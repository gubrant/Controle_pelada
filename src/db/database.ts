import Database from 'better-sqlite3';
import path from 'node:path';
import type {
  AttendanceRecord,
  AttendanceStatus,
  DashboardData,
  EncounterSummary,
  GoalRecord,
  MonthlyPaymentItem,
  NotificationItem,
  PeladaSettings,
  PlayerCriteria,
  TeamDraw,
  TeamPlayerItem,
  UserProfile,
  UserRole,
} from '../types.ts';

const dbPath = path.resolve(process.cwd(), 'pelada.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('administrador', 'peladeiro', 'peladeiro_avulso')) DEFAULT 'peladeiro_avulso',
    idade INTEGER,
    peso REAL,
    altura REAL,
    init_preparo REAL NOT NULL DEFAULT 6.0,
    init_drible REAL NOT NULL DEFAULT 6.0,
    init_chute REAL NOT NULL DEFAULT 6.0,
    init_passe REAL NOT NULL DEFAULT 6.0,
    init_defesa REAL NOT NULL DEFAULT 6.0,
    init_ataque REAL NOT NULL DEFAULT 6.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS encounters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    data_hora TEXT NOT NULL,
    local TEXT NOT NULL,
    valor_avulso REAL NOT NULL DEFAULT 25,
    status TEXT NOT NULL CHECK(status IN ('aberto', 'em_andamento', 'finalizado')) DEFAULT 'aberto',
    votacao_aberta INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id INTEGER NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('pendente', 'confirmado', 'recusado')) DEFAULT 'pendente',
    pago_avulso INTEGER NOT NULL DEFAULT 0,
    valor_pago REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(encounter_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id INTEGER NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    cor TEXT NOT NULL,
    ordem INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encounter_id INTEGER NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    UNIQUE(encounter_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id INTEGER NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    scorer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assist_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    minuto INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id INTEGER NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    voter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preparo REAL NOT NULL CHECK(preparo >= 1 AND preparo <= 10),
    drible REAL NOT NULL CHECK(drible >= 1 AND drible <= 10),
    chute REAL NOT NULL CHECK(chute >= 1 AND chute <= 10),
    passe REAL NOT NULL CHECK(passe >= 1 AND passe <= 10),
    defesa REAL NOT NULL CHECK(defesa >= 1 AND defesa <= 10),
    ataque REAL NOT NULL CHECK(ataque >= 1 AND ataque <= 10),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(encounter_id, voter_id, target_id),
    CHECK(voter_id != target_id)
  );

  CREATE TABLE IF NOT EXISTS monthly_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    competencia TEXT NOT NULL,
    valor REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pendente', 'pago', 'isento')) DEFAULT 'pendente',
    metodo TEXT DEFAULT 'Pix',
    paid_at TEXT,
    UNIQUE(user_id, competencia)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encounter_id INTEGER REFERENCES encounters(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK(tipo IN ('convocacao', 'lembrete', 'votacao', 'pagamento', 'sistema')),
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    lida INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const defaultSettings: Record<string, string> = {
  pelada_nome: 'Pelada Quadra Livre',
  valor_mensalidade: '80',
  valor_avulso: '25',
  jogadores_por_time: '5',
};

const insertSettingStmt = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
for (const [k, v] of Object.entries(defaultSettings)) {
  insertSettingStmt.run(k, v);
}

export function getSettings(): PeladaSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    peladaNome: map.get('pelada_nome') || 'Pelada Quadra Livre',
    valorMensalidade: Number(map.get('valor_mensalidade') || 80),
    valorAvulso: Number(map.get('valor_avulso') || 25),
    jogadoresPorTime: Number(map.get('jogadores_por_time') || 5),
  };
}

export function updateSettings(partial: Partial<PeladaSettings>): PeladaSettings {
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  if (partial.peladaNome !== undefined) {
    upsert.run('pelada_nome', partial.peladaNome.trim() || 'Pelada Quadra Livre');
  }
  if (partial.valorMensalidade !== undefined) {
    upsert.run('valor_mensalidade', String(Math.max(0, partial.valorMensalidade)));
  }
  if (partial.valorAvulso !== undefined) {
    upsert.run('valor_avulso', String(Math.max(0, partial.valorAvulso)));
  }
  if (partial.jogadoresPorTime !== undefined) {
    upsert.run(
      'jogadores_por_time',
      String(Math.min(10, Math.max(3, Math.round(partial.jogadoresPorTime))))
    );
  }
  return getSettings();
}

