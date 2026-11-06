# e-PB Dungun — Fasa 1

Portal jadual Pulang Bermalam MRSM Dungun menggunakan React, Vite, TypeScript dan Tailwind CSS melalui npm. Antara muka Bahasa Melayu bertema ungu pastel, dengan dashboard, jadual berpenapis, kalendar interaktif, countdown langsung, pengumuman demo dan cetakan A4 landskap.

## Pembangunan

Memerlukan Node.js 22.12+ (diuji dengan Node.js 24) dan npm.

```sh
npm ci
npm run dev
```

```sh
npm run build
npm test
npm run test:e2e
```

`npm run preview` menjalankan hasil build. Ujian pelayar membina andaian bahawa `npm run build` telah selesai. Konfigurasi Playwright menggunakan Chromium di `/usr/bin/chromium`; tetapkan `CHROMIUM_PATH` kepada lokasi Chromium anda jika berbeza. PDF ujian disimpan dalam `test-results/jadual-a4.pdf` (diabaikan Git). Butang cetak mencetak semua lapan sesi, tanpa mengira tab atau penapis semasa; pilih A4 landskap dalam dialog jika pencetak tidak mengikut tetapan CSS.

## Sumber data dan skop

- `index (7).html` ialah fail sumber asal yang dikekalkan tanpa perubahan untuk rujukan sahaja. Ia bukan titik masuk aplikasi Vite. Rujukan CDN lama di dalam arkib ini tidak digunakan aplikasi baharu.
- `src/data.ts` memindahkan kesemua lapan rekod asal, termasuk masa keluar, masa kembali dan sesi Disember yang berakhir pada 2 Januari 2027.
- `src/schedule.ts` mengurus carian, penapis, julat tarikh kalendar dan countdown. Semua tarikh dan masa menggunakan `Asia/Kuala_Lumpur` (UTC+08:00). Countdown memilih sesi yang masa keluarnya belum tiba; selepas sesi terakhir, aplikasi memaparkan keadaan jadual selesai.
- Kalendar meliputi setiap hari antara tarikh keluar dan masuk, termasuk kedua-dua tarikh. Navigasi bulan dan butang Hari ini disediakan.
- Pengumuman ialah demonstrasi berlabel, bukan pengumuman rasmi baharu.
- Aset aplikasi dibundel secara tempatan oleh npm/Vite; tiada CDN, Supabase, backend atau kelayakan diperlukan. Cloudflare D1 belum diintegrasikan dan disediakan untuk fasa seterusnya.
- Fasa ini tidak menyediakan permohonan PB, akaun pengguna, kelulusan atau penyimpanan data pelayan.

## Pengesahan

Vitest menguji pemindahan peristiwa daripada HTML asal, gabungan penapis, tarikh rentas tahun, waktu Malaysia dan sempadan countdown. Playwright menguji aliran dashboard/jadual/kalendar, pengumuman demo, ketiadaan permintaan luar, keadaan jadual tamat, responsif mudah alih dan cetakan jadual lengkap.

Tiada deployment atau merge production diperlukan untuk menjalankan aplikasi ini.
