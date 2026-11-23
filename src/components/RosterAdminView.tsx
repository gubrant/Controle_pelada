import { useState, type FormEvent } from 'react';
import { Eye, Search, Trash2, UserCog, UserPlus, X } from 'lucide-react';
import type { PlayerCriteria, UserProfile, UserRole } from '../types.ts';
import { CRITERIA_LABELS, ROLE_LABELS, api } from '../lib/api.ts';
import { RadarChart } from './RadarChart.tsx';

interface RosterAdminViewProps {
  players: UserProfile[];
  currentUser: UserProfile;
  onRefresh: () => Promise<void>;
  onUpdateCurrentUser: (user: UserProfile) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const DEFAULT_CRITERIA: PlayerCriteria = {
  preparo: 6,
  drible: 6,
  chute: 6,
  passe: 6,
  defesa: 6,
  ataque: 6,
};

export function RosterAdminView({
  players,
  currentUser,
  onRefresh,
  onUpdateCurrentUser,
  onToast,
}: RosterAdminViewProps) {
  const isAdmin = currentUser.role === 'administrador';
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [detailPlayer, setDetailPlayer] = useState<UserProfile | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Add account modal (Admin)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('peladeiro');
  const [newIdade, setNewIdade] = useState('');
  const [newPeso, setNewPeso] = useState('');
  const [newAltura, setNewAltura] = useState('');
  const [newCriteria, setNewCriteria] = useState<PlayerCriteria>(DEFAULT_CRITERIA);
  const [creating, setCreating] = useState(false);

  // Edit own profile modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profName, setProfName] = useState(currentUser.displayName);
  const [profIdade, setProfIdade] = useState(
    currentUser.idade !== null ? String(currentUser.idade) : ''
  );
  const [profPeso, setProfPeso] = useState(
    currentUser.peso !== null ? String(currentUser.peso) : ''
  );
  const [profAltura, setProfAltura] = useState(
    currentUser.altura !== null ? String(currentUser.altura) : ''
  );
  const [profCriteria, setProfCriteria] = useState<PlayerCriteria>(currentUser.initialCriteria);
  const [savingProfile, setSavingProfile] = useState(false);

  const filtered = players.filter((p) => {
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.displayName.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  const handleRoleChange = async (userId: number, role: UserRole) => {
    try {
      await api.adminUpdateRole(userId, role);
      await onRefresh();
      onToast(`Perfil atualizado para ${ROLE_LABELS[role]}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao alterar perfil.', 'error');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await api.adminDeletePlayer(userId);
      setConfirmDeleteId(null);
      await onRefresh();
      onToast('Conta removida.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao remover conta.', 'error');
    }
  };

  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.adminCreatePlayer({
        username: newUsername || undefined,
        displayName: newDisplayName,
        role: newRole,
        idade: newIdade ? Number(newIdade) : null,
        peso: newPeso ? Number(newPeso) : null,
        altura: newAltura ? Number(newAltura) : null,
        ...newCriteria,
      });
      setNewUsername('');
      setNewDisplayName('');
      setNewIdade('');
      setNewPeso('');
      setNewAltura('');
      setNewCriteria(DEFAULT_CRITERIA);
      setShowAddModal(false);
      await onRefresh();
      onToast('Novo participante adicionado com sucesso!');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao criar conta.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveOwnProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.updateProfile({
        displayName: profName,
        idade: profIdade ? Number(profIdade) : null,
        peso: profPeso ? Number(profPeso) : null,
        altura: profAltura ? Number(profAltura) : null,
        ...profCriteria,
      });
      onUpdateCurrentUser(res.user);
      setShowProfileModal(false);
      await onRefresh();
      onToast('Seu perfil foi atualizado!');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar perfil.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const openProfileModal = () => {
    setProfName(currentUser.displayName);
    setProfIdade(currentUser.idade !== null ? String(currentUser.idade) : '');
    setProfPeso(currentUser.peso !== null ? String(currentUser.peso) : '');
    setProfAltura(currentUser.altura !== null ? String(currentUser.altura) : '');
    setProfCriteria(currentUser.initialCriteria);
    setShowProfileModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Barra de filtros e ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar jogador..."
              className="min-h-[42px] w-56 rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-slate-200/70 p-1">
            {(
              [
                ['all', 'Todos'],
                ['administrador', 'Admins'],
                ['peladeiro', 'Fixos'],
                ['peladeiro_avulso', 'Avulsos'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setRoleFilter(val)}
                className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                  roleFilter === val
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openProfileModal}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <UserCog className="h-4 w-4 text-slate-600" />
            <span>Meu Perfil</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
            >
              <UserPlus className="h-4 w-4" />
              <span>Adicionar Conta</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabela do elenco */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-3.5">Peladeiro</th>
                <th className="px-5 py-3.5">Dados Físicos</th>
                <th className="px-5 py-3.5 text-right">Nota (OVR)</th>
                <th className="px-5 py-3.5 text-right">Gols</th>
                <th className="px-5 py-3.5 text-right">Jogos</th>
                <th className="px-5 py-3.5">Função / Acesso</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-900">
                      {p.displayName}
                      {p.id === currentUser.id && (
                        <span className="ml-1.5 text-xs font-normal text-emerald-700">(você)</span>
                      )}
                    </p>
                    <p className="text-xs font-mono text-slate-500">@{p.username}</p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600 tabular-nums">
                    {p.idade ? `${p.idade} anos` : '—'} · {p.peso ? `${p.peso} kg` : '—'} ·{' '}
                    {p.altura ? `${(p.altura / 100).toFixed(2)} m` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
                      {p.stats.overall.toFixed(1)}
                    </span>
                    <p className="text-[11px] text-slate-400 tabular-nums">
                      {p.stats.hasPeerVotes
                        ? `Últ. ${p.stats.evaluatedEncountersCount} jogo(s)`
                        : 'Inicial'}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-800 tabular-nums">
                    {p.stats.totalGoals}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-600 tabular-nums">
                    {p.stats.totalPresences}
                  </td>
                  <td className="px-5 py-3.5">
                    {isAdmin ? (
                      <select
                        aria-label={`Função de ${p.displayName}`}
                        value={p.role}
                        onChange={(e) => handleRoleChange(p.id, e.target.value as UserRole)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        <option value="administrador">Administrador</option>
                        <option value="peladeiro">Peladeiro Fixo</option>
                        <option value="peladeiro_avulso">Peladeiro Avulso</option>
                      </select>
                    ) : (
                      <span className="text-xs font-medium text-slate-700">
                        {ROLE_LABELS[p.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailPlayer(p)}
                        className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Ficha</span>
                      </button>

                      {isAdmin && p.id !== currentUser.id && (
                        confirmDeleteId === p.id ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(p.id)}
                            className="min-h-[34px] rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            Confirmar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(p.id)}
                            title="Excluir conta"
                            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Ficha do Jogador */}
      {detailPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  {detailPlayer.displayName}
                </h3>
                <p className="text-xs text-slate-500">
                  @{detailPlayer.username} · {ROLE_LABELS[detailPlayer.role]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailPlayer(null)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 rounded-xl bg-slate-50 p-3 text-center border border-slate-200 mb-5">
              <div>
                <p className="text-[11px] text-slate-500">Nota</p>
                <p className="font-mono text-lg font-bold text-emerald-700 tabular-nums">
                  {detailPlayer.stats.overall.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Gols</p>
                <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {detailPlayer.stats.totalGoals}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Assist.</p>
                <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {detailPlayer.stats.totalAssists}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Jogos</p>
                <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {detailPlayer.stats.totalPresences}
                </p>
              </div>
            </div>

            <RadarChart
              primary={detailPlayer.stats.criteria}
              primaryLabel={detailPlayer.displayName}
              size={240}
            />

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs">
              {CRITERIA_LABELS.map((c) => (
                <div key={c.key} className="flex items-center justify-between">
                  <span className="text-slate-600">{c.label}</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {detailPlayer.stats.criteria[c.key].toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Conta (Admin) */}
      {showAddModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                Adicionar Nova Conta
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nome / Apelido
                  </label>
                  <input
                    type="text"
                    required
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="ex: Marcos Aurélio"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Identificador (opcional)
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="ex: marcos10"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Perfil / Categoria
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
                >
                  <option value="peladeiro">Peladeiro Fixo</option>
                  <option value="peladeiro_avulso">Peladeiro Avulso</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Idade</label>
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={newIdade}
                    onChange={(e) => setNewIdade(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newPeso}
                    onChange={(e) => setNewPeso(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Altura (cm)
                  </label>
                  <input
                    type="number"
                    value={newAltura}
                    onChange={(e) => setNewAltura(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
                {CRITERIA_LABELS.map((c) => (
                  <div key={c.key}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-600">{c.short}</span>
                      <span className="font-mono font-semibold text-emerald-700">
                        {newCriteria[c.key]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={0.5}
                      value={newCriteria[c.key]}
                      onChange={(e) =>
                        setNewCriteria((prev) => ({
                          ...prev,
                          [c.key]: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-emerald-600"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-[42px] rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="min-h-[42px] rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Meu Perfil */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                Editar Meu Perfil
              </h3>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOwnProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome / Apelido
                </label>
                <input
                  type="text"
                  required
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Idade</label>
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={profIdade}
                    onChange={(e) => setProfIdade(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={profPeso}
                    onChange={(e) => setProfPeso(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Altura (cm)
                  </label>
                  <input
                    type="number"
                    value={profAltura}
                    onChange={(e) => setProfAltura(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Autoavaliação inicial (usada até receber votos pós-pelada)
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {CRITERIA_LABELS.map((c) => (
                    <div key={c.key}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-600">{c.short}</span>
                        <span className="font-mono font-semibold text-emerald-700">
                          {profCriteria[c.key]}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={0.5}
                        value={profCriteria[c.key]}
                        onChange={(e) =>
                          setProfCriteria((prev) => ({
                            ...prev,
                            [c.key]: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="min-h-[42px] rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="min-h-[42px] rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
