const TXLINE_API = "/api/txline";

let cachedJwt: string | null = null;

async function getJwt(): Promise<string> {
  if (cachedJwt) return cachedJwt;
  try {
    const res = await fetch(`${TXLINE_API}/auth/guest/start`, { method: "POST" });
    const data = await res.json();
    cachedJwt = data.token;
    return cachedJwt || "";
  } catch { return ""; }
}

export interface TxLineFixture {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  Participant1IsHome: boolean;
  StartTime: string;
  Status?: string;
  Competition?: string;
  CompetitionId?: number;
}

export interface TxLineScore {
  key?: number;
  value?: number;
  phase?: number;
  phaseId?: number;
  ts?: number;
}

// Hardcoded WC2026 QF fixtures (TxLINE devnet doesn't serve without API token)
const WC2026_FIXTURES: TxLineFixture[] = [
  { FixtureId: 18209181, Participant1: "France", Participant2: "Morocco", Participant1IsHome: true, StartTime: "2026-07-09T20:00:00Z", Competition: "World Cup", CompetitionId: 72 },
  { FixtureId: 18218149, Participant1: "Spain", Participant2: "Belgium", Participant1IsHome: true, StartTime: "2026-07-10T19:00:00Z", Competition: "World Cup", CompetitionId: 72 },
  { FixtureId: 18213979, Participant1: "Norway", Participant2: "England", Participant1IsHome: true, StartTime: "2026-07-11T21:00:00Z", Competition: "World Cup", CompetitionId: 72 },
  { FixtureId: 18222446, Participant1: "Argentina", Participant2: "Switzerland", Participant1IsHome: true, StartTime: "2026-07-12T01:00:00Z", Competition: "World Cup", CompetitionId: 72 },
];

export async function fetchFixtures(): Promise<TxLineFixture[]> {
  return WC2026_FIXTURES;
}

export async function fetchScores(fixtureId: number): Promise<TxLineScore[]> {
  const jwt = await getJwt();
  if (!jwt) return [];
  try {
    const res = await fetch(`${TXLINE_API}/api/scores/snapshot/${fixtureId}`, {
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    return res.json() as Promise<TxLineScore[]>;
  } catch { return []; }
}

export async function fetchUpdates(fixtureId: number): Promise<TxLineScore[]> {
  const jwt = await getJwt();
  if (!jwt) return [];
  try {
    const res = await fetch(`${TXLINE_API}/api/scores/updates/${fixtureId}`, {
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    return res.json() as Promise<TxLineScore[]>;
  } catch { return []; }
}

export function getPhaseName(phase: number): string {
  const phases: Record<number, string> = {
    1: "Not Started", 2: "First Half", 3: "Half Time", 4: "Second Half",
    5: "Full Time", 6: "Waiting ET", 7: "ET 1H", 8: "ET HT", 9: "ET 2H",
    10: "Finished ET", 11: "Waiting Pen", 12: "Penalties", 13: "Finished Pen",
    14: "Interrupted", 15: "Abandoned", 16: "Cancelled",
  };
  return phases[phase] || `Phase ${phase}`;
}
