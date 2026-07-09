/**
 * Create 18 markets for WC2026 QF: 1 trustless + 5 manual per match
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
const connection = new Connection(RPC, "confirmed");

interface Match {
  fixtureId: number;
  home: string;
  away: string;
  start: string;
}

const MATCHES: Match[] = [
  { fixtureId: 18218149, home: "Spain", away: "Belgium", start: "Jul 10 19:00 UTC" },
  { fixtureId: 18213979, home: "Norway", away: "England", start: "Jul 11 21:00 UTC" },
  { fixtureId: 18222446, home: "Argentina", away: "Switzerland", start: "Jul 12 01:00 UTC" },
];

/**
 * Generate 6 Yes/No questions per match.
 * [0] = trustless, [1-5] = manual
 */
function questions(home: string, away: string): string[] {
  return [
    `Will ${home} beat ${away}?`,           // TRUSTLESS
    `Will ${away} beat ${home}?`,           // manual
    `Will the match end in a draw?`,         // manual
    `Will both teams score?`,                // manual
    `Will total goals be over 2.5?`,         // manual
    `Will ${home} score first?`,             // manual
  ];
}

function statusBar(created: number, skipped: number, total: number) {
  const pct = Math.round((created + skipped) / total * 20);
  const bar = "█".repeat(Math.max(0, pct)) + "░".repeat(Math.max(0, 20 - pct));
  return `[${bar}] ${created + skipped}/${total}`;
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Create 18 Markets — WC2026 QF");
  console.log("  1 Trustless + 5 Manual per Match");
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
  const now = Math.floor(Date.now() / 1000);

  let created = 0, skipped = 0;

  for (const match of MATCHES) {
    const qs = questions(match.home, match.away);

    for (let qi = 0; qi < qs.length; qi++) {
      const question = qs[qi];
      const isTrustless = qi === 0;
      const usedId = isTrustless ? match.fixtureId : match.fixtureId + 1_000_000 + qi;

      const fidBuf = Buffer.alloc(8);
      fidBuf.writeBigUInt64LE(BigInt(usedId));

      const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), progPk.toBuffer(), wallet.publicKey.toBuffer(), fidBuf],
        progPk
      );

      let exists = false;
      try { if (await connection.getAccountInfo(marketPda)) exists = true; } catch {}

      if (exists) {
        console.log(`  ${isTrustless ? "⚡" : "·"} [${match.home} vs ${match.away}] q${qi}: SKIP "${question}"`);
        skipped++;
        continue;
      }

      const openTime = now + 10;
      const closeTime = match.fixtureId === 18209181 ? now + 60 : now + 86400;

      try {
        const tx = await p.methods
          .createMarket(new anchor.BN(usedId), question, new anchor.BN(openTime), new anchor.BN(closeTime), isTrustless)
          .accounts({ market: marketPda, creator: wallet.publicKey, systemProgram: SystemProgram.programId })
          .signers([keypair])
          .rpc();
        const tag = isTrustless ? "⚡TRUSTLESS" : "manual";
        console.log(`  ${isTrustless ? "⚡" : "·"} [${match.home} vs ${match.away}] q${qi}: "${question}"`);
        console.log(`    ${tag} | PDA: ${marketPda.toBase58().slice(0, 10)}... | TX: ${tx.slice(0, 8)}...`);
        created++;
      } catch (err: any) {
        console.log(`  ❌ q${qi} failed: ${err.message.slice(0, 80)}`);
      }
    }
    console.log(`  ${statusBar(0, 0, qs.length)} ─── ${match.home} vs ${match.away}`);
  }

  console.log(`\n✅ Created: ${created}  |  Skipped: ${skipped}  |  Total: ${created + skipped}`);
  console.log(`SOL left: ${(await connection.getBalance(wallet.publicKey) / 1e9).toFixed(4)}`);
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
