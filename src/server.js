const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

require('dotenv').config();

const supabase = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(helmet());

// FIX 1: Configure CORS to allow cookies / credentials from your frontend
app.use(cors({
  origin: ['http://localhost:5000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://192.168.8.138:5500', 'http://127.0.0.1:5000', 'http://192.168.8.138:5000'], // Allows requests from any local frontend origin (file://, localhost:5500, etc.)
  credentials: true // Crucial for express-session cookies to save in the browser!
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const session = require('express-session');

// express-session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'super_secret_key_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // true if HTTPS in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day session validity
    },
  })
);

// --- Import Routes ---
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes'); // <-- FIX 2: Import admin routes
const dashboardRoutes = require('./routes/dashboard.routes'); // Dashboard data for the admin UI

// --- Use Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes); // <-- FIX 2: Mount admin routes
app.use('/api', dashboardRoutes); // GET /api/ui-dashboard-data

// --- Health Check Route ---
app.get('/api/health', async (req, res) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Server is running and connected to Supabase framework!',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: err.message,
    });
  }
});

// New edit
const path = require('path');
app.use(express.static(path.join(__dirname, '../UI-UX')));
// The live dashboard scripts use absolute /UI-UX/... paths, so serve the folder there too.
app.use('/UI-UX', express.static(path.join(__dirname, '../UI-UX')));

app.get('/api/test', (req, res) => {
  res.json({ status: 'success', message: 'API is working!' });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});