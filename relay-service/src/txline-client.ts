/**
 * TxLINE API Client — handles authentication, subscription, and data fetching
 *
 * Alur autentikasi:
 * 1. Guest JWT dari /auth/guest/start
 * 2. Subscribe on-chain via Anchor program (free tier = Service Level 1)
 * 3. Aktivasi API token via /api/token/activate
 * 4. Gunakan jwt + apiToken untuk semua request data selanjutnya
 */

import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import axios, { AxiosInstance } from "axios";
import nacl from "tweetnacl";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// ─── Network Configuration ────────────────────────────────────────
export type Network = "mainnet" | "devnet";

const CONFIG: Record<
  Network,
  {
    rpcUrl: string;
    apiOrigin: string;
    programId: string;
    txlTokenMint: string;
  }
> = {
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    apiOrigin: "https://txline.txodds.com",
    programId: "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA",
    txlTokenMint: "Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL",
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    apiOrigin: "https://txline-dev.txodds.com",
    programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
    txlTokenMint: "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",
  },
};

// ─── Game Phase Encoding (dari TxLINE Soccer Feed docs) ────────────
export const GAME_PHASES: Record<number, string> = {
  1: "Not Started",
  2: "First Half",
  3: "Half Time",
  4: "Second Half",
  5: "Full Time (Finished)",
  6: "Waiting Extra Time",
  7: "Extra Time 1H",
  8: "Extra Time HT",
  9: "Extra Time 2H",
  10: "Finished After ET",
  11: "Waiting Penalties",
  12: "Penalties",
  13: "Finished After Penalties",
  14: "Interrupted",
  15: "Abandoned",
  16: "Cancelled",
};

/** Phase yang menandakan match benar-benar selesai (bisa di-settle) */
export const SETTLEMENT_PHASES = [5, 10, 13] as const;

/** Phase yang menandakan match dibatalkan (market harus dicancel) */
export const CANCELLATION_PHASES = [15, 16] as const;

// ─── TxLINE Client Class ──────────────────────────────────────────
export class TxLineClient {
  private network: Network;
  private connection: Connection;
  private programId: PublicKey;
  private txlTokenMint: PublicKey;
  private apiOrigin: string;
  private apiBaseUrl: string;

  private jwt: string | null = null;
  private apiToken: string | null = null;
  private httpClient: AxiosInstance | null = null;
  private program: anchor.Program | null = null;

  constructor(network: Network = "devnet") {
    this.network = network;
    const cfg = CONFIG[network];

    this.connection = new Connection(cfg.rpcUrl, "confirmed");
    this.programId = new PublicKey(cfg.programId);
    this.txlTokenMint = new PublicKey(cfg.txlTokenMint);
    this.apiOrigin = cfg.apiOrigin;
    this.apiBaseUrl = `${cfg.apiOrigin}/api`;
  }

  // ─── Authentication ──────────────────────────────────────────
  async authenticate(): Promise<void> {
    // Step 1: Guest JWT
    const authRes = await axios.post(
      `${this.apiOrigin}/auth/guest/start`
    );
    this.jwt = authRes.data.token;

    // Step 2: Load wallet & subscribe on-chain
    const wallet = this.loadWallet();

    // Load IDL sesuai network
    const idlFileName =
      this.network === "mainnet"
        ? "txoracle_mainnet.json"
        : "txoracle_devnet.json";
    const idlPath = path.resolve(
      __dirname,
      "../idl",
      idlFileName
    );
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

    const provider = new anchor.AnchorProvider(
      this.connection,
      wallet,
      { commitment: "confirmed" }
    );
    anchor.setProvider(provider);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.program = new (anchor.Program as any)(idl, provider);

    // Create ATA if needed
    const userTokenAccount = getAssociatedTokenAddressSync(
      this.txlTokenMint,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const accountInfo =
      await this.connection.getAccountInfo(userTokenAccount);
    if (!accountInfo) {
      const createAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userTokenAccount,
        wallet.publicKey,
        this.txlTokenMint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const createTx = new anchor.web3.Transaction().add(createAtaIx);
      await anchor.web3.sendAndConfirmTransaction(
        this.connection,
        createTx,
        [wallet.payer as anchor.web3.Keypair]
      );
    }

    // Subscribe to free tier
    const txSig = await this.program.methods
      .subscribe(1, 4)
      .accounts({
        user: wallet.publicKey,
        pricingMatrix: PublicKey.findProgramAddressSync(
          [Buffer.from("pricing_matrix")],
          this.programId
        )[0],
        tokenMint: this.txlTokenMint,
        userTokenAccount,
        tokenTreasuryVault: getAssociatedTokenAddressSync(
          this.txlTokenMint,
          PublicKey.findProgramAddressSync(
            [Buffer.from("token_treasury_v2")],
            this.programId
          )[0],
          true,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ),
        tokenTreasuryPda: PublicKey.findProgramAddressSync(
          [Buffer.from("token_treasury_v2")],
          this.programId
        )[0],
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Step 3: Activate API token
    const SELECTED_LEAGUES: number[] = [];
    const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${this.jwt}`;
    const message = new TextEncoder().encode(messageString);
    const sigBytes = nacl.sign.detached(
      message,
      (wallet.payer as anchor.web3.Keypair).secretKey
    );
    const walletSignature = Buffer.from(sigBytes).toString("base64");

    const activationRes = await axios.post(
      `${this.apiBaseUrl}/token/activate`,
      { txSig, walletSignature, leagues: SELECTED_LEAGUES },
      { headers: { Authorization: `Bearer ${this.jwt}` } }
    );

    this.apiToken =
      activationRes.data.token || activationRes.data;

    // Step 4: Create HTTP client
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.jwt}`,
        "X-Api-Token": this.apiToken!,
      },
      baseURL: this.apiOrigin,
    });
  }

