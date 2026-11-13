const test = require('node:test');
const assert = require('node:assert/strict');
const schema = require('../config/ui-schema');

test('permission catalogue has the 41 permissions shown by User Management', () => {
  assert.equal(Object.keys(schema.rightsCatalogue).length, 41);
  for (const required of ['customers.view', 'products.view', 'hr.view', 'sales.view', 'reports.topSales']) {
    assert.ok(schema.rightsCatalogue[required], `${required} should be configurable`);
  }
});

test('all live module records map to known table fields and primary keys', () => {
  assert.equal(Object.keys(schema.resources).length, 10);
  for (const [name, resource] of Object.entries(schema.resources)) {
    assert.ok(resource.table, `${name} needs a table`);
    assert.ok(resource.pk.length, `${name} needs a key`);
    for (const field of [...resource.pk, ...resource.fields]) {
      assert.ok(schema.fields[field], `${name}.${field} needs UI field metadata`);
    }
  }
});

test('every page view is defined or handled by the dedicated admin/report UI', () => {
  for (const [module, views] of Object.entries(schema.groups)) {
    for (const view of views) {
      assert.ok(schema.resources[view] || ['users', 'roles', 'reports', 'settings', 'audit-log'].includes(view), `${module} has unknown view ${view}`);
    }
  }
});
