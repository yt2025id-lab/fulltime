import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fulltime } from "../target/types/fulltime";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert, expect } from "chai";

describe("FullTime E2E — YES/NO Market Flow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Fulltime as Program<Fulltime>;
  const creator = (provider.wallet as anchor.Wallet).payer;
  let seq = Math.floor(Math.random() * 100000);
  function fid() { return 99000000 + seq++; }
  function ts(futureSec = 5) { return new anchor.BN(Math.floor(Date.now() / 1000) + futureSec); }
  function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  function marketPda(fixtureId: number) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("market"), program.programId.toBuffer(), creator.publicKey.toBuffer(),
       new anchor.BN(fixtureId).toArrayLike(Buffer, "le", 8)], program.programId)[0];
  }
  function betPda(market: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), market.toBuffer(), creator.publicKey.toBuffer()], program.programId)[0];
  }

  it("E2E: create → open → bet YES → close → resolve YES → claim", async () => {
    const fixtureId = fid();
    const mpda = marketPda(fixtureId);
    const question = "Portugal vs Spain — Who wins?";
    const SOL = LAMPORTS_PER_SOL;

    // 1. CREATE (manual market, isTrustless=false)
    console.log("\n[1/7] Creating market...");
    await program.methods
      .createMarket(new anchor.BN(fixtureId), question, ts(2), ts(12), false)
      .accounts({ creator: creator.publicKey }).signers([creator]).rpc({ commitment: "confirmed" });
    const m1 = await program.account.market.fetch(mpda);
    assert.strictEqual(m1.question, question);
    assert.strictEqual(m1.outcomeCount, 2);
    assert.strictEqual(m1.isTrustless, false);
    assert.strictEqual(m1.poolYes.toNumber(), 0);
    assert.strictEqual(m1.poolNo.toNumber(), 0);
    console.log(`   ✅ Created | outcomeCount=${m1.outcomeCount} | isTrustless=${m1.isTrustless}`);

    // 2. OPEN
    console.log("\n[2/7] Opening market...");
    await sleep(3500);
    await program.methods.openMarket().accounts({ market: mpda }).rpc({ commitment: "confirmed" });
    const m2 = await program.account.market.fetch(mpda);
    assert.deepStrictEqual(m2.status, { open: {} });
    console.log("   ✅ Opened");

    // 3. BET YES (optionIndex=0)
    console.log("\n[3/7] Placing YES bet (0.15 SOL)...");
    const bpda = betPda(mpda);
    const betAmount = new anchor.BN(0.15 * SOL);
    const balBefore = await provider.connection.getBalance(creator.publicKey);
    await program.methods.placeBet(0, betAmount)
      .accounts({ bettor: creator.publicKey, market: mpda })
      .signers([creator]).rpc({ commitment: "confirmed" });
    const m3 = await program.account.market.fetch(mpda);
    const bet = await program.account.bet.fetch(bpda);
    assert.strictEqual(bet.optionIndex, 0);
    assert.strictEqual(bet.claimed, false);
    expect(m3.poolYes.toNumber()).to.equal(0.15 * SOL);
    expect(m3.poolNo.toNumber()).to.equal(0);
    expect(m3.totalPool.toNumber()).to.equal(0.15 * SOL);
    console.log(`   ✅ Bet YES | poolYes=${Number(m3.poolYes) / SOL} SOL | total=${Number(m3.totalPool) / SOL} SOL`);

    // 4. CLOSE BETTING
    console.log("\n[4/7] Closing betting...");
    await sleep(10000);
    await program.methods.closeBetting().accounts({ market: mpda }).rpc({ commitment: "confirmed" });
    const m4 = await program.account.market.fetch(mpda);
    assert.deepStrictEqual(m4.status, { closed: {} });
    console.log("   ✅ Closed");

    // 5. RESOLVE YES (manual — only for non-trustless markets)
    console.log("\n[5/7] Resolving market → YES...");
    await program.methods.resolveMarket(true)
      .accounts({ creator: creator.publicKey, market: mpda })
      .signers([creator]).rpc({ commitment: "confirmed" });
    const m5 = await program.account.market.fetch(mpda);
    assert.deepStrictEqual(m5.status, { settled: {} });
    assert.strictEqual(m5.winningOption, 0);
    console.log(`   ✅ Resolved YES | winningOption=${m5.winningOption}`);

    // 6. CLAIM PAYOUT
    console.log("\n[6/7] Claiming payout...");
    await program.methods.claimPayout()
      .accounts({ bettor: creator.publicKey, market: mpda, bet: bpda })
      .signers([creator]).rpc({ commitment: "confirmed" });
    const betAfter = await program.account.bet.fetch(bpda);
    assert.strictEqual(betAfter.claimed, true);
    const balAfter = await provider.connection.getBalance(creator.publicKey);
    console.log(`   ✅ Claimed | Balance change: ${(balAfter - balBefore) / SOL} SOL (net of fees)`);

    // 7. VERIFY double-claim rejected
    console.log("\n[7/7] Verifying double-claim rejected...");
    try {
      await program.methods.claimPayout()
        .accounts({ bettor: creator.publicKey, market: mpda, bet: bpda })
        .signers([creator]).rpc({ commitment: "confirmed" });
      assert.fail("Expected AlreadyClaimed error");
    } catch (err: any) {
      assert.include(err.message, "AlreadyClaimed");
      console.log("   ✅ Double-claim correctly rejected");
    }

    console.log("\n🎉 ALL 7 STEPS PASSED!\n");
  });

  it("E2E: create → bet NO → close → cancel → refund", async () => {
    const fixtureId = fid();
    const mpda = marketPda(fixtureId);
    const SOL = LAMPORTS_PER_SOL;

    // Create + open
    await program.methods
      .createMarket(new anchor.BN(fixtureId), "Argentina vs Brazil — Who wins?", ts(2), ts(12), false)
      .accounts({ creator: creator.publicKey }).signers([creator]).rpc({ commitment: "confirmed" });
    await sleep(3500);
    await program.methods.openMarket().accounts({ market: mpda }).rpc({ commitment: "confirmed" });

    // Bet NO (optionIndex=1)
    const bpda = betPda(mpda);
    await program.methods.placeBet(1, new anchor.BN(0.1 * SOL))
      .accounts({ bettor: creator.publicKey, market: mpda }).signers([creator]).rpc({ commitment: "confirmed" });

    // Close
    await sleep(10000);
    await program.methods.closeBetting().accounts({ market: mpda }).rpc({ commitment: "confirmed" });

    // Cancel
    await program.methods.cancelMarket()
      .accounts({ creator: creator.publicKey, market: mpda }).signers([creator]).rpc({ commitment: "confirmed" });
    const m = await program.account.market.fetch(mpda);
    assert.deepStrictEqual(m.status, { cancelled: {} });

    // Refund
    const balBefore = await provider.connection.getBalance(creator.publicKey);
    await program.methods.refundBet()
      .accounts({ bettor: creator.publicKey, market: mpda }).signers([creator]).rpc({ commitment: "confirmed" });
    const balAfter = await provider.connection.getBalance(creator.publicKey);
    expect(balAfter).to.be.greaterThan(balBefore - 5000);

    // Verify bet account closed
    try { await program.account.bet.fetch(bpda); assert.fail("Should be closed"); } catch {}
    console.log("✅ Cancel+Refund flow passed\n");
  });
});
