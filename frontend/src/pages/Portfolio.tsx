import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "../context/FullTimeContext";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import Navbar from "../components/Navbar";

interface BetView {
  pda: string;
  market: string;
  optionIndex: number;
  amount: number;
  claimed: boolean;
  marketQuestion?: string;
  marketStatus?: string;
  marketWinner?: number;
}

export default function Portfolio() {
  const program = useProgram();
  const wallet = useWallet();
  const [bets, setBets] = useState<BetView[]>([]);
  const [loading, setLoading] = useState(true);
  const [txMsg, setTxMsg] = useState("");

  useEffect(() => {
    if (!program || !wallet.publicKey) {
      setLoading(false);
      return;
    }
    loadBets();
  }, [program, wallet.publicKey]);

  async function loadBets() {
    if (!program || !wallet.publicKey) return;
    try {
      const allBets = await (program as any).account.bet.all([
        { memcmp: { offset: 40, bytes: wallet.publicKey.toBase58() } },
      ]);

      const data: BetView[] = [];
      for (const b of allBets) {
        try {
          const bet = b.account;
          let marketQuestion = "";
          let marketStatus = "";
          let marketWinner = 0;
          try {
            const m = await (program as any).account.market.fetch(bet.market);
            marketQuestion = m.question;
            marketStatus = Object.keys(m.status)[0];
            marketWinner = m.winningOption;
          } catch {}

          data.push({
            pda: b.publicKey.toBase58(),
            market: bet.market.toBase58(),
            optionIndex: bet.optionIndex,
            amount: bet.amount.toNumber() / LAMPORTS_PER_SOL,
            claimed: bet.claimed,
            marketQuestion,
            marketStatus,
            marketWinner,
          });
        } catch {}
      }

      setBets(data);
    } catch (err) {
      console.error("Failed to load bets:", err);
    } finally {
      setLoading(false);
    }
  }

  async function claim(bet: BetView) {
    if (!program || !wallet.publicKey) return;
    setTxMsg("Claiming...");
    try {
      const tx = await program.methods
        .claimPayout()
        .accounts({
          bettor: wallet.publicKey,
          market: new PublicKey(bet.market),
          bet: new PublicKey(bet.pda),
        })
        .rpc();
      setTxMsg(`✅ ${tx.slice(0, 20)}...`);
      loadBets();
    } catch (err: any) {
      setTxMsg(`❌ ${err.message.slice(0, 100)}`);
    }
  }

  async function refund(bet: BetView) {
    if (!program || !wallet.publicKey) return;
    setTxMsg("Refunding...");
    try {
      const tx = await program.methods
        .refundBet()
        .accounts({
          bettor: wallet.publicKey,
          market: new PublicKey(bet.market),
        })
        .rpc();
      setTxMsg(`✅ ${tx.slice(0, 20)}...`);
      loadBets();
    } catch (err: any) {
      setTxMsg(`❌ ${err.message.slice(0, 100)}`);
    }
  }

  if (!wallet.publicKey) {
    return (
      <div>
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <p className="text-xl font-bold">Connect Phantom wallet to see your portfolio</p>
        </div>
      </div>
    );
  }

  const options = ["HOME", "DRAW", "AWAY"];
  const active = bets.filter((b) => !b.claimed);
  const claimed = bets.filter((b) => b.claimed);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-black mb-8">PORTFOLIO</h1>

        {loading ? (
          <p>Loading...</p>
        ) : bets.length === 0 ? (
          <div className="text-center py-12 border-4 border-black shadow-[4px_4px_0px_#000]">
            <p className="text-xl font-bold mb-4">No bets yet</p>
            <Link to="/markets" className="inline-block bg-[#FFD700] px-6 py-3 border-2 border-black font-bold">
              EXPLORE MARKETS
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-black mb-4">ACTIVE ({active.length})</h2>
            <div className="space-y-3 mb-8">
              {active.map((b) => (
                <div key={b.pda} className="border-4 border-black p-4 shadow-[4px_4px_0px_#000]">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link to={`/markets/${b.market}`} className="font-bold hover:underline">
                        {b.marketQuestion || b.market.slice(0, 8) + "..."}
                      </Link>
                      <p className="text-sm text-gray-500 mt-1">
                        {options[b.optionIndex]} · {b.amount.toFixed(4)} SOL
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {b.marketStatus === "settled" && b.marketWinner === b.optionIndex && (
                        <button onClick={() => claim(b)} className="bg-[#FF1493] text-white text-xs font-bold px-3 py-1.5 border-2 border-black">
                          CLAIM
                        </button>
                      )}
                      {b.marketStatus === "cancelled" && (
                        <button onClick={() => refund(b)} className="bg-[#FFD700] text-xs font-bold px-3 py-1.5 border-2 border-black">
                          REFUND
                        </button>
                      )}
                      <span className="text-xs font-bold px-2 py-1 border border-black bg-gray-100">
                        {b.marketStatus?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="text-xl font-black mb-4 mt-8">HISTORY ({claimed.length})</h2>
            <div className="space-y-3 opacity-50">
              {claimed.map((b) => (
                <div key={b.pda} className="border-2 border-black p-3">
                  <p className="font-bold text-sm">
                    {b.marketQuestion || b.market.slice(0, 8) + "..."}
                  </p>
                  <p className="text-xs text-gray-500">
                    {options[b.optionIndex]} · {b.amount.toFixed(4)} SOL · Claimed
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {txMsg && (
          <div className="mt-4 border-2 border-black p-3 bg-gray-100 text-sm font-mono break-all">
            {txMsg}
          </div>
        )}
      </div>
    </div>
  );
}
