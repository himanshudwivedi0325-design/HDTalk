import React, { useState } from 'react';
import { X, Phone, Video, Globe, BookOpen, Hash, Mail, ShieldCheck, Trash2, UserMinus } from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { useSocket } from '../../context/SocketContext';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../ui/Avatar';
import { formatLastActive } from '../../utils/timeAgo';

export function ContactDetailsDrawer({ user, conversationId, onClose }) {
  const { initiateCall } = useCall();
  const { isUserOnline, getUserLastSeen } = useSocket();
  const { activeConversation, deleteConversation } = useChat();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!user) return null;
  const isOnline = isUserOnline(user.id);
  const lastSeenIso = getUserLastSeen(user.id, user.lastSeen);
  const targetConvId = conversationId || activeConversation?.id;

  const handleDeleteChat = async () => {
    if (!targetConvId) return;
    if (window.confirm(`Delete entire conversation with ${user.name}? This will erase all chat messages.`)) {
      try {
        setIsDeleting(true);
        await deleteConversation(targetConvId, false);
        onClose?.();
      } catch (err) {
        console.error('Failed to delete chat:', err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleDeleteChatAndFriend = async () => {
    if (!targetConvId) return;
    if (window.confirm(`Delete conversation AND remove ${user.name} from your friends list?`)) {
      try {
        setIsDeleting(true);
        await deleteConversation(targetConvId, true);
        onClose?.();
      } catch (err) {
        console.error('Failed to delete chat and friend:', err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="w-72 lg:w-80 h-full bg-white dark:bg-[#0d1322] border-l border-slate-200/80 dark:border-white/10 flex flex-col p-5 overflow-y-auto select-none animate-in slide-in-from-right duration-200 transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/10">
        <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">Contact Info</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Profile Info */}
      <div className="text-center py-5 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex justify-center mb-3">
          <Avatar
            src={user.avatar}
            name={user.name}
            size="2xl"
            isOnline={isOnline}
          />
        </div>
        <h4 className="font-bold text-base text-slate-900 dark:text-white">{user.name}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user.email}</p>

        <div className="mt-2 flex items-center justify-center gap-1.5">
          {isOnline ? (
            <span className="text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Active now
            </span>
          ) : (
            <span className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
              {formatLastActive(lastSeenIso, false)}
            </span>
          )}
        </div>

        {/* Quick Call Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => initiateCall(user, 'audio')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition"
          >
            <Phone className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
            <span>Voice</span>
          </button>
          <button
            onClick={() => initiateCall(user, 'video')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition hover:scale-105"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video</span>
          </button>
        </div>
      </div>

      {/* Profession Details */}
      <div className="py-4 border-b border-slate-200/80 dark:border-white/10 space-y-1.5 text-xs">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
          Profession / Role
        </span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-blue-700 dark:text-cyan-300 text-sm">
            💼 {user.profession || 'Software Professional'}
          </span>
        </div>
      </div>

      {/* About / Bio */}
      <div className="py-4 border-b border-slate-200/80 dark:border-white/10 text-xs">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
          About
        </span>
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{user.bio || 'Excited to connect and collaborate on HDTalk.'}</p>
      </div>

      {/* Interests */}
      {user.interests && user.interests.length > 0 && (
        <div className="py-4 border-b border-slate-200/80 dark:border-white/10 text-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
            Interests & Skills
          </span>
          <div className="flex flex-wrap gap-1.5">
            {user.interests.map((interest, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 text-[11px]"
              >
                #{interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chat & Contact Management */}
      <div className="py-4 border-b border-slate-200/80 dark:border-white/10 space-y-2 text-xs">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
          Chat & Contact Options
        </span>
        
        <button
          onClick={handleDeleteChat}
          disabled={isDeleting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-white/10 hover:border-rose-300 dark:hover:border-rose-900/50 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 font-semibold text-xs transition disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          <span>Delete Chat History</span>
        </button>

        <button
          onClick={handleDeleteChatAndFriend}
          disabled={isDeleting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-600 text-rose-600 hover:text-white dark:text-rose-400 dark:hover:text-white font-semibold text-xs transition disabled:opacity-50"
        >
          <UserMinus className="w-3.5 h-3.5" />
          <span>Delete Chat & Remove Friend</span>
        </button>
      </div>

      {/* Encryption security footer */}
      <div className="mt-auto pt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span>P2P WebRTC Direct Signaling</span>
      </div>
    </div>
  );
}
