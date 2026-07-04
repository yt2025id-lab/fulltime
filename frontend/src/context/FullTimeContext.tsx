import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import { clusterApiUrl } from "@solana/web3.js";
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

  const program = useMemo(() => {
    if (!connection || !wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new Program(
      // Minimal IDL — cukup address dan account types
      { address: FULLTIME_ID, instructions: [], accounts: [], types: [], errors: [] } as any,
      provider
    );
  }, [connection, wallet]);

  return (
    <ProgramContext.Provider value={{ program }}>
      {children}
    </ProgramContext.Provider>
  );
}

// ─── Top-level Provider ──────────────────────────────────────────
export function AppProviders({ children }: { children: ReactNode }) {
  const endpoint = clusterApiUrl("devnet");
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

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
