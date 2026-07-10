import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";
import { useProgram, FULLTIME_ID } from "../context/FullTimeContext";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Connection, clusterApiUrl } from "@solana/web3.js";
import { fetchFixtures, type TxLineFixture } from "../lib/txline";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
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
    [Buffer.from("market"), new PublicKey(FULLTIME_ID).toBytes(), creator.toBytes(), buf],
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

  function showMarket(fixtureId: number): boolean {
    return fixtureId === 0 || [18218149, 18213979, 18222446].includes(fixtureId);
  }
  const [showFixtures, setShowFixtures] = useState(true);
  const [fixtureQType, setFixtureQType] = useState<Record<number, "win" | "draw" | "lose">>({});

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
      // Market discriminator: first 8 bytes of SHA256("account:Market") → bs58
      const discB58 = "dkokXHR3DTw";

      const resp = await fetch(connection.rpcEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "getProgramAccounts",
          params: [FULLTIME_ID, {
            commitment: "confirmed",
            encoding: "base64",
            filters: [{ memcmp: { offset: 0, bytes: discB58 } }],
          }],
        }),
      });
      const raw = await resp.json();

      const mapped: UIMarket[] = (raw.result || []).map((r: any) => {
        const data = Uint8Array.from(atob(r.account.data[0]), c => c.charCodeAt(0));
        let off = 8; // skip discriminator
        const readU64 = (o: number) => { const v = new DataView(data.buffer.slice(data.byteOffset + o, data.byteOffset + o + 8)); return Number(v.getBigUint64(0, true)); };
        const readI64 = (o: number) => { const v = new DataView(data.buffer.slice(data.byteOffset + o, data.byteOffset + o + 8)); return Number(v.getBigInt64(0, true)); };
        const readU32 = (o: number) => { const v = new DataView(data.buffer.slice(data.byteOffset + o, data.byteOffset + o + 4)); return v.getUint32(0, true); };
        const readU16 = (o: number) => { const v = new DataView(data.buffer.slice(data.byteOffset + o, data.byteOffset + o + 2)); return v.getUint16(0, true); };
        const readU8 = (o: number) => data[o];

        const fixtureId = readU64(off); off += 8;
        const qLen = readU32(off); off += 4;
        const question = new TextDecoder().decode(data.slice(off, off + qLen)); off += qLen;
        const creator = new PublicKey(data.slice(off, off + 32)); off += 32;
        off += 1; // outcome_count
        off += 8; // total_pool
        const poolYes = readU64(off); off += 8;
        const poolNo = readU64(off); off += 8;
        off += 8; // betting_open_time
        const closeTime = readI64(off); off += 8;
        const statusByte = readU8(off); off += 1;
        off += 1; // winning_option
        const isTrustless = readU8(off) === 1;

        const statusMap = ["pending", "open", "closed", "settled", "cancelled"];
        return {
          pubkey: new PublicKey(r.pubkey),
          fixtureId,
          question,
          creator: creator.toBase58(),
          poolYes, poolNo, totalPool: poolYes + poolNo,
          openTime: 0, closeTime,
          status: statusMap[statusByte] || "created",
          winningOption: 255, isTrustless,
          settlementRoot: "",
        };
      });
      setMarkets(mapped);
    } catch (e: any) { console.error("loadMarkets:", e.message); }
    setLoading(false);
  }, [connection]);

  const loadBets = useCallback(async () => {
    if (!program || !publicKey) return;
    try {
      const betDiscB58 = (program as any).coder.accounts.memcmp("bet")?.bytes;
      if (!betDiscB58) return;
      const resp = await fetch(connection.rpcEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "getProgramAccounts",
          params: [FULLTIME_ID, {
            commitment: "confirmed",
            encoding: "base64",
            filters: [
              { memcmp: { offset: 0, bytes: betDiscB58 } },
              { memcmp: { offset: 8, bytes: publicKey.toBase58() } },
            ],
          }],
        }),
      });
      const raw = await resp.json();
      const list: UIBet[] = (raw.result || []).map((r: any) => {
        const data = Uint8Array.from(atob(r.account.data[0]), c => c.charCodeAt(0));
        const readU64 = (o: number) => Number(new DataView(data.buffer.slice(data.byteOffset + o, data.byteOffset + o + 8)).getBigUint64(0, true));
        const readU8 = (o: number) => data[o];
        return {
          market: new PublicKey(data.slice(40, 72)).toString(),
          optionIndex: readU8(72),
          amount: readU64(73),
          claimed: readU8(81) === 1,
          pubkey: new PublicKey(r.pubkey),
        };
      });
      setBets(list);
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

  const createFixtureMarket = async (f: TxLineFixture, qType?: "win" | "draw" | "lose") => {
    if (!program || !publicKey) {
      setStatus({ type: "error", msg: "Wallet not connected or program not loaded" });
      return;
    }
    setCreating(true);
    try {
      const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
      const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
      const question = qType === "draw"
        ? `Will ${home} lose or draw?`
        : qType === "lose"
        ? `Will ${home} lose?`
        : `Will ${home} beat ${away}?`;
      const nowTs = Math.floor(Date.now() / 1000);
      const openTime = nowTs + 300; // 5 min from now
      const matchTs = Math.floor(new Date(f.StartTime).getTime() / 1000);
      const closeTime = Math.max(openTime + 60, matchTs); // close at kickoff
      mark("Creating market...");
      await program.methods
        .createMarket(new BN(f.FixtureId), question, new BN(openTime), new BN(closeTime), true)
        .accounts({ creator: publicKey, systemProgram: SystemProgram.programId })
        .rpc({ commitment: "confirmed" });
      const mpda = marketPda(publicKey, f.FixtureId);
      await program.methods.openMarket().accounts({ market: mpda }).rpc({ commitment: "confirmed" });
      setStatus({ type: "success", msg: `Market created & opened: ${question}` });
      reload();
    } catch (e: any) {
      const msg = e.message || String(e);
      console.error("createFixtureMarket error:", msg);
      if (msg.includes("already in use")) {
        setStatus({ type: "error", msg: "This wallet already has a market for this fixture. Switch to another wallet (disconnect → select wallet) and try again." });
      } else {
        setStatus({ type: "error", msg: msg.slice(0, 200) });
      }
    }
    setCreating(false);
  };

  const createManualMarket = async () => {
    if (!program || !publicKey || !question || !deadline) return;
    setCreating(true);
    try {
      const dl = Math.floor(new Date(deadline).getTime() / 1000);
      const nowTs = Math.floor(Date.now() / 1000);
      const openTime = nowTs + 300; // 5 min from now
      const closeTime = Math.max(openTime + 3600, dl + 60);
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
        [Buffer.from("bet"), marketPk.toBytes(), publicKey.toBytes()],
        new PublicKey(FULLTIME_ID)
      )[0];
      await program.methods.placeBet(optionIndex, new BN(amount))
        .accounts({ bettor: publicKey, market: marketPk, bet: betPda, systemProgram: SystemProgram.programId })
        .rpc();
      setBetAmount(""); setBetMarket(null);
      setStatus({ type: "success", msg: `Bet ${optionIndex === 0 ? "YES" : "NO"} ${betAmount} SOL!` });
      setPayTx("success"); setTimeout(() => setPayTx("idle"), 2000);
      reload();
    } catch (e: any) { setPayTx("fail"); console.error("placeBet err:", e); setStatus({ type: "error", msg: e.message?.slice(0, 120) || String(e) }); }
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
          <p className="text-xs text-white/40 font-mono mt-2">{markets.filter(m => m.status !== "cancelled" && showMarket(m.fixtureId)).length} markets</p>
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
                {fixtures.slice(0, 8).map(f => {
                  const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
                  const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
                  const d = f.StartTime ? new Date(f.StartTime) : new Date();
                  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const qt = fixtureQType[f.FixtureId] || "win";
                  const existing = markets.filter(m => m.fixtureId === f.FixtureId && (m.status === "open" || m.status === "pending" || m.status === "settled"));
                  const hasExisting = existing.length > 0;
                  return (
                    <div key={f.FixtureId} className="group relative w-full overflow-hidden rounded-2xl bg-neutral-950 p-5 font-sans shadow-2xl border border-neutral-800/50">
                      <div className="absolute -top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-red-500/10 blur-3xl transition-all duration-700 group-hover:bg-red-500/15"></div>
                      <div className="relative flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                          <div>
                            <div className="font-semibold text-neutral-200 text-sm"><span className="text-xl">{flagEmoji(home)}</span> {home} vs {away} <span className="text-xl">{flagEmoji(away)}</span></div>
                            <div className="text-[10px] text-neutral-500 font-mono mt-1">#{f.FixtureId} · {dateStr} · Trustless</div>
                          </div>
                        </div>
                        <p className="text-sm text-neutral-200 font-medium leading-snug">{qt === "win" ? `Will ${home} beat ${away}?` : qt === "draw" ? `Will ${home} lose or draw?` : `Will ${home} lose?`}</p>
                        <div className="flex divide-x divide-neutral-800 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setFixtureQType(p => ({ ...p, [f.FixtureId]: "win" }))}
                            className={`flex-1 pr-3 text-left py-1 transition-all ${qt === "win" ? "bg-green-500/15" : "opacity-50 hover:opacity-100"}`}
                          ><p className={`text-[10px] font-medium font-mono ${qt === "win" ? "text-green-300" : "text-neutral-500"}`}>Win</p><p className={`text-xl font-semibold ${qt === "win" ? "text-green-200" : "text-neutral-300"}`}>{flagEmoji(home)}</p></button>
                          <button
                            onClick={() => setFixtureQType(p => ({ ...p, [f.FixtureId]: "draw" }))}
                            className={`flex-1 px-3 text-center py-1 transition-all ${qt === "draw" ? "bg-yellow-500/15" : "opacity-50 hover:opacity-100"}`}
                          ><p className={`text-[10px] font-medium font-mono ${qt === "draw" ? "text-yellow-300" : "text-neutral-500"}`}>Draw</p><p className={`text-xl font-semibold ${qt === "draw" ? "text-yellow-200" : "text-neutral-300"}`}>⚖️</p></button>
                          <button
                            onClick={() => setFixtureQType(p => ({ ...p, [f.FixtureId]: "lose" }))}
                            className={`flex-1 pl-3 text-right py-1 transition-all ${qt === "lose" ? "bg-red-500/15" : "opacity-50 hover:opacity-100"}`}
                          ><p className={`text-[10px] font-medium font-mono ${qt === "lose" ? "text-red-300" : "text-neutral-500"}`}>Lose</p><p className={`text-xl font-semibold ${qt === "lose" ? "text-red-200" : "text-neutral-300"}`}>{flagEmoji(away)}</p></button>
                        </div>
                        {hasExisting && (
                          <p className="text-[10px] font-mono text-yellow-400/60">Market exists · switch wallet</p>
                        )}
                        <button
                          onClick={() => createFixtureMarket(f, qt)}
                          disabled={creating}
                          className="rounded-lg border border-red-400/50 bg-transparent px-4 py-2 text-xs font-medium text-red-400 transition-colors duration-300 hover:bg-red-400 hover:text-neutral-950 disabled:opacity-30"
                        >Create & Bet</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Wallet Card */}
        {connected && (
          <motion.div initial={{ filter: "blur(5px)", opacity: 0 }} animate={{ filter: "blur(0px)", opacity: 1 }} transition={{ duration: 0.6 }} className="liquid-glass-strong rounded-[1.25rem] p-6 mb-8">
            <div className="group relative w-full overflow-hidden rounded-2xl bg-neutral-950 p-5 font-sans shadow-2xl border border-neutral-800/50">
              <div className="absolute -top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-red-500/10 blur-3xl transition-all duration-700 group-hover:bg-red-500/15"></div>
              <div className="relative flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                  <div>
                    <p className="text-[10px] font-medium text-neutral-500 font-mono">{wallet?.adapter?.name || "Wallet"}</p>
                    <p className="font-semibold text-neutral-200 text-sm">{publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-6)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium text-neutral-500 font-mono">Balance</p>
                    <p className="text-base font-semibold text-green-300">◎ {balance !== null ? (balance / 1e9).toFixed(3) : "..."} SOL</p>
                  </div>
                </div>
                {(balance !== null && balance < 0.5 * 1e9) && (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-xs font-mono text-yellow-300/70 text-center">Low balance — use <Link to="/faucet" className="underline text-yellow-300">Faucet</Link> to get test SOL</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Custom Market */}
        {connected && (
          <motion.div initial={{ filter: "blur(5px)", opacity: 0 }} animate={{ filter: "blur(0px)", opacity: 1 }} transition={{ duration: 0.6 }} className="liquid-glass-strong rounded-[1.25rem] p-6 mb-8">
            <div className="group relative w-full overflow-hidden rounded-2xl bg-neutral-950 p-5 font-sans shadow-2xl border border-neutral-800/50 max-w-lg mx-auto">
              <div className="absolute -top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-red-500/10 blur-3xl transition-all duration-700 group-hover:bg-red-500/15"></div>
              <div className="relative flex flex-col gap-4">
                <div className="border-b border-neutral-800 pb-4">
                  <p className="font-semibold text-neutral-200 text-sm">Custom Market</p>
                  <p className="text-[10px] text-neutral-500 font-mono mt-1">Create a manual YES/NO market for any question. You resolve the outcome.</p>
                </div>
                <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-red-400/50" placeholder="Will Argentina win the 2026 World Cup?" value={question} onChange={e => setQuestion(e.target.value)} />
                <div className="flex flex-col sm:flex-row gap-3">
                  <input className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-red-400/50" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-[10px] font-mono text-neutral-500">Fee: <span className="text-red-400 font-medium">2%</span></p>
                </div>
                <button onClick={createManualMarket} disabled={creating || !question || !deadline} className="w-full rounded-lg border border-red-400/50 bg-transparent px-4 py-2 text-xs font-medium text-red-400 transition-colors duration-300 hover:bg-red-400 hover:text-neutral-950 disabled:opacity-30">{creating ? "Creating..." : "Create Market"}</button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4">
          {["all", "pending", "open", "closed", "settled"].map((f) => (
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
          <h2 className="font-mono tracking-[-1px] text-white text-3xl tracking-[-1px]">Markets <span className="text-white/30 text-lg">({markets.filter(m => {
            if (m.status === "cancelled") return false;
            if (!m.isTrustless && m.status === "settled") return false;
            if (!showMarket(m.fixtureId)) return false;
            return true;
          }).length})</span></h2>
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
              if (filter === "open") return m.status === "open";
              return m.status === filter;
            }).filter(m => {
              if (!m.isTrustless && m.status === "settled") return false;
              if (!showMarket(m.fixtureId)) return false;
              return true;
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
                <div key={m.pubkey.toString()} className="group relative w-full overflow-hidden rounded-2xl bg-neutral-950 p-5 font-sans shadow-2xl border border-neutral-800/50">
                  <div className="absolute -top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-red-500/10 blur-3xl transition-all duration-700 group-hover:bg-red-500/15"></div>
                  <div className="relative flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-400/10">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" />
                            <path d="M12 14m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
                            <path d="M14 4v4h-4" />
                          </svg>
                        </div>
                        <div>
                           <p className="font-semibold text-neutral-200 text-sm">{fixture ? <><span className="text-xl">{flagEmoji(home!)}</span> {fixture.Participant1} vs {fixture.Participant2} <span className="text-xl">{flagEmoji(away!)}</span></> : 'Custom Market'}</p>
                          <p className="text-[10px] text-neutral-500 font-mono">#{m.fixtureId || idx + 1}{m.isTrustless && ' · Trustless'}{!m.isTrustless && ' · Manual'}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono font-semibold px-2 py-1 rounded-full ${st.color}`}>{st.label}</span>
                    </div>

                    {/* Question */}
                    <p className="text-sm text-neutral-200 font-medium leading-snug">{m.question}</p>

                    {/* Pools */}
                    <div className="flex divide-x divide-neutral-800">
                      <div className="flex-1 pr-3">
                        <p className="text-[10px] font-medium text-neutral-500 font-mono">YES</p>
                        <p className="text-base font-semibold text-green-400">{lamportsToSol(m.poolYes)} SOL</p>
                      </div>
                      <div className="flex-1 pl-3">
                        <p className="text-[10px] font-medium text-neutral-500 font-mono">NO</p>
                        <p className="text-base font-semibold text-red-400">{lamportsToSol(m.poolNo)} SOL</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-6 w-full">
                      <div className="h-full w-full rounded-full bg-neutral-800 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-green-500 transition-all" style={{ width: `${yesPct}%` }} />
                      </div>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white/70 font-semibold">{yesPct}% YES</span>
                    </div>

                    {/* Deadline */}
                    <p className="text-[10px] font-mono text-neutral-500">Deadline: {dt(m.closeTime)}</p>

                    {/* Your Bet */}
                    {myBet && (
                      <div className="border-t border-neutral-800 pt-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-neutral-400 font-mono">Your bet: <span className={myBet.optionIndex === 0 ? "text-green-400" : "text-red-400"}>{myBet.optionIndex === 0 ? "YES" : "NO"} {lamportsToSol(myBet.amount)} SOL</span>
                            {myBet.claimed && <span className="ml-1 text-red-400">(Claimed)</span>}
                          </p>
                        </div>
                        {isCancelled && !myBet.claimed && (
                          <button onClick={() => refundBet(m.pubkey, myBet.pubkey)} className="mt-2 w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-2 text-xs font-medium text-red-400 transition-colors duration-300 hover:bg-red-400 hover:text-neutral-950">Refund</button>
                        )}
                        {m.status === "settled" && myBet.optionIndex === m.winningOption && !myBet.claimed && (
                          <button onClick={() => claimPayout(m.pubkey, myBet.pubkey)} className="mt-2 w-full rounded-lg border border-green-500/50 bg-transparent px-4 py-2 text-xs font-medium text-green-400 transition-colors duration-300 hover:bg-green-400 hover:text-neutral-950">Claim Winnings</button>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="border-t border-neutral-800 pt-3 flex flex-wrap gap-2">
                      {m.status === "open" && (
                        <>
                          {betMarket === m.pubkey.toString() ? (
                            <div className="w-full flex gap-2">
                              <input type="number" step="0.01" min="0.01" className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-red-400/50" placeholder="SOL amount" value={betAmount} onChange={e => setBetAmount(e.target.value)} autoFocus />
                              <button onClick={() => { setBetSide(0); placeBet(m.pubkey, 0); }} disabled={payTx === "pending" || !!myBet} className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors duration-300 disabled:opacity-30 ${myBet?.optionIndex === 0 ? 'border-green-500/50 bg-green-500/10 text-green-400' : 'border-green-500/50 bg-transparent text-green-400 hover:bg-green-400 hover:text-neutral-950'}`}>{myBet?.optionIndex === 0 ? '✓ BET YES' : 'YES'}</button>
                              <button onClick={() => { setBetSide(1); placeBet(m.pubkey, 1); }} disabled={payTx === "pending" || !!myBet} className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors duration-300 disabled:opacity-30 ${myBet?.optionIndex === 1 ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-red-500/50 bg-transparent text-red-400 hover:bg-red-400 hover:text-neutral-950'}`}>{myBet?.optionIndex === 1 ? '✓ BET NO' : 'NO'}</button>
                            </div>
                          ) : (
                            <button onClick={() => setBetMarket(m.pubkey.toString())} className="flex-1 rounded-lg border border-red-400/50 bg-transparent px-4 py-2 text-xs font-medium text-red-400 transition-colors duration-300 hover:bg-red-400 hover:text-neutral-950">Place Bet</button>
                          )}
                        </>
                      )}
                      {canOpen && <button onClick={() => openMarket(m.pubkey)} className="flex-1 rounded-lg border border-green-500/50 bg-transparent px-4 py-2 text-xs font-medium text-green-400 transition-colors duration-300 hover:bg-green-400 hover:text-neutral-950">Open Market</button>}
                      {canClose && <button onClick={() => closeBetting(m.pubkey)} className="flex-1 rounded-lg border border-yellow-500/50 bg-transparent px-4 py-2 text-xs font-medium text-yellow-400 transition-colors duration-300 hover:bg-yellow-400 hover:text-neutral-950">Close Betting</button>}
                      {canResolve && (
                        <>
                          <button onClick={() => resolveMarket(m.pubkey, true)} disabled={payTx === "pending"} className="flex-1 rounded-lg border border-green-500/50 bg-transparent px-4 py-2 text-xs font-medium text-green-400 transition-colors duration-300 hover:bg-green-400 hover:text-neutral-950 disabled:opacity-30">Resolve YES</button>
                          <button onClick={() => resolveMarket(m.pubkey, false)} disabled={payTx === "pending"} className="flex-1 rounded-lg border border-red-500/50 bg-transparent px-4 py-2 text-xs font-medium text-red-400 transition-colors duration-300 hover:bg-red-400 hover:text-neutral-950 disabled:opacity-30">Resolve NO</button>
                        </>
                      )}
                      {canCancel && <button onClick={() => cancelMarket(m.pubkey)} className="rounded-lg border border-neutral-700 bg-transparent px-4 py-2 text-xs font-medium text-neutral-500 transition-colors duration-300 hover:bg-red-400 hover:text-neutral-950 hover:border-red-400">🗑</button>}
                    </div>
                  </div>
                </div>
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
