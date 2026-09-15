import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { X, UserCheck, Sparkles, Check, ArrowRight, ExternalLink } from 'lucide-react';

export function DemoSwitcherModal({ isOpen, onClose }) {
  const { user, demoUsers, quickLogin } = useAuth();
  const { isUserOnline } = useSocket();

  if (!isOpen) return null;

  const handleSwitch = async (userId) => {
    await quickLogin(userId);
    onClose();
  };

  const handleOpenInNewTab = (userId) => {
    window.open(`${window.location.origin}/?user=${userId}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-in fade-in select-none transition-colors duration-200">
      <div className="bg-white dark:bg-[#0c1220] max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200/90 dark:border-white/20 relative transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-blue-50 dark:bg-cyan-500/20 text-blue-600 dark:text-cyan-300 border border-blue-200 dark:border-cyan-500/30">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Switch Demo User</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Instantly switch active user identity or open side-by-side</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5 my-4">
          {demoUsers.map((u) => {
            const isCurrent = user?.id === u.id;
            const online = isUserOnline(u.id);

            return (
              <div
                key={u.id}
                className={`flex items-center justify-between p-3 rounded-2xl border transition duration-200 ${
                  isCurrent
                    ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-300 dark:border-blue-500/40 shadow-xs dark:shadow-lg dark:shadow-blue-600/10 ring-1 ring-blue-400/30'
                    : 'bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border-slate-200 dark:border-white/10'
                }`}
              >
                <div 
                  onClick={() => !isCurrent && handleSwitch(u.id)}
                  className={`flex items-center gap-3 flex-1 cursor-pointer ${isCurrent ? 'pointer-events-none' : ''}`}
                >
                  <div className="relative">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/20"
                    />
                    {online && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 ring-2 ring-white dark:ring-[#0f172a] absolute -bottom-0.5 -right-0.5 animate-pulse"></span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 dark:text-white">{u.name}</span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[9px] font-bold">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {u.nativeLanguage} ➔ {u.learningLanguage}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isCurrent ? (
                    <>
                      <button
                        onClick={() => handleSwitch(u.id)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm"
                        title="Switch in this tab"
                      >
                        Switch
                      </button>
                      <button
                        onClick={() => handleOpenInNewTab(u.id)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                        title="Open in new window/tab for dual testing"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
                      <Check className="w-4 h-4" /> Active
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] leading-relaxed">
          <p className="font-semibold flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Multi-Window Testing Tip:
          </p>
          Click the <ExternalLink className="w-3 h-3 inline mx-0.5" /> icon next to any user to open them in a separate tab. Both windows will connect to the real-time server simultaneously so you can test live chats and WebRTC HD video calling side-by-side!
        </div>
      </div>
    </div>
  );
}
