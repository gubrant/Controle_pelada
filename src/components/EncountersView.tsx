import { useEffect, useState, type FormEvent } from 'react';
import {
  BellRing,
  Check,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Shuffle,
  Trash2,
  Trophy,
  Users,
  X,
  Goal,
  Calendar,
  MapPin,
} from 'lucide-react';
import type {
  AttendanceStatus,
  EncounterStatus,
  EncounterSummary,
  MatchRecord,
  UserProfile,
} from '../types.ts';
import {
  ROLE_LABELS,
  STATUS_ENCOUNTER_LABELS,
  api,
  formatCurrency,
  formatDateTime,
} from '../lib/api.ts';

interface EncountersViewProps {
  encounters: EncounterSummary[];
  currentUser: UserProfile;
  defaultAvulso: number;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const TEAM_STYLES: Record<string, string> = {
  emerald: 'border-emerald-200 bg-emerald-50/40',
  slate: 'border-slate-300 bg-slate-100/60',
  amber: 'border-amber-200 bg-amber-50/40',
  sky: 'border-sky-200 bg-sky-50/40',
};

export function EncountersView({
  encounters,
  currentUser,
  defaultAvulso,
  onRefresh,
  onToast,
}: EncountersViewProps) {
  const isAdmin = currentUser.role === 'administrador';
  const [selectedId, setSelectedId] = useState<number | null>(encounters[0]?.id ?? null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form
  const [titulo, setTitulo] = useState('Pelada Semanal de Futsal');
  const [dataHora, setDataHora] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    d.setHours(20, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  });
  const [local, setLocal] = useState('Quadra Central');
  const [valorAvulso, setValorAvulso] = useState(String(defaultAvulso));
  const [creating, setCreating] = useState(false);

  // Draw controls
  const [numTeams, setNumTeams] = useState(2);
  const [drawMode, setDrawMode] = useState<'equilibrado' | 'aleatorio'>('equilibrado');
  const [drawing, setDrawing] = useState(false);

  // Match controls
  const [newTeamAId, setNewTeamAId] = useState<string>('');
  const [newTeamBId, setNewTeamBId] = useState<string>('');
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [updatingMatchId, setUpdatingMatchId] = useState<number | null>(null);

  // Goal form
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [goalTeamId, setGoalTeamId] = useState<string>('');
  const [scorerId, setScorerId] = useState<string>('');
  const [assistId, setAssistId] = useState<string>('');
  const [minuto, setMinuto] = useState<string>('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [confirmDeleteEnc, setConfirmDeleteEnc] = useState(false);

  useEffect(() => {
    if (encounters.length > 0 && !encounters.some((e) => e.id === selectedId)) {
      setSelectedId(encounters[0].id);
    } else if (encounters.length === 0) {
      setSelectedId(null);
    }
    setConfirmDeleteEnc(false);
  }, [encounters, selectedId]);

  const active = encounters.find((e) => e.id === selectedId) ?? encounters[0] ?? null;

  useEffect(() => {
    if (!active) return;
    if (active.teams.length >= 2) {
      if (!active.teams.some((t) => String(t.id) === newTeamAId)) {
        setNewTeamAId(String(active.teams[0].id));
      }
      if (!active.teams.some((t) => String(t.id) === newTeamBId) || newTeamBId === newTeamAId) {
        const second = active.teams.find((t) => String(t.id) !== newTeamAId) ?? active.teams[1];
        setNewTeamBId(String(second.id));
      }
    } else {
      setNewTeamAId('');
      setNewTeamBId('');
    }

    const liveMatch = active.matches.find((m) => m.status === 'em_andamento');
    if (liveMatch && (!selectedMatchId || !active.matches.some((m) => String(m.id) === selectedMatchId))) {
      setSelectedMatchId(String(liveMatch.id));
    } else if (selectedMatchId && !active.matches.some((m) => String(m.id) === selectedMatchId)) {
      setSelectedMatchId('');
    }
  }, [active?.id, active?.teams.length, active?.matches.length]);

  const canEditMatchData = Boolean(active && (active.status !== 'finalizado' || isAdmin));

  const handleCreateEncounter = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.createEncounter({
        titulo,
        dataHora,
        local,
        valorAvulso: Number(valorAvulso) || defaultAvulso,
      });
      await onRefresh();
      if (res.encounter) setSelectedId(res.encounter.id);
      setShowCreateModal(false);
      onToast('Encontro criado e notificações enviadas a todos os peladeiros!');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao criar encontro.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleSetAttendance = async (status: AttendanceStatus, userId?: number) => {
    if (!active) return;
    try {
      await api.setAttendance(active.id, status, userId);
      await onRefresh();
      onToast(
        status === 'confirmado'
          ? 'Presença confirmada!'
          : status === 'recusado'
          ? 'Ausência registrada.'
          : 'Status atualizado para pendente.'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar presença.', 'error');
    }
  };

  const handleRemind = async () => {
    if (!active) return;
    try {
      const res = await api.remindPending(active.id);
      onToast(
        res.notifiedCount > 0
          ? `Lembrete enviado para ${res.notifiedCount} jogador(es) pendente(s).`
          : 'Todos os jogadores já responderam à convocação.'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao enviar lembretes.', 'error');
    }
  };

  const handleDrawTeams = async () => {
    if (!active) return;
    setDrawing(true);
    try {
      await api.drawTeams(active.id, numTeams, drawMode);
      await onRefresh();
      onToast('Times sorteados com sucesso!');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao sortear times.', 'error');
    } finally {
      setDrawing(false);
    }
  };

  const handleMovePlayer = async (userId: number, targetTeamId: number) => {
    if (!active) return;
    try {
      await api.movePlayer(active.id, userId, targetTeamId);
      await onRefresh();
      onToast('Jogador movido de time.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao mover jogador.', 'error');
    }
  };

  const handleCreateMatch = async (e: FormEvent) => {
    e.preventDefault();
    if (!active || !newTeamAId || !newTeamBId) return;
    if (newTeamAId === newTeamBId) {
      onToast('Selecione dois times diferentes para a partida.', 'error');
      return;
    }
    setCreatingMatch(true);
    try {
      const res = await api.createMatch(active.id, {
        teamAId: Number(newTeamAId),
        teamBId: Number(newTeamBId),
      });
      const created = res.encounter?.matches[0];
      if (created) {
        setSelectedMatchId(String(created.id));
      }
      await onRefresh();
      onToast('Partida iniciada! Preencha o placar, gols e assistências.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao iniciar partida.', 'error');
    } finally {
      setCreatingMatch(false);
    }
  };

  const handleUpdateMatchScore = async (
    match: MatchRecord,
    nextGoalsA: number,
    nextGoalsB: number
  ) => {
    if (!active) return;
    setUpdatingMatchId(match.id);
    try {
      await api.updateMatch(active.id, match.id, {
        goalsA: Math.max(0, nextGoalsA),
        goalsB: Math.max(0, nextGoalsB),
      });
      await onRefresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar placar.', 'error');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const handleToggleMatchStatus = async (
    match: MatchRecord,
    nextStatus: 'em_andamento' | 'finalizado'
  ) => {
    if (!active) return;
    setUpdatingMatchId(match.id);
    try {
      await api.updateMatch(active.id, match.id, { status: nextStatus });
      await onRefresh();
      onToast(
        nextStatus === 'finalizado'
          ? match.goalsA === match.goalsB
            ? 'Partida finalizada com empate!'
            : 'Partida finalizada e vitória contabilizada para o time!'
          : 'Partida reaberta para ajustes.'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar partida.', 'error');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const handleDeleteMatch = async (matchId: number) => {
    if (!active) return;
    setUpdatingMatchId(matchId);
    try {
      await api.deleteMatch(active.id, matchId);
      if (String(matchId) === selectedMatchId) {
        setSelectedMatchId('');
      }
      await onRefresh();
      onToast('Partida removida.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao remover partida.', 'error');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const handleAddGoal = async (e: FormEvent) => {
    e.preventDefault();
    if (!active || !scorerId) return;
    setSavingGoal(true);
    try {
      await api.addGoal(active.id, {
        scorerId: Number(scorerId),
        assistId: assistId ? Number(assistId) : null,
        teamId: goalTeamId ? Number(goalTeamId) : null,
        matchId: selectedMatchId ? Number(selectedMatchId) : null,
        minuto: minuto ? Number(minuto) : null,
      });
      setMinuto('');
      setAssistId('');
      await onRefresh();
      onToast('Gol e assistência registrados!');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao registrar gol.', 'error');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    if (!active) return;
    try {
      await api.deleteGoal(active.id, goalId);
      await onRefresh();
      onToast('Gol removido.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao remover gol.', 'error');
    }
  };

  const handleChangeStatus = async (status: EncounterStatus) => {
    if (!active) return;
    try {
      await api.updateEncounterStatus(active.id, status, status === 'finalizado' ? true : undefined);
      await onRefresh();
      onToast(
        status === 'finalizado'
          ? 'Pelada finalizada e votação pós-jogo liberada!'
          : `Status atualizado para ${STATUS_ENCOUNTER_LABELS[status]}.`
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar status.', 'error');
    }
  };

  const handleDeleteEncounter = async () => {
    if (!active) return;
    try {
      await api.deleteEncounter(active.id);
      setConfirmDeleteEnc(false);
      await onRefresh();
      onToast('Encontro excluído.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao excluir encontro.', 'error');
    }
  };

  const confirmedPlayers = active?.attendance.filter((a) => a.status === 'confirmado') ?? [];
  const selectedMatch = active?.matches.find((m) => String(m.id) === selectedMatchId) ?? null;

  const sortedTeamsStandings = active
    ? [...active.teams].sort(
        (a, b) =>
          b.wins - a.wins ||
          b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
          b.goalsFor - a.goalsFor ||
          a.ordem - b.ordem
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Barra superior dos encontros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {encounters.map((enc) => (
            <button
              key={enc.id}
              type="button"
              onClick={() => setSelectedId(enc.id)}
              className={`min-h-[42px] rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap border transition-colors ${
                active?.id === enc.id
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {enc.titulo} · {new Date(enc.dataHora).toLocaleDateString('pt-BR')}
            </button>
          ))}
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 whitespace-nowrap transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Encontro</span>
          </button>
        )}
      </div>

      {!active ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <Calendar className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="font-display text-lg font-bold text-slate-900">
            Nenhum encontro da pelada cadastrado
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {isAdmin
              ? 'Crie o primeiro encontro para convocar os peladeiros, sortear os times e registrar os gols.'
              : 'O administrador ainda não agendou o próximo encontro.'}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>Agendar Primeiro Encontro</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Cabeçalho do encontro ativo */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="font-semibold text-emerald-700">
                    {STATUS_ENCOUNTER_LABELS[active.status]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {active.local}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Avulso: {formatCurrency(active.valorAvulso)}</span>
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
                  {active.titulo}
                </h2>
                <p className="text-sm text-slate-600 tabular-nums">
                  {formatDateTime(active.dataHora)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {active.status !== 'finalizado' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSetAttendance('confirmado')}
                      className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                        active.myAttendance === 'confirmado'
                          ? 'bg-emerald-600 text-white'
                          : 'border border-emerald-600 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                      <span>
                        {active.myAttendance === 'confirmado' ? 'Estou Confirmado' : 'Confirmar Presença'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAttendance('recusado')}
                      className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap border transition-colors ${
                        active.myAttendance === 'recusado'
                          ? 'border-red-600 bg-red-600 text-white'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <X className="h-4 w-4" />
                      <span>Não Vou</span>
                    </button>
                  </>
                )}

                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-slate-200 sm:pl-2.5">
                    <select
                      aria-label="Status do encontro"
                      value={active.status}
                      onChange={(e) => handleChangeStatus(e.target.value as EncounterStatus)}
                      className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="aberto">Aberto</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="finalizado">Finalizado (Abrir Votação)</option>
                    </select>

                    {!confirmDeleteEnc ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteEnc(true)}
                        title="Excluir encontro"
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDeleteEncounter}
                        className="min-h-[44px] rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap"
                      >
                        Confirmar Exclusão
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Lista de Presença */}
            <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Lista de Presença
                  </h3>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {active.confirmedCount} confirmados · {active.pendingCount} pendentes ·{' '}
                    {active.declinedCount} ausentes
                  </p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleRemind}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <BellRing className="h-3.5 w-3.5 text-amber-600" />
                    <span>Notificar Pendentes</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
                {active.attendance.map((att) => (
                  <div
                    key={att.userId}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {att.displayName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {ROLE_LABELS[att.role]} · Nota{' '}
                        <span className="font-mono font-semibold text-slate-700 tabular-nums">
                          {att.overall.toFixed(1)}
                        </span>
                      </p>
                    </div>

                    {isAdmin ? (
                      <select
                        aria-label={`Presença de ${att.displayName}`}
                        value={att.status}
                        onChange={(e) =>
                          handleSetAttendance(e.target.value as AttendanceStatus, att.userId)
                        }
                        className={`min-h-[38px] rounded-lg border px-2.5 py-1.5 text-xs font-semibold focus:outline-none ${
                          att.status === 'confirmado'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : att.status === 'recusado'
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        <option value="confirmado">Confirmado</option>
                        <option value="pendente">Pendente</option>
                        <option value="recusado">Não Vai</option>
                      </select>
                    ) : (
                      <span
                        className={`text-xs font-semibold whitespace-nowrap ${
                          att.status === 'confirmado'
                            ? 'text-emerald-700'
                            : att.status === 'recusado'
                            ? 'text-red-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {att.status === 'confirmado'
                          ? 'Confirmado'
                          : att.status === 'recusado'
                          ? 'Ausente'
                          : 'Pendente'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Sorteio de Times, Partidas ao Vivo e Gols */}
            <div className="lg:col-span-7 space-y-6">
              {/* Sorteio */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Sorteio de Times (Futsal)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Distribui os {confirmedPlayers.length} jogadores confirmados por equilíbrio
                      técnico ou aleatório
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Quantidade de times"
                        value={numTeams}
                        onChange={(e) => setNumTeams(Number(e.target.value))}
                        className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        <option value={2}>2 Times</option>
                        <option value={3}>3 Times</option>
                        <option value={4}>4 Times</option>
                      </select>
                      <select
                        aria-label="Modo de sorteio"
                        value={drawMode}
                        onChange={(e) =>
                          setDrawMode(e.target.value as 'equilibrado' | 'aleatorio')
                        }
                        className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        <option value="equilibrado">Equilibrado (Nota)</option>
                        <option value="aleatorio">Aleatório</option>
                      </select>
                      <button
                        type="button"
                        disabled={drawing || confirmedPlayers.length < 2}
                        onClick={handleDrawTeams}
                        className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap transition-colors"
                      >
                        <Shuffle className="h-3.5 w-3.5" />
                        <span>{drawing ? 'Sorteando...' : 'Sortear Times'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {active.teams.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                    <Users className="mx-auto mb-2 h-7 w-7 text-slate-400" />
                    Nenhum time sorteado ainda para este encontro.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {active.teams.map((team) => {
                      const teamGoals = active.goals.filter((g) => g.teamId === team.id).length;
                      return (
                        <div
                          key={team.id}
                          className={`rounded-xl border p-4 ${
                            TEAM_STYLES[team.cor] || 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3 gap-2">
                            <div className="min-w-0">
                              <h4 className="font-display text-sm font-bold text-slate-900 truncate">
                                {team.nome}
                              </h4>
                              <p className="text-[11px] text-slate-600 tabular-nums">
                                Média {team.avgOverall.toFixed(1)} · Atq {team.avgAtaque.toFixed(1)} ·
                                Def {team.avgDefesa.toFixed(1)}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono text-lg font-bold text-emerald-700 tabular-nums">
                                {team.wins}V
                              </span>
                              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                                {Math.max(team.goalsFor, teamGoals)} gols
                              </p>
                            </div>
                          </div>

                          <ul className="space-y-1.5">
                            {team.players.map((p) => (
                              <li
                                key={p.userId}
                                className="flex items-center justify-between gap-2 text-xs bg-white/80 rounded-lg px-2.5 py-1.5 border border-slate-200/70"
                              >
                                <span className="font-medium text-slate-900 truncate">
                                  {p.displayName}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                                    {p.overall.toFixed(1)}
                                  </span>
                                  {isAdmin && active.teams.length > 1 && (
                                    <select
                                      aria-label={`Mover ${p.displayName}`}
                                      value={team.id}
                                      onChange={(e) =>
                                        handleMovePlayer(p.userId, Number(e.target.value))
                                      }
                                      className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-600"
                                    >
                                      {active.teams.map((opt) => (
                                        <option key={opt.id} value={opt.id}>
                                          {opt.nome.split(' — ')[0]}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Partidas em Quadra, Placar & Vitórias dos Times */}
              {active.teams.length >= 2 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg font-bold text-slate-900">
                        Partidas & Vitórias dos Times
                      </h3>
                      <p className="text-xs text-slate-500">
                        Qualquer participante pode preencher o placar durante a partida e encerrar para contabilizar vitórias.
                      </p>
                    </div>
                    <Trophy className="h-5 w-5 text-amber-600 shrink-0" />
                  </div>

                  {/* Tabela de Vitórias dos Times */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                        <tr>
                          <th className="px-3.5 py-2.5">Time</th>
                          <th className="px-2.5 py-2.5 text-center" title="Vitórias">V</th>
                          <th className="px-2.5 py-2.5 text-center" title="Empates">E</th>
                          <th className="px-2.5 py-2.5 text-center" title="Derrotas">D</th>
                          <th className="px-2.5 py-2.5 text-center" title="Gols Pró">GP</th>
                          <th className="px-2.5 py-2.5 text-center" title="Gols Contra">GC</th>
                          <th className="px-3 py-2.5 text-right" title="Saldo de Gols">SG</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedTeamsStandings.map((t) => {
                          const sg = t.goalsFor - t.goalsAgainst;
                          return (
                            <tr key={t.id} className="hover:bg-slate-50/70">
                              <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                                {t.nome}
                              </td>
                              <td className="px-2.5 py-2.5 text-center font-mono font-bold text-emerald-700 tabular-nums">
                                {t.wins}
                              </td>
                              <td className="px-2.5 py-2.5 text-center font-mono text-slate-600 tabular-nums">
                                {t.draws}
                              </td>
                              <td className="px-2.5 py-2.5 text-center font-mono text-slate-600 tabular-nums">
                                {t.losses}
                              </td>
                              <td className="px-2.5 py-2.5 text-center font-mono text-slate-700 tabular-nums">
                                {t.goalsFor}
                              </td>
                              <td className="px-2.5 py-2.5 text-center font-mono text-slate-700 tabular-nums">
                                {t.goalsAgainst}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800 tabular-nums">
                                {sg > 0 ? `+${sg}` : sg}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Iniciar nova partida */}
                  {canEditMatchData && (
                    <form
                      onSubmit={handleCreateMatch}
                      className="grid gap-2.5 sm:grid-cols-12 items-end rounded-xl bg-slate-50 p-3.5 border border-slate-200"
                    >
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Time Mandante
                        </label>
                        <select
                          value={newTeamAId}
                          onChange={(e) => setNewTeamAId(e.target.value)}
                          className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900"
                        >
                          {active.teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Time Visitante
                        </label>
                        <select
                          value={newTeamBId}
                          onChange={(e) => setNewTeamBId(e.target.value)}
                          className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900"
                        >
                          {active.teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-4">
                        <button
                          type="submit"
                          disabled={creatingMatch || newTeamAId === newTeamBId}
                          className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>{creatingMatch ? 'Iniciando...' : 'Iniciar Partida'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Lista de Partidas */}
                  {active.matches.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-500">
                      Nenhuma partida iniciada ainda. Clique em "Iniciar Partida" para registrar o placar e contabilizar vitórias.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {active.matches.map((match, idx) => {
                        const isBusy = updatingMatchId === match.id;
                        const matchNumber = active.matches.length - idx;
                        const isLive = match.status === 'em_andamento';
                        return (
                          <div
                            key={match.id}
                            className={`rounded-xl border p-4 space-y-3 transition-colors ${
                              isLive
                                ? 'border-emerald-300 bg-emerald-50/35'
                                : 'border-slate-200 bg-slate-50/60'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 font-semibold">
                                <span className="font-mono text-slate-500">#{matchNumber}</span>
                                <span
                                  className={
                                    isLive ? 'text-emerald-700' : 'text-slate-700'
                                  }
                                >
                                  {isLive
                                    ? 'Partida em andamento'
                                    : match.winnerTeamNome
                                    ? `Vitória: ${match.winnerTeamNome}`
                                    : 'Finalizada · Empate'}
                                </span>
                              </div>
                              {canEditMatchData && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleDeleteMatch(match.id)}
                                  title="Excluir partida"
                                  className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Placar com controles touch + / - */}
                            <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-3">
                              <div className="sm:col-span-4 flex items-center justify-between sm:justify-end gap-2">
                                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                  {match.teamANome.split(' — ')[0]}
                                </span>
                                {canEditMatchData && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={isBusy || match.goalsA <= 0}
                                      onClick={() =>
                                        handleUpdateMatchScore(match, match.goalsA - 1, match.goalsB)
                                      }
                                      aria-label={`Diminuir placar ${match.teamANome}`}
                                      className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                                    >
                                      <Minus className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        handleUpdateMatchScore(match, match.goalsA + 1, match.goalsB)
                                      }
                                      aria-label={`Aumentar placar ${match.teamANome}`}
                                      className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="sm:col-span-3 flex items-center justify-center gap-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                                <span>{match.goalsA}</span>
                                <span className="text-sm font-normal text-slate-400">×</span>
                                <span>{match.goalsB}</span>
                              </div>

                              <div className="sm:col-span-4 flex items-center justify-between sm:justify-start gap-2">
                                {canEditMatchData && (
                                  <div className="flex items-center gap-1 shrink-0 order-2 sm:order-1">
                                    <button
                                      type="button"
                                      disabled={isBusy || match.goalsB <= 0}
                                      onClick={() =>
                                        handleUpdateMatchScore(match, match.goalsA, match.goalsB - 1)
                                      }
                                      aria-label={`Diminuir placar ${match.teamBNome}`}
                                      className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                                    >
                                      <Minus className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        handleUpdateMatchScore(match, match.goalsA, match.goalsB + 1)
                                      }
                                      aria-label={`Aumentar placar ${match.teamBNome}`}
                                      className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate order-1 sm:order-2">
                                  {match.teamBNome.split(' — ')[0]}
                                </span>
                              </div>
                            </div>

                            {canEditMatchData && (
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMatchId(String(match.id));
                                    setGoalTeamId(String(match.teamAId));
                                  }}
                                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  <Goal className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Lançar Gol / Assistência</span>
                                </button>

                                {isLive ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleToggleMatchStatus(match, 'finalizado')}
                                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Encerrar e Contabilizar Vitória</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleToggleMatchStatus(match, 'em_andamento')}
                                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span>Reabrir Placar</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* Controle de Gols e Assistências */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Gols e Assistências da Partida
                    </h3>
                    <p className="text-xs text-slate-500 tabular-nums">
                      Total no encontro: {active.totalGoals} gols registrados
                    </p>
                  </div>
                  <Goal className="h-5 w-5 text-emerald-600" />
                </div>

                {canEditMatchData && confirmedPlayers.length > 0 && (
                  <form
                    onSubmit={handleAddGoal}
                    className="mb-5 grid gap-3 sm:grid-cols-12 items-end rounded-xl bg-slate-50 p-3.5 border border-slate-200"
                  >
                    {active.matches.length > 0 && (
                      <>
                        <div className="sm:col-span-6">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Vincular à Partida
                          </label>
                          <select
                            value={selectedMatchId}
                            onChange={(e) => {
                              setSelectedMatchId(e.target.value);
                              setGoalTeamId('');
                            }}
                            className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                          >
                            <option value="">Sem partida específica (Geral)</option>
                            {active.matches.map((m, i) => (
                              <option key={m.id} value={m.id}>
                                #{active.matches.length - i}: {m.teamANome.split(' — ')[0]} {m.goalsA}×{m.goalsB} {m.teamBNome.split(' — ')[0]}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-6">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Time que marcou
                          </label>
                          <select
                            value={goalTeamId}
                            onChange={(e) => setGoalTeamId(e.target.value)}
                            className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                          >
                            <option value="">Automático (Time do jogador)</option>
                            {(selectedMatch
                              ? active.teams.filter(
                                  (t) => t.id === selectedMatch.teamAId || t.id === selectedMatch.teamBId
                                )
                              : active.teams
                            ).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Quem marcou o gol
                      </label>
                      <select
                        required
                        value={scorerId}
                        onChange={(e) => setScorerId(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                      >
                        <option value="">Selecione o jogador...</option>
                        {confirmedPlayers.map((p) => (
                          <option key={p.userId} value={p.userId}>
                            {p.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Quem deu assistência
                      </label>
                      <select
                        value={assistId}
                        onChange={(e) => setAssistId(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                      >
                        <option value="">Sem assistência</option>
                        {confirmedPlayers
                          .filter((p) => String(p.userId) !== scorerId)
                          .map((p) => (
                            <option key={p.userId} value={p.userId}>
                              {p.displayName}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3 flex gap-2">
                      <div className="w-16">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Min.
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={minuto}
                          onChange={(e) => setMinuto(e.target.value)}
                          placeholder="12"
                          className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs tabular-nums"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={savingGoal}
                        className="flex-1 min-h-[42px] rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        + Gol
                      </button>
                    </div>
                  </form>
                )}

                {active.goals.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    Nenhum gol registrado neste encontro ainda.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {active.goals.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between py-2.5 text-sm"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{g.scorerName}</span>
                          {g.assistName && (
                            <span className="text-xs text-slate-500">
                              {' '}
                              · Assistência: {g.assistName}
                            </span>
                          )}
                          <div className="text-xs text-slate-500">
                            {g.teamNome || 'Gol avulso'}
                            {g.minuto ? ` · ${g.minuto}'` : ''}
                          </div>
                        </div>
                        {canEditMatchData && (
                          <button
                            type="button"
                            onClick={() => handleDeleteGoal(g.id)}
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Remover gol"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      {/* Modal Novo Encontro */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                Agendar Novo Encontro
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEncounter} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Título da Pelada
                </label>
                <input
                  type="text"
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Data e Horário
                </label>
                <input
                  type="datetime-local"
                  required
                  value={dataHora}
                  onChange={(e) => setDataHora(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Local / Quadra
                  </label>
                  <input
                    type="text"
                    required
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Valor Avulso (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    required
                    value={valorAvulso}
                    onChange={(e) => setValorAvulso(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[42px] rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="min-h-[42px] rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar e Convocar Jogadores'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
