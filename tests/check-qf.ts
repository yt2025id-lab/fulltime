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
const NAMES = ["France vs Morocco", "Spain vs Belgium", "Norway vs England", "Argentina vs Switzerland"];

async function main() {
  const disc = crypto.createHash("sha256").update("account:Market").digest().slice(0, 8);
  const discB58 = require("bs58").encode(disc);
  const resp = await (conn as any)._rpcRequest("getProgramAccounts", [
    PROGRAM_ID,
    { commitment: "confirmed", encoding: "base64",
      filters: [{ memcmp: { offset: 0, bytes: discB58 } }] },
  ]);

  let qfCount = 0;
  for (const r of (resp.result || [])) {
    const pk = new PublicKey(r.pubkey);
    let acct;
    try {
      acct = await prog.account.market.fetch(pk);
    } catch { continue; }
    const fixt = Number(acct.fixtureId);
    const isQf = QF.some(q => fixt >= q && fixt < q + 1_000_000);
    if (!isQf) continue;
    qfCount++;

    const s = Object.keys(acct.status)[0];
    const matchIdx = QF.findIndex(q => fixt >= q && fixt < q + 1_000_000);
    const matchName = NAMES[matchIdx] || "?";
    const trust = acct.isTrustless ? "TRUSTLESS" : "manual";
    const pool = Number(acct.totalPool);
    console.log(`#${fixt} [${s}] ${trust} ${matchName} — ${acct.question.slice(0, 50)}  pool=${pool}`);
  }
  console.log(`\nTotal QF markets: ${qfCount}`);
}
main();
