import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModalButton } from "@solana/wallet-adapter-react-ui";
import { Connection, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";
import { motion } from "framer-motion";
import GlowCard from "../components/GlowCard";

function f(a: string) { return `${a.slice(0, 6)}...${a.slice(-4)}`; }
function solDisplay(lp: number) { return Math.floor(lp / LAMPORTS_PER_SOL).toString(); }

const fadeIn = {
  initial: { filter: "blur(8px)", opacity: 0, y: 20 },
  animate: { filter: "blur(0px)", opacity: 1, y: 0 },
};

export default function Faucet() {
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
      conn.getBalance(publicKey).then(setBalance).catch(() => {});
    }
  }, [connected, publicKey]);

  const requestAirdrop = async () => {
    if (!publicKey) return;
    setLoading(true);
    setStatus(null);
    try {
      const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
      const sig = await conn.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig, "confirmed");
      const bal = await conn.getBalance(publicKey);
      setBalance(bal);
      setStatus({ type: "success", msg: `+1 SOL! Balance: ${solDisplay(bal)} SOL` });
    } catch (e: any) {
      const msg = (e.message || String(e)).toLowerCase();
      if (msg.includes("429") || msg.includes("rate")) {
        setStatus({ type: "error", msg: "Rate limited. Use faucet.solana.com directly." });
      } else {
        setStatus({ type: "error", msg: "Request failed. Try faucet.solana.com." });
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black relative">
      <div className="fixed inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1920&q=80)" }}>
        <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-emerald-500/20 bg-zinc-900/90 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto grid grid-cols-3 items-center px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to="/app" className="text-sm text-white/70 hover:text-white font-mono transition-colors">&larr; Back</Link>
            <span className="text-lg">⚽</span>
            <span className="font-mono font-bold text-white text-lg">Full<span className="text-white/40">Time</span></span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Link to="/app" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">Markets</Link>
            <Link to="/matches" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">Matches</Link>
            <Link to="/faq" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">FAQ</Link>
            <Link to="/faucet" className="bg-white/15 rounded-full px-4 py-1.5 text-sm font-mono text-white font-medium">Faucet</Link>
          </div>
          <div />
        </div>
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-4 sm:px-6 py-16">
        <motion.div {...fadeIn} transition={{ duration: 0.6 }} className="text-center mb-10">
          <p className="text-sm font-mono text-amber-400/60 mb-4">// Faucet</p>
          <h1 className="font-mono font-bold text-white text-5xl md:text-6xl tracking-[-2px] mb-4">
            Devnet <span className="text-amber-400/60">SOL</span>
          </h1>
          <p className="font-mono text-sm text-white/40">Free test SOL for FullTime on Solana Devnet</p>
        </motion.div>

        {connected && publicKey && (
          <motion.div {...fadeIn} transition={{ duration: 0.5 }} className="mb-6">
            <GlowCard className="!min-h-0">
              <div className="p-4 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="font-mono text-white text-sm font-semibold">Phantom Wallet</div>
                  <div className="font-mono text-xs text-white/30">{f(publicKey.toBase58())}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-white/40">Balance</div>
                  <div className="font-mono text-white text-xl font-bold">{balance !== null ? solDisplay(balance) : "—"} <span className="text-amber-400/60 text-sm">SOL</span></div>
                  <div className="font-mono text-[10px] text-amber-400/50 mt-0.5">Devnet — no real value</div>
                </div>
              </div>
            </GlowCard>
          </motion.div>
        )}

        {!connected ? (
          <motion.div {...fadeIn} transition={{ duration: 0.6, delay: 0.2 }} className="flex flex-col items-center gap-4">
            <GlowCard className="!min-h-0">
              <div className="p-6 w-full text-center">
                <p className="font-mono text-sm text-white/50 mb-4">Connect Phantom to request devnet SOL</p>
                <p className="font-mono text-xs text-white/30 mb-6">Settings → Developer Settings → Testnet Mode → <span className="text-amber-400/60">Devnet</span></p>
              <WalletModalButton className="!bg-amber-500 hover:!bg-amber-400 !text-black !rounded-full !px-6 !py-3 !text-sm !font-bold !font-mono !h-auto !transition-colors" />
              </div>
            </GlowCard>
          </motion.div>
        ) : (
          <motion.div {...fadeIn} transition={{ duration: 0.6, delay: 0.3 }}>
            <button
              onClick={requestAirdrop}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-full px-6 py-3.5 text-sm font-bold font-mono transition-colors mb-4"
            >
              {loading ? "Requesting... approve in Phantom" : "Request 1 SOL"}
            </button>

            {status && (
              <GlowCard className="!min-h-0 mb-4">
                <div className={`p-5 ${status.type === "success" ? "" : ""}`}>
                  <p className={`font-mono text-sm ${status.type === "success" ? "text-green-400" : "text-red-400"}`}>{status.msg}</p>
                </div>
              </GlowCard>
            )}

            <GlowCard className="!min-h-0">
              <div className="p-5">
                <p className="font-mono font-bold text-white/50 text-xs mb-3">IF RATE LIMITED — USE DIRECT FAUCET</p>
                <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-white/[0.04] hover:bg-white/[0.08] rounded-full px-4 py-2.5 font-mono text-xs text-white/50 hover:text-white transition-colors">
                  faucet.solana.com <span className="text-white/20">↗</span>
                </a>
                <div className="mt-3 font-mono text-[10px] text-white/20 leading-relaxed">
                  1. <span className="text-amber-400/60">Sign in with GitHub</span> on faucet.solana.com<br />
                  2. Copy your wallet address from above<br />
                  3. Paste into the faucet, complete captcha<br />
                  4. Claim up to 5 SOL per request
                </div>
              </div>
            </GlowCard>
          </motion.div>
        )}
      </div>
    </div>
  );
}
