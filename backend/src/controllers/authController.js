const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../database/db');
const n8nService = require('../services/n8nService');
const cloudMediaService = require('../services/cloudMediaService');
const socketManager = require('../socket/socketManager');

const signToken = (id) => {
  return jwt.sign({ id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  const cleanEmail = (safe.email || '').toLowerCase().trim();
  const isCreator = cleanEmail === 'shikhar@gmail.com' || cleanEmail === 'himanshudwivedi0325@gmail.com';
  safe.role = safe.role || (isCreator ? 'admin' : 'user');
  safe.isBanned = safe.isBanned || false;
  return safe;
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, profession, bio, interests } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim().replace(/\s+/g, ' ');

    if (cleanName.length < 2 || cleanName.length > 30) {
      return res.status(400).json({ success: false, message: 'Name must be between 2 and 30 characters.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const existing = db.getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(400).json({ success: false, message: 'This email is already registered. Please Sign In.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    let avatar = (req.body.avatar && req.body.avatar.trim()) || '';

    if (avatar && avatar.startsWith('data:image/')) {
      try {
        const uploadRes = await cloudMediaService.uploadBase64(avatar, 'hdtalk/avatars');
        if (uploadRes && uploadRes.url) {
          avatar = uploadRes.url;
        }
      } catch (saveErr) {
        console.warn('Could not upload base64 avatar:', saveErr.message);
      }
    }

    const newUser = db.createUser({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      avatar,
      profession: (profession && profession.trim()) || 'Professional',
      bio: (bio && bio.trim()) || 'Excited to connect and collaborate on HDTalk!',
      interests: Array.isArray(interests) ? interests : (interests ? interests.split(',').map(s => s.trim()) : ['Tech', 'Networking'])
    });

    // Notify n8n for welcome onboarding automation
    n8nService.notifyUserRegistered(newUser);

    // Real-time broadcast to all active users and admin consoles
    try {
      const io = socketManager.getIO();
      if (io) {
        io.emit('user_registered', { user: sanitizeUser(newUser) });
      }
    } catch (sErr) {
      console.warn('Could not broadcast user_registered event:', sErr.message);
    }

    const token = signToken(newUser.id);
    res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(newUser)
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};


exports.login = (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by an administrator.',
        isBanned: true
      });
    }

    // Update status to online
    db.updateUser(user.id, { status: 'online', lastSeen: new Date().toISOString() });

    const token = signToken(user.id);
    res.json({
      success: true,
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

exports.getMe = (req, res) => {
  res.json({
    success: true,
    user: sanitizeUser(req.user)
  });
};

// Quick switch login for instant test in multiple browser windows / tabs
exports.quickLogin = (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' && !config.ALLOW_QUICK_LOGIN) {
      return res.status(403).json({ success: false, message: 'Quick login is disabled in production environments.' });
    }
    const { userId } = req.body;
    const user = db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Demo user not found.' });
    }

    db.updateUser(user.id, { status: 'online', lastSeen: new Date().toISOString() });
    const token = signToken(user.id);

    res.json({
      success: true,
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Quick login error:', err);
    res.status(500).json({ success: false, message: 'Server error during quick login.' });
  }
};

exports.getDemoUsers = (req, res) => {
  const users = db.getUsers().map(sanitizeUser);
  res.json({
    success: true,
    users
  });
};

exports.uploadRegistrationAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }
    const uploadResult = await cloudMediaService.uploadMedia(req.file, 'hdtalk/avatars');
    res.json({
      success: true,
      avatarUrl: uploadResult.url,
      fileUrl: uploadResult.url,
      storage: uploadResult.storage
    });
  } catch (err) {
    console.error('Registration avatar upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload avatar.' });
  }
};

