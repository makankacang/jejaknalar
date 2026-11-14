# C-03 QuestV1 Binding Plan — Bahasa Indonesia VIII

**Status: DRAFT — menunggu verifikasi identitas dan assessment backend.**

## 1. Backend identifiers dari PIC B

| Field | Nilai | Status |
|---|---|---|
| `module_id` | `b76fc3c4-1e51-420a-9868-396f8a934294` | Terdaftar staging |
| `document_id` | `doc_a305829d3917b4ca` | Terdaftar staging |
| Full `text_version` | `45224adb-ba66-4254-b896-bb43b7822e38` | Terdaftar staging |
| Subbab 5 `text_version` | `1c8e29fe-698d-4d6c-ad2b-ff178de1ace2` | Terdaftar staging |
| `analysis_job_id` | `31b48a66-76db-4721-8269-d27d3938999a` | Selesai menurut PIC B |
| Approved LO | `LO-8A857C13-422A-4C5B-AD8A-8403955C067E` | APPROVED |
| Rejected LO | `LO-8923F9B3-C10B-4744-A4E0-40A944530B70` | REJECTED — jangan gunakan |

## 2. Usulan identitas quest

| Field | Kandidat | Status |
|---|---|---|
| `quest_id` | `QUEST-BI8-B1S5-REDAKSI-001` | Belum diverifikasi unik |
| `quest_version_id` | `QV-BI8-B1S5-REDAKSI-001` | Belum diverifikasi unik |

Kedua nilai di atas boleh digunakan untuk draft lokal, tetapi belum menjadi identitas persisten dan belum boleh dipakai untuk publikasi.

## 3. QuestV1 v1.0 — binding plan

| Field QuestV1 | Nilai / keputusan |
|---|---|
| `schema_version` | `1.0` |
| `quest_id` | Gunakan kandidat setelah PIC B mengonfirmasi reservasi |
| `quest_version_id` | Gunakan kandidat setelah PIC B mengonfirmasi reservasi |
| `objective_ids` | `LO-8A857C13-422A-4C5B-AD8A-8403955C067E` |
| `template` | `evidence_hunt` |
| `scene_id` | Capability scaffold saat ini menggunakan `school_library`; perlu acknowledgement PIC D untuk kombinasi world/room |

### Quest steps

| Step | Jenis | Binding |
|---|---|---|
| `read_document` | `read_document` | Menunggu public document reference yang dikenali runtime/backend untuk snapshot Subbab 5 |
| `select_evidence` | `select_evidence` | Menunggu assessment `item_id` yang diotorisasi untuk quest version ini |

Jangan mengisi `read_document.ref` dengan `DOC-P-*` secara otomatis: referensi source map bukan otomatis document reference yang dipahami renderer QuestV1.

Jangan memakai `DOC-001` atau `ITEM-001` dari compatibility scaffold sebagai pengganti binding materi ini. Nilai tersebut merupakan referensi statis generator saat ini dan tidak membuktikan hubungan dengan dokumen/assessment Bahasa Indonesia.

## 4. Assessment mapping

| Activity | Peran | Objective | Assessment ID |
|---|---|---|---|
| `ACT-REDAKSI-KONSEP` | Formatif: mengenali kriteria | LO approved | Tidak ada item resmi |
| `ACT-REDAKSI-PERBANDINGAN` | Formatif: membandingkan contoh | LO approved | Tidak ada item resmi |
| `ACT-REDAKSI-KLASIFIKASI` | Kandidat assessment klasifikasi dan bukti tekstual | LO approved | Menunggu PIC B |

Aktivitas dan evidence bukan assessment item. `evidence_id`, `activity_id`, `item_id`, dan `question_id` tidak boleh dipertukarkan.

Tidak ada `public_item_ids` pada Story Bundle candidate sampai PIC B mengotorisasi item untuk pasangan `(quest_version_id, item_id)`.

## 5. Story Binding

File kandidat: `C03_STORY_BINDING_CANDIDATE_BI8_v0.1.json`.

- Menggunakan `document_id` dan Subbab 5 `text_version` staging.
- Menggunakan satu LO approved.
- Menggunakan `DOC-P-559`, `DOC-P-599`, dan `DOC-P-596` sebagai source map references.
- Menggunakan registry version `D-school-1.4-sprint2-1` sebagai target draft.
- Tidak menyertakan answer key, scoring policy, private rubric, atau assessment IDs yang belum diotorisasi.

`source_map_id` pada kandidat menggunakan ID `DOC-P-*` yang PIC B nyatakan tersedia dalam snapshot Subbab 5. PIC B perlu mengonfirmasi bahwa ID tersebut adalah nilai `source_map_id` yang diterima backend pada Story Bundle, bukan sekadar locator alias.

## 6. Mapping ke PIC D

| Activity | Room | Object | Template |
|---|---|---|---|
| `ACT-REDAKSI-KONSEP` | `school.library` | `school.library.guestbook` | `observe` |
| `ACT-REDAKSI-PERBANDINGAN` | `school.staff_room` | `school.staff_room.teacher_note` | `investigate` |
| `ACT-REDAKSI-KLASIFIKASI` | `school.discussion_hall` | `school.discussion_hall.case_board` | `decide` |

Ketiga pasangan object/template sesuai dengan `taskSlots` pada branch PIC D yang diperiksa. Registry tersebut masih `DESIGN_MOCK_NOT_PRODUCTION`, sehingga kesesuaian struktural belum sama dengan runtime approval.

NPC kandidat: `school.npc.librarian` pada `school.library`.

Story Adapter D sebelumnya mengembalikan `previewOnly: true`. Perlu konfirmasi D bahwa branch/adapter terbaru menerima ketiga task binding ini dan dapat merender konten dinamis tanpa mengandalkan fixture.

## 7. Blocker final yang perlu ditutup

**PIC B**
1. Verifikasi dan reservasi `quest_id` serta `quest_version_id`.
2. Konfirmasi `source_map_id` untuk DOC-P references.
3. Sediakan public document reference untuk QuestV1 `read_document`.
4. Buat/otorisasi assessment item dan berikan `item_id` untuk `select_evidence`.
5. Validasi dan publish setelah QuestV1 dan Story Binding lolos pemeriksaan.

**PIC D**
1. Acknowledge registry version dan room/object/task mapping.
2. Konfirmasi scene/world compatibility.
3. Validasi Story Adapter untuk tiga activity templates.
4. Konfirmasi preview/runtime status dan persyaratan student mode.

**PIC C**
1. Finalisasi QuestV1 setelah seluruh binding resmi tersedia.
2. Validasi Story Bundle terhadap schema dan paired binding.
3. Jalankan tests dan serahkan PR serta handoff.

## 8. Acceptance target

Belum boleh menyatakan Published Quest atau Gameplay E2E PASS sebelum ada bukti:
- Quest ID/version terdaftar dan published.
- QuestV1 dan Story Bundle memiliki `quest_version_id` identik.
- Source references cocok dengan immutable snapshot.
- Assessment item terotorisasi untuk quest version.
- Story Adapter menerima konten non-fixture.
- Student session berhasil memuat quest published.
- Gameplay, checkpoint, submit, scoring, dan BedaJalur diuji.

**Kesimpulan:** Story Bundle candidate bisa direview sekarang. QuestV1 final tetap menunggu public document reference dan assessment item ID; identitas quest menunggu verifikasi keunikan PIC B.
