const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

const dataDir = config.DATA_DIR;
const dbFile = path.join(dataDir, 'db.json');
const backupFile = path.join(dataDir, 'db.backup.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const defaultSchema = {
  users: [],
  conversations: [],
  messages: [],
  connectionRequests: [],
  pushSubscriptions: []
};

function isValidSchema(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.users) &&
    Array.isArray(data.conversations) &&
    Array.isArray(data.messages) &&
    Array.isArray(data.connectionRequests)
  );
}

function normalizeSchema(data) {
  return {
    users: Array.isArray(data.users) ? data.users : [],
    conversations: Array.isArray(data.conversations) ? data.conversations : [],
    messages: Array.isArray(data.messages) ? data.messages : [],
    connectionRequests: Array.isArray(data.connectionRequests) ? data.connectionRequests : [],
    pushSubscriptions: Array.isArray(data.pushSubscriptions) ? data.pushSubscriptions : []
  };
}

/**
 * Cross-platform Atomic File Write:
 * Writes to a unique temp file in the same directory, syncs to disk (fsync),
 * then atomically renames the temp file over targetPath.
 */
function atomicWriteFile(targetPath, contentString) {
  const dir = path.dirname(targetPath);
  const tempPath = path.join(dir, '.tmp_' + path.basename(targetPath) + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));

  try {
    const fd = fs.openSync(tempPath, 'w');
    fs.writeSync(fd, contentString, 0, 'utf8');
    try {
      fs.fsyncSync(fd);
    } catch (_) {}
    fs.closeSync(fd);

    let attempts = 0;
    while (attempts < 5) {
      try {
        fs.renameSync(tempPath, targetPath);
        return;
      } catch (renameErr) {
        attempts++;
        if (attempts >= 5) {
          fs.copyFileSync(tempPath, targetPath);
          try { fs.unlinkSync(tempPath); } catch (_) {}
          return;
        }
        const start = Date.now();
        while (Date.now() - start < 5) {}
      }
    }
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (_) {}
    throw err;
  }
}

/**
 * Startup Integrity Validation & Self-Healing:
 * Loads db.json. If corrupted or truncated, automatically recovers from db.backup.json.
 */
function loadDatabase() {
  if (fs.existsSync(dbFile)) {
    try {
      const raw = fs.readFileSync(dbFile, 'utf8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        if (isValidSchema(parsed)) {
          try {
            atomicWriteFile(backupFile, raw);
          } catch (_) {}
          return normalizeSchema(parsed);
        }
      }
      console.warn('[DB] Warning: db.json was empty or invalid schema. Checking backup...');
    } catch (err) {
      console.error('[DB] SyntaxError or ReadError in db.json:', err.message);
    }
  }

  // Attempt recovery from backup
  if (fs.existsSync(backupFile)) {
    try {
      console.log('[DB] Attempting automatic recovery from db.backup.json...');
      const rawBackup = fs.readFileSync(backupFile, 'utf8');
      if (rawBackup && rawBackup.trim().length > 0) {
        const parsed = JSON.parse(rawBackup);
        if (isValidSchema(parsed)) {
          if (fs.existsSync(dbFile)) {
            const corruptArchive = path.join(dataDir, 'db.corrupted.' + Date.now() + '.json');
            try { fs.copyFileSync(dbFile, corruptArchive); } catch (_) {}
          }
          atomicWriteFile(dbFile, rawBackup);
          console.log('[DB] SUCCESS: Self-healed and successfully restored database from db.backup.json!');
          return normalizeSchema(parsed);
        }
      }
    } catch (bErr) {
      console.error('[DB] Failed reading backup file:', bErr.message);
    }
  }

  console.log('[DB] Initializing fresh production database schema.');
  const initial = { ...defaultSchema };
  try {
    const raw = JSON.stringify(initial, null, 2);
    atomicWriteFile(dbFile, raw);
    atomicWriteFile(backupFile, raw);
  } catch (err) {
    console.error('[DB] Error initializing db files:', err);
  }
  return initial;
}

// IN-MEMORY DOCUMENT STORE
let memoryState = loadDatabase();

