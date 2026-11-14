# Teacher UI Architecture
## Edu-Roguelike: JejakNalar

- **Owner:** PIC A - Product Owner, Teacher Frontend & UX
- **Project:** LOGICODIX 2026
- **Baseline:** PRD v1.0 and Agile Scrum Parallel Work Plan v1.0
**Status:** Sprint 0 - Architecture Planning

---

## 1. Purpose

Dokumen ini mendefinisikan rancangan Product Flow, routing,
frontend architecture, data requirements, mock adapter,
dan kontrak integrasi Teacher UI JejakNalar.

Dokumen menjadi acuan implementasi PIC A dan koordinasi
integrasi dengan PIC B, PIC C, dan PIC D.

Dokumen ini tidak menggantikan PRD maupun API contract.
Perubahan API dan JSON schema tetap menjadi kewenangan PIC B
melalui proses Contract Change Request.

## 2. Architecture Decisions

| Area | Decision |
|---|---|
| Frontend framework | React |
| Language | TypeScript |
| Build tool | Vite |
| Routing | React Router DOM |
| Application structure | Single Page Application |
| Teacher layout | Top Navigation |
| Teacher feature ownership | PIC A |
| Student feature ownership | PIC D |
| Game renderer | Phaser, PIC D |
| Data access | Repository Adapter |
| Data mode | MOCK / REAL, configuration planned |
| Game preview | QuestGame preview mode |

Catatan:
Keputusan arsitektur di atas merupakan baseline rancangan PIC A.
React Router DOM dan repository adapter belum diimplementasikan
pada skeleton repository saat dokumen ini disusun.

## 3. Product Flow

### 3.1 Teacher Journey

1. Guru membuka landing page.
2. Guru login atau menggunakan akses demo yang disediakan.
3. Guru melihat dashboard dan mengelola kelas.
4. Guru memilih modul bawaan atau mengunggah PDF/DOCX.
5. Sistem melakukan ekstraksi dokumen.
6. Guru melihat dan mengoreksi hasil ekstraksi.
7. Guru menjalankan Learning Objective Analysis.
8. Sistem menampilkan status analysis job.
9. Guru meninjau, mengedit, menyetujui, atau menolak LO.
10. Sistem menghasilkan draft quest berdasarkan LO yang disetujui.
11. Guru meninjau dan mengedit konten quest.
12. Guru membuka Preview Game melalui Phaser PIC D.
13. Guru melakukan approval dan publish secara eksplisit.
14. Guru memantau hasil pembelajaran melalui dashboard report.

### 3.2 Student Journey

1. Siswa menggunakan public demo atau bergabung melalui kelas.
2. Sistem membuat atau memulihkan student session yang sah.
3. Siswa membuka quest yang sudah published.
4. Siswa menjelajahi dunia dan menemukan evidence.
5. Siswa mengerjakan assessment.
6. Backend memvalidasi dan menghitung skor.
7. Siswa menerima feedback dan dapat melakukan retry.
8. BedaJalur menentukan variasi latihan berikutnya.
9. Progres pembelajaran tersimpan.
10. Guru melihat learning evidence melalui report.

## 4. Routing Map

### 4.1 Public Routes

| Route | Page | Purpose |
|---|---|---|
| / | LandingPage | Product landing |
| /demo | PublicDemoPage | Public demo entry |
| /login | TeacherLoginPage | Teacher authentication |

### 4.2 Teacher Routes

| Route | Page | Purpose |
|---|---|---|
| /teacher | TeacherDashboardPage | Dashboard |
| /teacher/classes | TeacherClassesPage | Class list |
| /teacher/classes/new | CreateClassPage | Create class |
| /teacher/classes/:classId | ClassDetailPage | Class detail |
| /teacher/modules | ModuleCatalogPage | Module catalog |
| /teacher/modules/upload | ModuleUploadPage | Upload document |
| /teacher/modules/:moduleId/preview | DocumentPreviewPage | Extracted document preview |
| /teacher/modules/:moduleId/objectives | ObjectiveReviewPage | LO review |
| /teacher/quests/:draftId/review | QuestReviewPage | Quest content review |
| /teacher/quests/:draftId/preview | QuestPreviewPage | Phaser game preview |
| /teacher/classes/:classId/report | TeacherReportPage | Learning report |

### 4.3 Student Routes

Student route ownership belongs to PIC D.

Proposed routes:

| Route | Page |
|---|---|
| /student/join | StudentJoinPage |
| /student/quests/:questId | StudentQuestPage |

Final route compatibility must be confirmed with PIC D.

### 4.4 Error Routes

| Route | Page |
|---|---|
| * | NotFoundPage |

### 4.5 Navigation Layout

Teacher UI uses Top Navigation.

Primary navigation:
- Dashboard
- Classes
- Learning Modules
- Reports

Teacher account actions:
- Profile
- Logout

Game Preview uses a dedicated page and must provide
navigation back to Quest Review.

