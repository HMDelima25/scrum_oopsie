const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ status: 'error', message: 'Invalid email or user not found.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ status: 'error', message: 'Access denied. Your account has been blocked.' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ status: 'error', message: 'Account is pending Superadmin approval.' });
    }

    if (!user.password_hash) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('id', user.id);

      if (updateError) throw updateError;

      user.password_hash = hashedPassword;
    } else {
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
      }
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;

    return res.status(200).json({
      status: 'success',
      message: 'Login successful!',
      data: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status },
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
    res.clearCookie('connect.sid');
    return res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
  });
};

// @desc    Request password reset token
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: 'error', message: 'Please provide your email address.' });
    }

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    // To prevent user enumeration attacks, we can return a generic success message even if email is not found,
    // but for internal testing convenience, let's return a clear message or handle it gracefully.
    if (fetchError || !user) {
      return res.status(404).json({ status: 'error', message: 'User with this email does not exist.' });
    }

    // Generate secure random reset token (expires in 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    // Save token to database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expires: expiresAt,
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Log token to console for easy testing (in production, send via email service like Nodemailer/Resend)
    console.log(`\n🔑 [PASSWORD RESET TOKEN FOR ${email}]: ${resetToken}\n`);

    return res.status(200).json({
      status: 'success',
      message: 'Password reset token generated. Check your server console for the token (simulated email delivery).',
      // Included in response for easy local testing:
      debugToken: resetToken, 
    });

  } catch (err) {
    console.error('Password Reset Request Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.', error: err.message });
  }
};

// @desc    Reset password using token
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Please provide both token and new password.' });
    }

    // Find user with matching token and valid expiration time
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('reset_token', token)
      .single();

    if (fetchError || !user) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired password reset token.' });
    }

    // Check if token has expired
    if (new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({ status: 'error', message: 'Password reset token has expired.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token fields
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    return res.status(200).json({
      status: 'success',
      message: 'Password has been successfully reset. You can now log in with your new password.',
    });

  } catch (err) {
    console.error('Reset Password Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error during password reset.', error: err.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  requestPasswordReset,
  resetPassword,
};