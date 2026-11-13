# C-03.2 — Story Bundle Contract v0.1 (Draft)

**Status:** Proposal teknis PIC C untuk review PIC A/B/D. **Belum menjadi kontrak final dan belum menjadi runtime implementation.**
**Compatibility baseline:** Quest Schema v1.0 tetap tidak berubah.
**Assessment alignment:** C5-01/C5-03/C5-04/C5-05 disepakati secara desain; C5-02 (`ITEM-001` vs `Q-001`) tetap OPEN / UNRESOLVED.

## 1. Tujuan dan batas

Story Bundle adalah payload konten naratif/gameplay yang dipasangkan dengan QuestV1 melalui `quest_version_id`. QuestV1 tetap menjadi kontrak dasar untuk identitas quest, LO, template, scene, steps, dan variants. Story Bundle tidak menambahkan properti ke root QuestV1 dan tidak menggantikan `contracts/quest.schema.json`.

Story Bundle v0.1 mengusulkan wadah untuk:

- metadata episode dan konteks belajar;
- mission graph;
- dialog NPC bercabang;
- aktivitas/task close-up;
- evidence naratif yang terpisah dari assessment item;
- hint dan feedback naratif;
- variasi ending;
- provenance sumber dokumen.

Story Bundle v0.1 **bukan** jaminan bahwa renderer saat ini dapat memainkan bundle. Validasi JSON Schema hanya memeriksa struktur. Kelayakan runtime harus diperiksa oleh Story Adapter terhadap Capability Registry tepercaya dan versi renderer.

## 2. Prinsip kontrak

1. **QuestV1 tetap v1.0.** Jangan menambahkan field Story Bundle ke QuestV1 tanpa keputusan versi kontrak lintas PIC.
2. **Versi terikat.** `story_bundle.quest_version_id` wajib sama persis dengan `quest_v1.quest_version_id` yang menjadi pasangannya.
3. **Registry dipin.** `registry_version` wajib menyatakan versi capability yang menjadi batas generasi dan validasi.
4. **World satu per episode.** `world_preset` hanya `school` atau `city`; `scene_id` tetap berada pada QuestV1; `room_id` adalah identitas ruangan internal world.
5. **ID bukan sinonim.** `activity_id`, `item_id`, `question_id`, `evidence_id`, `npc_id`, `object_id`, `room_id`, dan `scene_id` merepresentasikan entitas berbeda.
6. **Assessment IDs opaque.** `public_item_ids` hanya boleh diisi jika item terdaftar/diotorisasi untuk pasangan `(quest_version_id, item_id)` oleh backend. Tidak ada mapping otomatis antara `ITEM-001` dan `Q-001`.
7. **Provenance wajib untuk konten akademik.** Klaim akademik di task, evidence, dialog, hint, atau feedback harus memiliki source reference yang tervalidasi. Konten fiktif murni tidak harus memiliki referensi akademik.
8. **Tidak ada rahasia penilaian di payload publik.** Answer key, correct answer, private rubric, dan scoring policy tidak termasuk Story Bundle publik.
9. **No silent fallback.** Konten yang tidak didukung harus ditolak dengan error terstruktur atau diarahkan untuk review guru. Jangan mengganti konten dengan Episode 01 secara otomatis.
10. **Status publish bukan input browser.** Status published dan hak akses student ditentukan oleh backend/session tepercaya, bukan boolean dari payload klien.

## 3. Terminologi dan keputusan ID

| Identifier | Makna pada draft ini | Tanggung jawab awal |
|---|---|---|
| `scene_id` | Profil scene/entry point yang dikenali loader/adapter; berada di QuestV1 | Registry dan loader PIC D |
| `world_preset` | Dunia episode: `school` atau `city` | Registry PIC D; pemilihan konten PIC C berdasarkan materi dan capability |
| `room_id` | Hub/ruangan internal pada world | Registry PIC D |
| `npc_id` | Actor/NPC yang telah terdaftar | Registry PIC D |
| `object_id` | Objek interaksi yang telah terdaftar | Registry PIC D |
| `activity_id` | Aktivitas gameplay/task content; dapat dibuat C, harus cocok dengan kemampuan renderer D | C membuat ID konten; D memvalidasi capability |
| `item_id` | Unit assessment yang dinilai backend; identitas kanonis untuk pasangan quest version | C mengusulkan draft ID; B mengotorisasi, menyimpan, dan memvalidasi |
| `question_id` | Identitas konten pertanyaan hanya jika diputuskan sebagai entitas terpisah | Belum digunakan oleh kontrak saat ini; perlu keputusan B/C/D jika diperlukan |
| `evidence_id` | Bukti naratif/akademik yang ditemukan atau dicatat di jurnal | C membuat ID konten; D memetakan ke gameplay; B menyimpan progres resmi |

