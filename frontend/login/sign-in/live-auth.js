(() => {
  const $ = (s) => document.querySelector(s);
  const { send } = window.HopeAuthApi;
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
  window.initializeHopeRegistration({ $, matchPassword, validateInputs, fieldError, send });
  const reset = window.initializeHopeRecovery({ $, guides, email, password, matchPassword, validateInputs, fieldError, send });
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
