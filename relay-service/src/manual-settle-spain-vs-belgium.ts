/**
 * Manual settlement — Spain vs Belgium (fixture #18218149)
 * 
 * 1. close_betting → Open → Closed
 * 2. settle_market → CPI TxLINE validateStat → Settled
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { TxLineClient } from "./txline-client";
import { ProofFetcher } from "./proof-fetcher";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const FULLTIME_PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
const TXLINE_PROGRAM_ID = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
const RPC_URL = "https://api.devnet.solana.com";
const FIXTURE_ID = 18218149; // Spain vs Belgium
const MARKET_PDA = new PublicKey("5ZTzJqTZLwxkVrJ7Kk5U6SLKYT3TegM6udTof7ZisYQD");

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log(" Manual Settlement: Spain vs Belgium");
  console.log(` Fixture: #${FIXTURE_ID}`);
  console.log(` Market: ${MARKET_PDA.toBase58()}`);
  console.log("═══════════════════════════════════════════\n");

  // ─── Load wallet ─────────────────────────
  const keypairPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/id.json"
  );
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));
  const wallet = new anchor.Wallet(keypair);
  console.log(`[Wallet] ${wallet.publicKey.toBase58()}`);

  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // ─── Load FullTime IDL ──────────────────
  const idlPath = path.resolve(__dirname, "../../target/idl/fulltime.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new anchor.Program(idl, provider);

  // ─── Check market state ─────────────────
  const marketAcc = await program.account.market.fetch(MARKET_PDA);
  console.log(`[Market] Status: ${Object.keys(marketAcc.status)[0]}`);
  console.log(`[Market] Trustless: ${marketAcc.isTrustless}`);
  console.log(`[Market] Pool YES: ${marketAcc.poolYes.toNumber() / 1e9} SOL`);
  console.log(`[Market] Pool NO: ${marketAcc.poolNo.toNumber() / 1e9} SOL`);

  // ─── Step 1: close_betting ──────────────
  console.log("\n[Step 1] Closing betting...");
  try {
    // Check current status
    if (!("open" in marketAcc.status)) {
      console.log(`[Step 1] ⚠️ Market not open (status: ${Object.keys(marketAcc.status)[0]}), skipping close`);
    } else {
      const closeTx = await program.methods
        .closeBetting()
        .accounts({ market: MARKET_PDA })
        .rpc();
      console.log(`[Step 1] ✅ Betting closed: ${closeTx}`);
      console.log(`[Step 1] 🔗 https://explorer.solana.com/tx/${closeTx}?cluster=devnet`);
      
      // Wait for confirmation
      await new Promise(r => setTimeout(r, 3000));
    }
  } catch (err: any) {
    console.error(`[Step 1] ❌ Close failed: ${err.logs ? err.logs.slice(-5).join("\n") : err.message}`);
    if (err.message?.includes("0x1771") || err.message?.includes("InvalidMarketStatus")) {
      console.log("[Step 1] Market probably already closed, continuing...");
    } else {
      throw err;
    }
  }

  // ─── Step 2: Fetch proof ────────────────
  console.log("\n[Step 2] Fetching Merkle proof from TxLINE (latest seq)...");
  const txline = new TxLineClient("devnet");
  await txline.authenticate();
  
  // Get latest seq — we need the proof for the FINAL state
  const scores = await txline.getScoresSnapshot(FIXTURE_ID) as any[];
  const latestSeq = scores?.length || 1;
  const penaltySeq = Math.max(1, latestSeq - 5); // skip last 5 penalty-phase updates
  console.log(`[Scores] Total: ${latestSeq} updates, using seq=${penaltySeq}`);
  const latest = scores[scores.length - 1];
  console.log(`[Scores] Latest GameState: ${latest?.GameState}, StatusId: ${latest?.StatusId}`);
  console.log(`[Scores] P1: ${JSON.stringify(latest?.Score?.Participant1?.Total)}`);
  console.log(`[Scores] P2: ${JSON.stringify(latest?.Score?.Participant2?.Total)}`);
  
  // Fetch proof with latest seq for BOTH stat keys (need consistent state)
  const v1 = await txline.getStatValidation({ fixtureId: FIXTURE_ID, seq: penaltySeq, statKey: 1 });
  const v2 = await txline.getStatValidation({ fixtureId: FIXTURE_ID, seq: penaltySeq, statKey: 2 });

  let proof: any; 
  if (!v1?.summary?.fixtureId) {
    console.error("[Proof] ❌ No validation data at latest seq, trying seq=1");
    const fetcherFallback = new ProofFetcher(txline);
    proof = await fetcherFallback.fetchSettlementProof(FIXTURE_ID);
    if (!proof) { console.error("Fatal: no proof"); process.exit(1); }
  } else {
    console.log(`[Proof] V1 HOME goals: ${v1.statToProve?.value}, V2 AWAY goals: ${v2.statToProve?.value}`);
    
    proof = {
      targetTs: v1.summary.updateStats.minTimestamp,
      fixtureSummary: {
        fixtureId: v1.summary.fixtureId,
        updateStats: {
          updateCount: v1.summary.updateStats.updateCount,
          minTimestamp: v1.summary.updateStats.minTimestamp,
          maxTimestamp: v1.summary.updateStats.maxTimestamp,
        },
        eventsSubTreeRoot: v1.summary.eventStatsSubTreeRoot,
      },
      fixtureProof: (v1.subTreeProof || []).map((n: any) => ({ hash: n.hash, isRightSibling: n.isRightSibling })),
      mainTreeProof: (v1.mainTreeProof || []).map((n: any) => ({ hash: n.hash, isRightSibling: n.isRightSibling })),
      statA: {
        statToProve: { key: v1.statToProve?.key ?? 1, value: v1.statToProve?.value ?? 0, period: v1.statToProve?.period ?? 0 },
        eventStatRoot: v1.eventStatRoot || [],
        statProof: (v1.statProof || []).map((n: any) => ({ hash: n.hash, isRightSibling: n.isRightSibling })),
      },
      statB: {
        statToProve: { key: v2?.statToProve?.key ?? 2, value: v2?.statToProve?.value ?? 0, period: v2?.statToProve?.period ?? 0 },
        eventStatRoot: v2?.eventStatRoot || [],
        statProof: (v2?.statProof || []).map((n: any) => ({ hash: n.hash, isRightSibling: n.isRightSibling })),
      },
    };
  }

  if (!proof) {
    console.error("[Step 2] ❌ No proof available");
    process.exit(1);
  }

  console.log(`[Proof] Home goals: ${proof.statA.statToProve.value}, Away: ${proof.statB.statToProve.value}`);
  console.log(`[Proof] FixtureProof nodes: ${proof.fixtureProof.length}`);
  console.log(`[Proof] MainTreeProof nodes: ${proof.mainTreeProof.length}`);
  console.log(`[Proof] TargetTs: ${proof.targetTs} (${new Date(proof.targetTs).toISOString()})`);

  const { pda: dailyScoresPda, epochDay } = ProofFetcher.deriveDailyScoresPda(
    proof.targetTs,
    TXLINE_PROGRAM_ID
  );
  console.log(`[Proof] Epoch day: ${epochDay}`);
  console.log(`[Proof] DailyScores PDA: ${dailyScoresPda}`);

  // ─── Step 3: settle_market ──────────────
  console.log("\n[Step 3] Submitting settle_market with CPI proof...");

  const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

  const txlineProgramPk = new PublicKey(TXLINE_PROGRAM_ID);

  // Build proof args matching contract types
  const targetTsBn = new anchor.BN(proof.targetTs);

  const fixtureSummary = {
    fixtureId: new anchor.BN(proof.fixtureSummary.fixtureId),
    updateStats: {
      updateCount: proof.fixtureSummary.updateStats.updateCount,
      minTimestamp: new anchor.BN(proof.fixtureSummary.updateStats.minTimestamp),
      maxTimestamp: new anchor.BN(proof.fixtureSummary.updateStats.maxTimestamp),
    },
    eventsSubTreeRoot: proof.fixtureSummary.eventsSubTreeRoot as any,
  };

  const fixtureProof = proof.fixtureProof.map((n) => ({
    hash: n.hash,
    isRightSibling: n.isRightSibling,
  }));

  const mainTreeProof = proof.mainTreeProof.map((n) => ({
    hash: n.hash,
    isRightSibling: n.isRightSibling,
  }));

  const statA = {
    statToProve: {
      key: proof.statA.statToProve.key,
      value: proof.statA.statToProve.value,
      period: proof.statA.statToProve.period,
    },
    eventStatRoot: proof.statA.eventStatRoot as any,
    statProof: proof.statA.statProof.map((n) => ({
      hash: n.hash,
      isRightSibling: n.isRightSibling,
    })),
  };

  const statB = {
    statToProve: {
      key: proof.statB.statToProve.key,
      value: proof.statB.statToProve.value,
      period: proof.statB.statToProve.period,
    },
    eventStatRoot: proof.statB.eventStatRoot as any,
    statProof: proof.statB.statProof.map((n) => ({
      hash: n.hash,
      isRightSibling: n.isRightSibling,
    })),
  };

  try {
    // Build transaction manually for skipPreflight support
    const ix = await program.methods
      .settleMarket(
        targetTsBn,
        fixtureSummary as any,
        fixtureProof as any,
        mainTreeProof as any,
        statA as any,
        statB as any
      )
      .accounts({
        market: MARKET_PDA,
        dailyScoresMerkleRoots: new PublicKey(dailyScoresPda),
        txlineProgram: txlineProgramPk,
      })
      .instruction();

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const tx = new anchor.web3.Transaction({
      feePayer: wallet.publicKey,
      blockhash,
      lastValidBlockHeight: undefined as any,
    }).add(computeIx, ix);
    
    // Sign and send
    tx.sign(keypair);
    const settleTx = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });
    
    console.log(`[Step 3] ✅ TX sent: ${settleTx}`);
    console.log(`[Step 3] 🔗 https://explorer.solana.com/tx/${settleTx}?cluster=devnet`);
    
    // Wait for confirmation
    await new Promise(r => setTimeout(r, 15000));
    const result = await connection.getTransaction(settleTx, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    
    if (result?.meta?.err) {
      console.error(`[Step 3] ❌ On-chain error: ${JSON.stringify(result.meta.err)}`);
      const logs = result.meta.logMessages || [];
      console.error(`[Step 3] Logs:\n${logs.join("\n")}`);
    } else {
      console.log(`[Step 3] ✅ Confirmed!`);
    }

    // ─── Verify ────────────────────────────
    await new Promise(r => setTimeout(r, 3000));
    const updated = await program.account.market.fetch(MARKET_PDA);
    console.log("\n[Verify] Final Market State:");
    console.log(`  Status: ${Object.keys(updated.status)[0]}`);
    console.log(`  Winning Option: ${updated.winningOption} (${updated.winningOption === 0 ? 'YES' : updated.winningOption === 1 ? 'NO' : 'Unset'})`);
    console.log(`  Settlement TS: ${new Date(updated.settlementTs.toNumber() * 1000).toISOString()}`);
    
    const winner = updated.winningOption === 0 ? "YES (Spain wins → NOT a draw)" : "NO (draw)";
    console.log(`  Result: Spain 2-1 Belgium → ${winner}`);

    console.log("\n═══════════════════════════════════════════");
    console.log(" ✅ SETTLEMENT COMPLETE — TRUSTLESS CPI");
    console.log("═══════════════════════════════════════════");
  } catch (err: any) {
    console.error(`[Step 3] ❌ Settlement failed!`);
    console.error(`  Error: ${err.message}`);
    if (err.logs) {
      console.error(`  Logs:\n${err.logs.join("\n")}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
