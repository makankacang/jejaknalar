import { handleAssessmentScoringRequest } from "./index.ts";
const url = "https://example.invalid/functions/v1/assessment-scoring-worker";
async function check(response: Response, status: number, error: string) {
  const body = await response.json();
  if (response.status !== status || body.error !== error) {
    throw new Error(
      `Expected ${status}/${error}, got ${response.status}/${body.error}`,
    );
  }
}
Deno.test("scoring worker rejects unsafe requests before database access", async () => {
  const keys = [
    "ASSESSMENT_SCORING_WORKER_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ASSESSMENT_SCORING_ENGINE_READY",
  ];
  const original = keys.map((key) => Deno.env.get(key));
  try {
    await check(
      await handleAssessmentScoringRequest(new Request(url)),
      405,
      "METHOD_NOT_ALLOWED",
    );
    Deno.env.delete(keys[0]);
    await check(
      await handleAssessmentScoringRequest(
        new Request(url, { method: "POST" }),
      ),
      503,
      "WORKER_NOT_CONFIGURED",
    );
    const secret = "S".repeat(40);
    Deno.env.set(keys[0], secret);
    await check(
      await handleAssessmentScoringRequest(
        new Request(url, { method: "POST" }),
      ),
      401,
      "UNAUTHORIZED",
    );
    await check(
      await handleAssessmentScoringRequest(
        new Request(url, {
          method: "POST",
          headers: { "x-worker-secret": "wrong" },
        }),
      ),
      401,
      "UNAUTHORIZED",
    );
    await check(
      await handleAssessmentScoringRequest(
        new Request(url, {
          method: "POST",
          headers: { "x-worker-secret": "X".repeat(513) },
        }),
      ),
      401,
      "UNAUTHORIZED",
    );
    Deno.env.set(keys[1], "https://example.invalid");
    Deno.env.set(keys[2], "test-service-key");
    Deno.env.set(keys[3], "true");
    await check(
      await handleAssessmentScoringRequest(
        new Request(url, {
          method: "POST",
          headers: { "x-worker-secret": secret },
        }),
      ),
      503,
      "SCORING_ENGINE_NOT_IMPLEMENTED",
    );
  } finally {
    keys.forEach((key, i) => {
      if (original[i] === undefined) Deno.env.delete(key);
      else Deno.env.set(key, original[i]);
    });
  }
});
