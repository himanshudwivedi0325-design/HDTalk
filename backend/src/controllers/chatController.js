const path = require('path');
const db = require('../database/db');
const socketManager = require('../socket/socketManager');

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

      // Count unread messages
      const msgs = db.getMessages(c.id);
      const unreadCount = msgs.filter(m => m.senderId !== currentUserId && !m.readBy.includes(currentUserId)).length;

      return {
        ...c,
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
    const messages = db.getMessages(conversationId);

    res.json({
      success: true,
      messages
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

    res.status(201).json({
      success: true,
      message: newMsg
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
};

exports.uploadFile = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      fileUrl,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size
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

// Webhook callback endpoint for n8n AI agent to post bot replies
exports.postBotReply = (req, res) => {
  try {
    const { conversationId, text, replyToId } = req.body;
    if (!conversationId || !text) {
      return res.status(400).json({ success: false, message: 'conversationId and text are required.' });
    }

    const socketManager = require('../socket/socketManager');
    const n8nService = require('../services/n8nService');

    const botMsg = n8nService.postBotMessage({
      conversationId,
      text,
      replyToId,
      socketManager
    });

    res.json({
      success: true,
      message: 'Bot reply posted successfully.',
      data: botMsg
    });
  } catch (err) {
    console.error('Error posting bot reply:', err);
    res.status(500).json({ success: false, message: 'Failed to post bot reply.' });
  }
};
