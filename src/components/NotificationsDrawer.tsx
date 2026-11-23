import { Bell, Check, CheckCheck, X } from 'lucide-react';
import type { AttendanceStatus, NotificationItem } from '../types.ts';
import { formatShortDate } from '../lib/api.ts';

interface NotificationsDrawerProps {
  open: boolean;
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onRespondAttendance: (encounterId: number, status: AttendanceStatus) => Promise<void>;
}

export function NotificationsDrawer({
  open,
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onRespondAttendance,
}: NotificationsDrawerProps) {
  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.lida).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-l border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-emerald-700" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Notificações e Convocações
              </h3>
              <p className="text-xs text-slate-500 tabular-nums">
                {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo em dia'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="min-h-[36px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Ler todas</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhuma notificação recebida até o momento.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 transition-colors ${!n.lida ? 'bg-emerald-50/40' : 'bg-white'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-emerald-700">
                      {n.tipo === 'convocacao'
                        ? 'Convocação'
                        : n.tipo === 'lembrete'
                        ? 'Lembrete de Presença'
                        : n.tipo === 'votacao'
                        ? 'Votação Aberta'
                        : 'Aviso'}
                      {' · '}
                      <span className="font-normal text-slate-500 tabular-nums">
                        {formatShortDate(n.createdAt)}
                      </span>
                    </p>
                    <h4 className="text-sm font-bold text-slate-900">{n.titulo}</h4>
                    <p className="text-xs leading-relaxed text-slate-600">{n.mensagem}</p>
                  </div>

                  {!n.lida && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(n.id)}
                      title="Marcar como lida"
                      className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {n.encounterId && (n.tipo === 'convocacao' || n.tipo === 'lembrete') && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRespondAttendance(n.encounterId!, 'confirmado')}
                      className={`min-h-[36px] inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        n.myAttendance === 'confirmado'
                          ? 'bg-emerald-600 text-white'
                          : 'border border-emerald-600 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>
                        {n.myAttendance === 'confirmado' ? 'Confirmado' : 'Confirmar Presença'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRespondAttendance(n.encounterId!, 'recusado')}
                      className={`min-h-[36px] inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                        n.myAttendance === 'recusado'
                          ? 'border-red-600 bg-red-600 text-white'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Não Vou</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
