import { expect, test as base, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

declare global {
    interface Window {
        __OPENLAYERS_E2E__?: {
            images: Map<HTMLImageElement, boolean>;
            errors: string[];
        };
    }
}

// Fixture tiles keep map screenshots stable. See fixtures/README.md to update them.
const TILES_DIR = path.join(__dirname, 'fixtures', 'tiles');

// Missing tiles use a gray grid so tile placement remains visible.
const TILE_PNG = fs.readFileSync(path.join(__dirname, 'fixtures', 'fallback.png'));

// Validate each request before a fixture can hide an invalid tile URL. The
// whole URL is matched, so a wrong host or path prefix in the app's URL
// template cannot pass.
const TILE_ORIGIN = 'https://tile.mierune.co.jp';
const TILE_URL_PATTERN =
    /^https:\/\/tile\.mierune\.co\.jp\/mierune_mono\/(\d+)\/(\d+)\/(\d+)\.png$/;
// A 1280x720 viewport requests ~20+ tiles; well below that means the map broke.
const MIN_EXPECTED_TILES = 12;
// Budget for the map to fully come up (tiles requested / loaded / faded in).
// Above the 10s expect timeout, well under the 60s test timeout (playwright.config.ts).
export const MAP_READY_TIMEOUT_MS = 15_000;

// Fail any test that produced an uncaught page error (includes unhandled
// rejections), a console error, a failed tile image or a request to anything
// but the preview server and the mocked tile host during its run. The fixture
// is auto: true, so every spec importing `test` from this file gets the check
// implicitly — there is nothing to call from the spec.
const test = base.extend<{ _runtimeErrors: void }>({
    _runtimeErrors: [
        async ({ page, baseURL }, use) => {
            const errors: string[] = [];
            await page.addInitScript(() => {
                const state = {
                    images: new Map<HTMLImageElement, boolean>(),
                    errors: [] as string[],
                };
                window.__OPENLAYERS_E2E__ = state;

                // OpenLayers keeps tile images outside the DOM. Observe native
                // images and canvas draws in the test page, leaving the app unchanged.
                window.Image = new Proxy(window.Image, {
                    construct(target, args, newTarget) {
                        const image = Reflect.construct(
                            target,
                            args,
                            newTarget
                        ) as HTMLImageElement;
                        state.images.set(image, false);
                        image.addEventListener('error', () => {
                            if (image.src.startsWith('https://tile.mierune.co.jp/')) {
                                state.errors.push(`tile load failed: ${image.src}`);
                            }
                        });
                        return image;
                    },
                });
                const drawImage = CanvasRenderingContext2D.prototype.drawImage;
                CanvasRenderingContext2D.prototype.drawImage = new Proxy(drawImage, {
                    apply(target, context: CanvasRenderingContext2D, args) {
                        const result = Reflect.apply(target, context, args);
                        const image = args[0];
                        if (
                            image instanceof HTMLImageElement &&
                            state.images.has(image) &&
                            context.globalAlpha === 1 &&
                            context.canvas instanceof HTMLCanvasElement &&
                            context.canvas.closest('#map')
                        ) {
                            state.images.set(image, true);
                        }
                        return result;
                    },
                });
            });
            // Routes are matched newest first, so this catch-all only sees
            // requests that stabilizeTileRequests did not take. Anything that
            // would leave the preview server is a network dependency the
            // tests must not have.
            if (!baseURL) throw new Error('baseURL is required to tell preview requests apart');
            const previewOrigin = new URL(baseURL).origin;
            await page.route('**/*', (route) => {
                const url = route.request().url();
                if (url.startsWith(`${previewOrigin}/`)) return route.fallback();
                errors.push(`unexpected request: ${url}`);
                return route.abort();
            });
            page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
            page.on('console', (msg) => {
                if (msg.type() !== 'error') return;
                // Safety net for specs that skip stabilizeTileRequests: the browser's
                // automatic favicon request 404s against vite preview. Match on the
                // message's source URL only, so real errors that merely mention
                // "favicon.ico" in their text are still reported.
                if ((msg.location()?.url ?? '').includes('favicon.ico')) return;
                errors.push(`console.error: ${msg.text()}`);
            });
            await use();
            errors.push(...(await page.evaluate(() => window.__OPENLAYERS_E2E__?.errors ?? [])));
            expect(errors, 'runtime errors detected during test').toEqual([]);
        },
        { auto: true },
    ],
});

// Serve local tiles and collect the requested URLs for expectValidTileRequests.
async function stabilizeTileRequests(page: Page): Promise<string[]> {
    const tileUrls: string[] = [];
    // The browser requests /favicon.ico on its own; vite preview would 404 it,
    // which the runtime-error fixture would flag as a console error.
    await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }));
    await page.route(`${TILE_ORIGIN}/**`, async (route) => {
        const url = route.request().url();
        tileUrls.push(url);
        // A bad URL gets no fixture; expectValidTileRequests reports it.
        if (tileLevel(url) < 0) return route.abort();
        const [z, x, y] = TILE_URL_PATTERN.exec(url)!.slice(1);
        const fixture = path.join(TILES_DIR, z, x, `${y}.png`);
        const body = fs.existsSync(fixture) ? fs.readFileSync(fixture) : TILE_PNG;
        try {
            await route.fulfill({
                status: 200,
                headers: {
                    'cache-control': 'public, max-age=31536000',
                },
                contentType: 'image/png',
                body,
            });
        } catch (error) {
            // A fulfillment can lose the race against the page closing during
            // teardown; anything else is a real mock failure and must surface.
            if (!page.isClosed()) throw error;
        }
    });
    return tileUrls;
}

