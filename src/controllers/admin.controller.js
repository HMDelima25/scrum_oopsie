const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/mailer');

// @desc    Get user list (Admins see only 'user' role; Superadmins see 'user' and 'admin')
const getUsersList = async (req, res) => {
  try {
    let query = supabase.from('users').select('id, email, username, name, status, role, rights, permission_role_id, is_deleted, stamp, created_at, updated_at');

    if (req.session.userRole === 'admin') {
      query = query.eq('role', 'user');
    } else if (req.session.userRole === 'superadmin') {
      query = query.neq('role', 'superadmin');
    }

    const { data: users, error } = await query;

    if (error) throw error;
    let rows = users || [];
    if (req.query.status !== 'all') {
      const active = req.query.status !== 'inactive';
      rows = rows.filter((row) => active
        ? !row.is_deleted && row.status === 'approved'
        : row.is_deleted || row.status !== 'approved');
    }
    const search = String(req.query.q || '').toLowerCase();
    if (search) rows = rows.filter((row) => [row.name, row.email, row.username, row.role, row.status].some((value) => String(value || '').toLowerCase().includes(search)));
    const count = rows.length;
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    const limit = Math.max(1, Math.min(200, Number.parseInt(req.query.limit, 10) || 50));
    const sort = ['name', 'email', 'username', 'role', 'status', 'created_at'].includes(req.query.sort) ? req.query.sort : 'name';
    const direction = req.query.direction === 'desc' ? -1 : 1;
    rows.sort((a, b) => String(a[sort] || '').localeCompare(String(b[sort] || ''), undefined, { numeric: true }) * direction);

    return res.status(200).json({
      status: 'success',
      count,
      data: rows.slice(offset, offset + limit).map((user) => ({ ...user, updated_at: user.updated_at || user.stamp })),
      access: { role: req.session.userRole, rights: req.session.rights || {} },
    });
  } catch (err) {
    console.error('Get Users Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

// @desc    Admin/Superadmin adds a new user directly
const addUser = async (req, res) => {
  try {
    const { email, name, username, password, role = 'user', status } = req.body;

    if (!email || !name) {
      return res.status(400).json({ status: 'error', message: 'Please provide email and name.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ status: 'error', message: 'Please provide a valid email address.' });
    }
    if (username && !/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username)) {
      return res.status(400).json({ status: 'error', message: 'Username must be 3-32 characters and start with a letter.' });
    }
    if (password && (String(password).length < 8 || Buffer.byteLength(String(password), 'utf8') > 72)) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
    }
    if (!['user', 'admin'].includes(role) && !(req.session.userRole === 'superadmin' && role === 'superadmin')) {
      return res.status(400).json({ status: 'error', message: 'Invalid role.' });
    }
    const accountStatus = status || (password ? 'approved' : 'pending');
    if (!['pending', 'approved', 'blocked'].includes(accountStatus)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status.' });
    }

    if (req.session.userRole === 'admin' && role !== 'user') {
      return res.status(403).json({ status: 'error', message: 'Admins can only create standard user accounts.' });
    }

    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email.trim())
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'User with this email already exists.' });
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        email: email.trim().toLowerCase(),
        username: username ? username.toLowerCase() : null,
        name: name.trim(),
        password_hash: hashedPassword,
        status: accountStatus,
        role,
      }])
      .select('id, email, username, name, status, role, rights, permission_role_id, stamp, created_at, updated_at')
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      status: 'success',
      message: 'User successfully created by administrator.',
      data: { ...newUser, updated_at: newUser.updated_at || newUser.stamp },
    });

  } catch (err) {
    console.error('Add User Error:', err.message);
    if (err.code === '23505') return res.status(409).json({ status: 'error', message: 'That email or username is already in use.' });
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

const sendSetupLink = async (req, res) => {
  try {
    const { data: user, error } = await supabase.from('users').select('id, email, role, status')
      .eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!user || user.role === 'superadmin') {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    if (req.session.userRole === 'admin' && user.role !== 'user') {
      return res.status(403).json({ status: 'error', message: 'Admins can only send setup links to standard users.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const { error: updateError } = await supabase.from('users').update({
      reset_token: crypto.createHash('sha256').update(token).digest('hex'),
      reset_token_expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }).eq('id', user.id);
    if (updateError) throw updateError;
    const delivered = await sendPasswordResetEmail(user.email, token);
    return res.json({
      status: 'success',
      message: delivered ? 'Password setup link sent.' : 'Setup link generated. Check the backend log in development.',
    });
  } catch (err) {
    console.error('Send Setup Link Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Setup link could not be sent.' });
  }
};

const getAuditLog = async (req, res) => {
  try {
    const [events, business] = await Promise.all([
      supabase.from('app_audit_events').select('*').order('action_at', { ascending: false }).limit(200),
      supabase.from('audit_log').select('audit_id, table_name, action, record_key, old_values, new_values, action_by, action_at')
        .order('action_at', { ascending: false }).limit(200),
    ]);
    if (events.error) throw events.error;
    if (business.error) throw business.error;
    const data = [...(events.data || []), ...(business.data || []).map((row) => ({ ...row, id: row.audit_id }))]
      .sort((a, b) => String(b.action_at).localeCompare(String(a.action_at))).slice(0, 200);
    return res.json({ status: 'success', data, count: data.length });
  } catch (err) {
    console.error('Get Audit Log Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Audit history could not be loaded.' });
  }
};

