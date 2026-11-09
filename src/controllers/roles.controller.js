const supabase = require('../config/supabase');
const { rightsCatalogue } = require('../config/ui-schema');

const replyError = (res, error, message) => {
  console.error('Role API error:', error.message);
  return res.status(500).json({ status: 'error', message });
};

async function listRoles(req, res) {
  try {
    let query = supabase.from('permission_role').select('*').order('name');
    if (req.query.status !== 'all') query = query.eq('status', 'active');
    const { data: roles, error } = await query;
    if (error) throw error;
    const { data: users, error: userError } = await supabase.from('users').select('permission_role_id').eq('is_deleted', false);
    if (userError) throw userError;
    const data = (roles || []).map((role) => ({
      ...role,
      updated_at: role.updated_at || role.stamp,
      members: (users || []).filter((user) => user.permission_role_id === role.id).length,
      permission_count: Object.values(role.rights || {}).filter(Boolean).length,
    }));
    return res.json({ status: 'success', data, count: data.length });
  } catch (error) { return replyError(res, error, 'Roles could not be loaded.'); }
}

async function getRole(req, res) {
  try {
    const { data, error } = await supabase.from('permission_role').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ status: 'error', message: 'Role not found.' });
    return res.json({ status: 'success', data: { ...data, updated_at: data.updated_at || data.stamp } });
  } catch (error) { return replyError(res, error, 'Role could not be loaded.'); }
}

async function saveRole(req, res) {
  const { name, description = '', status = 'active', rights = {} } = req.body || {};
  if (!String(name || '').trim() || String(name).length > 80 || !['active', 'inactive'].includes(status) || !rights || typeof rights !== 'object' || Array.isArray(rights)) {
    return res.status(400).json({ status: 'error', message: 'Provide a role name, valid status, and permissions.' });
  }
  const normalized = Object.fromEntries(Object.keys(rightsCatalogue).map((key) => [key, rights[key] === true]));
  for (const [key, value] of Object.entries(rights)) {
    if (!Object.hasOwn(rightsCatalogue, key) && value === true) return res.status(400).json({ status: 'error', message: `Unknown permission: ${key}.` });
  }
  try {
    if (req.params.id && req.get('if-match')) {
      let expected;
      try { expected = JSON.parse(req.get('if-match')); } catch { expected = req.get('if-match'); }
      const { data: existing, error: existingError } = await supabase.from('permission_role')
        .select('stamp, updated_at').eq('id', req.params.id).maybeSingle();
      if (existingError) throw existingError;
      if (!existing) return res.status(404).json({ status: 'error', message: 'Role not found.' });
      if (String(existing.updated_at || existing.stamp || '') !== String(expected || '')) {
        return res.status(409).json({ status: 'error', message: 'This role changed elsewhere. Reload it before saving.' });
      }
    }
    const payload = { name: String(name).trim(), description: String(description).slice(0, 500), status, rights: normalized, updated_at: new Date().toISOString() };
    const isUpdate = Boolean(req.params.id);
    let query = isUpdate
      ? supabase.from('permission_role').update(payload).eq('id', req.params.id)
      : supabase.from('permission_role').insert(payload);
    const { data, error } = await query.select('*').single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ status: 'error', message: 'A role with that name already exists.' });
      throw error;
    }
    return res.status(isUpdate ? 200 : 201).json({ status: 'success', data: { ...data, updated_at: data.updated_at || data.stamp } });
  } catch (error) { return replyError(res, error, 'Role could not be saved.'); }
}

async function catalogue(req, res) {
  return res.json({ status: 'success', data: rightsCatalogue });
}

async function setUserRights(req, res) {
  const { rights } = req.body || {};
  const targetId = req.params.id;
  if (!rights || typeof rights !== 'object' || Array.isArray(rights)) {
    return res.status(400).json({ status: 'error', message: 'Provide a valid permissions object.' });
  }
  try {
    const { data: target, error: fetchError } = await supabase.from('users').select('id, role').eq('id', targetId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!target) return res.status(404).json({ status: 'error', message: 'User not found.' });
    if (req.user.role === 'admin' && target.role !== 'user') return res.status(403).json({ status: 'error', message: 'Admins can only manage standard users.' });
    const clean = Object.fromEntries(Object.keys(rightsCatalogue).map((key) => [key, rights[key] === true]));
    for (const key of Object.keys(rights)) if (!Object.hasOwn(rightsCatalogue, key)) {
      return res.status(400).json({ status: 'error', message: `Unknown permission: ${key}.` });
    }
    const { data, error } = await supabase.from('users').update({ rights: clean, permission_role_id: null })
      .eq('id', targetId).select('id, email, name, role, rights, permission_role_id, stamp, updated_at').single();
    if (error) throw error;
    await supabase.from('app_audit_events').insert({
      action_by: req.user.id, table_name: 'users', record_key: targetId,
      action: 'UPDATE_USER_RIGHTS', new_values: clean,
    });
    return res.json({ status: 'success', data: { ...data, updated_at: data.updated_at || data.stamp } });
  } catch (error) { return replyError(res, error, 'User permissions could not be updated.'); }
}

async function assignRole(req, res) {
  const { permission_role_id: roleId } = req.body || {};
  if (!roleId) return res.status(400).json({ status: 'error', message: 'Select a permission role.' });
  try {
    const [{ data: target, error: targetError }, { data: role, error: roleError }] = await Promise.all([
      supabase.from('users').select('id, role, stamp, updated_at').eq('id', req.params.id).maybeSingle(),
      supabase.from('permission_role').select('id, status, rights').eq('id', roleId).maybeSingle(),
    ]);
    if (targetError) throw targetError;
    if (roleError) throw roleError;
    if (!target) return res.status(404).json({ status: 'error', message: 'User not found.' });
    if (!role || role.status !== 'active') return res.status(400).json({ status: 'error', message: 'Choose an active permission role.' });
    if (target.role !== 'user') return res.status(400).json({ status: 'error', message: 'Permission roles can only be assigned to standard users.' });
    const ifMatch = req.get('if-match');
    if (ifMatch) {
      let expected;
      try { expected = JSON.parse(ifMatch); } catch { expected = ifMatch; }
      if (String(target.updated_at || target.stamp || '') !== String(expected || '')) {
        return res.status(409).json({ status: 'error', message: 'This user changed elsewhere. Reload before assigning a role.' });
      }
    }
    const { data, error } = await supabase.from('users').update({
      permission_role_id: role.id, rights: role.rights || {}, updated_at: new Date().toISOString(),
    }).eq('id', target.id).select('id, email, name, role, rights, permission_role_id, stamp, updated_at').single();
    if (error) throw error;
    await supabase.from('app_audit_events').insert({
      action_by: req.user.id, table_name: 'users', record_key: target.id,
      action: 'ASSIGN_PERMISSION_ROLE', new_values: { permission_role_id: role.id },
    });
    return res.json({ status: 'success', data: { ...data, updated_at: data.updated_at || data.stamp } });
  } catch (error) { return replyError(res, error, 'Permission role could not be assigned.'); }
}

module.exports = { listRoles, getRole, saveRole, catalogue, setUserRights, assignRole };
