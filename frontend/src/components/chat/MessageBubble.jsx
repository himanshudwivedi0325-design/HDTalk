import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Check, CheckCheck, Play, Pause, Paperclip, Download, Languages } from 'lucide-react';
import { translateText } from '../../services/translationService';

const EMOJI_OPTIONS = ['❤️', '🔥', '👍', '😂', '🚀', '🎉'];

export function MessageBubble({ message }) {
  const { user } = useAuth();
  const { addReaction } = useChat();
  const isMe = message.senderId === user?.id;

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [translatedText, setTranslatedText] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const audioRef = useRef(null);

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

  const isRead = message.readBy && message.readBy.length > 1;

  return (
    <div className={`relative group flex flex-col mb-2.5 select-text ${isMe ? 'items-end' : 'items-start'}`}>
      <div className="relative max-w-[85%] sm:max-w-[70%]">
        {/* Quick Reaction Floating Bar on Hover */}
        <div className={`absolute -top-7 ${isMe ? 'right-0' : 'left-0'} hidden group-hover:flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-[#162035] border border-slate-200 dark:border-white/15 shadow-lg dark:shadow-xl z-20 transition-all`}>
          {EMOJI_OPTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => addReaction(message.id, emoji)}
              className="hover:scale-130 transition-transform text-xs p-0.5"
            >
              {emoji}
            </button>
          ))}

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
        </div>

        {/* Message Bubble */}
        <div
          className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed transition-all ${
            isMe
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-xs shadow-md shadow-blue-600/20'
              : 'bg-white dark:bg-[#151d30] text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-md dark:shadow-black/20'
          }`}
        >
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
              <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={message.mediaUrl}
                  alt="Attachment"
                  className="rounded-xl max-h-64 object-cover hover:opacity-95 transition ring-1 ring-slate-200 dark:ring-white/10"
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

          {/* Timestamp and Read Status */}
          <div className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${isMe ? 'text-blue-100/90' : 'text-slate-500 dark:text-slate-400'}`}>
            {!isMe && message.type === 'text' && !translatedText && (
              <button
                onClick={handleTranslate}
                className="opacity-70 hover:opacity-100 text-[10px] text-blue-600 dark:text-cyan-300 flex items-center gap-0.5 hover:underline mr-1 font-medium"
                title="Translate to Hindi"
              >
                <Languages className="w-3 h-3" />
                <span>Translate</span>
              </button>
            )}
            <span>{formatTime(message.timestamp)}</span>
            {isMe && (
              <span>
                {isRead ? (
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-200 inline" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-white/70 inline" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Reaction Badges below message */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
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
    </div>
  );
}
