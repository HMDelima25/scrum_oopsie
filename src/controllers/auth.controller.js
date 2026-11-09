const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/mailer');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// @desc    Register a new user with password (status defaults to 'pending')
const registerUser = async (req, res) => {
  try {
    const { email, name, firstName, lastName, username, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedName = String(name || [firstName, lastName].filter(Boolean).join(' ')).trim();

    if (!normalizedEmail || !normalizedName || !password) {
      return res.status(400).json({ status: 'error', message: 'Please provide email, name, and password.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ status: 'error', message: 'Please provide a valid email address.' });
    }
    if (String(password).length < 8 || Buffer.byteLength(String(password), 'utf8') > 72) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
    }
    if (username && !/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username)) {
      return res.status(400).json({ status: 'error', message: 'Username must be 3-32 characters and start with a letter.' });
    }

    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingUser) {
      return res.status(409).json({ status: 'error', message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        email: normalizedEmail,
        name: normalizedName.slice(0, 160),
        username: username ? username.toLowerCase() : null,
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
    if (err.code === '23505') return res.status(409).json({ status: 'error', message: 'That email or username is already in use.' });
    return res.status(500).json({ status: 'error', message: 'Registration could not be completed.' });
  }
};

// @desc    Login user (standard login with password comparison)
const loginUser = async (req, res) => {
  let loginStage = 'user lookup';
  try {
    const { password } = req.body;
    const identifier = String(req.body.email || req.body.identifier || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ status: 'error', message: 'Please provide an email/username and password.' });
    }
    let userQuery = supabase
      .from('users')
      .select('*');
    userQuery = identifier.includes('@')
      ? userQuery.ilike('email', identifier)
      : userQuery.ilike('username', identifier);
    const { data: user, error: fetchError } = await userQuery.maybeSingle();

    if (fetchError) throw fetchError;
    if (!user || user.is_deleted === true) {
      return res.status(401).json({ status: 'error', message: 'Invalid email/username or password.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ status: 'error', message: 'Access denied. Your account has been blocked.' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ status: 'error', message: 'Account is pending Superadmin approval.' });
    }

    if (!user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ status: 'error', message: 'Invalid email/username or password.' });
    }

    loginStage = 'session regeneration';
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => error ? reject(error) : resolve());
    });
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;
    req.session.rights = user.rights || {};

    return res.status(200).json({
      status: 'success',
      message: 'Login successful!',
      data: { id: user.id, email: user.email, username: user.username, name: user.name, role: user.role, status: user.status },
    });

  } catch (err) {
    console.error(`Login Error during ${loginStage}:`, { code: err.code, message: err.message });
    return res.status(500).json({ status: 'error', message: 'Login could not be completed.' });
  }
};

// @desc    Logout user and destroy session
const logoutUser = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'Could not log out, please try again.' });
    }
    res.clearCookie('hope.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
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
      .ilike('email', String(email).trim())
      .maybeSingle();

    // Always answer the same way so the form never reveals which emails are registered.
    const genericResponse = {
      status: 'success',
      message: 'If an account exists for that email, password-recovery instructions have been sent.',
    };

    if (fetchError) throw fetchError;
    if (!user) {
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
    return res.status(500).json({ status: 'error', message: 'Password recovery could not be completed.' });
  }
};

// @desc    Reset password using token
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Please provide both token and new password.' });
    }

    if (String(newPassword).length < 8 || Buffer.byteLength(String(newPassword), 'utf8') > 72) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
    }

    // Find user with matching token and valid expiration time
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('reset_token', hashToken(String(token)))
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!user) {
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
    return res.status(500).json({ status: 'error', message: 'Password reset could not be completed.' });
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
      .select('id, email, name, role, status, rights, permission_role_id, is_deleted')
      .eq('id', req.session.userId)
      .maybeSingle();

    if (error) throw error;
    if (!user || user.is_deleted || user.status !== 'approved') {
      return res.status(401).json({ status: 'error', message: 'Not authenticated.' });
    }
    if (user.permission_role_id && user.role === 'user') {
      const { data: role, error: roleError } = await supabase.from('permission_role')
        .select('rights, status').eq('id', user.permission_role_id).maybeSingle();
      if (roleError) throw roleError;
      user.rights = role?.status === 'active' ? role.rights : {};
    }
    delete user.is_deleted;

    return res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (err) {
    console.error('Get Me Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

const getAuthMethods = (_req, res) => res.json({
  status: 'success',
  data: { email: true, google: false },
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  requestPasswordReset,
  resetPassword,
  getMe,
  getAuthMethods,
};