export function ensureDefaultAdmin(): number {
  const existingAdmin = db
    .prepare("SELECT id FROM users WHERE role = 'administrador' ORDER BY id ASC LIMIT 1")
    .get() as { id: number } | undefined;
  if (existingAdmin) {
    return existingAdmin.id;
  }
  const existingDidi = db
    .prepare("SELECT id FROM users WHERE lower(username) = 'didi'")
    .get() as { id: number } | undefined;
  if (existingDidi) {
    db.prepare("UPDATE users SET role = 'administrador' WHERE id = ?").run(existingDidi.id);
    return existingDidi.id;
  }
  const result = db
    .prepare(
      `INSERT INTO users (username, display_name, password_hash, role, init_preparo, init_drible, init_chute, init_passe, init_defesa, init_ataque)
       VALUES ('didi', 'Didi', '', 'administrador', 7, 7, 7, 7, 7, 7)`
    )
    .run();
  return Number(result.lastInsertRowid);
}

ensureDefaultAdmin();

interface RawUserRow {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  idade: number | null;
  peso: number | null;
  altura: number | null;
  init_preparo: number;
  init_drible: number;
  init_chute: number;
  init_passe: number;
  init_defesa: number;
  init_ataque: number;
  created_at: string;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function mapUserToProfile(row: RawUserRow): UserProfile {
  const recentEncounterVotes = db
    .prepare(
      `SELECT
        v.encounter_id,
        COUNT(*) as vote_count,
        AVG(v.preparo) as preparo,
        AVG(v.drible) as drible,
        AVG(v.chute) as chute,
        AVG(v.passe) as passe,
        AVG(v.defesa) as defesa,
        AVG(v.ataque) as ataque
      FROM votes v
      JOIN encounters e ON e.id = v.encounter_id
      JOIN attendance a ON a.encounter_id = v.encounter_id AND a.user_id = v.target_id
      WHERE v.target_id = ? AND a.status = 'confirmado'
      GROUP BY v.encounter_id
      ORDER BY e.data_hora DESC, e.id DESC
      LIMIT 5`
    )
    .all(row.id) as Array<{
    encounter_id: number;
    vote_count: number;
    preparo: number;
    drible: number;
    chute: number;
    passe: number;
    defesa: number;
    ataque: number;
  }>;

  const goalsCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM goals WHERE scorer_id = ?').get(row.id) as {
      cnt: number;
    }
  ).cnt;

  const assistsCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM goals WHERE assist_id = ?').get(row.id) as {
      cnt: number;
    }
  ).cnt;

  const presencesCount = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM attendance WHERE user_id = ? AND status = 'confirmado'")
      .get(row.id) as { cnt: number }
  ).cnt;

  const evaluatedEncountersCount = recentEncounterVotes.length;
  const hasPeerVotes = evaluatedEncountersCount > 0;
  const voteCount = recentEncounterVotes.reduce((sum, r) => sum + r.vote_count, 0);

  const criteria: PlayerCriteria = hasPeerVotes
    ? {
        preparo: round1(
          recentEncounterVotes.reduce((sum, r) => sum + r.preparo, 0) / evaluatedEncountersCount
        ),
        drible: round1(
          recentEncounterVotes.reduce((sum, r) => sum + r.drible, 0) / evaluatedEncountersCount
        ),
        chute: round1(
          recentEncounterVotes.reduce((sum, r) => sum + r.chute, 0) / evaluatedEncountersCount
        ),
        passe: round1(
          recentEncounterVotes.reduce((sum, r) => sum + r.passe, 0) / evaluatedEncountersCount
        ),
        defesa: round1(
          recentEncounterVotes.reduce((sum, r) => sum + r.defesa, 0) / evaluatedEncountersCount
        ),
        ataque: round1(
          recentEncounterVotes.reduce((sum, r) => sum + r.ataque, 0) / evaluatedEncountersCount
        ),
      }
    : {
        preparo: round1(row.init_preparo),
        drible: round1(row.init_drible),
        chute: round1(row.init_chute),
        passe: round1(row.init_passe),
        defesa: round1(row.init_defesa),
        ataque: round1(row.init_ataque),
      };

  const overall = hasPeerVotes
    ? round1(
        recentEncounterVotes.reduce(
          (sum, r) => sum + (r.preparo + r.drible + r.chute + r.passe + r.defesa + r.ataque) / 6,
          0
        ) / evaluatedEncountersCount
      )
    : round1(
        (criteria.preparo +
          criteria.drible +
          criteria.chute +
          criteria.passe +
          criteria.defesa +
          criteria.ataque) /
          6
      );

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    idade: row.idade,
    peso: row.peso,
    altura: row.altura,
    initialCriteria: {
      preparo: round1(row.init_preparo),
      drible: round1(row.init_drible),
      chute: round1(row.init_chute),
      passe: round1(row.init_passe),
      defesa: round1(row.init_defesa),
      ataque: round1(row.init_ataque),
    },
    stats: {
      totalGoals: goalsCount,
      totalAssists: assistsCount,
      totalPresences: presencesCount,
      voteCount,
      evaluatedEncountersCount,
      hasPeerVotes,
      overall,
      criteria,
    },
    createdAt: row.created_at,
  };
}