Authentication and authorization are enforced by backend B.
Frontend route guards are not a replacement for backend security.

## 5. Component Architecture

### 5.1 Proposed Directory Structure

```text
apps/web/src/
├── App.tsx
├── main.tsx
├── pages/
│   ├── LandingPage.tsx
│   ├── TeacherLoginPage.tsx
│   ├── TeacherDashboardPage.tsx
│   ├── TeacherClassesPage.tsx
│   ├── CreateClassPage.tsx
│   ├── ClassDetailPage.tsx
│   ├── ModuleCatalogPage.tsx
│   ├── ModuleUploadPage.tsx
│   ├── DocumentPreviewPage.tsx
│   ├── ObjectiveReviewPage.tsx
│   ├── QuestReviewPage.tsx
│   ├── QuestPreviewPage.tsx
│   └── TeacherReportPage.tsx
├── features/
│   ├── teacher/
│   │   ├── auth/
│   │   ├── classes/
│   │   ├── modules/
│   │   ├── objectives/
│   │   ├── quests/
│   │   └── reports/
│   └── student/          # PIC D
├── game/                 # PIC D
├── lib/
│   ├── parser/           # PIC C
│   ├── api/
│   ├── mocks/
│   └── types/
└── shared-ui/            # PIC A steward
    ├── components/
    ├── layouts/
    └── navigation/
```
This is a proposed structure, not the current implemented
repository structure.

### 5.2 Code Ownership

| Directory | Owner |
|---|---|
| features/teacher/ | PIC A |
| pages/ | PIC A |
| shared-ui/ | PIC A steward |
| features/student/ | PIC D |
| game renderer | PIC D |
| lib/parser/ | PIC C |
| supabase/functions/ | PIC B |

Shared files must be coordinated before changes.

## 6. Data Access Architecture

Teacher UI uses a Repository Adapter pattern.

```text
Teacher Pages
     |
     v
Feature Components
     |
     v
Repository Interface
     |
     +---------------+
     |               |
     v               v
Mock Adapter     Real Adapter
     |               |
     v               v
Fixtures         Backend API
```

Components must not depend directly on fixture file paths
or implementation-specific backend details.

### 6.1 Planned Repositories

| Repository | Responsibility |
|---|---|
| ClassRepository | Class list, detail, creation |
| ModuleRepository | Catalog, upload, document preview |
| ObjectiveRepository | Analyze, edit, approve, reject |
| QuestRepository | Generate, retrieve, revise, publish |
| ReportRepository | Learning report |

These interfaces must follow the final API contract.

### 6.2 Data Mode

The team environment plan defines:

VITE_DATA_MODE=mock

and a real API mode for staging.

HANDOFF_DAY1.md states that the mock adapter wiring is not
yet implemented. Do not assume the environment variable
already switches adapters.

## 7. API Integration Mapping

PIC B owns API endpoints and contract definitions.
PIC C owns parser and AI implementation.
PIC A consumes these services through typed repositories.

| Operation | Logical Endpoint | Provider |
|---|---|---|
| List classes | GET /classes | B |
| Create class | POST /classes | B |
| Analyze module | POST /modules/analyze | B + C |
| Retrieve analysis status | GET /analysis-jobs/{id} | B + C |
| Edit objective | PATCH /modules/{id}/objectives/{objectiveId} | B + C |
| Approve objectives | POST /modules/{id}/objectives/approve | B |
| Generate quest | POST /quests/generate | B + C |
| Publish quest | POST /quests/publish | B |
| Teacher report | GET /teacher/classes/{id}/report | B |

The list above includes integration requirements and
proposed endpoint mappings. Not every endpoint is present
in the current OpenAPI specification.

Final request and response schemas must be approved by
PIC B and affected consumers.

## 8. Learning Objective Review

Proposed logical fields:

- id
- statement
- source_references
- review_status

Proposed review status:

- pending
- approved
- rejected

Source references should preserve document provenance.
PDF references use page numbers; DOCX references use
paragraph references where available.

Guru can edit, approve, or reject individual objectives.

Quest generation must be disabled when no objective
has been approved.

Analysis is asynchronous according to the integration
proposal from PIC B. The frontend polls the job status
and stops polling on completed or failed.

Final schema and endpoint behavior remain subject to
cross-PIC approval.

## 9. Quest Review and Game Preview

### 9.1 Quest Lifecycle

Proposed lifecycle:

draft -> approved -> published

Published quest versions are immutable.

Changes after publication must create a new draft/version
rather than overwrite a published version.

### 9.2 Quest Identity

| Field | Meaning |
|---|---|
| draft_id | Editable draft identity |
| quest_id | Logical quest identity |
| quest_version_id | Quest content version identity |

Provisional draft versioning is not finalized.

PIC B must confirm the lifecycle and ID generation rules.

### 9.3 Phaser Preview Integration

Proposed renderer interface from PIC D:

QuestGame({
  quest,
  mode,
  adapter
})

