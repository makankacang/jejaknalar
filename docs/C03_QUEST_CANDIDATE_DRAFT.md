# C-03 Quest Candidate: Misi Redaksi

**Status: DRAFT - belum disetujui untuk publikasi atau gameplay siswa.**

Dokumen ini adalah rancangan kandidat C-03 berdasarkan modul yang diberikan pengguna. Dokumen ini bukan payload QuestV1 yang valid, bukan Story Bundle final, dan bukan bukti quest sudah playable.

## 1. Sumber dan provenance

| Atribut | Nilai |
|---|---|
| File sumber | `FIX MA 2627 BINDO KLS 8 BAB 1.docx` |
| Mata pelajaran | Bahasa Indonesia |
| Sasaran | Kelas VIII |
| Bab | Bab 1 |
| Subbab | Mengidentifikasi paragraf deskripsi dan eksposisi dalam LHO |
| Document ID lokal | `doc_a305829d3917b4ca` |
| Parser | DOCX parser lokal |
| Jumlah referensi hasil parsing | 923 |
| Jumlah paragraf hasil parsing | 923 |

Document ID dan referensi `DOC-P-*` di bawah ini adalah hasil parsing lokal. Nilai-nilai tersebut belum merupakan `document_id`, `text_version`, atau `source_map_id` resmi dari backend.

Parser melaporkan:
- Empat gambar dilewati; OCR belum didukung.
- Tiga puluh enam tabel diratakan menjadi paragraf.
- Heading tidak terdeteksi sebagai metadata heading.
- Hubungan sumber dengan Subbab 5 ditetapkan berdasarkan pemeriksaan hasil pencarian dan isi paragraf, bukan metadata section yang dihasilkan parser.

Keaslian dokumen, kewenangan penggunaan, dan persetujuan guru tetap perlu dikonfirmasi sebelum materi dipublikasikan.

## 2. Referensi sumber yang ditemukan

| Referensi lokal | Locator | Isi dan kegunaan |
|---|---:|---|
| `DOC-P-522` | Paragraf 522 | Judul Subbab 5: Mengidentifikasi Paragraf Deskripsi dan Eksposisi dalam Laporan Hasil Observasi. |
| `DOC-P-532` | Paragraf 532 | Konteks kegiatan guru menjelaskan pengertian paragraf deskripsi dan eksposisi. |
| `DOC-P-533` | Paragraf 533 | Pertanyaan pemantik tentang pembelajaran paragraf deskripsi dan eksposisi. |
| `DOC-P-559` | Paragraf 559 | Kriteria konseptual: deskripsi menggambarkan keadaan, sedangkan eksposisi menyampaikan informasi. |
| `DOC-P-599` | Paragraf 599 | Contoh sepeda baru Mira dengan detail warna, keranjang, bangku boncengan, dan kaca spion. Kandidat contoh deskripsi. |
| `DOC-P-596` | Paragraf 596 | Contoh sepeda motor dengan informasi harga bahan bakar Rp7.800,00 per liter dan jarak tempuh 47 kilometer. Kandidat contoh eksposisi yang masih perlu validasi guru. |

### Kutipan sumber penting

**DOC-P-559, konsep:**

> Kunci paragraf deskripsi terletak pada cara menggambarkan sebuah keadaan, sedangkan kunci paragraf eksposisi terletak pada informasi yang dikandungnya.

**DOC-P-599, calon paragraf deskripsi:**

> Sepeda baru Mira berwarna merah, punya keranjang, dan memiliki bangku boncengan di bagian belakang. Bel sepedanya terletak di setang sebelah kanan. Ada kaca spion kecil di setang kiri dan kanan yang berfungsi untuk melihat jika ada kendaraan dari belakang.

**DOC-P-596, calon paragraf eksposisi:**

> Sepeda motor banyak digunakan untuk pergi bekerja karena termasuk salah satu alat transportasi yang hemat. Dengan bahan bakar seharga Rp7.800,00 per liter, pengendara sepeda motor bisa menempuh jarak sejauh 47 kilometer.

Kutipan disingkat pada bagian akhir paragraf DOC-P-596. Teks lengkap tetap tersedia pada hasil parsing lokal.

## 3. Target pembelajaran kandidat

Rumusan target belajar untuk ditinjau guru:

Peserta didik dapat membedakan paragraf deskripsi dan eksposisi berdasarkan ciri informasi yang disajikan serta menunjukkan bukti tekstual yang mendukung klasifikasinya.

**Penting:** rumusan tersebut adalah usulan pembelajaran, bukan ID Learning Objective yang telah disetujui. Jangan memasukkannya sebagai `objective_ids` sebelum PIC B menyediakan ID `LO-*` resmi.

## 4. Rancangan quest

### Judul

**Misi Redaksi: Deskripsi atau Eksposisi?**

### Premis

Peserta didik bergabung dengan tim redaksi majalah sekolah. Mereka menerima dua paragraf yang harus diperiksa sebelum diterbitkan. Mereka perlu menentukan jenis paragraf dan memberikan bukti tekstual yang mendukung keputusan.

### Alur kandidat

1. **Briefing redaksi**
   - Membaca kriteria deskripsi dan eksposisi.
   - Sumber konsep: `DOC-P-559`.

2. **Audit paragraf pertama**
   - Mengamati paragraf sepeda Mira.
   - Mengidentifikasi detail yang menggambarkan karakteristik objek.
   - Sumber kandidat: `DOC-P-599`.
   - Klasifikasi kandidat: deskripsi.

