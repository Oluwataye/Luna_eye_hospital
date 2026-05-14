const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  const log = (msg) => { console.log(msg); logs.push(msg); };

  try {
    log('1. Navigating to login...');
    await page.goto('http://127.0.0.1/');
    await page.waitForSelector('input[placeholder*="Username"]');

    log('2. Attempting login as admin...');
    await page.type('input[placeholder*="Username"]', 'admin');
    await page.type('input[placeholder*="Password"]', 'password');
    await page.click('button[type="submit"], button:has-text("Log In")');

    // Wait for either dashboard or error
    try {
      await page.waitForSelector('.card, .dashboard', { timeout: 3000 });
      log('SUCCESS: Logged in and reached dashboard.');
    } catch(err) {
      const errorText = await page.evaluate(() => document.body.innerText);
      if (errorText.includes('Invalid username')) {
         log('FAILED: Invalid username or password. Default password might not be "password".');
         // We will stop here if login fails.
         await browser.close();
         return;
      } else {
         log('FAILED: Did not reach dashboard. ' + err.message);
      }
    }

    // TODO: Add more steps once we fix the login!

  } catch(e) {
    log('ERROR: ' + e.message);
  } finally {
    await browser.close();
  }
})();
