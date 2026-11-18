JEJAKNALAR PIC D — BI8 STORY BUNDLE PREVIEW PATCH
=================================================
TARGET REPO: D:\JEJAKNALAR\WT_D_BI8_PREVIEW
BRANCH: feat/D-bi8-story-preview (berasal dari D-06 286c143)
STATUS: PREVIEW-ONLY / DRAFT / BUKAN STUDENT RUNTIME RESMI

KONTEN PATCH (semuanya file baru, tidak overwrite source D-06)
- apps/web/bi8.preview.html
- apps/web/src/features/student/bi8/main.tsx
- apps/web/src/features/student/bi8/BI8Preview.tsx
- apps/web/src/features/student/bi8/bi8-model.ts
- apps/web/src/features/student/bi8/bi8-model.test.ts
- apps/web/src/features/student/bi8/bi8.css
- apps/web/src/features/student/bi8/story-bi8.json
- TEST_BI8_PREVIEW.ps1

SUMBER KONTEN
JSON PIC C C03_STORY_BINDING_CANDIDATE_BI8_v0.1.json disalin tanpa
mengubah field akademik, selain menghapus UTF-8 BOM agar aman untuk bundling.
Registry dan Phaser World Engine lama digunakan langsung (tanpa menimpa D-06).

INSTALASI (PowerShell)
1) Unduh ZIP hasil ChatGPT ke folder D:\JEJAKNALAR.
2) Jalankan:
   $repo = 'D:\JEJAKNALAR\WT_D_BI8_PREVIEW'
   if ((git -C $repo branch --show-current) -ne 'feat/D-bi8-story-preview') { throw 'Branch salah!' }
   Expand-Archive -Path 'D:\JEJAKNALAR\JEJAKNALAR_BI8_PREVIEW_PATCH.zip' -DestinationPath $repo -Force
   cd $repo
   git status --short
3) Tes otomatis:
   powershell -NoProfile -ExecutionPolicy Bypass -File .\TEST_BI8_PREVIEW.ps1
4) Jalankan web dev server (terminal PowerShell tetap hidup):
   npm run dev -w apps/web -- --host 127.0.0.1 --port 5173
5) Buka URL:
   http://localhost:5173/bi8.preview.html
   Jika port sudah terpakai, ikuti alamat lokal yang dicetak Vite.

MANUAL BROWSER QA
[ ] Prolog memuat 'Misi Redaksi: Deskripsi atau Eksposisi?' dari PIC C.
[ ] Karakter mulai di school.library, bukan halaman sekolah.
[ ] Temui Bu Maya dan pilih 'Mulai memeriksa panduan redaksi'.
[ ] Dekati Buku Tamu perpustakaan, baca kutipan DOC-P-559,
    tandai sudah dibaca, klik 'Catat aktivitas ke jurnal'.
[ ] Ikuti pintu ke Koridor dan Ruang Guru. Dekati map laporan,
    baca DOC-P-599 & DOC-P-596, tulis perbandingan minimal 15 karakter;
    selesaikan aktivitas kedua.
[ ] Lewati pintu menuju Aula Diskusi. Periksa Papan Kasus,
    baca ketiga kutipan, klasifikasikan kedua paragraf, pilih bukti,
    tulis dua alasan minimal 15 karakter; catat aktivitas ketiga.
[ ] Tampilan selesai + Jurnal menunjukkan 3/3 aktivitas dan evidence.
[ ] Uji desktop (WASD/panah, E, M), mobile (D-pad, Interaksi),
    NPC terlalu jauh tidak langsung membuka dialog; mengklik objek
    jauh dapat membuat karakter berjalan mendekati dahulu.
[ ] Uji bahwa tidak ada request assessment, hasil mastery, atau publikasi.

BATASAN YANG WAJIB DIJAGA
- QuestV1 pasangan adalah identitas sementara di proses preview untuk
  memvalidasi kontrak; BUKAN quest_version_id published oleh PIC B.
- Tidak ada kunci jawaban, rubric privat, scoring, mastery atau BedaJalur resmi.
- Source refs berasal dari JSON PIC C; belum diverifikasi ulang terhadap
  snapshot immutable dokumen pada layanan PIC B.
- Progres dan jawaban hanya di memori React; refresh akan memulai ulang.
- Panel BI8 terpisah dari QuestGame lama agar tidak mengganggu D-06 dan D-07.
- UI masih memakai layout/lokasi objek D-06; teks nama objek pada canvas
  dapat tetap nama fasilitas sekolah, sedangkan konten pembelajaran pada
  modal sepenuhnya dari draft PIC C.
- Belum ada browser E2E tervalidasi di mesin ini. Jangan klaim CI/browser
  PASS sampai tes lokal di Windows benar-benar lulus.
- PR #38 masih HOLD terkait fetch Illegal invocation. Jangan merge
  branch BI8 ke develop tanpa koordinasi PIC B dan review PR dependensi.

HASIL VALIDASI DI LINGKUNGAN PEMBUAT PATCH
- AST transpilation TypeScript/TSX: PASS.
- TypeScript semantic check untuk file patch dengan stub minimal: PASS
  (BUKAN full typecheck repo JejakNalar).
- 5 runtime integration checks via transpile harness dengan adapter.ts,
  runtime.ts, world.ts dan school-v1.4.json nyata: PASS.
- Full npm typecheck / Vitest / build / browser di repo pengguna: BELUM DIUJI.
