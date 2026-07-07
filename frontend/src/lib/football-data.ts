const API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY || "";
const FD_BASE = import.meta.env.DEV ? "/api/football" : "/api/football";
const COMP = "WC";

function fdHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (import.meta.env.DEV) h["X-Auth-Token"] = API_KEY;
  return h;
}

export interface FDScorer {
  player: string; team: string; flag: string; goals: number; assists: number; matches: number;
}

export interface FDStanding {
  group: string; pos: number; team: string; flag: string;
  p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number;
}

const flagMap: Record<string, string> = {
  USA: "🇺🇸", CAN: "🇨🇦", MEX: "🇲🇽", ARG: "🇦🇷", BRA: "🇧🇷", ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", FRA: "🇫🇷",
  GER: "🇩🇪", ESP: "🇪🇸", POR: "🇵🇹", NED: "🇳🇱", ITA: "🇮🇹", BEL: "🇧🇪", URU: "🇺🇾", COL: "🇨🇴",
  JPN: "🇯🇵", KOR: "🇰🇷", KSA: "🇸🇦", AUS: "🇦🇺", MAR: "🇲🇦", SEN: "🇸🇳", CRO: "🇭🇷", SUI: "🇨🇭",
  NOR: "🇳🇴", SWE: "🇸🇪", EGY: "🇪🇬", GHA: "🇬🇭", TUN: "🇹🇳", ALG: "🇩🇿", ECU: "🇪🇨", PAR: "🇵🇾",
  AUT: "🇦🇹", TUR: "🇹🇷", CPV: "🇨🇻", CIV: "🇨🇮", CMR: "🇨🇲", NGA: "🇳🇬", NZL: "🇳🇿", PAN: "🇵🇦",
  CRC: "🇨🇷", JAM: "🇯🇲", HAI: "🇭🇹", BIH: "🇧🇦", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", DEN: "🇩🇰", POL: "🇵🇱",
  CZE: "🇨🇿", IRQ: "🇮🇶", JOR: "🇯🇴", UZB: "🇺🇿", QAT: "🇶🇦", CUW: "🇨🇼",
};

function fln(tla: string) { return flagMap[tla] || "⚽"; }

export async function fetchScorers(): Promise<FDScorer[]> {
  if (!API_KEY) return [];
  try {
    const res = await fetch(`${FD_BASE}/competitions/${COMP}/scorers?limit=10`, { headers: fdHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.scorers || []).map((s: any) => ({
      player: s.player?.name || "Unknown",
      team: s.team?.shortName || "",
      flag: fln(s.team?.tla || ""),
      goals: s.goals || 0,
      assists: s.assists || 0,
      matches: s.playedMatches || 0,
    }));
  } catch { return []; }
}

export async function fetchStandings(): Promise<FDStanding[]> {
  if (!API_KEY) return [];
  try {
    const res = await fetch(`${FD_BASE}/competitions/${COMP}/standings`, { headers: fdHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    const all: FDStanding[] = [];
    for (const t of data.standings || []) {
      const group = t.group?.replace("GROUP_", "Group ") || "";
      for (const row of t.table || []) {
        all.push({
          group, pos: row.position || 0,
          team: row.team?.shortName || "", flag: fln(row.team?.tla || ""),
          p: row.playedGames || 0, w: row.won || 0, d: row.draw || 0, l: row.lost || 0,
          gf: row.goalsFor || 0, ga: row.goalsAgainst || 0, pts: row.points || 0,
        });
      }
    }
    return all;
  } catch { return []; }
}

export function hasApiKey(): boolean { return API_KEY.length > 5; }
