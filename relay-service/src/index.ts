/**
 * FullTime Relay Service — Entry Point
 *
 * Layanan off-chain yang bertanggung jawab:
 * 1. Autentikasi ke TxLINE API
 * 2. Polling stat-validation untuk market yang aktif
 * 3. Submit settlement transaction ke FullTime Solana program
 */

import { TxLineClient } from "./txline-client";
import { SettlementWorker } from "./settlement-worker";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log(" FullTime Relay Service");
  console.log("═══════════════════════════════════════════\n");

  // Initialize TxLINE client
  const network = (process.env.TXLINE_NETWORK || "devnet") as
    | "devnet"
    | "mainnet";

  console.log(`[Init] Network: ${network}`);

  const txline = new TxLineClient(network);

  try {
    await txline.authenticate();
    console.log("[Init] TxLINE authentication successful\n");

    // Fetch available fixtures
    const fixtures = await txline.getFixtures();
    console.log(
      `[Init] Available fixtures: ${fixtures.length}`
    );

    if (fixtures.length > 0) {
      console.log("[Init] Sample fixtures:");
      fixtures.slice(0, 5).forEach((f) => {
        const home = f.Participant1IsHome
          ? f.Participant1
          : f.Participant2;
        const away = f.Participant1IsHome
          ? f.Participant2
          : f.Participant1;
        console.log(
          `  #${f.FixtureId}: ${home} vs ${away} | ${new Date(f.StartTime).toISOString()}`
        );
      });
    }

    // Initialize settlement worker
    const programId =
      process.env.FULLTIME_PROGRAM_ID ||
      "2L1YbuAks47q5CmVF5iXFQe2kCF3xYZKARkhNDRyL2jz";

    const worker = new SettlementWorker(txline, programId);

    console.log(
      `\n[Init] Settlement worker ready (program: ${programId.slice(0, 8)}...)`
    );

    // TODO: On production, register markets from on-chain query
    // For now, worker runs in polling mode
    // await worker.startPolling();

    console.log("\n✅ Relay service initialized successfully");
    console.log(
      "📌 Next: Deploy FullTime program, then connect worker to on-chain markets"
    );
  } catch (err: any) {
    console.error(`\n❌ Init failed: ${err.message}`);
    if (err.logs) {
      console.error("   Logs:", err.logs.join("\n"));
    }
    process.exit(1);
  }
}

main();
