import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../context/ChatContext';
import { usePwa } from '../../context/PwaContext';
import { 
  Sparkles, 
  UserCheck, 
  LogOut, 
  Palette, 
  ShieldCheck, 
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Bell,
  Download,
  ShieldAlert
} from 'lucide-react';
import { HDTalkLogo, CreatorBadge } from '../ui/HDTalkLogo';
import { Avatar } from '../ui/Avatar';

export function GlassNavbar({ onOpenThemeModal, onOpenProfileModal, onOpenRequestsModal, onOpenNotificationModal, onOpenAdminModal }) {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const { currentThemeObj, isDark, toggleMode } = useTheme();
  const { pendingRequestsCount } = useChat();
  const { installApp, isInstalled } = usePwa();

  const cleanEmail = (user?.email || '').toLowerCase().trim();
  const isAdmin = user?.role === 'admin' || cleanEmail === 'shikhar@gmail.com' || cleanEmail === 'himanshudwivedi0325@gmail.com';

  return (
    <header className="h-14 sm:h-16 px-4 md:px-6 flex items-center justify-between bg-white/80 dark:bg-[#070c18]/90 border-b border-slate-200/80 dark:border-white/10 backdrop-blur-xl z-20 select-none transition-colors duration-200 flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <HDTalkLogo size="md" showText={true} />
        <div className="hidden lg:block">
          <CreatorBadge />
        </div>
      </div>

      {/* Center Gateway Status */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs shadow-xs">
        <span className="relative flex h-2 w-2">
          {isConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
        </span>
        <span className="text-slate-600 dark:text-slate-300 font-medium">
          {isConnected ? 'Real-Time WebSocket Connected' : 'Connecting to Gateway...'}
        </span>
        <span className="text-slate-300 dark:text-white/20">•</span>
        <span className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          WebRTC Mesh
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">

        {/* Light / Dark Mode Toggle Button */}
        <button
          onClick={toggleMode}
          className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 transition hover:scale-105 active:scale-95 group relative"
          title={`Currently ${isDark ? 'Dark' : 'Light'} Mode (Click to switch)`}
          aria-label="Toggle Theme Mode"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
          ) : (
            <Moon className="w-4 h-4 text-blue-600 group-hover:-rotate-12 transition-transform duration-300" />
          )}
        </button>

        {/* Download & Install HDTalk App Button */}
        {!isInstalled && (
          <button
            onClick={installApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition hover:scale-105 active:scale-95 group"
            title="Download & Install HDTalk App"
            aria-label="Download HDTalk App"
          >
            <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
            <span className="hidden sm:inline">Download App</span>
            <span className="sm:hidden">App</span>
          </button>
        )}

        {/* Admin Console Pill Button */}
        {isAdmin && (
          <button
            onClick={onOpenAdminModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500/15 via-purple-500/15 to-indigo-500/15 hover:from-rose-500/25 hover:to-indigo-500/25 border border-rose-300/60 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 font-bold text-xs transition hover:scale-105 active:scale-95 shadow-xs"
            title="Open Admin User Management Console"
            aria-label="Open Admin Console"
          >
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span className="hidden md:inline">Admin Console</span>
          </button>
        )}

        {/* Connection Requests Button (Prominent on laptop & tablet) */}
        <button
          onClick={onOpenRequestsModal}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-600/15 hover:bg-blue-100 dark:hover:bg-blue-600/30 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 font-semibold text-xs transition hover:scale-105 active:scale-95 shadow-xs"
          title="Sent & Received Friend Requests"
          aria-label="Sent and Received Friend Requests"
        >
          <UserCheck className="w-4 h-4 text-blue-600 dark:text-cyan-400 flex-shrink-0" />
          <span className="hidden sm:inline font-bold">Requests</span>
          {pendingRequestsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold shadow animate-pulse">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        {/* Web Push Background Notifications Bell */}
        <button
          onClick={onOpenNotificationModal}
          className="relative p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 transition hover:scale-105 active:scale-95 group"
          title="Background Call & Message Notifications (Web Push)"
          aria-label="Notification Settings"
        >
          <Bell className="w-4 h-4" />
          {typeof Notification !== 'undefined' && Notification.permission === 'granted' ? (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#070c18]"></span>
          ) : (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse ring-2 ring-white dark:ring-[#070c18]"></span>
          )}
        </button>

        {/* Theme Palette Picker Button (Desktop/Tablet, available in mobile bottom nav) */}
        <button
          onClick={onOpenThemeModal}
          className="hidden sm:flex p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition"
          title={`Palette: ${currentThemeObj.name}`}
        >
          <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </button>

        {/* Profile Pill */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-white/10">
            <button
              onClick={onOpenProfileModal}
              className="flex items-center gap-2.5 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition"
              title="Edit Profile"
            >
              <Avatar
                src={user.avatar}
                name={user.name}
                size="sm"
                shape="circle"
              />
              <span className="text-xs font-semibold text-slate-900 dark:text-white hidden md:block max-w-[100px] truncate">
                {user.name}
              </span>
            </button>

            <button
              onClick={logout}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-white/10 hover:border-rose-200 dark:hover:border-rose-500/30 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
