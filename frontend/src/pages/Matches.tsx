import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY || "";

const COMPETITION = "WC";

interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "upcoming" | "live" | "finished";
  date: string;
  time: string;
  venue: string;
  minute?: string;
  group?: string;
}

interface Scorer {
  id: number;
  player: string;
  team: string;
  flag: string;
  goals: number;
  assists: number;
  matches: number;
}

interface Standing {
  position: number;
  team: string;
  flag: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  group: string;
}

const flagMap: Record<string, string> = {
  USA: "🇺🇸", CAN: "🇨🇦", MEX: "🇲🇽", ARG: "🇦🇷", BRA: "🇧🇷",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", FRA: "🇫🇷", GER: "🇩🇪", ESP: "🇪🇸", ITA: "🇮🇹",
  NED: "🇳🇱", POR: "🇵🇹", URU: "🇺🇾", COL: "🇨🇴",
  JPN: "🇯🇵", KOR: "🇰🇷", KSA: "🇸🇦", AUS: "🇦🇺",
  MAR: "🇲🇦", SEN: "🇸🇳", CRO: "🇭🇷", BEL: "🇧🇪",
  ECU: "🇪🇨", CIV: "🇨🇮", ALG: "🇩🇿", EGY: "🇪🇬",
  GHA: "🇬🇭", TUN: "🇹🇳", RSA: "🇿🇦", CPV: "🇨🇻",
  COD: "🇨🇩", CMR: "🇨🇲", NGA: "🇳🇬", IRN: "🇮🇷",
  QAT: "🇶🇦", IRQ: "🇮🇶", JOR: "🇯🇴", UZB: "🇺🇿",
  NZL: "🇳🇿", NOR: "🇳🇴", SWE: "🇸🇪", SUI: "🇨🇭",
  AUT: "🇦🇹", CZE: "🇨🇿", TUR: "🇹🇷", PAR: "🇵🇾",
  PAN: "🇵🇦", HAI: "🇭🇹", BIH: "🇧🇦", CUW: "🇨🇼",
  DEN: "🇩🇰", SRB: "🇷🇸", POL: "🇵🇱", UKR: "🇺🇦",
  SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", WAL: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", RUS: "🇷🇺",
  HUN: "🇭🇺", ROU: "🇷🇴", GRE: "🇬🇷", FIN: "🇫🇮",
  BUL: "🇧🇬", SVK: "🇸🇰", SVN: "🇸🇮", ISR: "🇮🇱",
  ALB: "🇦🇱", GEO: "🇬🇪", ARM: "🇦🇲", CHI: "🇨🇱",
  BOL: "🇧🇴", VEN: "🇻🇪", PER: "🇵🇪", CRC: "🇨🇷",
  JAM: "🇯🇲",
};

function getFlag(name: string): string {
  return flagMap[name] || "⚽";
}

function mapStatus(status: string): Match["status"] {
  if (status === "LIVE" || status === "IN_PLAY" || status === "PAUSED") return "live";
  if (status === "FINISHED" || status === "AWARDED") return "finished";
  return "upcoming";
}

type MainTab = "matches" | "scorers" | "standings";
type MatchTab = "all" | "upcoming" | "live" | "finished";

