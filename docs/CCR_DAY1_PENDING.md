# Contract Change Requests — Pending Team Approval (B-01)

**Jangan ubah OpenAPI secara sepihak pada Sprint 0.** B adalah steward, namun perubahan ini memengaruhi PIC A/C/D.

| CCR | Usulan | Pihak yang menyetujui | Alasan |
|---|---|---|---|
| CCR-01 | Guru membuat roster / kode individual melalui `POST /classes/{id}/students`. | A+B | Identifikasi siswa unik dan aman. |
| CCR-02 | `POST /student/join` meminta class_code + individual_access_code, bukan hanya display_name; tentukan input nama sebagai tampilan opsional. | A+B+D | Hindari penyamaran siswa. |
| CCR-03 | Kembalikan `attempt_id` idempotent bersama quest publik. | B+D | Sesi dan submit konsisten. |
| CCR-04 | `POST /student/progress` atau endpoint setara yang membatasi state tersimpan. | B+D | Progres tahan refresh tanpa manipulasi nilai. |
| CCR-05 | Mode guest/demo terpisah dari mode kelas autentikasi. | A+B+D | Juri tanpa akses khusus; data sintetis. |
| CCR-06 | Standarkan `assessment_item_id`/`item_id` pada game dan backend. | B+D+C | Hindari mismatch. |
| CCR-07 | Recovery credential individual dan rotasi sesi melalui endpoint terverifikasi. | A+B | Restore progress di perangkat baru. |
| CCR-08 | Definisikan kontrak `/health`, `/modules/analyze`, `/quests/generate` dan publish lengkap, termasuk model error. | B+C | API contract lengkap. |

Rapat singkat: setujui field, schema, fixture, error, lalu ubah `contracts/api.openapi.yaml` pada PR kontrak terpisah.
