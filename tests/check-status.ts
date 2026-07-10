import { Connection } from "@solana/web3.js";
import * as crypto from "crypto";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
const conn = new Connection("https://api.devnet.solana.com", "confirmed");

const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8"))));
const wallet = new anchor.Wallet(kp);
const idl = JSON.parse(fs.readFileSync(path.resolve("target/idl/fulltime.json"), "utf-8"));
const provider = new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);
const prog = new anchor.Program(idl, provider) as any;

const QF = [18209181, 18218149, 18213979, 18222446];

// Get ALL market accounts using raw RPC
async function main() {
  const disc = crypto.createHash("sha256").update("account:Market").digest().slice(0, 8);
  const discB58 = require("bs58").encode(disc);
  const resp = await (conn as any)._rpcRequest("getProgramAccounts", [
    PROGRAM_ID,
    { commitment: "confirmed", encoding: "base64",
      filters: [{ memcmp: { offset: 0, bytes: discB58 } }] },
  ]);

  // Fetch each market individually using Anchor
  let nonQf = 0, open = 0, closed = 0, cancelled = 0, settled = 0;
  const statusMap: Record<string, number> = {};
  for (const r of (resp.result || [])) {
    const pk = new PublicKey(r.pubkey);
    let acct;
    try {
      acct = await prog.account.market.fetch(pk);
    } catch { continue; }
    const fixt = Number(acct.fixtureId);
    const isQf = QF.some(q => fixt >= q && fixt < q + 1_000_000);
    if (isQf) continue;
    nonQf++;

    const s = Object.keys(acct.status)[0];
    if (s === "open") open++;
    else if (s === "closed") closed++;
    else if (s === "cancelled") cancelled++;
    else if (s === "settled") settled++;
    
    if (!statusMap[s]) statusMap[s] = 0;
    statusMap[s]++;

    if (fixt >= 20000000 || fixt === 0) {
      const q = acct.question.slice(0, 60);
      console.log(`#${fixt} [${s}] "${q}"  creator=${acct.creator.toString().slice(0, 8)}`);
    }
  }
  console.log(`\nNon-QF markets: ${nonQf}`);
  console.log("Status breakdown:", statusMap);
  console.log(`Open: ${open}, Closed: ${closed}, Cancelled: ${cancelled}, Settled: ${settled}`);
}
main();
