/**
 * Research WC2026 Fixtures from TxLINE
 */
import { TxLineClient } from "./txline-client";

async function main() {
  console.log("Fetching fixtures from TxLINE...\n");
  const txline = new TxLineClient("devnet");
  await txline.authenticate();
  const fixtures = await txline.getFixtures();
  console.log(`Total fixtures: ${fixtures.length}\n`);

  const QF_TEAMS = ["France", "Morocco", "Spain", "Belgium", "Norway", "England", "Argentina", "Switzerland"];

  // Find QF matches — matches involving two QF teams
  for (const f of fixtures) {
    const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
    const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
    const homeInQF = QF_TEAMS.includes(home);
    const awayInQF = QF_TEAMS.includes(away);
    if (homeInQF && awayInQF) {
      console.log(`#${f.FixtureId}: ${home} vs ${away}  (QF!)`);
    }
  }

  // Check specific fixtures
  const checkIds = [18209181, 18202701, 18218149, 18213979, 18222446, 18209181];
  console.log("\n--- Checking specific fixtures ---");
  for (const id of checkIds) {
    try {
      const scores = await txline.getScoresSnapshot(id);
      const hasScores = scores && scores.length > 0;
      console.log(`#${id}: scores=${hasScores ? scores.length : "none"}`);
      if (hasScores && id === 18209181) {
        const latest = scores[scores.length-1];
        const first = scores[0];
        console.log(`  Latest score keys: ${Object.keys(latest).join(", ")}`);
        console.log(`  GameState: ${latest.GameState}, StatusId: ${latest.StatusId}`);
        console.log(`  Score1: ${JSON.stringify(latest.Score?.Participant1?.Total)}`);
        console.log(`  Score2: ${JSON.stringify(latest.Score?.Participant2?.Total)}`);
        console.log(`  Seq range: ${first.Seq} → ${latest.Seq}`);
        // Try proof fetch
        try {
          const { ProofFetcher } = require("./proof-fetcher");
          const fetcher = new ProofFetcher(txline);
          const proof = await fetcher.fetchSettlementProof(id);
          console.log(`  Proof: ${proof ? "AVAILABLE" : "NONE"}`);
          if (proof) console.log(`  CanSettle: YES`);
        } catch (e: any) {
          console.log(`  Proof error: ${e.message.slice(0, 80)}`);
        }
      }
    } catch (e: any) {
      console.log(`#${id}: ERROR ${e.message.slice(0, 60)}`);
    }
  }

  // Show ALL fixtures
  console.log("\n--- ALL Fixtures ---");
  for (const f of fixtures) {
    const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
    const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
    console.log(`#${f.FixtureId}: ${home} vs ${away}  (start: ${f.StartTime})`);
  }
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
