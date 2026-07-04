# PLAN — FullTime

**Prediction Market On-Chain World Cup 2026. Trustless auto-settlement via TxLINE Merkle proofs. No referee needed.**

- **Author:** Achmad Fauzan Ashari (Ozan_OnChain)
- **Hackathon:** TxODDS x Solana x Superteam Earn — World Cup Hackathon 2026
- **Track:** Prediction Markets & Settlement ($18,000 — 1st $12k / 2nd $4k / 3rd $2k)
- **Deadline:** 19 Juli 2026 | **Pengumuman:** 29 Juli 2026
- **Status:** Final — post-audit, revised architecture

---

## 1. Branding & Positioning

| Item | Value |
|---|---|
| **Nama** | FullTime |
| **Tagline** | _Crypto settles. No referee needed._ |
| **Deskripsi pendek** | Prediction market on-chain yang menyelesaikan sendiri begitu peluit akhir berbunyi — diverifikasi secara kriptografis via Merkle proofs dari TxLINE, tanpa admin, tanpa tombol "resolve", tanpa kepercayaan. |
| **Elevator pitch** | "Di setiap prediction market Web3 hari ini, seseorang harus login, cek skor, dan klik 'resolve'. Itu lambat, terpusat, dan bukan Web3. FullTime mengubah itu. Begitu peluit akhir World Cup berbunyi, sistem kami mengambil cryptographic Merkle proof dari TxLINE, memverifikasinya on-chain melawan kebenaran yang tertambat di Solana, dan menyelesaikan market — otomatis, tanpa kepercayaan, dalam waktu kurang dari satu detik." |

---

## 2. Arsitektur Sistem (Revised)

```
┌──────────────────────┐
│   TxLINE API (REST)   │
│  - /fixtures/snapshot │
│  - /scores/stream SSE │
│  - /scores/stat-      │
│    validation (proof) │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐      CPI call       ┌──────────────────────────┐
│  FullTime Solana      │◄───────────────────│  TxLINE Txoracle Program  │
│  Program (Anchor)     │                    │  (Merkle root on-chain)   │
│                       │                    │  Program ID (devnet):     │
│  - create_market      │                    │  6pW64gN1s2uqjHkn1unFe    │
│  - place_bet          │                    │  EjAwJkPGHoppGvS715wyP2J  │
│  - close_betting      │                    │                            │
│  - settle_market ◄────┼─ verify Merkle ───│  daily_scores_roots PDA   │
│  - claim_payout       │   proof on-chain   │                            │
│  - cancel_market      │                    └──────────────────────────┘
│  - dispute_result     │
└───────────┬───────────┘
            │
            ▼
┌──────────────────────┐      ┌─────────────────────────┐
│  Off-Chain Relay       │────▶│  React Frontend          │
│  (Node.js)             │      │  (Phantom Wallet)        │
│                        │      │                           │
│  - SSE stream listener │      │  /markets                │
│  - Phase detector (F)  │      │  /markets/:id            │
│  - Proof fetcher       │      │  /markets/:id/audit      │
│  - Settlement submitter│      │  /portfolio              │
│  - Multi-relay fallback│      │  /admin                  │
└──────────────────────┘      └─────────────────────────┘
```

### Kunci diferensiator arsitektur

| PRD (versi lama, SALAH) | FullTime (versi baru, BENAR) |
|---|---|
| Relay dipercaya karena `require_keys_eq!` authority key | Relay hanya submit proof — verifikasi kriptografis via Merkle tree on-chain |
| `settlement_proof_hash` disimpan manual | CPI call ke TxLINE `Txoracle` program, diverifikasi melawan `daily_scores_roots` |
| Relay = single point of trust | Siapa pun bisa submit proof; proof palsu ditolak oleh verifikasi Merkle |
| Polling REST tiap 2 menit | SSE streaming — deteksi `phase = F` real-time, latency < 1 detik |

---

## 3. Smart Contract Spec (Anchor / Rust)

### 3.1 On-Chain Programs yang Digunakan

