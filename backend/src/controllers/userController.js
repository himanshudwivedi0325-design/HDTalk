const db = require('../database/db');
const socketManager = require('../socket/socketManager');
const pushService = require('../services/pushNotificationService');
const cloudMediaService = require('../services/cloudMediaService');

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

// Calculate smart professional matchmaking score
const calculateMatchScore = (userA, userB) => {
  let score = 65; // Base score

  // Professional synergy bonus
  if (userA.profession && userB.profession) {
    const profA = (userA.profession || '').toLowerCase();
    const profB = (userB.profession || '').toLowerCase();
    if (profA === profB) {
      score += 20; // Peers in same domain
    } else if (
      (profA.includes('engineer') && profB.includes('designer')) ||
      (profA.includes('designer') && profB.includes('engineer')) ||
      (profA.includes('developer') && profB.includes('architect')) ||
      (profA.includes('founder') || profB.includes('founder'))
    ) {
      score += 25; // Cross-functional synergy
    } else {
      score += 10;
    }
  }

  // Shared interests & skills bonus
  const interestsA = userA.interests || [];
  const interestsB = userB.interests || [];
  const common = interestsA.filter(i => interestsB.map(x => x.toLowerCase()).includes(i.toLowerCase()));
  score += Math.min(common.length * 6, 20);

  return Math.min(score, 98);
};

exports.getAllUsers = (req, res) => {
  try {
    const currentUserId = req.user.id;
    const allUsers = db.getUsers().filter(u => u.id !== currentUserId);

    const usersWithMatch = allUsers.map(u => {
      const safe = sanitizeUser(u);
      return {
        ...safe,
        matchScore: calculateMatchScore(req.user, u)
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      users: usersWithMatch
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

exports.getUserProfile = (req, res) => {
  const user = db.getUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  res.json({
    success: true,
    user: sanitizeUser(user)
  });
};

exports.updateProfile = (req, res) => {
  try {
    const allowed = ['name', 'bio', 'avatar', 'profession', 'interests'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.name !== undefined) {
      const cleanName = String(updates.name).trim().replace(/\s+/g, ' ');
      if (cleanName.length < 2 || cleanName.length > 30) {
        return res.status(400).json({ success: false, message: 'Name must be between 2 and 30 characters.' });
      }
      updates.name = cleanName;
    }

    const updated = db.updateUser(req.user.id, updates);
    res.json({
      success: true,
      user: sanitizeUser(updated)
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};

exports.getConnectionRequests = (req, res) => {
  try {
    const requests = db.getConnectionRequests(req.user.id);
    const enriched = requests.map(r => {
      const fromUser = sanitizeUser(db.getUserById(r.fromUserId));
      const toUser = sanitizeUser(db.getUserById(r.toUserId));
      return {
        ...r,
        fromUser,
        toUser
      };
    });
    res.json({ success: true, requests: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch connection requests.' });
  }
};

exports.sendConnectionRequest = (req, res) => {
  try {
    const toUserId = req.body.toUserId || req.body.targetUserId;
    const note = req.body.note || '';
    if (!toUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required.' });
    }
    const request = db.sendConnectionRequest(req.user.id, toUserId, note || '');

    // Real-time notification to recipient
    try {
      const io = socketManager.getIO();
      if (io) {
        const enriched = {
          ...request,
          fromUser: sanitizeUser(db.getUserById(req.user.id)),
          toUser: sanitizeUser(db.getUserById(toUserId))
        };
        io.to(`user:${toUserId}`).emit('new_connection_request', enriched);
      }
    } catch (sErr) {
      console.warn('Socket error on sendConnectionRequest:', sErr.message);
    }

    // Trigger background Web Push alert
    try {
      const sender = db.getUserById(req.user.id);
      pushService.notifyFriendRequest({
        recipientId: toUserId,
        senderName: sender?.name || 'HDTalk User',
        senderAvatar: sender?.avatar
      }).catch(pErr => console.warn('[Push] Friend request push error:', pErr.message));
    } catch (pushErr) {
      console.warn('[Push] Error dispatching request push:', pushErr.message);
    }

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send request.' });
  }
};

exports.respondConnectionRequest = (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'accepted' | 'rejected'

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be accepted or rejected.' });
    }

    const updated = db.updateConnectionRequest(requestId, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    // If accepted, automatically create or open a direct conversation
    let conversation = null;
    if (status === 'accepted') {
      conversation = db.getOrCreateDirectConversation(updated.fromUserId, updated.toUserId);
    }

    // Broadcast socket event to both users
    try {
      const io = socketManager.getIO();
      if (io) {
        const payload = {
          requestId: updated.id,
          status,
          updated,
          conversation
        };
        io.to(`user:${updated.fromUserId}`).emit('connection_request_status_updated', payload);
        io.to(`user:${updated.toUserId}`).emit('connection_request_status_updated', payload);
      }
    } catch (sErr) {
      console.warn('Socket error on respondConnectionRequest:', sErr.message);
    }

    res.json({ success: true, request: updated, conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to respond to request.' });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided.' });
    }

    const uploadResult = await cloudMediaService.uploadMedia(req.file, 'hdtalk/avatars');
    const avatarUrl = uploadResult.url;
    const updatedUser = db.updateUser(req.user.id, { avatar: avatarUrl });

    res.json({
      success: true,
      avatar: avatarUrl,
      storage: uploadResult.storage,
      user: sanitizeUser(updatedUser)
    });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload avatar.' });
  }
};

exports.removeFriend = (req, res) => {
  try {
    const { friendUserId } = req.params;
    const removed = db.removeFriend(req.user.id, friendUserId);

    try {
      const io = socketManager.getIO();
      if (io) {
        io.to(`user:${req.user.id}`).emit('friend_removed', { friendUserId });
        io.to(`user:${friendUserId}`).emit('friend_removed', { friendUserId: req.user.id });
      }
    } catch (_) {}

    res.json({ success: true, message: 'Friend removed successfully.' });
  } catch (err) {
    console.error('Error removing friend:', err);
    res.status(500).json({ success: false, message: 'Failed to remove friend.' });
  }
};

