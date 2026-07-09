import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import axios from "axios";
import nacl from "tweetnacl";
import fs from "fs";
import path from "path";

const cfg = {
  apiOrigin: "https://txline-dev.txodds.com",
  rpcUrl: "https://api.devnet.solana.com",
  programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
  txlMint: "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",  // Token 2022
  usdtMint: "ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh", // Classic Token
};

const connection = new Connection(cfg.rpcUrl, "confirmed");

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  FullTime TxLINE Setup");
  console.log("═══════════════════════════════════════\n");

  // 1. Load wallet
  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const sk = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(sk));
  const wallet = new anchor.Wallet(keypair);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  const sol = await connection.getBalance(wallet.publicKey);
  console.log(`SOL: ${sol / 1e9}`);

  // 2. Guest JWT
  console.log("\n[1/6] Guest JWT...");
  const authRes = await axios.post(`${cfg.apiOrigin}/auth/guest/start`);
  const jwt = authRes.data.token;

  // 3. IDL
  console.log("[2/6] Loading IDL...");
  const idlPath = path.resolve(__dirname, "../idl/txoracle_devnet.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const txlMint = new PublicKey(cfg.txlMint);
  const usdtMint = new PublicKey(cfg.usdtMint);
  const txlineProgram = new PublicKey(cfg.programId);

  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const p = new anchor.Program(idl, provider) as any;

  // 4. ATAs
  console.log("[3/6] ATAs...");
  const txlAta = getAssociatedTokenAddressSync(txlMint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const usdtAta = getAssociatedTokenAddressSync(usdtMint, wallet.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  // TXL ATA (Token 2022)
  try {
    await getOrCreateAssociatedTokenAccount(connection, keypair, txlMint, wallet.publicKey, false, "confirmed", { commitment: "confirmed" }, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    console.log("  TXL ATA OK");
  } catch (e: any) { console.log(`  TXL ATA: ${e.message.slice(0, 80)}`); }

  // USDT ATA (classic Token)
  try {
    await getOrCreateAssociatedTokenAccount(connection, keypair, usdtMint, wallet.publicKey, false, "confirmed", { commitment: "confirmed" }, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    console.log("  USDT ATA OK");
  } catch (e: any) { console.log(`  USDT ATA: ${e.message.slice(0, 80)}`); }

  let txlBalance = 0n;
  try {
    const a = await getAccount(connection, txlAta, "confirmed", TOKEN_2022_PROGRAM_ID);
    txlBalance = a.amount;
  } catch {}
  console.log(`  TXL balance: ${txlBalance}`);

  // 5. Get TXL tokens if needed
  if (txlBalance === 0n) {
    console.log("[4/6] Getting TXL (USDT faucet → buy)...");
    const [ftPda] = PublicKey.findProgramAddressSync([Buffer.from("faucet_tracker")], txlineProgram);
    const [utPda] = PublicKey.findProgramAddressSync([Buffer.from("usdt_treasury")], txlineProgram);
    const [ttPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], txlineProgram);
    const utVault = getAssociatedTokenAddressSync(usdtMint, utPda, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const ttVault = getAssociatedTokenAddressSync(txlMint, ttPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    // Faucet (USDT = classic Token)
    try {
      const tx = await p.methods.requestDevnetFaucet().accounts({
        user: wallet.publicKey, faucetTracker: ftPda, usdtMint,
        userUsdtAta: usdtAta, usdtTreasuryPda: utPda,
        tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      }).rpc();
      console.log(`  Faucet: ${tx.slice(0, 12)}...`);
    } catch (e: any) { console.log(`  Faucet: ${e.message.slice(0, 100)}`); }

    // Buy TXL (USDT → TXL uses both programs)
    try {
      const tx = await p.methods.purchaseSubscriptionTokenUsdt(new anchor.BN(1000)).accounts({
        buyer: wallet.publicKey, usdtMint,
        buyerUsdtAccount: usdtAta, usdtTreasuryVault: utVault, usdtTreasuryPda: utPda,
        subscriptionTokenMint: txlMint, tokenTreasuryVault: ttVault, tokenTreasuryPda: ttPda,
        buyerTokenAccount: txlAta,
        tokenProgram: TOKEN_PROGRAM_ID, token2022Program: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      }).rpc();
      console.log(`  Buy TXL: ${tx.slice(0, 12)}...`);
    } catch (e: any) { console.log(`  Buy TXL: ${e.message.slice(0, 120)}`); }

    try {
      const a = await getAccount(connection, txlAta, "confirmed", TOKEN_2022_PROGRAM_ID);
      txlBalance = a.amount;
    } catch {}
    console.log(`  TXL: ${txlBalance}`);
  }

  // 6. Subscribe
  console.log("[5/6] Subscribing...");
  const [pmPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], txlineProgram);
  const [ttPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], txlineProgram);
  const ttVault = getAssociatedTokenAddressSync(txlMint, ttPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const subTx = await p.methods.subscribe(1, 4).accounts({
    user: wallet.publicKey, pricingMatrix: pmPda, tokenMint: txlMint,
    userTokenAccount: txlAta, tokenTreasuryVault: ttVault, tokenTreasuryPda: ttPda,
    tokenProgram: TOKEN_2022_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: anchor.web3.SystemProgram.programId,
  }).rpc();
  console.log(`  Subscribe: ${subTx}`);

  // 7. Activate API token
  console.log("[6/6] Activating API token...");
  const msg = `${subTx}::${jwt}`;
  const sig = nacl.sign.detached(new TextEncoder().encode(msg), keypair.secretKey);
  const b64sig = Buffer.from(sig).toString("base64");

  const act = await axios.post(`${cfg.apiOrigin}/api/token/activate`,
    { txSig: subTx, walletSignature: b64sig, leagues: [] },
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
  const apiToken = act.data.token || act.data;
  console.log(`  API Token: ${apiToken.slice(0, 24)}...`);

  // 8. Save .env
  fs.writeFileSync(path.resolve(__dirname, "../.env"), [
    `TXLINE_JWT=${jwt}`,
    `TXLINE_API_TOKEN=${apiToken}`,
    `TXLINE_NETWORK=devnet`,
  ].join("\n"));
  console.log("  .env saved");

  // 9. Test
  const http = axios.create({
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
    baseURL: cfg.apiOrigin,
  });
  const fixtures = await http.get("/api/fixtures");
  console.log(`\nFixtures: ${fixtures.data.length}`);
  for (const f of fixtures.data.slice(0, 10)) {
    const h = f.Participant1IsHome ? f.Participant1 : f.Participant2;
    const a = f.Participant1IsHome ? f.Participant2 : f.Participant1;
    console.log(`  #${f.FixtureId}: ${h} vs ${a}`);
  }

  console.log("\n═══════════════════════════════════════");
  console.log("  ✅ Done!");
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
