import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";

export const FULLTIME_ID = "58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x";

// ─── Anchor Program Context ──────────────────────────────────────
interface ProgramCtx {
  program: Program | null;
}

const ProgramContext = createContext<ProgramCtx>({ program: null });

function AnchorProgramProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [idl, setIdl] = useState<any>(null);

  useEffect(() => {
    fetch("/idl.json")
      .then((r) => r.json())
      .then(setIdl)
      .catch(() => console.warn("IDL not found, using minimal"));
  }, []);

  const program = useMemo(() => {
    if (!connection || !idl) return null;
    if (!wallet) {
      try {
        const provider = new AnchorProvider(connection, { publicKey: PublicKey.default } as any, { commitment: "confirmed" });
        return new Program(idl, provider);
      } catch {
        return null;
      }
    }
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new Program(idl, provider);
  }, [connection, wallet, idl]);

  return (
    <ProgramContext.Provider value={{ program }}>
      {children}
    </ProgramContext.Provider>
  );
}

// ─── Top-level Provider ──────────────────────────────────────────
export function AppProviders({ children }: { children: ReactNode }) {
  const endpoint = import.meta.env.VITE_RPC_URL || clusterApiUrl("devnet");
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new TorusWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AnchorProgramProvider>{children}</AnchorProgramProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function useProgram(): Program | null {
  return useContext(ProgramContext).program;
}
