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
    if (!r.ok) {
      const error = new Error(result.message);
      error.field = result.field;
      error.status = r.status;
      throw error;
    }
    return result;
  }
  function fieldError(input, text) {
    let node = document.getElementById(input.id + "-error");
    if (!node) {
      node = document.createElement("p");
      node.id = input.id + "-error";
      node.className = "auth-inline-error";
      (input.type === "checkbox"
        ? input.closest("label")
        : input
      ).insertAdjacentElement("afterend", node);
    }
    node.setAttribute("aria-live", "polite");
    node.textContent = text;
    input.setAttribute("aria-invalid", String(Boolean(text)));
    input.setAttribute(
      "aria-describedby",
      [
        ...new Set(
          (input.getAttribute("aria-describedby") || "")
            .split(" ")
            .filter(Boolean)
            .concat(node.id),
        ),
      ].join(" "),
    );
    input.closest(".field-group")?.classList.toggle("has-error", Boolean(text));
  }
  function validateInputs(inputs) {
    let first;
    for (const input of inputs) {
      if (input.disabled) continue;
      const name =
        document
          .querySelector('label[for="' + input.id + '"]')
          ?.textContent.trim()
          .toLowerCase() || "this field";
      let notice = "";
      if (input.validity.valueMissing)
        notice =
          input.type === "checkbox"
            ? "Please confirm this information."
            : "Enter your " + name + ".";
      else if (input.validity.typeMismatch)
        notice = "Enter a valid email address.";
      else if (input.validity.patternMismatch)
        notice =
          input.id === "create-username"
            ? "Use 3–32 letters, numbers, dots, underscores or hyphens. Start with a letter."
            : "Enter the six-digit code from your email.";
      else if (!input.validity.valid) notice = input.validationMessage;
      fieldError(input, notice);
      if (notice && !first) first = input;
    }
    first?.focus();
    return !first;
  }
  document
    .querySelectorAll("input")
    .forEach((input) =>
      input.addEventListener("input", () => fieldError(input, "")),
    );
  const guides = ["create-password", "recovery-password"].map((id) =>
    HopePasswordGuide.attach($("#" + id)),
  );
  function matchPassword(input, confirmation) {
    confirmation.setCustomValidity(
      confirmation.value && input.value !== confirmation.value
        ? "The passwords do not match."
        : "",
    );
  }
  for (const [passwordId, confirmId] of [
    ["create-password", "confirm-password"],
    ["recovery-password", "recovery-password-confirm"],
  ]) {
    const input = $("#" + passwordId),
      confirmation = $("#" + confirmId);
    const match = () => {
      matchPassword(input, confirmation);
      if (confirmation.value)
        fieldError(confirmation, confirmation.validationMessage);
    };
    input.addEventListener("input", match);
    confirmation.addEventListener("input", match);
  }
  const successDialog = $("#login-success-dialog");
  function signedIn(user) {
    if (user.role !== "user") {
      location.assign("modules/dashboard/index.html");
      return;
    }
    $("#form-message").textContent = "";
    $("#password").value = "";
    successDialog.showModal();
  }
  $("#login-success-close").onclick = () => successDialog.close();
  $("#login-success-logout").onclick = async () => {
    try {
      await send("logout", {});
      successDialog.close();
    } catch (error) {
      $("#login-success-message").textContent = error.message;
    }
  };
  successDialog.addEventListener("click", (e) => {
    if (e.target === successDialog) successDialog.close();
  });
  fetch("/api/auth/me", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((result) => {
      if (result?.data?.role === "user") signedIn(result.data);
    })
    .catch(() => {});
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
    fieldError(email, authMessage);
    history.replaceState(null, "", location.pathname);
  }
  password.required = true;
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!validateInputs([email, password])) return;
    const b = form.querySelector('[type="submit"]');
    b.disabled = true;
    message.textContent = "Signing in…";
    try {
      const result = await send("login", {
        identifier: email.value,
        password: password.value,
      });
      signedIn(result.data);
    } catch (error) {
      message.textContent = "";
      fieldError(
        error.field === "identifier" ? email : password,
        error.message,
      );
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
        const dialog = $("#quick-email-dialog");
        $("#quick-email").value = email.value.includes("@") ? email.value : "";
        $("#quick-email-password").value = "";
        fieldError($("#quick-email"), "");
        fieldError($("#quick-email-password"), "");
        dialog.showModal();
      } else if (googleEnabled) location.assign("/api/auth/google");
      else
        fieldError(email, "Google sign-in is awaiting provider configuration.");
    };
  });
  const create = $("#create-dialog");
  $("#create-account").onclick = () => create.showModal();
  $("#create-close").onclick = () => create.close();
  const quickEmailDialog = $("#quick-email-dialog");
  $("#quick-email-close").onclick = () => quickEmailDialog.close();
  quickEmailDialog.addEventListener(
    "close",
    () => ($("#quick-email-password").value = ""),
  );
  quickEmailDialog.addEventListener("click", (e) => {
    if (e.target === quickEmailDialog) quickEmailDialog.close();
  });
  $("#quick-email-create").onclick = () => {
    const address = $("#quick-email").value;
    quickEmailDialog.close();
    $("#create-email").value = address;
    create.showModal();
  };
  $("#quick-email-forgot").onclick = () => {
    email.value = $("#quick-email").value;
    quickEmailDialog.close();
    $("#forgot-password").click();
  };
  $("#quick-email-form").onsubmit = async (e) => {
    e.preventDefault();
    const address = $("#quick-email"),
      secret = $("#quick-email-password");
    if (!validateInputs([address, secret])) return;
    const button = e.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = "Signing in…";
    try {
      const result = await send("login", {
        identifier: address.value,
        password: secret.value,
      });
      quickEmailDialog.close();
      signedIn(result.data);
    } catch (error) {
      fieldError(
        error.field === "identifier" ? address : secret,
        error.message,
      );
    } finally {
      button.disabled = false;
      button.textContent = "Sign in";
    }
  };
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

  $("#create-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    matchPassword($("#create-password"), $("#confirm-password"));
    if (!validateInputs([...f.querySelectorAll("input")])) return;
    if ($("#create-password").value !== $("#confirm-password").value) {
      fieldError($("#confirm-password"), "The passwords do not match.");
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
      $("#create-message").textContent = "";
      const target = /username/i.test(error.message)
        ? "#create-username"
        : /email/i.test(error.message)
          ? "#create-email"
          : /password/i.test(error.message)
            ? "#create-password"
            : null;
      if (target) fieldError($(target), error.message);
      else $("#create-message").textContent = error.message;
    } finally {
      b.disabled = false;
    }
  };
  const reset = $("#reset-dialog");
  document
    .querySelectorAll("[data-recovery]")
    .forEach((b) => (b.hidden = b.dataset.recovery !== "email"));
  let resendAt = 0;
  let recoveryBusy = false;
  const steps = ["method", "confirmation", "password", "success"];
  const codeDigits = [...document.querySelectorAll(".recovery-digit")];
  function syncCode() {
    $("#recovery-code").value = codeDigits.map((input) => input.value).join("");
    fieldError($("#recovery-code"), "");
    codeDigits.forEach((input) => input.setAttribute("aria-invalid", "false"));
  }
  function fillDigits(start, text) {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 6 - start);
    [...digits].forEach((digit, i) => (codeDigits[start + i].value = digit));
    syncCode();
    codeDigits[Math.min(start + digits.length, 5)].focus({
      preventScroll: true,
    });
  }
  codeDigits.forEach((input, i) => {
    input.addEventListener("input", () => {
      const text = input.value;
      input.value = "";
      fillDigits(i, text);
    });
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      fillDigits(i, e.clipboardData.getData("text"));
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && i) {
        e.preventDefault();
        codeDigits[i - 1].value = "";
        syncCode();
        codeDigits[i - 1].focus();
      } else if (e.key === "ArrowLeft" && i) {
        e.preventDefault();
        codeDigits[i - 1].focus();
      } else if (e.key === "ArrowRight" && i < 5) {
        e.preventDefault();
        codeDigits[i + 1].focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        $("#confirm-recovery-code").click();
      }
    });
    input.addEventListener("focus", () => input.select());
  });
  function recoveryStep(step) {
    guides.forEach((guide) => guide.update());
    steps.forEach(
      (name) => ($("#reset-" + name + "-step").hidden = name !== step),
    );
    reset.querySelector(".flow-dialog__surface").scrollTop = 0;
    const pane = $("#reset-" + step + "-step");
    pane.classList.remove("recovery-enter");
    void pane.offsetWidth;
    pane.classList.add("recovery-enter");
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
    codeDigits.forEach((input) => (input.value = ""));
    reset.querySelectorAll("input").forEach((input) => fieldError(input, ""));
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
  $("#recovery-done").onclick = () => {
    reset.close();
    password.value = "";
    email.focus();
  };
  async function recover() {
    const address = $("#recovery-email");
    if (!validateInputs([address])) return;
    const buttons = [$("#continue-recovery"), $("#resend-recovery")];
    recoveryBusy = true;
    $("#continue-recovery").textContent = "Sending code…";
    buttons.forEach((b) => (b.disabled = true));
    updateResend();
    $("#recovery-message").textContent = "";
    $("#resend-message").textContent = "";
    try {
      const result = await send("forgot-password", { email: address.value });
      resendAt = Date.now() + result.retryAfter * 1000;
      $("#recovery-code").value = "";
      codeDigits.forEach((input) => (input.value = ""));
      $("#recovery-confirmation-copy").textContent =
        "Enter the six-digit code sent to " +
        address.value.trim() +
        ". Check your spam folder if needed.";
      recoveryStep("confirmation");
      codeDigits[0].focus({ preventScroll: true });
    } catch (error) {
      const target = $("#reset-method-step").hidden
        ? "#resend-message"
        : "#recovery-message";
      if (!$("#reset-method-step").hidden) fieldError(address, error.message);
      else $(target).textContent = error.message;
    } finally {
      recoveryBusy = false;
      $("#continue-recovery").textContent = "Send code";
      buttons.forEach((b) => (b.disabled = false));
      updateResend();
    }
  }
  function updateResend() {
    const seconds = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    $("#resend-recovery").disabled = recoveryBusy || seconds > 0;
    $("#resend-recovery").textContent = recoveryBusy
      ? "Requesting another code…"
      : seconds
        ? "Request another code in " + seconds + "s"
        : "Request another code";
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
    if (!/^[0-9]{6}$/.test(input.value)) {
      fieldError(input, "Enter all six digits from your email.");
      codeDigits.find((d) => !d.value)?.focus();
      return;
    }
    button.disabled = true;
    $("#resend-message").textContent = "";
    try {
      await send("verify-recovery-code", { code: input.value });
      input.value = "";
      recoveryStep("password");
      $("#recovery-password").focus({ preventScroll: true });
    } catch (error) {
      fieldError(input, error.message);
      codeDigits.forEach((d) => d.setAttribute("aria-invalid", "true"));
    } finally {
      button.disabled = false;
    }
  };
  $("#save-recovery-password").onclick = async () => {
    const input = $("#recovery-password"),
      confirmation = $("#recovery-password-confirm"),
      button = $("#save-recovery-password");
    matchPassword(input, confirmation);
    if (!validateInputs([input, confirmation])) return;
    if (input.value !== confirmation.value) {
      fieldError(confirmation, "The passwords do not match.");
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
      fieldError(input, error.message);
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
