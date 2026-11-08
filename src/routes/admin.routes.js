const express = require('express');
const router = express.Router();
const {
  getUsersList,
  addUser,
  updateUser,
  toggleUserStatus,
  getUserRights,
  updateUserRights,
} = require('../controllers/admin.controller');

// EXISTING ROUTES

// GET /api/admin/users/:id/rights - Get user rights
router.get('/users/:id/rights', getUserRights);

// PUT /api/admin/users/:id/rights - Update user rights & audit log
router.put('/users/:id/rights', updateUserRights);

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