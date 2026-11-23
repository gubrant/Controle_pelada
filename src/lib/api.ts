import type {
  AttendanceStatus,
  DashboardData,
  EncounterStatus,
  EncounterSummary,
  MonthlyPaymentItem,
  NotificationItem,
  PeladaSettings,
  PlayerCriteria,
  UserProfile,
  UserRole,
  VoteRecord,
  AvulsoPaymentItem,
} from '../types.ts';

let activePlayerId: number | null = null;

export function setActivePlayerId(id: number | null) {
  activePlayerId = id;
}

export function getActivePlayerId(): number | null {
  return activePlayerId;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (activePlayerId !== null) {
    headers.set('X-Player-Id', String(activePlayerId));
  }

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erro na requisição (${res.status})`);
  }
  return data as T;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  administrador: 'Administrador',
  peladeiro: 'Peladeiro Fixo',
  peladeiro_avulso: 'Peladeiro Avulso',
};

export const STATUS_ENCOUNTER_LABELS: Record<EncounterStatus, string> = {
  aberto: 'Aberto para Confirmação',
  em_andamento: 'Em Andamento',
  finalizado: 'Finalizado',
};

export const CRITERIA_LABELS: Array<{ key: keyof PlayerCriteria; label: string; short: string }> = [
  { key: 'preparo', label: 'Preparo Físico', short: 'Preparo' },
  { key: 'drible', label: 'Drible', short: 'Drible' },
  { key: 'chute', label: 'Chute', short: 'Chute' },
  { key: 'passe', label: 'Passe', short: 'Passe' },
  { key: 'defesa', label: 'Capacidade de Defesa', short: 'Defesa' },
  { key: 'ataque', label: 'Capacidade de Ataque', short: 'Ataque' },
];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const api = {
  register: (payload: {
    username?: string;
    displayName: string;
    idade: number | null;
    peso: number | null;
    altura: number | null;
  } & PlayerCriteria) =>
    apiRequest<{ user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => apiRequest<{ user: UserProfile; settings: PeladaSettings }>('/api/auth/me'),

  updateProfile: (payload: {
    displayName: string;
    idade: number | null;
    peso: number | null;
    altura: number | null;
  } & PlayerCriteria) =>
    apiRequest<{ user: UserProfile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getPlayers: () => apiRequest<{ players: UserProfile[] }>('/api/players'),

  adminCreatePlayer: (payload: {
    username?: string;
    displayName: string;
    role: UserRole;
    idade: number | null;
    peso: number | null;
    altura: number | null;
  } & PlayerCriteria) =>
    apiRequest<{ player: UserProfile }>('/api/admin/players', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminUpdateRole: (userId: number, role: UserRole) =>
    apiRequest<{ player: UserProfile }>(`/api/admin/players/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  adminUpdateRatings: (
    userId: number,
    payload: ({ mode: 'manual' } & PlayerCriteria) | { mode: 'automatico' }
  ) =>
    apiRequest<{ player: UserProfile }>(`/api/admin/players/${userId}/ratings`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  adminDeletePlayer: (userId: number) =>
    apiRequest<{ deleted: boolean }>(`/api/admin/players/${userId}`, {
      method: 'DELETE',
    }),

  getEncounters: () => apiRequest<{ encounters: EncounterSummary[] }>('/api/encounters'),

  createEncounter: (payload: {
    titulo: string;
    dataHora: string;
    local: string;
    valorAvulso?: number;
  }) =>
    apiRequest<{ encounter: EncounterSummary }>('/api/encounters', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateEncounterStatus: (
    encounterId: number,
    status: EncounterStatus,
    votacaoAberta?: boolean
  ) =>
    apiRequest<{ encounter: EncounterSummary }>(`/api/encounters/${encounterId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, votacaoAberta }),
    }),

  deleteEncounter: (encounterId: number) =>
    apiRequest<{ deleted: boolean }>(`/api/encounters/${encounterId}`, {
      method: 'DELETE',
    }),

  setAttendance: (encounterId: number, status: AttendanceStatus, userId?: number) =>
    apiRequest<{ encounter: EncounterSummary }>(`/api/encounters/${encounterId}/attendance`, {
      method: 'POST',
      body: JSON.stringify({ status, userId }),
    }),

  remindPending: (encounterId: number) =>
    apiRequest<{ notifiedCount: number }>(`/api/encounters/${encounterId}/remind`, {
      method: 'POST',
    }),

  drawTeams: (encounterId: number, numTeams: number, mode: 'equilibrado' | 'aleatorio') =>
    apiRequest<{ encounter: EncounterSummary }>(`/api/encounters/${encounterId}/draw-teams`, {
      method: 'POST',
      body: JSON.stringify({ numTeams, mode }),
    }),

  movePlayer: (encounterId: number, userId: number, targetTeamId: number) =>
    apiRequest<{ encounter: EncounterSummary }>(`/api/encounters/${encounterId}/move-player`, {
      method: 'POST',
      body: JSON.stringify({ userId, targetTeamId }),
    }),

  createMatch: (
    encounterId: number,
    payload: {
      teamAId: number;
      teamBId: number;
      goalsA?: number;
      goalsB?: number;
      status?: 'em_andamento' | 'finalizado';
    }
  ) =>
    apiRequest<{ encounter: EncounterSummary }>(`/api/encounters/${encounterId}/matches`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMatch: (
    encounterId: number,
    matchId: number,
    payload: {
      goalsA?: number;
      goalsB?: number;
      status?: 'em_andamento' | 'finalizado';
    }
  ) =>
    apiRequest<{ encounter: EncounterSummary }>(
      `/api/encounters/${encounterId}/matches/${matchId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),

  deleteMatch: (encounterId: number, matchId: number) =>
    apiRequest<{ encounter: EncounterSummary }>(
      `/api/encounters/${encounterId}/matches/${matchId}`,
      { method: 'DELETE' }
    ),

  addGoal: (
    encounterId: number,
    payload: {
      scorerId: number;
      assistId?: number | null;
      teamId?: number | null;
      matchId?: number | null;
      minuto?: number | null;
    }
  ) =>
    apiRequest<{ encounter: EncounterSummary }>(`/api/encounters/${encounterId}/goals`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteGoal: (encounterId: number, goalId: number) =>
    apiRequest<{ encounter: EncounterSummary }>(
      `/api/encounters/${encounterId}/goals/${goalId}`,
      { method: 'DELETE' }
    ),

  getMyVotes: (encounterId: number) =>
    apiRequest<{ myVotes: VoteRecord[] }>(`/api/encounters/${encounterId}/votes`),

  submitVote: (encounterId: number, vote: VoteRecord) =>
    apiRequest<{ saved: boolean; updatedTarget: UserProfile }>(
      `/api/encounters/${encounterId}/votes`,
      {
        method: 'POST',
        body: JSON.stringify(vote),
      }
    ),

  getNotifications: () =>
    apiRequest<{ notifications: NotificationItem[] }>('/api/notifications'),

  markNotificationRead: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' }),

  markAllNotificationsRead: () =>
    apiRequest<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }),

  getPayments: (month: string) =>
    apiRequest<{
      month: string;
      monthly: MonthlyPaymentItem[];
      avulsos: AvulsoPaymentItem[];
      settings: PeladaSettings;
      summary: {
        totalArrecadadoMes: number;
        mensalidadesPagas: number;
        mensalidadesPendentes: number;
        avulsosPagos: number;
        avulsosPendentes: number;
      };
    }>(`/api/payments?month=${encodeURIComponent(month)}`),

  saveMonthlyPayment: (payload: {
    userId: number;
    competencia: string;
    status: 'pendente' | 'pago' | 'isento';
    valor?: number;
    metodo?: string;
  }) =>
    apiRequest<{ ok: boolean }>('/api/payments/monthly', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  saveAvulsoPayment: (payload: { attendanceId: number; pago: boolean; valor?: number }) =>
    apiRequest<{ ok: boolean }>('/api/payments/avulso', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSettings: (payload: Partial<PeladaSettings>) =>
    apiRequest<{ settings: PeladaSettings }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getDashboard: () => apiRequest<DashboardData>('/api/dashboard'),
};
