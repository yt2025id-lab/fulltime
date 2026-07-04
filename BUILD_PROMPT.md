# Prompt untuk OpenCode + DeepSeek V4 Pro

> Cara pakai: copy-paste seluruh isi di bawah ini (dari "===MULAI PROMPT===" sampai "===AKHIR PROMPT===") ke OpenCode. Pastikan file `PRD.md` sudah ada di root folder project sebelum menjalankan prompt ini, karena prompt ini mereferensikan PRD tersebut.

===MULAI PROMPT===

Kamu adalah senior Solana + Anchor smart contract engineer sekaligus full-stack React/TypeScript developer. Kamu akan membangun sebuah project bernama **GoalCast Markets** — sebuah prediction market on-chain untuk pertandingan World Cup 2026 di Solana, dengan settlement otomatis berbasis data dari TxLINE API (TxODDS).

Baca dulu file `PRD.md` di root folder ini secara menyeluruh sebelum menulis kode apapun. PRD itu adalah spesifikasi produk lengkap yang WAJIB kamu ikuti. Jangan mulai coding sebelum kamu benar-benar paham isi PRD tersebut, terutama bagian 6 (Smart Contract Spec) dan bagian 7 (Integrasi TxLINE API).

## Konteks penting yang harus kamu pegang selama development

1. Ini project hackathon dengan **deadline ketat (15 hari)**. Prioritaskan MVP yang BEKERJA end-to-end daripada fitur lengkap tapi setengah jadi. Kalau harus memilih antara "fitur lebih banyak tapi rapuh" vs "fitur lebih sedikit tapi solid dan bisa didemokan", **selalu pilih yang solid**.

2. Diferensiator utama project ini adalah **settlement otomatis** yang dipicu oleh data pertandingan asli dari TxLINE, BUKAN tombol "resolve" manual yang diklik admin. Ini adalah fitur paling penting yang harus benar-benar berfungsi dan bisa didemokan — jangan sampai fitur ini di-mock atau di-fake untuk demo.

3. Developer (Achmad) sebelumnya sudah membangun project serupa bernama "Stellar Prophecy" di Soroban/Stellar. Kalau developer memberikan akses ke kode lama itu, gunakan sebagai referensi pola arsitektur (terutama alur create_market → place_bet → resolve → claim), TAPI jangan asal copy-paste karena Soroban dan Anchor punya API yang sangat berbeda. Sesuaikan sepenuhnya dengan idiom Anchor/Rust dan Solana account model (PDA, rent-exempt account, dsb).

4. **JANGAN menebak-nebak endpoint API TxLINE untuk data fixtures/scores.** PRD sudah eksplisit menyebutkan endpoint ini belum terkonfirmasi. Sebelum menulis kode integrasi API tersebut, tanyakan kepada saya (developer) untuk memberikan dokumentasi API Reference terbaru dari https://txline-docs.txodds.com/, atau screenshot/copy-paste isi dokumentasinya. Kalau saya belum memberikannya, buat dulu bagian ini sebagai placeholder/mock dengan komentar jelas `// TODO: ganti dengan endpoint asli setelah konfirmasi dari TxLINE docs`, supaya development bagian lain tidak terhambat.

## Urutan kerja yang harus kamu ikuti (JANGAN loncat-loncat)

### Fase 1 — Setup & Scaffolding
1. Buat struktur folder project:
   ```
   goalcast-markets/
   ├── programs/
   │   └── goalcast/
   │       └── src/
   │           └── lib.rs
   ├── tests/
   │   └── goalcast.ts
   ├── relay-service/
   │   ├── src/
   │   │   ├── txline-client.ts
   │   │   ├── settlement-worker.ts
   │   │   └── index.ts
   │   └── package.json
   ├── frontend/
   │   └── (struktur React + Vite standar)
   ├── Anchor.toml
   ├── PRD.md
   └── README.md
   ```
2. Setup `Anchor.toml` untuk target **devnet** dulu.
3. Inisialisasi git repo dan buat `.gitignore` yang benar untuk Rust + Node + React (jangan sampai commit `target/`, `node_modules/`, `.env`).

### Fase 2 — Smart Contract (ikuti section 6 PRD secara detail)
1. Implementasikan struct `Market` dan `Bet` PERSIS seperti didefinisikan di PRD section 6.1. Jangan tambah/kurangi field tanpa alasan kuat — kalau kamu merasa perlu menambah field, jelaskan alasannya ke saya dulu sebelum implementasi.
2. Implementasikan instruction satu per satu dengan urutan: `create_market` → `place_bet` → `close_betting` → `settle_market` → `claim_payout` → `cancel_market`.
3. Untuk `settle_market`: WAJIB implementasikan authorization check yang memastikan hanya relay authority key tertentu yang bisa memanggil instruksi ini. Gunakan pattern `require_keys_eq!(ctx.accounts.authority.key(), expected_relay_authority)`. Ini kritis untuk keamanan — jangan skip.
4. Tambahkan field `settlement_proof_hash: [u8; 32]` di struct `Market` untuk menyimpan hash dari data TxLINE sebagai bukti audit trail on-chain.
5. Tulis unit test Anchor (TypeScript, pakai `anchor-mocha` atau `@solana/web3.js` test framework standar) untuk SETIAP instruction, termasuk test case KEGAGALAN (contoh: unauthorized user mencoba memanggil `settle_market`, betting setelah `betting_close_time`, klaim dobel oleh user yang sama). Jangan lanjut ke instruksi berikutnya sebelum test instruksi sebelumnya lolos semua.
6. Setelah semua instruksi selesai dan test lolos, jalankan `anchor build` dan pastikan tidak ada warning yang mengindikasikan bug (misalnya unused variable yang seharusnya dipakai untuk validasi).

