# PIC D — Sprint 0 isolated game foundation

All shapes/types in this directory are **internal prototypes**, not the approved `contracts/quest.schema.json` or OpenAPI v1.0. Confirm both contracts before implementation / merge. Never modify contract files inside PIC D feature branch without approval.

Modules:
- `types.ts`: internal mock-only game quest and strict basic validator.
- `fixtures.ts`: synthetic public quest (no answer key).
- `state-machine.ts`: deterministic transitions, no Phaser dependency.
- `learning-events.ts`: minimal client event, student identity attached on backend.
- `repositories.ts`: mock adapters to develop while PIC B/C work.

Next sprint: renderer loads a mapped `GameQuest` from the **approved** public quest contract, with an adapter written only after API inspection. UI must never import private scoring rules.