const fallbackMatches: Match[] = [
  { id: 9901, homeTeam: "Argentina", awayTeam: "France", homeFlag: "🇦🇷", awayFlag: "🇫🇷", homeScore: 2, awayScore: 2, status: "live", date: "2026-07-03", time: "20:00", venue: "SoFi Stadium, Los Angeles", minute: "67'", group: "Quarter-Final" },
  { id: 9902, homeTeam: "England", awayTeam: "Germany", homeFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", awayFlag: "🇩🇪", homeScore: 0, awayScore: 0, status: "live", date: "2026-07-03", time: "16:00", venue: "AT&T Stadium, Dallas", minute: "34'", group: "Quarter-Final" },
  { id: 9903, homeTeam: "Spain", awayTeam: "Netherlands", homeFlag: "🇪🇸", awayFlag: "🇳🇱", homeScore: null, awayScore: null, status: "upcoming", date: "2026-07-04", time: "16:00", venue: "Mercedes-Benz Stadium, Atlanta", group: "Quarter-Final" },
  { id: 9904, homeTeam: "Portugal", awayTeam: "Italy", homeFlag: "🇵🇹", awayFlag: "🇮🇹", homeScore: null, awayScore: null, status: "upcoming", date: "2026-07-04", time: "20:00", venue: "Arrowhead Stadium, Kansas City", group: "Quarter-Final" },
  { id: 9905, homeTeam: "USA", awayTeam: "Canada", homeFlag: "🇺🇸", awayFlag: "🇨🇦", homeScore: 2, awayScore: 1, status: "finished", date: "2026-06-11", time: "19:00", venue: "MetLife Stadium, New Jersey", group: "Group A" },
  { id: 9906, homeTeam: "Brazil", awayTeam: "Mexico", homeFlag: "🇧🇷", awayFlag: "🇲🇽", homeScore: 3, awayScore: 1, status: "finished", date: "2026-06-12", time: "16:00", venue: "Estadio Azteca, Mexico City", group: "Group B" },
  { id: 9907, homeTeam: "Colombia", awayTeam: "Uruguay", homeFlag: "🇨🇴", awayFlag: "🇺🇾", homeScore: 1, awayScore: 0, status: "finished", date: "2026-07-02", time: "20:00", venue: "Gillette Stadium, Boston", group: "Round of 16" },
  { id: 9908, homeTeam: "Japan", awayTeam: "Morocco", homeFlag: "🇯🇵", awayFlag: "🇲🇦", homeScore: 0, awayScore: 2, status: "finished", date: "2026-07-02", time: "16:00", venue: "NRG Stadium, Houston", group: "Round of 16" },
];

const fallbackScorers: Scorer[] = [
  { id: 991, player: "Kylian Mbappé", team: "France", flag: "🇫🇷", goals: 5, assists: 2, matches: 4 },
  { id: 992, player: "Lionel Messi", team: "Argentina", flag: "🇦🇷", goals: 4, assists: 3, matches: 4 },
  { id: 993, player: "Erling Haaland", team: "Norway", flag: "🇳🇴", goals: 3, assists: 1, matches: 3 },
  { id: 994, player: "Vinícius Jr.", team: "Brazil", flag: "🇧🇷", goals: 3, assists: 2, matches: 3 },
  { id: 995, player: "Jude Bellingham", team: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", goals: 3, assists: 1, matches: 3 },
];

const fallbackStandings: Standing[] = [
  { position: 1, team: "Argentina", flag: "🇦🇷", played: 3, won: 3, draw: 0, lost: 0, goalsFor: 8, goalsAgainst: 2, points: 9, group: "Group C" },
  { position: 1, team: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", played: 3, won: 2, draw: 1, lost: 0, goalsFor: 6, goalsAgainst: 1, points: 7, group: "Group D" },
  { position: 1, team: "Brazil", flag: "🇧🇷", played: 3, won: 3, draw: 0, lost: 0, goalsFor: 7, goalsAgainst: 1, points: 9, group: "Group B" },
];

export default function Matches() {
  const [mainTab, setMainTab] = useState<MainTab>("matches");
  const [matchTab, setMatchTab] = useState<MatchTab>("all");

  const [matches, setMatches] = useState<Match[]>([]);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (!API_KEY) {
      setError("API key not configured — showing demo data");
      setMatches(fallbackMatches);
      setScorers(fallbackScorers);
      setStandings(fallbackStandings);
      setLoading(false);
      return;
    }

    const BASE = "https://api.football-data.org/v4";
    const headers: Record<string, string> = { "X-Auth-Token": API_KEY };
    try {
      const [matchRes, scorerRes, standingRes] = await Promise.all([
        fetch(`${BASE}/competitions/${COMPETITION}/matches`, { headers }),
        fetch(`${BASE}/competitions/${COMPETITION}/scorers?limit=15`, { headers }),
        fetch(`${BASE}/competitions/${COMPETITION}/standings`, { headers }),
      ]);

      if (matchRes.ok) {
        const data = await matchRes.json();
        const mapped: Match[] = (data.matches || []).map((m: any) => ({
          id: m.id, homeTeam: m.homeTeam?.name || "TBD", awayTeam: m.awayTeam?.name || "TBD",
          homeFlag: getFlag(m.homeTeam?.tla || ""), awayFlag: getFlag(m.awayTeam?.tla || ""),
          homeScore: m.score?.fullTime?.home ?? null, awayScore: m.score?.fullTime?.away ?? null,
          status: mapStatus(m.status || "SCHEDULED"),
          date: m.utcDate ? m.utcDate.slice(0, 10) : "",
          time: m.utcDate ? new Date(m.utcDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "",
          venue: m.venue || "", minute: m.minute ? `${m.minute}'` : "", group: m.group || m.stage || "",
        }));
        setMatches(mapped);
      }

      if (scorerRes.ok) {
        const data = await scorerRes.json();
        setScorers((data.scorers || []).map((s: any, i: number) => ({
          id: i, player: s.player?.name || "Unknown", team: s.team?.shortName || "",
          flag: getFlag(s.team?.tla || ""), goals: s.goals || 0, assists: s.assists || 0, matches: s.playedMatches || 0,
        })));
      }

      if (standingRes.ok) {
        const data = await standingRes.json();
        const all: Standing[] = [];
        for (const t of data.standings || []) {
          for (const row of t.table || []) {
            all.push({ position: row.position || 0, team: row.team?.shortName || "", flag: getFlag(row.team?.tla || ""), played: row.playedGames || 0, won: row.won || 0, draw: row.draw || 0, lost: row.lost || 0, goalsFor: row.goalsFor || 0, goalsAgainst: row.goalsAgainst || 0, points: row.points || 0, group: t.group || "" });
          }
        }
        setStandings(all);
      }

      setLastUpdate(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
      setError(null);
    } catch {
      if (matches.length === 0) setMatches(fallbackMatches);
      if (scorers.length === 0) setScorers(fallbackScorers);
      if (standings.length === 0) setStandings(fallbackStandings);
      setError("live_unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 60000); return () => clearInterval(iv); }, [fetchData]);

  const sortByDate = (list: Match[]) => [...list].sort((a, b) => new Date(b.date + "T" + (b.time || "00:00")).getTime() - new Date(a.date + "T" + (a.time || "00:00")).getTime());
  const filteredMatches = (() => {
    const base = matchTab === "all" ? matches : matches.filter(m => m.status === matchTab);
    const live = base.filter(m => m.status === "live");
    const rest = sortByDate(base.filter(m => m.status !== "live"));
    return [...live, ...rest];
  })();

  return (
    <div className="min-h-screen bg-green-950 relative">
      <div className="fixed inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1920&q=80)` }}>
        <div className="absolute inset-0 bg-green-950/75 backdrop-blur-[2px]" />
      </div>
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/app" className="text-sm text-amber-300/60 hover:text-amber-300 transition-colors font-body">&larr; Back to Dashboard</Link>
            <h1 className="font-heading italic text-white text-5xl md:text-6xl mt-2 tracking-[-2px]">World Cup <span className="text-amber-300/60">2026</span></h1>
          </div>
          {lastUpdate && (
            <div className="text-right">
              <div className="text-xs text-white/30 font-body">Live data via football-data.org</div>
              <div className="text-xs text-amber-300/50 font-body">Updated {lastUpdate}</div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mb-8">
          {([ { key: "matches" as MainTab, label: "Matches" }, { key: "scorers" as MainTab, label: "Top Scorers" }, { key: "standings" as MainTab, label: "Standings" } ]).map(t => (
            <button key={t.key} onClick={() => setMainTab(t.key)} className={`rounded-full px-5 py-2.5 text-sm font-body transition-all ${mainTab === t.key ? "bg-amber-500 text-black font-semibold" : "liquid-glass text-white/60 hover:text-white"}`}>{t.label}</button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full" />
              <span className="text-white/40 font-body text-sm">Loading live data...</span>
            </div>
          </div>
        )}

        {!loading && (
          <>
            {mainTab === "matches" && (
              <>
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  {([ { key: "all" as MatchTab, label: "All" }, { key: "upcoming" as MatchTab, label: "Upcoming" }, { key: "live" as MatchTab, label: "Live" }, { key: "finished" as MatchTab, label: "Results" } ]).map(t => (
                    <button key={t.key} onClick={() => setMatchTab(t.key)} className={`rounded-full px-4 py-1.5 text-xs font-body transition-all whitespace-nowrap ${matchTab === t.key ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}>{t.label}</button>
                  ))}
                </div>
                <div className="space-y-3">
                  {filteredMatches.map(m => (
                    <motion.div key={m.id} initial={{ filter: "blur(5px)", opacity: 0 }} animate={{ filter: "blur(0px)", opacity: 1 }} className="liquid-glass rounded-[1.25rem] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-white/40 font-body mb-1">
                            {m.status === "live" && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse font-bold">LIVE</span>}
                            {m.status === "finished" && <span className="text-white/30">FT</span>}
                            {m.status === "upcoming" && <span className="text-white/30">Upcoming</span>}
                            {m.group && <span>{m.group}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-lg text-white/90 font-body font-medium truncate">{m.homeFlag} {m.homeTeam}</span>
                            <span className="text-2xl font-heading italic text-amber-400 shrink-0">{m.homeScore !== null && m.awayScore !== null ? `${m.homeScore} - ${m.awayScore}` : "vs"}</span>
                            <span className="text-lg text-white/90 font-body font-medium truncate">{m.awayTeam} {m.awayFlag}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-white/30 font-body">
                            {m.date && <span>{m.date} {m.time}</span>}
                            {m.minute && <span className="text-amber-300">{m.minute}</span>}
                            {m.venue && <span className="truncate">{m.venue}</span>}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {mainTab === "scorers" && (
              <div className="space-y-3">
                {scorers.map((s, i) => (
                  <div key={s.id} className="liquid-glass rounded-[1.25rem] p-4 flex items-center gap-4">
                    <span className={`font-heading italic text-2xl w-8 ${i === 0 ? "text-amber-400" : "text-white/30"}`}>{i + 1}</span>
                    <span className="text-lg">{s.flag}</span>
                    <div className="flex-1 min-w-0"><div className="text-white/90 font-body font-medium">{s.player}</div><div className="text-xs text-white/40 font-body">{s.team}</div></div>
                    <div className="text-right"><span className="font-heading italic text-2xl text-amber-400">{s.goals}</span><div className="text-xs text-white/30 font-body">{s.assists} assists · {s.matches} matches</div></div>
                  </div>
                ))}
              </div>
            )}

            {mainTab === "standings" && (
              <div className="space-y-6">
                {Array.from(new Set(standings.map(s => s.group))).map(group => (
                  <div key={group} className="liquid-glass-strong rounded-[1.25rem] p-4">
                    <h3 className="font-heading italic text-white text-xl mb-3">{group}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm font-body">
                        <thead><tr className="text-white/30 text-xs border-b border-white/5">{["Pos","Team","P","W","D","L","GF","GA","Pts"].map(h => <th key={h} className="p-2 text-left font-medium">{h}</th>)}</tr></thead>
                        <tbody>
                          {standings.filter(s => s.group === group).map(s => (
                            <tr key={`${group}-${s.team}`} className="border-b border-white/5">
                              <td className="p-2 text-white/60">{s.position}</td>
                              <td className="p-2 text-white/90">{s.flag} {s.team}</td>
                              <td className="p-2 text-white/40">{s.played}</td><td className="p-2 text-white/40">{s.won}</td><td className="p-2 text-white/40">{s.draw}</td><td className="p-2 text-white/40">{s.lost}</td>
                              <td className="p-2 text-white/40">{s.goalsFor}</td><td className="p-2 text-white/40">{s.goalsAgainst}</td>
                              <td className="p-2 text-amber-400 font-semibold">{s.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {error && (
          <div className="text-center mt-8">
            <p className="text-white/30 font-body text-xs">{error === "live_unavailable" ? "Live data temporarily unavailable — showing demo data" : error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
