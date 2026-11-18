import {
  publicObjectiveUuids,
  verifyApprovedSource,
} from "./b07-verified-source.ts";

const teacher = "44444444-4444-4444-8444-444444444444";
const moduleId = "11111111-1111-4111-8111-111111111111";
const version = "22222222-2222-4222-8222-222222222222";
const lo1 = "33333333-3333-4333-8333-333333333333";
const lo2 = "55555555-5555-4555-8555-555555555555";
const good = {
  questPayload: {
    objective_ids: [`LO-${lo1.toUpperCase()}`, `LO-${lo2.toUpperCase()}`],
  },
  publishedApprovedBy: teacher,
  objectiveRows: [lo1, lo2].map((id) => ({
    id,
    module_id: moduleId,
    text_version: version,
    review_status: "approved",
  })),
  moduleRow: { id: moduleId, owner_uid: teacher },
  snapshotRow: {
    module_id: moduleId,
    text_version: version,
    extracted_text: "Teks pembelajaran yang disetujui berdasarkan sumber asli.",
  },
};
function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}
function rejects(input: Parameters<typeof verifyApprovedSource>[0]) {
  let thrown = false;
  try {
    verifyApprovedSource(input);
  } catch {
    thrown = true;
  }
  assert(thrown, "Expected unverified source to be rejected");
}
Deno.test("source: accepted LO identities tie to one approved teacher snapshot", () => {
  assert(
    verifyApprovedSource(good) === good.snapshotRow.extracted_text,
    "source mismatch",
  );
  assert(
    publicObjectiveUuids(good.questPayload).length === 2,
    "missing objectives",
  );
});
Deno.test("source: foreign teacher is rejected", () => {
  rejects({
    ...good,
    publishedApprovedBy: "99999999-9999-4999-8999-999999999999",
  });
});
Deno.test("source: LO must all exist and be approved", () => {
  rejects({ ...good, objectiveRows: good.objectiveRows.slice(0, 1) });
  rejects({
    ...good,
    objectiveRows: [good.objectiveRows[0], {
      ...good.objectiveRows[1],
      review_status: "pending",
    }],
  });
});
Deno.test("source: objective cannot point to a different text version", () => {
  rejects({
    ...good,
    objectiveRows: [good.objectiveRows[0], {
      ...good.objectiveRows[1],
      text_version: "99999999-9999-4999-8999-999999999999",
    }],
  });
});
Deno.test("source: objective cannot point to another module", () => {
  rejects({
    ...good,
    objectiveRows: [good.objectiveRows[0], {
      ...good.objectiveRows[1],
      module_id: "99999999-9999-4999-8999-999999999999",
    }],
  });
});
Deno.test("source: duplicate or fabricated public IDs are rejected", () => {
  rejects({
    ...good,
    questPayload: {
      objective_ids: [`LO-${lo1.toUpperCase()}`, `LO-${lo1.toUpperCase()}`],
    },
  });
  rejects({ ...good, questPayload: { objective_ids: ["LO-FIXTURE-001"] } });
  rejects({
    ...good,
    objectiveRows: [good.objectiveRows[0], {
      ...good.objectiveRows[1],
      id: lo1,
    }],
  });
});
Deno.test("source: snapshot cannot be substituted", () => {
  rejects({
    ...good,
    snapshotRow: {
      ...good.snapshotRow,
      text_version: "99999999-9999-4999-8999-999999999999",
    },
  });
  rejects({
    ...good,
    snapshotRow: { ...good.snapshotRow, extracted_text: " " },
  });
  rejects({
    ...good,
    snapshotRow: { ...good.snapshotRow, extracted_text: "A".repeat(20_001) },
  });
});
