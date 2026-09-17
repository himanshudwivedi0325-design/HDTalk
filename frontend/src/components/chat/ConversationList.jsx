import React, { useState, useEffect, useCallback } from 'react';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Search, Plus, MessageSquare, Check, CheckCheck, Filter, Mic, Image as ImageIcon, PanelLeftClose, UserCheck, Trash2, UserPlus, Bot, Sparkles } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { formatChatTimestamp, formatLastActive } from '../../utils/timeAgo';

export function ConversationList({ onNewChatClick, onCollapse, onSelectChat, onOpenRequestsModal, onOpenHelpModal }) {
  const { user } = useAuth();
  const { conversations, activeConversation, selectConversation, typingUsers, pendingRequestsCount, deleteConversation, startDirectConversationWithUser } = useChat();
  const { isUserOnline, getUserLastSeen } = useSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread'
  const [platformUsers, setPlatformUsers] = useState([]);
  const [isStartingChat, setIsStartingChat] = useState(false);

  // Load platform users directory
  const loadPlatformUsers = useCallback(async () => {
    try {
      const res = await api.getUsers();
      if (res.success && Array.isArray(res.users)) {
        const clean = res.users.filter(u => {
          const email = (u.email || '').toLowerCase().trim();
          const id = u.id || '';
          return !email.includes('demo.hdtalk.local') && email !== 'himanshu.test99@gmail.com' && !id.startsWith('usr_demo_') && id !== 'usr_97d33ffd';
        });
        setPlatformUsers(clean);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadPlatformUsers();
    const handleSync = () => loadPlatformUsers();
    window.addEventListener('hdtalk:user-registered', handleSync);
    window.addEventListener('hdtalk:user-updated', handleSync);
    window.addEventListener('hdtalk:user-deleted', handleSync);
    return () => {
      window.removeEventListener('hdtalk:user-registered', handleSync);
      window.removeEventListener('hdtalk:user-updated', handleSync);
      window.removeEventListener('hdtalk:user-deleted', handleSync);
    };
  }, [loadPlatformUsers]);

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

  // Calculate matching registered users who don't already have a chat in conversations
  const existingChatUserIds = new Set(
    conversations.map(c => {
      const o = getOther(c);
      return typeof o === 'object' ? o?.id : o;
    }).filter(Boolean)
  );

  const matchingNewUsers = searchTerm.trim().length > 0
    ? platformUsers.filter(u => 
        u.id !== user?.id &&
        !existingChatUserIds.has(u.id) &&
        ((u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
         (u.profession || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
         (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  const handleStartChatWith = async (targetUser) => {
    if (isStartingChat) return;
    try {
      setIsStartingChat(true);
      const conv = await startDirectConversationWithUser(targetUser.id);
      if (conv) {
        onSelectChat?.(conv);
        setSearchTerm('');
      }
    } catch (err) {
      console.error('Could not start direct conversation:', err);
    } finally {
      setIsStartingChat(false);
    }
  };

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

        {/* Filter Pills (All, Unread, Requests) */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto no-scrollbar">
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
          <button
            onClick={() => onOpenRequestsModal?.()}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"
            title="View Sent & Received Friend Requests"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span>Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold shadow animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => onOpenHelpModal?.()}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent whitespace-nowrap"
            title="Help Center & AI Assistant"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
            <span>AI Help</span>
          </button>
        </div>
      </div>

      {/* Pending Requests Banner (High visibility on laptop) */}
      {pendingRequestsCount > 0 && (
        <div className="px-3 pt-2.5">
          <div
            onClick={() => onOpenRequestsModal?.()}
            className="p-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/10 border border-blue-200/80 dark:border-blue-500/30 flex items-center justify-between gap-2 cursor-pointer hover:border-blue-400 dark:hover:border-blue-400/50 transition shadow-xs group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-cyan-400">
                  {pendingRequestsCount} Friend {pendingRequestsCount === 1 ? 'Request' : 'Requests'}
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Click to view sent & received
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10.5px] font-bold shadow-xs flex-shrink-0">
              Review
            </span>
          </div>
        </div>
      )}

      {/* Conversation Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 && matchingNewUsers.length === 0 ? (
          <div className="text-center py-10 px-4">
            <MessageSquare className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">No conversations yet</p>
            <p className="text-[11px] text-slate-500 mt-1 mb-4">
              Click "+ New" or connect with registered members below!
            </p>

            {platformUsers.length > 0 && (
              <div className="space-y-1.5 text-left border-t border-slate-200/80 dark:border-white/10 pt-3">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1 mb-1">
                  Active Community Members ({platformUsers.length})
                </div>
                {platformUsers.filter(u => u.id !== user?.id).slice(0, 6).map(u => (
                  <div
                    key={u.id}
                    onClick={() => handleStartChatWith(u)}
                    className="p-2 rounded-xl flex items-center justify-between gap-2.5 hover:bg-blue-50 dark:hover:bg-white/5 border border-transparent hover:border-blue-200 dark:hover:border-blue-500/30 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar src={u.avatar} name={u.name} size="sm" isOnline={isUserOnline(u.id)} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.name}</div>
                        <div className="text-[10.5px] text-slate-500 truncate">{u.profession || 'Member'}</div>
                      </div>
                    </div>
                    <button className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10.5px] font-semibold flex items-center gap-1 shadow-xs group-hover:scale-105 transition">
                      <MessageSquare className="w-3 h-3" />
                      <span>Chat</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                className={`group w-full p-3 rounded-2xl flex items-center gap-3.5 transition duration-150 cursor-pointer ${
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
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="font-display font-bold text-[14.5px] text-slate-900 dark:text-white truncate tracking-tight">
                        {other?.name}
                      </span>
                      {(other?.id === 'usr_ai_bot' || other?.email === 'claude@hdtalk.ai') && (
                        <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 text-[9px] font-extrabold uppercase tracking-wider flex-shrink-0">
                          AI Bot
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete conversation with ${other?.name || 'this user'}?`)) {
                            deleteConversation(c.id, false);
                          }
                        }}
                        title="Delete chat"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {formatChatTimestamp(c.lastMessage?.timestamp || c.updatedAt || c.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
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
                      <p className={`text-xs truncate flex-1 min-w-0 ${
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

        {/* Matching Registered Users Directory Results */}
        {matchingNewUsers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-white/10 space-y-1.5 pb-3">
            <div className="px-2 py-1 text-[11px] font-bold text-blue-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Matching Registered Users ({matchingNewUsers.length})</span>
            </div>
            {matchingNewUsers.map(u => (
              <div
                key={u.id}
                onClick={() => handleStartChatWith(u)}
                className="p-2.5 rounded-2xl flex items-center justify-between gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-200/60 dark:border-blue-500/30 transition cursor-pointer group bg-blue-50/40 dark:bg-blue-950/20"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar src={u.avatar} name={u.name} size="md" isOnline={isUserOnline(u.id)} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.name}</div>
                    <div className="text-[10.5px] text-slate-500 truncate">{u.profession || u.email || 'Member'}</div>
                  </div>
                </div>
                <button className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 shadow-xs group-hover:scale-105 transition">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
