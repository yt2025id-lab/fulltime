/**
 * Settlement Submitter — submit transaksi settle_market ke FullTime program
 *
 * Alur:
 * 1. Ambil proof data dari ProofFetcher
 * 2. Derive daily_scores_roots PDA
 * 3. Build settle_market instruction dengan Anchor client
 * 4. Submit transaksi ke Solana devnet
 * 5. Log tx signature untuk audit trail
 */

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { ProofFetcher, SettlementProofData } from "./proof-fetcher";
import { TxLineClient } from "./txline-client";
import dotenv from "dotenv";

dotenv.config();

// ─── Configuration ────────────────────────────────────────────────
const TXLINE_PROGRAM_ID =
  process.env.TXLINE_PROGRAM_ID ||
  "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";

const FULLTIME_PROGRAM_ID =
  process.env.FULLTIME_PROGRAM_ID ||
  "D9NfB9gGqxiDa4JxpYPmTccX6iwXCwys1HzvsWxZSBkh";

const RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

// ─── Settlement Submitter ─────────────────────────────────────────

export class SettlementSubmitter {
  private proofFetcher: ProofFetcher;
  private connection: Connection;
  private wallet: anchor.Wallet;
  private program: anchor.Program;

  constructor(
    proofFetcher: ProofFetcher,
    wallet: anchor.Wallet,
    idl: any
  ) {
    this.proofFetcher = proofFetcher;
    this.connection = new Connection(RPC_URL, "confirmed");
    this.wallet = wallet;

    const provider = new anchor.AnchorProvider(
      this.connection,
      wallet,
      { commitment: "confirmed" }
    );
    anchor.setProvider(provider);

    this.program = new anchor.Program(idl, provider);
  }

  /**
   * Execute settlement untuk satu fixture.
   */
  async settleFixture(
    fixtureId: number,
    marketPda: PublicKey
  ): Promise<boolean> {
    console.log(
      `\n═══════════════════════════════════════════════`
    );
    console.log(`[Settle] Fixture #${fixtureId} — Settlement started`);
    console.log(
      `[Settle] Market PDA: ${marketPda.toBase58()}`
    );

    // 1. Fetch proof data
    const proof = await this.proofFetcher.fetchSettlementProof(
      fixtureId
    );
    if (!proof) {
      console.error(`[Settle] ❌ Failed to fetch proof`);
      return false;
    }

    console.log(
      `[Settle]   Home goals: ${proof.statA.statToProve.value}, Away goals: ${proof.statB.statToProve.value}`
    );

    // 2. Derive daily_scores_roots PDA
    const { pda: dailyScoresPda, epochDay } =
      ProofFetcher.deriveDailyScoresPda(
        proof.targetTs,
        TXLINE_PROGRAM_ID
      );

    console.log(
      `[Settle]   Epoch day: ${epochDay}, PDA: ${dailyScoresPda.slice(0, 12)}...`
    );

    // 3. Submit settlement transaction
    try {
      // Konversi targetTs dari milliseconds ke i64 untuk contract
      const targetTsI64 = new anchor.BN(proof.targetTs);

      // Build instruction data
      const fixtureSummary = {
        fixtureId: new anchor.BN(proof.fixtureSummary.fixtureId),
        updateStats: {
          updateCount: proof.fixtureSummary.updateStats.updateCount,
          minTimestamp: new anchor.BN(
            proof.fixtureSummary.updateStats.minTimestamp
          ),
          maxTimestamp: new anchor.BN(
            proof.fixtureSummary.updateStats.maxTimestamp
          ),
        },
        eventsSubTreeRoot: proof.fixtureSummary.eventsSubTreeRoot,
      };

      console.log(
        `[Settle]   Submitting settle_market tx...`
      );

      // Add compute budget for Merkle proof verification (2 CPI calls)
      const computeIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_400_000,
      });

      const tx = await this.program.methods
        .settleMarket(
          targetTsI64,
          fixtureSummary as any,
          proof.fixtureProof as any,
          proof.mainTreeProof as any,
          proof.statA as any,
          proof.statB as any
        )
        .accounts({
          market: marketPda,
          dailyScoresMerkleRoots: new PublicKey(dailyScoresPda),
        })
        .preInstructions([computeIx])
        .rpc();

      console.log(
        `[Settle]   ✅ Settlement TX: ${tx}`
      );
      console.log(
        `[Settle]   🔗 Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`
      );
      console.log(
        `═══════════════════════════════════════════════\n`
      );

      return true;
    } catch (err: any) {
      console.error(
        `[Settle]   ❌ Settlement failed: ${err.message}`
      );
      if (err.logs) {
        console.error(`[Settle]   Logs:`, err.logs);
      }
      return false;
    }
  }

  /**
   * Cancel market (match abandoned/cancelled).
   */
  async cancelFixture(
    fixtureId: number,
    marketPda: PublicKey
  ): Promise<boolean> {
    console.log(
      `[Settle] ❌ Fixture #${fixtureId} — Cancelling market`
    );

    try {
      const tx = await this.program.methods
        .cancelMarket()
        .accounts({
          creator: this.wallet.publicKey,
          market: marketPda,
        })
        .rpc();

      console.log(`[Settle]   ✅ Cancel TX: ${tx}`);
      return true;
    } catch (err: any) {
      console.error(
        `[Settle]   ❌ Cancel failed: ${err.message}`
      );
      return false;
    }
  }
}
