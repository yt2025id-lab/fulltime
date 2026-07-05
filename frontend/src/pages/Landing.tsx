import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import FadingVideo from "../components/FadingVideo";
import BlurText from "../components/BlurText";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4";

const CAPABILITIES_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4";

const ArrowUpRight = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7" />
    <path d="M7 7h10v10" />
  </svg>
);

const PlayIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="white">
    <polygon points="6 4 20 12 6 20 6 4" />
  </svg>
);

const fadeIn = {
  initial: { filter: "blur(10px)", opacity: 0, y: 20 },
  animate: { filter: "blur(0px)", opacity: 1, y: 0 },
};

const steps = [
  { step: "01", title: "Create", desc: "Create a YES/NO prediction market with a question and deadline. Pay a small 2% platform fee." },
  { step: "02", title: "Bet", desc: "Place SOL bets on YES or NO. All bets are held securely in the smart contract on-chain." },
  { step: "03", title: "Resolve", desc: "After full-time, TxLINE feeds verify the outcome. CPI Merkle proof settles the market — trustless." },
  { step: "04", title: "Claim", desc: "Winners claim proportional share of the total pool. Verified on-chain, permanent audit trail on Solana." },
];

const features = [
  { title: "Trustless", desc: "TxLINE Merkle proof verification via CPI on-chain. No admin resolve button — cryptographic proof or nothing.", check: true },
  { title: "Automatic", desc: "SSE real-time listener detects full-time in < 1 second. Markets auto-settle. No polling, no delay.", check: true },
  { title: "2% Fee", desc: "Market creators pay just 2% of the losing pool as a protocol fee — minimal overhead, transparent, on-chain.", check: true },
];

const countries = [
  "🇺🇸 USA", "🇨🇦 Canada", "🇲🇽 Mexico", "🇦🇷 Argentina", "🇧🇷 Brazil",
  "🏴󠁧󠁢󠁥󠁮󠁧󠁿 England", "🇫🇷 France", "🇩🇪 Germany", "🇪🇸 Spain", "🇳🇱 Netherlands",
  "🇵🇹 Portugal", "🇺🇾 Uruguay", "🇨🇴 Colombia", "🇯🇵 Japan",
  "🇰🇷 South Korea", "🇸🇦 Saudi Arabia", "🇦🇺 Australia",
  "🇲🇦 Morocco", "🇸🇳 Senegal", "🇭🇷 Croatia", "🇧🇪 Belgium",
  "🇪🇨 Ecuador", "🇨🇮 Ivory Coast", "🇩🇿 Algeria", "🇪🇬 Egypt",
  "🇬🇭 Ghana", "🇹🇳 Tunisia", "🇿🇦 South Africa", "🇨🇻 Cape Verde",
  "🇨🇩 Congo DR", "🇧🇦 Bosnia", "🇨🇼 Curaçao", "🇮🇷 Iran",
  "🇶🇦 Qatar", "🇮🇶 Iraq", "🇯🇴 Jordan", "🇺🇿 Uzbekistan",
  "🇳🇿 New Zealand", "🇳🇴 Norway", "🇸🇪 Sweden", "🇨🇭 Switzerland",
  "🇦🇹 Austria", "🇨🇿 Czechia", "🇹🇷 Turkey", "🇵🇾 Paraguay",
  "🇵🇦 Panama", "🇭🇹 Haiti", "🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland",
];

