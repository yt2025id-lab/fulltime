# Informasi Lengkap — TxODDS x Solana World Cup Hackathon 2026

> Dokumen ini dikompilasi dari berbagai sumber publik per 4 Juli 2026. Beberapa detail teknis (terutama endpoint API spesifik) mungkin berubah — selalu cek sumber resmi sebelum mengambil keputusan penting.

---

## 1. Ringkasan Umum

| Item | Detail |
|---|---|
| Nama event | TxODDS World Cup Hackathon |
| Diselenggarakan oleh | TxODDS (penyedia data), didukung oleh Solana Foundation, dihosting di platform Superteam Earn |
| Total hadiah | **$50,000 USD** (dibagi 3 track) |
| Blockchain | Solana |
| Sumber data | TxLINE API (produk TxODDS) — data pertandingan World Cup 2026 real-time |
| Platform pendaftaran & submission | Superteam Earn (superteam.fun/earn) |
| Peserta yang diizinkan | Individual developer, tim, **dan juga autonomous AI agent** |
| Deadline submission | **19 Juli 2026** |
| Pengumuman pemenang | **29 Juli 2026** (sesuai jadwal masing-masing sponsor per track) |
| Event tambahan | Watch party final World Cup di London |

**Konsep inti:** TxODDS membebaskan biaya akses data (data fee dan syarat pembayaran token) untuk seluruh 104 pertandingan World Cup 2026, memberi peserta akses langsung ke feed pertandingan berkualitas tinggi secara real-time, sebagai ajang pembuktian penerapan data live on-chain.