| Program | Devnet Address | Fungsi |
|---|---|---|
| TxLINE Txoracle | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` | CPI call untuk verifikasi stat |
| FullTime | (akan di-deploy) | Prediction market logic |
| SPL Token 2022 | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | SOL wrapping |

### 3.2 State Accounts

```rust
#[account]
pub struct Market {
    pub fixture_id: u64,              // TxLINE FixtureId
    pub competition_id: Option<u32>,  // TxLINE CompetitionId (opsional, untuk filter)
    pub question: String,             // "Argentina vs Brazil — Who wins?"
    pub creator: Pubkey,
    pub outcome_count: u8,            // 2 (binary) atau 3 (1X2)
    pub outcome_labels: Vec<String>,  // ["HOME", "DRAW", "AWAY"]
    pub total_pool: u64,              // dalam lamports
    pub pool_per_option: Vec<u64>,
    pub betting_open_time: i64,       // unix timestamp
    pub betting_close_time: i64,      // sebelum kickoff
    pub status: MarketStatus,
    pub winning_option: Option<u8>,
    pub settlement_root: Pubkey,      // PDA daily_scores_roots TxLINE yg dipakai verifikasi
    pub settlement_tx: Option<Pubkey>, // transaction signature settlement
    pub settlement_ts: Option<i64>,
    pub dispute_until: Option<i64>,   // 1 jam setelah settlement
    pub fee_bps: u16,                 // 200 = 2%
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
    Pending,    // dibuat, belum open
    Open,       // menerima bet
    Closed,     // betting window closed, menunggu hasil
    Settled,    // hasil diverifikasi & market settled
    Disputed,   // dalam masa dispute window
    Cancelled,  // match cancelled/dibatalkan
}
```

### 3.3 Instructions

| # | Instruction | Caller | Keterangan |
|---|---|---|---|
| 1 | `create_market` | Creator | Buat market baru dari fixture TxLINE |
| 2 | `place_bet` | Bettor | Pasang taruhan pada salah satu outcome |
| 3 | `close_betting` | Permissionless | Tutup betting window (cek `betting_close_time` vs clock) |
| 4 | `settle_market` | Permissionless | **CPI call ke TxLINE Txoracle** verifikasi stat via Merkle proof, tentukan pemenang |
| 5 | `claim_payout` | Bettor | Klaim reward kalau menang (proporsional ke pool) |
| 6 | `cancel_market` | Creator | Fallback kalau match cancelled/abandoned (phase A/C) |
| 7 | `dispute_result` | Bettor | Challenge hasil settlement dalam dispute window |

### 3.4 `settle_market` — Instruksi Paling Kritis

```
settle_market(
    target_ts: i64,                    // timestamp epoch dari TxLINE
    fixture_summary: FixtureSummary,   // { fixture_id, update_stats, events_subtree_root }
    fixture_proof: Vec<ProofNode>,     // Merkle proof subtree fixture
    main_tree_proof: Vec<ProofNode>,   // Merkle proof main tree → daily_scores_root
    stat1: StatToValidate,             // stat gol Participant 1 (key=1 atau 1001/2001/...)
    stat2: StatToValidate,             // stat gol Participant 2 (key=2 atau 1002/2002/...)
) -> Result<()>

