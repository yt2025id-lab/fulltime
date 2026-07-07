import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { fetchFixtures, fetchScores, getPhaseName, type TxLineFixture, type TxLineScore } from "../lib/txline";
import { fetchScorers, fetchStandings, hasApiKey, type FDScorer, type FDStanding } from "../lib/football-data";

interface Match {
  id: number; home: string; away: string; homeFlag: string; awayFlag: string;
  homeScore: number | null; awayScore: number | null; status: MatchStatus;
  date: string; time: string; phase: string; phaseId: number; competition: string;
}
type MatchStatus = "live" | "upcoming" | "finished";
type MainTab = "matches" | "live" | "upcoming" | "finished";
type DetailTab = "matches" | "scorers" | "standings" | "knockout";

const flagMap: Record<string, string> = {
  Argentina: "🇦🇷", Brazil: "🇧🇷", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", France: "🇫🇷",
  Germany: "🇩🇪", Spain: "🇪🇸", Portugal: "🇵🇹", Netherlands: "🇳🇱",
  Italy: "🇮🇹", Belgium: "🇧🇪", Uruguay: "🇺🇾", Colombia: "🇨🇴",
  Mexico: "🇲🇽", USA: "🇺🇸", Canada: "🇨🇦", Japan: "🇯🇵",
  "South Korea": "🇰🇷", Australia: "🇦🇺", Morocco: "🇲🇦", Senegal: "🇸🇳",
  Croatia: "🇭🇷", Switzerland: "🇨🇭", Norway: "🇳🇴", Sweden: "🇸🇪",
  Egypt: "🇪🇬", Ghana: "🇬🇭", Tunisia: "🇹🇳", Algeria: "🇩🇿",
  Ecuador: "🇪🇨", Paraguay: "🇵🇾", Austria: "🇦🇹", Turkey: "🇹🇷",
  "Saudi Arabia": "🇸🇦", Iran: "🇮🇷", "South Africa": "🇿🇦",
  "Cape Verde": "🇨🇻", "Congo DR": "🇨🇩", "Ivory Coast": "🇨🇮",
  Cameroon: "🇨🇲", Nigeria: "🇳🇬", "New Zealand": "🇳🇿",
  "Costa Rica": "🇨🇷", Panama: "🇵🇦", Jamaica: "🇯🇲", Haiti: "🇭🇹",
  Bosnia: "🇧🇦", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Denmark: "🇩🇰", Poland: "🇵🇱",
  Czechia: "🇨🇿", Iraq: "🇮🇶", Jordan: "🇯🇴", Uzbekistan: "🇺🇿",
  Qatar: "🇶🇦", "Curacao": "🇨🇼", Vietnam: "🇻🇳", Myanmar: "🇲🇲",
};
function fl(name: string) { return flagMap[name] || "⚽"; }

