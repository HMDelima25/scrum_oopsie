const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/dashboard.controller');

// GET /api/ui-dashboard-data - Signed-in user + dashboard records
router.get('/ui-dashboard-data', getDashboardData);

module.exports = router;