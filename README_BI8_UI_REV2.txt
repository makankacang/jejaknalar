JEJAKNALAR BI8 PREVIEW — REV2 PANDUAN + UI UTAMA

Ini PATCH LANJUTAN. Ekstrak ke root D:\JEJAKNALAR\WT_D_BI8_PREVIEW (bukan D06 atau D07).

Perbaikan:
- Panduan tugas dinamis sesuai progres dan target terdekat; perintah E untuk Bu Maya, Buku Tamu, Map Laporan, Papan Kasus.
- Susunan UI mengikuti arah Sprint2 utama (canvas fullscreen, branding kiri atas, peta kanan atas, objektif ribbon bawah tengah, D-pad & Interaksi).
- Mini-map menunjukkan player dan target ketika di ruang yang sama (arah perkiraan, bukan pathfinding).
- Dialog, evidence, pemeriksaan dokumen, keputusan, dan aturan preview-only dipertahankan.
- Tidak mengubah backend PIC B, registry D06, atau QuestV1 resmi.

Testing di PowerShell:
cd D:\JEJAKNALAR\WT_D_BI8_PREVIEW
powershell -NoProfile -ExecutionPolicy Bypass -File .\TEST_BI8_PREVIEW.ps1
npm run dev -w apps/web -- --host 127.0.0.1 --port 5173
Browser: http://localhost:5173/bi8.preview.html (Ctrl+Shift+R jika halaman lama tercache)

Belum commit/push sampai tes browser, terutama posisi UI responsif & alur 3 misi, selesai.
