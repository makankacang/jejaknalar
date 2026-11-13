# Handoff to PIC B — C-04 Curated Quest E2E

Please review:
- `public/quest-v1.fixture.json`
- `public/story-bundle-v0.1.fixture.json`
- `private/private-assessment-spec.fixture.json`
- `private/expected-scoring-cases.fixture.json`
- `private/identity-binding.fixture.json`
- `submissions/*.request-fragment.fixture.json`

Decisions requested:
1. Confirm `quest_version_id` is backend-created on first draft persistence and stable through review/approval/publish.
2. Confirm backend assignment/rebinding of `quest_id`, `objective_id`, and `item_id`.
3. Review the four-point rubric anchors and `insufficient_evidence` behavior.
4. Confirm full B06 request envelope, endpoint and response contract; this package contains only the agreed `quest_version_id`, `idempotency_key`, `answers[{item_id,value}]` fragment.
5. Confirm storage boundary: private assessment spec never exposed to student.

All IDs in this package are fixture aliases only. No threshold 60/80 or adaptive path is specified here.
