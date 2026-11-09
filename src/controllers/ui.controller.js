const supabase = require('../config/supabase');
const schema = require('../config/ui-schema');

const ok = (res, data, extra = {}) => res.json({ status: 'success', data, ...extra });
const fail = (res, error, fallback = 'The request could not be completed.') => {
  console.error('UI API error:', error.message);
  return res.status(500).json({ status: 'error', message: fallback });
};
const withVersion = (row) => row ? { ...row, updated_at: row.updated_at || row.stamp || null } : row;
const resourceFor = (name) => schema.resources[name];
const cleanRows = (rows = []) => rows.map(withVersion);

function parseKey(name, key) {
  const config = resourceFor(name);
  const values = String(key).split('~');
  if (!config || values.length !== config.pk.length || values.some((v) => !v)) return null;
  return Object.fromEntries(config.pk.map((field, index) => [field, values[index]]));
}

async function queryResource(name, query = {}) {
  const config = resourceFor(name);
  if (!config) {
    const error = new Error('Unknown resource.');
    error.status = 404;
    throw error;
  }
  const { data, error } = await supabase.from(config.table).select('*').limit(5000);
  if (error) throw error;
  let rows = data || [];
  const status = query.status || 'active';
  if (status !== 'all') rows = rows.filter((row) => Boolean(row.is_deleted) === (status === 'inactive'));
  const search = String(query.q || '').trim().toLowerCase();
  if (search) rows = rows.filter((row) => config.search.some((field) => String(row[field] ?? '').toLowerCase().includes(search)));
  for (const [param, value] of Object.entries(query)) {
    if (!param.startsWith('f_') || value === '') continue;
    const field = param.slice(2);
    if (![...config.pk, ...config.fields].includes(field)) continue;
    rows = rows.filter((row) => String(row[field] ?? '') === String(value));
  }
  const sort = [...config.pk, ...config.fields, 'is_deleted', 'stamp'].includes(query.sort)
    ? query.sort : config.pk[0];
  const direction = query.direction === 'desc' ? -1 : 1;
  rows.sort((a, b) => String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), undefined, { numeric: true }) * direction);
  const count = rows.length;
  const offset = Math.max(0, Math.min(5000, Number.parseInt(query.offset, 10) || 0));
  const limit = Math.max(1, Math.min(200, Number.parseInt(query.limit, 10) || 50));
  return { data: cleanRows(rows.slice(offset, offset + limit)), count };
}

async function enrichSales(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.transno);
  const [{ data: details, error: detailError }, { data: payments, error: paymentError }, { data: prices, error: priceError }] = await Promise.all([
    supabase.from('salesdetail').select('transno, prodcode, quantity').in('transno', ids).eq('is_deleted', false),
    supabase.from('payment').select('transno, amount').in('transno', ids).eq('is_deleted', false),
    supabase.from('pricehist').select('prodcode, effdate, unitprice').eq('is_deleted', false),
  ]);
  if (detailError) throw detailError;
  if (paymentError) throw paymentError;
  if (priceError) throw priceError;
  const totals = new Map();
  for (const detail of details || []) {
    const sale = rows.find((row) => row.transno === detail.transno);
    const price = (prices || []).filter((item) => item.prodcode === detail.prodcode && item.effdate <= sale.salesdate)
      .sort((a, b) => String(b.effdate).localeCompare(String(a.effdate)))[0];
    const total = totals.get(detail.transno) || 0;
    totals.set(detail.transno, total + Number(detail.quantity || 0) * Number(price?.unitprice || 0));
  }
  const paid = new Map();
  for (const payment of payments || []) paid.set(payment.transno, (paid.get(payment.transno) || 0) + Number(payment.amount || 0));
  return rows.map((row) => {
    const total = totals.get(row.transno) || 0;
    const received = paid.get(row.transno) || 0;
    return { ...row, total, paid: received, balance: total - received };
  });
}

async function listResource(req, res) {
  try {
    const result = await queryResource(req.params.resource, req.query);
    if (req.params.resource === 'sales') result.data = await enrichSales(result.data);
    return ok(res, result.data, { count: result.count, access: { role: req.user.role, rights: req.user.rights || {} } });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ status: 'error', message: error.message });
    return fail(res, error, 'Records could not be loaded.');
  }
}

async function getResource(req, res) {
  try {
    const key = parseKey(req.params.resource, req.params.key);
    if (!key) return res.status(400).json({ status: 'error', message: 'Invalid record key.' });
    const config = resourceFor(req.params.resource);
    let query = supabase.from(config.table).select('*');
    for (const [field, value] of Object.entries(key)) query = query.eq(field, value);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data || data.is_deleted) return res.status(404).json({ status: 'error', message: 'Record not found.' });
    return ok(res, withVersion(data), { access: { role: req.user.role, rights: req.user.rights || {} } });
  } catch (error) { return fail(res, error, 'Record could not be loaded.'); }
}

