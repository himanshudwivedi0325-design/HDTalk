import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Users, 
  UserCheck, 
  UserX, 
  Search, 
  Filter, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  UserPlus, 
  X, 
  Check, 
  AlertCircle, 
  Crown, 
  Clock, 
  Mail, 
  Briefcase,
  ExternalLink,
  Ban
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import { formatChatTimestamp, formatLastActive } from '../../utils/timeAgo';

export function AdminUserManagementModal({ isOpen, onClose }) {
  const { user: currentAdmin, updateProfile } = useAuth();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'banned' | 'admin'
  const [sort, setSort] = useState('newest'); // 'newest' | 'alphabetical' | 'lastActive'

  // Modals & sub-states
  const [editingUser, setEditingUser] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null); // { type: 'success' | 'error', text: '' }

  // Forms
  const [editFormData, setEditFormData] = useState({ name: '', email: '', profession: '', bio: '', role: 'user', newPassword: '' });
  const [createFormData, setCreateFormData] = useState({ name: '', email: '', password: '', role: 'user', profession: '', bio: '' });

  const showFeedback = (type, text) => {
    setActionFeedback({ type, text });
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [usersRes, statsRes] = await Promise.all([
        api.adminGetUsers({ search, filter, sort }),
        api.adminGetStats()
      ]);

      if (usersRes.success) {
        setUsers(usersRes.users || []);
      }
      if (statsRes.success) {
        setStats(statsRes.stats || null);
      }
    } catch (err) {
      console.error('[Admin] Error loading data:', err);
      showFeedback('error', err.message || 'Failed to load admin data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search, filter, sort]);

  useEffect(() => {
    if (isOpen) {
      loadData();

      const handleRealtimeSync = () => loadData(true);
      window.addEventListener('hdtalk:user-registered', handleRealtimeSync);
      window.addEventListener('hdtalk:user-updated', handleRealtimeSync);
      window.addEventListener('hdtalk:user-deleted', handleRealtimeSync);
      return () => {
        window.removeEventListener('hdtalk:user-registered', handleRealtimeSync);
        window.removeEventListener('hdtalk:user-updated', handleRealtimeSync);
        window.removeEventListener('hdtalk:user-deleted', handleRealtimeSync);
      };
    }
  }, [isOpen, loadData]);

  // Actions
  const handleToggleBan = async (user) => {
    const targetIsBanned = !user.isBanned;
    const actionName = targetIsBanned ? 'suspend / ban' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${actionName} account for ${user.name}?`)) {
      return;
    }

    try {
      const res = await api.adminToggleBan(user.id, targetIsBanned, targetIsBanned ? 'Suspended by admin' : '');
      if (res.success) {
        showFeedback('success', res.message || `User account ${targetIsBanned ? 'suspended' : 'activated'}.`);
        loadData(true);
      }
    } catch (err) {
      showFeedback('error', err.message || 'Action failed.');
    }
  };

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Change ${user.name}'s role to ${newRole.toUpperCase()}?`)) {
      return;
    }

    try {
      const res = await api.adminUpdateUserRole(user.id, newRole);
      if (res.success) {
        showFeedback('success', `Role updated to ${newRole}.`);
        loadData(true);
      }
    } catch (err) {
      showFeedback('error', err.message || 'Role change failed.');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`⚠️ DANGER: Permanently delete account for ${user.name} (${user.email})? This action cannot be undone and will delete all their messages.`)) {
      return;
    }

    try {
      const res = await api.adminDeleteUser(user.id);
      if (res.success) {
        showFeedback('success', 'User permanently deleted.');
        window.dispatchEvent(new CustomEvent('hdtalk:user-deleted', { detail: { userId: user.id } }));
        loadData(true);
      }
    } catch (err) {
      showFeedback('error', err.message || 'Failed to delete user.');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const payload = {
        name: editFormData.name,
        email: editFormData.email,
        profession: editFormData.profession,
        bio: editFormData.bio,
        role: editFormData.role
      };
      if (editFormData.newPassword && editFormData.newPassword.trim()) {
        payload.password = editFormData.newPassword.trim();
      }

      const res = await api.adminUpdateUser(editingUser.id, payload);
      if (res.success) {
        showFeedback('success', 'User details updated successfully.');
        if (currentAdmin && currentAdmin.id === editingUser.id && updateProfile) {
          updateProfile(res.user);
        }
        window.dispatchEvent(new CustomEvent('hdtalk:user-updated', { detail: res.user }));
        setEditingUser(null);
        loadData(true);
      }
    } catch (err) {
      showFeedback('error', err.message || 'Failed to update user.');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.adminCreateUser(createFormData);
      if (res.success) {
        showFeedback('success', `User ${createFormData.name} created successfully!`);
        setIsCreateOpen(false);
        setCreateFormData({ name: '', email: '', password: '', role: 'user', profession: '', bio: '' });
        loadData(true);
      }
    } catch (err) {
      showFeedback('error', err.message || 'Failed to create user.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col bg-white dark:bg-[#0a0f1d] rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Top Header */}
        <header className="px-5 py-4 bg-slate-50/80 dark:bg-[#0e1529]/80 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 p-[1.5px] shadow-md shadow-rose-500/20 flex-shrink-0">
              <div className="w-full h-full bg-white dark:bg-[#070b16] rounded-[14px] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-base md:text-lg text-slate-900 dark:text-white tracking-tight">
                  HDTalk Admin Console
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300/40">
                  Gov & Users
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                Manage user accounts, roles, access permissions and platform metrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Feedback Alert Pill */}
        {actionFeedback && (
          <div className={`px-4 py-2 text-xs font-semibold flex items-center justify-between transition-all ${
            actionFeedback.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800/40' 
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-b border-rose-200 dark:border-rose-800/40'
          }`}>
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{actionFeedback.text}</span>
            </div>
            <button onClick={() => setActionFeedback(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stats Metrics Ribbon */}
        <div className="px-5 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-100/50 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/10 flex-shrink-0">
          <div className="p-3 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200/70 dark:border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-cyan-400 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Users</div>
              <div className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {stats ? stats.totalUsers : users.length}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200/70 dark:border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Online Now</div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 leading-tight">
                {stats ? stats.onlineUsers : 0}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200/70 dark:border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Admins</div>
              <div className="text-base font-bold text-purple-600 dark:text-purple-400 leading-tight">
                {stats ? stats.adminUsers : 1}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200/70 dark:border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Banned / Suspended</div>
              <div className="text-base font-bold text-rose-600 dark:text-rose-400 leading-tight">
                {stats ? stats.bannedUsers : 0}
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-5 py-3 border-b border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search user name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Filter Pills & Sort Dropdown */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200/60 dark:border-white/5">
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'banned', label: 'Banned' },
                { id: 'admin', label: 'Admins' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    filter === tab.id
                      ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="alphabetical">Name (A-Z)</option>
              <option value="lastActive">Recently Active</option>
            </select>
          </div>
        </div>

        {/* User Table Content */}
        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100 dark:divide-white/5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span className="text-xs">Loading user registry...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No users found</p>
              <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query or filter selection.</p>
            </div>
          ) : (
            users.map(u => {
              const isSelf = u.id === currentAdmin?.id;
              const isCreator = (u.email || '').toLowerCase() === 'shikhar@gmail.com' || (u.email || '').toLowerCase() === 'himanshudwivedi0325@gmail.com';
              const isAdmin = u.role === 'admin' || isCreator;

              return (
                <div 
                  key={u.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition"
                >
                  {/* Left info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <Avatar src={u.avatar} name={u.name} size="md" />
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#0a0f1d] ${
                        u.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
                      }`} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {u.name}
                        </span>

                        {isSelf && (
                          <span className="px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-cyan-300 text-[10px] font-bold">
                            You
                          </span>
                        )}

                        {isAdmin ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-extrabold flex items-center gap-1 border border-purple-300/40">
                            <Crown className="w-3 h-3 text-amber-500" />
                            Admin
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium">
                            User
                          </span>
                        )}

                        {u.isBanned ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-extrabold flex items-center gap-1 border border-rose-300/40 animate-pulse">
                            <Ban className="w-3 h-3" />
                            Suspended
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 opacity-70" />
                          {u.email}
                        </span>
                        {u.profession && (
                          <span className="flex items-center gap-1 truncate max-w-[200px]">
                            <Briefcase className="w-3.5 h-3.5 opacity-70" />
                            {u.profession}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                          Joined {u.createdAt ? formatChatTimestamp(u.createdAt) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5 self-end md:self-center flex-shrink-0">
                    {/* Role Switcher */}
                    {!isCreator && (
                      <button
                        onClick={() => handleToggleRole(u)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 border ${
                          isAdmin 
                            ? 'border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30' 
                            : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                        title={isAdmin ? 'Demote to regular user' : 'Promote to administrator'}
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>{isAdmin ? 'Make User' : 'Make Admin'}</span>
                      </button>
                    )}

                    {/* Edit Details */}
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setEditFormData({
                          name: u.name || '',
                          email: u.email || '',
                          profession: u.profession || '',
                          bio: u.bio || '',
                          role: u.role || 'user',
                          newPassword: ''
                        });
                      }}
                      className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition flex items-center gap-1"
                      title="Edit user profile details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>

                    {/* Ban / Suspend Button */}
                    {!isCreator && !isSelf && (
                      <button
                        onClick={() => handleToggleBan(u)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 border ${
                          u.isBanned
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300/60 hover:bg-emerald-100'
                            : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-300/60 hover:bg-rose-100'
                        }`}
                        title={u.isBanned ? 'Reactivate user account' : 'Suspend user account'}
                      >
                        {u.isBanned ? <Check className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                        <span>{u.isBanned ? 'Reactivate' : 'Suspend'}</span>
                      </button>
                    )}

                    {/* Delete User Button */}
                    {!isCreator && !isSelf && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition border border-transparent hover:border-rose-300/50"
                        title="Permanently delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 bg-slate-50/80 dark:bg-[#0e1529]/80 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
          <span>Logged in as Admin: <strong className="text-slate-900 dark:text-white">{currentAdmin?.name}</strong></span>
          <span>HDTalk Platform Governance v1.0</span>
        </footer>

        {/* ─── Submodal: Edit User ────────────────────────────────────────── */}
        {editingUser && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white dark:bg-[#0f172a] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  Edit User: {editingUser.name}
                </h3>
                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Profession</label>
                  <input
                    type="text"
                    value={editFormData.profession}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, profession: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Bio</label>
                  <textarea
                    rows={2}
                    value={editFormData.bio}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, bio: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Role</label>
                    <select
                      value={editFormData.role}
                      disabled={editingUser.email === 'shikhar@gmail.com' || editingUser.email === 'himanshudwivedi0325@gmail.com'}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="user">User</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Reset Password</label>
                    <input
                      type="password"
                      placeholder="Blank = keep current"
                      value={editFormData.newPassword}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Submodal: Add New User ────────────────────────────────────── */}
        {isCreateOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white dark:bg-[#0f172a] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  Add New User to HDTalk
                </h3>
                <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="john@example.com"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={createFormData.password}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Role</label>
                    <select
                      value={createFormData.role}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      <option value="user">User</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Profession</label>
                    <input
                      type="text"
                      placeholder="Engineer, Designer..."
                      value={createFormData.profession}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, profession: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
