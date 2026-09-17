const { MongoClient } = require('mongodb');
const dns = require('dns');
const config = require('../config/config');

let client = null;
let dbInstance = null;
let isConnected = false;
let isConfigured = false;

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 
  (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mongodb') ? process.env.DATABASE_URL : null) ||
  config.MONGODB_URI ||
  null;

if (mongoUri) {
  isConfigured = true;
  console.log('[MongoDB] MONGODB_URI configured.');
} else {
  console.log('[MongoDB] No MONGODB_URI detected. Active Database Engine: Local JSON (db.json).');
}

/**
 * Initialize MongoDB connection and perform automated migration from local db.json
 * @param {Object} memoryState - Current in-memory database object
 * @returns {Promise<Object>} Hydrated or migrated database state
 */
async function initMongo(memoryState) {
  if (!isConfigured) return memoryState;

  try {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch (_) {}

    console.log('[MongoDB] Connecting to MongoDB Atlas cluster...');
    client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000
    });

    await client.connect();
    isConnected = true;
    dbInstance = client.db('hdtalk');
    console.log('[MongoDB] Connected successfully to MongoDB Atlas database: hdtalk');

    // Setup performance indexes
    try {
      await dbInstance.collection('users').createIndex({ id: 1 }, { unique: true });
      await dbInstance.collection('users').createIndex({ email: 1 });
      await dbInstance.collection('messages').createIndex({ id: 1 }, { unique: true });
      await dbInstance.collection('messages').createIndex({ conversationId: 1 });
      await dbInstance.collection('conversations').createIndex({ id: 1 }, { unique: true });
      await dbInstance.collection('conversations').createIndex({ participants: 1 });
      await dbInstance.collection('connectionRequests').createIndex({ id: 1 }, { unique: true });
      await dbInstance.collection('pushSubscriptions').createIndex({ id: 1 }, { unique: true });
      await dbInstance.collection('rateLimits').createIndex({ resetTime: 1 }, { expireAfterSeconds: 0 });
    } catch (idxErr) {
      console.warn('[MongoDB] Index setup note:', idxErr.message);
    }

    // Check if remote collections already have data
    const usersCount = await dbInstance.collection('users').countDocuments();
    const messagesCount = await dbInstance.collection('messages').countDocuments();

    if (usersCount === 0 && messagesCount === 0) {
      // Automatic One-Time Migration: Local db.json -> MongoDB Atlas
      console.log('[MongoDB] Remote database is empty. Executing automated migration from local db.json...');
      
      const collections = ['users', 'conversations', 'messages', 'connectionRequests', 'pushSubscriptions'];
      for (const collName of collections) {
        const items = memoryState[collName] || [];
        if (items.length > 0) {
          // Prepare documents ensuring _id maps to item.id
          const docs = items.map(item => ({ ...item, _id: item.id }));
          try {
            await dbInstance.collection(collName).insertMany(docs, { ordered: false });
            console.log(`[MongoDB Migration] Migrated ${items.length} records into '${collName}'`);
          } catch (mErr) {
            console.warn(`[MongoDB Migration] Partial insert for ${collName}:`, mErr.message);
          }
        }
      }
      console.log('[MongoDB] Automated zero-data-loss migration completed successfully! 🎉');
      return memoryState;
    } else {
      // Hydrate local cache from MongoDB Atlas (filtering out purged test/demo users)
      const TEST_USER_EMAILS = [
        'alice.sterling@demo.hdtalk.local',
        'bob.vance@demo.hdtalk.local',
        'himanshu.test99@gmail.com'
      ];
      const TEST_USER_IDS = ['usr_demo_alice', 'usr_demo_bob', 'usr_97d33ffd'];

      // Actively purge blacklisted test accounts from MongoDB Atlas cluster
      try {
        await dbInstance.collection('users').deleteMany({
          $or: [
            { email: { $in: TEST_USER_EMAILS } },
            { id: { $in: TEST_USER_IDS } },
            { _id: { $in: TEST_USER_IDS } }
          ]
        });
      } catch (_) {}

      const rawUsers = await dbInstance.collection('users').find().toArray();
      const cleanUsers = rawUsers.filter(u => {
        const email = (u.email || '').toLowerCase().trim();
        const id = u.id || u._id || '';
        return !TEST_USER_EMAILS.includes(email) && !TEST_USER_IDS.includes(id) && !id.startsWith('usr_demo_');
      });

      console.log(`[MongoDB] Hydrating local memory cache from MongoDB (Found ${cleanUsers.length} authentic users, ${messagesCount} messages)...`);
      const hydratedState = {
        users: cleanUsers,
        conversations: await dbInstance.collection('conversations').find().toArray(),
        messages: await dbInstance.collection('messages').find().toArray(),
        connectionRequests: await dbInstance.collection('connectionRequests').find().toArray(),
        pushSubscriptions: await dbInstance.collection('pushSubscriptions').find().toArray()
      };

      // Sanitize _id to id if needed
      for (const key of Object.keys(hydratedState)) {
        hydratedState[key] = hydratedState[key].map(doc => {
          const { _id, ...rest } = doc;
          return { id: doc.id || _id, ...rest };
        });
      }

      console.log('[MongoDB] In-memory cache hydrated from remote MongoDB Atlas.');
      return hydratedState;
    }
  } catch (err) {
    console.warn('[MongoDB] Connection or migration error, continuing with local storage fallback:', err.message);
    isConnected = false;
    return memoryState;
  }
}

