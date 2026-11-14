import { isRecord, StudentApiClient, StudentApiError, successData } from './client';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const classCode = /^[A-HJ-NP-Z2-9]{8}$/;

export type JoinCredentials = {
  student_session_id: string;
  access_code: string;
  recovery_token: string;
  class_id: string;
  class_name: string;
};
export type StudentIdentity = { student_session_id: string; class_id: string; display_name: string };

export class StudentSessionApi {
  constructor(private readonly api: StudentApiClient) {}

  /** Public join creates one new session; never store credentials in localStorage. */
  async join(classId: string, code: string, displayName: string): Promise<JoinCredentials> {
    const normalizedCode = code.trim().toUpperCase();
    const normalizedName = displayName.trim();
    if (!uuid.test(classId) || !classCode.test(normalizedCode) || !normalizedName || normalizedName.length > 80) {
      throw new StudentApiError(422, 'VALIDATION_ERROR', null, 'ID kelas, kode kelas, atau nama siswa tidak valid.');
    }
    const { data } = successData(await this.api.request(`/classes/${classId}/join`, {
      method: 'POST', expectedStatus: 201, auth: false,
      body: { class_code: normalizedCode, display_name: normalizedName },
    }));
    if (!uuid.test(String(data.student_session_id)) || !uuid.test(String(data.class_id)) ||
      typeof data.access_code !== 'string' || !data.access_code ||
      typeof data.recovery_token !== 'string' || !data.recovery_token ||
      typeof data.class_name !== 'string') {
      throw new StudentApiError(502, 'BAD_RESPONSE', null, 'Respons join siswa tidak valid.');
    }
    return data as JoinCredentials;
  }

  async session(): Promise<StudentIdentity> {
    const { data } = successData(await this.api.request('/session', { method: 'GET', expectedStatus: 200 }));
    if (!uuid.test(String(data.student_session_id)) || !uuid.test(String(data.class_id)) ||
      typeof data.display_name !== 'string' || !data.display_name.trim()) {
      throw new StudentApiError(502, 'BAD_RESPONSE', null, 'Respons sesi siswa tidak valid.');
    }
    return data as StudentIdentity;
  }
}

/** Credential lives only in this object; a refresh requires explicit re-entry. */
export class InMemoryStudentCredential {
  private code: string | null = null;
  set(code: string): void {
    if (typeof code !== 'string' || !code.trim()) throw new Error('STUDENT_ACCESS_CODE_REQUIRED');
    this.code = code.trim();
  }
  get = (): string | null => this.code;
  clear(): void { this.code = null; }
}

/** Narrow response guard; never treat an arbitrary object as an authenticated session. */
export const hasStudentIdentity = (value: unknown): value is StudentIdentity =>
  isRecord(value) && uuid.test(String(value.student_session_id)) &&
  uuid.test(String(value.class_id)) && typeof value.display_name === 'string';
