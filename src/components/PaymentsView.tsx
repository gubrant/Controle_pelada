import { useEffect, useState, type FormEvent } from 'react';
import { Check, Settings2, Wallet, X } from 'lucide-react';
import type {
  AvulsoPaymentItem,
  MonthlyPaymentItem,
  PeladaSettings,
  UserProfile,
} from '../types.ts';
import { ROLE_LABELS, api, formatCurrency, formatDateTime } from '../lib/api.ts';

interface PaymentsViewProps {
  currentUser: UserProfile;
  settings: PeladaSettings;
  onSettingsUpdated: (s: PeladaSettings) => void;
  onDashboardRefresh: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export function PaymentsView({
  currentUser,
  settings,
  onSettingsUpdated,
  onDashboardRefresh,
  onToast,
}: PaymentsViewProps) {
  const isAdmin = currentUser.role === 'administrador';
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [subTab, setSubTab] = useState<'mensalidades' | 'avulsos' | 'config'>('mensalidades');
  const [monthly, setMonthly] = useState<MonthlyPaymentItem[]>([]);
  const [avulsos, setAvulsos] = useState<AvulsoPaymentItem[]>([]);
  const [summary, setSummary] = useState({
    totalArrecadadoMes: 0,
    mensalidadesPagas: 0,
    mensalidadesPendentes: 0,
    avulsosPagos: 0,
    avulsosPendentes: 0,
  });
  const [loading, setLoading] = useState(true);

  // Settings form
  const [peladaNome, setPeladaNome] = useState(settings.peladaNome);
  const [valorMensalidade, setValorMensalidade] = useState(String(settings.valorMensalidade));
  const [valorAvulso, setValorAvulso] = useState(String(settings.valorAvulso));
  const [savingSettings, setSavingSettings] = useState(false);

  const loadPayments = async (targetMonth: string) => {
    setLoading(true);
    try {
      const data = await api.getPayments(targetMonth);
      setMonthly(data.monthly);
      setAvulsos(data.avulsos);
      setSummary(data.summary);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao carregar financeiro.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments(month);
  }, [month]);

  useEffect(() => {
    setPeladaNome(settings.peladaNome);
    setValorMensalidade(String(settings.valorMensalidade));
    setValorAvulso(String(settings.valorAvulso));
  }, [settings]);

  const handleToggleMonthly = async (
    item: MonthlyPaymentItem,
    nextStatus: 'pago' | 'pendente' | 'isento'
  ) => {
    try {
      await api.saveMonthlyPayment({
        userId: item.userId,
        competencia: month,
        status: nextStatus,
        valor: item.valor,
        metodo: item.metodo,
      });
      await Promise.all([loadPayments(month), onDashboardRefresh()]);
      onToast(`Mensalidade de ${item.displayName} atualizada.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar mensalidade.', 'error');
    }
  };

  const handleToggleAvulso = async (item: AvulsoPaymentItem, pago: boolean) => {
    try {
      await api.saveAvulsoPayment({
        attendanceId: item.attendanceId,
        pago,
        valor: item.valor,
      });
      await Promise.all([loadPayments(month), onDashboardRefresh()]);
      onToast(
        pago
          ? `Avulso de ${item.displayName} marcado como pago.`
          : `Pagamento avulso de ${item.displayName} estornado.`
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar avulso.', 'error');
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await api.updateSettings({
        peladaNome,
        valorMensalidade: Number(valorMensalidade),
        valorAvulso: Number(valorAvulso),
      });
      onSettingsUpdated(res.settings);
      await loadPayments(month);
      onToast('Configurações financeiras atualizadas.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao salvar configurações.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumo Financeiro */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Arrecadado ({month})</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {formatCurrency(summary.totalArrecadadoMes)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Mensalidades Pagas</p>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">
            {summary.mensalidadesPagas}
            <span className="text-base font-normal text-slate-400">
              /{summary.mensalidadesPagas + summary.mensalidadesPendentes}
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Mensalidades Pendentes</p>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-amber-600 tabular-nums">
            {summary.mensalidadesPendentes}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Avulsos Pendentes</p>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {summary.avulsosPendentes}
            <span className="text-xs font-normal text-slate-500 ml-1.5">
              ({summary.avulsosPagos} pagos)
            </span>
          </p>
        </div>
      </div>

      {/* Controles e Abas */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-xl bg-slate-200/70 p-1">
          <button
            type="button"
            onClick={() => setSubTab('mensalidades')}
            className={`min-h-[38px] rounded-lg px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              subTab === 'mensalidades'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mensalidades (Fixos)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('avulsos')}
            className={`min-h-[38px] rounded-lg px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              subTab === 'avulsos'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Avulsos (Por Jogo)
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setSubTab('config')}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                subTab === 'config'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Valores</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="competencia-month" className="text-xs font-medium text-slate-600">
            Mês de referência:
          </label>
          <input
            id="competencia-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
          />
        </div>
      </div>

      {/* Conteúdo */}
      {subTab === 'mensalidades' && (
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Carregando mensalidades...</div>
          ) : monthly.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhum peladeiro fixo ou administrador cadastrado.
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 md:hidden">
                {monthly.map((item) => (
                  <div key={item.userId} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{item.displayName}</p>
                        <p className="text-xs text-slate-500">
                          {ROLE_LABELS[item.role]} · @{item.username}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrency(item.valor)}
                        </p>
                        <span
                          className={`text-xs font-semibold ${
                            item.status === 'pago'
                              ? 'text-emerald-700'
                              : item.status === 'isento'
                              ? 'text-slate-500'
                              : 'text-amber-700'
                          }`}
                        >
                          {item.status === 'pago'
                            ? 'Pago'
                            : item.status === 'isento'
                            ? 'Isento'
                            : 'Pendente'}
                        </span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        {item.status !== 'pago' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleMonthly(item, 'pago')}
                            className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Dar Baixa</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleMonthly(item, 'pendente')}
                            className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Estornar</span>
                          </button>
                        )}
                        {item.status !== 'isento' && (
                          <button
                            type="button"
                            onClick={() => handleToggleMonthly(item, 'isento')}
                            className="min-h-[40px] rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Isentar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3.5">Participante</th>
                      <th className="px-5 py-3.5">Categoria</th>
                      <th className="px-5 py-3.5 text-right">Valor</th>
                      <th className="px-5 py-3.5">Situação</th>
                      {isAdmin && <th className="px-5 py-3.5 text-right">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthly.map((item) => (
                      <tr key={item.userId} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-900">{item.displayName}</p>
                          <p className="text-xs font-mono text-slate-500">@{item.username}</p>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600">
                          {ROLE_LABELS[item.role]}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(item.valor)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`text-xs font-semibold ${
                              item.status === 'pago'
                                ? 'text-emerald-700'
                                : item.status === 'isento'
                                ? 'text-slate-500'
                                : 'text-amber-700'
                            }`}
                          >
                            {item.status === 'pago'
                              ? 'Pago'
                              : item.status === 'isento'
                              ? 'Isento'
                              : 'Pendente'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {item.status !== 'pago' ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleMonthly(item, 'pago')}
                                  className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Dar Baixa</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleMonthly(item, 'pendente')}
                                  className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span>Estornar</span>
                                </button>
                              )}
                              {item.status !== 'isento' && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleMonthly(item, 'isento')}
                                  className="min-h-[34px] rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                                >
                                  Isentar
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {subTab === 'avulsos' && (
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Carregando avulsos...</div>
          ) : avulsos.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhum peladeiro avulso confirmou presença em encontros ainda.
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 md:hidden">
                {avulsos.map((item) => (
                  <div key={item.attendanceId} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{item.displayName}</p>
                        <p className="text-xs text-slate-600 truncate">{item.encounterTitulo}</p>
                        <p className="text-[11px] text-slate-400 tabular-nums">
                          {formatDateTime(item.encounterDataHora)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrency(item.valor)}
                        </p>
                        <span
                          className={`text-xs font-semibold ${
                            item.pagoAvulso ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {item.pagoAvulso ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div>
                        {!item.pagoAvulso ? (
                          <button
                            type="button"
                            onClick={() => handleToggleAvulso(item, true)}
                            className="w-full min-h-[40px] inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Confirmar Pagamento</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleAvulso(item, false)}
                            className="w-full min-h-[40px] inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Estornar</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3.5">Jogador Avulso</th>
                      <th className="px-5 py-3.5">Encontro</th>
                      <th className="px-5 py-3.5 text-right">Valor</th>
                      <th className="px-5 py-3.5">Situação</th>
                      {isAdmin && <th className="px-5 py-3.5 text-right">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {avulsos.map((item) => (
                      <tr key={item.attendanceId} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-900">{item.displayName}</p>
                          <p className="text-xs font-mono text-slate-500">@{item.username}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-xs font-semibold text-slate-800">
                            {item.encounterTitulo}
                          </p>
                          <p className="text-xs text-slate-500 tabular-nums">
                            {formatDateTime(item.encounterDataHora)}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(item.valor)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`text-xs font-semibold ${
                              item.pagoAvulso ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {item.pagoAvulso ? 'Pago' : 'Pendente'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3.5 text-right">
                            {!item.pagoAvulso ? (
                              <button
                                type="button"
                                onClick={() => handleToggleAvulso(item, true)}
                                className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Confirmar Pagamento</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleAvulso(item, false)}
                                className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Estornar</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {subTab === 'config' && isAdmin && (
        <section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="font-display text-lg font-bold text-slate-900 mb-1">
            Configurações da Pelada
          </h3>
          <p className="text-xs text-slate-500 mb-5">
            Defina o nome da pelada e os valores padrão de mensalidade e diária avulsa.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nome da Pelada
              </label>
              <input
                type="text"
                required
                value={peladaNome}
                onChange={(e) => setPeladaNome(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mensalidade Padrão (R$)
                </label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  required
                  value={valorMensalidade}
                  onChange={(e) => setValorMensalidade(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Valor Avulso Padrão (R$)
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

            <button
              type="submit"
              disabled={savingSettings}
              className="min-h-[44px] rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
