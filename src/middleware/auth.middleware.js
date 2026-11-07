const requireAdmin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized. Please log in first.' });
  }

  if (req.session.userRole !== 'admin' && req.session.userRole !== 'superadmin') {
    return res.status(403).json({ status: 'error', message: 'Access denied. Administrator privileges required.' });
  }

  next();
};

// @desc    Check if logged-in user has specific module rights (Superadmins bypass automatically)
const checkPermission = (moduleName, action) => {
  return async (req, res, next) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized. Please log in.' });
      }

      // Superadmins have full universal access
      if (req.session.userRole === 'superadmin') {
        return next();
      }

      // Fetch fresh rights from DB or use session
      const supabase = require('../config/supabase');
      const { data: user, error } = await supabase
        .from('users')
        .select('role, rights')
        .eq('id', req.session.userId)
        .single();

      if (error || !user) {
        return res.status(403).json({ status: 'error', message: 'Access verification failed.' });
      }

      // Admins usually have management access, but can also be restricted if needed. 
      // Let's allow admins full module access or check their rights object:
      if (user.role === 'admin') {
        return next();
      }

      // Check granular rights for regular users
      const userRights = user.rights || {};
      const moduleRights = userRights[moduleName];

      if (moduleRights && moduleRights[action] === true) {
        return next(); // Permission granted!
      }

      return res.status(403).json({
        status: 'error',
        message: `Access denied. You do not have '${action}' permission for the '${moduleName}' module.`,
      });

    } catch (err) {
      console.error('Permission Middleware Error:', err.message);
      return res.status(500).json({ status: 'error', message: 'Internal server error during permission check.' });
    }
  };
};

module.exports = {
  requireAdmin,
  checkPermission, // <-- Export this
};