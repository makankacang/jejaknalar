import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = process.cwd();
const bi8 = 'supabase/functions/_shared/ai/quest-generator/examples/bi8';
const read = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(root, relativePath), 'utf8'),
);
const fail = (message) => {
  throw new Error(message);
};

const quest = read(`${bi8}/questv1_bi8_candidate.json`);
const bundle = read(`${bi8}/story_bundle_draft_v01.json`);
const presentation = read(`${bi8}/student_presentation.json`);
const paired = read(`${bi8}/paired_binding_v2.json`);
const registryMapping = read(`${bi8}/registry_mapping.json`);
const manifest = read(`${bi8}/source_manifest.test.json`);

const expected = {
  questId: 'QUEST-BI8-B1S5-REDAKSI-001',
  questVersionId: 'QV-BI8-B1S5-REDAKSI-001',
  objectiveId: 'LO-8A857C13-422A-4C5B-AD8A-8403955C067E',
  itemId: 'ITEM-BI8-B1S5-REDAKSI-KLASIFIKASI-001',
  documentId: 'doc_a305829d3917b4ca',
  textVersion: '1c8e29fe-698d-4d6c-ad2b-ff178de1ace2',
  registryVersion: 'D-school-1.4-sprint2-1',
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

function validateSchema(schemaPath, data, label) {
  const schema = read(schemaPath);
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    console.error(validate.errors);
    fail(`${label} gagal validasi schema`);
  }
  console.log(`PASS schema: ${label}`);
}

validateSchema('contracts/quest.schema.json', quest, 'QuestV1 1.0');
validateSchema('contracts/story-bundle.schema.json', bundle, 'StoryBundleDraftV01');

// Keep the exact identity returned/locked by PIC B. Do not normalize or infer UUIDs.
if (quest.quest_id !== expected.questId || quest.quest_version_id !== expected.questVersionId) {
  fail('Quest identity tidak sesuai final lock PIC B');
}
if (bundle.quest_version_id !== expected.questVersionId) {
  fail('Quest/StoryBundle pair mismatch');
}
if (
  quest.objective_ids.length !== 1 ||
  quest.objective_ids[0] !== expected.objectiveId
) {
  fail('Quest harus menggunakan satu objective BI8 yang dikunci');
}
if (bundle.missions.some((mission) => !mission.objective_ids.includes(expected.objectiveId))) {
  fail('Ada Story Bundle mission yang tidak mengacu objective BI8');
}

const stagingRef = manifest.staging_reference_from_pic_b;
if (
  manifest.document?.document_id !== expected.documentId ||
  stagingRef?.document_id !== expected.documentId ||
  stagingRef?.text_version !== expected.textVersion
) {
  fail('Manifest local/staging reference tidak sama dengan document_id dan text_version lock PIC B');
}
if (manifest.source_map_verified_in_staging !== false) {
  fail('Manifest lokal tidak boleh mengklaim source-map staging terverifikasi tanpa bukti PIC B');
}
if (bundle.source_document_versions.length !== 1) {
  fail('Story Bundle BI8 harus menunjuk tepat satu dokumen sumber');
}
const bundleSourceVersion = bundle.source_document_versions[0];
if (
  bundleSourceVersion.document_id !== expected.documentId ||
  bundleSourceVersion.text_version !== expected.textVersion
) {
  fail('Story Bundle source_document_versions tidak sesuai lock PIC B');
}
console.log('PASS identity: Quest, StoryBundle, source document and locked staging version');

const readSteps = quest.steps.filter((step) => step.type === 'read_document');
const assessmentSteps = quest.steps.filter((step) => step.type === 'select_evidence');
if (readSteps.length !== 1 || readSteps[0].ref !== expected.documentId) {
  fail('Quest harus memiliki satu read_document dengan document ID BI8');
}
if (
  assessmentSteps.length !== 1 ||
  assessmentSteps[0].id !== 'submit-bi8-classification' ||
  assessmentSteps[0].item_id !== expected.itemId
) {
  fail('Quest harus mempertahankan satu assessment item BI8');
}

const bindings = paired.identity_bindings;
if (
  bindings.objective_id !== expected.objectiveId ||
  bindings.assessment_item_id !== expected.itemId ||
  bindings.staging_document_id !== expected.documentId ||
  bindings.staging_text_version !== expected.textVersion
) {
  fail('Paired binding tidak sesuai identitas final PIC B');
}
if (
  paired.quest?.quest_id !== expected.questId ||
  paired.quest?.quest_version_id !== expected.questVersionId ||
  paired.story_bundle?.quest_version_id !== expected.questVersionId
) {
  fail('Paired binding Quest/Story Bundle identity mismatch');
}
console.log('PASS paired step/item/document/text-version identity');

const responseFields = presentation.response_fields;
const expectedFields = [
  'paragraph_a_classification', 'paragraph_a_evidence', 'paragraph_a_reasoning',
  'paragraph_b_classification', 'paragraph_b_evidence', 'paragraph_b_reasoning',
];
const fieldIds = new Set(responseFields.map((field) => field.id));
if (
  responseFields.length !== expectedFields.length ||
  expectedFields.some((id) => !fieldIds.has(id))
) {
  fail('Student presentation harus mempertahankan enam response fields BI8');
}
if (
  presentation.submission.item_id !== expected.itemId ||
  presentation.submission.quest_version_id !== expected.questVersionId ||
  presentation.submission.value_type !== 'string' ||
  presentation.submission.allow_partial_submission !== true
) {
  fail('Kontrak Student presentation/submission tidak sesuai');
}
if (
  presentation.display_safety?.show_private_rubric !== false ||
  presentation.display_safety?.show_answer_key !== false ||
  presentation.display_safety?.show_score_before_backend_result !== false
) {
  fail('Display safety presentation tidak mengunci konten privat');
}
console.log('PASS student presentation: six fields, one string, partial allowed, no private rubric');

