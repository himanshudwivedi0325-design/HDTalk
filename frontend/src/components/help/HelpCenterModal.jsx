import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Bot, 
  Send, 
  Sparkles, 
  HelpCircle, 
  BookOpen, 
  Video, 
  Zap, 
  Download, 
  Bell, 
  ShieldCheck, 
  Trash2, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { api } from '../../services/api';
import { Avatar } from '../ui/Avatar';

// FAQ Content Dataset
const FAQ_CATEGORIES = [
  {
    id: 'calling',
    title: 'HD Video & Audio Calling',
    icon: Video,
    color: 'text-blue-500',
    items: [
      {
        q: 'How do I start a video or audio call?',
        a: 'Navigate to any chat in **Messages** or find any user in **Discover / Matchmaking**. Open their conversation and click the **Video Call** button in the top header. HDTalk instantly establishes a peer-to-peer WebRTC connection.'
      },
      {
        q: 'How does Screen Sharing work?',
        a: 'During an ongoing call, click the **Screen Share** icon in the bottom call control dock. You can broadcast your entire screen, an application window, or a specific browser tab in crisp 1080p resolution.'
      },
      {
        q: 'Why is my camera or microphone blocked?',
        a: 'If you see a black video feed or a permissions alert, look at your browser address bar (lock icon 🔒 next to the URL). Ensure both **Camera** and **Microphone** permissions are set to **Allow**, then refresh the page.'
      },
      {
        q: 'What network technology powers calling?',
        a: 'HDTalk uses peer-to-peer **WebRTC** with DTLS-SRTP encryption, Google Public STUN servers for NAT traversal, and Metered TURN relay servers for restrictive firewall environments.'
      }
    ]
  },
  {
    id: 'n8n',
    title: 'n8n Workflow Automations',
    icon: Zap,
    color: 'text-amber-500',
    items: [
      {
        q: 'What is the n8n automation engine in HDTalk?',
        a: 'HDTalk integrates natively with **n8n**, the leading workflow automation platform. Whenever key events occur (user signup, missed calls, offline messages, or @bot queries), HDTalk automatically dispatches webhooks to trigger downstream automations, CRM syncs, or AI chains.'
      },
      {
        q: 'What happens if external n8n is offline?',
        a: 'HDTalk features a resilient **hybrid dual-engine architecture**. If an external n8n cluster is offline or unreachable, HDTalk\'s built-in smart AI engine seamlessly takes over with zero downtime.'
      },
      {
        q: 'How do I query the AI Assistant in chats?',
        a: 'You can tag `@bot` or `@ai` in any regular chat message, or chat directly with **HDTalk AI Assistant** in a 1-on-1 direct conversation. The bot will analyze your query and provide instant guidance.'
      },
      {
        q: 'How can I connect my own self-hosted n8n instance?',
        a: 'Download the pre-packaged workflow schema by visiting `/api/n8n/workflow`. Import it into your n8n workspace and set `N8N_WEBHOOK_URL` in your server environment variables.'
      }
    ]
  },
  {
    id: 'pwa',
    title: 'PWA Mobile & Desktop Installation',
    icon: Download,
    color: 'text-emerald-500',
    items: [
      {
        q: 'How do I install HDTalk as an app?',
        a: 'HDTalk is a full **Progressive Web App (PWA)**.\n• **Desktop (Chrome/Edge)**: Click the **"Install App"** button in the top navbar.\n• **Android**: Tap the browser menu (⋮) and select **"Install app"** or **"Add to Home screen"**.\n• **iOS (iPhone/iPad)**: In Safari, tap the **Share** button (box with upward arrow) and choose **"Add to Home Screen"**.'
      },
      {
        q: 'Does the installed PWA support offline and push notifications?',
        a: 'Yes! The installed PWA runs in standalone mode with its own app icon, cached offline assets, and background Web Push notification handlers.'
      }
    ]
  },
  {
    id: 'security',
    title: 'Security, Encryption & Privacy',
    icon: ShieldCheck,
    color: 'text-indigo-500',
    items: [
      {
        q: 'How secure is HDTalk communication?',
        a: '1. **WebRTC Media**: All audio and video streams are end-to-end encrypted using **DTLS-SRTP**.\n2. **Authentication**: Secure JWT tokens with expiration and bcrypt password hashing.\n3. **Sanitization**: Strict file extension and MIME-type filters protect against malicious uploads.\n4. **Database Resilience**: MongoDB Atlas cloud cluster with automated schema verification.'
      },
      {
        q: 'Who created HDTalk?',
        a: 'HDTalk was architected and built from the ground up with ❤️ by **Himanshu Dwivedi** as an enterprise-grade, high-performance real-time messaging, WebRTC calling, and automated workflow platform.'
      }
    ]
  },
  {
    id: 'notifications',
    title: 'Background Push Notifications',
    icon: Bell,
    color: 'text-rose-500',
    items: [
      {
        q: 'How do background notifications work?',
        a: 'HDTalk implements standard RFC-8292 **Web Push** with cryptographic VAPID keys. Even if your browser tab is closed or your device is asleep, incoming calls and chat messages trigger high-priority alerts.'
      },
      {
        q: 'How do I enable or test push notifications?',
        a: 'Click the **Bell** icon in the top navigation bar to open the **Notification Manager**. You can test push delivery or grant browser permissions in one click.'
      }
    ]
  }
];

