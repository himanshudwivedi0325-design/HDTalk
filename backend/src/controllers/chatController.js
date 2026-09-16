const path = require('path');
const db = require('../database/db');
const socketManager = require('../socket/socketManager');
const pushService = require('../services/pushNotificationService');
const cloudMediaService = require('../services/cloudMediaService');

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

exports.getConversations = (req, res) => {
  try {
    const currentUserId = req.user.id;
    const conversations = db.getConversationsForUser(currentUserId);

    const enriched = conversations.map(c => {
      const participants = c.participants.map(id => sanitizeUser(db.getUserById(id))).filter(Boolean);
      const otherUser = participants.find(p => p.id !== currentUserId) || null;

      // Dynamically evaluate pending connection status
      let isPending = c.isPending || false;
      let requestedBy = c.requestedBy || null;
      if (c.type === 'direct' && otherUser) {
        const reqItem = (db.getDb().connectionRequests || []).find(r =>
          (r.fromUserId === currentUserId && r.toUserId === otherUser.id) ||
          (r.fromUserId === otherUser.id && r.toUserId === currentUserId)
        );
        isPending = reqItem ? reqItem.status === 'pending' : false;
        requestedBy = reqItem ? reqItem.fromUserId : null;
      }

      // Count unread messages
      const msgs = db.getMessages(c.id, currentUserId);
      const unreadCount = msgs.filter(m => m.senderId !== currentUserId && !m.readBy?.includes(currentUserId)).length;

      return {
        ...c,
        isPending,
        requestedBy,
        participants,
        otherUser,
        unreadCount
      };
    }).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    res.json({ success: true, conversations: enriched });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations.' });
  }
};

exports.getOrCreateConversation = (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required.' });
    }

    const conv = db.getOrCreateDirectConversation(req.user.id, targetUserId);
    const participants = conv.participants.map(id => sanitizeUser(db.getUserById(id))).filter(Boolean);
    const otherUser = participants.find(p => p.id !== req.user.id) || null;

    res.json({
      success: true,
      conversation: {
        ...conv,
        participants,
        otherUser,
        unreadCount: 0
      }
    });
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ success: false, message: 'Failed to initialize conversation.' });
  }
};

