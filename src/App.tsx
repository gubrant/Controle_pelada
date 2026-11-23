import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AttendanceStatus,
  DashboardData,
  EncounterSummary,
  NotificationItem,
  PeladaSettings,
  PlayerCriteria,
  UserProfile,
} from './types.ts';
import {
  CRITERIA_LABELS,
  ROLE_LABELS,
  api,
  setActivePlayerId,
} from './lib/api.ts';
import { DashboardView } from './components/DashboardView.tsx';
import { EncountersView } from './components/EncountersView.tsx';
import { VotingView } from './components/VotingView.tsx';
import { PaymentsView } from './components/PaymentsView.tsx';
import { RosterAdminView } from './components/RosterAdminView.tsx';
import { NotificationsDrawer } from './components/NotificationsDrawer.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';

type ActiveTab = 'painel' | 'peladas' | 'votacao' | 'financeiro' | 'elenco';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: typeof BarChart3 }> = [
  { id: 'painel', label: 'Painel', icon: BarChart3 },
  { id: 'peladas', label: 'Peladas', icon: CalendarDays },
  { id: 'votacao', label: 'Votação', icon: ClipboardCheck },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'elenco', label: 'Elenco', icon: Users },
];

const DEFAULT_CRITERIA: PlayerCriteria = {
  preparo: 6,
  drible: 6,
  chute: 6,
  passe: 6,
  defesa: 6,
  ataque: 6,
};

