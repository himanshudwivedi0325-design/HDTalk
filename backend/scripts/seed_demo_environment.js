// ==============================================================================
// HDTalk v1.1.0-RC1 — Production Demo Environment Seed Script
// Author: Himanshu Dwivedi
// ==============================================================================

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('../src/database/db');
const config = require('../src/config/config');

// Safe, non-production demo password configuration
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'DemoUser2026!';

function seedDemoEnvironment() {
  console.log('================================================================');
  console.log('⚡ HDTALK v1.1.0-RC1 — DEMO ENVIRONMENT INITIALIZATION');
  console.log('================================================================\n');

  // 1. Reset Database to Clean Baseline
  console.log('👉 [1/6] Resetting database to clean production baseline...');
  db.resetDb();

  // Ensure uploads directory exists
  if (!fs.existsSync(config.UPLOAD_DIR)) {
    fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  }

  // 2. Generate Demo Asset in Uploads
  console.log('👉 [2/6] Generating sample demo media asset in uploads directory...');
  const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const demoImagePath = path.join(config.UPLOAD_DIR, 'hdtalk-architecture-preview.png');
  fs.writeFileSync(demoImagePath, Buffer.from(samplePngBase64, 'base64'));
  console.log('   Created asset: /uploads/hdtalk-architecture-preview.png');

  // 3. Create Fictional Demo Users with Authenticated Bcrypt Hashes
  console.log('👉 [3/6] Provisioning fictional demo users (User A, User B, User C)...');
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const now = Date.now();

  const userA = db.createUser({
    id: 'usr_demo_alice',
    name: 'Alice Sterling',
    email: 'alice.sterling@demo.hdtalk.local',
    password: passwordHash,
    profession: 'Senior Frontend Architect',
    bio: 'Specializing in real-time WebRTC media rendering, accessible UI systems, and client performance.',
    interests: ['WebRTC', 'React', 'Design Systems', 'Accessibility'],
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    status: 'offline',
    lastSeen: new Date(now - 120000).toISOString(),
    createdAt: new Date(now - 86400000).toISOString()
  });

  const userB = db.createUser({
    id: 'usr_demo_bob',
    name: 'Bob Vance',
    email: 'bob.vance@demo.hdtalk.local',
    password: passwordHash,
    profession: 'Cloud Infrastructure Specialist',
    bio: 'Passionate about high-throughput Socket.io networks, media server tuning, and STUN/TURN relays.',
    interests: ['DevOps', 'Coturn', 'Docker', 'NodeJS'],
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    status: 'offline',
    lastSeen: new Date(now - 60000).toISOString(),
    createdAt: new Date(now - 86400000).toISOString()
  });

  const userC = db.createUser({
    id: 'usr_demo_clara',
    name: 'Clara Oswald',
    email: 'clara.oswald@demo.hdtalk.local',
    password: passwordHash,
    profession: 'Full Stack Engineer',
    bio: 'Building next-generation collaborative workflows and distributed messaging architectures.',
    interests: ['FullStack', 'WebSocket', 'GraphQL', 'TypeScript'],
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    status: 'offline',
    lastSeen: new Date(now - 300000).toISOString(),
    createdAt: new Date(now - 86400000).toISOString()
  });

  console.log('   ✓ User A: Alice Sterling (alice.sterling@demo.hdtalk.local)');
  console.log('   ✓ User B: Bob Vance (bob.vance@demo.hdtalk.local)');
  console.log('   ✓ User C: Clara Oswald (clara.oswald@demo.hdtalk.local)');

  // 4. Provision Connection Requests & Matchmaking
  console.log('👉 [4/6] Establishing connections & matchmaking states...');
  const reqAB = db.sendConnectionRequest(userA.id, userB.id, 'Let us collaborate on HDTalk WebRTC mesh architecture.');
  db.updateConnectionRequest(reqAB.id, 'accepted');

  const reqCA = db.sendConnectionRequest(userC.id, userA.id, 'Hi Alice, would love to collaborate on the frontend WebRTC interface!');
  console.log('   ✓ Connection established between Alice and Bob (Accepted)');
  console.log('   ✓ Pending incoming connection notification for Alice from Clara (Pending)');

  // 5. Establish Direct Conversation & Multi-Type Messages
  console.log('👉 [5/6] Generating demo chat conversation with reactions and read receipts...');
  const conversation = db.getOrCreateDirectConversation(userA.id, userB.id);

  // Message 1: Alice -> Bob
  const msg1 = db.createMessage({
    conversationId: conversation.id,
    senderId: userA.id,
    text: 'Hi Bob! The WebRTC audio and video mesh streams are looking remarkably clear in HDTalk.',
    type: 'text',
    mediaUrl: null,
    replyToId: null,
    reactions: { '👍': [userB.id] },
    readBy: [userA.id, userB.id],
    timestamp: new Date(now - 20 * 60000).toISOString()
  });

  // Message 2: Bob -> Alice
  const msg2 = db.createMessage({
    conversationId: conversation.id,
    senderId: userB.id,
    text: 'Hey Alice! Just finished configuring the media relay pipeline. Real-time latency is under 30ms!',
    type: 'text',
    mediaUrl: null,
    replyToId: null,
    reactions: { '🚀': [userA.id] },
    readBy: [userA.id, userB.id],
    timestamp: new Date(now - 15 * 60000).toISOString()
  });

  // Message 3: Alice -> Bob
  const msg3 = db.createMessage({
    conversationId: conversation.id,
    senderId: userA.id,
    text: 'That is fantastic. Let me send over the updated architecture specs for review.',
    type: 'text',
    mediaUrl: null,
    replyToId: null,
    reactions: {},
    readBy: [userA.id, userB.id],
    timestamp: new Date(now - 10 * 60000).toISOString()
  });

  // Message 4: Alice -> Bob (Shared File Attachment)
  const msg4 = db.createMessage({
    conversationId: conversation.id,
    senderId: userA.id,
    text: 'hdtalk-architecture-preview.png',
    type: 'image',
    mediaUrl: '/uploads/hdtalk-architecture-preview.png',
    replyToId: null,
    reactions: { '✨': [userB.id] },
    readBy: [userA.id, userB.id],
    timestamp: new Date(now - 5 * 60000).toISOString()
  });

  // Message 5: Bob -> Alice (Unread for Alice to demonstrate notification badge)
  const msg5 = db.createMessage({
    conversationId: conversation.id,
    senderId: userB.id,
    text: 'Received and reviewed. The peer-to-peer signaling fallback works seamlessly!',
    type: 'text',
    mediaUrl: null,
    replyToId: null,
    reactions: {},
    readBy: [userB.id], // Unread for Alice!
    timestamp: new Date(now - 60000).toISOString()
  });

  conversation.lastMessage = msg5;
  conversation.updatedAt = msg5.timestamp;

  // 6. Flush Atomically to Disk & Backup
  console.log('👉 [6/6] Synchronizing atomic snapshot to db.json and db.backup.json...');
  db.flushSync();

  const stats = db.getDbStats();
  console.log('\n================================================================');
  console.log('✅ DEMO ENVIRONMENT SEED COMPLETE');
  console.log('================================================================');
  console.log(`Users:               ${stats.usersCount}`);
  console.log(`Conversations:       ${stats.conversationsCount}`);
  console.log(`Messages:            ${stats.messagesCount}`);
  console.log(`Connection Requests: ${stats.connectionRequestsCount}`);
  console.log('================================================================\n');

  return { userA, userB, userC, conversation };
}

if (require.main === module) {
  seedDemoEnvironment();
}

module.exports = { seedDemoEnvironment };
