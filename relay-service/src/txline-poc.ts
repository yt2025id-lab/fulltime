/**
 * TxLINE PoC Script — FullTime Phase 1
 *
 * Alur:
 * 1. Dapatkan guest JWT
 * 2. Subscribe on-chain ke free tier (devnet, Service Level 1)
 * 3. Aktivasi API token
 * 4. Fetch fixtures snapshot → cari World Cup matches
 * 5. Fetch scores snapshot untuk 1 fixture
 */

import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ─── Konfigurasi Devnet ───────────────────────────────────────────
const NETWORK = "devnet" as const;

const CONFIG = {
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    apiOrigin: "https://txline.txodds.com",
    programId: new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"),
    txlTokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    apiOrigin: "https://txline-dev.txodds.com",
    programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
    txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
  },
} as const;

const { rpcUrl, apiOrigin, programId, txlTokenMint } = CONFIG[NETWORK];
const apiBaseUrl = `${apiOrigin}/api`;

// ─── Load Wallet ──────────────────────────────────────────────────
const connection = new Connection(rpcUrl, "confirmed");

async function loadWallet(): Promise<anchor.Wallet> {
  const keypairPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/id.json"
  );
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(secretKey)
  );
  return new anchor.Wallet(keypair);
}

// ─── Step 1: Guest JWT ────────────────────────────────────────────
async function getGuestJwt(): Promise<string> {
  console.log("[1/5] Requesting guest JWT...");
  const response = await axios.post(`${apiOrigin}/auth/guest/start`);
  const jwt = response.data.token;
  console.log(`  ✅ JWT obtained (${jwt.length} chars)`);
  return jwt;
}

// ─── Step 2: Subscribe On-Chain ───────────────────────────────────
async function subscribeOnChain(
  wallet: anchor.Wallet
): Promise<{
  txSig: string;
  serviceLevelId: number;
}> {
  console.log("[2/5] Subscribing on-chain (Service Level 1)...");

  const txoracleIdl = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../idl/txoracle_devnet.json"),
      "utf-8"
    )
  );

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new (anchor.Program as any)(txoracleIdl, provider);

  const SERVICE_LEVEL_ID = 1;
  const DURATION_WEEKS = 4;
  const SELECTED_LEAGUES: number[] = [];

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId
  );

  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    txlTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId
  );

  const userTokenAccount = getAssociatedTokenAddressSync(
    txlTokenMint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Buat ATA untuk TxL token jika belum ada
  const accountInfo = await connection.getAccountInfo(userTokenAccount);
  if (!accountInfo) {
    console.log("  ⚡ Creating TxL token account...");
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      userTokenAccount,
      wallet.publicKey,
      txlTokenMint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createTx = new anchor.web3.Transaction().add(createAtaIx);
    await anchor.web3.sendAndConfirmTransaction(connection, createTx, [
      wallet.payer as anchor.web3.Keypair,
    ]);
    console.log("  ✅ TxL token account created");
  }

  const txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: wallet.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: txlTokenMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`  ✅ Subscribed — tx: ${txSig.slice(0, 20)}...`);
  return { txSig, serviceLevelId: SERVICE_LEVEL_ID };
}

// ─── Step 3: Activate API Token ────────────────────────────────────
async function activateApiToken(
  jwt: string,
  txSig: string,
  wallet: anchor.Wallet
): Promise<string> {
  console.log("[3/5] Activating API token...");

  const SELECTED_LEAGUES: number[] = [];

  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const message = new TextEncoder().encode(messageString);

  const signatureBytes = nacl.sign.detached(
    message,
    (wallet.payer as anchor.web3.Keypair).secretKey
  );
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  const activationResponse = await axios.post(
    `${apiBaseUrl}/token/activate`,
    { txSig, walletSignature, leagues: SELECTED_LEAGUES },
    { headers: { Authorization: `Bearer ${jwt}` } }
  );

  const apiToken = activationResponse.data.token || activationResponse.data;
  console.log(`  ✅ API token activated (${apiToken.length} chars)`);
  return apiToken;
}

// ─── Step 4: Fetch Fixtures Snapshot ──────────────────────────────
async function fetchFixtures(jwt: string, apiToken: string) {
  console.log("[4/5] Fetching fixtures snapshot...");

  const httpClient = axios.create({
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      "X-Api-Token": apiToken,
    },
    baseURL: apiOrigin,
  });

  const response = await httpClient.get("/api/fixtures/snapshot");
  const fixtures = response.data;

  console.log(`  ✅ Retrieved ${fixtures.length} fixtures`);

  if (fixtures.length > 0) {
    console.log(`  📋 Sample fixtures:`);
    fixtures.slice(0, 5).forEach((f: any, i: number) => {
      const home = f.Participant1IsHome
        ? f.Participant1
        : f.Participant2;
      const away = f.Participant1IsHome
        ? f.Participant2
        : f.Participant1;

      console.log(
        `     ${i + 1}. ${home} vs ${away}  |  ID: ${
          f.FixtureId
        }  |  Start: ${new Date(
          f.StartTime
        ).toISOString()}  |  Status: ${f.Status || "N/A"}`
      );
    });
  }

  return { fixtures, httpClient };
}

