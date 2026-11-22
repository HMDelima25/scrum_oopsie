const {test,expect}=require('@playwright/test');
test('Create Account fields remain interactive without closing the prompt',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/UI-UX/index.html');
 await page.locator('#create-account').click();
 const dialog=page.locator('#create-dialog');
 await expect(dialog).toBeVisible();
 await expect(page.locator('#create-form')).toHaveAttribute('autocomplete','off');
 await expect(page.locator('#create-password')).toHaveAttribute('autocomplete','off');
 await expect(page.locator('#confirm-password')).toHaveAttribute('autocomplete','off');
 for(const id of ['first-name','last-name','create-email','create-username','create-password','confirm-password']){
  await page.locator('#'+id).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#'+id)).toBeFocused();
 }
 await page.locator('#create-password').fill('Visible-password-123!');
 await dialog.getByRole('button',{name:'Show password',exact:true}).click();
 await expect(page.locator('#create-password')).toHaveAttribute('type','text');
 await expect(page.locator('#confirm-password')).toHaveAttribute('type','password');
 await dialog.getByRole('button',{name:'Show confirm password',exact:true}).click();
 await expect(page.locator('#confirm-password')).toHaveAttribute('type','text');
 await dialog.getByRole('button',{name:'Hide password',exact:true}).click();
 await dialog.getByRole('button',{name:'Hide confirm password',exact:true}).click();
 await expect(page.locator('#create-password')).toHaveAttribute('type','password');
 await expect(page.locator('#confirm-password')).toHaveAttribute('type','password');
 expect(errors).toEqual([]);
});
for (const mobile of [false,true]) test(`Email registration verification ${mobile?'mobile':'desktop'}`,async({page,request})=>{
 await request.post('/_test/reset');
 if(mobile) await page.setViewportSize({width:390,height:844});
 await page.goto('/UI-UX/index.html');await page.locator('#create-account').click();
 for(const [id,value] of Object.entries({'first-name':'Email','last-name':'Owner','create-email':'verify@example.test','create-username':'verify-owner','create-password':'Strong-password-123','confirm-password':'Strong-password-123'})) await page.locator('#'+id).fill(value);
 await page.locator('#account-terms').check();await page.locator('#create-form button[type=submit]').click();
 await expect(page.getByRole('group',{name:'Six-digit registration verification code'})).toBeVisible();
 await expect(page.locator('#registration-resend')).toBeDisabled();
 const {code}=await (await request.get('/_test/registration-code')).json();
 await page.locator('#registration-digit-1').fill(code);await page.locator('#registration-verify').click();
 await expect(page.locator('#create-message')).toContainText('awaiting Superadmin approval');
 expect((await page.request.get('/api/auth/me')).status()).toBe(401);
});
