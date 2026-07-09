import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Fulltime } from "../target/types/fulltime";
import { PublicKey, LAMPORTS_PER_SOL, Keypair, SystemProgram, Connection } from "@solana/web3.js";
import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const RPC_URL = "http://localhost:8899";

const MARKET_DEFS = [
  { q: "Argentina vs Brazil — Who wins?", outcome: true, betYes: 0.05, betNo: 0.03 },
  { q: "England vs France — Who wins?", outcome: true, betYes: 0.04, betNo: 0.02 },
  { q: "Germany vs Spain — Who wins?", outcome: false, betYes: 0.03, betNo: 0.04 },
  { q: "Netherlands vs Portugal — Who wins?", outcome: true, betYes: 0.02, betNo: 0.01 },
  { q: "Who will win World Cup 2026?", outcome: true, betYes: 0.10, betNo: 0.05 },
  { q: "Will Haaland be top scorer?", outcome: true, betYes: 0.02, betNo: 0.03 },
  { q: "Will Messi win MVP?", outcome: false, betYes: 0.01, betNo: 0.05 },
  { q: "Will Brazil reach semi-final?", outcome: true, betYes: 0.03, betNo: 0.02 },
  { q: "Will there be extra time in final?", outcome: false, betYes: 0.02, betNo: 0.04 },
  { q: "Will Argentina defend the title?", outcome: true, betYes: 0.04, betNo: 0.02 },
  { q: "Belgium vs Morocco — Who wins?", outcome: false, betYes: 0.03, betNo: 0.03 },
  { q: "USA vs Mexico — Who wins?", outcome: true, betYes: 0.02, betNo: 0.01 },
  { q: "Will Mbappe be top scorer?", outcome: false, betYes: 0.02, betNo: 0.04 },
  { q: "Will Japan reach knockout?", outcome: false, betYes: 0.01, betNo: 0.03 },
  { q: "Will Nigeria reach QF?", outcome: true, betYes: 0.02, betNo: 0.02 },
  { q: "Will there be a hat-trick?", outcome: true, betYes: 0.03, betNo: 0.01 },
  { q: "Will golden glove be European?", outcome: true, betYes: 0.02, betNo: 0.03 },
  { q: "Will host nation win group?", outcome: false, betYes: 0.02, betNo: 0.04 },
  { q: "Will Ronaldo play in WC?", outcome: true, betYes: 0.03, betNo: 0.01 },
  { q: "Total goals exceed 170?", outcome: true, betYes: 0.02, betNo: 0.03 },
];

