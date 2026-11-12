window.initializeHopeRegistration = ({ $, matchPassword, validateInputs, fieldError, send }) => {
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

  let verifying = false;
  const code = $("#registration-code");
  const message = $("#create-message");
  const resend = $("#registration-resend");
  let resendAt = 0;
  function cooldown() {
    resendAt = Date.now() + 60000;
    resend.disabled = true;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((resendAt-Date.now())/1000));
      resend.textContent = left ? `Request another code (${left}s)` : "Request another code";
      resend.disabled = left > 0;
      if (!left) clearInterval(timer);
    },1000);
  }
  code.addEventListener("input", () => { code.value = code.value.replace(/[^0-9]/g, "").slice(0,6); });
  function showDetails() {
    verifying = false;
    $("#create-details").hidden = false;
    $("#registration-verification").hidden = true;
    $("#create-title").textContent = "Create your account";
    message.textContent = "";
    code.value = "";
  }
  $("#registration-back").onclick = showDetails;
  $("#create-dialog").addEventListener("close", () => {
    if (!verifying) showDetails();
  });
  const verify = async () => {
    if (!/^\d{6}$/.test(code.value)) { fieldError(code,"Enter the six-digit code from your email."); return; }
    const button = $("#registration-verify");
    button.disabled = true;
    try {
      const result = await send("verify-registration-code", {code:code.value});
      $("#registration-verification").hidden = true;
      $("#create-title").textContent = "Email verified";
      message.textContent = result.message;
      verifying = false;
      $("#create-form").reset();
    } catch(error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  };
  $("#registration-verify").onclick = verify;
  resend.onclick = async () => {
    resend.disabled = true;
    try { const result = await send("resend-registration-code",{}); message.textContent = result.message; code.value = ""; cooldown(); code.focus(); }
    catch(error) { message.textContent = error.message; resend.disabled = false; }
  };
  $("#create-form").onsubmit = async (e) => {
    e.preventDefault();
    if (verifying) { await verify(); return; }
    const f = e.currentTarget;
    matchPassword($("#create-password"), $("#confirm-password"));
    if (!validateInputs([...$("#create-details").querySelectorAll("input")])) return;
    if ($("#create-password").value !== $("#confirm-password").value) {
      fieldError($("#confirm-password"), "The passwords do not match.");
      $("#confirm-password").focus();
      return;
    }
    const b = f.querySelector('[type="submit"]');
    b.disabled = true;
    $("#create-message").textContent = "Sending verification code…";
    try {
      const result = await send("register", {
        firstName: $("#first-name").value,
        lastName: $("#last-name").value,
        email: $("#create-email").value,
        username: $("#create-username").value,
        password: $("#create-password").value,
      });
      $("#create-message").textContent = result.message;
      verifying = true;
      $("#create-details").hidden = true;
      $("#registration-verification").hidden = false;
      $("#create-title").textContent = "Verify your email";
      $("#create-password").value = "";
      $("#confirm-password").value = "";
      cooldown();
      code.focus();
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
};
