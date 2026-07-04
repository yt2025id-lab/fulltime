# PRD — GoalCast Markets
**Prediction Market On-Chain untuk World Cup 2026, disettle otomatis via TxLINE Oracle Data**

- **Author:** Achmad Fauzan Ashari (Ozan_OnChain)
- **Hackathon:** TxODDS x Solana x Superteam Earn — World Cup Hackathon 2026
- **Track:** Prediction Markets & Settlement ($18,000 — 1st $12k / 2nd $4k / 3rd $2k)
- **Deadline submission:** 19 Juli 2026
- **Winner announcement:** 29 Juli 2026
- **Status dokumen:** Draft v1.0 — 4 Juli 2026

---

## 1. Latar Belakang & Konteks

Builder (Achmad) sudah punya pengalaman langsung membangun **Stellar Prophecy**, prediction market YES/NO on-chain di Soroban (Stellar), termasuk smart contract Rust, frontend React/TypeScript, dan integrasi wallet (Freighter). Project ini adalah **port arsitektur yang sama ke ekosistem Solana**, dengan diferensiator utama: **settlement otomatis** berbasis data pertandingan real-time dari TxLINE (bukan resolve manual oleh admin/oracle manusia).

Builder juga sudah punya pengalaman integrasi automation oracle (Chainlink Automation + Data Feeds di project Savanna Finance, Celo), yang pola arsitekturnya bisa di-reuse untuk trigger auto-settlement di project ini.

### Mengapa ini punya peluang menang
Framing resmi sponsor menekankan kata kunci: *"tamper-evident audit trail," "compliance," "automated smart contract verification."* Ini sinyal kuat bahwa juri kemungkinan besar menilai:
1. Apakah settlement benar-benar **otomatis on-chain**, bukan tombol "resolve" manual.
2. Apakah data TxLINE benar-benar **terverifikasi dan dapat diaudit** (bukan cuma dipakai sebagai angka biasa).
3. Apakah produk **fungsional end-to-end** dengan data match nyata, bukan mock data.

---

## 2. Problem Statement

Prediction market Web3 pada umumnya masih bergantung pada:
- Oracle terpusat/manual untuk resolve hasil (rawan delay, manipulasi, atau human error)
- Data pertandingan yang tidak terverifikasi sumbernya (rawan sengketa hasil)

**GoalCast Markets** menyelesaikan ini dengan settlement otomatis: begitu pertandingan selesai dan data resmi masuk lewat TxLINE (yang sudah di-timestamp cryptographically on-chain oleh TxODDS), smart contract langsung meng-settle market tanpa campur tangan manusia.

---

## 3. Goals & Non-Goals

### Goals (harus ada di MVP untuk submission)
- [ ] Create market untuk pertandingan World Cup 2026 (pilih fixture dari TxLINE)
- [ ] User bisa place bet (YES/NO atau Home/Draw/Away) pakai SOL/USDC
- [ ] Settlement **otomatis** memicu begitu skor akhir match tersedia di TxLINE
- [ ] Claim payout untuk pemenang
- [ ] UI menampilkan **bukti audit trail on-chain** (link ke transaksi Solana yang membuktikan data match sudah tercatat/timestamped)
- [ ] Demo end-to-end dengan minimal 1 fixture nyata dari TxLINE World Cup Free Tier

### Non-Goals (skip untuk MVP, sebutkan sebagai "future work" di submission)
- Multi-outcome market kompleks (over/under, handicap) — cukup binary/3-way dulu
- Mobile app native
- Governance token / DAO voting untuk dispute resolution
- Liquidity pool / AMM untuk market making (pakai simple pool sederhana dulu)

---

## 4. Tech Stack

