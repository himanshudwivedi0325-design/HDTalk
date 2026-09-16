const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../database/db');
const n8nService = require('../services/n8nService');
const aiService = require('../services/aiService');
const pushService = require('../services/pushNotificationService');

// Map of userId -> Set of socketIds
const userSocketMap = new Map();
// Map of socketId -> userId
const socketUserMap = new Map();
// Map of socketId -> active call info { targetUserId, callType, status }
const activeCallsMap = new Map();
// Map of userId -> active call info { peerUserId, socketId, status }
const userActiveCallMap = new Map();

// Group Mesh Call Rooms: roomId -> Map<userId, { socketId, callType, user, joinedAt }>
const callRooms = new Map();
// Map of socketId -> Set<roomId>
const socketCallRooms = new Map();

// ─── Per-Socket Event Rate Limiter (Token Bucket) ──────────────────────────────
// Prevents socket event spam without requiring external Redis.
// socketEventBuckets: socketId -> { eventName -> timestamp[] }
const socketEventBuckets = new Map();

/**
 * Returns true if the event should be throttled (rate limit exceeded).
 * @param {string} socketId
 * @param {string} eventName
 * @param {number} maxEvents  - Max events allowed in the window
 * @param {number} windowMs   - Window duration in ms
 */
function isSocketEventThrottled(socketId, eventName, maxEvents, windowMs) {
  const now = Date.now();
  if (!socketEventBuckets.has(socketId)) {
    socketEventBuckets.set(socketId, {});
  }
  const bucket = socketEventBuckets.get(socketId);
  if (!bucket[eventName]) bucket[eventName] = [];

  // Slide the window
  bucket[eventName] = bucket[eventName].filter(t => now - t < windowMs);

  if (bucket[eventName].length >= maxEvents) {
    return true; // throttled
  }
  bucket[eventName].push(now);
  return false;
}

let ioInstance = null;


