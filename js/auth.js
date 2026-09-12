/**
 * WL (Word Learning) - Hitelesítési Réteg (Firebase Auth + Helyi / Vendég Mód)
 */

import { getSavedFirebaseConfig } from './firebaseConfig.js';
import { parseJwt } from './googleAuth.js';

let firebaseApp = null;
let firebaseAuth = null;
let firebaseFirestore = null;
let currentUser = null;
let authListeners = [];

// Helyi munkamenet kulcs
const LOCAL_SESSION_KEY = 'wl_current_session';
const LOCAL_USERS_KEY = 'wl_registered_users';

/**
 * Inicializálja a hitelesítést (Firebase ha van érvényes config, egyébként Helyi mód)
 */
export async function initAuth() {
  const config = getSavedFirebaseConfig();
  if (config && config.apiKey && config.projectId) {
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
      const { getAuth, onAuthStateChanged, getRedirectResult } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

      firebaseApp = initializeApp(config);
      firebaseAuth = getAuth(firebaseApp);
      firebaseFirestore = getFirestore(firebaseApp);

      // Firebase Redirect eredmény ellenőrzése visszatéréskor
      try {
        const redirectRes = await getRedirectResult(firebaseAuth);
        if (redirectRes && redirectRes.user) {
          currentUser = {
            uid: redirectRes.user.uid,
            email: redirectRes.user.email,
            displayName: redirectRes.user.displayName || (redirectRes.user.email ? redirectRes.user.email.split('@')[0] : 'Google Felhasználó'),
            photoURL: redirectRes.user.photoURL || null,
            isFirebase: true,
            isGuest: false,
            isGoogle: true
          };
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentUser));
        }
      } catch (redirErr) {
        console.warn("Firebase redirect hiba:", redirErr);
      }

      onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Felhasználó'),
            photoURL: user.photoURL || null,
            isFirebase: true,
            isGuest: false,
            isGoogle: Boolean(user.providerData?.some(p => p.providerId === 'google.com'))
          };
        } else {
          // Ha Firebase kijelentkezett, ellenőrizzük a helyi Google/Helyi munkamenetet
          try {
            const savedSession = localStorage.getItem(LOCAL_SESSION_KEY);
            if (savedSession) {
              currentUser = JSON.parse(savedSession);
            } else {
              currentUser = null;
            }
          } catch (e) {
            currentUser = null;
          }
        }
        notifyListeners();
      });

      console.log("Firebase Auth sikeresen inicializálva.");
      return { isFirebase: true };
    } catch (err) {
      console.warn("Hiba a Firebase inicializálásakor, helyi módra váltás:", err);
    }
  }

  // Helyi (LocalStorage) mód inicializálása
  try {
    const savedSession = localStorage.getItem(LOCAL_SESSION_KEY);
    if (savedSession) {
      currentUser = JSON.parse(savedSession);
    }
  } catch (e) {
    console.error("Hiba a helyi munkamenet visszaállításakor:", e);
    currentUser = null;
  }

  notifyListeners();
  return { isFirebase: false };
}

/**
 * Regisztráció email és jelszó párossal
 */
export async function register(email, password) {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !password) {
    throw new Error("Kérjük, adja meg az email címet és a jelszót!");
  }
  if (password.length < 6) {
    throw new Error("A jelszónak legalább 6 karakter hosszúnak kell lennie!");
  }

  if (firebaseAuth) {
    try {
      const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      currentUser = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        isFirebase: true,
        isGuest: false
      };
      notifyListeners();
      return currentUser;
    } catch (err) {
      let msg = "Sikertelen regisztráció a Firebase-en.";
      if (err.code === 'auth/email-already-in-use') msg = "Ez az email cím már használatban van!";
      if (err.code === 'auth/invalid-email') msg = "Érvénytelen email formátum!";
      if (err.code === 'auth/weak-password') msg = "A megadott jelszó túl gyenge!";
      throw new Error(msg);
    }
  }

  // Helyi mód regisztráció
  const users = getLocalUsers();
  if (users.find(u => u.email === cleanEmail)) {
    throw new Error("Ez az email cím már regisztrálva van a helyi rendszerben!");
  }

  const newUser = {
    uid: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
    email: cleanEmail,
    passwordHash: btoa(password), // egyszerű tárolás demo módhoz
    createdAt: new Date().toISOString(),
    isFirebase: false,
    isGuest: false
  };

  users.push(newUser);
  saveLocalUsers(users);

  currentUser = {
    uid: newUser.uid,
    email: newUser.email,
    isFirebase: false,
    isGuest: false
  };

  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentUser));
  notifyListeners();
  return currentUser;
}

/**
 * Bejelentkezés email és jelszó párossal
 */
export async function login(email, password) {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !password) {
    throw new Error("Kérjük, töltse ki az összes mezőt!");
  }

  if (firebaseAuth) {
    try {
      const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      currentUser = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        isFirebase: true,
        isGuest: false
      };
      notifyListeners();
      return currentUser;
    } catch (err) {
      let msg = "Hibás email cím vagy jelszó!";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = "Hibás email cím vagy jelszó!";
      } else if (err.code === 'auth/invalid-email') {
        msg = "Érvénytelen email cím formátum!";
      } else if (err.code === 'auth/too-many-requests') {
        msg = "Túl sok sikertelen kísérlet. Kérjük, próbálja meg később!";
      }
      throw new Error(msg);
    }
  }

  // Helyi mód bejelentkezés
  const users = getLocalUsers();
  const found = users.find(u => u.email === cleanEmail);
  if (!found || found.passwordHash !== btoa(password)) {
    throw new Error("Hibás email cím vagy jelszó!");
  }

  currentUser = {
    uid: found.uid,
    email: found.email,
    isFirebase: false,
    isGuest: false
  };

  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentUser));
  notifyListeners();
  return currentUser;
}

