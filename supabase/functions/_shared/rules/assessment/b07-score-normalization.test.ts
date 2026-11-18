import { normalizeAssessmentPoints as score } from "./b07-score-normalization.ts";
function rejects(fn: () => unknown): void {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  if (!failed) throw new Error("Expected rejection");
}
const rubric = [{ criterion: "argument", points: 3 }, {
  criterion: "evidence",
  points: 2,
}];
Deno.test("B07 normalizes trusted points", () => {
  const r = score(rubric, "sufficient", { argument: 2, evidence: 1 });
  if (
    r.outcome !== "scored" || r.score !== 60 || r.earned_points !== 3 ||
    r.max_points !== 5
  ) throw new Error("Wrong normalized score");
});
Deno.test("B07 supports zero and full scores", () => {
  const a = score(rubric, "sufficient", { argument: 0, evidence: 0 });
  const b = score(rubric, "sufficient", { argument: 3, evidence: 2 });
  if (
    a.outcome !== "scored" || a.score !== 0 || b.outcome !== "scored" ||
    b.score !== 100
  ) throw new Error("Wrong score boundary");
});
Deno.test("B07 preserves insufficient evidence without a score", () => {
  const r = score(rubric, "insufficient_evidence", null);
  if (
    r.outcome !== "insufficient_evidence" || r.score !== null ||
    r.earned_points !== null || r.max_points !== 5
  ) throw new Error("Insufficient evidence was scored");
});
Deno.test("B07 rejects missing and unknown criteria", () => {
  rejects(() => score(rubric, "sufficient", { argument: 2 }));
  rejects(() =>
    score(rubric, "sufficient", { argument: 2, evidence: 1, extra: 1 })
  );
});
Deno.test("B07 rejects invalid rubric and point values", () => {
  rejects(() => score([], "sufficient", {}));
  rejects(() =>
    score(
      [{ criterion: "a", points: 1 }, { criterion: "a", points: 2 }],
      "sufficient",
      { a: 1 },
    )
  );
  rejects(() => score(rubric, "sufficient", { argument: 4, evidence: 1 }));
  rejects(() => score(rubric, "sufficient", { argument: -1, evidence: 1 }));
  rejects(() =>
    score(rubric, "sufficient", { argument: Number.NaN, evidence: 1 })
  );
});
Deno.test("B07 rejects fake scoring for insufficient evidence", () => {
  rejects(() =>
    score(rubric, "insufficient_evidence", { argument: 0, evidence: 0 })
  );
  rejects(() => score(rubric, "sufficient", null));
});
Deno.test("B07 rounds fractional scores", () => {
  const r = score([{ criterion: "a", points: 3 }], "sufficient", { a: 1 });
  if (r.outcome !== "scored" || r.score !== 33) {
    throw new Error("Wrong rounding");
  }
});
