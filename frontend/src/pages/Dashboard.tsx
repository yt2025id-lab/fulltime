import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";
import { useProgram, FULLTIME_ID } from "../context/FullTimeContext";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";

const fadeIn = {
  initial: { filter: "blur(8px)", opacity: 0, y: 20 },
  animate: { filter: "blur(0px)", opacity: 1, y: 0 },
};

function f(a: string) { return `${a.slice(0, 6)}...${a.slice(-4)}`; }

interface UIMarket {
  pubkey: PublicKey;
  fixtureId: number;
  question: string;
  creator: string;
  poolYes: number;
  poolNo: number;
  totalPool: number;
  openTime: number;
  closeTime: number;
  status: string;
  winningOption: number;
  isTrustless: boolean;
}

interface UIBet {
  market: string;
  optionIndex: number;
  amount: number;
  claimed: boolean;
  pubkey: PublicKey;
}

function lamportsToSol(lamports: number) { return (lamports / 1e9).toFixed(4); }

function statusLabel(s: string): { label: string; color: string } {
  if (s === "pending") return { label: "Pending", color: "text-white/40" };
  if (s === "open") return { label: "Open", color: "text-green-400" };
  if (s === "closed") return { label: "Closed", color: "text-yellow-400" };
  if (s === "settled") return { label: "Settled", color: "text-amber-400" };
  if (s === "cancelled") return { label: "Cancelled", color: "text-red-400" };
  return { label: s, color: "text-white/60" };
}

