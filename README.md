# Ledgerine — Generator Faktur & Kwitansi

Aplikasi web multi-page untuk membuat faktur (invoice) dan kwitansi, dengan login role-based dan penyimpanan Google Sheets. Hosting: GitHub Pages.

## Arsitektur
- Frontend statis (HTML/CSS/JS) → GitHub Pages
- Backend → Google Apps Script (Web App, GET-only, tanpa CORS preflight)
- Database → Google Sheets

## Cara Setup

### 1. Google Sheets + Apps Script
1. Buat Google Spreadsheet baru.
2. **Extensions → Apps Script**. Hapus isi default, tempel seluruh isi `APPS_SCRIPT.gs`.
3. Simpan, lalu pilih fungsi `setup` di dropdown dan klik **Run** sekali (izinkan permission). Ini membuat sheet Users, Customers, Products, Invoices, Receipts + 2 user default.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin **Web app URL** (berakhiran `/exec`).

### 2. Hubungkan Frontend
Buka `js/config.js`, ganti `PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE` dengan URL `/exec` tadi.

> ⚠️ **PENTING:** Edit `config.js` **langsung di GitHub**. Jangan timpa file ini dari paket ZIP mana pun — API_URL Anda akan hilang.

### 3. Deploy ke GitHub Pages
1. Push semua file ke repo GitHub.
2. **Settings → Pages → Source: main / root**. Tunggu Pages aktif.
3. Buka URL Pages → `login.html`.

## Akun Default
| Username | Password | Role |
|----------|----------|------|
| admin    | admin123 | admin |
| staff    | staff123 | staff |

Ganti password / tambah user lewat menu **Pengguna** (khusus admin).

## Struktur
```
index.html            → redirect ke login
login.html            → halaman masuk
dashboard.html        → ringkasan & aksi cepat
invoices.html         → editor faktur (+ pratinjau A4 + PDF)
invoice-list.html     → daftar faktur tersimpan
receipts.html         → editor kwitansi (+ pratinjau A4 + PDF)
receipt-list.html     → daftar kwitansi tersimpan
customers.html        → CRUD pelanggan
products.html         → CRUD barang/jasa
users.html            → CRUD pengguna (admin)
css/  app.css doc.css
js/   config.js core.js crud.js doclist.js invoice.js receipt.js
APPS_SCRIPT.gs        → backend (tempel ke Apps Script)
```

## Catatan
- Ekspor PDF memakai jsPDF + html2canvas (bukan `window.print()`); nama file = nomor dokumen.
- Info penjual disimpan di perangkat (localStorage) agar tidak perlu diketik ulang.
- Nomor faktur/kwitansi otomatis berurutan (`INV/2026/00X`, `KW/2026/00X`), tetap bisa diubah.
