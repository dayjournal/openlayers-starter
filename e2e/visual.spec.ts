import {
    test,
    expect,
    stabilizeTileRequests,
    expectValidTileRequests,
    MAP_READY_TIMEOUT_MS,
} from './_helpers';

test('visual: map container screenshot', async ({ page }) => {
    const tileUrls = await stabilizeTileRequests(page);

    await page.goto('/');
    const map = page.locator('#map');
    await expect(map).toBeVisible();

    // OpenLayers draws all tiles into one canvas, so there are no tile elements
    // to wait on. Once the tiles are requested, waiting for network idle (500ms
    // with no requests) outlasts the 250ms tile fade-in, and its timeout fails
    // here instead of at the 60s test timeout. Two animation frames then let the
    // final draw reach the screen.
    await expectValidTileRequests(tileUrls);
    await page.waitForLoadState('networkidle', { timeout: MAP_READY_TIMEOUT_MS });
    await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );

    // No baseline is committed (snapshotDir is gitignored; see playwright.config.ts):
    // the first local run writes .playwright-snapshots/ and fails — rerun to compare.
    await expect(map).toHaveScreenshot('map.png', {
        // Keep it tight to reduce irrelevant diffs
        animations: 'disabled',
        scale: 'css',
    });
});
