import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Lock } from 'lucide-react';
import type { EncounterSummary, PlayerCriteria, UserProfile, VoteRecord } from '../types.ts';
import { CRITERIA_LABELS, ROLE_LABELS, api, formatDateTime } from '../lib/api.ts';

interface VotingViewProps {
  encounters: EncounterSummary[];
  currentUser: UserProfile;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const DEFAULT_VOTE: PlayerCriteria = {
  preparo: 6,
  drible: 6,
  chute: 6,
  passe: 6,
  defesa: 6,
  ataque: 6,
};

export function VotingView({
  encounters,
  currentUser,
  onRefresh,
  onToast,
}: VotingViewProps) {
  const votableEncounters = encounters.filter((e) => e.votacaoAberta);
  const [selectedEncId, setSelectedEncId] = useState<number | null>(
    votableEncounters[0]?.id ?? null
  );
  const [drafts, setDrafts] = useState<Record<number, PlayerCriteria>>({});
  const [savedTargets, setSavedTargets] = useState<Set<number>>(new Set());
  const [savingTarget, setSavingTarget] = useState<number | null>(null);
  const [loadingVotes, setLoadingVotes] = useState(false);

  useEffect(() => {
    if (votableEncounters.length > 0 && !votableEncounters.some((e) => e.id === selectedEncId)) {
      setSelectedEncId(votableEncounters[0].id);
    } else if (votableEncounters.length === 0) {
      setSelectedEncId(null);
    }
  }, [encounters, selectedEncId]);

  const activeEnc =
    votableEncounters.find((e) => e.id === selectedEncId) ?? votableEncounters[0] ?? null;

  useEffect(() => {
    if (!activeEnc) return;
    let cancelled = false;
    setLoadingVotes(true);
    api
      .getMyVotes(activeEnc.id)
      .then((res) => {
        if (cancelled) return;
        const map: Record<number, PlayerCriteria> = {};
        const saved = new Set<number>();
        res.myVotes.forEach((v: VoteRecord) => {
          map[v.targetId] = {
            preparo: v.preparo,
            drible: v.drible,
            chute: v.chute,
            passe: v.passe,
            defesa: v.defesa,
            ataque: v.ataque,
          };
          saved.add(v.targetId);
        });
        setDrafts(map);
        setSavedTargets(saved);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingVotes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeEnc?.id]);

  // Confirmed participants in this encounter excluding current user
  const targets =
    activeEnc?.attendance.filter(
      (a) => a.status === 'confirmado' && a.userId !== currentUser.id
    ) ?? [];

  const getDraft = (targetId: number): PlayerCriteria => drafts[targetId] ?? DEFAULT_VOTE;

  const updateCriterion = (targetId: number, key: keyof PlayerCriteria, val: number) => {
    setDrafts((prev) => ({
      ...prev,
      [targetId]: {
        ...(prev[targetId] ?? DEFAULT_VOTE),
        [key]: val,
      },
    }));
  };

  const handleSaveVote = async (targetId: number, targetName: string) => {
    if (!activeEnc) return;
    setSavingTarget(targetId);
    const c = getDraft(targetId);
    try {
      await api.submitVote(activeEnc.id, { targetId, ...c });
      setSavedTargets((prev) => new Set(prev).add(targetId));
      await onRefresh();
      onToast(`Avaliação de ${targetName} registrada! Média recalculada automaticamente.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao enviar avaliação.', 'error');
    } finally {
      setSavingTarget(null);
    }
  };

  if (votableEncounters.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3">
        <Lock className="mx-auto h-10 w-10 text-slate-400" />
        <h3 className="font-display text-lg font-bold text-slate-900">
          Nenhuma votação aberta no momento
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Após finalizar um encontro na aba <span className="font-semibold">Peladas</span>, a
          votação pós-jogo abre automaticamente para todos os participantes avaliarem uns aos
          outros (exceto a si mesmos).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Votação Pós-Pelada Fixa
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Avalie os critérios de cada participante (seu próprio perfil fica oculto). A nota final
            é a média simples dos últimos 5 encontros que o jogador participou.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Selecionar encontro para votação"
            value={activeEnc?.id ?? ''}
            onChange={(e) => setSelectedEncId(Number(e.target.value))}
            className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800"
          >
            {votableEncounters.map((enc) => (
              <option key={enc.id} value={enc.id}>
                {enc.titulo} ({formatDateTime(enc.dataHora)})
              </option>
            ))}
          </select>
          <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
            {savedTargets.size}/{targets.length} avaliados
          </span>
        </div>
      </div>

      {loadingVotes ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : targets.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Não há outros participantes confirmados neste encontro para avaliar.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {targets.map((player) => {
            const c = getDraft(player.userId);
            const avg =
              (c.preparo + c.drible + c.chute + c.passe + c.defesa + c.ataque) / 6;
            const isSaved = savedTargets.has(player.userId);
            const isBusy = savingTarget === player.userId;

            return (
              <article
                key={player.userId}
                className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      {player.displayName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {ROLE_LABELS[player.role]} · Média atual:{' '}
                      <span className="font-mono font-semibold text-slate-700 tabular-nums">
                        {player.overall.toFixed(1)}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-500">Seu voto</p>
                    <p className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                      {avg.toFixed(1)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                  {CRITERIA_LABELS.map((item) => (
                    <div key={item.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-700 font-medium">{item.short}</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {c[item.key].toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={0.5}
                        value={c[item.key]}
                        onChange={(e) =>
                          updateCriterion(player.userId, item.key, Number(e.target.value))
                        }
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleSaveVote(player.userId, player.displayName)}
                  className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors ${
                    isSaved
                      ? 'border border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isSaved ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{isBusy ? 'Atualizando...' : 'Voto Salvo (Atualizar)'}</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-4 w-4" />
                      <span>{isBusy ? 'Salvando...' : 'Salvar Avaliação'}</span>
                    </>
                  )}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
