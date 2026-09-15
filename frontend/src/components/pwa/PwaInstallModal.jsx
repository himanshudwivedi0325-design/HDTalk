import React, { useState } from 'react';
import { usePwa } from '../../context/PwaContext';
import { 
  X, 
  Download, 
  Smartphone, 
  Laptop, 
  Share2, 
  PlusSquare, 
  CheckCircle2, 
  Sparkles, 
  PhoneCall, 
  MessageSquare,
  ShieldCheck,
  Zap
} from 'lucide-react';

export function PwaInstallModal({ isOpen, onClose }) {
  const { isIOS, isAndroid, isDesktop, installApp, hasPrompt, isInstalled } = usePwa();
  const [activeTab, setActiveTab] = useState(isIOS ? 'ios' : isAndroid ? 'android' : 'desktop');

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (hasPrompt) {
      await installApp();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in select-none">
      <div className="bg-white dark:bg-[#0c1220] max-w-lg w-full rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/90 dark:border-white/15 relative overflow-hidden transition-all duration-200">
        
        {/* Glow ambient decoration */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-500/20 flex-shrink-0">
              <img src="/icon.svg" alt="HDTalk" className="w-full h-full rounded-[14px] object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-xl text-slate-900 dark:text-white">
                  Download HDTalk App
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-cyan-400 text-[10px] font-extrabold uppercase tracking-wider">
                  PWA WebApp
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Install directly on your phone or desktop for instant chats & calls!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-3 gap-2 my-4">
          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex flex-col items-center text-center">
            <PhoneCall className="w-5 h-5 text-emerald-500 mb-1" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Instant Calls</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400">Ringtone & vibration</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex flex-col items-center text-center">
            <Zap className="w-5 h-5 text-amber-500 mb-1" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Fullscreen</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400">No browser address bar</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex flex-col items-center text-center">
            <ShieldCheck className="w-5 h-5 text-blue-500 mb-1" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Zero Storage</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400">Lightweight &lt;2MB</span>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex rounded-2xl bg-slate-100 dark:bg-white/5 p-1 mb-4 border border-slate-200 dark:border-white/10">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'android'
                ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Android
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'ios'
                ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            iPhone / iPad
          </button>
          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'desktop'
                ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            Desktop / Laptop
          </button>
        </div>

        {/* Step-by-Step Instructions based on active tab */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-3 mb-5">
          {activeTab === 'android' && (
            <div className="space-y-2.5">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">1</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Click the <strong>"Install HDTalk Now"</strong> button below or tap the Chrome menu (<strong>⋮</strong> three dots).
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">2</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong> on your phone.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">3</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  HDTalk icon appears on your home screen! Open it to chat and receive audio/video calls just like WhatsApp.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-2.5">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">1</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  In Safari, tap the <strong>Share</strong> button (<strong><Share2 className="w-3.5 h-3.5 inline text-blue-500" /></strong>) at the bottom toolbar.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">2</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Scroll down the share sheet and tap <strong>"Add to Home Screen"</strong> (<strong><PlusSquare className="w-3.5 h-3.5 inline text-blue-500" /></strong>).
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">3</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Tap <strong>"Add"</strong> at the top right. HDTalk will install on your iPhone home screen!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'desktop' && (
            <div className="space-y-2.5">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">1</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Click the <strong>"Install HDTalk"</strong> button below, or click the <strong>Install icon (⊕)</strong> on the right side of your Chrome/Edge address bar.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">2</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Click <strong>"Install"</strong> in the browser prompt.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">3</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  HDTalk opens as a native desktop application with taskbar pin, window controls, and keyboard shortcuts!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-3">
          {hasPrompt ? (
            <button
              onClick={handleInstallClick}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Download className="w-4 h-4" />
              Install HDTalk App Now
            </button>
          ) : isInstalled ? (
            <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-sm border border-emerald-200 dark:border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
              HDTalk is Already Installed!
            </div>
          ) : (
            <button
              onClick={() => {
                if (hasPrompt) installApp();
                else onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              Got it, Follow Steps Above
            </button>
          )}

          <button
            onClick={onClose}
            className="py-3 px-5 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold text-sm transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
