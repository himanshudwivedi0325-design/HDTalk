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
  ChevronLeft
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
    sendVoiceMessage, 
    sendFileMessage, 
    notifyTyping, 
    stopTyping,
    typingUsers 
  } = useChat();

  const { initiateCall, joinGroupCall } = useCall();
  const { isUserOnline, getUserLastSeen } = useSocket();

  const [text, setText] = useState('');
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const otherUser = activeConversation?.otherUser || 
    (activeConversation?.participants?.find(p => (typeof p === 'object' ? p.id : p) !== user?.id));
  const isOnline = otherUser ? isUserOnline(otherUser.id) : false;
  const isOtherTyping = Boolean(
    (otherUser && typingUsers[otherUser.id]) ||
    (activeConversation && typingUsers[activeConversation.id])
  );
  const lastSeenIso = otherUser ? getUserLastSeen(otherUser.id, otherUser.lastSeen) : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    sendMessage({ text: text.trim(), type: 'text' });
    setText('');
    stopTyping();
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
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
    <div className="flex-1 flex flex-col h-full bg-slate-100/60 dark:bg-[#090d18] relative overflow-hidden transition-colors duration-200">
      {/* Apphitect Top Bar Header */}
      <div className="h-14 sm:h-16 px-2.5 sm:px-4 md:px-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between z-10 bg-white/95 dark:bg-[#0d1322]/95 backdrop-blur-md select-none transition-colors duration-200">
        {/* Recipient Profile Info */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-1 sm:mr-3">
          {/* Mobile Back to Conversations Button */}
          {onToggleConversationList && (
            <button
              onClick={() => onToggleConversationList(true)}
              className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition flex-shrink-0"
              title="Back to Conversations"
            >
              <ChevronLeft className="w-5 h-5" />
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

          <div className="flex-shrink-0">
            <Avatar
              src={otherUser?.avatar}
              name={otherUser?.name}
              size="md"
              isOnline={isOnline}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="font-display font-bold text-sm sm:text-[15.5px] text-slate-900 dark:text-white tracking-tight truncate">
                {otherUser?.name}
              </span>
              {otherUser && (
                <span className="hidden sm:inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-cyan-300 border border-blue-200/80 dark:border-blue-500/30 whitespace-nowrap flex-shrink-0">
                  💼 {otherUser.profession || 'Professional'}
                </span>
              )}
            </div>
            <p className="text-[10.5px] sm:text-[11.5px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5 truncate">
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

        {/* Action Buttons: Audio, HD Video, Contact Details */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Audio Call */}
          <button
            onClick={() => {
              if (activeConversation?.isGroup) {
                joinGroupCall(activeConversation.id, 'audio');
              } else {
                initiateCall(otherUser, 'audio');
              }
            }}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition text-xs font-semibold flex items-center gap-1.5"
            title={activeConversation?.isGroup ? "Join Group Voice Call" : "Start Audio Call"}
          >
            <Phone className="w-4 h-4 text-blue-600 dark:text-cyan-400 flex-shrink-0" />
            <span className="hidden sm:inline">{activeConversation?.isGroup ? "Group Voice" : "Voice Call"}</span>
          </button>

          {/* HD Video Call */}
          <button
            onClick={() => {
              if (activeConversation?.isGroup) {
                joinGroupCall(activeConversation.id, 'video');
              } else {
                initiateCall(otherUser, 'video');
              }
            }}
            className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition hover:scale-105 active:scale-95 flex items-center gap-1.5"
            title={activeConversation?.isGroup ? "Join Group HD Video Mesh" : "Start HD Video Call"}
          >
            <Video className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{activeConversation?.isGroup ? "Group Video" : "HD Video"}</span>
          </button>

          {/* Contact Details Drawer Toggle */}
          <button
            onClick={onToggleInfoDrawer}
            className={`p-2 rounded-xl border transition flex-shrink-0 ${
              isInfoDrawerOpen
                ? 'bg-blue-50 dark:bg-blue-600/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/40'
                : 'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-white/10'
            }`}
            title="Contact Info & Media"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-slate-50/50 dark:bg-[#090d18] transition-colors duration-200">
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
      <div className="p-2.5 sm:p-3 md:p-4 border-t border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0c1220] relative select-none transition-colors duration-200">
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

        {showVoiceRecorder ? (
          <VoiceRecorder
            onAudioReady={(blob) => {
              sendVoiceMessage(blob);
              setShowVoiceRecorder(false);
            }}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-1.5 sm:gap-2">
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
              className="p-2 sm:p-2.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex-shrink-0"
              title="Attach File"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Emoji Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className="p-2 sm:p-2.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-300 transition flex-shrink-0"
              title="Emojis"
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* Main Input Field */}
            <input
              type="text"
              placeholder={`Write a message...`}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              className="flex-1 min-w-0 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full apphitect-input text-xs sm:text-[13.5px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
            />

            {/* Dynamic Mic or Send Action Button (WhatsApp/Telegram style) */}
            {text.trim() ? (
              <button
                type="submit"
                className="p-2 sm:p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 hover:scale-105 active:scale-95 transition flex-shrink-0"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowVoiceRecorder(true)}
                className="p-2 sm:p-2.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition flex-shrink-0"
                title="Record Voice Note"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
