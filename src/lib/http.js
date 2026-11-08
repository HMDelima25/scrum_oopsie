class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
function check(result) {
  if (result.error) {
    const { code } = result.error;
    const status =
      code === "42501"
        ? 403
        : code === "P0002" || code === "PGRST116"
          ? 404
          : ["23505", "40001"].includes(code)
            ? 409
            : [
                  "23503",
                  "23514",
                  "23502",
                  "22023",
                  "22007",
                  "22008",
                  "22P02",
                  "P0001",
                  "22001",
                  "22003",
                ].includes(code)
              ? 400
              : 500;
    throw new HttpError(
      status,
      status === 500 ? "Database operation failed." : result.error.message,
    );
  }
  return result.data;
}
function text(v, label, max = 160) {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw new HttpError(
      400,
      `${label} is required (maximum ${max} characters).`,
    );
  return v.trim();
}
function email(v) {
  const value = text(v, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new HttpError(400, "Enter a valid email.");
  return value;
}
function password(v) {
  if (typeof v !== "string" || v.length < 12 || Buffer.byteLength(v) > 72)
    throw new HttpError(
      400,
      "Use a password of at least 12 characters and no more than 72 UTF-8 bytes.",
    );
  return v;
}
function object(v) {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new HttpError(400, "A JSON object is required.");
  return v;
}
module.exports = { HttpError, wrap, check, text, email, password, object };
