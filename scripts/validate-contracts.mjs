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
console.log(`OK: ${files.length} public fixture JSON terbaca; quest-public dan Story Bundle Draft v0.1 tervalidasi.`);
