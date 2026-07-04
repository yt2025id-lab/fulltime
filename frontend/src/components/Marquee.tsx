export default function Marquee({
  countries,
  reverse = false,
}: {
  countries: string[];
  reverse?: boolean;
}) {
  const items = [...countries, ...countries]; // double for seamless loop
  return (
    <div className="border-y-4 border-black bg-[#111] py-6 overflow-hidden">
      <div
        className={`flex gap-0 whitespace-nowrap ${
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        }`}
      >
        {items.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3 text-white font-black text-2xl md:text-3xl mx-6"
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
        .animate-marquee { animation: marquee 30s linear infinite; }
        .animate-marquee-reverse { animation: marquee-reverse 30s linear infinite; }
        .animate-marquee:hover, .animate-marquee-reverse:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}
