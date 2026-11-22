const session = require("express-session");
function storageError(error) {
  const unavailable = new Error("Session storage unavailable.");
  if (error && typeof error.code === "string" && /^[A-Z0-9_]+$/.test(error.code))
    unavailable.code = error.code;
  return unavailable;
}
class SupabaseSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
  }
  get(sid, cb) {
    this.db
      .from("app_session")
      .select("sess,expires_at")
      .eq("sid", sid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return cb(storageError(error));
        cb(
          null,
          data && Date.parse(data.expires_at) > Date.now() ? data.sess : null,
        );
      })
      .catch((error) => cb(storageError(error)));
  }
  set(sid, sess, cb = () => {}) {
    const expires_at =
      sess.cookie.expires || new Date(Date.now() + 86400000).toISOString();
    this.db
      .from("app_session")
      .upsert({ sid, sess, expires_at })
      .then(({ error }) => cb(error ? storageError(error) : null))
      .catch((error) => cb(storageError(error)));
  }
  destroy(sid, cb = () => {}) {
    this.db
      .from("app_session")
      .delete()
      .eq("sid", sid)
      .then(({ error }) => cb(error ? storageError(error) : null))
      .catch((error) => cb(storageError(error)));
  }
  touch(sid, sess, cb = () => {}) {
    this.set(sid, sess, cb);
  }
}
module.exports = SupabaseSessionStore;
