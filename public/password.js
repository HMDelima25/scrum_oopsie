const form = document.querySelector("#password-form");
const message = document.querySelector("#message");
const params = new URLSearchParams(location.hash.slice(1));
const token = params.get("token");
history.replaceState(null, "", location.pathname);
if (!token) {
  form.hidden = true;
  message.textContent =
    "This link is missing its token. Request a fresh account setup or password reset link.";
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.querySelector("#password");
  const confirm = document.querySelector("#confirm");
  if (password.value !== confirm.value) {
    message.textContent = "The passwords do not match.";
    confirm.focus();
    return;
  }
  if (new TextEncoder().encode(password.value).length > 72) {
    message.textContent = "Choose a password no longer than 72 UTF-8 bytes.";
    password.focus();
    return;
  }
  const button = form.querySelector("button");
  button.disabled = true;
  message.textContent = "Saving…";
  try {
    const response = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, newPassword: password.value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    form.reset();
    form.hidden = true;
    message.textContent = result.message;
  } catch (error) {
    message.textContent =
      error.message || "Could not save your password. Try again.";
  } finally {
    button.disabled = false;
  }
});
