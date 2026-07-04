/**
 * FullTime TxLINE PoC Script — Quick verification
 *
 * Setup: Pastikan file .env ada di relay-service/ (copy dari .env.example)
 * Run:   npx ts-node src/txline-poc.ts
 *
 * Verifikasi:
 * 1. Autentikasi JWT ✅
 * 2. Subscribe on-chain free tier ✅
 * 3. Activation API token ✅
 * 4. Fetch fixtures snapshot ✅
 * 5. Fetch stat-validation proof ✅
 */

import { TxLineClient } from "./txline-client";
import { ProofFetcher } from "./proof-fetcher";

async function main() {
  console.log("═══════════════════════════════════");
  console.log(" FullTime — TxLINE PoC");
  console.log("═══════════════════════════════════\n");

  const txline = new TxLineClient("devnet");

  // Step 1-3: Auth
  console.log("[1/3] Authenticating...");
  await txline.authenticate();
  console.log("  ✅ Auth OK\n");

  // Step 4: Fixtures
  console.log("[2/3] Fetching fixtures...");
  const fixtures = await txline.getFixtures();
  console.log(`  ✅ ${fixtures.length} fixtures available`);
  fixtures.slice(0, 5).forEach((f) => {
    const home = f.Participant1IsHome
      ? f.Participant1
      : f.Participant2;
    const away = f.Participant1IsHome
      ? f.Participant2
      : f.Participant1;
    console.log(
      `     #${f.FixtureId}: ${home} vs ${away}`
    );
  });

  // Step 5: Proof
  console.log("\n[3/3] Fetching Merkle proof...");
  const fetcher = new ProofFetcher(txline);
  const proof = await fetcher.fetchSettlementProof(18167317);
  if (proof) {
    console.log("  ✅ Proof fetched successfully");
    console.log(
      `     Home: ${proof.statA.statToProve.value} | Away: ${proof.statB.statToProve.value}`
    );
    console.log(
      `     fixtureProof: ${proof.fixtureProof.length} nodes`
    );
    console.log(
      `     mainTreeProof: ${proof.mainTreeProof.length} nodes`
    );
  } else {
    console.log("  ❌ No proof available");
  }

  console.log("\n═══════════════════════════════════");
  console.log(" ✅ PoC Complete!");
  console.log("═══════════════════════════════════");
}

main().catch((err) => {
  console.error("❌ PoC failed:", err.message);
  process.exit(1);
});
