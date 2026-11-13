// deno-lint-ignore-file no-import-prefix
/**
 * B12 — Teacher Learning Objective Review.
 *
 * POST /learning-objectives/:objective_id/review
 * Body: { review_status: "approved" | "rejected" }
 *
 * Only the teacher who owns the objective's module
 * may change its review status.
 */

import { Hono } from 'npm:hono@4.6.14';
import { createClient } from 'npm:@supabase/supabase-js@2.46.2';
import { uuidToPublicLoId } from './lo-identity.ts';

export const loReviewRoutes = new Hono();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

loReviewRoutes.post('/:objective_id/review', async (c) => {
  const requestId = crypto.randomUUID();

  const fail = (status: 401 | 404 | 422 | 500, code: string, message: string) =>
    c.json(
      {
        ok: false,
        error: { code, message },
        request_id: requestId,
      },
      status,
    );

  const bearer = /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '');

  if (!bearer) {
    return fail(401, 'UNAUTHORIZED', 'Token guru diperlukan');
  }

  const objectiveId = c.req.param('objective_id');

  if (!uuidPattern.test(objectiveId)) {
    return fail(422, 'VALIDATION_ERROR', 'Objective ID tidak valid');
  }

  const body: unknown = await c.req.json().catch(() => null);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail(422, 'VALIDATION_ERROR', 'JSON tidak valid');
  }

  const input = body as Record<string, unknown>;
  const reviewStatus = input.review_status;

  if (
    Object.keys(input).length !== 1 ||
    (reviewStatus !== 'approved' && reviewStatus !== 'rejected')
  ) {
    return fail(
      422,
      'VALIDATION_ERROR',
      'review_status harus approved atau rejected',
    );
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !anonKey || !serviceKey) {
    return fail(500, 'INTERNAL_ERROR', 'Konfigurasi server belum siap');
  }

  const teacherDb = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${bearer[1]}`,
      },
    },
  });

  const { data: identity, error: authError } = await teacherDb.auth.getUser(
    bearer[1],
  );

  if (authError || !identity.user) {
    return fail(401, 'UNAUTHORIZED', 'Sesi guru tidak valid');
  }

  const admin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Find the canonical objective and its parent module.
  const { data: objective, error: objectiveError } = await admin
    .from('learning_objectives')
    .select('id,module_id')
    .eq('id', objectiveId)
    .maybeSingle();

  if (objectiveError) {
    console.error('[B12] LO lookup failed', {
      requestId,
      code: objectiveError.code,
    });

    return fail(
      500,
      'INTERNAL_ERROR',
      'Gagal memverifikasi Learning Objective',
    );
  }

  if (!objective) {
    return fail(404, 'NOT_FOUND', 'Learning Objective tidak ditemukan');
  }

  // Use the teacher JWT to verify ownership under RLS.
  const { data: ownedModule, error: moduleError } = await teacherDb
    .from('modules')
    .select('id')
    .eq('id', objective.module_id)
    .eq('owner_uid', identity.user.id)
    .maybeSingle();

  if (moduleError) {
    console.error('[B12] LO ownership lookup failed', {
      requestId,
      code: moduleError.code,
    });

    return fail(500, 'INTERNAL_ERROR', 'Gagal memverifikasi kepemilikan modul');
  }

  if (!ownedModule) {
    return fail(404, 'NOT_FOUND', 'Learning Objective tidak ditemukan');
  }

  // Privileged update occurs only after ownership verification.
  const { data: updated, error: updateError } = await admin
    .from('learning_objectives')
    .update({
      review_status: reviewStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', objectiveId)
    .eq('module_id', ownedModule.id)
    .select('id,review_status')
    .single();

  if (updateError || !updated) {
    console.error('[B12] LO review update failed', {
      requestId,
      code: updateError?.code,
    });

    return fail(
      500,
      'INTERNAL_ERROR',
      'Gagal menyimpan persetujuan Learning Objective',
    );
  }

  return c.json({
    ok: true,
    data: {
      objective_id: updated.id,
      public_lo_id: uuidToPublicLoId(updated.id),
      review_status: updated.review_status,
    },
    request_id: requestId,
  });
});
