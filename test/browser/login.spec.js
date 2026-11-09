const { test, expect } = require('@playwright/test');

const baseURL = process.env.HOPE_TEST_URL || 'http://127.0.0.1:5001';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname)) {
  throw new Error('Use a loopback URL connected to a disposable test database.');
}
const identifier = process.env.HOPE_TEST_USERNAME;
const password = process.env.HOPE_TEST_PASSWORD;
if (!identifier || !password) throw new Error('Configure an approved disposable test account through HOPE_TEST_USERNAME and HOPE_TEST_PASSWORD.');

test.use({ baseURL, trace: 'off', screenshot: 'off', video: 'off' });

test('password login opens dashboard and logout invalidates session', async ({ page }) => {
  await page.goto('/UI-UX/index.html');
  await page.locator('#email').fill(identifier);
  await page.locator('#password').fill(password);
  const loginResponse = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  await page.locator('#login-form button[type="submit"]').click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/modules\/dashboard\/index\.html$/);
  const session = await page.request.get('/api/auth/me');
  expect(session.status()).toBe(200);
  expect((await session.json()).data.status).toBe('approved');
  expect((await page.request.get('/api/ui-dashboard-data')).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true }).first()).toBeVisible();
  expect((await page.request.post('/api/auth/logout')).status()).toBe(200);
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  expect((await page.request.get('/api/ui-dashboard-data')).status()).toBe(401);
});
