import React, { useState, useEffect } from 'react';
import { Bell, BellRing, BellOff, CheckCircle2, AlertCircle, Sparkles, X, Smartphone, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  isPushSupported, 
  getPermissionState, 
  subscribeToPush, 
  sendTestPushNotification,
  showLocalTestNotification
} from '../../services/pushService';

export function NotificationManagerModal({ isOpen, onClose }) {
  const { user, token } = useAuth();
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const supported = isPushSupported();
      setIsSupported(supported);
      if (supported) {
        setPermission(getPermissionState());
      }
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEnableNotifications = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      await subscribeToPush(token);
      setPermission('granted');
      setStatusMessage({
        type: 'success',
        text: '🎉 Background Push Notifications enabled! You will receive calls & messages even when your phone screen is locked.'
      });
    } catch (err) {
      setPermission(getPermissionState());
      const isBrave = typeof navigator !== 'undefined' && 
        ((navigator.brave && typeof navigator.brave.isBrave === 'function') || navigator.userAgent.includes('Brave'));
      
      if (err.message?.includes('push service error') || isBrave) {
        setStatusMessage({
          type: 'info',
          text: 'Brave Browser blocks background push service by default. Notifications on this device are active! To enable background push while app is closed, toggle "Use Google services for push messaging" in brave://settings/privacy.'
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: 'Device notifications are active! (' + (err.message || 'Push service unavailable') + ')'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await sendTestPushNotification(token);
      setStatusMessage({
        type: 'success',
        text: res.message || '🔔 Notification dispatched! Check your device notification tray.'
      });
    } catch (err) {
      try {
        await showLocalTestNotification();
        setStatusMessage({
          type: 'success',
          text: '🔔 Test notification alert dispatched to your screen!'
        });
      } catch (localErr) {
        setStatusMessage({
          type: 'error',
          text: err.message || 'Failed to dispatch notification alert.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0e1526] w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 relative overflow-hidden text-slate-900 dark:text-white">
        {/* Glow ambient */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-500/15 dark:bg-blue-600/25 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <BellRing className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-display">Background Push Alerts</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Web Push API & Service Worker</p>
          </div>
        </div>

        {/* Support & Permission Status */}
        {!isSupported ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs mb-4">
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>Not Supported by this Browser</span>
            </div>
            <span>Your current browser does not support Service Worker Web Push API. For background alerts, use Chrome, Edge, Safari (iOS 16.4+), or Firefox.</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</div>
                  <div className="text-sm font-bold flex items-center gap-1.5 mt-0.5">
                    {permission === 'granted' ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-emerald-600 dark:text-emerald-400">Active & Subscribed</span>
                      </>
                    ) : permission === 'denied' ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <span className="text-rose-600 dark:text-rose-400">Blocked in Browser</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span className="text-amber-600 dark:text-amber-400">Not Enabled Yet</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {permission === 'granted' && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  Ready
                </span>
              )}
            </div>

            {/* Explanation card */}
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-2xl border border-blue-200/50 dark:border-blue-900/40">
              <div className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>What does this do?</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                <li>Rings your phone like a real phone call when someone calls.</li>
                <li>Notifies you of new messages even if your browser tab is closed.</li>
                <li>Vibrates and plays notification chimes when screen is locked.</li>
              </ul>
            </div>

            {/* Feedback message banner */}
            {statusMessage && (
              <div className={`p-3 rounded-2xl text-xs flex items-start gap-2 border ${
                statusMessage.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50' 
                  : statusMessage.type === 'info'
                  ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-cyan-300 border-blue-200 dark:border-blue-800/50'
                  : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
              }`}>
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : statusMessage.type === 'info' ? (
                  <ShieldCheck className="w-4 h-4 text-blue-500 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-2.5">
              {permission !== 'granted' ? (
                <button
                  onClick={handleEnableNotifications}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  <span>{loading ? 'Requesting Permission...' : 'Enable Background Push Alerts'}</span>
                </button>
              ) : (
                <button
                  onClick={handleSendTest}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? 'Dispatching...' : '🔔 Send Test Push Notification'}</span>
                </button>
              )}

              {permission === 'denied' && (
                <p className="text-[11px] text-center text-slate-400">
                  ⚠️ Notifications were blocked. Click the lock / tune icon in your browser URL bar to set Notifications to "Allow".
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
