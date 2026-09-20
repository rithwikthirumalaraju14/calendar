import { test, expect } from '@playwright/test';
import { preview } from 'vite';

const selectedDate = '2026-09-20';

async function ready(page) {
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
}

async function openDay(page, date = selectedDate) {
  await page.locator(`[data-date="${date}"]`).click();
  await expect(page.locator('#note-text')).toBeVisible();
}

async function closeSheet(page) {
  if (await page.locator('#close-editor').isVisible()) await page.locator('#close-editor').click();
}

async function save(page, text) {
  await page.locator('#note-text').fill(text);
  await page.locator('#save-note').click();
  await expect(page.locator('#save-status')).toHaveText('Saved on this device');
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-20T16:00:00Z'));
  await page.goto('/');
  await ready(page);
});

test('reload begins on the dark background without unstyled artwork', async ({ page }) => {
  await page.route(/\/assets\/index-.*\.(?:js|css)$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  const navigation = page.reload({ waitUntil: 'commit' });
  await navigation;
  await page.waitForTimeout(120);
  const firstPaint = await page.evaluate(() => ({
    background: getComputedStyle(document.body).backgroundColor,
    shellVisibility: getComputedStyle(document.querySelector('.app-shell')).visibility,
    logoWidth: document.querySelector('.brand-moon').getBoundingClientRect().width,
  }));
  expect(firstPaint.background).toBe('rgb(8, 11, 20)');
  // A warm cache may style the page before this sample; otherwise the app shell
  // must remain hidden so the browser never paints the raw, oversized SVG.
  expect(firstPaint.shellVisibility === 'hidden' || firstPaint.logoWidth <= 31).toBe(true);
  await ready(page);
  await expect(page.locator('.app-shell')).toBeVisible();
});

test('save, reload, edit, delete and undo a note', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.locator('#moon-canvas')).toHaveClass('is-ready');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('calendar.png'), fullPage: true });
  const note = 'A moonlit walk. 🌙\n<script>This is just a note.</script>';
  await openDay(page);
  await save(page, note);
  await page.screenshot({ path: testInfo.outputPath('note.png'), fullPage: true });
  await closeSheet(page);
  await expect(page.locator(`[data-date="${selectedDate}"]`)).toHaveClass(/has-note/);
  await page.reload();
  await ready(page);
  await openDay(page);
  await expect(page.locator('#note-text')).toHaveValue(note);
  await save(page, `${note}\nAnd a little more.`);
  await page.locator('#delete-note').click();
  await expect(page.locator('#note-text')).toHaveValue('');
  await page.locator('#toast-action').click();
  await expect(page.locator('#note-text')).toHaveValue(`${note}\nAnd a little more.`);
  await expect(page.locator('#save-status')).toHaveText('Saved on this device');
  expect(errors).toEqual([]);
});

test('unfinished and empty drafts survive switching dates and reopening', async ({ page }) => {
  await openDay(page);
  await page.locator('#note-text').fill('Not quite finished…');
  await expect(page.locator('#save-status')).toHaveText('Draft kept on this device');
  await closeSheet(page);
  await openDay(page, '2026-09-21');
  await expect(page.locator('#note-text')).toHaveValue('');
  await closeSheet(page);
  await page.reload();
  await ready(page);
  await openDay(page);
  await expect(page.locator('#note-text')).toHaveValue('Not quite finished…');
  await save(page, 'Now it is saved.');
  await page.locator('#note-text').fill('');
  await expect(page.locator('#save-status')).toHaveText('Draft kept on this device');
  await page.reload();
  await ready(page);
  await openDay(page);
  await expect(page.locator('#note-text')).toHaveValue('');
  await expect(page.locator('#save-note')).toBeDisabled();
});

