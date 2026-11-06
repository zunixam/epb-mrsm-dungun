# e-PB Dungun Fasa 2 — D1, Pages Functions dan Cloudflare Access

## Asas Git dan keselamatan production

Pada permulaan pembangunan, `git ls-remote --symref origin HEAD` mengesahkan branch lalai `main` pada `e805fc6`. Ia masih mengandungi HTML asal. Kod Fasa 1 terkini ialah `feat/epb-v1` pada `ae707b7`, yang sudah merangkumi `main`. Branch `feat/epb-admin-d1` dibina daripada kod Fasa 1 itu. Tiada merge ke main, deployment, penciptaan database remote atau migrasi production dijalankan.

`wrangler.jsonc` sengaja menggunakan ID database sifar dan nama tempatan. Ini bukan ID production. Jangan menggantikannya dengan ID production atau menjalankan arahan remote tanpa semakan dan kelulusan berasingan. Jangan aktifkan integrasi awam sebelum database dan API diuji dalam persekitaran bukan production.

## Jalankan secara tempatan

Node.js 22.12+ dan npm diperlukan; diuji menggunakan Node.js 24.

```sh
npm ci
npm run build
npm run db:migrate:local
npm run dev:pages -- --ip 127.0.0.1 --port 8788
```

Arahan migrasi menggunakan `--local` secara eksplisit. Ia tidak memerlukan akaun Cloudflare dan tidak mencipta database remote. Keadaan D1 tempatan disimpan dalam `.wrangler/` yang diabaikan Git. Ulang `npm run db:migrate:local` untuk mengesahkan tiada migrasi tertunggak.

`npm run dev` hanya menjalankan frontend Vite. Ia tidak menjalankan Functions: portal menggunakan rujukan asal, dan admin tidak boleh mengakses API. Untuk aliran penuh gunakan `dev:pages` selepas build. Selepas mengubah frontend, bina semula `dist`.

Untuk menguji API awam dengan **D1 tempatan sahaja**:

```sh
npm run dev:pages -- --ip 127.0.0.1 --port 8788 --binding PUBLIC_DATA_ENABLED=true
```

`GET /api/schedules` patut memulangkan lapan rekod seed; `GET /api/announcements` patut memulangkan senarai kosong. Tanpa konfigurasi Access, `/admin`, `/admin/*` dan semua `/api/admin/*` memulangkan 503. Dengan konfigurasi lengkap tetapi tanpa JWT, responsnya 401. Tiada bypass autentikasi tempatan dalam kod aplikasi.

## Migrasi dan seed

- `migrations/0001_initial.sql`: jadual `pb_schedules`, `announcements`, `audit_logs`; ID unik, timestamp UTC, versi rekod, constraint status/kategori/masa dan indeks bacaan awam, kategori serta sejarah.
- `migrations/0002_seed_original.sql`: lapan rekod daripada `index (7).html`, dengan ID stabil `original-pb-01` hingga `original-pb-08`. `ON CONFLICT(id) DO NOTHING` memastikan seed berulang tidak menggandakan atau menimpa perubahan pentadbir.
- Rekod asal diterbitkan dalam seed; ia masih tidak disajikan oleh API awam sehingga `PUBLIC_DATA_ENABLED=true` ditetapkan.
- Pengumuman demo Fasa 1 **tidak** dimasukkan sebagai pengumuman rasmi.

Untuk **database staging yang diluluskan dan sudah dicipta secara manual**, tambahkan binding D1 sebenar di konfigurasi `env.preview` dengan `binding: DB`, `database_name`, `database_id` staging dan `migrations_dir: migrations`. Semak nama/ID sasaran sebelum menjalankan secara manual:

```sh
# STAGING SAHAJA; tidak dijalankan semasa pembangunan ini.
npx wrangler d1 migrations apply DB --env preview --remote
```

Jika Pages Dashboard digunakan untuk binding, pastikan konfigurasi Wrangler yang digunakan CLI mempunyai binding staging yang sama. Jangan gunakan placeholder tempatan untuk remote dan jangan bergantung pada pilihan persekitaran tersirat. Ambil backup dan semak migrasi dahulu sebelum sebarang kerja production yang diluluskan pada masa hadapan.

## Cloudflare Access — konfigurasi manual wajib

