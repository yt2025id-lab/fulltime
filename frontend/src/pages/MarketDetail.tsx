import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "../context/FullTimeContext";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import Navbar from "../components/Navbar";

interface MarketView {
  pda: string;
  fixtureId: number;
  question: string;
  creator: string;
  totalPool: number;
  poolHome: number;
  poolDraw: number;
  poolAway: number;
  status: string;
  winningOption: number;
  settlementTs: number;
  disputeUntil: number;
  bettingOpenTime: number;
  bettingCloseTime: number;
  feeBps: number;
}

const STATUS_MAP: Record<string, string> = {
  pending: "PENDING",
  open: "OPEN",
  closed: "CLOSED",
  settled: "SETTLED",
  cancelled: "CANCELLED",
};

export default function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const program = useProgram();
  const wallet = useWallet();
  const [market, setMarket] = useState<MarketView | null>(null);
  const [amount, setAmount] = useState("0.1");
  const [option, setOption] = useState(0);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState("");

  useEffect(() => {
    if (!id || !program) return;
    fetchMarket();
  }, [id, program]);

  async function fetchMarket() {
    try {
      const m = await (program as any).account.market.fetch(new PublicKey(id!));
      setMarket({
        pda: id!,
        fixtureId: m.fixtureId.toNumber(),
        question: m.question,
        creator: m.creator.toBase58(),
        totalPool: m.totalPool.toNumber() / LAMPORTS_PER_SOL,
        poolHome: m.poolHome.toNumber() / LAMPORTS_PER_SOL,
        poolDraw: m.poolDraw.toNumber() / LAMPORTS_PER_SOL,
        poolAway: m.poolAway.toNumber() / LAMPORTS_PER_SOL,
        status: Object.keys(m.status)[0],
        winningOption: m.winningOption,
        settlementTs: m.settlementTs.toNumber(),
        disputeUntil: m.disputeUntil.toNumber(),
        bettingOpenTime: m.bettingOpenTime.toNumber(),
        bettingCloseTime: m.bettingCloseTime.toNumber(),
        feeBps: m.feeBps,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function placeBet() {
    if (!program || !wallet.publicKey || !market) return;
    setTxStatus("Placing bet...");

    try {
      const tx = await program.methods
        .placeBet(option, new BN(parseFloat(amount) * LAMPORTS_PER_SOL))
        .accounts({
          bettor: wallet.publicKey,
          market: new PublicKey(market.pda),
        })
        .rpc();

      setTxStatus(`✅ Bet placed! TX: ${tx.slice(0, 20)}...`);
      fetchMarket();
    } catch (err: any) {
      setTxStatus(`❌ ${err.message.slice(0, 100)}`);
    }
  }

  async function claimPayout() {
    if (!program || !wallet.publicKey || !market) return;
    setTxStatus("Claiming payout...");

    const [betPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), new PublicKey(market.pda).toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    );

    try {
      const tx = await program.methods
        .claimPayout()
        .accounts({ bettor: wallet.publicKey, market: new PublicKey(market.pda), bet: betPda })
        .rpc();
      setTxStatus(`✅ Claimed! TX: ${tx.slice(0, 20)}...`);
      fetchMarket();
    } catch (err: any) {
      setTxStatus(`❌ ${err.message.slice(0, 100)}`);
    }
  }

  if (loading)
    return (
      <div>
        <Navbar />
        <p className="text-center py-12">Loading...</p>
      </div>
    );

  if (!market)
    return (
      <div>
        <Navbar />
        <p className="text-center py-12">Market not found</p>
      </div>
    );

  const options = ["HOME", "DRAW", "AWAY"];
  const pools = [market.poolHome, market.poolDraw, market.poolAway];
  const maxPool = Math.max(...pools, 0.001);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-black mb-2">{market.question}</h1>
            <p className="text-sm text-gray-500">
              Fixture #{market.fixtureId} · Fee: {market.feeBps / 100}%
            </p>
          </div>
          <span
            className={`text-sm font-bold px-3 py-1 border-2 border-black ${
              market.status === "open" ? "bg-[#FFD700]" :
              market.status === "settled" ? "bg-[#00FFFF]" :
              market.status === "closed" ? "bg-gray-200" :
              market.status === "cancelled" ? "bg-red-200" : "bg-white"
            }`}
          >
            {STATUS_MAP[market.status] ?? market.status}
          </span>
        </div>

        {/* Pool distribution */}
        <div className="border-4 border-black p-6 mb-6 shadow-[4px_4px_0px_#000]">
          <h2 className="font-black text-lg mb-4">POOL DISTRIBUTION</h2>
          {options.map((opt, i) => (
            <div key={opt} className="mb-3">
              <div className="flex justify-between text-sm font-bold mb-1">
                <span>{opt}</span>
                <span>{pools[i].toFixed(4)} SOL</span>
              </div>
              <div className="h-4 border-2 border-black bg-white">
                <div
                  className="h-full bg-[#FF1493]"
                  style={{ width: `${(pools[i] / maxPool) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <div className="text-right text-sm font-bold mt-2">
            Total: {market.totalPool.toFixed(4)} SOL
          </div>
        </div>

        {/* Betting section */}
        {market.status === "open" && wallet.publicKey && (
          <div className="border-4 border-black p-6 mb-6 shadow-[4px_4px_0px_#000]">
            <h2 className="font-black text-lg mb-4">PLACE BET</h2>
            <div className="flex gap-2 mb-4">
              {options.map((opt, i) => (
                <button
                  key={opt}
                  onClick={() => setOption(i)}
                  className={`flex-1 py-2 border-2 border-black font-bold text-sm transition-colors ${
                    option === i
                      ? "bg-black text-white"
                      : "bg-white hover:bg-gray-100"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0.01"
                className="flex-1 border-2 border-black px-3 py-2 font-bold text-lg"
              />
              <span className="flex items-center font-bold text-sm">SOL</span>
            </div>
            <button
              onClick={placeBet}
              className="w-full bg-[#FFD700] py-3 border-2 border-black font-black text-lg shadow-[4px_4px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#000] transition-all"
            >
              PLACE BET
            </button>
          </div>
        )}

        {/* Settled: claim button */}
        {market.status === "settled" && wallet.publicKey && (
          <div className="border-4 border-black p-6 mb-6 shadow-[4px_4px_0px_#000] bg-[#00FFFF]/20">
            <h2 className="font-black text-lg mb-2">
              WINNER: {options[market.winningOption]}
            </h2>
            <button
              onClick={claimPayout}
              className="w-full bg-[#FF1493] text-white py-3 border-2 border-black font-black text-lg shadow-[4px_4px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#000] transition-all mt-4"
            >
              CLAIM PAYOUT
            </button>
          </div>
        )}

        {/* Audit link */}
        {market.status === "settled" && (
          <Link
            to={`/markets/${market.pda}/audit`}
            className="inline-block w-full text-center bg-black text-white py-3 border-2 border-black font-black text-lg mb-6 hover:bg-gray-800"
          >
            VIEW AUDIT TRAIL ↗
          </Link>
        )}

        {/* Transaction status */}
        {txStatus && (
          <div className="border-2 border-black p-3 bg-gray-100 text-sm font-mono break-all">
            {txStatus}
          </div>
        )}

        {/* Wallet connect prompt */}
        {!wallet.publicKey && (
          <div className="text-center py-6 border-2 border-black bg-gray-100">
            <p className="font-bold">Connect Phantom wallet to place bets</p>
          </div>
        )}
      </div>
    </div>
  );
}
