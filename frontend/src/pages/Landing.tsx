import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const parallax = (factor: number) => ({
    transform: `translateY(${scrollY * factor}px)`,
  });

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* ─── HERO ──────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center border-b-8 border-black overflow-hidden">
        {/* Animated bg pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, #FF1493 1px, transparent 1px),
                              radial-gradient(circle at 80% 20%, #FFD700 1px, transparent 1px),
                              radial-gradient(circle at 40% 80%, #00FFFF 1px, transparent 1px),
                              radial-gradient(circle at 70% 70%, #8B00FF 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating geometric shapes */}
        <div className="absolute top-20 left-10 w-32 h-32 border-4 border-[#FF1493] rotate-12 opacity-20 hidden lg:block" style={parallax(-0.3)} />
        <div className="absolute top-40 right-20 w-24 h-24 border-4 border-[#FFD700] -rotate-6 opacity-20 hidden lg:block" style={parallax(-0.2)} />
        <div className="absolute bottom-32 left-1/4 w-20 h-20 bg-[#00FFFF] border-4 border-black opacity-10 hidden lg:block" style={parallax(0.3)} />
        <div className="absolute bottom-40 right-1/3 w-28 h-28 border-4 border-[#8B00FF] rotate-45 opacity-15 hidden lg:block" style={parallax(0.2)} />

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto py-20">
          {/* Badge */}
          <div className="inline-block border-2 border-black px-4 py-1 mb-8 bg-[#FFD700] font-bold text-sm uppercase tracking-widest animate-pulse">
            ⚡ Powered by TxLINE · Solana Devnet
          </div>

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img
              src="/logo fulltime.png"
              alt="FullTime"
              className="w-72 md:w-96 h-auto drop-shadow-[8px_8px_0px_#000]"
              style={parallax(-0.1)}
            />
          </div>

          {/* Main headline */}
          <h1 className="text-7xl md:text-9xl font-black leading-[0.9] tracking-tighter mb-6">
            <span className="block">CRYPTO</span>
            <span className="block text-[#FF1493]">SETTLES.</span>
          </h1>

          {/* Sub-headline */}
          <div className="text-2xl md:text-4xl font-black mb-8 leading-tight">
            <span className="bg-black text-white px-2">NO REFEREE</span>
            {" "}NEEDED.
          </div>

          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
            The world's first <strong>trustless prediction market</strong> for World Cup 2026.
            Settlement verified on-chain via cryptographic Merkle proofs — zero human
            intervention. No admin. No button. Pure math.
          </p>

          {/* CTAs */}
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              to="/markets"
              className="group relative bg-[#FF1493] text-white text-xl font-black px-10 py-5 border-4 border-black shadow-[8px_8px_0px_#000] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0px_#000] transition-all duration-100"
            >
              <span className="relative z-10">START PREDICTING</span>
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
            </Link>
            <Link
              to="/admin"
              className="group bg-[#FFD700] text-black text-xl font-black px-10 py-5 border-4 border-black shadow-[8px_8px_0px_#000] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0px_#000] transition-all duration-100"
            >
              CREATE MARKET
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="mt-16 animate-bounce">
            <div className="w-8 h-12 border-4 border-black rounded-full mx-auto flex justify-center pt-2">
              <div className="w-1.5 h-3 bg-black rounded-full" />
            </div>
            <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Scroll</p>
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ────────────────────────────────────── */}
      <section className="border-b-4 border-black bg-black text-white">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-white/20">
          {[
            { value: "104", label: "World Cup Matches" },
            { value: "15+", label: "Markets Created" },
            { value: "12", label: "Contracts Deployed" },
            { value: "< 1s", label: "Settlement Time" },
          ].map((s) => (
            <div key={s.label} className="py-6 px-4 text-center">
              <div className="text-4xl md:text-5xl font-black text-[#FFD700]">{s.value}</div>
              <div className="text-xs md:text-sm text-gray-400 font-bold uppercase tracking-wider mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── THE PROBLEM ──────────────────────────────────── */}
      <section className="border-b-8 border-black py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block border-2 border-red-500 bg-red-50 text-red-700 px-4 py-1 font-bold text-sm uppercase tracking-widest mb-4">
              The Problem
            </div>
            <h2 className="text-5xl md:text-6xl font-black leading-tight">
              Every prediction market<br />
              <span className="text-red-500">still uses an admin button.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "🐢", title: "SLOW", desc: "Results sit unsettled for hours after the final whistle. Someone has to wake up, login, and click resolve." },
              { icon: "🏰", title: "CENTRALIZED", desc: "One person or entity controls the outcome. If they're compromised, every bet is at risk." },
              { icon: "🔍", title: "OPAQUE", desc: "Users have zero cryptographic proof the resolution is honest. 'Trust us' is not Web3." },
            ].map((p) => (
              <div key={p.title} className="border-4 border-black bg-white p-8 shadow-[6px_6px_0px_#EF4444]">
                <div className="text-4xl mb-4">{p.icon}</div>
                <h3 className="text-2xl font-black mb-3 text-red-500">{p.title}</h3>
                <p className="text-gray-600 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────── */}
      <section className="border-b-8 border-black py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block border-2 border-[#FF1493] bg-pink-50 text-[#FF1493] px-4 py-1 font-bold text-sm uppercase tracking-widest mb-4">
              How It Works
            </div>
            <h2 className="text-5xl md:text-6xl font-black leading-tight">
              From whistle<br />
              <span className="text-[#FF1493]">to settlement</span> in seconds.
            </h2>
          </div>

          <div className="space-y-0">
            {[
              { step: "1", title: "MATCH ENDS", desc: "Referee blows the final whistle. TxLINE detects phase F (Full Time) via live data feed.", color: "#FF1493", icon: "⚽" },
              { step: "2", title: "PROOF GENERATED", desc: "TxLINE cryptographically signs the match result and publishes a Merkle root on-chain on Solana.", color: "#FFD700", icon: "🔐" },
              { step: "3", title: "RELAY DETECTS", desc: "FullTime's relay service detects the match completion via SSE stream — latency under 1 second.", color: "#00FFFF", icon: "⚡" },
              { step: "4", title: "ON-CHAIN VERIFICATION", desc: "Smart contract verifies the Merkle proof via CPI to TxLINE — no human, no admin, no button.", color: "#8B00FF", icon: "✅" },
              { step: "5", title: "AUTO-SETTLEMENT", desc: "Market is settled. Winnings ready to claim. Every step leaves a permanent audit trail on Solana.", color: "#22C55E", icon: "💰" },
            ].map((s, i) => (
              <div key={s.step} className="relative flex items-start gap-6 pb-12 last:pb-0">
                {/* Connecting line */}
                {i < 4 && (
                  <div className="absolute left-[30px] top-16 bottom-0 w-1 bg-black" />
                )}
                {/* Step number */}
                <div
                  className="relative z-10 w-16 h-16 border-4 border-black flex items-center justify-center text-2xl font-black flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                >
                  {s.step}
                </div>
                {/* Content */}
                <div className="pt-4">
                  <div className="text-sm mb-2">{s.icon}</div>
                  <h3 className="text-2xl font-black mb-2">{s.title}</h3>
                  <p className="text-gray-600 leading-relaxed max-w-lg">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FULLTIME vs TRADITIONAL ──────────────────────── */}
      <section className="border-b-8 border-black py-24 bg-black text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block border-2 border-[#FFD700] text-[#FFD700] px-4 py-1 font-bold text-sm uppercase tracking-widest mb-4">
              The Difference
            </div>
            <h2 className="text-5xl md:text-6xl font-black leading-tight">
              FullTime{" "}
              <span className="text-[#FFD700] line-through decoration-4">vs</span>
              {" "}Traditional
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-4 border-white/20">
                  <th className="text-left py-4 px-4 text-lg font-black uppercase">Feature</th>
                  <th className="text-center py-4 px-4 text-lg font-black uppercase text-[#FFD700] bg-[#FFD700]/10 border-x-4 border-[#FFD700]">FullTime</th>
                  <th className="text-center py-4 px-4 text-lg font-black uppercase text-red-400">Traditional</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-white/10">
                {[
                  ["Settlement", "Automatic, < 1 second", "Manual, hours to days"],
                  ["Verification", "Merkle proof on-chain (CPI)", "Admin clicks 'resolve'"],
                  ["Trust model", "Trustless — cryptographic", "Trust in operator"],
                  ["Audit trail", "Permanent, Solana Explorer", "Internal database only"],
                  ["Disputes", "On-chain dispute window (1h)", "Support ticket / Discord"],
                  ["Data source", "TxLINE — cryptographically signed", "Manual entry / API"],
                  ["Censorship", "Impossible (Solana)", "Operator can block"],
                ].map(([feature, fulltime, trad], i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="py-5 px-4 font-bold text-sm">{feature}</td>
                    <td className="py-5 px-4 text-center text-sm bg-[#FFD700]/5 border-x-4 border-[#FFD700]">
                      <span className="font-bold text-[#FFD700]">{fulltime}</span>
                    </td>
                    <td className="py-5 px-4 text-center text-sm text-red-400">
                      {trad}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── USE CASES ────────────────────────────────────── */}
      <section className="border-b-8 border-black py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block border-2 border-[#8B00FF] bg-purple-50 text-[#8B00FF] px-4 py-1 font-bold text-sm uppercase tracking-widest mb-4">
              Unlimited Markets
            </div>
            <h2 className="text-5xl md:text-6xl font-black leading-tight">
              Any prediction.<br />
              <span className="text-[#8B00FF]">Fully automated.</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              ["⚽", "Match\nWinner"],
              ["🏆", "Tournament\nChampion"],
              ["👟", "Golden\nBoot"],
              ["🧤", "Best\nGoalkeeper"],
              ["🏅", "Player of\nTournament"],
              ["👔", "Best\nCoach"],
              ["📊", "Over/Under\nGoals"],
              ["🟨", "Cards\nTotal"],
              ["🏴", "Corner\nKicks"],
              ["🎯", "Penalty\nScored?"],
            ].map(([icon, label]) => (
              <div
                key={label}
                className="border-4 border-black p-6 text-center bg-white shadow-[4px_4px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#000] transition-all"
              >
                <div className="text-3xl mb-2">{icon}</div>
                <div className="font-black text-sm leading-tight whitespace-pre-line">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AUDIT TRAIL ───────────────────────────────────── */}
      <section className="border-b-8 border-black py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block border-2 border-[#00FFFF] bg-cyan-50 text-cyan-700 px-4 py-1 font-bold text-sm uppercase tracking-widest mb-4">
              Trust But Verify
            </div>
            <h2 className="text-5xl md:text-6xl font-black leading-tight">
              Every settlement leaves<br />
              <span className="text-[#00FFFF] bg-black px-2">on-chain proof.</span>
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {[
              { label: "Market Account", desc: "Contains settlement data: winner, timestamp, Merkle root", link: "market/:id" },
              { label: "TxLINE Merkle Root", desc: "Published by TxODDS — cryptographic proof of match result", link: "txline" },
              { label: "Transaction Signature", desc: "Links settlement to a specific Solana block — immutable", link: "tx" },
            ].map((a) => (
              <div key={a.label} className="border-4 border-black bg-white p-5 shadow-[4px_4px_0px_#000] flex items-center gap-4">
                <div className="w-12 h-12 border-2 border-black bg-[#00FFFF] flex items-center justify-center text-xl font-black flex-shrink-0">
                  🔗
                </div>
                <div>
                  <h3 className="font-black">{a.label}</h3>
                  <p className="text-sm text-gray-500">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-gray-500 mb-2 font-bold uppercase tracking-widest">
              ALL VERIFIABLE VIA SOLANA EXPLORER
            </p>
            <code className="text-xs bg-gray-200 px-3 py-1 border border-gray-400 font-mono">
              solana confirm 58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x
            </code>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─────────────────────────────────────── */}
      <section className="py-24 bg-[#FF1493] border-b-8 border-black">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl md:text-7xl font-black text-white leading-tight mb-8">
            READY TO<br />PREDICT?
          </h2>
          <p className="text-xl text-white/80 mb-10 max-w-xl mx-auto">
            Connect your Phantom wallet and join the most trustless prediction
            market on Solana.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              to="/markets"
              className="bg-white text-[#FF1493] text-xl font-black px-10 py-5 border-4 border-black shadow-[8px_8px_0px_#000] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0px_#000] transition-all duration-100"
            >
              LAUNCH APP
            </Link>
            <Link
              to="/admin"
              className="bg-black text-white text-xl font-black px-10 py-5 border-4 border-white shadow-[8px_8px_0px_#FFF] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0px_#FFF] transition-all duration-100"
            >
              CREATE MARKET
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────── */}
      <footer className="bg-black text-white py-12 border-t-4 border-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo fulltime.png" alt="FullTime" className="h-8 w-auto invert" />
              <span className="text-xs text-gray-400 font-mono">
                v1.0 · Devnet · Built for TxODDS x Solana World Cup Hackathon 2026
              </span>
            </div>
            <div className="flex gap-4 text-xs text-gray-400 font-bold">
              <a href="https://github.com/yt2025id-lab/fulltime" target="_blank" rel="noopener" className="hover:text-white">GitHub</a>
              <a href="https://explorer.solana.com/address/58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x?cluster=devnet" target="_blank" rel="noopener" className="hover:text-white">Explorer</a>
              <span>© 2026 FullTime</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
