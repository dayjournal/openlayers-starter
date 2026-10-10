import {
    test,
    expect,
    stabilizeTileRequests,
    waitForMapReady,
    expectValidTileRequests,
    MAP_READY_TIMEOUT_MS,
} from './_helpers';

test('smoke: OpenLayers renders loaded tiles', async ({ page }) => {
    const tileUrls = await stabilizeTileRequests(page);

    await page.goto('/');
    await expect(page.locator('#map')).toBeVisible();

    // OpenLayers adds the layer's canvas to #map on its first render, so this
    // only matches once the map has initialized (one tile layer, one canvas).
    await expect(page.locator('#map canvas')).toHaveCount(1, { timeout: MAP_READY_TIMEOUT_MS });

    await waitForMapReady(page);
    await expectValidTileRequests(tileUrls);
});