// MONGODB ATLAS HOSTED DATABASE INTEGRATION (WRITE-THROUGH CACHE)
const mongoAdapter = require('./mongoAdapter');
if (mongoAdapter.isConfigured()) {
  mongoAdapter.initMongo(memoryState).then(hydrated => {
    if (hydrated) {
      memoryState = hydrated;
      console.log('[DB] Database synchronized with hosted MongoDB Atlas cluster.');
    }
  }).catch(err => {
    console.warn('[DB] MongoDB initialization warning:', err.message);
  });
}

// SERIALIZED WRITE FLUSH CONTROLLER
let isFlushing = false;
let flushPending = false;
let flushTimer = null;
let isDirty = false;

function scheduleFlush() {
  isDirty = true;
  if (flushTimer) return;

  flushTimer = setTimeout(() => {
    flushTimer = null;
    executeFlushAsync();
  }, 25);
}

function executeFlushAsync() {
  if (isFlushing) {
    flushPending = true;
    return;
  }
  if (!isDirty) return;

  isFlushing = true;
  flushPending = false;

  const snapshot = JSON.stringify(memoryState, null, 2);
  isDirty = false;

  setImmediate(() => {
    try {
      atomicWriteFile(dbFile, snapshot);
      atomicWriteFile(backupFile, snapshot);
      if (mongoAdapter.isConnected()) {
        mongoAdapter.fullSyncToMongo(memoryState).catch(() => {});
      }
    } catch (err) {
      console.error('[DB] Error during async flush:', err);
      isDirty = true;
    } finally {
      isFlushing = false;
      if (flushPending || isDirty) {
        scheduleFlush();
      }
    }
  });
}

function flushSync() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  try {
    const snapshot = JSON.stringify(memoryState, null, 2);
    atomicWriteFile(dbFile, snapshot);
    atomicWriteFile(backupFile, snapshot);
    if (mongoAdapter.isConnected()) {
      mongoAdapter.fullSyncToMongo(memoryState).catch(() => {});
    }
    isDirty = false;
  } catch (err) {
    console.error('[DB] Error during flushSync:', err);
  }
}

// Process lifecycle hooks for graceful shutdown
process.on('SIGTERM', () => {
  try { flushSync(); } catch (_) {}
});
process.on('SIGINT', () => {
  try { flushSync(); } catch (_) {}
});
process.on('beforeExit', () => {
  try { flushSync(); } catch (_) {}
});

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

  memoryState = {
    users: initialUsers,
    conversations: [],
    messages: [],
    connectionRequests: []
  };
  flushSync();
  console.log('Database seeded with admin template user.');
}

function enrichMessage(m) {
  if (!m) return m;
  if (!m.replyToId) return m;
  const orig = (memoryState.messages || []).find(o => o.id === m.replyToId);
  if (!orig) return m;
  const origSender = (memoryState.users || []).find(u => u.id === orig.senderId);
  return {
    ...m,
    replyTo: {
      id: orig.id,
      senderId: orig.senderId,
      senderName: origSender ? origSender.name : 'User',
      text: orig.isDeleted ? 'This message was deleted' : (orig.text || (orig.type === 'voice' ? '🎤 Voice note' : '📎 Attachment')),
      type: orig.type,
      mediaUrl: orig.isDeleted ? null : orig.mediaUrl,
      isDeleted: orig.isDeleted || false
    }
  };
}

