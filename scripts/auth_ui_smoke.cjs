// Run after exporting the web app to dist-test/customer-auth.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve('node_modules/.cache/playwright');
const { chromium } = require('playwright');

async function main() {
  const root = path.resolve('dist-test/customer-auth');
  const mime = { '.js': 'application/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.png': 'image/png', '.ico': 'image/x-icon' };
  const server = http.createServer((request, response) => {
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.EVENTGEAR_BROWSER_PATH ? { executablePath: process.env.EVENTGEAR_BROWSER_PATH } : {}) });
    page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const click = text => page.getByText(text, { exact: true }).filter({ visible: true }).last().click();
    const email = `customer-${Date.now()}@example.test`;
    const password = 'UITestPassword123';
    async function fillRegistration(name, address) {
      await page.getByLabel('Full name', { exact: true }).fill(name);
      await page.getByLabel('Contact number', { exact: true }).fill('09ab123-456789');
      assert.equal(await page.getByLabel('Contact number', { exact: true }).inputValue(), '09123456789');
      await page.getByLabel('Email', { exact: true }).fill(address);
      await page.getByLabel('Password', { exact: true }).fill(password + '!@#');
      await page.getByLabel('Confirm password', { exact: true }).fill(password + '!@#');
      assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), password);
      assert.equal(await page.getByLabel('Confirm password', { exact: true }).inputValue(), password);
      await click('Create an account');
    }
    async function signOut() {
      await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
      await page.getByRole('dialog', { name: 'Sign out confirmation' }).getByText('Sign out', { exact: true }).click();
      await page.getByText('Create an account', { exact: true }).filter({visible:true}).last().waitFor();
    }
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await click('Sign in as Administrator');
    assert.equal(await page.getByRole('textbox').count(),2);
    assert.equal(await page.getByLabel('Full name', {exact:true}).count(),0);
    assert.equal(await page.getByLabel('Contact number', {exact:true}).count(),0);
    assert.equal(await page.getByLabel('Confirm password', {exact:true}).count(),0);
    await page.getByLabel('Username', {exact:true}).fill('EventGear Admin');
    await page.getByLabel('Password', {exact:true}).fill('incorrect');
    await click('Sign In');
    await page.getByText('Incorrect email, username or password.', {exact:true}).waitFor();
    await page.getByLabel('Password', {exact:true}).fill('EventGear2026');
    await click('Sign In');
    await page.getByText('Management', { exact: true }).filter({visible:true}).last().waitFor({timeout:60000});
    await page.getByRole('button', { name: 'Switch to Supplier', exact: true }).click();
    await page.getByText('Quick actions', {exact:true}).waitFor();
    await page.getByRole('button', { name: 'Switch to Admin', exact: true }).click();
    await page.getByText('Management', {exact:true}).filter({visible:true}).last().waitFor();
    await signOut();
    await click('Create an account');
    await fillRegistration('UI Test Customer',email);
    await page.getByText('WELCOME, UI TEST CUSTOMER', {exact:true}).waitFor({timeout:60000});
    await click('Browse equipment');
    await page.getByText('6 results', {exact:true}).waitFor();
    await click('Home');
    await signOut();
    await click('Sign in');
    await page.getByRole('dialog', {name:'Customer sign in'}).waitFor();
    await page.getByLabel('Email or username', {exact:true}).fill(email);
    await page.getByLabel('Password', {exact:true}).fill('incorrect');
    await click('Sign in');
    await page.getByText('Incorrect email, username or password.', {exact:true}).waitFor({timeout:60000});
    await page.getByLabel('Password', {exact:true}).fill(password);
    await click('Sign in');
    await page.getByText('WELCOME, UI TEST CUSTOMER', {exact:true}).waitFor({timeout:60000});
    assert.equal(await page.getByRole('button', { name: /^Switch to (Admin|Supplier)$/ }).count(),0);
    await click('Cart'); await page.getByText('Your cart is empty', {exact:true}).waitFor();
    await click('Home'); await signOut();
    await click('Sign in');
    await page.getByLabel('Email or username', {exact:true}).fill('EventGear Admin');
    await page.getByLabel('Password', {exact:true}).fill('EventGear2026');
    await click('Sign in');
    await page.getByText('Management', {exact:true}).filter({visible:true}).last().waitFor({timeout:60000});
    await page.getByText(/User directory/).last().click();
    await page.getByText(`Email: ${email}`, {exact:true}).waitFor();
    assert.equal(await page.getByText(`Email: admin-${email}`, {exact:true}).count(),0);
    await page.getByText('Users (1)', {exact:true}).waitFor();
    assert.equal(await page.getByText('UserDemo', {exact:true}).count(),0);
    assert.equal(await page.getByText('Demo Customer', {exact:true}).count(),0);
    assert.equal(await page.getByText('EventGear Supplier', {exact:true}).count(),0);
    assert.equal(await page.getByText('Demo Administrator', {exact:true}).count(),0);

    // Reload the same origin and verify the previously registered customer remains.
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await click('Sign in as Administrator');
    await page.getByLabel('Username', {exact:true}).fill('EventGear Admin');
    await page.getByLabel('Password', {exact:true}).fill('EventGear2026');
    await click('Sign In');
    await page.getByText(/User directory/).last().click();
    await page.getByText(`Email: ${email}`, {exact:true}).waitFor();

    // An isolated browser starts with its own catalog and can register the same
    // email independently; its saved account also survives a normal reload.
    const firstPage = page;
    const freshContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page = await freshContext.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await click('Create an account');
    await fillRegistration('UI Test Customer',email);
    await page.getByText('WELCOME, UI TEST CUSTOMER', {exact:true}).waitFor();
    await click('Browse equipment');
    await page.getByText('6 results', {exact:true}).waitFor();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await click('Sign in');
    await page.getByLabel('Email or username', {exact:true}).fill(email);
    await page.getByLabel('Password', {exact:true}).fill(password);
    await click('Sign in');
    await page.getByText('WELCOME, UI TEST CUSTOMER', {exact:true}).waitFor();
    await freshContext.close();
    page = firstPage;
    assert.deepEqual(errors, []);
    console.log('PASS fixed administrator login, starter catalogs in isolated browsers, reload persistence, customer registration, login errors, role switching and customer-only directory');
  } catch (error) {
    if (page) {
      console.error('Page at failure:', (await page.locator('body').innerText()).slice(-2500));
      await page.screenshot({ path: path.join(root, 'auth-failure.png') });
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