function allowedPayload(name, body, creating) {
  const config = resourceFor(name);
  const payload = {};
  const allowed = new Set([...config.pk, ...config.fields]);
  for (const [field, value] of Object.entries(body || {})) {
    if (allowed.has(field) && !(creating && schema.autoCodes[name]?.field === field)) payload[field] = value;
  }
  return payload;
}

async function checkVersion(table, key, req) {
  const raw = req.get('if-match');
  if (!raw) return null;
  let expected;
  try { expected = JSON.parse(raw); } catch { expected = raw; }
  let query = supabase.from(table).select('updated_at');
  for (const [field, value] of Object.entries(key)) query = query.eq(field, value);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return 'Record no longer exists.';
  if (String(data.updated_at || '') !== String(expected || '')) return 'This record changed elsewhere. Reload it before saving.';
  return null;
}

async function createResource(req, res) {
  const name = req.params.resource;
  const config = resourceFor(name);
  try {
    if (!config) return res.status(404).json({ status: 'error', message: 'Unknown resource.' });
    const payload = allowedPayload(name, req.body, true);
    if (schema.autoCodes[name]) payload[schema.autoCodes[name].field] = req.body[schema.autoCodes[name].field] || await nextCode(name, req.body._code_prefix);
    for (const field of config.pk) if (!payload[field]) return res.status(400).json({ status: 'error', message: `${schema.fields[field][0]} is required.` });
    if (name === 'sales' && Array.isArray(req.body.lines)) {
      const { lines, ...sale } = req.body;
      if (!Array.isArray(lines) || !lines.length || lines.length > 100) {
        return res.status(400).json({ status: 'error', message: 'A sale must contain between 1 and 100 lines.' });
      }
      const { data: created, error } = await supabase.rpc('create_sale_with_lines', {
        p_sale: sale,
        p_lines: lines,
      });
      if (error) throw error;
      return res.status(201).json({ status: 'success', data: withVersion(created) });
    }
    const { data, error } = await supabase.from(config.table).insert(payload).select('*').single();
    if (error) throw error;
    return res.status(201).json({ status: 'success', data: withVersion(data) });
  } catch (error) { return fail(res, error, 'Record could not be created.'); }
}

async function updateResource(req, res) {
  const name = req.params.resource;
  const config = resourceFor(name);
  const key = parseKey(name, req.params.key);
  if (!config || !key) return res.status(400).json({ status: 'error', message: 'Invalid resource or record key.' });
  try {
    const conflict = await checkVersion(config.table, key, req);
    if (conflict) return res.status(409).json({ status: 'error', message: conflict });
    const payload = allowedPayload(name, req.body, false);
    if (Object.keys(payload).length === 0) return res.status(400).json({ status: 'error', message: 'No editable fields were provided.' });
    let query = supabase.from(config.table).update(payload);
    for (const [field, value] of Object.entries(key)) query = query.eq(field, value);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return ok(res, withVersion(data));
  } catch (error) { return fail(res, error, 'Record could not be updated.'); }
}

async function setDeleted(req, res, isDeleted) {
  const config = resourceFor(req.params.resource);
  const key = parseKey(req.params.resource, req.params.key);
  if (!config || !key) return res.status(400).json({ status: 'error', message: 'Invalid resource or record key.' });
  try {
    const conflict = await checkVersion(config.table, key, req);
    if (conflict) return res.status(409).json({ status: 'error', message: conflict });
    let query = supabase.from(config.table).update({ is_deleted: isDeleted });
    for (const [field, value] of Object.entries(key)) query = query.eq(field, value);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return ok(res, withVersion(data));
  } catch (error) { return fail(res, error, 'Record status could not be changed.'); }
}

async function nextCode(name, requestedPrefix) {
  const config = resourceFor(name);
  const rule = schema.autoCodes[name];
  if (!config || !rule) throw new Error('Automatic code is not configured for this resource.');
  const prefixes = name === 'products' ? ['AD', 'AK', 'AM', 'PR'] : [rule.prefix];
  const prefix = requestedPrefix && prefixes.includes(requestedPrefix) ? requestedPrefix : rule.prefix;
  const { data, error } = await supabase.rpc('next_entity_code', {
    p_resource: name,
    p_prefix: prefix,
    p_width: rule.width,
  });
  if (error) throw error;
  return data;
}

