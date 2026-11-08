(() => {
  const $ = (s) => document.querySelector(s);
  async function send(path, data) {
    const r = await fetch("/api/auth/" + path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.message);
    return result;
  }
  const form = $("#login-form"),
    email = $("#email"),
    password = $("#password"),
    message = $("#form-message");
  email.required = true;
  email.type = "text";
  email.autocomplete = "username";
  email.placeholder = "Email or username";
  document.querySelector('label[for="email"]').textContent =
    "Email or username";
  const authMessage = new URLSearchParams(location.search).get("authMessage");
  if (authMessage) {
    message.textContent = authMessage;
    history.replaceState(null, "", location.pathname);
  }
  password.required = true;
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const b = form.querySelector('[type="submit"]');
    b.disabled = true;
    message.textContent = "Signing in…";
    try {
      await send("login", {
        identifier: email.value,
        password: password.value,
      });
      location.assign("modules/dashboard/index.html");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      b.disabled = false;
    }
  };
  $(".visibility-toggle").onclick = (e) => {
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    e.currentTarget.setAttribute("aria-pressed", String(show));
    e.currentTarget.setAttribute(
      "aria-label",
      show ? "Hide password" : "Show password",
    );
  };
  document.querySelector('[name="remember"]').closest("label").hidden = true;
  let googleEnabled = false;
  fetch("/api/auth/methods")
    .then((r) => r.json())
    .then((r) => (googleEnabled = r.data.google))
    .catch(() => {});
  document.querySelectorAll(".social-button").forEach((button) => {
    const provider = button.dataset.provider;
    button.hidden = !["Google", "Email"].includes(provider);
    button.onclick = () => {
      if (provider === "Email") {
        email.focus();
        message.textContent =
          "Enter your registered email or username and password.";
      } else if (googleEnabled) location.assign("/api/auth/google");
      else
        message.textContent =
          "Google sign-in is awaiting provider configuration.";
    };
  });
  const create = $("#create-dialog");
  $("#create-account").onclick = () => create.showModal();
  $("#create-close").onclick = () => create.close();
  const birthdate = $("#birthdate");
  birthdate.disabled = true;
  birthdate.required = false;
  birthdate.closest(".dialog-field").hidden = true;
  for (const id of ["create-username", "create-password", "confirm-password"]) {
    $("#" + id).disabled = false;
    $("#" + id).required = true;
    $("#" + id).closest(".dialog-field").hidden = false;
  }
  $("#create-username").maxLength = 32;
  $("#create-username").pattern = "[A-Za-z][A-Za-z0-9._-]{2,31}";
  $("#create-password").minLength = 12;
  $("#confirm-password").minLength = 12;
  $("#password-strength").hidden = true;
  $("#create-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.reportValidity()) return;
    if ($("#create-password").value !== $("#confirm-password").value) {
      $("#create-message").textContent = "The passwords do not match.";
      $("#confirm-password").focus();
      return;
    }
    const b = f.querySelector('[type="submit"]');
    b.disabled = true;
    $("#create-message").textContent = "Requesting an account…";
    try {
      const result = await send("register", {
        firstName: $("#first-name").value,
        lastName: $("#last-name").value,
        email: $("#create-email").value,
        username: $("#create-username").value,
        password: $("#create-password").value,
      });
      $("#create-message").textContent = result.message;
      f.reset();
    } catch (error) {
      $("#create-message").textContent = error.message;
    } finally {
      b.disabled = false;
    }
  };
  const reset = $("#reset-dialog");
  document
    .querySelectorAll("[data-recovery]")
    .forEach((b) => (b.hidden = b.dataset.recovery !== "email"));
  let resendAt = 0;
  const steps = ["method", "confirmation", "password", "success"];
  function recoveryStep(step) {
    steps.forEach(
      (name) => ($("#reset-" + name + "-step").hidden = name !== step),
    );
    $("#reset-title").textContent = "Forgot password?";
    reset.removeAttribute("aria-labelledby");
    reset.setAttribute(
      "aria-label",
      {
        method: "Forgot password",
        confirmation: "Enter your recovery code",
        password: "Create a new password",
        success: "Password changed",
      }[step],
    );
  }
  function clearRecovery() {
    [
      "#recovery-code",
      "#recovery-password",
      "#recovery-password-confirm",
    ].forEach((id) => ($(id).value = ""));
    [
      "#recovery-message",
      "#resend-message",
      "#recovery-password-message",
    ].forEach((id) => ($(id).textContent = ""));
  }
  $("#forgot-password").onclick = () => {
    clearRecovery();
    $("#recovery-email").value = email.value.includes("@") ? email.value : "";
    recoveryStep("method");
    reset.showModal();
  };
  $("#reset-close").onclick = () => reset.close();
  reset.addEventListener("close", clearRecovery);
  $("#recovery-done").onclick = () => reset.close();
  async function recover() {
    const address = $("#recovery-email");
    if (!address.reportValidity()) return;
    const buttons = [$("#continue-recovery"), $("#resend-recovery")];
    buttons.forEach((b) => (b.disabled = true));
    $("#recovery-message").textContent = "";
    $("#resend-message").textContent = "";
    try {
      const result = await send("forgot-password", { email: address.value });
      resendAt = Date.now() + result.retryAfter * 1000;
      $("#recovery-code").value = "";
      recoveryStep("confirmation");
      $("#recovery-code").focus();
    } catch (error) {
      const target = $("#reset-method-step").hidden
        ? "#resend-message"
        : "#recovery-message";
      $(target).textContent = error.message;
    } finally {
      buttons.forEach((b) => (b.disabled = false));
      updateResend();
    }
  }
  function updateResend() {
    const seconds = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    $("#resend-recovery").disabled = seconds > 0;
    $("#resend-recovery").textContent = seconds
      ? "Resend code in " + seconds + "s"
      : "Resend code";
  }
  setInterval(updateResend, 1000);
  $("#continue-recovery").onclick = recover;
  $("#resend-recovery").onclick = recover;
  $("#change-recovery-method").onclick = () => {
    clearRecovery();
    recoveryStep("method");
  };
  $("#recovery-code").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
  });
  $("#confirm-recovery-code").onclick = async () => {
    const input = $("#recovery-code"),
      button = $("#confirm-recovery-code");
    if (!input.reportValidity()) return;
    button.disabled = true;
    $("#resend-message").textContent = "";
    try {
      await send("verify-recovery-code", { code: input.value });
      input.value = "";
      recoveryStep("password");
      $("#recovery-password").focus();
    } catch (error) {
      $("#resend-message").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  $("#save-recovery-password").onclick = async () => {
    const input = $("#recovery-password"),
      confirmation = $("#recovery-password-confirm"),
      button = $("#save-recovery-password");
    if (!input.reportValidity() || !confirmation.reportValidity()) return;
    if (input.value !== confirmation.value) {
      $("#recovery-password-message").textContent =
        "The passwords do not match.";
      return;
    }
    button.disabled = true;
    try {
      await send("change-recovered-password", {
        newPassword: input.value,
        confirmPassword: confirmation.value,
      });
      clearRecovery();
      recoveryStep("success");
    } catch (error) {
      $("#recovery-password-message").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  for (const d of [create, reset])
    d.addEventListener("click", (e) => {
      if (e.target === d) d.close();
    });
  const highlights = [
    [
      "Built for daily operations",
      "Everything your business needs, connected.",
      "Bring customer records, product pricing, people, sales, payments, and reports together in one clear system.",
    ],
    [
      "Clear access by role",
      "The right tools for every responsibility.",
      "Role-aware navigation keeps each workspace focused while administrators manage access.",
    ],
    [
      "Consistent business records",
      "Move from information to action faster.",
      "Search records, follow histories, complete sales, track payments, and review reports.",
    ],
  ];
  let active = 0;
  function show(i) {
    active = (i + 3) % 3;
    const item = highlights[active];
    $("#feature-kicker").textContent = item[0];
    $("#feature-title").textContent = item[1];
    $("#feature-description").textContent = item[2];
    document.querySelectorAll("[data-slide]").forEach((b) => {
      b.classList.toggle("is-active", Number(b.dataset.slide) === active);
      b.setAttribute(
        "aria-selected",
        String(Number(b.dataset.slide) === active),
      );
    });
  }
  $("#previous-slide").onclick = () => show(active - 1);
  $("#next-slide").onclick = () => show(active + 1);
  document
    .querySelectorAll("[data-slide]")
    .forEach((b) => (b.onclick = () => show(Number(b.dataset.slide))));
})();
