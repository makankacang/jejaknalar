import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const schema = read('contracts/quest.schema.json');
const has2020 = String(schema.$schema || '').includes('2020-12');
const ajv = has2020 ? new Ajv2020({ allErrors: true, strict: false }) : new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

// Story Bundle is a proposal-only companion contract; QuestV1 remains unchanged.
const storyBundleSchema = read('contracts/story-bundle.schema.json');
const storyBundleAjv = new Ajv2020({ allErrors: true, strict: false });
const validateStoryBundle = storyBundleAjv.compile(storyBundleSchema);
const storyBundleFixture = read('fixtures/contracts/story-bundle-draft-v0.1.json');
if (!validateStoryBundle(storyBundleFixture)) {
  console.error(JSON.stringify(validateStoryBundle.errors, null, 2));
  throw new Error('story-bundle-draft-v0.1.json tidak sesuai Story Bundle Draft v0.1 schema');
}

// Structural negative probes: the draft must reject incomplete provenance,
// unsupported world values, and private assessment fields in public content.
const invalidStoryBundleCases = [
  {
    ...storyBundleFixture,
    world_preset: 'space',
  },
  {
    ...storyBundleFixture,
    tasks: storyBundleFixture.tasks.map((task) => ({
      ...task,
      source_refs: task.source_refs.map(({ locator, ...sourceRef }) => sourceRef),
    })),
  },
  {
    ...storyBundleFixture,
    answer_key: 'must-not-be-public',
  },
];
for (const [index, candidate] of invalidStoryBundleCases.entries()) {
  if (validateStoryBundle(candidate)) {
    throw new Error(`Story Bundle negative probe ${index + 1} unexpectedly passed`);
  }
}
const candidateStoryBundlePath = 'docs/C03_STORY_BINDING_CANDIDATE_BI8_v0.1.json';
const candidateStoryBundle = read(candidateStoryBundlePath);

if (!validateStoryBundle(candidateStoryBundle)) {
  console.error(JSON.stringify(validateStoryBundle.errors, null, 2));
  throw new Error('C-03 Story Binding candidate tidak sesuai Story Bundle Draft v0.1 schema');
}

// Validate the approved LO binding supplied by PIC B.
const approvedObjectiveId = 'LO-8A857C13-422A-4C5B-AD8A-8403955C067E';
const rejectedObjectiveId = 'LO-8923F9B3-C10B-4744-A4E0-40A944530B70';
const candidateObjectiveIds = [
  ...candidateStoryBundle.missions.flatMap((item) => item.objective_ids),
  ...candidateStoryBundle.tasks.flatMap((item) => item.objective_ids),
  ...candidateStoryBundle.evidence.flatMap((item) => item.objective_ids),
  ...candidateStoryBundle.dialogues.flatMap((dialogue) =>
    dialogue.nodes.flatMap((node) => node.objective_ids || []),
  ),
];

if (
  !candidateObjectiveIds.length ||
  candidateObjectiveIds.some((id) => id !== approvedObjectiveId || id === rejectedObjectiveId)
) {
  throw new Error('C-03 candidate memakai LO yang tidak approved atau tidak memiliki LO');
}

// Every source reference must point to a document version declared by the bundle.
const declaredSourceVersions = new Set(
  candidateStoryBundle.source_document_versions.map(
    (item) => `${item.document_id}:${item.text_version}`,
  ),
);
const candidateSourceRefs = [
  ...candidateStoryBundle.tasks.flatMap((item) => item.source_refs || []),
  ...candidateStoryBundle.evidence.flatMap((item) => item.source_refs || []),
  ...candidateStoryBundle.dialogues.flatMap((dialogue) =>
    dialogue.nodes.flatMap((node) => node.source_refs || []),
  ),
  ...(candidateStoryBundle.hints || []).flatMap((item) => item.source_refs || []),
  ...(candidateStoryBundle.feedback || []).flatMap((item) => item.source_refs || []),
];

if (!candidateSourceRefs.length) {
  throw new Error('C-03 candidate tidak memiliki source reference');
}

for (const sourceRef of candidateSourceRefs) {
  const key = `${sourceRef.document_id}:${sourceRef.text_version}`;
  if (!declaredSourceVersions.has(key)) {
    throw new Error(`Source reference tidak terdaftar pada source_document_versions: ${key}`);
  }
}

