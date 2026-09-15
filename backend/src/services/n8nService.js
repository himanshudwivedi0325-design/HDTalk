const config = require('../config/config');
const db = require('../database/db');

/**
 * Dispatches an event to the configured n8n Webhook endpoint
 * Non-blocking, safe failover with timeout.
 */
async function sendWebhook(eventData) {
  if (!config.N8N_ENABLED || !config.N8N_WEBHOOK_URL) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout

    const response = await fetch(config.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HDTalk-Backend/1.0 (by Himanshu Dwivedi)'
      },
      body: JSON.stringify(eventData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      return { success: true };
    } else {
      console.warn(`[n8n] Webhook responded with status: ${response.status}`);
      return null;
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[n8n] Webhook timed out (4s). n8n may be offline or processing in background.');
    } else {
      // Quiet failover so HDTalk is never blocked
      console.warn(`[n8n] Webhook dispatch notice: ${err.message}`);
    }
    return null;
  }
}

/**
 * 1. Trigger when a new user completes signup
 */
function notifyUserRegistered(user) {
  const payload = {
    event: 'user_registered',
    timestamp: new Date().toISOString(),
    data: {
      userId: user.id,
      name: user.name,
      email: user.email,
      profession: user.profession || '',
      bio: user.bio || '',
      interests: user.interests || []
    }
  };

  // Run asynchronously in the background
  sendWebhook(payload).catch(() => {});
}

/**
 * 2. Trigger when an incoming call fails because the target is offline
 */
function notifyMissedCall({ caller, targetUser, callType }) {
  if (!caller || !targetUser) return;

  const payload = {
    event: 'missed_call',
    timestamp: new Date().toISOString(),
    data: {
      caller: {
        id: caller.id,
        name: caller.name,
        email: caller.email,
        avatar: caller.avatar || ''
      },
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      },
      callType: callType || 'video',
      alertText: `You missed a ${callType || 'video'} call from ${caller.name} on HDTalk.`
    }
  };

  sendWebhook(payload).catch(() => {});
}

/**
 * 3. Trigger when a chat message is sent to an offline user
 */
function notifyOfflineMessage({ sender, targetUser, conversationId, messageText, messageType }) {
  if (!sender || !targetUser) return;

  const payload = {
    event: 'offline_message',
    timestamp: new Date().toISOString(),
    data: {
      conversationId,
      sender: {
        id: sender.id,
        name: sender.name,
        email: sender.email
      },
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      },
      message: {
        text: messageText || '',
        type: messageType || 'text'
      },
      alertText: `New message from ${sender.name} on HDTalk: "${(messageText || '').slice(0, 100)}"`
    }
  };

  sendWebhook(payload).catch(() => {});
}

/**
 * Helper to post bot message directly into conversation & broadcast via socket
 */
function postBotMessage({ conversationId, text, replyToId, socketManager }) {
  if (!conversationId || !text) return null;

  const botUser = db.getOrCreateBotUser();
  const botMsg = db.createMessage({
    conversationId,
    senderId: botUser.id,
    text: text.trim(),
    type: 'text',
    replyToId: replyToId || null
  });

  const io = socketManager && socketManager.getIO ? socketManager.getIO() : null;
  if (io) {
    io.to(`conv:${conversationId}`).emit('receive_message', botMsg);

    const conv = db.getConversationById(conversationId);
    if (conv && conv.participants) {
      conv.participants.forEach(pId => {
        io.to(`user:${pId}`).emit('conversation_updated', {
          conversationId,
          lastMessage: conv.lastMessage,
          updatedAt: conv.updatedAt
        });
      });
    }
  }

  return botMsg;
}

/**
 * 4. Trigger when a user mentions @bot or @ai in chat
 */
async function handleAIBotQuery({ conversationId, sender, text, replyToId, socketManager }) {
  const cleanQuery = text.replace(/@bot|@ai/gi, '').trim();

  // Send typing indicator from bot
  const io = socketManager && socketManager.getIO ? socketManager.getIO() : null;
  const botUser = db.getOrCreateBotUser();
  if (io) {
    io.to(`conv:${conversationId}`).emit('user_typing', {
      conversationId,
      userId: botUser.id
    });
  }

  const payload = {
    event: 'ai_chat_query',
    timestamp: new Date().toISOString(),
    data: {
      conversationId,
      sender: {
        id: sender.id,
        name: sender.name,
        email: sender.email
      },
      query: cleanQuery || text,
      fullText: text,
      replyToId: replyToId || null
    }
  };

  try {
    const result = await sendWebhook(payload);

    // Stop bot typing
    if (io) {
      io.to(`conv:${conversationId}`).emit('user_stop_typing', {
        conversationId,
        userId: botUser.id
      });
    }

    // If n8n responded synchronously with an answer in JSON { reply: "..." }
    if (result && (result.reply || result.message || result.output)) {
      const replyText = result.reply || result.message || result.output;
      postBotMessage({
        conversationId,
        text: replyText,
        replyToId,
        socketManager
      });
    }
  } catch (err) {
    console.error('[n8n] Error handling AI Bot query:', err);
    if (io) {
      io.to(`conv:${conversationId}`).emit('user_stop_typing', {
        conversationId,
        userId: botUser.id
      });
    }
  }
}

module.exports = {
  sendWebhook,
  notifyUserRegistered,
  notifyMissedCall,
  notifyOfflineMessage,
  handleAIBotQuery,
  postBotMessage
};
