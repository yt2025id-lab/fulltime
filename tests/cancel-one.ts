import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const PROGRAM_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(
  process.env.HOME + "/.config/solana/id.json", "utf-8"
))));
const wallet = new anchor.Wallet(kp);
const idl = JSON.parse(fs.readFileSync(path.resolve("target/idl/fulltime.json"), "utf-8"));
const provider = new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);
const prog = new anchor.Program(idl, provider) as any;

// Fetch SPECIFIC market account directly (no all())
async function main() {
  const disc = crypto.createHash("sha256").update("account:Market").digest().slice(0, 8);
  const discB58 = require("bs58").encode(disc);
  const resp = await (conn as any)._rpcRequest("getProgramAccounts", [
    PROGRAM_ID,
    { commitment: "confirmed", encoding: "base64",
      filters: [{ memcmp: { offset: 0, bytes: discB58 } }] },
  ]);
  for (const r of (resp.result || [])) {
    const data = Uint8Array.from(atob(r.account.data[0]), c => c.charCodeAt(0));
    const readU64 = (o: number) => Number(new DataView(data.buffer.slice(data.byteOffset + o, data.byteOffset + o + 8)).getBigUint64(0, true));
    const readU32 = (o: number) => new DataView(data.buffer.slice(data.byteOffset + o, data.byteOffset + o + 4)).getUint32(0, true);
    let off = 8;
    const fid = readU64(off); off += 8;
    const qLen = readU32(off); off += 4;
    const question = new TextDecoder().decode(data.slice(off, off + qLen)); off += qLen;
    if (fid !== 20028593) continue;

    console.log("Raw bytes length:", data.length);
    console.log("question length:", qLen);
    console.log("offset at creator:", off);

    // Now try Anchor decode
    try {
      const pk = new PublicKey(r.pubkey);
      const acct = await prog.account.market.fetch(pk);
      console.log("Anchor decode:", acct);
      console.log("Status:", acct.status);
      console.log("Creator:", acct.creator.toString());
      console.log("Is creator match?", acct.creator.toString() === wallet.publicKey.toString());
    } catch (e: any) {
      console.log("Anchor fetch error:", e.message);
      console.log("Trying decode raw...");
      // manual decode offset for status
      console.log("Raw data hex:", Buffer.from(data.slice(0, 200)).toString("hex"));
    }
    break;
  }
}
main();