const getSettings = async (req, res) => {
  try {
    const { data, error } = await supabase.from('app_settings').select('key, value').order('key');
    if (error) throw error;
    return res.json({ status: 'success', data: data || [] });
  } catch (err) {
    console.error('Get Settings Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Settings could not be loaded.' });
  }
};

const updateSetting = async (req, res) => {
  const allowed = ['company_name', 'company_address', 'report_footer'];
  if (!allowed.includes(req.params.key) || typeof req.body?.value !== 'string' || req.body.value.length > 1000) {
    return res.status(400).json({ status: 'error', message: 'Invalid setting.' });
  }
  try {
    const { data, error } = await supabase.from('app_settings').upsert({
      key: req.params.key, value: req.body.value, updated_by: req.session.userId,
    }, { onConflict: 'key' }).select('key, value').single();
    if (error) throw error;
    return res.json({ status: 'success', data });
  } catch (err) {
    console.error('Update Setting Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Setting could not be saved.' });
  }
};

// @desc    Edit user details (Name, Email, Role, Status) with Last Superadmin Protection
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, status, role } = req.body;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ status: 'error', message: 'Please provide a valid email address.' });
    }

    // 1. Fetch target user
    const { data: targetUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    // 2. Enforce Admin restrictions
    if (req.session.userRole === 'admin' && targetUser.role !== 'user') {
      return res.status(403).json({ status: 'error', message: 'Admins can only modify standard user accounts.' });
    }

    if (req.session.userId === id) {
      return res.status(400).json({ status: 'error', message: 'You cannot modify your own account via user management.' });
    }

    const expectedVersion = req.get('if-match');
    if (expectedVersion) {
      let expected;
      try { expected = JSON.parse(expectedVersion); } catch { expected = expectedVersion; }
      if (String(targetUser.updated_at || targetUser.stamp || '') !== String(expected || '')) {
        return res.status(409).json({ status: 'error', message: 'This user changed elsewhere. Reload the record before saving.' });
      }
    }

    // 3. SAFETY CHECK: If target user is a superadmin, ensure we don't demote or block them if they are the LAST superadmin
    if (targetUser.role === 'superadmin') {
      const isDemoting = role && role !== 'superadmin';
      const isBlocking = status && status !== 'approved';

      if (isDemoting || isBlocking) {
        // Count how many active superadmins exist
        const { data: superadmins, error: countError } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'superadmin')
          .eq('status', 'approved');

        if (countError) throw countError;

        if (superadmins.length <= 1) {
          return res.status(400).json({
            status: 'error',
            message: 'Action denied. You cannot demote or block the last remaining active Superadmin.',
          });
        }
      }
    }

    // 4. Build update payload dynamically
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = String(email).trim().toLowerCase();
    if (status) {
      if (!['pending', 'approved', 'blocked'].includes(status)) {
        return res.status(400).json({ status: 'error', message: 'Invalid status value.' });
      }
      updateData.status = status;
    }
    if (role) {
      if (req.session.userRole === 'admin') {
        return res.status(403).json({ status: 'error', message: 'Admins cannot change user roles.' });
      }
      if (!['user', 'admin', 'superadmin'].includes(role)) {
        return res.status(400).json({ status: 'error', message: 'Invalid role value.' });
      }
      updateData.role = role;
    }
    if (!Object.keys(updateData).length) {
      return res.status(400).json({ status: 'error', message: 'No editable fields were provided.' });
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, email, name, status, role, rights, permission_role_id, stamp, updated_at')
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      status: 'success',
      message: 'User updated successfully.',
      data: { ...updatedUser, updated_at: updatedUser.updated_at || updatedUser.stamp },
    });

  } catch (err) {
    console.error('Update User Error:', err.message);
    if (err.code === '23505') return res.status(409).json({ status: 'error', message: 'That email or username is already in use.' });
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

// @desc    Quick Block / Unblock user status with Last Superadmin Protection
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'blocked' or 'pending'

    if (!['approved', 'blocked', 'pending'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status.' });
    }

    const { data: targetUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', id)
      .single();

    if (!targetUser) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    if (req.session.userRole === 'admin' && targetUser.role !== 'user') {
      return res.status(403).json({ status: 'error', message: 'Admins can only block/unblock standard users.' });
    }
    if (req.session.userId === id && status !== 'approved') {
      return res.status(400).json({ status: 'error', message: 'You cannot block or suspend your own account.' });
    }

    // SAFETY CHECK: If blocking a superadmin, ensure they aren't the last one
    if (targetUser.role === 'superadmin' && status !== 'approved') {
      const { data: superadmins, error: countError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'superadmin')
        .eq('status', 'approved');

      if (countError) throw countError;

      if (superadmins.length <= 1) {
        return res.status(400).json({
          status: 'error',
          message: 'Action denied. You cannot block or suspend the last remaining active Superadmin.',
        });
      }
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, email, name, status, role')
      .single();

    if (error) throw error;

    return res.status(200).json({
      status: 'success',
      message: `User status changed to '${status}' successfully.`,
      data: updatedUser,
    });

  } catch (err) {
    console.error('Toggle Status Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

// @desc    Get specific user's rights/permissions
const getUserRights = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: targetUser, error } = await supabase
      .from('users')
      .select('id, email, name, role, rights, permission_role_id')
      .eq('id', id)
      .single();

    if (error || !targetUser) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    // Admin restriction check
    if (req.session.userRole === 'admin' && targetUser.role !== 'user') {
      return res.status(403).json({ status: 'error', message: 'Admins can only view standard user rights.' });
    }

    return res.status(200).json({
      status: 'success',
      data: targetUser.rights || {},
    });
  } catch (err) {
    console.error('Get User Rights Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

// @desc    Update user rights by module and log action in audit_log
const updateUserRights = async (req, res) => {
  try {
    const { id } = req.params;
    const { rights } = req.body; // Expected format: { Customer: {create: true, read: true, ...}, Product: {...}, ... }

    if (!rights || typeof rights !== 'object') {
      return res.status(400).json({ status: 'error', message: 'Invalid rights payload provided.' });
    }

    // 1. Fetch target user
    const { data: targetUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    // 2. Enforce Admin restrictions
    if (req.session.userRole === 'admin' && targetUser.role !== 'user') {
      return res.status(403).json({ status: 'error', message: 'Admins can only modify standard user rights.' });
    }

    // 3. Update user's rights in Supabase
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ rights })
      .eq('id', id)
      .select('id, email, name, rights')
      .single();

    if (updateError) throw updateError;

    // 4. Log the rights change in audit_log
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert([{
        admin_id: req.session.userId,
        target_user_id: id,
        action: 'UPDATE_USER_RIGHTS',
        details: { new_rights: rights },
      }]);

    if (auditError) {
      console.error('Audit Log Error:', auditError.message);
      // Non-blocking, but good to catch
    }

    return res.status(200).json({
      status: 'success',
      message: 'User rights updated and logged successfully.',
      data: updatedUser,
    });

  } catch (err) {
    console.error('Update User Rights Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

module.exports = {
  getUsersList,
  addUser,
  updateUser,
  getUserRights,
  updateUserRights,
  toggleUserStatus,
  sendSetupLink,
  getAuditLog,
  getSettings,
  updateSetting,
};