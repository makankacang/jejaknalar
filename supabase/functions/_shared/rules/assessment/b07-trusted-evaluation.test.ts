import { validateTrustedEvaluations } from "./b07-trusted-evaluation.ts";

function assert(condition: unknown, msg: string) {
  if (!condition) throw new Error(msg);
}
function rejects(action: () => unknown) {
  let rejected = false;
  try {
    action();
  } catch {
    rejected = true;
  }
  assert(rejected, "Expected evaluator output to be rejected");
}

// Synthetic contract fixture only. Not the teacher-approved BI8 private rubric.
const itemId = "ITEM-SYNTHETIC-001";
const spec = {
  items: [{
    item_id: itemId,
    max_points: 10,
    objective_id: "LO-SYNTHETIC",
    rubric: [
      { criterion: "classification_a", points: 2 },
      { criterion: "classification_b", points: 2 },
      { criterion: "evidence_a", points: 2 },
      { criterion: "evidence_b", points: 2 },
      { criterion: "reasoning", points: 2 },
    ],
  }],
};
const prepared = {
  items: [{ item_id: itemId, objective_id: "LO-SYNTHETIC", max_points: 10 }],
  answers: [{ item_id: itemId, value: "Paragraf A: deskripsi; bukti: ..." }],
  missing_item_ids: [],
};
const evaluated = {
  item_id: itemId,
  evidence_status: "sufficient",
  awarded_points: {
    classification_a: 2,
    classification_b: 1,
    evidence_a: 2,
    evidence_b: 1,
    reasoning: 1,
  },
  feedback: ["Perjelas bukti pada paragraf B."],
  evidence: ["Paragraf A: deskripsi"],
};

Deno.test("B07 trusted evaluator: valid breakdown normalizes to 70/100", () => {
  const output = validateTrustedEvaluations(prepared, spec, [evaluated]);
  assert(output.length === 1 && output[0].score === 70, "Expected 70/100");
  assert(
    output[0].objective_id === "LO-SYNTHETIC",
    "Objective binding changed",
  );
});
Deno.test("B07 trusted evaluator: wrong but evaluable response may score 0", () => {
  const output = validateTrustedEvaluations(prepared, spec, [{
    ...evaluated,
    awarded_points: Object.fromEntries(
      Object.keys(evaluated.awarded_points).map((k) => [k, 0]),
    ),
  }]);
  assert(
    output[0].outcome === "scored" && output[0].score === 0,
    "Zero score rejected",
  );
});
Deno.test("B07 trusted evaluator: insufficient evidence has null score", () => {
  const output = validateTrustedEvaluations(prepared, spec, [{
    ...evaluated,
    evidence_status: "insufficient_evidence",
    awarded_points: null,
  }]);
  assert(
    output[0].outcome === "insufficient_evidence" && output[0].score === null,
    "Expected null score",
  );
});
Deno.test("B07 trusted evaluator: rejects fabricated item IDs", () => {
  rejects(() =>
    validateTrustedEvaluations(prepared, spec, [{
      ...evaluated,
      item_id: "ITEM-OTHER",
    }])
  );
});
Deno.test("B07 trusted evaluator: rejects changed rubric maximum", () => {
  rejects(() =>
    validateTrustedEvaluations(prepared, {
      items: [{
        ...spec.items[0],
        rubric: [{ criterion: "reasoning", points: 2 }],
      }],
    }, [evaluated])
  );
});
Deno.test("B07 trusted evaluator: rejects missing or inflated criterion points", () => {
  rejects(() =>
    validateTrustedEvaluations(prepared, spec, [{
      ...evaluated,
      awarded_points: { classification_a: 2 },
    }])
  );
  rejects(() =>
    validateTrustedEvaluations(prepared, spec, [{
      ...evaluated,
      awarded_points: { ...evaluated.awarded_points, reasoning: 3 },
    }])
  );
});
Deno.test("B07 trusted evaluator: rejects numeric scores for empty answers", () => {
  rejects(() =>
    validateTrustedEvaluations(
      { ...prepared, answers: [{ item_id: itemId, value: " " }] },
      spec,
      [evaluated],
    )
  );
});
Deno.test("B07 trusted evaluator: rejects points for insufficient evidence", () => {
  rejects(() =>
    validateTrustedEvaluations(prepared, spec, [{
      ...evaluated,
      evidence_status: "insufficient_evidence",
    }])
  );
});
Deno.test("B07 trusted evaluator: requires valid feedback", () => {
  rejects(() =>
    validateTrustedEvaluations(prepared, spec, [{ ...evaluated, feedback: [] }])
  );
  rejects(() =>
    validateTrustedEvaluations(prepared, spec, [{
      ...evaluated,
      feedback: ["X".repeat(1001)],
    }])
  );
});
