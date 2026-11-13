// deno-lint-ignore-file no-import-prefix
/**
 * JejakNalar B-02 (Day 2): Supabase Edge Function `api`.
 * POST /functions/v1/api/classes  -> OpenAPI operation POST /classes
 *
 * Auth: Supabase teacher JWT validated with auth.getUser(token).
 * DB: PostgREST request uses the SAME user JWT so RLS applies.
 * Service-role credentials are never used here.
 * Only the class-creation endpoint is implemented in Day 2.
 */

import { teacherReportRoutes } from './teacher-report.ts';
import { type Context, Hono } from 'npm:hono@4.6.14';
import { cors } from 'npm:hono@4.6.14/cors';
import { uuidToPublicLoId } from './lo-identity.ts';
import { moduleSnapshotRoutes } from './module-snapshots.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.46.2';
import { questReviewRoutes } from './quest-review.ts';
import { loReviewRoutes } from './lo-review.ts';
import { questPublishRoutes } from './quest-publish.ts';

const app = new Hono().basePath('/api');
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 unambiguous chars
const allowedOrigins = (
  Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  '/*',
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : ''),
    allowHeaders: ['authorization', 'apikey', 'content-type', 'x-client-info'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
);

function generateClassCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b & 31]).join('');
}

function responseError(
  c: Context,
  status: 401 | 404 | 409 | 422 | 500,
  code:
    | 'UNAUTHORIZED'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'VALIDATION_ERROR'
    | 'INTERNAL_ERROR',
  message: string,
  requestId: string,
) {
  return c.json(
    { ok: false, error: { code, message }, request_id: requestId },
    status,
  );
}

app.post('/classes', async (c) => {
  const requestId = crypto.randomUUID();
  const authHeader = c.req.header('authorization') ?? '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(authHeader);
  if (!match) {
    return responseError(
      c,
      401,
      'UNAUTHORIZED',
      'Token guru diperlukan',
      requestId,
    );
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    console.error(
      '[JejakNalar] Missing Supabase server environment',
      requestId,
    );
    return responseError(
      c,
      500,
      'INTERNAL_ERROR',
      'Konfigurasi server belum siap',
      requestId,
    );
  }

  const token = match[1];
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Never trust a decoded, unverified JWT, and never use the service-role key here.
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return responseError(
      c,
      401,
      'UNAUTHORIZED',
      'Sesi guru tidak valid',
      requestId,
    );
  }

  const parsed: unknown = await c.req.json().catch(() => null);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return responseError(
      c,
      422,
      'VALIDATION_ERROR',
      'JSON request tidak valid',
      requestId,
    );
  }
  const body = parsed as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const grade = body.grade;
  if (
    name.length < 1 ||
    name.length > 80 ||
    !Number.isInteger(grade) ||
    (grade as number) < 7 ||
    (grade as number) > 9
  ) {
    return responseError(
      c,
      422,
      'VALIDATION_ERROR',
      'name harus 1–80 karakter dan grade harus 7, 8, atau 9',
      requestId,
    );
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('classes')
      .insert({
        teacher_uid: userData.user.id,
        name,
        grade,
        class_code: generateClassCode(),
      })
      .select('id,name,grade,class_code')
      .single();

    if (!error && data) {
      return c.json(
        {
          ok: true,
          data: {
            class_id: data.id,
            class_code: data.class_code,
            name: data.name,
            grade: data.grade,
          },
          request_id: requestId,
        },
        201,
      );
    }
    if (error?.code === '23505') continue; // Extremely unlikely class_code collision.
    console.error('[JejakNalar] createClass database error', {
      requestId,
      code: error?.code,
    });
    return responseError(
      c,
      500,
      'INTERNAL_ERROR',
      'Kelas gagal dibuat',
      requestId,
    );
  }
  return responseError(
    c,
    409,
    'CONFLICT',
    'Gagal mengalokasikan kode kelas, coba lagi',
    requestId,
  );
});