test('cycle start persists and marks day 25 plus six careful days', async ({ page }) => {
  await openDay(page);
  await page.locator('#track-cycle').click();
  await expect(page.locator('#cycle-button-label')).toHaveText('Tracked · remove');
  await closeSheet(page);
  await expect(page.locator(`[data-date="${selectedDate}"]`)).toHaveClass(/is-cycle-start/);
  await page.locator('#next-month').click();
  await expect(page.locator('[data-date="2026-10-15"]')).toHaveClass(/is-expected/);
  for (let day = 15; day <= 20; day++) {
    await expect(page.locator(`[data-date="2026-10-${day}"]`)).toHaveClass(/is-careful/);
  }
  await expect(page.locator('[data-date="2026-10-21"]')).not.toHaveClass(/is-careful/);
  await page.reload();
  await ready(page);
  await openDay(page);
  await expect(page.locator('#cycle-button-label')).toHaveText('Tracked · remove');
  await page.locator('#track-cycle').click();
  await expect(page.locator('#cycle-button-label')).toHaveText('Track cycle');
  await page.locator('#toast-action').click();
  await expect(page.locator('#cycle-button-label')).toHaveText('Tracked · remove');
});

test('one-day-prior cycle reminder appears and requests a system notification', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'System notification interception is Chromium-specific.');
  await context.grantPermissions(['notifications']);
  await page.evaluate(() => {
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'granted' });
    window.__cycleNotifications = [];
    navigator.serviceWorker.getRegistration = async () => ({
      showNotification: async (title, options) => window.__cycleNotifications.push({ title, options }),
    });
  });
  await page.locator('#previous-month').click();
  await openDay(page, '2026-08-27');
  await page.locator('#track-cycle').click();
  await closeSheet(page);
  await expect(page.locator('#cycle-reminder')).toBeVisible();
  await expect(page.locator('#cycle-reminder-text')).toContainText('estimated for tomorrow');
  await expect.poll(() => page.evaluate(() => window.__cycleNotifications.length)).toBe(1);
  const notification = await page.evaluate(() => window.__cycleNotifications[0]);
  expect(notification.title).toBe('A gentle reminder from deyam');
  expect(notification.options.body).toContain('following 6 days');
  await page.reload();
  await ready(page);
  await page.waitForTimeout(300);
  await expect(page.locator('#cycle-reminder')).toBeVisible();
});

test('backup download, non-destructive restore, and malformed import', async ({ page }) => {
  await openDay(page);
  await save(page, 'Keep my existing writing.');
  await closeSheet(page);
  await page.locator('#menu-button').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-notes').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('deyam-2026-09-20.json');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.notes[0].text).toBe('Keep my existing writing.');
  const backup = {
    format: 'moonlit-pages', version: 1,
    notes: [
      { date: selectedDate, text: 'Do not replace the current note.', updatedAt: new Date().toISOString() },
      { date: '2026-09-21', text: 'A page from my other phone.', updatedAt: new Date().toISOString() },
    ],
    drafts: [{ date: '2026-09-22', text: 'An unfinished thought.', updatedAt: new Date().toISOString() }],
  };
  await page.locator('#backup-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator('#backup-status')).toHaveText('2 days restored. 1 existing day was kept.');
  await page.locator('#backup-file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...backup, notes: [{ ...backup.notes[0], date: '2026-02-30' }] })) });
  await expect(page.locator('#backup-status')).toContainText('Nothing was imported.');
  await page.locator('#close-options').click();
  await openDay(page);
  await expect(page.locator('#note-text')).toHaveValue('Keep my existing writing.');
  await closeSheet(page);
  await openDay(page, '2026-09-21');
  await expect(page.locator('#note-text')).toHaveValue('A page from my other phone.');
  await closeSheet(page);
  await openDay(page, '2026-09-22');
  await expect(page.locator('#note-text')).toHaveValue('An unfinished thought.');
});

test('cached app, moon and saved notes reopen offline', async ({ page, context, browserName }) => {
  test.setTimeout(60000);
  // An isolated server can be shut down for a real network failure. Windows
  // WebKit's offline-emulation switch also disables service-worker navigation.
  const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  try {
    await page.goto(url);
    await ready(page);
    await expect(page.locator('body')).toHaveAttribute('data-offline-ready', 'true', { timeout: 20000 });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    await openDay(page);
    await save(page, 'A page without an internet connection.');
    await closeSheet(page);
    await new Promise((resolve) => { server.httpServer.close(resolve); server.httpServer.closeAllConnections(); });
    await expect(fetch(url, { signal: AbortSignal.timeout(3000) })).rejects.toThrow();
    if (browserName === 'chromium') await context.setOffline(true);
    await page.reload();
    await ready(page);
    await expect(page.locator('#moon-canvas')).toHaveClass('is-ready');
    await openDay(page);
    await expect(page.locator('#note-text')).toHaveValue('A page without an internet connection.');
    await save(page, 'Edited while offline.');
    await page.reload();
    await ready(page);
    await openDay(page);
    await expect(page.locator('#note-text')).toHaveValue('Edited while offline.');
    await closeSheet(page);
    // The sticker section has never been opened online in this browser context.
    await page.locator('#open-stickers').click();
    await page.locator('.mood-button[data-mood="gn"]').click();
    await expect(page.locator('#corner-app')).toHaveAttribute('data-mood', 'gn');
    await expect(page.locator('.nightcap')).toHaveCSS('opacity', '1');
    await page.locator('#close-stickers').click();
  } finally {
    if (server.httpServer.listening) await new Promise((resolve) => { server.httpServer.close(resolve); server.httpServer.closeAllConnections(); });
  }
});

test('calendar keyboard navigation crosses months; mobile sheet traps focus', async ({ page, isMobile }) => {
  const today = page.locator(`[data-date="${selectedDate}"]`);
  await today.focus();
  await page.keyboard.press('PageDown');
  await expect(page.locator('[data-date="2026-10-20"]')).toBeFocused();
  await expect(page.locator('#month-heading')).toContainText('October');
  await page.keyboard.press('Enter');
  await expect(page.locator('#selected-date-label')).toContainText('OCTOBER 20, 2026');
  if (isMobile) {
    await expect(page.locator('#editor-panel')).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('#close-editor')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#track-cycle')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#editor-panel')).not.toBeVisible();
  }
  await page.locator('#today-button').click();
  await expect(page.locator('#month-heading')).toContainText('September');
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('a storage failure is visible and never claims a successful save', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open() { throw new Error('Storage unavailable'); } } });
  });
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'error');
  await openDay(page);
  await expect(page.locator('#note-text')).toBeDisabled();
  await expect(page.locator('#save-note')).toBeDisabled();
  await expect(page.locator('#toast-message')).toContainText('couldn’t open local storage');
});

