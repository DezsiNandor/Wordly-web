/**
 * WL (Word Learning) - Firebase Konfiguráció és Inicializálás
 */

// Alapértelmezett beállítások vagy a felhasználó által a felületen mentett kulcsok
const STORAGE_KEY = 'wl_firebase_config';

// Alapértelmezett minta / placeholder konfiguráció
export const defaultFirebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

/**
 * Betölti a mentett Firebase konfigurációt a környezeti változókból vagy a LocalStorage-ból
 */
export function getSavedFirebaseConfig() {
  try {
    // 1. Környezeti változók ellenőrzése (window.ENV vagy window.__WORDLY_ENV__)
    if (window.ENV?.FIREBASE_CONFIG && typeof window.ENV.FIREBASE_CONFIG === 'object' && window.ENV.FIREBASE_CONFIG.apiKey) {
      return window.ENV.FIREBASE_CONFIG;
    }
    if (window.__WORDLY_ENV__?.FIREBASE_CONFIG && typeof window.__WORDLY_ENV__.FIREBASE_CONFIG === 'object' && window.__WORDLY_ENV__.FIREBASE_CONFIG.apiKey) {
      return window.__WORDLY_ENV__.FIREBASE_CONFIG;
    }

    // 2. Alapértelmezett konfiguráció, ha a defaultFirebaseConfig rendelkezik érvényes kulcsokkal
    if (defaultFirebaseConfig && defaultFirebaseConfig.apiKey && defaultFirebaseConfig.projectId) {
      return defaultFirebaseConfig;
    }

    // 3. Felhasználó által mentett konfiguráció LocalStorage-ban
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Nem sikerült betölteni a mentett Firebase konfigurációt:", e);
  }
  return null;
}

/**
 * Elmenti az új Firebase konfigurációt
 */
export function saveFirebaseConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error("Hiba a Firebase konfiguráció mentésekor:", e);
    return false;
  }
}

/**
 * Törli a Firebase konfigurációt (visszaállítás helyi módra)
 */
export function clearFirebaseConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Hiba a konfiguráció törlésekor:", e);
  }
}
