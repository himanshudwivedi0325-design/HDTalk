const config = require('../config/config');
const db = require('../database/db');

/**
 * HDTalk AI Assistant powered by Claude via OmniRoute
 */

const OMNIROUTE_BASE_URL = process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1';
const OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY || 'sk_omniroute';
const OMNIROUTE_MODEL = process.env.OMNIROUTE_MODEL || 'auto/claude-sonnet';

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

  const response = await fetch(`${OMNIROUTE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OMNIROUTE_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

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
    const result = await queryClaude(contextHistory);

    // 4. Create bot message in DB
    const botMsg = db.createMessage({
      conversationId,
      senderId: botUser.id,
      text: result.content,
      type: 'text',
      replyToId: replyToId || null,
      replyTo: replyToId ? db.getMessageById(replyToId) : null
    });

    // 5. Broadcast to conversation room via Socket.io
    if (io) {
      io.to(`conv:${conversationId}`).emit('receive_message', botMsg);
    }

    return botMsg;
  } catch (err) {
    console.error('[Claude AI / OmniRoute] Error querying AI:', err.message);
    const fallbackMsg = db.createMessage({
      conversationId,
      senderId: botUser.id,
      text: `⚠️ Claude AI: Request could not be completed (${err.message}). Make sure OmniRoute is running on port 20128.`,
      type: 'text',
      replyToId: replyToId || null
    });
    if (io) {
      io.to(`conv:${conversationId}`).emit('receive_message', fallbackMsg);
    }
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
  handleAIBotQuery
};
