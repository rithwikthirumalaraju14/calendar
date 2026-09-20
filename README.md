# deyam

A personal, moon-themed calendar made for deyam. Pick a date, write, and save;
open **Little surprises** for a tiny ghost with a whole lot of feelings.
Built with Vite, vanilla JavaScript/CSS, IndexedDB, and an offline service worker.

## Run locally

Requires Node.js 22.12+ (or 20.19+).

```sh
npm install
npm run dev
```

Open the localhost URL shown in the terminal. The dev server also prints a network
URL for a phone on the same Wi-Fi. Local notes work there, but installation and
offline caching require HTTPS (or localhost on the device running the browser).

## Preview the installable app

```sh
npm run build
npm run preview
```

Open `http://localhost:4173`. Wait for **Ready for offline moments** in app options
before trying airplane mode. Development mode intentionally does not register a
service worker.

## Put it on your phone

1. Run `npm run build`.
2. Upload the **contents of `dist/`** to a static HTTPS host, such as Netlify,
   Cloudflare Pages, or GitHub Pages. A Netlify manual deploy accepts the `dist`
   folder. No application server or database service is required.
3. Open the deployed HTTPS address on your phone and let the first load finish.
4. **Android / Chrome:** browser menu → **Install app** or **Add to Home screen**.
5. **iPhone / Safari:** Share → **Add to Home Screen**. Enable **Open as Web App**
   if that option is shown, then tap **Add**.
6. Open the home-screen app once while online, then use it offline.

For a build-based host, the build command is `npm run build` and the output folder
is `dist`. Relative asset paths support hosting in a subdirectory as well.

Use a stable address. Browser storage belongs to a particular origin (protocol,
hostname, and port) and browser profile. A new domain, another browser, another
phone, or some home-screen contexts can have separate storage. Use backup/restore
to move your writing rather than assuming it will automatically appear there.

## Your pages

- **Save note** saves one plain-text note for the selected local date.
- Notes survive reloads and normal app/browser closing on that device.
- Typing also keeps an independent unfinished draft in IndexedDB. A hollow dot
  indicates a draft-only date; a filled dot indicates a saved note.
- Deleting a page offers **Undo** for ten seconds.
- **App options → Download backup** exports saved notes and drafts as JSON.
- **Restore backup** adds missing dates and keeps dates with existing notes or
  drafts. Invalid backups are rejected before writing anything. Supported backups
  are up to 10 MB; individual notes support up to 1,000,000 UTF-16 code units.
- Clearing website data, browser eviction, private browsing ending, or removing
  app data can remove local pages. Keep a downloaded backup for long-term storage.
- Notes are not uploaded or automatically synced. IndexedDB storage uses the
  browser's normal device protections; this app does not add a separate password
  or encryption layer.

## Cycle reminder

- Pick today or an earlier calendar date and tap **Track cycle** in the note panel.
- deyam marks that start date, estimates the next date 25 days later, and marks a
  six-day care window beginning on the estimated date.
- One day before the estimate, it shows an in-app reminder and attempts a private
  system notification if browser permission was granted.
- Browsers do not provide reliable local scheduled notifications while a PWA is
  fully closed. Open the app regularly; it checks on launch, when returning to the
  app, and while it remains open. This limitation is shown inside app options.
- Tap **Tracked · remove** on the tracked start date to clear it; Undo is available.
- The date is stored only in the app's local IndexedDB settings and is not included
  in note backup files. These are calendar estimates, not medical guidance.

For guaranteed notifications while the app is fully closed and offline, see
[`OFFLINE-NOTIFICATIONS.md`](OFFLINE-NOTIFICATIONS.md).

## Accessibility and controls

- Calendar: arrow keys move focus, Home/End move within the week,
  Page Up/Down change month, Shift + Page Up/Down change year, Enter selects.
- Editor: Ctrl/⌘ + Enter saves. Escape closes the mobile editor.
- The mobile sheet keeps focus inside it. Text entry is 16px on phones to avoid
  iOS input zoom, and the sheet follows the visual viewport above the keyboard.
- Motion follows the device's reduced-motion preference.

## Little surprises

The ghost button in the header opens a dedicated animated-SVG section:

- **Just deyam, Say hi, Happy, Love you, Angry, Good morning, Good night** use the
  original morphing ghost, expressions, and costume layers from
  `stickeranimation idea/index.html`, with personalized vector `deyam` lettering.
- **Doorway hello → Open the door** plays the reference's hinged-door entrance,
  peek, float, and wave inside this section. **Skip hello** returns immediately.
- Tap the ghost to boop it. Booping the sleeping ghost wakes it for the morning.
- **Replay** restarts a reaction. **Pause motion** freezes it.
- Closing the section or hiding the browser tab suspends animation work. The
  device's reduced-motion setting displays still poses and disables the doorway.
- The native dialog supports Escape, keyboard focus containment, and return focus
  to the header button. SVG styles are isolated from the calendar in a shadow root.
- All SVGs, animation code, and fonts are bundled locally and precached for offline
  use, including opening this section for the first time while offline.

### Personalize it further

- `index.html`: greeting, brand, page copy, and section title.
- `src/stickers/poses.js`: the seven mood labels and personal messages.
- `src/stickers/ghost.svg`: the artwork, costumes, and hand-drawn name paths.
- `src/stickers/art.css`: the sticker section's layout and animation styling.
- `public/icon.svg`: the matching ghost home-screen icon (`npm run icons` rebuilds PNGs).
- `vite.config.js`: the installed app's name and description.

The rebrand keeps the original IndexedDB database so existing pages remain
available at the same browser origin. New downloads are named `deyam-YYYY-MM-DD.json`;
restoring also accepts backups from the earlier Moonlit Pages version.

## Checks

```sh
npm test
npx playwright install chromium webkit
npm run build
npm run test:e2e
```

Browser tests cover desktop Chromium, Android-style Chromium, and iPhone-style
WebKit. They exercise saving/reopening, editing, draft recovery, deleting/undoing,
backup download/restore, cycle calculations and persistence, offline reloads and edits, keyboard navigation, narrow
layouts, simulated keyboard resizing, storage-open/write failures, all seven ghost
moods, animation pause/cleanup, the doorway, and reduced-motion behavior. The offline
test shuts down a dedicated server; Chromium also uses offline network emulation.
These are browser simulations; home-screen installation
and the actual on-screen keyboard should also be checked on physical phones.

## Project layout

```text
index.html               App structure and dialogs
src/styles.css           deyam theme, desktop layout, mobile sheet
src/main.js              Calendar and note interactions
src/dates.js             Local calendar-date helpers
src/storage.js           IndexedDB transactions
src/backup.js            Backup format and validation
src/lunar-surface.js     Textured moon renderer adapted from the Night Garden
src/pwa.js               Offline/update/install interface
src/stickers/            Personalized SVG artwork, mood controls, doorway animation
public/                  Local moon texture and app icons
vite.config.js           Build, PWA manifest, and offline cache configuration
tests/                   Date/backup unit tests and browser workflows
```

The moon uses the same texture as `tree-season-recovered/final_one`, downloaded
locally from the three.js examples. Fonts are locally bundled Cormorant Garamond
and Plus Jakarta Sans from Fontsource. See `public/assets/README.md` for sources.
Regenerate the PNG home-screen icons from `public/icon.svg` with `npm run icons`.