// Level of a well-formed tile URL on the tile host, or -1. Web Mercator has
// 2^z tiles per axis at level z, so larger x or y never exist on the server.
function tileLevel(url: string): number {
    const match = TILE_URL_PATTERN.exec(url);
    if (!match) return -1;
    const [z, x, y] = match.slice(1).map(Number);
    const tilesPerAxis = 2 ** z;
    return [z, x, y].every(Number.isSafeInteger) &&
        Number.isFinite(tilesPerAxis) &&
        x < tilesPerAxis &&
        y < tilesPerAxis
        ? z
        : -1;
}

async function waitForMapReady(page: Page) {
    await page.waitForFunction(
        (minimumTiles) => {
            const state = window.__OPENLAYERS_E2E__;
            if (state?.errors.length) throw new Error(state.errors.join('\n'));
            const tiles = Array.from(state?.images ?? []).filter(([image]) =>
                image.src.startsWith('https://tile.mierune.co.jp/')
            );
            const failed = tiles.find(([image]) => image.complete && image.naturalWidth === 0);
            if (failed) throw new Error(`tile load failed: ${failed[0].src}`);
            return (
                tiles.length >= minimumTiles &&
                tiles.every(([image, drawn]) => image.complete && image.naturalWidth > 0 && drawn)
            );
        },
        MIN_EXPECTED_TILES,
        { timeout: MAP_READY_TIMEOUT_MS }
    );
}

async function expectValidTileRequests(tileUrls: string[]) {
    await expect
        .poll(() => tileUrls.length, {
            message: 'expected the map to request tiles',
            timeout: MAP_READY_TIMEOUT_MS,
        })
        .toBeGreaterThanOrEqual(MIN_EXPECTED_TILES);
    const invalid = tileUrls.filter((url) => tileLevel(url) < 0);
    expect(
        invalid,
        `tile URLs should be ${TILE_ORIGIN}/mierune_mono/{z}/{x}/{y}.png with coordinates in range`
    ).toEqual([]);
}

export { expect, test, stabilizeTileRequests, waitForMapReady, expectValidTileRequests, tileLevel };