1. Dalam Zero Trust, cipta aplikasi **Self-hosted** untuk hostname portal staging. Lindungi **kedua-dua** path `/admin` (termasuk subpath) dan `/api/admin` (termasuk subpath). Gunakan aplikasi Access yang sama dengan audience yang sama untuk kedua-duanya, melalui konfigurasi beberapa public hostname/path. Jangan lindungi keseluruhan hostname sehingga portal awam memerlukan login.
2. Tambahkan polisi Allow untuk identiti pentadbir yang ditetapkan dan penyedia identiti organisasi. Jangan gunakan polisi Bypass untuk laluan tersebut. Konfigurasi MFA/keperluan sesi mengikut polisi organisasi.
3. Tetapkan runtime variables Pages Functions untuk persekitaran yang betul:

| Nama | Nilai |
| --- | --- |
| `ACCESS_TEAM_DOMAIN` | `https://<team>.cloudflareaccess.com` tanpa trailing slash |
| `ACCESS_AUD` | Application Audience (AUD) sebenar daripada aplikasi Access |
| `ADMIN_EMAILS` | Senarai e-mel dibenarkan, dipisahkan koma; semakan tepat, tanpa wildcard |
| `PUBLIC_DATA_ENABLED` | `false` dahulu; tukar kepada `true` hanya selepas pengesahan staging |
| `DB` | Binding D1, bukan string variable, kepada database persekitaran yang betul |

Tiada nilai ini menggunakan awalan `VITE_`; tiada token/secrets dimasukkan dalam bundle frontend. AUD/domain bukan kata laluan, tetapi tetap konfigurasi server. Tiada penyimpanan kata laluan sendiri. Untuk tempatan, `.dev.vars.example` boleh disalin ke `.dev.vars` yang diabaikan Git. Jangan commit nilai atau token sebenar.

4. `server/auth.ts` mendapatkan JWKS daripada `${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs` melalui HTTPS dan memverifikasi JWT `Cf-Access-Jwt-Assertion` menggunakan `jose`: signature RS256, issuer, audience, expiry serta tuntutan wajib `exp`, `iat`, `sub`, `email`. E-mel mesti tersenarai dalam `ADMIN_EMAILS`. Header e-mel identiti semata-mata tidak dipercayai. Kegagalan konfigurasi/JWKS/token tidak membuka akses.
5. Uji akses anonymous, identiti di luar senarai, token expired dan login pentadbir sebenar di staging. Pastikan hostname custom **dan** URL preview/pages.dev tidak membuka admin. Server masih menolak akses tanpa JWT sah walaupun polisi edge tersalah konfigurasi. Routing Pages mesti menggunakan fail `_routes.json` yang dibekalkan.
6. Operasi tulis memerlukan `Origin` sama dengan origin API dan `Content-Type: application/json`, selain JWT sah. Jangan tambah CORS permisif atau pengecualian CSRF. UI menggunakan cookie sesi Access melalui permintaan same-origin; ia tidak membaca atau menyimpan token.

**Batas pengesahan:** ujian kriptografi menggunakan pasangan kunci RSA tempatan dan ujian API menggunakan runtime D1 tempatan. Login IdP sebenar, pengambilan JWKS organisasi, binding remote dan edge policies memerlukan konfigurasi manual dan belum disahkan dengan akaun Cloudflare sebenar.

## API

Semua respons API menggunakan `Cache-Control: no-store`. Endpoint awam hanya GET, dan hanya mengembalikan `published`. Tiada endpoint audit awam.

| Endpoint | Kaedah / fungsi |
| --- | --- |
| `/api/schedules` | GET jadual diterbitkan; `year`, `month`, `q` |
| `/api/announcements` | GET pengumuman diterbitkan; `q` |
| `/api/admin/status` | GET status DB dan identiti disahkan |
| `/api/admin/schedules` | GET semua status; `year`, `month`, `category`, `status`, `q`; POST tambah |
| `/api/admin/schedules/:id` | PUT edit/status; pembatalan menggunakan `status: cancelled`, bukan DELETE |
| `/api/admin/announcements` | GET semua status; `status`, `q`; POST tambah |
| `/api/admin/announcements/:id` | PUT edit/status, DELETE padam |
| `/api/admin/audit?page=0` | GET sejarah, 100 rekod setiap halaman |

POST/PUT jadual menerima `title`, `start_date` dan `end_date` (`YYYY-MM-DD`), `departure_time` dan `return_time` (`HH:mm`, MYT), `category` (`PB Wajib`/`PB Pilihan`), `status` (`draft`/`published`/`cancelled`). Tarikh masuk mesti **selepas** tarikh keluar; tarikh sebenar dan masa divalidasi di server. Julat tahun disokong 2000–2100. Pengumuman menerima `title`, `body`, `status` (`draft`/`published`). Teks dipaparkan sebagai teks React, bukan HTML.

