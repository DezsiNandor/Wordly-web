/**
 * WL Wordly - PWA Vezérlő Modul (Telepítés, Service Worker és Offline Érzékelés)
 */

let deferredInstallPrompt = null;

/**
 * Standalone (telepített PWA) állapot érzékelése
 */
export function isStandaloneMode() {
  const isUrlStandalone = window.location.search.includes('mode=standalone') || window.location.search.includes('pwa=1');
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = window.navigator.standalone === true;
  const isAndroidApp = document.referrer.includes('android-app://');

  return isUrlStandalone || isDisplayStandalone || isIosStandalone || isAndroidApp;
}

/**
 * PWA állapot osztályok és felület szinkronizálása
 */
export function updatePWAStandaloneUI() {
  const isStandalone = isStandaloneMode();
  if (isStandalone) {
    document.documentElement.classList.add('pwa-standalone');
    document.body.classList.add('pwa-standalone');
    
    // Telepítés gombok elrejtése ha már telepítve van
    const headerPwaBtn = document.getElementById('btn-header-pwa-install');
    if (headerPwaBtn) {
      headerPwaBtn.classList.add('hidden');
    }
  } else {
    document.documentElement.classList.remove('pwa-standalone');
    document.body.classList.remove('pwa-standalone');
  }
}

/**
 * PWA Útmutató Modális ablak megjelenítése
 */
export function showPwaGuideModal() {
  const modal = document.getElementById('modal-pwa-guide');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Platform detektálás: iOS fül vagy Android/Desktop fül kiemelése
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const tabIos = document.getElementById('pwa-tab-ios');
    const tabAndroid = document.getElementById('pwa-tab-android');
    const contentIos = document.getElementById('pwa-content-ios');
    const contentAndroid = document.getElementById('pwa-content-android');

    if (tabIos && tabAndroid && contentIos && contentAndroid) {
      if (isIos) {
        tabIos.classList.add('bg-brand-600', 'text-white');
        tabIos.classList.remove('text-slate-400');
        tabAndroid.classList.remove('bg-brand-600', 'text-white');
        tabAndroid.classList.add('text-slate-400');
        contentIos.classList.remove('hidden');
        contentAndroid.classList.add('hidden');
      } else {
        tabAndroid.classList.add('bg-brand-600', 'text-white');
        tabAndroid.classList.remove('text-slate-400');
        tabIos.classList.remove('bg-brand-600', 'text-white');
        tabIos.classList.add('text-slate-400');
        contentAndroid.classList.remove('hidden');
        contentIos.classList.add('hidden');
      }
    }
  }
}

export function closePwaGuideModal() {
  const modal = document.getElementById('modal-pwa-guide');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

export function initPWA() {
  updatePWAStandaloneUI();
  registerServiceWorker();
  setupInstallPrompt();

  // Modal bezárás gombok bekötése
  const btnClose = document.getElementById('btn-close-pwa-guide');
  if (btnClose) {
    btnClose.addEventListener('click', closePwaGuideModal);
  }

  // PWA Tab váltók
  const tabIos = document.getElementById('pwa-tab-ios');
  const tabAndroid = document.getElementById('pwa-tab-android');
  const contentIos = document.getElementById('pwa-content-ios');
  const contentAndroid = document.getElementById('pwa-content-android');

  if (tabIos && tabAndroid && contentIos && contentAndroid) {
    tabIos.addEventListener('click', () => {
      tabIos.classList.add('bg-brand-600', 'text-white');
      tabIos.classList.remove('text-slate-400');
      tabAndroid.classList.remove('bg-brand-600', 'text-white');
      tabAndroid.classList.add('text-slate-400');
      contentIos.classList.remove('hidden');
      contentAndroid.classList.add('hidden');
    });

    tabAndroid.addEventListener('click', () => {
      tabAndroid.classList.add('bg-brand-600', 'text-white');
      tabAndroid.classList.remove('text-slate-400');
      tabIos.classList.remove('bg-brand-600', 'text-white');
      tabIos.classList.add('text-slate-400');
      contentAndroid.classList.remove('hidden');
      contentIos.classList.add('hidden');
    });
  }

  // Fejléc PWA gomb eseménykezelője - Mindig megnyitja a modális útmutatót
  const headerPwaBtn = document.getElementById('btn-header-pwa-install');
  if (headerPwaBtn) {
    headerPwaBtn.addEventListener('click', () => {
      showPwaGuideModal();
    });
  }

  // Standalone váltás figyelése
  try {
    window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
      updatePWAStandaloneUI();
    });
  } catch (e) {
    console.debug('[PWA] MatchMedia listener hiba:', e);
  }
}

/**
 * Service Worker regisztráció
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        console.log('[PWA] Service Worker regisztrálva:', reg.scope);
      } catch (err) {
        console.warn('[PWA] Service Worker figyelmeztetés:', err);
      }
    });
  }
}

/**
 * Android / Chrome beforeinstallprompt esemény elkapása
 */
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] beforeinstallprompt elkapva');
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] WL Wordly sikeresen telepítve!');
    deferredInstallPrompt = null;
    updatePWAStandaloneUI();
  });
}
