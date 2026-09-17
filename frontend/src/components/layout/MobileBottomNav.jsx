import React from 'react';
import { MessageSquare, Compass, Palette, User, UserCheck, ShieldAlert, HelpCircle } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

export function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenThemeModal,
  onOpenProfileModal,
  onOpenRequestsModal,
  onOpenAdminModal,
  onOpenHelpModal,
  unreadCount = 0,
  pendingRequestsCount = 0,
  user
}) {
  const cleanEmail = (user?.email || '').toLowerCase().trim();
  const isAdmin = user?.role === 'admin' || cleanEmail === 'shikhar@gmail.com' || cleanEmail === 'himanshudwivedi0325@gmail.com';
  return (
    <nav className="md:hidden flex items-center justify-around h-14 bg-white/95 dark:bg-[#070c18]/95 border-t border-slate-200/80 dark:border-white/10 backdrop-blur-xl z-30 select-none flex-shrink-0 px-2">
      {/* Chats Tab */}
      <button
        onClick={() => onTabChange('chats')}
        className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors ${
          activeTab === 'chats'
            ? 'text-blue-600 dark:text-cyan-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <div className="relative">
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold shadow">
              {unreadCount}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5">Chats</span>
      </button>

      {/* Discover / Matchmaking Tab */}
      <button
        onClick={() => onTabChange('discover')}
        className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors ${
          activeTab === 'discover'
            ? 'text-blue-600 dark:text-cyan-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Compass className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Discover</span>
      </button>

      {/* Friend Requests Button */}
      <button
        onClick={onOpenRequestsModal}
        className="flex flex-col items-center justify-center flex-1 py-1 relative text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors"
      >
        <div className="relative">
          <UserCheck className="w-5 h-5" />
          {pendingRequestsCount > 0 && (
            <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold shadow animate-pulse">
              {pendingRequestsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5">Requests</span>
      </button>

      {/* Admin Button (Mobile) */}
      {isAdmin && (
        <button
          onClick={onOpenAdminModal}
          className="flex flex-col items-center justify-center flex-1 py-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors"
          title="Admin User Management Console"
        >
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          <span className="text-[10px] mt-0.5 font-bold">Admin</span>
        </button>
      )}

      {/* Themes Button */}
      <button
        onClick={onOpenThemeModal}
        className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors"
      >
        <Palette className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Themes</span>
      </button>

      {/* Help & AI Support Button */}
      <button
        onClick={onOpenHelpModal}
        className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors"
        title="Help & AI Support"
      >
        <HelpCircle className="w-5 h-5 text-blue-500 dark:text-cyan-400" />
        <span className="text-[10px] mt-0.5">Help</span>
      </button>

      {/* Profile Button */}
      <button
        onClick={onOpenProfileModal}
        className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors"
      >
        {user ? (
          <Avatar src={user.avatar} name={user.name} size="xs" shape="circle" />
        ) : (
          <User className="w-5 h-5" />
        )}
        <span className="text-[10px] mt-0.5">Profile</span>
      </button>
    </nav>
  );
}
