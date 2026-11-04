const express = require('express');
const router = express.Router();
const {
  getUsersList,
  addUser,
  updateUser,
  toggleUserStatus,
} = require('../controllers/admin.controller');
const { requireAdmin } = require('../middleware/auth.middleware');

// Protect all admin routes
router.use(requireAdmin);

// GET /api/admin/users - List users (filtered by role)
router.get('/users', getUsersList);

// POST /api/admin/users - Add new user
router.post('/users', addUser);

// PUT /api/admin/users/:id - Edit user details
router.put('/users/:id', updateUser);

// PATCH /api/admin/users/:id/status - Block/Unblock user
router.patch('/users/:id/status', toggleUserStatus);

module.exports = router;