export function getUserProfileById(id: number): UserProfile | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as RawUserRow | undefined;
  return row ? mapUserToProfile(row) : null;
}

export function getRawUserByUsername(username: string): RawUserRow | undefined {
  return db
    .prepare('SELECT * FROM users WHERE lower(username) = lower(?)')
    .get(username.trim()) as RawUserRow | undefined;
}

export function getAllPlayerProfiles(): UserProfile[] {
  const rows = db
    .prepare('SELECT * FROM users ORDER BY display_name COLLATE NOCASE ASC')
    .all() as RawUserRow[];
  return rows.map(mapUserToProfile);
}

export function getEncounterSummaries(currentUserId: number): EncounterSummary[] {
  const encounters = db
    .prepare('SELECT * FROM encounters ORDER BY data_hora DESC, id DESC')
    .all() as Array<{
    id: number;
    titulo: string;
    data_hora: string;
    local: string;
    valor_avulso: number;
    status: 'aberto' | 'em_andamento' | 'finalizado';
    votacao_aberta: number;
    created_at: string;
  }>;

  const allProfiles = new Map(getAllPlayerProfiles().map((p) => [p.id, p]));

  return encounters.map((enc) => {
    const attRows = db
      .prepare(
        `SELECT a.*, u.username, u.display_name, u.role
         FROM attendance a
         JOIN users u ON u.id = a.user_id
         WHERE a.encounter_id = ?
         ORDER BY
           CASE a.status WHEN 'confirmado' THEN 0 WHEN 'pendente' THEN 1 ELSE 2 END,
           u.display_name COLLATE NOCASE ASC`
      )
      .all(enc.id) as Array<{
      id: number;
      encounter_id: number;
      user_id: number;
      username: string;
      display_name: string;
      role: UserRole;
      status: AttendanceStatus;
      pago_avulso: number;
      valor_pago: number;
      updated_at: string;
    }>;

    const attendance: AttendanceRecord[] = attRows.map((r) => ({
      id: r.id,
      encounterId: r.encounter_id,
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      role: r.role,
      status: r.status,
      pagoAvulso: r.pago_avulso === 1,
      valorPago: r.valor_pago,
      overall: allProfiles.get(r.user_id)?.stats.overall ?? 6.0,
      updatedAt: r.updated_at,
    }));

    const confirmedCount = attendance.filter((a) => a.status === 'confirmado').length;
    const pendingCount = attendance.filter((a) => a.status === 'pendente').length;
    const declinedCount = attendance.filter((a) => a.status === 'recusado').length;
    const myAtt =
      attendance.find((a) => a.userId === currentUserId)?.status ?? 'pendente';

    const teamRows = db
      .prepare('SELECT * FROM teams WHERE encounter_id = ? ORDER BY ordem ASC')
      .all(enc.id) as Array<{
      id: number;
      encounter_id: number;
      nome: string;
      cor: 'emerald' | 'slate' | 'amber' | 'sky';
      ordem: number;
    }>;

    const teams: TeamDraw[] = teamRows.map((t) => {
      const tpRows = db
        .prepare(
          `SELECT tp.user_id, u.username, u.display_name, u.role
           FROM team_players tp
           JOIN users u ON u.id = tp.user_id
           WHERE tp.team_id = ?
           ORDER BY u.display_name COLLATE NOCASE ASC`
        )
        .all(t.id) as Array<{
        user_id: number;
        username: string;
        display_name: string;
        role: UserRole;
      }>;

      const players: TeamPlayerItem[] = tpRows.map((tp) => {
        const prof = allProfiles.get(tp.user_id);
        return {
          userId: tp.user_id,
          username: tp.username,
          displayName: tp.display_name,
          role: tp.role,
          overall: prof?.stats.overall ?? 6.0,
          ataque: prof?.stats.criteria.ataque ?? 6.0,
          defesa: prof?.stats.criteria.defesa ?? 6.0,
        };
      });

      const count = players.length || 1;
      return {
        id: t.id,
        encounterId: t.encounter_id,
        nome: t.nome,
        cor: t.cor,
        ordem: t.ordem,
        players,
        avgOverall: round1(players.reduce((s, p) => s + p.overall, 0) / count),
        avgAtaque: round1(players.reduce((s, p) => s + p.ataque, 0) / count),
        avgDefesa: round1(players.reduce((s, p) => s + p.defesa, 0) / count),
      };
    });

    const goalRows = db
      .prepare(
        `SELECT g.*, t.nome as team_nome, s.display_name as scorer_name, a.display_name as assist_name
         FROM goals g
         LEFT JOIN teams t ON t.id = g.team_id
         JOIN users s ON s.id = g.scorer_id
         LEFT JOIN users a ON a.id = g.assist_id
         WHERE g.encounter_id = ?
         ORDER BY g.id DESC`
      )
      .all(enc.id) as Array<{
      id: number;
      encounter_id: number;
      team_id: number | null;
      team_nome: string | null;
      scorer_id: number;
      scorer_name: string;
      assist_id: number | null;
      assist_name: string | null;
      minuto: number | null;
      created_at: string;
    }>;

    const goals: GoalRecord[] = goalRows.map((g) => ({
      id: g.id,
      encounterId: g.encounter_id,
      teamId: g.team_id,
      teamNome: g.team_nome,
      scorerId: g.scorer_id,
      scorerName: g.scorer_name,
      assistId: g.assist_id,
      assistName: g.assist_name,
      minuto: g.minuto,
      createdAt: g.created_at,
    }));

    return {
      id: enc.id,
      titulo: enc.titulo,
      dataHora: enc.data_hora,
      local: enc.local,
      valorAvulso: enc.valor_avulso,
      status: enc.status,
      votacaoAberta: enc.votacao_aberta === 1,
      createdAt: enc.created_at,
      confirmedCount,
      pendingCount,
      declinedCount,
      myAttendance: myAtt,
      totalGoals: goals.length,
      attendance,
      teams,
      goals,
    };
  });
}