Modes:
- preview
- student

Preview mode:
- Receives validated draft quest JSON.
- Runs the Phaser renderer and gameplay simulation.
- Does not create a student session.
- Does not create official attempts.
- Does not call the official student scoring endpoint.
- Does not persist student checkpoints.

Student mode:
- Receives published quest content.
- Requires a valid student session.
- Uses backend scoring and progress persistence.

PIC A owns the preview page and data handoff.
PIC D owns renderer implementation and gameplay behavior.

The interface and payload are still subject to integration
verification.

## 10. Editable Quest Content

Teacher revision may cover:
- NPC dialogue.
- Story descriptions.
- Mission descriptions.
- Learning document content.
- Hints and supporting narrative.

RPG presentation configuration is not fully represented
by Quest Schema v1.0.

A separate content configuration or approved schema
extension must be agreed by PIC B, PIC C, and PIC D.

Private answer keys, rubrics, and official scoring rules
must not be editable or exposed through the public frontend.

## 11. Teacher Dashboard and Reports

The report should support:

- Attempt count.
- Quest completion.
- Scores and feedback.
- Evidence per learning objective.
- Learning progress.
- BedaJalur status.
- Students or groups requiring additional support.
- Teacher intervention history.

Individual student reports are restricted to authorized
teachers of the relevant class.

Dashboard must use synthetic data in public demo mode.

Gameplay events such as mission_started,
mission_completed, evidence_collected, and quest_completed
are proposed events from PIC D, not confirmed production
contracts.

Gameplay activity alone must not be treated as proof
of learning mastery. Official assessment and scoring
remain backend responsibilities.

## 12. UI States and Error Handling

Every data-driven page must consider:

| State | UI Behavior |
|---|---|
| Loading | Loading indicator or skeleton |
| Empty | Clear empty state |
| Success | Display retrieved data |
| Validation error | Explain invalid input |
| Unauthorized | Redirect or request authentication |
| Forbidden | Display access denial |
| Not found | Display unavailable resource |
| AI processing | Progress status |
| AI failed | Error explanation and retry |
| AI result empty | Empty state and re-analysis action |
| LO pending | Generate button disabled |
| Quest draft | Editable and previewable |
| Quest published | Read-only published version |

API errors must follow the agreed response envelope:
{ok, error, request_id}.

Mock and real adapters must produce compatible
success and error behavior.

## 13. Security and Data Boundaries

1. Teacher authentication is provided by Supabase Auth.
2. Teachers may access only authorized classes and drafts.
3. Student session verification is handled by backend B.
4. Preview mode must be isolated from student assessment.
5. Public fixtures must not include private answer keys.
6. Gemini API keys and service-role keys must remain
   server-side.
7. Frontend data is not trusted for official scores.
8. Public demo uses synthetic data.

Frontend visibility rules alone are not authorization.

## 14. Pending Cross-PIC Decisions

The following decisions are not considered finalized:

| Topic | Parties |
|---|---|
| API endpoint and response completeness | A + B + C |
| Analysis job response and LO schema | A + B + C |
| Draft provisional version ID | B + C + D |
| Editable RPG content configuration | A + C + D |
| Gameplay event contract | B + D |
| Module catalog data source | A + B |
| Document upload/storage flow | A + B + C |
| Student route finalization | A + D |
| Mock fixture completion | A + B + C + D |
| Dependency vulnerability remediation | B + affected PICs |

Existing reference documents:
- docs/CCR_DAY1_PENDING.md
- docs/HANDOFF_DAY1.md

Do not modify public contracts unilaterally.
Use the Contract Change Request process.

## 15. Sprint 0 Verification Record

Environment verified:
- Node.js v22.23.4
- npm 10.9.9
- npm ci completed successfully.
- Vite development server started successfully.

Quality checks:
- npm run lint: passed.
- npm run typecheck: passed.
- npm test: passed (1 smoke test).
- npm run build: passed.
- npm run contract:lint: passed.

Security audit:
- npm audit reported 16 development dependency vulnerabilities.
- npm audit --omit=dev reported 0 vulnerabilities.
- Dependency remediation remains open.
- Do not run npm audit fix --force without team review.

Repository baseline:
- Branch: feat/A-01-teacher-ui
- Initial Git working tree was clean.
- This document is an architecture planning deliverable,
  not proof that Teacher UI features are implemented.

## 16. Definition of Ready for Sprint 1

Before implementing Teacher UI features:

- Routing decisions are recorded.
- Feature ownership is understood.
- API contract and fixtures are reviewed.
- Mock adapter interface is agreed.
- Loading, empty, success, and error states are defined.
- Phaser preview handoff is agreed.
- No unresolved dependency is silently treated as available.

A feature is done only after implementation, tests,
review, and integration evidence are available.

---

- **Document Owner:** PIC A
- **Reviewers:** PIC B, PIC C, PIC D
**Status:** Sprint 0 architecture baseline, pending cross-PIC integration decisions.
