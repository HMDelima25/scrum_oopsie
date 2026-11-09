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
  await page.getByRole("row", { name: "Open QA User", exact: true }).click();
  await page
    .getByRole("button", { name: "Assign rights", exact: true })
    .click();
  const d = page.locator("#live-dialog");
  await expect(d.locator("[data-gate]")).toHaveCount(5);
  await expect(d.locator("[data-right]")).toHaveCount(36);
  await d.locator("[data-none]").click();
  await expect(d.locator('[data-right="customers.add"]')).toBeDisabled();
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
test("S1-USER-01 temporary User login confirmation and server-side restrictions", async ({
  page,
}) => {
  await login(page, "qa-user");
  await expect(
    page.getByRole("dialog", { name: "Signed in successfully", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/users")).status()).toBe(403);
  expect((await page.request.get("/api/admin/settings")).status()).toBe(403);
  expect((await page.request.get("/api/products")).status()).toBe(403);
  expect((await page.request.get("/api/customers")).status()).toBe(200);
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
test("KNOWN GAP-SP1-002 User workspace is not implemented yet", async ({
  page,
}) => {
  test.fail(
    true,
    "Owner explicitly requested a temporary User success prompt until the User workspace exists.",
  );
  await login(page, "qa-user");
  await expect(page).toHaveURL(/modules\/dashboard/, { timeout: 3000 });
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

test("KNOWN BUG-SP1-007 ordinary User must not see the system Settings shortcut", async ({
  page,
}) => {
  test.fail(
    true,
    "Settings shortcut remains visible on module pages despite the privileged API being protected.",
  );
  await login(page, "qa-user");
  await expect(page.locator("#login-success-dialog")).toBeVisible();
  await page.goto("/UI-UX/modules/customers/index.html");
  await expect(
    page.getByRole("row", { name: "Open QA Customer", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#settings-button")).toBeHidden({ timeout: 3000 });
});
test("KNOWN BUG-SP1-008 denied module URL should show a friendly authorization notice", async ({
  page,
}) => {
  test.fail(
    true,
    "An empty permitted-view result currently causes an undefined result JavaScript error.",
  );
  await login(page, "qa-user");
  await expect(page.locator("#login-success-dialog")).toBeVisible();
  await page.goto("/UI-UX/modules/products/index.html");
  await expect(page.locator("#app")).toContainText(
    /not permitted|access denied|no access|not authorized|no permission|forbidden/i,
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
