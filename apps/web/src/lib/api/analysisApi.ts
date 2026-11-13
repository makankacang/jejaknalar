
import { getSupabaseClient } from '../supabase/client';

export type AnalysisJobStatus =
    | 'queued'
    | 'processing'
    | 'completed'
    | 'failed';

export type AnalysisResultStatus =
    | 'completed'
    | 'insufficient_evidence'
    | null;

export interface AnalyzerSourceReference {
    source_type: string;
    source_map_id: string;
    page?: number;
    paragraph_index?: number;
    section?: string;
    excerpt: string;
}

export interface AnalyzerObjective {
    id: string;
    statement: string;
    basis: 'explicit' | 'inferred';
    source_references: AnalyzerSourceReference[];
    review_status: 'pending' | 'approved' | 'rejected';
}

export interface AnalysisFailure {
    code: string;
    message: string;
    retryable: boolean;
}

export interface AnalysisJob {
    analysis_job_id: string;
    module_id: string;
    text_version: string;
    status: AnalysisJobStatus;
    result_status: AnalysisResultStatus;
    warnings: string[];
    objectives: AnalyzerObjective[];
    failure: AnalysisFailure | null;
}

interface ApiEnvelope<T> {
    ok: boolean;
    data: T;
    request_id: string;
}

export interface StartAnalysisResult {
    analysis_job_id: string;
    status: 'queued' | 'processing';
}

export interface PollOptions {
    intervalMs?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
}

const DEFAULT_POLL_INTERVAL_MS = 2500;
const DEFAULT_TIMEOUT_MS = 180000;

export class AnalysisPollingTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(
            `Analisis belum selesai setelah ${Math.round(timeoutMs / 1000)} detik.`,
        );
        this.name = 'AnalysisPollingTimeoutError';
    }
}

function assertEnvelope<T>(
    response: ApiEnvelope<T> | null,
): T {
    if (!response || response.ok !== true || !response.data) {
        throw new Error('Respons API Analyzer tidak valid.');
    }

    return response.data;
}

/**
 * Membuat asynchronous Learning Objective Analysis job.
 *
 * Snapshot harus sudah disimpan sebelumnya.
 * text_version merupakan UUID dari backend.
 */
export async function startModuleAnalysis(
    moduleId: string,
    textVersion: string,
): Promise<StartAnalysisResult> {
    if (!moduleId.trim() || !textVersion.trim()) {
        throw new Error('module_id dan text_version wajib diisi.');
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.functions.invoke<
        ApiEnvelope<StartAnalysisResult>
    >('api/modules/analyze', {
        method: 'POST',
        body: {
            module_id: moduleId,
            text_version: textVersion,
        },
    });

    if (error) {
        throw new Error(`Gagal memulai analisis: ${error.message}`);
    }

    const result = assertEnvelope(data);

    if (
        !result.analysis_job_id ||
        !['queued', 'processing'].includes(result.status)
    ) {
        throw new Error('Respons pembuatan analysis job tidak valid.');
    }

    return result;
}

/**
 * Mengambil status dan hasil Learning Objective Analysis.
 */
export async function getAnalysisJob(
    analysisJobId: string,
): Promise<AnalysisJob> {
    if (!analysisJobId.trim()) {
        throw new Error('analysis_job_id wajib diisi.');
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.functions.invoke<
        ApiEnvelope<AnalysisJob>
    >(
        `api/analysis-jobs/${encodeURIComponent(analysisJobId)}`,
        {
            method: 'GET',
        },
    );

    if (error) {
        throw new Error(`Gagal mengambil analysis job: ${error.message}`);
    }

    const job = assertEnvelope(data);

    const validStatuses: AnalysisJobStatus[] = [
        'queued',
        'processing',
        'completed',
        'failed',
    ];

    if (!validStatuses.includes(job.status)) {
        throw new Error(`Status analysis job tidak dikenal: ${job.status}`);
    }

    return job;
}

/**
 * Polling sampai job mencapai completed atau failed.
 *
 * insufficient_evidence bukan kegagalan job.
 * Kondisi tersebut tetap dikembalikan sebagai hasil completed.
 */
export async function waitForAnalysisCompletion(
    analysisJobId: string,
    options: PollOptions = {},
): Promise<AnalysisJob> {
    const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const signal = options.signal;

    if (intervalMs < 500 || timeoutMs <= 0) {
        throw new Error('Konfigurasi polling tidak valid.');
    }

    const startTime = Date.now();

    while (true) {
        if (signal?.aborted) {
            throw new Error('Polling analisis dibatalkan.');
        }

        if (Date.now() - startTime >= timeoutMs) {
            throw new AnalysisPollingTimeoutError(timeoutMs);
        }

        const job = await getAnalysisJob(analysisJobId);

        if (job.status === 'completed' || job.status === 'failed') {
            return job;
        }

        const elapsed = Date.now() - startTime;

        if (elapsed >= timeoutMs) {
            throw new AnalysisPollingTimeoutError(timeoutMs);
        }

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, intervalMs);

            if (signal) {
                const onAbort = () => {
                    clearTimeout(timer);
                    reject(new Error('Polling analisis dibatalkan.'));
                };

                signal.addEventListener('abort', onAbort, { once: true });
            }
        });
    }
}
