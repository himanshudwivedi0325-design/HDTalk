const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

const dataDir = config.DATA_DIR;
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const defaultSchema = {
  users: [],
  conversations: [],
  messages: [],
  connectionRequests: []
};

function readDb() {
  try {
    if (!fs.existsSync(dbFile)) {
      writeDb(defaultSchema);
      return defaultSchema;
    }
    const content = fs.readFileSync(dbFile, 'utf8');
    return JSON.parse(content || '{}');
  } catch (err) {
    console.error('Error reading database file:', err);
    return defaultSchema;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

function seedDefaultUsers() {
  const hash = bcrypt.hashSync('password123', 10);
  const initialUsers = [
    {
      id: 'usr_f5b68402',
      name: 'Himanshu Dwivedi',
      email: 'himanshudwivedi0325@gmail.com',
      password: hash,
      avatar: '',
      profession: 'Founder & Full Stack Architect',
      bio: 'Creator of HDTalk. Building next-gen real-time applications.',
      interests: ['WebRTC', 'React', 'NodeJS', 'System Design'],
      status: 'offline',
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
  ];

  writeDb({
    users: initialUsers,
    conversations: [],
    messages: [],
    connectionRequests: []
  });
  console.log('Database seeded with admin template user.');
}

// Database helper functions
const db = {
  resetDb: () => {
    writeDb({
      users: [],
      conversations: [],
      messages: [],
      connectionRequests: []
    });
    console.log('Database reset to empty production state.');
    return defaultSchema;
  },
  seedDefaultUsers,
  getUsers: () => readDb().users || [],
  getUserById: (id) => (readDb().users || []).find(u => u.id === id),
  getUserByEmail: (email) => {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return (readDb().users || []).find(u => u.email && u.email.trim().toLowerCase() === clean);
  },
  createUser: (userData) => {
    const data = readDb();
    const newUser = {
      id: 'usr_' + uuidv4().slice(0, 8),
      createdAt: new Date().toISOString(),
      status: 'online',
      lastSeen: new Date().toISOString(),
      ...userData
    };
    data.users.push(newUser);
    writeDb(data);
    return newUser;
  },
  updateUser: (id, updates) => {
    const data = readDb();
    const index = data.users.findIndex(u => u.id === id);
    if (index === -1) return null;
    data.users[index] = { ...data.users[index], ...updates };
    writeDb(data);
    return data.users[index];
  },
  getOrCreateBotUser: () => {
    const data = readDb();
    let bot = (data.users || []).find(u => u.id === 'usr_ai_bot');
    if (!bot) {
      bot = {
        id: 'usr_ai_bot',
        name: 'HDTalk AI Assistant 🤖',
        email: 'bot@hdtalk.ai',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=HDTalkBot',
        profession: 'AI Automation Agent (Powered by n8n)',
        bio: 'Official HDTalk AI Companion powered by n8n workflow automations.',
        interests: ['Automation', 'AI', 'Workflow', 'n8n'],
        status: 'online',
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      if (!data.users) data.users = [];
      data.users.push(bot);
      writeDb(data);
    }
    return bot;
  },

  getConversationsForUser: (userId) => {
    const data = readDb();
    return (data.conversations || []).filter(c => c.participants.includes(userId));
  },
  getConversationById: (convId) => {
    return (readDb().conversations || []).find(c => c.id === convId);
  },
  getOrCreateDirectConversation: (userA, userB) => {
    const data = readDb();
    let conv = data.conversations.find(c =>
      c.type === 'direct' &&
      c.participants.includes(userA) &&
      c.participants.includes(userB)
    );
    if (!conv) {
      conv = {
        id: 'conv_' + uuidv4().slice(0, 8),
        type: 'direct',
        participants: [userA, userB],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessage: null
      };
      data.conversations.push(conv);
      writeDb(data);
    }
    return conv;
  },

  getMessages: (conversationId) => {
    const data = readDb();
    return (data.messages || [])
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  },
  createMessage: (messageData) => {
    const data = readDb();
    const newMsg = {
      id: 'msg_' + uuidv4().slice(0, 8),
      timestamp: new Date().toISOString(),
      reactions: {},
      readBy: [messageData.senderId],
      ...messageData
    };
    data.messages.push(newMsg);

    // Update conversation lastMessage
    const convIndex = data.conversations.findIndex(c => c.id === messageData.conversationId);
    if (convIndex !== -1) {
      data.conversations[convIndex].lastMessage = {
        text: newMsg.text || (newMsg.type === 'voice' ? '🎤 Voice message' : '📎 Attachment'),
        senderId: newMsg.senderId,
        timestamp: newMsg.timestamp
      };
      data.conversations[convIndex].updatedAt = newMsg.timestamp;
    }

    writeDb(data);
    return newMsg;
  },
  addReaction: (messageId, emoji, userId) => {
    const data = readDb();
    const msg = data.messages.find(m => m.id === messageId);
    if (!msg) return null;
    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    
    // Toggle reaction
    if (msg.reactions[emoji].includes(userId)) {
      msg.reactions[emoji] = msg.reactions[emoji].filter(u => u !== userId);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji].push(userId);
    }
    writeDb(data);
    return msg;
  },
  markAsRead: (conversationId, userId) => {
    const data = readDb();
    let updated = false;
    data.messages.forEach(m => {
      if (m.conversationId === conversationId && !m.readBy.includes(userId)) {
        m.readBy.push(userId);
        updated = true;
      }
    });
    if (updated) writeDb(data);
  },

  // Connection Requests
  getConnectionRequests: (userId) => {
    const data = readDb();
    return (data.connectionRequests || []).filter(r => r.toUserId === userId || r.fromUserId === userId);
  },
  sendConnectionRequest: (fromUserId, toUserId, note = '') => {
    const data = readDb();
    const existing = data.connectionRequests.find(r =>
      (r.fromUserId === fromUserId && r.toUserId === toUserId) ||
      (r.fromUserId === toUserId && r.toUserId === fromUserId)
    );
    if (existing) return existing;
    const req = {
      id: 'req_' + uuidv4().slice(0, 8),
      fromUserId,
      toUserId,
      note,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    data.connectionRequests.push(req);
    writeDb(data);
    return req;
  },
  updateConnectionRequest: (requestId, status) => {
    const data = readDb();
    const req = data.connectionRequests.find(r => r.id === requestId);
    if (!req) return null;
    req.status = status;
    writeDb(data);
    return req;
  }
};

// Initial read/seed check on require
readDb();

module.exports = db;
