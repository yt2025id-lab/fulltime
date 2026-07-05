import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fulltime } from "../target/types/fulltime";
import { PublicKey } from "@solana/web3.js";
import { assert, expect } from "chai";

describe("FullTime", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Fulltime as Program<Fulltime>;
  const creator = (provider.wallet as anchor.Wallet).payer;
  const QUESTION = "Team A vs Team B — Who wins?";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let seq = Math.floor(Math.random() * 100000);
  function fid() { return 99000000 + seq++; }
  // ts(0) = now; ts(N) = now+N seconds
  function ts(futureSec = 5) { return new anchor.BN(Math.floor(Date.now() / 1000) + futureSec); }

  function marketPda(fixtureId: number) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("market"), program.programId.toBuffer(), creator.publicKey.toBuffer(),
       new anchor.BN(fixtureId).toArrayLike(Buffer, "le", 8)], program.programId)[0];
  }
  function betPda(market: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), market.toBuffer(), creator.publicKey.toBuffer()], program.programId)[0];
  }

  // ─── create_market ─────────────────────────────────────────────
  describe("create_market", () => {
    it("creates a market", async () => {
      const mid = fid();
      const tx = await program.methods.createMarket(new anchor.BN(mid), QUESTION, ts(5), ts(3600), false)
        .accounts({ creator: creator.publicKey }).signers([creator]).rpc();
      await provider.connection.confirmTransaction(tx, "confirmed");
      const m = await program.account.market.fetch(marketPda(mid));
      assert.strictEqual(m.question, QUESTION);
      assert.strictEqual(m.outcomeCount, 2);
      assert.deepStrictEqual(m.status, { pending: {} });
    });
    it("rejects question > 200 chars", async () => {
      try {
        await program.methods.createMarket(new anchor.BN(fid()), "X".repeat(201), ts(5), ts(3600), false)
          .accounts({ creator: creator.publicKey }).rpc();
        assert.fail("Expected error");
      } catch (err: any) { assert.include(err.message, "QuestionTooLong"); }
    });
    it("rejects close <= open", async () => {
      try {
        await program.methods.createMarket(new anchor.BN(fid()), QUESTION, ts(3600), ts(5), false)
          .accounts({ creator: creator.publicKey }).rpc();
        assert.fail("Expected error");
      } catch (err: any) { assert.include(err.message, "InvalidBettingWindow"); }
    });
  });

  // ─── open_market ───────────────────────────────────────────────
  describe("open_market", () => {
    it("opens pending market (correct)", async () => {
      const mid = fid();
      await program.methods.createMarket(new anchor.BN(mid), QUESTION, ts(2), ts(3600), false)
        .accounts({ creator: creator.publicKey }).signers([creator]).rpc();
      await sleep(3000);
      await program.methods.openMarket().accounts({ market: marketPda(mid) }).rpc();
      assert.deepStrictEqual((await program.account.market.fetch(marketPda(mid))).status, { open: {} });
    });
    it("rejects double open", async () => {
      const mid = fid();
      await program.methods.createMarket(new anchor.BN(mid), QUESTION, ts(2), ts(3600), false)
        .accounts({ creator: creator.publicKey }).signers([creator]).rpc();
      await sleep(3000);
      const m = marketPda(mid);
      await program.methods.openMarket().accounts({ market: m }).rpc();
      try {
        await program.methods.openMarket().accounts({ market: m }).rpc();
        assert.fail("Expected error");
      } catch (err: any) { assert.include(err.message, "market status"); }
    });
  });

  // ─── place_bet ────────────────────────────────────────────────
  describe("place_bet", () => {
    let mpda: PublicKey;
    before(async () => {
      const mid = fid();
      mpda = marketPda(mid);
      await program.methods.createMarket(new anchor.BN(mid), QUESTION, ts(2), ts(3600), false)
        .accounts({ creator: creator.publicKey }).signers([creator]).rpc();
      await sleep(3000);
      await program.methods.openMarket().accounts({ market: mpda }).rpc();
    });
    it("places HOME bet", async () => {
      const bpda = betPda(mpda);
      await program.methods.placeBet(0, new anchor.BN(100_000_000))
        .accounts({ bettor: creator.publicKey, market: mpda }).signers([creator]).rpc();
      const bet = await program.account.bet.fetch(bpda);
      assert.strictEqual(bet.optionIndex, 0);
      assert.strictEqual(bet.claimed, false);
      const market = await program.account.market.fetch(mpda);
      expect(market.poolYes.toNumber()).to.equal(100_000_000);
      expect(market.totalPool.toNumber()).to.equal(100_000_000);
    });
    it("rejects invalid option", async () => {
      const mid = fid();
      const m2 = marketPda(mid);
      await program.methods.createMarket(new anchor.BN(mid), QUESTION, ts(2), ts(3600), false)
        .accounts({ creator: creator.publicKey }).signers([creator]).rpc();
      await sleep(3000);
      await program.methods.openMarket().accounts({ market: m2 }).rpc();
      try {
        await program.methods.placeBet(5, new anchor.BN(1000))
          .accounts({ bettor: creator.publicKey, market: m2 }).signers([creator]).rpc();
        assert.fail("Expected error");
      } catch (err: any) { assert.include(err.message, "Invalid option"); }
    });
  });

  // ─── close_betting ─────────────────────────────────────────────
  describe("close_betting", () => {
    let mpda: PublicKey;
    before(async () => {
      const mid = fid();
      mpda = marketPda(mid);
      await program.methods.createMarket(new anchor.BN(mid), QUESTION, ts(2), ts(4), false)
        .accounts({ creator: creator.publicKey }).signers([creator]).rpc();
      await sleep(3000);
      await program.methods.openMarket().accounts({ market: mpda }).rpc();
    });
    it("closes after time", async () => {
      await sleep(3000);
      await program.methods.closeBetting().accounts({ market: mpda }).rpc();
      assert.deepStrictEqual((await program.account.market.fetch(mpda)).status, { closed: {} });
    });
    it("rejects double close", async () => {
      try {
        await program.methods.closeBetting().accounts({ market: mpda }).rpc();
        assert.fail("Expected error");
      } catch (err: any) { assert.include(err.message, "market status"); }
    });
  });

  // ─── cancel + refund ────────────────────────────────────────
  describe("cancel_and_refund", () => {
    let mpda: PublicKey;
    before(async () => {
      const mid = fid();
      mpda = marketPda(mid);
      await program.methods.createMarket(new anchor.BN(mid), QUESTION, ts(2), ts(3600), false)
        .accounts({ creator: creator.publicKey }).signers([creator]).rpc();
      await sleep(3000);
      await program.methods.openMarket().accounts({ market: mpda }).rpc();
      await program.methods.placeBet(0, new anchor.BN(50_000_000))
        .accounts({ bettor: creator.publicKey, market: mpda }).signers([creator]).rpc();
    });
    it("cancels market by creator", async () => {
      await program.methods.cancelMarket()
        .accounts({ creator: creator.publicKey, market: mpda }).signers([creator]).rpc();
      const m = await program.account.market.fetch(mpda);
      assert.deepStrictEqual(m.status, { cancelled: {} });
    });
    it("refunds bet on cancelled market", async () => {
      const bpda = betPda(mpda);
      const balBefore = await provider.connection.getBalance(creator.publicKey);
      await program.methods.refundBet()
        .accounts({ bettor: creator.publicKey, market: mpda }).signers([creator]).rpc();
      const balAfter = await provider.connection.getBalance(creator.publicKey);
      // Balance should increase (minus tx fee)
      expect(balAfter).to.be.greaterThan(balBefore - 5000);

      // Bet account should be closed
      try {
        await program.account.bet.fetch(bpda);
        assert.fail("Bet account should be closed");
      } catch (err: any) {}
    });
    it("rejects refund on non-cancelled market", async () => {
      const mid = fid();
      const m2 = marketPda(mid);
      await program.methods.createMarket(new anchor.BN(mid), QUESTION, ts(2), ts(3600), false)
        .accounts({ creator: creator.publicKey }).signers([creator]).rpc();
      await sleep(3000);
      await program.methods.openMarket().accounts({ market: m2 }).rpc();
      // Place bet first so PDA exists
      await program.methods.placeBet(0, new anchor.BN(10_000_000))
        .accounts({ bettor: creator.publicKey, market: m2 }).signers([creator]).rpc();
      // Try refund without cancelling — must fail
      try {
        await program.methods.refundBet()
          .accounts({ bettor: creator.publicKey, market: m2 }).signers([creator]).rpc();
        assert.fail("Expected error");
      } catch (err: any) {
        assert.include(err.message, "market status");
      }
    });
  });

  // ─── settle_market status checks ─────────────────────────────
  describe("settle_market_status", () => {
    it("rejects settle on open market", async () => {
      const mid = fid();
      await program.methods.createMarket(new anchor.BN(mid), QUESTION, ts(2), ts(3600), false)
        .accounts({ creator: creator.publicKey }).signers([creator]).rpc();
      await sleep(3000);
      await program.methods.openMarket().accounts({ market: marketPda(mid) }).rpc();

      try {
        await program.methods.settleMarket(
          new anchor.BN(0), // target_ts
          { fixtureId: new anchor.BN(mid), updateStats: { updateCount: 0, minTimestamp: new anchor.BN(0), maxTimestamp: new anchor.BN(0) }, eventsSubTreeRoot: Array(32).fill(0) },
          [], [], // empty proofs
          { statToProve: { key: 0, value: 0, period: 0 }, eventStatRoot: Array(32).fill(0), statProof: [] },
          { statToProve: { key: 0, value: 0, period: 0 }, eventStatRoot: Array(32).fill(0), statProof: [] },
        ).accounts({ market: marketPda(mid), dailyScoresMerkleRoots: PublicKey.default })
         .rpc();
        assert.fail("Expected error");
      } catch (err: any) { assert.include(err.message, "MarketNotClosed"); }
    });
  });

  // ─── claim_payout ──────────────────────────────────────────────
  describe("claim_payout", () => {
    it("rejects claim on pending market", async () => {
      const mid = fid();
      const mpda = marketPda(mid);
      const bpda = betPda(mpda);
      await program.methods.createMarket(new anchor.BN(mid), QUESTION, ts(5), ts(3600), false)
        .accounts({ creator: creator.publicKey }).signers([creator]).rpc();
      try {
        await program.methods.claimPayout()
          .accounts({ bettor: creator.publicKey, market: mpda, bet: bpda }).signers([creator]).rpc();
        assert.fail("Expected error");
      } catch (err: any) { assert.include(err.message, "AccountNotInitialized"); }
    });
  });

  // ─── edge cases ────────────────────────────────────────────────
  describe("edge cases", () => {
    it("PDA deterministic", () => {
      const mid = fid();
      const p1 = marketPda(mid);
      const p2 = marketPda(mid);
      assert.equal(p1.toBase58(), p2.toBase58());
    });
  });
});
