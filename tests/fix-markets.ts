/**
 * Fix markets: delete old test markets, create proper Yes/No binary for each WC2026 QF
 *
 * Proper format: "Will {home} beat {away}?" → YES=home wins, NO=home doesn't win
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import axios from "axios";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
const connection = new Connection(RPC, "confirmed");

// Load TxLINE creds
const env = (() => {
  const envPath = path.resolve(__dirname, "../relay-service/.env");
  const raw = fs.readFileSync(envPath, "utf-8");
  const m: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k) m[k.trim()] = v.join("=").trim();
  }
  return m;
})();

async function getFixtures() {
  const res = await axios.get("https://txline-dev.txodds.com/api/fixtures/snapshot", {
    headers: { Authorization: `Bearer ${env.TXLINE_JWT}`, "X-Api-Token": env.TXLINE_API_TOKEN },
  });
  return res.data as any[];
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Fix Markets — Proper Yes/No Binary");
  console.log("═══════════════════════════════════════\n");

  const kpPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const sk = JSON.parse(fs.readFileSync(kpPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(sk));
  const wallet = new anchor.Wallet(keypair);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`SOL: ${(await connection.getBalance(wallet.publicKey) / 1e9).toFixed(4)}\n`);

  const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../target/idl/fulltime.json"), "utf-8"));
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const p = new anchor.Program(idl, provider) as any;
  const progPk = new PublicKey(PROGRAM_ID);

  // Get WC2026 fixtures from TxLINE
  const fixtures = await getFixtures();
  const wc = fixtures.filter((f: any) =>
    f.Competition?.toLowerCase().includes("world cup") ||
    f.CompetitionId === 72
  );

  console.log(`WC2026 fixtures: ${wc.length}`);
  const now = Math.floor(Date.now() / 1000);
  let created = 0, skipped = 0;

  for (const f of wc) {
    const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
    const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
    const startTime = f.StartTime ? new Date(f.StartTime).toISOString().slice(0, 16) : "?";
    const gameState = f.GameState || "?";

    // Proper Yes/No question
    const question = `Will ${home} beat ${away}?`;

    const fidBuf = Buffer.alloc(8);
    fidBuf.writeBigUInt64LE(BigInt(f.FixtureId));

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), progPk.toBuffer(), wallet.publicKey.toBuffer(), fidBuf],
      progPk
    );

    let exists = false;
    try { const d = await connection.getAccountInfo(marketPda); if (d) exists = true; } catch {}

    if (exists) {
      console.log(`  #${f.FixtureId} ${home} vs ${away} — SKIP (exists)`);
      skipped++;
      continue;
    }

    const openTime = now + 10;
    const closeTime = now + 86400;

    try {
      const tx = await p.methods
        .createMarket(new anchor.BN(f.FixtureId), question, new anchor.BN(openTime), new anchor.BN(closeTime), true)
        .accounts({ market: marketPda, creator: wallet.publicKey, systemProgram: SystemProgram.programId })
        .signers([keypair])
        .rpc();
      console.log(`  #${f.FixtureId} ${home} vs ${away} → ✅ "${question}"`);
      console.log(`       ${startTime} | State: ${gameState} | TX: ${tx.slice(0, 12)}...`);
      created++;
    } catch (err: any) {
      console.log(`  #${f.FixtureId} ${home} vs ${away} → ❌ ${err.message.slice(0, 80)}`);
    }
  }

  console.log(`\n✅ Created: ${created}  |  Skipped: ${skipped}`);
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
