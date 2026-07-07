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

export interface FDKnockoutMatch {
  round: string; home: string; away: string; hf: string; af: string;
  hs: number | null; as: number | null; date: string; time: string; venue: string;
}

export async function fetchKnockout(): Promise<{ round: string; matches: FDKnockoutMatch[] }[]> {
  if (!API_KEY) return [];
  try {
    const res = await fetch(`${FD_BASE}/competitions/${COMP}/matches`, { headers: fdHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    const KO_STAGES = ["LAST_16","QUARTER_FINALS","SEMI_FINALS","THIRD_PLACE","FINAL"];
    const rounds: Record<string, FDKnockoutMatch[]> = {};
    for (const m of data.matches || []) {
      const stage = m.stage || "";
      if (!KO_STAGES.includes(stage)) continue;
      const label = stage === "LAST_16" ? "Round of 16" : stage === "QUARTER_FINALS" ? "Quarter-Finals" : stage === "SEMI_FINALS" ? "Semi-Finals" : stage === "THIRD_PLACE" ? "Third Place" : "Final";
      if (!rounds[label]) rounds[label] = [];
      const d = m.utcDate ? new Date(m.utcDate) : new Date();
      const h = m.homeTeam?.shortName || m.homeTeam?.name || "TBD";
      const a = m.awayTeam?.shortName || m.awayTeam?.name || "TBD";
      if (h === "None" || a === "None") continue;
      rounds[label].push({
        round: label,
        home: h,
        away: a,
        hf: fln(m.homeTeam?.tla || ""),
        af: fln(m.awayTeam?.tla || ""),
        hs: m.score?.fullTime?.home ?? null,
        as: m.score?.fullTime?.away ?? null,
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        venue: m.venue || "",
      });
    }
    const ORDER = ["Round of 16","Quarter-Finals","Semi-Finals","Third Place","Final"];
    return ORDER.filter(r => rounds[r]).map(r => ({ round: r, matches: rounds[r] }));
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
