import { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title="Instalar aplicativo no dispositivo"
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap ${
          compact ? 'min-h-[44px] min-w-[44px] px-3 py-2 text-xs' : 'w-full min-h-[42px] px-3.5 py-2 text-xs'
        }`}
      >
        <Download className="h-4 w-4 shrink-0" />
        <span className={compact ? 'hidden sm:inline' : ''}>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Instalar no iPhone ou iPad"
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600/35 bg-emerald-50 font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap ${
            compact ? 'min-h-[44px] min-w-[44px] px-3 py-2 text-xs' : 'w-full min-h-[42px] px-3.5 py-2 text-xs'
          }`}
        >
          <Smartphone className="h-4 w-4 shrink-0" />
          <span className={compact ? 'hidden sm:inline' : ''}>Instalar no iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Instalar no iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2.5 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-emerald-700">1.</span>
                  <span>
                    Toque no botão <strong className="inline-flex items-center gap-1 text-slate-900"><Share className="h-3.5 w-3.5" /> Compartilhar</strong> na barra do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-emerald-700">2.</span>
                  <span>
                    Role para baixo e toque em <strong className="text-slate-900">Adicionar à Tela de Início</strong>.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
