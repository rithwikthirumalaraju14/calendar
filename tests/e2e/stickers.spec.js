import { test, expect } from '@playwright/test';

test.setTimeout(90000);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
});

test('deyam branding and all seven original SVG moods', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page).toHaveTitle('deyam — a little place, just for you');
  await expect(page.locator('.brand')).toContainText('deyam');
  await expect(page.locator('#hero-title')).toHaveText('Hey, deyam.Stay a little.');
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  expect(manifest.name).toBe('deyam');
  await page.locator('#open-stickers').click();
  await expect(page.getByRole('dialog', { name: 'Tiny ghost. Big feelings.' })).toBeVisible();
  await expect(page.locator('.mood-button')).toHaveCount(7);
  await expect(page.locator('#deyam-lettering .name-letter')).toHaveCount(5);
  const moods = [
    ['idle', '.everyday-sparkles'], ['hi', '.big-smile'], ['happy', '.happy-effects'],
    ['love', '.love-effects'], ['angry', '.arm-folds'], ['morning', '.morning-sky'], ['gn', '.nightcap'],
  ];
  for (const [name, layer] of moods) {
    await page.locator(`.mood-button[data-mood="${name}"]`).click();
    await expect(page.locator('#corner-app')).toHaveAttribute('data-mood', name);
    await expect(page.locator(`.mood-button[data-mood="${name}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(layer)).toHaveCSS('opacity', '1');
    await expect(page.locator('#body-shape')).not.toHaveAttribute('d', /NaN|undefined/);
    if (testInfo.project.name === 'desktop-chromium' && ['love', 'morning', 'gn'].includes(name)) {
      // Let the morph settle for visual inspection of the adapted costume/name.
      await page.waitForTimeout(750);
      await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
    }
  }
  await page.locator('#boop').click();
  await expect(page.locator('#corner-app')).toHaveAttribute('data-mood', 'morning');
  await expect(page.locator('#speech')).toHaveText('Oh! Morning already, deyam?');
  expect(errors).toEqual([]);
});

test('pause, replay, modal focus, cleanup, and narrow screen layout', async ({ page }) => {
  await page.locator('#open-stickers').click();
  await expect(page.locator('#close-stickers')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#doorway')).toBeFocused();
  await page.locator('.mood-button[data-mood="hi"]').click();
  await page.locator('#pause').click();
  await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'true');
  const stopped = await page.locator('#body-shape').getAttribute('d');
  await page.waitForTimeout(180);
  expect(await page.locator('#body-shape').getAttribute('d')).toBe(stopped);
  await expect(page.locator('.actor')).toHaveCSS('animation-play-state', 'paused');
  await page.locator('#pause').click();
  await page.locator('#replay').click();
  await expect.poll(() => page.locator('#body-shape').getAttribute('d')).not.toBe(stopped);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 740 });
    expect(await page.locator('#stickers-dialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#stickers-dialog')).not.toBeVisible();
  await expect(page.locator('#open-stickers')).toBeFocused();
  await expect(page.locator('#open-stickers')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#corner-shell')).toHaveClass(/is-dormant/);
  const closedPose = await page.locator('#body-shape').getAttribute('d');
  await page.waitForTimeout(180);
  expect(await page.locator('#body-shape').getAttribute('d')).toBe(closedPose);
  await page.locator('#open-stickers').click();
  await expect(page.locator('#corner-shell')).not.toHaveClass(/is-dormant/);
  await expect(page.locator('#corner-app')).toHaveAttribute('data-mood', 'hi');
});

test('doorway can play, skip, and close without losing the live ghost', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('#open-stickers').click();
  await page.locator('#doorway').click();
  await expect(page.locator('#open-door')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('doorway.png'), fullPage: true });
  await page.locator('#skip-entrance').click();
  await expect(page.locator('#entrance')).not.toBeVisible();
  await expect(page.locator('#character #reaction')).toHaveCount(1);
  await page.locator('#doorway').click();
  await page.locator('#open-door').click();
  await expect(page.locator('#entrance')).not.toBeVisible({ timeout: 20000 });
  await expect(page.locator('#character #reaction')).toHaveCount(1);
  await expect(page.locator('#corner-app')).not.toHaveAttribute('inert', '');
  await page.locator('#doorway').click();
  await page.locator('#open-door').click();
  await page.locator('#close-stickers').click();
  await page.locator('#open-stickers').click();
  await expect(page.locator('#entrance')).not.toBeVisible();
  await expect(page.locator('#character #reaction')).toHaveCount(1);
  await page.locator('.mood-button[data-mood="morning"]').click();
  await expect(page.locator('.morning-coffee-group')).toHaveCSS('opacity', '1');
  expect(errors).toEqual([]);
});

test('reduced motion shows complete still poses and cancels an active doorway', async ({ page }) => {
  await page.locator('#open-stickers').click();
  await page.locator('#doorway').click();
  await page.locator('#open-door').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#entrance')).not.toBeVisible();
  await expect(page.locator('#pause-label')).toHaveText('Reduced motion');
  await expect(page.locator('#pause')).toBeDisabled();
  await expect(page.locator('#doorway')).toBeDisabled();
  await page.locator('.mood-button[data-mood="gn"]').click();
  await expect(page.locator('.nightcap')).toHaveCSS('opacity', '1');
  await expect(page.locator('.actor')).toHaveCSS('animation-name', 'none');
  await page.locator('#close-stickers').click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#open-stickers').click();
  await expect(page.locator('#pause')).toBeEnabled();
  await expect(page.locator('#doorway')).toBeEnabled();
});