const Marquee = ({ items, reverse }: { items: string[]; reverse?: boolean }) => (
  <div className="relative z-30 bg-black/60 backdrop-blur-sm border-y border-white/10 py-2.5 overflow-hidden">
    <div className={`flex animate-marquee whitespace-nowrap ${reverse ? "flex-row-reverse" : ""}`} style={reverse ? { animationDirection: "reverse" } : {}}>
      {[...Array(2)].map((_, lap) => (
        <div key={lap} className="flex items-center gap-8 px-4">
          {items.map((c, i) => (
            <span key={i}>
              <span className="text-white/90 font-body text-sm font-medium">{c}</span>
              {i < items.length - 1 && <span className="text-white/50 ml-8">·</span>}
            </span>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const chunkSize = Math.ceil(countries.length / 6);
const c1 = countries.slice(0, chunkSize);
const c2 = countries.slice(chunkSize, chunkSize * 2);
const c3 = countries.slice(chunkSize * 2, chunkSize * 3);
const c4 = countries.slice(chunkSize * 3, chunkSize * 4);
const c5 = countries.slice(chunkSize * 4, chunkSize * 5);
const c6 = countries.slice(chunkSize * 5);

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="bg-green-950">
      {/* Hero Section */}
      <section className="relative h-screen overflow-hidden bg-green-950">
        <Marquee items={c1} />

        <FadingVideo
          src={HERO_VIDEO}
          className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0"
          style={{ width: "120%", height: "120%" }}
        />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex-1 flex flex-col items-center justify-start text-center px-4 pt-12">
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-black/20 to-black/40 pointer-events-none" />

            <motion.div
              {...fadeIn}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-5 mb-14 relative"
            >
              <span className="bg-amber-500 text-black rounded-full px-5 py-2 text-xl md:text-2xl font-bold font-body tracking-wider uppercase shadow-lg shadow-amber-500/40">
                FIFA World Cup 2026
              </span>
              <p className="text-xl md:text-2xl text-amber-200 font-body font-semibold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                Predict. Bet. Win.
              </p>
            </motion.div>

            <BlurText
              text="Predict the World Cup. Win on Solana."
              className="text-8xl md:text-9xl lg:text-[7rem] font-heading italic text-white leading-[0.85] max-w-4xl tracking-[-4px] relative drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]"
              delay={0.1}
            />

            <motion.p
              {...fadeIn}
              transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
              className="mt-10 text-lg md:text-xl text-white max-w-2xl font-body font-medium leading-relaxed relative drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            >
              A trustless prediction market powered by Solana + TxLINE — Merkle-proof settlement on-chain, no referee needed.
            </motion.p>

            <motion.div
              {...fadeIn}
              transition={{ duration: 0.8, delay: 1.1, ease: "easeOut" }}
              className="flex items-center gap-10 mt-12 relative"
            >
              <button
                onClick={() => navigate("/app")}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black rounded-full px-7 py-3.5 text-lg font-bold flex items-center gap-2 font-body transition-all shadow-lg shadow-amber-500/30"
              >
                Launch dApp <ArrowUpRight />
              </button>
              <a href="#how" className="text-lg text-white flex items-center gap-1.5 font-body font-medium hover:text-amber-300 transition-colors drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                <PlayIcon /> How It Works
              </a>
            </motion.div>

            <motion.p
              {...fadeIn}
              transition={{ duration: 0.8, delay: 1.2, ease: "easeOut" }}
              className="mt-14 text-sm text-white/50 font-body font-light tracking-wide relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            >
              TxODDS x Solana x Superteam Earn · Prediction Markets & Settlement · July 2026
            </motion.p>
          </div>
        </div>
      </section>

      <Marquee items={c2} reverse />

      {/* How It Works */}
      <section id="how" className="relative min-h-screen bg-emerald-950 overflow-hidden">
        <FadingVideo
          src={CAPABILITIES_VIDEO}
          className="absolute inset-0 w-full h-full object-cover z-0"
        />

        <div className="relative z-10 px-8 md:px-16 lg:px-20 pt-24 pb-10 flex flex-col min-h-screen">
          <div className="mb-auto">
            <p className="text-sm font-body text-amber-300/80 mb-6">// How It Works</p>
            <h2 className="font-heading italic text-white text-6xl md:text-7xl lg:text-[6rem] leading-[0.9] tracking-[-3px]">
              Predict. Bet.
              <br />
              Claim.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-16">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ filter: "blur(10px)", opacity: 0, y: 30 }}
                whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.15, ease: "easeOut" }}
                className="liquid-glass rounded-[1.25rem] p-6 min-h-[360px] flex flex-col"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="text-white/30 font-heading italic text-4xl tracking-[-1px]">{s.step}</span>
                </div>
                <div className="flex-1" />
                <div className="mt-6">
                  <h3 className="font-heading italic text-white text-3xl md:text-4xl tracking-[-1px] leading-none">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-sm text-white/80 font-body font-light leading-snug max-w-[32ch]">
                    {s.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Marquee items={c3} />

      {/* Why FullTime / Features */}
      <section id="features" className="relative min-h-screen bg-green-950 overflow-hidden">
        <FadingVideo
          src={HERO_VIDEO}
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{ opacity: 0.5 }}
        />

        <div className="relative z-10 px-8 md:px-16 lg:px-20 pt-24 pb-10 flex flex-col min-h-screen">
          <div className="mb-auto">
            <p className="text-sm font-body text-amber-300/80 mb-6">// Why FullTime</p>
            <h2 className="font-heading italic text-white text-6xl md:text-7xl lg:text-[6rem] leading-[0.9] tracking-[-3px]">
              On-Chain
              <br />
              Prediction
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ filter: "blur(10px)", opacity: 0, y: 30 }}
                whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.15, ease: "easeOut" }}
                className="liquid-glass-strong rounded-[1.25rem] p-8 min-h-[320px] flex flex-col"
              >
                {f.check && (
                  <div className="liquid-glass w-10 h-10 rounded-full flex items-center justify-center mb-6">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
                <h3 className="font-heading italic text-white text-3xl md:text-4xl tracking-[-1px] leading-none mt-auto">
                  {f.title}
                </h3>
                <p className="mt-3 text-sm text-white/80 font-body font-light leading-snug">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Marquee items={c4} reverse />
      <Marquee items={c5} />
      <Marquee items={c6} reverse />

      {/* Footer */}
      <footer className="relative bg-green-950 border-t border-white/5 px-8 py-8">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
          <button
            onClick={() => navigate("/app")}
            className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black rounded-full px-7 py-3 text-base font-bold flex items-center gap-2 font-body transition-all shadow-lg shadow-amber-500/30"
          >
            Launch dApp <ArrowUpRight />
          </button>
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm text-white/40 font-body">FullTime — Built on Solana. Powered by TxLINE.</span>
            <span className="text-xs text-white/30 font-body">TxODDS x Solana x Superteam Earn Hackathon · {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
