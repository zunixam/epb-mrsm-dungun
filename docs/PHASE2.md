# e-PB Dungun Fasa 2 — Login pentadbir D1

## Skop semasa dan keselamatan persekitaran

Branch pembangunan: `feat/epb-admin-login`, berasaskan `feat/epb-admin-d1` (`c3b8291`). Pengesahan Cloudflare Access/JWT telah diganti dengan akaun pentadbir dan sesi dalam D1. Tidak memerlukan Zero Trust Access, Supabase atau Firebase. Semua fungsi dashboard, jadual, pengumuman, audit, kalendar, countdown dan cetakan dikekalkan. HTML asal tidak diubah.

`wrangler.jsonc` kekal tanpa perubahan:

| Persekitaran | Binding | Database | ID |
| --- | --- | --- | --- |
| Tempatan / top-level | DB | epb-dungun-local | 00000000-0000-0000-0000-000000000000 |
| Preview sahaja | DB | epb-dungun-staging | 20235c71-0c91-428c-80a3-06eee3eab20e |

`PUBLIC_DATA_ENABLED=false` dalam kedua-dua konfigurasi. Staging tidak diwarisi oleh production. Tiada database production dikonfigurasi. Kerja ini tidak menjalankan migrasi remote, deployment, bootstrap akaun sebenar, push atau merge.

## Persediaan dan ujian tempatan

Node.js 24 disyorkan (digunakan dalam pengesahan). CLI bootstrap menggunakan sokongan TypeScript strip-types Node; tidak memerlukan transpiler atau menjalankan bundel frontend.

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run db:migrate:local
npm run dev:pages -- --ip 127.0.0.1 --port 8788 --local-protocol https
```

`db:migrate:local` menggunakan `--local` secara eksplisit. Ia hanya menyediakan skema tempatan dalam `.wrangler/state/v3`; ia tidak mencipta akaun. HTTPS tempatan diperlukan untuk login dan cookie `Secure`. Ikuti persediaan sijil pembangunan yang dipercayai untuk pelayar anda; jangan matikan pengesahan TLS untuk staging/production. `npm run dev` ialah frontend sahaja dan tidak menjalankan Pages Functions; gunakan Pages dev untuk login sebenar. Bina semula selepas perubahan frontend.

Ujian Vitest menggunakan D1 sementara Miniflare dan akaun sintetik yang dijana semasa ujian; ia bukan akaun pentadbir sebenar. Ujian UI login/logout menggunakan API mock; ujian API menggunakan D1 SQLite sebenar secara tempatan. Tiada kata laluan atau token ujian tetap dicommit.

## Migrasi tambahan

- `0001_initial.sql`: jadual PB, pengumuman dan audit serta indeks.
- `0002_seed_original.sql`: lapan rekod PB asal dengan ID stabil dan `ON CONFLICT(id) DO NOTHING`. Tidak menimpa suntingan rekod sedia ada. Demo pengumuman tidak dijadikan pengumuman rasmi.
- `0003_admin_auth.sql`: tambahan `admin_users`, `admin_sessions`, `login_rate_limits` dan indeks. Tidak memadam, mengubah atau menggandakan lapan rekod asal. Tidak mencipta akaun atau kata laluan lalai.

**Arahan staging untuk pengendali selepas kelulusan berasingan; belum dijalankan dalam kerja ini:**

```sh
npx wrangler d1 info DB --env preview
# Sahkan nama dan ID staging di atas sebelum meneruskan.
npx wrangler d1 migrations apply DB --env preview --remote
```

Jangan gunakan database alternatif, jangan jalankan terhadap production dan jangan aktifkan API awam ketika menyediakan autentikasi. Migrasi remote memerlukan akses Cloudflare yang sah milik pengendali.

## Bootstrap pentadbir pertama — manual dan interaktif sahaja

Tiada endpoint pendaftaran, reset kata laluan terbuka, kata laluan lalai atau bypass login. Sediakan akaun hanya apabila pengendali diberi kelulusan untuk persekitaran sasaran. **CLI ini tidak dijalankan untuk mencipta akaun semasa pembangunan ini.**

```sh
# Tempatan sahaja, selepas migrasi tempatan dan kelulusan mencipta akaun:
npm run admin:bootstrap -- --local

