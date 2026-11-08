const supabase = require('../config/supabase');
const { enrichSales } = require('./ui.controller');

// Candidate Supabase table names for each dashboard resource.
// The first name that exists in your database is used. A resource whose table
// does not exist yet simply returns an empty list (the dashboard shows zeros).
const RESOURCES = {
  customers:   { tables: ['customer', 'customers'],                    right: 'customers.view' },
  products:    { tables: ['product', 'products'],                      right: 'products.view' },
  prices:      { tables: ['pricehist', 'price_history', 'prices'],     right: 'products.view' },
  employees:   { tables: ['employee', 'employees'],                    right: 'hr.view' },
  departments: { tables: ['department', 'departments'],                right: 'hr.view' },
  jobs:        { tables: ['job', 'jobs'],                              right: 'hr.view' },
  sales:       { tables: ['sales'],                                    right: 'sales.view' },
  payments:    { tables: ['payment', 'payments'],                      right: 'sales.view' },
};

const warned = new Set();

// @desc    Dashboard bundle: signed-in user + business records the user may view
const getDashboardData = async (req, res) => {
  try {
    const user = req.user;
    const rights = user.rights || {};
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const canView = (right) => isAdmin || rights[right] === true;

    const entries = await Promise.all(
      Object.entries(RESOURCES).map(async ([key, config]) => {
        if (!canView(config.right)) return [key, []];

        let lastError;
        for (const table of config.tables) {
          const { data, error } = await supabase.from(table).select('*').eq('is_deleted', false).limit(5000);
          if (!error) return [key, data || []];
          lastError = error;
          if (error.code !== '42P01' && error.code !== 'PGRST205' && !/does not exist|not find the table/i.test(error.message)) throw error;
        }
        if (!warned.has(key)) {
          warned.add(key);
          console.warn(`[dashboard] Missing table for "${key}": ${lastError?.message || 'none found'}`);
        }
        throw lastError || new Error(`No table configured for dashboard resource "${key}".`);
      })
    );
    const records = Object.fromEntries(entries);
    if (records.sales?.length) records.sales = await enrichSales(records.sales);

    return res.status(200).json({
      status: 'success',
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, rights },
        records,
      },
      access: { role: user.role, rights },
    });
  } catch (err) {
    console.error('Dashboard Data Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Records could not be loaded.' });
  }
};

module.exports = { getDashboardData };