function initSocket(io) {
  ioInstance = io;
  io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // Register user socket with optional JWT authentication
    socket.on('register_user', (payload) => {
      let userId = null;
      let token = null;

      if (typeof payload === 'object' && payload !== null) {
        userId = payload.userId;
        token = payload.token;
      } else {
        userId = payload;
      }

      if (!userId) return;

      // Cryptographic verification: token is required to prevent unauthenticated socket identity spoofing
      const candidateToken = token || socket.handshake?.auth?.token;
      if (!candidateToken) {
        console.warn(`[Socket Security] Rejected unauthenticated registration attempt for userId: ${userId} (No JWT token provided)`);
        socket.emit('socket_error', { message: 'Authentication required. Token missing.' });
        return;
      }

      try {
        const decoded = jwt.verify(candidateToken, config.JWT_SECRET);
        if (!decoded || decoded.id !== userId) {
          console.warn(`[Socket Security] Rejected spoofed registration attempt: Token user ${decoded?.id} !== requested ${userId}`);
          socket.emit('socket_error', { message: 'Authentication mismatch' });
          return;
        }
      } catch (jwtErr) {
        console.warn(`[Socket Security] Invalid JWT token during register_user: ${jwtErr.message}`);
        socket.emit('socket_error', { message: 'Invalid session token' });
        return;
      }

      let user = db.getUserById(userId);
      if (!user && candidateToken) {
        try {
          const decoded = jwt.verify(candidateToken, config.JWT_SECRET);
          if (decoded && decoded.id === userId) {
            user = { id: userId, name: decoded.name || 'User', email: decoded.email || '', avatar: '' };
          }
        } catch (_) {}
      }
      if (!user) {
        console.log(`[Socket] Rejected registration for unknown/deleted user: ${userId}`);
        return;
      }
      
      socketUserMap.set(socket.id, userId);

      if (!userSocketMap.has(userId)) {
        userSocketMap.set(userId, new Set());
      }
      userSocketMap.get(userId).add(socket.id);

      // Mark user online in db
      const now = new Date().toISOString();
      db.updateUser(userId, { status: 'online', lastSeen: now });

      // Join user personal room for easy private broadcasts
      socket.join(`user:${userId}`);

      // Broadcast to all clients that user is online
      io.emit('user_status_changed', { userId, status: 'online', lastSeen: now });

      // Send list of all currently online user IDs to the connected client
      const onlineUserIds = Array.from(userSocketMap.keys());
      socket.emit('online_users_list', onlineUserIds);

      // Check for undelivered messages to this user and mark them delivered
      const newlyDelivered = db.markConversationDeliveredForUser(userId);
      if (newlyDelivered && newlyDelivered.length > 0) {
        const bySender = {};
        newlyDelivered.forEach(m => {
          if (!bySender[m.senderId]) bySender[m.senderId] = [];
          bySender[m.senderId].push(m.id);
        });

        Object.entries(bySender).forEach(([sId, mIds]) => {
          io.to(`user:${sId}`).emit('messages_delivered', {
            deliveredTo: userId,
            messageIds: mIds
          });
        });
      }

      console.log(`[Socket] User registered: ${userId} (${socket.id}). Online users: ${onlineUserIds.length}`);
    });

    // Handle joining specific conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    // ----------------------------------------------------
    // CHAT & MESSAGING EVENTS
    // ----------------------------------------------------
    socket.on('send_message', (data, ackCallback) => {
      // Rate limit: max 20 messages per 5 seconds per socket
      if (isSocketEventThrottled(socket.id, 'send_message', 20, 5000)) {
        if (typeof ackCallback === 'function') ackCallback({ success: false, message: 'Slow down! You are sending messages too fast.' });
        return;
      }
      const { conversationId, text, type, mediaUrl, replyToId, tempId } = data || {};
      if (!conversationId) return;

      let senderId = socketUserMap.get(socket.id);
      if (!senderId && data.token) {
        try {
          const dec = jwt.verify(data.token, config.JWT_SECRET);
          if (dec?.id) senderId = dec.id;
        } catch (_) {}
      }
      if (!senderId && socket.handshake?.auth?.token) {
        try {
          const dec = jwt.verify(socket.handshake.auth.token, config.JWT_SECRET);
          if (dec?.id) senderId = dec.id;
        } catch (_) {}
      }

      if (!senderId) {
        console.warn(`[Socket] send_message rejected: senderId not found for socket ${socket.id}`);
        if (typeof ackCallback === 'function') ackCallback({ success: false, message: 'Authentication required' });
        return;
      }

      const existingConv = db.getConversationById(conversationId);
      if (existingConv && existingConv.isPending) {
        console.warn(`[Socket] send_message blocked: conversation ${conversationId} is pending connection acceptance`);
        if (typeof ackCallback === 'function') ackCallback({ success: false, message: 'Connection request is pending acceptance.' });
        socket.emit('socket_error', { message: 'Chat is locked until the connection request is accepted.' });
        return;
      }

      const conv = db.getConversationById(conversationId);
      let initialStatus = 'sent';
      const deliveredTo = [];
      if (conv && conv.participants) {
        const otherParticipants = conv.participants.filter(pId => pId !== senderId);
        const anyOnline = otherParticipants.some(pId => userSocketMap.has(pId) && userSocketMap.get(pId).size > 0);
        if (anyOnline) {
          initialStatus = 'delivered';
          otherParticipants.forEach(pId => {
            if (userSocketMap.has(pId) && userSocketMap.get(pId).size > 0) {
              deliveredTo.push(pId);
            }
          });
        }
      }

      const newMsg = db.createMessage({
        conversationId,
        senderId,
        text: text || '',
        type: type || 'text',
        mediaUrl: mediaUrl || null,
        replyToId: replyToId || null,
        status: initialStatus,
        deliveredTo
      });

      // 1. Broadcast to conversation room
      io.to(`conv:${conversationId}`).emit('receive_message', newMsg);

      // 2. Broadcast directly back to sender socket to guarantee confirmation
      socket.emit('receive_message', newMsg);
      if (tempId) {
        socket.emit('message_sent_ack', { tempId, message: newMsg });
      }
      if (typeof ackCallback === 'function') {
        ackCallback({ success: true, message: newMsg });
      }

      const sender = db.getUserById(senderId);

      // 3. Also broadcast to every participant's personal user room so all devices/tabs receive it
      if (conv && conv.participants) {
        conv.participants.forEach(pId => {
          // Notify personal user room
          io.to(`user:${pId}`).emit('receive_message', newMsg);
          io.to(`user:${pId}`).emit('conversation_updated', {
            conversationId,
            lastMessage: conv.lastMessage,
            updatedAt: conv.updatedAt
          });

          // If participant is offline, notify n8n for offline alert
          if (pId !== senderId && (!userSocketMap.has(pId) || userSocketMap.get(pId).size === 0)) {
            const targetUser = db.getUserById(pId);
            if (targetUser && targetUser.id !== 'usr_ai_bot') {
              n8nService.notifyOfflineMessage({
                sender: sender || { id: senderId, name: 'User' },
                targetUser,
                conversationId,
                messageText: text,
                messageType: type
              });
            }
          }
        });
      }

      // Trigger Claude AI Assistant if mentioned or in direct 1-on-1 conversation with AI Bot
      const isBotConversation = conv && conv.participants && conv.participants.includes('usr_ai_bot');
      const isBotMentioned = text && /@bot|@ai|@claude/i.test(text);

      if (senderId !== 'usr_ai_bot' && (isBotMentioned || isBotConversation)) {
        aiService.handleAIBotQuery({
          conversationId,
          sender: sender || { id: senderId, name: 'User' },
          text,
          replyToId,
          socketManager: { getIO: () => ioInstance }
        });
      }
    });

    socket.on('typing_start', ({ conversationId, targetUserId }) => {
      // Rate limit: max 10 typing events per 3 seconds (prevents typing indicator spam)
      if (isSocketEventThrottled(socket.id, 'typing_start', 10, 3000)) return;
      const senderId = socketUserMap.get(socket.id);
      if (!senderId) return;

      const payload = { conversationId, userId: senderId };
      // Emit only to participant personal rooms (avoids duplicates from conv room overlap)
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('user_typing', payload);
      } else if (conversationId) {
        const conv = db.getConversationById(conversationId);
        if (conv && conv.participants) {
          conv.participants.forEach(pId => {
            if (pId !== senderId) {
              io.to(`user:${pId}`).emit('user_typing', payload);
            }
          });
        }
      }
    });

    socket.on('typing_stop', ({ conversationId, targetUserId }) => {
      const senderId = socketUserMap.get(socket.id);
      if (!senderId) return;

      const payload = { conversationId, userId: senderId };
      // Emit only to participant personal rooms (avoids duplicates)
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('user_stop_typing', payload);
      } else if (conversationId) {
        const conv = db.getConversationById(conversationId);
        if (conv && conv.participants) {
          conv.participants.forEach(pId => {
            if (pId !== senderId) {
              io.to(`user:${pId}`).emit('user_stop_typing', payload);
            }
          });
        }
      }
    });

    socket.on('add_reaction', ({ messageId, conversationId, emoji }) => {
      // Rate limit: max 15 reactions per 5 seconds
      if (isSocketEventThrottled(socket.id, 'add_reaction', 15, 5000)) return;
      const userId = socketUserMap.get(socket.id);
      if (!userId) return;

      const updated = db.addReaction(messageId, emoji, userId);
      if (updated) {
        io.to(`conv:${conversationId}`).emit('reaction_updated', {
          messageId,
          reactions: updated.reactions
        });
      }
    });

    // Client confirms receipt of incoming message
    socket.on('message_ack_delivered', ({ messageId, conversationId }) => {
      const recipientId = socketUserMap.get(socket.id);
      if (!recipientId) return;

      const msg = db.markAsDelivered(messageId, recipientId);
      if (msg) {
        io.to(`user:${msg.senderId}`).emit('message_delivered', {
          messageId,
          conversationId,
          deliveredTo: recipientId
        });
      }
    });

    socket.on('mark_read', ({ conversationId }) => {
      const userId = socketUserMap.get(socket.id);
      if (!userId) return;

      const readMessageIds = db.markAsRead(conversationId, userId);
      const payload = { conversationId, readBy: userId, messageIds: readMessageIds };
      
      io.to(`conv:${conversationId}`).emit('messages_marked_read', payload);
      const conv = db.getConversationById(conversationId);
      if (conv && conv.participants) {
        conv.participants.forEach(pId => {
          if (pId !== userId) {
            io.to(`user:${pId}`).emit('messages_marked_read', payload);
          }
        });
      }
    });

    socket.on('delete_conversation', ({ conversationId, alsoRemoveFriend }) => {
      const userId = socketUserMap.get(socket.id);
      if (!userId) return;

      const result = db.deleteConversation(conversationId, userId, alsoRemoveFriend);
      if (result) {
        const payload = { conversationId, deletedBy: userId, alsoRemoveFriend };
        io.to(`conv:${conversationId}`).emit('conversation_deleted', payload);
        io.to(`user:${userId}`).emit('conversation_deleted', payload);
        if (result.otherUserId) {
          io.to(`user:${result.otherUserId}`).emit('conversation_deleted', payload);
          if (alsoRemoveFriend) {
            io.to(`user:${result.otherUserId}`).emit('friend_removed', { friendUserId: userId });
            io.to(`user:${userId}`).emit('friend_removed', { friendUserId: result.otherUserId });
          }
        }
      }
    });

    socket.on('remove_friend', ({ friendUserId }) => {
      const userId = socketUserMap.get(socket.id);
      if (!userId) return;

      db.removeFriend(userId, friendUserId);
      io.to(`user:${userId}`).emit('friend_removed', { friendUserId });
      io.to(`user:${friendUserId}`).emit('friend_removed', { friendUserId: userId });
    });

    socket.on('delete_message', ({ messageId, conversationId, deleteForEveryone }) => {
      let userId = socketUserMap.get(socket.id);
      if (!userId) return;

      const isForEveryone = deleteForEveryone !== false;
      const result = db.deleteMessage(messageId, userId, isForEveryone);
      if (!result) {
        socket.emit('socket_error', { message: 'Message not found' });
        return;
      }
      if (result.error) {
        socket.emit('socket_error', { message: result.error });
        return;
      }

      const targetConvId = conversationId || result.message.conversationId;
      const payload = {
        messageId,
        conversationId: targetConvId,
        deleteForEveryone: isForEveryone,
        message: result.message
      };

      if (isForEveryone) {
        io.to(`conv:${targetConvId}`).emit('message_deleted', payload);
        const conv = db.getConversationById(targetConvId);
        if (conv && conv.participants) {
          conv.participants.forEach(pId => {
            io.to(`user:${pId}`).emit('message_deleted', payload);
            io.to(`user:${pId}`).emit('conversation_updated', {
              conversationId: targetConvId,
              lastMessage: conv.lastMessage,
              updatedAt: conv.updatedAt
            });
          });
        }
      } else {
        socket.emit('message_deleted', payload);
        io.to(`user:${userId}`).emit('message_deleted', payload);
      }
    });

    socket.on('edit_message', ({ messageId, conversationId, text }, ackCallback) => {
      let userId = socketUserMap.get(socket.id);
      if (!userId) {
        if (typeof ackCallback === 'function') ackCallback({ success: false, message: 'Unauthorized' });
        return;
      }

      const result = db.editMessage(messageId, userId, text);
      if (!result || result.error) {
        socket.emit('socket_error', { message: result?.error || 'Failed to edit message' });
        if (typeof ackCallback === 'function') ackCallback({ success: false, message: result?.error });
        return;
      }

      const targetConvId = conversationId || result.message.conversationId;
      const payload = {
        messageId,
        conversationId: targetConvId,
        text: result.message.text,
        isEdited: true,
        editedAt: result.message.editedAt,
        message: result.message
      };

      io.to(`conv:${targetConvId}`).emit('message_edited', payload);
      const conv = db.getConversationById(targetConvId);
      if (conv && conv.participants) {
        conv.participants.forEach(pId => {
          io.to(`user:${pId}`).emit('message_edited', payload);
          io.to(`user:${pId}`).emit('conversation_updated', {
            conversationId: targetConvId,
            lastMessage: conv.lastMessage,
            updatedAt: conv.updatedAt
          });
        });
      }

      if (typeof ackCallback === 'function') {
        ackCallback({ success: true, message: result.message });
      }
    });

    // ----------------------------------------------------
    // WEBRTC 1:1 CALLING SIGNALING & SESSION SECURITY
    // ----------------------------------------------------
    socket.on('call_user', (data) => {
      const { targetUserId, signalData, callType } = data;
      const callerId = socketUserMap.get(socket.id);
      if (!callerId) return;

      // Prevent calling oneself
      if (callerId === targetUserId) {
        socket.emit('call_rejected', { fromUserId: targetUserId, reason: 'Cannot call yourself' });
        return;
      }

      // Check if target is already on another call (Line Busy)
      if (userActiveCallMap.has(targetUserId)) {
        console.log(`[Call Security] Call blocked: Target ${targetUserId} is already on another call`);
        socket.emit('call_rejected', {
          fromUserId: targetUserId,
          reason: 'User is currently on another call (Line Busy)'
        });
        return;
      }

      const caller = db.getUserById(callerId);
      console.log(`[Call] Call initiated from ${callerId} to ${targetUserId} (${callType})`);

      const targetSockets = userSocketMap.get(targetUserId);
      if (!targetSockets || targetSockets.size === 0) {
        console.log(`[Call] Target user ${targetUserId} is offline`);
        socket.emit('call_rejected', {
          fromUserId: targetUserId,
          reason: 'User is currently offline'
        });

        const targetUser = db.getUserById(targetUserId);
        n8nService.notifyMissedCall({
          caller: caller || { id: callerId, name: 'Caller' },
          targetUser: targetUser || { id: targetUserId, name: 'User' },
          callType
        });
        return;
      }

      // Register session in ringing status
      activeCallsMap.set(socket.id, { targetUserId, callType, status: 'ringing' });
      userActiveCallMap.set(callerId, { peerUserId: targetUserId, socketId: socket.id, status: 'ringing' });
      userActiveCallMap.set(targetUserId, { peerUserId: callerId, status: 'ringing' });

      io.to(`user:${targetUserId}`).emit('incoming_call', {
        callerId,
        callerName: caller ? caller.name : 'Unknown User',
        callerAvatar: caller ? caller.avatar : '',
        callType: callType || 'video',
        signalData
      });

      // Background Web Push to alert user if screen is off or tab is in background
      try {
        pushService.notifyIncomingCall({
          targetUserId,
          callerName: caller ? caller.name : 'Unknown User',
          callType: callType || 'video',
          callerAvatar: caller ? caller.avatar : ''
        }).catch(pErr => console.warn('[Push] Incoming call push notice error:', pErr.message));
      } catch (_) {}

      // Acknowledge to caller that callee device is ringing
      socket.emit('call_ringing', { targetUserId });
    });

    socket.on('accept_call', (data) => {
      const { toUserId, signalData } = data;
      const acceptorId = socketUserMap.get(socket.id);
      if (!acceptorId) return;

      // Verify caller actually has an active ringing session with this acceptor
      const callerSession = userActiveCallMap.get(toUserId);
      if (!callerSession || callerSession.peerUserId !== acceptorId) {
        console.warn(`[Call Security] Blocked unauthorized or stale accept_call from ${acceptorId} for caller ${toUserId}`);
        socket.emit('call_rejected', { fromUserId: toUserId, reason: 'Call was already cancelled or expired' });
        return;
      }

      console.log(`[Call] Call accepted by ${acceptorId} for ${toUserId}`);
      activeCallsMap.set(socket.id, { targetUserId: toUserId, status: 'active' });
      userActiveCallMap.set(acceptorId, { peerUserId: toUserId, socketId: socket.id, status: 'active' });
      if (userActiveCallMap.has(toUserId)) {
        userActiveCallMap.get(toUserId).status = 'active';
      }

      io.to(`user:${toUserId}`).emit('call_accepted', {
        fromUserId: acceptorId,
        signalData
      });
    });

    socket.on('reject_call', (data) => {
      const { toUserId, reason } = data;
      const rejectorId = socketUserMap.get(socket.id);
      if (!rejectorId) return;

      // Verify authorization
      const session = userActiveCallMap.get(rejectorId);
      const callerSession = toUserId ? userActiveCallMap.get(toUserId) : null;
      const isAuthorized = (session && session.peerUserId === toUserId) ||
                           (callerSession && callerSession.peerUserId === rejectorId);

      if (!isAuthorized) {
        console.warn(`[Call Security] Blocked rogue reject_call from ${rejectorId} targeting ${toUserId}`);
        return;
      }

      console.log(`[Call] Call rejected by ${rejectorId}`);
      activeCallsMap.delete(socket.id);
      userActiveCallMap.delete(rejectorId);
      userActiveCallMap.delete(toUserId);

      io.to(`user:${toUserId}`).emit('call_rejected', {
        fromUserId: rejectorId,
        reason: reason || 'declined'
      });
    });

    socket.on('end_call', (data) => {
      const { toUserId } = data;
      const enderId = socketUserMap.get(socket.id);
      if (!enderId) return;

      // Signaling security verification: verify ender is in an active session with toUserId
      const session = userActiveCallMap.get(enderId);
      const activeCall = activeCallsMap.get(socket.id);
      const targetSession = toUserId ? userActiveCallMap.get(toUserId) : null;

      const isAuthorized = (session && session.peerUserId === toUserId) ||
                           (activeCall && activeCall.targetUserId === toUserId) ||
                           (targetSession && targetSession.peerUserId === enderId);

      if (!isAuthorized) {
        console.warn(`[Call Security] Blocked rogue end_call from ${enderId} targeting unrelated user ${toUserId}`);
        return;
      }

      console.log(`[Call] Call ended by ${enderId}`);
      activeCallsMap.delete(socket.id);
      userActiveCallMap.delete(enderId);
      if (toUserId) {
        userActiveCallMap.delete(toUserId);
        io.to(`user:${toUserId}`).emit('call_ended', { fromUserId: enderId });
      }
    });

    socket.on('ice_candidate', (data) => {
      const { toUserId, candidate } = data;
      const senderId = socketUserMap.get(socket.id);
      if (!senderId) return;

      // Verify caller/callee relationship before forwarding candidate
      const session = userActiveCallMap.get(senderId);
      const activeCall = activeCallsMap.get(socket.id);
      const targetSession = toUserId ? userActiveCallMap.get(toUserId) : null;

      const isAuthorized = (session && session.peerUserId === toUserId) ||
                           (activeCall && activeCall.targetUserId === toUserId) ||
                           (targetSession && targetSession.peerUserId === senderId);

      if (!isAuthorized) {
        console.warn(`[Call Security] Dropped candidate from ${senderId} to unauthorized target ${toUserId}`);
        return;
      }

      io.to(`user:${toUserId}`).emit('ice_candidate', {
        fromUserId: senderId,
        candidate
      });
    });

    socket.on('screen_share_status', (data) => {
      const { toUserId, isSharing } = data;
      const senderId = socketUserMap.get(socket.id);
      if (!senderId) return;

      // Security: verify sender is in an active call session with the target user
      const session = userActiveCallMap.get(senderId);
      const activeCall = activeCallsMap.get(socket.id);
      const targetSession = toUserId ? userActiveCallMap.get(toUserId) : null;

      const isAuthorized = (session && session.peerUserId === toUserId) ||
                           (activeCall && activeCall.targetUserId === toUserId) ||
                           (targetSession && targetSession.peerUserId === senderId);

      if (!isAuthorized) {
        console.warn(`[Call Security] Dropped screen_share_status from ${senderId} to unauthorized target ${toUserId}`);
        return;
      }

      io.to(`user:${toUserId}`).emit('screen_share_status', {
        fromUserId: senderId,
        isSharing
      });
    });

    socket.on('call_renegotiate', (data) => {
      const { toUserId, signalData } = data;
      const senderId = socketUserMap.get(socket.id);
      if (!senderId) return;

      const session = userActiveCallMap.get(senderId);
      const activeCall = activeCallsMap.get(socket.id);
      const targetSession = toUserId ? userActiveCallMap.get(toUserId) : null;

      const isAuthorized = (session && session.peerUserId === toUserId) ||
                           (activeCall && activeCall.targetUserId === toUserId) ||
                           (targetSession && targetSession.peerUserId === senderId);

      if (!isAuthorized) {
        console.warn(`[Call Security] Dropped renegotiation from ${senderId} to unauthorized target ${toUserId}`);
        return;
      }

      console.log(`[Call] Mid-call renegotiation requested from ${senderId} to ${toUserId}`);
      io.to(`user:${toUserId}`).emit('call_renegotiate', {
        fromUserId: senderId,
        signalData
      });
    });

    socket.on('renegotiate_answer', (data) => {
      const { toUserId, signalData } = data;
      const senderId = socketUserMap.get(socket.id);
      if (!senderId) return;

      console.log(`[Call] Mid-call renegotiation answered from ${senderId} to ${toUserId}`);
      io.to(`user:${toUserId}`).emit('renegotiate_answer', {
        fromUserId: senderId,
        signalData
      });
    });

    // ----------------------------------------------------
    // WEBRTC GROUP MESH CALLING SIGNALING (Phases 3, 4, 11)
    // ----------------------------------------------------
    socket.on('join_call_room', (data) => {
      const { roomId, callType } = data;
      const userId = socketUserMap.get(socket.id);
      if (!userId || !roomId) return;

      if (!callRooms.has(roomId)) {
        callRooms.set(roomId, new Map());
      }
      const room = callRooms.get(roomId);

      // Enforce SRS P2P Mesh Safety Limit (Max 6 participants)
      const maxLimit = config.MAX_MESH_PARTICIPANTS || 6;
      if (room.size >= maxLimit && !room.has(userId)) {
        console.warn(`[Mesh Call] Room ${roomId} full (${room.size}/${maxLimit})`);
        socket.emit('call_room_error', {
          roomId,
          message: `Room is full (maximum ${maxLimit} participants allowed in P2P mesh)`
        });
        return;
      }

      const user = db.getUserById(userId);
      const userEntry = {
        socketId: socket.id,
        callType: callType || 'video',
        user: { id: userId, name: user?.name || 'User', avatar: user?.avatar || '' },
        joinedAt: Date.now()
      };

      room.set(userId, userEntry);

      if (!socketCallRooms.has(socket.id)) {
        socketCallRooms.set(socket.id, new Set());
      }
      socketCallRooms.get(socket.id).add(roomId);

      socket.join(`callRoom:${roomId}`);

      // Collect existing participants (excluding joiner)
      const existing = [];
      room.forEach((info, pId) => {
        if (pId !== userId) {
          existing.push({
            userId: pId,
            callType: info.callType,
            user: info.user,
            joinedAt: info.joinedAt
          });
        }
      });

      console.log(`[Mesh Call] User ${userId} joined room ${roomId}. Total: ${room.size}`);

      // Send existing participants list to joiner
      socket.emit('call_room_users', { roomId, participants: existing });

      // Notify existing room members that new peer has joined
      socket.to(`callRoom:${roomId}`).emit('room_user_joined', {
        roomId,
        userId,
        callType: callType || 'video',
        user: userEntry.user
      });
    });

    socket.on('leave_call_room', (data) => {
      const { roomId } = data;
      const userId = socketUserMap.get(socket.id);
      if (!userId || !roomId) return;

      if (callRooms.has(roomId)) {
        const room = callRooms.get(roomId);
        room.delete(userId);
        if (room.size === 0) {
          callRooms.delete(roomId);
        }
      }

      if (socketCallRooms.has(socket.id)) {
        socketCallRooms.get(socket.id).delete(roomId);
      }

      socket.leave(`callRoom:${roomId}`);
      socket.to(`callRoom:${roomId}`).emit('room_user_left', { roomId, userId });
      console.log(`[Mesh Call] User ${userId} left room ${roomId}`);
    });

    socket.on('mesh_signal', (data) => {
      const { roomId, toUserId, signalData, type } = data;
      const senderId = socketUserMap.get(socket.id);
      if (!senderId || !roomId || !toUserId) return;

      const room = callRooms.get(roomId);
      if (!room || !room.has(toUserId) || !room.has(senderId)) {
        console.warn(`[Mesh Security] Signal dropped: peer not in room ${roomId}`);
        return;
      }

      const targetEntry = room.get(toUserId);
      if (targetEntry && targetEntry.socketId) {
        io.to(targetEntry.socketId).emit('mesh_signal', {
          roomId,
          fromUserId: senderId,
          signalData,
          type: type || 'signal'
        });
      }
    });

    socket.on('mesh_ice_candidate', (data) => {
      const { roomId, toUserId, candidate } = data;
      const senderId = socketUserMap.get(socket.id);
      if (!senderId || !roomId || !toUserId) return;

      const room = callRooms.get(roomId);
      if (!room || !room.has(toUserId) || !room.has(senderId)) return;

      const targetEntry = room.get(toUserId);
      if (targetEntry && targetEntry.socketId) {
        io.to(targetEntry.socketId).emit('mesh_ice_candidate', {
          roomId,
          fromUserId: senderId,
          candidate
        });
      }
    });

    // ----------------------------------------------------
    // DISCONNECT CLEANUP
    // ----------------------------------------------------
    socket.on('disconnect', () => {
      const userId = socketUserMap.get(socket.id);

      // Clean up rate limit bucket for this socket
      socketEventBuckets.delete(socket.id);

      // Clean up 1:1 call session
      if (userId && userActiveCallMap.has(userId)) {
        const session = userActiveCallMap.get(userId);
        if (session && session.peerUserId) {
          io.to(`user:${session.peerUserId}`).emit('call_ended', {
            fromUserId: userId,
            reason: 'Peer disconnected unexpectedly'
          });
          userActiveCallMap.delete(session.peerUserId);
        }
        userActiveCallMap.delete(userId);
      }
      activeCallsMap.delete(socket.id);


      // Clean up all group mesh rooms this socket was in
      if (socketCallRooms.has(socket.id)) {
        const rooms = socketCallRooms.get(socket.id);
        rooms.forEach((roomId) => {
          if (callRooms.has(roomId)) {
            const room = callRooms.get(roomId);
            if (userId) room.delete(userId);
            if (room.size === 0) {
              callRooms.delete(roomId);
            }
          }
          if (userId) {
            socket.to(`callRoom:${roomId}`).emit('room_user_left', { roomId, userId });
          }
        });
        socketCallRooms.delete(socket.id);
      }

      if (userId) {
        socketUserMap.delete(socket.id);
        const userSockets = userSocketMap.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            userSocketMap.delete(userId);
            const now = new Date().toISOString();
            db.updateUser(userId, { status: 'offline', lastSeen: now });
            io.emit('user_status_changed', { userId, status: 'offline', lastSeen: now });
            console.log(`[Socket] User went offline: ${userId} (${now})`);
          }
        }
      }
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
}

module.exports = {
  initSocket,
  getIO: () => ioInstance,
  isUserOnline: (userId) => !!(userSocketMap.get(userId) && userSocketMap.get(userId).size > 0),
  getMetrics: () => ({
    activeSockets: socketUserMap.size,
    uniqueOnlineUsers: userSocketMap.size,
    active1on1Calls: Math.floor(userActiveCallMap.size / 2),
    activeCallingRooms: callRooms.size
  })
};
