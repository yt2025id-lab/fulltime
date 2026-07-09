# FullTime — Complete Session Summary
**Author:** Achmad Fauzan Ashari (Ozan_OnChain)
**Hackathon:** TxODDS x Solana x Superteam Earn — World Cup 2026
**Track:** Prediction Markets & Settlement ($18,000)
**Date:** 4 Juli 2026 (Updated: 7 Juli 2026 — v2.2: Live football-data.org, Portfolio, faucet, FAQ overhaul)
**Deadline:** 19 Juli 2026 | **Pengumuman:** 29 Juli 2026

---

## ✅ Final Status

| Item | URL/Info |
|------|----------|
| **GitHub** | https://github.com/yt2025id-lab/fulltime (public) |
| **Live Demo** | https://fulltime-wc.vercel.app |
| **Devnet Program** | `58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x` |
| **Smart Contract Tests** | 15/15 passing |
| **E2E Test #1** | create→open→bet→close→cancel→refund (6/6 ✅, 14.2s) |
| **E2E Test #2** | 3 market types: Champion / Top Scorer / Best GK (18/18 ✅) |
| **E2E Test #3** | 5 markets: Champion + Golden Boot + Golden Glove + MVP + Best Coach (25/25 ✅, 79s) |
| **Local Dev Server** | `http://localhost:5173` (Vite) |

---

## 📂 Project Structure

```
fulltime/
├── programs/fulltime/src/lib.rs     # Smart Contract (Anchor/Rust, ~820 lines)
├── tests/fulltime.ts                # 15 unit tests
├── relay-service/
│   └── src/
│       ├── txline-client.ts         # TxLINE API auth + data (exposes jwt/apiToken)
│       ├── scores-stream.ts         # SSE real-time listener (AbortController)
│       ├── proof-fetcher.ts         # Merkle proof → CPI types (2 API calls)
│       ├── settlement-submitter.ts  # Submit settle_market tx + ComputeBudget
│       ├── index.ts                 # Entry point + market sync (60s) + polling fallback
│       └── txline-poc.ts            # Quick verification script
├── frontend/
│   └── src/
│       ├── context/FullTimeContext.tsx  # Wallet + Anchor provider (full IDL)
│       ├── components/
│       │   ├── Navbar.tsx               # Navbar with logo
│       │   └── Marquee.tsx              # Country flag marquee animation
│       └── pages/
│           ├── Landing.tsx         # Championship-level: marquee, comparison, 5-step flow
│           ├── Markets.tsx         # Grid cards, filter tabs (correct discriminator)
│           ├── MarketDetail.tsx    # Pool bars, bet, claim, open market button
│           ├── AuditTrail.tsx      # Solscan links, Merkle root, verification guide
│           ├── Portfolio.tsx       # Active bets, claim/refund, history (correct discriminator)
│           └── Admin.tsx           # Create market, WC fixtures (live TxLINE data)
├── README.md                       # Comprehensive documentation
├── Anchor.toml                     # Config: devnet + localnet
├── vercel.json                     # SPA rewrites for React Router
├── PLAN.md                         # Rencana arsitektur (PRIVATE)
├── PRD.md                          # Product requirements (PRIVATE)
├── BUILD_PROMPT.md                 # Build instructions (PRIVATE)
├── HACKATHON_INFO.md               # Hackathon research (PRIVATE)
└── SESSION_SUMMARY.md              # This file (PRIVATE)
```

---

## 🔐 Smart Contract — 8 Instructions

| # | Instruction | Caller | Description |
|---|---|---|---|
| 1 | `create_market` | Creator | Create market with fixture_id + question + timestamps |
| 2 | `open_market` | Permissionless | Transition Pending → Open |
| 3 | `place_bet` | Bettor | Place SOL bet on HOME (0) / DRAW (1) / AWAY (2) |
| 4 | `close_betting` | Permissionless | Close after betting_close_time passes |
| 5 | `settle_market` | **Permissionless** | CPI to TxLINE `validateStat()` — Merkle proof verification on-chain |
| 6 | `claim_payout` | Bettor | Claim proportional winnings (minus 2% platform fee) |
| 7 | `refund_bet` | Bettor | Reclaim SOL when market cancelled (auto-closes bet account via `close=bettor`) |
| 8 | `cancel_market` | Creator | Fallback for abandoned/cancelled matches |

