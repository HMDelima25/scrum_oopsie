const express = require('express');
const router = express.Router();
const { loadCurrentUser, requireAdministrator } = require('../middleware/require-user.middleware');
const roles = require('../controllers/roles.controller');
const {
  getUsersList,
  addUser,
  updateUser,
  toggleUserStatus,
  getUserRights,
} = require('../controllers/admin.controller');

router.use(loadCurrentUser, requireAdministrator);

router.get('/users', getUsersList);
router.post('/users', addUser);
router.put('/users/:id', updateUser);
router.patch('/users/:id/status', toggleUserStatus);
router.post('/users/:id/invite', require('../controllers/admin.controller').sendSetupLink);
router.get('/users/:id/rights', getUserRights);
router.put('/users/:id/rights', roles.setUserRights);
router.put('/users/:id/permission-role', roles.assignRole);

router.get('/rights-catalogue', roles.catalogue);
router.get('/roles', roles.listRoles);
router.post('/roles', roles.saveRole);
router.get('/roles/:id', roles.getRole);
router.put('/roles/:id', roles.saveRole);
router.get('/audit-log', require('../controllers/admin.controller').getAuditLog);
router.get('/settings', require('../controllers/admin.controller').getSettings);
router.put('/settings/:key', require('../controllers/admin.controller').updateSetting);

module.exports = router;