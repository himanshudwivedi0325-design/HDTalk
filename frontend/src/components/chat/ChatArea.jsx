import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useCall } from '../../context/CallContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { MessageBubble } from './MessageBubble';
import { VoiceRecorder } from './VoiceRecorder';
import { 
  Video, 
  Phone, 
  Send, 
  Paperclip, 
  Mic, 
  Smile, 
  Info, 
  ShieldCheck, 
  MoreVertical,
  Image as ImageIcon,
  FileText,
  PanelLeftOpen,
  PanelLeftClose,
  ChevronLeft,
  Clock,
  Check,
  UserCheck,
  Reply,
  Pencil,
  Share2,
  X,
  CornerDownLeft,
  Sparkles
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { formatLastActive } from '../../utils/timeAgo';

const COMMON_EMOJIS = ['😊', '😂', '🔥', '❤️', '👍', '🙏', '🎉', '🚀', '💯', '✨', '👋', '😎', '🙌', '💡'];

export function ChatArea({ 
  onToggleInfoDrawer, 
  isInfoDrawerOpen, 
  isConversationListVisible = true, 
  onToggleConversationList 
}) {
  const { user } = useAuth();
  const { 
    activeConversation, 
    messages, 
    isLoadingMessages, 
    sendMessage, 
    editMessage,
    sendVoiceMessage, 
    sendFileMessage, 
    notifyTyping, 
    stopTyping,
    typingUsers,
    connectionRequests,
    acceptConnectionRequest,
    rejectConnectionRequest,
    replyingToMessage,
    setReplyingToMessage,
    editingMessage,
    setEditingMessage
  } = useChat();

  const { initiateCall, joinGroupCall } = useCall();
  const { isUserOnline, getUserLastSeen } = useSocket();

  const [text, setText] = useState('');
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRespondingConnection, setIsRespondingConnection] = useState(false);
  const [enterIsNewline, setEnterIsNewline] = useState(() => {
    try {
      return localStorage.getItem('hdtalk_enter_newline') === 'true';
    } catch {
      return false;
    }
  });

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const toggleEnterMode = () => {
    setEnterIsNewline(prev => {
      const next = !prev;
      try {
        localStorage.setItem('hdtalk_enter_newline', String(next));
      } catch {}
      return next;
    });
  };

  const adjustTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  const resetTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text || '');
      setTimeout(adjustTextareaHeight, 0);
      inputRef.current?.focus();
    } else if (replyingToMessage) {
      inputRef.current?.focus();
    }
  }, [editingMessage, replyingToMessage]);

  const otherUser = activeConversation?.otherUser || 
    (activeConversation?.participants?.find(p => (typeof p === 'object' ? p.id : p) !== user?.id));
  const isOnline = otherUser ? isUserOnline(otherUser.id) : false;
  const isOtherTyping = Boolean(
    (otherUser && typingUsers[otherUser.id]) ||
    (activeConversation && typingUsers[activeConversation.id])
  );
  const lastSeenIso = otherUser ? getUserLastSeen(otherUser.id, otherUser.lastSeen) : null;

  // Connection request resolution
  const matchingRequest = (connectionRequests || []).find(r => 
    otherUser?.id && (
      (r.fromUserId === user?.id && r.toUserId === otherUser.id) ||
      (r.fromUserId === otherUser.id && r.toUserId === user?.id)
    )
  );

  const isPending = Boolean(activeConversation?.isPending || (matchingRequest && matchingRequest.status === 'pending'));
  const isSender = (activeConversation?.requestedBy === user?.id) || (matchingRequest && matchingRequest.fromUserId === user?.id);

  const handleAcceptConnection = async () => {
    if (!matchingRequest) return;
    try {
      setIsRespondingConnection(true);
      await acceptConnectionRequest(matchingRequest.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRespondingConnection(false);
    }
  };

  const handleDeclineConnection = async () => {
    if (!matchingRequest) return;
    try {
      setIsRespondingConnection(true);
      await rejectConnectionRequest(matchingRequest.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRespondingConnection(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  const handleShareChatLink = async () => {
    if (!otherUser?.id) return;
    const url = `${window.location.origin}/?u=${otherUser.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Chat with ${otherUser.name} on HDTalk`,
          text: `Join me on HDTalk for real-time messaging and HD calling!`,
          url
        });
        return;
      } catch (_) {}
    }
    navigator.clipboard.writeText(url);
    alert(`Direct chat link copied to clipboard!\n\nShare with your friend to connect directly:\n${url}`);
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;

    if (editingMessage) {
      editMessage(editingMessage.id, text.trim());
      setEditingMessage(null);
      setText('');
      resetTextareaHeight();
      stopTyping();
      return;
    }

    sendMessage({ 
      text: text.trim(), 
      type: 'text',
      replyToId: replyingToMessage?.id || null,
      replyTo: replyingToMessage || null
    });
    setText('');
    resetTextareaHeight();
    stopTyping();
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (editingMessage) {
        setEditingMessage(null);
        setText('');
        resetTextareaHeight();
      } else if (replyingToMessage) {
        setReplyingToMessage(null);
      }
      return;
    }

    // Ctrl + Enter or Cmd + Enter always sends immediately
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Shift + Enter always creates a new line
    if (e.key === 'Enter' && e.shiftKey) {
      setTimeout(adjustTextareaHeight, 0);
      return;
    }

    // Enter pressed without modifier keys
    if (e.key === 'Enter' && !e.shiftKey) {
      const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window);

      if (enterIsNewline || isMobile) {
        // Natural newline inserted in textarea
        setTimeout(adjustTextareaHeight, 0);
        return;
      } else {
        // Desktop default: Enter sends message
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    adjustTextareaHeight();
    if (val.trim()) {
      notifyTyping();
    } else {
      stopTyping();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      sendFileMessage(file);
    }
    setShowAttachMenu(false);
    e.target.value = '';
  };

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-slate-50 dark:bg-[#090d18] transition-colors duration-200">
        <div className="w-16 h-16 rounded-3xl bg-blue-500/10 dark:bg-blue-600/15 border border-blue-500/20 flex items-center justify-center mb-4 shadow-md shadow-blue-500/10">
          <Send className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-2">Select a Conversation</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          Select a chat from the sidebar or discover language exchange partners to start real-time messaging and HD video calls.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-slate-100/60 dark:bg-[#090d18] relative overflow-hidden transition-colors duration-200">
      {/* Apphitect Top Bar Header */}
      <div className="h-14 sm:h-16 px-3 sm:px-4 md:px-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between z-10 bg-white/95 dark:bg-[#0d1322]/95 backdrop-blur-md select-none transition-colors duration-200 gap-2 flex-shrink-0">
        {/* Recipient Profile Info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Mobile Back to Conversations Button */}
          {onToggleConversationList && (
            <button
              onClick={() => onToggleConversationList(true)}
              className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition flex-shrink-0"
              title="Back to Conversations"
              aria-label="Back to conversations"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Desktop Conversation List Collapse/Expand Toggle Button */}
          {onToggleConversationList && (
            <button
              onClick={onToggleConversationList}
              className={`hidden md:flex p-2 rounded-xl transition flex-shrink-0 ${
                !isConversationListVisible
                  ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-600/30'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title={isConversationListVisible ? "Hide conversation list" : "Show conversation list"}
            >
              {isConversationListVisible ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>
          )}

          <div
            onClick={onToggleInfoDrawer}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer select-none group"
            title="View contact info"
          >
            <Avatar
              src={otherUser?.avatar}
              name={otherUser?.name}
              size="md"
              isOnline={isOnline}
              className="transition-transform group-hover:scale-105 flex-shrink-0"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight truncate leading-tight max-w-[120px] sm:max-w-[200px] md:max-w-xs block">
                  {otherUser?.name}
                </span>
                {otherUser?.profession && (
                  <span className="hidden xl:inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-cyan-300 border border-blue-200/80 dark:border-blue-500/30 whitespace-nowrap flex-shrink-0">
                    💼 {otherUser.profession}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5 truncate mt-0.5 whitespace-nowrap">
                {isOtherTyping ? (
                  <span className="text-blue-600 dark:text-blue-400 font-semibold italic flex items-center gap-1.5">
                    <span className="flex gap-0.5 items-center">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                    </span>
                    Typing...
                  </span>
                ) : isOnline ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Active now
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatLastActive(lastSeenIso, false)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Audio, HD Video, Share Link, Contact Details */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Audio Call */}
          <button
            disabled={isPending}
            onClick={() => {
              if (isPending) return;
              if (activeConversation?.isGroup) {
                joinGroupCall(activeConversation.id, 'audio');
              } else {
                initiateCall(otherUser, 'audio');
              }
            }}
            className={`h-9 px-2.5 sm:px-3 rounded-xl border transition text-xs font-semibold flex items-center justify-center gap-1.5 flex-shrink-0 whitespace-nowrap ${
              isPending
                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-white/5 border-slate-200/50 dark:border-white/5 text-slate-400'
                : 'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
            }`}
            title={isPending ? "Calls locked until connection is accepted" : (activeConversation?.isGroup ? "Join Group Voice Call" : "Start Audio Call")}
          >
            <Phone className="w-4 h-4 text-blue-600 dark:text-cyan-400 flex-shrink-0" />
            <span className="hidden xl:inline whitespace-nowrap">{activeConversation?.isGroup ? "Group Voice" : "Voice Call"}</span>
          </button>

          {/* HD Video Call */}
          <button
            disabled={isPending}
            onClick={() => {
              if (isPending) return;
              if (activeConversation?.isGroup) {
                joinGroupCall(activeConversation.id, 'video');
              } else {
                initiateCall(otherUser, 'video');
              }
            }}
            className={`h-9 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 flex-shrink-0 whitespace-nowrap ${
              isPending
                ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-white/10 text-slate-400'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition hover:scale-105 active:scale-95'
            }`}
            title={isPending ? "Video calls locked until connection is accepted" : (activeConversation?.isGroup ? "Join Group HD Video Mesh" : "Start HD Video Call")}
          >
            <Video className="w-4 h-4 flex-shrink-0" />
            <span className="hidden xl:inline whitespace-nowrap">{activeConversation?.isGroup ? "Group Video" : "HD Video"}</span>
          </button>

          {/* Share Direct Chat Link */}
          <button
            onClick={handleShareChatLink}
            className="h-9 w-9 rounded-xl border transition flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-600/20 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-300 border-slate-200/80 dark:border-white/10"
            title="Share Direct Chat Link"
          >
            <Share2 className="w-4 h-4 flex-shrink-0" />
          </button>

          {/* Contact Details Drawer Toggle */}
          <button
            onClick={onToggleInfoDrawer}
            className={`h-9 w-9 rounded-xl border transition flex items-center justify-center flex-shrink-0 ${
              isInfoDrawerOpen
                ? 'bg-blue-50 dark:bg-blue-600/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/40'
                : 'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200/80 dark:border-white/10'
            }`}
            title="Contact Info & Media"
          >
            <Info className="w-4 h-4 flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 space-y-3 bg-slate-50/50 dark:bg-[#090d18] transition-colors duration-200">
        {/* End-to-end encryption banner */}
        <div className="flex items-center justify-center mb-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 text-[10.5px] sm:text-[11px] text-slate-600 dark:text-slate-300 shadow-xs text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="hidden sm:inline">HDTalk End-to-End Encrypted Real-Time Chat & HD WebRTC</span>
            <span className="sm:hidden">End-to-End Encrypted</span>
          </div>
        </div>

        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 text-slate-500 dark:text-slate-400 text-xs">
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-1">Say hello to {otherUser?.name}! 👋</p>
            <p>Send a message or initiate an HD video call above.</p>
          </div>
        ) : (
          messages.map(m => (
            <MessageBubble key={m.id} message={m} />
          ))
        )}

        {/* Typing indicator */}
        {isOtherTyping && (
          <div className="flex items-center gap-2 max-w-fit px-3.5 py-2 rounded-2xl rounded-bl-sm bg-white dark:bg-[#131b2e] border border-slate-200/80 dark:border-white/10 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="text-[12px] font-medium text-blue-600 dark:text-blue-400">{otherUser?.name || 'Partner'} is typing</span>
            <div className="flex gap-1 items-center ml-1">
              <span className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="w-full p-2.5 sm:p-3 md:p-4 pb-3 sm:pb-3 md:pb-4 border-t border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0c1220] relative select-none transition-colors duration-200 flex-shrink-0 z-20">
        {/* Attachment Options Menu */}
        {showAttachMenu && (
          <div className="absolute bottom-16 sm:bottom-20 left-2 sm:left-4 p-2 bg-white dark:bg-[#141b2e] border border-slate-200 dark:border-white/15 rounded-2xl shadow-xl dark:shadow-2xl z-30 flex flex-col gap-1 w-44 animate-in zoom-in-95">
            <button
              onClick={() => {
                setShowAttachMenu(false);
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition text-left"
            >
              <ImageIcon className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
              <span>Photo or Video</span>
            </button>
            <button
              onClick={() => {
                setShowAttachMenu(false);
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition text-left"
            >
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Document</span>
            </button>
          </div>
        )}

        {/* Emoji Picker Popover */}
        {showEmojiPicker && (
          <div className="absolute bottom-16 sm:bottom-20 left-6 sm:left-12 p-2 bg-white dark:bg-[#141b2e] border border-slate-200 dark:border-white/15 rounded-2xl shadow-xl dark:shadow-2xl z-30 flex flex-wrap gap-2 max-w-xs animate-in zoom-in-95">
            {COMMON_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => {
                  setText(prev => prev + emoji);
                  setShowEmojiPicker(false);
                }}
                className="text-lg p-1.5 hover:scale-125 transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {isPending ? (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/95 dark:bg-[#111728]/95 border border-slate-200/80 dark:border-white/10 shadow-lg select-none">
            {isSender ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    Connection Request Pending
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                    Waiting for <strong className="text-slate-800 dark:text-slate-200">{otherUser?.name || 'this user'}</strong> to accept your connection request before you can chat.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {otherUser?.name || 'This user'} sent you a connection request
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                      Accept to unlock messaging and video calling.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleAcceptConnection}
                    disabled={isRespondingConnection}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept Request</span>
                  </button>
                  <button
                    onClick={handleDeclineConnection}
                    disabled={isRespondingConnection}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-rose-500/20 text-slate-700 dark:text-slate-300 hover:text-rose-500 text-xs font-medium transition disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : showVoiceRecorder ? (
          <VoiceRecorder
            onAudioReady={(blob) => {
              sendVoiceMessage(blob);
              setShowVoiceRecorder(false);
            }}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        ) : (
          <>
            {/* Editing Message Banner */}
            {editingMessage && (
              <div className="mb-2 p-2 sm:p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 flex items-center justify-between gap-2 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  <div className="overflow-hidden min-w-0 text-left">
                    <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate">
                      Editing message
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {editingMessage.text}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessage(null);
                    setText('');
                  }}
                  className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition flex-shrink-0"
                  title="Cancel edit (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Replying Preview Banner (Instagram / Telegram style) */}
            {replyingToMessage && (
              <div className="mb-2 p-2 sm:p-2.5 rounded-xl bg-slate-100/90 dark:bg-white/[0.07] border-l-4 border-blue-500 flex items-center justify-between gap-2 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                    <Reply className="w-3.5 h-3.5" />
                  </div>
                  <div className="overflow-hidden min-w-0 text-left">
                    <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate">
                      Replying to {replyingToMessage.senderId === user?.id ? 'Yourself' : (replyingToMessage.senderName || 'User')}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {replyingToMessage.type === 'image' && '📷 Photo'}
                      {replyingToMessage.type === 'video' && '🎥 Video'}
                      {replyingToMessage.type === 'audio' && '🎵 Voice message'}
                      {replyingToMessage.type === 'file' && '📎 Document'}
                      {(!replyingToMessage.type || replyingToMessage.type === 'text') && (replyingToMessage.text || 'Message')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingToMessage(null)}
                  className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition flex-shrink-0"
                  title="Cancel reply"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleSend} className="flex items-end gap-1.5 sm:gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Plus / Attach Button */}
              <button
                type="button"
                onClick={() => setShowAttachMenu(prev => !prev)}
                className="p-2 sm:p-2.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex-shrink-0 mb-0.5"
                title="Attach File"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Emoji Button */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(prev => !prev)}
                className="p-2 sm:p-2.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-300 transition flex-shrink-0 mb-0.5"
                title="Emojis"
              >
                <Smile className="w-4 h-4" />
              </button>

              {/* Ask Claude AI Button (OmniRoute) */}
              <button
                type="button"
                onClick={() => {
                  setText(prev => {
                    if (prev.startsWith('@claude ')) return prev;
                    if (prev.startsWith('@ai ') || prev.startsWith('@bot ')) {
                      return prev.replace(/^@(ai|bot)\s*/, '@claude ');
                    }
                    return prev.trim() ? `@claude ${prev.trim()}` : '@claude ';
                  });
                  inputRef.current?.focus();
                }}
                className="p-2 sm:p-2.5 rounded-full bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 border border-purple-200/50 dark:border-purple-800/40 transition flex-shrink-0 mb-0.5 group"
                title="Ask Claude AI (OmniRoute)"
              >
                <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              </button>

              {/* Main Multi-line Auto-Expanding Textarea with Next Line Support */}
              <div className="flex-1 min-w-0 relative flex items-center">
                <textarea
                  ref={inputRef}
                  rows={1}
                  placeholder={
                    replyingToMessage 
                      ? "Reply to message..." 
                      : (enterIsNewline 
                          ? "Write a message... (Enter for new line)" 
                          : "Write a message... (Shift + Enter for new line)")
                  }
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 pr-16 sm:pr-20 rounded-2xl apphitect-input text-xs sm:text-[13.5px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none max-h-32 overflow-y-auto leading-relaxed transition-all shadow-inner"
                />

                {/* Desktop Enter Mode Toggle (WhatsApp Web style: Enter sends vs Enter creates new line) */}
                <button
                  type="button"
                  onClick={toggleEnterMode}
                  className={`hidden sm:flex items-center gap-1 absolute right-2.5 bottom-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold transition select-none ${
                    enterIsNewline
                      ? 'bg-blue-500/15 text-blue-600 dark:text-cyan-300 border border-blue-400/30'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-70 hover:opacity-100'
                  }`}
                  title={enterIsNewline ? "Mode: Enter goes to Next Line. Click to switch to Enter sends." : "Mode: Enter sends message (Shift+Enter for Next Line). Click to switch to Enter goes to Next Line."}
                >
                  <CornerDownLeft className="w-2.5 h-2.5" />
                  <span>{enterIsNewline ? '↵ Next line' : '↵ Send'}</span>
                </button>
              </div>

              {/* Dynamic Mic or Send Action Button (WhatsApp/Telegram style) */}
              {text.trim() ? (
                <button
                  type="submit"
                  className="p-2 sm:p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 hover:scale-105 active:scale-95 transition flex-shrink-0 mb-0.5"
                  title={enterIsNewline ? "Send Message (Ctrl + Enter)" : "Send Message"}
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowVoiceRecorder(true)}
                  className="p-2 sm:p-2.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition flex-shrink-0 mb-0.5"
                  title="Record Voice Note"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </form>
        </>
        )}
      </div>
    </div>
  );
}
