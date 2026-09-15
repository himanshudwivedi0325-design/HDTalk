import React, { useState, useEffect } from 'react';
import { BellRing, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isPushSupported, getPermissionState, subscribeToPush } from '../../services/pushService';

export function NotificationBanner({ onOpenModal }) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    const dismissed = sessionStorage.getItem('hdtalk_push_dismissed');
    if (!dismissed && isPushSupported()) {
      const perm = getPermissionState();
      if (perm === 'default') {
        setVisible(true);
      }
    }
  }, [user]);

  if (!visible) return null;

  const handleQuickEnable = async () => {
    setLoading(true);
    try {
      await subscribeToPush(user?.token);
      setVisible(false);
    } catch (err) {
      if (onOpenModal) onOpenModal();
      setVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('hdtalk_push_dismissed', 'true');
    setVisible(false);
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white px-4 py-2 text-xs flex items-center justify-between shadow-md relative z-30 transition-all select-none animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2 truncate pr-2">
        <div className="p-1 rounded-lg bg-white/20">
          <BellRing className="w-3.5 h-3.5 animate-bounce text-white" />
        </div>
        <span className="font-medium truncate">
          Never miss calls & messages! Enable background push notifications on this device.
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleQuickEnable}
          disabled={loading}
          className="px-3 py-1 rounded-full bg-white text-blue-700 hover:bg-white/90 font-bold text-[11px] shadow-sm transition hover:scale-105 active:scale-95 disabled:opacity-60 flex items-center gap-1 cursor-pointer"
        >
          <span>{loading ? 'Enabling...' : 'Enable Now'}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition"
          title="Dismiss for this session"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
