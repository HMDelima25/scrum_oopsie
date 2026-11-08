const form = document.querySelector("#reset-form");
const newPassword = document.querySelector("#new-password");
const confirmPassword = document.querySelector("#confirm-new-password");
const message = document.querySelector("#reset-message");
const submitButton = document.querySelector("#reset-submit");

const MIN_PASSWORD_LENGTH = 8;

// Read the token from the emailed link, then remove it from the address bar
// so it does not stay in the browser history.
const token = new URLSearchParams(window.location.search).get("token");
window.history.replaceState(null, "", window.location.pathname);

function setError(input, text) {
  const error = document.querySelector(`#${input.id}-error`);
  if (error) error.textContent = text;
  input.setAttribute("aria-invalid", String(Boolean(text)));
}

if (!token) {
  message.textContent = "This reset link is missing its token. Request a new link from the sign-in page.";
  submitButton.disabled = true;
}

[newPassword, confirmPassword].forEach((input) =>
  input.addEventListener("input", () => {
    setError(input, "");
    message.textContent = "";
  }),
);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError(newPassword, "");
  setError(confirmPassword, "");
  if (!token) return;

  if (newPassword.value.length < MIN_PASSWORD_LENGTH) {
    setError(newPassword, `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    newPassword.focus();
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    setError(confirmPassword, "Passwords do not match.");
    confirmPassword.focus();
    return;
  }

  message.textContent = "Saving your new password...";
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token, newPassword: newPassword.value }),
    });

    let result = {};
    try {
      result = await response.json();
    } catch (parseError) {
      // Non-JSON response; fall through to the generic message.
    }

    if (response.ok) {
      message.textContent = "Password updated. Taking you to the sign-in page...";
      window.setTimeout(() => window.location.assign("index.html"), 2500);
      return;
    }

    message.textContent = result.message || `Could not reset the password (Status: ${response.status}).`;
  } catch (error) {
    console.error("Network error:", error);
    message.textContent = "Unable to connect to the server. Make sure the backend is running.";
  }

  submitButton.disabled = false;
});