import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModalButton, WalletDisconnectButton } from "@solana/wallet-adapter-react-ui";
import { Connection, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";
import { useLang } from "../lib/i18n/context";
import LangToggle from "../components/LangToggle";
import { motion } from "framer-motion";

function f(a: string) { return `${a.slice(0, 6)}...${a.slice(-4)}`; }
function solDisplay(lp: number) { return Math.floor(lp / LAMPORTS_PER_SOL).toString(); }

const fadeIn = {
  initial: { filter: "blur(8px)", opacity: 0, y: 20 },
  animate: { filter: "blur(0px)", opacity: 1, y: 0 },
};

export default function Faucet() {
  const { t, lang } = useLang();
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-zinc-900 to-zinc-950 relative">
      <div className="fixed inset-0 z-0 bg-cover bg-center opacity-[0.04]" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1920&q=80)` }} />

      <nav className="sticky top-0 z-40 border-b border-emerald-500/20 bg-zinc-900/90 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto grid grid-cols-3 items-center px-4 sm:px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">⚽</span>
            <span className="font-mono font-bold text-white text-lg tracking-tight">Full<span className="text-white/40">Time</span></span>
          </Link>
          <div className="flex items-center justify-center gap-2">
            <Link to="/app" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">{t("nav.markets")}</Link>
            <Link to="/matches" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">{t("nav.matches")}</Link>
            <Link to="/faq" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">{t("nav.faq")}</Link>
            <Link to="/faucet" className="bg-white/15 rounded-full px-4 py-1.5 text-sm font-mono text-white font-medium">{t("nav.faucet")}</Link>
          </div>
          <div className="flex items-center justify-end gap-2">
            <LangToggle />
            {connected ? (
              <WalletDisconnectButton style={{ background: "#262626", color: "#fff", borderRadius: "9999px", padding: "6px 16px", fontSize: "12px", fontFamily: "ui-monospace,monospace", border: "none" }} />
            ) : (
              <WalletModalButton style={{ background: "#171717", color: "#fff", borderRadius: "9999px", padding: "8px 20px", fontSize: "14px", fontFamily: "ui-monospace,monospace", fontWeight: 600, border: "1px solid rgba(255,255,255,0.2)" }} />
            )}
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-4 sm:px-6 py-16">
        <motion.div {...fadeIn} transition={{ duration: 0.6 }} className="text-center mb-10">
          <p className="text-sm font-mono text-amber-400/60 mb-4">{t("faucet.subtitle")}</p>
          <h1 className="font-mono font-bold text-white text-5xl md:text-6xl tracking-[-2px] mb-4">
            Devnet <span className="text-amber-400/60">SOL</span>
          </h1>
          <p className="font-mono text-sm text-white/40">{lang === "id" ? "SOL tes gratis untuk FullTime di Solana Devnet" : "Free test SOL for FullTime on Solana Devnet"}</p>
        </motion.div>

        {connected && publicKey && (
          <motion.div {...fadeIn} transition={{ duration: 0.5 }} className="mb-6">
            <div className="group relative w-full overflow-hidden rounded-2xl bg-zinc-800/40 font-sans shadow-2xl border border-zinc-600/20">
              <div className="absolute -top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-500/20 via-amber-500/10 to-transparent blur-3xl transition-all duration-700 group-hover:from-emerald-500/30 group-hover:via-amber-500/20" />
              <div className="relative z-10">
              <div className="p-4 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="font-mono text-white text-sm font-semibold">Phantom Wallet</div>
                  <div className="font-mono text-xs text-white/30">{f(publicKey.toBase58())}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-white/40">{lang === "id" ? "Saldo" : "Balance"}</div>
                  <div className="font-mono text-white text-xl font-bold">{balance !== null ? solDisplay(balance) : "—"} <span className="text-amber-400/60 text-sm">SOL</span></div>
                  <div className="font-mono text-[10px] text-amber-400/50 mt-0.5">{lang === "id" ? "Devnet — tidak bernilai nyata" : "Devnet — no real value"}</div>
                </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {!connected ? (
          <motion.div {...fadeIn} transition={{ duration: 0.6, delay: 0.2 }} className="flex flex-col items-center gap-4">
            <div className="group relative w-full overflow-hidden rounded-2xl bg-zinc-800/40 font-sans shadow-2xl border border-zinc-600/20">
              <div className="absolute -top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-500/20 via-amber-500/10 to-transparent blur-3xl transition-all duration-700 group-hover:from-emerald-500/30 group-hover:via-amber-500/20" />
              <div className="relative z-10">
              <div className="p-6 w-full text-center">
                <p className="font-mono text-sm text-white/50 mb-4">{lang === "id" ? "Hubungkan Phantom untuk minta SOL devnet" : "Connect Phantom to request devnet SOL"}</p>
                <p className="font-mono text-xs text-white/30 mb-6">{lang === "id" ? "Pengaturan → Pengaturan Developer → Mode Testnet →" : "Settings → Developer Settings → Testnet Mode →"} <span className="text-amber-400/60">Devnet</span></p>
              <WalletModalButton className="!bg-amber-500 hover:!bg-amber-400 !text-black !rounded-full !px-6 !py-3 !text-sm !font-bold !font-mono !h-auto !transition-colors" />
              </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div {...fadeIn} transition={{ duration: 0.6, delay: 0.3 }}>
            <button
              onClick={requestAirdrop}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-full px-6 py-3.5 text-sm font-bold font-mono transition-colors mb-4"
            >
              {loading ? (lang === "id" ? "Meminta... setujui di Phantom" : "Requesting... approve in Phantom") : t("faucet.request")}
            </button>

            {status && (
              <div className="group relative w-full overflow-hidden rounded-2xl bg-zinc-800/40 font-sans shadow-2xl border border-zinc-600/20 mb-4">
                <div className="absolute -top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-500/20 via-amber-500/10 to-transparent blur-3xl transition-all duration-700 group-hover:from-emerald-500/30 group-hover:via-amber-500/20" />
                <div className="relative z-10">
                <div className={`p-5 ${status.type === "success" ? "" : ""}`}>
                  <p className={`font-mono text-sm ${status.type === "success" ? "text-emerald-400" : "text-red-400"}`}>{status.msg}</p>
                </div>
                </div>
              </div>
            )}

            <div className="group relative w-full overflow-hidden rounded-2xl bg-zinc-800/40 font-sans shadow-2xl border border-zinc-600/20">
              <div className="absolute -top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-500/20 via-amber-500/10 to-transparent blur-3xl transition-all duration-700 group-hover:from-emerald-500/30 group-hover:via-amber-500/20" />
              <div className="relative z-10">
              <div className="p-5">
                <p className="font-mono font-bold text-white/50 text-xs mb-3">{lang === "id" ? "JIKA TERKENA LIMIT — GUNAKAN FAUCET LANGSUNG" : "IF RATE LIMITED — USE DIRECT FAUCET"}</p>
                <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-zinc-800/40 hover:bg-zinc-700/50 rounded-full px-4 py-2.5 font-mono text-xs text-white/50 hover:text-white transition-colors border border-zinc-600/20">
                  faucet.solana.com <span className="text-white/20">↗</span>
                </a>
                <div className="mt-3 font-mono text-[10px] text-white/20 leading-relaxed">
                  1. <span className="text-amber-400/60">{lang === "id" ? "Login dengan GitHub" : "Sign in with GitHub"}</span> {lang === "id" ? "di faucet.solana.com" : "on faucet.solana.com"}<br />
                  2. {lang === "id" ? "Salin alamat dompet Anda dari atas" : "Copy your wallet address from above"}<br />
                  3. {lang === "id" ? "Tempel ke faucet, selesaikan captcha" : "Paste into the faucet, complete captcha"}<br />
                  4. {lang === "id" ? "Klaim hingga 5 SOL per permintaan" : "Claim up to 5 SOL per request"}
                </div>
              </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <footer className="border-t border-amber-500/10 py-6 text-center">
        <p className="font-mono text-[10px] text-white/30">{t("footer.text")}</p>
        <p className="font-mono text-[10px] text-white/20">{t("footer.sub")}</p>
      </footer>
    </div>
  );
}
