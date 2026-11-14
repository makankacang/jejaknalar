import { prepareAssessmentScoring } from "./b07-scoring-input.ts";
const quest = {
  objective_ids: ["LO-TEST"],
  steps: [{ type: "read_document", ref: "DOC-TEST" }, {
    type: "select_evidence",
    item_id: "ITEM-TEST-1",
  }, { type: "select_evidence", item_id: "ITEM-TEST-2" }],
};
const rubric = {
  items: [{ item_id: "ITEM-TEST-1", objective_id: "LO-TEST", max_points: 50 }, {
    item_id: "ITEM-TEST-2",
    objective_id: "LO-TEST",
    max_points: 50,
  }],
};
const answers = [{ item_id: "ITEM-TEST-1", value: "contoh jawaban" }];
const check = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const rejects = (run: () => unknown) => {
  let rejected = false;
  try {
    run();
  } catch {
    rejected = true;
  }
  check(rejected, "Expected invalid input to be rejected");
};
Deno.test("valid assessment input", () => {
  const result = prepareAssessmentScoring(quest, rubric, [{
    item_id: "ITEM-TEST-1",
    value: "A",
  }, { item_id: "ITEM-TEST-2", value: "B" }]);
  check(
    result.items.length === 2 && result.answers.length === 2 &&
      result.missing_item_ids.length === 0,
    "Valid input mismatch",
  );
});
Deno.test("partial answer tracks missing item", () => {
  const result = prepareAssessmentScoring(quest, rubric, answers);
  check(
    result.missing_item_ids.length === 1 &&
      result.missing_item_ids[0] === "ITEM-TEST-2",
    "Missing item not detected",
  );
});
Deno.test("unknown answer item rejected", () => {
  rejects(() =>
    prepareAssessmentScoring(quest, rubric, [{
      item_id: "ITEM-UNKNOWN",
      value: "A",
    }])
  );
});
Deno.test("duplicate answer item rejected", () => {
  rejects(() =>
    prepareAssessmentScoring(quest, rubric, [answers[0], answers[0]])
  );
});
Deno.test("rubric with wrong learning objective rejected", () => {
  rejects(() =>
    prepareAssessmentScoring(quest, {
      items: [
        { ...rubric.items[0], objective_id: "LO-WRONG" },
        rubric.items[1],
      ],
    }, answers)
  );
});
Deno.test("invalid rubric points rejected", () => {
  rejects(() =>
    prepareAssessmentScoring(quest, {
      items: [{ ...rubric.items[0], max_points: 0 }, rubric.items[1]],
    }, answers)
  );
});
