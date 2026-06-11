import {
  CalendarDays,
  Gift,
  Home,
  ListChecks,
  Lock,
  LogOut,
  Medal,
  Save,
  Shield,
  Trophy,
  User
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  clearDemoSession,
  fetchBootstrap,
  login,
  logout,
  register,
  resetUserPassword,
  savePrediction,
  setDoublePoints,
  setDemoSession,
  setMatchResult,
  setUserPrediction,
  syncResults,
  syncSquads,
  type BootstrapData
} from "./client/api";
import { isPredictionLocked } from "./domain/scoring";
import type { Match, SquadPlayer, Team } from "./shared/types";

type Tab = "home" | "matches" | "leaderboard" | "bonus" | "profile";

type ScoreDraft = Record<string, { home: number; away: number }>;

type ScorerRow = {
  player: string;
  teamName: string;
  goals: number;
};

export function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [scores, setScores] = useState<ScoreDraft>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!data) return;
    setScores((current) => {
      const next = { ...current };
      for (const match of data.matches) {
        if (!next[match.id]) {
          next[match.id] = {
            home: match.myPrediction?.homeScore ?? 0,
            away: match.myPrediction?.awayScore ?? 0
          };
        }
      }
      return next;
    });
  }, [data]);

  async function refresh() {
    setLoading(true);
    const bootstrap = await fetchBootstrap();
    setData(bootstrap);
    setLoading(false);
  }

  async function handleSave(match: Match) {
    const draft = scores[match.id] ?? { home: 0, away: 0 };
    if (data?.isDemo) {
      updateLocalPrediction(match.id, draft.home, draft.away);
      setNotice("Pronóstico guardado en modo demo.");
      return;
    }

    try {
      await savePrediction(match.id, draft.home, draft.away);
      await refresh();
      setNotice("Pronóstico guardado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar.");
    }
  }

  function updateLocalPrediction(matchId: string, home: number, away: number) {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        matches: current.matches.map((match) =>
          match.id === matchId
            ? {
                ...match,
                myPrediction: {
                  id: match.myPrediction?.id ?? `local-${matchId}`,
                  homeScore: home,
                  awayScore: away,
                  points: match.myPrediction?.points ?? 0,
                  outcome: match.myPrediction?.outcome ?? "pending"
                }
              }
            : match
        )
      };
    });
  }

  if (loading || !data) {
    return (
      <main className="app-shell loading-shell">
        <div className="loader-card">
          <Trophy size={34} />
          <p>Cargando Porra Fortilin...</p>
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
    <main className="app-shell">
      <div className="stadium-bg" />
      <div className="content">
        <Header data={appData} />
        {notice ? <button className="notice" type="button" onClick={() => setNotice(null)}>{notice}</button> : null}

        {tab === "home" ? (
          <HomeView
            data={appData}
            nextMatch={nextMatch}
            editableMatch={currentMatch ?? editableNext}
            scores={scores}
            setScores={setScores}
            onSave={handleSave}
            onOpenMatches={() => setTab("matches")}
            onOpenLeaderboard={() => setTab("leaderboard")}
          />
        ) : null}
        {tab === "matches" ? (
          <MatchesView data={appData} scores={scores} setScores={setScores} onSave={handleSave} />
        ) : null}
        {tab === "leaderboard" ? <LeaderboardView data={appData} /> : null}
        {tab === "bonus" ? <BonusView data={appData} /> : null}
        {tab === "profile" ? <ProfileView data={appData} onRefresh={refresh} onNotice={setNotice} /> : null}
      </div>
      <BottomNav active={tab} onChange={setTab} />
    </main>
  );
}

function Header({ data }: { data: BootstrapData }) {
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
      <div className="profile-dot" title={data.user?.displayName}>
        <span>{initials(data.user?.displayName || "PF")}</span>
        <i />
      </div>
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
  onOpenMatches,
  onOpenLeaderboard
}: {
  data: BootstrapData;
  nextMatch: Match | null;
  editableMatch: Match | null;
  scores: ScoreDraft;
  setScores: (setter: (current: ScoreDraft) => ScoreDraft) => void;
  onSave: (match: Match) => void;
  onOpenMatches: () => void;
  onOpenLeaderboard: () => void;
}) {
  const todayMatches = useMemo(() => getRelevantMatches(data.matches).slice(0, 4), [data.matches]);

  return (
    <>
      {nextMatch ? <NextMatchHero match={nextMatch} /> : null}
      {editableMatch ? (
        <PredictionCard match={editableMatch} scores={scores} setScores={setScores} onSave={onSave} featured />
      ) : null}
      <section className="two-column">
        <LeaderboardCard rows={data.leaderboard.slice(0, 5)} onOpen={onOpenLeaderboard} />
        <TodayCard matches={todayMatches} onOpen={onOpenMatches} />
      </section>
      <BonusBanner data={data} />
    </>
  );
}

