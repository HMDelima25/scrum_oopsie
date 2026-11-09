const session = require("express-session");
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
        if (error) return cb(new Error("Session storage unavailable."));
        cb(
          null,
          data && Date.parse(data.expires_at) > Date.now() ? data.sess : null,
        );
      })
      .catch(cb);
  }
  set(sid, sess, cb = () => {}) {
    const expires_at =
      sess.cookie.expires || new Date(Date.now() + 86400000).toISOString();
    this.db
      .from("app_session")
      .upsert({ sid, sess, expires_at })
      .then(({ error }) =>
        cb(error ? new Error("Session storage unavailable.") : null),
      )
      .catch(cb);
  }
  destroy(sid, cb = () => {}) {
    this.db
      .from("app_session")
      .delete()
      .eq("sid", sid)
      .then(({ error }) =>
        cb(error ? new Error("Session storage unavailable.") : null),
      )
      .catch(cb);
  }
  touch(sid, sess, cb = () => {}) {
    this.set(sid, sess, cb);
  }
}
module.exports = SupabaseSessionStore;
