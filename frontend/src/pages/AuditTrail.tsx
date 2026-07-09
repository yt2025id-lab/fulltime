import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useProgram } from "../context/FullTimeContext";
import { PublicKey } from "@solana/web3.js";
import Navbar from "../components/Navbar";

export default function AuditTrail() {
  const { id } = useParams<{ id: string }>();
  const program = useProgram();
  const [market, setMarket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !program) return;
    (async () => {
      try {
        const m = await (program as any).account.market.fetch(new PublicKey(id));
        setMarket({
          fixtureId: m.fixtureId.toNumber(),
          question: m.question,
          status: Object.keys(m.status)[0],
          winningOption: m.winningOption,
          settlementRoot: m.settlementRoot.toBase58(),
          settlementEpochDay: m.settlementEpochDay,
          settlementTs: m.settlementTs.toNumber(),
          disputeUntil: m.disputeUntil.toNumber(),
          totalPool: m.totalPool.toNumber() / 1e9,
          poolYes: m.poolYes.toNumber() / 1e9,
          poolNo: m.poolNo.toNumber() / 1e9,
        });
      } catch {}
      setLoading(false);
    })();
  }, [id, program]);

  if (loading) return <div><Navbar /><p className="text-center py-12">Loading...</p></div>;
  if (!market) return <div><Navbar /><p className="text-center py-12">Market not found</p></div>;

  const solscan = "https://solscan.io";
  const programAddr = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";
  const txlinePda = market.settlementRoot;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to={`/markets/${id}`} className="text-sm font-bold underline mb-4 block">
          ← Back to Market
        </Link>
        <h1 className="text-4xl font-black mb-2">AUDIT TRAIL</h1>
        <p className="text-gray-500 mb-8 text-lg">{market.question}</p>

        {/* Settlement verification */}
        <div className="border-4 border-black p-6 mb-6 shadow-[4px_4px_0px_#000]">
          <h2 className="font-black text-lg mb-4">🔗 ON-CHAIN SETTLEMENT VERIFICATION</h2>

          <div className="space-y-4 text-sm">
            <div className="border-b-2 border-black pb-3">
              <p className="font-bold text-gray-500 uppercase text-xs mb-1">FullTime Program</p>
              <a
                href={`${solscan}/account/${programAddr}?cluster=devnet`}
                target="_blank"
                rel="noopener"
                className="font-mono break-all underline hover:text-[#FF1493]"
              >
                {programAddr}
              </a>
            </div>

            <div className="border-b-2 border-black pb-3">
              <p className="font-bold text-gray-500 uppercase text-xs mb-1">Market Account</p>
              <a
                href={`${solscan}/account/${id}?cluster=devnet`}
                target="_blank"
                rel="noopener"
                className="font-mono break-all underline hover:text-[#FF1493]"
              >
                {id}
              </a>
            </div>

            <div className="border-b-2 border-black pb-3">
              <p className="font-bold text-gray-500 uppercase text-xs mb-1">TxLINE Merkle Root PDA</p>
              <a
                href={`${solscan}/account/${txlinePda}?cluster=devnet`}
                target="_blank"
                rel="noopener"
                className="font-mono break-all underline hover:text-[#FF1493]"
              >
                {txlinePda}
              </a>
            </div>

            <div>
              <p className="font-bold text-gray-500 uppercase text-xs mb-1">Epoch Day</p>
              <p className="font-mono text-lg">{market.settlementEpochDay}</p>
            </div>
          </div>
        </div>

        {/* Settlement details */}
        {market.status === "settled" && (
          <div className="border-4 border-black p-6 mb-6 shadow-[4px_4px_0px_#000] bg-[#00FFFF]/20">
            <h2 className="font-black text-lg mb-4">SETTLEMENT DETAILS</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-bold text-gray-500">Winner:</span> {["HOME","DRAW","AWAY"][market.winningOption] ?? "?"}</div>
              <div><span className="font-bold text-gray-500">Settled:</span> {market.settlementTs > 0 ? new Date(market.settlementTs * 1000).toISOString() : "N/A"}</div>
              <div><span className="font-bold text-gray-500">Dispute Until:</span> {market.disputeUntil > 0 ? new Date(market.disputeUntil * 1000).toISOString() : "N/A"}</div>
            </div>
          </div>
        )}

        <div className="border-2 border-black p-4 bg-gray-50 text-sm text-gray-600">
          <p className="font-bold mb-2">HOW TO VERIFY INDEPENDENTLY</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open the <strong>TxLINE Merkle Root PDA</strong> link above to see the on-chain Merkle root published by TxODDS</li>
            <li>Open the <strong>Market Account</strong> link to see the settlement state (winning option, timestamp, dispute window)</li>
            <li>Cross-reference the Merkle root with the fixture data from TxLINE API documentation</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
