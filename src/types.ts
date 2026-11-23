export type UserRole = 'administrador' | 'peladeiro' | 'peladeiro_avulso';

export type AttendanceStatus = 'pendente' | 'confirmado' | 'recusado';

export type EncounterStatus = 'aberto' | 'em_andamento' | 'finalizado';

export interface PlayerCriteria {
  preparo: number;
  drible: number;
  chute: number;
  passe: number;
  defesa: number;
  ataque: number;
}

export interface PlayerStats {
  totalGoals: number;
  totalAssists: number;
  totalPresences: number;
  voteCount: number;
  evaluatedEncountersCount: number;
  hasPeerVotes: boolean;
  overall: number;
  criteria: PlayerCriteria;
}

export interface UserProfile {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  idade: number | null;
  peso: number | null;
  altura: number | null;
  initialCriteria: PlayerCriteria;
  stats: PlayerStats;
  createdAt: string;
}

export interface AttendanceRecord {
  id: number;
  encounterId: number;
  userId: number;
  username: string;
  displayName: string;
  role: UserRole;
  status: AttendanceStatus;
  pagoAvulso: boolean;
  valorPago: number;
  overall: number;
  updatedAt: string;
}

export interface TeamPlayerItem {
  userId: number;
  username: string;
  displayName: string;
  role: UserRole;
  overall: number;
  ataque: number;
  defesa: number;
}

export interface TeamDraw {
  id: number;
  encounterId: number;
  nome: string;
  cor: 'emerald' | 'slate' | 'amber' | 'sky';
  ordem: number;
  players: TeamPlayerItem[];
  avgOverall: number;
  avgAtaque: number;
  avgDefesa: number;
}

export interface GoalRecord {
  id: number;
  encounterId: number;
  teamId: number | null;
  teamNome: string | null;
  scorerId: number;
  scorerName: string;
  assistId: number | null;
  assistName: string | null;
  minuto: number | null;
  createdAt: string;
}

export interface EncounterSummary {
  id: number;
  titulo: string;
  dataHora: string;
  local: string;
  valorAvulso: number;
  status: EncounterStatus;
  votacaoAberta: boolean;
  createdAt: string;
  confirmedCount: number;
  pendingCount: number;
  declinedCount: number;
  myAttendance: AttendanceStatus;
  totalGoals: number;
  attendance: AttendanceRecord[];
  teams: TeamDraw[];
  goals: GoalRecord[];
}

export interface NotificationItem {
  id: number;
  userId: number;
  encounterId: number | null;
  tipo: 'convocacao' | 'lembrete' | 'votacao' | 'pagamento' | 'sistema';
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: string;
  encounterTitulo: string | null;
  encounterDataHora: string | null;
  encounterLocal: string | null;
  myAttendance: AttendanceStatus | null;
}

export interface VoteRecord {
  targetId: number;
  preparo: number;
  drible: number;
  chute: number;
  passe: number;
  defesa: number;
  ataque: number;
}

export interface MonthlyPaymentItem {
  userId: number;
  username: string;
  displayName: string;
  role: UserRole;
  competencia: string;
  valor: number;
  status: 'pendente' | 'pago' | 'isento';
  metodo: string;
  paidAt: string | null;
}

export interface AvulsoPaymentItem {
  attendanceId: number;
  encounterId: number;
  encounterTitulo: string;
  encounterDataHora: string;
  userId: number;
  username: string;
  displayName: string;
  valor: number;
  pagoAvulso: boolean;
  updatedAt: string;
}

export interface PeladaSettings {
  peladaNome: string;
  valorMensalidade: number;
  valorAvulso: number;
  jogadoresPorTime: number;
}

export interface DashboardData {
  kpis: {
    totalEncontros: number;
    encontrosFinalizados: number;
    totalGols: number;
    mediaGolsPorEncontro: number;
    jogadoresAtivos: number;
    caixaTotal: number;
    caixaMesAtual: number;
    taxaPresencaMedia: number;
  };
  topScorers: Array<{
    userId: number;
    username: string;
    displayName: string;
    role: UserRole;
    gols: number;
    assistencias: number;
    presencas: number;
    mediaGols: number;
  }>;
  topRated: UserProfile[];
  attendanceRanking: Array<{
    userId: number;
    displayName: string;
    role: UserRole;
    presencas: number;
    totalEncontros: number;
  }>;
  monthlyRevenue: Array<{
    competencia: string;
    label: string;
    mensalidades: number;
    avulsos: number;
    total: number;
  }>;
  leagueAverages: PlayerCriteria;
}
