type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected JSON object');
  }
  return value as JsonObject;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected JSON array');
  }
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fixture(path: string): JsonObject {
  const url = new URL(`./fixtures/c04/picb/${path}`, import.meta.url);
  return object(JSON.parse(Deno.readTextFileSync(url)));
}

const quest = fixture('public/quest-v1.fixture.json');
const story = fixture('public/story-bundle-v0.1.fixture.json');
const spec = fixture('private/private-assessment-spec.fixture.json');
const identity = fixture('private/identity-binding.fixture.json');
const expected = fixture('private/expected-scoring-cases.fixture.json');

Deno.test('C04: quest and private IDs remain consistent', () => {
  const identifiers = object(identity.identifiers);
  const version = quest.quest_version_id;
  const item = object(array(spec.items)[0]);

  assert(
    version === story.quest_version_id && version === spec.quest_version_id,
    'Quest version differs across fixtures',
  );

  for (const [name, actual] of [
    ['quest_id', quest.quest_id],
    ['quest_version_id', version],
    ['objective_id', array(quest.objective_ids)[0]],
    ['item_id', item.item_id],
    ['activity_id', item.activity_id],
    ['evidence_id', item.evidence_id],
  ]) {
    assert(
      object(identifiers[String(name)]).fixture_alias === actual,
      `Identity alias mismatch: ${name}`,
    );
  }

  const steps = array(quest.steps).map(object);
  const tasks = array(story.tasks).map(object);
  const evidence = array(story.evidence).map(object);

  assert(
    steps.some(
      (step) =>
        step.type === 'select_evidence' && step.item_id === item.item_id,
    ),
    'Assessment item is missing from QuestV1',
  );

  assert(
    tasks.some(
      (task) =>
        task.activity_id === item.activity_id &&
        array(task.evidence_ids).includes(item.evidence_id),
    ),
    'Story task and evidence binding mismatch',
  );

  assert(
    evidence.some((entry) => entry.evidence_id === item.evidence_id),
    'Story evidence is missing',
  );

  assert(
    item.objective_id === array(quest.objective_ids)[0],
    'Assessment objective mismatch',
  );

  console.log('B07_C04_IDENTITY_CONTRACT_PASS');
});

Deno.test('C04: rubric stays private and response is compatible', () => {
  const item = object(array(spec.items)[0]);

  assert(spec.exposure === 'backend_only', 'Rubric is not private');
  assert(
    item.response_type === 'constructed_response',
    'Unexpected response type',
  );
  assert(
    item.submission_value_type === 'string',
    'Submission must use string value',
  );
  assert(item.scoring_mode === 'analytic_rubric', 'Unexpected scoring mode');

  const publicPayload = JSON.stringify({ quest, story });
  const secretFields =
    /"(?:private_answer_key|answer_key|rubric|accepted_answer_variants|full_credit_anchor|zero_credit_anchor)"\s*:/;

  assert(!secretFields.test(publicPayload), 'Private assessment data leaked');

  const insufficient = object(item.insufficient_evidence_rule);
  assert(
    insufficient.status === 'insufficient_evidence' &&
      insufficient.is_adaptive_path === false,
    'Insufficient evidence must not become an adaptive path',
  );

  console.log('B07_C04_PRIVATE_ASSESSMENT_PASS');
});

Deno.test('C04: four scoring expectations are internally consistent', () => {
  const item = object(array(spec.items)[0]);
  const rubric = array(item.rubric).map(object);
  const cases = array(expected.expected_cases).map(object);

  assert(cases.length === 4, 'Expected exactly four scoring cases');
  assert(expected.item_id === item.item_id, 'Scoring item ID mismatch');

  const criteria = rubric.map((criterion) => String(criterion.criterion));
  const maxPoints = rubric.reduce(
    (total, criterion) => total + Number(criterion.points),
    0,
  );

  assert(maxPoints === item.max_points, 'Rubric maximum does not match item');

  const expectedCases: Record<string, number | null> = {
    correct: 4,
    'partially-correct': 2,
    incorrect: 0,
    'insufficient-evidence': null,
  };

  const seen = new Set<string>();

  for (const testCase of cases) {
    const name = String(testCase.case);

    assert(Object.hasOwn(expectedCases, name), `Unknown case: ${name}`);
    assert(!seen.has(name), `Duplicate case: ${name}`);
    seen.add(name);

    assert(testCase.max_points === maxPoints, `Maximum mismatch: ${name}`);
    assert(
      testCase.adaptive_path === null,
      `Unexpected adaptive path: ${name}`,
    );
    assert(
      testCase.raw_points === expectedCases[name],
      `Points mismatch: ${name}`,
    );

    if (name === 'insufficient-evidence') {
      assert(
        testCase.evidence_status === 'insufficient_evidence' &&
          testCase.criteria_points === null,
        'Insufficient evidence incorrectly scored',
      );
      continue;
    }

    assert(
      testCase.evidence_status === 'sufficient',
      `Unexpected status: ${name}`,
    );

    const points = object(testCase.criteria_points);
    assert(
      Object.keys(points).length === criteria.length,
      `Criterion count mismatch: ${name}`,
    );

    const total = criteria.reduce((sum, criterion) => {
      assert(
        points[criterion] === 0 || points[criterion] === 1,
        `Invalid criterion points: ${criterion}`,
      );
      return sum + Number(points[criterion]);
    }, 0);

    assert(total === testCase.raw_points, `Criterion sum mismatch: ${name}`);
  }

  console.log('B07_C04_SCORING_FIXTURE_PASS');
});