Flow:
1. Derive daily_scores_roots PDA dari TxLINE program (epoch_day dari target_ts)
2. CPI call ke TxLINE program: validate_stat dua kali (stat1, stat2)
3. Bandingkan nilai stat1 vs stat2 → tentukan winning_option (0=HOME, 1=DRAW, 2=AWAY)
4. Simpan daily_scores_roots PDA ke field settlement_root
5. Set status = Settled, dispute_until = now + 3600 (1 jam)
6. Emit event SettlementVerified { market, fixture_id, stat1_value, stat2_value, winning_option, root }
```

### 3.5 Mapping TXLINE Data

**Game Phase (kapan trigger settlement)**

| Phase | ID | Aksi |
|-------|----|------|
| F | 5 | Full Time — `settle_market` |
| FET | 10 | Extra Time selesai — `settle_market` |
| FPE | 13 | Penalti selesai — `settle_market` |
| A | 15 | Abandoned — `cancel_market` |
| C | 16 | Cancelled — `cancel_market` |

**Stat Key (apa yang diverifikasi)**

| Key | Makna | Outcome |
|-----|-------|---------|
| 1 | Participant 1 Total Goals | HOME goals |
| 2 | Participant 2 Total Goals | AWAY goals |
| 1001 | Participant 1 H1 Goals | (bonus market) |
| 2001 | Participant 1 H2 Goals | (bonus market) |

**Penentuan pemenang 1X2:**
- stat1_value > stat2_value → HOME (option 0)
- stat1_value == stat2_value → DRAW (option 1)
- stat1_value < stat2_value → AWAY (option 2)

---

## 4. Relay Service (Node.js)

### 4.1 Tanggung Jawab

| Komponen | File | Fungsi |
|---|---|---|
| SSE Listener | `scores-stream.ts` | Subscribe ke `/api/scores/stream`, deteksi `phaseId = 5/10/13/15/16` |
| Proof Fetcher | `proof-fetcher.ts` | Panggil `/api/scores/stat-validation` dengan statKey 1 & 2 |
| Settlement Submitter | `settlement-submitter.ts` | Submit tx `settle_market` dengan Merkle proof |
| Health Monitor | `health.ts` | Logging, alert kalau relay down |

### 4.2 Autentikasi TxLINE

```
1. POST {apiOrigin}/auth/guest/start → jwt
2. Subscribe on-chain: program.methods.subscribe(SERVICE_LEVEL_ID=1, DURATION_WEEKS=4)
   → gratis, pakai World Cup Free Tier
3. POST {apiBaseUrl}/token/activate
   Body: { txSig, walletSignature, leagues: [] }
   → apiToken
4. Semua request: Authorization: Bearer {jwt}, X-Api-Token: {apiToken}
```

**Konfigurasi network (devnet):**
- `apiOrigin`: `https://txline-dev.txodds.com`
- `programId`: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- `txlTokenMint`: `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG`

### 4.3 Flow Auto-Settlement

```
1. SSE stream mendeteksi event: { fixtureId, phaseId: 5 }
2. Proof fetcher: GET /api/scores/stat-validation?fixtureId=X&statKey=1&statKey2=2
3. Parse response: fixture_summary, fixture_proof, main_tree_proof, stat1, stat2
4. Settlement submitter: program.methods.settleMarket(...).accounts({ dailyScoresMerkleRoots, ... }).rpc()
5. Log tx signature + proof hash untuk audit trail
```

### 4.4 Multi-Relay Architecture (Future, dokumentasikan)

Sebutkan di README: dalam production, settlement menggunakan threshold multi-relay (mis. 2-of-3) untuk mencegah relay tunggal menjadi titik kegagalan — tapi untuk MVP hackathon, 1 relay cukup karena verifikasi kriptografis tetap berjalan.

---

## 5. Frontend Spec

### 5.1 Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 (neo-brutalism aesthetic) |
| Wallet | @solana/wallet-adapter-react + Phantom |
| Anchor Client | @coral-xyz/anchor |
| Network | Solana Devnet |
| Hosting | Vercel |

### 5.2 Halaman

| Route | Komponen | Fungsi |
|---|---|---|
| `/` | `Landing.tsx` | Hero, value proposition, CTA connect wallet |
| `/markets` | `MarketList.tsx` | Grid market cards (Open/Closed/Settled tabs) |
| `/markets/:id` | `MarketDetail.tsx` | Detail fixture, place bet, pool distribution, status badge |
| `/markets/:id/audit` | `AuditTrail.tsx` | **Halaman diferensiator** — link Solana Explorer, Merkle proof details, verifikasi independen |
| `/portfolio` | `Portfolio.tsx` | Riwayat bet user + tombol claim + dispute |
| `/admin` | `Admin.tsx` | Create market (wallet-protected), daftar fixture dari TxLINE |

### 5.3 Halaman Audit Trail (Diferensiator Penting)

