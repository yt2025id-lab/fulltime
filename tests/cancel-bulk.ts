/**
 * Cancel ALL markets that aren't related to the 4 WC2026 QF matches
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
const connection = new Connection(RPC, "confirmed");

// 4 QF fixtures
const QF = [18209181, 18218149, 18213979, 18222446];

function isRelevant(fixtureId: number): boolean {
  return QF.some(q => fixtureId >= q && fixtureId < q + 1_000_000);
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Cancel Irrelevant Markets");
  console.log("═══════════════════════════════════════\n");

  // Load IDL
  const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../target/idl/fulltime.json"), "utf-8"));
  const progPk = new PublicKey(PROGRAM_ID);
  const crypto = require("crypto");
  const discriminator = crypto.createHash("sha256").update("account:Market").digest().slice(0, 8);
  const discB58 = require("bs58").encode(discriminator);

  // Get ALL markets
  const resp = await (connection as any)._rpcRequest("getProgramAccounts", [
    PROGRAM_ID,
    { commitment: "confirmed", encoding: "base64",
      filters: [{ memcmp: { offset: 0, bytes: discB58 } }] },
  ]);
  const results = resp.result || [];

  console.log(`Total markets: ${results.length}`);

  // Decode all
  const markets: { pubkey: string; fixtureId: number; question: string; creator: string; status: number }[] = [];
  for (const r of results) {
    const data = Uint8Array.from(atob(r.account.data[0]), c => c.charCodeAt(0));
    const readU64 = (o: number) => Number(new DataView(data.buffer.slice(data.byteOffset + o, data.byteOffset + o + 8)).getBigUint64(0, true));
    const readU32 = (o: number) => new DataView(data.buffer.slice(data.byteOffset + o, data.byteOffset + o + 4)).getUint32(0, true);
    let off = 8;
    const fixtureId = readU64(off); off += 8;
    const qLen = readU32(off); off += 4;
    const question = new TextDecoder().decode(data.slice(off, off + qLen)); off += qLen;
    const creator = new PublicKey(data.slice(off, off + 32)).toBase58(); off += 32;
    off += 1 + 8 + 8 + 8 + 8 + 8;
    const status = data[off];

    if (status === 4) continue; // already cancelled

    const relevant = isRelevant(fixtureId);
    markets.push({ pubkey: r.pubkey, fixtureId, question, creator, status });
    if (!relevant) {
      console.log(`  ❌ [${creator.slice(0, 8)}] #${fixtureId} "${question.slice(0, 50)}"`);
    }
  }

  const toCancel = markets.filter(m => !isRelevant(m.fixtureId));
  console.log(`\nTo cancel: ${toCancel.length}/${markets.length}`);

  // Load both wallets
  const mainKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
    fs.readFileSync(path.resolve(process.env.HOME || "~", ".config/solana/id.json"), "utf-8")
  )));
  const altKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
    fs.readFileSync("/tmp/market-creator.json", "utf-8")
  )));
  const wallets = {
    [mainKp.publicKey.toBase58()]: new anchor.Wallet(mainKp),
    [altKp.publicKey.toBase58()]: new anchor.Wallet(altKp),
  };

  const getProgram = (wallet: anchor.Wallet) => {
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);
    return new anchor.Program(idl, provider) as any;
  };

  let cancelled = 0, failed = 0;

  for (const m of toCancel) {
    const wallet = wallets[m.creator];
    if (!wallet) { console.log(`  SKIP #${m.fixtureId}: not our wallet`); failed++; continue; }

    const p = getProgram(wallet);
    try {
      await p.methods.cancelMarket()
        .accounts({ creator: wallet.publicKey, market: new PublicKey(m.pubkey) })
        .signers([wallet.payer as Keypair])
        .rpc();
      cancelled++;
      if (cancelled % 5 === 0) console.log(`  Cancelled ${cancelled}/${toCancel.length}...`);
    } catch (e: any) {
      console.log(`  FAIL #${m.fixtureId}: ${e.message.slice(0, 60)}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n✅ Cancelled: ${cancelled}  |  Failed: ${failed}`);
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
