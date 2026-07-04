import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <nav className="border-b-4 border-black bg-white">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center">
          <img src="/logo fulltime.png" alt="FullTime" className="h-10 w-auto" />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="text-6xl md:text-8xl font-black leading-none mb-6">
          CRYPTO SETTLES.
          <br />
          <span className="text-[#FF1493]">NO REFEREE</span> NEEDED.
        </h1>

        <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-12 leading-relaxed">
          Prediction market on-chain untuk World Cup 2026. Settlement otomatis
          diverifikasi secara kriptografis via Merkle proofs dari TxLINE — tanpa
          admin, tanpa tombol "resolve", tanpa kepercayaan.
        </p>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            to="/markets"
            className="bg-[#FF1493] text-white text-lg font-bold px-8 py-4 border-4 border-black shadow-[6px_6px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            EXPLORE MARKETS
          </Link>
          <Link
            to="/admin"
            className="bg-[#FFD700] text-black text-lg font-bold px-8 py-4 border-4 border-black shadow-[6px_6px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            CREATE MARKET
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            {
              title: "TRUSTLESS",
              desc: "Settlement diverifikasi via Merkle proof on-chain. Tidak ada pihak yang harus dipercaya — semua bukti tersimpan permanen di Solana.",
            },
            {
              title: "AUTOMATIC",
              desc: "Begitu peluit akhir dibunyikan, relay service mendeteksi, memverifikasi, dan menyelesaikan market — dalam hitungan detik.",
            },
            {
              title: "AUDITABLE",
              desc: "Setiap settlement meninggalkan jejak on-chain yang bisa diverifikasi siapa saja via Solana Explorer.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="border-4 border-black p-6 shadow-[4px_4px_0px_#000]"
            >
              <h3 className="text-lg font-black mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
