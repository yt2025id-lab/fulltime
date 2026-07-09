import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";
import { useProgram, FULLTIME_ID } from "../context/FullTimeContext";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Connection, clusterApiUrl } from "@solana/web3.js";
import { fetchFixtures, type TxLineFixture } from "../lib/txline";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import GlowCard from "../components/GlowCard";
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
  settlementRoot: string;
}

interface UIBet {
  market: string;
  optionIndex: number;
  amount: number;
  claimed: boolean;
  pubkey: PublicKey;
}

function lamportsToSol(lamports: number) { return (lamports / 1e9).toFixed(4); }
function solDisplay(lamports: number) { return Math.floor(lamports / LAMPORTS_PER_SOL).toString(); }

function flagEmoji(name: string): string {
  const m: Record<string, string> = {
    Argentina: "🇦🇷", Brazil: "🇧🇷", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", France: "🇫🇷",
    Germany: "🇩🇪", Spain: "🇪🇸", Portugal: "🇵🇹", Netherlands: "🇳🇱",
    Italy: "🇮🇹", Belgium: "🇧🇪", Uruguay: "🇺🇾", Colombia: "🇨🇴",
    Mexico: "🇲🇽", USA: "🇺🇸", Canada: "🇨🇦", Japan: "🇯🇵",
    "South Korea": "🇰🇷", Australia: "🇦🇺", Morocco: "🇲🇦", Senegal: "🇸🇳",
    Croatia: "🇭🇷", Switzerland: "🇨🇭", Norway: "🇳🇴", Sweden: "🇸🇪",
    Egypt: "🇪🇬", Ghana: "🇬🇭", Tunisia: "🇹🇳", Algeria: "🇩🇿",
    Ecuador: "🇪🇨", Paraguay: "🇵🇾", Austria: "🇦🇹", Turkey: "🇹🇷",
    "Saudi Arabia": "🇸🇦", Iran: "🇮🇷", "South Africa": "🇿🇦",
    "Cape Verde": "🇨🇻", "Ivory Coast": "🇨🇮", Cameroon: "🇨🇲",
    Nigeria: "🇳🇬", "New Zealand": "🇳🇿", Panama: "🇵🇦",
    Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Denmark: "🇩🇰", Poland: "🇵🇱",
    Czechia: "🇨🇿", Iraq: "🇮🇶", Jordan: "🇯🇴", Uzbekistan: "🇺🇿",
    Qatar: "🇶🇦", Vietnam: "🇻🇳", Myanmar: "🇲🇲",
  };
  return m[name] || "⚽";
}