// B-03: Guru mengambil status dan hasil Learning Analyzer.
app.get('/analysis-jobs/:analysis_job_id', async (c) => {
  const requestId = crypto.randomUUID();
  const jobId = c.req.param('analysis_job_id');

  // analysis_jobs.id menggunakan UUID.
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(jobId)) {
    return responseError(
      c,
      422,
      'VALIDATION_ERROR',
      'analysis_job_id tidak valid',
      requestId,
    );
  }

  // Wajib menggunakan JWT guru yang valid.
  const authHeader = c.req.header('authorization') ?? '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(authHeader);

  if (!match) {
    return responseError(
      c,
      401,
      'UNAUTHORIZED',
      'Token guru diperlukan',
      requestId,
    );
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    return responseError(
      c,
      500,
      'INTERNAL_ERROR',
      'Konfigurasi server belum siap',
      requestId,
    );
  }

  const token = match[1];

  // Menggunakan JWT guru agar RLS tetap berlaku.
  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return responseError(
      c,
      401,
      'UNAUTHORIZED',
      'Sesi guru tidak valid',
      requestId,
    );
  }

  // RLS memastikan guru hanya membaca job dari modulnya.
  const { data: job, error: jobError } = await supabase
    .from('analysis_jobs')
    .select(
      'id,module_id,text_version,status,result_status,warnings,error_code,error_message,retryable',
    )
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) {
    console.error('[B-03] Job query failed', {
      requestId,
      code: jobError.code,
    });

    return responseError(
      c,
      500,
      'INTERNAL_ERROR',
      'Gagal mengambil analysis job',
      requestId,
    );
  }

  if (!job) {
    return responseError(
      c,
      404,
      'NOT_FOUND',
      'Analysis job tidak ditemukan',
      requestId,
    );
  }

  // Hasil LO hanya diberikan setelah analisis selesai.
  let objectives: unknown[] = [];

  if (job.status === 'completed') {
    const { data, error } = await supabase
      .from('learning_objectives')
      .select('id,statement,basis,source_references,review_status')
      .eq('analysis_job_id', job.id);

    if (error) {
      console.error('[B-03] Objectives query failed', {
        requestId,
        code: error.code,
      });

      return responseError(
        c,
        500,
        'INTERNAL_ERROR',
        'Gagal mengambil hasil analisis',
        requestId,
      );
    }

    objectives = (data ?? []).map((objective) => ({
      ...objective,
      public_lo_id: uuidToPublicLoId(objective.id),
    }));
  }

  return c.json({
    ok: true,
    data: {
      analysis_job_id: job.id,
      module_id: job.module_id,
      text_version: job.text_version,
      status: job.status,
      result_status: job.result_status ?? null,
      warnings: job.warnings ?? [],
      objectives,
      failure:
        job.status === 'failed'
          ? {
              code: job.error_code ?? 'AI_UNAVAILABLE',
              message: job.error_message ?? 'Analisis gagal',
              retryable: job.retryable ?? false,
            }
          : null,
    },
    request_id: requestId,
  });
});

