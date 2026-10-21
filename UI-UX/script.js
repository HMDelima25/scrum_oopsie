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
  const error = group.querySelector(".field-error");
  group.classList.toggle("has-error", Boolean(message));
  input.setAttribute("aria-invalid", Boolean(message));
  error.textContent = message;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setFieldError(emailInput, "");
  setFieldError(passwordInput, "");
  formMessage.textContent = "Opening the administrator dashboard…";
  window.setTimeout(() => {
    window.location.href = "modules/dashboard/index.html";
  }, 320);
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

document.querySelector("#forgot-password").addEventListener("click", () => {
  recoveryEmail.value = emailInput.value;
  recoveryMessage.textContent = "";
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

document.querySelector("#continue-recovery").addEventListener("click", () => {
  recoveryEmail.setAttribute("aria-invalid", "false");
  const confirmationKicker = document.querySelector("#recovery-confirmation-kicker");
  const confirmationTitle = document.querySelector("#recovery-confirmation-title");
  const confirmationCopy = document.querySelector("#recovery-confirmation-copy");

  if (selectedRecoveryMethod === "email") {
    confirmationKicker.textContent = "Check your inbox";
    confirmationTitle.textContent = "Confirmation email sent";
    confirmationCopy.innerHTML = 'We sent password-recovery instructions to <strong id="masked-recovery-email"></strong>.';
    document.querySelector("#masked-recovery-email").textContent = recoveryEmail.value.trim()
      ? maskEmail(recoveryEmail.value.trim())
      : "your account email";
    document.querySelector("#resend-recovery").textContent = "Resend email";
  } else if (selectedRecoveryMethod === "google") {
    confirmationKicker.textContent = "Google verification";
    confirmationTitle.textContent = "Verification ready";
    confirmationCopy.textContent = "The Google verification step is ready for prototype testing.";
    document.querySelector("#resend-recovery").textContent = "Try again";
  } else {
    confirmationKicker.textContent = "Authenticator recovery";
    confirmationTitle.textContent = "Authenticator ready";
    confirmationCopy.textContent = "The authenticator recovery step is ready for prototype testing.";
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
  recoveryEmail.focus();
});

document.querySelector("#resend-recovery").addEventListener("click", () => {
  const action = selectedRecoveryMethod === "email" ? "Resend requested" : "Retry requested";
  document.querySelector("#resend-message").textContent =
    `${action}. Backend integration is pending.`;
});

document.querySelector("#create-account").addEventListener("click", () => {
  createMessage.textContent = "";
  createDialog.showModal();
});

document.querySelector("#create-close").addEventListener("click", () => {
  createDialog.close();
});

createForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createForm.querySelectorAll("input").forEach((input) => input.setAttribute("aria-invalid", "false"));
  createMessage.textContent =
    "Demo account creation continued. Administrator-approval API integration is pending.";
});

createForm.querySelectorAll("input").forEach((input) => {
  input.addEventListener("input", () => {
    input.setAttribute("aria-invalid", "false");
    createMessage.textContent = "";
  });
});

createPassword.addEventListener("input", renderPasswordStrength);

confirmPasswordInput.addEventListener("input", () => {
  if (confirmPasswordInput.value && confirmPasswordInput.value !== createPassword.value) {
    confirmPasswordInput.setAttribute("aria-invalid", "true");
  }
});

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
