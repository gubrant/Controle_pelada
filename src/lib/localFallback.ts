import type {
  AttendanceRecord,
  AttendanceStatus,
  DashboardData,
  EncounterStatus,
  EncounterSummary,
  GoalRecord,
  MatchRecord,
  MatchStatus,
  MonthlyPaymentItem,
  NotificationItem,
  PeladaSettings,
  PlayerCriteria,
  TeamDraw,
  TeamPlayerItem,
  UserProfile,
  UserRole,
  VoteRecord,
  AvulsoPaymentItem,
} from '../types.ts';

const STORAGE_KEY = 'quadra_livre_db_v1';

interface StoredUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  idade: number | null;
  peso: number | null;
  altura: number | null;
  initPreparo: number;
  initDrible: number;
  initChute: number;
  initPasse: number;
  initDefesa: number;
  initAtaque: number;
  ratingOverride: boolean;
  overridePreparo: number | null;
  overrideDrible: number | null;
  overrideChute: number | null;
  overridePasse: number | null;
  overrideDefesa: number | null;
  overrideAtaque: number | null;
  createdAt: string;
}

interface StoredEncounter {
  id: number;
  titulo: string;
  dataHora: string;
  local: string;
  valorAvulso: number;
  status: EncounterStatus;
  votacaoAberta: boolean;
  createdBy: number | null;
  createdAt: string;
}

interface StoredAttendance {
  id: number;
  encounterId: number;
  userId: number;
  status: AttendanceStatus;
  pagoAvulso: boolean;
  valorPago: number;
  updatedAt: string;
}

interface StoredTeam {
  id: number;
  encounterId: number;
  nome: string;
  cor: 'emerald' | 'slate' | 'amber' | 'sky';
  ordem: number;
}

interface StoredTeamPlayer {
  id: number;
  teamId: number;
  userId: number;
  encounterId: number;
}

interface StoredMatch {
  id: number;
  encounterId: number;
  teamAId: number;
  teamBId: number;
  goalsA: number;
  goalsB: number;
  status: MatchStatus;
  winnerTeamId: number | null;
  createdBy: number | null;
  createdAt: string;
}

interface StoredGoal {
  id: number;
  encounterId: number;
  matchId: number | null;
  teamId: number | null;
  scorerId: number;
  assistId: number | null;
  minuto: number | null;
  createdAt: string;
}

interface StoredVote {
  id: number;
  encounterId: number;
  voterId: number;
  targetId: number;
  preparo: number;
  drible: number;
  chute: number;
  passe: number;
  defesa: number;
  ataque: number;
  createdAt: string;
}

interface StoredMonthlyPayment {
  userId: number;
  competencia: string;
  valor: number;
  status: 'pendente' | 'pago' | 'isento';
  metodo: string;
  paidAt: string | null;
}

interface StoredNotification {
  id: number;
  userId: number;
  encounterId: number | null;
  tipo: NotificationItem['tipo'];
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: string;
}

interface LocalDbState {
  nextId: number;
  settings: PeladaSettings;
  users: StoredUser[];
  encounters: StoredEncounter[];
  attendance: StoredAttendance[];
  teams: StoredTeam[];
  teamPlayers: StoredTeamPlayer[];
  matches: StoredMatch[];
  goals: StoredGoal[];
  votes: StoredVote[];
  monthlyPayments: StoredMonthlyPayment[];
  notifications: StoredNotification[];
}

let memoryFallbackState: LocalDbState | null = null;

function createInitialState(): LocalDbState {
  const now = new Date().toISOString();
  return {
    nextId: 2,
    settings: {
      peladaNome: 'Pelada Quadra Livre',
      valorMensalidade: 80,
      valorAvulso: 25,
      jogadoresPorTime: 5,
    },
    users: [
      {
        id: 1,
        username: 'didi',
        displayName: 'Didi',
        role: 'administrador',
        idade: null,
        peso: null,
        altura: null,
        initPreparo: 7,
        initDrible: 7,
        initChute: 7,
        initPasse: 7,
        initDefesa: 7,
        initAtaque: 7,
        ratingOverride: false,
        overridePreparo: null,
        overrideDrible: null,
        overrideChute: null,
        overridePasse: null,
        overrideDefesa: null,
        overrideAtaque: null,
        createdAt: now,
      },
    ],
    encounters: [],
    attendance: [],
    teams: [],
    teamPlayers: [],
    matches: [],
    goals: [],
    votes: [],
    monthlyPayments: [],
    notifications: [],
  };
}

function loadState(): LocalDbState {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LocalDbState>;
        if (parsed && Array.isArray(parsed.users) && parsed.settings) {
          return {
            ...createInitialState(),
            ...parsed,
          };
        }
      }
    } catch {
      // Ignore malformed storage and fallback cleanly
    }
  }
  if (!memoryFallbackState) {
    memoryFallbackState = createInitialState();
    saveState(memoryFallbackState);
  }
  return memoryFallbackState;
}

function saveState(state: LocalDbState) {
  memoryFallbackState = state;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }
}

function allocId(state: LocalDbState): number {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function clampScore(value: unknown, fallback = 6): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(10, Math.max(1, Math.round(num * 10) / 10));
}

function sanitizeOptionalNumber(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(max, Math.max(min, num));
}

function formatDatePtBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ensureDefaultAdmin(state: LocalDbState): StoredUser {
  const existingAdmin = state.users.find((u) => u.role === 'administrador');
  if (existingAdmin) return existingAdmin;
  const didi = state.users.find((u) => u.username.toLowerCase() === 'didi');
  if (didi) {
    didi.role = 'administrador';
    return didi;
  }
  const now = new Date().toISOString();
  const created: StoredUser = {
    id: allocId(state),
    username: 'didi',
    displayName: 'Didi',
    role: 'administrador',
    idade: null,
    peso: null,
    altura: null,
    initPreparo: 7,
    initDrible: 7,
    initChute: 7,
    initPasse: 7,
    initDefesa: 7,
    initAtaque: 7,
    ratingOverride: false,
    overridePreparo: null,
    overrideDrible: null,
    overrideChute: null,
    overridePasse: null,
    overrideDefesa: null,
    overrideAtaque: null,
    createdAt: now,
  };
  state.users.push(created);
  return created;
}

