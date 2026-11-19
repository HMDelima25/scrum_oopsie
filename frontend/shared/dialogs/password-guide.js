(function (root) {
  const rules = [
    ["At least 12 characters", (value) => value.length >= 12],
    ["One uppercase letter", (value) => /[A-Z]/.test(value)],
    ["One lowercase letter", (value) => /[a-z]/.test(value)],
    ["One number", (value) => /[0-9]/.test(value)],
    ["One symbol", (value) => /[^A-Za-z0-9\s]/.test(value)],
  ];
  function error(value) {
    if (!value) return "Enter a password.";
    if (new TextEncoder().encode(value).length > 72)
      return "Use no more than 72 UTF-8 bytes.";
    if (!rules.every((rule) => rule[1](value)))
      return "Your password must meet every requirement below.";
    return "";
  }
  function attach(input) {
    const guide = document.createElement("div");
    guide.className = "hope-password-guide";
    guide.id = input.id + "-guide";
    guide.innerHTML =
      '<div class="hope-password-guide__heading"><span>Use a strong password</span><strong></strong></div><div class="hope-password-guide__track" role="progressbar" aria-label="Password strength checklist" aria-valuemin="0" aria-valuemax="5"><span></span></div><ul>' +
      rules
        .map(
          (rule) => '<li><span aria-hidden="true">○</span>' + rule[0] + "</li>",
        )
        .join("") +
      '</ul><p class="hope-password-guide__limit">Maximum 72 UTF-8 bytes.</p>';
    input.insertAdjacentElement("afterend", guide);
    input.setAttribute(
      "aria-describedby",
      [input.getAttribute("aria-describedby"), guide.id]
        .filter(Boolean)
        .join(" "),
    );
    function update() {
      const met = rules.map((rule) => rule[1](input.value));
      const count = met.filter(Boolean).length,
        valid = !error(input.value);
      const label = !input.value
        ? "Not entered"
        : valid
          ? "Strong"
          : count >= 3
            ? "Almost there"
            : "Weak";
      guide.dataset.level = valid ? "strong" : input.value ? "weak" : "empty";
      guide.querySelector("strong").textContent = label;
      const track = guide.querySelector('[role="progressbar"]');
      track.setAttribute("aria-valuenow", String(count));
      track.setAttribute(
        "aria-valuetext",
        label + ". " + count + " of 5 requirements met.",
      );
      track.firstElementChild.style.width = count * 20 + "%";
      guide.querySelectorAll("li").forEach((row, index) => {
        row.classList.toggle("is-met", met[index]);
        row.firstElementChild.textContent = met[index] ? "✓" : "○";
      });
      input.setCustomValidity(error(input.value));
    }
    input.addEventListener("input", update);
    input.form?.addEventListener("reset", () => setTimeout(update, 0));
    update();
    return { update, error: () => error(input.value) };
  }
  const api = { error, attach };
  if (typeof module !== "undefined") module.exports = api;
  else root.HopePasswordGuide = api;
})(typeof window === "undefined" ? {} : window);
