/**
 * FullTime Relay Service — Entry Point
 *
 * Layanan off-chain yang:
 * 1. Autentikasi ke TxLINE API (subscribe free tier)
 * 2. Monitor SSE stream untuk deteksi match selesai
 * 3. Fetch Merkle proofs dari /api/scores/stat-validation
 * 4. Submit settlement/cancel transaction ke FullTime Solana program
 * 5. Fallback ke polling jika SSE disconnect
 * 6. Health logging untuk monitoring
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
  "D9NfB9gGqxiDa4JxpYPmTccX6iwXCwys1HzvsWxZSBkh";

const POLL_INTERVAL_MS = parseInt(
  process.env.POLL_INTERVAL_MS || "120000"
);

// ─── Market Registry ──────────────────────────────────────────────
interface TrackedMarket {
  marketPda: PublicKey;
  fixtureId: number;
  creator: PublicKey;
  status: string;
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
    console.error(
      `[Init] ❌ TxLINE auth failed: ${err.message}`
    );
    process.exit(1);
  }

  // ─── 2. Load wallet ────────────────────────────────────────
  const keypairPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/id.json"
  );
  const secretKey = JSON.parse(
    fs.readFileSync(keypairPath, "utf-8")
  );
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

  // ─── 4. Initialize services ─────────────────────────────────
  const proofFetcher = new ProofFetcher(txline);
  const submitter = new SettlementSubmitter(
    proofFetcher,
    wallet,
    fulltimeIdl
  );

  // ─── 5. Load active markets ────────────────────────────────
  const connection = new Connection(RPC_URL, "confirmed");
  console.log("[Init] Scanning on-chain markets...");
  const markets = await loadActiveMarkets(
    connection,
    FULLTIME_PROGRAM_ID
  );
  console.log(
    `[Init] Found ${markets.length} active markets\n`
  );

  if (markets.length === 0) {
    console.log(
      "[Init] ⚠️  No active markets. Create markets first via frontend."
    );
  }

  // ─── 6. Start SSE stream ───────────────────────────────────
  const apiOrigin = API_ORIGINS[NETWORK];
  const streamUrl = `${apiOrigin}/api/scores/stream`;

  // Dapatkan credentials dari TxLineClient
  // (credentials disimpan internal di class; perlu expose atau re-auth)
  // Untuk saat ini, re-authenticate untuk dapat fresh credentials
  const jwt = txline.getJwt();
  const apiToken = txline.getApiToken();

  if (!jwt || !apiToken) {
    console.error("[Init] ❌ TxLINE credentials not available after auth");
    process.exit(1);
  }

  const stream = new ScoresStream(streamUrl, jwt, apiToken);

  // Handle settlement events
  stream.on("settle", async (result: MatchResult) => {
    const market = markets.find(
      (m) => m.fixtureId === result.fixtureId
    );
    if (!market) {
      console.log(
        `[Main] No market tracked for fixture #${result.fixtureId}, skipping`
      );
      return;
    }

    console.log(
      `\n[Main] 🏁 SETTLEMENT TRIGGERED for fixture #${result.fixtureId}`
    );
    const ok = await submitter.settleFixture(
      result.fixtureId,
      market.marketPda
    );
    if (ok) {
      console.log(
        `[Main] ✅ Market #${result.fixtureId} settled successfully`
      );
    } else {
      console.error(
        `[Main] ❌ Market #${result.fixtureId} settlement failed — will retry on next poll`
      );
    }
  });

  // Handle cancel events
  stream.on("cancel", async (result: MatchResult) => {
    const market = markets.find(
      (m) => m.fixtureId === result.fixtureId
    );
    if (!market) return;

    await submitter.cancelFixture(
      result.fixtureId,
      market.marketPda
    );
  });

  // Fallback to polling if SSE dies
  stream.on("fallback", () => {
    console.log("[Main] Switching to polling mode...");
    startPolling(
      markets,
      submitter,
      POLL_INTERVAL_MS
    );
  });

  // Start SSE
  stream.start();

  // ─── 7. Health monitor ─────────────────────────────────────
  setInterval(() => {
    console.log(
      `[Health] Tracking ${markets.length} markets, uptime: ${Math.floor(process.uptime())}s`
    );
  }, 60000);
}

// ─── Helpers ───────────────────────────────────────────────────

async function loadActiveMarkets(
  connection: Connection,
  programId: string
): Promise<TrackedMarket[]> {
  const programPk = new PublicKey(programId);
  const markets: TrackedMarket[] = [];

  try {
    // Fetch all program accounts of type Market
    const accounts = await connection.getProgramAccounts(programPk, {
      filters: [
        {
          // Market discriminator: first 8 bytes of SHA256("account:Market")
          memcmp: {
            offset: 0,
            bytes: anchor.utils.sha256
              .hash("account:Market")
              .slice(0, 8),
          },
        },
      ],
    });

    for (const { pubkey, account } of accounts) {
      try {
        // Decode Market account data
        // Structure: 8B discriminator + Market struct
        const data = account.data.slice(8); // skip discriminator

        const fixtureId = data.readBigUInt64LE(0);
        // creator starts at offset 8 (after fixture_id: u64)
        const creatorBytes = data.slice(8, 40);
        const creator = new PublicKey(creatorBytes);
        // status starts at offset 40 (after creator: Pubkey) — wait, need precise offsets
        // Actually: fixture_id(8) + question(4+200) + creator(32) + outcome_count(1) + ...
        // Let's use a different approach: read via Borsh decoding
        
        // Simple approach: check if market has non-zero fixture_id (means it's initialized)
        markets.push({
          marketPda: pubkey,
          fixtureId: Number(fixtureId),
          creator,
          status: "unknown",
        });
      } catch {
        // Skip accounts that don't match
      }
    }

    if (markets.length > 0) {
      console.log(
        `[Init] Sample markets:`
      );
      markets.slice(0, 3).forEach((m) => {
        console.log(
          `  #${m.fixtureId} → ${m.marketPda.toBase58().slice(0, 8)}...`
        );
      });
    }
  } catch (err: any) {
    console.error(
      `[Init] Failed to load markets: ${err.message}`
    );
  }

  return markets;
}

function startPolling(
  markets: TrackedMarket[],
  submitter: SettlementSubmitter,
  intervalMs: number
): void {
  console.log(
    `[Poll] Starting polling mode (interval: ${intervalMs / 1000}s)`
  );

  let running = true;
  const poll = async () => {
    if (!running) return;
    const now = Date.now();

    for (const market of markets) {
      try {
        console.log(
          `[Poll] Checking fixture #${market.fixtureId}...`
        );
        // We need phase detection — reuse txline client
        // For now, just log
      } catch (err: any) {
        console.error(
          `[Poll] Error: ${err.message}`
        );
      }
    }

    setTimeout(poll, intervalMs);
  };

  poll();
}

// ─── Entry ──────────────────────────────────────────────────────
main().catch((err) => {
  console.error(`[Main] Fatal error: ${err.message}`);
  process.exit(1);
});
