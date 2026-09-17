const test = require('node:test');
const assert = require('node:assert');
const db = require('../src/database/db');
const userController = require('../src/controllers/userController');
const chatController = require('../src/controllers/chatController');

test.describe('Broken Object-Level Authorization (BOLA) & Mass Assignment Suite', () => {

  // Setup test mock users and conversations in memoryState
  const userAliceId = 'usr_test_alice_' + Date.now();
  const userBobId = 'usr_test_bob_' + Date.now();
  const userMalloryId = 'usr_test_mallory_' + Date.now();

  const userAlice = db.createUser({
    _forceId: userAliceId,
    name: 'Alice Security',
    email: `alice_${Date.now()}@test.local`,
    password: 'password123'
  });

  const userBob = db.createUser({
    _forceId: userBobId,
    name: 'Bob Security',
    email: `bob_${Date.now()}@test.local`,
    password: 'password123'
  });

  const userMallory = db.createUser({
    _forceId: userMalloryId,
    name: 'Mallory Attacker',
    email: `mallory_${Date.now()}@test.local`,
    password: 'password123'
  });

  const testConv = db.getOrCreateDirectConversation(userAliceId, userBobId);

  // ── 1. BOLA: deleteConversation ───────────────────────────────────────────
  test('db.deleteConversation rejects deletion when user is not a participant', () => {
    // Mallory attempts to delete Alice & Bob's conversation
    const result = db.deleteConversation(testConv.id, userMalloryId);
    assert.strictEqual(result, null, 'Non-participant should receive null when attempting deletion');

    // Conversation should still exist
    const checkConv = db.getConversationById(testConv.id);
    assert.ok(checkConv, 'Conversation must still exist after unauthorized deletion attempt');
  });

  test('chatController.deleteConversation returns 403 for non-participant', () => {
    let statusCode = null;
    let responseJson = null;

    const req = {
      params: { conversationId: testConv.id },
      user: { id: userMalloryId },
      body: {}
    };

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { responseJson = data; }
        };
      },
      json: (data) => { responseJson = data; }
    };

    chatController.deleteConversation(req, res);
    assert.strictEqual(statusCode, 403, 'Should respond with 403 Forbidden');
    assert.strictEqual(responseJson.success, false);
  });

  // ── 2. BOLA: Connection Requests ──────────────────────────────────────────
  test('userController.sendConnectionRequest rejects self-requests', () => {
    let statusCode = null;
    let responseJson = null;

    const req = {
      body: { toUserId: userAliceId },
      user: { id: userAliceId }
    };

    const res = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { responseJson = data; } };
      }
    };

    userController.sendConnectionRequest(req, res);
    assert.strictEqual(statusCode, 400, 'Sending request to oneself should return 400');
    assert.match(responseJson.message, /cannot send a connection request to yourself/i);
  });

  test('userController.respondConnectionRequest rejects response if not the intended recipient', () => {
    // Alice sends connection request to Bob
    const connReq = db.sendConnectionRequest(userAliceId, userBobId, 'Hey Bob!');

    // Mallory (attacker) attempts to accept Bob's request
    let statusCode = null;
    let responseJson = null;

    const req = {
      params: { requestId: connReq.id },
      user: { id: userMalloryId },
      body: { status: 'accepted' }
    };

    const res = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { responseJson = data; } };
      },
      json: (data) => { responseJson = data; }
    };

    userController.respondConnectionRequest(req, res);
    assert.strictEqual(statusCode, 403, 'Non-recipient must receive 403 Forbidden');
    assert.strictEqual(responseJson.success, false);

    // Alice (the sender) also cannot accept her own request
    const reqAlice = {
      params: { requestId: connReq.id },
      user: { id: userAliceId },
      body: { status: 'accepted' }
    };

    userController.respondConnectionRequest(reqAlice, res);
    assert.strictEqual(statusCode, 403, 'Sender cannot accept their own request');

    // Bob (the intended recipient) CAN accept the request
    let bobStatusCode = null;
    let bobResponseJson = null;
    const reqBob = {
      params: { requestId: connReq.id },
      user: { id: userBobId },
      body: { status: 'accepted' }
    };
    const resBob = {
      status: (code) => {
        bobStatusCode = code;
        return { json: (data) => { bobResponseJson = data; } };
      },
      json: (data) => { bobResponseJson = data; }
    };

    userController.respondConnectionRequest(reqBob, resBob);
    assert.strictEqual(bobResponseJson.success, true);
    assert.strictEqual(bobResponseJson.request.status, 'accepted');
  });

  // ── 3. BOLA: Message Reactions, Read Marks, & Edits ───────────────────────
  test('BOLA: Non-participant cannot add reaction or edit messages in private chat', () => {
    const msg = db.createMessage({
      conversationId: testConv.id,
      senderId: userAliceId,
      text: 'Private message between Alice and Bob'
    });

    // Mallory attempts to react via db
    const reactionResult = db.addReaction(msg.id, '👍', userMalloryId);
    assert.strictEqual(reactionResult, null, 'Non-participant cannot add reaction via db.addReaction');

    // Mallory attempts to react via chatController
    let statusCode = null;
    let responseJson = null;
    const reqReaction = {
      params: { messageId: msg.id },
      body: { emoji: '❤️' },
      user: { id: userMalloryId }
    };
    const resReaction = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { responseJson = data; } };
      },
      json: (data) => { responseJson = data; }
    };

    chatController.addReaction(reqReaction, resReaction);
    assert.strictEqual(statusCode, 403, 'Non-participant reaction via controller returns 403');

    // Bob attempts to edit Alice's message (same conversation, but not the sender)
    let editStatusCode = null;
    let editResponseJson = null;
    const reqEdit = {
      params: { messageId: msg.id },
      body: { text: 'Tampered by Bob' },
      user: { id: userBobId }
    };
    const resEdit = {
      status: (code) => {
        editStatusCode = code;
        return { json: (data) => { editResponseJson = data; } };
      },
      json: (data) => { editResponseJson = data; }
    };

    chatController.editMessage(reqEdit, resEdit);
    assert.strictEqual(editStatusCode, 403, 'Non-sender cannot edit message (403)');

    // Alice (sender) CAN edit her own message
    let aliceEditRes = null;
    const reqAliceEdit = {
      params: { messageId: msg.id },
      body: { text: 'Edited by Alice' },
      user: { id: userAliceId }
    };
    const resAliceEdit = {
      status: (code) => ({ json: (d) => { aliceEditRes = d; } }),
      json: (d) => { aliceEditRes = d; }
    };

    chatController.editMessage(reqAliceEdit, resAliceEdit);
    assert.strictEqual(aliceEditRes.success, true);
    assert.strictEqual(aliceEditRes.message.text, 'Edited by Alice');
  });

  // ── 4. Mass Assignment Defenses ──────────────────────────────────────────
  test('Mass Assignment: createUser strips privilege escalation fields (role, isBanned, id)', () => {
    const maliciousPayload = {
      name: 'Hacker User',
      email: `hacker_${Date.now()}@evil.com`,
      password: 'password123',
      role: 'admin',
      isAdmin: true,
      isBanned: true,
      id: 'usr_custom_forged_id',
      createdAt: '1970-01-01T00:00:00.000Z'
    };

    const created = db.createUser(maliciousPayload);

    assert.strictEqual(created.role, 'user', 'Role must default to user and ignore payload role');
    assert.strictEqual(created.isAdmin, undefined, 'isAdmin field must not be assigned');
    assert.strictEqual(created.isBanned, false, 'isBanned must default to false');
    assert.notStrictEqual(created.id, 'usr_custom_forged_id', 'User cannot forge arbitrary id');
    assert.notStrictEqual(created.createdAt, '1970-01-01T00:00:00.000Z', 'createdAt cannot be backdated');
  });

  test('Mass Assignment: updateUser ignores immutable identifiers', () => {
    const originalUser = db.getUserById(userAliceId);
    const originalCreatedAt = originalUser.createdAt;

    db.updateUser(userAliceId, {
      id: 'forged_new_id',
      _id: 'forged_mongo_id',
      createdAt: '1999-01-01T00:00:00.000Z',
      name: 'Alice Safe Update'
    });

    const updatedUser = db.getUserById(userAliceId);
    assert.strictEqual(updatedUser.id, userAliceId, 'id cannot be overwritten');
    assert.strictEqual(updatedUser.createdAt, originalCreatedAt, 'createdAt cannot be overwritten');
    assert.strictEqual(updatedUser.name, 'Alice Safe Update', 'Allowed profile field was updated');
  });

  test('Mass Assignment: createMessage allowlists fields only', () => {
    const msgPayload = {
      conversationId: testConv.id,
      senderId: userAliceId,
      text: 'Hello world',
      maliciousField: 'exploit',
      __proto_pollution__: true,
      reactions: { '🔥': ['fake_user'] }
    };

    const msg = db.createMessage(msgPayload);
    assert.strictEqual(msg.maliciousField, undefined, 'Extra unwhitelisted fields must be discarded');
    assert.strictEqual(msg.__proto_pollution__, undefined);
    assert.deepStrictEqual(msg.reactions, {}, 'Reactions cannot be pre-populated at message creation');
  });

  // ── 5. Push Subscription BOLA ─────────────────────────────────────────────
  test('BOLA: removePushSubscription requires matching userId', () => {
    const testEndpoint = 'https://fcm.googleapis.com/fcm/send/test_endpoint_' + Date.now();
    db.savePushSubscription(userAliceId, { endpoint: testEndpoint });

    // Mallory tries to unsubscribe Alice's endpoint
    const malloryAttempt = db.removePushSubscription(testEndpoint, userMalloryId);
    assert.strictEqual(malloryAttempt, false, 'Mallory cannot remove Alice subscription');

    // Alice subscription is still present
    const subs = db.getPushSubscriptionsForUser(userAliceId);
    assert.ok(subs.some(s => s.subscription?.endpoint === testEndpoint));

    // Alice removes her own subscription
    const aliceAttempt = db.removePushSubscription(testEndpoint, userAliceId);
    assert.strictEqual(aliceAttempt, true, 'Alice can remove her own subscription');
  });

  // ── Clean up: Alice deletes conversation & users ─────────────────────────
  test('Authorized participant can delete conversation & test entities cleaned', () => {
    const result = db.deleteConversation(testConv.id, userAliceId);
    assert.ok(result, 'Participant should successfully delete conversation');
    assert.strictEqual(db.getConversationById(testConv.id), undefined);

    // Clean up mock users
    db.deleteUser(userAliceId);
    db.deleteUser(userBobId);
    db.deleteUser(userMalloryId);
    const hacker = db.getUserByEmail('hacker_');
    const allUsers = db.getUsers();
    allUsers.forEach(u => {
      if (u.email && (u.email.includes('@evil.com') || u.email.includes('@test.local'))) {
        db.deleteUser(u.id);
      }
    });
  });

});

