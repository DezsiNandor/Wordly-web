/**
 * WL (Word Learning) - Hitelesítési Réteg (Firebase Auth + Helyi / Vendég Mód)
 */

import { getSavedFirebaseConfig } from './firebaseConfig.js';

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
      const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

      firebaseApp = initializeApp(config);
      firebaseAuth = getAuth(firebaseApp);
      firebaseFirestore = getFirestore(firebaseApp);

      onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          currentUser = {
            uid: user.uid,
            email: user.email,
            isFirebase: true,
            isGuest: false
          };
        } else {
          currentUser = null;
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
    isFirebase: false,
    isGuest: true
  };
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentUser));
  notifyListeners();
  return currentUser;
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
