# Tigabelas — Kalender Kegiatan

Web kalender sederhana untuk menampilkan kegiatan/event dalam tampilan satu bulan penuh.
Dibuat dengan **Tailwind CSS**, font **Plus Jakarta Sans**, mendukung **dark mode**, dengan
accent **hitam–putih** saja.

## Cara menjalankan

Tidak perlu instalasi atau build. Cukup buka berkas `index.html` di browser:

- Klik dua kali `index.html`, atau
- (Opsional) jalankan server statis agar lebih nyaman:
  ```powershell
  # Python
  python -m http.server 5500
  # lalu buka http://localhost:5500
  ```

> Tailwind, font, peta (Leaflet/OpenStreetMap), pencarian lokasi (Nominatim), dan unduh struk
> (html2canvas) dimuat via CDN/online, jadi butuh koneksi internet saat dibuka.

## Login

Untuk **menambah / mengedit / menghapus** kegiatan, wajib login terlebih dahulu.

| User | Password |
|------|----------|
| L    | `1305`   |
| F    | `1304`   |

Tanpa login, kalender tetap bisa dilihat (mode baca-saja).

## Fitur

- Tampilan kalender satu bulan penuh + navigasi bulan (sebelumnya / berikutnya / hari ini).
- **Countdown** live (HH:MM:SS) ke event terdekat di header kalender.
- Indikator angka per tanggal = **jumlah item timeline** semua kegiatan di tanggal itu
  (kegiatan tanpa timeline dihitung 1).
- Panel **Kegiatan Mendatang** (tinggi mengikuti kalender, dengan paginasi bila item banyak).
- Tambah / edit / hapus kegiatan: judul, tanggal, **tag**, **lokasi (pilih dari peta)**,
  **timeline**, dan catatan. Timeline boleh kosong, tapi jika diisi **minimal 2 item**.
- Klik kegiatan untuk membuka **Detail** (jam, durasi, lokasi, timeline, catatan).
- **Kelola tag**: tambah/ubah/hapus tag, dan tandai tag mana yang dihitung sebagai "Kuliner".
- **Struk statistik**: tombol share di kartu statistik membuka pratinjau bergaya struk
  (kertas sobek) yang bisa **di-download** sebagai gambar PNG.
- Penanda pemilik kegiatan (L / F).
- Dark / light mode (mengikuti preferensi sistem, bisa diubah manual).
- Data tersimpan otomatis di browser (`localStorage`).

## Statistik (per tahun, otomatis)

Statistik dihitung otomatis dari data kegiatan — **tidak diinput manual**:

| Statistik | Sumber perhitungan |
|-----------|--------------------|
| Total Hari | Jumlah tanggal unik yang punya kegiatan |
| Total Jam | Rentang waktu timeline tiap kegiatan (item pertama → terakhir), dijumlahkan |
| Total Tempat | Jumlah lokasi **unik** yang dikunjungi |
| Total Kuliner | Jumlah kegiatan yang punya tag bertanda "Kuliner" |
| Total Jarak (km) | Jarak garis lurus dari **rumah** ke lokasi tiap kegiatan, dijumlahkan |

Kartu statistik menampilkan 2 teratas dengan efek gradient; klik **"Lihat semua"** untuk
membuka selengkapnya.

### Titik rumah & jarak

- Titik rumah saat ini: **Sidoarjo**. Diatur lewat konstanta `HOME` di awal `app.js`.
- Jarak dihitung secara **garis lurus (haversine)**, bukan jarak tempuh jalan. Bisa diganti
  ke API rute nanti bila diperlukan.

> Catatan: stat **Foto** sengaja ditunda — direncanakan jadi fitur **album foto** terpisah.

## Struktur berkas

```
tigabelas/
├── index.html   # struktur halaman + modal (login, hari, form, tag, peta)
├── app.js       # logika kalender, auth, CRUD, statistik, tag, peta
├── style.css    # gaya tambahan (scrollbar, animasi)
└── README.md
```

## Catatan

- Data bersifat lokal per-browser; tidak ada server/sinkronisasi antar perangkat.
- Password disimpan di sisi klien (cocok untuk penggunaan pribadi, bukan keamanan tingkat produksi).
- Peta memakai Leaflet + OpenStreetMap, pencarian/penamaan lokasi memakai Nominatim (gratis,
  ada rate-limit ~1 permintaan/detik).