> Sumber: [AGB — TxODDS and Solana introduce World Cup Hackathon](https://agbrief.com/news/world/25/06/2026/txodds-and-solana-introduce-world-cup-hackathon-to-reshape-sports-data-ecosystems/)

---

## 2. Tiga Track Kompetisi

### Track 1 — Prediction Markets & Settlement
- **Hadiah: $18,000** (1st: $12,000 / 2nd: $4,000 / 3rd: $2,000)
- Fokus: membangun prediction market dan mekanisme settlement (penyelesaian hasil taruhan/prediksi) menggunakan data TxLINE
- Skill dibutuhkan: Frontend, Backend, Blockchain, Mobile, Design, Other
- Winner announcement: 29 Juli 2026
- Listing: https://superteam.fun/earn/listing/prediction-markets-and-settlement/

### Track 2 — Trading Tools & Agents
- **Hadiah: $16,000**
- Fokus: alat trading atau agent otomatis (termasuk AI agent) yang memanfaatkan data odds/match real-time
- Skill dibutuhkan: Frontend, Backend, Blockchain, Mobile, Design, Other
- Winner announcement: 29 Juli 2026
- Listing: https://superteam.fun/earn/listing/trading-tools-and-agents/

### Track 3 — Consumer & Fan Experiences (juga disebut "Fan Experiences and Consumer Apps")
- **Hadiah: $16,000**
- Fokus: aplikasi konsumen/fan-facing — pengalaman menonton, gamifikasi, komunitas, dsb
- Listing spesifik tidak berhasil ditemukan URL langsungnya saat riset ini — akses via tombol **"View All Tracks"** di halaman utama hackathon: https://superteam.fun/earn/hackathon/world-cup/

> Sumber pembagian hadiah per track: [Superteam di X/Twitter](https://x.com/superteam) (versi bahasa Spanyol dari post resmi mereka menyebutkan rincian: *"Prediction Markets y Settlement ($18k USD) — Experiencias de Fans y Consumer Apps ($16k USD) — Herramientas de Trading y Agentes ($16k USD)"*)

**Catatan penting:** Semua track mensyaratkan peserta **submit build fungsional atau aplikasi live testnet** yang menggunakan data TxLINE sebagai input utama, supaya eligible untuk memenangkan hadiah.

> Sumber: [AGB article](https://agbrief.com/news/world/25/06/2026/txodds-and-solana-introduce-world-cup-hackathon-to-reshape-sports-data-ecosystems/)

---

## 3. Kutipan Resmi dari Pihak Penyelenggara

> *"Partnering with Solana and Superteam puts our data directly into the hands of builders who are pushing the sports betting industry toward real transparency. This World Cup hackathon is where we prove what's possible when you break down traditional gatekeepers and give access to talented, motivated builders."*
> — **Einar Knobel, CEO TxODDS**

> Sumber: [AGB — TxODDS and Solana introduce World Cup Hackathon](https://agbrief.com/news/world/25/06/2026/txodds-and-solana-introduce-world-cup-hackathon-to-reshape-sports-data-ecosystems/)

---

## 4. Tentang TxLINE (Sumber Data yang Wajib Digunakan)

TxLINE adalah produk TxODDS yang menyediakan **data sports terverifikasi secara kriptografis** melalui sistem hybrid: on-chain di Solana + off-chain di infrastruktur TxODDS.

### Fitur kunci TxLINE
- **Timestamping on-chain**: setiap feed odds/data pertandingan di-cryptographically timestamp di Solana — auditable dan immutable
- **Reliabilitas saat lonjakan trafik**: didesain untuk tetap stabil saat volume tinggi (final World Cup, Super Bowl, dsb)
- **Latency rendah by design**: data odds sampai ke sistem sebelum konfirmasi resmi broadcast
- **Akses standar via API key**: tidak perlu middleware custom — kalau tim bisa baca dokumentasi, bisa langsung live di hari yang sama
- **Model akses berbasis token (TxL)**: fleksibel upgrade/downgrade/exit tanpa kontrak jangka panjang (namun untuk hackathon ini, biaya token **dihapuskan/gratis** khusus data World Cup & International Friendlies)
- **Data untuk backtesting**: setiap fixture terverifikasi sebelum masuk arsip, cocok untuk validasi model/strategi

> Sumber: [TxODDS — Tx LINE Product Page](https://txodds.net/our-products/tx-line/)

### Peluncuran TxLINE
TxLINE resmi dirilis jelang FIFA World Cup 2026, dengan cakupan gratis untuk seluruh **International Friendlies pra-turnamen** dan **104 pertandingan FIFA World Cup 2026**.

> *"TxLINE introduces a structural evolution to data distribution. By deploying an on-chain delivery layer, we give market participants direct access and complete cost transparency. In a mature market, transparent pricing should be a baseline expectation. TxLINE establishes that standard."*
> — **Einar Knobel, CEO TxODDS**

> *"We built TxLINE specifically to eliminate the weeks of legal and technical back-and-forth that used to define enterprise data onboarding. Now an operator can activate elite-tier odds streams in minutes."*
> — **Aidan Rolfe, Blockchain Systems Engineer, TxODDS**

> Sumber: [AGB — TxODDS releases TxLINE ahead of the FIFA World Cup 2026](https://agbrief.com/news/world/17/06/2026/txodds-releases-txline-ahead-of-the-fifa-world-cup-2026/)

---

## 5. Cara Akses API TxLINE (Alur Teknis Terkonfirmasi)

Dokumentasi resmi: **https://txline-docs.txodds.com/documentation/quickstart**

### Ringkasan alur autentikasi

1. **Dapatkan guest JWT**
   ```
   POST https://txline.txodds.com/auth/guest/start
   ```

2. **Pembelian token TxL bersifat opsional** — tersedia free tier khusus untuk data World Cup dan International Friendlies tanpa perlu pembayaran apapun. Untuk melihat semua tier (gratis maupun berbayar), cek halaman "Subscription Tiers" di dokumentasi resmi.

3. **Kalau memilih beli token TxL** (tidak wajib untuk hackathon ini): wallet harus memiliki USDT di Solana — bisa swap via Jupiter atau exchange lain. Proses pembelian 2 langkah: minta quote dari backend, lalu verifikasi dan sign transaksi secara lokal.
   ```
   POST https://txline.txodds.com/api/guest/purchase/quote
   Headers: Authorization: Bearer {jwt}
   Body: { buyerPubkey, txlineAmount }
   ```

4. **Aktivasi akses API** (setelah subscription on-chain, baik gratis maupun berbayar):
   ```
   POST https://txline.txodds.com/api/token/activate
   Headers: Authorization: Bearer {jwt}
   Body: { txSig, walletSignature, leagues: [] }
   ```
   Response berisi `apiToken` yang dipakai bersama `jwt` untuk autentikasi seluruh request data selanjutnya.

5. Setelah punya `jwt` dan `apiToken`, peserta bisa mengakses **API Reference lengkap** di dokumentasi resmi untuk melihat seluruh endpoint yang tersedia (fixtures, odds, scores, dsb).

> ⚠️ **Catatan penting:** Dokumen ini TIDAK mencantumkan endpoint spesifik untuk mengambil data fixtures/skor pertandingan karena tidak berhasil dikonfirmasi detailnya saat riset. **Cek langsung dokumentasi resmi "API Reference"** di txline-docs.txodds.com sebelum membangun integrasi.

> Sumber: [TxLINE Documentation — Quickstart](https://txline-docs.txodds.com/documentation/quickstart)

### Kanal support teknis
- Telegram: **t.me/TxLINEChat** (disebutkan sebagai kontak untuk pertanyaan terkait listing hackathon)
- Halaman dokumentasi index lengkap: `/llms.txt` di domain txline-docs.txodds.com (khusus untuk discovery semua halaman dokumentasi yang tersedia)

---

## 6. Tentang Platform Superteam Earn (Tempat Hackathon Ini Dihosting)

### Latar belakang
Superteam Earn adalah platform yang menghubungkan talent Web3 (developer, designer, content creator) dengan bounty, grant, dan pekerjaan dari proyek-proyek crypto, awalnya berfokus di ekosistem Solana. Diluncurkan **8 September 2022** sebagai bagian dari SuperteamDAO, tersedia sebagai proyek open-source di GitHub.

> Sumber: [Superteam Earn — Grokipedia](https://grokipedia.com/page/Superteam_Earn)

### Model kerja platform
- Ada 4 kategori: **Content, Design, Development, Other** — termasuk grants dan contests
- Sistem **escrow**: dana diamankan sebelum kerja dimulai, otomatis cair setelah selesai — membangun trust antara sponsor dan peserta
- Dibayar dalam stablecoin: USDC, USDG, atau USDT
- Reach ke **190,000+ talent** dalam kurang dari 5 klik (klaim dari halaman utama platform)

> Sumber: [Solana Compass — Superteam Project Review](https://solanacompass.com/projects/superteam) dan [Superteam Earn homepage](https://superteam.fun/earn)

### Riwayat pembayaran platform (konteks kredibilitas)
Superteam secara keseluruhan telah mendistribusikan **lebih dari $1.7 juta** community GDP di ekosistem Solana sejak berdiri.

> Sumber: [Solana Compass — Superteam Project Review](https://solanacompass.com/projects/superteam)

---

## 7. Data Submission Saat Ini (per 4 Juli 2026, saat riset dilakukan)

| Track | Jumlah submission tercatat |
|---|---|
| Prediction Markets and Settlement | 13 |
| Trading Tools and Agents | 12 |

Angka ini masih rendah relatif terhadap 15 hari sisa waktu — kompetisi belum terlalu padat pada tahap ini.

> Sumber: [Listing Prediction Markets and Settlement](https://superteam.fun/earn/listing/prediction-markets-and-settlement/) dan [Listing Trading Tools and Agents](https://superteam.fun/earn/listing/trading-tools-and-agents/)

---

## 8. Konteks Tambahan dari Media Sosial Resmi

Dari akun X/Twitter resmi Superteam (@superteam):

- Beberapa Superteam regional chapter (Nigeria, Belanda/NL) turut mempromosikan dan berpartisipasi dalam hackathon ini sebagai bagian dari inisiatif komunitas Solana global
- Diposisikan sebagai "The World Cup is coming onchain" — mengangkat narasi bahwa turnamen sepak bola terbesar dunia kini punya jejak on-chain resmi lewat kemitraan ini
- Ada elemen komunitas berupa watch party fisik di London untuk merayakan final turnamen

> Sumber: [Superteam di X (Twitter)](https://x.com/superteam)

---

## 9. Ringkasan Timeline Penting

| Tanggal | Event |
|---|---|
| ~24 Juni 2026 | Hackathon resmi diumumkan/dibuka (post pertama TxODDS di X) |
| 4 Juli 2026 | (Hari ini — saat dokumen ini dibuat) |
| **19 Juli 2026** | **Deadline submission** |
| **29 Juli 2026** | Pengumuman pemenang per track |
| Sepanjang turnamen | Watch party final di London (tanggal spesifik belum dikonfirmasi dalam riset ini) |

---

## 10. Daftar Sumber Lengkap

1. AGB (Asia Gaming Brief) — *TxODDS and Solana introduce World Cup Hackathon to reshape sports data ecosystems*
   https://agbrief.com/news/world/25/06/2026/txodds-and-solana-introduce-world-cup-hackathon-to-reshape-sports-data-ecosystems/

2. AGB — *TxODDS releases TxLINE ahead of the FIFA World Cup 2026*
   https://agbrief.com/news/world/17/06/2026/txodds-releases-txline-ahead-of-the-fifa-world-cup-2026/

3. Superteam Earn — Halaman utama hackathon
   https://superteam.fun/earn/hackathon/world-cup/

4. Superteam Earn — Listing Prediction Markets and Settlement
   https://superteam.fun/earn/listing/prediction-markets-and-settlement/

5. Superteam Earn — Listing Trading Tools and Agents
   https://superteam.fun/earn/listing/trading-tools-and-agents/

6. TxODDS — Halaman produk Tx LINE
   https://txodds.net/our-products/tx-line/

7. TxLINE Documentation — Quickstart Guide
   https://txline-docs.txodds.com/documentation/quickstart

8. Superteam (@superteam) — Akun X/Twitter resmi
   https://x.com/superteam

9. TxODDS (@TXODDSOfficial) — Akun X/Twitter resmi
   https://x.com/TXODDSOfficial

10. Grokipedia — *Superteam Earn* (latar belakang platform)
    https://grokipedia.com/page/Superteam_Earn

11. Solana Compass — *Superteam on Solana: Project Review*
    https://solanacompass.com/projects/superteam

12. GitHub — SuperteamDAO/earn (kode open-source platform)
    https://github.com/SuperteamDAO/earn

---

## 11. Yang Masih Perlu Dikonfirmasi Sendiri

Riset ini **tidak berhasil menemukan secara pasti**:
- URL listing langsung untuk Track 3 (Consumer & Fan Experiences)
- Endpoint API spesifik untuk fixtures/scores/live match status di TxLINE
- Batasan ukuran tim (maksimal berapa orang per tim)
- Apakah wajib deploy ke mainnet atau devnet cukup untuk submission
- Format/template submission yang detail (selain requirement umum "functional build atau live testnet application")

**Rekomendasi:** cek langsung ke halaman listing resmi (login ke akun Superteam Earn kamu) dan/atau tanya di **t.me/TxLINEChat** untuk detail-detail ini sebelum mulai development serius.
