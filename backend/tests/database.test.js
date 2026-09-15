const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/database/db');

test('Database In-Memory Operations Suite', async (t) => {
  await t.test('getDbStats returns valid state object', () => {
    const stats = db.getDbStats();
    assert.ok(stats);
    assert.ok(typeof stats.usersCount === 'number');
    assert.ok(typeof stats.conversationsCount === 'number');
    assert.ok(typeof stats.messagesCount === 'number');
  });

  await t.test('User lookup handles missing users gracefully', () => {
    const missingUser = db.getUserById('non_existent_id_999999');
    assert.equal(missingUser, null);

    const missingEmail = db.getUserByEmail('does_not_exist@example.com');
    assert.equal(missingEmail, null);
  });

  await t.test('Reaction toggling adds and removes correctly', () => {
    const testMsgId = 'test_msg_rx_' + Date.now();
    const testUserId = 'test_usr_42';

    // Seed temporary message into state
    const memory = db.getDb();
    memory.messages.push({
      id: testMsgId,
      text: 'Hello test',
      senderId: 'usr_1',
      conversationId: 'conv_1',
      reactions: {}
    });

    // Add reaction
    const withReaction = db.addReaction(testMsgId, '❤️', testUserId);
    assert.ok(withReaction);
    assert.ok(withReaction.reactions['❤️'].includes(testUserId));

    // Toggle off reaction
    const withoutReaction = db.addReaction(testMsgId, '❤️', testUserId);
    assert.ok(withoutReaction);
    assert.equal(withoutReaction.reactions['❤️'], undefined);

    // Clean up
    memory.messages = memory.messages.filter(m => m.id !== testMsgId);
  });
});
