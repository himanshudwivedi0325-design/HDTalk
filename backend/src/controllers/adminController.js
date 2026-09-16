const bcrypt = require('bcryptjs');
const db = require('../database/db');

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  const cleanEmail = (safe.email || '').toLowerCase().trim();
  const isCreator = cleanEmail === 'shikhar@gmail.com' || cleanEmail === 'himanshudwivedi0325@gmail.com';
  safe.role = safe.role || (isCreator ? 'admin' : 'user');
  safe.isBanned = safe.isBanned || false;
  return safe;
};

/**
 * 1. Get all users with search, filter, and pagination
 */
exports.getUsers = (req, res) => {
  try {
    const { search = '', filter = 'all', sort = 'newest' } = req.query;
    let users = db.getUsers().map(sanitizeUser);

    // Search by name, email, or profession
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      users = users.filter(u => 
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.profession && u.profession.toLowerCase().includes(q))
      );
    }

    // Filter
    if (filter === 'active') {
      users = users.filter(u => !u.isBanned);
    } else if (filter === 'banned') {
      users = users.filter(u => u.isBanned === true);
    } else if (filter === 'admin') {
      users = users.filter(u => u.role === 'admin');
    }

    // Sort
    if (sort === 'alphabetical') {
      users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'lastActive') {
      users.sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0));
    } else {
      // newest
      users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    res.json({
      success: true,
      total: users.length,
      users
    });
  } catch (err) {
    console.error('[Admin] getUsers error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
};

/**
 * 2. Get system overview statistics
 */
exports.getStats = (req, res) => {
  try {
    const stats = db.getSystemStats();
    res.json({
      success: true,
      stats
    });
  } catch (err) {
    console.error('[Admin] getStats error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve system stats.' });
  }
};

/**
 * 3. Update User Role (Promote to Admin / Demote to User)
 */
exports.updateUserRole = (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be "admin" or "user".' });
    }

    const targetUser = db.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Protection: Prevent demoting platform creator
    const cleanEmail = (targetUser.email || '').toLowerCase().trim();
    if ((cleanEmail === 'shikhar@gmail.com' || cleanEmail === 'himanshudwivedi0325@gmail.com') && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Platform creator cannot be demoted from admin.' });
    }

    const updated = db.updateUser(userId, { role });
    res.json({
      success: true,
      message: `User role successfully updated to ${role}.`,
      user: sanitizeUser(updated)
    });
  } catch (err) {
    console.error('[Admin] updateUserRole error:', err);
    res.status(500).json({ success: false, message: 'Failed to update user role.' });
  }
};

/**
 * 4. Ban / Suspend or Unban User
 */
exports.toggleUserBan = (req, res) => {
  try {
    const { userId } = req.params;
    const { isBanned, reason } = req.body;

    if (typeof isBanned !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isBanned must be boolean (true/false).' });
    }

    const targetUser = db.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Safety checks: Cannot ban self or creator
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot suspend your own account.' });
    }
    const cleanEmail = (targetUser.email || '').toLowerCase().trim();
    if (cleanEmail === 'shikhar@gmail.com' || cleanEmail === 'himanshudwivedi0325@gmail.com') {
      return res.status(403).json({ success: false, message: 'Platform creator cannot be suspended.' });
    }

    const updates = {
      isBanned,
      bannedAt: isBanned ? new Date().toISOString() : null,
      banReason: isBanned ? (reason || 'Violation of terms of service') : null,
      status: isBanned ? 'offline' : targetUser.status
    };

    const updated = db.updateUser(userId, updates);

    // If banned, broadcast force logout to user's socket room
    if (isBanned) {
      try {
        const socketManager = require('../socket/socketManager');
        const io = socketManager.getIO ? socketManager.getIO() : null;
        if (io) {
          io.to(`user:${userId}`).emit('account_suspended', {
            message: 'Your account has been suspended by an administrator.',
            reason: updates.banReason
          });
        }
      } catch (_) {}
    }

    res.json({
      success: true,
      message: isBanned ? 'User account suspended.' : 'User account reactivated.',
      user: sanitizeUser(updated)
    });
  } catch (err) {
    console.error('[Admin] toggleUserBan error:', err);
    res.status(500).json({ success: false, message: 'Failed to update user ban status.' });
  }
};

/**
 * 5. Update user profile information by Admin
 */
exports.updateUser = (req, res) => {
  try {
    const { userId } = req.params;
    const { name, profession, bio, interests, email } = req.body;

    const targetUser = db.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (profession !== undefined) updates.profession = profession;
    if (bio !== undefined) updates.bio = bio;
    if (Array.isArray(interests)) updates.interests = interests;

    if (email && email.trim().toLowerCase() !== targetUser.email.toLowerCase()) {
      const existing = db.getUserByEmail(email.trim().toLowerCase());
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email is already in use by another account.' });
      }
      updates.email = email.trim().toLowerCase();
    }

    const updated = db.updateUser(userId, updates);
    res.json({
      success: true,
      message: 'User updated successfully.',
      user: sanitizeUser(updated)
    });
  } catch (err) {
    console.error('[Admin] updateUser error:', err);
    res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
};

/**
 * 6. Permanently Delete User
 */
exports.deleteUser = (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = db.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Safety checks
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account from here.' });
    }
    const cleanEmail = (targetUser.email || '').toLowerCase().trim();
    if (cleanEmail === 'shikhar@gmail.com' || cleanEmail === 'himanshudwivedi0325@gmail.com') {
      return res.status(403).json({ success: false, message: 'Platform creator cannot be deleted.' });
    }

    const success = db.deleteUser(userId);
    if (!success) {
      return res.status(500).json({ success: false, message: 'Failed to delete user.' });
    }

    // Notify sockets to disconnect deleted user
    try {
      const socketManager = require('../socket/socketManager');
      const io = socketManager.getIO ? socketManager.getIO() : null;
      if (io) {
        io.to(`user:${userId}`).emit('account_deleted', {
          message: 'Your account has been deleted by an administrator.'
        });
      }
    } catch (_) {}

    res.json({
      success: true,
      message: 'User deleted successfully along with associated conversations.'
    });
  } catch (err) {
    console.error('[Admin] deleteUser error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
};

/**
 * 7. Directly create a user by Admin
 */
exports.createUser = (req, res) => {
  try {
    const { name, email, password, role = 'user', profession = '', bio = '' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (db.getUserByEmail(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = db.createUser({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      profession,
      bio,
      role: role === 'admin' ? 'admin' : 'user',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      interests: ['Networking', 'Tech']
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user: sanitizeUser(newUser)
    });
  } catch (err) {
    console.error('[Admin] createUser error:', err);
    res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
};
