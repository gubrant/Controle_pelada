import { useState } from 'react';
import { Check, X, ArrowRight, Trophy, Users, Wallet, Target } from 'lucide-react';
import type {
  AttendanceStatus,
  DashboardData,
  EncounterSummary,
  UserProfile,
} from '../types.ts';
import {
  CRITERIA_LABELS,
  ROLE_LABELS,
  STATUS_ENCOUNTER_LABELS,
  formatCurrency,
  formatDateTime,
} from '../lib/api.ts';
import { RadarChart } from './RadarChart.tsx';

interface DashboardViewProps {
  dashboard: DashboardData | null;
  loading: boolean;
  nextEncounter: EncounterSummary | null;
  currentUser: UserProfile;
  onConfirmAttendance: (encounterId: number, status: AttendanceStatus) => Promise<void>;
  onNavigateTab: (tab: 'peladas' | 'votacao' | 'financeiro' | 'elenco') => void;
}

export function DashboardView({
  dashboard,
  loading,
  nextEncounter,
  currentUser,
  onConfirmAttendance,
  onNavigateTab,
}: DashboardViewProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [attBusy, setAttBusy] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  if (loading || !dashboard) {
    return (
      <div className="space-y-6">
        <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  const { kpis, topScorers, topWinners, topRated, attendanceRanking, monthlyRevenue, leagueAverages } =
    dashboard;

  const selectedPlayer =
    topRated.find((p) => p.id === selectedPlayerId) ??
    topRated.find((p) => p.id === currentUser.id) ??
    topRated[0] ??
    currentUser;

  const maxRevenue = Math.max(100, ...monthlyRevenue.map((m) => m.total));

  const handleAtt = async (status: AttendanceStatus) => {
    if (!nextEncounter) return;
    setAttBusy(true);
    try {
      await onConfirmAttendance(nextEncounter.id, status);
    } finally {
      setAttBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner do Próximo Encontro */}
      <section className="relative overflow-hidden rounded-2xl bg-slate-900 text-white border border-slate-800">
        {!heroImgFailed ? (
          <img
            src="/src/assets/images/futsal_court_hero_1795449227087.jpg"
            alt="Quadra de futebol de salão"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-950/45" />

        <div className="relative z-10 flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          {nextEncounter ? (
            <>
              <div className="space-y-2 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-300">
                  <span>{STATUS_ENCOUNTER_LABELS[nextEncounter.status]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{nextEncounter.local}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {nextEncounter.confirmedCount} confirmados
                  </span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
                  {nextEncounter.titulo}
                </h2>
                <p className="text-sm text-slate-200 tabular-nums">
                  {formatDateTime(nextEncounter.dataHora)} · Avulso:{' '}
                  {formatCurrency(nextEncounter.valorAvulso)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {nextEncounter.status !== 'finalizado' && (
                  <>
                    <button
                      type="button"
                      disabled={attBusy}
                      onClick={() => handleAtt('confirmado')}
                      className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                        nextEncounter.myAttendance === 'confirmado'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                      <span>
                        {nextEncounter.myAttendance === 'confirmado'
                          ? 'Presença Confirmada'
                          : 'Confirmar Presença'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={attBusy}
                      onClick={() => handleAtt('recusado')}
                      className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap border transition-colors ${
                        nextEncounter.myAttendance === 'recusado'
                          ? 'border-red-400 bg-red-500/20 text-red-100'
                          : 'border-white/25 bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      <X className="h-4 w-4" />
                      <span>Não Vou</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateTab('peladas')}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/25 bg-slate-900/70 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap transition-colors"
                >
                  <span>Abrir Encontro</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-emerald-300">Temporada Ativa</p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  Nenhum encontro agendado no momento
                </h2>
                <p className="text-sm text-slate-300">
                  {currentUser.role === 'administrador'
                    ? 'Crie o próximo encontro da pelada para disparar convocações e sortear os times.'
                    : 'Aguarde o administrador abrir a próxima convocação da quadra.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('peladas')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 whitespace-nowrap self-start lg:self-auto"
              >
                <span>Ir para Peladas</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </section>

      {/* Strip de 4 KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Gols Marcados</span>
            <Target className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {kpis.totalGols}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Média de {kpis.mediaGolsPorEncontro} gols / encontro
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Encontros & Partidas</span>
            <Trophy className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {kpis.encontrosFinalizados}
            <span className="text-base font-normal text-slate-400">/{kpis.totalEncontros}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {kpis.totalPartidas} partida(s) · Presença {kpis.taxaPresencaMedia}%
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Caixa do Mês</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {formatCurrency(kpis.caixaMesAtual)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Acumulado: {formatCurrency(kpis.caixaTotal)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Peladeiros Ativos</span>
            <Users className="h-4 w-4 text-slate-600" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {kpis.jogadoresAtivos}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sua nota geral: <span className="font-mono font-semibold text-emerald-700">{currentUser.stats.overall.toFixed(1)}</span>
          </p>
        </div>
      </section>

      {/* Artilharia + Radar de Avaliação */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Artilharia Geral */}
        <section className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">Artilharia Geral</h3>
              <p className="text-xs text-slate-500">Gols e assistências registrados nos encontros</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('peladas')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Registrar Gols
            </button>
          </div>

          {topScorers.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Nenhum jogador cadastrado ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="pb-2.5 pr-2">#</th>
                    <th className="pb-2.5">Jogador</th>
                    <th className="pb-2.5 text-right">Jogos</th>
                    <th className="pb-2.5 text-right">Assist.</th>
                    <th className="pb-2.5 text-right">Gols</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topScorers.map((item, idx) => (
                    <tr key={item.userId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 pr-2 font-mono text-xs text-slate-400 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2.5">
                        <div className="font-medium text-slate-900">{item.displayName}</div>
                        <div className="text-xs text-slate-500">{ROLE_LABELS[item.role]}</div>
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs text-slate-600 tabular-nums">
                        {item.presencas}
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs text-slate-600 tabular-nums">
                        {item.assistencias}
                      </td>
                      <td className="py-2.5 text-right font-mono text-sm font-bold text-emerald-700 tabular-nums">
                        {item.gols}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Ranking de Notas + Radar SVG */}
        <section className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Média de Avaliação (Votos)
              </h3>
              <p className="text-xs text-slate-500">
                Clique em um jogador para comparar os 6 critérios no radar
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('votacao')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Ir para Votação
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 items-center">
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
              {topRated.map((player, idx) => {
                const isSelected = player.id === selectedPlayer.id;
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={`w-full flex items-center justify-between py-2.5 px-2.5 text-left rounded-xl transition-colors ${
                      isSelected ? 'bg-emerald-50 text-emerald-950' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {idx + 1}. {player.displayName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {player.stats.isAdminAdjusted
                          ? 'Ajustada pelo Admin'
                          : player.stats.hasPeerVotes
                          ? `Últimos ${player.stats.evaluatedEncountersCount} encontro(s) · ${player.stats.voteCount} votos`
                          : 'Autoavaliação inicial'}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums shrink-0">
                      {player.stats.overall.toFixed(1)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col items-center justify-center">
              <RadarChart
                primary={selectedPlayer.stats.criteria}
                primaryLabel={selectedPlayer.displayName}
                secondary={leagueAverages}
                secondaryLabel="Média da Pelada"
                size={230}
              />
              <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1 text-[11px] text-slate-600 w-full">
                {CRITERIA_LABELS.map((c) => (
                  <div key={c.key} className="flex items-center justify-between">
                    <span>{c.short}</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {selectedPlayer.stats.criteria[c.key].toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Receita Mensal e Assiduidade */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Arrecadação dos Últimos 6 Meses
              </h3>
              <p className="text-xs text-slate-500">
                Comparativo entre mensalidades e entradas avulsas
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('financeiro')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Ver Financeiro
            </button>
          </div>

          <div className="grid grid-cols-6 gap-3 items-end h-44 pt-4">
            {monthlyRevenue.map((m) => {
              const mensalHeight = Math.round((m.mensalidades / maxRevenue) * 100);
              const avulsoHeight = Math.round((m.avulsos / maxRevenue) * 100);
              return (
                <div key={m.competencia} className="flex flex-col items-center gap-2 h-full justify-end">
                  <span className="font-mono text-[11px] font-medium text-slate-600 tabular-nums">
                    {m.total > 0 ? `R$${Math.round(m.total)}` : '—'}
                  </span>
                  <div className="w-full max-w-[44px] flex flex-col justify-end h-28 bg-slate-100 rounded-lg overflow-hidden p-0.5 gap-0.5">
                    {m.avulsos > 0 && (
                      <div
                        style={{ height: `${Math.max(8, avulsoHeight)}%` }}
                        className="w-full bg-amber-500 rounded-sm"
                        title={`Avulsos: ${formatCurrency(m.avulsos)}`}
                      />
                    )}
                    {m.mensalidades > 0 && (
                      <div
                        style={{ height: `${Math.max(8, mensalHeight)}%` }}
                        className="w-full bg-emerald-600 rounded-sm"
                        title={`Mensalidades: ${formatCurrency(m.mensalidades)}`}
                      />
                    )}
                  </div>
                  <span className="text-xs font-medium text-slate-600">{m.label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-5 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
              Mensalidades
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
              Avulsos
            </span>
          </div>
        </section>

        <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Vitórias em Partidas
                </h3>
                <p className="text-xs text-slate-500">Peladeiros com mais jogos vencidos</p>
              </div>
              <Trophy className="h-4 w-4 text-amber-600" />
            </div>

            {topWinners.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3.5 py-4 text-xs text-slate-500 text-center">
                Finalize partidas na aba Peladas para contabilizar as vitórias dos times e jogadores.
              </p>
            ) : (
              <div className="space-y-2">
                {topWinners.slice(0, 5).map((w, idx) => (
                  <div
                    key={w.userId}
                    className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-slate-800 truncate">
                      <span className="font-mono text-slate-400 mr-1.5">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      {w.displayName}
                    </span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums shrink-0">
                      {w.vitorias}V / {w.partidas}J
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-5">
            <div className="mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">Assiduidade na Quadra</h3>
              <p className="text-xs text-slate-500">Jogadores com mais presenças confirmadas</p>
            </div>
            <div className="space-y-3">
              {attendanceRanking.slice(0, 6).map((row) => {
                const pct =
                  row.totalEncontros > 0
                    ? Math.round((row.presencas / row.totalEncontros) * 100)
                    : 0;
                return (
                  <div key={row.userId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{row.displayName}</span>
                      <span className="font-mono text-slate-600 tabular-nums">
                        {row.presencas}/{row.totalEncontros} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
