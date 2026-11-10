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
};
