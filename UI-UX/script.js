const loginForm = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector(".visibility-toggle");
const formMessage = document.querySelector("#form-message");
const resetDialog = document.querySelector("#reset-dialog");
const recoveryEmail = document.querySelector("#recovery-email");
const recoveryMethodStep = document.querySelector("#reset-method-step");
const recoveryConfirmationStep = document.querySelector("#reset-confirmation-step");
const recoveryMessage = document.querySelector("#recovery-message");
const createDialog = document.querySelector("#create-dialog");
const createForm = document.querySelector("#create-form");
const createMessage = document.querySelector("#create-message");
const createPassword = document.querySelector("#create-password");
const confirmPasswordInput = document.querySelector("#confirm-password");
const passwordStrength = document.querySelector("#password-strength");
const strengthLabel = document.querySelector("#strength-label");
const strengthHint = document.querySelector("#strength-hint");

// ---------------------------------------------------------------------------
// API configuration
// ---------------------------------------------------------------------------
// - Served by Express (http://localhost:5000): use same-origin relative URLs.
// - Served elsewhere (Live Server on :5500, etc.): talk to the backend on port 5000
//   using the SAME hostname as the page, so localhost stays localhost and
//   127.0.0.1 stays 127.0.0.1 (keeps the session cookie same-site).
// - Override anytime by defining window.API_BASE before this script loads.
const API_BASE =
  window.API_BASE !== undefined
    ? window.API_BASE
    : window.location.port === "5000"
      ? ""
      : `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname || "localhost"}:5000`;

const DASHBOARD_URL = "modules/dashboard/index.html";
const MIN_PASSWORD_LENGTH = 8;

async function apiRequest(path, { method = "POST", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  // Safely parse JSON; fall back to an empty object for empty/invalid bodies.
  const text = await response.text();
  let result = {};
  try {
    if (text && text.trim().length > 0) result = JSON.parse(text);
  } catch (parseErr) {
    console.warn("Response was not valid JSON:", text);
  }

  return { ok: response.ok, status: response.status, result };
}

function setBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    if (busyText) button.textContent = busyText;
    button.disabled = true;
  } else {
    if (button.dataset.originalText) button.textContent = button.dataset.originalText;
    button.disabled = false;
  }
}

const highlights = [
  {
    kicker: "Built for daily operations",
    title: "Everything your business needs, connected.",
    description:
      "Bring customer records, product pricing, people, sales, payments, and reports together in one clear system.",
  },
  {
    kicker: "Clear access by role",
    title: "The right tools for every responsibility.",
    description:
      "Role-aware navigation keeps each workspace focused while administrators manage access and record status with confidence.",
  },
  {
    kicker: "Consistent business records",
    title: "Move from information to action faster.",
    description:
      "Search records, follow price and job history, complete sales, track payments, and review reports without switching systems.",
  },
];

let activeHighlight = 0;
let selectedRecoveryMethod = "email";

function getPasswordStrength(value) {
  if (!value) return 0;

  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.max(1, score);
}

function renderPasswordStrength() {
  const value = createPassword.value;
  const score = getPasswordStrength(value);
  const labels = ["Enter a password", "Weak", "Fair", "Good", "Strong"];
  const hints = [
    "Use 8+ characters with uppercase, lowercase, a number, and a symbol.",
    "Add more length and a mix of uppercase, numbers, and symbols.",
    "Getting better. Add another character type for more protection.",
    "Good password. One more character type will make it strong.",
    "Strong password with a useful mix of character types.",
  ];

  passwordStrength.dataset.strength = String(score);
  strengthLabel.textContent = labels[score];
  strengthHint.textContent = hints[score];
}

function setFieldError(input, message) {
  const group = input.closest(".field-group");
  input.setAttribute("aria-invalid", Boolean(message));
  if (!group) return;
  const error = group.querySelector(".field-error");
  group.classList.toggle("has-error", Boolean(message));
  if (error) error.textContent = message;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFieldError(emailInput, "");
  setFieldError(passwordInput, "");

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const submitButton = loginForm.querySelector("[type='submit']");

  if (!email) {
    setFieldError(emailInput, "Enter your email address.");
    formMessage.textContent = "";
    emailInput.focus();
    return;
  }
  if (!password) {
    setFieldError(passwordInput, "Enter your password.");
    formMessage.textContent = "";
    passwordInput.focus();
    return;
  }

  formMessage.textContent = "Signing in...";
  setBusy(submitButton, true);

  try {
    const { ok, status, result } = await apiRequest("/api/auth/login", {
      body: { email, password },
    });

    if (ok) {
      formMessage.textContent = "Login successful! Opening dashboard...";
      window.setTimeout(() => {
        window.location.href = DASHBOARD_URL;
      }, 500);
      return; // keep the button disabled while redirecting
    }

    const message = result.message || `Login failed (Status: ${status})`;
    formMessage.textContent = message;

    // Map the error by HTTP status instead of guessing from the message text.
    if (status === 400) {
      setFieldError(!email ? emailInput : passwordInput, message);
    } else if (status === 401 || status === 404) {
      // Wrong credentials: don't reveal which one was wrong.
      setFieldError(passwordInput, message);
    }
    // 403 (pending / blocked) and 5xx are account/server states, shown in the form message only.
  } catch (err) {
    console.error("Network error:", err);
    formMessage.textContent = `Unable to connect to the server at ${API_BASE || window.location.origin}. Make sure the backend is running.`;
  }

  setBusy(submitButton, false);
});