// B-03: Guru membuat pekerjaan Learning Analyzer.
app.post('/modules/analyze', async (c) => {
  const requestId = crypto.randomUUID();

  const authHeader = c.req.header('authorization') ?? '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(authHeader);

  if (!match) {
    return responseError(
      c,
      401,
      'UNAUTHORIZED',
      'Token guru diperlukan',
      requestId,
    );
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !anonKey || !serviceKey) {
    console.error('[B-03] Missing server configuration', requestId);
    return responseError(
      c,
      500,
      'INTERNAL_ERROR',
      'Konfigurasi server belum siap',
      requestId,
    );
  }

  const token = match[1];

  // Client guru: query dibatasi RLS.
  const teacherDb = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: userData, error: authError } =
    await teacherDb.auth.getUser(token);

  if (authError || !userData.user) {
    return responseError(
      c,
      401,
      'UNAUTHORIZED',
      'Sesi guru tidak valid',
      requestId,
    );
  }

  const parsed: unknown = await c.req.json().catch(() => null);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return responseError(
      c,
      422,
      'VALIDATION_ERROR',
      'JSON request tidak valid',
      requestId,
    );
  }

  const body = parsed as Record<string, unknown>;
  const moduleId = body.module_id;
  const textVersion = body.text_version;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    typeof moduleId !== 'string' ||
    typeof textVersion !== 'string' ||
    !uuidPattern.test(moduleId) ||
    !uuidPattern.test(textVersion)
  ) {
    return responseError(
      c,
      422,
      'VALIDATION_ERROR',
      'module_id dan text_version harus UUID valid',
      requestId,
    );
  }

  // Pastikan modul milik guru yang sedang login.
  const { data: module, error: moduleError } = await teacherDb
    .from('modules')
    .select('id')
    .eq('id', moduleId)
    .eq('owner_uid', userData.user.id)
    .maybeSingle();

  if (moduleError) {
    console.error('[B-03] Module query failed', {
      requestId,
      code: moduleError.code,
    });
    return responseError(
      c,
      500,
      'INTERNAL_ERROR',
      'Gagal memeriksa modul',
      requestId,
    );
  }

  if (!module) {
    return responseError(
      c,
      404,
      'NOT_FOUND',
      'Modul tidak ditemukan',
      requestId,
    );
  }

  // Pastikan snapshot versi teks ada dan dapat dibaca guru.
  const { data: snapshot, error: snapshotError } = await teacherDb
    .from('module_text_versions')
    .select('text_version')
    .eq('module_id', moduleId)
    .eq('text_version', textVersion)
    .maybeSingle();

  if (snapshotError) {
    console.error('[B-03] Snapshot query failed', {
      requestId,
      code: snapshotError.code,
    });
    return responseError(
      c,
      500,
      'INTERNAL_ERROR',
      'Gagal memeriksa versi teks',
      requestId,
    );
  }

  if (!snapshot) {
    return responseError(
      c,
      404,
      'NOT_FOUND',
      'Versi teks tidak ditemukan',
      requestId,
    );
  }

  // Client server tepercaya, dibuat hanya setelah
  // JWT dan kepemilikan modul diverifikasi.
  // Jangan pernah mengirim serviceKey ke browser.
  const adminDb = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Gunakan job aktif yang sudah ada agar klik berulang
  // tidak membuat banyak job untuk versi teks yang sama.
  const { data: existingJob, error: existingError } = await adminDb
    .from('analysis_jobs')
    .select('id,status')
    .eq('module_id', moduleId)
    .eq('text_version', textVersion)
    .in('status', ['queued', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error('[B-03] Existing job query failed', {
      requestId,
      code: existingError.code,
    });
    return responseError(
      c,
      500,
      'INTERNAL_ERROR',
      'Gagal memeriksa analysis job',
      requestId,
    );
  }

  if (existingJob) {
    return c.json(
      {
        ok: true,
        data: {
          analysis_job_id: existingJob.id,
          status: existingJob.status,
        },
        request_id: requestId,
      },
      202,
    );
  }

  // Simpan job baru dengan status queued.
  const { data: job, error: insertError } = await adminDb
    .from('analysis_jobs')
    .insert({
      module_id: moduleId,
      text_version: textVersion,
      status: 'queued',
    })
    .select('id,status')
    .single();

  if (insertError?.code === '23505') {
    const { data: activeJob, error: activeError } = await adminDb
      .from('analysis_jobs')
      .select('id,status')
      .eq('module_id', moduleId)
      .eq('text_version', textVersion)
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeError && activeJob) {
      return c.json(
        {
          ok: true,
          data: {
            analysis_job_id: activeJob.id,
            status: activeJob.status,
          },
          request_id: requestId,
        },
        202,
      );
    }
  }

  if (insertError || !job) {
    console.error('[B-03] Job insert failed', {
      requestId,
      code: insertError?.code,
    });
    return responseError(
      c,
      500,
      'INTERNAL_ERROR',
      'Gagal membuat analysis job',
      requestId,
    );
  }

  return c.json(
    {
      ok: true,
      data: {
        analysis_job_id: job.id,
        status: job.status,
      },
      request_id: requestId,
    },
    202,
  );
});

// B06: Experimental quest workflow.
// Disabled by default; enable only for controlled local HTTP tests.
if (Deno.env.get('B06_ENABLE_QUEST_DEMO_ROUTES') === 'true') {
  app.route('/quests', questReviewRoutes);
  app.route('/quests', questPublishRoutes);
}

// B08: Teacher-owned class reports.
app.route('/classes', teacherReportRoutes);

// B03 follow-up: Teacher-owned C-01 parser snapshots.
app.route('/modules', moduleSnapshotRoutes);

app.route('/learning-objectives', loReviewRoutes);

Deno.serve(app.fetch);
