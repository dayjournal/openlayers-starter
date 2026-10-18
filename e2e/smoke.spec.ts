import {
    test,
    expect,
    stabilizeTileRequests,
    waitForMapReady,
    expectValidTileRequests,
    tileLevel,
    MAP_READY_TIMEOUT_MS,
} from './_helpers';

test('smoke: OpenLayers renders loaded tiles', async ({ page }) => {
    const tileUrls = await stabilizeTileRequests(page);

    await page.goto('./');
    await expect(page.locator('#map')).toBeVisible();

    // OpenLayers adds the layer's canvas to #map on its first render, so this
    // only matches once the map has initialized (one tile layer, one canvas).
    await expect(page.locator('#map canvas')).toHaveCount(1, { timeout: MAP_READY_TIMEOUT_MS });

    await waitForMapReady(page);
    await expectValidTileRequests(tileUrls);
});

test('smoke: the tile URL check rejects anything but a valid MIERUNE tile', async () => {
    expect(tileLevel('https://tile.mierune.co.jp/mierune_mono/11/1818/806.png')).toBe(11);
    for (const url of [
        // Wrong host, wrong path prefix, unexpanded template, out of range.
        'https://example.com/mierune_mono/11/1818/806.png',
        'https://tile.mierune.co.jp/other/mierune_mono/11/1818/806.png',
        'https://tile.mierune.co.jp/mierune_mono/{z}/{x}/{y}.png',
        'https://tile.mierune.co.jp/mierune_mono/11/2048/806.png',
        'https://tile.mierune.co.jp/mierune_mono/11/1818/2048.png',
    ]) {
        expect(tileLevel(url), url).toBe(-1);
    }
});
