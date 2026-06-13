import {
  AlertTriangle,
  Award,
  CalendarDays,
  Clock,
  Gift,
  Home,
  ListChecks,
  Lock,
  LogOut,
  Medal,
  NotebookPen,
  Save,
  Shield,
  Table2,
  Trophy,
  User,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  changePassword,
  deleteUser,
  fetchBootstrap,
  fetchMatchPredictions,
  fetchUserSummary,
  login,
  logout,
  resetUserPassword,
  savePrediction,
  setDoublePoints,
  setMatchResult,
  setUserBonus,
  setUserPrediction,
  syncResults,
  syncSquads,
  updateAvatar,
  updateProfile,
  type BootstrapData,
  type UserClosedSummary,
  type VisiblePrediction
} from "./client/api";
import { getPostMatchPhrase, getPreviewPhrase } from "./domain/fortilinCopy";
import { isPredictionLocked } from "./domain/scoring";
import { achievementDefinitions } from "./shared/achievements";
import type { Match, MatchStage, PredictionOutcome, SquadPlayer, Team, UserAchievement } from "./shared/types";

type Tab = "home" | "matches" | "leaderboard" | "world" | "bonus" | "profile";

type ScoreDraft = Record<string, { home: number; away: number }>;

type MyPrediction = { id: string; homeScore: number; awayScore: number; points: number; outcome: string };

type MatchFilter = "all" | "knockout" | `matchday-${number}`;

type WorldMode = "knockout" | "groups";

type ScorerRow = {
  player: string;
  teamName: string;
  goals: number;
};

type KnockoutRoundGroup = {
  stage: MatchStage;
  label: string;
  matches: Match[];
};

export function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [scores, setScores] = useState<ScoreDraft>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pullStartY, setPullStartY] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [phraseSessionSeed] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [matchScrollRequest, setMatchScrollRequest] = useState(0);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!data) return;
    setScores((current) => {
      const next = { ...current };
      for (const match of data.matches) {
        if (match.myPrediction) {
          next[match.id] = {
            home: match.myPrediction.homeScore,
            away: match.myPrediction.awayScore
          };
        } else if (!next[match.id]) {
          next[match.id] = {
            home: 0,
            away: 0
          };
        }
      }
      return next;
    });
  }, [data]);

  async function refresh(options: { silent?: boolean; preserveDataOnError?: boolean } = {}) {
    if (!options.silent) setLoading(true);
    setLoadError(null);
    try {
      const bootstrap = await fetchBootstrap();
      setData(bootstrap);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar Porra Fortilin.";
      if (options.preserveDataOnError) {
        setNotice(message);
      } else {
        setData(null);
        setLoadError(message);
      }
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  async function handlePullRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh({ silent: true, preserveDataOnError: true });
    } finally {
      setRefreshing(false);
    }
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    if (event.currentTarget.scrollTop <= 0) {
      setPullStartY(event.touches[0]?.clientY ?? null);
      setPullDistance(0);
    }
  }

  function handleTouchMove(event: React.TouchEvent<HTMLElement>) {
    if (pullStartY === null || event.currentTarget.scrollTop > 0) return;
    const currentY = event.touches[0]?.clientY ?? pullStartY;
    setPullDistance(Math.max(0, Math.min(120, currentY - pullStartY)));
  }

  function handleTouchEnd() {
    if (pullDistance > 80) void handlePullRefresh();
    setPullStartY(null);
    setPullDistance(0);
  }

  async function handleSave(match: Match) {
    const draft = scores[match.id] ?? { home: 0, away: 0 };
    try {
      await savePrediction(match.id, draft.home, draft.away);
      await refresh({ silent: true, preserveDataOnError: true });
      setNotice("Pronóstico guardado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar.");
    }
  }

  function handleTabChange(nextTab: Tab) {
    if (nextTab === "matches") {
      setMatchScrollRequest((current) => current + 1);
    }
    setTab(nextTab);
  }

  if (loading || (!data && !loadError)) {
    return (
      <main className="app-shell loading-shell">
        <div className="loader-card">
          <Trophy size={34} />
          <p>Cargando Porra Fortilin...</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="app-shell loading-shell">
        <div className="loader-card">
          <Trophy size={34} />
          <p>{loadError}</p>
          <button className="save-button wide" type="button" onClick={() => void refresh()}>Reintentar</button>
        </div>
      </main>
    );
  }

  if (!data.user) {
    return <AuthScreen data={data} onDone={refresh} />;
  }

  const sortedMatches = sortMatchesByKickoff(data.matches);
  const currentMatch = findCurrentMatch(sortedMatches);
  const appData = { ...data, matches: sortedMatches };
  const editableNext =
    sortedMatches.find((match) => !isPredictionLocked(match.kickoffAt) && match.status !== "finished") ?? data.nextMatch;
  const nextMatch = currentMatch ?? data.nextMatch ?? editableNext;

  return (
    <main
      className="app-shell"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="stadium-bg" />
      {(pullDistance > 0 || refreshing) ? (
        <div className={`pull-refresh ${refreshing ? "active" : ""}`} style={{ transform: `translateY(${Math.min(pullDistance, 56)}px)` }}>
          {refreshing ? "Actualizando..." : pullDistance > 80 ? "Suelta para actualizar" : "Desliza para actualizar"}
        </div>
      ) : null}
      <div className="content">
        <Header data={appData} onProfile={() => setTab("profile")} />
        {notice ? <button className="notice" type="button" onClick={() => setNotice(null)}>{notice}</button> : null}

        {tab === "home" ? (
          <HomeView
            data={appData}
            nextMatch={nextMatch}
            editableMatch={currentMatch ?? editableNext}
            scores={scores}
            setScores={setScores}
            onSave={handleSave}
            refreshKey={data.now}
            onOpenMatches={() => handleTabChange("matches")}
            onOpenLeaderboard={() => handleTabChange("leaderboard")}
            onSelectUser={setSelectedUserId}
            phraseSessionSeed={phraseSessionSeed}
          />
        ) : null}
        {tab === "matches" ? (
          <MatchesView data={appData} scores={scores} setScores={setScores} onSave={handleSave} refreshKey={data.now} scrollRequest={matchScrollRequest} />
        ) : null}
        {tab === "leaderboard" ? <LeaderboardView data={appData} onSelectUser={setSelectedUserId} /> : null}
        {tab === "world" ? <WorldStandingsView data={appData} /> : null}
        {tab === "bonus" ? <BonusView data={appData} /> : null}
        {tab === "profile" ? (
          <ProfileView
            data={appData}
            onRefresh={() => refresh({ silent: true, preserveDataOnError: true })}
            onNotice={setNotice}
          />
        ) : null}
      </div>
      <BottomNav active={tab} onChange={handleTabChange} />
      {selectedUserId ? <UserSummaryModal userId={selectedUserId} data={appData} onClose={() => setSelectedUserId(null)} /> : null}
    </main>
  );
}

function Header({ data, onProfile }: { data: BootstrapData; onProfile: () => void }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <Trophy size={30} />
        </div>
        <div>
          <h1>Porra</h1>
          <strong>Fortilin</strong>
        </div>
      </div>
      <button className="profile-dot" type="button" title={data.user?.displayName} onClick={onProfile} aria-label="Editar perfil">
        <UserAvatar name={data.user?.displayName || "PF"} avatarUrl={data.user?.avatarUrl ?? null} />
        <i />
      </button>
    </header>
  );
}

function HomeView({
  data,
  nextMatch,
  editableMatch,
  scores,
  setScores,
  onSave,
  refreshKey,
  onOpenMatches,
  onOpenLeaderboard,
  onSelectUser,
  phraseSessionSeed
}: {
  data: BootstrapData;
  nextMatch: Match | null;
  editableMatch: Match | null;
  scores: ScoreDraft;
  setScores: (setter: (current: ScoreDraft) => ScoreDraft) => void;
  onSave: (match: Match) => void;
  refreshKey: string;
  onOpenMatches: () => void;
  onOpenLeaderboard: () => void;
  onSelectUser: (userId: string) => void;
  phraseSessionSeed: string;
}) {
  const todayMatches = useMemo(() => getRelevantMatches(data.matches).slice(0, 4), [data.matches]);
  const missingUpcoming = useMemo(() => getMissingUpcomingPredictions(data.matches), [data.matches]);

  return (
    <>
      {nextMatch ? (
        <>
          <NextMatchHero match={nextMatch} />
          <PreviewPhrase match={nextMatch} userId={data.user?.id ?? "anon"} sessionSeed={phraseSessionSeed} />
        </>
      ) : null}
      {missingUpcoming.length > 0 ? <UpcomingPredictionAlert matches={missingUpcoming} onOpen={onOpenMatches} /> : null}
      {editableMatch ? (
        <PredictionCard match={editableMatch} scores={scores} setScores={setScores} onSave={onSave} refreshKey={refreshKey} userId={data.user?.id ?? ""} featured />
      ) : null}
      <section className="two-column">
        <LeaderboardCard rows={data.leaderboard.slice(0, 6)} onOpen={onOpenLeaderboard} onSelect={onSelectUser} />
        <TodayCard matches={todayMatches} onOpen={onOpenMatches} />
      </section>
    </>
  );
}