| Layer | Teknologi | Catatan |
|---|---|---|
| Smart Contract | **Anchor Framework (Rust)** | Bukan Soroban — beda dari Stellar Prophecy, tapi konsep serupa |
| Blockchain | **Solana Devnet → Mainnet-beta** (untuk demo) | Devnet dulu untuk development, cek requirement submission apakah wajib mainnet |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 | Reuse struktur dari frontend Stellar Prophecy |
| Wallet | **Phantom** / Solflare (Solana Wallet Adapter) | Ganti dari Freighter |
| Oracle Data | **TxLINE API** (TxODDS) | Guest JWT + on-chain subscription (gratis untuk World Cup) |
| Automation trigger | Cron job off-chain (Node.js) yang polling TxLINE + submit transaksi settle, ATAU Solana Clockwork/keeper jika waktu memungkinkan | Mulai dari cron sederhana dulu untuk MVP, upgrade ke keeper jika waktu cukup |
| Hosting frontend | Vercel | Sama seperti project sebelumnya |
| CI/CD | GitHub Actions | Reuse pipeline dari stellar-orange-belt-2 |

---

## 5. Arsitektur Sistem

```
┌─────────────────┐      ┌──────────────────┐      ┌────────────────────┐
│   TxLINE API     │─────▶│  Off-chain Relay   │─────▶│  Solana Program     │
│ (TxODDS oracle)  │      │  (Node.js service)  │      │  (Anchor - Rust)    │
│ fixtures/scores  │      │  - poll match data   │      │  create_market      │
└─────────────────┘      │  - detect final score│      │  place_bet          │
                          │  - submit settle_tx  │      │  settle_market      │
                          └──────────────────────┘      │  claim_payout       │
                                                          └─────────┬──────────┘
                                                                    │
                                                          ┌─────────▼──────────┐
                                                          │  React Frontend     │
                                                          │  (Phantom Wallet)   │
                                                          │  - browse markets   │
                                                          │  - place bet        │
                                                          │  - claim winnings   │
                                                          │  - audit trail view │
                                                          └─────────────────────┘
```

### Alur Auto-Settlement (diferensiator utama)
1. Market dibuat untuk fixture tertentu (contoh: "Indonesia vs Argentina — Siapa menang?")
2. User bertaruh selama window waktu tertentu (tutup sebelum kickoff)
3. Off-chain relay service polling TxLINE API setiap X menit untuk fixture tsb
4. Begitu status fixture = `FINISHED` dan skor final tersedia, relay service otomatis memanggil instruksi `settle_market` di smart contract dengan menyertakan data skor + signature/proof dari TxLINE
5. Smart contract verifikasi data (minimal: cocokkan fixture ID, mark market sebagai settled) dan hitung siapa pemenang
6. User yang menang bisa `claim_payout`

---

## 6. Smart Contract Spec (Anchor / Rust)

### 6.1 Program Accounts (State)

```rust
#[account]
pub struct Market {
    pub fixture_id: String,        // ID pertandingan dari TxLINE
    pub question: String,          // "Argentina menang?"
    pub creator: Pubkey,
    pub outcome_options: Vec<String>, // ["YES", "NO"] atau ["HOME","DRAW","AWAY"]
    pub total_pool: u64,
    pub pool_per_option: Vec<u64>,
    pub betting_close_time: i64,   // unix timestamp, sebelum kickoff
    pub status: MarketStatus,      // Open, Closed, Settled, Cancelled
    pub winning_option: Option<u8>,
    pub fee_bps: u16,              // fee platform, misal 200 = 2%
    pub bump: u8,
}

#[account]
pub struct Bet {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub option_index: u8,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum MarketStatus {
    Open,
    Closed,      // betting window ditutup, menunggu hasil match
    Settled,     // hasil sudah masuk, siap diklaim
    Cancelled,   // fallback kalau data TxLINE tidak tersedia / match dibatalkan
}
```

### 6.2 Instructions

| Instruction | Deskripsi | Siapa yang panggil |
|---|---|---|
| `create_market` | Buat market baru untuk 1 fixture | Admin/creator |
| `place_bet` | User taruh sejumlah token ke salah satu opsi | User (bettor) |
| `close_betting` | Tutup window taruhan (otomatis via `betting_close_time` atau manual) | Siapapun (permissionless check via clock) |
| `settle_market` | Set `winning_option` berdasarkan data TxLINE | **Relay service (authority key khusus)** — INI YANG PALING PENTING dibuat aman |
| `claim_payout` | User klaim reward kalau menang | User (bettor) |
| `cancel_market` | Fallback kalau data tidak pernah masuk (timeout X jam setelah kickoff) | Admin, sebagai safety net |

