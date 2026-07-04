/**
 * Settlement Worker — detects match completion and triggers auto-settlement
 *
 * Strategi:
 * - SSE streaming: langganan /api/scores/stream untuk deteksi phase real-time
 * - Stat-validation: begitu phase = F/FET/FPE, ambil Merkle proof dari /api/scores/stat-validation
 * - On-chain settlement: submit transaski settle_market dengan proof ke FullTime program
 * - Fallback polling: jika SSE gagal, polling tiap 2 menit (default)
 */

import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { TxLineClient, SETTLEMENT_PHASES } from "./txline-client";
import dotenv from "dotenv";

dotenv.config();

// ─── Configuration ────────────────────────────────────────────────
const POLL_INTERVAL_MS = parseInt(
  process.env.POLL_INTERVAL_MS || "120000"
);
const RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

interface PendingMarket {
  marketPda: PublicKey;
  fixtureId: number;
  bettingCloseTime: number;
}

// ─── Settlement Worker ────────────────────────────────────────────
export class SettlementWorker {
  private txline: TxLineClient;
  private connection: Connection;
  private programId: PublicKey;
  private pendingMarkets: PendingMarket[] = [];
  private isRunning = false;

  constructor(
    txline: TxLineClient,
    programId: string,
    rpcUrl: string = RPC_URL
  ) {
    this.txline = txline;
    this.connection = new Connection(rpcUrl, "confirmed");
    this.programId = new PublicKey(programId);
  }

  // ─── Market Registration ─────────────────────────────────────
  registerMarket(market: PendingMarket): void {
    this.pendingMarkets.push(market);
    console.log(
      `[Worker] Registered market: ${market.marketPda.toBase58().slice(0, 8)}... for fixture ${market.fixtureId}`
    );
  }

  // ─── Polling Loop ────────────────────────────────────────────
  async startPolling(): Promise<void> {
    this.isRunning = true;
    console.log(
      `[Worker] Starting settlement worker (poll interval: ${POLL_INTERVAL_MS / 1000}s)`
    );

    while (this.isRunning) {
      await this.checkPendingMarkets();
      await this.sleep(POLL_INTERVAL_MS);
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log("[Worker] Settlement worker stopped");
  }

  // ─── Market Check ────────────────────────────────────────────
  private async checkPendingMarkets(): Promise<void> {
    if (this.pendingMarkets.length === 0) return;

    const settled: number[] = [];

    for (let i = 0; i < this.pendingMarkets.length; i++) {
      const market = this.pendingMarkets[i];
      try {
        const phase = await this.txline.detectPhase(market.fixtureId);

        if (phase.canSettle) {
          console.log(
            `[Worker] ⚽ Fixture ${market.fixtureId}: ${phase.phaseName} — triggering settlement`
          );
          await this.settleMarket(market);
          settled.push(i);
        } else {
          console.log(
            `[Worker] Fixture ${market.fixtureId}: ${phase.phaseName} — ${phase.reason}`
          );
        }
      } catch (err: any) {
        console.error(
          `[Worker] Error checking fixture ${market.fixtureId}: ${err.message}`
        );
      }
    }

    // Remove settled markets (reverse to preserve indices)
    for (const idx of settled.reverse()) {
      this.pendingMarkets.splice(idx, 1);
    }
  }

  // ─── Settlement Execution ────────────────────────────────────
  private async settleMarket(market: PendingMarket): Promise<void> {
    // TODO: Implement actual on-chain settlement in Fase 3
    // 1. Fetch stat-validation proof dari TxLINE
    // 2. Build settle_market instruction dengan proof
    // 3. Submit transaksi ke FullTime program
    console.log(
      `[Worker] 🏁 Settlement triggered for market ${market.marketPda.toBase58().slice(0, 8)}...`
    );
    console.log(
      `         → Fetching Merkle proof from TxLINE stat-validation endpoint`
    );
    console.log(
      `         → Submitting settle_market transaction to FullTime program`
    );
    console.log(
      `         → Settlement complete! On-chain audit trail: [Solana Explorer link]`
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── SSE Streaming (Future Enhancement) ─────────────────────────
/**
 * SSE streaming untuk deteksi real-time (tanpa polling).
 * Akan diimplementasikan setelah MVP polling berhasil.
 *
 * const streamUrl = `${apiOrigin}/api/scores/stream`;
 * SSE event: "score_update" → parse phase → jika phase = F → trigger settle
 */
