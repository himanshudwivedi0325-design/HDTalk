import React from 'react';
import { 
  MessageSquare, 
  Compass, 
  PhoneCall, 
  Users, 
  Palette, 
  Settings, 
  Sparkles,
  LogOut
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { HDTalkLogo } from '../ui/HDTalkLogo';
import { Avatar } from '../ui/Avatar';

export function ApphitectSidebar({ 
  activeTab, 
  onTabChange, 
  onOpenThemeModal, 
  onOpenProfileModal
}) {
  const { conversations } = useChat();
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const navItems = [
    { id: 'chats', label: 'All Chats', icon: MessageSquare, badge: totalUnread },
    { id: 'discover', label: 'Matchmaking', icon: Compass },
    { id: 'theme', label: 'Themes', icon: Palette, action: onOpenThemeModal }
  ];

  return (
    <aside className="w-16 md:w-18 flex flex-col items-center justify-between py-4 bg-white/80 dark:bg-[#070c18]/95 backdrop-blur-2xl border-r border-slate-200/80 dark:border-white/10 z-30 select-none transition-colors duration-200">
      {/* Top: Logo / Brand Icon */}
      <div className="flex flex-col items-center gap-3">
        <div 
          onClick={() => onTabChange('chats')}
          className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1.5px] shadow-md shadow-blue-500/20 dark:shadow-lg dark:shadow-blue-500/30 cursor-pointer hover:scale-105 transition"
          title="HDTalk - Created by Himanshu Dwivedi"
        >
          <div className="w-full h-full bg-white dark:bg-[#070c18] rounded-[14px] flex items-center justify-center p-1">
            <HDTalkLogo size="sm" showText={false} />
          </div>
        </div>

        {/* Live Gateway Status Pill */}
        <div 
          className="relative flex items-center justify-center cursor-pointer"
          title={isConnected ? 'HDTalk Gateway: Active' : 'Connecting to Server...'}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-rose-500'}`}></span>
          {isConnected && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 absolute animate-ping opacity-75"></span>
          )}
        </div>
      </div>

      {/* Center: Navigation Menu Icons */}
      <div className="flex flex-col items-center gap-3 w-full px-2">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.action) {
                  item.action();
                } else {
                  onTabChange(item.id);
                }
              }}
              className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40'
                  : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />

              {/* Unread Badge Counter */}
              {item.badge > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold shadow animate-pulse">
                  {item.badge}
                </span>
              )}

              {/* Hover Tooltip on desktop */}
              <span className="absolute left-16 px-2.5 py-1 rounded-xl bg-slate-900 text-white text-xs font-medium whitespace-nowrap shadow-xl border border-slate-700 dark:border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom: User Avatar & Logout */}
      <div className="flex flex-col items-center gap-3">
        {user && (
          <button
            onClick={onOpenProfileModal}
            className="relative group cursor-pointer"
            title={`${user.name} - Profile Settings`}
          >
            <Avatar
              src={user.avatar}
              name={user.name}
              size="md"
              isOnline={true}
            />

            <span className="absolute left-16 px-2.5 py-1 rounded-xl bg-slate-900 text-white text-xs font-medium whitespace-nowrap shadow-xl border border-slate-700 dark:border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              {user.name} (Profile)
            </span>
          </button>
        )}

        {/* Creator Info Icon & Tooltip */}
        <div className="relative group">
          <div 
            className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-600/15 border border-blue-500/25 dark:border-blue-500/30 flex items-center justify-center text-[10px] font-black text-blue-600 dark:text-blue-400 cursor-pointer transition hover:bg-blue-500/20 dark:hover:bg-blue-600/30 hover:scale-105"
            title="HDTalk • Created by Himanshu Dwivedi"
          >
            HD
          </div>
          <span className="absolute left-14 bottom-0 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap shadow-2xl border border-blue-500/30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 flex items-center gap-1.5">
            <span className="text-blue-400 font-bold">HDTalk</span>
            <span className="text-white/40">•</span>
            <span>Created by <b className="text-cyan-300 font-semibold">Himanshu Dwivedi</b></span>
          </span>
        </div>

        <button
          onClick={logout}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition group"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
