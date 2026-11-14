import { runVerifiedClaimedScoring } from "./b07-worker-pipeline.ts";
import type { AIModel } from "../../ai/core/model.ts";
const teacher = "44444444-4444-4444-8444-444444444444";
const moduleId = "11111111-1111-4111-8111-111111111111";
const version = "22222222-2222-4222-8222-222222222222";
const lo = "33333333-3333-4333-8333-333333333333";
const attemptId = "66666666-6666-4666-8666-666666666666";
const claimToken = "77777777-7777-4777-8777-777777777777";
const rubricId = "88888888-8888-4888-8888-888888888888";
const item = "ITEM-B07-TEST";
const base = {
  claim: { attempt_id: attemptId, claim_token: claimToken },
  questPayload: {
    objective_ids: [`LO-${lo.toUpperCase()}`],
    steps: [{ type: "select_evidence", item_id: item }],
  },
  publishedApprovedBy: teacher,
  answers: [{ item_id: item, value: "Jawaban menyebutkan detail teks." }],
  rubricId,
  privateSpec: {
    items: [{
      item_id: item,
      objective_id: `LO-${lo.toUpperCase()}`,
      max_points: 2,
      prompt: "Apa bukti dalam teks?",
      rubric: [{ criterion: "evidence", points: 2 }],
    }],
  },
  objectiveRows: [{
    id: lo,
    module_id: moduleId,
    text_version: version,
    review_status: "approved",
  }],
  moduleRow: { id: moduleId, owner_uid: teacher },
  snapshotRow: {
    module_id: moduleId,
    text_version: version,
    extracted_text: "Teks memiliki informasi yang dapat dijadikan bukti.",
  },
  engineVersion: "b07-semantic-v1",
};
function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}
Deno.test("pipeline: evaluator produces validated points then protected RPC", async () => {
  let calls = 0;
  const model: AIModel = {
    generateStructuredOutput: () => {
      calls++;
      return Promise.resolve({
        evaluations: [{
          item_id: item,
          evidence_status: "sufficient",
          awarded_points: { evidence: 2 },
          feedback: ["Bukti relevan."],
          evidence: ["Detail teks."],
        }],
      });
    },
  };
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({
        data: [{
          attempt_id: attemptId,
          status: "scored",
          replayed: false,
          result_id: "99999999-9999-4999-8999-999999999999",
        }],
        error: null,
      });
    },
  };
  const result = await runVerifiedClaimedScoring({ ...base, db, model });
  assert(calls === 1, "Model should be called once");
  assert(rpcCalls.length === 1, "RPC should be called once");
  assert(
    rpcCalls[0].name === "b07_finalize_claimed_assessment_score",
    "unprotected RPC",
  );
  assert(rpcCalls[0].args.p_claim_token === claimToken, "claim not used");
  assert(rpcCalls[0].args.p_score === 100, "unexpected normalized score");
  assert(result.status === "scored", "incorrect finalization status");
});
Deno.test("pipeline: unapproved source must never invoke model or RPC", async () => {
  let called = false;
  const model: AIModel = {
    generateStructuredOutput: () => {
      called = true;
      return Promise.resolve({});
    },
  };
  const db = {
    rpc: () => {
      called = true;
      return Promise.resolve({ data: [], error: null });
    },
  };
  let rejected = false;
  try {
    await runVerifiedClaimedScoring({
      ...base,
      objectiveRows: [{ ...base.objectiveRows[0], review_status: "pending" }],
      db,
      model,
    });
  } catch {
    rejected = true;
  }
  assert(rejected && !called, "Unverified scoring source reached grading");
});
Deno.test("pipeline: provider error must never persist fake grade", async () => {
  let persisted = false;
  const db = {
    rpc: () => {
      persisted = true;
      return Promise.resolve({ data: [], error: null });
    },
  };
  const model: AIModel = {
    generateStructuredOutput: () => Promise.reject(new Error("MODEL_DOWN")),
  };
  let rejected = false;
  try {
    await runVerifiedClaimedScoring({ ...base, db, model });
  } catch {
    rejected = true;
  }
  assert(rejected && !persisted, "Model failure persisted an invented score");
});
Deno.test("pipeline: DB finalization rejection is never counted as success", async () => {
  const db = {
    rpc: () =>
      Promise.resolve({ data: null, error: { message: "expired claim" } }),
  };
  const model: AIModel = {
    generateStructuredOutput: () =>
      Promise.resolve({
        evaluations: [{
          item_id: item,
          evidence_status: "sufficient",
          awarded_points: { evidence: 2 },
          feedback: ["Bukti relevan."],
          evidence: ["Detail teks."],
        }],
      }),
  };
  let rejected = false;
  try {
    await runVerifiedClaimedScoring({ ...base, db, model });
  } catch {
    rejected = true;
  }
  assert(rejected, "Expired claim accepted");
});
