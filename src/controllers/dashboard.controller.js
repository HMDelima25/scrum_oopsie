const supabase = require('../config/supabase');

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
    if (!req.session.userId) {
      return res.status(401).json({ status: 'error', message: 'Sign in required.' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, status, rights')
      .eq('id', req.session.userId)
      .single();

    if (userError || !user) {
      return res.status(401).json({ status: 'error', message: 'Sign in required.' });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({ status: 'error', message: 'Your account is not active.' });
    }

    const rights = user.rights || {};
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const canView = (right) => isAdmin || rights[right] === true;

    const entries = await Promise.all(
      Object.entries(RESOURCES).map(async ([key, config]) => {
        if (!canView(config.right)) return [key, []];

        for (const table of config.tables) {
          const { data, error } = await supabase.from(table).select('*').limit(5000);
          if (!error) return [key, data || []];
        }

        if (!warned.has(key)) {
          warned.add(key);
          console.warn(`[dashboard] No table found for "${key}" (tried: ${config.tables.join(', ')}). Returning an empty list.`);
        }
        return [key, []];
      })
    );

    return res.status(200).json({
      status: 'success',
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, rights },
        records: Object.fromEntries(entries),
      },
    });
  } catch (err) {
    console.error('Dashboard Data Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Records could not be loaded.' });
  }
};

module.exports = { getDashboardData };