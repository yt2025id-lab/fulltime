/**
 * Claim payout from already-settled market + settlement report
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

async function main() {
  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));
  const wallet = new anchor.Wallet(keypair);

  const PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../target/idl/fulltime.json"), "utf-8"));
  const program = new anchor.Program(idl, provider);

  const MARKET_PDA = "43GuvVPgV5Cxs6car1HXCTVKHLFiSb4wwA8S4tDkPBtw";
  const marketPk = new PublicKey(MARKET_PDA);

  console.log("═══════════════════════════════════════════════");
  console.log("  FullTime — Settlement & Payout Report");
  console.log("═══════════════════════════════════════════════\n");

  // Read market state
  const market = await program.account.market.fetch(marketPk);
  const statusStr = Object.keys(market.status)[0];
  const winner = market.winningOption === 0 ? "YES" : "NO";
  const yesPool = market.poolYes.toNumber();
  const noPool = market.poolNo.toNumber();
  const totalPool = market.totalPool.toNumber();
  const feeBps = market.feeBps;

  console.log(`  Market: "${market.question}"`);
  console.log(`  Status: ${statusStr}`);
  console.log(`  Winner: ${winner}`);
  console.log(`  Pool YES: ${yesPool / 1e9} SOL`);
  console.log(`  Pool NO:  ${noPool / 1e9} SOL`);
  console.log(`  Total:    ${totalPool / 1e9} SOL`);
  console.log(`  Fee: ${feeBps / 100}%`);
  console.log(`  Settled: ${new Date(market.settlementTs.toNumber() * 1000).toISOString()}`);

  // Derive bet PDA
  const [betPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), marketPk.toBytes(), wallet.publicKey.toBytes()],
    new PublicKey(PROGRAM_ID)
  );

  // Try to read bet
  try {
    const betAcc = await program.account.bet.fetch(betPda);
    
    console.log(`\n  Your Bet:`);
    console.log(`  Option: ${betAcc.optionIndex === 0 ? 'YES' : 'NO'}`);
    console.log(`  Amount: ${betAcc.amount.toNumber() / 1e9} SOL`);
    console.log(`  Claimed: ${betAcc.claimed}`);

    const betAmount = betAcc.amount.toNumber();
    const winningPool = betAcc.optionIndex === 0 ? yesPool : noPool;

    if (betAcc.optionIndex === market.winningOption && !betAcc.claimed) {
      // Calculate payout
      const grossPayout = BigInt(betAmount) * BigInt(totalPool) / BigInt(winningPool);
      const fee = grossPayout * BigInt(feeBps) / 10000n;
      const netPayout = grossPayout - fee;

      console.log(`\n  ╔══════════════════════════════════╗`);
      console.log(`  ║  PAYOUT REPORT                  ║`);
      console.log(`  ╠══════════════════════════════════╣`);
      console.log(`  ║  Bet:          ${(betAmount/1e9).toFixed(4)} SOL        ║`);
      console.log(`  ║  Gross Payout: ${(Number(grossPayout)/1e9).toFixed(4)} SOL        ║`);
      console.log(`  ║  Fee (${feeBps/100}%):     -${(Number(fee)/1e9).toFixed(4)} SOL       ║`);
      console.log(`  ║  ───────────────────────── ║`);
      console.log(`  ║  ⭐ NET:       ${(Number(netPayout)/1e9).toFixed(4)} SOL        ║`);
      console.log(`  ║  Profit:      ${((Number(netPayout)-betAmount)/1e9).toFixed(4)} SOL        ║`);
      console.log(`  ╚══════════════════════════════════╝`);

      console.log(`\n[CLAIM] Claiming payout...`);
      const tx = await program.methods
        .claimPayout()
        .accounts({
          bettor: wallet.publicKey,
          market: marketPk,
          bet: betPda,
        })
        .rpc();
      console.log(`  ✅ Claimed! TX: ${tx.slice(0, 48)}...`);
      console.log(`  🔗 https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
    } else if (betAcc.claimed) {
      console.log(`\n  ✅ Already claimed!`);
    } else {
      console.log(`\n  ❌ Your bet (${betAcc.optionIndex === 0 ? 'YES' : 'NO'}) lost. Winner is ${winner}.`);
    }
  } catch (e: any) {
    console.log(`  No bet found for this wallet at this market`);
  }

  // Balance check
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`  Wallet Balance: ${balance / 1e9} SOL`);
  console.log(`  Wallet: ${wallet.publicKey.toBase58()}`);
}

main().catch(e => console.error("Fatal:", e.message));