// Quick prompt pills for one-click questions
const QUICK_PROMPTS = [
  'How do video calls work?',
  'What can n8n automation do?',
  'How to install the PWA app?',
  'Who created HDTalk?',
  'How do push notifications work?',
  'Camera or microphone blocked?',
  'Is my chat encrypted and secure?'
];

// Simple Markdown Formatter Helper
function renderFormattedMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');

  return lines.map((line, lIdx) => {
    const isBullet = line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ');
    const isNumbered = /^\d+\.\s/.test(line);

    let formatted = line;
    if (isBullet) formatted = formatted.replace(/^[•\-\*]\s+/, '');
    if (isNumbered) formatted = formatted.replace(/^\d+\.\s+/, '');

    const parts = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(formatted)) !== null) {
      if (match.index > lastIndex) {
        parts.push(formatted.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={`b-${lIdx}-${match.index}`} className="font-semibold text-slate-900 dark:text-white">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={`c-${lIdx}-${match.index}`} className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-white/10 font-mono text-xs text-blue-600 dark:text-cyan-300">
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < formatted.length) {
      parts.push(formatted.substring(lastIndex));
    }

    if (line.trim() === '') {
      return <div key={lIdx} className="h-2" />;
    }

    if (isBullet) {
      return (
        <div key={lIdx} className="flex items-start gap-2 my-1 pl-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-cyan-400 mt-1.5 flex-shrink-0" />
          <div className="flex-1 leading-relaxed text-xs sm:text-sm">{parts.length > 0 ? parts : formatted}</div>
        </div>
      );
    }

    if (isNumbered) {
      const num = line.match(/^\d+/)[0];
      return (
        <div key={lIdx} className="flex items-start gap-2 my-1 pl-1">
          <span className="text-xs font-bold text-blue-600 dark:text-cyan-400 mt-0.5 flex-shrink-0">{num}.</span>
          <div className="flex-1 leading-relaxed text-xs sm:text-sm">{parts.length > 0 ? parts : formatted}</div>
        </div>
      );
    }

    return (
      <p key={lIdx} className="my-1 leading-relaxed text-xs sm:text-sm">
        {parts.length > 0 ? parts : formatted}
      </p>
    );
  });
}

