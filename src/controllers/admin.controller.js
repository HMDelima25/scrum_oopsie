const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');

// @desc    Get user list (Admins see only 'user' role; Superadmins see 'user' and 'admin')
const getUsersList = async (req, res) => {
  try {
    let query = supabase.from('users').select('id, email, name, status, role, created_at');

    if (req.session.userRole === 'admin') {
      query = query.eq('role', 'user');
    } else if (req.session.userRole === 'superadmin') {
      query = query.neq('role', 'superadmin');
    }

    const { data: users, error } = await query;

    if (error) throw error;

    return res.status(200).json({
      status: 'success',
      count: users.length,
      data: users,
    });
  } catch (err) {
    console.error('Get Users Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

// @desc    Admin/Superadmin adds a new user directly
const addUser = async (req, res) => {
  try {
    const { email, name, password, role = 'user', status = 'approved' } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ status: 'error', message: 'Please provide email, name, and password.' });
    }

    if (req.session.userRole === 'admin' && role !== 'user') {
      return res.status(403).json({ status: 'error', message: 'Admins can only create standard user accounts.' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        email,
        name,
        password_hash: hashedPassword,
        status,
        role,
      }])
      .select('id, email, name, status, role, created_at')
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      status: 'success',
      message: 'User successfully created by administrator.',
      data: newUser,
    });

  } catch (err) {
    console.error('Add User Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

// @desc    Edit user details (Name, Email, Role, Status) with Last Superadmin Protection
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, status, role } = req.body;

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
    if (email) updateData.email = email;
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

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, email, name, status, role')
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      status: 'success',
      message: 'User updated successfully.',
      data: updatedUser,
    });

  } catch (err) {
    console.error('Update User Error:', err.message);
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
      .update({ status })
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
      .select('id, email, name, role, rights')
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
};