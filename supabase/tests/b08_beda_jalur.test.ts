import {
  decideBedaJalur,
  type BedaJalurPath,
  type BedaJalurPolicy,
} from '../functions/_shared/rules/adaptive/b08-beda-jalur.ts';

const policy: BedaJalurPolicy = {
  version: 'b08-provisional-1',
  developing_min_score: 60,
  extension_min_score: 80,
};

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

  assert(rejected, `${label} should be rejected`);
}

Deno.test('B08: score boundaries select correct paths', () => {
  const cases: Array<[number, BedaJalurPath]> = [
    [0, 'needs_support'],
    [59, 'needs_support'],
    [60, 'developing'],
    [79, 'developing'],
    [80, 'ready_for_extension'],
    [100, 'ready_for_extension'],
  ];

  for (const [score, expectedPath] of cases) {
    const result = decideBedaJalur({ status: 'scored', score }, policy);

    assert(result.next_path === expectedPath, `Wrong path at ${score}`);
    assert(result.decision_status === 'decided', 'Wrong decision status');
    assert(result.policy_version === policy.version, 'Wrong policy version');
  }

  console.log('B08_SCORE_BOUNDARIES_PASS');
});

Deno.test('B08: pending assessment has no adaptive path', () => {
  const result = decideBedaJalur(
    { status: 'pending_scoring', score: null },
    policy,
  );

  assert(result.next_path === null, 'Pending cannot choose a path');
  assert(
    result.decision_status === 'pending_scoring',
    'Pending status mismatch',
  );

  console.log('B08_PENDING_NO_PATH_PASS');
});

Deno.test('B08: insufficient evidence has no adaptive path', () => {
  const result = decideBedaJalur(
    { status: 'insufficient_evidence', score: null },
    policy,
  );

  assert(
    result.next_path === null,
    'Insufficient evidence cannot choose a path',
  );
  assert(
    result.decision_status === 'insufficient_evidence',
    'Insufficient evidence status mismatch',
  );

  console.log('B08_INSUFFICIENT_EVIDENCE_NO_PATH_PASS');
});

Deno.test('B08: reject invalid assessment results', () => {
  for (const score of [-1, 101, 59.5, Number.NaN, Infinity]) {
    expectError(
      () => decideBedaJalur({ status: 'scored', score }, policy),
      `Invalid score ${score}`,
    );
  }

  expectError(
    () => decideBedaJalur({ status: 'scored', score: null }, policy),
    'Missing official score',
  );

  expectError(
    () => decideBedaJalur({ status: 'pending_scoring', score: 0 }, policy),
    'Pending with score',
  );

  expectError(
    () =>
      decideBedaJalur({ status: 'insufficient_evidence', score: 0 }, policy),
    'Insufficient evidence with zero score',
  );

  console.log('B08_INVALID_ASSESSMENT_DENIED_PASS');
});

Deno.test('B08: configurable thresholds and policy validation', () => {
  const customPolicy: BedaJalurPolicy = {
    version: 'b08-custom-test',
    developing_min_score: 50,
    extension_min_score: 90,
  };

  assert(
    decideBedaJalur({ status: 'scored', score: 50 }, customPolicy).next_path ===
      'developing',
    'Custom developing threshold failed',
  );

  assert(
    decideBedaJalur({ status: 'scored', score: 90 }, customPolicy).next_path ===
      'ready_for_extension',
    'Custom extension threshold failed',
  );

  for (const [developing, extension] of [
    [80, 60],
    [60, 60],
    [0, 80],
    [60, 101],
  ]) {
    expectError(
      () =>
        decideBedaJalur(
          { status: 'scored', score: 75 },
          {
            version: 'invalid-policy',
            developing_min_score: developing,
            extension_min_score: extension,
          },
        ),
      `Invalid thresholds ${developing}/${extension}`,
    );
  }

  console.log('B08_POLICY_VALIDATION_PASS');
});
