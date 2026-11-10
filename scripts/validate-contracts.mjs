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
console.log(`OK: ${files.length} fixture JSON terbaca; quest-public tervalidasi.`);
