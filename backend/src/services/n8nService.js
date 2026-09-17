const config = require('../config/config');
const db = require('../database/db');

// Telemetry & metrics for diagnostics endpoint
const n8nMetrics = {
  dispatched: 0,
  successful: 0,
  failed: 0,
  lastEvent: null,
  lastEventAt: null,
  lastError: null
};

/**
 * Dispatches an event to the configured n8n Webhook endpoint
 * Non-blocking, safe failover with timeout.
 */
async function sendWebhook(eventData) {
  n8nMetrics.dispatched++;
  n8nMetrics.lastEvent = eventData.event;
  n8nMetrics.lastEventAt = new Date().toISOString();

  if (!config.N8N_ENABLED || !config.N8N_WEBHOOK_URL) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout boundary

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
      n8nMetrics.successful++;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      return { success: true };
    } else {
      n8nMetrics.failed++;
      n8nMetrics.lastError = `HTTP ${response.status}`;
      console.warn(`[n8n] Webhook responded with status: ${response.status}`);
      return null;
    }
  } catch (err) {
    n8nMetrics.failed++;
    n8nMetrics.lastError = err.message;
    if (err.name === 'AbortError') {
      console.warn('[n8n] Webhook timed out (4s). Using built-in smart fallback.');
    } else {
      console.warn(`[n8n] Webhook dispatch notice (${err.message}). Using built-in smart fallback.`);
    }
    return null;
  }
}

/**
 * Built-in Smart AI Knowledge Engine
 * Provides instant, intelligent responses when external n8n is offline or unconfigured
 */
function generateSmartAIResponse(query, senderName) {
  const q = (query || '').toLowerCase().trim();
  const name = senderName || 'friend';

  if (!q || q === 'hi' || q === 'hello' || q === 'hey' || q === 'hola' || q === 'namaste') {
    return `Hello ${name}! 👋 I am your **HDTalk AI Assistant** powered by n8n workflow automations.\n\nHow can I help you today? You can ask me about:\n• 📹 **WebRTC Video & Audio Calling**\n• 💬 **Chat & Voice Notes**\n• ⚡ **n8n Automations & Webhooks**\n• 🛠️ **System Architecture & Creator info**`;
  }

  if (q.includes('creator') || q.includes('who made') || q.includes('who built') || q.includes('founder') || q.includes('himanshu') || q.includes('dwivedi')) {
    return `HDTalk was envisioned, architected, and built with ❤️ by **Himanshu Dwivedi** as an enterprise-grade, real-time communication platform featuring WebRTC calling, instant messaging, and automated n8n workflows.`;
  }

  if (q.includes('feature') || q.includes('what can you do') || q.includes('help') || q.includes('capability') || q.includes('guide')) {
    return `🚀 **HDTalk Core Features:**\n\n1. **HD Video & Voice Calling**: Peer-to-peer WebRTC mesh with STUN/TURN traversal and screen sharing.\n2. **Real-Time Chat**: Direct messaging with typing indicators, delivery receipts, and emojis.\n3. **Voice Notes**: In-browser audio recording & high-fidelity playback.\n4. **File Sharing**: Cloudinary & local storage for images, docs, and code up to 25MB.\n5. **Background Push Alerts**: RFC-8292 Web Push notifications for missed calls and messages.\n6. **n8n Workflow Automation**: Automated user onboarding, CRM triggers, and @bot AI agents.`;
  }

  if (q.includes('n8n') || q.includes('automation') || q.includes('workflow') || q.includes('webhook')) {
    return `⚡ **n8n Automation Subsystem Status: ACTIVE!**\n\nHDTalk connects seamlessly with n8n workflows for:\n• **User Registered**: Welcome emails & CRM synchronization\n• **Missed Calls**: SMS & Push alert dispatches\n• **Offline Messages**: Background digest alerts\n• **AI Chat Queries**: Complex multi-step LLM chains\n\nYou can import the \`hdtalk-automation-workflow.json\` into your self-hosted or cloud n8n instance anytime!`;
  }

  if (q.includes('call') || q.includes('video') || q.includes('audio') || q.includes('webrtc')) {
    return `📞 **Calling on HDTalk:**\nTo start a call, navigate to **Messages** or **Matchmaking**, open any user's profile, and click **"Video Call"**. Calls use secure DTLS-SRTP encryption with Google STUN and Metered TURN fallbacks!`;
  }

  if (q.includes('thank') || q.includes('thx') || q.includes('shukriya') || q.includes('dhanyawad')) {
    return `You're very welcome, ${name}! 😊 Happy to assist. If you ever need anything else, just tag me with \`@bot\`!`;
  }

  return `🤖 **HDTalk AI Assistant:** I received your query: *"@bot ${query}"*.\n\nHDTalk's n8n automation engine is listening! If you have configured custom LLM nodes in your n8n workflow, they will handle complex processing. In the meantime, I'm here to help with any platform guidance or questions! 🚀`;
}

