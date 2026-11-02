const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  requestPasswordReset,
  resetPassword,
} = require('../controllers/auth.controller');

// POST /api/auth/register
router.post('/register', registerUser);

// POST /api/auth/login
router.post('/login', loginUser);

// POST /api/auth/logout
router.post('/logout', logoutUser);

// POST /api/auth/forgot-password
router.post('/forgot-password', requestPasswordReset);

// POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

module.exports = router;