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
        
        # -> Click the 'Masuk' button to open the login page.
        # Masuk button
        elem = page.get_by_text('Demo', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Masuk', exact=True)
        await elem.click(timeout=10000)
        
        # -> Check the 'Login sebagai Super Admin' checkbox to enable Super Admin login mode.
        # checkbox
        elem = page.get_by_label('Login sebagai Super Admin', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the username field with 'superadmin', fill the password field with 'Admin1234', then click the 'Masuk' button to sign in.
        # Masukkan username text field
        elem = page.get_by_placeholder('Masukkan username', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("superadmin")
        
        # -> Fill the username field with 'superadmin', fill the password field with 'Admin1234', then click the 'Masuk' button to sign in.
        # Masukkan password password field
        elem = page.get_by_placeholder('Masukkan password', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Admin1234")
        
        # -> Fill the username field with 'superadmin', fill the password field with 'Admin1234', then click the 'Masuk' button to sign in.
        # Masuk button
        elem = page.get_by_text('Username', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Masuk', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Komunikasi' link in the left sidebar to open the communication workspace.
        # Komunikasi link
        elem = page.get_by_role('link', name='Komunikasi', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the tenant named 'PT Logistik Nusantara' from the left tenant list to open its conversation.
        # PT Logistik Nusantara / logistik-nusantara button
        elem = page.get_by_role('button', name='PT Logistik Nusantara /logistik-nusantara', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Kirim Kredensial' button to open the send-credentials flow for the selected tenant.
        # Kirim Kredensial button
        elem = page.get_by_role('button', name='Kirim Kredensial', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Kirim' button in the send credentials modal to send the credentials message to the tenant.
        # Kirim button
        elem = page.get_by_role('button', name='Kirim', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> A credentials message titled 'Akun DTMS Anda Telah Aktif' appears in the PT Logistik Nusantara conversation.
        # Assert-outcome: passed
        # Assert: The conversation contains the credentials message titled 'Akun DTMS Anda Telah Aktif'.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div/div[2]/div[2]/div[2]/div[3]/div[3]/span[2]").nth(0)).to_contain_text("Akun DTMS Anda Telah Aktif", timeout=15000), "The conversation contains the credentials message titled 'Akun DTMS Anda Telah Aktif'."
        
        # --> The Komunikasi conversation pane remained open after sending (URL is /komunikasi).
        # Assert-outcome: passed
        # Assert: The browser stayed on the Komunikasi page after sending, keeping the conversation available.
        await expect(page).to_have_url(re.compile("komunikasi"), timeout=15000), "The browser stayed on the Komunikasi page after sending, keeping the conversation available."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    