/**
 * 1. Trigger when a new user completes signup
 */
function notifyUserRegistered(user) {
  if (!user) return;

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

  // Dispatch webhook to external n8n in background
  sendWebhook(payload).catch(() => {});

  // Send automated welcome message from AI Assistant
  try {
    const botUser = db.getOrCreateBotUser();
    if (botUser && user.id !== botUser.id) {
      const conv = db.getOrCreateDirectConversation(user.id, botUser.id);
      if (conv) {
        db.createMessage({
          conversationId: conv.id,
          senderId: botUser.id,
          text: `Welcome to HDTalk, ${user.name}! 🚀\n\nI am your **AI Assistant** powered by n8n workflow automations. You can chat with me directly right here, or tag \`@bot\` in any conversation to ask questions or get assistance!`,
          type: 'text'
        });
      }
    }
  } catch (err) {
    console.warn('[n8n] Welcome message notice:', err.message);
  }
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
    io.to(`conv:${conversationId}`).emit('user_stop_typing', {
      conversationId,
      userId: botUser.id
    });

    const conv = db.getConversationById(conversationId);
    if (conv && conv.participants) {
      conv.participants.forEach(pId => {
        io.to(`user:${pId}`).emit('receive_message', botMsg);
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
 * 4. Trigger when a user mentions @bot or @ai in chat, or in an AI direct conversation
 */
async function handleAIBotQuery({ conversationId, sender, text, replyToId, socketManager }) {
  const cleanQuery = text.replace(/@bot|@ai/gi, '').trim();

  // Send real-time typing indicator from bot
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
    let replyText = null;

    // 1. Attempt outbound dispatch to configured external n8n workflow
    const result = await sendWebhook(payload);

    if (result && (result.reply || result.message || result.output)) {
      replyText = result.reply || result.message || result.output;
    } else {
      // 2. Fallback to Built-in Smart AI Engine (instant, context-aware)
      // Short realistic typing pause for natural conversational feel (350ms)
      await new Promise(r => setTimeout(r, 350));
      replyText = generateSmartAIResponse(cleanQuery || text, sender.name);
    }

    // Stop bot typing
    if (io) {
      io.to(`conv:${conversationId}`).emit('user_stop_typing', {
        conversationId,
        userId: botUser.id
      });
    }

    if (replyText) {
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
    const fallbackReply = generateSmartAIResponse(cleanQuery || text, sender.name);
    postBotMessage({
      conversationId,
      text: fallbackReply,
      replyToId,
      socketManager
    });
  }
}

/**
 * Returns integration health and status telemetry
 */
function getN8nStatus() {
  const isConfigured = !!(config.N8N_ENABLED && config.N8N_WEBHOOK_URL && config.N8N_WEBHOOK_URL.trim().length > 0);
  return {
    enabled: config.N8N_ENABLED,
    configured: isConfigured,
    mode: isConfigured ? 'External n8n Workflow Cluster' : 'Built-in Smart Automation & AI Engine',
    webhookUrl: config.N8N_WEBHOOK_URL || '(Internal Autonomous Engine)',
    metrics: n8nMetrics,
    availableEvents: [
      'user_registered',
      'missed_call',
      'offline_message',
      'ai_chat_query'
    ]
  };
}

module.exports = {
  sendWebhook,
  notifyUserRegistered,
  notifyMissedCall,
  notifyOfflineMessage,
  handleAIBotQuery,
  postBotMessage,
  getN8nStatus
};