Tampilkan:
1. Link ke Solana Explorer (devnet) untuk tx settlement
2. Link ke akun `daily_scores_roots` TxLINE di Solana Explorer
3. Nilai stat1 (gol home) & stat2 (gol away) yang diverifikasi
4. Merkle proof details (collapsed, expandable)
5. Tombol "Verify Independently" — user bisa verifikasi manual via Solana CLI / Explorer

---

## 6. Struktur Project

```
fulltime/
├── programs/
│   └── fulltime/
│       ├── src/
│       │   ├── lib.rs                  # entry point
│       │   ├── instructions/
│       │   │   ├── create_market.rs
│       │   │   ├── place_bet.rs
│       │   │   ├── close_betting.rs
│       │   │   ├── settle_market.rs    # CPI ke TxLINE
│       │   │   ├── claim_payout.rs
│       │   │   ├── cancel_market.rs
│       │   │   └── dispute_result.rs
│       │   ├── state/
│       │   │   └── mod.rs              # Market, Bet, MarketStatus
│       │   ├── errors.rs
│       │   └── events.rs
│       ├── Cargo.toml
│       └── Xargo.toml
├── tests/
│   └── fulltime.ts                     # TypeScript tests (anchor mocha)
├── relay-service/
│   ├── src/
│   │   ├── index.ts                    # entry
│   │   ├── txline-auth.ts             # auth flow
│   │   ├── scores-stream.ts           # SSE listener
│   │   ├── proof-fetcher.ts           # stat-validation API
│   │   └── settlement-submitter.ts    # anchor client → settle_market
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Landing.tsx
│   │   │   ├── MarketList.tsx
│   │   │   ├── MarketDetail.tsx
│   │   │   ├── AuditTrail.tsx
│   │   │   ├── Portfolio.tsx
│   │   │   └── Admin.tsx
│   │   ├── hooks/
│   │   ├── utils/
│   │   │   ├── anchor.ts
│   │   │   ├── txline.ts
│   │   │   └── explorer.ts
│   │   └── styles/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── index.html
├── Anchor.toml
├── package.json                        # root workspace
├── PRD.md
├── PLAN.md                             # file ini
├── BUILD_PROMPT.md
├── HACKATHON_INFO.md
├── README.md
└── .gitignore
```

---

## 7. TxLINE API Reference (Terkonfirmasi)

### 7.1 Autentikasi

| Step | Endpoint | Method | Output |
|---|---|---|---|
| Guest JWT | `{apiOrigin}/auth/guest/start` | POST | `{ token: string }` |
| Subscribe on-chain | via Anchor `program.methods.subscribe()` | RPC | `txSig` |
| Activate API | `{apiBaseUrl}/token/activate` | POST | `apiToken` |