function mapUserToProfile(state: LocalDbState, user: StoredUser): UserProfile {
  const confirmedAttSet = new Set(
    state.attendance
      .filter((a) => a.userId === user.id && a.status === 'confirmado')
      .map((a) => a.encounterId)
  );

  const encMap = new Map(state.encounters.map((e) => [e.id, e]));
  const votesByEncounter = new Map<number, StoredVote[]>();

  for (const v of state.votes) {
    if (v.targetId !== user.id || !confirmedAttSet.has(v.encounterId)) continue;
    const list = votesByEncounter.get(v.encounterId) ?? [];
    list.push(v);
    votesByEncounter.set(v.encounterId, list);
  }

  const recentEncounters = Array.from(votesByEncounter.entries())
    .map(([encounterId, votes]) => {
      const enc = encMap.get(encounterId);
      return {
        encounterId,
        dataHora: enc?.dataHora ?? '',
        votes,
      };
    })
    .sort((a, b) => b.dataHora.localeCompare(a.dataHora) || b.encounterId - a.encounterId)
    .slice(0, 5);

  const evaluatedEncountersCount = recentEncounters.length;
  const hasPeerVotes = evaluatedEncountersCount > 0;
  const voteCount = recentEncounters.reduce((sum, r) => sum + r.votes.length, 0);

  const encAvgs = recentEncounters.map((r) => {
    const n = r.votes.length;
    return {
      preparo: r.votes.reduce((s, v) => s + v.preparo, 0) / n,
      drible: r.votes.reduce((s, v) => s + v.drible, 0) / n,
      chute: r.votes.reduce((s, v) => s + v.chute, 0) / n,
      passe: r.votes.reduce((s, v) => s + v.passe, 0) / n,
      defesa: r.votes.reduce((s, v) => s + v.defesa, 0) / n,
      ataque: r.votes.reduce((s, v) => s + v.ataque, 0) / n,
    };
  });

  const autoCriteria: PlayerCriteria = hasPeerVotes
    ? {
        preparo: round1(encAvgs.reduce((s, r) => s + r.preparo, 0) / evaluatedEncountersCount),
        drible: round1(encAvgs.reduce((s, r) => s + r.drible, 0) / evaluatedEncountersCount),
        chute: round1(encAvgs.reduce((s, r) => s + r.chute, 0) / evaluatedEncountersCount),
        passe: round1(encAvgs.reduce((s, r) => s + r.passe, 0) / evaluatedEncountersCount),
        defesa: round1(encAvgs.reduce((s, r) => s + r.defesa, 0) / evaluatedEncountersCount),
        ataque: round1(encAvgs.reduce((s, r) => s + r.ataque, 0) / evaluatedEncountersCount),
      }
    : {
        preparo: round1(user.initPreparo),
        drible: round1(user.initDrible),
        chute: round1(user.initChute),
        passe: round1(user.initPasse),
        defesa: round1(user.initDefesa),
        ataque: round1(user.initAtaque),
      };

  const autoOverall = hasPeerVotes
    ? round1(
        encAvgs.reduce(
          (s, r) => s + (r.preparo + r.drible + r.chute + r.passe + r.defesa + r.ataque) / 6,
          0
        ) / evaluatedEncountersCount
      )
    : round1(
        (autoCriteria.preparo +
          autoCriteria.drible +
          autoCriteria.chute +
          autoCriteria.passe +
          autoCriteria.defesa +
          autoCriteria.ataque) /
          6
      );

  const isAdminAdjusted = user.ratingOverride;
  const criteria: PlayerCriteria = isAdminAdjusted
    ? {
        preparo: round1(user.overridePreparo ?? autoCriteria.preparo),
        drible: round1(user.overrideDrible ?? autoCriteria.drible),
        chute: round1(user.overrideChute ?? autoCriteria.chute),
        passe: round1(user.overridePasse ?? autoCriteria.passe),
        defesa: round1(user.overrideDefesa ?? autoCriteria.defesa),
        ataque: round1(user.overrideAtaque ?? autoCriteria.ataque),
      }
    : autoCriteria;

  const overall = isAdminAdjusted
    ? round1(
        (criteria.preparo +
          criteria.drible +
          criteria.chute +
          criteria.passe +
          criteria.defesa +
          criteria.ataque) /
          6
      )
    : autoOverall;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    idade: user.idade,
    peso: user.peso,
    altura: user.altura,
    initialCriteria: {
      preparo: round1(user.initPreparo),
      drible: round1(user.initDrible),
      chute: round1(user.initChute),
      passe: round1(user.initPasse),
      defesa: round1(user.initDefesa),
      ataque: round1(user.initAtaque),
    },
    stats: {
      totalGoals: state.goals.filter((g) => g.scorerId === user.id).length,
      totalAssists: state.goals.filter((g) => g.assistId === user.id).length,
      totalPresences: confirmedAttSet.size,
      voteCount,
      evaluatedEncountersCount,
      hasPeerVotes,
      isAdminAdjusted,
      autoOverall,
      overall,
      criteria,
    },
    createdAt: user.createdAt,
  };
}

function getAllPlayerProfiles(state: LocalDbState): UserProfile[] {
  return [...state.users]
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' }))
    .map((u) => mapUserToProfile(state, u));
}

function getEncounterSummaries(state: LocalDbState, currentUserId: number): EncounterSummary[] {
  const profiles = getAllPlayerProfiles(state);
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const userMap = new Map(state.users.map((u) => [u.id, u]));

  const sortedEncs = [...state.encounters].sort(
    (a, b) => b.dataHora.localeCompare(a.dataHora) || b.id - a.id
  );

  const statusOrder: Record<AttendanceStatus, number> = {
    confirmado: 0,
    pendente: 1,
    recusado: 2,
  };

  return sortedEncs.map((enc) => {
    const attendance: AttendanceRecord[] = state.attendance
      .filter((a) => a.encounterId === enc.id)
      .map((a) => {
        const u = userMap.get(a.userId);
        if (!u) return null;
        return {
          id: a.id,
          encounterId: a.encounterId,
          userId: a.userId,
          username: u.username,
          displayName: u.displayName,
          role: u.role,
          status: a.status,
          pagoAvulso: a.pagoAvulso,
          valorPago: a.valorPago,
          overall: profileMap.get(a.userId)?.stats.overall ?? 6.0,
          updatedAt: a.updatedAt,
        };
      })
      .filter((x): x is AttendanceRecord => Boolean(x))
      .sort(
        (a, b) =>
          statusOrder[a.status] - statusOrder[b.status] ||
          a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' })
      );

    const encTeams = state.teams
      .filter((t) => t.encounterId === enc.id)
      .sort((a, b) => a.ordem - b.ordem);
    const teamMap = new Map(encTeams.map((t) => [t.id, t]));

    const matches: MatchRecord[] = state.matches
      .filter((m) => m.encounterId === enc.id)
      .sort((a, b) => b.id - a.id)
      .map((m) => {
        const ta = teamMap.get(m.teamAId);
        const tb = teamMap.get(m.teamBId);
        const tw = m.winnerTeamId ? teamMap.get(m.winnerTeamId) : undefined;
        return {
          id: m.id,
          encounterId: m.encounterId,
          teamAId: m.teamAId,
          teamANome: ta?.nome ?? 'Time A',
          teamACor: ta?.cor ?? 'emerald',
          teamBId: m.teamBId,
          teamBNome: tb?.nome ?? 'Time B',
          teamBCor: tb?.cor ?? 'slate',
          goalsA: m.goalsA,
          goalsB: m.goalsB,
          status: m.status,
          winnerTeamId: m.winnerTeamId,
          winnerTeamNome: tw?.nome ?? null,
          createdAt: m.createdAt,
        };
      });

    const teams: TeamDraw[] = encTeams.map((t) => {
      const players: TeamPlayerItem[] = state.teamPlayers
        .filter((tp) => tp.teamId === t.id)
        .map((tp) => {
          const u = userMap.get(tp.userId);
          if (!u) return null;
          const prof = profileMap.get(tp.userId);
          return {
            userId: u.id,
            username: u.username,
            displayName: u.displayName,
            role: u.role,
            overall: prof?.stats.overall ?? 6.0,
            ataque: prof?.stats.criteria.ataque ?? 6.0,
            defesa: prof?.stats.criteria.defesa ?? 6.0,
          };
        })
        .filter((x): x is TeamPlayerItem => Boolean(x))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' }));

      let wins = 0;
      let draws = 0;
      let losses = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;

      for (const m of matches) {
        if (m.teamAId !== t.id && m.teamBId !== t.id) continue;
        const gf = m.teamAId === t.id ? m.goalsA : m.goalsB;
        const ga = m.teamAId === t.id ? m.goalsB : m.goalsA;
        goalsFor += gf;
        goalsAgainst += ga;
        if (m.status === 'finalizado') {
          if (m.winnerTeamId === t.id) wins += 1;
          else if (m.winnerTeamId === null) draws += 1;
          else losses += 1;
        }
      }

      const count = players.length || 1;
      return {
        id: t.id,
        encounterId: t.encounterId,
        nome: t.nome,
        cor: t.cor,
        ordem: t.ordem,
        players,
        avgOverall: round1(players.reduce((s, p) => s + p.overall, 0) / count),
        avgAtaque: round1(players.reduce((s, p) => s + p.ataque, 0) / count),
        avgDefesa: round1(players.reduce((s, p) => s + p.defesa, 0) / count),
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
      };
    });

    const goals: GoalRecord[] = state.goals
      .filter((g) => g.encounterId === enc.id)
      .sort((a, b) => b.id - a.id)
      .map((g) => ({
        id: g.id,
        encounterId: g.encounterId,
        matchId: g.matchId,
        teamId: g.teamId,
        teamNome: g.teamId ? teamMap.get(g.teamId)?.nome ?? null : null,
        scorerId: g.scorerId,
        scorerName: userMap.get(g.scorerId)?.displayName ?? 'Jogador',
        assistId: g.assistId,
        assistName: g.assistId ? userMap.get(g.assistId)?.displayName ?? null : null,
        minuto: g.minuto,
        createdAt: g.createdAt,
      }));

    return {
      id: enc.id,
      titulo: enc.titulo,
      dataHora: enc.dataHora,
      local: enc.local,
      valorAvulso: enc.valorAvulso,
      status: enc.status,
      votacaoAberta: enc.votacaoAberta,
      createdAt: enc.createdAt,
      confirmedCount: attendance.filter((a) => a.status === 'confirmado').length,
      pendingCount: attendance.filter((a) => a.status === 'pendente').length,
      declinedCount: attendance.filter((a) => a.status === 'recusado').length,
      myAttendance: attendance.find((a) => a.userId === currentUserId)?.status ?? 'pendente',
      totalGoals: goals.length,
      attendance,
      teams,
      matches,
      goals,
    };
  });
}