### Key Architecture Decisions

| Decision | Rationale |
|---|---|
| CPI to TxLINE, not relay-trusted | Settlement is **TRUSTLESS** — proof verified mathematically on-chain |
| `daily_scores_roots` PDA check | Prevents fake Merkle root accounts |
| `target_ts / 86400000` | Matches TxLINE's millisecond timestamp format |
| 1X2 (HOME/DRAW/AWAY) | Football's natural outcome model — better UX |
| `checked_add/sub/mul/div` everywhere | No arithmetic overflow vulnerabilities |
| `close = bettor` on refund | Auto-closes bet account, reclaims rent |

### Security
- **PDA verification**: `daily_scores_merkle_roots` derived and checked before CPI
- **Creator-only cancel**: `constraint = market.creator == creator.key()`
- **Status lifecycle enforcement**: Every transition validates current status
- **Merkle proof**: CPI to TxLINE `validate_stat` verifies against on-chain root

---

## 🔄 Relay Service

| Component | File | Key Features |
|---|---|---|
| SSE Listener | `scores-stream.ts` | Phase detection (5/10/13=settle, 15/16=cancel), AbortController, exponential backoff reconnect |
| Proof Fetcher | `proof-fetcher.ts` | 2x API calls (statKey=1 HOME, statKey=2 AWAY), direct `number[]` mapping (no base64) |
| Settlement Submitter | `settlement-submitter.ts` | ComputeBudget 1.4M CU, Solscan explorer link logging |
| Entry Point | `index.ts` | SSE + polling fallback, market registry sync every 60s, health monitor |

### E2E Verified
- ✅ TxLINE auth (JWT + subscribe free tier + API token activation)
- ✅ Fixtures snapshot: 12 live fixtures from devnet
- ✅ Stat-validation: Merkle proofs fetched and parsed (6 fixtureProof + 1 mainTreeProof nodes)
- ✅ PDA derivation: `daily_scores_roots` via `Pubkey.findProgramAddressSync`
- ✅ API response format confirmed: `number[]` for byte arrays (raw bytes, no base64 conversion needed)

---

## 🎨 Frontend — 6 Pages + 2 Components

### Pages

| Route | Description | Key Features |
|---|---|---|
| `/` | Landing | Animated hero, 6 marquee sections (40+ WC country flags), 5-step How It Works, comparison table (FullTime vs Traditional), CTA |
| `/markets` | Market List | Grid cards, 5 filter tabs (all/open/closed/settled/cancelled), pool distribution, correct discriminator |
| `/markets/:id` | Market Detail | Pool bars, place bet form (HOME/DRAW/AWAY), open market button, claim payout, audit link |
| `/markets/:id/audit` | Audit Trail | Solscan links (Program + Market + Merkle Root PDA), epoch day, settlement details, independent verification guide |
| `/portfolio` | Portfolio | Active bets with claim/refund buttons, history section, correct Bet discriminator |
| `/admin` | Admin | Quick-select WC fixtures (live TxLINE devnet data), manual entry, create + open market flow |

### Tech Stack
- **React 19** + Vite 8 + TypeScript + Tailwind CSS v4
- **@solana/wallet-adapter-react** + Phantom wallet
- **@coral-xyz/anchor** client with full IDL
- **Neo-brutalism aesthetic**: thick borders (`border-4`), solid shadows (`shadow-[6px_6px_0px_#000]`), bold typography, high contrast colors

### Landing Page Evolution
- **v1**: Neo-brutalism white theme, thick black borders, solid shadows
- **v2 (Championship)**: Added 40+ country flag marquees, comparison table, 5-step flow
- **v3 (Mindloop Final)**: Dark theme `#0a0a0f`, glass morphic cards, gradient text, blur orbs

