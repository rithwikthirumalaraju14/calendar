# Completely Offline Scheduled Notifications

This document explains how notifications currently work in **deyam**, why a web
app cannot guarantee future offline notifications, and how to provide reliable
notifications on Android and iPhone without a server or internet connection.

## Current PWA behavior

deyam is currently an installable Progressive Web App (PWA). After its first
successful online load, the following features work offline:

- The calendar and note editor.
- Saved notes and unfinished drafts in IndexedDB.
- Cycle start date and calculated cycle dates.
- Moon and SVG animations.
- Backup downloads and restores.
- In-app cycle reminders.

When a date is marked with **Track cycle**, the app calculates:

- Estimated next date: selected date + 25 days.
- Reminder date: selected date + 24 days (one day before the estimate).
- Care window: six days beginning on the estimated date.

The app checks whether a reminder is due:

- When the app starts.
- When the app returns from the background.
- Every 15 minutes while the app remains open.

If notification permission is available and the reminder is due, the app asks the
browser/service worker to display a system notification. It also shows an in-app
reminder. All cycle data remains on the device.

## Important browser limitation

A PWA cannot reliably schedule JavaScript to run at an exact future time while it
is completely closed.

- `setTimeout` and `setInterval` stop when the browser/app is terminated.
- A service worker is event-driven and is not allowed to run continuously.
- Periodic Background Sync is not exact, is not consistently supported, and the
  operating system decides when or whether it runs.
- iPhone does not provide a standard PWA API for offline local notification
  scheduling.
- Web Push can wake a service worker, but it requires internet access and a push
  server. It is therefore not a completely offline solution.

Consequently, the current PWA can notify on the correct day when it is opened or
resumed, but it cannot guarantee an alert while fully closed and offline.

## Vercel deployment and app updates...

Vercel deploys deyam as an installable PWA, not as an APK. When the Vercel project
is connected to a Git repository, pushing to its configured production branch
automatically starts a new build and deployment. A project deployed manually must
be redeployed manually; a local Git push alone does not update it.

Use these Vercel build settings:

```text
Framework preset: Vite
Install command: npm install
Build command: npm run build
Output directory: dist
```

Use one permanent production or custom-domain URL. Notes, drafts, cycle settings,
notification permissions, and installed-PWA storage belong to the exact website
origin. Vercel preview URLs are different origins and therefore have separate
local data.

### Current update flow on an installed phone

deyam uses a safe, prompt-based service-worker update:

1. New changes are pushed and Vercel finishes the production deployment.
2. The installed app continues using its cached, offline-capable version.
3. When the app opens or returns to the foreground while online, it checks Vercel
   for a newer service worker.
4. When a new version is ready, app options show:

   > A fresh version is ready. Update ↗

5. The user taps **Update** to activate the new version.

If the prompt does not appear immediately, close and reopen deyam while online.
The prompt is intentional: it avoids an unexpected reload while someone is typing.
Notes, drafts, and cycle settings remain in IndexedDB during normal application
updates. An update does not clear them.

The app could use automatic activation instead, but prompt-based updates are safer
for this note-taking experience. Any future automatic-update implementation should
wait for pending local writes and avoid reloading while an editor is active.

Installing from Vercel on Android or iPhone creates a home-screen PWA. It does not
download an APK. An actual APK must first be built with Capacitor and Android
Studio; Vercel can host that completed file but cannot compile it.

## Reliable offline solution