const registry = manifest.trusted_registry_candidate;
if (
  registry.version !== expected.registryVersion ||
  bundle.registry_version !== expected.registryVersion ||
  bundle.world_preset !== registry.worldPreset ||
  bundle.start_room_id !== registry.startRoomId ||
  registryMapping.effective_registry_pin_observed_in_D_audit !== expected.registryVersion
) {
  fail('Story Bundle dan registry candidate tidak memakai registry pin yang sama');
}
if (
  registryMapping.registry_file_status !== 'DESIGN_MOCK_NOT_PRODUCTION' ||
  !String(registry.status).includes('D CONFIRMATION REQUIRED')
) {
  fail('Status registry harus tetap provisional sampai PIC D mengonfirmasi runtime');
}
const allowedRooms = new Set(registry.roomIds);
const allowedNpcs = new Set(registry.npcIds);
const allowedObjects = new Set(registry.objectIds);
for (const task of bundle.tasks) {
  if (!allowedRooms.has(task.room_id) || !allowedObjects.has(task.object_id)) {
    fail(`Task ${task.activity_id} memakai room/object di luar allowlist registry`);
  }
}
for (const dialogue of bundle.dialogues) {
  if (!allowedRooms.has(dialogue.room_id) || !allowedNpcs.has(dialogue.npc_id)) {
    fail(`Dialogue ${dialogue.npc_id} memakai room/NPC di luar allowlist registry`);
  }
}
for (const mission of bundle.missions) {
  if (!allowedRooms.has(mission.room_id)) {
    fail(`Mission ${mission.mission_id} memakai room di luar allowlist registry`);
  }
}
console.log('PASS registry allowlist and provisional runtime status');

const sources = new Map(manifest.sources.map((source) => [source.id, source]));
const collected = [];
function walk(value) {
  if (Array.isArray(value)) return value.forEach(walk);
  if (!value || typeof value !== 'object') return;
  if (typeof value.source_map_id === 'string' && typeof value.excerpt === 'string') {
    collected.push(value);
  }
  Object.values(value).forEach(walk);
}
walk(bundle);
if (!collected.length) fail('Story Bundle tidak memiliki source references');
const normalize = (value) => String(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
const usedSourceIds = new Set();
for (const ref of collected) {
  const source = sources.get(ref.source_map_id);
  if (!source) fail(`Source map lokal tidak dikenal: ${ref.source_map_id}`);
  if (!normalize(source.text).includes(normalize(ref.excerpt))) {
    fail(`Kutipan tidak ditemukan pada ${ref.source_map_id}`);
  }
  if (ref.document_id !== expected.documentId || ref.text_version !== expected.textVersion) {
    fail(`Source reference identity tidak cocok: ${ref.source_map_id}`);
  }
  if (
    source.kind !== 'paragraph' ||
    ref.locator?.kind !== 'docx_paragraph' ||
    ref.locator?.paragraph_index !== source.paragraphIndex
  ) {
    fail(`Source locator tidak cocok dengan parser lokal: ${ref.source_map_id}`);
  }
  usedSourceIds.add(ref.source_map_id);
}
const expectedSourceIds = new Set(['DOC-P-559', 'DOC-P-599', 'DOC-P-596']);
if (
  usedSourceIds.size !== expectedSourceIds.size ||
  [...expectedSourceIds].some((id) => !usedSourceIds.has(id))
) {
  fail('Story Bundle harus mengacu tepat pada tiga locator BI8 yang disepakati');
}
console.log(`PASS local source excerpts and locators: ${collected.length} references, 3 required locators`);

const publicJson = JSON.stringify({ quest, bundle, presentation });
if (/\b(DOC-001|ITEM-001|LO-FIXTURE|DOC-SYN-[A-Z0-9-]+)\b/.test(publicJson)) {
  fail('Fixture identifier ditemukan dalam kandidat BI8 publik');
}
const privateKeys = new Set([
  'answer_key', 'correct_answer', 'scoring_criteria', 'max_points',
  'criterion_points', 'private_rubric', 'scoring_rubric', 'grading_criteria',
  'scoring_weights', 'expected_scores', 'service_role_key', 'gemini_api_key',
]);
function inspectPrivateKeys(value, where = 'public') {
  if (Array.isArray(value)) {
    return value.forEach((item, index) => inspectPrivateKeys(item, `${where}[${index}]`));
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (privateKeys.has(key.toLowerCase())) fail(`Field privat ${key} ditemukan di ${where}`);
    inspectPrivateKeys(nested, `${where}.${key}`);
  }
}
inspectPrivateKeys({ quest, bundle, presentation });
console.log('PASS public safety: no fixture IDs or private scoring fields');

console.warn('NOTICE: local parser excerpts/locators are verified; authoritative staging source-map equivalence remains PIC B gate.');
console.warn(`NOTICE: registry status=${registryMapping.registry_file_status}; runtime playability remains PIC D gate.`);
console.warn('NOTICE: paragraph A/B teacher confirmation remains PIC A/teacher gate.');
console.warn('NOTICE: this candidate is draft-only; no publication or Student E2E is asserted.');
console.log('BI8 PIC C candidate validation PASS (schema + identity + local provenance + registry boundary + public safety).');