### Fase 3 — Relay Service (Node.js)
1. Buat `txline-client.ts` yang mengimplementasikan alur autentikasi dari PRD section 7.1 (guest JWT → subscribe on-chain ke free tier → activate token).
2. Buat `settlement-worker.ts` yang:
   - Polling TxLINE API tiap interval yang bisa dikonfigurasi via environment variable (default 2 menit)
   - Mendeteksi kapan fixture berstatus selesai
   - Menghitung hash dari response data (untuk `settlement_proof_hash`)
   - Memanggil instruksi `settle_market` di program Solana menggunakan `@coral-xyz/anchor` client
   - Logging jelas ke console untuk setiap langkah (ini penting untuk demo dan debugging)
3. Simpan semua secret (relay authority private key, API credentials) di file `.env`, JANGAN hardcode di kode. Buat `.env.example` sebagai template.

### Fase 4 — Frontend
1. Setup React + Vite + TypeScript + Tailwind CSS v4 (ikuti versi yang sama dengan project Stellar Prophecy sebelumnya kalau developer memberikan referensi).
2. Install dan konfigurasi `@solana/wallet-adapter-react` dengan Phantom sebagai wallet utama.
3. Buat halaman-halaman sesuai PRD section 8.1: Landing, Markets list, Market detail, Audit trail, Portfolio, Admin (protected).
4. Untuk halaman Audit Trail: tampilkan link eksplisit ke Solana Explorer (devnet) untuk transaksi settlement, supaya juri hackathon bisa verifikasi sendiri bahwa data benar-benar on-chain.
5. Styling: gunakan estetika neo-brutalism (warna kontras tinggi, border tebal, shadow solid, tipografi bold) — konsisten dengan preferensi desain developer di project-project sebelumnya.

### Fase 5 — Integrasi End-to-End & Testing
1. Jalankan seluruh alur dari awal: create market untuk 1 fixture nyata (pakai data International Friendlies atau World Cup dari free tier) → tempatkan beberapa bet dari 2-3 wallet devnet berbeda → tunggu/simulasikan match selesai → verifikasi relay service otomatis memanggil `settle_market` → verifikasi user bisa `claim_payout`.
2. Screenshot/rekam setiap langkah ini untuk keperluan demo video nantinya.
3. Perbaiki bug yang ditemukan selama testing end-to-end ini sebelum lanjut ke dokumentasi final.

### Fase 6 — Dokumentasi & Submission Prep
1. Tulis `README.md` yang mengikuti format serupa project sebelumnya (`stellar-orange-belt-2`): deployed addresses, tech stack, quick start commands, link live demo.
2. Siapkan checklist submission sesuai PRD section 11.

## Aturan kerja tambahan

- **Selalu tunjukkan progress secara bertahap.** Setelah menyelesaikan setiap fase di atas, berhenti dan laporkan ke saya apa yang sudah selesai, apa yang masih pending, dan apakah ada blocker (terutama terkait ketidakjelasan endpoint TxLINE API) sebelum lanjut ke fase berikutnya.
- **Kalau ada ambiguitas di PRD** yang membuatmu harus menebak-nebak keputusan desain penting (misalnya: skema fee platform, mekanisme dispute kalau data TxLINE salah, dsb), TANYAKAN dulu ke saya daripada berasumsi sendiri.
- **Jangan generate kode yang tidak diminta.** Fokus strict ke scope PRD. Kalau kamu punya ide fitur tambahan yang bagus, sebutkan sebagai saran di akhir laporan progress, jangan langsung diimplementasikan tanpa persetujuan.
- Tulis kode dengan komentar yang jelas terutama di bagian-bagian kritis (authorization checks, kalkulasi payout, integrasi API eksternal) — ini bukan cuma untuk hackathon, developer akan pakai ini sebagai bahan belajar juga.
- Gunakan bahasa Indonesia untuk komentar penjelasan konsep/keputusan desain, dan bahasa Inggris untuk nama variabel/fungsi/commit message (mengikuti konvensi umum industri).

Mulai dari Fase 1 sekarang. Konfirmasi ke saya kalau kamu sudah selesai membaca PRD.md dan siap mulai, atau kalau ada pertanyaan klarifikasi sebelum mulai coding.

===AKHIR PROMPT===