function NextMatchHero({ match }: { match: Match }) {
  return (
    <section className="next-hero">
      <div className={`hero-pill ${match.status === "live" ? "live" : ""}`}>{matchStatusLabel(match)}</div>
      <div className="hero-teams">
        <TeamBadge team={match.homeTeam} large />
        <div className="hero-names">
          <strong>{match.homeTeam.name}</strong>
          <span>vs</span>
          <strong>{match.awayTeam.name}</strong>
        </div>
        <TeamBadge team={match.awayTeam} large />
      </div>
      {hasScore(match) ? <div className="hero-score">{match.homeScore} - {match.awayScore}</div> : null}
      <MatchGoals match={match} compact />
      <div className="hero-meta">
        <span><CalendarDays size={15} /> {formatDate(match.kickoffAt)}</span>
        <span>{formatTime(match.kickoffAt)} Madrid</span>
      </div>
      <a className="hero-cta" href="#pronostico">Haz tu pronóstico</a>
    </section>
  );
}

function PredictionCard({
  match,
  scores,
  setScores,
  onSave,
  featured = false
}: {
  match: Match;
  scores: ScoreDraft;
  setScores: (setter: (current: ScoreDraft) => ScoreDraft) => void;
  onSave: (match: Match) => void;
  featured?: boolean;
}) {
  const locked = isPredictionLocked(match.kickoffAt) || match.status === "finished";
  const draft = scores[match.id] ?? { home: 0, away: 0 };

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
    <section className={`card prediction-card ${featured ? "featured" : ""}`} id={featured ? "pronostico" : undefined}>
      <div className="section-title">
        <ListChecks size={18} />
        <span>Haz tu pronóstico</span>
        {locked ? <em><Lock size={13} /> Bloqueado</em> : <em>Bloqueo 2h antes</em>}
      </div>
      <p className="muted compact">
        {match.round} · Grupo {match.groupName} · {formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)}
      </p>
      <div className="score-row">
        <TeamInline team={match.homeTeam} />
        <ScoreStepper value={draft.home} disabled={locked} onDec={() => change("home", -1)} onInc={() => change("home", 1)} />
        <span className="score-separator">-</span>
        <ScoreStepper value={draft.away} disabled={locked} onDec={() => change("away", -1)} onInc={() => change("away", 1)} />
        <TeamInline team={match.awayTeam} align="right" />
      </div>
      {hasScore(match) ? (
        <p className="live-score-line">{matchStatusLabel(match)} · Resultado actual: {match.homeScore} - {match.awayScore}</p>
      ) : null}
      <MatchGoals match={match} />
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

  return (
    <div className={`goal-list ${compact ? "compact-goals" : ""}`}>
      {match.goals.map((goal, index) => (
        <span key={`${match.id}-goal-${index}`}>
          {goal.minute ? `${goal.minute}' ` : ""}
          {formatGoal(goal)} · {goal.homeScore}-{goal.awayScore}
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
  onSave
}: {
  data: BootstrapData;
  scores: ScoreDraft;
  setScores: (setter: (current: ScoreDraft) => ScoreDraft) => void;
  onSave: (match: Match) => void;
}) {
  const [matchday, setMatchday] = useState<number | "all">("all");
  const matches = matchday === "all" ? data.matches : data.matches.filter((match) => match.matchday === matchday);

  return (
    <section className="view-stack">
      <div className="view-header">
        <h2>Partidos</h2>
        <p>Lista compacta para pronosticar rápido.</p>
      </div>
      <div className="segmented">
        {(["all", 1, 2, 3] as const).map((item) => (
          <button key={item} type="button" className={matchday === item ? "active" : ""} onClick={() => setMatchday(item)}>
            {item === "all" ? "Todos" : `J${item}`}
          </button>
        ))}
      </div>
      {matches.map((match) => (
        <PredictionCard key={match.id} match={match} scores={scores} setScores={setScores} onSave={onSave} />
      ))}
    </section>
  );
}

function LeaderboardView({ data }: { data: BootstrapData }) {
  return (
    <section className="card full-card">
      <div className="section-title">
        <Medal size={18} />
        <span>Clasificación</span>
      </div>
      <LeaderboardRows rows={data.leaderboard} />
    </section>
  );
}

function BonusView({ data }: { data: BootstrapData }) {
  const teamById = new Map(data.teams.map((team) => [team.id, team]));
  const bonus = data.bonus;
  const scorerTeam = bonus?.topScorerTeamId ? teamById.get(bonus.topScorerTeamId)?.name : null;
  const scorers = getTopScorers(data.matches);
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
        <strong>Reglas rapidas</strong>
        <span>Exacto 3 pts · Tendencia 1 pt · Grupo de España x2</span>
        <span>Campeón +10 · Subcampeón +5 · Goleador +5</span>
      </div>
    </section>
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
  async function handleLogout() {
    if (data.isDemo) clearDemoSession();
    else await logout();
    await onRefresh();
  }

  return (
    <section className="view-stack">
      <div className="card profile-card">
        <div className="profile-avatar">{initials(data.user?.displayName || "PF")}</div>
        <div>
          <h2>{data.user?.displayName}</h2>
          <p>{data.user?.isAdmin ? "Administrador" : `Liga ${data.league.name}`}</p>
        </div>
        <button type="button" className="ghost-button" onClick={handleLogout}>
          <LogOut size={16} /> Salir
        </button>
      </div>
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
  const [userHome, setUserHome] = useState(0);
  const [userAway, setUserAway] = useState(0);
  const match = data.matches.find((candidate) => candidate.id === matchId);

  async function handleSquadSync() {
    try {
      if (data.isDemo) {
        onNotice("Modo demo sin D1: aplica migraciones en Cloudflare para cargar convocatorias reales.");
      } else {
        const result = await syncSquads();
        onNotice(`${result.message} Requests usados: ${result.requestsUsed}.`);
      }
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudieron cargar convocatorias.");
    }
  }

  async function handleResultSync() {
    try {
      if (data.isDemo) {
        onNotice("Sincronización demo omitida.");
      } else {
        const result = await syncResults();
        onNotice(`${result.message} Requests usados: ${result.requestsUsed}.`);
      }
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudieron sincronizar resultados.");
    }
  }

  async function saveResult() {
    if (!match) return;
    try {
      if (!data.isDemo) await setMatchResult(match.id, home, away);
      onNotice("Resultado actualizado.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  }

  async function toggleDouble() {
    if (!match) return;
    try {
      if (!data.isDemo) await setDoublePoints(match.id, !match.isDoublePoints);
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
      if (!data.isDemo) await resetUserPassword(targetUserId, newPassword);
      setNewPassword("");
      onNotice("Contraseña reseteada. El usuario tendrá que iniciar sesión otra vez.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo resetear.");
    }
  }

  async function handleUserPrediction() {
    if (!targetUserId || !match) {
      onNotice("Selecciona usuario y partido.");
      return;
    }
    try {
      if (!data.isDemo) await setUserPrediction(targetUserId, match.id, userHome, userAway);
      onNotice("Pronóstico de usuario actualizado.");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo actualizar el pronóstico.");
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
      <div className="admin-row">
        <input
          placeholder="Nueva contraseña"
          type="text"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <button type="button" className="ghost-button" onClick={handlePasswordReset}>Resetear</button>
      </div>
      <hr />
      <select value={matchId} onChange={(event) => setMatchId(event.target.value)}>
        {data.matches.slice(0, 20).map((item) => (
          <option key={item.id} value={item.id}>
            {item.homeTeam.name} vs {item.awayTeam.name}
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
      <small className="admin-subtitle">Pronóstico del participante seleccionado</small>
      <div className="admin-score">
        <input type="number" min={0} value={userHome} onChange={(event) => setUserHome(Number(event.target.value))} />
        <span>-</span>
        <input type="number" min={0} value={userAway} onChange={(event) => setUserAway(Number(event.target.value))} />
      </div>
      <button type="button" className="save-button wide" onClick={handleUserPrediction}>Guardar pronóstico de usuario</button>
    </div>
  );
}

function AuthScreen({ data, onDone }: { data: BootstrapData; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [message, setMessage] = useState<string | null>(null);
  const initialChampionId = data.teams[0]?.id ?? null;
  const initialRunnerUpId = firstDifferentTeam(data.teams, initialChampionId)?.id ?? null;
  const initialScorerTeamId = firstTeamWithPlayers(data.teams, data.squadPlayers)?.id ?? data.teams[0]?.id ?? null;
  const initialScorerPlayerId = firstPlayerForTeam(data.squadPlayers, initialScorerTeamId)?.apiPlayerId ?? null;
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    championTeamId: initialChampionId,
    runnerUpTeamId: initialRunnerUpId,
    topScorerTeamId: initialScorerTeamId,
    topScorerPlayerId: initialScorerPlayerId
  });
  const runnerUpTeams = useMemo(
    () => data.teams.filter((team) => team.id !== form.championTeamId),
    [data.teams, form.championTeamId]
  );
  const scorerPlayers = useMemo(
    () => data.squadPlayers.filter((player) => player.teamId === form.topScorerTeamId),
    [data.squadPlayers, form.topScorerTeamId]
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (mode === "register" && form.championTeamId === form.runnerUpTeamId) {
      setMessage("Campeón y subcampeón no pueden ser la misma selección.");
      return;
    }
    if (mode === "register" && (!form.topScorerTeamId || !form.topScorerPlayerId)) {
      setMessage("Elige primero la selección del goleador y luego un jugador de la convocatoria.");
      return;
    }
    try {
      if (data.isDemo) {
        const isAdminLogin = mode === "login" && form.username.toLowerCase() === "admin" && form.password === "Porra.44";
        setDemoSession({
          username: form.username || (isAdminLogin ? "admin" : "demo"),
          displayName: isAdminLogin ? "Admin Fortilin" : form.displayName || form.username || "Usuario Fortilin",
          isAdmin: isAdminLogin
        });
      } else if (mode === "login") {
        await login(form.username, form.password);
      } else {
        await register({
          username: form.username,
          displayName: form.displayName || form.username,
          password: form.password,
          bonus: {
            championTeamId: form.championTeamId,
            runnerUpTeamId: form.runnerUpTeamId,
            topScorerTeamId: form.topScorerTeamId,
            topScorerPlayerId: form.topScorerPlayerId
          }
        });
      }
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
        <div className="segmented auth-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Entrar</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Crear</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          <input placeholder="Usuario" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          {mode === "register" ? (
            <>
              <input placeholder="Nombre visible" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
            </>
          ) : null}
          <input placeholder="Contraseña" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          {mode === "register" ? (
            <>
              <SelectTeam
                label="Campeón"
                teams={data.teams}
                value={form.championTeamId}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    championTeamId: value,
                    runnerUpTeamId: current.runnerUpTeamId === value ? firstDifferentTeam(data.teams, value)?.id ?? null : current.runnerUpTeamId
                  }))
                }
              />
              <SelectTeam label="Subcampeón" teams={runnerUpTeams} value={form.runnerUpTeamId} onChange={(value) => setForm({ ...form, runnerUpTeamId: value })} />
              <SelectTeam
                label="Selección del máximo goleador"
                teams={data.teams}
                value={form.topScorerTeamId}
                onChange={(value) => {
                  const player = firstPlayerForTeam(data.squadPlayers, value);
                  setForm({ ...form, topScorerTeamId: value, topScorerPlayerId: player?.apiPlayerId ?? null });
                }}
              />
              <SelectPlayer
                label="Máximo goleador"
                players={scorerPlayers}
                value={form.topScorerPlayerId}
                onChange={(value) => setForm({ ...form, topScorerPlayerId: value })}
              />
              {scorerPlayers.length === 0 ? (
                <p className="form-hint">Convocatoria pendiente de cargar por el admin.</p>
              ) : null}
            </>
          ) : null}
          {message ? <p className="form-error">{message}</p> : null}
          <button className="save-button wide" type="submit">{mode === "login" ? "Entrar" : "Crear usuario"}</button>
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

function LeaderboardCard({ rows, onOpen }: { rows: BootstrapData["leaderboard"]; onOpen: () => void }) {
  return (
    <section className="card mini-card">
      <div className="section-title">
        <Medal size={18} />
        <span>Clasificación</span>
        <button type="button" onClick={onOpen}>Ver todo</button>
      </div>
      <LeaderboardRows rows={rows} compact />
    </section>
  );
}

function LeaderboardRows({ rows, compact = false }: { rows: BootstrapData["leaderboard"]; compact?: boolean }) {
  return (
    <div className={`leaderboard ${compact ? "compact-board" : ""}`}>
      <div className="board-head"><span>Pos.</span><span>Jugador</span><span>Pts</span></div>
      {rows.length === 0 ? <p className="empty-state">Aún no hay participantes.</p> : null}
      {rows.map((row) => (
        <div className="board-row" key={row.userId}>
          <span className={`rank rank-${row.rank}`}>{row.rank}</span>
          <strong>{row.displayName}</strong>
          <b>{row.points}</b>
        </div>
      ))}
    </div>
  );
}

function TodayCard({ matches, onOpen }: { matches: Match[]; onOpen: () => void }) {
  return (
    <section className="card mini-card">
      <div className="section-title">
        <CalendarDays size={18} />
        <span>Partidos</span>
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
          </div>
        ))}
      </div>
      <button className="link-button" type="button" onClick={onOpen}>Ver todos los partidos</button>
    </section>
  );
}

function BonusBanner({ data }: { data: BootstrapData }) {
  return (
    <section className="bonus-banner">
      <div className="bonus-icon"><Gift size={34} /></div>
      <div>
        <h2>Bonus+</h2>
        <p>{data.bonus ? "Tus bonus estan bloqueados" : "Completa tus bonus iniciales"}</p>
        <div className="progress"><span style={{ width: data.bonus ? "100%" : "35%" }} /></div>
      </div>
      <strong>+20</strong>
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

function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ tab: Tab; label: string; icon: React.ReactNode }> = [
    { tab: "home", label: "Inicio", icon: <Home size={22} /> },
    { tab: "matches", label: "Partidos", icon: <Trophy size={22} /> },
    { tab: "leaderboard", label: "Clasificación", icon: <Medal size={22} /> },
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

function getRelevantMatches<T extends Match>(matches: T[]): T[] {
  const sorted = sortMatchesByKickoff(matches);
  const current = findCurrentMatch(sorted);
  if (!current) return sorted;
  return [current, ...sorted.filter((match) => match.id !== current.id)];
}

function hasScore(match: Match): boolean {
  return match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined;
}

function matchStatusLabel(match: Match): string {
  if (match.status === "live") return "En curso";
  if (match.status === "finished") return "Finalizado";
  if (isPredictionLocked(match.kickoffAt)) return "Bloqueado";
  return "Próximo partido";
}

function matchSummary(match: Match): string {
  const score = hasScore(match) ? `${match.homeScore}-${match.awayScore}` : null;
  const status = match.status === "live" || match.status === "finished" ? matchStatusLabel(match) : null;
  return [status, score].filter(Boolean).join(" · ") || "Programado";
}

function formatGoal(goal: Match["goals"][number]): string {
  return [goal.scorerName || "Gol", goal.isPenalty ? "(p)" : goal.isOwnGoal ? "(pp)" : ""].filter(Boolean).join(" ");
}

function getTopScorers(matches: Match[]): ScorerRow[] {
  const scorers = new Map<string, ScorerRow>();

  for (const match of matches) {
    let previousHome = 0;
    let previousAway = 0;
    for (const goal of match.goals || []) {
      if (!goal.scorerName) {
        previousHome = goal.homeScore;
        previousAway = goal.awayScore;
        continue;
      }

      const teamName = goal.homeScore > previousHome ? match.homeTeam.name : goal.awayScore > previousAway ? match.awayTeam.name : "";
      const key = `${goal.scorerName}|${teamName}`;
      const current = scorers.get(key) ?? { player: goal.scorerName, teamName, goals: 0 };
      current.goals += 1;
      scorers.set(key, current);
      previousHome = goal.homeScore;
      previousAway = goal.awayScore;
    }
  }

  return [...scorers.values()].sort((left, right) => right.goals - left.goals || left.player.localeCompare(right.player)).slice(0, 20);
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
