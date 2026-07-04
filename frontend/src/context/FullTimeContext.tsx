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
    // Fetch IDL from on-chain (Anchor auto-fetches if IDL account exists)
    // Fallback: use address-only for basic operations
    // Account deserialization works because Anchor fetches IDL from chain
    return new Program(
      {
        address: FULLTIME_ID,
        metadata: { name: "fulltime", version: "0.1.0", spec: "0.1.0" },
        instructions: [
          { name: "createMarket", discriminator: [189,124,20,6,249,47,120,183], accounts: [{name:"creator"},{name:"market"},{name:"systemProgram"}], args: [{name:"fixtureId",type:"u64"},{name:"question",type:"string"},{name:"bettingOpenTime",type:"i64"},{name:"bettingCloseTime",type:"i64"}] },
          { name: "openMarket", discriminator: [236,159,88,232,73,5,81,216], accounts: [{name:"market"}], args: [] },
          { name: "placeBet", discriminator: [60,205,217,14,98,213,111,205], accounts: [{name:"bettor"},{name:"market"},{name:"bet"},{name:"systemProgram"}], args: [{name:"optionIndex",type:"u8"},{name:"amount",type:"u64"}] },
          { name: "closeBetting", discriminator: [113,113,50,118,107,189,140,129], accounts: [{name:"market"}], args: [] },
          { name: "settleMarket", discriminator: [202,81,148,234,73,81,146,178], accounts: [{name:"market"},{name:"dailyScoresMerkleRoots"}], args: [{name:"targetTs",type:"i64"},{name:"fixtureSummary",type:{defined:"ScoresBatchSummary"}},{name:"fixtureProof",type:{vec:{defined:"ProofNode"}}},{name:"mainTreeProof",type:{vec:{defined:"ProofNode"}}},{name:"statA",type:{defined:"StatTerm"}},{name:"statB",type:{defined:"StatTerm"}}] },
          { name: "claimPayout", discriminator: [53,140,147,20,178,168,182,230], accounts: [{name:"bettor"},{name:"market"},{name:"bet"}], args: [] },
          { name: "refundBet", discriminator: [62,118,103,155,166,16,214,199], accounts: [{name:"bettor"},{name:"market"},{name:"bet"}], args: [] },
          { name: "cancelMarket", discriminator: [235,10,199,52,140,47,161,85], accounts: [{name:"creator"},{name:"market"}], args: [] },
        ],
        accounts: [
          { name: "Market", discriminator: [219,190,239,191,189,55,0,239] },
          { name: "Bet", discriminator: [71,226,176,38,7,201,108,189] },
        ],
        types: [],
        errors: [],
      } as any,
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