exports.getMessages = (req, res) => {
  try {
    const { conversationId } = req.params;
    const conv = db.getConversationById(conversationId);
    if (!conv || !conv.participants.includes(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Access denied to this conversation.' });
    }

    db.markAsRead(conversationId, req.user.id);

    // ── Cursor-based Pagination ──────────────────────────────────────────────
    // ?limit=50        — number of messages to return (default 50, max 200)
    // ?before=<ISO>    — cursor: return messages older than this timestamp
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const before = req.query.before ? new Date(req.query.before) : null;

    let allMessages = db.getMessages(conversationId, req.user.id);

    if (before && !isNaN(before.getTime())) {
      allMessages = allMessages.filter(m => new Date(m.timestamp) < before);
    }

    // getMessages already sorts ASC by timestamp; take the last `limit` for newest-first paging
    const totalFiltered = allMessages.length;
    const paged = allMessages.slice(Math.max(0, totalFiltered - limit));

    res.json({
      success: true,
      messages: paged,
      hasMore: totalFiltered > limit,
      total: totalFiltered
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
};


exports.sendMessage = (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text, type, mediaUrl, replyToId } = req.body;

    const conv = db.getConversationById(conversationId);
    if (!conv || !conv.participants.includes(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Access denied to this conversation.' });
    }
    if (conv.isPending) {
      return res.status(403).json({ success: false, message: 'Connection request is pending. Cannot send messages until accepted.' });
    }

    const newMsg = db.createMessage({
      conversationId,
      senderId: req.user.id,
      text: text || '',
      type: type || 'text', // 'text' | 'image' | 'voice' | 'file'
      mediaUrl: mediaUrl || null,
      replyToId: replyToId || null
    });

    // Broadcast in real-time via Socket.IO
    try {
      const io = socketManager.getIO();
      if (io) {
        io.to(`conv:${conversationId}`).emit('receive_message', newMsg);
        conv.participants.forEach(pId => {
          io.to(`user:${pId}`).emit('receive_message', newMsg);
          io.to(`user:${pId}`).emit('conversation_updated', {
            conversationId,
            lastMessage: conv.lastMessage,
            updatedAt: conv.updatedAt
          });
        });
      }
    } catch (socketBroadcastErr) {
      console.warn('Socket broadcast error in REST sendMessage:', socketBroadcastErr.message);
    }

    // Trigger background Web Push notification to all other participants
    try {
      const sender = db.getUserById(req.user.id);
      const otherParticipants = (conv.participants || []).filter(pId => pId !== req.user.id);
      otherParticipants.forEach(recipientId => {
        pushService.notifyNewMessage({
          recipientId,
          senderName: sender?.name || 'HDTalk User',
          senderAvatar: sender?.avatar,
          text: newMsg.text,
          type: newMsg.type,
          conversationId
        }).catch(pushErr => console.warn('[Push] Background message push error:', pushErr.message));
      });
    } catch (pushDispatchErr) {
      console.warn('[Push] Error dispatching message push:', pushDispatchErr.message);
    }

    res.status(201).json({
      success: true,
      message: newMsg
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const uploadResult = await cloudMediaService.uploadMedia(req.file);

    res.json({
      success: true,
      fileUrl: uploadResult.url,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      storage: uploadResult.storage
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'File upload failed.' });
  }
};

exports.addReaction = (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ success: false, message: 'Emoji is required.' });
    }

    const updated = db.addReaction(messageId, emoji, req.user.id);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    res.json({ success: true, message: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add reaction.' });
  }
};

exports.markRead = (req, res) => {
  try {
    const { conversationId } = req.params;
    db.markAsRead(conversationId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.deleteMessage = (req, res) => {
  try {
    const { messageId } = req.params;
    const deleteForEveryone = req.body.deleteForEveryone !== false;

    const result = db.deleteMessage(messageId, req.user.id, deleteForEveryone);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }
    if (result.error) {
      return res.status(403).json({ success: false, message: result.error });
    }

    // Broadcast in real-time via Socket.IO
    try {
      const io = socketManager.getIO();
      if (io) {
        const payload = {
          messageId,
          conversationId: result.message.conversationId,
          deleteForEveryone,
          message: result.message
        };
        if (deleteForEveryone) {
          io.to(`conv:${result.message.conversationId}`).emit('message_deleted', payload);
          const conv = db.getConversationById(result.message.conversationId);
          if (conv && conv.participants) {
            conv.participants.forEach(pId => {
              io.to(`user:${pId}`).emit('message_deleted', payload);
            });
          }
        } else {
          io.to(`user:${req.user.id}`).emit('message_deleted', payload);
        }
      }
    } catch (socketErr) {
      console.warn('Socket broadcast error on delete:', socketErr.message);
    }

    res.json({
      success: true,
      message: result.message,
      deleteForEveryone
    });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete message.' });
  }
};

exports.deleteConversation = (req, res) => {
  try {
    const { conversationId } = req.params;
    const alsoRemoveFriend = req.body.alsoRemoveFriend === true;

    const result = db.deleteConversation(conversationId, req.user.id, alsoRemoveFriend);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    try {
      const io = socketManager.getIO();
      if (io) {
        const payload = { conversationId, deletedBy: req.user.id, alsoRemoveFriend };
        io.to(`conv:${conversationId}`).emit('conversation_deleted', payload);
        io.to(`user:${req.user.id}`).emit('conversation_deleted', payload);
        if (result.otherUserId) {
          io.to(`user:${result.otherUserId}`).emit('conversation_deleted', payload);
          if (alsoRemoveFriend) {
            io.to(`user:${result.otherUserId}`).emit('friend_removed', { friendUserId: req.user.id });
            io.to(`user:${req.user.id}`).emit('friend_removed', { friendUserId: result.otherUserId });
          }
        }
      }
    } catch (_) {}

    res.json({ success: true, message: 'Conversation deleted successfully.', conversationId, alsoRemoveFriend });
  } catch (err) {
    console.error('Delete conversation error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete conversation.' });
  }
};

exports.editMessage = (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text cannot be empty.' });
    }

    const result = db.editMessage(messageId, req.user.id, text);
    if (!result || result.error) {
      return res.status(400).json({ success: false, message: result?.error || 'Failed to edit message.' });
    }

    const targetConvId = result.message.conversationId;
    const payload = {
      messageId,
      conversationId: targetConvId,
      text: result.message.text,
      isEdited: true,
      editedAt: result.message.editedAt,
      message: result.message
    };

    try {
      const io = socketManager.getIO();
      if (io) {
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
      }
    } catch (socketErr) {
      console.warn('Socket broadcast error on editMessage:', socketErr.message);
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ success: false, message: 'Failed to edit message.' });
  }
};

