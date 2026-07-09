/**
 * Create trustless markets for WC2026 Quarterfinals on devnet
 *
 * Run: npx ts-node tests/create-trustless-markets.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";

const connection = new Connection(RPC, "confirmed");

// WC2026 Quarterfinal fixtures
const FIXTURES = [
  { id: 18209181, question: "France vs Morocco - Who wins?", home: "France", away: "Morocco" },
  { id: 18218149, question: "Spain vs Belgium - Who wins?", home: "Spain", away: "Belgium" },
  { id: 18213979, question: "Norway vs England - Who wins?", home: "Norway", away: "England" },
  { id: 18222446, question: "Argentina vs Switzerland - Who wins?", home: "Argentina", away: "Switzerland" },
];

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Create Trustless Markets");
  console.log("═══════════════════════════════════════\n");

  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const sk = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(sk));
  const wallet = new anchor.Wallet(keypair);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  const bal = await connection.getBalance(wallet.publicKey);
  console.log(`SOL: ${bal / 1e9}`);

  // Load IDL
  const idlPath = path.resolve(__dirname, "../target/idl/fulltime.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(idl, provider) as any;
  const programId = new PublicKey(PROGRAM_ID);

  const now = Math.floor(Date.now() / 1000);
  const openTime = now + 10;
  const closeTime = now + 300;

  for (const f of FIXTURES) {
    console.log(`\n── ${f.home} vs ${f.away} (#${f.id}) ──`);

    const fixtureIdLe = new anchor.BN(f.id).toArrayLike(Buffer, "le", 8);
    const [marketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        programId.toBuffer(),
        wallet.publicKey.toBuffer(),
        fixtureIdLe,
      ],
      programId
    );

    // Check if market already exists
    try {
      const marketData = await connection.getAccountInfo(marketPda);
      if (marketData) {
        console.log(`  Market already exists: ${marketPda.toBase58().slice(0, 12)}...`);
        continue;
      }
    } catch {}

    console.log(`  Creating market...`);
    const tx = await program.methods
      .createMarket(
        new anchor.BN(f.id),
        f.question,
        new anchor.BN(openTime),
        new anchor.BN(closeTime),
        true  // is_trustless = true
      )
      .accounts({
        market: marketPda,
        creator: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([keypair])
      .rpc();

    console.log(`  ✅ Market created!`);
    console.log(`     PDA: ${marketPda.toBase58()}`);
    console.log(`     TX: ${tx}`);
    console.log(`     Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  }

  console.log("\n═══════════════════════════════════════");
  console.log("  ✅ All markets created!");
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
