import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Fulltime } from "../target/types/fulltime";
import { PublicKey, LAMPORTS_PER_SOL, Keypair, SystemProgram, Connection } from "@solana/web3.js";
import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const RPC_URL = "http://localhost:8899";

describe("FullTime — Quick E2E Test", () => {
  const connection = new Connection(RPC_URL, { commitment: "confirmed" });
  const walletFile = process.env.ANCHOR_WALLET || path.join(os.homedir(), ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletFile, "utf-8"))));
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed", preflightCommitment: "confirmed" });
  anchor.setProvider(provider);
  const program = anchor.workspace.Fulltime as Program<Fulltime>;
  const creator = wallet.payer;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let seq = Math.floor(Math.random() * 100000);
  function fid() { return 40000000 + seq++; }

  function marketPda(fid: number) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("market"), program.programId.toBuffer(), creator.publicKey.toBuffer(),
       new anchor.BN(fid).toArrayLike(Buffer, "le", 8)], program.programId)[0];
  }
  function betPda(market: PublicKey, bettor: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), market.toBuffer(), bettor.toBuffer()], program.programId)[0];
  }

  it("full flow", async function () {
    this.timeout(60_000);
    const id = fid();
    const mpda = marketPda(id);
    const bpda = betPda(mpda, creator.publicKey);
    const nowTs = Math.floor(Date.now() / 1000);

    console.log("1. Creating market...");
    const tx1 = await program.methods.createMarket(
      new anchor.BN(id), "Brazil vs Norway — Who wins?",
      new anchor.BN(nowTs + 2), new anchor.BN(nowTs + 6), false
    ).accounts({ creator: creator.publicKey }).signers([creator]).rpc();
    console.log("   tx:", tx1);

    console.log("2. Sleeping 3s...");
    await sleep(3000);

    console.log("3. Opening market...");
    const tx2 = await program.methods.openMarket()
      .accounts({ market: mpda }).signers([creator]).rpc();
    console.log("   tx:", tx2);

    console.log("4. Placing bet...");
    const tx3 = await program.methods.placeBet(0, new anchor.BN(50_000_000))
      .accounts({ bettor: creator.publicKey, market: mpda }).signers([creator]).rpc();
    console.log("   tx:", tx3);

    // Send dummy txs to advance validator clock
    console.log("5. Waiting + advancing clock...");
    for (let i = 0; i < 8; i++) {
      await provider.connection.getBalance(creator.publicKey);
      await sleep(1000);
    }

    console.log("6. Closing betting...");
    const tx4 = await program.methods.closeBetting()
      .accounts({ market: mpda }).signers([creator]).rpc();
    console.log("   tx:", tx4);

    const m1 = await program.account.market.fetch(mpda);
    console.log("   Status:", JSON.stringify(m1.status));
    expect(m1.status).to.have.property("closed");

    console.log("7. Resolving market...");
    const tx5 = await program.methods.resolveMarket(true)
      .accounts({ creator: creator.publicKey, market: mpda }).signers([creator]).rpc();
    console.log("   tx:", tx5);

    const m2 = await program.account.market.fetch(mpda);
    console.log("   Status:", JSON.stringify(m2.status));
    expect(m2.status).to.have.property("settled");

    console.log("8. Claiming payout...");
    const balBefore = await provider.connection.getBalance(creator.publicKey);
    const tx6 = await program.methods.claimPayout()
      .accounts({ bettor: creator.publicKey, market: mpda, bet: bpda }).signers([creator]).rpc();
    console.log("   tx:", tx6);
    const balAfter = await provider.connection.getBalance(creator.publicKey);
    const payout = (balAfter - balBefore) / LAMPORTS_PER_SOL;
    console.log(`   Payout: ${payout.toFixed(4)} SOL`);

    const m3 = await program.account.market.fetch(mpda);
    console.log(`   Pool YES: ${(m3.poolYes.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}`);
    console.log(`   Pool NO: ${(m3.poolNo.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}`);

    console.log("\n✅ ALL PASSED");
  });
});
