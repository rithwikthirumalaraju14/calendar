import { registerSW } from 'virtual:pwa-register';

export function setupPwa({ beforeUpdate, notify }) {
  const $ = (id) => document.getElementById(id);
  let installPrompt;
  let offlineReady = false;
  const installed = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function showInstallInstructions() {
    if (installed()) {
      $('install-instructions').textContent = 'deyam has a little home on your device. Your pages and your tiny ghost are always a tap away.';
    } else if (isAppleMobile) {
      $('install-instructions').textContent = 'In Safari, tap Share → Add to Home Screen. If shown, turn on Open as Web App, then tap Add. Use that home-screen icon for your pages.';
    } else if (/Android/.test(navigator.userAgent)) {
      $('install-instructions').textContent = 'In Chrome, open the ⋮ menu and choose Install app or Add to Home screen. Your pages will be a tap away.';
    } else {
      $('install-instructions').textContent = 'Use the install icon in your browser’s address bar, or open this site on your phone and add it to your home screen.';
    }
    $('install-button').hidden = !installPrompt || installed();
  }

  function setOfflineStatus(message) {
    $('offline-status').replaceChildren();
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    $('offline-status').append(dot, document.createTextNode(message));
  }

  function updateConnection() {
    $('connection-label').textContent = navigator.onLine ? 'ON THIS DEVICE' : 'OFFLINE · STILL YOURS';
    if (offlineReady) setOfflineStatus(navigator.onLine ? 'Ready for offline moments' : 'You’re offline. Your pages still work.');
  }

  async function confirmOfflineReady() {
    try {
      const cachedShell = await caches.match(new URL('index.html', document.baseURI).href, { ignoreSearch: true });
      if (!cachedShell) throw new Error('The offline app shell is missing.');
      offlineReady = true;
      document.body.dataset.offlineReady = 'true';
      updateConnection();
    } catch {
      setOfflineStatus('Offline setup didn’t finish. Reopen while online to retry.');
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    showInstallInstructions();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; showInstallInstructions(); });
  $('install-button').addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    $('install-button').hidden = true;
    try { await prompt.prompt(); await prompt.userChoice; } catch { /* The browser instructions remain available. */ }
    showInstallInstructions();
  });
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  showInstallInstructions();
  updateConnection();

  if (import.meta.env.DEV) {
    setOfflineStatus('Offline installation is available in the production build');
    return;
  }
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    setOfflineStatus('Open the HTTPS site to enable offline access');
    return;
  }

  const updateSW = registerSW({
    immediate: true,
    onOfflineReady: confirmOfflineReady,
    onNeedRefresh() { $('update-button').hidden = false; },
    onRegisteredSW(_url, registration) {
      if (registration?.active) confirmOfflineReady();
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && navigator.onLine) registration?.update().catch(() => {});
      });
    },
    onRegisterError(error) {
      console.error('Offline setup failed:', error);
      setOfflineStatus('Offline setup didn’t finish. Reopen while online to retry.');
    },
  });
  $('update-button').addEventListener('click', async () => {
    $('update-button').disabled = true;
    try {
      await beforeUpdate();
      await updateSW(true);
    } catch {
      notify('The update couldn’t finish. Your pages are still here.');
      $('update-button').disabled = false;
    }
  });
}
