const session = require('express-session');
const supabase = require('../config/supabase');

class SupabaseSessionStore extends session.Store {
  get(sid, callback) {
    supabase.from('app_sessions').select('session_data, expires_at')
      .eq('session_id', sid).maybeSingle()
      .then(({ data, error }) => {
        if (error) return callback(error);
        if (!data || new Date(data.expires_at) <= new Date()) {
          if (data) this.destroy(sid, () => {});
          return callback(null, null);
        }
        return callback(null, data.session_data);
      })
      .catch(callback);
  }

  set(sid, value, callback = () => {}) {
    const expires = value.cookie?.expires ? new Date(value.cookie.expires) : new Date(Date.now() + 86400000);
    supabase.from('app_sessions').upsert({
      session_id: sid,
      session_data: value,
      expires_at: expires.toISOString(),
    }, { onConflict: 'session_id' }).then(({ error }) => callback(error || null)).catch(callback);
  }

  touch(sid, value, callback = () => {}) {
    this.set(sid, value, callback);
  }

  destroy(sid, callback = () => {}) {
    supabase.from('app_sessions').delete().eq('session_id', sid)
      .then(({ error }) => callback(error || null)).catch(callback);
  }
}

module.exports = SupabaseSessionStore;
