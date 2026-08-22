import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:3000/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Open the login page by clicking the 'Masuk' button
        # Masuk button
        elem = page.get_by_text('Demo', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Masuk', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'superadmin' into the Username field
        # checkbox
        elem = page.get_by_label('Login sebagai Super Admin', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'superadmin' into the Username field (placeholder 'Masukkan username') and 'Admin1234' into the Password field, then click the 'Masuk' button to submit the login form.
        # Masukkan username text field
        elem = page.get_by_placeholder('Masukkan username', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("superadmin")
        
        # -> Fill 'superadmin' into the Username field (placeholder 'Masukkan username') and 'Admin1234' into the Password field, then click the 'Masuk' button to submit the login form.
        # Masukkan password password field
        elem = page.get_by_placeholder('Masukkan password', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Admin1234")
        
        # -> Fill 'superadmin' into the Username field (placeholder 'Masukkan username') and 'Admin1234' into the Password field, then click the 'Masuk' button to submit the login form.
        # Masuk button
        elem = page.get_by_text('Username', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Masuk', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The browser is on the tenants workspace URL.
        # Assert-outcome: passed
        # Assert: Browser navigated to the tenants page.
        await expect(page).to_have_url(re.compile("/tenants"), timeout=15000), "Browser navigated to the tenants page."
        
        # --> The top-right header shows the Super Admin user label.
        # Assert-outcome: passed
        # Assert: Top-right user label contains 'Super Admin'.
        await expect(page.locator("xpath=/html/body/div[3]/div/header/div/div/div[2]/button").nth(0)).to_contain_text("Super Admin", timeout=15000), "Top-right user label contains 'Super Admin'."
        
        # --> The Tenant Management table is visible on the page.
        await page.locator("xpath=/html/body/div[3]/div/main/div/div[2]/div[2]/table/thead/tr").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: Tenant table header is visible.
        await expect(page.locator("xpath=/html/body/div[3]/div/main/div/div[2]/div[2]/table/thead/tr").nth(0)).to_be_visible(timeout=15000), "Tenant table header is visible."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    