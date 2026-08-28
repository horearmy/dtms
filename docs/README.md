# DTMS Documentation

Dokumentasi proyek DTMS dibagi menjadi tiga kelompok:

| Dokumen | Tujuan |
|---|---|
| [Codebase Review](./DTMS_CODEBASE_REVIEW.md) | Review teknis dan blueprint berdasarkan implementasi saat ini |
| [System Documentation](./SISTEM_LENGKAP.md) | Dokumentasi sistem yang lebih lama dan luas |
| [Application Documentation](./DOCUMENTATION.md) | Referensi setup, modul, API, dan operasi |
| [Pre-deployment Audit](./LAPORAN-AUDIT-PRA-DEPLOY.md) | Riwayat audit keamanan dan verifikasi pra-deploy |
| [Application Flow](./FLOW.md) | Ringkasan alur penggunaan aplikasi |
| [Multi-tenant Isolation](./MULTI_TENANT_ISOLATION.md) | Catatan desain isolasi tenant |
| [Enterprise Blueprint](./DTMS_Enterprise_Upgrade_Blueprint.md) | Rencana pengembangan enterprise |

## Cara Membaca

Mulai dari `DTMS_CODEBASE_REVIEW.md`. Dokumen tersebut adalah sumber ringkasan paling relevan untuk memahami kondisi codebase saat ini. Dokumen lain berisi konteks historis dan harus dibandingkan dengan kode sebelum dijadikan spesifikasi.

Dokumen review memberi label berikut:

- **Implemented**: terlihat langsung dari source code atau schema.
- **Observed**: didukung oleh test, audit, atau konfigurasi yang tersimpan di repository.
- **Recommendation**: usulan desain untuk aplikasi baru atau iterasi berikutnya.
- **Risk**: hal yang perlu diselesaikan atau diverifikasi sebelum produksi.

Tanggal review: 28 Agustus 2026.