PUT memerlukan keseluruhan rekod yang boleh diedit bersama `version` terkini; DELETE pengumuman memerlukan `{ "version": <versi> }`. Konflik versi memulangkan 409. Muat semula data sebelum mencuba semula; jangan timpa perubahan orang lain. ID dan timestamp ditentukan server. Semua nilai SQL dibind; nama jadual/lajur dipilih daripada senarai tetap. Had payload 32 KiB.

Perubahan dan audit dilakukan melalui `DB.batch` atomik. Log mengandungi actor JWT disahkan, tindakan, ID entiti, masa UTC dan salinan sebelum/selepas. Audit untuk update/delete hanya dimasukkan jika versi rekod sepadan. UI meminta pengesahan sebelum simpan, terbit, nyahterbit, batal atau padam. Jadual dibatalkan kekal dalam database dan sejarah.

## Integrasi portal dan pelan pengaktifan

Frontend meminta kedua-dua API awam. Hanya apabila **kedua-dua** respons berjaya dan rekod lulus validasi diterbitkan, jadual dan pengumuman dimasukkan ke paparan. Jadual kosong yang sah dikekalkan kosong. Masa dinamik digunakan untuk countdown, bukannya pemetaan ID asal. Kalendar, carian, penapis dan cetakan menggunakan sumber rekod yang sama.

Jika API belum diaktifkan, gagal atau mengandungi data tidak sah, portal mengekalkan rujukan asal Fasa 1 dan melabelkan sumber itu. Pengumuman demo kekal dilabel DEMO dan tidak menjadi pengumuman rasmi. Dalam mod D1 yang berjaya, demo diganti hanya dengan pengumuman diterbitkan (atau keadaan tiada pengumuman). Rujukan asal ketika kegagalan API ialah jadual sejarah 2026, **bukan jaminan salinan terkini database**.

Sebelum pengaktifan manual: sediakan D1 staging, migrasi, semak lapan rekod, sahkan Access, uji CRUD/draf/audit pada staging, kemudian aktifkan `PUBLIC_DATA_ENABLED=true` dalam staging. Pengaktifan production memerlukan kelulusan berasingan; jangan sambungkan preview kepada database production. Tetapan `false` mengekalkan portal pada sumber asal dan menjadikan API awam 503. Fungsi Fasa 1 tidak dipadam.

## Ujian

```sh
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run db:migrate:local
```

- Vitest: 26 ujian, termasuk regresi Fasa 1, validasi pemetaan API, JWT kriptografi, akses anonymous, allowlist, CRUD D1 sebenar secara tempatan, idempotensi seed, konflik versi, audit, draf tersembunyi SQL injection, had payload dan rollback apabila audit gagal.
- Playwright: 5 ujian; regresi jadual/carian/kalendar/countdown/cetakan, sumber D1 dinamik, UI admin ditolak jika API gagal, aliran editor dengan pengesahan dan lebar 375px. API admin dalam ujian UI dimock; keselamatan API diuji berasingan dengan JWT/D1.
- Smoke test `wrangler pages dev`: portal 200; API awam tempatan 200 dengan lapan rekod/tiada pengumuman; `/admin`, subpath admin dan API admin 503 apabila konfigurasi Access tiada.
- Migrasi tempatan berjaya. Seed dua kali tidak menggandakan lapan rekod. PDF regresi kekal satu halaman A4 landskap.

Wrangler tempatan mungkin memberi amaran bahawa `Request.cf` tidak dapat diambil melalui rangkaian; runtime menggunakan placeholder tempatan. Ini tidak menggantikan pengesahan staging sebenar.

## Fail utama baharu / diubah

Baharu: `src/Admin.tsx`, `src/shared.ts`, `src/publicData.ts`, `src/publicData.test.ts`, `server/auth.ts`, `server/auth.test.ts`, `server/validation.ts`, `server/api.ts`, `server/api.test.ts`, `functions/api/[[path]].ts`, `functions/admin/[[path]].ts`, `migrations/0001_initial.sql`, `migrations/0002_seed_original.sql`, `public/_routes.json`, `public/_headers`, `wrangler.jsonc`, `.dev.vars.example`, dokumen ini.

Diubah untuk integrasi: `src/main.tsx`, `src/schedule.ts`, `src/data.ts` (jenis ID/masa dinamik; lapan rekod asal kekal), `src/style.css`, `tests/app.spec.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `README.md`. HTML asal tidak diubah.
