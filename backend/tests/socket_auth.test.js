const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/database/db');
const { assertParticipant } = require('../src/socket/socketManager');

test('Socket Authorization Suite', async (t) => {
  // Setup mock conversation in database
  const userA = 'test_usr_alice';
  const userB = 'test_usr_bob';
  const attackerUser = 'test_usr_mallory';

  const testConv = db.getOrCreateDirectConversation(userA, userB);

  const createMockSocket = (userId) => {
    const emitted = [];
    return {
      id: `mock_sock_${Math.random().toString(36).substring(7)}`,
      data: userId ? { userId } : {},
      emit: (event, data) => {
        emitted.push({ event, data });
      },
      getEmitted: () => emitted
    };
  };

  await t.test('assertParticipant rejects unauthenticated socket', async () => {
    const mockSocket = createMockSocket(null);
    const result = await assertParticipant(mockSocket, testConv.id);

    assert.equal(result, false);
    const emitted = mockSocket.getEmitted();
    assert.ok(emitted.some(e => e.event === 'unauthorized'));
  });

  await t.test('assertParticipant rejects missing conversationId', async () => {
    const mockSocket = createMockSocket(userA);
    const result = await assertParticipant(mockSocket, null);

    assert.equal(result, false);
    const emitted = mockSocket.getEmitted();
    assert.ok(emitted.some(e => e.event === 'unauthorized'));
  });

  await t.test('assertParticipant rejects non-existent conversation', async () => {
    const mockSocket = createMockSocket(userA);
    const result = await assertParticipant(mockSocket, 'non_existent_conv_9999');

    assert.equal(result, false);
    const emitted = mockSocket.getEmitted();
    assert.ok(emitted.some(e => e.event === 'unauthorized'));
  });

  await t.test('assertParticipant blocks unauthorized user from eavesdropping on private conversation', async () => {
    const mockSocket = createMockSocket(attackerUser);
    const result = await assertParticipant(mockSocket, testConv.id);

    assert.equal(result, false);
    const emitted = mockSocket.getEmitted();
    const unauthEvent = emitted.find(e => e.event === 'unauthorized');
    assert.ok(unauthEvent, 'Must emit unauthorized event to attacker');
    assert.equal(unauthEvent.data.conversationId, testConv.id);
  });

  await t.test('assertParticipant succeeds and returns conversation for authorized participant', async () => {
    const mockSocket = createMockSocket(userA);
    const result = await assertParticipant(mockSocket, testConv.id);

    assert.ok(result && typeof result === 'object');
    assert.equal(result.id, testConv.id);
    assert.deepEqual(result.participants, [userA, userB]);
  });
});