function getMonthlyPayments(state: LocalDbState, competencia: string): MonthlyPaymentItem[] {
  const fixedUsers = state.users
    .filter((u) => u.role === 'administrador' || u.role === 'peladeiro')
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' }));

  return fixedUsers.map((u) => {
    const rec = state.monthlyPayments.find(
      (mp) => mp.userId === u.id && mp.competencia === competencia
    );
    return {
      userId: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      competencia,
      valor: rec?.valor ?? state.settings.valorMensalidade,
      status: rec?.status ?? 'pendente',
      metodo: rec?.metodo ?? 'Pix',
      paidAt: rec?.paidAt ?? null,
    };
  });
}

function getDashboardData(state: LocalDbState): DashboardData {
  const profiles = getAllPlayerProfiles(state);
  const encMap = new Map(state.encounters.map((e) => [e.id, e]));
  const totalEncontros = state.encounters.length;
  const encontrosFinalizados = state.encounters.filter((e) => e.status === 'finalizado').length;
  const finishedMatches = state.matches.filter((m) => m.status === 'finalizado');
  const totalPartidas = finishedMatches.length;
  const totalGols = state.goals.length;
  const totalConfirmed = state.attendance.filter((a) => a.status === 'confirmado').length;
  const currentMonth = new Date().toISOString().slice(0, 7);

  const mensalidadesTotal = state.monthlyPayments
    .filter((mp) => mp.status === 'pago')
    .reduce((s, mp) => s + mp.valor, 0);
  const avulsosTotal = state.attendance
    .filter((a) => a.pagoAvulso)
    .reduce((s, a) => s + a.valorPago, 0);

  const mensalidadesMesAtual = state.monthlyPayments
    .filter((mp) => mp.status === 'pago' && mp.competencia === currentMonth)
    .reduce((s, mp) => s + mp.valor, 0);
  const avulsosMesAtual = state.attendance
    .filter((a) => {
      if (!a.pagoAvulso) return false;
      const enc = encMap.get(a.encounterId);
      return Boolean(enc && enc.dataHora.startsWith(currentMonth));
    })
    .reduce((s, a) => s + a.valorPago, 0);

  const topScorers = profiles
    .map((p) => ({
      userId: p.id,
      username: p.username,
      displayName: p.displayName,
      role: p.role,
      gols: p.stats.totalGoals,
      assistencias: p.stats.totalAssists,
      presencas: p.stats.totalPresences,
      mediaGols:
        p.stats.totalPresences > 0
          ? round1(p.stats.totalGoals / p.stats.totalPresences)
          : p.stats.totalGoals,
    }))
    .sort((a, b) => b.gols - a.gols || b.assistencias - a.assistencias)
    .slice(0, 10);

  const topRated = [...profiles]
    .sort((a, b) => b.stats.overall - a.stats.overall || b.stats.voteCount - a.stats.voteCount)
    .slice(0, 10);

  const attendanceRanking = profiles
    .map((p) => ({
      userId: p.id,
      displayName: p.displayName,
      role: p.role,
      presencas: p.stats.totalPresences,
      totalEncontros,
    }))
    .sort((a, b) => b.presencas - a.presencas)
    .slice(0, 10);

  const monthNames = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const monthlyRevenue: DashboardData['monthlyRevenue'] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mPaid = state.monthlyPayments
      .filter((mp) => mp.status === 'pago' && mp.competencia === ym)
      .reduce((s, mp) => s + mp.valor, 0);
    const aPaid = state.attendance
      .filter((a) => {
        if (!a.pagoAvulso) return false;
        const enc = encMap.get(a.encounterId);
        return Boolean(enc && enc.dataHora.startsWith(ym));
      })
      .reduce((s, a) => s + a.valorPago, 0);
    monthlyRevenue.push({
      competencia: ym,
      label: `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      mensalidades: mPaid,
      avulsos: aPaid,
      total: mPaid + aPaid,
    });
  }

  const countPlayers = profiles.length || 1;
  const leagueAverages: PlayerCriteria = {
    preparo: round1(profiles.reduce((s, p) => s + p.stats.criteria.preparo, 0) / countPlayers),
    drible: round1(profiles.reduce((s, p) => s + p.stats.criteria.drible, 0) / countPlayers),
    chute: round1(profiles.reduce((s, p) => s + p.stats.criteria.chute, 0) / countPlayers),
    passe: round1(profiles.reduce((s, p) => s + p.stats.criteria.passe, 0) / countPlayers),
    defesa: round1(profiles.reduce((s, p) => s + p.stats.criteria.defesa, 0) / countPlayers),
    ataque: round1(profiles.reduce((s, p) => s + p.stats.criteria.ataque, 0) / countPlayers),
  };

  const winStats = new Map<number, { vitorias: number; partidas: number }>();
  for (const m of finishedMatches) {
    const playersInMatch = state.teamPlayers.filter(
      (tp) => tp.encounterId === m.encounterId && (tp.teamId === m.teamAId || tp.teamId === m.teamBId)
    );
    for (const tp of playersInMatch) {
      const cur = winStats.get(tp.userId) ?? { vitorias: 0, partidas: 0 };
      cur.partidas += 1;
      if (m.winnerTeamId === tp.teamId) {
        cur.vitorias += 1;
      }
      winStats.set(tp.userId, cur);
    }
  }

  const topWinners = profiles
    .map((p) => {
      const w = winStats.get(p.id);
      return {
        userId: p.id,
        displayName: p.displayName,
        role: p.role,
        vitorias: w?.vitorias ?? 0,
        partidas: w?.partidas ?? 0,
      };
    })
    .filter((w) => w.partidas > 0)
    .sort((a, b) => b.vitorias - a.vitorias || a.partidas - b.partidas)
    .slice(0, 10);

  return {
    kpis: {
      totalEncontros,
      encontrosFinalizados,
      totalPartidas,
      totalGols,
      mediaGolsPorEncontro: totalEncontros > 0 ? round1(totalGols / totalEncontros) : 0,
      jogadoresAtivos: profiles.length,
      caixaTotal: mensalidadesTotal + avulsosTotal,
      caixaMesAtual: mensalidadesMesAtual + avulsosMesAtual,
      taxaPresencaMedia:
        totalEncontros > 0 && profiles.length > 0
          ? Math.round((totalConfirmed / (totalEncontros * profiles.length)) * 100)
          : 0,
    },
    topScorers,
    topWinners,
    topRated,
    attendanceRanking,
    monthlyRevenue,
    leagueAverages,
  };
}

function getAuthUser(state: LocalDbState, activePlayerId: number | null): StoredUser {
  if (activePlayerId !== null) {
    const found = state.users.find((u) => u.id === activePlayerId);
    if (found) return found;
  }
  return ensureDefaultAdmin(state);
}

function sanitizeHandle(rawHandle: string, state: LocalDbState, prefix: string): string {
  let cleanUser = rawHandle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 24);

  if (cleanUser.length < 2) {
    cleanUser = `${prefix}_${Math.floor(100 + Math.random() * 900)}`;
  }
  if (state.users.some((u) => u.username.toLowerCase() === cleanUser.toLowerCase())) {
    cleanUser = `${cleanUser.slice(0, 19)}_${Math.floor(10 + Math.random() * 90)}`;
  }
  return cleanUser;
}

export async function handleLocalFallback<T>(
  rawPath: string,
  options: RequestInit,
  activePlayerId: number | null
): Promise<T> {
  const state = loadState();
  const method = (options.method || 'GET').toUpperCase();
  const url = new URL(rawPath, 'http://localhost');
  const pathname = url.pathname;
  const body =
    typeof options.body === 'string' && options.body.trim()
      ? (JSON.parse(options.body) as Record<string, unknown>)
      : {};

  const authUser = getAuthUser(state, activePlayerId);

  const requireAdmin = () => {
    if (authUser.role !== 'administrador') {
      throw new Error('Apenas administradores podem realizar esta ação.');
    }
  };

  // Auth / Register
  if (pathname === '/api/auth/register' && method === 'POST') {
    const baseName =
      typeof body.displayName === 'string' && body.displayName.trim().length > 0
        ? body.displayName.trim().slice(0, 48)
        : typeof body.username === 'string'
        ? body.username.trim().slice(0, 48)
        : '';

    if (!baseName) {
      throw new Error('Informe o nome ou apelido do jogador.');
    }

    const rawHandle =
      typeof body.username === 'string' && body.username.trim().length >= 2
        ? body.username.trim()
        : baseName;

    const newUser: StoredUser = {
      id: allocId(state),
      username: sanitizeHandle(rawHandle, state, 'peladeiro'),
      displayName: baseName,
      role: 'peladeiro_avulso',
      idade: sanitizeOptionalNumber(body.idade, 10, 90),
      peso: sanitizeOptionalNumber(body.peso, 35, 200),
      altura: sanitizeOptionalNumber(body.altura, 120, 230),
      initPreparo: clampScore(body.preparo, 6),
      initDrible: clampScore(body.drible, 6),
      initChute: clampScore(body.chute, 6),
      initPasse: clampScore(body.passe, 6),
      initDefesa: clampScore(body.defesa, 6),
      initAtaque: clampScore(body.ataque, 6),
      ratingOverride: false,
      overridePreparo: null,
      overrideDrible: null,
      overrideChute: null,
      overridePasse: null,
      overrideDefesa: null,
      overrideAtaque: null,
      createdAt: new Date().toISOString(),
    };
    state.users.push(newUser);

    for (const enc of state.encounters.filter((e) => e.status === 'aberto')) {
      state.attendance.push({
        id: allocId(state),
        encounterId: enc.id,
        userId: newUser.id,
        status: 'pendente',
        pagoAvulso: false,
        valorPago: 0,
        updatedAt: new Date().toISOString(),
      });
      state.notifications.push({
        id: allocId(state),
        userId: newUser.id,
        encounterId: enc.id,
        tipo: 'convocacao',
        titulo: `Convocação: ${enc.titulo}`,
        mensagem: `Pelada marcada para ${formatDatePtBr(enc.dataHora)} em ${enc.local}. Confirme sua presença!`,
        lida: false,
        createdAt: new Date().toISOString(),
      });
    }

    saveState(state);
    return { user: mapUserToProfile(state, newUser) } as T;
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    saveState(state);
    return {
      user: mapUserToProfile(state, authUser),
      settings: state.settings,
    } as T;
  }

  if (pathname === '/api/profile' && method === 'PUT') {
    authUser.displayName =
      typeof body.displayName === 'string' && body.displayName.trim().length > 0
        ? body.displayName.trim().slice(0, 48)
        : authUser.displayName;
    authUser.idade = sanitizeOptionalNumber(body.idade, 10, 90);
    authUser.peso = sanitizeOptionalNumber(body.peso, 35, 200);
    authUser.altura = sanitizeOptionalNumber(body.altura, 120, 230);
    authUser.initPreparo = clampScore(body.preparo, authUser.initPreparo);
    authUser.initDrible = clampScore(body.drible, authUser.initDrible);
    authUser.initChute = clampScore(body.chute, authUser.initChute);
    authUser.initPasse = clampScore(body.passe, authUser.initPasse);
    authUser.initDefesa = clampScore(body.defesa, authUser.initDefesa);
    authUser.initAtaque = clampScore(body.ataque, authUser.initAtaque);
    saveState(state);
    return { user: mapUserToProfile(state, authUser) } as T;
  }

  if (pathname === '/api/players' && method === 'GET') {
    return { players: getAllPlayerProfiles(state) } as T;
  }

  if (pathname === '/api/admin/players' && method === 'POST') {
    requireAdmin();
    const cleanName =
      typeof body.displayName === 'string' && body.displayName.trim().length > 0
        ? body.displayName.trim().slice(0, 48)
        : typeof body.username === 'string'
        ? body.username.trim().slice(0, 48)
        : '';
    if (!cleanName) {
      throw new Error('Informe o nome do jogador.');
    }
    const rawHandle =
      typeof body.username === 'string' && body.username.trim().length >= 2
        ? body.username.trim()
        : cleanName;
    const validRoles: UserRole[] = ['administrador', 'peladeiro', 'peladeiro_avulso'];
    const targetRole: UserRole = validRoles.includes(body.role as UserRole)
      ? (body.role as UserRole)
      : 'peladeiro';

    const newPlayer: StoredUser = {
      id: allocId(state),
      username: sanitizeHandle(rawHandle, state, 'jogador'),
      displayName: cleanName,
      role: targetRole,
      idade: sanitizeOptionalNumber(body.idade, 10, 90),
      peso: sanitizeOptionalNumber(body.peso, 35, 200),
      altura: sanitizeOptionalNumber(body.altura, 120, 230),
      initPreparo: clampScore(body.preparo, 6),
      initDrible: clampScore(body.drible, 6),
      initChute: clampScore(body.chute, 6),
      initPasse: clampScore(body.passe, 6),
      initDefesa: clampScore(body.defesa, 6),
      initAtaque: clampScore(body.ataque, 6),
      ratingOverride: false,
      overridePreparo: null,
      overrideDrible: null,
      overrideChute: null,
      overridePasse: null,
      overrideDefesa: null,
      overrideAtaque: null,
      createdAt: new Date().toISOString(),
    };
    state.users.push(newPlayer);

    for (const enc of state.encounters.filter((e) => e.status === 'aberto')) {
      state.attendance.push({
        id: allocId(state),
        encounterId: enc.id,
        userId: newPlayer.id,
        status: 'pendente',
        pagoAvulso: false,
        valorPago: 0,
        updatedAt: new Date().toISOString(),
      });
      state.notifications.push({
        id: allocId(state),
        userId: newPlayer.id,
        encounterId: enc.id,
        tipo: 'convocacao',
        titulo: `Convocação: ${enc.titulo}`,
        mensagem: `Pelada marcada para ${formatDatePtBr(enc.dataHora)} em ${enc.local}. Confirme sua presença!`,
        lida: false,
        createdAt: new Date().toISOString(),
      });
    }

    saveState(state);
    return { player: mapUserToProfile(state, newPlayer) } as T;
  }

  let match = pathname.match(/^\/api\/admin\/players\/(\d+)\/role$/);
  if (match && method === 'PATCH') {
    requireAdmin();
    const targetId = Number(match[1]);
    const validRoles: UserRole[] = ['administrador', 'peladeiro', 'peladeiro_avulso'];
    if (!validRoles.includes(body.role as UserRole)) {
      throw new Error('Perfil de participante inválido.');
    }
    const target = state.users.find((u) => u.id === targetId);
    if (!target) {
      throw new Error('Jogador não encontrado.');
    }
    if (target.role === 'administrador' && body.role !== 'administrador') {
      const adminCount = state.users.filter((u) => u.role === 'administrador').length;
      if (adminCount <= 1) {
        throw new Error('Não é possível rebaixar o único administrador do sistema.');
      }
    }
    target.role = body.role as UserRole;
    saveState(state);
    return { player: mapUserToProfile(state, target) } as T;
  }

  match = pathname.match(/^\/api\/admin\/players\/(\d+)\/ratings$/);
  if (match && method === 'PUT') {
    requireAdmin();
    const targetId = Number(match[1]);
    const target = state.users.find((u) => u.id === targetId);
    if (!target) {
      throw new Error('Jogador não encontrado.');
    }
    if (body.mode === 'automatico') {
      target.ratingOverride = false;
      target.overridePreparo = null;
      target.overrideDrible = null;
      target.overrideChute = null;
      target.overridePasse = null;
      target.overrideDefesa = null;
      target.overrideAtaque = null;
      saveState(state);
      return { player: mapUserToProfile(state, target) } as T;
    }

    const prof = mapUserToProfile(state, target);
    target.ratingOverride = true;
    target.overridePreparo = clampScore(body.preparo, prof.stats.criteria.preparo);
    target.overrideDrible = clampScore(body.drible, prof.stats.criteria.drible);
    target.overrideChute = clampScore(body.chute, prof.stats.criteria.chute);
    target.overridePasse = clampScore(body.passe, prof.stats.criteria.passe);
    target.overrideDefesa = clampScore(body.defesa, prof.stats.criteria.defesa);
    target.overrideAtaque = clampScore(body.ataque, prof.stats.criteria.ataque);
    saveState(state);
    return { player: mapUserToProfile(state, target) } as T;
  }

  match = pathname.match(/^\/api\/admin\/players\/(\d+)$/);
  if (match && method === 'DELETE') {
    requireAdmin();
    const targetId = Number(match[1]);
    if (targetId === authUser.id) {
      throw new Error('Você não pode excluir a própria conta logada.');
    }
    const exists = state.users.some((u) => u.id === targetId);
    if (!exists) {
      throw new Error('Jogador não encontrado.');
    }
    state.users = state.users.filter((u) => u.id !== targetId);
    state.attendance = state.attendance.filter((a) => a.userId !== targetId);
    state.teamPlayers = state.teamPlayers.filter((tp) => tp.userId !== targetId);
    state.goals = state.goals.filter((g) => g.scorerId !== targetId);
    state.votes = state.votes.filter((v) => v.voterId !== targetId && v.targetId !== targetId);
    state.monthlyPayments = state.monthlyPayments.filter((mp) => mp.userId !== targetId);
    state.notifications = state.notifications.filter((n) => n.userId !== targetId);
    saveState(state);
    return { deleted: true } as T;
  }

  if (pathname === '/api/encounters' && method === 'GET') {
    return { encounters: getEncounterSummaries(state, authUser.id) } as T;
  }

  if (pathname === '/api/encounters' && method === 'POST') {
    requireAdmin();
    if (
      typeof body.titulo !== 'string' ||
      !body.titulo.trim() ||
      typeof body.dataHora !== 'string' ||
      !body.dataHora.trim()
    ) {
      throw new Error('Informe o título e a data/hora do encontro.');
    }
    const cleanLocal =
      typeof body.local === 'string' && body.local.trim()
        ? body.local.trim().slice(0, 80)
        : 'Quadra Principal';
    const avulsoPrice =
      body.valorAvulso !== undefined && Number.isFinite(Number(body.valorAvulso))
        ? Math.max(0, Number(body.valorAvulso))
        : state.settings.valorAvulso;

    const newEnc: StoredEncounter = {
      id: allocId(state),
      titulo: body.titulo.trim().slice(0, 80),
      dataHora: body.dataHora.trim(),
      local: cleanLocal,
      valorAvulso: avulsoPrice,
      status: 'aberto',
      votacaoAberta: false,
      createdBy: authUser.id,
      createdAt: new Date().toISOString(),
    };
    state.encounters.push(newEnc);

    for (const u of state.users) {
      state.attendance.push({
        id: allocId(state),
        encounterId: newEnc.id,
        userId: u.id,
        status: 'pendente',
        pagoAvulso: false,
        valorPago: 0,
        updatedAt: new Date().toISOString(),
      });
      state.notifications.push({
        id: allocId(state),
        userId: u.id,
        encounterId: newEnc.id,
        tipo: 'convocacao',
        titulo: `Convocação: ${newEnc.titulo}`,
        mensagem: `Pelada marcada para ${formatDatePtBr(newEnc.dataHora)} em ${cleanLocal}. Confirme sua presença!`,
        lida: false,
        createdAt: new Date().toISOString(),
      });
    }

    saveState(state);
    const enc = getEncounterSummaries(state, authUser.id).find((e) => e.id === newEnc.id);
    return { encounter: enc } as T;
  }

  match = pathname.match(/^\/api\/encounters\/(\d+)\/status$/);
  if (match && method === 'PATCH') {
    requireAdmin();
    const encId = Number(match[1]);
    const enc = state.encounters.find((e) => e.id === encId);
    if (!enc) throw new Error('Encontro não encontrado.');
    const validStatuses: EncounterStatus[] = ['aberto', 'em_andamento', 'finalizado'];
    const prevVoting = enc.votacaoAberta;
    if (validStatuses.includes(body.status as EncounterStatus)) {
      enc.status = body.status as EncounterStatus;
    }
    enc.votacaoAberta =
      typeof body.votacaoAberta === 'boolean'
        ? body.votacaoAberta
        : enc.status === 'finalizado'
        ? true
        : enc.votacaoAberta;

    if (enc.votacaoAberta && !prevVoting) {
      const confirmed = state.attendance.filter(
        (a) => a.encounterId === encId && a.status === 'confirmado'
      );
      for (const c of confirmed) {
        state.notifications.push({
          id: allocId(state),
          userId: c.userId,
          encounterId: encId,
          tipo: 'votacao',
          titulo: `Votação Aberta: ${enc.titulo}`,
          mensagem:
            'A pelada terminou! Acesse a aba Votação para avaliar os critérios dos outros participantes.',
          lida: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    saveState(state);
    return { encounter: getEncounterSummaries(state, authUser.id).find((e) => e.id === encId) } as T;
  }

  match = pathname.match(/^\/api\/encounters\/(\d+)$/);
  if (match && method === 'DELETE') {
    requireAdmin();
    const encId = Number(match[1]);
    state.encounters = state.encounters.filter((e) => e.id !== encId);
    state.attendance = state.attendance.filter((a) => a.encounterId !== encId);
    state.teams = state.teams.filter((t) => t.encounterId !== encId);
    state.teamPlayers = state.teamPlayers.filter((tp) => tp.encounterId !== encId);
    state.matches = state.matches.filter((m) => m.encounterId !== encId);
    state.goals = state.goals.filter((g) => g.encounterId !== encId);
    state.votes = state.votes.filter((v) => v.encounterId !== encId);
    state.notifications = state.notifications.filter((n) => n.encounterId !== encId);
    saveState(state);
    return { deleted: true } as T;
  }

  match = pathname.match(/^\/api\/encounters\/(\d+)\/attendance$/);
  if (match && method === 'POST') {
    const encId = Number(match[1]);
    const validStatuses: AttendanceStatus[] = ['pendente', 'confirmado', 'recusado'];
    if (!validStatuses.includes(body.status as AttendanceStatus)) {
      throw new Error('Status de presença inválido.');
    }
    const enc = state.encounters.find((e) => e.id === encId);
    if (!enc) throw new Error('Encontro não encontrado.');

    const targetUserId =
      authUser.role === 'administrador' && Number.isInteger(Number(body.userId))
        ? Number(body.userId)
        : authUser.id;

    const existing = state.attendance.find(
      (a) => a.encounterId === encId && a.userId === targetUserId
    );
    if (existing) {
      existing.status = body.status as AttendanceStatus;
      existing.updatedAt = new Date().toISOString();
    } else {
      state.attendance.push({
        id: allocId(state),
        encounterId: encId,
        userId: targetUserId,
        status: body.status as AttendanceStatus,
        pagoAvulso: false,
        valorPago: 0,
        updatedAt: new Date().toISOString(),
      });
    }

    if (targetUserId === authUser.id && body.status !== 'pendente') {
      for (const n of state.notifications) {
        if (
          n.userId === authUser.id &&
          n.encounterId === encId &&
          (n.tipo === 'convocacao' || n.tipo === 'lembrete')
        ) {
          n.lida = true;
        }
      }
    }

    saveState(state);
    return { encounter: getEncounterSummaries(state, authUser.id).find((e) => e.id === encId) } as T;
  }

  match = pathname.match(/^\/api\/encounters\/(\d+)\/remind$/);
  if (match && method === 'POST') {
    requireAdmin();
    const encId = Number(match[1]);
    const enc = state.encounters.find((e) => e.id === encId);
    if (!enc) throw new Error('Encontro não encontrado.');

    let count = 0;
    for (const u of state.users) {
      const att = state.attendance.find((a) => a.encounterId === encId && a.userId === u.id);
      const status = att?.status ?? 'pendente';
      if (status === 'pendente') {
        if (!att) {
          state.attendance.push({
            id: allocId(state),
            encounterId: encId,
            userId: u.id,
            status: 'pendente',
            pagoAvulso: false,
            valorPago: 0,
            updatedAt: new Date().toISOString(),
          });
        }
        state.notifications.push({
          id: allocId(state),
          userId: u.id,
          encounterId: encId,
          tipo: 'lembrete',
          titulo: `Lembrete de Presença: ${enc.titulo}`,
          mensagem: `Ainda não recebemos sua confirmação para ${formatDatePtBr(enc.dataHora)} (${enc.local}). Confirme se vai jogar!`,
          lida: false,
          createdAt: new Date().toISOString(),
        });
        count += 1;
      }
    }

    saveState(state);
    return { notifiedCount: count } as T;
  }

  match = pathname.match(/^\/api\/encounters\/(\d+)\/draw-teams$/);
  if (match && method === 'POST') {
    requireAdmin();
    const encId = Number(match[1]);
    const enc = state.encounters.find((e) => e.id === encId);
    if (!enc) throw new Error('Encontro não encontrado.');

    const numTeams = Math.min(4, Math.max(2, Number(body.numTeams) || 2));
    const mode = body.mode === 'aleatorio' ? 'aleatorio' : 'equilibrado';

    const confirmedIds = state.attendance
      .filter((a) => a.encounterId === encId && a.status === 'confirmado')
      .map((a) => a.userId);

    if (confirmedIds.length < 2) {
      throw new Error(
        'É necessário ter pelo menos 2 jogadores confirmados para sortear os times.'
      );
    }

    const allProfiles = new Map(getAllPlayerProfiles(state).map((p) => [p.id, p]));
    const confirmedPlayers = confirmedIds
      .map((id) => allProfiles.get(id))
      .filter((p): p is UserProfile => Boolean(p));

    const buckets: UserProfile[][] = Array.from({ length: numTeams }, () => []);
    if (mode === 'aleatorio') {
      const shuffled = [...confirmedPlayers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      shuffled.forEach((p, idx) => buckets[idx % numTeams].push(p));
    } else {
      const sorted = [...confirmedPlayers].sort((a, b) => {
        const diff = b.stats.overall - a.stats.overall;
        if (Math.abs(diff) > 0.05) return diff;
        return Math.random() - 0.5;
      });
      const teamTotals = new Array(numTeams).fill(0);
      for (const player of sorted) {
        const minLen = Math.min(...buckets.map((b) => b.length));
        let bestIdx = 0;
        let bestScore = Infinity;
        for (let t = 0; t < numTeams; t++) {
          if (buckets[t].length === minLen && teamTotals[t] < bestScore) {
            bestScore = teamTotals[t];
            bestIdx = t;
          }
        }
        buckets[bestIdx].push(player);
        teamTotals[bestIdx] += player.stats.overall;
      }
    }

    const presets: Array<{ nome: string; cor: 'emerald' | 'slate' | 'amber' | 'sky' }> = [
      { nome: 'Time A — Esmeralda', cor: 'emerald' },
      { nome: 'Time B — Ardósia', cor: 'slate' },
      { nome: 'Time C — Ouro', cor: 'amber' },
      { nome: 'Time D — Celeste', cor: 'sky' },
    ];

    const oldTeamIds = new Set(state.teams.filter((t) => t.encounterId === encId).map((t) => t.id));
    state.teamPlayers = state.teamPlayers.filter((tp) => tp.encounterId !== encId);
    state.teams = state.teams.filter((t) => t.encounterId !== encId);
    state.matches = state.matches.filter(
      (m) => !oldTeamIds.has(m.teamAId) && !oldTeamIds.has(m.teamBId)
    );

    for (let i = 0; i < numTeams; i++) {
      const preset = presets[i];
      const teamId = allocId(state);
      state.teams.push({
        id: teamId,
        encounterId: encId,
        nome: preset.nome,
        cor: preset.cor,
        ordem: i + 1,
      });
      for (const p of buckets[i]) {
        state.teamPlayers.push({
          id: allocId(state),
          teamId,
          userId: p.id,
          encounterId: encId,
        });
      }
    }

    saveState(state);
    return { encounter: getEncounterSummaries(state, authUser.id).find((e) => e.id === encId) } as T;
  }

  match = pathname.match(/^\/api\/encounters\/(\d+)\/move-player$/);
  if (match && method === 'POST') {
    requireAdmin();
    const encId = Number(match[1]);
    const userId = Number(body.userId);
    const targetTeamId = Number(body.targetTeamId);
    const team = state.teams.find((t) => t.id === targetTeamId && t.encounterId === encId);
    if (!team) throw new Error('Time de destino não encontrado.');

    const existingTp = state.teamPlayers.find(
      (tp) => tp.encounterId === encId && tp.userId === userId
    );
    if (existingTp) {
      existingTp.teamId = targetTeamId;
    } else {
      state.teamPlayers.push({
        id: allocId(state),
        teamId: targetTeamId,
        userId,
        encounterId: encId,
      });
    }

    saveState(state);
    return { encounter: getEncounterSummaries(state, authUser.id).find((e) => e.id === encId) } as T;
  }

  match = pathname.match(/^\/api\/encounters\/(\d+)\/matches$/);
  if (match && method === 'POST') {
    const encId = Number(match[1]);
    const enc = state.encounters.find((e) => e.id === encId);
    if (!enc) throw new Error('Encontro não encontrado.');
    if (enc.status === 'finalizado' && authUser.role !== 'administrador') {
      throw new Error('Este encontro já foi finalizado.');
    }

    const teamAId = Number(body.teamAId);
    const teamBId = Number(body.teamBId);
    if (!Number.isInteger(teamAId) || !Number.isInteger(teamBId) || teamAId === teamBId) {
      throw new Error('Selecione dois times diferentes para a partida.');
    }
    const validTeams = state.teams.filter(
      (t) => t.encounterId === encId && (t.id === teamAId || t.id === teamBId)
    );
    if (validTeams.length !== 2) {
      throw new Error('Times inválidos para este encontro.');
    }

    const goalsA = Math.max(0, Math.min(99, Math.round(Number(body.goalsA) || 0)));
    const goalsB = Math.max(0, Math.min(99, Math.round(Number(body.goalsB) || 0)));
    const status: MatchStatus = body.status === 'finalizado' ? 'finalizado' : 'em_andamento';
    const winnerTeamId =
      status === 'finalizado'
        ? goalsA > goalsB
          ? teamAId
          : goalsB > goalsA
          ? teamBId
          : null
        : null;

    state.matches.push({
      id: allocId(state),
      encounterId: encId,
      teamAId,
      teamBId,
      goalsA,
      goalsB,
      status,
      winnerTeamId,
      createdBy: authUser.id,
      createdAt: new Date().toISOString(),
    });

    saveState(state);
    return { encounter: getEncounterSummaries(state, authUser.id).find((e) => e.id === encId) } as T;
  }

  match = pathname.match(/^\/api\/encounters\/(\d+)\/matches\/(\d+)$/);
  if (match && method === 'PATCH') {
    const encId = Number(match[1]);
    const matchId = Number(match[2]);
    const enc = state.encounters.find((e) => e.id === encId);
    if (!enc) throw new Error('Encontro não encontrado.');
    if (enc.status === 'finalizado' && authUser.role !== 'administrador') {
      throw new Error('Este encontro já foi finalizado.');
    }
    const m = state.matches.find((item) => item.id === matchId && item.encounterId === encId);
    if (!m) throw new Error('Partida não encontrada.');

    if (body.goalsA !== undefined && Number.isFinite(Number(body.goalsA))) {
      m.goalsA = Math.max(0, Math.min(99, Math.round(Number(body.goalsA))));
    }
    if (body.goalsB !== undefined && Number.isFinite(Number(body.goalsB))) {
      m.goalsB = Math.max(0, Math.min(99, Math.round(Number(body.goalsB))));
    }
    if (body.status === 'finalizado' || body.status === 'em_andamento') {
      m.status = body.status;
    }
    m.winnerTeamId =
      m.status === 'finalizado'
        ? m.goalsA > m.goalsB
          ? m.teamAId
          : m.goalsB > m.goalsA
          ? m.teamBId
          : null
        : null;

    saveState(state);
    return { encounter: getEncounterSummaries(state, authUser.id).find((e) => e.id === encId) } as T;
  }

  if (match && method === 'DELETE') {
    const encId = Number(match[1]);
    const matchId = Number(match[2]);
    const enc = state.encounters.find((e) => e.id === encId);
    if (!enc) throw new Error('Encontro não encontrado.');
    if (enc.status === 'finalizado' && authUser.role !== 'administrador') {
      throw new Error(
        'Apenas administradores podem excluir partidas após finalizar o encontro.'
      );
    }
    state.matches = state.matches.filter((m) => !(m.id === matchId && m.encounterId === encId));
    state.goals = state.goals.filter((g) => g.matchId !== matchId);
    saveState(state);
    return { encounter: getEncounterSummaries(state, authUser.id).find((e) => e.id === encId) } as T;
  }

  match = pathname.match(/^\/api\/encounters\/(\d+)\/goals$/);
  if (match && method === 'POST') {
    const encId = Number(match[1]);
    const enc = state.encounters.find((e) => e.id === encId);
    if (!enc) throw new Error('Encontro não encontrado.');
    if (enc.status === 'finalizado' && authUser.role !== 'administrador') {
      throw new Error('Este encontro já foi finalizado.');
    }

    const scorerId = Number(body.scorerId);
    if (!Number.isInteger(scorerId)) throw new Error('Selecione o autor do gol.');

    const assistId = body.assistId ? Number(body.assistId) : null;
    const matchId = body.matchId ? Number(body.matchId) : null;
    const minuto = sanitizeOptionalNumber(body.minuto, 1, 120);

    let teamId: number | null = body.teamId ? Number(body.teamId) : null;
    if (!teamId) {
      teamId =
        state.teamPlayers.find((tp) => tp.encounterId === encId && tp.userId === scorerId)
          ?.teamId ?? null;
    }

    state.goals.push({
      id: allocId(state),
      encounterId: encId,
      matchId: matchId && Number.isInteger(matchId) ? matchId : null,
      teamId,
      scorerId,
      assistId: assistId && assistId !== scorerId ? assistId : null,
      minuto,
      createdAt: new Date().toISOString(),
    });

    if (matchId && Number.isInteger(matchId) && teamId) {
      const m = state.matches.find((item) => item.id === matchId && item.encounterId === encId);
      if (m) {
        if (teamId === m.teamAId) m.goalsA += 1;
        else if (teamId === m.teamBId) m.goalsB += 1;
        m.winnerTeamId =
          m.status === 'finalizado'
            ? m.goalsA > m.goalsB
              ? m.teamAId
              : m.goalsB > m.goalsA
              ? m.teamBId
              : null
            : null;
      }
    }

    saveState(state);
    return { encounter: getEncounterSummaries(state, authUser.id).find((e) => e.id === encId) } as T;
  }

  match = pathname.match(/^\/api\/encounters\/(\d+)\/goals\/(\d+)$/);
  if (match && method === 'DELETE') {
    const encId = Number(match[1]);
    const goalId = Number(match[2]);
    const enc = state.encounters.find((e) => e.id === encId);
    if (!enc) throw new Error('Encontro não encontrado.');
    if (enc.status === 'finalizado' && authUser.role !== 'administrador') {
      throw new Error(
        'Apenas administradores podem remover gols após finalizar o encontro.'
      );
    }

    const goal = state.goals.find((g) => g.id === goalId && g.encounterId === encId);
    if (goal) {
      state.goals = state.goals.filter((g) => g.id !== goalId);
      if (goal.matchId && goal.teamId) {
        const m = state.matches.find(
          (item) => item.id === goal.matchId && item.encounterId === encId
        );
        if (m) {
          if (goal.teamId === m.teamAId) m.goalsA = Math.max(0, m.goalsA - 1);
          else if (goal.teamId === m.teamBId) m.goalsB = Math.max(0, m.goalsB - 1);
          m.winnerTeamId =
            m.status === 'finalizado'
              ? m.goalsA > m.goalsB
                ? m.teamAId
                : m.goalsB > m.goalsA
                ? m.teamBId
                : null
              : null;
        }
      }
    }

    saveState(state);
    return { encounter: getEncounterSummaries(state, authUser.id).find((e) => e.id === encId) } as T;
  }

  match = pathname.match(/^\/api\/encounters\/(\d+)\/votes$/);
  if (match && method === 'GET') {
    const encId = Number(match[1]);
    const myVotes: VoteRecord[] = state.votes
      .filter((v) => v.encounterId === encId && v.voterId === authUser.id)
      .map((v) => ({
        targetId: v.targetId,
        preparo: v.preparo,
        drible: v.drible,
        chute: v.chute,
        passe: v.passe,
        defesa: v.defesa,
        ataque: v.ataque,
      }));
    return { myVotes } as T;
  }

  if (match && method === 'POST') {
    const encId = Number(match[1]);
    const target = Number(body.targetId);
    if (!Number.isInteger(target) || target === authUser.id) {
      throw new Error('Você não pode votar em si mesmo.');
    }
    const enc = state.encounters.find((e) => e.id === encId);
    if (!enc) throw new Error('Encontro não encontrado.');
    if (!enc.votacaoAberta) {
      throw new Error('A votação ainda não foi aberta para este encontro.');
    }
    const targetAtt = state.attendance.find(
      (a) => a.encounterId === encId && a.userId === target && a.status === 'confirmado'
    );
    if (!targetAtt) {
      throw new Error('Só é possível avaliar jogadores que participaram deste encontro.');
    }

    const existingVote = state.votes.find(
      (v) => v.encounterId === encId && v.voterId === authUser.id && v.targetId === target
    );
    if (existingVote) {
      existingVote.preparo = clampScore(body.preparo, 6);
      existingVote.drible = clampScore(body.drible, 6);
      existingVote.chute = clampScore(body.chute, 6);
      existingVote.passe = clampScore(body.passe, 6);
      existingVote.defesa = clampScore(body.defesa, 6);
      existingVote.ataque = clampScore(body.ataque, 6);
      existingVote.createdAt = new Date().toISOString();
    } else {
      state.votes.push({
        id: allocId(state),
        encounterId: encId,
        voterId: authUser.id,
        targetId: target,
        preparo: clampScore(body.preparo, 6),
        drible: clampScore(body.drible, 6),
        chute: clampScore(body.chute, 6),
        passe: clampScore(body.passe, 6),
        defesa: clampScore(body.defesa, 6),
        ataque: clampScore(body.ataque, 6),
        createdAt: new Date().toISOString(),
      });
    }

    saveState(state);
    const targetUser = state.users.find((u) => u.id === target);
    return {
      saved: true,
      updatedTarget: targetUser ? mapUserToProfile(state, targetUser) : null,
    } as T;
  }

  if (pathname === '/api/notifications' && method === 'GET') {
    const encMap = new Map(state.encounters.map((e) => [e.id, e]));
    const notifications: NotificationItem[] = state.notifications
      .filter((n) => n.userId === authUser.id)
      .sort((a, b) => b.id - a.id)
      .slice(0, 60)
      .map((n) => {
        const enc = n.encounterId ? encMap.get(n.encounterId) : undefined;
        const att = n.encounterId
          ? state.attendance.find(
              (a) => a.encounterId === n.encounterId && a.userId === n.userId
            )
          : undefined;
        return {
          id: n.id,
          userId: n.userId,
          encounterId: n.encounterId,
          tipo: n.tipo,
          titulo: n.titulo,
          mensagem: n.mensagem,
          lida: n.lida,
          createdAt: n.createdAt,
          encounterTitulo: enc?.titulo ?? null,
          encounterDataHora: enc?.dataHora ?? null,
          encounterLocal: enc?.local ?? null,
          myAttendance: att?.status ?? null,
        };
      });
    return { notifications } as T;
  }

  match = pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
  if (match && method === 'PATCH') {
    const notifId = Number(match[1]);
    const n = state.notifications.find((item) => item.id === notifId && item.userId === authUser.id);
    if (n) n.lida = true;
    saveState(state);
    return { ok: true } as T;
  }

  if (pathname === '/api/notifications/read-all' && method === 'POST') {
    for (const n of state.notifications) {
      if (n.userId === authUser.id) n.lida = true;
    }
    saveState(state);
    return { ok: true } as T;
  }

  if (pathname === '/api/payments' && method === 'GET') {
    const mQuery = url.searchParams.get('month');
    const monthParam =
      mQuery && /^\d{4}-\d{2}$/.test(mQuery) ? mQuery : new Date().toISOString().slice(0, 7);

    const monthly = getMonthlyPayments(state, monthParam);
    const encMap = new Map(state.encounters.map((e) => [e.id, e]));
    const userMap = new Map(state.users.map((u) => [u.id, u]));

    const avulsos: AvulsoPaymentItem[] = state.attendance
      .filter((a) => {
        const u = userMap.get(a.userId);
        return u?.role === 'peladeiro_avulso' && a.status === 'confirmado';
      })
      .map((a) => {
        const enc = encMap.get(a.encounterId)!;
        const u = userMap.get(a.userId)!;
        return {
          attendanceId: a.id,
          encounterId: a.encounterId,
          encounterTitulo: enc?.titulo ?? 'Encontro',
          encounterDataHora: enc?.dataHora ?? '',
          userId: a.userId,
          username: u.username,
          displayName: u.displayName,
          valor: a.pagoAvulso && a.valorPago > 0 ? a.valorPago : enc?.valorAvulso ?? state.settings.valorAvulso,
          pagoAvulso: a.pagoAvulso,
          updatedAt: a.updatedAt,
        };
      })
      .sort(
        (a, b) =>
          b.encounterDataHora.localeCompare(a.encounterDataHora) ||
          a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' })
      );

    const mensalidadesPagas = monthly.filter((m) => m.status === 'pago').length;
    const mensalidadesPendentes = monthly.filter((m) => m.status === 'pendente').length;
    const totalMensalMes = monthly
      .filter((m) => m.status === 'pago')
      .reduce((s, m) => s + m.valor, 0);
    const avulsosMes = avulsos.filter((a) => a.encounterDataHora.startsWith(monthParam));
    const totalAvulsoMes = avulsosMes
      .filter((a) => a.pagoAvulso)
      .reduce((s, a) => s + a.valor, 0);

    return {
      month: monthParam,
      monthly,
      avulsos,
      settings: state.settings,
      summary: {
        totalArrecadadoMes: totalMensalMes + totalAvulsoMes,
        mensalidadesPagas,
        mensalidadesPendentes,
        avulsosPagos: avulsos.filter((a) => a.pagoAvulso).length,
        avulsosPendentes: avulsos.filter((a) => !a.pagoAvulso).length,
      },
    } as T;
  }

  if (pathname === '/api/payments/monthly' && method === 'POST') {
    requireAdmin();
    const userId = Number(body.userId);
    const competencia = body.competencia;
    const status = body.status;
    if (
      !Number.isInteger(userId) ||
      typeof competencia !== 'string' ||
      !/^\d{4}-\d{2}$/.test(competencia) ||
      !['pendente', 'pago', 'isento'].includes(String(status))
    ) {
      throw new Error('Dados de pagamento mensal inválidos.');
    }
    const amount = Number.isFinite(Number(body.valor))
      ? Math.max(0, Number(body.valor))
      : state.settings.valorMensalidade;
    const methodLabel =
      typeof body.metodo === 'string' && body.metodo.trim()
        ? body.metodo.trim().slice(0, 30)
        : 'Pix';
    const paidAt = status === 'pago' ? new Date().toISOString() : null;

    const existing = state.monthlyPayments.find(
      (mp) => mp.userId === userId && mp.competencia === competencia
    );
    if (existing) {
      existing.valor = amount;
      existing.status = status as 'pendente' | 'pago' | 'isento';
      existing.metodo = methodLabel;
      existing.paidAt = paidAt;
    } else {
      state.monthlyPayments.push({
        userId,
        competencia,
        valor: amount,
        status: status as 'pendente' | 'pago' | 'isento',
        metodo: methodLabel,
        paidAt,
      });
    }
    saveState(state);
    return { ok: true } as T;
  }

  if (pathname === '/api/payments/avulso' && method === 'POST') {
    requireAdmin();
    const attId = Number(body.attendanceId);
    if (!Number.isInteger(attId) || typeof body.pago !== 'boolean') {
      throw new Error('Dados de pagamento avulso inválidos.');
    }
    const att = state.attendance.find((a) => a.id === attId);
    if (!att) throw new Error('Registro de presença não encontrado.');
    const enc = state.encounters.find((e) => e.id === att.encounterId);
    const amount = body.pago
      ? Number.isFinite(Number(body.valor))
        ? Math.max(0, Number(body.valor))
        : enc?.valorAvulso ?? state.settings.valorAvulso
      : 0;
    att.pagoAvulso = body.pago;
    att.valorPago = amount;
    att.updatedAt = new Date().toISOString();
    saveState(state);
    return { ok: true } as T;
  }

  if (pathname === '/api/admin/settings' && method === 'PUT') {
    requireAdmin();
    if (typeof body.peladaNome === 'string') {
      state.settings.peladaNome = body.peladaNome.trim() || 'Pelada Quadra Livre';
    }
    if (body.valorMensalidade !== undefined && Number.isFinite(Number(body.valorMensalidade))) {
      state.settings.valorMensalidade = Math.max(0, Number(body.valorMensalidade));
    }
    if (body.valorAvulso !== undefined && Number.isFinite(Number(body.valorAvulso))) {
      state.settings.valorAvulso = Math.max(0, Number(body.valorAvulso));
    }
    if (body.jogadoresPorTime !== undefined && Number.isFinite(Number(body.jogadoresPorTime))) {
      state.settings.jogadoresPorTime = Math.min(
        10,
        Math.max(3, Math.round(Number(body.jogadoresPorTime)))
      );
    }
    saveState(state);
    return { settings: state.settings } as T;
  }

  if (pathname === '/api/dashboard' && method === 'GET') {
    return getDashboardData(state) as T;
  }

  throw new Error(`Operação não suportada (${method} ${pathname}).`);
}