export function getUserNotifications(userId: number): NotificationItem[] {
  const rows = db
    .prepare(
      `SELECT n.*, e.titulo as encounter_titulo, e.data_hora as encounter_data_hora,
              e.local as encounter_local, a.status as my_attendance
       FROM notifications n
       LEFT JOIN encounters e ON e.id = n.encounter_id
       LEFT JOIN attendance a ON a.encounter_id = n.encounter_id AND a.user_id = n.user_id
       WHERE n.user_id = ?
       ORDER BY n.id DESC
       LIMIT 60`
    )
    .all(userId) as Array<{
    id: number;
    user_id: number;
    encounter_id: number | null;
    tipo: NotificationItem['tipo'];
    titulo: string;
    mensagem: string;
    lida: number;
    created_at: string;
    encounter_titulo: string | null;
    encounter_data_hora: string | null;
    encounter_local: string | null;
    my_attendance: AttendanceStatus | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    encounterId: r.encounter_id,
    tipo: r.tipo,
    titulo: r.titulo,
    mensagem: r.mensagem,
    lida: r.lida === 1,
    createdAt: r.created_at,
    encounterTitulo: r.encounter_titulo,
    encounterDataHora: r.encounter_data_hora,
    encounterLocal: r.encounter_local,
    myAttendance: r.my_attendance,
  }));
}

