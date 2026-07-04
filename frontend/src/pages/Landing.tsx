import { Link } from "react-router-dom";
import Marquee from "../components/Marquee";

const M1 = ["⚽ 🇦🇷 Argentina","⚽ 🇧🇷 Brazil","⚽ 🇺🇾 Uruguay","⚽ 🇨🇴 Colombia","⚽ 🇪🇨 Ecuador","⚽ 🇵🇾 Paraguay","⚽ 🇨🇱 Chile","⚽ 🇵🇪 Peru"];
const M2 = ["⚽ 🇫🇷 France","⚽ 🇪🇸 Spain","⚽ 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England","⚽ 🇩🇪 Germany","⚽ 🇵🇹 Portugal","⚽ 🇳🇱 Netherlands","⚽ 🇧🇪 Belgium","⚽ 🇮🇹 Italy"];
const M3 = ["⚽ 🇭🇷 Croatia","⚽ 🇨🇭 Switzerland","⚽ 🇳🇴 Norway","⚽ 🇦🇹 Austria","⚽ 🇸🇪 Sweden","⚽ 🇩🇰 Denmark","⚽ 🇵🇱 Poland","⚽ 🇹🇷 Turkey"];
const M4 = ["⚽ 🇯🇵 Japan","⚽ 🇰🇷 South Korea","⚽ 🇸🇦 Saudi Arabia","⚽ 🇦🇺 Australia","⚽ 🇮🇷 Iran","⚽ 🇮🇶 Iraq","⚽ 🇺🇿 Uzbekistan","⚽ 🇯🇴 Jordan"];
const M5 = ["⚽ 🇲🇦 Morocco","⚽ 🇸🇳 Senegal","⚽ 🇹🇳 Tunisia","⚽ 🇩🇿 Algeria","⚽ 🇪🇬 Egypt","⚽ 🇨🇮 Côte d'Ivoire","⚽ 🇬🇭 Ghana","⚽ 🇨🇲 Cameroon"];
const M6 = ["⚽ 🇺🇸 USA","⚽ 🇲🇽 Mexico","⚽ 🇨🇦 Canada","⚽ 🇵🇦 Panama","⚽ 🇯🇲 Jamaica","⚽ 🇨🇷 Costa Rica","⚽ 🇳🇿 New Zealand","⚽ 🇿🇦 South Africa"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* NAV */}
      <nav className="border-b-4 border-black bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center">
          <img src="/logo fulltime.png" alt="FullTime" className="h-10 w-auto" />
        </div>
      </nav>

      {/* HERO */}
      <section className="relative bg-[#111] text-white overflow-hidden border-b-4 border-black">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 text-8xl">⚽</div>
          <div className="absolute top-20 right-20 text-7xl">🏆</div>
          <div className="absolute bottom-10 left-1/3 text-6xl">⚽</div>
          <div className="absolute bottom-20 right-10 text-9xl">🥅</div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-20 relative z-10 text-center">
          <img src="/logo fulltime.png" alt="FullTime" className="h-20 md:h-28 mx-auto mb-8 animate-bounce-in" />
          <h1 className="text-5xl md:text-8xl font-black leading-none mb-6">
            <span className="block animate-slide-up">CRYPTO</span>
            <span className="block text-[#FF1493] animate-slide-up" style={{animationDelay:"0.2s"}}>SETTLES.</span>
            <span className="block text-xl md:text-3xl mt-4 text-gray-400 font-bold animate-slide-up" style={{animationDelay:"0.4s"}}>
              NO REFEREE NEEDED.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10 animate-fade-in" style={{animationDelay:"0.6s"}}>
            Prediction market on-chain untuk World Cup 2026. Settlement otomatis diverifikasi kriptografis via Merkle proofs — tanpa admin, tanpa tombol "resolve", tanpa kepercayaan.
          </p>
          <div className="flex gap-4 justify-center flex-wrap animate-fade-in" style={{animationDelay:"0.8s"}}>
            <Link to="/markets" className="bg-[#FF1493] text-white text-lg font-black px-8 py-4 border-4 border-white shadow-[6px_6px_0px_#FFD700] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#FFD700] transition-all">
              EXPLORE MARKETS
            </Link>
            <Link to="/admin" className="bg-[#FFD700] text-black text-lg font-black px-8 py-4 border-4 border-white shadow-[6px_6px_0px_#FF1493] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#FF1493] transition-all">
              CREATE MARKET
            </Link>
          </div>
        </div>
      </section>

      {/* MARQUEE 1 — South America */}
      <Marquee countries={M1} />

      {/* STATS / FEATURES */}
      <section className="py-20 bg-white border-b-4 border-black">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title:"TRUSTLESS", emoji:"🔐", desc:"Settlement diverifikasi via Merkle proof on-chain. Tidak ada pihak yang harus dipercaya — bukti tersimpan permanen di Solana." },
            { title:"AUTOMATIC", emoji:"⚡", desc:"Begitu peluit akhir dibunyikan, relay service mendeteksi dan menyelesaikan market dalam hitungan detik via SSE stream." },
            { title:"AUDITABLE", emoji:"🔍", desc:"Setiap settlement meninggalkan jejak on-chain yang bisa diverifikasi siapa saja via Solana Explorer — permanent & immutable." },
          ].map((f,i) => (
            <div key={f.title} className="border-4 border-black p-8 shadow-[6px_6px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-white" style={{animationDelay:`${i*0.15}s`}}>
              <div className="text-4xl mb-4">{f.emoji}</div>
              <h3 className="text-2xl font-black mb-3">{f.title}</h3>
              <p className="text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MARQUEE 2 — Europe */}
      <Marquee countries={M2} reverse />

      {/* HOW IT WORKS */}
      <section className="py-20 bg-[#111] text-white border-b-4 border-black">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-4">
            HOW <span className="text-[#FFD700]">IT WORKS</span>
          </h2>
          <p className="text-center text-gray-400 text-lg mb-16">
            From whistle to wallet — fully automated, cryptographically verified
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { s:"1", icon:"🏟️", t:"KICKOFF", d:"Match dimulai. Bettors pasang taruhan HOME/DRAW/AWAY sebelum kickoff." },
              { s:"2", icon:"⏱️", t:"FULL TIME", d:"Peluit akhir. TxLINE mendeteksi phase F (match selesai) via live data feed." },
              { s:"3", icon:"🔗", t:"MERKLE PROOF", d:"TxLINE generates cryptographic proof linking score to on-chain Merkle root." },
              { s:"4", icon:"⛓️", t:"CPI VERIFY", d:"FullTime contract verifies proof via Cross-Program Invocation to TxLINE oracle." },
              { s:"5", icon:"💰", t:"SETTLE & CLAIM", d:"Market otomatis settled. Pemenang klaim payout. Audit trail tersimpan on-chain." },
            ].map((s,i) => (
              <div key={s.s} className="border-2 border-white/20 p-5 text-center bg-white/5 hover:bg-white/10 transition-colors">
                <div className="text-3xl mb-2">{s.icon}</div>
                <div className="w-8 h-8 border-2 border-[#FFD700] rounded-full flex items-center justify-center mx-auto mb-2 font-black text-sm bg-[#FFD700] text-black">{s.s}</div>
                <h4 className="font-black text-sm mb-1">{s.t}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MARQUEE 3 — Europe Part 2 */}
      <Marquee countries={M3} />

      {/* COMPARISON TABLE */}
      <section className="py-20 bg-white border-b-4 border-black">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-4">
            WHY <span className="text-[#FF1493]">FULLTIME</span> WINS
          </h2>
          <p className="text-center text-gray-500 text-lg mb-16">No contest.</p>
          <div className="border-4 border-black shadow-[6px_6px_0px_#000] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-black text-white">
                  <th className="p-4 font-black text-sm">FEATURE</th>
                  <th className="p-4 font-black text-sm border-l-2 border-white bg-[#FF1493]">FULLTIME</th>
                  <th className="p-4 font-black text-sm border-l-2 border-white">TRADITIONAL</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {[
                  ["Settlement", "Automatic < 1 detik", "Manual — admin klik resolve"],
                  ["Verifikasi", "Merkle proof on-chain", "Trust-based — percaya admin"],
                  ["Audit Trail", "Permanent di Solana", "Tidak ada / internal DB"],
                  ["Data Source", "TxLINE cryptographically verified", "Manual input / web scraping"],
                  ["Censorship", "Permissionless — no admin", "Admin bisa blokir payout"],
                  ["Latency", "SSE real-time stream", "Polling REST 2-5 menit"],
                ].map(([f, ft, tr], i) => (
                  <tr key={f} className={i%2===0?"bg-gray-50":""}>
                    <td className="p-4 font-bold text-sm">{f}</td>
                    <td className="p-4 text-sm bg-[#FF1493]/10 border-l-2 border-black font-bold text-green-700">{ft}</td>
                    <td className="p-4 text-sm border-l-2 border-black text-red-700">{tr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* MARQUEE 4 — Asia */}
      <Marquee countries={M4} reverse />

      {/* MARQUEE 5 — Africa */}
      <Marquee countries={M5} />

      {/* CTA */}
      <section className="py-20 bg-[#111] text-white border-b-4 border-black">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6">
            READY TO <span className="text-[#FFD700]">SETTLE</span>?
          </h2>
          <p className="text-xl text-gray-400 mb-10">
            World Cup 2026 sedang berlangsung. Buat market, pasang taruhan, dan biarkan blockchain yang bekerja.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/markets" className="bg-[#FF1493] text-white text-lg font-black px-8 py-4 border-4 border-white shadow-[6px_6px_0px_#FFD700] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#FFD700] transition-all">
              EXPLORE MARKETS
            </Link>
            <Link to="/admin" className="bg-[#FFD700] text-black text-lg font-black px-8 py-4 border-4 border-white shadow-[6px_6px_0px_#FF1493] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#FF1493] transition-all">
              CREATE MARKET
            </Link>
          </div>
        </div>
      </section>

      {/* MARQUEE 6 — CONCACAF + Others */}
      <Marquee countries={M6} reverse />

      {/* FOOTER */}
      <footer className="py-8 bg-black text-white text-center border-t-4 border-[#FFD700]">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-sm text-gray-400">
            FullTime — Built on Solana. Powered by TxLINE. World Cup 2026.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            TxODDS x Solana x Superteam Earn Hackathon · Prediction Markets & Settlement
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes bounceIn { 0%{opacity:0;transform:scale(0.3)} 50%{transform:scale(1.05)} 70%{transform:scale(0.9)} 100%{opacity:1;transform:scale(1)} }
        @keyframes slideUp { 0%{opacity:0;transform:translateY(30px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { 0%{opacity:0} 100%{opacity:1} }
        .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) both; }
        .animate-slide-up { opacity:0; animation: slideUp 0.6s ease-out forwards; }
        .animate-fade-in { opacity:0; animation: fadeIn 0.8s ease-out forwards; }
      `}</style>
    </div>
  );
}
