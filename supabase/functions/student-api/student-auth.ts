// deno-lint-ignore-file no-import-prefix
// Supabase Edge Functions use pinned npm: imports.

import { createClient } from "npm:@supabase/supabase-js@2.46.2";

export interface VerifiedStudentSession {
  id: string;
  class_id: string;
  display_name: string;
}

export type StudentAuthResult =
  | { ok: true; session: VerifiedStudentSession }
  | { ok: false; reason: "UNAUTHORIZED" | "INTERNAL_ERROR" };

const accessCodePattern = /^[A-HJ-NP-Z2-9]{20}$/;

/**
 * Shared HMAC algorithm for issuing and verifying credentials.
 * Do not log the input, secret, or resulting credential.
 */
export async function hashStudentCredential(
  credential: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(credential),
  );

  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Always derive identity from a verified access code.
 * Never trust student_session_id supplied by the client.
 */
export async function authenticateStudentAccessCode(
  accessCode: string | undefined,
): Promise<StudentAuthResult> {
  if (!accessCode || !accessCodePattern.test(accessCode)) {
    return { ok: false, reason: "UNAUTHORIZED" };
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const hmacSecret = Deno.env.get("STUDENT_CREDENTIAL_HMAC_KEY");

  if (
    !url ||
    !serviceRoleKey ||
    !hmacSecret ||
    new TextEncoder().encode(hmacSecret).length < 32
  ) {
    return { ok: false, reason: "INTERNAL_ERROR" };
  }

  try {
    const accessCodeHash = await hashStudentCredential(accessCode, hmacSecret);

    const admin = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: session, error } = await admin
      .from("student_sessions")
      .select("id, class_id, display_name")
      .eq("access_code_hash", accessCodeHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (error) {
      console.error("[B-05] Student auth database error", {
        code: error.code,
      });

      return { ok: false, reason: "INTERNAL_ERROR" };
    }

    if (!session) {
      return { ok: false, reason: "UNAUTHORIZED" };
    }

    return {
      ok: true,
      session: {
        id: session.id,
        class_id: session.class_id,
        display_name: session.display_name,
      },
    };
  } catch {
    return { ok: false, reason: "INTERNAL_ERROR" };
  }
}
