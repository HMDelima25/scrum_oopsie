const requireAdmin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized. Please log in first.' });
  }

  if (req.session.userRole !== 'admin' && req.session.userRole !== 'superadmin') {
    return res.status(403).json({ status: 'error', message: 'Access denied. Administrator privileges required.' });
  }

  next();
};

module.exports = {
  requireAdmin,
};