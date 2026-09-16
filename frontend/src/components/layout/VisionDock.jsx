import React from 'react';
import { 
  MessageSquare, 
  Compass, 
  Video, 
  User, 
  Palette,
  PhoneCall,
  Sparkles
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export function VisionDock({ activeTab, onTabChange, onOpenThemeModal, onOpenProfileModal }) {
  const { conversations } = useChat();

  // Calculate total unread messages
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const tabs = [
    { id: 'chats', label: 'Messages', icon: MessageSquare, badge: totalUnread },
    { id: 'discover', label: 'Matchmaking', icon: Compass },
    { id: 'ai', label: 'Claude AI', icon: Sparkles },
    { id: 'profile', label: 'Profile', icon: User, action: onOpenProfileModal },
    { id: 'theme', label: 'Themes', icon: Palette, action: onOpenThemeModal }
  ];

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-3 py-2 rounded-3xl vision-glass-dock flex items-center gap-1.5 shadow-2xl transition-all duration-300">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.action) {
                tab.action();
              } else {
                onTabChange(tab.id);
              }
            }}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl font-medium text-xs transition-all duration-200 group ${
              isActive
                ? 'bg-gradient-to-r from-blue-600/15 to-indigo-600/15 dark:from-purple-500/30 dark:to-cyan-500/30 text-blue-600 dark:text-white border border-blue-500/30 dark:border-white/20 shadow-lg shadow-blue-500/10 dark:shadow-purple-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10'
            }`}
          >
            <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-blue-600 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'}`} />
            <span className={`tracking-wide ${isActive ? 'font-semibold' : ''}`}>{tab.label}</span>

            {/* Unread Badge */}
            {tab.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
                {tab.badge}
              </span>
            )}

            {/* Active Indicator dot */}
            {isActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600 dark:bg-cyan-400 shadow-sm shadow-blue-500 dark:shadow-cyan-400"></span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
