const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const ALLOWED_AVATAR_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_AVATAR_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_AVATAR_EXTENSIONS.has(rawExt) ? rawExt : '.jpg';
    cb(null, `avatar-${Date.now()}-${uuidv4().slice(0, 8)}${safeExt}`);
  }
});

const upload = multer({
  storage,
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

router.use(authMiddleware);

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserProfile);
router.put('/profile', userController.updateProfile);
router.post('/avatar', upload.single('avatar'), userController.uploadAvatar);

// Connection requests / Matchmaking
router.get('/connections/requests', userController.getConnectionRequests);
router.post('/connections/request', userController.sendConnectionRequest);
router.put('/connections/requests/:requestId', userController.respondConnectionRequest);
router.delete('/friends/:friendUserId', userController.removeFriend);

module.exports = router;