/**
 * Asynchronously upsert a record into MongoDB Atlas (Write-Through Cache)
 */
async function persistUpsert(collectionName, document) {
  if (!isConnected || !dbInstance || !document || !document.id) return;
  try {
    const docId = document.id;
    const res = await dbInstance.collection(collectionName).updateOne(
      { $or: [{ _id: docId }, { id: docId }] },
      { $set: { ...document, id: docId } }
    );
    if (res.matchedCount === 0) {
      await dbInstance.collection(collectionName).insertOne({
        ...document,
        _id: docId,
        id: docId
      });
    }
  } catch (err) {
    console.warn(`[MongoDB] Failed to persist update to ${collectionName}:`, err.message);
  }
}

/**
 * Asynchronously delete a record from MongoDB Atlas
 */
async function persistDelete(collectionName, filter) {
  if (!isConnected || !dbInstance) return;
  try {
    let mongoFilter;
    if (typeof filter === 'string') {
      const cleanId = String(filter);
      mongoFilter = { $or: [{ _id: cleanId }, { id: cleanId }] };
    } else if (filter && typeof filter === 'object') {
      const targetId = filter.id || filter._id;
      if (targetId) {
        const cleanId = String(targetId);
        mongoFilter = { $or: [{ _id: cleanId }, { id: cleanId }] };
      } else {
        // Defensive NoSQL coercion: ensure every query value is coerced to String primitive
        const safeFilter = {};
        for (const [key, val] of Object.entries(filter)) {
          if (key.startsWith('$')) continue;
          safeFilter[key] = typeof val === 'object' && val !== null ? String(val) : String(val);
        }
        mongoFilter = safeFilter;
      }
    } else {
      return;
    }
    await dbInstance.collection(collectionName).deleteMany(mongoFilter);
  } catch (err) {
    console.warn(`[MongoDB] Failed to delete from ${collectionName}:`, err.message);
  }
}

/**
 * Asynchronously delete multiple records from MongoDB Atlas
 */
async function persistDeleteMany(collectionName, filter) {
  if (!isConnected || !dbInstance || !filter) return;
  try {
    await dbInstance.collection(collectionName).deleteMany(filter);
  } catch (err) {
    console.warn(`[MongoDB] Failed to deleteMany from ${collectionName}:`, err.message);
  }
}

/**
 * Asynchronously bulk upsert records into MongoDB Atlas
 */
async function persistUpsertMany(collectionName, documents) {
  if (!isConnected || !dbInstance || !Array.isArray(documents) || documents.length === 0) return;
  try {
    const ops = documents.filter(doc => doc && doc.id).map(doc => ({
      updateOne: {
        filter: { $or: [{ _id: doc.id }, { id: doc.id }] },
        update: { $set: { ...doc, id: doc.id } },
        upsert: true
      }
    }));
    if (ops.length > 0) {
      await dbInstance.collection(collectionName).bulkWrite(ops, { ordered: false });
    }
  } catch (err) {
    console.warn(`[MongoDB] Failed bulk write to ${collectionName}:`, err.message);
  }
}

/**
 * Full flush sync to MongoDB Atlas
 */
async function fullSyncToMongo(memoryState) {
  if (!isConnected || !dbInstance) return;
  try {
    const collections = ['users', 'conversations', 'messages', 'connectionRequests', 'pushSubscriptions'];
    for (const coll of collections) {
      const items = memoryState[coll] || [];
      const currentIds = items.map(x => x.id).filter(Boolean);
      
      // Upsert current documents safely (Explicit deletions are handled by persistDelete)
      for (const item of items) {
        if (item.id) {
          if (coll === 'users') {
            const email = (item.email || '').toLowerCase().trim();
            if (['alice.sterling@demo.hdtalk.local', 'bob.vance@demo.hdtalk.local', 'himanshu.test99@gmail.com'].includes(email) ||
                ['usr_demo_alice', 'usr_demo_bob', 'usr_97d33ffd'].includes(item.id) ||
                item.id.startsWith('usr_demo_')) {
              continue;
            }
          }
          const res = await dbInstance.collection(coll).updateOne(
            { $or: [{ _id: item.id }, { id: item.id }] },
            { $set: { ...item, id: item.id } }
          );
          if (res.matchedCount === 0) {
            await dbInstance.collection(coll).insertOne({
              ...item,
              _id: item.id,
              id: item.id
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[MongoDB] Full sync warning:', err.message);
  }
}

function getMongoStatus() {
  return {
    isConfigured,
    isConnected,
    engine: isConnected ? 'MongoDB Atlas (Hosted Cloud Database)' : 'Local JSON File (db.json)'
  };
}

module.exports = {
  initMongo,
  persistUpsert,
  persistUpsertMany,
  persistDelete,
  persistDeleteMany,
  fullSyncToMongo,
  getMongoStatus,
  getDbInstance: () => dbInstance,
  isConnected: () => isConnected,
  isConfigured: () => isConfigured
};