### 6.3 Keamanan yang wajib diperhatikan
- `settle_market` **HARUS** dibatasi hanya bisa dipanggil oleh relay authority key yang sudah ditentukan (`require_keys_eq!`), supaya tidak sembarang orang bisa settle market dengan hasil palsu.
- Simpan **fixture_id + raw response hash dari TxLINE** on-chain sebagai bukti audit (bisa disimpan sebagai field tambahan `settlement_proof_hash: [u8; 32]`) — ini yang jadi "tamper-evident audit trail" yang ditekankan sponsor.
- Tambahkan `cancel_market` sebagai fallback kalau TxLINE API down atau data tidak pernah masuk dalam X jam, supaya dana user tidak terkunci selamanya.

---

## 7. Integrasi TxLINE API

### 7.1 Autentikasi (dikonfirmasi dari dokumentasi resmi)

```
1. POST https://txline.txodds.com/auth/guest/start
   → dapat guest JWT

2. Subscribe on-chain ke "World Cup Free Tier" (gratis, tidak perlu beli token TxL)
   → sign transaksi pakai wallet Solana (guest atau project wallet)

3. POST https://txline.txodds.com/api/token/activate
   Body: { txSig, walletSignature, leagues: [] }
   Header: Authorization: Bearer {jwt}
   → dapat apiToken

4. Semua request data selanjutnya pakai:
   Authorization: Bearer {jwt}
   X-Api-Token: {apiToken}
```

### 7.2 Endpoint data yang dibutuhkan
> ⚠️ **PENTING untuk developer/AI coding assistant:** endpoint pasti untuk fixtures/scores/odds belum terkonfirmasi lengkap di riset ini. **WAJIB cek dokumentasi resmi terbaru di https://txline-docs.txodds.com/ (bagian "API Reference") sebelum implementasi**, dan join **t.me/TxLINEChat** untuk tanya detail teknis kalau ada yang ambigu. Jangan asal menebak nama endpoint.

Yang perlu dicari di dokumentasi resmi:
- Endpoint list fixtures World Cup 2026 (untuk populate pilihan market saat `create_market`)
- Endpoint get live score / match status per fixture
- Format response untuk status "FINISHED" dan skor final
- Apakah ada webhook (lebih baik daripada polling) untuk notifikasi match selesai

### 7.3 Off-chain Relay Service (Node.js)
Tanggung jawab:
1. Polling TxLINE API tiap interval (mis. tiap 2 menit) untuk fixture yang match-nya sedang berjalan
2. Deteksi kapan status berubah jadi `FINISHED`
3. Ambil skor final + hash response sebagai bukti
4. Submit transaksi `settle_market` ke Solana program pakai relay authority keypair
5. Log semua aktivitas untuk debugging (submission juri kemungkinan minta log ini sebagai bukti otomasi bekerja)

---

## 8. Frontend Spec

### 8.1 Halaman/komponen utama
| Halaman | Fungsi |
|---|---|
| `/` Landing | Penjelasan produk, CTA connect wallet |
| `/markets` | List semua market (filter: Open, Closed, Settled) |
| `/markets/:id` | Detail market — placing bet, lihat pool distribution, status |
| `/markets/:id/audit` | **Halaman khusus audit trail** — tampilkan link transaksi Solana yang jadi bukti settlement, timestamp data TxLINE, fixture ID |
| `/portfolio` | Riwayat bet user + tombol claim payout |
| `/admin` | (protected) create market baru dari daftar fixture TxLINE |

### 8.2 Reuse dari Stellar Prophecy
- Struktur komponen `Dashboard.tsx`, styling neo-brutalism, pola sim-sign-send transaction bisa di-porting konsepnya (ganti library dari `stellar-sdk` ke `@solana/web3.js` + `@coral-xyz/anchor`)
- Wallet connector: ganti `Freighter API` → `@solana/wallet-adapter-react` + Phantom

---

## 9. Data Model (Off-chain / Frontend cache — opsional tapi direkomendasikan)