### Landing Page Sections (Mindloop Dark Theme — Final Version)
1. **Hero** — Dark gradient bg with pink/yellow blur orbs, gradient text, glass-morphic buttons
2. **Marquee 1** — ⚽ South America (white/bold on dark bg, 30s loop)
3. **Features** — 3 glass-morphic cards (Trustless/Automatic/Auditable), border glow on hover
4. **Marquee 2** — ⚽ Europe (reverse)
5. **How It Works** — 5-step cards with gradient number badges
6. **Marquee 3** — ⚽ More Europe
7. **Comparison Table** — FullTime (green) vs Traditional (red), glass bg
8. **Marquee 4** — ⚽ Asia (reverse)
9. **Marquee 5** — ⚽ Africa
10. **CTA** — Gradient orb + buttons
11. **Marquee 6** — ⚽ CONCACAF (reverse)
12. **Footer** — Subtle, white/10 text

**Design System (Mindloop-inspired):**
- `#0a0a0f` dark background throughout
- Glass morphic: `bg-white/5 backdrop-blur-sm border-white/10 rounded-2xl`
- Gradient text: `bg-gradient-to-r from-white to-[#FF1493] bg-clip-text text-transparent`
- Shadow gradient orbs: `bg-[#FF1493]/10 rounded-full blur-3xl`
- All transitions: `duration-500 ease-out`
- Hover: cards `hover:border-[#FF1493]/30`, buttons color-flip animation

### Fixtures (Live TxLINE Devnet Data)
- **Upcoming**: Argentina vs Egypt, Switzerland vs Colombia, Paraguay vs France, Brazil vs Norway, Mexico vs England, USA vs Belgium, Portugal vs Spain, Canada vs Morocco
- **Past (for testing)**: Colombia vs Ghana, Australia vs Egypt, South Africa vs Canada, Argentina vs Cape Verde

---

## 📊 E2E Test Results

### Test #1 — Basic Flow (14.2s)
```
1/6 CREATE   ✅ pending | Argentina vs Egypt | Fee: 2%
2/6 OPEN     ✅ open
3/6 BET      ✅ 0.1 SOL on HOME | Pool: 0.1 SOL
4/6 CLOSE    ✅ closed
5/6 CANCEL   ✅ cancelled
6/6 REFUND   ✅ +0.101464 SOL returned | Bet account closed
```

### Test #2 — Creative Markets (79s)
```
1. 🏆 World Cup Champion          → Bet 0.15 SOL on DRAW   → Refund ✅
2. ⚽ Golden Boot (Top Scorer)     → Bet 0.10 SOL on HOME   → Refund ✅
3. 🧤 Golden Glove (Best GK)      → Bet 0.08 SOL on AWAY   → Refund ✅
4. 🏅 Player of Tournament (MVP)  → Bet 0.12 SOL on HOME   → Refund ✅
5. 👔 Best Coach                   → Bet 0.05 SOL on DRAW   → Refund ✅
```

### Key Finding
**Question field is free text** — FullTime supports ANY prediction type, not just match winners:
- Tournament champion · Top Scorer · Best Goalkeeper · MVP · Best Coach
- Final matchup · Group winner · Red cards · Corners · Possession
- All use the same flow: `create→open→bet→close→settle/cancel→claim/refund`

---

## 🚀 Deployment

| Item | Details |
|------|---------|
| **Vercel** | `fulltime-wc.vercel.app` (SPA rewrites for React Router) |
| **GitHub** | `github.com/yt2025id-lab/fulltime` (public, excludes internal MD files) |
| **Solana Devnet** | Program `58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x` |
| **Wallet** | `52rWpvP4SeQ2n8B3ULPsYN6zTmYd6ZeQHM8VqXfjcsZ8` (~12.5 SOL) |

---