// DATABASE API (100% Backward-Compatible)
const db = {
  resetDb: () => {
    memoryState = {
      users: [],
      conversations: [],
      messages: [],
      connectionRequests: []
    };
    flushSync();
    console.log('Database reset to empty production state.');
    return defaultSchema;
  },

  seedDefaultUsers,

  getUsers: () => [...(memoryState.users || [])],

  getUserById: (id) => {
    let u = (memoryState.users || []).find(x => x.id === id);
    if (!u) {
      try {
        const diskData = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        if (Array.isArray(diskData.users)) {
          u = diskData.users.find(x => x.id === id);
          if (u) memoryState.users.push(u);
        }
      } catch (_) {}
    }
    return u;
  },

  getUserByEmail: (email) => {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    let u = (memoryState.users || []).find(x => x.email && x.email.trim().toLowerCase() === clean);
    if (!u) {
      try {
        const diskData = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        if (Array.isArray(diskData.users)) {
          u = diskData.users.find(x => x.email && x.email.trim().toLowerCase() === clean);
          if (u) memoryState.users.push(u);
        }
      } catch (_) {}
    }
    return u;
  },

  createUser: (userData) => {
    const newUser = {
      id: 'usr_' + uuidv4().slice(0, 8),
      createdAt: new Date().toISOString(),
      status: 'online',
      lastSeen: new Date().toISOString(),
      ...userData
    };
    memoryState.users.push(newUser);
    scheduleFlush();
    return newUser;
  },

  updateUser: (id, updates) => {
    const index = memoryState.users.findIndex(u => u.id === id);
    if (index === -1) return null;
    memoryState.users[index] = { ...memoryState.users[index], ...updates };
    scheduleFlush();
    return memoryState.users[index];
  },

  getOrCreateBotUser: () => {
    let bot = (memoryState.users || []).find(u => u.id === 'usr_ai_bot');
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
      memoryState.users.push(bot);
      scheduleFlush();
    }
    return bot;
  },

  getConversationsForUser: (userId) => {
    return (memoryState.conversations || []).filter(c => c.participants && c.participants.includes(userId));
  },

  getConversationById: (convId) => {
    return (memoryState.conversations || []).find(c => c.id === convId);
  },

  getOrCreateDirectConversation: (userA, userB) => {
    let conv = memoryState.conversations.find(c =>
      c.type === 'direct' &&
      c.participants &&
      c.participants.includes(userA) &&
      c.participants.includes(userB)
    );

    const req = (memoryState.connectionRequests || []).find(r =>
      (r.fromUserId === userA && r.toUserId === userB) ||
      (r.fromUserId === userB && r.toUserId === userA)
    );

    const isPending = req ? req.status === 'pending' : false;
    const requestedBy = req ? req.fromUserId : null;

    if (!conv) {
      conv = {
        id: 'conv_' + uuidv4().slice(0, 8),
        type: 'direct',
        participants: [userA, userB],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessage: null,
        isPending,
        requestedBy
      };
      memoryState.conversations.push(conv);
      scheduleFlush();
    } else {
      conv.isPending = isPending;
      conv.requestedBy = requestedBy;
    }
    return conv;
  },

  getMessages: (conversationId, userId) => {
    return (memoryState.messages || [])
      .filter(m => m.conversationId === conversationId && (!userId || !m.deletedFor || !m.deletedFor.includes(userId)))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(m => enrichMessage(m));
  },

  createMessage: (messageData) => {
    const newMsg = {
      id: 'msg_' + uuidv4().slice(0, 8),
      timestamp: new Date().toISOString(),
      reactions: {},
      readBy: [messageData.senderId],
      ...messageData
    };
    memoryState.messages.push(newMsg);

    const convIndex = memoryState.conversations.findIndex(c => c.id === messageData.conversationId);
    if (convIndex !== -1) {
      memoryState.conversations[convIndex].lastMessage = {
        text: newMsg.text || (newMsg.type === 'voice' ? '🎤 Voice message' : '📎 Attachment'),
        senderId: newMsg.senderId,
        timestamp: newMsg.timestamp
      };
      memoryState.conversations[convIndex].updatedAt = newMsg.timestamp;
    }

    scheduleFlush();
    return enrichMessage(newMsg);
  },

  addReaction: (messageId, emoji, userId) => {
    const msg = memoryState.messages.find(m => m.id === messageId);
    if (!msg) return null;
    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

    if (msg.reactions[emoji].includes(userId)) {
      msg.reactions[emoji] = msg.reactions[emoji].filter(u => u !== userId);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji].push(userId);
    }
    scheduleFlush();
    return msg;
  },

  markAsRead: (conversationId, userId) => {
    let updated = false;
    memoryState.messages.forEach(m => {
      if (m.conversationId === conversationId && (!m.readBy || !m.readBy.includes(userId))) {
        if (!m.readBy) m.readBy = [];
        m.readBy.push(userId);
        updated = true;
      }
    });
    if (updated) scheduleFlush();
  },

  deleteMessage: (messageId, userId, deleteForEveryone = true) => {
    const msg = memoryState.messages.find(m => m.id === messageId);
    if (!msg) return null;

    if (deleteForEveryone) {
      if (msg.senderId !== userId) {
        return { error: 'Only the sender can delete this message for everyone.' };
      }
      msg.isDeleted = true;
      msg.text = 'This message was deleted';
      msg.mediaUrl = null;
      msg.fileName = null;
      msg.reactions = {};

      // Update conversation preview if needed
      const conv = memoryState.conversations.find(c => c.id === msg.conversationId);
      if (conv && conv.lastMessage && conv.lastMessage.timestamp === msg.timestamp) {
        conv.lastMessage.text = '🚫 This message was deleted';
      }
      scheduleFlush();
      return { message: msg, deleteForEveryone: true };
    } else {
      // Delete for me
      if (!msg.deletedFor) msg.deletedFor = [];
      if (!msg.deletedFor.includes(userId)) {
        msg.deletedFor.push(userId);
      }
      scheduleFlush();
      return { message: msg, deleteForEveryone: false };
    }
  },

  getConnectionRequests: (userId) => {
    return (memoryState.connectionRequests || []).filter(r => r.toUserId === userId || r.fromUserId === userId);
  },

  sendConnectionRequest: (fromUserId, toUserId, note = '') => {
    const existing = memoryState.connectionRequests.find(r =>
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
    memoryState.connectionRequests.push(req);
    scheduleFlush();
    return req;
  },

  updateConnectionRequest: (requestId, status) => {
    const req = memoryState.connectionRequests.find(r => r.id === requestId);
    if (!req) return null;
    req.status = status;
    req.updatedAt = new Date().toISOString();
    scheduleFlush();
    return req;
  },

  // Push Notification Subscriptions
  savePushSubscription: (userId, subscription, userAgent = '') => {
    if (!memoryState.pushSubscriptions) {
      memoryState.pushSubscriptions = [];
    }
    if (!subscription || !subscription.endpoint) return null;

    const existingIndex = memoryState.pushSubscriptions.findIndex(
      s => s.subscription?.endpoint === subscription.endpoint
    );
    const record = {
      id: 'sub_' + uuidv4().slice(0, 8),
      userId,
      subscription,
      userAgent: (userAgent || '').slice(0, 200),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      memoryState.pushSubscriptions[existingIndex] = record;
    } else {
      memoryState.pushSubscriptions.push(record);
    }
    scheduleFlush();
    return record;
  },

  removePushSubscription: (endpoint) => {
    if (!memoryState.pushSubscriptions) return false;
    const initialLen = memoryState.pushSubscriptions.length;
    memoryState.pushSubscriptions = memoryState.pushSubscriptions.filter(
      s => s.subscription?.endpoint !== endpoint
    );
    if (memoryState.pushSubscriptions.length !== initialLen) {
      scheduleFlush();
      return true;
    }
    return false;
  },

  getPushSubscriptionsForUser: (userId) => {
    if (!memoryState.pushSubscriptions) return [];
    return memoryState.pushSubscriptions.filter(s => s.userId === userId);
  },

  // Reliability & Persistence Lifecycle Utilities
  flushSync,
  getDb: () => memoryState,
  getDbStats: () => ({
    usersCount: (memoryState.users || []).length,
    conversationsCount: (memoryState.conversations || []).length,
    messagesCount: (memoryState.messages || []).length,
    connectionRequestsCount: (memoryState.connectionRequests || []).length,
    pushSubscriptionsCount: (memoryState.pushSubscriptions || []).length,
    databaseEngine: mongoAdapter.getMongoStatus().engine,
    mongoStatus: mongoAdapter.getMongoStatus(),
    isDirty
  }),
  reloadFromDisk: () => {
    memoryState = loadDatabase();
    return memoryState;
  }
};

module.exports = db;
