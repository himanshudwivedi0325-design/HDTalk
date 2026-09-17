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

const TEST_USER_EMAILS = [
  'alice.sterling@demo.hdtalk.local',
  'bob.vance@demo.hdtalk.local',
  'himanshu.test99@gmail.com'
];
const TEST_USER_IDS = ['usr_demo_alice', 'usr_demo_bob', 'usr_97d33ffd'];

function isTestUser(u) {
  if (!u) return false;
  const email = (u.email || '').toLowerCase().trim();
  const id = u.id || u._id || '';
  if (id === 'usr_ai_bot' || email === 'bot@hdtalk.ai') return false;
  if (TEST_USER_EMAILS.includes(email)) return true;
  if (TEST_USER_IDS.includes(id)) return true;
  if (id.startsWith('usr_demo_')) return true;
  return false;
}

function normalizeSchema(data) {
  const users = (Array.isArray(data.users) ? data.users : []).filter(u => !isTestUser(u));
  const validUserIds = users.map(u => u.id || u._id);
  return {
    users,
    conversations: (Array.isArray(data.conversations) ? data.conversations : []).filter(c => 
      c.participants && c.participants.every(p => validUserIds.includes(p))
    ),
    messages: (Array.isArray(data.messages) ? data.messages : []).filter(m => 
      validUserIds.includes(m.senderId)
    ),
    connectionRequests: (Array.isArray(data.connectionRequests) ? data.connectionRequests : []).filter(r => 
      validUserIds.includes(r.fromUserId) && validUserIds.includes(r.toUserId)
    ),
    pushSubscriptions: (Array.isArray(data.pushSubscriptions) ? data.pushSubscriptions : []).filter(s => 
      validUserIds.includes(s.userId)
    )
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
      // Clean bidirectional merge to ensure zero in-flight data loss (excluding test users)
      const mergedUsers = [...(hydrated.users || [])].filter(u => !isTestUser(u));
      for (const u of (memoryState.users || [])) {
        if (!isTestUser(u) && !mergedUsers.some(m => m.id === u.id || (m.email && u.email && m.email.toLowerCase() === u.email.toLowerCase()))) {
          mergedUsers.push(u);
          mongoAdapter.persistUpsert('users', u);
        }
      }

      const mergedConversations = [...(hydrated.conversations || [])];
      for (const c of (memoryState.conversations || [])) {
        if (!mergedConversations.some(m => m.id === c.id)) {
          mergedConversations.push(c);
          mongoAdapter.persistUpsert('conversations', c);
        }
      }

      const mergedMessages = [...(hydrated.messages || [])];
      for (const m of (memoryState.messages || [])) {
        if (!mergedMessages.some(x => x.id === m.id)) {
          mergedMessages.push(m);
          mongoAdapter.persistUpsert('messages', m);
        }
      }

      const mergedRequests = [...(hydrated.connectionRequests || [])];
      for (const r of (memoryState.connectionRequests || [])) {
        if (!mergedRequests.some(x => x.id === r.id)) {
          mergedRequests.push(r);
          mongoAdapter.persistUpsert('connectionRequests', r);
        }
      }

      const mergedSubs = [...(hydrated.pushSubscriptions || [])];
      for (const s of (memoryState.pushSubscriptions || [])) {
        if (!mergedSubs.some(x => x.id === s.id)) {
          mergedSubs.push(s);
          mongoAdapter.persistUpsert('pushSubscriptions', s);
        }
      }

      memoryState = {
        users: mergedUsers,
        conversations: mergedConversations,
        messages: mergedMessages,
        connectionRequests: mergedRequests,
        pushSubscriptions: mergedSubs
      };

      flushSync();
      console.log(`[DB] Database synchronized & merged with hosted MongoDB Atlas cluster (${mergedUsers.length} users).`);
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

  // Debounced non-blocking flush to prevent disk I/O thrashing
  flushTimer = setTimeout(() => {
    flushTimer = null;
    executeFlushAsync();
  }, 500);
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
      // Note: Fine-grained atomic writes (persistUpsert/persistDelete) are executed directly
      // on each database operation, eliminating O(N) fullSyncToMongo network bottlenecks.
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

// Note: Graceful shutdown (flush on SIGTERM/SIGINT) is handled centrally in server.js.
// server.js calls db.flushSync() before closing the HTTP server, ensuring a safe, ordered shutdown.


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

  getUsers: () => (memoryState.users || []).filter(u => !isTestUser(u) && u.id !== 'usr_ai_bot'),

  getUserById: (id) => {
    return (memoryState.users || []).find(x => x.id === id) || null;
  },

  getUserByEmail: (email) => {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return (memoryState.users || []).find(x => x.email && x.email.trim().toLowerCase() === clean) || null;
  },

  getOrCreateBotUser: () => {
    let bot = (memoryState.users || []).find(u => u.id === 'usr_ai_bot');
    if (!bot) {
      bot = {
        id: 'usr_ai_bot',
        name: 'HDTalk AI Assistant',
        email: 'bot@hdtalk.ai',
        avatar: '',
        profession: 'AI Workflow Assistant',
        bio: 'Official HDTalk AI Workflow & Automation Agent powered by n8n.',
        interests: ['Automation', 'AI', 'System Design', 'WebRTC'],
        role: 'bot',
        status: 'online',
        lastSeen: new Date().toISOString(),
        createdAt: '2026-09-14T00:00:00.000Z'
      };
      memoryState.users.push(bot);
      mongoAdapter.persistUpsert('users', bot);
      flushSync();
    }
    return bot;
  },

  createUser: (userData = {}) => {
    // Mass-assignment defense: Allowlist only safe user-controllable profile fields
    const safeData = {
      name: typeof userData.name === 'string' ? userData.name.trim() : 'User',
      email: typeof userData.email === 'string' ? userData.email.trim().toLowerCase() : '',
      password: userData.password,
      avatar: typeof userData.avatar === 'string' ? userData.avatar : '',
      profession: typeof userData.profession === 'string' ? userData.profession.trim() : 'Professional',
      bio: typeof userData.bio === 'string' ? userData.bio.trim() : '',
      interests: Array.isArray(userData.interests) ? userData.interests : []
    };

    // Role cannot be assigned via request body. Creator emails become admin, otherwise default 'user'
    const isCreator = safeData.email === 'shikhar@gmail.com' || safeData.email === 'himanshudwivedi0325@gmail.com';
    const role = isCreator ? 'admin' : (userData._forceRole || 'user');

    const newUser = {
      id: (userData._forceId && typeof userData._forceId === 'string') ? userData._forceId : ('usr_' + uuidv4().slice(0, 8)),
      ...safeData,
      role,
      isBanned: false,
      status: 'online',
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    memoryState.users.push(newUser);
    mongoAdapter.persistUpsert('users', newUser);
    flushSync();
    return newUser;
  },

  updateUser: (id, updates = {}) => {
    const index = memoryState.users.findIndex(u => u.id === id);
    if (index === -1) return null;

    // Mass-assignment defense: Never allow overwriting immutable identifiers
    const safeUpdates = { ...updates };
    delete safeUpdates.id;
    delete safeUpdates._id;
    delete safeUpdates.createdAt;

    memoryState.users[index] = { ...memoryState.users[index], ...safeUpdates };
    mongoAdapter.persistUpsert('users', memoryState.users[index]);
    flushSync();
    return memoryState.users[index];
  },

  deleteUser: (id) => {
    const userIndex = (memoryState.users || []).findIndex(u => u.id === id);
    if (userIndex === -1) return false;

    // 1. Remove user from users
    memoryState.users.splice(userIndex, 1);
    mongoAdapter.persistDelete('users', id);

    // 2. Find all conversations where this user is a participant
    const affectedConvs = (memoryState.conversations || []).filter(c => c.participants && c.participants.includes(id));
    const affectedConvIds = affectedConvs.map(c => c.id);

    // Remove these conversations
    memoryState.conversations = (memoryState.conversations || []).filter(c => !affectedConvIds.includes(c.id));
    affectedConvIds.forEach(cId => mongoAdapter.persistDelete('conversations', cId));

    // 3. Remove all messages in these conversations or sent by this user
    memoryState.messages = (memoryState.messages || []).filter(m => !affectedConvIds.includes(m.conversationId) && m.senderId !== id);
    if (affectedConvIds.length > 0) {
      mongoAdapter.persistDeleteMany('messages', { conversationId: { $in: affectedConvIds } });
    }
    mongoAdapter.persistDeleteMany('messages', { senderId: id });

    // 4. Remove connection requests
    memoryState.connectionRequests = (memoryState.connectionRequests || []).filter(r => r.fromUserId !== id && r.toUserId !== id);
    mongoAdapter.persistDeleteMany('connectionRequests', { $or: [{ fromUserId: id }, { toUserId: id }] });

    // 5. Remove push subscriptions
    memoryState.pushSubscriptions = (memoryState.pushSubscriptions || []).filter(s => s.userId !== id);
    mongoAdapter.persistDeleteMany('pushSubscriptions', { userId: id });

    flushSync();
    return true;
  },

  getSystemStats: () => {
    const totalUsers = (memoryState.users || []).length;
    const onlineUsers = (memoryState.users || []).filter(u => u.status === 'online').length;
    const bannedUsers = (memoryState.users || []).filter(u => u.isBanned === true).length;
    const adminUsers = (memoryState.users || []).filter(u => u.role === 'admin' || u.email === 'shikhar@gmail.com' || u.email === 'himanshudwivedi0325@gmail.com').length;
    const totalConversations = (memoryState.conversations || []).length;
    const totalMessages = (memoryState.messages || []).length;

    return {
      totalUsers,
      onlineUsers,
      bannedUsers,
      adminUsers,
      totalConversations,
      totalMessages,
      serverUptime: process.uptime()
    };
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
      mongoAdapter.persistUpsert('conversations', conv);
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

  getMessageById: (id) => {
    const found = (memoryState.messages || []).find(m => m.id === id);
    return found ? enrichMessage(found) : null;
  },

  createMessage: (messageData = {}) => {
    const newMsg = {
      id: 'msg_' + uuidv4().slice(0, 8),
      conversationId: messageData.conversationId,
      senderId: messageData.senderId,
      text: typeof messageData.text === 'string' ? messageData.text : '',
      type: messageData.type || 'text',
      mediaUrl: messageData.mediaUrl || null,
      fileName: messageData.fileName || null,
      fileSize: messageData.fileSize || null,
      replyToId: messageData.replyToId || null,
      timestamp: new Date().toISOString(),
      reactions: {},
      readBy: [messageData.senderId],
      deliveredTo: Array.isArray(messageData.deliveredTo) ? messageData.deliveredTo : [],
      status: messageData.status || 'sent'
    };
    memoryState.messages.push(newMsg);
    mongoAdapter.persistUpsert('messages', newMsg);

    const convIndex = memoryState.conversations.findIndex(c => c.id === messageData.conversationId);
    if (convIndex !== -1) {
      memoryState.conversations[convIndex].lastMessage = {
        text: newMsg.text || (newMsg.type === 'voice' ? '🎤 Voice message' : '📎 Attachment'),
        senderId: newMsg.senderId,
        timestamp: newMsg.timestamp
      };
      memoryState.conversations[convIndex].updatedAt = newMsg.timestamp;
      mongoAdapter.persistUpsert('conversations', memoryState.conversations[convIndex]);
    }

    scheduleFlush();
    return enrichMessage(newMsg);
  },

  addReaction: (messageId, emoji, userId) => {
    const msg = memoryState.messages.find(m => m.id === messageId);
    if (!msg) return null;

    if (userId) {
      const conv = memoryState.conversations.find(c => c.id === msg.conversationId);
      if (conv && Array.isArray(conv.participants) && !conv.participants.includes(userId)) {
        return null;
      }
    }

    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

    if (msg.reactions[emoji].includes(userId)) {
      msg.reactions[emoji] = msg.reactions[emoji].filter(u => u !== userId);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji].push(userId);
    }
    mongoAdapter.persistUpsert('messages', msg);
    scheduleFlush();
    return msg;
  },

  markAsDelivered: (messageId, userId) => {
    const msg = memoryState.messages.find(m => m.id === messageId);
    if (!msg) return null;

    if (userId) {
      const conv = memoryState.conversations.find(c => c.id === msg.conversationId);
      if (conv && Array.isArray(conv.participants) && !conv.participants.includes(userId)) {
        return null;
      }
    }

    if (!msg.deliveredTo) msg.deliveredTo = [];
    if (!msg.deliveredTo.includes(userId)) {
      msg.deliveredTo.push(userId);
    }
    if (msg.status !== 'read') {
      msg.status = 'delivered';
    }
    mongoAdapter.persistUpsert('messages', msg);
    scheduleFlush();
    return msg;
  },

  markConversationDeliveredForUser: (userId) => {
    const updatedMessages = [];
    const userConvs = (memoryState.conversations || []).filter(c => c.participants && c.participants.includes(userId));
    const convIds = new Set(userConvs.map(c => c.id));

    (memoryState.messages || []).forEach(m => {
      if (convIds.has(m.conversationId) && m.senderId !== userId) {
        if (!m.deliveredTo) m.deliveredTo = [];
        if (!m.deliveredTo.includes(userId)) {
          m.deliveredTo.push(userId);
          if (m.status !== 'read') {
            m.status = 'delivered';
          }
          updatedMessages.push(m);
        }
      }
    });

    if (updatedMessages.length > 0) {
      mongoAdapter.persistUpsertMany('messages', updatedMessages);
      scheduleFlush();
    }
    return updatedMessages;
  },

  markAsRead: (conversationId, userId) => {
    const conv = (memoryState.conversations || []).find(c => c.id === conversationId);
    if (!conv || !Array.isArray(conv.participants) || !conv.participants.includes(userId)) {
      return [];
    }

    let updated = false;
    const readMessageIds = [];
    const updatedMessages = [];
    memoryState.messages.forEach(m => {
      if (m.conversationId === conversationId && (!m.readBy || !m.readBy.includes(userId))) {
        if (!m.readBy) m.readBy = [];
        m.readBy.push(userId);
        if (!m.deliveredTo) m.deliveredTo = [];
        if (!m.deliveredTo.includes(userId)) m.deliveredTo.push(userId);
        m.status = 'read';
        readMessageIds.push(m.id);
        updatedMessages.push(m);
        updated = true;
      }
    });
    if (updated) {
      mongoAdapter.persistUpsertMany('messages', updatedMessages);
      scheduleFlush();
    }
    return readMessageIds;
  },

  deleteConversation: (conversationId, userId, alsoRemoveFriend = false) => {
    if (!conversationId || !userId) return null;
    const convIndex = (memoryState.conversations || []).findIndex(c => c.id === conversationId);
    if (convIndex === -1) return null;

    const conv = memoryState.conversations[convIndex];
    const participants = conv.participants || [];
    if (!participants.includes(userId)) {
      return null;
    }
    const otherUserId = participants.find(p => p !== userId);

    // 1. Remove conversation from memory & mongo
    memoryState.conversations.splice(convIndex, 1);
    mongoAdapter.persistDelete('conversations', { id: conversationId });

    // 2. Delete all messages of this conversation atomically
    memoryState.messages = (memoryState.messages || []).filter(m => m.conversationId !== conversationId);
    mongoAdapter.persistDeleteMany('messages', { conversationId });

    // 3. Remove friend relationship if requested
    if (alsoRemoveFriend && otherUserId) {
      memoryState.connectionRequests = (memoryState.connectionRequests || []).filter(r => {
        const match = (r.fromUserId === userId && r.toUserId === otherUserId) ||
                      (r.fromUserId === otherUserId && r.toUserId === userId);
        if (match) {
          mongoAdapter.persistDelete('connectionRequests', { id: r.id });
          return false;
        }
        return true;
      });
    }

    scheduleFlush();
    return { conversationId, otherUserId, alsoRemoveFriend };
  },

  removeFriend: (userId, friendId) => {
    let removed = false;
    memoryState.connectionRequests = (memoryState.connectionRequests || []).filter(r => {
      const match = (r.fromUserId === userId && r.toUserId === friendId) ||
                    (r.fromUserId === friendId && r.toUserId === userId);
      if (match) {
        mongoAdapter.persistDelete('connectionRequests', { id: r.id });
        removed = true;
        return false;
      }
      return true;
    });
    if (removed) scheduleFlush();
    return removed;
  },

  deleteMessage: (messageId, userId, deleteForEveryone = true) => {
    const msg = memoryState.messages.find(m => m.id === messageId);
    if (!msg) return null;

    const conv = memoryState.conversations.find(c => c.id === msg.conversationId);
    if (!conv || !Array.isArray(conv.participants) || !conv.participants.includes(userId)) {
      return { error: 'You are not a participant in this conversation.' };
    }

    if (deleteForEveryone) {
      if (msg.senderId !== userId) {
        return { error: 'Only the sender can delete this message for everyone.' };
      }
      msg.isDeleted = true;
      msg.text = 'This message was deleted';
      msg.mediaUrl = null;
      msg.fileName = null;
      msg.reactions = {};

      mongoAdapter.persistUpsert('messages', msg);

      // Update conversation preview if needed
      if (conv && conv.lastMessage && conv.lastMessage.timestamp === msg.timestamp) {
        conv.lastMessage.text = '🚫 This message was deleted';
        mongoAdapter.persistUpsert('conversations', conv);
      }
      scheduleFlush();
      return { message: msg, deleteForEveryone: true };
    } else {
      // Delete for me
      if (!msg.deletedFor) msg.deletedFor = [];
      if (!msg.deletedFor.includes(userId)) {
        msg.deletedFor.push(userId);
      }
      mongoAdapter.persistUpsert('messages', msg);
      scheduleFlush();
      return { message: msg, deleteForEveryone: false };
    }
  },

  editMessage: (messageId, userId, newText) => {
    const msg = memoryState.messages.find(m => m.id === messageId);
    if (!msg) return { error: 'Message not found' };

    const conv = memoryState.conversations.find(c => c.id === msg.conversationId);
    if (!conv || !Array.isArray(conv.participants) || !conv.participants.includes(userId)) {
      return { error: 'You are not a participant in this conversation.' };
    }

    if (msg.senderId !== userId) return { error: 'Only the sender can edit this message.' };
    if (msg.isDeleted) return { error: 'Cannot edit a deleted message.' };
    if (msg.type !== 'text') return { error: 'Only text messages can be edited.' };

    const trimmed = (newText || '').trim();
    if (!trimmed) return { error: 'Message text cannot be empty.' };

    msg.text = trimmed;
    msg.isEdited = true;
    msg.editedAt = new Date().toISOString();

    mongoAdapter.persistUpsert('messages', msg);

    // Update conversation lastMessage preview if this was the last message
    if (conv && conv.lastMessage && conv.lastMessage.timestamp === msg.timestamp) {
      conv.lastMessage.text = trimmed;
      mongoAdapter.persistUpsert('conversations', conv);
    }

    scheduleFlush();
    return { success: true, message: enrichMessage(msg) };
  },

  getConnectionRequests: (userId) => {
    return (memoryState.connectionRequests || []).filter(r => r.toUserId === userId || r.fromUserId === userId);
  },

  getConnectionRequestById: (requestId) => {
    return (memoryState.connectionRequests || []).find(r => r.id === requestId) || null;
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
    mongoAdapter.persistUpsert('connectionRequests', req);
    scheduleFlush();
    return req;
  },

  updateConnectionRequest: (requestId, status, userId = null) => {
    const req = memoryState.connectionRequests.find(r => r.id === requestId);
    if (!req) return null;
    if (userId && req.toUserId !== userId) {
      return null;
    }
    req.status = status;
    req.updatedAt = new Date().toISOString();
    mongoAdapter.persistUpsert('connectionRequests', req);
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
    mongoAdapter.persistUpsert('pushSubscriptions', record);
    scheduleFlush();
    return record;
  },

  removePushSubscription: (endpoint, userId = null) => {
    if (!memoryState.pushSubscriptions) return false;
    if (!endpoint || typeof endpoint !== 'string') return false;
    const cleanEndpoint = String(endpoint).trim();
    const cleanUserId = userId ? String(userId) : null;

    const initialLen = memoryState.pushSubscriptions.length;
    memoryState.pushSubscriptions = memoryState.pushSubscriptions.filter(
      s => !(s.subscription?.endpoint === cleanEndpoint && (!cleanUserId || s.userId === cleanUserId))
    );
    if (memoryState.pushSubscriptions.length !== initialLen) {
      const deleteQuery = { 'subscription.endpoint': cleanEndpoint };
      if (cleanUserId) deleteQuery.userId = cleanUserId;
      mongoAdapter.persistDelete('pushSubscriptions', deleteQuery);
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
