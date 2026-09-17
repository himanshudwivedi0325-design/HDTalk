const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const config = require('../config/config');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

const webhookAuth = require('../middleware/webhookAuth');

// Webhook Callback: Ingest asynchronous bot replies from n8n automation with HMAC signature verification
router.post('/bot-reply', express.raw({ type: '*/*', limit: '2mb' }), webhookAuth, chatController.botReply);

const validate = require('../middleware/validate');
const { chatSchemas } = require('../validation/schemas');

router.use(authMiddleware);

router.get('/conversations', chatController.getConversations);
router.post('/conversations', validate(chatSchemas.getOrCreateConversation), chatController.getOrCreateConversation);
router.get('/conversations/:conversationId/messages', validate(chatSchemas.getMessages), chatController.getMessages);
router.post('/conversations/:conversationId/messages', validate(chatSchemas.sendMessage), chatController.sendMessage);
router.post('/conversations/:conversationId/read', validate(chatSchemas.markRead), chatController.markRead);
router.post('/messages/:messageId/reactions', validate(chatSchemas.addReaction), chatController.addReaction);
router.put('/messages/:messageId', validate(chatSchemas.editMessage), chatController.editMessage);
router.delete('/messages/:messageId', validate(chatSchemas.deleteMessage), chatController.deleteMessage);
router.delete('/conversations/:conversationId', validate(chatSchemas.deleteConversation), chatController.deleteConversation);
router.post('/upload', uploadLimiter, upload.single('file'), chatController.uploadFile);

module.exports = router;