/**
 * Gyors demo / vendég belépés (nem igényel jelszót)
 */
export function loginAsGuest() {
  currentUser = {
    uid: 'guest_user',
    email: 'vendeg@wordlearning.hu',
    displayName: 'Vendég',
    photoURL: null,
    isFirebase: false,
    isGuest: true,
    isGoogle: false
  };
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentUser));
  notifyListeners();
  return currentUser;
}

/**
 * Bejelentkezés Google Hitelesítéssel (GIS Id_Token / Credential vagy profil adatok)
 */
export async function loginWithGoogleCredential(credentialToken, profilePayload = null) {
  if (!credentialToken && !profilePayload) {
    throw new Error("Nem érkezett érvényes Google token!");
  }

  // 1. Ha Firebase Auth aktív, a hivatalos Google hitelesítési providerrel lépünk be
  if (firebaseAuth && credentialToken) {
    try {
      const { GoogleAuthProvider, signInWithCredential } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      const credential = GoogleAuthProvider.credential(credentialToken);
      const userCredential = await signInWithCredential(firebaseAuth, credential);
      currentUser = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'Google Felhasználó',
        photoURL: userCredential.user.photoURL || null,
        isFirebase: true,
        isGuest: false,
        isGoogle: true
      };
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentUser));
      notifyListeners();
      return currentUser;
    } catch (err) {
      console.warn("Firebase Google Credential belépési hiba, próbálkozás közvetlen token értelmezéssel:", err);
    }
  }

  // 2. Közvetlen Google Identity Services token (JWT) értelmezés (Firebase nélkül vagy fallback)
  const payload = profilePayload || parseJwt(credentialToken);
  if (!payload || !payload.sub) {
    throw new Error("A Google profil adatok nem érvényesek!");
  }

  currentUser = {
    uid: 'google_' + payload.sub,
    googleSub: payload.sub,
    email: payload.email,
    displayName: payload.name || payload.email?.split('@')[0] || 'Google Felhasználó',
    givenName: payload.given_name || '',
    familyName: payload.family_name || '',
    photoURL: payload.picture || null,
    isFirebase: false,
    isGuest: false,
    isGoogle: true
  };

  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentUser));
  notifyListeners();
  return currentUser;
}

/**
 * Interaktív felugró ablakos Google bejelentkezés (Firebase módban)
 */
export async function loginWithGooglePopup() {
  if (firebaseAuth) {
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      const result = await signInWithPopup(firebaseAuth, provider);
      currentUser = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName || result.user.email?.split('@')[0] || 'Google Felhasználó',
        photoURL: result.user.photoURL || null,
        isFirebase: true,
        isGuest: false,
        isGoogle: true
      };
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentUser));
      notifyListeners();
      return currentUser;
    } catch (err) {
      let msg = "A Google bejelentkezés megszakadt vagy sikertelen.";
      if (err.code === 'auth/popup-closed-by-user') msg = "A bejelentkező ablak be lett zárva.";
      if (err.code === 'auth/cancelled-popup-request') msg = "A bejelentkezési kérés megszakadt.";
      if (err.code === 'auth/network-request-failed') msg = "Hálózati hiba a Google szerver elérésekor!";
      throw new Error(msg);
    }
  }

  throw new Error("A felugró ablakos Google belépéshez Firebase kapcsolat vagy Google Client ID szükséges!");
}

/**
 * Firebase Google Redirect indítása
 */
export async function startFirebaseGoogleRedirect() {
  if (firebaseAuth) {
    const { GoogleAuthProvider, signInWithRedirect } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    await signInWithRedirect(firebaseAuth, provider);
    return true;
  }
  return false;
}

/**
 * Kijelentkezés
 */
export async function logout() {
  if (firebaseAuth) {
    try {
      const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      await signOut(firebaseAuth);
    } catch (e) {
      console.warn("Hiba a Firebase kijelentkezéskor:", e);
    }
  }
  currentUser = null;
  localStorage.removeItem(LOCAL_SESSION_KEY);
  notifyListeners();
}

/**
 * Jelenlegi bejelentkezett felhasználó
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Firestore referencia elérése
 */
export function getFirestoreInstance() {
  return firebaseFirestore;
}

export function isFirebaseActive() {
  return Boolean(firebaseAuth && currentUser?.isFirebase);
}

/**
 * Eseményfigyelő feliratkozás
 */
export function onAuthStateChangedCustom(callback) {
  authListeners.push(callback);
  callback(currentUser);
  return () => {
    authListeners = authListeners.filter(cb => cb !== callback);
  };
}

function notifyListeners() {
  for (const cb of authListeners) {
    try {
      cb(currentUser);
    } catch (e) {
      console.error(e);
    }
  }
}

// Local user segédfüggvények
function getLocalUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUsers(users) {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error(e);
  }
}
