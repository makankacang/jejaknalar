import { validateAndNormalizeStoryBundle } from "./validator.ts";
import type { QuestStoryGenerationInput } from "./types.ts";

type JsonObject = Record<string, unknown>;

async function readJson<T>(relativePath: string): Promise<T> {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(await Deno.readTextFile(url)) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const exampleDir = "./examples/bi8/";

Deno.test("BI8 Story Bundle is normalized against local C-01 source excerpts", async () => {
  const [bundle, manifest] = await Promise.all([
    readJson<JsonObject>(`${exampleDir}story_bundle_draft_v01.json`),
    readJson<JsonObject>(`${exampleDir}source_manifest.test.json`),
  ]);

  const document = manifest.document as JsonObject;
  const stagingReference = manifest.staging_reference_from_pic_b as JsonObject;
  const sourceMap = manifest.sources as Array<Record<string, unknown>>;
  const registry = manifest.trusted_registry_candidate as JsonObject;
  const objectiveId = "LO-8A857C13-422A-4C5B-AD8A-8403955C067E";
  const expectedDocumentId = "doc_a305829d3917b4ca";
  const expectedTextVersion = "1c8e29fe-698d-4d6c-ad2b-ff178de1ace2";

  assert(stagingReference.document_id === expectedDocumentId, "document_id staging berubah dari lock PIC B");
  assert(stagingReference.text_version === expectedTextVersion, "text_version staging berubah dari lock PIC B");
  assert(document.document_id === expectedDocumentId, "document_id parser lokal tidak cocok dengan staging lock");
  assert(manifest.source_map_verified_in_staging === false, "Manifest lokal tidak boleh mengklaim verifikasi staging");

  const input: QuestStoryGenerationInput = {
    questVersionId: "QV-BI8-B1S5-REDAKSI-001",
    objectives: [{
      id: objectiveId,
      statement:
        "Peserta didik dapat mengidentifikasi paragraf deskripsi dan eksposisi dalam teks, serta dapat menulis kedua jenis paragraf ini dengan baik.",
    }],
    document: {
      documentId: expectedDocumentId,
      textVersion: expectedTextVersion,
      format: "docx",
      extractedText: sourceMap.map((source) => String(source.text)).join("\n\n"),
      sourceMap: sourceMap as QuestStoryGenerationInput["document"]["sourceMap"],
    },
    registry: {
      version: String(registry.version),
      worldPreset: "school",
      startRoomId: String(registry.startRoomId),
      roomIds: registry.roomIds as string[],
      npcIds: registry.npcIds as string[],
      objectIds: registry.objectIds as string[],
    },
    learningContext: {
      grade: 8,
      subject: "Bahasa Indonesia",
      topic: "Mengidentifikasi paragraf deskripsi dan eksposisi dalam Laporan Hasil Observasi",
    },
  };

  const normalized = validateAndNormalizeStoryBundle(bundle, input);
  assert(normalized.quest_version_id === input.questVersionId, "quest_version_id tidak cocok");
  assert(normalized.source_document_versions.length === 1, "Dokumen sumber harus tunggal");
  assert(
    normalized.source_document_versions[0].document_id === input.document.documentId,
    "document_id hasil normalisasi tidak cocok",
  );
  assert(normalized.missions.length === 2, "Kandidat harus memiliki dua mission");
  assert(normalized.tasks.length === 2, "Kandidat harus memiliki dua task");
  assert(
    normalized.tasks.some((task) => task.activity_id === "ACT-BI8-REDAKSI-OBSERVE-01"),
    "Task observe BI8 tidak ditemukan",
  );
  assert(
    normalized.tasks.some((task) => task.activity_id === "ACT-BI8-REDAKSI-INVESTIGATE-01"),
    "Task investigate BI8 tidak ditemukan",
  );

  const allowedSourceIds = new Set(sourceMap.map((source) => String(source.id)));
  for (const task of normalized.tasks) {
    for (const ref of task.source_refs) {
      assert(allowedSourceIds.has(ref.source_map_id), `Source tidak dikenal: ${ref.source_map_id}`);
      assert(ref.document_id === input.document.documentId, "document_id source ref tidak trusted");
      assert(ref.text_version === input.document.textVersion, "text_version source ref tidak trusted");
    }
  }

  // This is a local-content binding test, not proof of staging source-map equality.
  assert(manifest.source_map_verified_in_staging === false, "Status staging tidak boleh diasumsikan PASS");
  assert((document.filename as string).endsWith(".docx"), "Manifest bukan DOCX");
  assert(registry.version === "D-school-1.4-sprint2-1", "Registry pin kandidat berubah tanpa konfirmasi PIC D");
});

Deno.test("BI8 public contracts retain locked QuestV1 and assessment identity", async () => {
  const [quest, presentation, bundle] = await Promise.all([
    readJson<JsonObject>(`${exampleDir}questv1_bi8_candidate.json`),
    readJson<JsonObject>(`${exampleDir}student_presentation.json`),
    readJson<JsonObject>(`${exampleDir}story_bundle_draft_v01.json`),
  ]);

  const itemId = "ITEM-BI8-B1S5-REDAKSI-KLASIFIKASI-001";
  const questVersionId = "QV-BI8-B1S5-REDAKSI-001";
  const steps = quest.steps as Array<Record<string, unknown>>;
  const assessmentSteps = steps.filter((step) => step.type === "select_evidence");
  const readSteps = steps.filter((step) => step.type === "read_document");
  const responseFields = presentation.response_fields as Array<Record<string, unknown>>;
  const submission = presentation.submission as JsonObject;

  assert(quest.schema_version === "1.0", "QuestV1 schema version berubah");
  assert(quest.quest_id === "QUEST-BI8-B1S5-REDAKSI-001", "quest_id tidak cocok");
  assert(quest.quest_version_id === questVersionId, "quest_version_id tidak cocok");
  assert(bundle.quest_version_id === questVersionId, "Story Bundle tidak berpasangan dengan QuestV1");
  assert(assessmentSteps.length === 1, "Harus tepat satu step select_evidence");
  assert(assessmentSteps[0].id === "submit-bi8-classification", "Assessment step ID berubah");
  assert(assessmentSteps[0].item_id === itemId, "Assessment item ID berubah");
  assert(readSteps.length === 1, "Harus tepat satu step read_document");
  assert(readSteps[0].ref === "doc_a305829d3917b4ca", "Document ref bukan dokumen BI8");
  assert(responseFields.length === 6, "Student presentation harus memiliki enam bagian respons");
  assert(submission.item_id === itemId, "Submission item ID tidak cocok");
  assert(submission.value_type === "string", "Submission harus satu string");
  assert(submission.allow_partial_submission === true, "Respons parsial harus diizinkan");
  assert(submission.frontend_validation?.toString().includes("Do not block partial answers") ?? true,
    "Frontend tidak boleh memblokir jawaban parsial");
});
