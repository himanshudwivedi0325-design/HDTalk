import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { X, Check, Palette, Sparkles, Sun, Moon, Monitor } from 'lucide-react';

export function ThemeSelector({ isOpen, onClose }) {
  const { theme, themes, setTheme, mode, setMode } = useTheme();

  if (!isOpen) return null;

  const modeOptions = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in select-none">
      <div className="bg-white dark:bg-[#0e1424] max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/20 relative transition-colors duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-300">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Appearance & Theme</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">HDTalk Custom Themes & Light/Dark Modes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Appearance Mode Segmented Control */}
        <div className="mb-6">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Color Mode
          </label>
          <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            {modeOptions.map(opt => {
              const Icon = opt.icon;
              const isSelected = mode === opt.id;

              return (
                <button
                  key={opt.id}
                  onClick={() => setMode(opt.id)}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm dark:shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme Palette Cards */}
        <div className="space-y-2.5">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Brand Accent Palette
          </label>
          {themes.map(t => {
            const isSelected = theme === t.id;

            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-all ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-600/15 border-blue-500 dark:border-blue-500/60 shadow-md shadow-blue-500/15 ring-1 ring-blue-500/40'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Swatch circle */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md relative overflow-hidden flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})` }}
                  >
                    <Sparkles className="w-4 h-4 text-white opacity-80" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{t.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.desc}</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-blue-600 dark:bg-cyan-400 text-white dark:text-black flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Check className="w-4 h-4 font-bold" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl apphitect-btn-primary text-white font-semibold text-xs shadow-md shadow-blue-600/30 hover:scale-105 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