Package the existing web application as Android and iPhone apps using
[Capacitor](https://capacitorjs.com/) and its Local Notifications plugin.

Native local notifications are scheduled with the phone's operating system. After
scheduling, they can appear when:

- deyam is closed or terminated.
- The phone has no internet connection.
- The screen is locked.
- The phone has restarted, subject to platform scheduling rules and permissions.

No backend, user account, cloud database, or push-notification server is required.
The built web assets are included inside the installed app, so the calendar itself
also opens without internet from its first launch.

## Intended native flow

1. The user selects a calendar date and taps **Track cycle**.
2. deyam saves the selected date locally.
3. It calculates the expected date and the one-day-prior reminder date.
4. It cancels any previously scheduled cycle notification.
5. It requests notification permission if it has not already been granted.
6. It schedules a native local notification for the reminder date.
7. Android or iOS stores and displays the notification independently of the app.
8. Selecting a different start date replaces the existing schedule.
9. Tapping **Tracked · remove** cancels the pending native notification.

The six care days remain visual estimates in the calendar. The notification body
can remain discreet, for example:

> A gentle reminder: your expected date is tomorrow. Take a little extra care for
> the following six days.

## Suggested data model

Keep the existing local cycle record and add the native notification identifier:

```json
{
  "startDate": "2026-09-20",
  "expectedDate": "2026-10-15",
  "reminderDate": "2026-10-14",
  "notificationId": 2501,
  "updatedAt": "2026-09-20T12:00:00.000Z"
}
```

Only one active cycle schedule is needed. A fixed notification ID allows the app
to cancel or replace the previous notification safely.

## Capacitor setup outline

The native conversion should be performed as a separate implementation step:

```sh
npm install @capacitor/core @capacitor/cli
npx cap init deyam com.deyam.app --web-dir=dist
npm install @capacitor/local-notifications
npx cap add android
npx cap add ios
npm run build
npx cap sync
```

Android Studio is required to build and sign Android releases. Xcode on macOS is
required to build and sign iPhone releases.

The application should detect whether it is running inside Capacitor:

- Native app: schedule/cancel notifications with `LocalNotifications`.
- Browser/PWA: retain the existing in-app and best-effort browser notification.

This keeps one codebase working as both a website and native mobile application.

## Platform permissions

### Android

- Android 13 and newer require notification permission.
- Recent Android versions may restrict exact alarms. If an exact time is required,
  additional manifest permission and user approval may be needed.
- A reminder that only needs to appear on the correct day can normally use a
  non-exact local notification and avoid unnecessary exact-alarm complexity.
- Battery optimization behavior must be tested on real devices from multiple
  manufacturers.

### iPhone

- The app must request notification permission through iOS.
- Local notifications are scheduled by iOS and do not require internet.
- Building and distributing the app requires Xcode, signing, and an Apple
  Developer workflow (TestFlight, App Store, or permitted device installation).

Permission denial must not break cycle tracking. The dates should still be saved
and shown in the calendar, with a clear message explaining that system alerts are
disabled.

## Privacy

- Notes and cycle dates remain local to the device.
- Local notification scheduling does not upload cycle information.
- No analytics or notification server is required.
- Notification text can appear on the lock screen. Use discreet wording and let
  the user control notification previews through phone settings.
- Cycle estimates are informational calendar reminders, not medical predictions.

## Time and date handling

- Store cycle dates as local calendar keys (`YYYY-MM-DD`), not UTC timestamps.
- Convert the reminder date to a native scheduled date using the phone's current
  local time zone.
- Choose a configurable reminder time, such as 9:00 AM.
- Recalculate and reschedule when the user changes the tracked date.
- Test daylight-saving changes, time-zone changes, leap years, and month/year
  boundaries.

## Required testing

Test on physical Android and iPhone devices:

1. Grant notification permission and schedule a reminder.
2. Put the device in airplane mode.
3. Fully terminate deyam.
4. Lock the screen and confirm the notification appears.
5. Restart the phone and verify the pending schedule remains valid.
6. Change the tracked date and verify the old notification is cancelled.
7. Remove cycle tracking and verify no notification appears.
8. Deny permission and verify calendar tracking still works.
9. Check lock-screen privacy and notification wording.
10. Verify notes, cycle data, SVGs, and calendar operation without internet.

## Summary

The current PWA is fully usable offline, but its future notification is
best-effort and requires the app to be opened or resumed on the reminder day.
Reliable scheduled notifications while closed and offline require native local
notifications. Capacitor is the recommended path because it can reuse the existing
deyam interface and local storage design without introducing a backend.
