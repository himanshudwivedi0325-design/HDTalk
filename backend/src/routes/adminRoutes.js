const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

const validate = require('../middleware/validate');
const { adminSchemas } = require('../validation/schemas');

// All routes require authentication + administrator rights
router.use(authMiddleware);
router.use(adminMiddleware);

// Admin metrics & system overview
router.get('/stats', adminController.getStats);

// User management endpoints
router.get('/users', adminController.getUsers);
router.post('/users', validate(adminSchemas.createUser), adminController.createUser);
router.put('/users/:userId/role', validate(adminSchemas.updateUserRole), adminController.updateUserRole);
router.patch('/users/:userId/role', validate(adminSchemas.updateUserRole), adminController.updateUserRole);
router.put('/users/:userId/ban', validate(adminSchemas.toggleUserBan), adminController.toggleUserBan);
router.patch('/users/:userId/ban', validate(adminSchemas.toggleUserBan), adminController.toggleUserBan);
router.put('/users/:userId', validate(adminSchemas.updateUser), adminController.updateUser);
router.patch('/users/:userId', validate(adminSchemas.updateUser), adminController.updateUser);
router.delete('/users/:userId', validate(adminSchemas.userIdParam), adminController.deleteUser);

module.exports = router;
