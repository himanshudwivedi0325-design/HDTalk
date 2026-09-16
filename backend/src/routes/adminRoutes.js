const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

// All routes require authentication + administrator rights
router.use(authMiddleware);
router.use(adminMiddleware);

// Admin metrics & system overview
router.get('/stats', adminController.getStats);

// User management endpoints
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.put('/users/:userId/role', adminController.updateUserRole);
router.patch('/users/:userId/role', adminController.updateUserRole);
router.put('/users/:userId/ban', adminController.toggleUserBan);
router.patch('/users/:userId/ban', adminController.toggleUserBan);
router.put('/users/:userId', adminController.updateUser);
router.patch('/users/:userId', adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);

module.exports = router;
