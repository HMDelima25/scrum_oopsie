/* Shared authentication requests; credentials stay server-side. */
window.HopeAuthApi = (() => {
async function send(path, data) {
    const r = await fetch("/api/auth/" + path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await r.json();
    if (!r.ok) {
      const error = new Error(result.message);
      error.field = result.field;
      error.status = r.status;
      throw error;
    }
    return result;
  }
return { send };
})();
