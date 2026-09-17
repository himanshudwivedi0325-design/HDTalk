const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const config = require('../config/config');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.includes('audio') ? '.webm' : '.dat');
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  }
});

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.mp3', '.wav', '.ogg', '.m4a', '.webm', '.aac', '.flac',
  '.mp4', '.mov', '.avi', '.mkv',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.zip', '.rar', '.7z', '.tar', '.gz', '.json'
]);

const FORBIDDEN_EXTENSIONS = new Set([
  '.html', '.htm', '.exe', '.bat', '.cmd', '.sh', '.php',
  '.js', '.mjs', '.vbs', '.scr', '.jar', '.com', '.msi', '.pif'
]);

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 + 64 * 1024 }, // 25 MB + 64KB envelope margin
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ext || FORBIDDEN_EXTENSIONS.has(ext) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`File extension "${ext || 'none'}" is not permitted. Allowed: documents, audio, video, images, archives.`));
    }
    cb(null, true);
  }
});

// Webhook Authorization Middleware for n8n/Bot callbacks
const webhookAuthMiddleware = (req, res, next) => {
  const secretHeader = req.headers['x-webhook-secret'] || req.headers['x-api-key'] || req.query.secret;
  const expectedSecret = config.N8N_WEBHOOK_SECRET;

  if (secretHeader && secretHeader === expectedSecret) {
    return next();
  }

  // Also permit authenticated users / admins via standard Bearer token
  if (req.headers.authorization) {
    return authMiddleware(req, res, next);
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized webhook access. Valid X-Webhook-Secret or Bearer token required.'
  });
};

// Webhook Callback: Ingest asynchronous bot replies from n8n automation
router.post('/bot-reply', webhookAuthMiddleware, chatController.botReply);

router.use(authMiddleware);

router.get('/conversations', chatController.getConversations);
router.post('/conversations', chatController.getOrCreateConversation);
router.get('/conversations/:conversationId/messages', chatController.getMessages);
router.post('/conversations/:conversationId/messages', chatController.sendMessage);
router.post('/conversations/:conversationId/read', chatController.markRead);
router.post('/messages/:messageId/reactions', chatController.addReaction);
router.put('/messages/:messageId', chatController.editMessage);
router.delete('/messages/:messageId', chatController.deleteMessage);
router.delete('/conversations/:conversationId', chatController.deleteConversation);
router.post('/upload', uploadLimiter, upload.single('file'), chatController.uploadFile);

module.exports = router;
