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

// Webhook callback route for n8n AI Bot (unauthenticated or pre-shared webhook callback)
router.post('/bot-reply', chatController.postBotReply);

router.use(authMiddleware);

router.get('/conversations', chatController.getConversations);
router.post('/conversations', chatController.getOrCreateConversation);
router.get('/conversations/:conversationId/messages', chatController.getMessages);
router.post('/conversations/:conversationId/messages', chatController.sendMessage);
router.post('/conversations/:conversationId/read', chatController.markRead);
router.post('/messages/:messageId/reactions', chatController.addReaction);
router.post('/upload', uploadLimiter, upload.single('file'), chatController.uploadFile);

module.exports = router;
