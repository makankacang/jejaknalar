import { describe, expect, it, vi } from 'vitest';
import { StudentApiClient, StudentApiError } from './client';
import { InMemoryStudentCredential, StudentSessionApi } from './session';
import {
  createSubmission, StudentAssessmentApi, StudentSubmitController,
  hasOfficialBedaJalur, type PublishedItemCatalog,
} from './assessment';
import {
  StudentCheckpointApi, matchesWorldAndRegistry, parseUiProgress,
  type UiProgress,
} from './checkpoint';

const uuid = '11111111-1111-4111-8111-111111111111';
const attempt = '22222222-2222-4222-8222-222222222222';
const classId = '33333333-3333-4333-8333-333333333333';
const catalog: PublishedItemCatalog = {
  origin: 'published-quest', quest_version_id: 'QV-REAL-01', item_ids: ['ITEM-REAL-1'],
};
const progress: UiProgress = {
  kind: 'jejaknalar.pic-d.ui.v1', registry_version: 'D-school-1.4-sprint2-1', world: 'school',
  room: 'school.library', position: { x: 120, y: 200 }, heading: 'down',
  visited: ['school.courtyard', 'school.library'],
  ui_task_statuses: { observe: 'completed' }, local_evidence_ids: ['evidence.demo'],
};
const response = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (data: unknown) => ({ ok: true, request_id: 'r-01', data });
function client(handler: (url: string, init: RequestInit) => Promise<Response>, code: string | null = 'ACCESS-CODE') {
  return new StudentApiClient({
    baseUrl: 'https://unit.supabase.co/functions/v1/student-api',
    accessCode: () => code,
    publicApiKey: 'public-anon-key',
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init ?? {})) as typeof fetch,
  });
}

describe('B-05 HTTP and student session', () => {
  it('uses exact base path, access code, public auth, and no credentials on join', async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const api = client(async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/join')) {
        return response(ok({ student_session_id: uuid, access_code: 'CODE',
          recovery_token: 'RECOVERY', class_id: classId, class_name: 'Kelas A' }), 201);
      }
      return response(ok({ student_session_id: uuid, class_id: classId, display_name: 'Siswa' }));
    });
    const service = new StudentSessionApi(api);
    const joined = await service.join(classId, 'ABCDEFGH', ' Siswa ');
    expect(joined.recovery_token).toBe('RECOVERY');
    expect(await service.session()).toEqual({ student_session_id: uuid, class_id: classId, display_name: 'Siswa' });
    expect(calls[0].url).toBe(`https://unit.supabase.co/functions/v1/student-api/classes/${classId}/join`);
    expect((calls[0].options.headers as Record<string, string>)['X-Student-Access-Code']).toBeUndefined();
    expect((calls[1].options.headers as Record<string, string>)['X-Student-Access-Code']).toBe('ACCESS-CODE');
    expect((calls[1].options.headers as Record<string, string>).apikey).toBe('public-anon-key');
    expect(calls[1].options.credentials).toBe('omit');
    expect(calls[1].options.cache).toBe('no-store');
  });

  it('rejects missing credential before making a request', async () => {
    const f = vi.fn(async () => response(ok({})));
    await expect(client(f, null).request('/session', { method: 'GET', expectedStatus: 200 }))
      .rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(f).not.toHaveBeenCalled();
  });

  it('does not persist access code and supports explicit clearing', () => {
    const code = new InMemoryStudentCredential();
    code.set('  ABCD  ');
    expect(code.get()).toBe('ABCD');
    code.clear();
    expect(code.get()).toBeNull();
  });

  it('treats 401 and 409 as structured errors without leaking upstream messages', async () => {
    const api = client(async () => response({
      ok: false, request_id: 'request-409', error: { code: 'CONFLICT', message: 'HIDDEN-SECRET' },
    }, 409));
    try { await api.request('/session', { method: 'GET', expectedStatus: 200 });
      throw new Error('expected reject');
    } catch (err) {
      expect(err).toBeInstanceOf(StudentApiError);
      expect((err as StudentApiError).code).toBe('CONFLICT');
      expect((err as StudentApiError).message).not.toContain('HIDDEN-SECRET');
    }
  });

  it('rejects insecure remote base URLs', () => {
    expect(() => new StudentApiClient({ baseUrl: 'http://unit.supabase.co/functions/v1/student-api' }))
      .toThrow('B05_BASE_URL_INVALID');
  });
});