export default function App() {
  const [bootLoading, setBootLoading] = useState(true);
  const [peladaNome, setPeladaNome] = useState('Pelada Quadra Livre');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<PeladaSettings>({
    peladaNome: 'Pelada Quadra Livre',
    valorMensalidade: 80,
    valorAvulso: 25,
    jogadoresPorTime: 5,
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('painel');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [crestFailed, setCrestFailed] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Quick self-registration modal (no login/password)
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regIdade, setRegIdade] = useState('');
  const [regPeso, setRegPeso] = useState('');
  const [regAltura, setRegAltura] = useState('');
  const [regCriteria, setRegCriteria] = useState<PlayerCriteria>(DEFAULT_CRITERIA);
  const [registering, setRegistering] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadWorkspaceData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [meRes, dashRes, encRes, playersRes, notifRes] = await Promise.all([
        api.getMe(),
        api.getDashboard(),
        api.getEncounters(),
        api.getPlayers(),
        api.getNotifications(),
      ]);
      setActivePlayerId(meRes.user.id);
      setCurrentUser(meRes.user);
      setSettings(meRes.settings);
      setPeladaNome(meRes.settings.peladaNome);
      setDashboard(dashRes);
      setEncounters(encRes.encounters);
      setPlayers(playersRes.players);
      setNotifications(notifRes.notifications);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Erro ao carregar dados da pelada.',
        'error'
      );
    } finally {
      setDataLoading(false);
      setBootLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const handleSwitchPlayer = async (playerId: number) => {
    setActivePlayerId(playerId);
    await loadWorkspaceData();
  };

  const handleQuickRegister = async (e: FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const res = await api.register({
        displayName: regDisplayName,
        idade: regIdade ? Number(regIdade) : null,
        peso: regPeso ? Number(regPeso) : null,
        altura: regAltura ? Number(regAltura) : null,
        ...regCriteria,
      });
      setActivePlayerId(res.user.id);
      setRegDisplayName('');
      setRegIdade('');
      setRegPeso('');
      setRegAltura('');
      setRegCriteria(DEFAULT_CRITERIA);
      setShowRegisterModal(false);
      await loadWorkspaceData();
      showToast(`Bem-vindo à quadra, ${res.user.displayName}!`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao cadastrar.', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleConfirmAttendance = async (encounterId: number, status: AttendanceStatus) => {
    try {
      await api.setAttendance(encounterId, status);
      await loadWorkspaceData();
      showToast(
        status === 'confirmado'
          ? 'Presença confirmada para a pelada!'
          : 'Ausência registrada.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao confirmar presença.', 'error');
    }
  };

  const handleMarkNotifRead = async (id: number) => {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
  };

  const handleMarkAllNotifRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  if (bootLoading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-600">
        Carregando sistema da pelada...
      </div>
    );
  }

  const unreadNotifs = notifications.filter((n) => !n.lida).length;
  const nextEncounter =
    encounters.find((e) => e.status !== 'finalizado') ?? encounters[0] ?? null;

  const tabTitles: Record<ActiveTab, string> = {
    painel: 'Painel de Estatísticas',
    peladas: 'Encontros, Sorteio e Gols',
    votacao: 'Votação Pós-Pelada Fixa',
    financeiro: 'Mensalidades e Avulsos',
    elenco: 'Elenco e Administração',
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
          {!crestFailed ? (
            <img
              src="/src/assets/images/pelada_club_crest_1795449227065.jpg"
              alt="Escudo"
              referrerPolicy="no-referrer"
              onError={() => setCrestFailed(true)}
              className="h-9 w-9 rounded-xl object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white font-display font-bold text-sm shrink-0">
              QL
            </div>
          )}
          <span className="font-display text-base font-bold text-slate-900 truncate">
            {peladaNome}
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 space-y-3">
          <div>
            <label
              htmlFor="sidebar-player-select"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Participante ativo
            </label>
            <select
              id="sidebar-player-select"
              value={currentUser.id}
              onChange={(e) => handleSwitchPlayer(Number(e.target.value))}
              className="w-full min-h-[38px] rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} ({ROLE_LABELS[p.role]})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Sua nota (OVR)</span>
            <span className="font-mono font-bold text-emerald-700 tabular-nums">
              {currentUser.stats.overall.toFixed(1)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600/30 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Novo Peladeiro</span>
          </button>

          <PWAInstallButton />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 pb-24 lg:pb-8">
        {/* Top Bar (3 zones) */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-6 border-b border-slate-200 bg-white/95 px-3.5 sm:px-8 py-3 backdrop-blur-md">
          <div className="flex flex-col lg:flex-row lg:items-center lg:gap-3 min-w-0">
            <span className="lg:hidden font-display text-[11px] font-bold text-emerald-700 truncate">
              {peladaNome}
            </span>
            <h1 className="font-display text-sm sm:text-lg font-bold text-slate-900 truncate">
              {tabTitles[activeTab]}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <select
              aria-label="Selecionar participante ativo"
              value={currentUser.id}
              onChange={(e) => handleSwitchPlayer(Number(e.target.value))}
              className="lg:hidden min-h-[44px] max-w-[112px] rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 truncate"
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>

            <div className="lg:hidden">
              <PWAInstallButton compact />
            </div>

            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="lg:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-emerald-700 hover:bg-emerald-50"
              title="Novo Peladeiro"
            >
              <UserPlus className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label="Abrir notificações"
              className="relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Bell className="h-4 w-4 text-slate-700" />
              <span className="hidden sm:inline">Notificações</span>
              {unreadNotifs > 0 && (
                <span className="font-mono text-xs font-bold text-emerald-700 tabular-nums">
                  ({unreadNotifs})
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Workspace Viewport */}
        <main className="mx-auto w-full max-w-6xl px-4 sm:px-8 py-6">
          {activeTab === 'painel' && (
            <DashboardView
              dashboard={dashboard}
              loading={dataLoading}
              nextEncounter={nextEncounter}
              currentUser={currentUser}
              onConfirmAttendance={handleConfirmAttendance}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'peladas' && (
            <EncountersView
              encounters={encounters}
              currentUser={currentUser}
              defaultAvulso={settings.valorAvulso}
              onRefresh={loadWorkspaceData}
              onToast={showToast}
            />
          )}

          {activeTab === 'votacao' && (
            <VotingView
              encounters={encounters}
              currentUser={currentUser}
              onRefresh={loadWorkspaceData}
              onToast={showToast}
            />
          )}

          {activeTab === 'financeiro' && (
            <PaymentsView
              currentUser={currentUser}
              settings={settings}
              onSettingsUpdated={(s) => {
                setSettings(s);
                setPeladaNome(s.peladaNome);
              }}
              onDashboardRefresh={loadWorkspaceData}
              onToast={showToast}
            />
          )}

          {activeTab === 'elenco' && (
            <RosterAdminView
              players={players}
              currentUser={currentUser}
              onRefresh={loadWorkspaceData}
              onUpdateCurrentUser={(u) => setCurrentUser(u)}
              onToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Fixed Mobile Bottom Tab Bar */}
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden min-h-[64px] pb-[env(safe-area-inset-bottom)]"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-full px-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modal Cadastro Rápido de Novo Peladeiro */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Cadastrar Novo Peladeiro
                </h3>
                <p className="text-xs text-slate-500">
                  Acesso direto sem senha — informe seus dados físicos e autoavaliação.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleQuickRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome ou Apelido
                </label>
                <input
                  type="text"
                  required
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="ex: Lucas Silva"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Idade</label>
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={regIdade}
                    onChange={(e) => setRegIdade(e.target.value)}
                    placeholder="28"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Peso (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={35}
                    max={200}
                    value={regPeso}
                    onChange={(e) => setRegPeso(e.target.value)}
                    placeholder="76"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Altura (cm)
                  </label>
                  <input
                    type="number"
                    min={120}
                    max={230}
                    value={regAltura}
                    onChange={(e) => setRegAltura(e.target.value)}
                    placeholder="178"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-800 mb-2.5">
                  Autoavaliação inicial (1 a 10)
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {CRITERIA_LABELS.map((c) => (
                    <div key={c.key}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-600">{c.short}</span>
                        <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                          {regCriteria[c.key]}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={0.5}
                        value={regCriteria[c.key]}
                        onChange={(e) =>
                          setRegCriteria((prev) => ({
                            ...prev,
                            [c.key]: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="min-h-[42px] rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="min-h-[42px] rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {registering ? 'Cadastrando...' : 'Confirmar Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notifications Drawer */}
      <NotificationsDrawer
        open={notifOpen}
        notifications={notifications}
        onClose={() => setNotifOpen(false)}
        onMarkRead={handleMarkNotifRead}
        onMarkAllRead={handleMarkAllNotifRead}
        onRespondAttendance={handleConfirmAttendance}
      />

      {/* Offline status indicator */}
      <OfflineIndicator />

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-lg ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
