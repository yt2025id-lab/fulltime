/**
 * E2E Demo: Market Creation → Betting → Settlement → Payout
 * Spain vs Belgium — "Will the match end in a draw?" → YES wins (Spain 2-1)
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
const RPC_URL = "https://api.devnet.solana.com";

function sol(n: number): anchor.BN {
  return new anchor.BN(n * LAMPORTS_PER_SOL);
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  FullTime E2E Demo: Spain vs Belgium");
  console.log("  Market → Bet → Close → Resolve → Claim");
  console.log("═══════════════════════════════════════════════\n");

  // ─── Setup ──────────────────────────────
  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));
  const wallet = new anchor.Wallet(keypair);
  console.log(`[Wallet] ${wallet.publicKey.toBase58()}`);

  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idlPath = path.resolve(__dirname, "../../target/idl/fulltime.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new anchor.Program(idl, provider);

  const now = Math.floor(Date.now() / 1000);
  const betOpenTime = new anchor.BN(now + 2);    // open in 2 seconds
  const betCloseTime = new anchor.BN(now + 35);  // close in 35 seconds
  const isTrustless = false;

  const fixtureId = new anchor.BN(99918218149); // unique ID to avoid PDA collision
  const question = "Spain vs Belgium - Will it end in a draw?";

  const [marketPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("market"),
      new PublicKey(PROGRAM_ID).toBytes(),
      wallet.publicKey.toBytes(),
      fixtureId.toArrayLike(Buffer, "le", 8),
    ],
    new PublicKey(PROGRAM_ID)
  );
  
  console.log(`   Market PDA: ${marketPda.toBase58()}`);

  try {
    const tx = await program.methods
      .createMarket(fixtureId, question, betOpenTime, betCloseTime, isTrustless)
      .accounts({
        creator: wallet.publicKey,
        market: marketPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`   ✅ Created: ${tx}`);
  } catch (e: any) {
    if (e.message?.includes("already in use")) {
      console.log(`   ⚠️ Market already exists, using existing`);
    } else {
      console.error(`   ❌ ${e.message.slice(0, 100)}`);
      throw e;
    }
  }

  // ─── Step 2: Open Market ────────────────
  console.log("\n[2/5] OPEN MARKET");
  try {
    const marketAcc = await program.account.market.fetch(marketPda);
    if ("pending" in marketAcc.status) {
      const tx = await program.methods
        .openMarket()
        .accounts({ market: marketPda })
        .rpc();
      console.log(`   ✅ Opened: ${tx}`);
    } else {
      console.log(`   ⚠️ Already ${Object.keys(marketAcc.status)[0]}`);
    }
  } catch (e: any) {
    console.log(`   ⚠️ ${e.message.slice(0, 80)}`);
  }

  // Wait for state to settle
  await sleep(2000);

  // ─── Step 3: Place Bets ─────────────────
  console.log("\n[3/5] PLACE BETS");
  console.log("   Spain won 2-1 → NOT a draw → YES wins");

  // Bet on YES (0.15 SOL)
  const betAmount = sol(0.15);
  const [betYesPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), marketPda.toBytes(), wallet.publicKey.toBytes()],
    new PublicKey(PROGRAM_ID)
  );
  
  try {
    const tx = await program.methods
      .placeBet(0, betAmount)
      .accounts({
        bettor: wallet.publicKey,
        market: marketPda,
        bet: betYesPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`   ✅ Bet YES: 0.15 SOL — ${tx.slice(0, 48)}...`);
  } catch (e: any) {
    console.log(`   ⚠️ YES bet: ${e.message.slice(0, 80)}`);
  }

  await sleep(2000);

  // Bet on NO from a different "simulated" wallet
  // Since we only have one wallet, we'll bet NO from the same wallet
  // In a real scenario, different users would bet from their own wallets
  console.log("   Simulating: Another user bets NO (0.10 SOL)");
  
  // Create a temporary keypair for the NO bettor
  const noBettor = anchor.web3.Keypair.generate();
  
  // Fund the NO bettor with some SOL
  try {
    const airdropSig = await connection.requestAirdrop(noBettor.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSig);
    console.log(`   Airdrop 1 SOL to NO bettor: ${noBettor.publicKey.toBase58()}`);
  } catch (e: any) {
    console.log(`   ⚠️ Airdrop failed (rate limit?), using existing balance`);
  }

  await sleep(2000);

  const [betNoPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), marketPda.toBytes(), noBettor.publicKey.toBytes()],
    new PublicKey(PROGRAM_ID)
  );

  try {
    const tx = await program.methods
      .placeBet(1, sol(0.10))
      .accounts({
        bettor: noBettor.publicKey,
        market: marketPda,
        bet: betNoPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([noBettor])
      .rpc();
    console.log(`   ✅ Bet NO: 0.10 SOL — ${tx.slice(0, 48)}...`);
  } catch (e: any) {
    console.log(`   ⚠️ NO bet: ${e.message.slice(0, 80)}`);
  }

  await sleep(2000);

  // Also bet NO from relay wallet (to simulate more NO bettors)
  const [betNo2Pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), marketPda.toBytes(), wallet.publicKey.toBytes()],
    new PublicKey(PROGRAM_ID)
  );
  // We already have betYesPda for wallet.publicKey, so we can't bet NO from same wallet
  // (PDA seeds include bettor, so different option from same bettor creates same PDA)
  console.log("   ℹ Skipping 2nd NO bet (same wallet PDAs collide)");

  // ─── Read current pool state ────────────
  await sleep(2000);
  const preMarket = await program.account.market.fetch(marketPda);
  console.log(`   📊 Pool: YES ${preMarket.poolYes.toNumber()/1e9} SOL | NO ${preMarket.poolNo.toNumber()/1e9} SOL`);
  console.log(`   📊 Total pool: ${preMarket.totalPool.toNumber()/1e9} SOL`);

  // ─── Step 4: Close Betting ──────────────
  console.log("\n[4/5] CLOSE BETTING");
  const waitUntil = Number(betCloseTime) * 1000;
  const waitMs = Math.max(0, waitUntil - Date.now() + 3000);
  if (waitMs > 0) {
    console.log(`   Waiting ${waitMs/1000}s for betting close time...`);
    await sleep(waitMs);
  }

  try {
    const tx = await program.methods
      .closeBetting()
      .accounts({ market: marketPda })
      .rpc();
    console.log(`   ✅ Closed: ${tx}`);
  } catch (e: any) {
    console.log(`   ⚠️ ${e.message.slice(0, 80)}`);
  }

  await sleep(2000);

  // ─── Step 5: Resolve Market ─────────────
  console.log("\n[5/5] RESOLVE MARKET — Spain won 2-1 → NOT a draw → YES");
  console.log("   Creator resolves: outcome = true (YES wins)");

  try {
    const tx = await program.methods
      .resolveMarket(true) // true = YES wins
      .accounts({
        creator: wallet.publicKey,
        market: marketPda,
      })
      .rpc();
    console.log(`   ✅ Resolved! TX: ${tx}`);
    console.log(`   🔗 https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  } catch (e: any) {
    console.error(`   ❌ ${e.message}`);
    if (e.logs) console.error(`   Logs: ${e.logs.slice(-5).join("\n")}`);
    throw e;
  }

  await sleep(2000);

  // ─── Verify ─────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("  SETTLEMENT REPORT");
  console.log("═══════════════════════════════════════════════");

  const finalMarket = await program.account.market.fetch(marketPda);
  
  const statusStr = Object.keys(finalMarket.status)[0];
  const winner = finalMarket.winningOption === 0 ? "YES" : "NO";
  const yesPool = finalMarket.poolYes.toNumber();
  const noPool = finalMarket.poolNo.toNumber();
  const totalPool = finalMarket.totalPool.toNumber();

  console.log(`  Market: "${question}"`);
  console.log(`  Fixture ID: ${finalMarket.fixtureId.toString()}`);
  console.log(`  Status: ${statusStr}`);
  console.log(`  Winner: ${winner}`);
  console.log(`  Pool YES: ${yesPool / 1e9} SOL`);
  console.log(`  Pool NO: ${noPool / 1e9} SOL`);
  console.log(`  Total Pool: ${totalPool / 1e9} SOL`);
  console.log(`  Settlement Time: ${new Date(finalMarket.settlementTs.toNumber() * 1000).toISOString()}`);

  // Payout calculation
  const feeBps = finalMarket.feeBps; // 200 = 2%
  console.log(`  Platform Fee: ${feeBps / 100}%`);

  if (finalMarket.winningOption === 0) {
    // YES won — calculate YES bettor payout
    const myBetAmount = sol(0.15).toNumber();
    const grossPayout = BigInt(myBetAmount) * BigInt(totalPool) / BigInt(yesPool);
    const fee = grossPayout * BigInt(feeBps) / 10000n;
    const netPayout = grossPayout - fee;
    
    console.log(`\n  PAYOUT REPORT (YES bettor):`);
    console.log(`  Bet: ${myBetAmount / 1e9} SOL`);
    console.log(`  Winning Pool: ${yesPool / 1e9} SOL`);
    console.log(`  Gross Payout: ${Number(grossPayout) / 1e9} SOL`);
    console.log(`  Fee (${feeBps/100}%): ${Number(fee) / 1e9} SOL`);
    console.log(`  ⭐ Net Payout: ${Number(netPayout) / 1e9} SOL`);
    console.log(`  Profit: ${(Number(netPayout) - myBetAmount) / 1e9} SOL`);
    
    // Claim payout
    console.log(`\n[CLAIM] Claiming payout for YES bettor...`);
    try {
      const tx = await program.methods
        .claimPayout()
        .accounts({
          bettor: wallet.publicKey,
          market: marketPda,
          bet: betYesPda,
        })
        .rpc();
      console.log(`  ✅ Claimed! TX: ${tx}`);
      console.log(`  🔗 https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    } catch (e: any) {
      console.log(`  ⚠️ ${e.message.slice(0, 80)}`);
    }
  }

  console.log(`\n  Market PDA: ${marketPda.toBase58()}`);
  console.log(`  Explorer: https://explorer.solana.com/address/${marketPda.toBase58()}?cluster=devnet`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal:", err.message || err);
  process.exit(1);
});
