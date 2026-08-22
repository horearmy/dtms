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
        
        # -> Click the 'Masuk' button to open the login form.
        # Masuk button
        elem = page.get_by_text('Demo', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Masuk', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the 'Masukkan username' and 'Masukkan password' fields with the tenant admin credentials and click the 'Masuk' button to submit the login form.
        # Masukkan username text field
        elem = page.get_by_placeholder('Masukkan username', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("logistik_admin")
        
        # -> Fill the 'Masukkan username' and 'Masukkan password' fields with the tenant admin credentials and click the 'Masuk' button to submit the login form.
        # Masukkan password password field
        elem = page.get_by_placeholder('Masukkan password', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Admin1234")
        
        # -> Fill the 'Masukkan username' and 'Masukkan password' fields with the tenant admin credentials and click the 'Masuk' button to submit the login form.
        # Masuk button
        elem = page.get_by_text('Login sebagai Super Admin', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Masuk', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the username with 'superadmin' and password with 'Admin1234', then click the 'Masuk' button to attempt login as Super Admin.
        # Masukkan username text field
        elem = page.get_by_placeholder('Masukkan username', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("superadmin")
        
        # -> Fill the username with 'superadmin' and password with 'Admin1234', then click the 'Masuk' button to attempt login as Super Admin.
        # Masukkan password password field
        elem = page.get_by_placeholder('Masukkan password', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Admin1234")
        
        # -> Fill the username with 'superadmin' and password with 'Admin1234', then click the 'Masuk' button to attempt login as Super Admin.
        # Masuk button
        elem = page.get_by_text('Username', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Masuk', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Dashboard' link in the left navigation to open the dashboard page.
        # Dashboard link
        elem = page.get_by_role('link', name='Dashboard', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The dashboard shows a recent shipments list with at least one entry (recent resi visible).
        await page.locator("xpath=/html/body/div[2]/div/main/div/div[3]/div[1]/div[2]/table/tbody/tr[1]/td[1]/a").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: Recent shipment row is visible in the 'Shipment Terbaru' table.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div/div[3]/div[1]/div[2]/table/tbody/tr[1]/td[1]/a").nth(0)).to_be_visible(timeout=15000), "Recent shipment row is visible in the 'Shipment Terbaru' table."
        
        # --> A shipment-by-status chart/list is visible on the dashboard (status counts are shown).
        await page.locator("xpath=/html/body/div[2]/div/main/div/div[3]/div[2]/div[1]/div/div[1]/div[1]/span[2]").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: A shipment-by-status count element is visible on the dashboard.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div/div[3]/div[2]/div[1]/div/div[1]/div[1]/span[2]").nth(0)).to_be_visible(timeout=15000), "A shipment-by-status count element is visible on the dashboard."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    