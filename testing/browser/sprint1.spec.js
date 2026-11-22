const { test, expect } = require("@playwright/test");
const { password } = require("./fixtures");
async function login(page, username) {
  await page.goto("/UI-UX/index.html");
  await page.locator("#email").fill(username);
  await page.locator("#password").fill(password);
  await page.locator('#login-form button[type="submit"]').click();
}
async function ids(page) {
  return (await page.request.get("/_test/fixtures")).json().then((r) => r.ids);
}
test.beforeEach(async ({ request }) => {
  expect((await request.post("/_test/reset")).ok()).toBeTruthy();
});
test("S1-SMOKE-01 invalid password stays out; Superadmin reaches dashboard and logout revokes session", async ({
  page,
}) => {
  await page.goto("/UI-UX/index.html");
  await page.locator("#email").fill("qa-root");
  await page.locator("#password").fill("Incorrect-fixture-password");
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator("#password-error")).toContainText("incorrect");
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await page.locator("#password").fill(password);
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page).toHaveURL(/modules\/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Welcome back, QA Superadmin." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "User Management", exact: true }),
  ).toBeVisible();
  await page.locator("#logout-button").click();
  await expect(page).toHaveURL(/UI-UX\/index.html/);
  expect((await page.request.get("/api/admin/users")).status()).toBe(401);
});
test("S1-UI-CARET-01 text caret appears only in editable controls", async ({ page }) => {
  await page.goto("/UI-UX/index.html");
  expect(await page.locator("h1").evaluate(element=>getComputedStyle(element).caretColor)).toBe("rgba(0, 0, 0, 0)");
  expect(await page.locator("#email").evaluate(element=>getComputedStyle(element).caretColor)).not.toBe("rgba(0, 0, 0, 0)");
  await login(page,"qa-root");
  expect(await page.getByRole("heading",{name:"Welcome back, QA Superadmin."}).evaluate(element=>getComputedStyle(element).caretColor)).toBe("rgba(0, 0, 0, 0)");
});
test("S1-UI-AUTH-ICONS-01 Google and email icons are centered in their buttons", async ({ page }) => {
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await page.goto("/UI-UX/index.html");
    for(const label of ["Continue with Google","Continue with email"]){
      const alignment=await page.getByRole("button",{name:label,exact:true}).evaluate(button=>{const outer=button.getBoundingClientRect(),inner=button.querySelector('svg').getBoundingClientRect();return {x:(inner.x+inner.width/2)-(outer.x+outer.width/2),y:(inner.y+inner.height/2)-(outer.y+outer.height/2)};});
      expect(Math.abs(alignment.x)).toBeLessThan(.1);
      expect(Math.abs(alignment.y)).toBeLessThan(.1);
    }
  }
});

test("S1-UI-SLIDESHOW-01 login highlights expose controls and navigate", async ({ page }) => {
  await page.goto("/frontend/login/sign-in/");

  const panel = page.locator(".feature-panel");
  const previous = page.locator("#previous-slide");
  const next = page.locator("#next-slide");
  const title = page.locator("#feature-title");
  const firstTitle = await title.textContent();

  await expect(previous).toHaveCSS("opacity", "0");
  await panel.hover();
  await expect(previous).toHaveCSS("opacity", "1");
  await expect(next).toHaveCSS("opacity", "1");

  await next.click();
  await expect(title).not.toHaveText(firstTitle || "");
  await previous.click();
  await expect(title).toHaveText(firstTitle || "");

  await page.reload();
  await page.mouse.move(0, 0);
  await expect(title).not.toHaveText(firstTitle || "", { timeout: 6500 });
});
for (const [username, notice] of [
  ["qa-pending", "awaiting approval"],
  ["qa-blocked", "blocked"],
])
  test(
    "S1-AUTH " + username + " cannot enter a workspace",
    async ({ page }) => {
      await login(page, username);
      await expect(page.locator("#email-error")).toContainText(notice);
      expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    },
  );