emailInput.addEventListener("input", () => {
  setFieldError(emailInput, "");
});

passwordInput.addEventListener("input", () => {
  setFieldError(passwordInput, "");
});

passwordToggle.addEventListener("click", () => {
  const showingPassword = passwordInput.type === "text";
  passwordInput.type = showingPassword ? "password" : "text";
  passwordToggle.setAttribute("aria-pressed", String(!showingPassword));
  passwordToggle.setAttribute(
    "aria-label",
    showingPassword ? "Show password" : "Hide password",
  );
  passwordInput.focus();
});

document.querySelectorAll(".social-button").forEach((button) => {
  button.addEventListener("click", () => {
    const provider = button.dataset.provider;

    if (provider === "Email") {
      formMessage.textContent = "Use your HOPE, Inc. email and password to continue.";
      emailInput.focus();
      return;
    }

    formMessage.textContent = `${provider} sign-in integration is pending.`;
  });
});

// ---------------------------------------------------------------------------
// Forgot password / recovery
// ---------------------------------------------------------------------------
document.querySelector("#forgot-password").addEventListener("click", () => {
  recoveryEmail.value = emailInput.value;
  recoveryMessage.textContent = "";
  document.querySelector("#resend-message").textContent = "";
  recoveryMethodStep.hidden = false;
  recoveryConfirmationStep.hidden = true;
  resetDialog.showModal();
});

document.querySelector("#reset-close").addEventListener("click", () => {
  resetDialog.close();
});

document.querySelectorAll(".recovery-option").forEach((button) => {
  button.addEventListener("click", () => {
    selectedRecoveryMethod = button.dataset.recovery;

    document.querySelectorAll(".recovery-option").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });

    recoveryMessage.textContent = "";
  });
});

function maskEmail(email) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"•".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

// Calls the backend. Returns { sent: true } or { sent: false, message }.
// A 404 ("no such user") is treated as success so the UI never reveals which
// emails are registered.
async function requestPasswordRecovery(email) {
  try {
    const { ok, status, result } = await apiRequest("/api/auth/forgot-password", {
      body: { email },
    });

    if (ok || status === 404) return { sent: true };
    return { sent: false, message: result.message || `Request failed (Status: ${status})` };
  } catch (err) {
    console.error("Network error:", err);
    return { sent: false, message: "Unable to connect to the server. Make sure the backend is running." };
  }
}

document.querySelector("#continue-recovery").addEventListener("click", async () => {
  recoveryEmail.setAttribute("aria-invalid", "false");
  recoveryMessage.textContent = "";
  document.querySelector("#resend-message").textContent = "";

  const confirmationKicker = document.querySelector("#recovery-confirmation-kicker");
  const confirmationTitle = document.querySelector("#recovery-confirmation-title");
  const confirmationCopy = document.querySelector("#recovery-confirmation-copy");
  const continueButton = document.querySelector("#continue-recovery");

  if (selectedRecoveryMethod === "email") {
    const email = recoveryEmail.value.trim();

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      recoveryEmail.setAttribute("aria-invalid", "true");
      recoveryMessage.textContent = "Enter a valid email address.";
      recoveryEmail.focus();
      return;
    }

    setBusy(continueButton, true, "Sending...");
    const outcome = await requestPasswordRecovery(email);
    setBusy(continueButton, false);

    if (!outcome.sent) {
      recoveryMessage.textContent = outcome.message;
      return;
    }

    confirmationKicker.textContent = "Check your inbox";
    confirmationTitle.textContent = "Confirmation email sent";
    confirmationCopy.innerHTML =
      'If an account exists for <strong id="masked-recovery-email"></strong>, we sent password-recovery instructions.';
    document.querySelector("#masked-recovery-email").textContent = maskEmail(email);
    document.querySelector("#resend-recovery").textContent = "Resend email";
  } else if (selectedRecoveryMethod === "google") {
    confirmationKicker.textContent = "Google verification";
    confirmationTitle.textContent = "Not available yet";
    confirmationCopy.textContent =
      "Google recovery is not connected to the backend yet. Please use email recovery.";
    document.querySelector("#resend-recovery").textContent = "Try again";
  } else {
    confirmationKicker.textContent = "Authenticator recovery";
    confirmationTitle.textContent = "Not available yet";
    confirmationCopy.textContent =
      "Authenticator recovery is not connected to the backend yet. Please use email recovery.";
    document.querySelector("#resend-recovery").textContent = "Try again";
  }

  recoveryMethodStep.hidden = true;
  recoveryConfirmationStep.hidden = false;
  document.querySelector("#resend-recovery").focus();
});

