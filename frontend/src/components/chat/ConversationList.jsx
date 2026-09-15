import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Search, Plus, MessageSquare, Check, CheckCheck, Filter, Mic, Image as ImageIcon, PanelLeftClose } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { formatChatTimestamp, formatLastActive } from '../../utils/timeAgo';

export function ConversationList({ onNewChatClick, onCollapse, onSelectChat }) {
  const { user } = useAuth();
  const { conversations, activeConversation, selectConversation, typingUsers } = useChat();
  const { isUserOnline, getUserLastSeen } = useSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread'

  const getOther = (c) => {
    return c.otherUser || (c.participants?.find(p => (typeof p === 'object' ? p.id : p) !== user?.id));
  };

  const filtered = conversations.filter(c => {
    const other = getOther(c);
    if (!other) return false;
    const name = (other.name || '').toLowerCase();
    const lastMsg = c.lastMessage?.text?.toLowerCase() || '';
    const matchesSearch = name.includes(searchTerm.toLowerCase()) || lastMsg.includes(searchTerm.toLowerCase());
    
    if (activeFilter === 'unread') {
      return matchesSearch && (c.unreadCount > 0);
    }
    return matchesSearch;
  });

  return (
    <div className="w-full md:w-80 lg:w-[340px] flex flex-col h-full bg-white/95 dark:bg-[#0e1424]/95 border-r border-slate-200/80 dark:border-white/10 select-none transition-colors duration-200 flex-shrink-0">
      {/* Top Apphitect Header */}
      <div className="p-4 border-b border-slate-200/80 dark:border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Messages</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30">
                {conversations.length}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onNewChatClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 text-xs font-semibold hover:scale-105 transition active:scale-95"
              title="Start New Chat"
            >
              <Plus className="w-4 h-4" />
              <span>New</span>
            </button>

            {onCollapse && (
              <button
                onClick={onCollapse}
                className="hidden md:flex p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
                title="Hide messages sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 apphitect-input focus:outline-none"
          />
        </div>

        {/* Filter Pills (All, Unread) */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeFilter === 'all'
                ? 'bg-blue-50 dark:bg-blue-600/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/40 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            All Chats
          </button>
          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeFilter === 'unread'
                ? 'bg-blue-50 dark:bg-blue-600/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/40 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <span>Unread</span>
            {conversations.some(c => c.unreadCount > 0) && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            )}
          </button>
        </div>
      </div>

      {/* Conversation Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <MessageSquare className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">No conversations</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Click "+ New" or explore Matchmaking to start chatting!
            </p>
          </div>
        ) : (
          filtered.map(c => {
            const isSelected = activeConversation?.id === c.id;
            const other = getOther(c);
            const isOnline = other ? isUserOnline(other.id) : false;
            const isTyping = Boolean(
              (other && typingUsers[other.id]) ||
              (c.id && typingUsers[c.id])
            );

            return (
              <div
                key={c.id}
                onClick={() => {
                  selectConversation(c);
                  onSelectChat?.(c);
                }}
                className={`w-full p-3 rounded-2xl flex items-center gap-3.5 transition duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/35 shadow-xs dark:shadow-md dark:shadow-blue-500/10'
                    : 'hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent'
                }`}
              >
                {/* Avatar with Status Ring */}
                <Avatar
                  src={other?.avatar}
                  name={other?.name}
                  size="lg"
                  isOnline={isOnline}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display font-bold text-[14.5px] text-slate-900 dark:text-white truncate max-w-[140px] tracking-tight">
                      {other?.name}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">
                      {formatChatTimestamp(c.lastMessage?.timestamp || c.updatedAt || c.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    {isTyping ? (
                      <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold italic text-xs animate-pulse">
                        <span className="flex gap-0.5 items-center">
                          <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></span>
                        </span>
                        typing...
                      </span>
                    ) : (
                      <p className={`text-xs truncate max-w-[160px] ${
                        isSelected ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {c.lastMessage?.text || 'No messages yet'}
                      </p>
                    )}

                    {/* Unread Pill */}
                    {c.unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px] ml-2 flex-shrink-0 shadow-sm shadow-blue-600/40">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Profession Badge */}
                  {other && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      <span className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-600/15 border border-blue-200/80 dark:border-blue-500/30 text-blue-700 dark:text-cyan-300 text-[10.5px] font-semibold truncate max-w-[170px]">
                        💼 {other.profession || 'Professional'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