## 🐛 Bugs Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Markets page "No markets found" | Wrong Market discriminator `Dg4UZq5MQCtq` | Correct: `U8qf9A7qqTa1dLWK6nCYyA` |
| Portfolio empty | Wrong Bet discriminator `LRfi4TvquPVs` | Correct: `5XQeKAhjkvc5vWNjH` |
| `program.account.market.fetch()` failing | Frontend IDL was empty | Full IDL with account definitions + discriminators |
| 404 on `/markets` etc. in Vercel | No SPA rewrite rules | `vercel.json` rewrites `/(.*)` → `/index.html` |
| `block-buffer 0.12.1` build error | Solana BPF platform-tools v1.48 (rustc 1.84.1) doesn't support edition2024 | Upgraded to Anchor CLI 1.1.2 (newer platform-tools) |
| E2E market #2 "BettingCloseTimeInPast" | `now` timestamp captured at script start, stale after 15s | Compute `Date.now()` fresh before each `createMarket` |
| Vercel white screen / IDL crash | Manual IDL had undefined custom types (ScoresBatchSummary, etc.) | Load full `idl.json` from `/public/idl.json` at runtime via `fetch()` |
| Vercel SSO/redirect all pages | Deployment Protection (Vercel Authentication) enabled | `vercel project protection disable frontend --sso` |
| Frontend LP Ciamik blank page | `shaders` npm package incompatible with React 19 + Vite | Deleted project, redesigned FullTime landing with CSS gradients instead |

---

## 📝 Full Commit History

| # | Commit | Description |
|---|--------|-------------|
| 1 | `1feab97` | Fase 1: Scaffolding + Integrasi TxLINE PoC |
| 2 | `88daa22` | Audit Fase 1: Fix program ID, configs, WC schedule |
| 3 | `b7cc9b7` | Fase 2: Smart Contract — 7 instructions, 12 tests pass |
| 4 | `f8705c8` | Fase 2 Audit Fixes: validation, refund_bet, rename context |
| 5 | `0cf1bb4` | Fase 3: Relay Service — SSE, proof fetcher, settlement submitter |
| 6 | `b1d66d4` | Fase 3 Audit Fixes: AbortController, epoch_day ms, market polling |
| 7 | `2ac9886` | Fase 4: Frontend — React 19 + Vite + Tailwind v4 |
| 8 | `114fc42` | README.md comprehensive + logo integration |
| 9 | `8641e07` | Fix E2E: Open Market button on Admin + MarketDetail |
| 10 | `e74291e` | Update WC fixtures to live TxLINE devnet data |
| 11 | `ccdb130` | Vercel deployment config |
| 12 | `8f145ff` | Update README with live demo URL |
| 13 | `98d696e` | Fix discriminator + full IDL in context |
| 14 | `393b93b` | Fix Vercel SPA routing |
| 15 | `1f7912b` | Landing page championship-level redesign |
| 16 | `a5dbe82` | Marquee country flags + comparison table |
| 17 | `ecabdec` | Marquee: larger flags, no boxes, faster |
| 18 | `649d5b2` | Fix IDL loading (fetch /idl.json), Anchor all(), Vercel SSO off |
| 19 | `8808a3f` | Landing: Mindloop dark theme redesign (glass morphic, gradients) |

---

## 🏆 Championship Differentiators

1. **CPI Merkle proof settlement** — verify on-chain via TxLINE `validateStat()`, not relay-trusted. The ONLY prediction market with cryptographic proof verification.
2. **SSE real-time + auto-settle < 1s** — SSE stream detects phase F instantly, triggers settlement
3. **Audit trail on-chain** — `/markets/:id/audit` with Solscan links, Merkle proof details, independent verification
4. **Universal prediction types** — Match winner · Champion · Top scorer · Best GK · MVP · Best coach · ANY question
5. **Refund mechanism** — `refund_bet` for cancelled markets (auto-closes bet account, returns SOL)
6. **Championship landing page** — 6 marquee sections with 40+ World Cup country flags, comparison table, 5-step flow
7. **Neo-brutalism UI** — distinct visual identity, memorable for judges, consistent across all pages

---

## 🎨 v2.0 — Major Redesign (6 Juli 2026)

