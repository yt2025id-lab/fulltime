/**
 * Retry failed Argentina vs Switzerland manual markets (q2-q5)
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
const connection = new Connection(RPC, "confirmed");

async function main() {
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
    fs.readFileSync(path.resolve(process.env.HOME || "~", ".config/solana/id.json"), "utf-8")
  )));
  const wallet = new anchor.Wallet(kp);
  const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../target/idl/fulltime.json"), "utf-8"));
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const p = new anchor.Program(idl, provider) as any;
  const progPk = new PublicKey(PROGRAM_ID);

  const fixtureId = 18222446;
  const qs = [
    "Will the match end in a draw?",
    "Will both teams score?",
    "Will total goals be over 2.5?",
    "Will Argentina score first?",
  ];

  for (let qi = 0; qi < qs.length; qi++) {
    const q = qs[qi];
    const usedId = fixtureId + 1_000_000 + (qi + 2);
    const fidBuf = Buffer.alloc(8);
    fidBuf.writeBigUInt64LE(BigInt(usedId));
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), progPk.toBuffer(), wallet.publicKey.toBuffer(), fidBuf], progPk
    );

    if (await connection.getAccountInfo(pda)) { console.log(`  SKIP: "${q}"`); continue; }

    const now = Math.floor(Date.now() / 1000);
    try {
      const tx = await p.methods
        .createMarket(new anchor.BN(usedId), q, new anchor.BN(now + 30), new anchor.BN(now + 86400), false)
        .accounts({ market: pda, creator: wallet.publicKey, systemProgram: SystemProgram.programId })
        .signers([kp])
        .rpc();
      console.log(`  ✅ "${q}" | ${tx.slice(0, 8)}...`);
    } catch (e: any) { console.log(`  ❌ "${q}" — ${e.message.slice(0, 100)}`); }
    await new Promise(r => setTimeout(r, 3000));
  }
  console.log(`\nSOL: ${(await connection.getBalance(wallet.publicKey) / 1e9).toFixed(4)}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
