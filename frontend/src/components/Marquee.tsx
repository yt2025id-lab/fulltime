export default function Marquee({
  countries,
  reverse = false,
}: {
  countries: string[];
  reverse?: boolean;
}) {
  const items = [...countries, ...countries]; // double for seamless loop
  return (
    <div className="border-y-4 border-black bg-[#111] py-4 overflow-hidden">
      <div
        className={`flex gap-6 whitespace-nowrap animate-marquee ${
          reverse ? "animate-marquee-reverse" : ""
        }`}
      >
        {items.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 text-white text-sm font-bold px-4 py-2 border-2 border-white/20 bg-white/5"
          >
            {c}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-marquee { animation: marquee 40s linear infinite; }
        .animate-marquee-reverse { animation: marquee-reverse 40s linear infinite; }
        .animate-marquee:hover, .animate-marquee-reverse:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}
