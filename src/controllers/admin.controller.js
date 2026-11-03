const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');

// @desc    Get user list (Admins see only 'user' role; Superadmins see 'user' and 'admin')
const getUsersList = async (req, res) => {
  try {
    let query = supabase.from('users').select('id, email, name, status, role, created_at');

    // If requester is an Admin, restrict view to regular users only (hide superadmins/admins)
    if (req.session.userRole === 'admin') {
      query = query.eq('role', 'user');
    } else if (req.session.userRole === 'superadmin') {
      // Superadmins can see users and admins, but hide other superadmins for safety
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

    // Admins cannot create admin/superadmin accounts
    if (req.session.userRole === 'admin' && role !== 'user') {
      return res.status(403).json({ status: 'error', message: 'Admins can only create standard user accounts.' });
    }

    // Check if user exists
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

// @desc    Edit user details (Name, Email, Role, Status)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, status, role } = req.body;

    // 1. Fetch target user to check permissions
    const { data: targetUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    // 2. Enforce Admin restriction (Admins cannot edit superadmins or other admins)
    if (req.session.userRole === 'admin' && targetUser.role !== 'user') {
      return res.status(403).json({ status: 'error', message: 'Admins can only modify standard user accounts.' });
    }

    // Prevent modifying own account status/role here
    if (req.session.userId === id) {
      return res.status(400).json({ status: 'error', message: 'You cannot modify your own account via user management.' });
    }

    // Build update payload dynamically
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
      if (!['user', 'admin'].includes(role)) {
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

// @desc    Quick Block / Unblock user status
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'blocked'

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

module.exports = {
  getUsersList,
  addUser,
  updateUser,
  toggleUserStatus,
};