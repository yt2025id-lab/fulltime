import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const mainKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8"))));

let altKp: Keypair | null = null;
try {
  altKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync("/tmp/market-creator.json", "utf-8"))));
} catch {}

const wallets: Record<string, anchor.Wallet> = {
  [mainKp.publicKey.toBase58()]: new anchor.Wallet(mainKp),
};
if (altKp) wallets[altKp.publicKey.toBase58()] = new anchor.Wallet(altKp);

const idl = JSON.parse(fs.readFileSync(path.resolve("target/idl/fulltime.json"), "utf-8"));
const getProgram = (wallet: anchor.Wallet) => {
  const provider = new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  return new anchor.Program(idl, provider) as any;
};

async function main() {
  const disc = crypto.createHash("sha256").update("account:Market").digest().slice(0, 8);
  const discB58 = require("bs58").encode(disc);
  const resp = await (conn as any)._rpcRequest("getProgramAccounts", [
    PROGRAM_ID,
    { commitment: "confirmed", encoding: "base64", filters: [{ memcmp: { offset: 0, bytes: discB58 } }] },
  ]);

  interface M { pubkey: string; fixtureId: number; question: string; creator: string; status: number; }
  const markets: M[] = [];

  for (const r of (resp.result || [])) {
    const data = Uint8Array.from(atob(r.account.data[0]), c => c.charCodeAt(0));
    const readU64 = (o: number) => Number(new DataView(data.buffer.slice(data.byteOffset + o, data.byteOffset + o + 8)).getBigUint64(0, true));
    const readU32 = (o: number) => new DataView(data.buffer.slice(data.byteOffset + o, data.byteOffset + o + 4)).getUint32(0, true);
    let off = 8;
    const fid = readU64(off); off += 8;
    const qLen = readU32(off); off += 4;
    const question = new TextDecoder().decode(data.slice(off, off + qLen)); off += qLen;
    const creator = new PublicKey(data.slice(off, off + 32)).toBase58(); off += 32;
    off += 1; // outcome_count
    off += 8; // total_pool
    off += 8; // pool_yes
    off += 8; // pool_no
    off += 8; // betting_open_time
    off += 8; // betting_close_time
    const status = data[off];
    if (status === 4) continue; // already cancelled
    if (status === 3) continue; // settled
    markets.push({ pubkey: r.pubkey, fixtureId: fid, question: question.slice(0, 50), creator, status });
  }

  if (markets.length === 0) { console.log("No cancellable markets."); return; }

  const name = ["pending", "open", "closed"];
  console.log(`\n${markets.length} markets to cancel:\n`);
  for (const m of markets) {
    console.log(`  #${m.fixtureId} [${name[m.status]}] ${m.creator === mainKp.publicKey.toBase58() ? "(main)" : "(alt)"} ${m.question}`);
  }

  console.log("\n--- Cancelling ---\n");
  let ok = 0, fail = 0, skip = 0;
  for (const m of markets) {
    const wallet = wallets[m.creator];
    if (!wallet) { console.log(`  SKIP #${m.fixtureId}: not our wallet`); skip++; continue; }
    const prog = getProgram(wallet);
    try {
      await prog.methods.cancelMarket()
        .accounts({ creator: wallet.publicKey, market: new PublicKey(m.pubkey) })
        .signers([wallet.payer as Keypair])
        .rpc();
      console.log(`  ✅ #${m.fixtureId} "${m.question}"`);
      ok++;
    } catch (e: any) {
      console.log(`  ❌ #${m.fixtureId}: ${e.message.slice(0, 80)}`);
      fail++;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`\n✅ ${ok}  |  ❌ ${fail}  |  SKIP ${skip}`);
}

main().catch(e => console.error("Fatal:", e.message));
