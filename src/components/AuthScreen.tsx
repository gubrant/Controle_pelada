import { useState, type FormEvent } from 'react';
import { ShieldCheck, UserPlus, LogIn, ArrowRight, KeyRound } from 'lucide-react';
import { api, CRITERIA_LABELS } from '../lib/api.ts';
import type { PlayerCriteria, UserProfile } from '../types.ts';

interface AuthScreenProps {
  adminConfigured: boolean;
  peladaNome: string;
  onAuthenticated: (token: string, user: UserProfile) => void;
}

const DEFAULT_CRITERIA: PlayerCriteria = {
  preparo: 6,
  drible: 6,
  chute: 6,
  passe: 6,
  defesa: 6,
  ataque: 6,
};

export function AuthScreen({ adminConfigured, peladaNome, onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'claim' | 'login' | 'register'>(
    adminConfigured ? 'login' : 'claim'
  );
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [idade, setIdade] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [criteria, setCriteria] = useState<PlayerCriteria>(DEFAULT_CRITERIA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courtImgFailed, setCourtImgFailed] = useState(false);
  const [crestImgFailed, setCrestImgFailed] = useState(false);

  const handleClaimAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.claimAdmin(adminPass, 'Didi');
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ativar administrador.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(username, password);
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.register({
        username,
        displayName,
        password,
        idade: idade ? Number(idade) : null,
        peso: peso ? Number(peso) : null,
        altura: altura ? Number(altura) : null,
        ...criteria,
      });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-12 lg:items-stretch">
      {/* Coluna visual esquerda */}
      <div className="relative hidden lg:col-span-6 lg:flex lg:flex-col lg:justify-between overflow-hidden bg-slate-900 text-white p-10">
        {!courtImgFailed ? (
          <img
            src="/src/assets/images/futsal_court_hero_1795449227087.jpg"
            alt="Quadra de futebol de salão iluminada"
            referrerPolicy="no-referrer"
            onError={() => setCourtImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-slate-950/60" />

        <div className="relative z-10 flex items-center gap-3.5">
          {!crestImgFailed ? (
            <img
              src="/src/assets/images/pelada_club_crest_1795449227065.jpg"
              alt="Escudo da pelada"
              referrerPolicy="no-referrer"
              onError={() => setCrestImgFailed(true)}
              className="h-12 w-12 rounded-xl object-cover border border-white/20"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white font-display font-bold text-xl">
              QL
            </div>
          )}
          <div>
            <p className="font-display text-lg font-bold tracking-tight text-white">
              {peladaNome}
            </p>
            <p className="text-xs text-slate-300">Gestão Oficial de Futebol de Salão</p>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-5">
          <h1 className="font-display text-4xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
            Controle total da sua pelada, do sorteio à resenha pós-jogo.
          </h1>
          <p className="text-sm leading-relaxed text-slate-200">
            Confirmação de presença via notificações, sorteio equilibrado por nota técnica,
            controle de gols em tempo real, mensalidades, avulsos e votação anônima entre os
            peladeiros após cada encontro.
          </p>
          <div className="grid grid-cols-3 gap-4 border-t border-white/15 pt-5 text-xs">
            <div>
              <p className="font-display text-xl font-bold text-emerald-400 tabular-nums">6</p>
              <p className="text-slate-300">Critérios avaliados por jogo</p>
            </div>
            <div>
              <p className="font-display text-xl font-bold text-emerald-400">Equilibrado</p>
              <p className="text-slate-300">Sorteio justo por média OVR</p>
            </div>
            <div>
              <p className="font-display text-xl font-bold text-emerald-400">Caixa</p>
              <p className="text-slate-300">Mensalistas e avulsos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Coluna do formulário */}
      <div className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10 lg:col-span-6 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            {!crestImgFailed ? (
              <img
                src="/src/assets/images/pelada_club_crest_1795449227065.jpg"
                alt="Escudo da pelada"
                referrerPolicy="no-referrer"
                onError={() => setCrestImgFailed(true)}
                className="h-10 w-10 rounded-xl object-cover border border-slate-200"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white font-display font-bold">
                QL
              </div>
            )}
            <div>
              <h1 className="font-display text-lg font-bold text-slate-900">{peladaNome}</h1>
              <p className="text-xs text-slate-500">Futebol de Salão</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            {/* Segmented Mode Tabs */}
            <div className="mb-6 flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              {!adminConfigured && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('claim');
                  }}
                  className={`flex-1 min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                    mode === 'claim'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ativar Admin
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('login');
                }}
                className={`flex-1 min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('register');
                }}
                className={`flex-1 min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cadastrar Peladeiro
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
              >
                {error}
              </div>
            )}

            {mode === 'claim' && !adminConfigured && (
              <form onSubmit={handleClaimAdmin} className="space-y-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Primeiro acesso do sistema</span>
                  </div>
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Definir senha do administrador didi
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Para liberar o painel administrativo, defina a senha inicial da conta{' '}
                    <span className="font-mono font-semibold text-slate-900">didi</span> (por
                    exemplo, <span className="font-mono text-slate-800">123456</span>).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Usuário Administrador
                  </label>
                  <input
                    type="text"
                    value="didi"
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-mono font-semibold text-slate-700"
                  />
                </div>

                <div>
                  <label
                    htmlFor="claim-pass"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Definir Senha
                  </label>
                  <input
                    id="claim-pass"
                    type="password"
                    required
                    minLength={4}
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    placeholder="Digite a senha do administrador (ex: 123456)"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>{loading ? 'Ativando...' : 'Ativar Administrador didi'}</span>
                </button>
              </form>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Acessar Pelada
                  </h2>
                  <p className="text-xs text-slate-500">
                    Entre com seu nome de usuário e senha simples.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Nome de usuário
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex: didi ou joao10"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Senha
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  <span>{loading ? 'Entrando...' : 'Entrar na Quadra'}</span>
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1">
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Cadastro de Peladeiro
                  </h2>
                  <p className="text-xs text-slate-500">
                    Informe seu acesso, dados físicos e autoavaliação inicial.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Usuário (login)
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ex: lucas10"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nome / Apelido
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="ex: Lucas Silva"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Senha (mínimo 4 dígitos)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Escolha uma senha simples"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Idade
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={90}
                      value={idade}
                      onChange={(e) => setIdade(e.target.value)}
                      placeholder="28"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
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
                      value={peso}
                      onChange={(e) => setPeso(e.target.value)}
                      placeholder="76"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
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
                      value={altura}
                      onChange={(e) => setAltura(e.target.value)}
                      placeholder="178"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold text-slate-800 mb-2.5">
                    Autoavaliação inicial (1 a 10)
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {CRITERIA_LABELS.map((c) => (
                      <div key={c.key}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-600">{c.short}</span>
                          <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                            {criteria[c.key]}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={0.5}
                          value={criteria[c.key]}
                          onChange={(e) =>
                            setCriteria((prev) => ({
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{loading ? 'Cadastrando...' : 'Finalizar Cadastro'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
