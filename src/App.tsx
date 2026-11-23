import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  LogOut,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  AttendanceStatus,
  DashboardData,
  EncounterSummary,
  NotificationItem,
  PeladaSettings,
  UserProfile,
} from './types.ts';
import { ROLE_LABELS, api, setApiToken } from './lib/api.ts';
import { AuthScreen } from './components/AuthScreen.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { EncountersView } from './components/EncountersView.tsx';
import { VotingView } from './components/VotingView.tsx';
import { PaymentsView } from './components/PaymentsView.tsx';
import { RosterAdminView } from './components/RosterAdminView.tsx';
import { NotificationsDrawer } from './components/NotificationsDrawer.tsx';

type ActiveTab = 'painel' | 'peladas' | 'votacao' | 'financeiro' | 'elenco';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: typeof BarChart3 }> = [
  { id: 'painel', label: 'Painel', icon: BarChart3 },
  { id: 'peladas', label: 'Peladas', icon: CalendarDays },
  { id: 'votacao', label: 'Votação', icon: ClipboardCheck },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'elenco', label: 'Elenco', icon: Users },
];

export default function App() {
  const [bootLoading, setBootLoading] = useState(true);
  const [adminConfigured, setAdminConfigured] = useState(true);
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

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((res) => {
        setAdminConfigured(res.adminConfigured);
        setPeladaNome(res.peladaNome);
      })
      .catch(() => {})
      .finally(() => setBootLoading(false));
  }, []);

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
    }
  }, [showToast]);

  const handleAuthenticated = async (token: string, user: UserProfile) => {
    setApiToken(token);
    setCurrentUser(user);
    setAdminConfigured(true);
    await loadWorkspaceData();
  };

  const handleLogout = () => {
    setApiToken(null);
    setCurrentUser(null);
    setDashboard(null);
    setEncounters([]);
    setPlayers([]);
    setNotifications([]);
    setActiveTab('painel');
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

  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-600">
        Carregando sistema da pelada...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen
        adminConfigured={adminConfigured}
        peladaNome={peladaNome}
        onAuthenticated={handleAuthenticated}
      />
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
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{currentUser.displayName}</p>
              <p className="text-xs text-slate-500 truncate">{ROLE_LABELS[currentUser.role]}</p>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-700 tabular-nums shrink-0">
              {currentUser.stats.overall.toFixed(1)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 pb-20 lg:pb-8">
        {/* Top Bar (3 zones) */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-slate-200 bg-white/95 px-4 sm:px-8 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden font-display text-sm font-bold text-emerald-700 whitespace-nowrap shrink-0">
              {peladaNome}
            </span>
            <span className="lg:hidden text-slate-300">/</span>
            <h1 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
              {tabTitles[activeTab]}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label="Abrir notificações"
              className="relative min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Bell className="h-4 w-4 text-slate-700" />
              <span className="hidden sm:inline">Notificações</span>
              {unreadNotifs > 0 && (
                <span className="font-mono text-xs font-bold text-emerald-700 tabular-nums">
                  ({unreadNotifs})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sair"
              className="lg:hidden min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
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
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden h-16"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-full px-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Notifications Drawer */}
      <NotificationsDrawer
        open={notifOpen}
        notifications={notifications}
        onClose={() => setNotifOpen(false)}
        onMarkRead={handleMarkNotifRead}
        onMarkAllRead={handleMarkAllNotifRead}
        onRespondAttendance={handleConfirmAttendance}
      />

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
