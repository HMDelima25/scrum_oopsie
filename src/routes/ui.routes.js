const express = require('express');
const controller = require('../controllers/ui.controller');
const { loadCurrentUser, requirePermission } = require('../middleware/require-user.middleware');

const router = express.Router();
router.use(loadCurrentUser);

router.get('/ui-schema', (req, res) => res.json({ status: 'success', data: controller.schema }));
router.get('/ui-bootstrap', controller.bootstrap);
router.get('/dashboard', controller.dashboard);
router.get('/reports/:name', controller.report);

const lookupRights = {
  customers: 'customers.view', products: 'products.view', employees: 'hr.view',
  departments: 'hr.view', jobs: 'hr.view', sales: 'sales.view',
};
router.get('/lookups/:name', (req, res, next) => {
  const permission = lookupRights[req.params.name];
  if (!permission) return res.status(404).json({ status: 'error', message: 'Unknown lookup.' });
  return requirePermission(permission)(req, res, next);
});
router.get('/sale-price', requirePermission('products.view'), requirePermission('sales.view'), requirePermission('sales.create'), controller.salePrice);
router.get('/next-code/:resource', (req, res, next) => {
  const resource = controller.schema.resources[req.params.resource];
  if (!resource) return res.status(404).json({ status: 'error', message: 'Unknown resource.' });
  return requirePermission(`${resource.module}.view`)(req, res, (error) => {
    if (error) return next(error);
    return requirePermission(`${resource.module}.${resource.actions[0]}`)(req, res, next);
  });
}, controller.codePreview);

for (const [name, resource] of Object.entries(controller.schema.resources)) {
  const basePermission = `${resource.module}.view`;
  router.get(`/${name}`, requirePermission(basePermission), controller.listResource);
  router.get(`/${name}/:key`, requirePermission(basePermission), controller.getResource);
  router.post(`/${name}`, requirePermission(basePermission), requirePermission(`${resource.module}.${resource.actions[0]}`), controller.createResource);
  router.patch(`/${name}/:key`, requirePermission(basePermission), requirePermission(`${resource.module}.${resource.actions[1]}`), controller.updateResource);
  router.put(`/${name}/:key`, requirePermission(basePermission), requirePermission(`${resource.module}.${resource.actions[1]}`), controller.updateResource);
  router.delete(`/${name}/:key`, requirePermission(basePermission), requirePermission(`${resource.module}.${resource.actions[2]}`), controller.deleteResource);
  router.post(`/${name}/:key/restore`, requirePermission(basePermission), requirePermission(`${resource.module}.${resource.actions[2]}`), controller.restoreResource);
}

module.exports = router;
