/**
 * WL Wordly - PWA Vezérlő Modul (Telepítés, Service Worker és Offline Érzékelés)
 */

let deferredInstallPrompt = null;

export function initPWA() {
  registerServiceWorker();
  setupInstallPrompt();
  setupNetworkStatusListeners();
}

/**
 * Service Worker regisztrációja
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        console.log('[PWA] Service Worker sikeresen regisztrálva:', reg.scope);
      } catch (err) {
        console.warn('[PWA] Service Worker regisztrációs hiba:', err);
      }
    });
  }
}

/**
 * PWA Telepítési események (beforeinstallprompt) és gombok kezelése
 */
function setupInstallPrompt() {
  const installButtons = document.querySelectorAll('.btn-install-pwa');
  const installBanner = document.getElementById('pwa-install-banner');
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  // Ha már telepített alkalmazásként fut, rejtse el a telepítési felületeket
  if (isInStandaloneMode) {
    installButtons.forEach(btn => btn.classList.add('hidden'));
    if (installBanner) installBanner.classList.add('hidden');
    return;
  }

  // Android / Chrome / Edge / Desktop telepítési prompt elkapása
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    // Telepítés gombok megjelenítése
    installButtons.forEach(btn => {
      btn.classList.remove('hidden');
      btn.classList.add('inline-flex');
    });

    if (installBanner) {
      installBanner.classList.remove('hidden');
    }
  });

  // Gombok kattintáskezelője
  installButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log(`[PWA] Felhasználó döntése: ${outcome}`);
        deferredInstallPrompt = null;
        installButtons.forEach(b => b.classList.add('hidden'));
        if (installBanner) installBanner.classList.add('hidden');
      } else if (isIos) {
        showIosInstallModal();
      } else {
        alert("A WL Wordly telepítéséhez kattints a böngésződ címsorában lévő 'Telepítés' ikonra vagy a böngésző menü 'Alkalmazás telepítése' pontjára!");
      }
    });
  });

  // Telepítés befejeződése
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] WL Wordly sikeresen telepítve!');
    deferredInstallPrompt = null;
    installButtons.forEach(btn => btn.classList.add('hidden'));
    if (installBanner) installBanner.classList.add('hidden');
  });

  // Ha iOS eszköz és nincs még standalone módban, a gomb kattintható maradjon
  if (isIos && !isInStandaloneMode) {
    installButtons.forEach(btn => {
      btn.classList.remove('hidden');
      btn.classList.add('inline-flex');
    });
  }
}

/**
 * iOS Safari telepítési segédlet felugró ablak
 */
function showIosInstallModal() {
  const modal = document.getElementById('modal-ios-install');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } else {
    alert("Telepítés iPhone / iPad eszközön:\n1. Érintsd meg a böngésző alsó sávjában lévő Megosztás gombot (négyzetből felfelé mutató nyíl).\n2. Görgess lejjebb, és válaszd a 'Főképernyőhöz adás' lehetőséget!");
  }
}

/**
 * Hálózat állapot (Online/Offline) figyelése
 */
function setupNetworkStatusListeners() {
  const offlineBadge = document.getElementById('offline-indicator-badge');

  function updateStatus() {
    if (!navigator.onLine) {
      if (offlineBadge) offlineBadge.classList.remove('hidden');
    } else {
      if (offlineBadge) offlineBadge.classList.add('hidden');
    }
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}
