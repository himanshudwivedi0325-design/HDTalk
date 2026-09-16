import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useChat } from '../../context/ChatContext';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, 
  Sparkles, 
  Video, 
  MessageSquare, 
  UserPlus, 
  Check, 
  Globe, 
  BookOpen, 
  Filter, 
  Briefcase 
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { formatLastActive } from '../../utils/timeAgo';

function UserAvatar({ src, name, isOnline }) {
  return <Avatar src={src} name={name} size="xl" isOnline={isOnline} />;
}

export function PartnerDiscovery({ onNavigateToChat }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sentRequests, setSentRequests] = useState(new Set());

  const { user } = useAuth();
  const { isUserOnline, getUserLastSeen } = useSocket();
  const { startDirectConversationWithUser, connectionRequests, sendConnectionRequest } = useChat();
  const { initiateCall } = useCall();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getUsers();
      if (res.success) {
        setUsers(res.users);
      }
    } catch (err) {
      console.warn('Error loading partners:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (user) => {
    await startDirectConversationWithUser(user.id);
    onNavigateToChat();
  };

  const handleConnect = async (userId) => {
    try {
      await sendConnectionRequest(userId, "Hey, let's connect on HDTalk!");
      setSentRequests(prev => new Set(prev).add(userId));
    } catch (e) {
      console.warn(e);
    }
  };

  // Distinct profession options
  const allProfessions = Array.from(new Set(users.map(u => u.profession).filter(Boolean)));

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                          (u.profession && u.profession.toLowerCase().includes(search.toLowerCase())) ||
                          (u.bio && u.bio.toLowerCase().includes(search.toLowerCase())) ||
                          (u.interests && u.interests.some(i => i.toLowerCase().includes(search.toLowerCase())));
    const matchesProf = professionFilter === 'all' || u.profession === professionFilter;
    const isOnline = isUserOnline(u.id);
    const matchesOnline = !onlineOnly || isOnline;

    return matchesSearch && matchesProf && matchesOnline;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-5 select-none transition-colors duration-200 font-sans">
      {/* Streamlined Discovery Header Bar */}
      <div className="vision-glass p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-md backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-lg bg-blue-600/15 text-blue-600 dark:text-cyan-400">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span className="text-[10.5px] uppercase font-bold tracking-wider text-blue-600 dark:text-cyan-300">
              Synergy Matchmaking
            </span>
          </div>
          <h1 className="font-display font-black text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
            Discover Professionals & Peers
          </h1>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative min-w-[190px] sm:min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 vision-glass-input focus:outline-none"
            />
          </div>

          {/* Profession dropdown */}
          <select
            value={professionFilter}
            onChange={(e) => setProfessionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer shadow-sm hover:border-blue-500/40 transition"
          >
            <option value="all">💼 All Professions</option>
            {allProfessions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Online toggle */}
          <button
            onClick={() => setOnlineOnly(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-sm ${
              onlineOnly
                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                : 'bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${onlineOnly ? 'bg-emerald-500 animate-ping' : 'bg-slate-400 dark:bg-slate-500'}`}></span>
            <span>Online</span>
          </button>
        </div>
      </div>

      {/* Partners Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-20 vision-glass rounded-3xl p-8 border border-slate-200 dark:border-white/10">
          <Globe className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3 opacity-50" />
          <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm">No match found</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Try clearing some filter criteria to discover more professionals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(u => {
            const isOnline = isUserOnline(u.id);
            const isSent = sentRequests.has(u.id) || (connectionRequests || []).some(
              r => r.fromUserId === user?.id && r.toUserId === u.id
            );
            const match = u.matchScore || 75;

            return (
              <div
                key={u.id}
                className="apphitect-card rounded-3xl p-5 md:p-6 flex flex-col justify-between relative group hover:border-blue-500/40 transition-all duration-300"
              >
                <div>
                  {/* Top Bar: Match Score & Online Status */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 border border-blue-500/25 dark:border-blue-500/30 text-[11px] font-bold text-blue-700 dark:text-cyan-300 shadow-sm">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                      <span>{match}% Synergy Match</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-[11px] font-semibold">
                      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-500'}`}></span>
                      <span className={isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
                        {isOnline ? 'Active now' : formatLastActive(getUserLastSeen(u.id, u.lastSeen), false)}
                      </span>
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="flex items-center gap-3.5 mb-3.5">
                    <UserAvatar src={u.avatar} name={u.name} isOnline={isOnline} />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-bold text-[17px] text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors tracking-tight truncate leading-snug">
                        {u.name}
                      </h3>
                      {/* Genuine Profession Badge */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-600/15 border border-blue-200/80 dark:border-blue-500/30 text-blue-700 dark:text-cyan-300 font-bold text-[11.5px] shadow-xs inline-flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 flex-shrink-0" />
                          <span className="truncate max-w-[170px]">{u.profession || 'Software Professional'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-[12.5px] text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-2 mb-3.5 font-normal">
                    {u.bio || 'Excited to connect and collaborate on HDTalk.'}
                  </p>

                  {/* Interest / Skills Tags */}
                  {u.interests && u.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {u.interests.map((interest, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-white/5 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-medium border border-slate-200/80 dark:border-white/5 transition"
                        >
                          #{interest}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Bottom Actions */}
                <div className="pt-3.5 border-t border-slate-200/80 dark:border-white/10 flex items-center gap-2.5">
                  <button
                    onClick={() => handleStartChat(u)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/90 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white font-semibold text-xs transition active:scale-95 border border-slate-200/80 dark:border-white/10 shadow-sm"
                    title="Open Chat"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                    <span>Chat</span>
                  </button>

                  <button
                    onClick={() => initiateCall(u, 'video')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-xs shadow-md shadow-blue-500/25 transition active:scale-95"
                    title="Call Now via WebRTC"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Video Call</span>
                  </button>

                  <button
                    onClick={() => handleConnect(u.id)}
                    disabled={isSent}
                    className={`p-2.5 rounded-xl border transition active:scale-95 shadow-sm ${
                      isSent
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-100 hover:bg-slate-200/90 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10'
                    }`}
                    title={isSent ? 'Request Sent' : 'Send Connection Request'}
                  >
                    {isSent ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
