/**
 * PIC D -> B-05 HTTP boundary. No service-role key, no persistent credential,
 * no authoritative scoring in the browser.
 * The B-05 routes are PROVISIONAL and are not yet aligned with OpenAPI.
 */
export type BackendErrorCode =
  | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION_ERROR'
  | 'RATE_LIMITED' | 'INTERNAL_ERROR' | 'NETWORK_ERROR' | 'BAD_RESPONSE';

export class StudentApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: BackendErrorCode,
    readonly requestId: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'StudentApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT';
type RequestOptions = { method: Method; expectedStatus: number; expectedStatuses?: readonly number[]; auth?: boolean; body?: unknown };
export type StudentApiConfig = {
  /** Full base path, e.g. https://PROJECT.supabase.co/functions/v1/student-api */
  baseUrl: string;
  /** Student access code is held in memory and supplied at call time. */
  accessCode?: () => string | null | undefined;
  /** Supabase anon/publishable key, never a service-role key. */
  publicApiKey?: string;
  fetchImpl?: typeof fetch;
};

const record = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
export const isRecord = record;

/** A malformed or hostile server payload never becomes an official result. */
export function successData(raw: unknown): { data: Record<string, unknown>; requestId: string } {
  if (!record(raw) || raw.ok !== true || !record(raw.data) ||
      typeof raw.request_id !== 'string' || !raw.request_id.trim()) {
    throw new StudentApiError(502, 'BAD_RESPONSE', null, 'Envelope respons B-05 tidak valid.');
  }
  return { data: raw.data, requestId: raw.request_id };
}

export class StudentApiClient {
  private readonly url: string;
  private readonly fetchFn: typeof fetch;
  private readonly accessCode?: () => string | null | undefined;
  private readonly publicApiKey?: string;

  constructor(config: StudentApiConfig) {
    let url: URL;
    try { url = new URL(config.baseUrl); }
    catch { throw new Error('B05_BASE_URL_INVALID'); }
    if (url.username || url.password || url.search || url.hash ||
        !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) ||
        !url.pathname.replace(/\/$/, '').endsWith('/functions/v1/student-api')) {
      throw new Error('B05_BASE_URL_INVALID');
    }
    this.url = url.href.replace(/\/$/, '');
    this.fetchFn = config.fetchImpl ?? fetch.bind(globalThis);
    this.accessCode = config.accessCode;
    this.publicApiKey = config.publicApiKey;
  }

  async request(path: string, opts: RequestOptions): Promise<unknown> {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('..') || path.includes('?') || path.includes('#')) {
      throw new Error('B05_ROUTE_INVALID');
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.publicApiKey) {
      headers.apikey = this.publicApiKey;
      headers.Authorization = `Bearer ${this.publicApiKey}`;
    }
    if (opts.auth !== false) {
      const code = this.accessCode?.();
      if (!code || !code.trim()) {
        throw new StudentApiError(401, 'UNAUTHORIZED', null, 'Kode akses siswa belum tersedia.');
      }
      headers['X-Student-Access-Code'] = code;
    }
    let res: Response;
    try {
      res = await this.fetchFn(this.url + path, {
        method: opts.method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        cache: 'no-store',
        credentials: 'omit',
      });
    } catch {
      throw new StudentApiError(0, 'NETWORK_ERROR', null, 'Koneksi terputus. Coba lagi tanpa mengganti idempotency key.');
    }
    let payload: unknown;
    try { payload = await res.json(); }
    catch { throw new StudentApiError(502, 'BAD_RESPONSE', null, 'Server tidak mengembalikan JSON.'); }
    if (!res.ok) {
      const body = record(payload) ? payload : null;
      const error = body && record(body.error) ? body.error : null;
      const rawCode = error?.code;
      const codes: BackendErrorCode[] = ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'VALIDATION_ERROR', 'RATE_LIMITED', 'INTERNAL_ERROR'];
      const code = typeof rawCode === 'string' && codes.includes(rawCode as BackendErrorCode)
        ? rawCode as BackendErrorCode : 'BAD_RESPONSE';
      const requestId = typeof body?.request_id === 'string' ? body.request_id : null;
      // Never interpolate upstream errors that might accidentally contain secrets.
      const message = code === 'CONFLICT' ? 'Konflik data. Periksa respons atau muat checkpoint terbaru.'
        : code === 'UNAUTHORIZED' ? 'Sesi siswa tidak valid. Masukkan kembali kode akses.'
        : code === 'FORBIDDEN' ? 'Akses ke sumber daya ini tidak diizinkan.'
        : code === 'RATE_LIMITED' ? 'Batas permintaan tercapai. Coba lagi nanti.'
        : code === 'VALIDATION_ERROR' ? 'Data tidak memenuhi validasi backend.'
        : 'Permintaan ke layanan siswa gagal.';
      throw new StudentApiError(res.status, code, requestId, message);
    }
    const acceptedStatuses = opts.expectedStatuses ?? [opts.expectedStatus];
    if (!acceptedStatuses.includes(res.status)) {
      throw new StudentApiError(502, 'BAD_RESPONSE', null,
        `Status B-05 tidak sesuai kontrak: HTTP ${res.status}, diharapkan ${acceptedStatuses.join(' atau ')}.`);
    }
    return payload;
  }
}