3. **Audit paragraf kedua**
   - Mengamati paragraf sepeda motor.
   - Mengidentifikasi informasi dan data yang disajikan.
   - Sumber kandidat: `DOC-P-596`.
   - Klasifikasi kandidat: eksposisi, menunggu validasi guru.

4. **Klasifikasi**
   - Memilih jenis paragraf untuk setiap contoh.
   - Menunjukkan bagian teks yang dijadikan dasar jawaban.

5. **Kesimpulan redaksi**
   - Menjelaskan perbedaan deskripsi dan eksposisi.
   - Menyampaikan bukti yang mendukung klasifikasi.

### Kriteria evaluasi kandidat

- Ketepatan membedakan deskripsi dan eksposisi.
- Kemampuan menemukan ciri teks yang relevan.
- Kemampuan memilih bukti tekstual.
- Kemampuan menjelaskan alasan klasifikasi.

Belum ada assessment item ID, rubrik backend, atau mapping reassessment yang disahkan untuk kandidat ini.

## 5. Kesesuaian dengan QuestV1 1.0

QuestV1 1.0 tetap dipertahankan tanpa perubahan schema.

| Field | Ketentuan | Status kandidat |
|---|---|---|
| `schema_version` | `1.0` | Mengikuti kontrak yang ada |
| `quest_id` | ID dari backend | Belum tersedia |
| `quest_version_id` | ID dari backend | Belum tersedia |
| `objective_ids` | ID `LO-*` yang disetujui | Menunggu PIC B |
| `template` | `evidence_hunt` | Sesuai template yang tersedia |
| `scene_id` | Scene yang didukung capability | Scaffold saat ini menggunakan `school_library` |
| `steps` | `read_document` dan `select_evidence` | Batas jenis step sesuai kontrak |
| `variants` | Tiga ID variant dari capability | Masih konfigurasi statis |

### Batas generator saat ini

`generateCompatibleQuestDraft()`:
- Bukan generator cerita AI dan tidak memanggil Gemini.
- Memerlukan identity backend dan minimal satu objective yang disetujui.
- Menggunakan referensi dokumen `DOC-001` dan item `ITEM-001` dari capability statis.
- Tidak membawa isi paragraf atau provenance `DOC-P-*` ke payload publik.
- Menggunakan konten scene statis.
- Tidak menghasilkan assessment atau reassessment baru.

Karena itu, referensi lokal `DOC-P-559`, `DOC-P-599`, dan `DOC-P-596` tidak boleh diganti begitu saja dengan `DOC-001` atau `ITEM-001`. Hubungan sumber lokal dengan referensi backend belum tersedia.

**Belum ada payload QuestV1 final yang dibuat untuk kandidat ini.** Identitas dan LO resmi harus menunggu PIC B.

## 6. Pemetaan awal ke registry PIC D

Rujukan registry D yang telah diperiksa:

`D-school-1.4-sprint2-1`

Registry ini berstatus `DESIGN_MOCK_NOT_PRODUCTION`. Pemetaan berikut hanya untuk diskusi integrasi.

| Elemen rancangan | Referensi registry | Hasil pemeriksaan |
|---|---|---|
| World preset | `school` | Tersedia pada registry mock |
| Ruang awal | `school.library` | Tersedia pada registry mock |
| NPC pustakawan | `school.npc.librarian` | Tersedia pada registry mock |
| Meja baca | `school.library.reading_table_0` | Tersedia sebagai objek interaksi baca |
| Arsip perpustakaan | `school.library.archive` | Tersedia sebagai objek interaksi dokumen |

Keberadaan ID di registry mock belum membuktikan objek tersebut sudah memiliki binding task yang dapat digunakan oleh quest dinamis. Mapping runtime, evidence, submit, dan scoring tetap memerlukan verifikasi PIC D.

Adapter Story Bundle yang diperiksa masih mengembalikan `previewOnly: true`. Registry dan Story Bundle belum boleh dianggap sebagai jalur gameplay siswa yang sudah disetujui.

## 7. Blocker dan pemilik tindak lanjut

| Blocker | Pemilik | Bukti yang dibutuhkan |
|---|---|---|
| Registrasi dokumen dan versi teks | PIC B | Backend document ID, text version, source map ID, dan provenance persisten |
| Learning Objective resmi | PIC B / guru | ID `LO-*` yang disetujui |
| Identitas quest persisten | PIC B | `quest_id` dan `quest_version_id` |
| Validasi isi dan klasifikasi contoh | Guru / PIC A | Persetujuan target belajar dan validasi DOC-P-596 sebagai eksposisi |
| Pemetaan scene, NPC, objek dan task | PIC D | Review registry dan kontrak adapter |
| Story Bundle yang dapat dipakai bersama | PIC C, B, dan D | Boundary contract yang direview bersama |
| Gameplay dan scoring end-to-end | PIC B dan D | Bukti Student API real, submit, score, serta alur hasil |

## 8. Keputusan sementara

1. Pertahankan QuestV1 1.0.
2. Jangan membuat persistent ID atau LO ID sendiri.
3. Jangan menganggap referensi parser lokal sebagai source reference backend.
4. Jangan mengklaim generator saat ini sudah membuat cerita berbasis AI.
5. Jangan mengklaim Story Bundle atau registry mock sudah playable.
6. Kandidat ini tetap berstatus DRAFT sampai provenance, learning objective, identitas quest, review registry, dan validasi guru tersedia.

**Kesimpulan:** materi dan alur pembelajaran sudah memiliki dasar sumber yang dapat dilacak secara lokal. Integrasi ke QuestV1 dan Story Bundle masih menunggu kontrak serta identitas resmi dari pemilik backend dan runtime.
