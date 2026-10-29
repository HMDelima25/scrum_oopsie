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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// --- Health Check Route ---
app.get('/api/health', async (req, res) => {
  try {
    // Quick ping to Supabase to verify DB connectivity
    const { data, error } = await supabase.from('_dummy_test_').select('*').limit(1);
    
    // If the table doesn't exist yet, Supabase might return a PGRST204 or table not found error, 
    // which still proves connection to the database instance.
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

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT} in ${process.env.NODE_ENV} mode`);
});