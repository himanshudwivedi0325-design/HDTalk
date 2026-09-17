import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../context/ChatContext';
import { usePwa } from '../../context/PwaContext';
import { 
  UserCheck, 
  LogOut, 
  Palette, 
  ShieldCheck, 
  ChevronDown,
  Sun,
  Moon,
  Bell,
  Download,
  ShieldAlert,
  User,
  Sparkles,
  ExternalLink,
  HelpCircle,
  Bot
} from 'lucide-react';
import { HDTalkLogo, CreatorBadge } from '../ui/HDTalkLogo';
import { Avatar } from '../ui/Avatar';

export function GlassNavbar({ 
  onOpenThemeModal, 
  onOpenProfileModal, 
  onOpenRequestsModal, 
  onOpenNotificationModal, 
  onOpenAdminModal,
  onOpenHelpModal
}) {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const { currentThemeObj, isDark, toggleMode } = useTheme();
  const { pendingRequestsCount } = useChat();
  const { installApp, isInstalled } = usePwa();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const cleanEmail = (user?.email || '').toLowerCase().trim();
  const isAdmin = user?.role === 'admin' || cleanEmail === 'shikhar@gmail.com' || cleanEmail === 'himanshudwivedi0325@gmail.com';
  const isCreator = cleanEmail === 'shikhar@gmail.com' || cleanEmail === 'himanshudwivedi0325@gmail.com';

  // Close dropdown on click outside or on page scroll
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }
    function handleScroll() {
      setIsUserMenuOpen(false);
    }
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isUserMenuOpen]);

  // Extract clean first name for personal touch
  const firstName = user?.name ? user.name.split(' ')[0] : 'Account';

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-5 md:px-6 flex items-center justify-between bg-white/85 dark:bg-[#070b14]/85 border-b border-slate-200/70 dark:border-white/[0.08] backdrop-blur-2xl relative z-40 select-none transition-colors duration-200 flex-shrink-0">
      {/* Left: Brand & Creator Identity */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <HDTalkLogo size="md" showText={true} />
        <div className="hidden lg:block">
          <CreatorBadge />
        </div>
      </div>

      {/* Center: Minimalist Security & Live Gateway Status */}
      <div 
        className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 text-xs shadow-xs backdrop-blur-md whitespace-nowrap cursor-default select-none"
        title={isConnected ? 'Connected to Real-Time Gateway (WebRTC Mesh Active)' : 'Connecting to Gateway...'}
      >
        <span className="relative flex h-2 w-2 flex-shrink-0">
          {isConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
        </span>
        <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
          {isConnected ? 'HDTalk Live' : 'Connecting...'}
        </span>
        <span className="text-slate-300 dark:text-white/20">•</span>
        <span className="text-blue-600 dark:text-cyan-400 font-medium flex items-center gap-1 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>E2E Encrypted</span>
        </span>
      </div>

      {/* Right: Cohesive Luxury Action Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Dark / Light Mode One-Click Toggle */}
        <button
          onClick={toggleMode}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/10 text-slate-600 dark:text-slate-300 transition-all hover:scale-105 active:scale-95 shadow-xs"
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle Theme Mode"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 text-blue-600 transition-transform duration-300 hover:-rotate-12" />
          )}
        </button>

        {/* PWA Install Button (Compact & Elegant Glass) */}
        {!isInstalled && (
          <button
            onClick={installApp}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-cyan-300 font-semibold text-xs transition-all hover:scale-105 active:scale-95 shadow-xs whitespace-nowrap"
            title="Download & Install HDTalk App (PWA)"
            aria-label="Install App"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Install App</span>
          </button>
        )}

        {/* Admin Console Badge Button (Executive Styling for Admins) */}
        {isAdmin && (
          <button
            onClick={onOpenAdminModal}
            className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-semibold text-xs transition-all hover:scale-105 active:scale-95 shadow-xs whitespace-nowrap"
            title="Open Admin User Management Console"
            aria-label="Open Admin Console"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="hidden md:inline">Admin</span>
          </button>
        )}

        {/* Friend Requests Button with Notification Badge */}
        <button
          onClick={onOpenRequestsModal}
          className="relative flex items-center justify-center h-9 w-9 xl:w-auto xl:px-3 rounded-xl bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 transition-all hover:scale-105 active:scale-95 shadow-xs gap-1.5 whitespace-nowrap"
          title="Friend Requests"
          aria-label="Friend Requests"
        >
          <UserCheck className="w-4 h-4 text-blue-600 dark:text-cyan-400 flex-shrink-0" />
          <span className="hidden xl:inline text-xs font-semibold">Requests</span>
          {pendingRequestsCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold shadow-sm animate-pulse">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        {/* Push Notification Manager Bell */}
        <button
          onClick={onOpenNotificationModal}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 transition-all hover:scale-105 active:scale-95 shadow-xs"
          title="Notification Settings"
          aria-label="Notification Settings"
        >
          <Bell className="w-4 h-4" />
          {typeof Notification !== 'undefined' && Notification.permission === 'granted' ? (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#070c18]"></span>
          ) : (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#070c18]"></span>
          )}
        </button>

        {/* Theme Palette Button (Desktop/Tablet) */}
        <button
          onClick={onOpenThemeModal}
          className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all hover:scale-105 active:scale-95 shadow-xs"
          title={`Theme Gallery: ${currentThemeObj.name}`}
          aria-label="Theme Gallery"
        >
          <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        </button>

        {/* Help & AI Support Center Button */}
        <button
          onClick={onOpenHelpModal}
          className="flex w-9 h-9 items-center justify-center rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-cyan-400 transition-all hover:scale-105 active:scale-95 shadow-xs"
          title="Help & AI Support Center"
          aria-label="Help & AI Support"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Apple-Grade User Profile Pill & Luxury Popover Menu */}
        {user && (
          <div className="relative pl-1 sm:pl-2 border-l border-slate-200/80 dark:border-white/10" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(prev => !prev)}
              className="flex items-center gap-2 p-1 pr-2 rounded-full bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/10 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xs cursor-pointer"
              title="User Account & Settings"
              aria-label="User Menu"
            >
              <Avatar
                src={user.avatar}
                name={user.name}
                size="xs"
                shape="circle"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 hidden sm:block max-w-[100px] truncate">
                {firstName}
              </span>
              {isAdmin && (
                <span className="hidden md:inline text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  Admin
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180 text-blue-600 dark:text-cyan-400' : ''}`} />
            </button>

            {/* Luxury Floating Glass Menu */}
            {isUserMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-[90] bg-transparent" 
                  onClick={() => setIsUserMenuOpen(false)} 
                />
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white/95 dark:bg-[#0d1424]/98 border border-slate-200/80 dark:border-white/10 shadow-2xl backdrop-blur-2xl p-2 z-[100] animate-in fade-in zoom-in-95 duration-150 select-none">
                {/* User Identity Header */}
                <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 mb-1.5 flex items-center gap-3">
                  <Avatar
                    src={user.avatar}
                    name={user.name}
                    size="sm"
                    shape="circle"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        {isCreator ? 'Founder & Creator' : isAdmin ? 'Administrator' : 'Active Member'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Navigation Items */}
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenProfileModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-white/10 hover:text-blue-600 dark:hover:text-cyan-400 transition"
                  >
                    <User className="w-4 h-4 text-blue-600 dark:text-cyan-400 flex-shrink-0" />
                    <span>Profile & Account</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAdminModal();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition"
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span>Admin Management Console</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenThemeModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-white/10 hover:text-blue-600 dark:hover:text-cyan-400 transition"
                  >
                    <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    <span>Theme Gallery</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenNotificationModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-white/10 hover:text-blue-600 dark:hover:text-cyan-400 transition"
                  >
                    <Bell className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span>Notifications & Web Push</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenHelpModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-white/10 hover:text-blue-600 dark:hover:text-cyan-400 transition"
                  >
                    <Bot className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>Help & AI Assistant</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="my-1.5 border-t border-slate-200/80 dark:border-white/10"></div>

                {/* Logout Button */}
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  <span>Sign Out of HDTalk</span>
                </button>
              </div>
            </>
          )}
        </div>
        )}
      </div>
    </header>
  );
}