### 3.1 Activity dan assessment item

Satu `activity_id` dapat memiliki nol, satu, atau beberapa `public_item_ids`. Setiap item assessment dalam MVP dipetakan ke tepat satu LO. Satu aktivitas dapat berhubungan dengan beberapa LO melalui item yang berbeda. Dukungan satu item untuk beberapa LO memerlukan rubric/mapping per LO yang eksplisit dan belum termasuk v0.1.

`public_item_ids` adalah referensi ID saja, bukan tempat menyimpan question text privat, answer key, atau rubric. Jika item belum terdaftar pada quest version yang sah, field harus dihilangkan pada draft non-assessment atau proses publish ditolak sesuai kebijakan B.

### 3.2 Evidence terpisah dari item

Evidence memiliki `evidence_id` sendiri dan dapat menunjuk satu atau lebih sumber akademik. Evidence bukan `item_id`, bukan `question_id`, dan bukan `object_id`. `object_id` menunjukkan objek renderer; `evidence_id` menunjukkan bukti konten yang dicatat.

### 3.3 C5-02 tetap terbuka

Pemeriksaan C menunjukkan `ITEM-001` digunakan pada C-03/Sprint 1, sedangkan `Q-001` digunakan oleh fixture publik/draft lain pada field bernama `item_id`. Belum ada bukti hubungan resmi di antara keduanya. Backend menetapkan identitas item pada pasangan `(quest_version_id, item_id)`. Oleh karena itu:

- jangan rename atau mapping kedua ID;
- jangan infer entitas `question_id` hanya dari awalan `Q-`;
- jangan isi `public_item_ids` dengan salah satu ID sebagai asumsi kanonis;
- penilaian resmi yang membutuhkan mapping tersebut tetap blocked sampai audit persistence/registry PIC B dan kesepakatan B/C/D selesai.

## 4. Struktur Story Bundle v0.1

JSON Schema yang menyertai draft ini berada di `contracts/story-bundle.schema.json`. TypeScript mirror berada di `apps/web/src/lib/quest-generator/story-bundle/types.ts`.

### 4.1 Root fields

| Field | Required | Deskripsi |
|---|---:|---|
| `bundle_schema_version` | Ya | Konstanta `0.1-draft`; belum versi produksi |
| `quest_version_id` | Ya | Harus sama dengan QuestV1 pasangannya |
| `source_document_versions` | Ya | Daftar pasangan `document_id` dan `text_version` yang menjadi sumber bundle |
| `registry_version` | Ya | Versi Capability Registry yang dipin |
| `world_preset` | Ya | `school` atau `city` |
| `start_room_id` | Ya | Room awal yang harus tersedia pada registry yang dipakai |
| `title`, `opening` | Ya | Metadata/narasi episode |
| `learning_context` | Tidak | Metadata konteks pembelajaran (subject, grade, topic, curriculum) dari konteks modul |
| `missions` | Ya | Daftar misi dan dependensinya |
| `dialogues` | Ya | Daftar dialog NPC; boleh kosong jika episode tidak membutuhkan dialog |
| `tasks` | Ya | Daftar aktivitas/task pembelajaran |
| `evidence` | Ya | Daftar evidence naratif; boleh kosong jika belum ada evidence yang dirancang |
| `hints`, `feedback` | Tidak | Konten bantuan/feedback naratif publik |
| `endings` | Ya | Narasi per jalur adaptif; boleh parsial pada draft, tetapi kelengkapan tiga jalur wajib sebelum publish sesuai kebijakan produk |

### 4.2 Mission

Mission menggunakan `mission_id`, `objective_ids`, `required`, `room_id`, `prerequisites`, dan `activity_ids`. Nama `activity_ids` digunakan untuk mengikuti keputusan C5-01, menggantikan `task_ids` pada handoff D v0.2. Ini adalah perubahan DTO yang harus direview/di-acknowledge D sebelum kontrak final.

Mission graph harus:

- menggunakan ID mission yang unik;
- tidak memiliki prerequisite yang tidak ditemukan;
- tidak memiliki siklus;
- hanya mereferensikan objective yang ada di QuestV1;
- hanya mereferensikan `activity_id` yang ada pada `tasks` bundle;
- tetap menyediakan jalur penyelesaian main quest dan tidak menimbulkan soft-lock.

### 4.3 Dialogue

Dialog dikelompokkan berdasarkan `npc_id` dan `room_id`. Setiap node memiliki `node_id`, teks, pilihan, dan `source_refs` opsional.