const TOP_SCORERS = [
  { player: "Kylian Mbappé", team: "France", flag: "🇫🇷", goals: 5, assists: 2, matches: 4 },
  { player: "Lionel Messi", team: "Argentina", flag: "🇦🇷", goals: 4, assists: 3, matches: 4 },
  { player: "Erling Haaland", team: "Norway", flag: "🇳🇴", goals: 4, assists: 1, matches: 3 },
  { player: "Vinícius Jr.", team: "Brazil", flag: "🇧🇷", goals: 3, assists: 2, matches: 3 },
  { player: "Jude Bellingham", team: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", goals: 3, assists: 1, matches: 3 },
  { player: "Lamine Yamal", team: "Spain", flag: "🇪🇸", goals: 3, assists: 2, matches: 3 },
  { player: "Cristiano Ronaldo", team: "Portugal", flag: "🇵🇹", goals: 2, assists: 1, matches: 3 },
  { player: "Lautaro Martínez", team: "Argentina", flag: "🇦🇷", goals: 2, assists: 1, matches: 3 },
  { player: "Jamal Musiala", team: "Germany", flag: "🇩🇪", goals: 2, assists: 1, matches: 3 },
  { player: "Federico Valverde", team: "Uruguay", flag: "🇺🇾", goals: 2, assists: 0, matches: 3 },
];

const STANDINGS = [
  { group: "Group A", teams: [{ pos: 1, team: "USA", flag: "🇺🇸", p: 3, w: 2, d: 1, l: 0, gf: 5, ga: 2, pts: 7 }, { pos: 2, team: "Canada", flag: "🇨🇦", p: 3, w: 1, d: 2, l: 0, gf: 4, ga: 3, pts: 5 }, { pos: 3, team: "Mexico", flag: "🇲🇽", p: 3, w: 1, d: 1, l: 1, gf: 3, ga: 3, pts: 4 }, { pos: 4, team: "Panama", flag: "🇵🇦", p: 3, w: 0, d: 0, l: 3, gf: 1, ga: 5, pts: 0 }] },
  { group: "Group B", teams: [{ pos: 1, team: "Brazil", flag: "🇧🇷", p: 3, w: 3, d: 0, l: 0, gf: 7, ga: 1, pts: 9 }, { pos: 2, team: "Uruguay", flag: "🇺🇾", p: 3, w: 2, d: 0, l: 1, gf: 5, ga: 3, pts: 6 }, { pos: 3, team: "Colombia", flag: "🇨🇴", p: 3, w: 1, d: 0, l: 2, gf: 3, ga: 5, pts: 3 }, { pos: 4, team: "Ecuador", flag: "🇪🇨", p: 3, w: 0, d: 0, l: 3, gf: 1, ga: 7, pts: 0 }] },
  { group: "Group C", teams: [{ pos: 1, team: "Argentina", flag: "🇦🇷", p: 3, w: 3, d: 0, l: 0, gf: 8, ga: 2, pts: 9 }, { pos: 2, team: "Morocco", flag: "🇲🇦", p: 3, w: 1, d: 1, l: 1, gf: 4, ga: 4, pts: 4 }, { pos: 3, team: "Egypt", flag: "🇪🇬", p: 3, w: 1, d: 0, l: 2, gf: 2, ga: 5, pts: 3 }, { pos: 4, team: "Japan", flag: "🇯🇵", p: 3, w: 0, d: 1, l: 2, gf: 2, ga: 5, pts: 1 }] },
  { group: "Group D", teams: [{ pos: 1, team: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", p: 3, w: 2, d: 1, l: 0, gf: 6, ga: 1, pts: 7 }, { pos: 2, team: "Germany", flag: "🇩🇪", p: 3, w: 2, d: 0, l: 1, gf: 5, ga: 3, pts: 6 }, { pos: 3, team: "Spain", flag: "🇪🇸", p: 3, w: 1, d: 1, l: 1, gf: 4, ga: 3, pts: 4 }, { pos: 4, team: "Netherlands", flag: "🇳🇱", p: 3, w: 0, d: 0, l: 3, gf: 1, ga: 9, pts: 0 }] },
  { group: "Group E", teams: [{ pos: 1, team: "France", flag: "🇫🇷", p: 3, w: 2, d: 1, l: 0, gf: 7, ga: 1, pts: 7 }, { pos: 2, team: "Portugal", flag: "🇵🇹", p: 3, w: 2, d: 0, l: 1, gf: 5, ga: 2, pts: 6 }, { pos: 3, team: "Belgium", flag: "🇧🇪", p: 3, w: 1, d: 1, l: 1, gf: 4, ga: 4, pts: 4 }, { pos: 4, team: "Sweden", flag: "🇸🇪", p: 3, w: 0, d: 0, l: 3, gf: 1, ga: 10, pts: 0 }] },
  { group: "Group F", teams: [{ pos: 1, team: "Italy", flag: "🇮🇹", p: 3, w: 3, d: 0, l: 0, gf: 5, ga: 0, pts: 9 }, { pos: 2, team: "Croatia", flag: "🇭🇷", p: 3, w: 1, d: 2, l: 0, gf: 3, ga: 2, pts: 5 }, { pos: 3, team: "Senegal", flag: "🇸🇳", p: 3, w: 1, d: 0, l: 2, gf: 3, ga: 5, pts: 3 }, { pos: 4, team: "Australia", flag: "🇦🇺", p: 3, w: 0, d: 0, l: 3, gf: 1, ga: 5, pts: 0 }] },
  { group: "Group G", teams: [{ pos: 1, team: "South Korea", flag: "🇰🇷", p: 3, w: 1, d: 2, l: 0, gf: 4, ga: 3, pts: 5 }, { pos: 2, team: "Switzerland", flag: "🇨🇭", p: 3, w: 1, d: 2, l: 0, gf: 3, ga: 2, pts: 5 }, { pos: 3, team: "Ivory Coast", flag: "🇨🇮", p: 3, w: 1, d: 1, l: 1, gf: 3, ga: 3, pts: 4 }, { pos: 4, team: "Saudi Arabia", flag: "🇸🇦", p: 3, w: 0, d: 1, l: 2, gf: 2, ga: 4, pts: 1 }] },
  { group: "Group H", teams: [{ pos: 1, team: "Paraguay", flag: "🇵🇾", p: 3, w: 2, d: 1, l: 0, gf: 5, ga: 2, pts: 7 }, { pos: 2, team: "Norway", flag: "🇳🇴", p: 3, w: 2, d: 0, l: 1, gf: 6, ga: 3, pts: 6 }, { pos: 3, team: "Tunisia", flag: "🇹🇳", p: 3, w: 1, d: 0, l: 2, gf: 2, ga: 5, pts: 3 }, { pos: 4, team: "New Zealand", flag: "🇳🇿", p: 3, w: 0, d: 0, l: 3, gf: 0, ga: 6, pts: 0 }] },
];

const KNOCKOUT = [
  { round: "Round of 16", matches: [
    { h: "Argentina", a: "Ecuador", hf: "🇦🇷", af: "🇪🇨", hs: 3, as: 1, date: "Jul 3", time: "16:00", venue: "Hard Rock Stadium" },
    { h: "USA", a: "Netherlands", hf: "🇺🇸", af: "🇳🇱", hs: 1, as: 2, date: "Jul 3", time: "20:00", venue: "SoFi Stadium" },
    { h: "Brazil", a: "Spain", hf: "🇧🇷", af: "🇪🇸", hs: 4, as: 2, date: "Jul 4", time: "16:00", venue: "AT&T Stadium" },
    { h: "Italy", a: "Morocco", hf: "🇮🇹", af: "🇲🇦", hs: 2, as: 0, date: "Jul 4", time: "20:00", venue: "Arrowhead Stadium" },
    { h: "France", a: "Egypt", hf: "🇫🇷", af: "🇪🇬", hs: 2, as: 1, date: "Jul 5", time: "16:00", venue: "Mercedes-Benz Stadium" },
    { h: "England", a: "Uruguay", hf: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", af: "🇺🇾", hs: 3, as: 0, date: "Jul 5", time: "20:00", venue: "MetLife Stadium" },
    { h: "Portugal", a: "Croatia", hf: "🇵🇹", af: "🇭🇷", hs: 1, as: 1, date: "Jul 6", time: "16:00", venue: "Gillette Stadium" },
    { h: "Germany", a: "Canada", hf: "🇩🇪", af: "🇨🇦", hs: 2, as: 1, date: "Jul 6", time: "20:00", venue: "Lumen Field" },
  ]},
  { round: "Quarter-Finals", matches: [
    { h: "Argentina", a: "Netherlands", hf: "🇦🇷", af: "🇳🇱", hs: 2, as: 2, date: "Jul 10", time: "16:00", venue: "NRG Stadium" },
    { h: "Brazil", a: "Italy", hf: "🇧🇷", af: "🇮🇹", hs: 1, as: 0, date: "Jul 10", time: "20:00", venue: "Levi's Stadium" },
    { h: "France", a: "England", hf: "🇫🇷", af: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", hs: 2, as: 1, date: "Jul 11", time: "16:00", venue: "Estadio Azteca" },
    { h: "Portugal", a: "Germany", hf: "🇵🇹", af: "🇩🇪", hs: null, as: null, date: "Jul 11", time: "20:00", venue: "BC Place" },
  ]},
  { round: "Semi-Finals", matches: [
    { h: "Argentina", a: "Brazil", hf: "🇦🇷", af: "🇧🇷", hs: null, as: null, date: "Jul 15", time: "20:00", venue: "AT&T Stadium" },
    { h: "France", a: "Portugal", hf: "🇫🇷", af: "🇵🇹", hs: null, as: null, date: "Jul 16", time: "20:00", venue: "Mercedes-Benz Stadium" },
  ]},
  { round: "Third Place", matches: [
    { h: "Brazil", a: "Portugal", hf: "🇧🇷", af: "🇵🇹", hs: null, as: null, date: "Jul 18", time: "16:00", venue: "Hard Rock Stadium" },
  ]},
  { round: "Final", matches: [
    { h: "Argentina", a: "France", hf: "🇦🇷", af: "🇫🇷", hs: null, as: null, date: "Jul 19", time: "20:00", venue: "MetLife Stadium · New Jersey" },
  ]},
];

export default function Matches() {
  const [detailTab, setDetailTab] = useState<DetailTab>("matches");
  const [mainTab, setMainTab] = useState<MainTab>("matches");
  const [matches, setMatches] = useState<Match[]>([]);
  const [scorers, setScorers] = useState<FDScorer[]>(TOP_SCORERS);
  const [standings, setStandings] = useState<FDStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");
  const [usingLiveData, setUsingLiveData] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const keyOk = hasApiKey();

    // TxLINE fixtures + scores (always try)
    try {
      const fixtures = await fetchFixtures();
      const wcFixtures = fixtures.filter((f: TxLineFixture) =>
        f.Competition?.toLowerCase().includes("world cup") || f.Competition?.toLowerCase().includes("wc")
      );
      const source = wcFixtures.length > 0 ? wcFixtures : fixtures.slice(0, 16);
      const mapped: Match[] = await Promise.all(source.map(async (f: TxLineFixture) => {
        const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
        const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
        const liveStatus = f.Status || "";
        const isFinished = liveStatus.toLowerCase().includes("finish") || liveStatus.toLowerCase().includes("full");
        const isLive = liveStatus.toLowerCase().includes("live") || liveStatus.toLowerCase().includes("progress");
        const status: MatchStatus = isFinished ? "finished" : isLive ? "live" : "upcoming";
        const d = f.StartTime ? new Date(f.StartTime) : new Date();

        let homeScore: number | null = null, awayScore: number | null = null, phase = liveStatus, phaseId = 0;
        if (isFinished || isLive) {
          try {
            const scores: TxLineScore[] = await fetchScores(f.FixtureId);
            if (scores.length > 0) {
              const last = scores[scores.length - 1];
              phaseId = last.phase || last.phaseId || 0;
              phase = getPhaseName(phaseId);
              const homeVal = scores.find((s: TxLineScore) => s.key === 1);
              const awayVal = scores.find((s: TxLineScore) => s.key === 2);
              if (homeVal) homeScore = homeVal.value ?? 0;
              if (awayVal) awayScore = awayVal.value ?? 0;
            }
          } catch {}
        }

        return {
          id: f.FixtureId, home, away, homeFlag: fl(home), awayFlag: fl(away),
          homeScore, awayScore, status,
          date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          phase, phaseId, competition: f.Competition || "",
        };
      }));

      mapped.sort((a, b) => { const o: Record<string, number> = { live: 0, upcoming: 1, finished: 2 }; return o[a.status] - o[b.status]; });
      setMatches(mapped);
      setError(null);
    } catch (e: any) {
      setError("Unable to load fixture data from TxLINE. Ensure API server is running.");
      setMatches([]);
    }

    if (keyOk) {
      try {
        const [sc, st] = await Promise.all([fetchScorers(), fetchStandings()]);
        if (sc.length > 0) { setScorers(sc); setUsingLiveData(true); }
        if (st.length > 0) {
          const grouped: Record<string, FDStanding[]> = {};
          for (const s of st) { if (!grouped[s.group]) grouped[s.group] = []; grouped[s.group].push(s); }
          setStandings(st);
          setUsingLiveData(true);
        }
      } catch {}
    }
    setLastUpdate(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const filtered = matches.filter(m => mainTab === "matches" ? true : m.status === mainTab);

  return (
    <div className="min-h-screen bg-black relative">
      <div className="fixed inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1920&q=80)" }}>
        <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-red-800/30 bg-[#c0392b]/95 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto grid grid-cols-3 items-center px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to="/app" className="text-sm text-white/70 hover:text-white font-mono transition-colors">&larr; Back</Link>
            <span className="text-lg">⚽</span>
            <span className="font-mono font-bold text-white text-lg">Full<span className="text-white/40">Time</span></span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Link to="/app" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">Markets</Link>
            <Link to="/matches" className="bg-white/15 rounded-full px-4 py-1.5 text-sm font-mono text-white font-medium">Matches</Link>
            <Link to="/faq" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">FAQ</Link>
            <Link to="/faucet" className="rounded-full px-4 py-1.5 text-sm font-mono text-white/50 hover:text-white transition-colors">Faucet</Link>
          </div>
          <div />
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-mono font-bold text-white text-5xl md:text-6xl tracking-[-2px]">
              World Cup <span className="text-red-300/60">2026</span>
            </h1>
            <p className="font-mono text-xs text-white/40 mt-1">Live data via TxLINE — Hackathon Sponsor</p>
          </div>
          {lastUpdate && (
            <div className="text-right">
              <div className="text-xs text-white/20 font-mono">Auto-refresh 30s</div>
              <div className="text-xs text-red-300/50 font-mono">Updated {lastUpdate}</div>
            </div>
          )}
        </div>

        {/* Detail Tabs */}
        <div className="flex gap-3 mb-6">
          {([{ k: "matches" as DetailTab, l: "Matches" }, { k: "scorers" as DetailTab, l: "Top Scorers" }, { k: "standings" as DetailTab, l: "Standings" }, { k: "knockout" as DetailTab, l: "Knockout" }]).map(t => (
            <button key={t.k} onClick={() => { setDetailTab(t.k); if (t.k !== "matches") setMainTab("matches"); }}
              className={`rounded-full px-5 py-2.5 text-sm font-mono transition-all ${detailTab === t.k ? "bg-[#c0392b] text-white font-semibold" : "bg-white/[0.04] text-white/50 hover:text-white border border-white/[0.06]"}`}>
              {t.l}
            </button>
          ))}
        </div>

        {detailTab === "matches" && (
          <>
            {/* Match Tabs */}
            <div className="flex gap-3 mb-6">
              {([{ k: "matches" as MainTab, l: "All" }, { k: "live" as MainTab, l: "Live" }, { k: "upcoming" as MainTab, l: "Upcoming" }, { k: "finished" as MainTab, l: "Results" }]).map(t => (
                <button key={t.k} onClick={() => setMainTab(t.k)} className={`rounded-full px-4 py-2 text-xs font-mono transition-all ${mainTab === t.k ? "bg-white/10 text-white font-semibold border border-white/10" : "text-white/40 hover:text-white"}`}>
                  {t.l} {t.k !== "matches" && <span className="opacity-50">({matches.filter(m => m.status === t.k).length})</span>}
                </button>
              ))}
            </div>

            {loading && (
              <div className="flex items-center justify-center py-20 gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full" />
                <span className="text-white/30 font-mono text-sm">Loading from TxLINE...</span>
              </div>
            )}

            {error && <div className="mb-6 bg-red-500/5 border border-red-500/10 rounded-2xl p-4"><p className="text-red-400/60 font-mono text-xs">{error}</p></div>}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-20"><p className="text-white/30 font-mono text-sm">No matches available</p></div>
            )}

            {!loading && (
              <div className="space-y-3">
                {filtered.map(m => (
                  <div key={m.id} className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4 hover:border-white/10 transition-colors">
                    <div className="shrink-0 w-20 text-center">
                      <span className="font-mono text-xs text-white/30">#{m.id}</span>
                      <div className={`mt-1 text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full ${m.status === "live" ? "bg-red-500/20 text-red-400 animate-pulse" : m.status === "finished" ? "bg-white/10 text-white/40" : "bg-white/5 text-white/30"}`}>
                        {m.status === "live" ? "LIVE" : m.status}
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="font-mono text-white font-semibold text-sm">{m.homeFlag} {m.home}</span>
                        <span className={`font-mono text-xl font-bold shrink-0 w-16 text-center ${m.status === "live" ? "text-red-400" : m.status === "finished" ? "text-white" : "text-white/40"}`}>
                          {m.homeScore !== null && m.awayScore !== null ? `${m.homeScore} - ${m.awayScore}` : "vs"}
                        </span>
                        <span className="font-mono text-white font-semibold text-sm">{m.awayFlag} {m.away}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-xs text-white/40">{m.date} · {m.time}</div>
                        {m.phase && <div className="font-mono text-[10px] text-white/20 mt-0.5">{m.phase}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {detailTab === "scorers" && (
          <div className="space-y-2">
            {scorers.map((s, i) => (
              <div key={s.player} className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4">
                <span className={`font-mono text-lg w-8 shrink-0 ${i === 0 ? "text-red-400 font-bold" : i < 3 ? "text-red-300/60" : "text-white/30"}`}>{i + 1}</span>
                <span className="text-lg shrink-0">{s.flag}</span>
                <div className="flex-1"><span className="font-mono font-semibold text-white text-sm">{s.player}</span><span className="ml-2 font-mono text-xs text-white/30">{s.team}</span></div>
                <div className="text-right shrink-0"><span className="font-mono text-lg text-red-400 font-bold">{s.goals}</span><div className="text-[10px] text-white/25 font-mono">{s.assists} assists · {s.matches} MP</div></div>
              </div>
            ))}
            <p className="text-center font-mono text-[10px] text-white/15 mt-2">{usingLiveData ? "Live data via football-data.org" : "Demo data — set VITE_FOOTBALL_API_KEY for live updates"}</p>
          </div>
        )}

        {detailTab === "standings" && (
          <div className="space-y-6">
            {(() => {
              if (standings.length > 0) {
                const grouped: Record<string, FDStanding[]> = {};
                for (const s of standings) { if (!grouped[s.group]) grouped[s.group] = []; grouped[s.group].push(s); }
                return Object.entries(grouped).map(([group, teams]) => (
                  <div key={group}>
                    <h3 className="font-mono text-sm text-red-300/60 mb-3">{group}</h3>
                    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead><tr className="text-white/25 text-[10px] border-b border-white/[0.04]">{["#","Team","P","W","D","L","GF","GA","Pts"].map(h => <th key={h} className="p-2 font-mono font-normal">{h}</th>)}</tr></thead>
                        <tbody>
                          {teams.sort((a,b) => a.pos-b.pos).map(s => (
                            <tr key={s.team} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                              <td className="p-2 font-mono text-xs text-white/40">{s.pos}</td>
                              <td className="p-2 font-mono text-xs text-white font-medium">{s.flag} {s.team}</td>
                              <td className="p-2 font-mono text-xs text-white/40">{s.p}</td>
                              <td className="p-2 font-mono text-xs text-white/40">{s.w}</td>
                              <td className="p-2 font-mono text-xs text-white/40">{s.d}</td>
                              <td className="p-2 font-mono text-xs text-white/40">{s.l}</td>
                              <td className="p-2 font-mono text-xs text-white/40">{s.gf}</td>
                              <td className="p-2 font-mono text-xs text-white/40">{s.ga}</td>
                              <td className="p-2 font-mono text-xs text-red-400 font-bold">{s.pts}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ));
              }
              return STANDINGS.map(g => (
                <div key={g.group}>
                  <h3 className="font-mono text-sm text-red-300/60 mb-3">{g.group}</h3>
                  <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead><tr className="text-white/25 text-[10px] border-b border-white/[0.04]">{["#","Team","P","W","D","L","GF","GA","Pts"].map(h => <th key={h} className="p-2 font-mono font-normal">{h}</th>)}</tr></thead>
                      <tbody>
                        {g.teams.map(s => (
                          <tr key={s.team} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                            <td className="p-2 font-mono text-xs text-white/40">{s.pos}</td>
                            <td className="p-2 font-mono text-xs text-white font-medium">{s.flag} {s.team}</td>
                            <td className="p-2 font-mono text-xs text-white/40">{s.p}</td>
                            <td className="p-2 font-mono text-xs text-white/40">{s.w}</td>
                            <td className="p-2 font-mono text-xs text-white/40">{s.d}</td>
                            <td className="p-2 font-mono text-xs text-white/40">{s.l}</td>
                            <td className="p-2 font-mono text-xs text-white/40">{s.gf}</td>
                            <td className="p-2 font-mono text-xs text-white/40">{s.ga}</td>
                            <td className="p-2 font-mono text-xs text-red-400 font-bold">{s.pts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ));
            })()}
            <p className="text-center font-mono text-[10px] text-white/15 mt-2">{usingLiveData ? "Live data via football-data.org" : "Demo data — set VITE_FOOTBALL_API_KEY for live updates"}</p>
          </div>
        )}

        {detailTab === "knockout" && (
          <div className="space-y-8">
            {KNOCKOUT.map((round) => (
              <div key={round.round}>
                <h3 className="font-mono text-sm text-red-300/60 mb-3 tracking-wider uppercase">{round.round}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {round.matches.map((m, mi) => (
                    <div key={mi} className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 hover:border-white/10 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-semibold text-white text-sm">{m.hf} {m.h}</span>
                        <span className={`font-mono font-bold text-lg shrink-0 ${m.hs !== null && m.as !== null ? "text-white" : "text-white/30"}`}>
                          {m.hs !== null && m.as !== null ? `${m.hs} - ${m.as}` : "vs"}
                        </span>
                        <span className="font-mono font-semibold text-white text-sm text-right">{m.a} {m.af}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-white/25">
                        <span>{m.date} · {m.time}</span>
                        <span className="text-white/15 truncate ml-2">{m.venue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-center font-mono text-[10px] text-white/15 mt-2">Demo bracket — set VITE_FOOTBALL_API_KEY for live updates</p>
          </div>
        )}

        <div className="mt-10 text-center">
          <p className="font-mono text-[10px] text-white/15">{error ? error : "Live data via TxLINE (TxODDS) — Official Hackathon Sponsor · Auto-refresh 30s"}</p>
        </div>
      </div>
    </div>
  );
}
