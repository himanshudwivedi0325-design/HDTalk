import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Check, CheckCheck, Play, Pause, Paperclip, Download, Languages, Trash2, Ban, Reply } from 'lucide-react';
import { translateText } from '../../services/translationService';
import { optimizeChatMediaUrl } from '../../utils/imageOptimizer';

const EMOJI_OPTIONS = ['❤️', '🔥', '👍', '😂', '🚀', '🎉'];

export function MessageBubble({ message }) {
  const { user } = useAuth();
  const { addReaction, deleteMessage, setReplyingToMessage, activeConversation, messages } = useChat();
  const isMe = message.senderId === user?.id;

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [translatedText, setTranslatedText] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const audioRef = useRef(null);

  const otherUser = activeConversation?.otherUser || 
    (activeConversation?.participants?.find(p => (typeof p === 'object' ? p.id : p) !== user?.id));
  const partnerName = (typeof otherUser === 'object' ? otherUser?.name : null) || 'Partner';
  const senderDisplayName = isMe ? 'You' : (message.senderName || partnerName);

  const partnerId = otherUser ? (typeof otherUser === 'object' ? otherUser.id : otherUser) : null;
  const isRead = Boolean(
    message.status === 'read' ||
    (message.readBy && partnerId && message.readBy.includes(partnerId))
  );
  const isDelivered = Boolean(
    isRead ||
    message.status === 'delivered' ||
    (message.deliveredTo && partnerId && message.deliveredTo.includes(partnerId))
  );

  const handleReply = (e) => {
    e?.stopPropagation?.();
    setReplyingToMessage({
      id: message.id,
      senderId: message.senderId,
      senderName: senderDisplayName,
      text: message.text,
      type: message.type,
      mediaUrl: message.mediaUrl,
      isDeleted: message.isDeleted || false
    });
    setShowActions(false);
  };

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (touchStartX === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX;
    if (diff > 0 && diff < 80) {
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 35) {
      handleReply();
      if (navigator.vibrate) navigator.vibrate(25);
    }
    setSwipeOffset(0);
    setTouchStartX(null);
  };

  const quotedReply = message.replyTo || (message.replyToId ? messages?.find(m => m.id === message.replyToId) : null);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const togglePlaybackSpeed = (e) => {
    e.stopPropagation();
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleTranslate = async (e) => {
    e?.stopPropagation();
    if (translatedText) {
      setShowOriginal(!showOriginal);
      return;
    }

    setIsTranslating(true);
    try {
      const targetLang = user?.learningLanguage?.toLowerCase()?.slice(0, 2) === 'en' ? 'en' : 'hi';
      const sourceLang = targetLang === 'hi' ? 'en' : 'hi';
      const result = await translateText(message.text, targetLang, sourceLang);
      setTranslatedText(result);
      setShowOriginal(false);
    } catch (err) {
      console.warn('Translation note:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      id={`msg-${message.id}`} 
      className={`relative group flex items-center mb-2.5 select-text ${isMe ? 'justify-end' : 'justify-start'}`}
    >
      {/* Direct Desktop Reply Shortcut Button for Outgoing (Instagram / Telegram style) */}
      {!message.isDeleted && isMe && (
        <button
          type="button"
          onClick={handleReply}
          className="hidden sm:flex opacity-0 group-hover:opacity-100 p-1.5 mr-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 transition self-center flex-shrink-0 cursor-pointer"
          title="Reply (or double-click message)"
        >
          <Reply className="w-4 h-4" />
        </button>
      )}

      <div 
        className="relative max-w-[85%] sm:max-w-[70%]"
        onDoubleClick={handleReply}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowActions(prev => !prev);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
          transition: swipeOffset ? 'none' : 'transform 0.2s ease'
        }}
      >
        {/* Swipe-to-Reply indicator on Mobile */}
        {swipeOffset > 10 && (
          <div className="absolute -left-7 top-1/2 -translate-y-1/2 text-blue-500 transition animate-pulse">
            <Reply className="w-4 h-4" />
          </div>
        )}

        {/* Quick Reaction & Action Floating Bar (Desktop Hover & Mobile Tap) */}
        {!message.isDeleted && (
          <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-0'} ${showActions ? 'flex' : 'hidden group-hover:flex'} items-center gap-1 px-2.5 py-1 rounded-full bg-white dark:bg-[#162035] border border-slate-200 dark:border-white/15 shadow-xl z-30 transition-all select-none animate-in fade-in`}>
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  addReaction(message.id, emoji);
                  setShowActions(false);
                }}
                className="hover:scale-130 transition-transform text-xs p-0.5"
              >
                {emoji}
              </button>
            ))}

            {/* Prominent Reply Action Button */}
            <button
              onClick={handleReply}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs hover:scale-105 active:scale-95 transition border-l border-slate-200 dark:border-white/15 ml-0.5 cursor-pointer"
              title="Reply to this message"
            >
              <Reply className="w-3.5 h-3.5" />
              <span>Reply</span>
            </button>

            {message.type === 'text' && (
              <button
                onClick={handleTranslate}
                disabled={isTranslating}
                className="hover:scale-120 transition-transform text-xs p-1 text-blue-600 dark:text-cyan-300 hover:text-blue-700 dark:hover:text-white flex items-center gap-1 border-l border-slate-200 dark:border-white/15 pl-1.5 ml-0.5"
                title={translatedText ? (showOriginal ? "Show translation" : "Show original") : "1-Click Translate"}
              >
                <Languages className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(false);
                setShowDeleteModal(true);
              }}
              className="hover:scale-120 transition-transform text-xs p-1 text-rose-500 hover:text-rose-600 flex items-center border-l border-slate-200 dark:border-white/15 pl-1.5 ml-0.5"
              title="Delete Message"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Message Bubble */}
        <div
          onClick={() => setShowActions(prev => !prev)}
          className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed transition-all cursor-pointer ${
            isMe
              ? (message.isDeleted
                  ? 'bg-blue-600/20 text-blue-200 border border-blue-400/20 rounded-br-xs'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-xs shadow-md shadow-blue-600/20')
              : (message.isDeleted
                  ? 'bg-slate-100/70 dark:bg-[#121826] text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-white/5 rounded-bl-xs'
                  : 'bg-white dark:bg-[#151d30] text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-md dark:shadow-black/20')
          }`}
        >
          {message.isDeleted ? (
            <div className="flex items-center gap-2 py-0.5 select-none italic text-xs">
              <Ban className={`w-3.5 h-3.5 flex-shrink-0 ${isMe ? 'text-blue-200/80' : 'text-slate-400 dark:text-slate-500'}`} />
              <span className={isMe ? 'text-blue-100/90' : 'text-slate-500 dark:text-slate-400'}>
                This message was deleted
              </span>
            </div>
          ) : (
            <>
              {/* Quoted Reply Preview (Telegram / Instagram style) */}
              {quotedReply && (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    const target = document.getElementById(`msg-${quotedReply.id}`);
                    if (target) {
                      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      target.classList.add('ring-2', 'ring-blue-400', 'rounded-2xl', 'transition-all');
                      setTimeout(() => target.classList.remove('ring-2', 'ring-blue-400', 'rounded-2xl'), 1800);
                    }
                  }}
                  className={`flex items-start gap-2 p-2 mb-2 rounded-xl text-xs cursor-pointer select-none transition border ${
                    isMe 
                      ? 'bg-blue-800/40 border-blue-400/30 text-blue-100 hover:bg-blue-800/60' 
                      : 'bg-slate-100/90 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10'
                  }`}
                  title="Jump to quoted message"
                >
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${isMe ? 'bg-cyan-300' : 'bg-blue-600 dark:bg-cyan-400'}`} />
                  <div className="min-w-0 flex-1">
                    <span className={`block font-bold text-[11px] truncate ${isMe ? 'text-cyan-200' : 'text-blue-600 dark:text-cyan-400'}`}>
                      {quotedReply.senderName || (quotedReply.senderId === user?.id ? 'You' : partnerName)}
                    </span>
                    <span className="block truncate text-[11px] opacity-85">
                      {quotedReply.isDeleted 
                        ? '🚫 This message was deleted' 
                        : (quotedReply.text || (quotedReply.type === 'voice' ? '🎤 Voice note' : '📎 Attachment'))}
                    </span>
                  </div>
                </div>
              )}

              {/* TEXT MESSAGE */}
              {message.type === 'text' && (
                <div className="space-y-1.5">
                  <p className="whitespace-pre-wrap break-words">
                    {showOriginal ? message.text : (translatedText || message.text)}
                  </p>

                  {translatedText && (
                    <div className={`flex items-center gap-1.5 pt-1.5 border-t select-none text-[11px] ${
                      isMe ? 'border-white/20 text-blue-100' : 'border-slate-200 dark:border-white/10 text-blue-600 dark:text-cyan-300'
                    }`}>
                      <Languages className="w-3 h-3" />
                      <span>{showOriginal ? 'Original' : 'Translated'}</span>
                      <button
                        onClick={() => setShowOriginal(prev => !prev)}
                        className="underline hover:opacity-80 font-medium transition"
                      >
                        ({showOriginal ? 'Show translation' : 'Show original'})
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* VOICE NOTE */}
              {message.type === 'voice' && message.mediaUrl && (
                <div className="flex items-center gap-3 min-w-[230px] py-1">
                  <button
                    onClick={toggleAudio}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow-md flex-shrink-0 ${
                      isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <audio
                    ref={audioRef}
                    src={message.mediaUrl}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                  <div className="flex-1 flex flex-col gap-1">
                    {/* Live audio bars */}
                    <div className="flex items-center gap-0.5 h-4">
                      {[30, 60, 90, 45, 75, 100, 50, 80, 40, 65, 85, 30, 70, 55, 90].map((h, i) => (
                        <span
                          key={i}
                          className={`w-0.5 rounded-full transition-all ${
                            isPlaying 
                              ? (isMe ? 'bg-blue-200 animate-pulse' : 'bg-blue-600 dark:bg-cyan-300 animate-pulse') 
                              : (isMe ? 'bg-white/40' : 'bg-slate-300 dark:bg-white/40')
                          }`}
                          style={{ height: `${h}%` }}
                        ></span>
                      ))}
                    </div>
                    <span className={`text-[10px] ${isMe ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      Voice recording
                    </span>
                  </div>

                  {/* WhatsApp-style Playback Speed Switcher */}
                  <button
                    onClick={togglePlaybackSpeed}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition select-none flex-shrink-0 ${
                      playbackSpeed > 1
                        ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-slate-950 shadow-sm font-extrabold ring-1 ring-blue-400 dark:ring-cyan-200 scale-105'
                        : isMe 
                          ? 'bg-white/15 hover:bg-white/25 text-white' 
                          : 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200'
                    }`}
                    title="Toggle playback speed (1x, 1.5x, 2x)"
                  >
                    {playbackSpeed}x
                  </button>
                </div>
              )}

              {/* IMAGE ATTACHMENT */}
              {message.type === 'image' && message.mediaUrl && (
                <div className="space-y-1.5 my-1">
                  <a
                    href={message.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block relative rounded-xl overflow-hidden max-h-64 bg-slate-200/50 dark:bg-white/5 ring-1 ring-slate-200 dark:ring-white/10 group"
                  >
                    <img
                      src={optimizeChatMediaUrl(message.mediaUrl, 800)}
                      alt="Attachment"
                      loading="lazy"
                      decoding="async"
                      className="rounded-xl max-h-64 w-auto object-cover group-hover:opacity-95 transition-all duration-200"
                    />
                  </a>
                  {message.text && message.text !== message.fileName && (
                    <p className="text-xs">{message.text}</p>
                  )}
                </div>
              )}

              {/* FILE ATTACHMENT */}
              {message.type === 'file' && message.mediaUrl && (
                <a
                  href={message.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2.5 p-2 rounded-xl transition text-xs font-medium my-1 ${
                    isMe ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <Paperclip className={`w-4 h-4 flex-shrink-0 ${isMe ? 'text-blue-200' : 'text-blue-600 dark:text-cyan-300'}`} />
                  <span className="truncate max-w-[160px]">{message.text || 'Document'}</span>
                  <Download className="w-3.5 h-3.5 ml-auto opacity-70" />
                </a>
              )}
            </>
          )}

          {/* Timestamp and Read Status */}
          <div className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${isMe ? 'text-blue-100/90' : 'text-slate-500 dark:text-slate-400'}`}>
            <span>{formatTime(message.timestamp)}</span>
            {isMe && !message.isDeleted && (
              <span 
                className="inline-flex items-center ml-0.5" 
                title={
                  isRead ? 'Seen by partner' :
                  isDelivered ? 'Delivered to partner' :
                  'Sent to server'
                }
              >
                {isRead ? (
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-300 dark:text-cyan-300 inline drop-shadow-xs" />
                ) : isDelivered ? (
                  <CheckCheck className="w-3.5 h-3.5 text-white/80 dark:text-slate-400 inline" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-white/70 dark:text-slate-400/80 inline" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Reaction Badges below message (only if not deleted) */}
        {!message.isDeleted && message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(message.reactions).map(([emoji, users]) => {
              const hasReacted = users.includes(user?.id);
              return (
                <button
                  key={emoji}
                  onClick={() => addReaction(message.id, emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition ${
                    hasReacted
                      ? 'bg-blue-50 dark:bg-blue-600/30 border border-blue-300 dark:border-blue-500/50 text-blue-700 dark:text-white'
                      : 'bg-white dark:bg-[#151d30] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 shadow-xs'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px] font-bold">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Direct Desktop Reply Shortcut Button for Incoming (Instagram / Telegram style) */}
      {!message.isDeleted && !isMe && (
        <button
          type="button"
          onClick={handleReply}
          className="hidden sm:flex opacity-0 group-hover:opacity-100 p-1.5 ml-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 transition self-center flex-shrink-0 cursor-pointer"
          title="Reply (or double-click message)"
        >
          <Reply className="w-4 h-4" />
        </button>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteModal(false);
          }}
        >
          <div 
            className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-white/15 rounded-3xl p-5 max-w-xs w-full shadow-2xl space-y-4 animate-in zoom-in-95 text-slate-900 dark:text-white select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Delete message?</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isMe ? 'Choose how to delete this message.' : 'Delete this message from your device.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {isMe && (
                <button
                  onClick={() => {
                    deleteMessage(message.id, true);
                    setShowDeleteModal(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-xs shadow-md shadow-rose-500/20 active:scale-98 transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete for Everyone</span>
                </button>
              )}

              <button
                onClick={() => {
                  deleteMessage(message.id, false);
                  setShowDeleteModal(false);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 font-medium text-xs active:scale-98 transition text-center"
              >
                Delete for Me
              </button>

              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs transition text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
