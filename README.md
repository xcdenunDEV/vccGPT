# VCC GPT

Website dummy generator VCC berbasis Netlify Functions + Netlify Blobs.

## Fitur

- Generator VCC dummy dari pool yang diinput admin.
- Halaman dipisah:
  - `index.html` untuk generate VCC
  - `admin.html` untuk dashboard admin
- Setelah generate, VCC otomatis ditandai `used ✅`.
- Credit harian kumulatif:
  - Guest: +1/hari
  - Free: +5/hari
  - Premium: +20/hari
  - Admin: unlimited
- Login tanpa register.
- Dashboard admin:
  - tambah list VCC batch (paste multi-line/koma/semicolon atau upload .txt/.csv)
  - tambah user
  - topup credit user
- Riwayat VCC used (masked) dengan status `Live Hit Success ✅`.
- Tombol topup via WhatsApp admin `085156434202`.
- Panel copy cepat untuk `card number`, `expiry`, `month`, `year`, dan `cvv`.
- Paginasi pada tabel VCC dan tabel user di dashboard admin.

## Default Admin

- Username: `admin`
- Password: `admin12345`

Bisa diubah dengan env Netlify:

- `VCC_ADMIN_USERNAME`
- `VCC_ADMIN_PASSWORD`
- `VCC_TOKEN_SECRET`

## Jalankan Lokal

```bash
npm install
npm run dev
```

## Deploy Netlify

1. Push repo ke Git.
2. Import project di Netlify.
3. Build command: kosongkan (static + functions).
4. Publish directory: `.`
5. Set env vars bila perlu.
