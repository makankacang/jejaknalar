import { hideUnapprovedAdaptivePaths } from '../functions/api/teacher-report.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('B09: provisional adaptive paths are hidden', () => {
  const report = {
    students: [
      {
        student_id: 'student-provisional',
        last_adaptive_path: 'needs_support',
        last_policy_status: 'provisional',
      },
      {
        student_id: 'student-approved',
        last_adaptive_path: 'developing',
        last_policy_status: 'approved',
      },
      {
        student_id: 'student-no-policy',
        last_adaptive_path: null,
        last_policy_status: null,
      },
    ],
    attempt_history: [
      {
        attempt_id: 'attempt-provisional',
        next_path: 'ready_for_extension',
        policy_status: 'provisional',
      },
      {
        attempt_id: 'attempt-approved',
        next_path: 'needs_support',
        policy_status: 'approved',
      },
    ],
    summary: { total_attempts: 2 },
  };

  const original = structuredClone(report);
  const result = hideUnapprovedAdaptivePaths(report);

  const students = result.students as Array<Record<string, unknown>>;
  const history = result.attempt_history as Array<Record<string, unknown>>;

  assert(
    students[0].last_adaptive_path === null,
    'Provisional student path leaked',
  );

  assert(
    students[1].last_adaptive_path === 'developing',
    'Approved student path was hidden',
  );

  assert(
    students[2].last_adaptive_path === null,
    'Missing policy must not expose a path',
  );

  assert(history[0].next_path === null, 'Provisional attempt path leaked');

  assert(
    history[1].next_path === 'needs_support',
    'Approved attempt path was hidden',
  );

  assert(
    JSON.stringify(report) === JSON.stringify(original),
    'Report was mutated',
  );

  assert(
    (result.summary as Record<string, number>).total_attempts === 2,
    'Unrelated report data changed',
  );

  console.log('B09_PROVISIONAL_PATH_HIDDEN_PASS');
  console.log('B09_APPROVED_PATH_PRESERVED_PASS');
  console.log('B09_REPORT_NOT_MUTATED_PASS');
});
