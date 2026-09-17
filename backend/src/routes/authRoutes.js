const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');

const ALLOWED_AVATAR_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_AVATAR_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_AVATAR_EXTENSIONS.has(rawExt) ? rawExt : '.jpg';
    cb(null, `avatar-${Date.now()}-${uuidv4().slice(0, 8)}${safeExt}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_AVATAR_EXTENSIONS.has(ext)) {
      return cb(new Error('Only safe raster image files (PNG, JPG, JPEG, WEBP, GIF) are allowed for avatar.'));
    }
    if (!ALLOWED_AVATAR_MIMES.has(file.mimetype.toLowerCase())) {
      return cb(new Error('Invalid image MIME type. Permitted: image/jpeg, image/png, image/webp, image/gif.'));
    }
    cb(null, true);
  }
});

const validate = require('../middleware/validate');
const { authSchemas } = require('../validation/schemas');

// ─── Routes ───────────────────────────────────────────────────────────────────
router.post('/register', validate(authSchemas.register), authController.register);
router.post('/login', validate(authSchemas.login), authController.login);
router.post('/quick-login', validate(authSchemas.quickLogin), authController.quickLogin);

// Protected: only authenticated users can see the user directory
router.get('/demo-users', authMiddleware, authController.getDemoUsers);

router.get('/me', authMiddleware, authController.getMe);
router.post('/upload-avatar', uploadLimiter, avatarUpload.single('avatar'), authController.uploadRegistrationAvatar);

module.exports = router;

