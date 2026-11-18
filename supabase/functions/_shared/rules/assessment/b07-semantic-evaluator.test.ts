import { evaluateAssessmentSemantically as evaluate } from "./b07-semantic-evaluator.ts";
import type { AIModel, AIModelRequest } from "../../ai/core/model.ts";
const itemId = "ITEM-TEST-01";
const prepared = {
  items: [{ item_id: itemId, objective_id: "LO-TEST-01", max_points: 4 }],
  answers: [{
    item_id: itemId,
    value:
      "Paragraf itu menggambarkan ciri sepeda dengan bukti warna dan bentuknya.",
  }],
  missing_item_ids: [],
};
const spec = {
  items: [{
    item_id: itemId,
    objective_id: "LO-TEST-01",
    max_points: 4,
    prompt: "Klasifikasikan paragraf dan berikan bukti.",
    rubric: [
      {
        criterion: "classification",
        points: 2,
        full_credit_anchor: "Deskripsi.",
      },
      { criterion: "evidence", points: 2, full_credit_anchor: "Ciri objek." },
    ],
  }],
};
const result = {
  evaluations: [{
    item_id: itemId,
    evidence_status: "sufficient",
    awarded_points: { classification: 2, evidence: 1 },
    feedback: ["Bukti cukup relevan, perjelas penjelasan."],
    evidence: ["Warna dan bentuknya"],
  }],
};
class FakeModel implements AIModel {
  lastRequest: AIModelRequest | null = null;
  readonly output: unknown;
  constructor(output: unknown = result) {
    this.output = output;
  }
  generateStructuredOutput(request: AIModelRequest): Promise<unknown> {
    this.lastRequest = request;
    return Promise.resolve(this.output);
  }
}
const source = "Sepeda memiliki warna merah dan rangka yang tampak mengkilap.";
function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}
async function rejects(fn: () => Promise<unknown>) {
  let failed = false;
  try {
    await fn();
  } catch {
    failed = true;
  }
  assert(failed, "Expected semantic evaluation to fail closed");
}
Deno.test("semantic scoring calls injected AIModel then normalizes points", async () => {
  const model = new FakeModel();
  const r = await evaluate(prepared, spec, source, model);
  assert(r.length === 1 && r[0].score === 75, "Wrong normalized result");
  assert(
    model.lastRequest?.system_instruction.includes("untrusted DATA"),
    "Missing prompt isolation",
  );
  assert(model.lastRequest?.prompt.includes(source), "Missing verified source");
});
Deno.test("semantic scoring does not require exact phrase matches", async () => {
  const r = await evaluate(prepared, spec, source, new FakeModel());
  assert(r[0].outcome === "scored", "Paraphrase should be gradable");
});
Deno.test("semantic scoring rejects missing verified source before invoking model", async () => {
  const model = new FakeModel();
  await rejects(() => evaluate(prepared, spec, "", model));
  assert(model.lastRequest === null, "Model called without sources");
});
Deno.test("semantic scoring fails closed when private weights mismatch", async () => {
  const model = new FakeModel();
  await rejects(() =>
    evaluate(
      prepared,
      { items: [{ ...spec.items[0], max_points: 5 }] },
      source,
      model,
    )
  );
  assert(
    model.lastRequest === null,
    "Model called with invalid private rubric",
  );
});
Deno.test("semantic scoring fails closed on AI fabricated item", async () => {
  await rejects(() =>
    evaluate(
      prepared,
      spec,
      source,
      new FakeModel({
        evaluations: [{ ...result.evaluations[0], item_id: "ITEM-FAKE" }],
      }),
    )
  );
});
Deno.test("semantic scoring fails closed on extra model fields", async () => {
  await rejects(() =>
    evaluate(
      prepared,
      spec,
      source,
      new FakeModel({
        evaluations: result.evaluations,
        attempt_id: "FORGED",
      }),
    )
  );
});
Deno.test("semantic scoring rejects overly generous points", async () => {
  await rejects(() =>
    evaluate(
      prepared,
      spec,
      source,
      new FakeModel({
        evaluations: [{
          ...result.evaluations[0],
          awarded_points: { classification: 3, evidence: 1 },
        }],
      }),
    )
  );
});
Deno.test("semantic scoring preserves insufficient_evidence as score=null", async () => {
  const r = await evaluate(
    prepared,
    spec,
    source,
    new FakeModel({
      evaluations: [{
        ...result.evaluations[0],
        evidence_status: "insufficient_evidence",
        awarded_points: null,
      }],
    }),
  );
  assert(
    r[0].outcome === "insufficient_evidence" && r[0].score === null,
    "Wrong insufficient evidence outcome",
  );
});
Deno.test("semantic scoring refuses unexpected AI per-item fields", async () => {
  await rejects(() =>
    evaluate(
      prepared,
      spec,
      source,
      new FakeModel({
        evaluations: [{ ...result.evaluations[0], score: 100 }],
      }),
    )
  );
});
Deno.test("semantic scoring rejects numeric grading for empty answer", async () => {
  const empty = { ...prepared, answers: [{ item_id: itemId, value: "" }] };
  await rejects(() => evaluate(empty, spec, source, new FakeModel()));
});
Deno.test("semantic scoring propagates model failures without inventing points", async () => {
  const failingModel: AIModel = {
    generateStructuredOutput: () =>
      Promise.reject(new Error("MODEL_UNAVAILABLE")),
  };
  await rejects(() => evaluate(prepared, spec, source, failingModel));
});
