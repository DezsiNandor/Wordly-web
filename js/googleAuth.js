/**
 * WL (Word Learning) - Google Identity Services (GIS) & OAuth 2.0 Modul
 * Hivatalos Google Sign-In, One Tap és Token feldolgozás
 */

const GOOGLE_CLIENT_ID_KEY = 'wl_google_client_id';

// Alapértelmezett Wordly Google OAuth 2.0 Web Client ID
// (Egyedi Google Cloud Console azonosítóval a beállításokban vagy localStorage-ban felülírható)
const DEFAULT_CLIENT_ID = '1084268297652-wordlyweblearningdemo.apps.googleusercontent.com';

/**
 * Visszaadja az érvényben lévő Google Client ID-t
 */
export function getGoogleClientId() {
  try {
    const customId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY);
    if (customId && customId.trim().length > 5) {
      return customId.trim();
    }
  } catch (e) {
    // LocalStorage olvasási hiba fallback
  }
  return DEFAULT_CLIENT_ID;
}

/**
 * Elmenti az egyedi Google Client ID-t
 */
export function saveGoogleClientId(clientId) {
  try {
    if (clientId && clientId.trim().length > 5) {
      localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId.trim());
      return true;
    }
    localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
  } catch (e) {
    console.error("Hiba a Google Client ID mentésekor:", e);
  }
  return false;
}

/**
 * Biztonságos JWT token dekódoló (UTF-8 karakterekkel, pl. ékezetes magyar nevek támogatásával)
 */
export function parseJwt(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.warn("Nem sikerült dekódolni a Google JWT tokent:", err);
    return null;
  }
}

/**
 * Megvárja a Google Identity Services (GIS) SDK betöltődését
 */
export function waitForGoogleScript(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) {
      resolve(true);
      return;
    }

    const start = Date.now();
    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100);
  });
}

/**
 * Inicializálja a Google Identity Services (GIS) klienst, a gombot és a One Tap felugrót
 * 
 * @param {Object} config
 * @param {Function} config.onSuccess - Callback sikeres bejelentkezéskor: (authResult) => void
 * @param {Function} [config.onError] - Callback hiba esetén: (error) => void
 * @param {HTMLElement|string} [config.buttonContainer] - A hivatalos Google gomb konténere
 * @param {boolean} [config.enableOneTap=true] - Engedélyezze-e a One Tap automatikus megjelenését
 */
export async function initGoogleIdentityServices({
  onSuccess,
  onError = console.error,
  buttonContainer = null,
  enableOneTap = true
}) {
  const isLoaded = await waitForGoogleScript();
  if (!isLoaded) {
    console.warn("A Google Identity Services (accounts.google.com/gsi/client) nem érhető el vagy letiltotta egy hirdetésblokkoló.");
    return false;
  }

  const clientId = getGoogleClientId();

  try {
    // 1. Google Identity Services inicializálása
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (!response || !response.credential) {
          onError(new Error("Nem érkezett érvényes Google hitelesítési token!"));
          return;
        }

        const payload = parseJwt(response.credential);
        if (!payload) {
          onError(new Error("A Google token értelmezése sikertelen!"));
          return;
        }

        const authResult = {
          credential: response.credential,
          select_by: response.select_by,
          sub: payload.sub,
          email: payload.email,
          emailVerified: payload.email_verified,
          name: payload.name || payload.email.split('@')[0],
          givenName: payload.given_name,
          familyName: payload.family_name,
          picture: payload.picture
        };

        onSuccess(authResult);
      },
      auto_select: false, // Ne léptessen be akaratlanul, ha a felhasználó ki akarna lépni
      cancel_on_tap_outside: false
    });

    // 2. Hivatalos Google gomb renderelése, ha megadtak konténert
    let containerEl = null;
    if (typeof buttonContainer === 'string') {
      containerEl = document.getElementById(buttonContainer);
    } else if (buttonContainer instanceof HTMLElement) {
      containerEl = buttonContainer;
    }

    if (containerEl) {
      containerEl.innerHTML = '';
      window.google.accounts.id.renderButton(containerEl, {
        type: 'standard',
        theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.min(360, containerEl.offsetWidth || 340)
      });
    }

    // 3. Google One Tap felugró prompt aktiválása
    if (enableOneTap) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          const reason = notification.getNotDisplayedReason();
          console.log("Google One Tap nem jelent meg:", reason);
        } else if (notification.isSkippedMoment()) {
          const reason = notification.getSkippedReason();
          console.log("Google One Tap elutasítva/kihagyva:", reason);
        } else if (notification.isDismissedMoment()) {
          const reason = notification.getDismissedReason();
          console.log("Google One Tap bezárva:", reason);
        }
      });
    }

    return true;
  } catch (err) {
    console.error("Hiba a Google Identity Services inicializálásakor:", err);
    onError(err);
    return false;
  }
}

/**
 * Kijelentkezteti az aktív Google munkamenetet a GIS kliensből
 */
export function disableGoogleAutoSelect() {
  if (window.google?.accounts?.id) {
    try {
      window.google.accounts.id.disableAutoSelect();
    } catch (e) {
      // ignore
    }
  }
}