document.querySelector("#change-recovery-method").addEventListener("click", () => {
  recoveryConfirmationStep.hidden = true;
  recoveryMethodStep.hidden = false;
  recoveryMessage.textContent = "";
  document.querySelector("#resend-message").textContent = "";
  recoveryEmail.focus();
});

document.querySelector("#resend-recovery").addEventListener("click", async () => {
  const resendMessage = document.querySelector("#resend-message");
  const resendButton = document.querySelector("#resend-recovery");

  if (selectedRecoveryMethod !== "email") {
    resendMessage.textContent = "This recovery method is not available yet. Please use email recovery.";
    return;
  }

  const email = recoveryEmail.value.trim();
  if (!email) {
    resendMessage.textContent = "Go back and enter your email address.";
    return;
  }

  resendMessage.textContent = "Sending...";
  setBusy(resendButton, true);
  const outcome = await requestPasswordRecovery(email);
  setBusy(resendButton, false);

  resendMessage.textContent = outcome.sent
    ? "Email resent. Check your inbox (and spam folder)."
    : outcome.message;
});

// ---------------------------------------------------------------------------
// Create account
// ---------------------------------------------------------------------------
// These selectors try the most likely IDs/names first, then fall back to input types,
// so they work even if the HTML uses slightly different IDs.
const createNameInput = createForm.querySelector(
  "#create-name, #full-name, #name, [name='name'], [name='fullName'], input[type='text']",
);
const createEmailInput = createForm.querySelector(
  "#create-email, #register-email, [name='email'], input[type='email']",
);

document.querySelector("#create-account").addEventListener("click", () => {
  createMessage.textContent = "";
  createDialog.showModal();
});

document.querySelector("#create-close").addEventListener("click", () => {
  createDialog.close();
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  createForm.querySelectorAll("input").forEach((input) => input.setAttribute("aria-invalid", "false"));
  createMessage.textContent = "";

  const name = createNameInput ? createNameInput.value.trim() : "";
  const email = createEmailInput ? createEmailInput.value.trim() : "";
  const password = createPassword.value;
  const confirmPassword = confirmPasswordInput.value;
  const submitButton = createForm.querySelector("[type='submit']");

  // Client-side validation that actually blocks the submit.
  if (!name) {
    if (createNameInput) {
      createNameInput.setAttribute("aria-invalid", "true");
      createNameInput.focus();
    }
    createMessage.textContent = "Enter your full name.";
    return;
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    if (createEmailInput) {
      createEmailInput.setAttribute("aria-invalid", "true");
      createEmailInput.focus();
    }
    createMessage.textContent = "Enter a valid email address.";
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    createPassword.setAttribute("aria-invalid", "true");
    createPassword.focus();
    createMessage.textContent = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    return;
  }
  if (password !== confirmPassword) {
    confirmPasswordInput.setAttribute("aria-invalid", "true");
    confirmPasswordInput.focus();
    createMessage.textContent = "Passwords do not match.";
    return;
  }

  createMessage.textContent = "Creating account...";
  setBusy(submitButton, true);

  try {
    const { ok, status, result } = await apiRequest("/api/auth/register", {
      body: { email, name, password },
    });

    if (ok) {
      createMessage.textContent =
        result.message || "Account created. Waiting for Superadmin approval.";
      createForm.reset();
      renderPasswordStrength();
      window.setTimeout(() => {
        if (createDialog.open) createDialog.close();
        formMessage.textContent = "Account created. You can sign in once an administrator approves it.";
      }, 2500);
    } else {
      createMessage.textContent = result.message || `Registration failed (Status: ${status})`;
      if (status === 400 && /email/i.test(result.message || "") && createEmailInput) {
        createEmailInput.setAttribute("aria-invalid", "true");
      }
    }
  } catch (err) {
    console.error("Network error:", err);
    createMessage.textContent = "Unable to connect to the server. Make sure the backend is running.";
  }

  setBusy(submitButton, false);
});

