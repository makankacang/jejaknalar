import {
  type FinalizationRpc,
  finalizeClaimedAssessment,
  makeFinalizationPayload,
} from "./b07-claimed-finalization.ts";
import type { ValidatedEvaluation } from "./b07-trusted-evaluation.ts";

const claim = {
  attempt_id: "c41b0cbd-7563-4f8d-b28c-a9d90ebdf4e2",
  claim_token: "78963413-bef0-4eda-8a3b-e9a032995cfd",
};
const rubricId = "4a2ddc52-f021-4328-b6b1-176838d1c34c";
const resultId = "e6dbd0a4-d135-4c90-8ae2-d69df1980b77";
const item: ValidatedEvaluation = {
  item_id: "ITEM-TEST-01",
  objective_id: "LO-TEST-01",
  outcome: "scored",
  score: 75,
  earned_points: 3,
  max_points: 4,
  feedback: ["Perbaiki kutipan bukti."],
  evidence: ["Sepeda itu berwarna merah."],
};
function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}
async function rejects(fn: () => Promise<unknown>) {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
  }
  assert(rejected, "Expected rejection");
}
class FakeDb implements FinalizationRpc {
  calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  fail = false;
  response: unknown = null;
  async rpc(name: string, args: Record<string, unknown>) {
    await Promise.resolve();
    this.calls.push({ name, args });
    if (this.fail) return { data: null, error: { message: "expired claim" } };
    return {
      data: this.response ?? [{
        attempt_id: claim.attempt_id,
        status: args.p_outcome,
        replayed: false,
        result_id: resultId,
      }],
      error: null,
    };
  }
}
Deno.test("B07 finalization computes score from validated points", () => {
  const payload = makeFinalizationPayload([item]);
  assert(
    payload.outcome === "scored" && payload.score === 75,
    "Wrong aggregate",
  );
  assert(
    payload.objective_results[0].objective_id === item.objective_id,
    "Identity changed",
  );
});
Deno.test("B07 finalization accepts incorrect but evaluable zero score", () => {
  const payload = makeFinalizationPayload([{
    ...item,
    score: 0,
    earned_points: 0,
  }]);
  assert(
    payload.outcome === "scored" && payload.score === 0,
    "Zero score rejected",
  );
});
Deno.test("B07 finalization keeps all-insufficient as null", () => {
  const payload = makeFinalizationPayload([{
    ...item,
    outcome: "insufficient_evidence",
    score: null,
    earned_points: null,
  }]);
  assert(
    payload.outcome === "insufficient_evidence" && payload.score === null,
    "Expected null",
  );
});
Deno.test("B07 finalization grades partial item batches by weighted totals", () => {
  const payload = makeFinalizationPayload([
    item,
    {
      ...item,
      item_id: "ITEM-TEST-02",
      outcome: "insufficient_evidence",
      score: null,
      earned_points: null,
    },
  ]);
  assert(
    payload.outcome === "scored" && payload.score === 38,
    "Wrong partial aggregate",
  );
});
Deno.test("B07 finalization always calls the token-protected RPC", async () => {
  const db = new FakeDb();
  const response = await finalizeClaimedAssessment(
    db,
    claim,
    rubricId,
    [item],
    "b07-semantic-v1",
  );
  assert(
    response.result_id === resultId && response.status === "scored",
    "Wrong ACK",
  );
  assert(db.calls.length === 1, "Expected exactly one RPC");
  assert(
    db.calls[0].name === "b07_finalize_claimed_assessment_score",
    "Unprotected RPC used",
  );
  assert(
    db.calls[0].args.p_claim_token === claim.claim_token,
    "Missing claim token",
  );
  assert(db.calls[0].args.p_rubric_version_id === rubricId, "Rubric changed");
});
Deno.test("B07 finalization fails closed if DB rejects expired claim", async () => {
  const db = new FakeDb();
  db.fail = true;
  await rejects(() =>
    finalizeClaimedAssessment(db, claim, rubricId, [item], "b07-semantic-v1")
  );
});
Deno.test("B07 finalization rejects missing claim token before DB access", async () => {
  const db = new FakeDb();
  await rejects(() =>
    finalizeClaimedAssessment(db, { ...claim, claim_token: "" }, rubricId, [
      item,
    ], "b07-semantic-v1")
  );
  assert(db.calls.length === 0, "Invalid token reached DB");
});
Deno.test("B07 finalization rejects malformed ACK", async () => {
  const db = new FakeDb();
  db.response = [{
    attempt_id: "wrong",
    status: "scored",
    replayed: false,
    result_id: resultId,
  }];
  await rejects(() =>
    finalizeClaimedAssessment(db, claim, rubricId, [item], "b07-semantic-v1")
  );
});
Deno.test("B07 finalization rejects replay mismatching scoring outcome", async () => {
  const db = new FakeDb();
  db.response = [{
    attempt_id: claim.attempt_id,
    status: "insufficient_evidence",
    replayed: true,
    result_id: resultId,
  }];
  await rejects(() =>
    finalizeClaimedAssessment(db, claim, rubricId, [item], "b07-semantic-v1")
  );
});
Deno.test("B07 finalization prevents duplicate assessment IDs", () => {
  let failed = false;
  try {
    makeFinalizationPayload([item, item]);
  } catch {
    failed = true;
  }
  assert(failed, "Duplicate accepted");
});
Deno.test("B07 finalization rejects impossible normalized scores", () => {
  let failed = false;
  try {
    makeFinalizationPayload([{ ...item, score: 100 }]);
  } catch {
    failed = true;
  }
  assert(failed, "Inflated score accepted");
});
Deno.test("B07 finalization rejects malformed feedback and evidence", () => {
  let failed = false;
  try {
    makeFinalizationPayload([{ ...item, feedback: [] }]);
  } catch {
    failed = true;
  }
  assert(failed, "Empty feedback accepted");
});
