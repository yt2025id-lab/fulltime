/**
 * FullTime Relay Service — Entry Point
 *
 * Layanan off-chain untuk:
 * 1. Autentikasi TxLINE API (subscribe free tier)
 * 2. Monitor SSE stream → deteksi match selesai
 * 3. Fetch Merkle proofs dari /api/scores/stat-validation
 * 4. Submit settlement transaction ke FullTime program
 * 5. Re-scan on-chain markets setiap 60 detik
 * 6. Polling fallback jika SSE disconnect
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { TxLineClient } from "./txline-client";
import { ScoresStream, MatchResult } from "./scores-stream";
import { ProofFetcher } from "./proof-fetcher";
import { SettlementSubmitter } from "./settlement-submitter";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// ─── Configuration ────────────────────────────────────────────────
const NETWORK = (process.env.TXLINE_NETWORK || "devnet") as
  | "devnet"
  | "mainnet";

const API_ORIGINS: Record<string, string> = {
  devnet: "https://txline-dev.txodds.com",
  mainnet: "https://txline.txodds.com",
};

const RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

const FULLTIME_PROGRAM_ID =
  process.env.FULLTIME_PROGRAM_ID ||
  "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";

const POLL_INTERVAL_MS = parseInt(
  process.env.POLL_INTERVAL_MS || "60000"
);

// ─── Types ─────────────────────────────────────────────────────────
interface TrackedMarket {
  marketPda: PublicKey;
  fixtureId: number;
  creator: PublicKey;
}

// ─── Market Scanner ────────────────────────────────────────────────

/**
 * Scan on-chain untuk semua Market accounts milik FullTime program.
 * Gunakan `getProgramAccounts` dengan discriminator filter.
 */