  // ─── Data Fetching ───────────────────────────────────────────
  async getFixtures(
    competitionId?: number
  ): Promise<TxLineFixture[]> {
    this.requireAuth();
    const params = competitionId
      ? { competitionId }
      : undefined;
    const res = await this.httpClient!.get("/api/fixtures/snapshot", {
      params,
    });
    return res.data;
  }

  async getScoresSnapshot(
    fixtureId: number
  ): Promise<TxLineScore[]> {
    this.requireAuth();
    const res = await this.httpClient!.get(
      `/api/scores/snapshot/${fixtureId}`
    );
    return Array.isArray(res.data) ? res.data : [];
  }

  async getScoresUpdates(
    fixtureId: number
  ): Promise<TxLineScore[]> {
    this.requireAuth();
    const res = await this.httpClient!.get(
      `/api/scores/updates/${fixtureId}`
    );
    return Array.isArray(res.data) ? res.data : [];
  }

  async getStatValidation(params: {
    fixtureId: number;
    seq: number;
    statKey: number;
    statKey2?: number;
  }): Promise<StatValidationResponse> {
    this.requireAuth();
    const res = await this.httpClient!.get(
      "/api/scores/stat-validation",
      { params }
    );
    return res.data;
  }

  // ─── Phase Detection ─────────────────────────────────────────
  async detectPhase(
    fixtureId: number
  ): Promise<{
    phase: number;
    phaseName: string;
    canSettle: boolean;
    reason: string;
  }> {
    const scores = await this.getScoresUpdates(fixtureId);
    if (!scores || scores.length === 0) {
      return {
        phase: 1,
        phaseName: "Not Started",
        canSettle: false,
        reason: "No score data available",
      };
    }

    const latestScore = scores[scores.length - 1];
    const phase = latestScore.Phase ?? 1;

    return {
      phase,
      phaseName: GAME_PHASES[phase] ?? `Unknown (${phase})`,
      canSettle: (SETTLEMENT_PHASES as readonly number[]).includes(
        phase
      ),
      reason: (CANCELLATION_PHASES as readonly number[]).includes(
        phase
      )
        ? "Match cancelled/abandoned"
        : (SETTLEMENT_PHASES as readonly number[]).includes(phase)
          ? "Match finished — ready to settle"
          : "Match still in progress",
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────
  private loadWallet(): anchor.Wallet {
    const keypairPath = path.resolve(
      process.env.HOME || "~",
      ".config/solana/id.json"
    );
    const secretKey = JSON.parse(
      fs.readFileSync(keypairPath, "utf-8")
    );
    const keypair = anchor.web3.Keypair.fromSecretKey(
      Uint8Array.from(secretKey)
    );
    return new anchor.Wallet(keypair);
  }

  private requireAuth(): void {
    if (!this.httpClient || !this.jwt || !this.apiToken) {
      throw new Error(
        "Client not authenticated. Call authenticate() first."
      );
    }
  }
}

// ─── Type Definitions ─────────────────────────────────────────────
export interface TxLineFixture {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  Participant1IsHome: boolean;
  StartTime: string;
  Status?: string;
  CompetitionId?: number;
}

export interface TxLineScore {
  StatKey?: number;
  Value?: number;
  Phase?: number;
  Timestamp?: number;
}

export interface StatValidationResponse {
  summary: {
    fixtureId: number;
    updateStats: {
      updateCount: number;
      minTimestamp: number;
      maxTimestamp: number;
    };
    eventStatsSubTreeRoot: string;
  };
  subTreeProof: ProofNode[];
  mainTreeProof: ProofNode[];
  statToProve: number;
  eventStatRoot: string;
  statProof: ProofNode[];
  statToProve2?: number;
  statProof2?: ProofNode[];
}

export interface ProofNode {
  hash: number[] | string;
  isRightSibling: boolean;
}