describe('B-05 assessment is pending, not scored', () => {
  it('requires exactly published item IDs and rejects duplicate/invented IDs', () => {
    expect(() => createSubmission(catalog, [{ item_id: 'ITEM-FAKE', value: 'yes' }], uuid)).toThrow();
    expect(() => createSubmission(catalog, [
      { item_id: 'ITEM-REAL-1', value: 'yes' }, { item_id: 'ITEM-REAL-1', value: 'no' },
    ], uuid)).toThrow();
    expect(createSubmission(catalog, [{ item_id: 'ITEM-REAL-1', value: 'yes' }], uuid)
      .idempotency_key).toBe(uuid);
  });

  it('submits 202 pending_scoring without next_path and no fake grade', async () => {
    const api = client(async (url, init) => {
      expect(url.endsWith('/assessments/submit')).toBe(true);
      expect(init.method).toBe('POST');
      const body = JSON.parse(String(init.body)) as { idempotency_key: string };
      expect(body.idempotency_key).toBe(uuid);
      return response(ok({ attempt_id: attempt, status: 'pending_scoring', replayed: false }), 202);
    });
    const controller = new StudentSubmitController(new StudentAssessmentApi(api));
    controller.prepare(catalog, [{ item_id: 'ITEM-REAL-1', value: 'yes' }], uuid);
    const accepted = await controller.submitOrRetry();
    expect(accepted).toEqual({ attempt_id: attempt, status: 'pending_scoring', replayed: false, request_id: 'r-01' });
    expect(hasOfficialBedaJalur(accepted)).toBe(false);
    expect('score' in accepted).toBe(false);
    expect('next_path' in accepted).toBe(false);
  });

  it('retries same payload and key after a lost response', async () => {
    let calls = 0;
    const submitted: string[] = [];
    const api = client(async (_url, init) => {
      calls++;
      submitted.push(String(init.body));
      if (calls === 1) throw new Error('connection dropped');
      return response(ok({ attempt_id: attempt, status: 'pending_scoring', replayed: true }), 202);
    });
    const controller = new StudentSubmitController(new StudentAssessmentApi(api));
    controller.prepare(catalog, [{ item_id: 'ITEM-REAL-1', value: 'yes' }], uuid);
    await expect(controller.submitOrRetry()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(controller.phase).toBe('error');
    const receipt = await controller.submitOrRetry();
    expect(receipt.replayed).toBe(true);
    expect(submitted).toEqual([submitted[0], submitted[0]]);
    expect(calls).toBe(2);
    await controller.submitOrRetry();
    expect(calls).toBe(2);
  });

  it('rejects fake scored response even with HTTP 202', async () => {
    const api = client(async () => response(ok({ attempt_id: attempt, status: 'scored',
      score: 90, feedback: [], next_path: 'ready_for_extension', replayed: false }), 202));
    const req = createSubmission(catalog, [{ item_id: 'ITEM-REAL-1', value: 'x' }], uuid);
    await expect(new StudentAssessmentApi(api).submit(req)).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });
});

describe('B-05 UI checkpoint optimistic revision', () => {
  it('handles first-time checkpoint null', async () => {
    const api = client(async () => response(ok({ checkpoint: null })));
    expect(await new StudentCheckpointApi(api).load(catalog.quest_version_id)).toBeNull();
  });

  it('sends expected_revision 0 and accepts revision 1', async () => {
    const api = client(async (url, init) => {
      expect(url.endsWith('/checkpoints/QV-REAL-01')).toBe(true);
      const body = JSON.parse(String(init.body)) as { expected_revision: number; progress: UiProgress };
      expect(body.expected_revision).toBe(0);
      expect('feedback' in body.progress).toBe(false);
      expect('score' in body.progress).toBe(false);
      return response(ok({ checkpoint: { checkpoint_id: uuid, quest_version_id: 'QV-REAL-01',
        revision: 1, progress, updated_at: '2026-11-13T00:00:00Z' } }));
    });
    const cp = await new StudentCheckpointApi(api).save('QV-REAL-01', 0, progress);
    expect(cp.revision).toBe(1);
    expect(matchesWorldAndRegistry(cp.progress, 'school', 'D-school-1.4-sprint2-1')).toBe(true);
  });

  it('preserves 409 revision conflict and does not silently re-save', async () => {
    const f = vi.fn(async () => response({ ok: false, request_id: 'r-409',
      error: { code: 'CONFLICT', message: 'checkpoint changed' } }, 409));
    await expect(new StudentCheckpointApi(client(f)).save('QV-REAL-01', 1, progress))
      .rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('rejects scoring-shaped or invalid checkpoint UI payloads', () => {
    expect(() => parseUiProgress({ ...progress, score: 100 })).toThrow();
    expect(() => parseUiProgress({ ...progress, position: { x: Infinity, y: 20 } })).toThrow();
  });
});
