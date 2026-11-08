const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const path = require('path');

require('dotenv').config();

const supabase = require('./config/supabase');
const SupabaseSessionStore = require('./utils/supabase-session-store');

const app = express();
const PORT = process.env.PORT || 5000;
const production = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;

app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_ORIGINS ||
  'http://localhost:5000,http://localhost:5500,http://127.0.0.1:5000,http://127.0.0.1:5500')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

if (production && !sessionSecret) throw new Error('SESSION_SECRET must be configured in production.');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(
  session({
    name: 'hope.sid',
    secret: sessionSecret || 'local-development-only-session-secret-change-me',
    store: new SupabaseSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: production,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const uiRoutes = require('./routes/ui.routes');
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', dashboardRoutes);

app.get('/api/health', async (req, res, next) => {
  try {
    const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' });
    if (error) throw error;
    res.status(200).json({
      status: 'success',
      message: 'API and database are available.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

app.use('/api', uiRoutes);

const frontend = path.join(__dirname, '../UI-UX');
app.use('/UI-UX', express.static(frontend));
app.use(express.static(frontend));
app.get(['/set-password', '/reset-password'], (req, res) => {
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(`/reset-password.html${query}`);
});

app.use('/api', (req, res) => res.status(404).json({ status: 'error', message: 'API endpoint not found.' }));
app.use((err, req, res, next) => {
  console.error('Request error:', err.message);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  return res.status(status).json({
    status: 'error',
    message: status >= 500 ? 'The server could not complete the request.' : err.message,
  });
});

if (require.main === module) app.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;