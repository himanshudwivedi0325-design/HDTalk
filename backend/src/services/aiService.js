const config = require('../config/config');
const db = require('../database/db');

/**
 * HDTalk AI Assistant powered by Claude via OmniRoute, with multi-cloud fallbacks (Gemini/Groq/OpenAI)
 */

const OMNIROUTE_BASE_URL = process.env.OMNIROUTE_BASE_URL || config.OMNIROUTE_BASE_URL || 'http://127.0.0.1:20128/v1';
const OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY || config.OMNIROUTE_API_KEY || 'sk_omniroute';
const OMNIROUTE_MODEL = process.env.OMNIROUTE_MODEL || config.OMNIROUTE_MODEL || 'auto/claude-sonnet';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || config.GROQ_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || config.OPENAI_API_KEY || '';

/**
 * Smart conversational & generative fallback when external cloud AI is offline
 */
function getSmartFallbackResponse(query, senderName) {
  const q = (query || '').toLowerCase().trim();
  const name = senderName || 'friend';

  // 1. Leave Applications
  if (/leave application|leave request|sick leave|casual leave|urgent leave|application for leave|leave.*english|chhutti/i.test(q)) {
    return `Here are professionally formatted **Leave Application Templates** ready to customize:\n\n---\n\n### 🏢 1. For Office / Work (Formal Email)\n\n**Subject:** Leave Application – [Your Full Name]\n\nDear [Manager / Supervisor Name],\n\nI am writing to formally request leave from **[Start Date]** to **[End Date]** (total: **[X] days**) due to **[Reason: illness / personal work / family event]**.\n\nI have ensured that my current tasks are up-to-date and have briefed [Colleague's Name] to assist with any urgent matters during my absence. I will also be reachable on my mobile number ([Your Phone Number]) or email in case of an emergency.\n\nI kindly request you to approve my leave. Thank you for your consideration.\n\nSincerely,  \n**[Your Name]**  \n[Your Designation / Employee ID]\n\n---\n\n### 🏫 2. For School / College\n\n**Subject:** Application for Leave of Absence\n\nRespected [Principal / Class Teacher's Name],\n\nI am **[Your Name]**, student of Class/Section **[Class & Section]**, Roll No **[Roll Number]**. I kindly request leave from **[Start Date]** to **[End Date]** due to **[Reason: viral fever / doctor advised rest / urgent family function]**.\n\nI will make sure to catch up on all the missed lessons and homework promptly once I resume classes.\n\nPlease grant me leave for the mentioned days. I will be very grateful.\n\nYours obediently,  \n**[Your Name]**  \nClass: [Class] | Roll No: [Roll No]\n\n---\n\n### ⚡ 3. Short & Quick (Slack / WhatsApp / HDTalk Message)\n\n> **Subject / Message:** Leave Request: [Start Date] - [End Date]\n> \n> Hi [Manager Name], I need to take leave from [Start Date] to [End Date] due to [Reason]. My urgent deliverables are handed over and I'll be reachable for anything urgent. Thanks!\n\n---\n💡 *Aap kis specific purpose ke liye leave likhna chahte hain? Batayein, main exact details ke sath customize kar dunga!*`;
  }

  // 2. Email Drafting
  if (/email|draft.*message|formal letter|letter|application/i.test(q)) {
    return `Here is a versatile, professional **Email Template**:\n\n---\n\n**Subject:** [Clear & Concise Topic / Action Required]\n\nDear [Recipient Name],\n\nI hope you are having a productive week.\n\nI am reaching out regarding **[Topic / Project]**. [State your main message or question in 1-2 clear sentences].\n\nHere are the key points:\n- **Point 1:** [Detail or deliverable]\n- **Point 2:** [Timeline or next steps]\n\nPlease let me know your thoughts or if we can connect for a brief 5-minute sync.\n\nBest regards,  \n**[Your Name]**  \n[Your Contact Information]`;
  }

  // 3. Resignation Letter
  if (/resignation|resign/i.test(q)) {
    return `Here is a professional **Resignation Letter**:\n\n---\n\n**Subject:** Resignation – [Your Name]\n\nDear [Manager's Name],\n\nPlease accept this letter as formal notification that I am resigning from my position as **[Your Job Title]** at **[Company Name]**. My last working day will be **[Last Date]**.\n\nI am grateful for the opportunities I've had during my time with the company. I appreciate the guidance and support provided by you and the team.\n\nDuring my remaining time, I will ensure a smooth handover of all my current responsibilities and assist in training the replacement.\n\nI wish you and the company continued success.\n\nSincerely,  \n**[Your Name]**`;
  }

  // 4. WebRTC Calling Explanation
  if (/webrtc|calling|call|audio.*video|mesh/i.test(q)) {
    return `### 📞 How WebRTC Audio/Video Calling Works in HDTalk:\n\n1. **Signaling (Socket.IO)**: When you initiate a call, HDTalk sends an encrypted signal payload (SDP offer & ICE candidates) to the recipient through our Node.js WebSocket gateway.\n2. **STUN/TURN Discovery**: Browsers query public STUN servers (Google STUN) to discover their public IP addresses and NAT traversal routes.\n3. **Peer-to-Peer Media Pipe**: Once both peers exchange candidates, media streams directly between both devices (P2P) with ultra-low latency and end-to-end encryption without burdening the central server!`;
  }

  // 5. Greetings
  if (!q || /^(hi|hello|hey|namaste|hola|hlo|hii|helo|pranam)\b/i.test(q)) {
    return `Namaste ${name}! 🙏 Main **Claude AI Assistant** hoon — HDTalk ka smart companion! Main real-time messaging, drafting, coding aur brainstorming me aapki help karne ke liye ready hoon. Bataiye aaj main aapki kya madad kar sakta hoon?`;
  }

  // 6. Identity / Creator
  if (/who are you|tum kaun ho|aap kaun ho|who created|kisne banaya/i.test(q)) {
    return `Main **Claude AI Assistant** hoon, embedded directly inside HDTalk! HDTalk ko **Himanshu Dwivedi** ne create kiya hai ek cutting-edge real-time messaging, HD WebRTC calling aur networking platform ke roop me.`;
  }

  // 7. General Features
  if (/features|kya kar sakte ho|what can you do|help|madad/i.test(q)) {
    return `HDTalk par aap ye sab kar sakte hain:\n- 💬 **Instant Real-Time Chat**: Auto-expanding input, Shift+Enter newlines, rich emoji reactions\n- 🎤 **HD Voice Notes**: Crisp audio recording & permanent playback\n- 📹 **HD Video & Voice Calls**: WebRTC peer-to-peer and mesh group calling\n- 📎 **Files & Media Sharing**: Photos, documents and videos with permanent cloud hosting\n- 🤖 **Dedicated AI Assistant**: Drafting, code review, translation, aur instant answers!`;
  }

  // 8. General Catch-All with High-Quality Breakdown
  return `Maine aapka message read kiya: **"${query || '...'}"**!\n\nAap iske baare me aur details provide kar sakte hain (jaise kis context me chahiye, formal ya informal, specific language). Main turant tailored response generate kar dunga!\n\n> 💡 **Pro Tip for Render Cloud Deployment:**\n> Render cloud par 24/7 unlimited live AI answers ke liye Render dashboard me free \`GEMINI_API_KEY\` ya \`GROQ_API_KEY\` add karein, ya fir apne computer par \`http://localhost:5173\` use karein jahan local OmniRoute Claude active hai!`;
}