// ─── Step 5: Fetch Scores & Phase Detection ─────────────────────────
async function fetchScores(
  fixtureId: number,
  httpClient: ReturnType<typeof axios.create>
) {
  console.log(`[5/5] Fetching scores for fixture ${fixtureId}...`);

  try {
    const response = await httpClient.get(
      `/api/scores/snapshot/${fixtureId}`
    );
    const scores = response.data;

    if (Array.isArray(scores) && scores.length > 0) {
      console.log(`  ✅ Found ${scores.length} score entries:`);
      for (const s of scores.slice(0, 3)) {
        console.log(
          `     StatKey: ${s.StatKey ?? "N/A"}, Value: ${s.Value ?? "N/A"}, Phase: ${s.Phase ?? "N/A"}`
        );
      }
    } else {
      console.log(`  ⚠️  No scores yet for fixture ${fixtureId}`);
      console.log(
        `  💡 Tunggu match mulai/jalan untuk lihat data skor live`
      );
    }
    return scores;
  } catch (err: any) {
    const status = err.response?.status;
    console.log(
      `  ⚠️  Scores endpoint returned ${status} — mungkin fixture belum dimulai`
    );
    return null;
  }
}

// ─── Phase Detection (dari TxLINE Soccer Feed encoding) ───────────
const GAME_PHASES: Record<number, string> = {
  1: "NS (Not Started)",
  2: "H1 (First Half)",
  3: "HT (Half Time)",
  4: "H2 (Second Half)",
  5: "F (Full Time / Finished)",
  6: "WET (Waiting Extra Time)",
  7: "ET1 (Extra Time 1H)",
  8: "HTET (Extra Time HT)",
  9: "ET2 (Extra Time 2H)",
  10: "FET (Finished After ET)",
  11: "WPE (Waiting Penalties)",
  12: "PE (Penalties)",
  13: "FPE (Finished After Penalties)",
  14: "I (Interrupted)",
  15: "A (Abandoned)",
  16: "C (Cancelled)",
};

function detectSettlementPhase(phase: number): {
  canSettle: boolean;
  reason: string;
} {
  const settlePhases = [5, 10, 13]; // F, FET, FPE
  const cancelPhases = [15, 16]; // A, C

  if (settlePhases.includes(phase)) {
    return { canSettle: true, reason: GAME_PHASES[phase] };
  }
  if (cancelPhases.includes(phase)) {
    return {
      canSettle: false,
      reason: `${GAME_PHASES[phase]} — market should be cancelled`,
    };
  }
  return {
    canSettle: false,
    reason: `${GAME_PHASES[phase] ?? "Unknown"} — match still in progress`,
  };
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log(" FullTime — TxLINE Integration PoC");
  console.log(` Network: ${NETWORK}`);
  console.log(` RPC: ${rpcUrl}`);
  console.log("═══════════════════════════════════════════\n");

  const wallet = await loadWallet();
  console.log(`👛 Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(
    `💰 Balance: ${
      (await connection.getBalance(wallet.publicKey)) / 1e9
    } SOL\n`
  );

  try {
    const jwt = await getGuestJwt();
    const { txSig } = await subscribeOnChain(wallet);
    const apiToken = await activateApiToken(jwt, txSig, wallet);
    const { fixtures, httpClient } = await fetchFixtures(jwt, apiToken);

    if (fixtures.length > 0) {
      const firstFixture = fixtures[0];
      await fetchScores(firstFixture.FixtureId, httpClient);
    }

    console.log("\n═══════════════════════════════════════════");
    console.log(" ✅ PoC Complete — All steps passed!");
    console.log("═══════════════════════════════════════════");

    console.log("\n📦 Credentials (simpan untuk development):");
    console.log(`   JWT: ${jwt.slice(0, 50)}...`);
    console.log(`   API Token: ${apiToken.slice(0, 30)}...`);
    console.log(`   Subscribe Tx: ${txSig}`);
  } catch (err: any) {
    console.error("\n❌ Error:", err.message);
    if (err.logs) {
      console.error("   Logs:", err.logs);
    }
    process.exit(1);
  }
}

main();