# STAGING sahaja, selepas kelulusan akaun dan migrasi staging:
npm run admin:bootstrap -- --staging
```

CLI memerlukan terminal TTY, memaparkan nama/ID sasaran dan meminta frasa pengesahan tepat `BOOTSTRAP <nama-database>`. Ia meminta e-mel dan kata laluan dua kali, dengan input kata laluan tersembunyi. Kata laluan mestilah 16–128 aksara (maksimum 512 bait UTF-8); gunakan frasa laluan unik yang dijana pengurus kata laluan. Jangan masukkan kata laluan dalam argumen shell, environment variable, fail, log atau Git.

Untuk staging, pengendali menyediakan `CLOUDFLARE_ACCOUNT_ID` dan `CLOUDFLARE_API_TOKEN` secara selamat melalui pengurus rahsia/environment terminal. Token Cloudflare mestilah mempunyai akses D1 Edit pada akaun staging yang dimaksudkan; skrip hanya boleh menyasarkan ID staging yang dikunci di atas. Token ini **hanya untuk CLI operator**, bukan Pages runtime atau frontend. Jangan taip nilai token dalam chat atau commitnya. Skrip tidak mencetak token, kata laluan atau hash. Ia menggunakan Cloudflare D1 API dengan SQL berparameter; tempatan menggunakan binding D1 melalui Wrangler. Ia tidak mencipta database atau menjalankan migrasi.

Penyisipan akaun menggunakan satu statement atomik `INSERT ... SELECT ... WHERE NOT EXISTS`, maka hanya akaun pertama boleh dibuat walaupun dua operator mencuba serentak. Jika mana-mana akaun sudah wujud (termasuk akaun dinyahaktifkan), bootstrap ditolak. Tiada kaedah menggunakan CLI ini untuk menambah akaun seterusnya atau mengganti kata laluan sedia ada. Trigger migrasi merekodkan audit `bootstrap` secara atomik bersama penyisipan akaun, menyimpan ID dan actor `operator-cli` tanpa hash/password. Jika audit gagal, penyisipan digulung balik. Jika rangkaian terputus ketika bootstrap, semak status melalui proses pentadbiran yang diluluskan sebelum mencuba semula; jangan padam akaun secara membuta tuli. Tindakan pengurusan akaun tambahan memerlukan proses operator yang disemak secara berasingan.

Untuk menyahaktifkan akaun atau pemulihan: pengendali yang diberi kuasa perlu menjalankan operasi pentadbiran D1 yang disemak, menyahaktifkan akaun dan membatalkan sesi, dengan rekod audit tanpa rahsia. Tiada UI pemulihan kata laluan atau akaun tambahan dalam skop ini. Sandaran D1 mengandungi verifier kata laluan dan mesti dilindungi seperti data akses.

## Model keselamatan login dan sesi

- Password: PBKDF2-HMAC-SHA256, **600,000 iterasi**, salt rawak unik 128 bit dan output 256 bit. Format menyimpan algoritma/iterasi/salt/hash sahaja. Tiada plaintext, tiada password dalam audit. Sokongan WebCrypto parameter ini disahkan dalam runtime Cloudflare tempatan.
- Cookie: `__Host-epb-session`, `HttpOnly; Secure; SameSite=Strict; Path=/`, tanpa `Domain`. Token sesi rawak 256 bit. D1 menyimpan **SHA-256 token sahaja**, bukan token yang boleh digunakan semula. Token tidak dipulangkan dalam body API, localStorage atau sessionStorage.
- Sesi tamat selepas 8 jam mutlak atau 30 minit tanpa permintaan sesi/admin yang sah. Last-seen dikemas kini maksimum sekali seminit. Panel menyemak sesi berkala; server sentiasa menyemak expiry dan status aktif akaun pada setiap permintaan. Melawat tab yang terus membuat semakan sesi dianggap aktiviti.
- Login baharu mengeluarkan token baharu dan membatalkan sesi lama daripada cookie pelayar itu; token yang dibekalkan tidak boleh menetapkan ID sesi. Logout sah memadam sesi di D1 dan mengosongkan cookie. Menyahaktifkan akaun menyebabkan semua sesinya ditolak walaupun cookie masih ada.
- `/admin/login` ialah halaman awam. Halaman `/admin` dan subpath lain disahkan server; anonymous mendapat redirect ke login. `/api/admin/*` sentiasa disahkan server dan memberikan 401 jika tiada sesi. Kegagalan database/migrasi memberi 503, bukannya membuka akses. Header identiti/JWT Cloudflare lama tidak lagi memberi akses.
- CSRF: setiap operasi tulis admin dan logout memerlukan Origin tepat sama, JSON dan header `X-CSRF-Token` yang terikat pada sesi. Nilai CSRF diterbitkan melalui SHA-256 dengan domain pemisah daripada token sesi berentropi tinggi; ia bukan token sesi dan disimpan frontend dalam memori sahaja. Login juga memerlukan Origin same-origin/JSON dan menolak cross-site. HTTPS diperlukan. Tiada CORS permisif.
- Brute force: D1 menempah percubaan secara atomik **sebelum hashing**. Had window tetap 15 minit: 5 percubaan/akaun, 20/IP, 100 global. Had termasuk login berjaya supaya ia tidak boleh dielak dengan perlumbaan atau reset kaunter. Respons 429 mempunyai `Retry-After: 900`. Had global diperiksa dahulu untuk mengehadkan pertumbuhan bucket dan kerja hashing. IP hanya daripada `CF-Connecting-IP` yang ditetapkan Pages edge, bukan `X-Forwarded-For`. Di tempatan tanpa header edge, bucket `unknown` dikongsi.
- Akaun tidak wujud, tidak aktif dan password salah menggunakan respons generik; akaun tidak wujud menggunakan dummy PBKDF2 verifier untuk mengurangkan perbezaan masa. Cubaan gagal diaudit secara anonim tanpa e-mel mentah, password atau token. Bucket disimpan sebagai hash; window lama dibersihkan.
- Had ini melindungi brute force aplikasi, tetapi had akaun/global juga boleh menyebabkan penolakan sementara semasa serangan. Pantau 429 dan kuota D1; jangan melonggarkan perlindungan secara automatik. Sahkan CPU login dengan pelan Cloudflare percuma sebenar sebelum penggunaan; ujian tempatan bukan bukti kuota hos. Jangan turunkan work factor untuk menyembunyikan kegagalan kuota.
- Semua operasi CRUD menggunakan SQL berparameter, validasi server, semakan versi untuk konflik dan audit atomik bersama mutasi. Teks dipaparkan sebagai teks React. Payload umum dihadkan 32 KiB dan login 2 KiB.

## Endpoint

| Endpoint | Fungsi |
| --- | --- |
| `POST /api/auth/login` | JSON `{email,password}`; sesi baharu jika sah |
| `GET /api/auth/session` | Identiti, token CSRF dan waktu tamat; memerlukan cookie sah |
| `POST /api/auth/logout` | Cookie + Origin + CSRF; memadam sesi |
| `GET /api/admin/status` | Status D1, actor dan flag awam |
| `/api/admin/schedules` | GET semua status; POST tambah |
| `/api/admin/schedules/:id` | PUT edit/status; pembatalan melalui `cancelled`, bukan DELETE |
| `/api/admin/announcements` | GET dan POST |
| `/api/admin/announcements/:id` | PUT dan DELETE |
| `GET /api/admin/audit?page=0` | Sejarah, 100 rekod/halaman |
| `GET /api/schedules` | Hanya diterbitkan, jika flag awam aktif |
| `GET /api/announcements` | Hanya diterbitkan, jika flag awam aktif |

PUT memerlukan keseluruhan rekod boleh diedit dan `version` terkini; DELETE pengumuman memerlukan `version`. Konflik memberi 409. Jadual menerima `title`, `start_date`, `end_date`, `departure_time`, `return_time`, `category` dan `status`. Tarikh masuk mesti selepas tarikh keluar; kategori hanya PB Wajib/PB Pilihan; masa wajib `HH:mm` MYT. Status jadual: draft/published/cancelled. Pengumuman: title/body, draft/published. Carian dan penapis jadual: `q`, `year`, `month`, `category`, `status`. Endpoint awam mengabaikan permintaan status draf dan tidak pernah mengembalikan draf.

Semua respons auth/API menggunakan `Cache-Control: no-store`; halaman admin turut `no-store` dan `noindex`. Fail `_routes.json` mesti dikekalkan supaya Pages Functions menjaga `/admin`, `/admin/*` dan `/api/*`.

## Portal awam dan pengaktifan manual

Flag awam kekal false; tiada data staging menggantikan data portal. Jika API dimatikan/gagal/tidak sah, rujukan asal Fasa 1 kekal dilabel sebagai sumber asal. Pengumuman demo kekal DEMO, bukan rasmi. Apabila pengaktifan diluluskan kelak, hanya setelah kedua-dua respons awam disahkan, data diterbitkan digunakan bersama oleh dashboard, kalendar, countdown, jadual dan cetakan. Respons kosong yang sah kekal kosong. Fallback asal ialah jadual sejarah 2026, bukan salinan terkini database.

Konfigurasi manual yang masih diperlukan, **bukan dilakukan sekarang**:

1. Semak dan luluskan kod/commit ini.
2. Sediakan pengesahan HTTPS dan binding D1 Preview staging yang sedia ada; tiada database baharu diperlukan.
3. Jalankan migrasi staging hanya selepas kelulusan remote yang baharu.
4. Bootstrap akaun pertama hanya selepas kelulusan penciptaan akaun sebenar.
5. Uji login/logout, cookie, timeout, 429, CSRF, CRUD dan audit pada staging sebenar, termasuk prestasi/kuota pelan percuma. Tiada maklumat pembayaran diperlukan oleh kod ini; kelayakan dan kuota akaun Cloudflare ditentukan perkhidmatan tersebut.
6. Jika polisi Access lama pernah diaktifkan, semak dan buang perlindungan Access itu secara manual selepas pengesahan sistem baharu, supaya `/admin/login` boleh dicapai. Kod ini tidak lagi membaca `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS`; variable lama boleh dibuang dari konfigurasi runtime melalui semakan manual. `.dev.vars.example` baharu hanya mengandungi flag awam false.
7. Kekalkan `PUBLIC_DATA_ENABLED=false` sehingga keselamatan dan API disahkan serta pengaktifan diluluskan. Tiada deployment production atau sambungan database production termasuk dalam kerja ini.

## Dependency dan keputusan pengesahan

`npm audit` sebelum perubahan: 6 isu (2 critical, 3 high, 1 moderate), melibatkan `vitest`, `@vitest/mocker`, `tinypool`, `miniflare`, `sharp`, `undici`; semuanya rantaian alat pembangunan/ujian.

Pembetulan dipilih secara khusus, bukan `npm audit fix --force`:

- Vitest 3.2.7 → **5.1.0**, dengan mocker 5.1.0; dependency tinypool lama dibuang.
- Miniflare 4 → **5.20261104.0-beta**, versi yang sama dengan dependency Wrangler 4.158.0 yang sudah digunakan. Ini ialah beta; versi eksplisit dikunci dalam package-lock dan adapter `convertV4MiniflareOptions` digunakan. API D1 diuji semula.
- Resolusi transitif menggunakan sharp **0.35.5** dan undici **7.30.1**, yang melepasi julat advisory.
- `jose` dibuang kerana JWT Access tidak lagi digunakan.

Selepas perubahan, audit npm melaporkan **0 vulnerabilities** pada masa semakan. Ini keputusan registry semasa, bukan jaminan tiada advisory baharu pada masa depan.

Pengesahan: TypeScript dan build lulus; 35 ujian Vitest lulus (regresi Fasa 1, data awam, CRUD D1, password, sesi, CSRF, cookie, expiry/idle, anonymous/spoofed identity, account disabled, rate limit IP/account/global dan serentak, bootstrap pertama); 7 ujian Playwright lulus termasuk login/logout dan paparan 375px. Bootstrap sebenar dan autentikasi hos staging tidak dijalankan. Migrasi tambahan diuji tempatan sahaja. PDF regresi kekal A4 landskap.

## Fail baharu / diubah

Baharu: `src/Login.tsx`, `server/password.ts`, `server/http.ts`, `server/bootstrap.ts`, `scripts/bootstrap-admin.mjs`, `migrations/0003_admin_auth.sql`.

Diubah: `server/auth.ts`, `server/auth.test.ts`, `server/api.ts`, `server/api.test.ts`, `functions/admin/[[path]].ts`, `src/Admin.tsx`, `src/main.tsx`, `src/style.css`, `tests/app.spec.ts`, `.dev.vars.example`, `package.json`, `package-lock.json`, `README.md`, `docs/PHASE2.md`.

Tidak diubah: konfigurasi staging `wrangler.jsonc`, migrasi/schema/seed Fasa 2 terdahulu, HTML asal dan lapan data PB asal.
