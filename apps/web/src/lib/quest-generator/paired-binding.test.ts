
import { describe, expect, it } from 'vitest';
import questFixture from '../../../../../supabase/tests/fixtures/c04/picb/public/quest-v1.fixture.json';
import storyBundleFixture from '../../../../../supabase/tests/fixtures/c04/picb/public/story-bundle-v0.1.fixture.json';
import identityBindingFixture from '../../../../../supabase/tests/fixtures/c04/picb/private/identity-binding.fixture.json';
import privateAssessmentFixture from '../../../../../supabase/tests/fixtures/c04/picb/private/private-assessment-spec.fixture.json';

import {
  validateC04PairedBinding,
  type C04BindingIssueCode,
  type C04PairedBindingInput,
} from './paired-binding';

type JsonObject = Record<string, unknown>;

const cloneJson = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value)) as unknown;

function asObject(value: unknown): JsonObject {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error('Expected a JSON object.');
  }

  return value as JsonObject;
}

function asArrayProperty(value: unknown, key: string): unknown[] {
  const result = asObject(value)[key];

  if (!Array.isArray(result)) {
    throw new Error(`Expected ${key} to be an array.`);
  }

  return result;
}

function findObject(
  items: unknown[],
  predicate: (item: JsonObject) => boolean,
): JsonObject {
  const found = items.find((item) => predicate(asObject(item)));

  if (!found) {
    throw new Error('Expected fixture object was not found.');
  }

  return asObject(found);
}

function makeInput(): C04PairedBindingInput {
  return {
    quest: cloneJson(questFixture),
    storyBundle: cloneJson(storyBundleFixture),
    identityBinding: cloneJson(identityBindingFixture),
    privateAssessment: cloneJson(privateAssessmentFixture),

    binding: {
      fixture_only: true,
      production_ready: false,
      quest_version_id: 'QV-FIXTURE-BI-CRED-001',
      mission_id: 'MIS-FIXTURE-BI-CRED-001',
      read_document_step_ids: [
        'read-source-a',
        'read-source-b',
      ],
      quest_step_id: 'submit-source-comparison',
      activity_id: 'ACT-FIXTURE-BI-CRED-001',
      item_id: 'ITEM-FIXTURE-BI-CRED-001',
      objective_id: 'LO-FIXTURE-BI-CRED-001',
      evidence_id: 'EVD-FIXTURE-BI-CRED-001',
      room_id: 'school.library',
      object_id: 'school.library.reading_table_0',
    },
  };
}

function expectIssue(
  input: C04PairedBindingInput,
  expectedCode: C04BindingIssueCode,
): void {
  const result = validateC04PairedBinding(input);

  expect(result.valid).toBe(false);
  expect(result.errors.map((error) => error.code)).toContain(expectedCode);
}

