import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Trash2, 
  Copy, 
  Check, 
  Bot, 
  User, 
  Lightbulb, 
  FileEdit, 
  Languages, 
  Cpu, 
  ArrowRight,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';

const STARTER_PROMPTS = [
  {
    icon: FileEdit,
    title: 'Draft a Message',
    desc: 'Write a polite, professional connection or follow-up note',
    prompt: 'Draft a friendly and professional networking message to connect with a fellow engineer or designer on HDTalk.'
  },
  {
    icon: Cpu,
    title: 'Explain WebRTC Calling',
    desc: 'Learn how peer-to-peer real-time communication works',
    prompt: 'Explain in simple terms how WebRTC peer-to-peer audio and video calling works under the hood in HDTalk.'
  },
  {
    icon: Languages,
    title: 'Polish & Translate',
    desc: 'Improve wording, tone, or translate between English & Hindi',
    prompt: 'Help me polish this message to sound more confident and professional: "Hey, can you look at this project when you have some free time?"'
  },
  {
    icon: Lightbulb,
    title: 'Product Brainstorming',
    desc: 'Brainstorm next-gen features for real-time collaboration apps',
    prompt: 'What are 3 high-impact features that can make a real-time chat and video networking app stand out?'
  }
];

export function AIAssistantWorkspace({ onNavigateToChat }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('hdtalk_ai_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Persist conversation
  useEffect(() => {
    try {
      localStorage.setItem('hdtalk_ai_chat_history', JSON.stringify(messages));
    } catch (_) {}
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (customPrompt) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend || isLoading) return;

    const userMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString()
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      // Prepare messages array for completion
      const payload = newHistory.slice(-8).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.askClaude(payload);
      if (res.success && res.data) {
        const botMessage = {
          id: `bot_${Date.now()}`,
          role: 'assistant',
          content: res.data.content,
          model: res.data.model,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        throw new Error(res.message || 'Failed to get response');
      }
    } catch (err) {
      console.warn('AI query fallback:', err);
      const fallbackMsg = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        content: `Namaste ${user?.name || 'dost'}! 🙏 Main aapki query: "${textToSend}" read kar chuka hoon. Main HDTalk ka smart assistant hoon aur aapki help ke liye ready hoon!`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear your AI Assistant conversation history?')) {
      setMessages([]);
      try {
        localStorage.removeItem('hdtalk_ai_chat_history');
      } catch (_) {}
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-[#070c18] relative select-none overflow-hidden transition-colors duration-200">
      {/* Top Header */}
      <header className="h-16 px-4 md:px-6 bg-white/90 dark:bg-[#0e1424]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[2px] shadow-md shadow-indigo-500/20">
              <div className="w-full h-full bg-white dark:bg-[#0c1220] rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-cyan-400 animate-pulse" />
              </div>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0c1220] shadow-xs" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-sm md:text-base text-slate-900 dark:text-white tracking-tight">
                Claude 3.7 AI Assistant
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-purple-900/30 text-indigo-600 dark:text-purple-300 border border-indigo-200/80 dark:border-purple-500/30">
                OmniRoute
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Dedicated AI workspace for drafting, brainstorming & coding
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 cursor-pointer"
              title="Clear conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          {onNavigateToChat && (
            <button
              onClick={onNavigateToChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-cyan-300 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-600/30 transition cursor-pointer"
              title="Back to Messages"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">All Chats</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-4xl w-full mx-auto">
        {messages.length === 0 ? (
          /* Empty / Welcome State with Prompt Cards */
          <div className="py-6 sm:py-10 space-y-6">
            <div className="text-center space-y-2 max-w-lg mx-auto">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-gradient-to-tr from-purple-500 via-indigo-500 to-cyan-400 p-[2px] shadow-xl shadow-indigo-500/20">
                <div className="w-full h-full bg-white dark:bg-[#090d18] rounded-[22px] flex items-center justify-center">
                  <Bot className="w-7 h-7 text-indigo-600 dark:text-cyan-400" />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                How can I help you today?
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Your smart AI companion inside HDTalk. Ask questions, draft polished messages, explain architecture, or brainstorm ideas.
              </p>
            </div>

            {/* Starter Prompt Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {STARTER_PROMPTS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.prompt)}
                    className="p-4 rounded-2xl bg-white dark:bg-[#0e1424] border border-slate-200/80 dark:border-white/10 hover:border-indigo-400/60 dark:hover:border-cyan-400/40 shadow-xs hover:shadow-md transition-all duration-200 text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-white/5 flex items-center justify-center text-indigo-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Message List */
          messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id || idx}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 text-white shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-xs relative group ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-white dark:bg-[#0e1424] border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-100 rounded-tl-xs'
                  }`}
                >
                  <div className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap select-text">
                    {m.content}
                  </div>

                  {/* Message Footer: Timestamp & Copy */}
                  <div className={`flex items-center justify-between gap-3 mt-2 text-[10px] ${isUser ? 'text-blue-100/70' : 'text-slate-400'}`}>
                    <span>
                      {new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {!isUser && (
                      <button
                        onClick={() => handleCopy(m.content, idx)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 hover:text-indigo-600 dark:hover:text-cyan-400 cursor-pointer"
                        title="Copy message text"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-500">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isUser && user && (
                  <Avatar src={user.avatar} name={user.name} size="sm" shape="circle" />
                )}
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 text-white">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-xs bg-white dark:bg-[#0e1424] border border-slate-200/80 dark:border-white/10 shadow-xs flex items-center gap-2">
              <span className="text-xs text-indigo-600 dark:text-cyan-400 font-medium">Claude is thinking</span>
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="p-3 sm:p-4 bg-white/95 dark:bg-[#0e1424]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/10 flex-shrink-0 z-20">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Quick Suggestions Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[11px]">
            <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> Quick:
            </span>
            {[
              'Explain WebRTC Calling',
              'Draft networking message',
              'Suggest feature roadmap',
              'Summarize HDTalk architecture'
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-cyan-300 border border-slate-200/70 dark:border-white/10 whitespace-nowrap transition cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Text Input Box */}
          <div className="relative flex items-end gap-2 bg-slate-100 dark:bg-[#131b2e] rounded-2xl p-1.5 border border-slate-200/80 dark:border-white/10 focus-within:border-indigo-500/50 dark:focus-within:border-cyan-400/50 focus-within:ring-2 focus-within:ring-indigo-500/15 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask Claude anything... (Enter to send, Shift+Enter for new line)"
              className="flex-1 max-h-28 px-3 py-2 text-xs sm:text-sm bg-transparent border-0 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none"
            />

            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-md shadow-indigo-500/20 cursor-pointer"
              title="Send to Claude"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
