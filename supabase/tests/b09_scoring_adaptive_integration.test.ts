import {
  normalizeAssessmentPoints,
  type RubricCriterion,
} from '../functions/_shared/rules/assessment/b07-score-normalization.ts';

import {
  decideBedaJalur,
  type BedaJalurPath,
  type BedaJalurPolicy,
} from '../functions/_shared/rules/adaptive/b08-beda-jalur.ts';

interface ScoringCase {
  case: string;
  evidence_status: 'sufficient' | 'insufficient_evidence';
  criteria_points: Record<string, number> | null;
  raw_points: number | null;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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
const cases: ScoringCase[] = fixture.expected_cases;

const policy: BedaJalurPolicy = {
  version: 'b08-provisional-1',
  developing_min_score: 60,
  extension_min_score: 80,
};

const expected: Record<
  string,
  { score: number | null; next_path: BedaJalurPath | null }
> = {
  correct: {
    score: 100,
    next_path: 'ready_for_extension',
  },
  'partially-correct': {
    score: 50,
    next_path: 'needs_support',
  },
  incorrect: {
    score: 0,
    next_path: 'needs_support',
  },
  'insufficient-evidence': {
    score: null,
    next_path: null,
  },
};

Deno.test('B09: C04 scoring to BedaJalur integration', () => {
  assert(cases.length === 4, 'Expected four C04 scoring cases');

  const tested = new Set<string>();

  for (const testCase of cases) {
    const expectation = expected[testCase.case];

    assert(expectation !== undefined, `Unknown case: ${testCase.case}`);
    assert(!tested.has(testCase.case), 'Duplicate scoring case');
    tested.add(testCase.case);

    // Points originate from a trusted synthetic fixture.
    // This does not evaluate student answers.
    const scoring = normalizeAssessmentPoints(
      criteria,
      testCase.evidence_status,
      testCase.criteria_points,
    );

    assert(
      scoring.earned_points === testCase.raw_points,
      `Earned points mismatch: ${testCase.case}`,
    );

    assert(
      scoring.score === expectation.score,
      `Score mismatch: ${testCase.case}`,
    );

    const decision = decideBedaJalur(
      {
        status: scoring.outcome,
        score: scoring.score,
      },
      policy,
    );

    assert(
      decision.next_path === expectation.next_path,
      `Adaptive path mismatch: ${testCase.case}`,
    );

    assert(
      decision.policy_version === policy.version,
      'Policy version mismatch',
    );

    if (scoring.outcome === 'insufficient_evidence') {
      assert(
        decision.decision_status === 'insufficient_evidence',
        'Insufficient evidence must not become a decided path',
      );
    } else {
      assert(
        decision.decision_status === 'decided',
        'Scored result must produce a decision',
      );
    }

    console.log(`B09_INTEGRATION_${testCase.case.toUpperCase()}_PASS`);
  }

  assert(tested.size === 4, 'Not all cases were tested');

  console.log('B09_SCORING_ADAPTIVE_INTEGRATION_PASS');
});