### Perubahan Desain: Neo-Brutalist → Liquid Glass Dark Green
- Terinspirasi dari **Stellar Prophecy** (Orange Belt Level 3)
- Background `#052e16` dark green + stadium image
- Glass morphic cards: `backdrop-blur` + gradient border via mask
- Font: `Instrument Serif` italic (headings) + `Inter` (body)
- Aksen: amber `#fbbf24` + gold gradient buttons
- Animasi: `framer-motion` BlurText, blur-fade-up scroll reveals
- Tambah `FadingVideo` component — video background loop dengan crossfade

### Perubahan Smart Contract: 1X2 → Yes/No Binary
- 3-outcome (HOME/DRAW/AWAY) → **binary YES/NO** (2 outcomes)
- Pool: `pool_home`/`pool_draw`/`pool_away` → `pool_yes`/`pool_no`
- **Dua mode settlement:**
  - `settle_market` — TxLINE CPI trustless (home_goals > away_goals → YES, else → NO)
  - **`resolve_market(outcome)` — NEW** — creator resolves manually untuk general Yes/No questions
- Field baru: `is_trustless: bool` di struct Market
- `MarketCreated` event updates
- 15/15 tests passing (deployed to devnet)

### Perubahan Frontend: 6 Halaman → 3 Halaman
| Route | Page | Keterangan |
|-------|------|------------|
| `/` | Landing | Video bg, BlurText hero, 6 marquee, How It Works (4 steps), Features, CTA |
| `/app` | **Dashboard** (NEW) | All-in-one: create market, bet, resolve, claim, your bets — menggabungkan Markets + MarketDetail + Admin + Portfolio |
| `/matches` | **Matches** (NEW) | Live World Cup data dari football-data.org (port dari Stellar) |

### Tech Stack Update
- **framer-motion** ^12.x ditambahkan untuk animasi
- `@types/bn.js` untuk Vercel build compatibility

### Live
- **Devnet Program:** `58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x` (upgraded)
- **GitHub:** `github.com/yt2025id-lab/fulltime` (public)
- **Vercel:** `fulltime-wc.vercel.app` (auto-deploy from main)



## 🎯 v2.2 — Live Data, Portfolio, UX Polish (7 Juli 2026)

### Live Match Data
- **football-data.org API** — Top Scorers, 12-group Standings (A-L), Knockout bracket live
- Vite proxy with `loadEnv()` for API key; Vercel Edge Function for production
- **TxLINE fixtures** — 6 World Cup matches + real-time scores overlay

### Dashboard Improvements
- **GlowCard** rotating borders | **Portfolio drawer** (slide-in, Claim/Refund)
- **Wallet card** (balance + Devnet badge) | **Auto-open** on manual market create
- **Filter cancelled** markets | **Snake_case field fix** in loadMarkets

### New Pages & UX
- `/faq` — 12 Q&A accordion | `/faucet` — SOL airdrop + GitHub instructions
- **Multi-wallet**: Phantom + Solflare + Torus
- **Design**: monospace font, brick red headers, centered nav pills, trophy marquee

### Active Markets
- 2 Trustless TxLINE: Argentina vs Egypt, Norway vs England
- 1 Manual: "Will Haaland be top scorer?"
- Wallet user: `8LkEf...` | Wallet dev: `52rWp...`

---

## ⚠️ Remaining for Hackathon Submission

| Item | Status |
|------|--------|
| Landing page (liquid glass dark theme) | ✅ Done |
| All smart contract tests | ✅ 15/15 |
| Yes/No binary markets | ✅ Done |
| resolve_market (manual) | ✅ Done |
| 3-page layout | ✅ Done |
| Vercel deployment (public) | ✅ fulltime-wc.vercel.app |
| GitHub repo (public) | ✅ github.com/yt2025id-lab/fulltime |
| Video demo (1:30-2:00 menit) | ❌ Not done |
| Submit ke Superteam Earn | ❌ Not done |

---

## 🚀 Quick Start

```bash
git clone https://github.com/yt2025id-lab/fulltime
cd fulltime

# Smart contract
anchor build
anchor test --skip-build --skip-deploy

# Frontend (http://localhost:5173)
cd frontend && npm install && npm run dev

# Relay service
cd relay-service && npm install && npm run dev
```
