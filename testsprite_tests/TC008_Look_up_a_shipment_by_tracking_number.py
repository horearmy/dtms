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
        
        # -> Click the 'Coba Tracking' button to open the public tracking lookup page.
        # Coba Tracking link
        elem = page.get_by_role('link', name='Coba Tracking', exact=True)
        await elem.click(timeout=10000)
        
        # -> Enter 'TRK000000117123' into the 'Nomor Resi' field and click the 'Lacak' button to submit the tracking lookup.
        # Contoh: DTMS-20260813-000001 text field
        elem = page.get_by_placeholder('Contoh: DTMS-20260813-000001', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("TRK000000117123")
        
        # -> Enter 'TRK000000117123' into the 'Nomor Resi' field and click the 'Lacak' button to submit the tracking lookup.
        # Lacak button
        elem = page.get_by_role('button', name='Lacak', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Shipment status badge is displayed on the tracking results card.
        await page.locator("xpath=/html/body/div[3]/main/div[2]/div/div[1]/span[2]").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The shipment status badge is visible.
        await expect(page.locator("xpath=/html/body/div[3]/main/div[2]/div/div[1]/span[2]").nth(0)).to_be_visible(timeout=15000), "The shipment status badge is visible."
        
        # --> Shipment tracking details (origin, destination, recipient, ETA, courier, vehicle, last update) are shown on the results card.
        await page.locator("xpath=/html/body/div[3]/main/div[2]/div/div[2]/span[2]").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The origin field (Asal) is visible on the results card.
        await expect(page.locator("xpath=/html/body/div[3]/main/div[2]/div/div[2]/span[2]").nth(0)).to_be_visible(timeout=15000), "The origin field (Asal) is visible on the results card."
        await page.locator("xpath=/html/body/div[3]/main/div[2]/div/div[5]/span").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The last-update field is visible on the results card.
        await expect(page.locator("xpath=/html/body/div[3]/main/div[2]/div/div[5]/span").nth(0)).to_be_visible(timeout=15000), "The last-update field is visible on the results card."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    