function marketPda(creator: PublicKey, fixtureId: number): PublicKey {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(fixtureId));
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), new PublicKey(FULLTIME_ID).toBuffer(), creator.toBuffer(), buf],
    new PublicKey(FULLTIME_ID)
  );
  return pda;
}

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export default function Dashboard() {
  const { publicKey, connected, disconnect } = useWallet();
  const program = useProgram();
  const [now, setNow] = useState(new Date());
  const [markets, setMarkets] = useState<UIMarket[]>([]);
  const [bets, setBets] = useState<UIBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: string; msg: string; txHash?: string } | null>(null);

  const [question, setQuestion] = useState("");
  const [deadline, setDeadline] = useState("");
  const [fixtureId, setFixtureId] = useState("");
  const [isTrustless, setIsTrustless] = useState(false);
  const [creating, setCreating] = useState(false);

  const [betMarket, setBetMarket] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [betSide, setBetSide] = useState(0);
  const [payTx, setPayTx] = useState("idle");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (status && status.type !== "error") {
      const t = setTimeout(() => setStatus(null), 4000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const mark = useCallback((s: string) => {
    if (s === "clear") setStatus(null);
    else setStatus({ type: "info", msg: s });
  }, []);

  const loadMarkets = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    try {
      const all = await (program as any).account.market.all();
      const mapped: UIMarket[] = all.map((a: any) => {
        const fStatus = Object.keys(a.account.status)[0] || "pending";
        return {
          pubkey: a.publicKey,
          fixtureId: Number(a.account.fixtureId),
          question: a.account.question,
          creator: a.account.creator.toString(),
          poolYes: Number(a.account.poolYes),
          poolNo: Number(a.account.poolNo),
          totalPool: Number(a.account.totalPool),
          openTime: Number(a.account.bettingOpenTime),
          closeTime: Number(a.account.bettingCloseTime),
          status: fStatus,
          winningOption: a.account.winningOption,
          isTrustless: a.account.isTrustless,
        };
      });
      setMarkets(mapped);
    } catch (e: any) {
      if (e.message?.includes("Account does not exist")) {
        setMarkets([]);
      }
    }
    setLoading(false);
  }, [program]);

  const loadBets = useCallback(async () => {
    if (!program || !publicKey) return;
    try {
      const all = await (program as any).account.bet.all([
        { memcmp: { offset: 40, bytes: publicKey.toBase58() } },
      ]);
      setBets(all.map((a: any) => ({
        market: a.account.market.toString(),
        optionIndex: a.account.optionIndex,
        amount: Number(a.account.amount),
        claimed: a.account.claimed,
        pubkey: a.publicKey,
      })));
    } catch {}
  }, [program, publicKey]);

  useEffect(() => {
    if (program) { loadMarkets(); loadBets(); }
  }, [program, loadMarkets, loadBets]);

  useEffect(() => {
    if (connected) { loadMarkets(); loadBets(); }
  }, [connected]);

  const reload = () => setTimeout(() => { loadMarkets(); loadBets(); }, 2000);

  const createMarket = async () => {
    if (!program || !publicKey || !question || !deadline) return;
    setCreating(true);
    try {
      const dl = Math.floor(new Date(deadline).getTime() / 1000);
      const nowTs = Math.floor(Date.now() / 1000);
      const openTime = nowTs + 30;
      const closeTime = Math.max(openTime + 60, dl);
      const fid = fixtureId ? parseInt(fixtureId) : 0;
      mark("Creating market...");
      await program.methods
        .createMarket(new BN(fid), question, new BN(openTime), new BN(closeTime), isTrustless)
        .accounts({ creator: publicKey })
        .rpc();
      setQuestion(""); setDeadline(""); setFixtureId("");
      setStatus({ type: "success", msg: "Market created!" });
      reload();
    } catch (e: any) {
      setStatus({ type: "error", msg: e.message?.slice(0, 120) || String(e) });
    }
    setCreating(false);
  };

  const openMarket = async (marketPk: PublicKey) => {
    if (!program) return;
    try {
      mark("Opening market...");
      const m = await (program as any).account.market.fetch(marketPk);
      await program.methods.openMarket()
        .accounts({ market: marketPk })
        .rpc();
      setStatus({ type: "success", msg: "Market opened!" });
      reload();
    } catch (e: any) { setStatus({ type: "error", msg: e.message?.slice(0, 120) || String(e) }); }
  };

  const closeBetting = async (marketPk: PublicKey) => {
    if (!program) return;
    try {
      mark("Closing betting...");
      await program.methods.closeBetting()
        .accounts({ market: marketPk })
        .rpc();
      setStatus({ type: "success", msg: "Betting closed!" });
      reload();
    } catch (e: any) { setStatus({ type: "error", msg: e.message?.slice(0, 120) || String(e) }); }
  };

  const placeBet = async (marketPk: PublicKey, optionIndex: number) => {
    if (!program || !publicKey || !betAmount || parseFloat(betAmount) <= 0) return;
    setPayTx("pending");
    try {
      mark("Placing bet...");
      const amount = Math.floor(parseFloat(betAmount) * 1e9);
      const betPda = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), marketPk.toBuffer(), publicKey.toBuffer()],
        new PublicKey(FULLTIME_ID)
      )[0];
      await program.methods.placeBet(optionIndex, new BN(amount))
        .accounts({ bettor: publicKey, market: marketPk, bet: betPda, systemProgram: SystemProgram.programId })
        .rpc();
      setBetAmount(""); setBetMarket(null);
      setStatus({ type: "success", msg: `Bet ${optionIndex === 0 ? "YES" : "NO"} ${betAmount} SOL!` });
      setPayTx("success"); setTimeout(() => setPayTx("idle"), 2000);
      reload();
    } catch (e: any) { setPayTx("fail"); setStatus({ type: "error", msg: e.message?.slice(0, 120) || String(e) }); }
  };

  const resolveMarket = async (marketPk: PublicKey, outcome: boolean) => {
    if (!program || !publicKey) return;
    setPayTx("pending");
    try {
      mark("Resolving market...");
      const m = await (program as any).account.market.fetch(marketPk);
      await program.methods.resolveMarket(outcome)
        .accounts({ creator: publicKey, market: marketPk })
        .rpc();
      setStatus({ type: "success", msg: `Resolved as ${outcome ? "YES" : "NO"}!` });
      setPayTx("success"); setTimeout(() => setPayTx("idle"), 2000);
      reload();
    } catch (e: any) { setPayTx("fail"); setStatus({ type: "error", msg: e.message?.slice(0, 120) || String(e) }); }
  };

  const claimPayout = async (marketPk: PublicKey, betPk: PublicKey) => {
    if (!program || !publicKey) return;
    setPayTx("pending");
    try {
      mark("Claiming...");
      await program.methods.claimPayout()
        .accounts({ bettor: publicKey, market: marketPk, bet: betPk })
        .rpc();
      setStatus({ type: "success", msg: "Payout claimed!" });
      setPayTx("success"); setTimeout(() => setPayTx("idle"), 2000);
      reload();
    } catch (e: any) { setPayTx("fail"); setStatus({ type: "error", msg: e.message?.slice(0, 120) || String(e) }); }
  };

  const cancelMarket = async (marketPk: PublicKey) => {
    if (!program || !publicKey) return;
    try {
      mark("Cancelling market...");
      await program.methods.cancelMarket()
        .accounts({ creator: publicKey, market: marketPk })
        .rpc();
      setStatus({ type: "success", msg: "Market cancelled!" });
      reload();
    } catch (e: any) { setStatus({ type: "error", msg: e.message?.slice(0, 120) || String(e) }); }
  };

  const refundBet = async (marketPk: PublicKey, betPk: PublicKey) => {
    if (!program || !publicKey) return;
    try {
      mark("Refunding...");
      await program.methods.refundBet()
        .accounts({ bettor: publicKey, market: marketPk, bet: betPk })
        .rpc();
      setStatus({ type: "success", msg: "Bet refunded!" });
      reload();
    } catch (e: any) { setStatus({ type: "error", msg: e.message?.slice(0, 120) || String(e) }); }
  };

  const myBetOnMarket = (mktPk: string) => bets.find(b => b.market === mktPk);
  const dt = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-green-950 relative">
      <div className="fixed inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1920&q=80)` }}>
        <div className="absolute inset-0 bg-green-950/75 backdrop-blur-[2px]" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-amber-500/10 bg-black/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-amber-300/60 hover:text-amber-300 font-body">&larr; Back</Link>
            <div className="liquid-glass w-9 h-9 rounded-full flex items-center justify-center text-base">⚽</div>
            <span className="hidden sm:inline font-heading italic text-white text-lg tracking-tight">Full<span className="text-amber-300/60">Time</span></span>
            <Link to="/app" className="liquid-glass rounded-full px-3 py-1 text-xs font-body text-amber-300 font-medium">Markets</Link>
            <Link to="/matches" className="liquid-glass rounded-full px-3 py-1 text-xs font-body text-white/60 hover:text-white">Matches</Link>
          </div>
          <div>
            {connected ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/60 font-body font-mono hidden sm:inline">{publicKey ? f(publicKey.toBase58()) : ""}</span>
                <button onClick={disconnect} className="liquid-glass rounded-full px-3 py-1.5 text-xs text-white/50 hover:text-red-400 font-body">Disconnect</button>
              </div>
            ) : (
              <WalletMultiButton className="!bg-gradient-to-r !from-amber-500 !to-yellow-500 hover:!from-amber-400 hover:!to-yellow-400 !text-black !rounded-full !px-5 !py-2 !text-sm !font-semibold !font-body !h-auto" />
            )}
          </div>
        </div>
      </nav>

      <div className="relative z-10 border-b border-white/5 bg-black/40 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-center gap-4 text-xs font-body text-white/50">
          <span>{now.toLocaleDateString("en-US", { weekday: "long" })}</span>
          <span className="text-white/20">|</span>
          <span>{now.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}</span>
          <span className="text-white/20">|</span>
          <span>{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <motion.div {...fadeIn} transition={{ duration: 0.8, ease: "easeOut" }} className="text-center mb-10">
          <p className="text-sm font-body text-amber-300/60 mb-4">// Dashboard</p>
          <h1 className="font-heading italic text-white text-5xl md:text-6xl lg:text-[5rem] leading-[0.9] tracking-[-3px]">
            World Cup<br /><span className="text-amber-300">Prediction</span>
          </h1>
          <p className="text-xs text-white/40 font-body mt-2">{markets.length} markets</p>
        </motion.div>

        {/* Create Market */}
        {connected && (
          <motion.div initial={{ filter: "blur(5px)", opacity: 0 }} animate={{ filter: "blur(0px)", opacity: 1 }} transition={{ duration: 0.6 }} className="liquid-glass-strong rounded-[1.25rem] p-6 mb-8">
            <h2 className="font-heading italic text-white text-2xl tracking-[-1px] mb-4">Create Market</h2>
            <div className="space-y-3">
              <input className="w-full bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm font-body text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50 transition-all" placeholder="Will Argentina win the 2026 World Cup?" value={question} onChange={e => setQuestion(e.target.value)} />
              <div className="flex flex-col sm:flex-row gap-3">
                <input className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm font-body text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
                <input className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm font-body text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50" placeholder="Fixture ID (optional)" value={fixtureId} onChange={e => setFixtureId(e.target.value)} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-body text-white/60 cursor-pointer">
                  <input type="checkbox" checked={isTrustless} onChange={e => setIsTrustless(e.target.checked)} className="accent-amber-500" />
                  Trustless (TxLINE settlement)
                </label>
                <div className="liquid-glass rounded-full px-4 py-2 text-sm font-body text-white/60">Fee: <span className="text-amber-300 font-medium">2%</span></div>
              </div>
              <button onClick={createMarket} disabled={creating || !question || !deadline} className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black rounded-full px-5 py-3 text-sm font-semibold font-body disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20">{creating ? "Creating..." : "Create Market"}</button>
            </div>
          </motion.div>
        )}

        {/* Markets */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading italic text-white text-3xl tracking-[-1px]">Markets <span className="text-white/30 text-lg">({markets.length})</span></h2>
          <button onClick={reload} disabled={loading} className="liquid-glass rounded-full px-4 py-2 text-sm font-body text-white/60 hover:text-white disabled:opacity-40">{loading ? "Loading..." : "Refresh"}</button>
        </div>

        {!connected ? (
          <div className="text-center py-20">
            <div className="liquid-glass w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><span className="font-heading italic text-white/40 text-3xl lowercase">f</span></div>
            <p className="text-white/40 font-body text-sm">Connect wallet to view markets</p>
          </div>
        ) : markets.length === 0 && !loading ? (
          <div className="text-center py-20"><p className="text-white/40 font-body text-sm">No markets yet — create one above</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {markets.map((m, idx) => {
              const st = statusLabel(m.status);
              const myBet = myBetOnMarket(m.pubkey.toString());
              const yesPct = m.totalPool > 0 ? (m.poolYes * 100 / m.totalPool).toFixed(1) : "50";
              const isCreator = publicKey && m.creator === publicKey.toBase58();
              const canResolve = isCreator && !m.isTrustless && m.status === "closed";
              const canClose = m.status === "open" && now.getTime() / 1000 > m.closeTime;
              const canOpen = m.status === "pending";
              const canCancel = isCreator && ["pending", "open", "closed"].includes(m.status);
              const isCancelled = m.status === "cancelled";

              return (
                <div key={m.pubkey.toString()} className="liquid-glass rounded-[1.25rem] p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-xs text-white/30 font-body">#{m.fixtureId || idx + 1}</span>
                      {m.isTrustless && <span className="ml-2 text-xs text-amber-400/60 font-body bg-amber-400/10 rounded-full px-2 py-0.5">Trustless</span>}
                      {!m.isTrustless && <span className="ml-2 text-xs text-blue-400/60 font-body bg-blue-400/10 rounded-full px-2 py-0.5">Manual</span>}
                    </div>
                    <span className={`text-xs font-body font-semibold ${st.color}`}>{st.label}</span>
                  </div>
                  <p className="text-white font-body font-medium text-sm mb-2">{m.question}</p>
                  <p className="text-xs text-white/30 font-body mb-3">Deadline: {dt(m.closeTime)}</p>

                  {!isCancelled && (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-green-500/10 rounded-xl p-2 text-center">
                          <p className="text-xs text-green-300/80 font-body">YES</p>
                          <p className="text-sm text-green-300 font-body font-semibold">{lamportsToSol(m.poolYes)} SOL</p>
                        </div>
                        <div className="bg-red-500/10 rounded-xl p-2 text-center">
                          <p className="text-xs text-red-300/80 font-body">NO</p>
                          <p className="text-sm text-red-300 font-body font-semibold">{lamportsToSol(m.poolNo)} SOL</p>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full transition-all" style={{ width: `${yesPct}%` }} />
                      </div>
                      <p className="text-xs text-white/30 font-body text-center mb-3">{yesPct}% YES</p>
                    </>
                  )}

                  {myBet && (
                    <div className="mb-3 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-xs text-white/50 font-body">Your bet: <span className={myBet.optionIndex === 0 ? "text-green-300" : "text-red-300"}>{myBet.optionIndex === 0 ? "YES" : "NO"} {lamportsToSol(myBet.amount)} SOL</span>
                        {myBet.claimed && <span className="ml-1 text-amber-400">(Claimed)</span>}
                      </p>
                      {isCancelled && !myBet.claimed && (
                        <button onClick={() => refundBet(m.pubkey, myBet.pubkey)} className="mt-2 w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-full py-1.5 text-xs font-body font-semibold transition-colors">Refund</button>
                      )}
                      {m.status === "settled" && myBet.optionIndex === m.winningOption && !myBet.claimed && (
                        <button onClick={() => claimPayout(m.pubkey, myBet.pubkey)} className="mt-2 w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black rounded-full py-1.5 text-xs font-body font-semibold transition-all">Claim Winnings</button>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {m.status === "open" && (
                      <>
                        {betMarket === m.pubkey.toString() ? (
                          <div className="w-full flex gap-2">
                            <input type="number" step="0.01" min="0.01" className="flex-1 bg-white/5 border border-white/10 rounded-full px-3 py-2 text-sm font-body text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50" placeholder="SOL amount" value={betAmount} onChange={e => setBetAmount(e.target.value)} autoFocus />
                            <div className="flex gap-1">
                              <button onClick={() => { setBetSide(0); placeBet(m.pubkey, 0); }} disabled={payTx === "pending"} className="liquid-glass rounded-full px-4 py-2 text-sm font-body text-green-300 disabled:opacity-30">YES</button>
                              <button onClick={() => { setBetSide(1); placeBet(m.pubkey, 1); }} disabled={payTx === "pending"} className="liquid-glass rounded-full px-4 py-2 text-sm font-body text-red-300 disabled:opacity-30">NO</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setBetMarket(m.pubkey.toString())} className="liquid-glass rounded-full px-4 py-2 text-sm font-body text-white hover:text-amber-300 transition-colors">Place Bet</button>
                        )}
                      </>
                    )}
                    {canOpen && <button onClick={() => openMarket(m.pubkey)} className="liquid-glass rounded-full px-4 py-2 text-sm font-body text-green-300 hover:text-green-200 transition-colors">Open Market</button>}
                    {canClose && <button onClick={() => closeBetting(m.pubkey)} className="liquid-glass rounded-full px-4 py-2 text-sm font-body text-yellow-300 hover:text-yellow-200 transition-colors">Close Betting</button>}
                    {canResolve && (
                      <>
                        <button onClick={() => resolveMarket(m.pubkey, true)} disabled={payTx === "pending"} className="liquid-glass rounded-full px-4 py-2 text-sm font-body text-green-300 disabled:opacity-30">Resolve YES</button>
                        <button onClick={() => resolveMarket(m.pubkey, false)} disabled={payTx === "pending"} className="liquid-glass rounded-full px-4 py-2 text-sm font-body text-red-300 disabled:opacity-30">Resolve NO</button>
                      </>
                    )}
                    {canCancel && <button onClick={() => cancelMarket(m.pubkey)} className="liquid-glass rounded-full px-4 py-2 text-sm font-body text-red-400/60 hover:text-red-400 transition-colors">Cancel</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Toast */}
        {status && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`liquid-glass-strong rounded-full px-6 py-3 text-sm font-body flex items-center gap-3 ${status.type === "error" ? "text-red-300" : status.type === "success" ? "text-green-300" : "text-amber-300"}`}>
              {status.type === "error" ? "✗" : status.type === "success" ? "✓" : "→"}
              <span>{status.msg}</span>
              {status.txHash && <a href={`https://solscan.io/tx/${status.txHash}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white underline">TX ↗</a>}
              <button onClick={() => setStatus(null)} className="ml-2 text-white/40 hover:text-white">✕</button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
