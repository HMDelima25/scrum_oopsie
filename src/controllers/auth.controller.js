const supabase = require('../config/supabase');

// @desc    Register a new user (status defaults to 'pending')
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { email, name, password } = req.body;

    // 1. Basic Validation
    if (!email || !name) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide both email and name.',
      });
    }

    // 2. Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'A user with this email already exists.',
      });
    }

    // 3. Insert new user with 'pending' status
    // Note: If password is provided during registration, we can store it or handle it in Task 3. 
    // For now, we save the user record with status 'pending'.
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          email,
          name,
          status: 'pending',
          role: 'user',
          // password_hash can be added here or during first login password-set
        },
      ])
      .select('id, email, name, status, role, created_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    return res.status(201).json({
      status: 'success',
      message: 'Registration successful! Your account is currently pending approval by a Superadmin.',
      data: newUser,
    });

  } catch (err) {
    console.error('Registration Error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error during registration.',
      error: err.message,
    });
  }
};

module.exports = {
  registerUser,
};