test('failed saves keep the text recoverable as a draft', async ({ page }) => {
  await openDay(page);
  await page.locator('#note-text').fill('Please keep these words, even if saving fails.');
  await expect(page.locator('#save-status')).toHaveText('Draft kept on this device');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'notes') throw new DOMException('Storage full', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await page.locator('#save-note').click();
  await expect(page.locator('#save-status')).toHaveText('Couldn’t save. Your text is still here.');
  await expect(page.locator('#note-text')).toHaveValue('Please keep these words, even if saving fails.');
  await expect(page.locator(`[data-date="${selectedDate}"]`)).not.toHaveClass(/has-note/);
  await page.reload();
  await ready(page);
  await openDay(page);
  await expect(page.locator('#note-text')).toHaveValue('Please keep these words, even if saving fails.');
  await page.locator('#save-note').click();
  await expect(page.locator('#save-status')).toHaveText('Saved on this device');
});

test('narrow layouts fit and the editor stays above a simulated keyboard', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  for (const width of [320, 390, 820, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `Layout at ${width}px`).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await openDay(page);
  await page.locator('#note-text').fill('A note with every editor action visible.');
  await page.locator('#save-note').click();
  await expect(page.locator('#save-status')).toHaveText('Saved on this device');
  await page.locator('#track-cycle').click();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.locator('#editor-panel').evaluate((editor) => editor.scrollWidth <= editor.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    // Emulate a keyboard reducing the visual viewport while the layout viewport
    // stays tall, as on iOS and modern Android Chrome.
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 310 });
    Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, value: 0 });
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('#editor-panel')).toHaveClass(/is-compact/);
  const saveButton = await page.locator('#save-note').boundingBox();
  expect(saveButton.y + saveButton.height).toBeLessThanOrEqual(310);
  const editor = await page.locator('#note-text').boundingBox();
  expect(editor.height).toBeGreaterThanOrEqual(45);
  await page.screenshot({ path: testInfo.outputPath('compact-editor.png') });
});
