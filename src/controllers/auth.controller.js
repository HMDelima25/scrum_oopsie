const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');

// @desc    Register a new user (status defaults to 'pending')
const registerUser = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ status: 'error', message: 'Please provide both email and name.' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'A user with this email already exists.' });
    }

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ email, name, status: 'pending', role: 'user' }])
      .select('id, email, name, status, role, created_at')
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      status: 'success',
      message: 'Registration successful! Your account is pending Superadmin approval.',
      data: newUser,
    });
  } catch (err) {
    console.error('Registration Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.', error: err.message });
  }
};

// @desc    Login user, handle first-time password setting, and block checks
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Please provide email and password.' });
    }

    // 1. Find user by email
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ status: 'error', message: 'Invalid email or user not found.' });
    }

    // 2. Check if user is blocked
    if (user.status === 'blocked') {
      return res.status(403).json({ status: 'error', message: 'Access denied. Your account has been blocked.' });
    }

    // 3. Check if user is still pending approval
    if (user.status === 'pending') {
      return res.status(403).json({ status: 'error', message: 'Account is pending Superadmin approval.' });
    }

    // 4. Handle First-Time Login (if password_hash is null/empty)
    if (!user.password_hash) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Save the new password
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('id', user.id);

      if (updateError) throw updateError;

      user.password_hash = hashedPassword;
    } else {
      // 5. Verify password for subsequent logins
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
      }
    }

    // 6. Create Session
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;

    return res.status(200).json({
      status: 'success',
      message: 'Login successful!',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    });

  } catch (err) {
    console.error('Login Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error during login.', error: err.message });
  }
};

// @desc    Logout user and destroy session
const logoutUser = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'Could not log out, please try again.' });
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    return res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
  });
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
};