function NextMatchHero({ match }: { match: Match }) {
  const score = getVisibleMatchScore(match);
  return (
    <section className="next-hero">
      <div className={`hero-pill ${match.status === "live" ? "live" : ""}`}>{matchStatusLabel(match)}</div>
      {match.isDoublePoints ? <span className="double-chip hero-double">Puntos x2</span> : null}
      <div className="hero-teams">
        <TeamBadge team={match.homeTeam} large />
        <div className="hero-names">
          <strong>{match.homeTeam.name}</strong>
          <span>vs</span>
          <strong>{match.awayTeam.name}</strong>
        </div>
        <TeamBadge team={match.awayTeam} large />
      </div>
      {score ? <div className="hero-score">{score.home} - {score.away}</div> : null}
      <MatchGoals match={match} compact />
      <div className="hero-meta">
        <span><CalendarDays size={15} /> {formatDate(match.kickoffAt)}</span>
        <span>{formatTime(match.kickoffAt)} Madrid</span>
      </div>
      <LockCountdown match={match} />
      <a className="hero-cta" href="#pronostico">Haz tu pronóstico</a>
    </section>
  );
}

function PreviewPhrase({ match, userId, sessionSeed }: { match: Match; userId: string; sessionSeed: string }) {
  const phrase = useMemo(() => getPreviewPhrase(`${match.id}:${userId}:${sessionSeed}`), [match.id, userId, sessionSeed]);
  return (
    <div className="preview-phrase">
      <NotebookPen size={17} />
      <span>{phrase}</span>
    </div>
  );
}

function UpcomingPredictionAlert({ matches, onOpen }: { matches: Match[]; onOpen: () => void }) {
  const lockedCount = matches.filter((match) => isPredictionLocked(match.kickoffAt)).length;
  return (
    <button className="prediction-alert" type="button" onClick={onOpen}>
      <AlertTriangle size={18} />
      <span>
        Te faltan {matches.length} pronóstico{matches.length === 1 ? "" : "s"} de las próximas 24 h.
        {lockedCount > 0 ? ` ${lockedCount} ya bloqueado${lockedCount === 1 ? "" : "s"}.` : ""}
      </span>
    </button>
  );
}

function LockCountdown({ match }: { match: Match }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const lockTime = new Date(match.lockAt).getTime();
  const remaining = lockTime - now;
  return (
    <div className={`lock-countdown ${remaining <= 0 ? "locked" : ""}`}>
      <Clock size={15} />
      <span>{remaining <= 0 ? "Pronóstico bloqueado" : `Bloquea en ${formatDuration(remaining)}`}</span>
    </div>
  );
}

function PredictionCard({
  match,
  scores,
  setScores,
  onSave,
  refreshKey,
  userId,
  featured = false,
  domId
}: {
  match: Match;
  scores: ScoreDraft;
  setScores: (setter: (current: ScoreDraft) => ScoreDraft) => void;
  onSave: (match: Match) => void;
  refreshKey: string;
  userId: string;
  featured?: boolean;
  domId?: string;
}) {
  const locked = isPredictionLocked(match.kickoffAt) || match.status === "finished";
  const draft = scores[match.id] ?? { home: 0, away: 0 };
  const savedPrediction = getMyPrediction(match);
  const postMatchPhrase = getOwnPostMatchPhrase(match, savedPrediction, userId);
  const score = getVisibleMatchScore(match);

  function change(side: "home" | "away", delta: number) {
    setScores((current) => {
      const existing = current[match.id] ?? { home: 0, away: 0 };
      return {
        ...current,
        [match.id]: {
          ...existing,
          [side]: clampScore(existing[side] + delta)
        }
      };
    });
  }

  return (
    <section className={`card prediction-card ${featured ? "featured" : ""}`} id={domId ?? (featured ? "pronostico" : undefined)}>
      <div className="section-title">
        <ListChecks size={18} />
        <span>Haz tu pronóstico</span>
        <b className={`prediction-chip ${savedPrediction ? "saved" : locked ? "missed" : "pending"}`}>
          {savedPrediction ? "Guardado" : locked ? "No enviado" : "Sin guardar"}
        </b>
        {locked ? <em><Lock size={13} /> Bloqueado</em> : <em>Bloqueo 2h antes</em>}
      </div>
      <p className="muted compact">
        {match.stage !== "GROUP" ? matchCardSubtitle(match) : (
          <>
        {match.round} · Grupo {match.groupName} · {formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)}
          </>
        )}
      </p>
      <div className="score-row">
        <TeamInline team={match.homeTeam} />
        <ScoreStepper value={draft.home} disabled={locked} onDec={() => change("home", -1)} onInc={() => change("home", 1)} />
        <span className="score-separator">-</span>
        <ScoreStepper value={draft.away} disabled={locked} onDec={() => change("away", -1)} onInc={() => change("away", 1)} />
        <TeamInline team={match.awayTeam} align="right" />
      </div>
      {score ? (
        <p className="live-score-line">{matchStatusLabel(match)} · Resultado actual: {score.home} - {score.away}</p>
      ) : null}
      <KnockoutResultDetails match={match} />
      {postMatchPhrase ? <PostMatchPhrase outcome={savedPrediction?.outcome ?? "pending"} phrase={postMatchPhrase} /> : null}
      <MatchGoals match={match} />
      <VisiblePredictions match={match} refreshKey={refreshKey} />
      <div className="card-actions">
        {match.isDoublePoints ? <span className="double-chip">Puntos x2</span> : <span />}
        <button className="save-button" type="button" disabled={locked} onClick={() => onSave(match)}>
          <Save size={16} /> Guardar
        </button>
      </div>
    </section>
  );
}

function MatchGoals({ match, compact = false }: { match: Match; compact?: boolean }) {
  if (!match.goals || match.goals.length === 0) return null;
  let previousHome = 0;
  let previousAway = 0;
  const goals = match.goals.map((goal) => {
    const side = goal.homeScore > previousHome ? "home" : goal.awayScore > previousAway ? "away" : "unknown";
    previousHome = goal.homeScore;
    previousAway = goal.awayScore;
    return { ...goal, side };
  });

  return (
    <div className={`goal-list ${compact ? "compact-goals" : ""}`}>
      {goals.map((goal, index) => (
        <span className={`goal-item ${goal.side}`} key={`${match.id}-goal-${index}`}>
          {goal.minute ? `${goal.minute}' ` : ""}
          {formatGoal(goal)} · {goal.homeScore}-{goal.awayScore}
        </span>
      ))}
    </div>
  );
}

function PostMatchPhrase({ outcome, phrase }: { outcome: string; phrase: string }) {
  return (
    <div className={`post-match-phrase ${outcome}`}>
      <NotebookPen size={16} />
      <span>{phrase}</span>
    </div>
  );
}

function KnockoutResultDetails({ match, compact = false, showScoringNote = true }: { match: Match; compact?: boolean; showScoringNote?: boolean }) {
  if (match.stage === "GROUP") return null;

  const hasExtraTime = hasScore(match.extraHomeScore, match.extraAwayScore);
  const hasPenalties = hasScore(match.penaltyHomeScore, match.penaltyAwayScore);
  const winner = getWinnerTeam(match);

  return (
    <div className={`knockout-result ${compact ? "compact" : ""}`}>
      {showScoringNote ? <small>Pronóstico y puntos: marcador al final de los 90 minutos.</small> : null}
      {winner ? <strong>Ganador: {winner.name}</strong> : null}
      {hasExtraTime ? (
        <span>Prórroga: {match.extraHomeScore} - {match.extraAwayScore}</span>
      ) : null}
      {hasPenalties ? <PenaltyShootoutLine match={match} /> : null}
    </div>
  );
}

