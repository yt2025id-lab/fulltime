# FullTime

<div align="center">
  <img src="./frontend/public/logo fulltime.png" alt="FullTime" width="320" />
  <h3><em>Crypto settles. No referee needed.</em></h3>
</div>

---

## 🔗 Quick Links

| Resource | URL |
|---|---|
| **Live Demo** | *(deploy ke Vercel — coming soon)* |
| **Devnet Program** | [`58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x`](https://explorer.solana.com/address/58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x?cluster=devnet) |
| **TxLINE Data Source** | [txline-docs.txodds.com](https://txline-docs.txodds.com/) |
| **Hackathon Listing** | [Superteam Earn — Prediction Markets & Settlement](https://superteam.fun/earn/listing/prediction-markets-and-settlement/) |

---

## 🧠 The Problem

Every Web3 prediction market today works the same way: someone — an admin, an oracle operator, a DAO multisig — has to **log in, check the score, and click "resolve."** This manual step is:

- **Slow** — results sit unsettled for hours after the final whistle
- **Centralized** — one person or entity controls the outcome
- **Opaque** — users have no cryptographic proof the resolution is honest

This isn't Web3. It's Web2 with extra steps.

---

## ⚡ What FullTime Does

**FullTime** is a trustless prediction market built on Solana for World Cup 2026. The moment the final whistle blows:

1. **TxLINE** (TxODDS's cryptographically-verified sports data feed) publishes match results
2. **A Merkle proof** is generated, cryptographically linking the score to an on-chain Merkle root
3. **FullTime's smart contract** verifies the proof via Cross-Program Invocation (CPI) to the TxLINE oracle program
4. **The market settles automatically** — no admin, no button, no human

Every settlement leaves a **permanent, verifiable audit trail** on Solana. Anyone can independently verify the result via Solana Explorer.

---

## 🏗 Architecture

```
┌──────────────────────┐
│   TxLINE API (REST)   │  Live World Cup data feed
│  - fixtures/snapshot  │
│  - scores/stream (SSE)│
│  - stat-validation    │  Merkle proofs
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐     CPI call      ┌──────────────────────────┐
│  FullTime Program     │◄─────────────────│  TxLINE Txoracle Program  │
│  (Anchor / Rust)      │                  │  on-chain Merkle roots    │
│                       │   verify_stat()  │  devnet: 6pW64gN1s2uq... │
│  create_market        │                  │                            │
│  place_bet            │                  │  daily_scores_roots PDA   │
│  close_betting        │                  └──────────────────────────┘
│  settle_market ◄──────┤
│  claim_payout         │
│  refund_bet           │
│  cancel_market        │
└───────────┬───────────┘
            │
            ▼
┌──────────────────────┐     ┌─────────────────────────┐
│  Relay Service        │     │  React Frontend          │
│  (Node.js)            │     │  (Vite + Tailwind v4)    │
│                       │     │                           │
│  SSE stream listener  │     │  /markets                │
│  Phase detector (F/5)  │     │  /markets/:id            │
│  Proof fetcher        │     │  /markets/:id/audit      │
│  Settlement submitter │     │  /portfolio              │
│  Market sync (60s)    │     │  /admin                  │
└──────────────────────┘     └─────────────────────────┘
```

### Key Differentiator: Trustless Settlement

| Typical Prediction Market | FullTime |
|---|---|
| Admin clicks "resolve" | Merkle proof verified on-chain |
| Data source untrusted | TxLINE cryptographically verified |
| Settlement timing arbitrary | Phase F/5 detected → settled in <1s |
| Audit trail: "trust us" | Verifiable via Solana Explorer |

---

## 📂 Project Structure

```
fulltime/
├── programs/fulltime/           # Solana Anchor program (Rust)
│   └── src/lib.rs               # 7 instructions, CPI to TxLINE
├── tests/fulltime.ts            # 15 unit tests
├── relay-service/               # Off-chain settlement bot (Node.js)
│   └── src/
│       ├── txline-client.ts     # TxLINE auth + data fetching
│       ├── scores-stream.ts     # SSE real-time listener
│       ├── proof-fetcher.ts     # Merkle proof → CPI types
│       ├── settlement-submitter.ts  # Submit settle_market tx
│       └── index.ts             # Entry point + market sync
├── frontend/                    # React + Vite + Tailwind v4
│   └── src/
│       ├── context/             # Wallet + Anchor provider
│       ├── components/          # Navbar
│       └── pages/               # 6 pages
├── Anchor.toml                  # Anchor workspace config
├── PLAN.md                      # Complete project plan
└── PRD.md                       # Product requirements
```

---

## 🔐 Smart Contract

### Instructions

| # | Instruction | Caller | Description |
|---|---|---|---|
| 1 | `create_market` | Creator | Create new prediction market for a TxLINE fixture |
| 2 | `open_market` | Permissionless | Transition Pending → Open |
| 3 | `place_bet` | Bettor | Place SOL bet on HOME / DRAW / AWAY |
| 4 | `close_betting` | Permissionless | Close betting window after kickoff |
| 5 | `settle_market` | **Permissionless** | CPI to TxLINE, verify Merkle proof, determine winner |
| 6 | `claim_payout` | Bettor | Claim proportional winnings (minus 2% fee) |
| 7 | `refund_bet` | Bettor | Reclaim SOL when market cancelled |
| 8 | `cancel_market` | Creator | Fallback for abandoned/cancelled matches |

### State

```rust
#[account]
pub struct Market {
    pub fixture_id: u64,         // TxLINE FixtureId
    pub question: String,        // "Argentina vs Brazil — Who wins?"
    pub creator: Pubkey,
    pub outcome_count: u8,       // 3 (HOME/DRAW/AWAY)
    pub total_pool: u64,         // Total SOL in pool
    pub pool_home: u64,
    pub pool_draw: u64,
    pub pool_away: u64,
    pub betting_open_time: i64,
    pub betting_close_time: i64,
    pub status: MarketStatus,    // Pending → Open → Closed → Settled/Cancelled
    pub winning_option: u8,      // 0=HOME, 1=DRAW, 2=AWAY
    pub settlement_root: Pubkey, // TxLINE daily_scores_roots PDA
    pub settlement_epoch_day: u16,
    pub dispute_until: i64,      // 1-hour dispute window
    pub fee_bps: u16,            // 200 = 2%
}
```

### Security

- **PDA verification**: `daily_scores_merkle_roots` checked against `Pubkey::find_program_address` before CPI
- **Creator-only cancel**: `constraint = market.creator == creator.key()`
- **Payout math**: All arithmetic uses `checked_add`/`checked_sub`/`checked_mul`/`checked_div`
- **Status lifecycle**: Every state transition validates current status
- **Merkle proof**: CPI to TxLINE `validate_stat` verifies proof against on-chain root before settlement

---

## 🔄 Settlement Flow

```
SSE Stream              Proof Fetcher             Smart Contract
──────────              ─────────────             ──────────────
│                       │                         │
│  phase=F detected     │                         │
│  (Match finished)     │                         │
│─────────►             │                         │
│                       │  GET stat-validation    │
│                       │  (key=1: HOME goals)    │
│                       │  (key=2: AWAY goals)    │
│                       │──────────►              │
│                       │                         │  CPI validate_stat()
│                       │                         │  ├─ stat_a verified
│                       │                         │  ├─ stat_b verified
│                       │                         │  ├─ PDA derived OK
│                       │                         │  └─ winning_option set
│                       │                         │
│                       │             TX confirmed │
│                       │ ◄────────────────────── │
│                                 Audit trail     │
│                           (Solana Explorer link) │
```

---

## 🎨 Frontend

6 pages, neo-brutalism aesthetic (thick borders, solid shadows, monospace).

| Route | Page | Function |
|---|---|---|
| `/` | Landing | Hero, CTA, value proposition |
| `/markets` | Market List | Grid cards, filter by status |
| `/markets/:id` | Market Detail | Pool bars, place bet, claim |
| `/markets/:id/audit` | Audit Trail | Solscan links, Merkle root, settlement proof |
| `/portfolio` | Portfolio | Active bets, claim/refund, history |
| `/admin` | Admin | Quick-select WC fixtures, create market |

---

## 🚀 Quick Start

### Prerequisites

- Rust 1.85+ `rustup install stable`
- Solana CLI 2.3+ `agave-install init 2.3.13`
- Anchor CLI 1.1.2 `avm install 1.1.2 && avm use 1.1.2`
- Node.js 20+
- Phantom Wallet (browser extension)

### Setup

```bash
# Clone & install
git clone <repo-url> fulltime
cd fulltime

# Install deps
npm install
cd relay-service && npm install && cd ..
cd frontend && npm install && cd ..

# Build & deploy smart contract
anchor build
solana airdrop 2 --url devnet   # get SOL if needed
solana program deploy target/deploy/fulltime.so \
  --program-id target/deploy/fulltime-keypair.json \
  --url devnet

# Run tests
anchor test --skip-build

# Start frontend
cd frontend && npm run dev

# Start relay service (terminal terpisah)
cd relay-service && npm run dev
```

---

## 🌐 Network Configuration

| Component | Devnet Address |
|---|---|
| FullTime Program | `58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x` |
| TxLINE Oracle | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxLINE API | `https://txline-dev.txodds.com` |
| Solana RPC | `https://api.devnet.solana.com` |

---

## 🧪 Test Coverage

```
FullTime
  create_market
    ✔ creates a market
    ✔ rejects question > 200 chars
    ✔ rejects close <= open
  open_market
    ✔ opens pending market
    ✔ rejects double open
  place_bet
    ✔ places HOME bet
    ✔ rejects invalid option
  close_betting
    ✔ closes after time
    ✔ rejects double close
  cancel_and_refund
    ✔ cancels market by creator
    ✔ refunds bet on cancelled market
    ✔ rejects refund on non-cancelled market
  settle_market_status
    ✔ rejects settle on open market
  claim_payout
    ✔ rejects claim on pending market
  edge cases
    ✔ PDA deterministic

15 passing (0 failing)
```

---

## 🔬 Technical Decisions

| Decision | Rationale |
|---|---|
| CPI to TxLINE instead of relay-only | Makes settlement **trustless** — relay just submits proofs, contract verifies them on-chain |
| Merkle proof on-chain verification | Matches TxODDS's "tamper-evident audit trail" requirement — proves settlement integrity mathematically |
| `daily_scores_roots` PDA check | Prevents using fake Merkle root accounts — only genuine TxLINE PDAs accepted |
| `target_ts / 86400000` for epoch_day | Matches TxLINE's ms-based timestamp format |
| 1X2 (HOME/DRAW/AWAY) instead of binary | Football's natural outcome model — better UX than YES/NO |
| Neo-brutalism frontend | Distinct from generic dApps, memorable for judges, functional aesthetic |
| Relay service with SSE + polling fallback | Real-time detection (<1s), graceful degradation |

---

## 🛡 Audit Trail Verification

Every settlement produces three on-chain artifacts, all independently verifiable:

1. **FullTime Market Account** — contains `settlement_root`, `winning_option`, `settlement_ts`
2. **TxLINE daily_scores_roots PDA** — the Merkle root published by TxODDS for that epoch day
3. **Transaction signature** — links the settlement to a specific Solana block

Visit any settled market's audit page (`/markets/:id/audit`) to see all three with direct Solscan links.

---

## 📦 Dependencies

| Layer | Technology |
|---|---|
| Smart Contract | Anchor 0.30.1, Solana 1.18.26, Rust |
| Relay Service | Node.js, axios, @coral-xyz/anchor, @solana/web3.js |
| Frontend | React 19, Vite 8, Tailwind CSS v4, @solana/wallet-adapter |
| Oracle | TxLINE API (TxODDS), TxLINE Smart Contract |

---

## 👤 Author

**Achmad Fauzan Ashari (Ozan_OnChain)**

Built for **TxODDS x Solana x Superteam Earn — World Cup Hackathon 2026**

Track: **Prediction Markets & Settlement** ($18,000 — 1st: $12k / 2nd: $4k / 3rd: $2k)

---

## 📄 License

ISC
