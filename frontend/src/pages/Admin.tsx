import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram, FULLTIME_ID } from "../context/FullTimeContext";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import Navbar from "../components/Navbar";

const WC_FIXTURES = [
  // Upcoming — Round of 16 / Quarterfinals (live from TxLINE devnet)
  { id: 18202701, home: "Argentina", away: "Egypt" },
  { id: 18202783, home: "Switzerland", away: "Colombia" },
  { id: 18188721, home: "Paraguay", away: "France" },
  { id: 18187298, home: "Brazil", away: "Norway" },
  { id: 18192996, home: "Mexico", away: "England" },
  { id: 18193785, home: "USA", away: "Belgium" },
  { id: 18198205, home: "Portugal", away: "Spain" },
  { id: 18185036, home: "Canada", away: "Morocco" },
  // Past (for testing settlement)
  { id: 18179549, home: "Colombia", away: "Ghana" },
  { id: 18176123, home: "Australia", away: "Egypt" },
  { id: 18167317, home: "South Africa", away: "Canada" },
  { id: 18175918, home: "Argentina", away: "Cape Verde" },
];

export default function Admin() {
  const program = useProgram();
  const wallet = useWallet();
  const [fixtureId, setFixtureId] = useState("");
  const [question, setQuestion] = useState("");
  const [openMinutes, setOpenMinutes] = useState("0");
  const [closeHours, setCloseHours] = useState("1");
  const [txMsg, setTxMsg] = useState("");
  const [createdMarket, setCreatedMarket] = useState<{
    pda: string;
    fixtureId: number;
  } | null>(null);

  function selectFixture(f: (typeof WC_FIXTURES)[0]) {
    setFixtureId(String(f.id));
    setQuestion(`${f.home} vs ${f.away} — Who wins?`);
    setCreatedMarket(null);
  }

  function marketPda(fixtureId: number, creatorPk: PublicKey): string {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        new PublicKey(FULLTIME_ID).toBuffer(),
        creatorPk.toBuffer(),
        new BN(fixtureId).toArrayLike(Buffer, "le", 8),
      ],
      new PublicKey(FULLTIME_ID)
    );
    return pda.toBase58();
  }

  async function createMarket() {
    if (!program || !wallet.publicKey) return;

    const now = Math.floor(Date.now() / 1000);
    const openTime = now + parseInt(openMinutes) * 60;
    const closeTime = openTime + parseInt(closeHours) * 3600;
    const fid = parseInt(fixtureId);

    setTxMsg("Creating market...");
    setCreatedMarket(null);

    try {
      const tx = await program.methods
        .createMarket(new BN(fid), question, new BN(openTime), new BN(closeTime))
        .accounts({ creator: wallet.publicKey })
        .rpc();

      const pda = marketPda(fid, wallet.publicKey);
      setTxMsg(`✅ Market created! TX: ${tx.slice(0, 20)}...`);
      setCreatedMarket({ pda, fixtureId: fid });
    } catch (err: any) {
      setTxMsg(`❌ ${err.message.slice(0, 150)}`);
    }
  }

  async function openMarket(pda: string) {
    if (!program || !wallet.publicKey) return;
    setTxMsg("Opening market...");
    try {
      const tx = await program.methods
        .openMarket()
        .accounts({ market: new PublicKey(pda) })
        .rpc();
      setTxMsg(`✅ Market opened! TX: ${tx.slice(0, 20)}...`);
    } catch (err: any) {
      setTxMsg(`❌ ${err.message.slice(0, 150)}`);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-black mb-8">CREATE MARKET</h1>

        {!wallet.publicKey ? (
          <div className="border-4 border-black p-8 text-center">
            <p className="text-xl font-bold">Connect Phantom to create markets</p>
          </div>
        ) : (
          <>
            {/* Quick select */}
            <div className="border-4 border-black p-6 mb-6 shadow-[4px_4px_0px_#000]">
              <h2 className="font-black text-lg mb-4">QUICK SELECT — World Cup 2026</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {WC_FIXTURES.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => selectFixture(f)}
                    className={`text-xs text-left p-2 border-2 border-black transition-colors ${
                      fixtureId === String(f.id)
                        ? "bg-black text-white"
                        : "bg-white hover:bg-gray-100"
                    }`}
                  >
                    <div className="font-bold">
                      {f.home} vs {f.away}
                    </div>
                    <div className="text-gray-500">#{f.id}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual entry */}
            <div className="border-4 border-black p-6 mb-6 shadow-[4px_4px_0px_#000]">
              <h2 className="font-black text-lg mb-4">MARKET DETAILS</h2>

              <label className="block text-sm font-bold mb-1">Fixture ID</label>
              <input
                value={fixtureId}
                onChange={(e) => setFixtureId(e.target.value)}
                placeholder="e.g. 18179549"
                className="w-full border-2 border-black px-3 py-2 font-mono mb-4"
              />

              <label className="block text-sm font-bold mb-1">Question (max 200 chars)</label>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Colombia vs Ghana — Who wins?"
                maxLength={200}
                className="w-full border-2 border-black px-3 py-2 font-mono mb-4"
              />

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Open in (min)</label>
                  <input
                    type="number"
                    value={openMinutes}
                    onChange={(e) => setOpenMinutes(e.target.value)}
                    min="0"
                    className="w-full border-2 border-black px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Duration (hours)</label>
                  <input
                    type="number"
                    value={closeHours}
                    onChange={(e) => setCloseHours(e.target.value)}
                    min="1"
                    className="w-full border-2 border-black px-3 py-2"
                  />
                </div>
              </div>

              <button
                onClick={createMarket}
                disabled={!fixtureId || !question}
                className="w-full bg-[#FFD700] py-3 border-2 border-black font-black text-lg shadow-[4px_4px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CREATE MARKET
              </button>
            </div>

            {txMsg && (
              <div className="border-2 border-black p-4 bg-gray-100 text-sm font-mono break-all">
                {txMsg}
              </div>
            )}

            {createdMarket && (
              <div className="mt-6 border-4 border-black p-6 shadow-[4px_4px_0px_#000] bg-[#FFD700]/20">
                <h2 className="font-black text-lg mb-4">✅ MARKET CREATED</h2>
                <p className="text-sm font-mono break-all mb-2">
                  <span className="font-bold">PDA:</span> {createdMarket.pda.slice(0, 16)}...
                </p>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => openMarket(createdMarket.pda)}
                    className="flex-1 bg-black text-white py-2 border-2 border-black font-bold text-sm shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000] transition-all"
                  >
                    OPEN MARKET
                  </button>
                  <Link
                    to={`/markets/${createdMarket.pda}`}
                    className="flex-1 text-center bg-[#FFD700] py-2 border-2 border-black font-bold text-sm shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000] transition-all"
                  >
                    VIEW MARKET ↗
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