export function getMonthlyPayments(competencia: string): MonthlyPaymentItem[] {
  const settings = getSettings();
  const users = db
    .prepare(
      "SELECT id, username, display_name, role FROM users WHERE role IN ('administrador', 'peladeiro') ORDER BY display_name COLLATE NOCASE ASC"
    )
    .all() as Array<{
    id: number;
    username: string;
    display_name: string;
    role: UserRole;
  }>;

  const existing = db
    .prepare('SELECT * FROM monthly_payments WHERE competencia = ?')
    .all(competencia) as Array<{
    user_id: number;
    competencia: string;
    valor: number;
    status: 'pendente' | 'pago' | 'isento';
    metodo: string;
    paid_at: string | null;
  }>;
  const map = new Map(existing.map((e) => [e.user_id, e]));

  return users.map((u) => {
    const rec = map.get(u.id);
    return {
      userId: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      competencia,
      valor: rec?.valor ?? settings.valorMensalidade,
      status: rec?.status ?? 'pendente',
      metodo: rec?.metodo ?? 'Pix',
      paidAt: rec?.paid_at ?? null,
    };
  });
}

export function getDashboardData(): DashboardData {
  const profiles = getAllPlayerProfiles();
  const totalEncontros = (
    db.prepare('SELECT COUNT(*) as cnt FROM encounters').get() as { cnt: number }
  ).cnt;
  const encontrosFinalizados = (
    db.prepare("SELECT COUNT(*) as cnt FROM encounters WHERE status = 'finalizado'").get() as {
      cnt: number;
    }
  ).cnt;
  const totalGols = (db.prepare('SELECT COUNT(*) as cnt FROM goals').get() as { cnt: number }).cnt;

  const totalConfirmed = (
    db.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE status = 'confirmado'").get() as {
      cnt: number;
    }
  ).cnt;

  const currentMonth = new Date().toISOString().slice(0, 7);

  const mensalidadesTotal = (
    db
      .prepare("SELECT COALESCE(SUM(valor), 0) as total FROM monthly_payments WHERE status = 'pago'")
      .get() as { total: number }
  ).total;
  const avulsosTotal = (
    db
      .prepare('SELECT COALESCE(SUM(valor_pago), 0) as total FROM attendance WHERE pago_avulso = 1')
      .get() as { total: number }
  ).total;

  const mensalidadesMesAtual = (
    db
      .prepare(
        "SELECT COALESCE(SUM(valor), 0) as total FROM monthly_payments WHERE status = 'pago' AND competencia = ?"
      )
      .get(currentMonth) as { total: number }
  ).total;

  const avulsosMesAtual = (
    db
      .prepare(
        `SELECT COALESCE(SUM(a.valor_pago), 0) as total
         FROM attendance a
         JOIN encounters e ON e.id = a.encounter_id
         WHERE a.pago_avulso = 1 AND substr(e.data_hora, 1, 7) = ?`
      )
      .get(currentMonth) as { total: number }
  ).total;

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

  // Last 6 months revenue
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
    const mPaid = (
      db
        .prepare(
          "SELECT COALESCE(SUM(valor), 0) as total FROM monthly_payments WHERE status = 'pago' AND competencia = ?"
        )
        .get(ym) as { total: number }
    ).total;
    const aPaid = (
      db
        .prepare(
          `SELECT COALESCE(SUM(a.valor_pago), 0) as total
           FROM attendance a
           JOIN encounters e ON e.id = a.encounter_id
           WHERE a.pago_avulso = 1 AND substr(e.data_hora, 1, 7) = ?`
        )
        .get(ym) as { total: number }
    ).total;
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

  return {
    kpis: {
      totalEncontros,
      encontrosFinalizados,
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
    topRated,
    attendanceRanking,
    monthlyRevenue,
    leagueAverages,
  };
}
