import { Link, useLocation } from "react-router-dom";
import {
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";

export default function Navbar() {
  const { pathname } = useLocation();

  const links = [
    { to: "/markets", label: "Markets" },
    { to: "/portfolio", label: "Portfolio" },
    { to: "/admin", label: "Admin" },
  ];

  return (
    <nav className="border-b-4 border-black bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity flex items-center gap-2"
        >
          <img src="/logo fulltime.png" alt="FullTime" className="h-10 w-auto" />
        </Link>

        <div className="flex items-center gap-6">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm font-bold uppercase tracking-wide border-b-2 pb-0.5 transition-colors ${
                pathname.startsWith(l.to)
                  ? "border-[#FF1493] text-black"
                  : "border-transparent text-gray-500 hover:text-black"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <WalletMultiButton className="!bg-[#FFD700] !text-black !border-2 !border-black !shadow-[3px_3px_0px_#000] !rounded-none !font-bold !text-sm !py-1.5 !px-4 hover:!translate-x-[1px] hover:!translate-y-[1px] hover:!shadow-[1px_1px_0px_#000] !transition-all" />
        </div>
      </div>
    </nav>
  );
}