async function scanMarkets(
  connection: Connection,
  programId: string
): Promise<TrackedMarket[]> {
  const programPk = new PublicKey(programId);
  const markets: TrackedMarket[] = [];

  try {
    // Market account discriminator = first 8 bytes of SHA256("account:Market")
    const discriminator = anchor.utils.sha256
      .hash("account:Market")
      .slice(0, 8);
    const discBase58 = require("bs58").encode(discriminator);

    console.log(
      `[Scanner] Market discriminator: ${discBase58}`
    );

    const accounts = await connection.getProgramAccounts(
      programPk,
      {
        filters: [
          { memcmp: { offset: 0, bytes: discBase58 } },
        ],
        dataSlice: { offset: 8, length: 48 }, // fixture_id(8) + question(4+200) + creator(32)... cukup 48 bytes
      }
    );

    for (const { pubkey, account } of accounts) {
      try {
        const data = account.data;
        // Borsh decoding: fixture_id = u64 LE (8 bytes)
        const fixtureId = Number(data.readBigUInt64LE(0));
        // creator = Pubkey (32 bytes) at offset 8 + 4 + 200 = 212
        // Borsh string: 4-byte len + content. We don't know exact len.
        // Read u32 for string length
        const questionLen = data.readUInt32LE(8);
        const creatorStart = 8 + 4 + questionLen;
        const creator = new PublicKey(
          data.slice(creatorStart, creatorStart + 32)
        );

        if (fixtureId > 0) {
          markets.push({ marketPda: pubkey, fixtureId, creator });
        }
      } catch {}
    }

    if (markets.length > 0) {
      console.log(`[Scanner] Found ${markets.length} markets:`);
      markets.forEach((m) => {
        console.log(
          `  #${m.fixtureId} → ${m.marketPda.toBase58().slice(0, 10)}...`
        );
      });
    }
  } catch (err: any) {
    console.error(`[Scanner] Failed: ${err.message}`);
  }

  return markets;
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log(" FullTime Relay Service v1.0");
  console.log(` Network: ${NETWORK}`);
  console.log(` Program: ${FULLTIME_PROGRAM_ID.slice(0, 8)}...`);
  console.log("═══════════════════════════════════════════\n");

  // ─── 1. Authenticate TxLINE ─────────────────────────────────
  const txline = new TxLineClient(NETWORK);
  console.log("[Init] Authenticating with TxLINE...");
  try {
    await txline.authenticate();
    console.log("[Init] ✅ TxLINE authentication successful\n");
  } catch (err: any) {
    console.error(`[Init] ❌ TxLINE auth failed: ${err.message}`);
    process.exit(1);
  }

  const jwt = txline.getJwt();
  const apiToken = txline.getApiToken();
  if (!jwt || !apiToken) {
    console.error("[Init] ❌ No credentials");
    process.exit(1);
  }

  // ─── 2. Load wallet ────────────────────────────────────────
  const keypairPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/id.json"
  );
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(secretKey)
  );
  const wallet = new anchor.Wallet(keypair);
  console.log(`[Init] Wallet: ${wallet.publicKey.toBase58()}`);

  // ─── 3. Load FullTime IDL ──────────────────────────────────
  const fulltimeIdlPath = path.resolve(
    __dirname,
    "../../target/idl/fulltime.json"
  );
  const fulltimeIdl = JSON.parse(
    fs.readFileSync(fulltimeIdlPath, "utf-8")
  );

  const connection = new Connection(RPC_URL, "confirmed");
  const proofFetcher = new ProofFetcher(txline);
  const submitter = new SettlementSubmitter(
    proofFetcher,
    wallet,
    fulltimeIdl
  );

  // ─── 4. Dynamic market registry ────────────────────────────
  let markets: TrackedMarket[] = [];
  const refreshMarkets = async () => {
    markets = await scanMarkets(connection, FULLTIME_PROGRAM_ID);
    console.log(`[Registry] ${markets.length} active markets`);
  };
  await refreshMarkets();

  // Re-scan every 60 seconds
  setInterval(refreshMarkets, 60000);

  // ─── 5. SSE Stream ─────────────────────────────────────────
  const apiOrigin = API_ORIGINS[NETWORK];
  const streamUrl = `${apiOrigin}/api/scores/stream`;
  const stream = new ScoresStream(streamUrl, jwt, apiToken);

  stream.on("settle", async (result: MatchResult) => {
    await refreshMarkets(); // re-scan untuk pastikan market terdaftar
    const market = markets.find(
      (m) => m.fixtureId === result.fixtureId
    );
    if (!market) {
      console.log(
        `[Main] No market for fixture #${result.fixtureId}, skipping`
      );
      return;
    }
    console.log(
      `\n[Main] 🏁 SETTLEMENT fixture #${result.fixtureId}`
    );
    await submitter.settleFixture(
      result.fixtureId,
      market.marketPda
    );
  });

  stream.on("cancel", async (result: MatchResult) => {
    const market = markets.find(
      (m) => m.fixtureId === result.fixtureId
    );
    if (!market) return;
    // cancelMarket hanya bisa oleh creator — relay hanya log
    console.log(
      `\n[Main] ❌ Fixture #${result.fixtureId} cancelled (creator must cancel manually)`
    );
  });

  stream.on("fallback", () => {
    console.log("[Main] SSE fallback → polling mode");
    startPolling(txline, submitter, markets, refreshMarkets, POLL_INTERVAL_MS);
  });

  stream.start();

  // ─── 6. Health monitor ─────────────────────────────────────
  setInterval(() => {
    console.log(
      `[Health] ${markets.length} markets | uptime ${Math.floor(process.uptime())}s`
    );
  }, 60000);
}

// ─── Polling fallback ───────────────────────────────────────────
async function startPolling(
  txline: TxLineClient,
  submitter: SettlementSubmitter,
  markets: TrackedMarket[],
  refresh: () => Promise<void>,
  intervalMs: number
): Promise<void> {
  console.log(
    `[Poll] Starting (interval: ${intervalMs / 1000}s)`
  );

  const tick = async () => {
    await refresh();
    for (const market of markets) {
      try {
        const phase = await txline.detectPhase(market.fixtureId);
        if (phase.canSettle) {
          console.log(
            `[Poll] ⚽ Fixture #${market.fixtureId} → ${phase.phaseName}`
          );
          await submitter.settleFixture(
            market.fixtureId,
            market.marketPda
          );
        }
      } catch (err: any) {
        // Continue polling other markets
      }
    }
    setTimeout(tick, intervalMs);
  };

  tick();
}

// ─── Graceful shutdown ──────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("\n[Main] Shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[Main] Shutting down...");
  process.exit(0);
});

main().catch((err) => {
  console.error(`[Main] Fatal: ${err.message}`);
  process.exit(1);
});