// Validate mission, activity, and evidence references.
const assertUniqueIds = (ids, label) => {
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} mengandung ID duplikat`);
  }
};

const missionIds = candidateStoryBundle.missions.map((item) => item.mission_id);
const activityIds = candidateStoryBundle.tasks.map((item) => item.activity_id);
const evidenceIds = candidateStoryBundle.evidence.map((item) => item.evidence_id);

assertUniqueIds(missionIds, 'mission_id');
assertUniqueIds(activityIds, 'activity_id');
assertUniqueIds(evidenceIds, 'evidence_id');

const missionById = new Map(
  candidateStoryBundle.missions.map((item) => [item.mission_id, item]),
);
const activityIdSet = new Set(activityIds);
const evidenceIdSet = new Set(evidenceIds);

for (const mission of candidateStoryBundle.missions) {
  for (const prerequisite of mission.prerequisites) {
    if (!missionById.has(prerequisite)) {
      throw new Error(`Mission prerequisite tidak ditemukan: ${prerequisite}`);
    }
  }
  for (const activityId of mission.activity_ids) {
    if (!activityIdSet.has(activityId)) {
      throw new Error(`Mission menunjuk activity yang tidak ditemukan: ${activityId}`);
    }
  }
}

for (const task of candidateStoryBundle.tasks) {
  for (const evidenceId of task.evidence_ids || []) {
    if (!evidenceIdSet.has(evidenceId)) {
      throw new Error(`Task menunjuk evidence yang tidak ditemukan: ${evidenceId}`);
    }
  }
  if ((task.public_item_ids || []).length > 0) {
    throw new Error('public_item_ids belum boleh digunakan sebelum otorisasi PIC B');
  }
}

for (const evidence of candidateStoryBundle.evidence) {
  if (!missionById.has(evidence.mission_id)) {
    throw new Error(`Evidence menunjuk mission yang tidak ditemukan: ${evidence.mission_id}`);
  }
}

// Reject cycles in the mission prerequisite graph.
const visitingMissions = new Set();
const visitedMissions = new Set();

const visitMission = (missionId) => {
  if (visitingMissions.has(missionId)) {
    throw new Error(`Mission prerequisite cycle ditemukan pada ${missionId}`);
  }
  if (visitedMissions.has(missionId)) return;

  visitingMissions.add(missionId);
  const mission = missionById.get(missionId);

  for (const prerequisite of mission.prerequisites) {
    visitMission(prerequisite);
  }

  visitingMissions.delete(missionId);
  visitedMissions.add(missionId);
};

for (const missionId of missionIds) visitMission(missionId);

// Public content must not expose private assessment material.
const candidateSerialized = JSON.stringify(candidateStoryBundle);
if (/"(?:answer_key|correct_answer|private_rubric|scoring_policy|service_role_key|gemini_api_key)"\s*:/i.test(candidateSerialized)) {
  throw new Error('Field privat ditemukan di C-03 Story Binding candidate');
}

console.log('PASS: C-03 candidate schema, approved LO, source versions, mission graph, activity/evidence references, and public-field checks.');
const candidateQuestPath = 'docs/C03_QUESTV1_CANDIDATE_BI8_v1.0.json';
const candidateQuest = read(candidateQuestPath);

if (!validate(candidateQuest)) {
  console.error(JSON.stringify(validate.errors, null, 2));
  throw new Error('C-03 QuestV1 candidate tidak sesuai Quest Schema 1.0');
}

const candidateQuestId = 'QUEST-BI8-B1S5-REDAKSI-001';
const candidateQuestVersionId = 'QV-BI8-B1S5-REDAKSI-001';
const candidateItemId = 'ITEM-BI8-B1S5-REDAKSI-KLASIFIKASI-001';
const candidateDocumentId = 'doc_a305829d3917b4ca';
const candidateTextVersion = '1c8e29fe-698d-4d6c-ad2b-ff178de1ace2';
const approvedLoId = 'LO-8A857C13-422A-4C5B-AD8A-8403955C067E';

if (
  candidateQuest.quest_id !== candidateQuestId ||
  candidateQuest.quest_version_id !== candidateQuestVersionId ||
  candidateQuest.quest_version_id !== candidateStoryBundle.quest_version_id
) {
  throw new Error('Quest identity atau paired quest_version_id tidak cocok');
}

if (
  candidateQuest.objective_ids.length !== 1 ||
  candidateQuest.objective_ids[0] !== approvedLoId
) {
  throw new Error('QuestV1 harus menggunakan satu-satunya LO approved BI8');
}

const candidateReadSteps = candidateQuest.steps.filter(
  (step) => step.type === 'read_document',
);
const candidateSelectSteps = candidateQuest.steps.filter(
  (step) => step.type === 'select_evidence',
);

if (
  candidateReadSteps.length !== 1 ||
  candidateReadSteps[0].ref !== candidateDocumentId ||
  candidateReadSteps[0].ref === 'DOC-001'
) {
  throw new Error('QuestV1 read_document harus menunjuk dokumen BI8, bukan fixture DOC-001');
}

if (
  candidateSelectSteps.length !== 1 ||
  candidateSelectSteps[0].item_id !== candidateItemId ||
  candidateSelectSteps[0].item_id === 'ITEM-001'
) {
  throw new Error('QuestV1 select_evidence harus memakai kandidat item BI8, bukan ITEM-001');
}

if (
  candidateStoryBundle.source_document_versions.length !== 1 ||
  candidateStoryBundle.source_document_versions[0].document_id !== candidateDocumentId ||
  candidateStoryBundle.source_document_versions[0].text_version !== candidateTextVersion
) {
  throw new Error('Story Bundle source document version tidak sesuai snapshot BI8');
}

const requiredTaskBindings = [
  {
    activity_id: 'ACT-REDAKSI-KONSEP',
    room_id: 'school.library',
    object_id: 'school.library.guestbook',
    template: 'observe',
  },
  {
    activity_id: 'ACT-REDAKSI-PERBANDINGAN',
    room_id: 'school.staff_room',
    object_id: 'school.staff_room.teacher_note',
    template: 'investigate',
  },
  {
    activity_id: 'ACT-REDAKSI-KLASIFIKASI',
    room_id: 'school.discussion_hall',
    object_id: 'school.discussion_hall.case_board',
    template: 'decide',
  },
];

for (const expected of requiredTaskBindings) {
  const actual = candidateStoryBundle.tasks.find(
    (task) => task.activity_id === expected.activity_id,
  );

  if (
    !actual ||
    actual.room_id !== expected.room_id ||
    actual.object_id !== expected.object_id ||
    actual.template !== expected.template
  ) {
    throw new Error('Task binding BI8 tidak cocok dengan hasil review PIC D: ' + expected.activity_id);
  }
}

const requiredSourceMapIds = [
  'DOC-P-559',
  'DOC-P-596',
  'DOC-P-599',
];

const actualSourceMapIds = new Set(
  candidateStoryBundle.tasks.flatMap(
    (task) => task.source_refs.map((source) => source.source_map_id),
  ),
);

for (const sourceMapId of requiredSourceMapIds) {
  if (!actualSourceMapIds.has(sourceMapId)) {
    throw new Error('Source Map BI8 tidak ditemukan pada Story Bundle: ' + sourceMapId);
  }
}

if (
  candidateStoryBundle.tasks.some(
    (task) => (task.public_item_ids || []).length > 0,
  )
) {
  throw new Error('public_item_ids tidak boleh diisi sebelum otorisasi assessment PIC B');
}

console.log('PASS: QuestV1 v1.0 and Story Bundle BI8 paired identity, LO, source version, task mapping, and candidate assessment checks.');
console.warn('NOTICE: Quest ID and assessment item are still candidates; reservation, scoring authorization, publication, and runtime resolution are not verified.');
const dir = 'fixtures/public';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
if (!files.length) throw new Error('Tidak ada public fixture JSON');
for (const file of files) {
  const data = read(path.join(dir, file));
  if (typeof data !== 'object' || data === null || typeof data.ok !== 'boolean') {
    throw new Error(`${file}: fixture harus memakai envelope {ok, data|error}`);
  }
  if (data.ok && !('data' in data)) throw new Error(`${file}: response ok tanpa data`);
  if (!data.ok && (!data.error || typeof data.error.code !== 'string')) {
    throw new Error(`${file}: response error tanpa error.code`);
  }
  if (file === 'quest-public.json') {
    if (!data.ok || !validate(data.data)) {
      console.error(JSON.stringify(validate.errors, null, 2));
      throw new Error('quest-public.json.data tidak sesuai Quest JSON Schema');
    }
  }
  // Safeguard: no private answer keys or recovery credential hashes in public fixtures.
  const s = JSON.stringify(data);
  if (/"(?:answer_key|correct_answer|recovery_code_hash|service_role_key|gemini_api_key)"\s*:/i.test(s)) {
    throw new Error(`${file}: field privat ditemukan dalam public fixture`);
  }
}
console.log(`OK: ${files.length} public fixture JSON terbaca; QuestV1 fixture, Story Bundle fixture, dan C-03 candidate tervalidasi.`);
