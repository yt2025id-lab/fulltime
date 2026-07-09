/**
 * Create proper Yes/No trustless markets using a fresh wallet (different PDA)
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import axios from "axios";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
const KEYPAIR_PATH = "/tmp/market-creator.json";
const connection = new Connection(RPC, "confirmed");

// Load TxLINE creds
function loadEnv() {
  const envPath = path.resolve(__dirname, "../relay-service/.env");
  const raw = fs.readFileSync(envPath, "utf-8");
  const m: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) m[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return m;
}

async function getFixtures(env: Record<string, string>) {
  const res = await axios.get("https://txline-dev.txodds.com/api/fixtures/snapshot", {
    headers: { Authorization: `Bearer ${env.TXLINE_JWT}`, "X-Api-Token": env.TXLINE_API_TOKEN },
  });
  return res.data as any[];
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Create Proper Yes/No Markets");
  console.log("═══════════════════════════════════════\n");

  const sk = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(sk));
  const wallet = new anchor.Wallet(keypair);
  console.log(`New Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`SOL: ${(await connection.getBalance(wallet.publicKey) / 1e9).toFixed(4)}\n`);

  const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../target/idl/fulltime.json"), "utf-8"));
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const p = new anchor.Program(idl, provider) as any;
  const progPk = new PublicKey(PROGRAM_ID);
  const env = loadEnv();
  const fixtures = await getFixtures(env);
  const wc = fixtures.filter((f: any) => f.Competition?.toLowerCase().includes("world cup") || f.CompetitionId === 72);

  console.log(`WC2026 fixtures: ${wc.length}\n`);
  const now = Math.floor(Date.now() / 1000);
  let created = 0;

  for (const f of wc) {
    const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
    const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
    const startTime = f.StartTime ? new Date(f.StartTime).toISOString().slice(0, 16) : "?";

    const fidBuf = Buffer.alloc(8);
    fidBuf.writeBigUInt64LE(BigInt(f.FixtureId));
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), progPk.toBuffer(), wallet.publicKey.toBuffer(), fidBuf], progPk
    );

    // Check if already exists for this wallet
    let exists = false;
    try { if (await connection.getAccountInfo(marketPda)) exists = true; } catch {}
    if (exists) { console.log(`  #${f.FixtureId} ${home} vs ${away} — SKIP`); continue; }

    // Proper Yes/No question
    const question = `Will ${home} beat ${away}?`;

    try {
      const tx = await p.methods
        .createMarket(new anchor.BN(f.FixtureId), question, new anchor.BN(now + 10), new anchor.BN(now + 86400), true)
        .accounts({ market: marketPda, creator: wallet.publicKey, systemProgram: SystemProgram.programId })
        .signers([keypair])
        .rpc();
      console.log(`  #${f.FixtureId} ${home} vs ${away} → ✅ "${question}"`);
      console.log(`       ${startTime} | TX: ${tx.slice(0, 12)}...`);
      created++;
    } catch (err: any) {
      console.log(`  #${f.FixtureId} ${home} vs ${away} → ❌ ${err.message.slice(0, 100)}`);
    }
  }

  console.log(`\n✅ Created: ${created} new markets with proper Yes/No questions`);
  console.log(`Creator: ${wallet.publicKey.toBase58()}`);
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
