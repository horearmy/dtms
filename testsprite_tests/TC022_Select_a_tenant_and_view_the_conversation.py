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
        
        # -> Click the 'Masuk' button to open the login page
        # Masuk button
        elem = page.get_by_text('Demo', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Masuk', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Login sebagai Super Admin' checkbox to enable Super Admin login mode and wait for the form to update.
        # checkbox
        elem = page.get_by_label('Login sebagai Super Admin', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'superadmin' into the Username field and 'Admin1234' into the Password field, then click the 'Masuk' button to submit the Super Admin login.
        # Masukkan username text field
        elem = page.get_by_placeholder('Masukkan username', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("superadmin")
        
        # -> Fill 'superadmin' into the Username field and 'Admin1234' into the Password field, then click the 'Masuk' button to submit the Super Admin login.
        # Masukkan password password field
        elem = page.get_by_placeholder('Masukkan password', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Admin1234")
        
        # -> Fill 'superadmin' into the Username field and 'Admin1234' into the Password field, then click the 'Masuk' button to submit the Super Admin login.
        # Masuk button
        elem = page.get_by_text('Username', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Masuk', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Komunikasi' link in the left sidebar to open the Communication workspace.
        # Komunikasi link
        elem = page.get_by_role('link', name='Komunikasi', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'PT Logistik Nusantara' tenant in the left 'Pilih Tenant' list to open its conversation thread.
        # PT Logistik Nusantara / logistik-nusantara button
        elem = page.get_by_role('button', name='PT Logistik Nusantara /logistik-nusantara', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The conversation panel for PT Logistik Nusantara opened.
        await page.locator("xpath=/html/body/div[2]/div/main/div/div[2]/div[2]/div[1]/div[2]/button[2]").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: failed
        # Assert: Expected the conversation panel controls (+ Pesan Baru) to be visible.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div/div[2]/div[2]/div[1]/div[2]/button[2]").nth(0)).to_be_visible(timeout=15000), "Expected the conversation panel controls (+ Pesan Baru) to be visible."
        
        # --> The conversation area did not show existing messages (it displayed a no-messages placeholder).
        # Assert-outcome: failed
        # Assert: Expected the conversation area to show existing messages.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div/div[2]/div[2]/div[1]/div[2]/button[2]").nth(0)).to_contain_text("Belum ada pesan", timeout=15000), "Expected the conversation area to show existing messages."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    