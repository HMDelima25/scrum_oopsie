const {test,expect}=require('@playwright/test');
for (const mobile of [false,true]) test(`Email registration verification ${mobile?'mobile':'desktop'}`,async({page,request})=>{
 await request.post('/_test/reset');
 if(mobile) await page.setViewportSize({width:390,height:844});
 await page.goto('/UI-UX/index.html');await page.locator('#create-account').click();
 for(const [id,value] of Object.entries({'first-name':'Email','last-name':'Owner','create-email':'verify@example.test','create-username':'verify-owner','create-password':'Strong-password-123','confirm-password':'Strong-password-123'})) await page.locator('#'+id).fill(value);
 await page.locator('#account-terms').check();await page.locator('#create-form button[type=submit]').click();
 await expect(page.locator('#registration-code')).toBeVisible();
 await expect(page.locator('#registration-resend')).toBeDisabled();
 const {code}=await (await request.get('/_test/registration-code')).json();
 await page.locator('#registration-code').fill(code);await page.locator('#registration-verify').click();
 await expect(page.locator('#create-message')).toContainText('awaiting Superadmin approval');
 expect((await page.request.get('/api/auth/me')).status()).toBe(401);
});