async function codePreview(req, res) {
  try {
    const config = resourceFor(req.params.resource);
    const rule = schema.autoCodes[req.params.resource];
    if (!rule) return res.status(404).json({ status: 'error', message: 'No automatic code is configured.' });
    const prefixes = req.params.resource === 'products' ? ['AD', 'AK', 'AM', 'PR'] : [rule.prefix];
    const prefix = prefixes.includes(req.query.prefix) ? req.query.prefix : rule.prefix;
    const { data: code, error } = await supabase.rpc('peek_entity_code', {
      p_resource: req.params.resource,
      p_prefix: prefix,
      p_width: rule.width,
    });
    if (error) throw error;
    return ok(res, { code, prefix, prefixes });
  } catch (error) { return fail(res, error, 'A record code could not be generated.'); }
}

async function lookup(req, res) {
  const lookupConfigs = {
    customers: ['customer', 'custno', ['custno', 'custname'], 'custname'],
    products: ['product', 'prodcode', ['prodcode', 'description'], 'description'],
    employees: ['employee', 'empno', ['empno', 'firstname', 'lastname'], 'lastname'],
    departments: ['department', 'deptcode', ['deptcode', 'deptname'], 'deptname'],
    jobs: ['job', 'jobcode', ['jobcode', 'jobdesc'], 'jobdesc'],
    sales: ['sales', 'transno', ['transno', 'salesdate'], 'salesdate'],
  };
  const config = lookupConfigs[req.params.name];
  if (!config) return res.status(404).json({ status: 'error', message: 'Unknown lookup.' });
  try {
    const { data, error, count } = await supabase.from(config[0]).select('*', { count: 'exact' })
      .eq('is_deleted', false).order(config[3]).range(Number(req.query.offset) || 0, (Number(req.query.offset) || 0) + 199);
    if (error) {
      if (/is_deleted/.test(error.message)) {
        const retry = await supabase.from(config[0]).select('*', { count: 'exact' })
          .order(config[3]).range(Number(req.query.offset) || 0, (Number(req.query.offset) || 0) + 199);
        if (retry.error) throw retry.error;
        return ok(res, retry.data, { count: retry.count || retry.data.length });
      }
      throw error;
    }
    return ok(res, data || [], { count: count || 0 });
  } catch (error) { return fail(res, error, 'Lookup choices could not be loaded.'); }
}

