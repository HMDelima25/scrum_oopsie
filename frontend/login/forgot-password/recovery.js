window.initializeHopeRecovery = ({ $, guides, email, password, matchPassword, validateInputs, fieldError, send }) => {
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
  return reset;
};