createForm.querySelectorAll("input").forEach((input) => {
  input.addEventListener("input", () => {
    input.setAttribute("aria-invalid", "false");
    createMessage.textContent = "";
  });
});

createPassword.addEventListener("input", renderPasswordStrength);

function checkPasswordMatch() {
  const mismatch =
    confirmPasswordInput.value && confirmPasswordInput.value !== createPassword.value;
  confirmPasswordInput.setAttribute("aria-invalid", String(Boolean(mismatch)));
}

confirmPasswordInput.addEventListener("input", checkPasswordMatch);
createPassword.addEventListener("input", checkPasswordMatch);

renderPasswordStrength();

function closeDialogFromBackdrop(event) {
  if (event.target === event.currentTarget) event.currentTarget.close();
}

resetDialog.addEventListener("click", closeDialogFromBackdrop);
createDialog.addEventListener("click", closeDialogFromBackdrop);

recoveryEmail.addEventListener("input", () => {
  recoveryEmail.setAttribute("aria-invalid", "false");
  recoveryMessage.textContent = "";
});

// ---------------------------------------------------------------------------
// Feature highlight carousel
// ---------------------------------------------------------------------------
const featurePanel = document.querySelector(".feature-panel");
const featureCopy = document.querySelector(".feature-copy");
const pagerButtons = [...document.querySelectorAll(".feature-pager button")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let highlightTimer;
let isHighlightAnimating = false;

function updateHighlightContent() {
  const highlight = highlights[activeHighlight];
  document.querySelector("#feature-kicker").textContent = highlight.kicker;
  document.querySelector("#feature-title").textContent = highlight.title;
  document.querySelector("#feature-description").textContent = highlight.description;
  pagerButtons.forEach((button, index) => {
    const isActive = index === activeHighlight;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

async function goToHighlight(index, direction = "next") {
  if (isHighlightAnimating || index === activeHighlight) return;
  isHighlightAnimating = true;

  if (!reducedMotion.matches) {
    const exitX = direction === "next" ? "-13%" : "13%";
    const enterX = direction === "next" ? "13%" : "-13%";
    await featureCopy.animate(
      [
        { opacity: 1, transform: "translateX(0) scale(1) rotateY(0deg)" },
        { opacity: 0, transform: `translateX(${exitX}) scale(.94) rotateY(${direction === "next" ? "5deg" : "-5deg"})` },
      ],
      { duration: 260, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "forwards" },
    ).finished;

    activeHighlight = index;
    updateHighlightContent();

    await featureCopy.animate(
      [
        { opacity: 0, transform: `translateX(${enterX}) scale(.94) rotateY(${direction === "next" ? "-5deg" : "5deg"})` },
        { opacity: 1, transform: "translateX(0) scale(1) rotateY(0deg)" },
      ],
      { duration: 420, easing: "cubic-bezier(.16, 1, .3, 1)", fill: "forwards" },
    ).finished;
  } else {
    activeHighlight = index;
    updateHighlightContent();
  }

  isHighlightAnimating = false;
}

function restartHighlightTimer() {
  window.clearTimeout(highlightTimer);
  highlightTimer = window.setTimeout(async () => {
    await goToHighlight((activeHighlight + 1) % highlights.length, "next");
    if (!featurePanel.classList.contains("is-paused")) restartHighlightTimer();
  }, 5200);
}

async function navigateHighlight(step) {
  const nextIndex = (activeHighlight + step + highlights.length) % highlights.length;
  await goToHighlight(nextIndex, step > 0 ? "next" : "previous");
  if (!featurePanel.classList.contains("is-paused")) restartHighlightTimer();
}

document.querySelector("#previous-slide").addEventListener("click", () => navigateHighlight(-1));
document.querySelector("#next-slide").addEventListener("click", () => navigateHighlight(1));

pagerButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const index = Number(button.dataset.slide);
    goToHighlight(index, index > activeHighlight ? "next" : "previous");
  });
});

featurePanel.addEventListener("mouseenter", () => {
  featurePanel.classList.add("is-paused");
  window.clearTimeout(highlightTimer);
});

featurePanel.addEventListener("mouseleave", () => {
  featurePanel.classList.remove("is-paused");
  restartHighlightTimer();
});

featurePanel.addEventListener("focusin", () => {
  featurePanel.classList.add("is-paused");
  window.clearTimeout(highlightTimer);
});

featurePanel.addEventListener("focusout", (event) => {
  if (!featurePanel.contains(event.relatedTarget)) {
    featurePanel.classList.remove("is-paused");
    restartHighlightTimer();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) window.clearTimeout(highlightTimer);
  else restartHighlightTimer();
});

updateHighlightContent();
restartHighlightTimer();