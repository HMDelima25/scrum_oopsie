const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/dashboard.controller');
const { loadCurrentUser } = require('../middleware/require-user.middleware');

// GET /api/ui-dashboard-data - Signed-in user + dashboard records
router.get('/ui-dashboard-data', loadCurrentUser, getDashboardData);

module.exports = router;