async function salePrice(req, res) {
  const { product, date } = req.query;
  if (!product || !date) return res.status(400).json({ status: 'error', message: 'Product and sale date are required.' });
  try {
    const { data, error } = await supabase.from('pricehist').select('prodcode, effdate, unitprice')
      .eq('is_deleted', false).eq('prodcode', product).lte('effdate', date).order('effdate', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return ok(res, data);
  } catch (error) { return fail(res, error, 'The effective product price could not be loaded.'); }
}

async function bootstrap(req, res) {
  const screen = req.query.screen || 'dashboard';
  if (!schema.groups[screen]) return res.status(404).json({ status: 'error', message: 'Unknown workspace.' });
  const view = req.query.view && schema.groups[screen].includes(req.query.view)
    ? req.query.view : schema.groups[screen][0];
  if (screen === 'user-management' || screen === 'administrator') {
    if (!['admin', 'superadmin'].includes(req.user.role)) return res.status(403).json({ status: 'error', message: 'Administrator privileges required.' });
  } else if (screen !== 'dashboard') {
    const resource = resourceFor(view);
    if (resource && !(['admin', 'superadmin'].includes(req.user.role) || req.user.rights?.[`${resource.module}.view`] === true)) {
      return res.status(403).json({ status: 'error', message: `Access denied. Required permission: ${resource.module}.view.` });
    }
    if (screen === 'reports' && !(['admin', 'superadmin'].includes(req.user.role) || req.user.rights?.['reports.view'] === true)) {
      return res.status(403).json({ status: 'error', message: 'Access denied to reports.' });
    }
  }
  let records = null;
  if (view && resourceFor(view)) records = await queryResource(view, req.query);
  const user = {
    id: req.user.id, email: req.user.email, username: req.user.username,
    name: req.user.name, role: req.user.role, status: req.user.status,
    rights: req.user.rights || {}, permission_role_id: req.user.permission_role_id,
  };
  return ok(res, { user, schema, view, records }, { access: { role: user.role, rights: user.rights } });
}

async function dashboard(req, res) {
  try {
    const counts = {};
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    for (const [name, config] of Object.entries(schema.resources)) {
      if (!isAdmin && req.user.rights?.[`${config.module}.view`] !== true) continue;
      const { count, error } = await supabase.from(config.table).select('*', { count: 'exact', head: true }).eq('is_deleted', false);
      if (error) throw error;
      counts[name] = count || 0;
    }
    if (isAdmin) {
      const { count, error } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_deleted', false);
      if (error) throw error;
      counts.users = count || 0;
    }
    return ok(res, { counts }, { access: { role: req.user.role, rights: req.user.rights || {} } });
  } catch (error) { return fail(res, error, 'Dashboard data could not be loaded.'); }
}

async function report(req, res) {
  const permissionMap = {
    'top-customers': 'reports.topCustomers',
    'product-master-list': 'reports.productMaster',
    'top-products': 'reports.topProducts',
    'active-employees': 'reports.activeEmployees',
    'all-employees': 'reports.allEmployees',
    'employee-job-history': 'reports.empJobHistory',
    'top-sales': 'reports.topSales',
  };
  const permission = permissionMap[req.params.name];
  const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
  if (!permission || !(isAdmin || (req.user.rights?.['reports.view'] === true && req.user.rights?.[permission] === true))) {
    return res.status(permission ? 403 : 404).json({ status: 'error', message: permission ? 'Report access denied.' : 'Unknown report.' });
  }
  try {
    const top = Math.max(1, Math.min(100, Number(req.query.top) || 10));
    const inRange = (value) => (!req.query.from || value >= req.query.from) && (!req.query.to || value <= req.query.to);
    let data;
    if (req.params.name === 'product-master-list') {
      const { data: rows, error } = await supabase.from('product').select('*').eq('is_deleted', false).limit(5000);
      if (error) throw error;
      data = rows;
    } else if (req.params.name === 'active-employees' || req.params.name === 'all-employees') {
      let query = supabase.from('employee').select('*').eq('is_deleted', false).limit(5000);
      const { data: rows, error } = await query;
      if (error) throw error;
      data = req.params.name === 'active-employees' ? rows.filter((row) => !row.sepdate) : rows;
    } else if (req.params.name === 'employee-job-history') {
      if (!req.query.employee) return res.status(400).json({ status: 'error', message: 'Select an employee for this report.' });
      const { data: rows, error } = await supabase.from('jobhistory').select('*').eq('is_deleted', false)
        .eq('empno', req.query.employee).limit(5000);
      if (error) throw error;
      data = rows.filter((row) => inRange(row.effdate));
    } else if (req.params.name === 'top-sales') {
      const { data: rows, error } = await supabase.from('sales').select('*').eq('is_deleted', false).limit(5000);
      if (error) throw error;
      data = (await enrichSales(rows.filter((row) => inRange(row.salesdate))))
        .sort((a, b) => b.total - a.total).slice(0, top);
    } else if (req.params.name === 'top-customers') {
      const { data: sales, error } = await supabase.from('sales').select('*').eq('is_deleted', false).limit(5000);
      if (error) throw error;
      const enriched = await enrichSales(sales.filter((row) => inRange(row.salesdate)));
      const totals = new Map();
      for (const sale of enriched) totals.set(sale.custno, (totals.get(sale.custno) || 0) + sale.total);
      const { data: customers, error: customerError } = await supabase.from('customer').select('*').eq('is_deleted', false);
      if (customerError) throw customerError;
      data = customers.map((customer) => ({ ...customer, sales_total: totals.get(customer.custno) || 0 }))
        .sort((a, b) => b.sales_total - a.sales_total).slice(0, top);
    } else {
      const [{ data: products, error: productError }, { data: details, error: detailError }, { data: sales, error: salesError }] = await Promise.all([
        supabase.from('product').select('*').eq('is_deleted', false),
        supabase.from('salesdetail').select('transno, prodcode, quantity').eq('is_deleted', false),
        supabase.from('sales').select('transno, salesdate').eq('is_deleted', false),
      ]);
      if (productError) throw productError;
      if (detailError) throw detailError;
      if (salesError) throw salesError;
      const saleDates = new Map((sales || []).map((sale) => [sale.transno, sale.salesdate]));
      const totals = new Map();
      for (const detail of details || []) {
        if (inRange(saleDates.get(detail.transno) || '')) totals.set(detail.prodcode, (totals.get(detail.prodcode) || 0) + Number(detail.quantity || 0));
      }
      data = (products || []).map((product) => ({ ...product, quantity_sold: totals.get(product.prodcode) || 0 }))
        .sort((a, b) => b.quantity_sold - a.quantity_sold).slice(0, top);
    }
    return ok(res, cleanRows(data), { count: data.length, access: { role: req.user.role, rights: req.user.rights || {} } });
  } catch (error) { return fail(res, error, 'Report could not be generated.'); }
}

module.exports = {
  schema, listResource, getResource, createResource, updateResource,
  deleteResource: (req, res) => setDeleted(req, res, true),
  restoreResource: (req, res) => setDeleted(req, res, false),
  codePreview, lookup, salePrice, bootstrap, dashboard, report,
  queryResource, nextCode, enrichSales,
};
