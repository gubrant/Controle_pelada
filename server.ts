import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import {
  db,
  ensureDefaultAdmin,
  getAllPlayerProfiles,
  getDashboardData,
  getEncounterSummaries,
  getMonthlyPayments,
  getRawUserByUsername,
  getSettings,
  getUserNotifications,
  getUserProfileById,
  updateSettings,
} from './src/db/database.ts';
import type { AttendanceStatus, EncounterStatus, UserProfile, UserRole } from './src/types.ts';

const PORT = 3000;

interface AuthenticatedRequest extends Request {
  authUser?: UserProfile;
}

function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const headerId = Number(req.headers['x-player-id']);
  let user = Number.isInteger(headerId) && headerId > 0 ? getUserProfileById(headerId) : null;
  if (!user) {
    const adminId = ensureDefaultAdmin();
    user = getUserProfileById(adminId);
  }
  req.authUser = user!;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || req.authUser.role !== 'administrador') {
    res.status(403).json({ error: 'Apenas administradores podem realizar esta ação.' });
    return;
  }
  next();
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/auth/status', (_req, res) => {
    const settings = getSettings();
    res.json({
      noLoginRequired: true,
      peladaNome: settings.peladaNome,
    });
  });

  // Quick self-registration (no login/password required)
  app.post('/api/auth/register', (req, res) => {
    const {
      username,
      displayName,
      idade,
      peso,
      altura,
      preparo,
      drible,
      chute,
      passe,
      defesa,
      ataque,
    } = req.body ?? {};

    const baseName =
      typeof displayName === 'string' && displayName.trim().length > 0
        ? displayName.trim().slice(0, 48)
        : typeof username === 'string'
        ? username.trim().slice(0, 48)
        : '';

    if (!baseName) {
      res.status(400).json({ error: 'Informe o nome ou apelido do jogador.' });
      return;
    }

    const rawHandle =
      typeof username === 'string' && username.trim().length >= 2
        ? username.trim()
        : baseName;

    let cleanUser = rawHandle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_.-]/g, '');

    if (cleanUser.length < 2) {
      cleanUser = `peladeiro_${crypto.randomInt(100, 999)}`;
    } else {
      cleanUser = cleanUser.slice(0, 24);
    }

    if (getRawUserByUsername(cleanUser)) {
      cleanUser = `${cleanUser.slice(0, 19)}_${crypto.randomInt(10, 99)}`;
    }

    const result = db
      .prepare(
        `INSERT INTO users (
          username, display_name, password_hash, role,
          idade, peso, altura,
          init_preparo, init_drible, init_chute, init_passe, init_defesa, init_ataque
        ) VALUES (?, ?, '', 'peladeiro_avulso', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        cleanUser,
        baseName,
        sanitizeOptionalNumber(idade, 10, 90),
        sanitizeOptionalNumber(peso, 35, 200),
        sanitizeOptionalNumber(altura, 120, 230),
        clampScore(preparo, 6),
        clampScore(drible, 6),
        clampScore(chute, 6),
        clampScore(passe, 6),
        clampScore(defesa, 6),
        clampScore(ataque, 6)
      );

    const newUserId = Number(result.lastInsertRowid);

    const openEncounters = db
      .prepare("SELECT id, titulo, data_hora, local FROM encounters WHERE status = 'aberto'")
      .all() as Array<{ id: number; titulo: string; data_hora: string; local: string }>;

    const insAtt = db.prepare(
      "INSERT OR IGNORE INTO attendance (encounter_id, user_id, status) VALUES (?, ?, 'pendente')"
    );
    const insNotif = db.prepare(
      `INSERT INTO notifications (user_id, encounter_id, tipo, titulo, mensagem)
       VALUES (?, ?, 'convocacao', ?, ?)`
    );

    for (const enc of openEncounters) {
      insAtt.run(enc.id, newUserId);
      insNotif.run(
        newUserId,
        enc.id,
        `Convocação: ${enc.titulo}`,
        `Pelada marcada para ${formatDatePtBr(enc.data_hora)} em ${enc.local}. Confirme sua presença!`
      );
    }

    const user = getUserProfileById(newUserId);
    res.status(201).json({ user });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser, settings: getSettings() });
  });

  // Update own profile
  app.put('/api/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const {
      displayName,
      idade,
      peso,
      altura,
      preparo,
      drible,
      chute,
      passe,
      defesa,
      ataque,
    } = req.body ?? {};

    const cleanName =
      typeof displayName === 'string' && displayName.trim().length > 0
        ? displayName.trim().slice(0, 48)
        : req.authUser!.displayName;

    db.prepare(
      `UPDATE users SET
        display_name = ?,
        idade = ?,
        peso = ?,
        altura = ?,
        init_preparo = ?,
        init_drible = ?,
        init_chute = ?,
        init_passe = ?,
        init_defesa = ?,
        init_ataque = ?
       WHERE id = ?`
    ).run(
      cleanName,
      sanitizeOptionalNumber(idade, 10, 90),
      sanitizeOptionalNumber(peso, 35, 200),
      sanitizeOptionalNumber(altura, 120, 230),
      clampScore(preparo, req.authUser!.initialCriteria.preparo),
      clampScore(drible, req.authUser!.initialCriteria.drible),
      clampScore(chute, req.authUser!.initialCriteria.chute),
      clampScore(passe, req.authUser!.initialCriteria.passe),
      clampScore(defesa, req.authUser!.initialCriteria.defesa),
      clampScore(ataque, req.authUser!.initialCriteria.ataque),
      userId
    );

    res.json({ user: getUserProfileById(userId) });
  });

  // Players list
  app.get('/api/players', requireAuth, (_req, res) => {
    res.json({ players: getAllPlayerProfiles() });
  });

  // Admin: create account
  app.post('/api/admin/players', requireAuth, requireAdmin, (req, res) => {
    const {
      username,
      displayName,
      role,
      idade,
      peso,
      altura,
      preparo,
      drible,
      chute,
      passe,
      defesa,
      ataque,
    } = req.body ?? {};

    const cleanName =
      typeof displayName === 'string' && displayName.trim().length > 0
        ? displayName.trim().slice(0, 48)
        : typeof username === 'string'
        ? username.trim().slice(0, 48)
        : '';

    if (!cleanName) {
      res.status(400).json({ error: 'Informe o nome do jogador.' });
      return;
    }

    const rawHandle =
      typeof username === 'string' && username.trim().length >= 2 ? username.trim() : cleanName;

    let cleanUser = rawHandle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_.-]/g, '')
      .slice(0, 24);

    if (cleanUser.length < 2) {
      cleanUser = `jogador_${crypto.randomInt(100, 999)}`;
    }
    if (getRawUserByUsername(cleanUser)) {
      cleanUser = `${cleanUser.slice(0, 19)}_${crypto.randomInt(10, 99)}`;
    }

    const validRoles: UserRole[] = ['administrador', 'peladeiro', 'peladeiro_avulso'];
    const targetRole: UserRole = validRoles.includes(role) ? role : 'peladeiro';

    const result = db
      .prepare(
        `INSERT INTO users (
          username, display_name, password_hash, role,
          idade, peso, altura,
          init_preparo, init_drible, init_chute, init_passe, init_defesa, init_ataque
        ) VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        cleanUser,
        cleanName,
        targetRole,
        sanitizeOptionalNumber(idade, 10, 90),
        sanitizeOptionalNumber(peso, 35, 200),
        sanitizeOptionalNumber(altura, 120, 230),
        clampScore(preparo, 6),
        clampScore(drible, 6),
        clampScore(chute, 6),
        clampScore(passe, 6),
        clampScore(defesa, 6),
        clampScore(ataque, 6)
      );

    const newId = Number(result.lastInsertRowid);
    const openEncounters = db
      .prepare("SELECT id, titulo, data_hora, local FROM encounters WHERE status = 'aberto'")
      .all() as Array<{ id: number; titulo: string; data_hora: string; local: string }>;
    for (const enc of openEncounters) {
      db.prepare(
        "INSERT OR IGNORE INTO attendance (encounter_id, user_id, status) VALUES (?, ?, 'pendente')"
      ).run(enc.id, newId);
      db.prepare(
        `INSERT INTO notifications (user_id, encounter_id, tipo, titulo, mensagem)
         VALUES (?, ?, 'convocacao', ?, ?)`
      ).run(
        newId,
        enc.id,
        `Convocação: ${enc.titulo}`,
        `Pelada marcada para ${formatDatePtBr(enc.data_hora)} em ${enc.local}. Confirme sua presença!`
      );
    }

    res.status(201).json({ player: getUserProfileById(newId) });
  });

  // Admin: promote / change role
  app.patch('/api/admin/players/:id/role', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const targetId = Number(req.params.id);
    const { role } = req.body ?? {};
    const validRoles: UserRole[] = ['administrador', 'peladeiro', 'peladeiro_avulso'];
    if (!Number.isInteger(targetId) || !validRoles.includes(role)) {
      res.status(400).json({ error: 'Perfil de participante inválido.' });
      return;
    }

    const target = getUserProfileById(targetId);
    if (!target) {
      res.status(404).json({ error: 'Jogador não encontrado.' });
      return;
    }

    if (target.role === 'administrador' && role !== 'administrador') {
      const adminCount = (
        db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'administrador'").get() as {
          cnt: number;
        }
      ).cnt;
      if (adminCount <= 1) {
        res.status(400).json({
          error: 'Não é possível rebaixar o único administrador do sistema.',
        });
        return;
      }
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetId);
    res.json({ player: getUserProfileById(targetId) });
  });

  // Admin: delete account
  app.delete('/api/admin/players/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId)) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    if (targetId === req.authUser!.id) {
      res.status(400).json({ error: 'Você não pode excluir a própria conta logada.' });
      return;
    }
    const target = getUserProfileById(targetId);
    if (!target) {
      res.status(404).json({ error: 'Jogador não encontrado.' });
      return;
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    res.json({ deleted: true });
  });

  // Encounters
  app.get('/api/encounters', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ encounters: getEncounterSummaries(req.authUser!.id) });
  });

  app.post('/api/encounters', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const { titulo, dataHora, local, valorAvulso } = req.body ?? {};
    if (typeof titulo !== 'string' || !titulo.trim() || typeof dataHora !== 'string' || !dataHora.trim()) {
      res.status(400).json({ error: 'Informe o título e a data/hora do encontro.' });
      return;
    }

    const settings = getSettings();
    const cleanLocal =
      typeof local === 'string' && local.trim() ? local.trim().slice(0, 80) : 'Quadra Principal';
    const avulsoPrice =
      valorAvulso !== undefined && Number.isFinite(Number(valorAvulso))
        ? Math.max(0, Number(valorAvulso))
        : settings.valorAvulso;

    const encId = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO encounters (titulo, data_hora, local, valor_avulso, status, votacao_aberta, created_by)
           VALUES (?, ?, ?, ?, 'aberto', 0, ?)`
        )
        .run(titulo.trim().slice(0, 80), dataHora.trim(), cleanLocal, avulsoPrice, req.authUser!.id);

      const newEncId = Number(result.lastInsertRowid);
      const users = db.prepare('SELECT id FROM users').all() as Array<{ id: number }>;

      const insAtt = db.prepare(
        "INSERT INTO attendance (encounter_id, user_id, status) VALUES (?, ?, 'pendente')"
      );
      const insNotif = db.prepare(
        `INSERT INTO notifications (user_id, encounter_id, tipo, titulo, mensagem)
         VALUES (?, ?, 'convocacao', ?, ?)`
      );

      for (const u of users) {
        insAtt.run(newEncId, u.id);
        insNotif.run(
          u.id,
          newEncId,
          `Convocação: ${titulo.trim()}`,
          `Pelada marcada para ${formatDatePtBr(dataHora)} em ${cleanLocal}. Confirme sua presença!`
        );
      }

      return newEncId;
    })();

    const encounters = getEncounterSummaries(req.authUser!.id);
    res.status(201).json({ encounter: encounters.find((e) => e.id === encId) });
  });

  app.patch('/api/encounters/:id/status', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const encId = Number(req.params.id);
    const { status, votacaoAberta } = req.body ?? {};
    const validStatuses: EncounterStatus[] = ['aberto', 'em_andamento', 'finalizado'];

    const existing = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId) as
      | { id: number; titulo: string; status: EncounterStatus; votacao_aberta: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Encontro não encontrado.' });
      return;
    }

    const nextStatus: EncounterStatus = validStatuses.includes(status) ? status : existing.status;
    const nextVoting =
      typeof votacaoAberta === 'boolean'
        ? votacaoAberta
          ? 1
          : 0
        : nextStatus === 'finalizado'
        ? 1
        : existing.votacao_aberta;

    db.prepare('UPDATE encounters SET status = ?, votacao_aberta = ? WHERE id = ?').run(
      nextStatus,
      nextVoting,
      encId
    );

    if (nextVoting === 1 && existing.votacao_aberta === 0) {
      const confirmed = db
        .prepare("SELECT user_id FROM attendance WHERE encounter_id = ? AND status = 'confirmado'")
        .all(encId) as Array<{ user_id: number }>;
      const insNotif = db.prepare(
        `INSERT INTO notifications (user_id, encounter_id, tipo, titulo, mensagem)
         VALUES (?, ?, 'votacao', ?, ?)`
      );
      for (const c of confirmed) {
        insNotif.run(
          c.user_id,
          encId,
          `Votação Aberta: ${existing.titulo}`,
          'A pelada terminou! Acesse a aba Votação para avaliar os critérios dos outros participantes.'
        );
      }
    }

    const encounters = getEncounterSummaries(req.authUser!.id);
    res.json({ encounter: encounters.find((e) => e.id === encId) });
  });

  app.delete('/api/encounters/:id', requireAuth, requireAdmin, (req, res) => {
    const encId = Number(req.params.id);
    db.prepare('DELETE FROM encounters WHERE id = ?').run(encId);
    res.json({ deleted: true });
  });

  // Confirm / Decline attendance
  app.post('/api/encounters/:id/attendance', requireAuth, (req: AuthenticatedRequest, res) => {
    const encId = Number(req.params.id);
    const { status, userId } = req.body ?? {};
    const validStatuses: AttendanceStatus[] = ['pendente', 'confirmado', 'recusado'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Status de presença inválido.' });
      return;
    }

    const targetUserId =
      req.authUser!.role === 'administrador' && Number.isInteger(Number(userId))
        ? Number(userId)
        : req.authUser!.id;

    const enc = db.prepare('SELECT id FROM encounters WHERE id = ?').get(encId);
    if (!enc) {
      res.status(404).json({ error: 'Encontro não encontrado.' });
      return;
    }

    db.prepare(
      `INSERT INTO attendance (encounter_id, user_id, status, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(encounter_id, user_id)
       DO UPDATE SET status = excluded.status, updated_at = datetime('now')`
    ).run(encId, targetUserId, status);

    if (targetUserId === req.authUser!.id && status !== 'pendente') {
      db.prepare(
        "UPDATE notifications SET lida = 1 WHERE user_id = ? AND encounter_id = ? AND tipo IN ('convocacao', 'lembrete')"
      ).run(req.authUser!.id, encId);
    }

    const encounters = getEncounterSummaries(req.authUser!.id);
    res.json({ encounter: encounters.find((e) => e.id === encId) });
  });

  // Send presence reminder notification
  app.post('/api/encounters/:id/remind', requireAuth, requireAdmin, (req, res) => {
    const encId = Number(req.params.id);
    const enc = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId) as
      | { id: number; titulo: string; data_hora: string; local: string }
      | undefined;
    if (!enc) {
      res.status(404).json({ error: 'Encontro não encontrado.' });
      return;
    }

    const pendingUsers = db
      .prepare(
        `SELECT u.id FROM users u
         LEFT JOIN attendance a ON a.user_id = u.id AND a.encounter_id = ?
         WHERE COALESCE(a.status, 'pendente') = 'pendente'`
      )
      .all(encId) as Array<{ id: number }>;

    const insNotif = db.prepare(
      `INSERT INTO notifications (user_id, encounter_id, tipo, titulo, mensagem)
       VALUES (?, ?, 'lembrete', ?, ?)`
    );

    for (const u of pendingUsers) {
      db.prepare(
        "INSERT OR IGNORE INTO attendance (encounter_id, user_id, status) VALUES (?, ?, 'pendente')"
      ).run(encId, u.id);
      insNotif.run(
        u.id,
        encId,
        `Lembrete de Presença: ${enc.titulo}`,
        `Ainda não recebemos sua confirmação para ${formatDatePtBr(enc.data_hora)} (${enc.local}). Confirme se vai jogar!`
      );
    }

    res.json({ notifiedCount: pendingUsers.length });
  });

  // Draw Teams
  app.post('/api/encounters/:id/draw-teams', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const encId = Number(req.params.id);
    const numTeams = Math.min(4, Math.max(2, Number(req.body?.numTeams) || 2));
    const mode = req.body?.mode === 'aleatorio' ? 'aleatorio' : 'equilibrado';

    const enc = db.prepare('SELECT id FROM encounters WHERE id = ?').get(encId);
    if (!enc) {
      res.status(404).json({ error: 'Encontro não encontrado.' });
      return;
    }

    const confirmedIds = (
      db
        .prepare("SELECT user_id FROM attendance WHERE encounter_id = ? AND status = 'confirmado'")
        .all(encId) as Array<{ user_id: number }>
    ).map((r) => r.user_id);

    if (confirmedIds.length < 2) {
      res.status(400).json({
        error: 'É necessário ter pelo menos 2 jogadores confirmados para sortear os times.',
      });
      return;
    }

    const allProfiles = new Map(getAllPlayerProfiles().map((p) => [p.id, p]));
    const confirmedPlayers = confirmedIds
      .map((id) => allProfiles.get(id))
      .filter((p): p is UserProfile => Boolean(p));

    const buckets: UserProfile[][] = Array.from({ length: numTeams }, () => []);

    if (mode === 'aleatorio') {
      const shuffled = [...confirmedPlayers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      shuffled.forEach((p, idx) => {
        buckets[idx % numTeams].push(p);
      });
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

    db.transaction(() => {
      db.prepare('DELETE FROM team_players WHERE encounter_id = ?').run(encId);
      db.prepare('DELETE FROM teams WHERE encounter_id = ?').run(encId);

      const insTeam = db.prepare(
        'INSERT INTO teams (encounter_id, nome, cor, ordem) VALUES (?, ?, ?, ?)'
      );
      const insTP = db.prepare(
        'INSERT INTO team_players (team_id, user_id, encounter_id) VALUES (?, ?, ?)'
      );

      for (let i = 0; i < numTeams; i++) {
        const preset = presets[i];
        const tRes = insTeam.run(encId, preset.nome, preset.cor, i + 1);
        const teamId = Number(tRes.lastInsertRowid);
        for (const p of buckets[i]) {
          insTP.run(teamId, p.id, encId);
        }
      }
    })();

    const encounters = getEncounterSummaries(req.authUser!.id);
    res.json({ encounter: encounters.find((e) => e.id === encId) });
  });

  // Move player between drawn teams
  app.post('/api/encounters/:id/move-player', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const encId = Number(req.params.id);
    const userId = Number(req.body?.userId);
    const targetTeamId = Number(req.body?.targetTeamId);

    const team = db
      .prepare('SELECT id FROM teams WHERE id = ? AND encounter_id = ?')
      .get(targetTeamId, encId);
    if (!team) {
      res.status(404).json({ error: 'Time de destino não encontrado.' });
      return;
    }

    db.prepare(
      `INSERT INTO team_players (team_id, user_id, encounter_id)
       VALUES (?, ?, ?)
       ON CONFLICT(encounter_id, user_id) DO UPDATE SET team_id = excluded.team_id`
    ).run(targetTeamId, userId, encId);

    const encounters = getEncounterSummaries(req.authUser!.id);
    res.json({ encounter: encounters.find((e) => e.id === encId) });
  });

  // Goals
  app.post('/api/encounters/:id/goals', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const encId = Number(req.params.id);
    const scorerId = Number(req.body?.scorerId);
    const assistId = req.body?.assistId ? Number(req.body.assistId) : null;
    const minuto = sanitizeOptionalNumber(req.body?.minuto, 1, 120);

    if (!Number.isInteger(scorerId)) {
      res.status(400).json({ error: 'Selecione o autor do gol.' });
      return;
    }

    let teamId: number | null = req.body?.teamId ? Number(req.body.teamId) : null;
    if (!teamId) {
      const tp = db
        .prepare('SELECT team_id FROM team_players WHERE encounter_id = ? AND user_id = ?')
        .get(encId, scorerId) as { team_id: number } | undefined;
      teamId = tp?.team_id ?? null;
    }

    db.prepare(
      `INSERT INTO goals (encounter_id, team_id, scorer_id, assist_id, minuto)
       VALUES (?, ?, ?, ?, ?)`
    ).run(encId, teamId, scorerId, assistId && assistId !== scorerId ? assistId : null, minuto);

    const encounters = getEncounterSummaries(req.authUser!.id);
    res.status(201).json({ encounter: encounters.find((e) => e.id === encId) });
  });

  app.delete('/api/encounters/:id/goals/:goalId', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const encId = Number(req.params.id);
    const goalId = Number(req.params.goalId);
    db.prepare('DELETE FROM goals WHERE id = ? AND encounter_id = ?').run(goalId, encId);
    const encounters = getEncounterSummaries(req.authUser!.id);
    res.json({ encounter: encounters.find((e) => e.id === encId) });
  });

  // Post-match voting
  app.get('/api/encounters/:id/votes', requireAuth, (req: AuthenticatedRequest, res) => {
    const encId = Number(req.params.id);
    const voterId = req.authUser!.id;

    const existingVotes = db
      .prepare(
        'SELECT target_id, preparo, drible, chute, passe, defesa, ataque FROM votes WHERE encounter_id = ? AND voter_id = ?'
      )
      .all(encId, voterId) as Array<{
      target_id: number;
      preparo: number;
      drible: number;
      chute: number;
      passe: number;
      defesa: number;
      ataque: number;
    }>;

    res.json({
      myVotes: existingVotes.map((v) => ({
        targetId: v.target_id,
        preparo: v.preparo,
        drible: v.drible,
        chute: v.chute,
        passe: v.passe,
        defesa: v.defesa,
        ataque: v.ataque,
      })),
    });
  });

  app.post('/api/encounters/:id/votes', requireAuth, (req: AuthenticatedRequest, res) => {
    const encId = Number(req.params.id);
    const voterId = req.authUser!.id;
    const { targetId, preparo, drible, chute, passe, defesa, ataque } = req.body ?? {};
    const target = Number(targetId);

    if (!Number.isInteger(target) || target === voterId) {
      res.status(400).json({ error: 'Você não pode votar em si mesmo.' });
      return;
    }

    const enc = db.prepare('SELECT id, votacao_aberta FROM encounters WHERE id = ?').get(encId) as
      | { id: number; votacao_aberta: number }
      | undefined;
    if (!enc) {
      res.status(404).json({ error: 'Encontro não encontrado.' });
      return;
    }
    if (enc.votacao_aberta !== 1) {
      res.status(400).json({ error: 'A votação ainda não foi aberta para este encontro.' });
      return;
    }

    const targetAtt = db
      .prepare("SELECT status FROM attendance WHERE encounter_id = ? AND user_id = ?")
      .get(encId, target) as { status: string } | undefined;
    if (!targetAtt || targetAtt.status !== 'confirmado') {
      res.status(400).json({
        error: 'Só é possível avaliar jogadores que participaram deste encontro.',
      });
      return;
    }

    db.prepare(
      `INSERT INTO votes (encounter_id, voter_id, target_id, preparo, drible, chute, passe, defesa, ataque)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(encounter_id, voter_id, target_id)
       DO UPDATE SET
         preparo = excluded.preparo,
         drible = excluded.drible,
         chute = excluded.chute,
         passe = excluded.passe,
         defesa = excluded.defesa,
         ataque = excluded.ataque,
         created_at = datetime('now')`
    ).run(
      encId,
      voterId,
      target,
      clampScore(preparo, 6),
      clampScore(drible, 6),
      clampScore(chute, 6),
      clampScore(passe, 6),
      clampScore(defesa, 6),
      clampScore(ataque, 6)
    );

    res.json({
      saved: true,
      updatedTarget: getUserProfileById(target),
    });
  });

  // Notifications
  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ notifications: getUserNotifications(req.authUser!.id) });
  });

  app.patch('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
    const notifId = Number(req.params.id);
    db.prepare('UPDATE notifications SET lida = 1 WHERE id = ? AND user_id = ?').run(
      notifId,
      req.authUser!.id
    );
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('UPDATE notifications SET lida = 1 WHERE user_id = ?').run(req.authUser!.id);
    res.json({ ok: true });
  });

  // Payments (Mensalidades & Avulsos)
  app.get('/api/payments', requireAuth, (req, res) => {
    const monthParam =
      typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
        ? req.query.month
        : new Date().toISOString().slice(0, 7);

    const monthly = getMonthlyPayments(monthParam);
    const avulsoRows = db
      .prepare(
        `SELECT a.id as attendance_id, a.encounter_id, e.titulo as encounter_titulo,
                e.data_hora as encounter_data_hora, e.valor_avulso,
                a.user_id, u.username, u.display_name, a.pago_avulso, a.valor_pago, a.updated_at
         FROM attendance a
         JOIN encounters e ON e.id = a.encounter_id
         JOIN users u ON u.id = a.user_id
         WHERE u.role = 'peladeiro_avulso' AND a.status = 'confirmado'
         ORDER BY e.data_hora DESC, u.display_name COLLATE NOCASE ASC`
      )
      .all() as Array<{
      attendance_id: number;
      encounter_id: number;
      encounter_titulo: string;
      encounter_data_hora: string;
      valor_avulso: number;
      user_id: number;
      username: string;
      display_name: string;
      pago_avulso: number;
      valor_pago: number;
      updated_at: string;
    }>;

    const avulsos = avulsoRows.map((r) => ({
      attendanceId: r.attendance_id,
      encounterId: r.encounter_id,
      encounterTitulo: r.encounter_titulo,
      encounterDataHora: r.encounter_data_hora,
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      valor: r.pago_avulso === 1 && r.valor_pago > 0 ? r.valor_pago : r.valor_avulso,
      pagoAvulso: r.pago_avulso === 1,
      updatedAt: r.updated_at,
    }));

    const mensalidadesPagas = monthly.filter((m) => m.status === 'pago').length;
    const mensalidadesPendentes = monthly.filter((m) => m.status === 'pendente').length;
    const totalMensalMes = monthly
      .filter((m) => m.status === 'pago')
      .reduce((s, m) => s + m.valor, 0);

    const avulsosMes = avulsos.filter((a) => a.encounterDataHora.startsWith(monthParam));
    const totalAvulsoMes = avulsosMes
      .filter((a) => a.pagoAvulso)
      .reduce((s, a) => s + a.valor, 0);

    res.json({
      month: monthParam,
      monthly,
      avulsos,
      settings: getSettings(),
      summary: {
        totalArrecadadoMes: totalMensalMes + totalAvulsoMes,
        mensalidadesPagas,
        mensalidadesPendentes,
        avulsosPagos: avulsos.filter((a) => a.pagoAvulso).length,
        avulsosPendentes: avulsos.filter((a) => !a.pagoAvulso).length,
      },
    });
  });

  app.post('/api/payments/monthly', requireAuth, requireAdmin, (req, res) => {
    const { userId, competencia, status, valor, metodo } = req.body ?? {};
    if (
      !Number.isInteger(Number(userId)) ||
      typeof competencia !== 'string' ||
      !/^\d{4}-\d{2}$/.test(competencia) ||
      !['pendente', 'pago', 'isento'].includes(status)
    ) {
      res.status(400).json({ error: 'Dados de pagamento mensal inválidos.' });
      return;
    }

    const settings = getSettings();
    const amount = Number.isFinite(Number(valor)) ? Math.max(0, Number(valor)) : settings.valorMensalidade;
    const method = typeof metodo === 'string' && metodo.trim() ? metodo.trim().slice(0, 30) : 'Pix';
    const paidAt = status === 'pago' ? new Date().toISOString() : null;

    db.prepare(
      `INSERT INTO monthly_payments (user_id, competencia, valor, status, metodo, paid_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, competencia)
       DO UPDATE SET valor = excluded.valor, status = excluded.status, metodo = excluded.metodo, paid_at = excluded.paid_at`
    ).run(Number(userId), competencia, amount, status, method, paidAt);

    res.json({ ok: true });
  });

  app.post('/api/payments/avulso', requireAuth, requireAdmin, (req, res) => {
    const { attendanceId, pago, valor } = req.body ?? {};
    const attId = Number(attendanceId);
    if (!Number.isInteger(attId) || typeof pago !== 'boolean') {
      res.status(400).json({ error: 'Dados de pagamento avulso inválidos.' });
      return;
    }

    const row = db
      .prepare(
        `SELECT a.id, e.valor_avulso FROM attendance a
         JOIN encounters e ON e.id = a.encounter_id
         WHERE a.id = ?`
      )
      .get(attId) as { id: number; valor_avulso: number } | undefined;

    if (!row) {
      res.status(404).json({ error: 'Registro de presença não encontrado.' });
      return;
    }

    const amount = pago
      ? Number.isFinite(Number(valor))
        ? Math.max(0, Number(valor))
        : row.valor_avulso
      : 0;

    db.prepare('UPDATE attendance SET pago_avulso = ?, valor_pago = ? WHERE id = ?').run(
      pago ? 1 : 0,
      amount,
      attId
    );

    res.json({ ok: true });
  });

  // Settings
  app.put('/api/admin/settings', requireAuth, requireAdmin, (req, res) => {
    const { peladaNome, valorMensalidade, valorAvulso, jogadoresPorTime } = req.body ?? {};
    const updated = updateSettings({
      peladaNome: typeof peladaNome === 'string' ? peladaNome : undefined,
      valorMensalidade:
        valorMensalidade !== undefined ? Number(valorMensalidade) : undefined,
      valorAvulso: valorAvulso !== undefined ? Number(valorAvulso) : undefined,
      jogadoresPorTime:
        jogadoresPorTime !== undefined ? Number(jogadoresPorTime) : undefined,
    });
    res.json({ settings: updated });
  });

  // Dashboard stats
  app.get('/api/dashboard', requireAuth, (_req, res) => {
    res.json(getDashboardData());
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quadra Livre server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
