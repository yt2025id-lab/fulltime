import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProgram, FULLTIME_ID } from "../context/FullTimeContext";
import Navbar from "../components/Navbar";

interface MarketData {
  pda: string;
  fixtureId: number;
  question: string;
  creator: string;
  totalPool: number;
  status: string;
  poolYes: number;
  poolNo: number;
  bettingCloseTime: number;
  isTrustless: boolean;
}

const STATUS_MAP: Record<string, string> = {
  pending: "PENDING",
  open: "OPEN",
  closed: "CLOSED",
  settled: "SETTLED",
  cancelled: "CANCELLED",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-200 text-gray-700",
  open: "bg-green-200 text-green-800",
  closed: "bg-yellow-200 text-yellow-800",
  settled: "bg-blue-200 text-blue-800",
  cancelled: "bg-red-200 text-red-800",
};

export default function Markets() {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const program = useProgram();

  useEffect(() => {
    if (!program) return;
    loadMarkets();
  }, [program]);

  async function loadMarkets() {
    if (!program) return;
    try {
      const allMarkets = await (program as any).account.market.all();
      const data: MarketData[] = allMarkets.map((m: any) => ({
        pda: m.publicKey.toBase58(),
        fixtureId: m.account.fixtureId.toNumber(),
        question: m.account.question,
        creator: m.account.creator.toBase58(),
        totalPool: m.account.totalPool.toNumber() / 1e9,
        status: Object.keys(m.account.status)[0],
        poolYes: m.account.poolYes.toNumber() / 1e9,
        poolNo: m.account.poolNo.toNumber() / 1e9,
        bettingCloseTime: m.account.bettingCloseTime.toNumber(),
        isTrustless: m.account.isTrustless,
      }));

      setMarkets(data.sort((a, b) => {
        const priority = (s: string) => s === "open" ? 0 : 1;
        const p = priority(a.status) - priority(b.status);
        return p !== 0 ? p : b.bettingCloseTime - a.bettingCloseTime;
      }));
    } catch (err) {
      console.error("Failed to load markets:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered =
    filter === "all"
      ? markets
      : markets.filter((m) => m.status === filter);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-black">MARKETS</h1>
          <div className="flex gap-2">
            {["all", "open", "settled"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs font-bold uppercase px-3 py-1.5 border-2 border-black transition-colors ${
                  filter === f
                    ? "bg-black text-white"
                    : "bg-white text-black hover:bg-gray-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-12">Loading markets...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl font-bold mb-4">No markets found</p>
            <Link
              to="/admin"
              className="inline-block bg-[#FFD700] px-6 py-3 border-2 border-black font-bold"
            >
              CREATE FIRST MARKET
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <Link
                key={m.pda}
                to={`/markets/${m.pda}`}
                className="border-4 border-black bg-white p-5 shadow-[4px_4px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#000] transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs text-gray-500 font-bold">
                    #{m.fixtureId}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 border border-black ${STATUS_COLORS[m.status]}`}
                  >
                    {STATUS_MAP[m.status] ?? m.status}
                  </span>
                </div>
                <h3 className="font-bold text-lg leading-tight mb-3">
                  {m.question}
                </h3>
                <div className="flex justify-between text-sm border-t-2 border-black pt-3">
                  <span className="text-gray-500">Pool</span>
                  <span className="font-bold">{m.totalPool.toFixed(2)} SOL</span>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>
                    YES: {m.poolYes.toFixed(2)}
                  </span>
                  <span>
                    NO: {m.poolNo.toFixed(2)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
