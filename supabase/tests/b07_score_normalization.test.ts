import {
  normalizeAssessmentPoints,
  type RubricCriterion,
} from '../functions/_shared/rules/assessment/b07-score-normalization.ts';

interface ExpectedCase {
  case: string;
  evidence_status: 'sufficient' | 'insufficient_evidence';
  criteria_points: Record<string, number> | null;
  raw_points: number | null;
  max_points: number;
  adaptive_path: null;
}

const spec = JSON.parse(
  Deno.readTextFileSync(
    new URL(
      './fixtures/c04/picb/private/private-assessment-spec.fixture.json',
      import.meta.url,
    ),
  ),
);

const fixture = JSON.parse(
  Deno.readTextFileSync(
    new URL(
      './fixtures/c04/picb/private/expected-scoring-cases.fixture.json',
      import.meta.url,
    ),
  ),
);

const criteria: RubricCriterion[] = spec.items[0].rubric;
const cases: ExpectedCase[] = fixture.expected_cases;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectError(action: () => unknown, label: string) {
  let rejected = false;

  try {
    action();
  } catch {
    rejected = true;
  }

  assert(rejected, `${label} should have been rejected`);
}

for (const testCase of cases) {
  Deno.test(`C04 normalization: ${testCase.case}`, () => {
    const result = normalizeAssessmentPoints(
      criteria,
      testCase.evidence_status,
      testCase.criteria_points,
    );

    assert(
      result.max_points === testCase.max_points,
      'Maximum points mismatch',
    );

    assert(
      result.earned_points === testCase.raw_points,
      'Earned points mismatch',
    );

    if (testCase.evidence_status === 'insufficient_evidence') {
      assert(
        result.outcome === 'insufficient_evidence',
        'Evidence status mismatch',
      );

      assert(
        result.score === null,
        'Insufficient evidence must have null score',
      );
    } else {
      assert(result.outcome === 'scored', 'Expected scored result');

      const expectedScore = Math.round(
        (100 * testCase.raw_points!) / testCase.max_points,
      );

      assert(
        result.score === expectedScore,
        `Expected score ${expectedScore}, got ${result.score}`,
      );
    }

    assert(testCase.adaptive_path === null, 'Unexpected adaptive path');

    console.log(`B07_C04_NORMALIZATION_${testCase.case.toUpperCase()}_PASS`);
  });
}

Deno.test('B07 normalization: reject invalid scoring inputs', () => {
  const validPoints = Object.fromEntries(
    criteria.map((criterion) => [criterion.criterion, 0]),
  );

  const missingPoints = { ...validPoints };
  delete missingPoints[criteria[0].criterion];

  expectError(
    () => normalizeAssessmentPoints(criteria, 'sufficient', missingPoints),
    'Missing criterion',
  );

  expectError(
    () =>
      normalizeAssessmentPoints(criteria, 'sufficient', {
        ...validPoints,
        unknown_criterion: 1,
      }),
    'Unknown criterion',
  );

  expectError(
    () =>
      normalizeAssessmentPoints(criteria, 'sufficient', {
        ...validPoints,
        [criteria[0].criterion]: 999,
      }),
    'Points exceeding maximum',
  );

  expectError(
    () =>
      normalizeAssessmentPoints(criteria, 'sufficient', {
        ...validPoints,
        [criteria[0].criterion]: -1,
      }),
    'Negative points',
  );

  expectError(
    () => normalizeAssessmentPoints(criteria, 'sufficient', null),
    'Missing points',
  );

  expectError(
    () =>
      normalizeAssessmentPoints(criteria, 'insufficient_evidence', validPoints),
    'Points supplied for insufficient evidence',
  );

  expectError(
    () => normalizeAssessmentPoints([], 'sufficient', {}),
    'Empty rubric',
  );

  console.log('B07_NORMALIZATION_INVALID_INPUT_DENIED_PASS');
});
