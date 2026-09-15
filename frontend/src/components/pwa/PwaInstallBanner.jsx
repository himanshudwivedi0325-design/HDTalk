import React, { useState, useEffect } from 'react';
import { usePwa } from '../../context/PwaContext';
import { Download, X, Smartphone, Sparkles, CheckCircle2 } from 'lucide-react';

export function PwaInstallBanner() {
  const { isInstalled, installApp, canInstall, justInstalled, setShowInstallModal } = usePwa();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('hdtalk_pwa_banner_dismissed') === 'true';
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('hdtalk_pwa_banner_dismissed', 'true');
  };

  if (justInstalled) {
    return (
      <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-md bg-emerald-600 text-white p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
        <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-bold">HDTalk App Installed Successfully! 🎉</p>
          <p className="text-[11px] opacity-90">Open HDTalk directly from your phone's Home Screen or Apps.</p>
        </div>
      </div>
    );
  }

  // Do not display banner if already installed or dismissed
  if (isInstalled || dismissed) {
    return null;
  }

  return (
    <aside 
      aria-label="Download App Banner"
      className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-lg bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-3 sm:p-3.5 shadow-2xl shadow-blue-500/10 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 transition-all"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-0.5 flex-shrink-0 shadow-md">
          <img src="/icon.svg" alt="HDTalk" className="w-full h-full rounded-[10px] object-cover" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
              Install HDTalk WebApp
            </h4>
            <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-600/30 text-blue-600 dark:text-cyan-300 text-[9px] font-extrabold uppercase">
              Free
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Fullscreen real-time chat & loud incoming call alerts!
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={installApp}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 hover:scale-105 active:scale-95 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition"
          title="Dismiss"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