describe('C-04 paired binding validator', () => {
  it('accepts the complete C-04 fixture package', () => {
    const result = validateC04PairedBinding(makeInput());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Fixture aliases must be replaced by backend-persisted IDs before production.',
        'Registry object/NPC capability validation remains owned by PIC D.',
        'Presentation rendering and completion guard remain owned by PIC D.',
        'Live B06 submission and production ID binding have not been verified.',
      ]),
    );
  });

  it('rejects missing or invalid input objects', () => {
    const input = makeInput();

    expectIssue(
      { ...input, quest: null },
      'INVALID_OBJECT',
    );
  });

  it('requires explicitly fixture-only identities', () => {
    const input = makeInput();
    const identity = asObject(input.identityBinding);

    identity.not_for_production = false;

    expectIssue(input, 'FIXTURE_IDENTITY_REQUIRED');
  });

  it('rejects inconsistent quest versions', () => {
    const input = makeInput();
    const story = asObject(input.storyBundle);

    story.quest_version_id = 'QV-WRONG-VERSION';

    expectIssue(input, 'QUEST_VERSION_MISMATCH');
  });

  it('rejects identity alias mismatches', () => {
    const input = makeInput();
    const identity = asObject(input.identityBinding);
    const identifiers = asObject(identity.identifiers);
    const itemIdentifier = asObject(identifiers.item_id);

    itemIdentifier.fixture_alias = 'ITEM-WRONG';

    expectIssue(input, 'IDENTITY_ALIAS_MISMATCH');
  });

  it('requires an existing select_evidence submission step', () => {
    const input = makeInput();
    const binding = asObject(input.binding);

    binding.quest_step_id = 'step-does-not-exist';

    expectIssue(input, 'QUEST_STEP_NOT_FOUND');
  });

  it('requires the QuestV1 submission step to use the bound item ID', () => {
    const input = makeInput();
    const steps = asArrayProperty(input.quest, 'steps');

    const submissionStep = findObject(
      steps,
      (step) => step.id === 'submit-source-comparison',
    );

    submissionStep.item_id = 'ITEM-WRONG';

    expectIssue(input, 'QUEST_STEP_ITEM_MISMATCH');
  });

  it('requires exactly two explicitly bound read_document steps', () => {
    const input = makeInput();
    const binding = asObject(input.binding);

    binding.read_document_step_ids = [
      'read-source-a',
      'read-source-c',
    ];

    expectIssue(input, 'READ_STEP_MISMATCH');
  });

  it('requires exactly one Story Bundle task for the activity', () => {
    const input = makeInput();
    const binding = asObject(input.binding);

    binding.activity_id = 'ACT-NOT-FOUND';

    expectIssue(input, 'ACTIVITY_NOT_FOUND');
  });

  it('requires the objective to be referenced by QuestV1 and the task', () => {
    const input = makeInput();
    const tasks = asArrayProperty(input.storyBundle, 'tasks');
    const task = findObject(
      tasks,
      (entry) => entry.activity_id === 'ACT-FIXTURE-BI-CRED-001',
    );

    task.objective_ids = [];

    expectIssue(input, 'OBJECTIVE_BINDING_MISMATCH');
  });

  it('requires the task to reference the bound narrative evidence', () => {
    const input = makeInput();
    const tasks = asArrayProperty(input.storyBundle, 'tasks');
    const task = findObject(
      tasks,
      (entry) => entry.activity_id === 'ACT-FIXTURE-BI-CRED-001',
    );

    task.evidence_ids = [];

    expectIssue(input, 'EVIDENCE_BINDING_MISMATCH');
  });

  it('requires the mission to contain the activity and objective', () => {
    const input = makeInput();
    const missions = asArrayProperty(input.storyBundle, 'missions');
    const mission = findObject(
      missions,
      (entry) => entry.mission_id === 'MIS-FIXTURE-BI-CRED-001',
    );

    mission.activity_ids = [];

    expectIssue(input, 'MISSION_BINDING_MISMATCH');
  });

  it('requires both source references to match the read steps and document versions', () => {
    const input = makeInput();
    const tasks = asArrayProperty(input.storyBundle, 'tasks');
    const task = findObject(
      tasks,
      (entry) => entry.activity_id === 'ACT-FIXTURE-BI-CRED-001',
    );

    task.source_refs = [];

    expectIssue(input, 'SOURCE_REFERENCE_MISMATCH');
  });

  it('requires private assessment to remain backend-only', () => {
    const input = makeInput();
    const assessment = asObject(input.privateAssessment);

    assessment.exposure = 'public';

    expectIssue(input, 'ASSESSMENT_BINDING_MISMATCH');
  });

  it('rejects private answer keys or rubric fields in public payloads', () => {
    const input = makeInput();
    const quest = asObject(input.quest);

    quest.private_answer_key = {
      correct_answer: 'This must never be public.',
    };

    expectIssue(input, 'PRIVATE_DATA_IN_PUBLIC_PAYLOAD');
  });
});
