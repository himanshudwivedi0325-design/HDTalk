const config = require('../config/config');
const db = require('../database/db');

/**
 * HDTalk AI Assistant powered by Claude via OmniRoute
 */

const OMNIROUTE_BASE_URL = process.env.OMNIROUTE_BASE_URL || config.OMNIROUTE_BASE_URL || 'http://127.0.0.1:20128/v1';
const OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY || config.OMNIROUTE_API_KEY || 'sk_omniroute';
const OMNIROUTE_MODEL = process.env.OMNIROUTE_MODEL || config.OMNIROUTE_MODEL || 'auto/claude-sonnet';

/**
 * Smart conversational fallback when OmniRoute gateway is temporarily unreachable
 */
function getSmartFallbackResponse(query, senderName) {
  const q = (query || '').toLowerCase().trim();
  const name = senderName || 'friend';

  if (!q || /^(hi|hello|hey|namaste|hola|hlo|hii|helo|pranam)\b/i.test(q)) {
    return `Namaste ${name}! 🙏 Main **Claude AI Assistant** hoon — HDTalk ka smart companion! Main real-time messaging, networking, queries aur brainstorming me aapki help karne ke liye ready hoon. Bataiye aaj main aapki kya madad kar sakta hoon?`;
  }
  if (/how are you|kaise ho|kya haal|kaisa hai/i.test(q)) {
    return `Main bilkul theek aur energetic hoon! 😊 Aap bataiye aapka din kaisa chal raha hai? HDTalk par chatting, voice notes aur HD calls sab super smooth chal rahe hain.`;
  }
  if (/who are you|tum kaun ho|aap kaun ho|who created|kisne banaya/i.test(q)) {
    return `Main **Claude AI Assistant** hoon, embedded directly inside HDTalk! HDTalk ko **Himanshu Dwivedi** ne create kiya hai ek cutting-edge real-time messaging, HD WebRTC calling aur networking platform ke roop me.`;
  }
  if (/features|kya kar sakte ho|what can you do|help|madad/i.test(q)) {
    return `HDTalk par aap ye sab kar sakte hain:\n- 💬 **Instant Real-Time Chat**: Auto-expanding input, Shift+Enter newlines, rich emoji reactions\n- 🎤 **HD Voice Notes**: Crisp audio recording & permanent playback\n- 📹 **HD Video & Voice Calls**: WebRTC peer-to-peer and mesh group calling\n- 📎 **Files & Media Sharing**: Photos, documents and videos with permanent cloud hosting\n- 🤖 **Smart AI Assistant**: Mujhe direct message bhejein ya kisi bhi chat me @claude ya @bot bolkar mention karein!`;
  }
  if (/weather|mausam/i.test(q)) {
    return `Filhal mere paas live GPS weather sensors nahi hain, lekin aap apne city ka mausam browser ya weather widget par dekh sakte hain! Agar koi aur query ho toh zaroor poochiye.`;
  }
  return `Maine aapka message read kiya: "${query || '...'}"! Main HDTalk ka built-in AI hoon. Agar aapko koi specific question, idea brainstorm karna ho, ya system design discuss karna ho, toh batayein! 🚀`;
}

/**
 * Send a chat completion request to Claude via OmniRoute
 */
async function queryClaude(messages, options = {}) {
  const model = options.model || OMNIROUTE_MODEL;
  const systemPrompt = options.systemPrompt || 
    "You are Claude, the intelligent AI companion embedded directly inside HDTalk (chatz-ultra). " +
    "You provide friendly, natural, helpful, and concise responses. Use Markdown formatting, bullet points, and code formatting when appropriate.";

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const payload = {
    model,
    messages: formattedMessages,
    temperature: options.temperature || 0.7,
    max_tokens: options.max_tokens || 1000
  };

  // Build target endpoints (trying both 127.0.0.1 and localhost for Windows compatibility)
  const candidateUrls = [OMNIROUTE_BASE_URL];
  if (OMNIROUTE_BASE_URL.includes('127.0.0.1')) {
    candidateUrls.push(OMNIROUTE_BASE_URL.replace('127.0.0.1', 'localhost'));
  } else if (OMNIROUTE_BASE_URL.includes('localhost')) {
    candidateUrls.push(OMNIROUTE_BASE_URL.replace('localhost', '127.0.0.1'));
  }

  let lastError = null;
  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OMNIROUTE_API_KEY}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OmniRoute error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const choice = data.choices && data.choices[0];
      const replyContent = choice?.message?.content || 'Sorry, I could not generate a response.';
      return {
        content: replyContent,
        model: data.model || model,
        usage: data.usage
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('OmniRoute gateway unreachable.');
}

/**
 * Handle AI Query triggered from Socket.io when user mentions @bot, @ai, or @claude
 */
async function handleAIBotQuery({ conversationId, sender, text, replyToId, socketManager }) {
  const cleanQuery = text.replace(/@claude|@bot|@ai/gi, '').trim();
  const io = socketManager && socketManager.getIO ? socketManager.getIO() : null;
  const botUser = db.getOrCreateBotUser();

  // 1. Emit typing indicator
  if (io) {
    io.to(`conv:${conversationId}`).emit('user_typing', {
      conversationId,
      userId: botUser.id
    });
  }

  try {
    // 2. Fetch context from conversation (last 6 messages)
    let recentMessages = [];
    try {
      if (typeof db.getMessages === 'function') {
        recentMessages = db.getMessages(conversationId, sender.id) || [];
      }
    } catch (e) {
      console.warn('[Claude AI] Context lookup skipped:', e.message);
    }

    const contextHistory = recentMessages
      .slice(-6)
      .filter(m => m && m.text && (!m.type || m.type === 'text'))
      .map(m => ({
        role: m.senderId === botUser.id ? 'assistant' : 'user',
        content: m.senderId === botUser.id ? m.text : `${m.senderName || 'User'}: ${m.text}`
      }));

    if (cleanQuery) {
      contextHistory.push({
        role: 'user',
        content: `${sender.name || 'User'}: ${cleanQuery}`
      });
    }

    // 3. Query Claude via OmniRoute
    let replyText = '';
    try {
      const result = await queryClaude(contextHistory);
      replyText = result.content;
    } catch (routeErr) {
      console.warn('[Claude AI] OmniRoute gateway offline/fallback triggered:', routeErr.message);
      replyText = getSmartFallbackResponse(cleanQuery, sender?.name);
    }

    // 4. Create bot message in DB
    const botMsg = db.createMessage({
      conversationId,
      senderId: botUser.id,
      text: replyText,
      type: 'text',
      replyToId: replyToId || null
    });

    // 5. Broadcast to conversation room via Socket.io
    if (io) {
      io.to(`conv:${conversationId}`).emit('receive_message', botMsg);
      io.to(`user:${sender.id}`).emit('conversation_updated', {
        conversationId,
        lastMessage: {
          text: botMsg.text,
          senderId: botUser.id,
          timestamp: botMsg.timestamp
        },
        updatedAt: botMsg.timestamp
      });
    }

    return botMsg;
  } catch (err) {
    console.error('[Claude AI] Unexpected error handling bot query:', err.message);
  } finally {
    // Stop typing indicator
    if (io) {
      io.to(`conv:${conversationId}`).emit('user_stop_typing', {
        conversationId,
        userId: botUser.id
      });
    }
  }
}

module.exports = {
  queryClaude,
  handleAIBotQuery,
  getSmartFallbackResponse
};
