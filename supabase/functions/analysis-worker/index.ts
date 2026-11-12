import { createClient } from 'npm:@supabase/supabase-js@2.46.2';
import { OpenRouterModel } from '../_shared/ai/providers/openrouter-model.ts';
import type { LearningAnalyzerModel } from '../_shared/ai/learning-analyzer/types.ts';
import {
  analyzeLearningObjectives,
  GeminiRestModel,
  LearningAnalyzerError,
  isLearningAnalyzerError,
} from '../_shared/ai/learning-analyzer/index.ts';
import type {
  DocumentParseResult,
  LearningAnalysisResult,
} from '../_shared/ai/learning-analyzer/index.ts';

type ClaimedJob = {
  analysis_job_id: string;
  module_id: string;
  text_version: string;
  attempt_count: number;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

// Compare hashed secrets without exiting early on a mismatched byte.
async function secretsEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);

  const left = new Uint8Array(hashA);
  const right = new Uint8Array(hashB);
  let difference = 0;

  for (let i = 0; i < left.length; i++) {
    difference |= left[i] ^ right[i];
  }

  return difference === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  // Worker is server-to-server only, never a teacher-facing endpoint.
  const expectedSecret = Deno.env.get('ANALYSIS_WORKER_SECRET') ?? '';

  if (expectedSecret.length < 32) {
    return json(503, { ok: false, error: 'WORKER_NOT_CONFIGURED' });
  }

  const providedSecret = req.headers.get('x-worker-secret') ?? '';

  if (
    !providedSecret ||
    providedSecret.length > 512 ||
    !(await secretsEqual(providedSecret, expectedSecret))
  ) {
    return json(401, { ok: false, error: 'UNAUTHORIZED' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const provider =
    Deno.env.get('AI_PROVIDER')?.trim().toLowerCase() || 'gemini';

  // Do not claim a job until the selected provider is configured.
  if (!url || !serviceKey) {
    return json(503, {
      ok: false,
      error: 'WORKER_NOT_CONFIGURED',
    });
  }

  let model: LearningAnalyzerModel;

  try {
    if (provider === 'gemini') {
      const apiKey = Deno.env.get('GEMINI_API_KEY');
      const modelName = Deno.env.get('GEMINI_MODEL');

      if (!apiKey || !modelName) {
        return json(503, {
          ok: false,
          error: 'WORKER_NOT_CONFIGURED',
        });
      }

      model = new GeminiRestModel({
        apiKey,
        model: modelName,
        timeoutMs: 60_000,
      });
    } else if (provider === 'openrouter') {
      const apiKey = Deno.env.get('OPENROUTER_API_KEY');
      const modelName = Deno.env.get('OPENROUTER_MODEL');

      if (!apiKey || !modelName) {
        return json(503, {
          ok: false,
          error: 'WORKER_NOT_CONFIGURED',
        });
      }

      model = new OpenRouterModel({
        apiKey,
        model: modelName,
        timeoutMs: 100_000,
      });
    } else {
      return json(503, {
        ok: false,
        error: 'UNSUPPORTED_AI_PROVIDER',
      });
    }
  } catch {
    return json(503, {
      ok: false,
      error: 'MODEL_NOT_CONFIGURED',
    });
  }

  const db = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Atomic claim: queued -> processing.
  const { data: claimedRows, error: claimError } = await db.rpc(
    'b03_claim_next_analysis_job',
  );

  if (claimError) {
    console.error('[B-03 worker] Claim failed', {
      code: claimError.code,
    });
    return json(500, { ok: false, error: 'CLAIM_FAILED' });
  }

  const job = (claimedRows as ClaimedJob[] | null)?.[0];

  if (!job) {
    return json(200, {
      ok: true,
      data: { status: 'idle', message: 'Tidak ada job queued' },
    });
  }

  let result: LearningAnalysisResult | null = null;
  let failure: {
    code: string;
    message: string;
    retryable: boolean;
  } | null = null;

  try {
    // Read the exact immutable snapshot attached to this job.
    const { data: snapshot, error: snapshotError } = await db
      .from('module_text_versions')
      .select(
        'document_id,filename,format,mime_type,size_bytes,' +
          'extracted_text,source_map,metadata,warnings',
      )
      .eq('module_id', job.module_id)
      .eq('text_version', job.text_version)
      .maybeSingle();

    if (snapshotError) {
      throw new Error('Snapshot database query failed');
    }

    if (!snapshot) {
      throw new LearningAnalyzerError(
        'INVALID_INPUT',
        'Snapshot materi tidak ditemukan.',
      );
    }

    const document: DocumentParseResult = {
      documentId: snapshot.document_id ?? '',
      filename: snapshot.filename ?? '',
      format: snapshot.format as DocumentParseResult['format'],
      mimeType: snapshot.mime_type ?? '',
      sizeBytes:
        snapshot.size_bytes == null ? Number.NaN : Number(snapshot.size_bytes),
      extractedText: snapshot.extracted_text,
      sourceMap: snapshot.source_map as DocumentParseResult['sourceMap'],
      metadata: snapshot.metadata as DocumentParseResult['metadata'],
      warnings: snapshot.warnings as string[],
    };

    // PIC C validates metadata, source map and evidence references.
    result = await analyzeLearningObjectives(
      {
        module_id: job.module_id,
        text_version: job.text_version,
        document,
      },
      model,
    );
  } catch (error) {
    if (isLearningAnalyzerError(error)) {
      failure = {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      };
    } else {
      console.error('[B-03 worker] Unexpected processing error', {
        analysis_job_id: job.analysis_job_id,
      });

      failure = {
        code: 'INTERNAL_ERROR',
        message: 'Analisis belum dapat diselesaikan.',
        retryable: true,
      };
    }
  }

  // One database transaction saves objectives and finalizes the job.
  const { data: finished, error: finishError } = await db.rpc(
    'b03_finish_analysis_job',
    {
      p_job_id: job.analysis_job_id,
      p_attempt_count: job.attempt_count,
      p_outcome: failure ? 'failed' : result!.status,
      p_objectives: result?.objectives ?? [],
      p_warnings: result?.warnings ?? [],
      p_error_code: failure?.code ?? null,
      p_error_message: failure?.message ?? null,
      p_retryable: failure?.retryable ?? false,
    },
  );

  if (finishError || finished !== true) {
    console.error('[B-03 worker] Finalization failed', {
      analysis_job_id: job.analysis_job_id,
      code: finishError?.code,
    });

    return json(500, {
      ok: false,
      error: 'FINALIZATION_FAILED',
    });
  }

  return json(200, {
    ok: true,
    data: {
      analysis_job_id: job.analysis_job_id,
      status: failure ? 'failed' : 'completed',
      result_status: result?.status ?? null,
      objective_count: result?.objectives.length ?? 0,
    },
  });
});
