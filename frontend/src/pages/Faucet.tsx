import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Connection, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { motion } from "framer-motion";

const fadeIn = {
  initial: { filter: "blur(8px)", opacity: 0, y: 20 },
  animate: { filter: "blur(0px)", opacity: 1, y: 0 },
};

export default function Faucet() {
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  const requestAirdrop = async (amount: number = 1) => {
    if (!publicKey) return;
    setLoading(true);
    setStatus(null);
    setTxSig(null);
    try {
      const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
      const sig = await conn.requestAirdrop(publicKey, amount * LAMPORTS_PER_SOL);
      setTxSig(sig);
      setStatus({ type: "success", msg: `${amount} SOL successfully airdropped to your wallet!` });
    } catch (e: any) {
      const msg = e.message?.toLowerCase() || "";
      if (msg.includes("429") || msg.includes("rate") || msg.includes("limit")) {
        setStatus({ type: "error", msg: "Rate limited by Solana public RPC. Try again in ~30 seconds, or use the fallback faucet below." });
      } else if (msg.includes("insufficient") || msg.includes("balance")) {
        setStatus({ type: "error", msg: "Faucet balance depleted. Try the official faucet at faucet.solana.com." });
      } else {
        setStatus({ type: "error", msg: e.message?.slice(0, 120) || "Unknown error. Try again." });
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black relative">
      <div className="fixed inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1920&q=80)" }}>
        <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-red-800/30 bg-[#c0392b]/95 backdrop-blur-lg">
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
          <p className="text-sm font-mono text-red-300/60 mb-4">// Faucet</p>
          <h1 className="font-mono font-bold text-white text-5xl md:text-6xl tracking-[-2px] mb-4">
            Devnet <span className="text-red-300/60">SOL</span>
          </h1>
          <p className="font-mono text-sm text-white/40">Free test SOL for FullTime on Solana Devnet. No real value — just for testing.</p>
        </motion.div>

        {!connected ? (
          <motion.div {...fadeIn} transition={{ duration: 0.6, delay: 0.2 }} className="flex flex-col items-center gap-4">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 w-full text-center">
              <p className="font-mono text-sm text-white/50 mb-4">Connect your Phantom wallet to request devnet SOL.</p>
              <p className="font-mono text-xs text-white/30 mb-6">Make sure Phantom is set to <span className="text-red-300/60">Devnet</span> mode (Settings → Developer Settings → Testnet Mode).</p>
              <WalletMultiButton className="!bg-red-600 hover:!bg-red-500 !text-white !rounded-full !px-6 !py-3 !text-sm !font-semibold !font-mono !h-auto !transition-colors" />
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div {...fadeIn} transition={{ duration: 0.6, delay: 0.2 }}>
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 w-full mb-4">
                <p className="font-mono text-xs text-white/40 mb-2">Connected Wallet</p>
                <p className="font-mono text-sm text-white/70 break-all">{publicKey?.toBase58()}</p>
              </div>
            </motion.div>

            <motion.div {...fadeIn} transition={{ duration: 0.6, delay: 0.3 }} className="flex gap-3 mb-6">
              <button
                onClick={() => requestAirdrop(1)}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full px-6 py-3.5 text-sm font-bold font-mono transition-colors"
              >
                {loading ? "..." : "Request 1 SOL"}
              </button>
              <button
                onClick={() => requestAirdrop(2)}
                disabled={loading}
                className="flex-1 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-white/60 rounded-full px-6 py-3.5 text-sm font-semibold font-mono transition-colors"
              >
                {loading ? "..." : "Request 2 SOL"}
              </button>
            </motion.div>

            {status && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white/[0.03] border rounded-2xl p-5 w-full mb-6 ${
                  status.type === "success" ? "border-green-500/20" : status.type === "error" ? "border-red-500/20" : "border-white/[0.08]"
                }`}
              >
                <p className={`font-mono text-sm ${status.type === "success" ? "text-green-400" : status.type === "error" ? "text-red-400" : "text-white/50"}`}>
                  {status.msg}
                </p>
                {txSig && (
                  <a
                    href={`https://solscan.io/tx/${txSig}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-white/40 hover:text-white/70 underline mt-2 inline-block"
                  >
                    View on Solscan ↗
                  </a>
                )}
              </motion.div>
            )}

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 w-full">
              <p className="font-mono font-bold text-white/50 text-xs mb-3">FALLBACK FAUCETS</p>
              <div className="space-y-2">
                <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-white/[0.04] hover:bg-white/[0.08] rounded-full px-4 py-2.5 font-mono text-xs text-white/50 hover:text-white transition-colors">
                  faucet.solana.com <span className="text-white/20">↗</span>
                </a>
                <a href="https://solfaucet.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-white/[0.04] hover:bg-white/[0.08] rounded-full px-4 py-2.5 font-mono text-xs text-white/50 hover:text-white transition-colors">
                  solfaucet.com <span className="text-white/20">↗</span>
                </a>
              </div>
              <p className="font-mono text-[10px] text-white/20 mt-4">
                These external faucets are rate-limited. If one doesn't work, try another. SOL on devnet has no real monetary value.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
