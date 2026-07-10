import { TxLineClient } from "./txline-client";

async function main() {
  const txline = new TxLineClient("devnet");
  await txline.authenticate();

  const ids = [18213979, 18209181];
  for (const id of ids) {
    const scores = await txline.getScoresSnapshot(id) as any[];
    if (!scores || scores.length === 0) {
      console.log(`#${id}: NO SCORES`);
      continue;
    }
    const latest = scores[scores.length - 1];
    console.log(`#${id}:`);
    console.log(`  GameState: ${latest.GameState}`);
    console.log(`  StatusId: ${latest.StatusId}`);
    console.log(`  Clock: ${JSON.stringify(latest.Clock)}`);
    const s1 = latest.Score?.Participant1?.Total;
    const s2 = latest.Score?.Participant2?.Total;
    console.log(`  Score: Participant1=${JSON.stringify(s1)} Participant2=${JSON.stringify(s2)}`);
    console.log(`  Updates: ${scores.length}`);
  }
}
main().catch(e => console.error(e.message));
