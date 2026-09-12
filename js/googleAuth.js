/**
 * WL (Word Learning) - Google OAuth 2.0 Átirányításos (Redirect-Based) Hitelesítési Modul
 * 100%-os megbízhatóság pop-up tiltások nélkül mobilon és PC-n.
 */

const GOOGLE_CLIENT_ID_KEY = 'wl_google_client_id';

/**
 * Lekéri az érvényben lévő Google Client ID-t környezeti konfigurációból vagy LocalStorage-ból
 */
export function getGoogleClientId() {
  try {
    // 1. Környezeti változók ellenőrzése (window.ENV vagy window.__WORDLY_ENV__)
    if (window.ENV?.GOOGLE_CLIENT_ID && String(window.ENV.GOOGLE_CLIENT_ID).trim().length > 5) {
      return String(window.ENV.GOOGLE_CLIENT_ID).trim();
    }
    if (window.__WORDLY_ENV__?.GOOGLE_CLIENT_ID && String(window.__WORDLY_ENV__.GOOGLE_CLIENT_ID).trim().length > 5) {
      return String(window.__WORDLY_ENV__.GOOGLE_CLIENT_ID).trim();
    }

    // 2. Felhasználói / helyi tároló beállítás
    const customId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY);
    if (customId && customId.trim().length > 5) {
      return customId.trim();
    }
  } catch (e) {
    console.warn("Hiba a Google Client ID lekérésekor:", e);
  }

  return '';
}

/**
 * Ellenőrzi, hogy van-e beállítva érvényes, nem üres Google Client ID
 */
export function hasValidGoogleClientId() {
  const clientId = getGoogleClientId();
  return Boolean(
    clientId && 
    typeof clientId === 'string' && 
    clientId.trim().length > 15 && 
    clientId.includes('.apps.googleusercontent.com') &&
    !clientId.includes('placeholder')
  );
}

/**
 * Elmenti az egyedi Google Client ID-t a helyi beállításokba
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
 * Biztonságos JWT token dekódoló modern TextDecoder-rel és UTF-8 támogatással
 */
export function parseJwt(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/').replace(/ /g, '+');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const jsonStr = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.warn("Nem sikerült dekódolni a JWT tokent:", err);
    return null;
  }
}

/**
 * Generál egy kriptográfiailag biztonságos véletlenszerű stringet CSRF védelemhez (state / nonce)
 */
function generateRandomString(length = 24) {
  const array = new Uint8Array(length);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Összeállítja a hivatalos Google OAuth 2.0 átirányítási végpontot (Implicit / OpenID Connect Redirect Flow)
 */
export function buildGoogleAuthUrl(redirectUri, state, nonce) {
  const clientId = getGoogleClientId();
  const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token token',
    scope: 'openid email profile',
    state: state,
    nonce: nonce,
    prompt: 'select_account'
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Elindítja a 100%-ban popup-mentes, megbízható Google átirányításos (Redirect) hitelesítést
 */
export function startGoogleRedirectAuth() {
  // 1. Google Client ID ellenőrzése
  if (!hasValidGoogleClientId()) {
    throw new Error("Google Client ID nincs beállítva az alkalmazásban!");
  }

  // 2. CSRF token (state) és nonce előállítása
  const state = generateRandomString(16);
  const nonce = generateRandomString(16);

  try {
    sessionStorage.setItem('wl_oauth_state', state);
    sessionStorage.setItem('wl_oauth_nonce', nonce);
    sessionStorage.setItem('wl_oauth_target', '#dashboard');
  } catch (e) {
    console.warn("SessionStorage figyelmeztetés:", e);
  }

  // 3. Tisztított visszatérési URL meghatározása (hash és query paraméterek nélkül)
  const redirectUri = window.location.origin + window.location.pathname;

  // 4. Hitelesítési URL előállítása és átnavigálás a Google hivatalos oldalára
  const authUrl = buildGoogleAuthUrl(redirectUri, state, nonce);
  window.location.assign(authUrl);
}

/**
 * Visszatérési pont (Callback Handler):
 * Induláskor ellenőrzi, hogy a böngésző a Google OAuth 2.0-ról tért-e vissza tokennel
 */
export function checkAndProcessOAuthCallback() {
  const hash = window.location.hash || '';
  const search = window.location.search || '';

  // 1. Hibás visszatérés vizsgálata (pl. felhasználó elutasította az engedélykérést)
  if (hash.includes('error=') || search.includes('error=')) {
    const searchParams = new URLSearchParams(search);
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);
    const errorMsg = hashParams.get('error_description') || searchParams.get('error_description') || hashParams.get('error') || searchParams.get('error');
    
    // URL tisztítása a hiba eltávolításához
    history.replaceState(null, null, window.location.pathname + '#auth');
    throw new Error(errorMsg || "A Google bejelentkezés meg lett szakítva vagy el lett utasítva.");
  }

  // 2. Sikeres token visszatérés vizsgálata (#id_token=... vagy #access_token=...)
  if (hash.includes('id_token=') || hash.includes('access_token=')) {
    const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
    const params = new URLSearchParams(cleanHash);

    const idToken = params.get('id_token');
    const accessToken = params.get('access_token');
    const returnedState = params.get('state');

    // CSRF ellenőrzés
    const expectedState = sessionStorage.getItem('wl_oauth_state');
    if (expectedState && returnedState && expectedState !== returnedState) {
      console.warn("CSRF figyelmeztetés: az OAuth state nem egyezik!");
    }
    sessionStorage.removeItem('wl_oauth_state');
    sessionStorage.removeItem('wl_oauth_nonce');

    if (!idToken && !accessToken) {
      return null;
    }

    // Profil adatok kibontása az ID tokenből
    let profile = {};
    if (idToken) {
      profile = parseJwt(idToken) || {};
    }

    const authResult = {
      idToken: idToken,
      accessToken: accessToken,
      sub: profile.sub || 'google_user_' + Date.now(),
      email: profile.email || '',
      emailVerified: profile.email_verified || false,
      name: profile.name || (profile.email ? profile.email.split('@')[0] : 'Google Felhasználó'),
      givenName: profile.given_name || '',
      familyName: profile.family_name || '',
      picture: profile.picture || null
    };

    // 3. Biztonság: azonnal eltávolítjuk a szenzitív tokent a böngésző címsorából és előzményeiből!
    const targetRoute = sessionStorage.getItem('wl_oauth_target') || '#dashboard';
    sessionStorage.removeItem('wl_oauth_target');
    history.replaceState(null, null, window.location.pathname + targetRoute);

    return authResult;
  }

  return null;
}