### 7.2 Data Endpoints

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/fixtures/snapshot` | GET | List fixtures (opsional `?competitionId=X`) |
| `/api/scores/snapshot/{fixtureId}` | GET | Skor saat ini untuk fixture |
| `/api/scores/updates/{fixtureId}` | GET | Update skor live |
| `/api/scores/stream` | GET (SSE) | Real-time score events stream |
| `/api/scores/stat-validation` | GET | Merkle proof untuk validasi on-chain (params: `fixtureId`, `statKey`, `statKey2`) |

### 7.3 Response Stat Validation (struktur)

```json
{
  "summary": {
    "fixtureId": 17952170,
    "updateStats": { "updateCount": 5, "minTimestamp": 1234567890, "maxTimestamp": 1234567999 },
    "eventStatsSubTreeRoot": "0x..."
  },
  "subTreeProof": [{ "hash": "0x...", "isRightSibling": true }, ...],
  "mainTreeProof": [{ "hash": "0x...", "isRightSibling": false }, ...],
  "statToProve": { "key": 1, "value": 3 },
  "eventStatRoot": "0x...",
  "statProof": [{ "hash": "0x...", "isRightSibling": false }, ...]
}
```

---

## 8. Timeline & Milestone (Disempurnakan)

### Hari 1–2 (4–5 Juli): Phase 0 — TxLINE Deep Dive
- [ ] Anchor init project `fulltime`
- [ ] Setup Solana CLI ke devnet, generate wallet, airdrop SOL
- [ ] Implement TxLINE auth flow: guest JWT → subscribe free tier → activate API token
- [ ] Fetch 1 fixture snapshot, catat FixtureId dan struktur response
- [ ] Fetch 1 stat-validation proof, verifikasi struktur Merkle proof
- [ ] Pahami IDL TxLINE `Txoracle` program, konfirmasi PDA `daily_scores_roots`
- [ ] **Go/No-Go decision**: kalau stat-validation proof bisa didapat dan struktur CPI dipahami → lanjut

### Hari 3–5 (6–8 Juli): Phase 1 — Smart Contract Core
- [ ] Implement `Market` dan `Bet` structs (state/mod.rs)
- [ ] Implement `create_market`
- [ ] Implement `place_bet` (dengan cek `betting_close_time` vs clock)
- [ ] Implement `close_betting` (permissionless, cek clock)
- [ ] Implement `cancel_market`
- [ ] Unit test untuk semua instruksi di atas (termasuk negative cases)

### Hari 6–8 (9–11 Juli): Phase 2 — CPI Settlement (KRITIS)
- [ ] Implement `settle_market` dengan CPI call ke TxLINE `Txoracle.validate_stat()`
- [ ] Implement `claim_payout` (perhitungan proporsional ke pool)
- [ ] Implement `dispute_result` (dalam dispute window)
- [ ] Unit test CPI — gunakan fixture nyata dari devnet
- [ ] Test: settlement dengan proof valid → sukses
- [ ] Test: settlement dengan proof tidak valid → gagal
- [ ] Test: unauthorized user submit valid proof → tetap sukses (permissionless!)
- [ ] `anchor build` — pastikan zero warning

### Hari 9–10 (12–13 Juli): Phase 3 — Relay Service
- [ ] Implement `txline-auth.ts` — auth + subscribe + activate
- [ ] Implement `scores-stream.ts` — SSE listener, deteksi phase `F`/`FET`/`FPE`/`A`/`C`
- [ ] Implement `proof-fetcher.ts` — fetch stat-validation proof
- [ ] Implement `settlement-submitter.ts` — submit `settle_market` tx
- [ ] Wiring: SSE event → fetch proof → submit tx
- [ ] Test E2E: buat market, place bet, tunggu event (atau simulasi), verify auto-settle

### Hari 11–13 (14–16 Juli): Phase 4 — Frontend
- [ ] Setup React + Vite + TypeScript + Tailwind CSS v4
- [ ] Wallet integration: `@solana/wallet-adapter-react` + Phantom
- [ ] `Landing.tsx` — hero section, value prop, CTA
- [ ] `MarketList.tsx` — fetch dari on-chain + TxLINE fixture snapshot
- [ ] `MarketDetail.tsx` — place bet form, pool distribution bar
- [ ] `AuditTrail.tsx` — Solana Explorer links, Merkle proof viewer
- [ ] `Portfolio.tsx` — bet history + claim + dispute button
- [ ] `Admin.tsx` — create market form (wallet-protected)
- [ ] Neo-brutalism styling: high-contrast, bold borders, solid shadows

### Hari 14 (17 Juli): Phase 5 — Integration & Polish
- [ ] E2E testing dengan fixture nyata (gunakan International Friendlies yang sedang berlangsung)
- [ ] Bug fixing
- [ ] UI polish, responsive design
- [ ] Screenshot untuk submission

### Hari 15 (18–19 Juli): Phase 6 — Ship
- [ ] Rekam video demo (1:30–2:00 menit)
- [ ] Tulis README.md (deployed addresses, quick start, tech stack)
- [ ] Deploy frontend ke Vercel
- [ ] Deploy program ke devnet (final)
- [ ] Submit ke Superteam Earn
- [ ] Buffer untuk bug fix last-minute

---

## 9. Test Matrix (Minimum untuk Submission)

| Test Case | Expected | Status |
|---|---|---|
| Create market dengan fixture valid | `MarketCreated` event | [ ] |
| Create market dengan fixture invalid | Error `InvalidFixture` | [ ] |
| Place bet dalam betting window | `BetPlaced` event, pool bertambah | [ ] |
| Place bet setelah `betting_close_time` | Error `BettingClosed` | [ ] |
| Close betting setelah close time | Status → Closed | [ ] |
| Close betting sebelum close time | Error `BettingStillOpen` | [ ] |
| Settle dengan Merkle proof valid | Status → Settled, `winning_option` terisi | [ ] |
| Settle dengan proof palsu | CPI revert dari TxLINE program | [ ] |
| Claim payout oleh pemenang | SOL terkirim ke wallet | [ ] |
| Claim payout oleh yang kalah | Error `NotWinner` | [ ] |
| Double claim | Error `AlreadyClaimed` | [ ] |
| Dispute dalam window | Status → Disputed | [ ] |
| Dispute di luar window | Error `DisputeWindowClosed` | [ ] |
| Cancel market (match abandoned) | Status → Cancelled, refund | [ ] |

---

## 10. Keamanan (Security Considerations)

| Risiko | Mitigasi |
|---|---|
| Attack vector: relay submit proof palsu | Verifikasi Merkle on-chain, proof palsu gagal di CPI |
| Attack vector: front-run settlement | Permissionless — siapa pun bisa submit, tidak ada insentif front-run karena hasil deterministik |
| Attack vector: dispute abuse | Dispute window pendek (1 jam), perlu SOL untuk biaya tx |
| Edge case: match abandoned | `cancel_market` dengan refund otomatis |
| Edge case: TxLINE API down | SSE reconnect + retry; kalau timeout X jam, fallback `cancel_market` |
| Edge case: relay keypair compromised | Tidak masalah — verifikasi kriptografis tetap berjalan; relay hanya submit proof |

---

## 11. Diferensiator vs Kompetisi (16 submissions)

| Dimensi | FullTime | Kompetitor umum |
|---|---|---|
| Settlement | **CPI ke TxLINE program** — verifikasi Merkle on-chain | Manual resolve / cron + hash biasa |
| Trust model | Trustless — cryptographic proof, bukan trusted relay | Trusted admin / trusted relay |
| Audit trail | On-chain Merkle root + full proof viewable di Explorer | Hash response / tidak ada |
| Latency | SSE real-time + instant proof fetch | Polling REST 2–5 menit |
| Multi-outcome | 1X2 (Home/Draw/Away) native untuk football | Binary YES/NO |
| Dispute mechanism | On-chain dispute window + verifikasi independen | Tidak ada / manual |

---

## 12. Kriteria Sukses / Definition of Done

- [x] Nama, tagline, dan branding final
- [ ] Smart contract ter-deploy di Solana **Devnet**
- [ ] `settle_market` melakukan CPI call ke TxLINE program — **bukan sekadar hash storage**
- [ ] Relay service auto-settle via SSE + Merkle proof
- [ ] Frontend fungsional dengan wallet Phantom
- [ ] Halaman Audit Trail menampilkan link Solana Explorer + Merkle proof
- [ ] Test matrix minimum terpenuhi
- [ ] README.md dengan deployed addresses, quick start, tech stack
- [ ] Video demo (90–120 detik)
- [ ] Deploy Vercel
- [ ] Submit ke Superteam Earn

---

## 13. Kontak & Sumber

| Sumber | URL |
|---|---|
| Documentation | https://txline-docs.txodds.com/ |
| Quickstart | https://txline-docs.txodds.com/documentation/quickstart |
| World Cup Free Tier | https://txline-docs.txodds.com/documentation/worldcup |
| On-Chain Validation | https://txline-docs.txodds.com/documentation/examples/onchain-validation |
| Scores Feed | https://txline-docs.txodds.com/documentation/scores/soccer-feed |
| IDL & Types (Devnet) | https://txline-docs.txodds.com/documentation/programs/devnet |
| Program Addresses | https://txline-docs.txodds.com/documentation/programs/addresses |
| Superteam Listing | https://superteam.fun/earn/listing/prediction-markets-and-settlement/ |
| Support Telegram | https://t.me/TxLINEChat |
| Support Discord | https://discord.gg/pPXPpZ6bwM |

---
*Dokumen ini adalah single source of truth untuk development FullTime. Setiap perubahan harus direfleksikan di sini.*
