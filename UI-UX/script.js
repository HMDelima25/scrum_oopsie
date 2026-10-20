const loginForm = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector(".visibility-toggle");
const formMessage = document.querySelector("#form-message");
const resetDialog = document.querySelector("#reset-dialog");
const resetForm = document.querySelector("#reset-form");
const resetEmail = document.querySelector("#reset-email");
const dialogMessage = document.querySelector("#dialog-message");

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

function setFieldError(input, message) {
  const group = input.closest(".field-group");
  const error = group.querySelector(".field-error");
  group.classList.toggle("has-error", Boolean(message));
  input.setAttribute("aria-invalid", Boolean(message));
  error.textContent = message;
}

function validateLogin() {
  let valid = true;

  if (!emailInput.value.trim()) {
    setFieldError(emailInput, "Enter your email address.");
    valid = false;
  } else if (!emailInput.validity.valid) {
    setFieldError(emailInput, "Enter a valid email address.");
    valid = false;
  } else {
    setFieldError(emailInput, "");
  }

  if (!passwordInput.value) {
    setFieldError(passwordInput, "Enter your password.");
    valid = false;
  } else if (passwordInput.value.length < 8) {
    setFieldError(passwordInput, "Password must contain at least 8 characters.");
    valid = false;
  } else {
    setFieldError(passwordInput, "");
  }

  return valid;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  if (!validateLogin()) return;

  formMessage.textContent =
    "Frontend validation passed. Authentication API integration is pending.";
});

emailInput.addEventListener("input", () => {
  if (emailInput.getAttribute("aria-invalid") === "true") validateLogin();
});

passwordInput.addEventListener("input", () => {
  if (passwordInput.getAttribute("aria-invalid") === "true") validateLogin();
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

document.querySelector("#forgot-password").addEventListener("click", () => {
  resetEmail.value = emailInput.value;
  dialogMessage.textContent = "";
  resetDialog.showModal();
});

document.querySelector("#dialog-close").addEventListener("click", () => {
  resetDialog.close();
});

resetForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!resetEmail.validity.valid) {
    dialogMessage.textContent = "Enter a valid email address.";
    resetEmail.focus();
    return;
  }

  dialogMessage.textContent =
    "Request validated. Password-reset API integration is pending.";
});

resetDialog.addEventListener("click", (event) => {
  if (event.target === resetDialog) resetDialog.close();
});

function renderHighlight() {
  const highlight = highlights[activeHighlight];
  document.querySelector("#feature-kicker").textContent = highlight.kicker;
  document.querySelector("#feature-title").textContent = highlight.title;
  document.querySelector("#feature-description").textContent = highlight.description;
  document.querySelector("#slide-number").textContent = String(activeHighlight + 1).padStart(2, "0");
}

document.querySelector("#previous-slide").addEventListener("click", () => {
  activeHighlight = (activeHighlight - 1 + highlights.length) % highlights.length;
  renderHighlight();
});

document.querySelector("#next-slide").addEventListener("click", () => {
  activeHighlight = (activeHighlight + 1) % highlights.length;
  renderHighlight();
});
