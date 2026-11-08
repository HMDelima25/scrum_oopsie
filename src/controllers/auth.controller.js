const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/mailer');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// @desc    Register a new user with password (status defaults to 'pending')
const registerUser = async (req, res) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ status: 'error', message: 'Please provide email, name, and password.' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'A user with this email already exists.' });
    }

    // Hash the password right away
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user with password_hash and 'pending' status
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        email,
        name,
        password_hash: hashedPassword,
        status: 'pending',
        role: 'user'
      }])
      .select('id, email, name, status, role, created_at')
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      status: 'success',
      message: 'Registration successful! Your account has been created and is pending Superadmin approval.',
      data: newUser,
    });
  } catch (err) {
    console.error('Registration Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.', error: err.message });
  }
};

// @desc    Login user (standard login with password comparison)
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
    req.session.rights = user.rights || {};

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

    // Always answer the same way so the form never reveals which emails are registered.
    const genericResponse = {
      status: 'success',
      message: 'If an account exists for that email, password-recovery instructions have been sent.',
    };

    if (fetchError || !user) {
      return res.status(200).json(genericResponse);
    }

    // Generate a secure random token. Only its hash is stored; the raw token goes in the email link.
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_token: hashToken(resetToken),
        reset_token_expires: expiresAt,
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    try {
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (mailErr) {
      // Logged on the server only; the visitor still gets the generic answer.
      console.error('Password reset email failed:', mailErr.message);
    }

    return res.status(200).json(genericResponse);

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

    if (String(newPassword).length < 8) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters.' });
    }

    // Find user with matching token and valid expiration time
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('reset_token', hashToken(String(token)))
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

// @desc    Get currently logged-in user session profile and rights
const getMe = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ status: 'error', message: 'Not authenticated.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, status, rights')
      .eq('id', req.session.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    return res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (err) {
    console.error('Get Me Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  requestPasswordReset,
  resetPassword,
  getMe,
};