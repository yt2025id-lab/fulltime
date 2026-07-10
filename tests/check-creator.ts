import { PublicKey, Connection } from "@solana/web3.js";
import * as crypto from "crypto";
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const disc = crypto.createHash("sha256").update("account:Market").digest().slice(0, 8);
const discB58 = require("bs58").encode(disc);
(async () => {
  const resp = await (conn as any)._rpcRequest("getProgramAccounts", [
    "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x",
    { commitment: "confirmed", encoding: "base64", filters: [{ memcmp: { offset: 0, bytes: discB58 } }] },
  ]);
  for (const r of (resp.result || [])) {
    const data = Uint8Array.from(atob(r.account.data[0]), c => c.charCodeAt(0));
    let off = 8;
    const fid = Number(new DataView(data.buffer.slice(data.byteOffset + off, data.byteOffset + off + 8)).getBigUint64(0, true));
    off += 8;
    const qLen = new DataView(data.buffer.slice(data.byteOffset + off, data.byteOffset + off + 4)).getUint32(0, true);
    off += 4;
    const question = new TextDecoder().decode(data.slice(off, off + qLen));
    off += qLen;
    const creator = new PublicKey(data.slice(off, off + 32)).toBase58();
    off += 32 + 1 + 8 + 8 + 8 + 8 + 8;
    const status = data[off];
    if (fid === 18213979 && (status === 2 || status === 1)) {
      console.log("Market:", r.pubkey);
      console.log("Creator:", creator);
      console.log("Question:", question);
      console.log("Status:", status, status === 2 ? "(closed)" : "(open)");
    }
  }
})();