export function HelpCenterModal({ isOpen, onClose, onOpenMessengerChat }) {
  const { user } = useAuth();
  const { startDirectConversationWithUser, selectConversation, conversations } = useChat();

  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'faq'
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [n8nStatus, setN8nStatus] = useState(null);
  const [faqSearch, setFaqSearch] = useState('');
  const [expandedFaq, setExpandedFaq] = useState({});

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize welcoming chat messages
  useEffect(() => {
    if (isOpen) {
      if (messages.length === 0) {
        setMessages([
          {
            id: 'welcome-msg',
            sender: 'bot',
            text: `Hello ${user?.name ? user.name.split(' ')[0] : 'friend'}! 👋 I am your **HDTalk AI Assistant** powered by our automated workflow engine.\n\nAsk me anything about **HD video calling**, **n8n automations**, **PWA app install**, **background notifications**, or **platform security**!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }

      // Fetch live n8n status
      api.getN8nStatus()
        .then(res => {
          if (res.success) setN8nStatus(res);
        })
        .catch(() => {});
    }
  }, [isOpen, user?.name]);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, activeTab]);

  if (!isOpen) return null;

  const handleSendMessage = async (customQuery) => {
    const query = (customQuery || inputValue || '').trim();
    if (!query || isTyping) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await api.askN8nAssistant(query, user?.name || 'User');
      const botReplyText = res.answer || "I received your query. HDTalk's automated system is ready to help!";
      
      setMessages(prev => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: botReplyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          mode: res.mode
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: "I'm experiencing a brief connection delay, but I'm still here! Feel free to ask another question or explore the Knowledge Base FAQs.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'bot',
        text: `Chat cleared! ✨ How can I assist you now, ${user?.name ? user.name.split(' ')[0] : 'friend'}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Open direct conversation in messenger with usr_ai_bot
  const handleOpenInMessenger = async () => {
    try {
      if (onOpenMessengerChat) {
        onOpenMessengerChat();
        onClose();
        return;
      }

      // Check if conversation with usr_ai_bot already exists
      const existing = (conversations || []).find(c => 
        !c.isGroup && c.participants?.includes('usr_ai_bot')
      );

      if (existing) {
        selectConversation(existing);
      } else if (startDirectConversationWithUser) {
        const conv = await startDirectConversationWithUser('usr_ai_bot');
        if (conv) selectConversation(conv);
      }
      onClose();
    } catch (err) {
      console.warn('Error opening AI conversation:', err);
      onClose();
    }
  };

  const toggleFaq = (key) => {
    setExpandedFaq(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Filtered FAQs
  const filteredCategories = FAQ_CATEGORIES.map(cat => {
    if (!faqSearch.trim()) return cat;
    const term = faqSearch.toLowerCase();
    const matchedItems = cat.items.filter(item => 
      item.q.toLowerCase().includes(term) || item.a.toLowerCase().includes(term)
    );
    return { ...cat, items: matchedItems };
  }).filter(cat => cat.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl h-[92vh] max-h-[780px] flex flex-col rounded-3xl bg-white dark:bg-[#090f1d] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] backdrop-blur-xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1.5px] shadow-md shadow-blue-500/20">
              <div className="w-full h-full bg-white dark:bg-[#070c18] rounded-[14px] flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-600 dark:text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Help & AI Support
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 text-[10px] font-semibold text-blue-600 dark:text-cyan-300">
                  <Sparkles className="w-2.5 h-2.5" />
                  n8n Powered
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Created by <span className="font-medium text-slate-800 dark:text-slate-200">Himanshu Dwivedi</span> • Instant Answers & Guides
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Gateway / Automation Status Badge */}
            <div 
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-[11px] font-medium text-slate-700 dark:text-slate-300"
              title={n8nStatus?.mode || 'Autonomous Assistant Active'}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{n8nStatus?.configured ? 'n8n Cluster Connected' : 'AI Automation Active'}</span>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              title="Close Help Center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="px-4 sm:px-6 pt-3 pb-2 bg-white dark:bg-[#090f1d] border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Chatbot</span>
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'faq'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Knowledge Base & FAQs</span>
            </button>
          </div>

          {activeTab === 'chat' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearChat}
                className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition"
                title="Clear Chat Conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
              <button
                onClick={handleOpenInMessenger}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-cyan-300 text-xs font-semibold transition"
                title="Open 1-on-1 direct conversation in regular messenger"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chat in Messenger</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: AI Chatbot Assistant View */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-[#070b15]/70">
            {/* Quick Prompt Carousel / Chips */}
            <div className="px-4 py-2 bg-white/70 dark:bg-white/[0.02] border-b border-slate-200/50 dark:border-white/5 overflow-x-auto no-scrollbar flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 whitespace-nowrap pl-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Suggested:
              </span>
              {QUICK_PROMPTS.map((prompt, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => handleSendMessage(prompt)}
                  className="px-2.5 py-1 rounded-xl bg-white dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/15 border border-slate-200/80 dark:border-white/10 hover:border-blue-400/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-300 text-[11px] font-medium whitespace-nowrap transition-all shadow-xs"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0">
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 sm:gap-3 max-w-[90%] sm:max-w-[80%] ${
                      isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    {/* Avatar */}
                    {isUser ? (
                      <Avatar
                        src={user?.avatar}
                        name={user?.name || 'User'}
                        size="sm"
                        shape="circle"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-[1px] flex-shrink-0 shadow-sm shadow-blue-500/30">
                        <div className="w-full h-full bg-[#070c18] rounded-[11px] flex items-center justify-center">
                          <Bot className="w-4 h-4 text-cyan-300" />
                        </div>
                      </div>
                    )}

                    {/* Speech Bubble */}
                    <div className="flex flex-col">
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm shadow-xs ${
                          isUser
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-white dark:bg-[#11192d] text-slate-800 dark:text-slate-200 border border-slate-200/70 dark:border-white/10 rounded-tl-sm shadow-md shadow-black/5'
                        }`}
                      >
                        {!isUser ? (
                          <div className="prose-sm dark:prose-invert">
                            {renderFormattedMarkdown(msg.text)}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        )}
                      </div>

                      {/* Timestamp & Metadata */}
                      <div
                        className={`flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400 ${
                          isUser ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <span>{msg.timestamp}</span>
                        {!isUser && msg.mode && (
                          <>
                            <span>•</span>
                            <span className="text-blue-500 dark:text-cyan-400 font-medium">
                              {msg.mode.includes('External') ? 'n8n Cluster' : 'HDTalk AI'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Bot Typing Indicator */}
              {isTyping && (
                <div className="flex items-start gap-2.5 mr-auto">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-[1px] flex-shrink-0">
                    <div className="w-full h-full bg-[#070c18] rounded-[11px] flex items-center justify-center">
                      <Bot className="w-4 h-4 text-cyan-300" />
                    </div>
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white dark:bg-[#11192d] border border-slate-200/70 dark:border-white/10 shadow-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    <span className="ml-2 text-xs text-slate-400 font-medium">Assistant thinking...</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 sm:p-4 bg-white dark:bg-[#090f1d] border-t border-slate-200/80 dark:border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus-within:ring-2 focus-within:ring-blue-500/40 transition">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about HDTalk, video calling, n8n automations..."
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none"
                  disabled={isTyping}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isTyping}
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white transition shadow-sm"
                  title="Send Question"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Press <b>Enter</b> to send • <b>Shift+Enter</b> for newline</span>
                <span className="hidden sm:inline">Powered by HDTalk Automation & WebRTC Engine</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Knowledge Base & FAQs View */}
        {activeTab === 'faq' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-[#070b15]/70 p-4 sm:p-6 overflow-y-auto">
            {/* Search FAQ */}
            <div className="relative mb-6 max-w-lg mx-auto w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="Search platform guides, features, video calling, n8n..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-xs"
              />
              {faqSearch && (
                <button
                  onClick={() => setFaqSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Groups */}
            <div className="space-y-6 max-w-3xl mx-auto w-full pb-6">
              {filteredCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div key={cat.id} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <Icon className={`w-4 h-4 ${cat.color}`} />
                      <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {cat.title}
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {cat.items.map((item, iIdx) => {
                        const key = `${cat.id}-${iIdx}`;
                        const isExpanded = expandedFaq[key];
                        return (
                          <div
                            key={key}
                            className="rounded-2xl bg-white dark:bg-[#101728] border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-xs transition-all"
                          >
                            <button
                              onClick={() => toggleFaq(key)}
                              className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition"
                            >
                              <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 pr-4">
                                {item.q}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-white/5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-white/[0.01]">
                                {renderFormattedMarkdown(item.a)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredCategories.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <HelpCircle className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm">No FAQs found matching "{faqSearch}"</p>
                  <button
                    onClick={() => {
                      setActiveTab('chat');
                      handleSendMessage(faqSearch);
                    }}
                    className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
                  >
                    Ask AI Assistant Instead
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Bottom Footer Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-white dark:bg-[#090f1d] border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between flex-shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>HDTalk Core Gateway: <b>Active</b></span>
          </div>

          <div>
            <span>Platform Architect: <b className="text-slate-800 dark:text-slate-200">Himanshu Dwivedi</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}
