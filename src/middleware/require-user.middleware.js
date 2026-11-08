const supabase = require('../config/supabase');

async function loadCurrentUser(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ status: 'error', message: 'Sign in required.' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, status, rights, permission_role_id, is_deleted')
      .eq('id', req.session.userId)
      .maybeSingle();

    if (error) throw error;
    if (!user || user.is_deleted || user.status !== 'approved') {
      req.session.destroy(() => {});
      return res.status(401).json({ status: 'error', message: 'Sign in required.' });
    }

    if (user.permission_role_id && user.role === 'user') {
      const { data: role, error: roleError } = await supabase
        .from('permission_role')
        .select('rights, status')
        .eq('id', user.permission_role_id)
        .maybeSingle();
      if (roleError) throw roleError;
      user.rights = role?.status === 'active' ? (role.rights || {}) : {};
    }

    req.user = user;
    req.session.userRole = user.role;
    req.session.rights = user.rights || {};
    return next();
  } catch (error) {
    console.error('Authentication lookup failed:', error.message);
    return res.status(500).json({ status: 'error', message: 'Unable to verify your account.' });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ status: 'error', message: 'Sign in required.' });
    if (['admin', 'superadmin'].includes(req.user.role) || req.user.rights?.[permission] === true) {
      return next();
    }
    return res.status(403).json({ status: 'error', message: `Access denied. Required permission: ${permission}.` });
  };
}

function requireAdministrator(req, res, next) {
  if (['admin', 'superadmin'].includes(req.user?.role)) return next();
  return res.status(403).json({ status: 'error', message: 'Administrator privileges required.' });
}

module.exports = { loadCurrentUser, requirePermission, requireAdministrator };