Kalau waktu cukup, tambahkan lapisan indexing sederhana (bisa pakai Supabase/Postgres ringan) untuk cache data market + history, supaya frontend tidak perlu selalu query on-chain langsung (lebih cepat untuk demo).

```
markets_cache: { fixture_id, question, status, pool_total, options[], settled_at, tx_signature }
bets_cache: { market_id, bettor_wallet, option, amount, claimed, tx_signature }
```

Ini **opsional** — kalau waktu mepet, skip dan query on-chain langsung saja (lebih sedikit moving parts, lebih aman untuk demo hackathon).

---

## 10. Milestone & Timeline (15 hari, deadline 19 Juli 2026)

| Hari | Task | Output |
|---|---|---|
| 1 (4 Jul) | Setup Anchor project + wallet Solana devnet + eksperimen TxLINE auth (guest JWT → activate) | API access berhasil, contoh response data tersimpan |
| 2-3 | Baca API Reference lengkap, konfirmasi endpoint fixtures/scores. Setup relay service skeleton (Node.js) | Relay bisa fetch 1 fixture data dan print ke console |
| 4-6 | Tulis smart contract: `create_market`, `place_bet`, `close_betting` | Unit test lolos untuk 3 instruksi ini |
| 7-8 | Tulis `settle_market` (dengan auth check relay key) + `claim_payout` + `cancel_market` | Unit test lolos, termasuk test kasus gagal (unauthorized settle) |
| 9 | Hubungkan relay service ke `settle_market` on-chain (end-to-end otomatis) | Demo: market otomatis settle tanpa klik manual |
| 10-12 | Build frontend: landing, markets list, market detail, place bet, claim | UI fungsional connect ke devnet |
| 13 | Halaman audit trail + polish UI (reuse neo-brutalism style) | Semua halaman selesai |
| 14 | Testing end-to-end dengan fixture nyata, rekam demo video (durasi target 1:30–2:00 menit) | Video demo siap |
| 15 (19 Jul) | Deploy final ke Vercel + submit ke Superteam Earn listing, buffer untuk bug fix | Submission lengkap |

---

## 11. Kriteria Sukses / Definition of Done untuk Submission

- [ ] Smart contract ter-deploy di Solana **Devnet** (cek requirement: apakah wajib mainnet — konfirmasi ke t.me/TxLINEChat kalau ragu)
- [ ] Repo GitHub public dengan README jelas (format serupa `stellar-orange-belt-2`)
- [ ] Live demo URL di Vercel
- [ ] Video demo (durasi pendek, jelas, tunjukkan settlement otomatis benar-benar terjadi — ini bagian paling penting untuk dibuktikan)
- [ ] Dokumentasi arsitektur (boleh reuse PRD ini yang disederhanakan)
- [ ] Bukti minimal 1 market yang settle otomatis end-to-end dengan data TxLINE asli (screenshot/video transaksi on-chain)
- [ ] Submit lewat listing "Prediction Markets and Settlement" di superteam.fun/earn

---

## 12. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Endpoint TxLINE untuk fixtures/scores belum jelas | Cek dokumentasi resmi H-1 sebelum mulai coding, join Telegram support |
| Waktu 15 hari mepet untuk full automation | Prioritaskan auto-settlement bekerja untuk **1 fixture saja** dulu sebagai proof-of-concept, baru generalize |
| World Cup match asli belum tentu berlangsung pas waktu development | Gunakan data historis / International Friendlies (juga gratis di free tier) untuk testing sebelum match asli terjadi |
| Relay service jadi single point of failure/centralization | Sebutkan transparan di submission sebagai "known limitation — future work: decentralize via multiple relay nodes / Chainlink Automation equivalent di Solana" — kejujuran soal trade-off dinilai positif oleh juri teknis |

---

## 13. Referensi

- Listing hackathon: https://superteam.fun/earn/listing/prediction-markets-and-settlement/
- Overview hackathon: https://superteam.fun/earn/hackathon/world-cup/
- Dokumentasi TxLINE: https://txline-docs.txodds.com/documentation/quickstart
- Support teknis: t.me/TxLINEChat
- Referensi arsitektur sebelumnya: repo `stellar-orange-belt-2` (Stellar Prophecy)