describe("FullTime — 20 E2E Markets", () => {
  const connection = new Connection(RPC_URL, { commitment: "confirmed" });
  const walletFile = process.env.ANCHOR_WALLET || path.join(os.homedir(), ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletFile, "utf-8"))));
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed", preflightCommitment: "confirmed" });
  anchor.setProvider(provider);
  const program = anchor.workspace.Fulltime as Program<Fulltime>;
  const creator = wallet.payer;
  const bettor2 = Keypair.generate();

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let seq = Math.floor(Math.random() * 100000);
  function fid() { return 30000000 + seq++; }

  function marketPda(fid: number) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("market"), program.programId.toBuffer(), creator.publicKey.toBuffer(),
       new anchor.BN(fid).toArrayLike(Buffer, "le", 8)], program.programId)[0];
  }
  function betPda(market: PublicKey, bettor: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), market.toBuffer(), bettor.toBuffer()], program.programId)[0];
  }

  const results: { i: number; q: string; outcome: string; poolYes: string; poolNo: string; payout: string }[] = [];
  const toSol = (lamps: number) => (lamps / LAMPORTS_PER_SOL).toFixed(4);
  const rpc = <T>(fn: () => Promise<T>, label: string): Promise<T> =>
    (async () => { for (let a = 0; a < 5; a++) try { return await fn(); } catch (e: any) { if (a === 4) throw e; if (e.message?.includes("429") || e.message?.includes("Timeout") || e.message?.includes("failed")) { await sleep(3000 * (a + 1)); continue; } throw e; } })();

  before(async function () {
    this.timeout(180_000);
    console.log(`\n  Creator: ${creator.publicKey.toBase58()}`);
    let bal = await rpc(() => provider.connection.getBalance(creator.publicKey), "getBalance");
    console.log(`  Balance: ${toSol(bal)} SOL`);
    if (bal < 10 * LAMPORTS_PER_SOL) {
      for (let i = 0; i < 3; i++) {
        try {
          const sig = await rpc(() => provider.connection.requestAirdrop(creator.publicKey, 5 * LAMPORTS_PER_SOL), "airdrop");
          await connection.confirmTransaction(sig, "confirmed");
          await sleep(3000);
        } catch {}
      }
      bal = await rpc(() => provider.connection.getBalance(creator.publicKey), "getBalance");
      console.log(`  After airdrop: ${toSol(bal)} SOL`);
    }
    const b2bal = await rpc(() => provider.connection.getBalance(bettor2.publicKey), "getBalance-b2");
    if (b2bal < 0.5 * LAMPORTS_PER_SOL) {
      const ix = SystemProgram.transfer({ fromPubkey: creator.publicKey, toPubkey: bettor2.publicKey, lamports: 0.5 * LAMPORTS_PER_SOL });
      const tx = new anchor.web3.Transaction().add(ix);
      await rpc(() => provider.sendAndConfirm(tx, [creator]), "fund-b2");
      console.log(`  Bettor2 funded: ${bettor2.publicKey.toBase58()}`);
    }
    console.log();
  });

  for (let i = 0; i < MARKET_DEFS.length; i++) {
    const m = MARKET_DEFS[i];
    it(`#${i + 1} — ${m.q}`, async function () {
      this.timeout(120_000);
      const id = fid();
      const mpda = marketPda(id);
      const bpdaCreator = betPda(mpda, creator.publicKey);
      const bpdaB2 = betPda(mpda, bettor2.publicKey);
      const yesAmt = new anchor.BN(Math.floor(m.betYes * LAMPORTS_PER_SOL));
      const noAmt = new anchor.BN(Math.floor(m.betNo * LAMPORTS_PER_SOL));
      const winningOpt = m.outcome ? 0 : 1;
      const [creatorBetOpt, creatorAmt, b2Opt, b2Amt] = winningOpt === 0
        ? [0, yesAmt, 1, noAmt] : [1, noAmt, 0, yesAmt];

      // Check balance first
      const balChk = await rpc(() => provider.connection.getBalance(creator.publicKey), "chk-bal");
      const needed = creatorAmt.toNumber() + 0.05 * LAMPORTS_PER_SOL;
      if (balChk < needed) throw new Error(`Low balance: ${toSol(balChk)} SOL, need ${toSol(needed)} SOL`);

      // 1. CREATE
      const nowTs = Math.floor(Date.now() / 1000);
      await rpc(() => program.methods.createMarket(new anchor.BN(id), m.q,
        new anchor.BN(nowTs + 2), new anchor.BN(nowTs + 8), false)
        .accounts({ creator: creator.publicKey }).signers([creator]).rpc(), "create");
      await sleep(3000);

      // 2. OPEN
      await rpc(() => program.methods.openMarket().accounts({ market: mpda }).signers([creator]).rpc(), "open");

      // 3. BET
      if (creatorAmt.gtn(0)) {
        await rpc(() => program.methods.placeBet(creatorBetOpt, creatorAmt)
          .accounts({ bettor: creator.publicKey, market: mpda }).signers([creator]).rpc(), "bet-creator");
      }
      if (b2Amt.gtn(0)) {
        await rpc(() => program.methods.placeBet(b2Opt, b2Amt)
          .accounts({ bettor: bettor2.publicKey, market: mpda }).signers([bettor2]).rpc(), "bet-b2");
      }

      // 4. CLOSE
      await sleep(10000);
      await rpc(() => program.methods.closeBetting().accounts({ market: mpda }).signers([creator]).rpc(), "close");
      const mkt1 = await rpc(() => program.account.market.fetch(mpda), "fetch-closed");
      expect(mkt1.status).to.have.property("closed");

      // 5. RESOLVE
      await rpc(() => program.methods.resolveMarket(m.outcome)
        .accounts({ creator: creator.publicKey, market: mpda }).signers([creator]).rpc(), "resolve");
      const mkt2 = await rpc(() => program.account.market.fetch(mpda), "fetch-settled");
      expect(mkt2.status).to.have.property("settled");

      // 6. CLAIM
      let payoutSol = "0.0000";
      for (let a = 0; a < 3; a++) {
        try {
          const bet = await rpc(() => program.account.bet.fetch(bpdaCreator), "fetch-bet");
          if (bet.optionIndex === winningOpt && !bet.claimed) {
            const bb = await rpc(() => provider.connection.getBalance(creator.publicKey), "bal-before");
            await rpc(() => program.methods.claimPayout()
              .accounts({ bettor: creator.publicKey, market: mpda, bet: bpdaCreator }).signers([creator]).rpc(), "claim");
            const ba = await rpc(() => provider.connection.getBalance(creator.publicKey), "bal-after");
            payoutSol = toSol(ba - bb);
          }
          break;
        } catch (e: any) {
          if (a === 2) {
            if (e.message?.includes("NotWinner") || e.message?.includes("AlreadyClaimed")) break;
            console.log(`  ⚠️ Claim #${i + 1} failed: ${e.message?.slice(0, 100)}`);
          }
          await sleep(3000);
        }
      }

      const mktF = await rpc(() => program.account.market.fetch(mpda), "fetch-final");
      results.push({ i: i + 1, q: m.q, outcome: m.outcome ? "YES" : "NO", poolYes: toSol(mktF.poolYes.toNumber()), poolNo: toSol(mktF.poolNo.toNumber()), payout: payoutSol });
      console.log(`  ✅ #${String(i + 1).padStart(2)} │ ${m.q.padEnd(40)} │ ${(m.outcome ? "YES" : "NO").padEnd(3)} │ YES:${toSol(mktF.poolYes.toNumber()).padStart(7)} │ NO:${toSol(mktF.poolNo.toNumber()).padStart(7)} │ Claim:${payoutSol.padStart(8)}`);
    });
  }

  after(async function () {
    this.timeout(10_000);
    const bal = await rpc(() => provider.connection.getBalance(creator.publicKey), "final-balance");
    console.log(`\n  ════════════════════════════════════════════════════════════════════`);
    console.log(`  📊 FullTime — 20 E2E Markets Summary`);
    console.log(`  ════════════════════════════════════════════════════════════════════`);
    console.log(`  Creator: ${creator.publicKey.toBase58()}  |  Final: ${toSol(bal)} SOL`);
    console.log(`  ────────────────────────────────────────────────────────────────────`);
    for (const r of results) {
      console.log(`  #${String(r.i).padStart(2)} │ ${r.q.padEnd(40)} │ ${r.outcome.padEnd(3)} │ YES:${r.poolYes.padStart(7)} │ NO:${r.poolNo.padStart(7)} │ ${r.payout} SOL`);
    }
    console.log(`  ════════════════════════════════════════════════════════════════════`);
    console.log(`  ✅ ${results.filter(r => parseFloat(r.payout) > 0).length}/${results.length} paid out\n`);
  });
});
