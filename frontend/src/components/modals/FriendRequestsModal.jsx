import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useCall } from '../../context/CallContext';
import { 
  UserCheck, 
  UserPlus, 
  UserMinus,
  X, 
  Check, 
  Clock, 
  Users,
  MessageSquare,
  Video,
  Phone,
  Trash2
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';

export function FriendRequestsModal({ isOpen, onClose, onOpenChat }) {
  const { user } = useAuth();
  const { 
    connectionRequests, 
    acceptConnectionRequest, 
    rejectConnectionRequest,
    removeFriend,
    conversations,
    selectConversation,
    startDirectConversationWithUser
  } = useChat();
  const { isUserOnline } = useSocket();
  const { initiateCall } = useCall();

  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'received' | 'sent'
  const [processingId, setProcessingId] = useState(null);

  if (!isOpen) return null;

  const receivedRequests = (connectionRequests || []).filter(
    r => r.toUserId === user?.id
  );
  const pendingReceived = receivedRequests.filter(r => r.status === 'pending');

  const sentRequests = (connectionRequests || []).filter(
    r => r.fromUserId === user?.id
  );

  // Extract unique accepted friends
  const acceptedRequests = (connectionRequests || []).filter(r => r.status === 'accepted');
  const friendsMap = new Map();
  acceptedRequests.forEach(req => {
    const isReceived = req.toUserId === user?.id;
    const friend = isReceived ? req.fromUser : req.toUser;
    const friendId = isReceived ? req.fromUserId : req.toUserId;
    if (friendId && friendId !== user?.id && !friendsMap.has(friendId)) {
      friendsMap.set(friendId, {
        ...(friend || {}),
        id: friendId,
        requestId: req.id,
        connectedAt: req.updatedAt || req.createdAt
      });
    }
  });
  const friends = Array.from(friendsMap.values());

  const handleAccept = async (reqId) => {
    try {
      setProcessingId(reqId);
      const res = await acceptConnectionRequest(reqId);
      if (res?.conversation && onOpenChat) {
        onClose();
        onOpenChat(res.conversation);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (reqId) => {
    try {
      setProcessingId(reqId);
      await rejectConnectionRequest(reqId);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleChatWithFriend = async (friend) => {
    try {
      setProcessingId(friend.id);
      const existing = (conversations || []).find(c => !c.isGroup && c.participants?.includes(friend.id));
      if (existing) {
        selectConversation(existing);
        if (onOpenChat) onOpenChat(existing);
        onClose();
        return;
      }
      const newConv = await startDirectConversationWithUser(friend.id);
      if (newConv) {
        if (onOpenChat) onOpenChat(newConv);
        onClose();
      }
    } catch (err) {
      console.error('Failed to open chat with friend:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCallFriend = (friend, type = 'video') => {
    initiateCall(friend, type);
    onClose();
  };

  const handleRemoveFriend = async (friend) => {
    if (window.confirm(`Are you sure you want to remove ${friend.name || 'this friend'} from your friends list?`)) {
      try {
        setProcessingId(friend.id);
        await removeFriend(friend.id);
      } catch (err) {
        console.error('Failed to remove friend:', err);
      } finally {
        setProcessingId(null);
      }
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#0e1526] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-900 dark:text-white select-none animate-in zoom-in-95 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg">Manage Friends</h3>
                {pendingReceived.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold shadow">
                    {pendingReceived.length} requests
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                View connections, start 1:1 chat & calls, or manage contacts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-5 pt-3 border-b border-slate-200/80 dark:border-white/10 gap-4">
          <button
            onClick={() => setActiveTab('friends')}
            className={`pb-3 text-xs font-bold transition relative flex items-center gap-2 ${
              activeTab === 'friends'
                ? 'text-blue-600 dark:text-cyan-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>My Friends ({friends.length})</span>
            {activeTab === 'friends' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-cyan-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('received')}
            className={`pb-3 text-xs font-bold transition relative flex items-center gap-2 ${
              activeTab === 'received'
                ? 'text-blue-600 dark:text-cyan-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Received</span>
            {pendingReceived.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold">
                {pendingReceived.length}
              </span>
            )}
            {activeTab === 'received' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-cyan-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-3 text-xs font-bold transition relative flex items-center gap-2 ${
              activeTab === 'sent'
                ? 'text-blue-600 dark:text-cyan-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Sent ({sentRequests.length})</span>
            {activeTab === 'sent' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-cyan-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {/* TAB 1: MY FRIENDS */}
          {activeTab === 'friends' && (
            friends.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No connected friends yet</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Explore Discover to connect with fellow learners and friends on HDTalk.
                </p>
              </div>
            ) : (
              friends.map(friend => {
                const online = isUserOnline(friend.id);
                return (
                  <div
                    key={friend.id}
                    className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar
                          src={friend.avatar}
                          name={friend.name}
                          size="md"
                          shape="circle"
                        />
                        {online && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0e1526] rounded-full" />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {friend.name}
                          </span>
                          {online ? (
                            <span className="text-[10px] text-emerald-500 font-semibold shrink-0">Online</span>
                          ) : (
                            <span className="text-[10px] text-slate-400 shrink-0">Offline</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {friend.profession || friend.email || 'HDTalk Friend'}
                        </p>
                      </div>
                    </div>

                    {/* Actions: Chat, Call, Remove */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleChatWithFriend(friend)}
                        disabled={processingId === friend.id}
                        title="Chat"
                        className="p-2 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-500/20 dark:hover:bg-blue-600 dark:text-cyan-300 dark:hover:text-white transition active:scale-95 disabled:opacity-50"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCallFriend(friend, 'video')}
                        title="Video Call"
                        className="p-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600 text-emerald-600 hover:text-white dark:bg-emerald-500/20 dark:hover:bg-emerald-600 dark:text-emerald-300 dark:hover:text-white transition active:scale-95"
                      >
                        <Video className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveFriend(friend)}
                        disabled={processingId === friend.id}
                        title="Remove Friend"
                        className="p-2 rounded-xl bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-rose-500/20 dark:hover:bg-rose-600 dark:text-rose-300 dark:hover:text-white transition active:scale-95 disabled:opacity-50"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )
          )}

          {/* TAB 2: RECEIVED REQUESTS */}
          {activeTab === 'received' && (
            receivedRequests.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No incoming requests</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  When other peers send you a friend request, they will appear here.
                </p>
              </div>
            ) : (
              receivedRequests.map(req => {
                const isPending = req.status === 'pending';
                const isAccepted = req.status === 'accepted';
                const partner = req.fromUser || { name: 'User', avatar: '' };

                return (
                  <div
                    key={req.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      isPending 
                        ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/70 dark:border-blue-500/30 shadow-xs' 
                        : 'bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/5 opacity-80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={partner.avatar}
                          name={partner.name}
                          size="md"
                          shape="circle"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {partner.name}
                            </span>
                            <span className="text-[10px] text-slate-400">• {formatTime(req.createdAt)}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {partner.profession || partner.bio || 'HDTalk Member'}
                          </p>
                          {req.note && (
                            <p className="text-xs italic text-blue-600 dark:text-cyan-300 mt-1">
                              "{req.note}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Status / Actions */}
                      <div>
                        {isPending ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAccept(req.id)}
                              disabled={processingId === req.id}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Accept</span>
                            </button>
                            <button
                              onClick={() => handleDecline(req.id)}
                              disabled={processingId === req.id}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-200/80 dark:bg-white/10 hover:bg-rose-500/20 text-slate-700 dark:text-slate-300 hover:text-rose-500 text-xs font-medium transition disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : isAccepted ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Connected
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/20">
                            Declined
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}

          {/* TAB 3: SENT REQUESTS */}
          {activeTab === 'sent' && (
            sentRequests.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No sent requests</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Find interesting peers in Discover to send them a connection request!
                </p>
              </div>
            ) : (
              sentRequests.map(req => {
                const partner = req.toUser || { name: 'User', avatar: '' };
                const isPending = req.status === 'pending';
                const isAccepted = req.status === 'accepted';

                return (
                  <div
                    key={req.id}
                    className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={partner.avatar}
                        name={partner.name}
                        size="md"
                        shape="circle"
                      />
                      <div>
                        <span className="font-bold text-sm text-slate-900 dark:text-white block">
                          {partner.name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatTime(req.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isPending ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-500/20 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      ) : isAccepted ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Accepted
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 text-xs font-medium border border-slate-500/20">
                          Declined
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
}
