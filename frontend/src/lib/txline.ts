const TXLINE_API = "/api/txline";

let cachedJwt: string | null = null;

async function getJwt(): Promise<string> {
  if (cachedJwt) return cachedJwt;
  const res = await fetch(`${TXLINE_API}/auth/guest/start`, { method: "POST" });
  const data = await res.json();
  cachedJwt = data.token;
  return cachedJwt || data.token || "";
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

export async function fetchFixtures(): Promise<TxLineFixture[]> {
  const jwt = await getJwt();
  const res = await fetch(`${TXLINE_API}/api/fixtures/snapshot`, {
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`TxLINE ${res.status}`);
  return res.json();
}

export async function fetchScores(fixtureId: number): Promise<TxLineScore[]> {
  const jwt = await getJwt();
  const res = await fetch(`${TXLINE_API}/api/scores/snapshot/${fixtureId}`, {
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`TxLINE ${res.status}`);
  return res.json();
}

export async function fetchUpdates(fixtureId: number): Promise<TxLineScore[]> {
  const jwt = await getJwt();
  const res = await fetch(`${TXLINE_API}/api/scores/updates/${fixtureId}`, {
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`TxLINE ${res.status}`);
  return res.json();
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
