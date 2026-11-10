# Error codes — JejakNalar (Sprint 0)

Semua API mengembalikan `{"ok":false,"error":{"code":"...","message":"..."},"request_id":"..."}` pada error.

| Kode | HTTP | Makna |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Data input tidak valid. |
| `UNAUTHORIZED` | 401 | Kredensial tidak ada / tidak sah. |
| `FORBIDDEN` | 403 | Tidak diizinkan untuk operasi tersebut. |
| `NOT_FOUND` | 404 | Resource tidak ditemukan **atau sengaja disamarkan** jika bukan miliknya. |
| `CONFLICT` | 409 | Versi atau idempotency key bertabrakan. |
| `RATE_LIMITED` | 429 | Batas percobaan/kuota terpenuhi. |
| `AI_UNAVAILABLE` | 503 | Provider AI gagal / tidak tersedia. |
| `INTERNAL_ERROR` | 500 | Kesalahan server. |

**Perhatian:** untuk kelas milik guru lain dan rekam siswa milik siswa lain, pilih 404 untuk menghindari kebocoran eksistensi, sesuai kebijakan keamanan yang telah direncanakan. Pastikan OpenAPI mengacu pada daftar final setelah CCR disetujui.