function statusLabel(s: string): { label: string; color: string } {
  if (s === "pending") return { label: "Pending", color: "text-white/40" };
  if (s === "open") return { label: "Open", color: "text-green-400" };
  if (s === "closed") return { label: "Closed", color: "text-yellow-400" };
  if (s === "settled") return { label: "Settled", color: "text-red-400" };
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
  const { publicKey, connected, disconnect, wallet } = useWallet();
  const { connection } = useConnection();
  const program = useProgram();
  const [now, setNow] = useState(new Date());
  const [markets, setMarkets] = useState<UIMarket[]>([]);
  const [bets, setBets] = useState<UIBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("open");
  const [status, setStatus] = useState<{ type: string; msg: string; txHash?: string } | null>(null);

  const [question, setQuestion] = useState("");
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);

  const [fixtures, setFixtures] = useState<TxLineFixture[]>([]);
  const [showFixtures, setShowFixtures] = useState(true);

  const [betMarket, setBetMarket] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [betSide, setBetSide] = useState(0);
  const [payTx, setPayTx] = useState("idle");
  const [balance, setBalance] = useState<number | null>(null);
  const [showPortfolio, setShowPortfolio] = useState(false);

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
    if (!connection) return;
    setLoading(true);
    try {
      const idlPath = "/idl.json";
      const idl = await fetch(idlPath).then(r => r.json());
      const provider = new AnchorProvider(connection, { publicKey: PublicKey.default } as any, { commitment: "confirmed" });
      const prog = new Program(idl, provider);
      const all = await (prog as any).account.market.all();
      const mapped: UIMarket[] = all.map((a: any) => {
        const acc = a.account;
        const fStatus = Object.keys(acc.status || {})[0] || "pending";
        return {
          pubkey: a.publicKey,
          fixtureId: Number(acc.fixtureId ?? acc.fixture_id ?? 0),
          question: acc.question || "",
          creator: (acc.creator?.toBase58 ? acc.creator.toBase58() : String(acc.creator || "")),
          poolYes: Number(acc.poolYes ?? acc.pool_yes ?? 0),
          poolNo: Number(acc.poolNo ?? acc.pool_no ?? 0),
          totalPool: Number(acc.totalPool ?? acc.total_pool ?? 0),
          openTime: Number(acc.bettingOpenTime ?? acc.betting_open_time ?? 0),
          closeTime: Number(acc.bettingCloseTime ?? acc.betting_close_time ?? 0),
          status: fStatus,
          winningOption: acc.winningOption ?? acc.winning_option ?? 255,
          isTrustless: acc.isTrustless ?? acc.is_trustless ?? false,
          settlementRoot: acc.settlementRoot?.toBase58 ? acc.settlementRoot.toBase58() : (acc.settlement_root?.toBase58 ? acc.settlement_root.toBase58() : ""),
        };
      });
      setMarkets(mapped);
    } catch (e: any) { console.error("loadMarkets:", e.message); }
    setLoading(false);
  }, [connection]);

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

  useEffect(() => { loadMarkets(); }, [connection]);
  useEffect(() => { if (program && publicKey) loadBets(); }, [program, publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      loadMarkets(); loadBets();
      const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
      conn.getBalance(publicKey).then(b => setBalance(b)).catch(() => {});
    } else { setBalance(null); }
  }, [connected]);

  useEffect(() => {
    fetchFixtures().then(fixtures => {
      const wc = fixtures.filter((f: TxLineFixture) =>
        f.Competition?.toLowerCase().includes("world cup") || f.Competition?.toLowerCase().includes("wc")
      );
      setFixtures(wc.length > 0 ? wc : fixtures.slice(0, 12));
    }).catch(() => {});
  }, []);

  const reload = () => setTimeout(() => { loadMarkets(); loadBets(); }, 2000);

  const createFixtureMarket = async (f: TxLineFixture) => {
    if (!program || !publicKey) {
      setStatus({ type: "error", msg: "Wallet not connected or program not loaded" });
      return;
    }
    setCreating(true);
    try {
      const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
      const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
      const question = `Will ${home} beat ${away}?`;
      const nowTs = Math.floor(Date.now() / 1000);
      const openTime = nowTs + 10;
      const closeTime = openTime + 86400;
      mark("Creating market...");
      await program.methods
        .createMarket(new BN(f.FixtureId), question, new BN(openTime), new BN(closeTime), true)
        .accounts({ creator: publicKey, systemProgram: SystemProgram.programId })
        .rpc({ commitment: "confirmed" });
      const mpda = marketPda(publicKey, f.FixtureId);
      await program.methods.openMarket().accounts({ market: mpda }).rpc({ commitment: "confirmed" });
      setStatus({ type: "success", msg: `Market created & opened: ${home} vs ${away}` });
      reload();
    } catch (e: any) {
      const msg = e.message || String(e);
      console.error("createFixtureMarket error:", msg);
      setStatus({ type: "error", msg: msg.slice(0, 200) });
    }
    setCreating(false);
  };

  const createManualMarket = async () => {
    if (!program || !publicKey || !question || !deadline) return;
    setCreating(true);
    try {
      const dl = Math.floor(new Date(deadline).getTime() / 1000);
      const nowTs = Math.floor(Date.now() / 1000);
      const openTime = nowTs + 10;
      const closeTime = Math.max(openTime + 3600, dl);
      mark("Creating manual market...");
      await program.methods
        .createMarket(new BN(0), question, new BN(openTime), new BN(closeTime), false)
        .accounts({ creator: publicKey })
        .rpc();
      const mpda = marketPda(publicKey, 0);
      await program.methods.openMarket().accounts({ market: mpda }).rpc();
      setQuestion(""); setDeadline("");
      setStatus({ type: "success", msg: "Market created & opened!" });
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
      <div className="fixed inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1920&q=80)` }}>
        <div className="absolute inset-0 bg-green-950/75 backdrop-blur-[2px]" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-red-800/30 bg-[#c0392b]/95 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto grid grid-cols-3 items-center px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-white/70 hover:text-white font-mono transition-colors">&larr; Back</Link>
            <span className="text-lg">⚽</span>
            <span className="font-mono font-bold text-white text-lg tracking-tight">Full<span className="text-white/40">Time</span></span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Link to="/app" className="bg-white/15 rounded-full px-4 py-1.5 text-sm font-mono text-white font-medium">Markets</Link>
            <Link to="/matches" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">Matches</Link>
            <Link to="/faq" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">FAQ</Link>
            <Link to="/faucet" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">Faucet</Link>
          </div>
          <div className="flex items-center justify-end">
            {connected ? (
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-mono text-white/70">
                  <span className="text-white/40">◎</span> {balance !== null ? (balance / 1e9).toFixed(2) : "..."} SOL
                </div>
                <button onClick={() => setShowPortfolio(true)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white font-mono transition-colors">{publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}</button>
                <button onClick={disconnect} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-red-300 font-mono transition-colors">Disconnect</button>
              </div>
            ) : (
              <WalletMultiButton className="!bg-red-600 hover:!bg-red-500 !text-white !rounded-full !px-5 !py-2 !text-sm !font-semibold !font-mono !h-auto !transition-colors" />
            )}
          </div>
        </div>
      </nav>

      <div className="relative z-10 border-b border-red-800/20 bg-[#c0392b]/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-center gap-4 text-xs font-mono text-white/50">
          <span>{now.toLocaleDateString("en-US", { weekday: "long" })}</span>
          <span className="text-white/20">|</span>
          <span>{now.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}</span>
          <span className="text-white/20">|</span>
          <span>{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <motion.div {...fadeIn} transition={{ duration: 0.8, ease: "easeOut" }} className="text-center mb-10">
          <p className="text-sm font-mono text-red-300/60 mb-4">// Dashboard</p>
          <h1 className="font-mono tracking-[-1px] text-white text-5xl md:text-6xl lg:text-[5rem] leading-[0.9] tracking-[-3px]">
            World Cup<br /><span className="text-red-300">Prediction</span>
          </h1>
          <p className="text-xs text-white/40 font-mono mt-2">{markets.length} markets</p>
        </motion.div>

        {/* World Cup 2026 Fixtures — Auto-Create Markets */}
        {connected && fixtures.length > 0 && (
          <motion.div initial={{ filter: "blur(5px)", opacity: 0 }} animate={{ filter: "blur(0px)", opacity: 1 }} transition={{ duration: 0.6 }} className="liquid-glass-strong rounded-[1.25rem] p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono tracking-[-1px] text-white text-2xl">World Cup 2026 Fixtures</h2>
              <button onClick={() => setShowFixtures(!showFixtures)} className="text-xs font-mono text-white/40 hover:text-white transition-colors">{showFixtures ? "Hide" : "Show"}</button>
            </div>
            <p className="font-mono text-xs text-white/30 mb-4">Create a trustless prediction market directly from these TxLINE fixtures — auto-settled via Merkle proof CPI.</p>
            {showFixtures && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                {fixtures.filter(f => {
                  const fixtureId = f.FixtureId;
                  return !markets.some(m => m.fixtureId === fixtureId);
                }).slice(0, 8).map(f => {
                  const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
                  const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
                  const d = f.StartTime ? new Date(f.StartTime) : new Date();
                  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <div key={f.FixtureId} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between hover:border-red-400/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-white font-semibold">{flagEmoji(home)} {home} vs {away} {flagEmoji(away)}</div>
                        <div className="font-mono text-[10px] text-white/30 mt-1">#{f.FixtureId} · {dateStr} · Trustless</div>
                      </div>
                      <button
                        onClick={() => createFixtureMarket(f)}
                        disabled={creating}
                        className="ml-3 shrink-0 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-full px-4 py-2 text-xs font-mono font-semibold transition-colors"
                      >
                        Create & Bet
                      </button>
                    </div>
                  );
                })}
                {fixtures.filter(f => !markets.some(m => m.fixtureId === f.FixtureId)).length === 0 && (
                  <p className="col-span-2 text-center font-mono text-xs text-white/20 py-4">All fixtures have markets created</p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Wallet Card */}
        {connected && (
          <motion.div initial={{ filter: "blur(5px)", opacity: 0 }} animate={{ filter: "blur(0px)", opacity: 1 }} transition={{ duration: 0.6 }} className="liquid-glass-strong rounded-[1.25rem] p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs text-white/30 mb-1">{wallet?.adapter?.name || "Wallet"}</p>
                <p className="font-mono font-semibold text-white">{publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-6)}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs text-white/30 mb-1">Balance</p>
                <p className="font-mono font-semibold text-green-300">◎ {balance !== null ? (balance / 1e9).toFixed(3) : "..."} SOL</p>
              </div>
            </div>
            {(balance !== null && balance < 0.5 * 1e9) && (
              <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-xs font-mono text-yellow-300/70 text-center">Low balance — use <Link to="/faucet" className="underline text-yellow-300">Faucet</Link> to get test SOL</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Custom Market */}
        {connected && (
          <motion.div initial={{ filter: "blur(5px)", opacity: 0 }} animate={{ filter: "blur(0px)", opacity: 1 }} transition={{ duration: 0.6 }} className="liquid-glass-strong rounded-[1.25rem] p-6 mb-8">
            <h2 className="font-mono tracking-[-1px] text-white text-2xl tracking-[-1px] mb-4">Custom Market</h2>
            <p className="font-mono text-xs text-white/30 mb-3">Create a manual YES/NO market for any question. You resolve the outcome.</p>
            <div className="space-y-3">
              <input className="w-full bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm font-mono text-white placeholder-white/30 focus:outline-none focus:border-red-400/50 transition-all" placeholder="Will Argentina win the 2026 World Cup?" value={question} onChange={e => setQuestion(e.target.value)} />
              <div className="flex flex-col sm:flex-row gap-3">
                <input className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm font-mono text-white placeholder-white/30 focus:outline-none focus:border-red-400/50" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
              </div>
              <div className="flex items-center gap-4">
                <div className="liquid-glass rounded-full px-4 py-2 text-sm font-mono text-white/60">Fee: <span className="text-red-300 font-medium">2%</span></div>
              </div>
              <button onClick={createManualMarket} disabled={creating || !question || !deadline} className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-black rounded-full px-5 py-3 text-sm font-semibold font-mono disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/20">{creating ? "Creating..." : "Create Market"}</button>
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4">
          {["all", "open", "settled"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-mono text-xs font-semibold uppercase px-4 py-1.5 rounded-full transition-all ${
                filter === f
                  ? "bg-red-500 text-black"
                  : "bg-white/[0.05] text-white/40 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Markets */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono tracking-[-1px] text-white text-3xl tracking-[-1px]">Markets <span className="text-white/30 text-lg">({markets.filter(m => m.status !== "cancelled").length})</span></h2>
          <button onClick={reload} disabled={loading} className="liquid-glass rounded-full px-4 py-2 text-sm font-mono text-white/60 hover:text-white disabled:opacity-40">{loading ? "Loading..." : "Refresh"}</button>
        </div>

        {!connected ? (
          <div className="text-center py-20">
            <div className="liquid-glass w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><span className="font-mono tracking-[-1px] text-white/40 text-3xl lowercase">f</span></div>
            <p className="text-white/40 font-mono text-sm">Connect wallet to view markets</p>
          </div>
        ) : markets.length === 0 && !loading ? (
          <div className="text-center py-20"><p className="text-white/40 font-mono text-sm">No markets yet — create one above</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {markets.filter(m => {
              if (m.status === "cancelled") return false;
              if (filter === "all") return true;
              return m.status === filter;
            }).map((m, idx) => {
              const st = statusLabel(m.status);
              const myBet = myBetOnMarket(m.pubkey.toString());
              const yesPct = m.totalPool > 0 ? (m.poolYes * 100 / m.totalPool).toFixed(1) : "50";
              const isCreator = publicKey && m.creator === publicKey.toBase58();
              const canResolve = isCreator && !m.isTrustless && m.status === "closed";
              const canClose = m.status === "open" && now.getTime() / 1000 > m.closeTime;
              const canOpen = m.status === "pending";
              const canCancel = isCreator && ["pending", "open", "closed"].includes(m.status);
              const isCancelled = m.status === "cancelled";

              const fixture = fixtures.find(f => f.FixtureId === m.fixtureId);
              const home = fixture ? (fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2) : null;
              const away = fixture ? (fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1) : null;

              return (
                <GlowCard key={m.pubkey.toString()} className="!min-h-0">
                  <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-xs text-white/30 font-mono">#{m.fixtureId || idx + 1}</span>
                      {m.isTrustless && <span className="ml-2 text-xs text-green-400 font-mono bg-green-400/10 rounded-full px-2 py-0.5 inline-flex items-center gap-0.5">⚡ TRUSTLESS</span>}
                      {!m.isTrustless && <span className="ml-2 text-xs text-blue-400/60 font-mono bg-blue-400/10 rounded-full px-2 py-0.5">Manual</span>}
                      {m.isTrustless && m.status === "settled" && m.settlementRoot && (
                        <span className="ml-2 text-xs text-green-300/70 font-mono bg-green-500/5 rounded-full px-2 py-0.5 border border-green-500/10">TxLINE verified · {f(m.settlementRoot)}</span>
                      )}
                    </div>
                    <span className={`text-xs font-mono font-semibold ${st.color}`}>{st.label}</span>
                  </div>
                  <p className="text-white font-mono font-medium text-sm mb-1">{m.question}</p>
                  {home && away && (
                    <p className="text-xs text-white/20 font-mono mb-1">{flagEmoji(home)} {home} vs {away} {flagEmoji(away)}</p>
                  )}
                  <p className="text-xs text-white/30 font-mono mb-3">Deadline: {dt(m.closeTime)}</p>

                  {!isCancelled && (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-green-500/10 rounded-xl p-2 text-center">
                          <p className="text-xs text-green-300/80 font-mono">YES</p>
                          <p className="text-sm text-green-300 font-mono font-semibold">{lamportsToSol(m.poolYes)} SOL</p>
                        </div>
                        <div className="bg-red-500/10 rounded-xl p-2 text-center">
                          <p className="text-xs text-red-300/80 font-mono">NO</p>
                          <p className="text-sm text-red-300 font-mono font-semibold">{lamportsToSol(m.poolNo)} SOL</p>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all" style={{ width: `${yesPct}%` }} />
                      </div>
                      <p className="text-xs text-white/30 font-mono text-center mb-3">{yesPct}% YES</p>
                    </>
                  )}

                  {myBet && (
                    <div className="mb-3 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-xs text-white/50 font-mono">Your bet: <span className={myBet.optionIndex === 0 ? "text-green-300" : "text-red-300"}>{myBet.optionIndex === 0 ? "YES" : "NO"} {lamportsToSol(myBet.amount)} SOL</span>
                        {myBet.claimed && <span className="ml-1 text-red-400">(Claimed)</span>}
                      </p>
                      {isCancelled && !myBet.claimed && (
                        <button onClick={() => refundBet(m.pubkey, myBet.pubkey)} className="mt-2 w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-full py-1.5 text-xs font-mono font-semibold transition-colors">Refund</button>
                      )}
                      {m.status === "settled" && myBet.optionIndex === m.winningOption && !myBet.claimed && (
                        <button onClick={() => claimPayout(m.pubkey, myBet.pubkey)} className="mt-2 w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-black rounded-full py-1.5 text-xs font-mono font-semibold transition-all">Claim Winnings</button>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {m.status === "open" && (
                      <>
                        {betMarket === m.pubkey.toString() ? (
                          <div className="w-full flex gap-2">
                            <input type="number" step="0.01" min="0.01" className="flex-1 bg-white/5 border border-white/10 rounded-full px-3 py-2 text-sm font-mono text-white placeholder-white/30 focus:outline-none focus:border-red-400/50" placeholder="SOL amount" value={betAmount} onChange={e => setBetAmount(e.target.value)} autoFocus />
                            <div className="flex gap-1">
                              <button onClick={() => { setBetSide(0); placeBet(m.pubkey, 0); }} disabled={payTx === "pending"} className="liquid-glass rounded-full px-4 py-2 text-sm font-mono text-green-300 disabled:opacity-30">YES</button>
                              <button onClick={() => { setBetSide(1); placeBet(m.pubkey, 1); }} disabled={payTx === "pending"} className="liquid-glass rounded-full px-4 py-2 text-sm font-mono text-red-300 disabled:opacity-30">NO</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setBetMarket(m.pubkey.toString())} className="liquid-glass rounded-full px-4 py-2 text-sm font-mono text-white hover:text-red-300 transition-colors">Place Bet</button>
                        )}
                      </>
                    )}
                    {canOpen && <button onClick={() => openMarket(m.pubkey)} className="liquid-glass rounded-full px-4 py-2 text-sm font-mono text-green-300 hover:text-green-200 transition-colors">Open Market</button>}
                    {canClose && <button onClick={() => closeBetting(m.pubkey)} className="liquid-glass rounded-full px-4 py-2 text-sm font-mono text-yellow-300 hover:text-yellow-200 transition-colors">Close Betting</button>}
                    {canResolve && (
                      <>
                        <button onClick={() => resolveMarket(m.pubkey, true)} disabled={payTx === "pending"} className="liquid-glass rounded-full px-4 py-2 text-sm font-mono text-green-300 disabled:opacity-30">Resolve YES</button>
                        <button onClick={() => resolveMarket(m.pubkey, false)} disabled={payTx === "pending"} className="liquid-glass rounded-full px-4 py-2 text-sm font-mono text-red-300 disabled:opacity-30">Resolve NO</button>
                      </>
                    )}
                    {canCancel && <button onClick={() => cancelMarket(m.pubkey)} className="liquid-glass rounded-full px-4 py-2 text-sm font-mono text-red-400/60 hover:text-red-400 transition-colors">Cancel</button>}
                  </div>
                  </div>
                </GlowCard>
              );
            })}
          </div>
        )}

        {/* Portfolio Drawer */}
        {showPortfolio && (
          <div className="fixed inset-0 z-50 flex" onClick={() => setShowPortfolio(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="ml-auto w-full max-w-md h-full bg-[#111] border-l border-white/10 overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-mono font-bold text-white text-xl">Portfolio</h2>
                  <button onClick={() => setShowPortfolio(false)} className="text-white/40 hover:text-white font-mono text-sm">✕</button>
                </div>
                {publicKey && <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-6">
                  <div className="text-xs text-white/40 font-mono mb-1">Wallet</div>
                  <div className="font-mono text-xs text-white/50 break-all">{publicKey.toBase58().slice(0,12)}...{publicKey.toBase58().slice(-4)}</div>
                  <div className="mt-2 font-mono text-lg text-white font-bold">{balance !== null ? solDisplay(balance) : "—"} <span className="text-red-300/60 text-sm">SOL</span></div>
                </div>}
                {bets.length === 0 ? (
                  <p className="text-white/30 font-mono text-sm text-center py-8">No bets yet</p>
                ) : (
                  <div className="space-y-3">{bets.map(b => {
                    const m = markets.find(x => x.pubkey.toString() === b.market);
                    const won = m?.status === "settled" && b.optionIndex === m.winningOption;
                    const canClaim = won && !b.claimed;
                    const canRefund = m?.status === "cancelled" && !b.claimed;
                    return <div key={b.pubkey.toString()} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                      <div className="text-xs text-white/50 font-mono truncate mb-2">{m?.question || b.market.slice(0,20)}</div>
                      <div className="flex items-center justify-between">
                        <div><span className={`font-mono text-sm font-bold ${b.optionIndex===0?"text-green-400":"text-red-400"}`}>{b.optionIndex===0?"YES":"NO"}</span><span className="font-mono text-sm text-white/60 ml-2">{lamportsToSol(b.amount)} SOL</span></div>
                        <div className="flex items-center gap-2">
                          {b.claimed ? <span className="text-xs text-green-400/60 font-mono">Claimed ✓</span> :
                           canClaim ? <button onClick={() => claimPayout(new PublicKey(b.market), b.pubkey)} className="bg-green-600 hover:bg-green-500 text-white rounded-full px-3 py-1 text-xs font-mono font-semibold">Claim</button> :
                           canRefund ? <button onClick={() => refundBet(new PublicKey(b.market), b.pubkey)} className="bg-yellow-600 hover:bg-yellow-500 text-white rounded-full px-3 py-1 text-xs font-mono font-semibold">Refund</button> :
                           <span className="text-xs text-white/20 font-mono">{m?.status||"—"}</span>}
                        </div>
                      </div>
                    </div>;
                  })}</div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Toast */}
        {status && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`liquid-glass-strong rounded-full px-6 py-3 text-sm font-mono flex items-center gap-3 ${status.type === "error" ? "text-red-300" : status.type === "success" ? "text-green-300" : "text-red-300"}`}>
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