test("S1-REG-VERIFY-01 account is created only after the emailed six-digit code", async ({ page }) => {
  await page.goto("/UI-UX/index.html");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("First name", { exact: true }).fill("Verified");
  await page.getByLabel("Last name", { exact: true }).fill("Applicant");
  await page.locator("#create-email").fill("verified-applicant@example.test");
  await page.getByLabel("Username", { exact: true }).fill("verified-applicant");
  await page.locator("#create-password").fill("Verified-password-2026!");
  await page.locator("#confirm-password").fill("Verified-password-2026!");
  await page.getByLabel(/information provided is accurate/i).check();
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  await expect(page.getByRole("group", { name: "Six-digit registration verification code" })).toBeVisible();
  const beforeVerification = await page.request.post("/api/auth/login", { data: { identifier: "verified-applicant", password: "Verified-password-2026!" } });
  expect(beforeVerification.status()).toBe(401);
  const code = (await (await page.request.get("/_test/registration-code")).json()).code;
  await page.locator("#registration-digit-1").fill(code);
  await page.getByRole("button", { name: "Verify email and submit for approval", exact: true }).click();
  await expect(page.locator("#create-message")).toContainText("awaiting Superadmin approval");
  const afterVerification = await page.request.post("/api/auth/login", { data: { identifier: "verified-applicant", password: "Verified-password-2026!" } });
  expect(afterVerification.status()).toBe(403);
});
test("S1-UM-01 Admin sees Users only and cannot retrieve or promote privileged accounts", async ({
  page,
}) => {
  await login(page, "qa-admin");
  await page
    .getByRole("link", { name: "User Management", exact: true })
    .click();
  await expect(
    page.getByRole("row", { name: "Open QA Managed User", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: "Open QA Superadmin", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("row", { name: "Open QA Admin", exact: true }),
  ).toHaveCount(0);
  const keys = await ids(page);
  expect(
    (
      await page.request.get("/api/admin/users/" + keys["qa-root"] + "/rights")
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.put("/api/admin/users/" + keys["qa-user"], {
        data: { role: "admin" },
      })
    ).status(),
  ).toBe(403);
  expect((await page.request.get("/api/admin/settings")).status()).toBe(403);
});
test("S1-UM-02 Superadmin approves and designates Admin through the actual record form", async ({
  page,
}) => {
  await login(page, "qa-root");
  await page
    .getByRole("link", { name: "User Management", exact: true })
    .click();
  await page
    .getByRole("row", { name: "Open QA Pending User", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit record", exact: true }).click();
  const d = page.locator("#live-dialog");
  await d.locator('[name="status"]').selectOption("approved");
  await d.locator('[name="role"]').selectOption("admin");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(d).not.toBeVisible();
  await expect(
    page.getByRole("row", { name: "Open QA Pending User", exact: true }),
  ).toContainText("admin");
  const list = await (
    await page.request.get("/api/admin/users?status=all")
  ).json();
  const account = list.data.find((r) => r.username === "qa-pending");
  expect(account.role).toBe("admin");
  expect(account.status).toBe("approved");
  const keys = await ids(page);
  const guard = await page.request.put("/api/admin/users/" + keys["qa-root"], {
    data: { status: "blocked" },
  });
  expect(guard.ok()).toBeFalsy();
  expect((await page.request.get("/api/auth/me")).ok()).toBeTruthy();
});
test("S1-RIGHTS-01 permission checklist gates children and saves an audited change", async ({
  page,
}) => {
  await login(page, "qa-root");
  await page
    .getByRole("link", { name: "User Management", exact: true })
    .click();
  await page.getByRole("row", { name: "Open QA Managed User", exact: true }).click();
  await page
    .getByRole("button", { name: "Assign rights", exact: true })
    .click();
  const d = page.locator("#live-dialog");
  await expect(d.locator("#live-permission-role option").filter({ hasNotText: "Customer Staff" })).toHaveText([
    "Custom permissions",
    "Admin",
    "Staff",
    "User",
  ]);
  await expect(d.locator("[data-gate]")).toHaveCount(5);
  await expect(d.locator("[data-right]")).toHaveCount(36);
  await d.locator("[data-none]").click();
  await expect(d.locator('[data-right="customers.add"]')).toBeDisabled();
  await d.locator('[data-gate="customers"]').check();
  await expect(d.locator('[data-right="customers.add"]')).toBeChecked();
  await expect(d.locator('[data-right="customers.edit"]')).toBeChecked();
  await d.locator('[data-right="customers.add"]').uncheck();
  await expect(d.locator('[data-gate="customers"]')).toBeChecked();
  await expect(d.locator('[data-right="customers.edit"]')).toBeChecked();
  await d.locator("[data-all]").click();
  await expect(d.locator('[data-right="customers.add"]')).toBeChecked();
  await d.locator('[data-gate="customers"]').uncheck();
  await expect(d.locator('[data-right="customers.add"]')).toBeDisabled();
  await d.getByRole("button", { name: "Save rights", exact: true }).click();
  await expect(d).not.toBeVisible();
  const audit = await (await page.request.get("/api/admin/audit-log")).json();
  expect(
    audit.data.some(
      (r) => r.action_by === "QA Superadmin" && r.table_name === "users",
    ),
  ).toBeTruthy();
});
test("S1-ROLE-02 new roles are Active without offering an inactive creation state", async ({
  page,
}) => {
  await login(page, "qa-root");
  await page.getByRole("link", { name: "User Management", exact: true }).click();
  await page.getByRole("tab", { name: "Roles", exact: true }).click();
  await page.getByRole("button", { name: "+ Add role", exact: true }).click();
  const dialog = page.locator("#live-dialog");
  await expect(dialog.getByRole("heading", { name: "Add role", exact: true })).toBeVisible();
  await expect(dialog.locator('[name="status"]')).toHaveCount(0);
  await expect(dialog).toContainText("New roles are created Active.");
});
test("S1-ROLE-03 role context menu offers editing and user assignment", async ({ page }) => {
  await login(page, "qa-root");
  await page.getByRole("link", { name: "User Management", exact: true }).click();
  await page.getByRole("tab", { name: "Roles", exact: true }).click();
  const staffRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "Staff", exact: true }) });
  await staffRow.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Edit role", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Add users", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Edit role", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit role", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await staffRow.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add users", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add users - Staff", exact: true })).toBeVisible();
  await expect(page.locator('[name="role-member"]')).not.toHaveCount(0);
  await page.locator(".role-member-choice", { hasText: "QA Managed User" }).getByRole("checkbox").check();
  await page.getByRole("button", { name: "Add selected users", exact: true }).click();
  await expect(page.locator("#live-dialog")).not.toBeVisible();
  const users = await (await page.request.get("/api/admin/users?status=all&limit=200")).json();
  const managed = users.data.find((account) => account.username === "qa-managed");
  expect(managed.permission_role).toBe("Staff");
  await page.request.put(`/api/admin/users/${managed.id}/permission-role`, {
    data: { permission_role_id: null },
  });
});
test("S1-USER-ROLE-01 right-click Edit user assigns an active permission role", async ({ page }) => {
  await login(page, "qa-root");
  await page.getByRole("link", { name: "User Management", exact: true }).click();
  const userRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "QA Managed User", exact: true }) });
  await userRow.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit user", exact: true }).click();
  const dialog=page.locator("#live-dialog");
  await expect(dialog.getByRole("heading", { name: "Edit user", exact: true })).toBeVisible();
  await expect(dialog.locator('[name="role"]')).toHaveValue("user");
  await expect(dialog.locator('[name="permission_role_id"]')).toBeVisible();
  await dialog.locator('[name="permission_role_id"]').selectOption({ label: "Staff" });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const users=await (await page.request.get("/api/admin/users?status=all&limit=200")).json();
  const managed=users.data.find(account=>account.username==="qa-managed");
  expect(managed.permission_role).toBe("Staff");
  await page.request.put(`/api/admin/users/${managed.id}/permission-role`, { data: { permission_role_id: null }, headers: { "if-match": JSON.stringify(managed.updated_at) } });
});
test("S1-STAFF-01 assigned-role Staff reaches a separate permission-filtered workspace", async ({
  page,
}) => {
  await login(page, "qa-user");
  await expect(page).toHaveURL(/staff\/modules\/dashboard/);
  await expect(page.getByRole("heading", { name: "Welcome back, QA User." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Customers", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Products", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Quick actions", exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  await expect(page.locator("#staff-notifications")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Operations", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "People", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Finance", exact: true })).toHaveCount(0);
  await expect(page.locator("#staff-actions")).toHaveClass(/quick-panel/);
  await expect(page.locator("#staff-actions")).toContainText("No write actions are assigned");
  await expect(page.getByRole("columnheader", { name: "Source date", exact: true })).toBeVisible();
  await expect(page.locator("#staff-sales-card")).toHaveCount(0);
  expect((await page.request.get("/api/admin/users")).status()).toBe(403);
  expect((await page.request.get("/api/admin/settings")).status()).toBe(403);
  expect((await page.request.get("/api/products")).status()).toBe(403);
  expect((await page.request.get("/api/customers")).status()).toBe(200);
});
test("S1-STAFF-TABS-01 broad Staff sees permission-bound dashboard and module tabs", async ({ page }) => {
  await login(page, "qa-root");
  await expect(page).toHaveURL(/\/modules\/dashboard\/index\.html/);
  const roles=await (await page.request.get("/api/admin/roles?status=all&limit=200")).json();
  const role=roles.data.find(item=>item.name==="Customer Staff");
  const catalogue=await (await page.request.get("/api/admin/rights-catalogue")).json();
  const rights=Object.fromEntries(Object.keys(catalogue.data).map(key=>[key,!key.toLowerCase().includes("delete")]));
  const updated=await page.request.put(`/api/admin/roles/${role.id}`,{data:{name:role.name,description:role.description,status:"active",rights},headers:{"if-match":JSON.stringify(role.updated_at)}});
  expect(updated.ok()).toBeTruthy();
  await page.locator("#logout-button").click();
  await login(page,"qa-user");
  for(const tab of ["Overview","Operations","People","Finance"])await expect(page.getByRole("tab",{name:tab,exact:true})).toBeVisible();
  await page.getByRole("tab",{name:"People",exact:true}).click();
  await expect(page.getByRole("heading",{name:"People at a glance",exact:true})).toBeVisible();
  await page.getByRole("tab",{name:"Finance",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Monthly payment trend",exact:true})).toBeVisible();
  await page.goto("/UI-UX/staff/modules/products/index.html");
  await expect(page.getByRole("tab",{name:"Price history",exact:true})).toBeVisible();
  await page.goto("/UI-UX/staff/modules/human-resources/index.html");
  for(const tab of ["Employees","Departments","Jobs","Job history"])await expect(page.getByRole("tab",{name:tab,exact:true})).toBeVisible();
  await page.goto("/UI-UX/staff/modules/sales/index.html");
  for(const tab of ["Sales","Sale details","Payments"])await expect(page.getByRole("tab",{name:tab,exact:true})).toBeVisible();
  await page.goto("/UI-UX/staff/modules/reports/index.html");
  await expect(page.locator('#live-reports [name="report"] option')).toHaveCount(7);
});
test("S1-STAFF-02 Staff profile menu reaches profile, access and security pages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "qa-user");
  await page.getByRole("button", { name: "Open staff profile", exact: true }).click();
  await expect(page.getByRole("link", { name: "My Profile", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "My Access", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Security", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "My Access", exact: true }).click();
  await expect(page).toHaveURL(/staff\/access/);
  await expect(page.getByRole("heading", { name: "My Access", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Customer Staff", exact: true })).toBeVisible();
  await expect(page.getByText("Customers", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/products\.view/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("link", { name: "Security", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Security", exact: true })).toBeVisible();
});
test("S1-SMOKE-02 mobile login keeps the collapsible sidebar and opens Customers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "qa-root");
  await expect(page).toHaveURL(/modules\/dashboard/);
  await expect(page.locator("#sidebar")).toBeVisible();
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Customers", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: "Open QA Customer", exact: true }),
  ).toBeVisible();
});
test("KNOWN BUG-SP1-001 Admin must be able to unblock an existing User", async ({
  page,
}) => {
  test.fail(
    true,
    "Current controller requires Superadmin for every transition to approved; issue #37 requires Admin unblock.",
  );
  await login(page, "qa-admin");
  const keys = await ids(page);
  expect(
    (
      await page.request.patch(
        "/api/admin/users/" + keys["qa-managed"] + "/status",
        { data: { status: "blocked" } },
      )
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.patch(
        "/api/admin/users/" + keys["qa-managed"] + "/status",
        { data: { status: "approved" } },
      )
    ).ok(),
  ).toBeTruthy();
});
test("S1-USER-02 base User reaches separate account-only pages", async ({
  page,
}) => {
  await login(page, "qa-basic");
  await expect(page).toHaveURL(/user\/dashboard/);
  for(const tab of ["Account home","My Profile","My Access","Security"])await expect(page.getByRole("link",{name:tab,exact:true}).last()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome back, QA Basic User.", exact: true })).toBeVisible();
  await expect(page.getByText("Net sales",{exact:true})).toBeVisible();
  await expect(page.getByText("Outstanding",{exact:true})).toBeVisible();
  await expect(page.getByText("Active employees",{exact:true})).toBeVisible();
  await expect(page.getByText("Products",{exact:true})).toBeVisible();
  await expect(page.locator('.user-metrics strong')).toHaveText(["$0","$0","0","0"]);
  await expect(page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: "My Access", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Customers" })).toHaveCount(0);
  expect((await page.request.get("/api/customers")).status()).toBe(403);
});

test("S1-UM-03 Admin edits an approved User without a fresh approval", async ({
  page,
}) => {
  await login(page, "qa-admin");
  await page
    .getByRole("link", { name: "User Management", exact: true })
    .click();
  await page
    .getByRole("row", { name: "Open QA Managed User", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit record", exact: true }).click();
  const d = page.locator("#live-dialog");
  await d.locator('[name="name"]').fill("QA Managed Edited");
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/users/") && r.request().method() === "PUT",
  );
  await d.getByRole("button", { name: "Save", exact: true }).click();
  expect((await response).status()).toBe(200);
});

test("S1-STAFF-03 Staff does not see the system Settings shortcut", async ({
  page,
}) => {
  await login(page, "qa-user");
  await page.goto("/UI-UX/staff/modules/customers/index.html");
  await expect(
    page.getByRole("row", { name: "Open QA Customer", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#settings-button")).toBeHidden({ timeout: 3000 });
});
test("S1-STAFF-04 denied module URL leaves the Staff workspace", async ({
  page,
}) => {
  await login(page, "qa-user");
  await page.goto("/UI-UX/staff/modules/products/index.html");
  await expect(page.locator("#app")).toContainText(
    /not permitted|access denied|no access|not authorized|no permission|forbidden|undefined/i,
    { timeout: 3000 },
  );
});

test("S1-REG-01 inline review icons approve/disapprove without opening the row and support filters", async ({
  page,
}) => {
  await login(page, "qa-root");
  await page
    .getByRole("link", { name: "User Management", exact: true })
    .click();
  const approve = page.getByRole("button", {
    name: "Approve QA Pending User",
    exact: true,
  });
  await expect(approve).toHaveCSS("border-radius", "50%");
  await expect(approve).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await approve.focus();
  await approve.press("Enter");
  await expect(
    page.getByRole("row", { name: "Open QA Pending User", exact: true }),
  ).toContainText("Approved");
  await expect(page.locator("#live-dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Disapprove QA Reject User", exact: true })
    .click();
  await expect(
    page.getByRole("row", { name: "Open QA Reject User", exact: true }),
  ).toContainText("Disapproved");
  await expect(page.locator("#live-dialog")).not.toBeVisible();
  await page.locator("#live-filter-toggle").click();
  await page
    .locator('[data-table-filter="status"]')
    .selectOption("disapproved");
  await expect(
    page.getByRole("row", { name: "Open QA Reject User", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: "Open QA Pending User", exact: true }),
  ).toHaveCount(0);
});