/**
 * Direct Google Gemini API call (Free Tier 24/7 on Cloud)
 */
async function queryGemini(messages, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const formattedContents = messages
    .filter(m => m && m.content)
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: formattedContents,
      systemInstruction: {
        parts: [{ text: "You are Claude 3.7, the intelligent AI companion inside HDTalk. Answer helpfully, accurately, and naturally with clear Markdown formatting." }]
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content returned from Gemini.');
  return {
    content: text,
    model: 'gemini-1.5-flash',
    provider: 'Google Gemini'
  };
}

/**
 * Direct Groq / OpenAI Compatible API call
 */
async function queryOpenAICompatible(messages, { baseUrl, apiKey, model, providerName = 'Cloud AI' }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: "You are Claude 3.7, the intelligent companion inside HDTalk. Provide natural, structured, and helpful responses with Markdown." },
        ...messages
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${providerName} error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices && data.choices[0];
  return {
    content: choice?.message?.content || 'No response generated.',
    model: data.model || model,
    provider: providerName,
    usage: data.usage
  };
}

/**
 * Send a chat completion request with multi-cloud fallback:
 * 1. OmniRoute (Localhost / Custom endpoint)
 * 2. Google Gemini API (if GEMINI_API_KEY set)
 * 3. Groq API (if GROQ_API_KEY set)
 * 4. OpenAI API (if OPENAI_API_KEY set)
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

  // 1. Try OmniRoute (Localhost or configured server)
  const candidateUrls = [OMNIROUTE_BASE_URL];
  if (OMNIROUTE_BASE_URL.includes('127.0.0.1')) {
    candidateUrls.push(OMNIROUTE_BASE_URL.replace('127.0.0.1', 'localhost'));
  } else if (OMNIROUTE_BASE_URL.includes('localhost')) {
    candidateUrls.push(OMNIROUTE_BASE_URL.replace('localhost', '127.0.0.1'));
  }

  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

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

      if (response.ok) {
        const data = await response.json();
        const choice = data.choices && data.choices[0];
        const replyContent = choice?.message?.content;
        if (replyContent) {
          return {
            content: replyContent,
            model: data.model || model,
            usage: data.usage,
            provider: 'OmniRoute'
          };
        }
      }
    } catch (_) {
      // Continue to next provider
    }
  }

  // 2. Try Google Gemini API if key is present
  if (GEMINI_API_KEY) {
    try {
      return await queryGemini(messages, GEMINI_API_KEY);
    } catch (geminiErr) {
      console.warn('[AI Service] Gemini fallback error:', geminiErr.message);
    }
  }

  // 3. Try Groq API if key is present
  if (GROQ_API_KEY) {
    try {
      return await queryOpenAICompatible(messages, {
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: GROQ_API_KEY,
        model: 'llama-3.3-70b-versatile',
        providerName: 'Groq Cloud'
      });
    } catch (groqErr) {
      console.warn('[AI Service] Groq fallback error:', groqErr.message);
    }
  }

  // 4. Try OpenAI API if key is present
  if (OPENAI_API_KEY) {
    try {
      return await queryOpenAICompatible(messages, {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: OPENAI_API_KEY,
        model: 'gpt-4o-mini',
        providerName: 'OpenAI'
      });
    } catch (openaiErr) {
      console.warn('[AI Service] OpenAI fallback error:', openaiErr.message);
    }
  }

  throw new Error('All external AI providers are offline or not configured.');
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