function PenaltyShootoutLine({ match }: { match: Match }) {
  if (!hasScore(match.penaltyHomeScore, match.penaltyAwayScore)) return null;

  return (
    <div className="penalty-line">
      <b>Penaltis: {match.penaltyHomeScore} - {match.penaltyAwayScore}</b>
    </div>
  );
}

function VisiblePredictions({ match, refreshKey }: { match: Match; refreshKey: string }) {
  const [predictions, setPredictions] = useState<VisiblePrediction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const locked = isPredictionLocked(match.kickoffAt) || match.status === "finished";

  useEffect(() => {
    let cancelled = false;
    if (!locked) {
      setPredictions([]);
      setError(null);
      return;
    }

    fetchMatchPredictions(match.id)
      .then((rows) => {
        if (!cancelled) {
          setPredictions(rows);
          setError(null);
        }
      })
      .catch((apiError) => {
        if (!cancelled) {
          setPredictions([]);
          setError(apiError instanceof Error ? apiError.message : "No se pudieron cargar pronósticos.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [locked, match.id, refreshKey]);

  if (!locked) return null;
  if (error) return <p className="visible-predictions muted">{error}</p>;
  if (predictions.length === 0) return <p className="visible-predictions muted">Aún no hay pronósticos visibles.</p>;

  return (
    <div className="visible-predictions">
      <strong>Pronósticos visibles</strong>
      {predictions.map((prediction) => (
        <span key={`${match.id}-${prediction.displayName}`}>
          <b>{prediction.displayName}</b>
          <em>{prediction.homeScore} - {prediction.awayScore}</em>
          <small>{prediction.points} pts</small>
        </span>
      ))}
    </div>
  );
}

function ScoreStepper({ value, disabled, onDec, onInc }: { value: number; disabled: boolean; onDec: () => void; onInc: () => void }) {
  return (
    <div className="score-stepper">
      <button type="button" disabled={disabled} onClick={onInc} aria-label="Subir goles">▲</button>
      <strong>{value}</strong>
      <button type="button" disabled={disabled} onClick={onDec} aria-label="Bajar goles">▼</button>
    </div>
  );
}

function MatchesView({
  data,
  scores,
  setScores,
  onSave,
  refreshKey,
  scrollRequest
}: {
  data: BootstrapData;
  scores: ScoreDraft;
  setScores: (setter: (current: ScoreDraft) => ScoreDraft) => void;
  onSave: (match: Match) => void;
  refreshKey: string;
  scrollRequest: number;
}) {
  const [filter, setFilter] = useState<MatchFilter>("all");
  const handledScrollRequestRef = useRef(0);
  const filters = useMemo(() => buildMatchFilters(data.matches), [data.matches]);
  const matches = useMemo(() => filterMatches(data.matches, filter), [data.matches, filter]);

  useEffect(() => {
    if (scrollRequest === 0 || handledScrollRequestRef.current === scrollRequest) return;
    const target = getLastFinishedMatch(matches) ?? matches[0] ?? null;
    if (!target) return;
    handledScrollRequestRef.current = scrollRequest;

    const timeoutId = window.setTimeout(() => {
      document.getElementById(matchCardDomId(target.id))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [matches, scrollRequest]);

  return (
    <section className="view-stack">
      <div className="view-header">
        <h2>Partidos</h2>
        <p>Lista compacta para pronosticar rápido.</p>
      </div>
      <div className="segmented match-filters">
        {filters.map((item) => (
          <button key={item.value} type="button" className={filter === item.value ? "active" : ""} onClick={() => setFilter(item.value)}>
            {item.label}
          </button>
        ))}
      </div>
      {matches.map((match) => (
        <PredictionCard
          key={match.id}
          domId={matchCardDomId(match.id)}
          match={match}
          scores={scores}
          setScores={setScores}
          onSave={onSave}
          refreshKey={refreshKey}
          userId={data.user?.id ?? ""}
        />
      ))}
    </section>
  );
}

function LeaderboardView({ data, onSelectUser }: { data: BootstrapData; onSelectUser: (userId: string) => void }) {
  return (
    <section className="card full-card">
      <div className="section-title">
        <Medal size={18} />
        <span>Clasificación</span>
      </div>
      <LeaderboardRows rows={data.leaderboard} onSelect={onSelectUser} />
    </section>
  );
}

function WorldStandingsView({ data }: { data: BootstrapData }) {
  const groups = useMemo(() => groupWorldStandings(data.worldStandings), [data.worldStandings]);
  const bestThirdKeys = useMemo(() => getBestThirdPlaceKeys(data.worldStandings), [data.worldStandings]);
  const hasKnockouts = useMemo(() => data.matches.some((match) => match.stage !== "GROUP"), [data.matches]);
  const groupStageComplete = useMemo(() => isGroupStageComplete(data.matches), [data.matches]);
  const updatedAt = data.worldStandings[0]?.updatedAt ?? null;
  const [mode, setMode] = useState<WorldMode>(() => (groupStageComplete && hasKnockouts ? "knockout" : "groups"));

  useEffect(() => {
    if (groupStageComplete && hasKnockouts) setMode("knockout");
  }, [groupStageComplete, hasKnockouts]);

  const showKnockouts = hasKnockouts && mode === "knockout";

  return (
    <section className="view-stack">
      <div className="view-header">
        <h2>{showKnockouts ? "Cruces Mundial" : "Clasificación Mundial"}</h2>
        <p>{showKnockouts ? "Eliminatorias preparadas con horarios oficiales y equipos resueltos al cerrar grupos." : "Grupos oficiales cacheados desde OpenLigaDB."}</p>
      </div>
      {updatedAt ? <p className="world-updated">Actualizado: {formatDate(updatedAt)} · {formatTime(updatedAt)} Madrid</p> : null}
      {hasKnockouts ? (
        <div className="segmented world-mode">
          <button type="button" className={mode === "knockout" ? "active" : ""} onClick={() => setMode("knockout")}>Cruces</button>
          <button type="button" className={mode === "groups" ? "active" : ""} onClick={() => setMode("groups")}>Grupos</button>
        </div>
      ) : null}
      {showKnockouts ? <WorldKnockoutView matches={data.matches} groupStageComplete={groupStageComplete} /> : (
        <>
          {groups.length === 0 ? (
            <div className="card full-card">
              <p className="empty-state">La clasificación del Mundial se cargará en la próxima sincronización de OpenLigaDB.</p>
            </div>
          ) : null}
          {groups.map((group) => (
            <section className="card world-group-card" key={group.name}>
              <div className="section-title">
                <Table2 size={18} />
                <span>{group.name}</span>
              </div>
              <div className="world-table">
                <div className="world-head">
                  <span>#</span>
                  <span>Selección</span>
                  <span>PJ</span>
                  <span>DG</span>
                  <span>Pts</span>
                </div>
                {group.rows.map((row) => {
                  const qualification = worldQualificationStatus(row, bestThirdKeys);
                  return (
                    <div className={`world-row ${qualification}`} key={`${group.name}-${row.teamId ?? row.teamName}`}>
                      <span>{row.rank}</span>
                      <TeamBadge team={{ id: row.teamId ?? row.teamName, name: row.teamName, shortCode: row.shortCode ?? row.teamName.slice(0, 3), logoUrl: row.logoUrl }} />
                      <strong>{row.teamName}</strong>
                      <em>{row.played}</em>
                      <em>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</em>
                      <b>{row.points}</b>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {groups.length > 0 ? (
            <div className="world-legend">
              <span><i className="legend-direct" /> 1.º y 2.º: pasan directos</span>
              <span><i className="legend-third" /> 8 mejores terceros</span>
              <small>Provisional según puntos, diferencia de goles y goles a favor publicados por OpenLigaDB.</small>
            </div>
          ) : null}
        </>
      )}
      <div className="rules-card">
        <strong>Fase de grupos y eliminatorias</strong>
        <ul>
          <li>La clasificación y los resultados se actualizan desde OpenLigaDB con el worker.</li>
          <li>Se clasifican los dos primeros de cada grupo y los ocho mejores terceros.</li>
          <li>Al cerrarse los grupos, la app resuelve los dieciseisavos con la tabla oficial de terceros y carga los cruces ya sembrados.</li>
          <li>En eliminatorias la porra puntúa el marcador a 90 minutos; prórroga y penaltis solo aclaran el ganador real del cruce.</li>
          <li>Los pronósticos ya guardados y la clasificación de la porra no se recalculan salvo que cambie el resultado real del partido.</li>
        </ul>
      </div>
    </section>
  );
}

function WorldKnockoutView({ matches, groupStageComplete }: { matches: Match[]; groupStageComplete: boolean }) {
  const rounds = useMemo(() => getKnockoutRoundGroups(matches), [matches]);
  if (rounds.length === 0) {
    return (
      <div className="card full-card">
        <p className="empty-state">Los cruces aparecerán cuando se cargue el calendario de eliminatorias.</p>
      </div>
    );
  }

  return (
    <>
      <div className="world-legend bracket-note">
        <span><i className={groupStageComplete ? "legend-direct" : "legend-third"} /> {groupStageComplete ? "Cruces activos con equipos resueltos" : "Cruces preparados hasta que cierre la fase de grupos"}</span>
        <small>Los placeholders como 1.º Grupo A o Ganador M73 se reemplazan automáticamente al sincronizar OpenLigaDB.</small>
      </div>
      {rounds.map((round) => (
        <section className="card bracket-round-card" key={round.stage}>
          <div className="section-title">
            <Trophy size={18} />
            <span>{round.label}</span>
          </div>
          <div className="bracket-list">
            {round.matches.map((match) => {
              const score = getVisibleMatchScore(match);
              const winnerId = getWinnerTeamId(match);
              return (
                <div className="bracket-match" key={match.id}>
                  <div className="bracket-meta">
                    <span>{matchNumberLabel(match)}</span>
                    <em>{formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)} Madrid</em>
                  </div>
                  <div className="bracket-teams">
                    <BracketTeam team={match.homeTeam} winner={winnerId === match.homeTeam.id} />
                    <span className="bracket-score">{score ? `${score.home} - ${score.away}` : "vs"}</span>
                    <BracketTeam team={match.awayTeam} winner={winnerId === match.awayTeam.id} align="right" />
                  </div>
                  <KnockoutResultDetails match={match} compact showScoringNote={false} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

function BracketTeam({ team, align = "left", winner = false }: { team: Team; align?: "left" | "right"; winner?: boolean }) {
  const placeholder = team.id.startsWith("slot-");
  return (
    <div className={`bracket-team ${align} ${winner ? "winner" : ""} ${placeholder ? "placeholder" : ""}`}>
      {align === "left" ? <TeamBadge team={team} /> : null}
      <strong>{team.name}</strong>
      {align === "right" ? <TeamBadge team={team} /> : null}
    </div>
  );
}

function BonusView({ data }: { data: BootstrapData }) {
  const teamById = new Map(data.teams.map((team) => [team.id, team]));
  const bonus = data.bonus;
  const scorerTeam = bonus?.topScorerTeamId ? teamById.get(bonus.topScorerTeamId)?.name : null;
  const scorers = getTopScorers(data.matches, data.squadPlayers);
  return (
    <section className="view-stack">
      <div className="view-header">
        <h2>Bonus</h2>
        <p>Bloqueados al crear el usuario.</p>
      </div>
      <div className="card bonus-detail">
        <BonusLine label="Campeón" value={bonus?.championTeamId ? teamById.get(bonus.championTeamId)?.name : null} />
        <BonusLine label="Subcampeón" value={bonus?.runnerUpTeamId ? teamById.get(bonus.runnerUpTeamId)?.name : null} />
        <BonusLine label="Máximo goleador" value={bonus?.topScorer ? `${bonus.topScorer}${scorerTeam ? ` (${scorerTeam})` : ""}` : null} />
      </div>
      <div className="card scorer-card">
        <div className="section-title">
          <Trophy size={18} />
          <span>Goleadores</span>
        </div>
        {scorers.length === 0 ? (
          <p className="empty-state">OpenLigaDB todavia no ha publicado goleadores con nombre.</p>
        ) : (
          <div className="scorer-list">
            {scorers.map((scorer, index) => (
              <div className="scorer-row" key={`${scorer.player}-${scorer.teamName}`}>
                <span>{index + 1}</span>
                <strong>{scorer.player}</strong>
                <em>{scorer.teamName}</em>
                <b>{scorer.goals}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rules-card">
        <strong>Reglas de puntuación</strong>
        <ul>
          <li>Resultado exacto: 3 puntos.</li>
          <li>Tendencia: 1 punto si aciertas ganador o empate aunque falle el marcador.</li>
          <li>Fallo: 0 puntos.</li>
          <li>Los partidos marcados como x2 duplican los puntos del pronóstico.</li>
          <li>Bonus bloqueados al crear usuario: campeón +10, subcampeón +5 y máximo goleador +5.</li>
          <li>El máximo goleador se valida contra OpenLigaDB y se normaliza con la convocatoria cargada.</li>
        </ul>
      </div>
    </section>
  );
}

function UserSummaryModal({ userId, data, onClose }: { userId: string; data: BootstrapData; onClose: () => void }) {
  const [summary, setSummary] = useState<UserClosedSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const teamById = useMemo(() => new Map(data.teams.map((team) => [team.id, team])), [data.teams]);
  const matchById = useMemo(() => new Map(data.matches.map((match) => [match.id, match])), [data.matches]);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setError(null);
    fetchUserSummary(userId)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((apiError) => {
        if (!cancelled) setError(apiError instanceof Error ? apiError.message : "No se pudo cargar el participante.");
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const bonus = summary?.bonus ?? null;
  const scorerTeam = bonus?.topScorerTeamId ? teamById.get(bonus.topScorerTeamId)?.name : null;
  const recentPredictions = summary?.predictions.slice(0, 3) ?? [];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="card user-modal">
        <div className="modal-head">
          <div>
            <strong>{summary?.user.displayName ?? "Participante"}</strong>
            <span>Logros, bonus y últimos pronósticos</span>
            {data.user?.isAdmin && summary ? <small className="modal-login">Login: {summary.user.username}</small> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {!summary && !error ? <p className="empty-state">Cargando participante...</p> : null}
        {summary ? (
          <>
            <AchievementList achievements={summary.achievements ?? []} compact />
            <div className="summary-block compact-bonus-block">
              <h3>Bonus</h3>
              <BonusLine label="Campeón" value={bonus?.championTeamId ? teamById.get(bonus.championTeamId)?.name : null} />
              <BonusLine label="Subcampeón" value={bonus?.runnerUpTeamId ? teamById.get(bonus.runnerUpTeamId)?.name : null} />
              <BonusLine label="Máximo goleador" value={bonus?.topScorer ? `${bonus.topScorer}${scorerTeam ? ` (${scorerTeam})` : ""}` : null} />
              <BonusLine label="Puntos bonus" value={bonus ? `${bonus.points}` : "0"} />
            </div>
            <div className="summary-block">
              <h3>Últimos 3 pronósticos cerrados</h3>
              {recentPredictions.length === 0 ? <p className="empty-state">Aún no hay pronósticos cerrados visibles.</p> : null}
              <div className="summary-predictions">
                {recentPredictions.map((prediction) => {
                  const match = matchById.get(prediction.matchId);
                  return (
                    <div className="summary-prediction-row" key={prediction.id}>
                      <span>{match ? `${shortTeam(match.homeTeam.name)} vs ${shortTeam(match.awayTeam.name)}` : prediction.matchId}</span>
                      <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
                      <b>{prediction.points} pts</b>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function AchievementList({ achievements, compact = false }: { achievements: UserAchievement[]; compact?: boolean }) {
  return (
    <div className={`${compact ? "summary-block" : "card"} achievements-card ${compact ? "compact-achievements" : ""}`}>
      <div className="section-title">
        <Award size={18} />
        <span>Logros</span>
      </div>
      {achievements.length === 0 ? <p className="empty-state">Aún no hay logros desbloqueados.</p> : null}
      <div className="achievement-list">
        {achievements.map((achievement) => (
          <article className="achievement-card" key={achievement.id}>
            <div className="achievement-mark">
              <Award size={22} />
            </div>
            <div>
              <strong>{achievement.name}</strong>
              <p>{achievement.description}</p>
              <small>
                {achievement.metadata?.preview === true ? "Vista previa admin" : `Desbloqueado el ${formatDate(achievement.unlockedAt)}`}
              </small>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProfileView({
  data,
  onRefresh,
  onNotice
}: {
  data: BootstrapData;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [displayName, setDisplayName] = useState(data.user?.displayName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newOwnPassword, setNewOwnPassword] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const profileAchievements: UserAchievement[] = data.user?.isAdmin
    ? achievementDefinitions.map((achievement) => ({
        ...achievement,
        unlockedAt: data.now,
        metadata: { preview: true }
      }))
    : data.achievements ?? [];

  useEffect(() => {
    setDisplayName(data.user?.displayName ?? "");
  }, [data.user?.displayName]);

  async function handleLogout() {
    await logout();
    await onRefresh();
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await updateProfile(displayName);
      onNotice("Perfil actualizado.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo actualizar el perfil.");
    }
  }

  async function handleOwnPasswordSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newOwnPassword.length < 6) {
      onNotice("La contraseña nueva debe tener al menos 6 caracteres.");
      return;
    }
    try {
      await changePassword(currentPassword, newOwnPassword);
      setCurrentPassword("");
      setNewOwnPassword("");
      onNotice("Contraseña actualizada.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo cambiar la contraseña.");
    }
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setAvatarBusy(true);
    try {
      const avatarUrl = await fileToAvatarDataUrl(file);
      await updateAvatar(avatarUrl);
      onNotice("Foto de perfil actualizada.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo subir la foto.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarBusy(true);
    try {
      await updateAvatar(null);
      onNotice("Foto de perfil eliminada.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo eliminar la foto.");
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <section className="view-stack">
      <div className="card profile-card">
        <UserAvatar name={data.user?.displayName || "PF"} avatarUrl={data.user?.avatarUrl ?? null} />
        <div>
          <h2>{data.user?.displayName}</h2>
          <p>{data.user?.isAdmin ? "Administrador" : `Liga ${data.league.name}`}</p>
        </div>
        <button type="button" className="ghost-button" onClick={handleLogout}>
          <LogOut size={16} /> Salir
        </button>
      </div>
      <form className="card profile-form" onSubmit={handleProfileSave}>
        <div className="section-title">
          <User size={18} />
          <span>Datos de perfil</span>
        </div>
        <label className="select-label">
          <span>Nombre visible</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label className="avatar-upload">
          <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={avatarBusy} />
          <span>{avatarBusy ? "Procesando foto..." : "Subir foto de perfil"}</span>
        </label>
        {data.user?.avatarUrl ? (
          <button type="button" className="ghost-button wide" onClick={handleAvatarRemove} disabled={avatarBusy}>Quitar foto</button>
        ) : null}
        <button type="submit" className="save-button wide">Guardar perfil</button>
      </form>
      <AchievementList achievements={profileAchievements} />
      <form className="card profile-form" onSubmit={handleOwnPasswordSave}>
        <div className="section-title">
          <Lock size={18} />
          <span>Cambiar contraseña</span>
        </div>
        <input
          placeholder="Contraseña actual"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <input
          placeholder="Nueva contraseña"
          type="password"
          value={newOwnPassword}
          onChange={(event) => setNewOwnPassword(event.target.value)}
        />
        <button type="submit" className="save-button wide">Cambiar contraseña</button>
      </form>
      {data.user?.isAdmin ? <AdminPanel data={data} onRefresh={onRefresh} onNotice={onNotice} /> : null}
    </section>
  );
}

function AdminPanel({ data, onRefresh, onNotice }: { data: BootstrapData; onRefresh: () => Promise<void>; onNotice: (message: string) => void }) {
  const [matchId, setMatchId] = useState(data.matches[0]?.id || "");
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const users = data.adminUsers ?? [];
  const [targetUserId, setTargetUserId] = useState(users[0]?.id ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [userHome, setUserHome] = useState(0);
  const [userAway, setUserAway] = useState(0);
  const match = data.matches.find((candidate) => candidate.id === matchId);
  const targetUser = users.find((item) => item.id === targetUserId) ?? null;
  const targetPrediction =
    data.adminPredictions?.find((prediction) => prediction.userId === targetUserId && prediction.matchId === matchId) ?? null;
  const defaultChampionId = data.teams[0]?.id ?? null;
  const defaultRunnerUpId = firstDifferentTeam(data.teams, defaultChampionId)?.id ?? null;
  const defaultScorerTeamId = firstTeamWithPlayers(data.teams, data.squadPlayers)?.id ?? data.teams[0]?.id ?? null;
  const defaultScorerPlayerId = firstPlayerForTeam(data.squadPlayers, defaultScorerTeamId)?.apiPlayerId ?? null;
  const [bonusChampionId, setBonusChampionId] = useState<string | null>(targetUser?.bonus?.championTeamId ?? defaultChampionId);
  const [bonusRunnerUpId, setBonusRunnerUpId] = useState<string | null>(targetUser?.bonus?.runnerUpTeamId ?? defaultRunnerUpId);
  const [bonusScorerTeamId, setBonusScorerTeamId] = useState<string | null>(targetUser?.bonus?.topScorerTeamId ?? defaultScorerTeamId);
  const [bonusScorerPlayerId, setBonusScorerPlayerId] = useState<number | null>(targetUser?.bonus?.topScorerPlayerId ?? defaultScorerPlayerId);
  const bonusRunnerUpTeams = useMemo(
    () => data.teams.filter((team) => team.id !== bonusChampionId),
    [data.teams, bonusChampionId]
  );
  const bonusScorerPlayers = useMemo(
    () => data.squadPlayers.filter((player) => player.teamId === bonusScorerTeamId),
    [data.squadPlayers, bonusScorerTeamId]
  );

  useEffect(() => {
    if (!targetUserId && users[0]) setTargetUserId(users[0].id);
  }, [targetUserId, users]);

  useEffect(() => {
    setHome(match?.homeScore ?? 0);
    setAway(match?.awayScore ?? 0);
  }, [matchId, match?.homeScore, match?.awayScore]);

  useEffect(() => {
    setUserHome(targetPrediction?.homeScore ?? 0);
    setUserAway(targetPrediction?.awayScore ?? 0);
  }, [targetUserId, matchId, targetPrediction?.homeScore, targetPrediction?.awayScore]);

  useEffect(() => {
    const bonus = targetUser?.bonus;
    const championId = bonus?.championTeamId ?? defaultChampionId;
    const runnerUpId = bonus?.runnerUpTeamId ?? firstDifferentTeam(data.teams, championId)?.id ?? defaultRunnerUpId;
    const scorerTeamId = bonus?.topScorerTeamId ?? defaultScorerTeamId;
    const scorerPlayerId = bonus?.topScorerPlayerId ?? firstPlayerForTeam(data.squadPlayers, scorerTeamId)?.apiPlayerId ?? defaultScorerPlayerId;
    setBonusChampionId(championId);
    setBonusRunnerUpId(runnerUpId);
    setBonusScorerTeamId(scorerTeamId);
    setBonusScorerPlayerId(scorerPlayerId);
  }, [targetUserId, targetUser?.bonus, data.teams, data.squadPlayers, defaultChampionId, defaultRunnerUpId, defaultScorerTeamId, defaultScorerPlayerId]);

  async function handleSquadSync() {
    setAdminMessage(null);
    try {
      const result = await syncSquads();
      setAdminMessage(`${result.message} Requests usados: ${result.requestsUsed}.`);
      await onRefresh();
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "No se pudieron cargar convocatorias.");
    }
  }

  async function handleResultSync() {
    setAdminMessage(null);
    try {
      const result = await syncResults();
      setAdminMessage(`${result.message} Requests usados: ${result.requestsUsed}.`);
      await onRefresh();
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "No se pudieron sincronizar resultados.");
    }
  }

  async function saveResult() {
    if (!match) return;
    try {
      await setMatchResult(match.id, home, away);
      onNotice("Resultado actualizado.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  }

  async function toggleDouble() {
    if (!match) return;
    try {
      await setDoublePoints(match.id, !match.isDoublePoints);
      onNotice("Puntos dobles actualizados.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  }

  async function handlePasswordReset() {
    if (!targetUserId) {
      onNotice("Selecciona un usuario.");
      return;
    }
    if (newPassword.length < 6) {
      onNotice("La contraseña nueva debe tener al menos 6 caracteres.");
      return;
    }
    try {
      await resetUserPassword(targetUserId, newPassword);
      setNewPassword("");
      onNotice("Contraseña reseteada. El usuario tendrá que iniciar sesión otra vez.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo resetear.");
    }
  }

  async function handleDeleteUser() {
    if (!targetUser) {
      onNotice("Selecciona un usuario.");
      return;
    }

    const confirmed = window.confirm(`¿Eliminar a ${targetUser.displayName} (${targetUser.username})? Se borrarán sus pronósticos, bonus y sesiones.`);
    if (!confirmed) return;

    try {
      await deleteUser(targetUser.id);
      onNotice("Usuario eliminado.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo eliminar el usuario.");
    }
  }

  async function handleUserPrediction() {
    if (!targetUserId || !match) {
      onNotice("Selecciona usuario y partido.");
      return;
    }
    try {
      await setUserPrediction(targetUserId, match.id, userHome, userAway);
      onNotice("Pronóstico de usuario actualizado.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo actualizar el pronóstico.");
    }
  }

  async function handleUserBonus() {
    if (!targetUserId) {
      onNotice("Selecciona un usuario.");
      return;
    }
    if (bonusChampionId && bonusChampionId === bonusRunnerUpId) {
      onNotice("Campeón y subcampeón no pueden ser la misma selección.");
      return;
    }
    if (!bonusScorerTeamId || !bonusScorerPlayerId) {
      onNotice("Selecciona la selección y el jugador del máximo goleador.");
      return;
    }
    try {
      await setUserBonus(targetUserId, {
        championTeamId: bonusChampionId,
        runnerUpTeamId: bonusRunnerUpId,
        topScorerTeamId: bonusScorerTeamId,
        topScorerPlayerId: bonusScorerPlayerId
      });
      onNotice("Bonus del usuario actualizado.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo actualizar el bonus.");
    }
  }

  return (
    <div className="card admin-card">
      <div className="section-title">
        <Shield size={18} />
        <span>Admin</span>
      </div>
      <p className="admin-note">
        El admin entra con usuario <strong>admin</strong> y contraseña <strong>Porra.44</strong>. No participa en la liga ni suma puntos.
      </p>
      <div className="admin-row two-actions">
        <button type="button" className="ghost-button" onClick={handleSquadSync}>Cargar convocatorias</button>
        <button type="button" className="ghost-button" onClick={handleResultSync}>Sincronizar resultados</button>
      </div>
      {adminMessage ? <button className="admin-message" type="button" onClick={() => setAdminMessage(null)}>{adminMessage}</button> : null}
      <section className="admin-section">
        <div className="admin-section-head">
          <strong>Editar partidos</strong>
          {match?.isDoublePoints ? <span className="double-chip">x2 activo</span> : null}
        </div>
        <select value={matchId} onChange={(event) => setMatchId(event.target.value)}>
          {data.matches.map((item) => (
            <option key={item.id} value={item.id}>
              {formatDate(item.kickoffAt)} {formatTime(item.kickoffAt)} · {item.homeTeam.name} vs {item.awayTeam.name}
            </option>
          ))}
        </select>
        <small className="admin-subtitle">Resultado real del partido</small>
        <div className="admin-score">
          <input type="number" min={0} value={home} onChange={(event) => setHome(Number(event.target.value))} />
          <span>-</span>
          <input type="number" min={0} value={away} onChange={(event) => setAway(Number(event.target.value))} />
        </div>
        <div className="card-actions">
          <button type="button" className="ghost-button" onClick={toggleDouble}>
            {match?.isDoublePoints ? "Quitar x2" : "Marcar x2"}
          </button>
          <button type="button" className="save-button" onClick={saveResult}>Finalizar</button>
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <strong>Editar participante</strong>
        </div>
        <label className="select-label">
          <span>Participante</span>
          <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
            {users.length === 0 ? <option value="">Sin participantes</option> : null}
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName} ({item.username})
              </option>
            ))}
          </select>
        </label>
        {targetUser ? (
          <small className="admin-user-login">
            Usuario login: <strong>{targetUser.username}</strong>
          </small>
        ) : null}
        <div className="admin-row">
          <input
            placeholder="Nueva contraseña"
            type="text"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <button type="button" className="ghost-button" onClick={handlePasswordReset}>Resetear</button>
        </div>
        <button type="button" className="danger-button wide" disabled={!targetUser} onClick={handleDeleteUser}>Eliminar usuario</button>
        <small className="admin-subtitle">Pronóstico del participante</small>
        <div className="admin-score">
          <input type="number" min={0} value={userHome} onChange={(event) => setUserHome(Number(event.target.value))} />
          <span>-</span>
          <input type="number" min={0} value={userAway} onChange={(event) => setUserAway(Number(event.target.value))} />
        </div>
        <button type="button" className="save-button wide" onClick={handleUserPrediction}>Guardar pronóstico</button>
        <hr />
        <small className="admin-subtitle">Bonus del participante</small>
        <SelectTeam
          label="Campeón"
          teams={data.teams}
          value={bonusChampionId}
          onChange={(value) => {
            setBonusChampionId(value);
            setBonusRunnerUpId((current) => (current === value ? firstDifferentTeam(data.teams, value)?.id ?? null : current));
          }}
        />
        <SelectTeam label="Subcampeón" teams={bonusRunnerUpTeams} value={bonusRunnerUpId} onChange={setBonusRunnerUpId} />
        <SelectTeam
          label="Selección del máximo goleador"
          teams={data.teams}
          value={bonusScorerTeamId}
          onChange={(value) => {
            const player = firstPlayerForTeam(data.squadPlayers, value);
            setBonusScorerTeamId(value);
            setBonusScorerPlayerId(player?.apiPlayerId ?? null);
          }}
        />
        <SelectPlayer
          label="Máximo goleador"
          players={bonusScorerPlayers}
          value={bonusScorerPlayerId}
          onChange={setBonusScorerPlayerId}
        />
        <button type="button" className="save-button wide" onClick={handleUserBonus}>Guardar bonus</button>
      </section>
    </div>
  );
}

function AuthScreen({ onDone }: { data: BootstrapData; onDone: () => Promise<void> }) {
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: ""
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      await login(form.username, form.password);
      await onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo continuar.");
    }
  }

  return (
    <main className="app-shell auth-shell">
      <div className="stadium-bg" />
      <div className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-mark"><Trophy size={34} /></div>
          <div>
            <h1>Porra</h1>
            <strong>Fortilin</strong>
          </div>
        </div>
        <form onSubmit={submit} className="auth-form">
          <input placeholder="Usuario" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          <input placeholder="Contraseña" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          {message ? <p className="form-error">{message}</p> : null}
          <button className="save-button wide" type="submit">Entrar</button>
        </form>
      </div>
    </main>
  );
}

function SelectTeam({ label, teams, value, onChange }: { label: string; teams: Team[]; value: string | null; onChange: (value: string) => void }) {
  return (
    <label className="select-label">
      <span>{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>{team.name}</option>
        ))}
      </select>
    </label>
  );
}

function SelectPlayer({
  label,
  players,
  value,
  onChange
}: {
  label: string;
  players: SquadPlayer[];
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="select-label">
      <span>{label}</span>
      <select value={value ?? ""} disabled={players.length === 0} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
        {players.length === 0 ? <option value="">Sin jugadores cargados</option> : null}
        {players.map((player) => (
          <option key={player.apiPlayerId} value={player.apiPlayerId}>
            {player.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function LeaderboardCard({
  rows,
  onOpen,
  onSelect
}: {
  rows: BootstrapData["leaderboard"];
  onOpen: () => void;
  onSelect: (userId: string) => void;
}) {
  return (
    <section className="card mini-card">
      <div className="section-title">
        <Medal size={18} />
        <span>Clasificación</span>
        <button type="button" onClick={onOpen}>Ver todo</button>
      </div>
      <LeaderboardRows rows={rows} compact onSelect={onSelect} />
    </section>
  );
}

function LeaderboardRows({
  rows,
  compact = false,
  onSelect
}: {
  rows: BootstrapData["leaderboard"];
  compact?: boolean;
  onSelect?: (userId: string) => void;
}) {
  return (
    <div className={`leaderboard ${compact ? "compact-board" : ""}`}>
      <div className="board-head"><span>Pos.</span><span /> <span>Jugador</span><span>Pts</span></div>
      {rows.length === 0 ? <p className="empty-state">Aún no hay participantes.</p> : null}
      {rows.map((row) => (
        <button className="board-row board-button" type="button" key={row.userId} onClick={() => onSelect?.(row.userId)}>
          <span className={`rank rank-${row.rank}`}>{row.rank}</span>
          <UserAvatar name={row.displayName} avatarUrl={row.avatarUrl} small />
          <strong>{row.displayName}</strong>
          <b>{row.points}</b>
        </button>
      ))}
    </div>
  );
}

function TodayCard({ matches, onOpen }: { matches: Match[]; onOpen: () => void }) {
  return (
    <section className="card mini-card">
      <div className="section-title">
        <CalendarDays size={18} />
        <span>Próximos partidos</span>
      </div>
      <div className="today-list">
        {matches.map((match) => (
          <div className="today-row" key={match.id}>
            <TeamBadge team={match.homeTeam} />
            <span>{shortTeam(match.homeTeam.name)}</span>
            <small>vs</small>
            <span>{shortTeam(match.awayTeam.name)}</span>
            <TeamBadge team={match.awayTeam} />
            <em>{matchSummary(match)} · {formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)}</em>
            {match.isDoublePoints ? <b className="x2-mini">x2</b> : null}
          </div>
        ))}
      </div>
      <button className="link-button" type="button" onClick={onOpen}>Ver todos los partidos</button>
    </section>
  );
}

function BonusLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bonus-line">
      <span>{label}</span>
      <strong>{value || "Sin elegir"}</strong>
    </div>
  );
}

function TeamInline({ team, align = "left" }: { team: Team; align?: "left" | "right" }) {
  return (
    <div className={`team-inline ${align}`}>
      {align === "left" ? <TeamBadge team={team} /> : null}
      <strong>{shortTeam(team.name)}</strong>
      {align === "right" ? <TeamBadge team={team} /> : null}
    </div>
  );
}

function TeamBadge({ team, large = false }: { team: Team; large?: boolean }) {
  return (
    <span className={`team-badge ${large ? "large" : ""}`} title={team.name}>
      {team.logoUrl ? <img src={team.logoUrl} alt="" /> : <b>{team.shortCode.slice(0, 3)}</b>}
    </span>
  );
}

function UserAvatar({ name, avatarUrl, small = false }: { name: string; avatarUrl?: string | null; small?: boolean }) {
  return (
    <span className={`user-avatar ${small ? "small" : ""}`}>
      {avatarUrl ? <img src={avatarUrl} alt="" /> : <b>{initials(name || "PF")}</b>}
    </span>
  );
}

function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ tab: Tab; label: string; icon: React.ReactNode }> = [
    { tab: "home", label: "Inicio", icon: <Home size={22} /> },
    { tab: "matches", label: "Partidos", icon: <Trophy size={22} /> },
    { tab: "leaderboard", label: "Clasif.", icon: <Medal size={22} /> },
    { tab: "world", label: "Mundial", icon: <Table2 size={22} /> },
    { tab: "bonus", label: "Bonus", icon: <Gift size={22} /> },
    { tab: "profile", label: "Perfil", icon: <User size={22} /> }
  ];
  return (
    <nav className="bottom-nav" aria-label="Navegacion principal">
      {items.map((item) => (
        <button key={item.tab} type="button" className={active === item.tab ? "active" : ""} onClick={() => onChange(item.tab)}>
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "Europe/Madrid" }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(value));
}

function sortMatchesByKickoff<T extends { kickoffAt: string }>(matches: T[]): T[] {
  return [...matches].sort((left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime());
}

function findCurrentMatch<T extends Match>(matches: T[], now = new Date()): T | null {
  const nowMs = now.getTime();
  const currentWindowMs = 3 * 60 * 60 * 1000;
  return (
    matches.find((match) => {
      const kickoffMs = new Date(match.kickoffAt).getTime();
      return (
        match.status === "live" ||
        (match.status !== "finished" && kickoffMs <= nowMs && nowMs - kickoffMs <= currentWindowMs)
      );
    }) ?? null
  );
}

function getRelevantMatches<T extends Match>(matches: T[], now = new Date()): T[] {
  const sorted = sortMatchesByKickoff(matches);
  const current = findCurrentMatch(sorted, now);
  const nowMs = now.getTime();
  const upcoming = sorted.filter((match) => match.status !== "finished" && new Date(match.kickoffAt).getTime() >= nowMs);
  if (!current) return upcoming;
  return [current, ...upcoming.filter((match) => match.id !== current.id)];
}

function getMissingUpcomingPredictions(matches: Match[], now = new Date()): Match[] {
  const nowMs = now.getTime();
  const limitMs = nowMs + 24 * 60 * 60 * 1000;
  return sortMatchesByKickoff(matches).filter((match) => {
    const kickoffMs = new Date(match.kickoffAt).getTime();
    return match.status !== "finished" && kickoffMs >= nowMs && kickoffMs <= limitMs && !getMyPrediction(match);
  });
}

function buildMatchFilters(matches: Match[]): Array<{ value: MatchFilter; label: string }> {
  const matchdays = Array.from(
    new Set(
      matches
        .filter((match) => match.stage === "GROUP" && typeof match.matchday === "number")
        .map((match) => match.matchday as number)
    )
  ).sort((left, right) => left - right);
  const hasKnockouts = matches.some((match) => match.stage !== "GROUP");

  return [
    { value: "all", label: "Todos" },
    ...matchdays.map((matchday) => ({ value: `matchday-${matchday}` as const, label: `J${matchday}` })),
    ...(hasKnockouts ? [{ value: "knockout" as const, label: "Elim." }] : [])
  ];
}

function filterMatches<T extends Match>(matches: T[], filter: MatchFilter): T[] {
  if (filter === "all") return matches;
  if (filter === "knockout") return matches.filter((match) => match.stage !== "GROUP");

  const matchday = Number(filter.replace("matchday-", ""));
  return matches.filter((match) => match.stage === "GROUP" && match.matchday === matchday);
}

function getLastFinishedMatch<T extends Match>(matches: T[]): T | null {
  return [...matches].reverse().find((match) => match.status === "finished") ?? null;
}

function matchCardDomId(matchId: string): string {
  return `match-card-${matchId}`;
}

function matchCardSubtitle(match: Match): string {
  const context = match.stage === "GROUP" ? `Grupo ${match.groupName}` : matchNumberLabel(match);
  return [match.round, context, formatDate(match.kickoffAt), formatTime(match.kickoffAt)].filter(Boolean).join(" · ");
}

function matchNumberLabel(match: Match): string {
  const number = match.id.match(/\d+$/)?.[0];
  return number ? `M${Number(number)}` : match.round;
}

function isGroupStageComplete(matches: Match[]): boolean {
  const groupMatches = matches.filter((match) => match.stage === "GROUP");
  return groupMatches.length > 0 && groupMatches.every((match) => match.status === "finished");
}

function getKnockoutRoundGroups(matches: Match[]): KnockoutRoundGroup[] {
  const byStage = new Map<MatchStage, Match[]>();
  for (const match of matches.filter((item) => item.stage !== "GROUP")) {
    const roundMatches = byStage.get(match.stage) ?? [];
    roundMatches.push(match);
    byStage.set(match.stage, roundMatches);
  }

  return knockoutStageOrder
    .map((stage) => {
      const roundMatches = byStage.get(stage) ?? [];
      return {
        stage,
        label: knockoutStageLabels[stage],
        matches: sortMatchesByKickoff(roundMatches)
      };
    })
    .filter((round) => round.matches.length > 0);
}

function getWinnerTeam(match: Match): Team | null {
  const winnerId = getWinnerTeamId(match);
  if (!winnerId) return null;
  if (winnerId === match.homeTeam.id) return match.homeTeam;
  if (winnerId === match.awayTeam.id) return match.awayTeam;
  return null;
}

function getWinnerTeamId(match: Match): string | null {
  const winnerSide = getWinnerSide(match);
  if (!winnerSide) return null;
  return winnerSide === "home" ? match.homeTeam.id : match.awayTeam.id;
}

function getWinnerSide(match: Match): "home" | "away" | null {
  const regularSide = scoreWinnerSide(match.homeScore, match.awayScore);
  if (regularSide) return regularSide;

  const extraSide = scoreWinnerSide(match.extraHomeScore, match.extraAwayScore);
  if (extraSide) return extraSide;

  return scoreWinnerSide(match.penaltyHomeScore, match.penaltyAwayScore);
}

function scoreWinnerSide(home: number | null | undefined, away: number | null | undefined): "home" | "away" | null {
  if (home === null || home === undefined || away === null || away === undefined) return null;
  if (home > away) return "home";
  if (away > home) return "away";
  return null;
}

function hasScore(home: number | null | undefined, away: number | null | undefined): boolean {
  return home !== null && home !== undefined && away !== null && away !== undefined;
}

const knockoutStageOrder: MatchStage[] = ["ROUND_OF_32", "ROUND_OF_16", "QUARTER_FINAL", "SEMI_FINAL", "THIRD_PLACE", "FINAL"];

const knockoutStageLabels: Record<MatchStage, string> = {
  GROUP: "Grupos",
  ROUND_OF_32: "Dieciseisavos",
  ROUND_OF_16: "Octavos",
  QUARTER_FINAL: "Cuartos",
  SEMI_FINAL: "Semifinales",
  THIRD_PLACE: "Tercer puesto",
  FINAL: "Final"
};

function getMyPrediction(match: Match): MyPrediction | null {
  return (match as Match & { myPrediction?: MyPrediction | null }).myPrediction ?? null;
}

function getOwnPostMatchPhrase(match: Match, prediction: MyPrediction | null, userId: string): string | null {
  if (!prediction || match.status !== "finished") return null;
  const outcome = prediction.outcome as PredictionOutcome;
  return getPostMatchPhrase(outcome, `${userId}:${match.id}:${outcome}`);
}

function getVisibleMatchScore(match: Match): { home: number; away: number } | null {
  const latestGoalScore = getLatestGoalScore(match);
  if (match.status === "live" && latestGoalScore) return latestGoalScore;
  if (match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined) {
    return { home: match.homeScore, away: match.awayScore };
  }
  return latestGoalScore;
}

function getLatestGoalScore(match: Match): { home: number; away: number } | null {
  const goals = match.goals || [];
  const lastGoal = goals[goals.length - 1];
  return lastGoal ? { home: lastGoal.homeScore, away: lastGoal.awayScore } : null;
}

function matchStatusLabel(match: Match): string {
  if (match.status === "live") return "En curso";
  if (match.status === "finished") return "Finalizado";
  if (isPredictionLocked(match.kickoffAt)) return "Bloqueado";
  return "Próximo partido";
}

function matchSummary(match: Match): string {
  const visibleScore = getVisibleMatchScore(match);
  const score = visibleScore ? `${visibleScore.home}-${visibleScore.away}` : null;
  const status = match.status === "live" || match.status === "finished" ? matchStatusLabel(match) : null;
  const double = match.isDoublePoints ? "x2" : null;
  return [status, score, double].filter(Boolean).join(" · ") || "Programado";
}

function formatGoal(goal: Match["goals"][number]): string {
  return [goal.scorerName || "Gol", goal.isPenalty ? "(p)" : goal.isOwnGoal ? "(pp)" : ""].filter(Boolean).join(" ");
}

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function groupWorldStandings(rows: BootstrapData["worldStandings"]): Array<{ name: string; rows: BootstrapData["worldStandings"] }> {
  const groups = new Map<string, BootstrapData["worldStandings"]>();
  for (const row of rows) {
    const groupRows = groups.get(row.groupName) ?? [];
    groupRows.push(row);
    groups.set(row.groupName, groupRows);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => sortGroupName(left, right))
    .map(([name, groupRows]) => ({
      name,
      rows: [...groupRows].sort((left, right) => left.rank - right.rank)
    }));
}

function getBestThirdPlaceKeys(rows: BootstrapData["worldStandings"]): Set<string> {
  const bestThirds = rows
    .filter((row) => row.rank === 3)
    .sort(
      (left, right) =>
        right.points - left.points ||
        right.goalDiff - left.goalDiff ||
        right.goalsFor - left.goalsFor ||
        left.teamName.localeCompare(right.teamName, "es")
    )
    .slice(0, 8);

  return new Set(bestThirds.map(worldStandingKey));
}

function worldQualificationStatus(row: BootstrapData["worldStandings"][number], bestThirdKeys: Set<string>): "qualified-direct" | "qualified-third" | "not-qualified" {
  if (row.rank <= 2) return "qualified-direct";
  if (row.rank === 3 && bestThirdKeys.has(worldStandingKey(row))) return "qualified-third";
  return "not-qualified";
}

function worldStandingKey(row: BootstrapData["worldStandings"][number]): string {
  return row.teamId ?? `${row.groupName}-${row.teamName}`;
}

function sortGroupName(left: string, right: string): number {
  const leftLetter = left.match(/[A-Z]$/i)?.[0] ?? left;
  const rightLetter = right.match(/[A-Z]$/i)?.[0] ?? right;
  return leftLetter.localeCompare(rightLetter, "es", { numeric: true });
}

function getTopScorers(matches: Match[], squadPlayers: SquadPlayer[] = []): ScorerRow[] {
  const scorers = new Map<string, ScorerRow>();

  for (const match of matches) {
    let previousHome = 0;
    let previousAway = 0;
    for (const goal of match.goals || []) {
      if (!goal.scorerName || goal.isOwnGoal) {
        previousHome = goal.homeScore;
        previousAway = goal.awayScore;
        continue;
      }

      const teamId = goal.homeScore > previousHome ? match.homeTeam.id : goal.awayScore > previousAway ? match.awayTeam.id : null;
      const teamName = goal.homeScore > previousHome ? match.homeTeam.name : goal.awayScore > previousAway ? match.awayTeam.name : "";
      const player = canonicalScorerName(goal.scorerName, teamId, squadPlayers);
      const key = `${player}|${teamName}`;
      const current = scorers.get(key) ?? { player, teamName, goals: 0 };
      current.goals += 1;
      scorers.set(key, current);
      previousHome = goal.homeScore;
      previousAway = goal.awayScore;
    }
  }

  return [...scorers.values()].sort((left, right) => right.goals - left.goals || left.player.localeCompare(right.player)).slice(0, 20);
}

function canonicalScorerName(name: string, teamId: string | null, squadPlayers: SquadPlayer[]): string {
  if (!teamId) return name;
  const candidates = squadPlayers.filter((player) => player.teamId === teamId);
  return findPersonNameMatch(name, candidates.map((player) => player.name)) ?? name;
}

function findPersonNameMatch(name: string, candidates: string[]): string | null {
  const normalizedName = normalizePersonName(name);
  if (!normalizedName) return null;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizePersonName(candidate);
    if (normalizedCandidate === normalizedName) return candidate;
    if (normalizedCandidate.includes(normalizedName) || normalizedName.includes(normalizedCandidate)) return candidate;
  }

  const nameTokens = normalizedName.split(" ").filter(Boolean);
  const lastName = nameTokens[nameTokens.length - 1];
  const firstInitial = nameTokens[0]?.[0];
  const tokenSet = new Set(nameTokens);

  for (const candidate of candidates) {
    const candidateTokens = normalizePersonName(candidate).split(" ").filter(Boolean);
    if (nameTokens.length >= 2 && candidateTokens.includes(lastName) && candidateTokens.some((token) => token[0] === firstInitial)) {
      return candidate;
    }
    if (nameTokens.length >= 2 && nameTokens.every((token) => candidateTokens.includes(token))) {
      return candidate;
    }
    if (candidateTokens.length >= 2 && candidateTokens.every((token) => tokenSet.has(token))) {
      return candidate;
    }
  }

  return null;
}

function normalizePersonName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function shortTeam(name: string): string {
  if (name.length <= 13) return name;
  return `${name.slice(0, 12)}.`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(20, score));
}

async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona una imagen.");
  }
  if (file.size > 6 * 1024 * 1024) {
    throw new Error("La imagen no puede superar 6 MB.");
  }

  const image = await loadImage(file);
  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo procesar la imagen.");

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    image.src = url;
  });
}

function firstDifferentTeam(teams: Team[], excludedId: string | null): Team | null {
  return teams.find((team) => team.id !== excludedId) ?? null;
}

function firstTeamWithPlayers(teams: Team[], players: SquadPlayer[]): Team | null {
  const teamIdsWithPlayers = new Set(players.map((player) => player.teamId));
  return teams.find((team) => teamIdsWithPlayers.has(team.id)) ?? null;
}

function firstPlayerForTeam(players: SquadPlayer[], teamId: string | null): SquadPlayer | null {
  if (!teamId) return null;
  return players.find((player) => player.teamId === teamId) ?? null;
}
