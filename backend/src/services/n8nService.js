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
    return `Hello ${name}! 👋 I am your **HDTalk AI Assistant** powered by n8n workflow automations.\n\nHow can I help you today? You can ask me about:\n• 📹 **WebRTC Video & Audio Calling**\n• ⚡ **n8n Automations & Webhooks**\n• 📲 **PWA Installation & Mobile App**\n• 🔔 **Background Push Notifications**\n• 🔒 **Security, Privacy & Encryption**\n• 🛠️ **System Architecture & Creator Info**`;
  }

  if (q.includes('creator') || q.includes('who made') || q.includes('who built') || q.includes('founder') || q.includes('himanshu') || q.includes('dwivedi')) {
    return `HDTalk was envisioned, architected, and crafted with ❤️ by **Himanshu Dwivedi** as a high-performance, real-time communication platform featuring peer-to-peer WebRTC video mesh, secure direct messaging, and automated n8n workflows.`;
  }

  if (q.includes('call') || q.includes('video') || q.includes('audio') || q.includes('camera') || q.includes('mic') || q.includes('webrtc')) {
    return `📹 **HDTalk Video & Audio Calling Guide:**\n\n• **How to Call**: Open any chat or discover profile, then click the **"Video Call"** button.\n• **Technology**: HDTalk uses ultra-low-latency peer-to-peer **WebRTC** with Google STUN and Metered TURN NAT traversal.\n• **Screen Sharing**: During any active call, click the **Screen Share** icon to broadcast your screen or window in 1080p.\n• **Camera/Mic Blocked?**: If video is black or permissions are denied, check your browser address bar (lock icon 🔒) and set Camera & Microphone to **"Allow"**, then refresh.`;
  }

  if (q.includes('n8n') || q.includes('automation') || q.includes('workflow') || q.includes('webhook')) {
    return `⚡ **n8n Automation Subsystem Status: ACTIVE!**\n\nHDTalk connects natively with n8n workflows for event-driven actions:\n• **User Registered**: Sends automated welcome email & CRM records.\n• **Missed Calls**: Dispatches SMS & push alerts to offline recipients.\n• **Offline Messages**: Background email/push digests.\n• **AI Queries**: Dispatches \`@bot\` questions to custom AI/LLM chains.\n\nYou can download the pre-packaged workflow from **GET /api/n8n/workflow** or import \`hdtalk-automation-workflow.json\` into your self-hosted n8n instance!`;
  }

  if (q.includes('pwa') || q.includes('install') || q.includes('download') || q.includes('apk') || q.includes('app') || q.includes('mobile')) {
    return `📲 **Installing HDTalk as an App (PWA):**\n\nHDTalk is a full **Progressive Web App (PWA)** that installs natively on any device:\n• **Chrome / Edge (Desktop)**: Click the **"Install App"** button in the top navbar or the install icon in the URL bar.\n• **Android (Chrome)**: Tap the browser menu (⋮) and choose **"Install app"** or **"Add to Home screen"**.\n• **iOS Safari (iPhone/iPad)**: Tap the **Share** button (box with upward arrow) and select **"Add to Home Screen"**.\n\nOnce installed, HDTalk opens in full-screen standalone mode with native performance!`;
  }

  if (q.includes('push') || q.includes('notification') || q.includes('alert') || q.includes('vapid')) {
    return `🔔 **Background Push Notifications:**\n\nHDTalk uses RFC-8292 standard **Web Push** with VAPID cryptographic keys.\n• Even if your browser tab is closed or minimized, your device will receive immediate alerts for incoming video calls and chat messages.\n• Click the **Bell** icon in the top navigation bar to check your notification permission status or re-enable push alerts anytime!`;
  }

  if (q.includes('security') || q.includes('encrypt') || q.includes('private') || q.includes('safe') || q.includes('password')) {
    return `🔒 **Enterprise-Grade Security in HDTalk:**\n\n1. **WebRTC Media**: All audio/video streams are encrypted end-to-end via **DTLS-SRTP**.\n2. **Authentication**: Uses cryptographically signed **JWT tokens** with bcrypt password hashing.\n3. **Sanitization**: XSS prevention and MIME-type verification protect against unsafe uploads.\n4. **Database Safety**: Dual-layer architecture with MongoDB Atlas production cluster and local memory fallback.`;
  }

  if (q.includes('theme') || q.includes('dark') || q.includes('light') || q.includes('color')) {
    return `🎨 **Theme Gallery & Dark Mode:**\n\n• **Instant Toggle**: Click the Sun/Moon icon in the top navigation bar to toggle between Light and Dark mode.\n• **Theme Gallery**: Click the **Palette** icon in the sidebar or navbar to choose between curated luxury color schemes (Midnight Titanium, Arctic Frost, Emerald Glow, Cyberpunk Neon).`;
  }

  if (q.includes('friend') || q.includes('request') || q.includes('discover') || q.includes('matchmaking')) {
    return `👥 **Matchmaking & Friend Connections:**\n\n• Click **"Discover"** (Compass icon) in the navigation bar to find other members filtered by interests and profession.\n• Send a **Connect Request** to start a conversation.\n• Manage incoming invites via the **"Requests"** modal in the top bar or sidebar.`;
  }

  if (q.includes('feature') || q.includes('what can you do') || q.includes('help') || q.includes('guide')) {
    return `🚀 **HDTalk Feature Suite:**\n\n1. 📹 **HD Video & Voice Calling**: High-definition peer-to-peer WebRTC calls with screen sharing.\n2. 💬 **Instant Messaging**: Real-time chats with typing indicators, reactions, and read receipts.\n3. 🎙️ **Voice Notes**: In-browser voice recording and audio player.\n4. 📁 **File & Media Sharing**: Upload images, documents, and videos up to 25MB.\n5. ⚡ **n8n Automation Engine**: Background webhook integrations and @bot AI query responses.\n6. 📲 **PWA Installation**: Install on iOS, Android, macOS, and Windows.\n7. 🔔 **Background Push Alerts**: Receive notifications even when the app is closed.`;
  }

  if (q.includes('thank') || q.includes('thx') || q.includes('shukriya') || q.includes('dhanyawad')) {
    return `You're very welcome, ${name}! 😊 I'm always here to assist. Feel free to ask any other questions, or tag \`@bot\` in any chat!`;
  }

  return `🤖 **HDTalk AI Assistant:** I received your query: *"@bot ${query}"*.\n\nHDTalk's automated assistant engine is active. If you need assistance with **video calling**, **n8n workflows**, **PWA installation**, or **friend requests**, feel free to ask or pick from the quick questions below! 🚀`;
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
  getN8nStatus,
  generateSmartAIResponse
};
