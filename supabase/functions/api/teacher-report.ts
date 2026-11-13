// deno-lint-ignore-file no-import-prefix
import { Hono } from 'npm:hono@4.6.14';
import { createClient } from 'npm:@supabase/supabase-js@2.46.2';

export const teacherReportRoutes = new Hono();

const uuidPattern =
  /**
   * B09: Do not expose provisional adaptive paths as official.
   * Keep policy status visible so clients can distinguish
   * unavailable decisions from approved ones.
   */
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function hideUnapprovedAdaptivePaths(
  report: Record<string, unknown>,
): Record<string, unknown> {
  const safe = structuredClone(report);

  if (Array.isArray(safe.students)) {
    for (const entry of safe.students) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }

      const student = entry as Record<string, unknown>;

      if (student.last_policy_status !== 'approved') {
        student.last_adaptive_path = null;
      }
    }
  }

  if (Array.isArray(safe.attempt_history)) {
    for (const entry of safe.attempt_history) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }

      const attempt = entry as Record<string, unknown>;

      if (attempt.policy_status !== 'approved') {
        attempt.next_path = null;
      }
    }
  }

  return safe;
}

/**
 * B08: Teacher-owned class assessment report.
 *
 * GET /api/classes/:class_id/report
 *
 * JWT identity is verified by Supabase Auth.
 * The database RPC independently checks class ownership.
 *
 * Never accept teacher_uid from the request.
 * Never return student answers, private rubrics, or raw evidence.
 */
teacherReportRoutes.get('/:class_id/report', async (c) => {
  const requestId = crypto.randomUUID();

  c.header('Cache-Control', 'no-store');

  const bearer = /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '');

  if (!bearer) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token guru diperlukan',
        },
        request_id: requestId,
      },
      401,
    );
  }

  const classId = c.req.param('class_id');

  if (!uuidPattern.test(classId)) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID kelas tidak valid',
        },
        request_id: requestId,
      },
      422,
    );
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !anonKey || !serviceKey) {
    console.error('[B08] Missing report configuration', { requestId });

    return c.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Konfigurasi server belum siap',
        },
        request_id: requestId,
      },
      500,
    );
  }

  try {
    const teacherAuth = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Validate the JWT with Supabase Auth, not by decoding it.
    const { data: identity, error: authError } = await teacherAuth.auth.getUser(
      bearer[1],
    );

    if (authError || !identity.user) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Sesi guru tidak valid',
          },
          request_id: requestId,
        },
        401,
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // This service-role-only RPC enforces:
    // classes.teacher_uid = verified teacher UID.
    const { data: report, error: reportError } = await admin.rpc(
      'b08_teacher_class_report',
      {
        p_teacher_uid: identity.user.id,
        p_class_id: classId,
      },
    );

    if (reportError) {
      if (reportError.code === '42501') {
        // Do not disclose whether another teacher's class exists.
        return c.json(
          {
            ok: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Laporan kelas tidak ditemukan',
            },
            request_id: requestId,
          },
          404,
        );
      }

      console.error('[B08] Report RPC failed', {
        requestId,
        code: reportError.code,
      });

      return c.json(
        {
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Gagal mengambil laporan kelas',
          },
          request_id: requestId,
        },
        500,
      );
    }

    if (!report || typeof report !== 'object' || Array.isArray(report)) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Format laporan tidak valid',
          },
          request_id: requestId,
        },
        500,
      );
    }

    return c.json({
      ok: true,
      data: hideUnapprovedAdaptivePaths(report as Record<string, unknown>),
      request_id: requestId,
    });
  } catch {
    console.error('[B08] Unexpected teacher report error', {
      requestId,
    });

    return c.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Terjadi kesalahan server',
        },
        request_id: requestId,
      },
      500,
    );
  }
});