`source_refs` boleh kosong untuk dialog fiktif murni. Jika dialog memuat klaim akademik, klaim tersebut wajib ditopang source reference pada node yang bersangkutan. Setiap pilihan wajib mengarah ke `next_node_id` dan/atau `unlock_mission_id` yang valid. Graph dialog tidak boleh memiliki referensi menggantung.

### 4.4 Tasks / activities

Nama koleksi tetap `tasks` agar mengikuti Story Adapter Draft D, tetapi identitas aktivitas di dalamnya menggunakan `activity_id` sesuai C5-01.

Setiap task membawa:

- `activity_id`, `room_id`, `object_id`;
- `template`: `observe`, `operate`, `investigate`, atau `decide`;
- `objective_ids`;
- `instruction`;
- minimal satu `source_ref` untuk task akademik;
- opsional `evidence_ids` yang dihasilkan/ditemukan;
- opsional `public_item_ids` setelah ID disahkan B.

Template di atas adalah jenis task untuk Story Bundle, bukan step baru pada QuestV1 v1.0. Renderer harus menyatakan ketersediaan template pada Capability Registry. Draft registry v0.2 belum menjadikan keempat template tersebut playable generik.

### 4.5 Evidence

Evidence adalah entitas terpisah dengan `evidence_id`, `mission_id`, `room_id`, `object_id`, judul/ringkasan, objective mapping, dan source reference. Registry mengatur object yang dapat menampilkannya; sistem jurnal/progres resmi dikoordinasikan dengan D/B.

### 4.6 Hint, feedback, dan ending

Hint dan feedback hanya memuat konten yang aman dipublikasikan. Jika berisi klaim akademik, sertakan `source_refs`. Feedback dapat memiliki jalur `needs_support`, `developing`, atau `ready_for_extension`, tetapi pemilihan jalur adalah keputusan backend/rules, bukan keputusan AI generator.

Ending juga merupakan narasi. Ending tidak menentukan nilai atau mastery LO. Sebelum publish, A/B/C/D perlu memutuskan apakah ketiga ending wajib hadir pada semua bundle.

## 5. Source Reference: adapter dari C-01/C-02

SourceRef bundle menggunakan bentuk normalisasi berikut:

```ts
interface StorySourceReference {
  document_id: string;
  text_version: string;
  source_map_id: string;
  locator:
    | { kind: 'pdf_page'; page: number }
    | { kind: 'docx_paragraph'; paragraph_index: number; section?: string };
  excerpt: string;
}
```

Pemetaan sumber:

| C-01/C-02 | Story Bundle |
|---|---|
| `document_id` pada hasil analisis | `document_id` |
| `text_version` pada hasil analisis | `text_version` |
| C-02 `source_id` (atau source-map ID yang setara) | `source_map_id` |
| C-02 `kind: page`, `page` | `locator.kind: pdf_page`, `locator.page` |
| C-02 `kind: paragraph`, `paragraph_index`, `section?` | `locator.kind: docx_paragraph`, `locator.paragraph_index`, `locator.section?` |
| `excerpt` tervalidasi | `excerpt` |

Adapter tidak boleh menebak lokasi dari excerpt. C memvalidasi `source_map_id`, document version, locator, dan excerpt terhadap immutable snapshot yang persis sama. D memeriksa keterkaitan/kelengkapan referensi tanpa mengubah data sumber.

Setiap pasangan `(document_id, text_version)` yang digunakan harus tercantum pada `source_document_versions`. Jika dokumen berubah, bundle lama tetap menunjuk versi lama; generator harus menganalisis ulang untuk membuat bundle versi baru.

## 6. Public/private boundary

Story Bundle yang dikonsumsi siswa hanya memuat konten tampilan dan identifier publik. Secara eksplisit tidak diperbolehkan memuat `answer_key`, `correct_answer`, private rubric, scoring policy, expected answer, atau nilai prediksi.

Konten assessment privat, mapping scoring, hasil attempt resmi, dan keputusan BedaJalur disimpan/dikelola melalui sistem backend/rules yang disepakati B/D. Schema menggunakan `additionalProperties: false` agar field yang tidak dikenal tidak lolos diam-diam.

## 7. Validasi berlapis

JSON Schema melakukan pemeriksaan bentuk dan tipe data. Validasi semantik berada di generator/Story Adapter, minimal:

1. QuestV1 lolos Quest Schema v1.0.
2. `story_bundle.quest_version_id === quest_v1.quest_version_id`.
3. `registry_version` cocok dengan registry tepercaya yang dipin.
4. Satu `world_preset`; `start_room_id`, seluruh `room_id`, `npc_id`, `object_id`, dan template harus tersedia pada registry untuk mode yang diminta.
5. `scene_id` QuestV1 tidak disamakan dengan `world_preset` atau `room_id`; kombinasi scene/world harus disetujui registry/adapter.
6. Semua LO pada mission/task/evidence merupakan subset `quest_v1.objective_ids`.
7. Semua `activity_id`, `mission_id`, `evidence_id`, node, choice, dan referensi graph unik serta tidak menggantung; mission graph tidak bersiklus.
8. Source reference cocok dengan snapshot dokumen dan versi yang dinyatakan.
9. `public_item_ids` hanya diterima jika terdaftar/diotorisasi untuk `(quest_version_id, item_id)`; jika belum jelas, item mapping ditolak dan C5-02 tetap open.
10. `student` mode memerlukan publikasi dan session backend tepercaya. Preview tidak membuat official attempt/checkpoint.
11. Unsupported content menghasilkan error eksplisit. Tidak ada fallback ke fixture Episode 01.

Error codes dari D v0.2 adalah draft internal. Pemetaan ke API error envelope harus disepakati PIC B; jangan menambah OpenAPI sebelum approval.

## 8. Keputusan yang sudah ada dan open items

| Topik | Status pada saat draft ini |
|---|---|
| QuestV1 v1.0 tidak diubah | Disepakati |
| Scene/world/room terpisah | Disepakati |
| Registry version dipin | Disepakati |
| Source locator wajib | Disepakati |
| Tiga bukti Episode 01 | Fixture-specific; bukan aturan semua episode |
| `ITEM-001` vs `Q-001` | OPEN / UNRESOLVED; assessment integration blocked |
| Activity dapat terkait beberapa item | Disepakati; satu item -> satu LO untuk MVP |
| Submission baseline tanpa `activity_id` | Disepakati sebagai desain |
| Strict validation/no silent fallback | Disepakati sebagai desain |
| `task_ids` dinormalisasi menjadi `activity_ids` | Usulan C untuk selaras C5-01; perlu ack D |
| Top-level `evidence` collection | Usulan C untuk memisahkan evidence dari item/object; perlu ack D |
| `learning_context`, `hints`, `feedback` | Usulan tambahan C; perlu review A/D |
| Syarat tiga ending saat publish | Perlu keputusan A/B/C/D |
| Story Adapter dan generik PlayableEpisode | Belum diimplementasikan; D-owned |
| Registry school/city vNext | Belum ready; renderer v4 status per scene seperti di handoff D v0.2 |

## 9. Acceptance test generalisasi lintas mata pelajaran

Requirement generalisasi lintas mata pelajaran disepakati sebagai target pengujian awal, bukan jaminan setiap materi selalu dapat dijadikan game.

| Modul uji | Fokus | Format dokumen |
|---|---|---|
| Bahasa Indonesia | Analisis dan kredibilitas informasi | PDF dan DOCX |
| Matematika | Pengumpulan dan interpretasi data | PDF dan DOCX |
| IPA | Pengamatan fenomena atau penggunaan alat | PDF dan DOCX |

Acceptance checks:

1. LO benar-benar diturunkan dari materi dan memiliki source reference yang tervalidasi.
2. Narasi, konflik, misi, dialog, dan task berubah secara substantif mengikuti materi, bukan sekadar mengganti judul/NPC.
3. Task memiliki objective mapping serta kemampuan renderer yang sesuai.
4. Source provenance tetap valid untuk PDF maupun DOCX.
5. Bundle lolos JSON Schema dan semantic validation.
6. Adapter menerima hanya konten yang didukung registry untuk mode yang diminta.
7. Materi yang tidak cocok ditolak atau diarahkan ke review guru; tidak ada konten contoh yang disisipkan diam-diam.
8. Episode 01 tetap menjadi regression/compatibility fixture, bukan fallback untuk tiga modul uji.

Satu fixture schema-valid tidak membuktikan generalisasi. Dibutuhkan sekurang-kurangnya enam kasus kombinasi (tiga mata pelajaran x dua format) dan hasil review guru sebelum menyatakan acceptance tercapai.

## 10. Urutan review dan sign-off

1. C mengajukan draft schema/types/fixture v0.1 ini.
2. D mereview `activity_id` vs `task_id`, `evidence` collection, room/object mapping, serta kebutuhan output adapter.
3. A mereview kebutuhan editor, preview, approval, dan field yang perlu diedit guru.
4. B mereview versioning, source snapshot persistence, item registration, public/private assessment, serta publish authorization.
5. Setelah review, tetapkan revisi dan sign-off per PIC. Baru setelah itu kontrak boleh dinyatakan final dan dipakai untuk implementasi generator/adapter.

**Belum ada perubahan** pada QuestV1 v1.0, OpenAPI, migration backend, Story Adapter PIC D, atau assessment registry melalui draft ini.
