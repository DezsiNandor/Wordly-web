/**
 * WL (Word Learning) - Központi Többeszközös Felhőszinkronizációs Modul
 * Támogatja a Firebase Cloud Firestore és Supabase backendet.
 * Automatikus felhőbeli adatletöltés belépéskor, azonnali felhőmentés haladáskor,
 * és valós idejű szinkronizáció PC és Mobil között.
 */

import { getFirestoreInstance, isFirebaseActive } from './auth.js';
import { getSavedFirebaseConfig } from './firebaseConfig.js';

/**
 * Ellenőrzi, hogy van-e aktív felhő backend kapcsolat
 */
export function hasActiveCloudBackend() {
  if (isFirebaseActive()) return true;
  const cfg = getSavedFirebaseConfig();
  if (cfg && cfg.apiKey && cfg.projectId) return true;
  return false;
}

/**
 * Lekéri a felhasználó összes adatát a központi felhőből (Pull)
 */
export async function pullUserCloudData(user) {
  if (!user || !user.uid) return [];

  if (isFirebaseActive()) {
    try {
      const db = getFirestoreInstance();
      const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const listsRef = collection(db, `users/${user.uid}/wordLists`);
      const q = query(listsRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);

      const cloudLists = [];
      snapshot.forEach(docSnap => {
        cloudLists.push({ id: docSnap.id, ...docSnap.data() });
      });
      return cloudLists;
    } catch (err) {
      console.warn("Hiba a felhőbeli adatok letöltésekor:", err);
      // Próbálkozás query rendezés nélkül, ha nincs kompozit index
      try {
        const db = getFirestoreInstance();
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const listsRef = collection(db, `users/${user.uid}/wordLists`);
        const snapshot = await getDocs(listsRef);
        const cloudLists = [];
        snapshot.forEach(docSnap => {
          cloudLists.push({ id: docSnap.id, ...docSnap.data() });
        });
        return cloudLists;
      } catch (innerErr) {
        console.warn("Hiba a felhőbeli adatok lekérésekor (fallback):", innerErr);
      }
    }
  }

  return [];
}

/**
 * Egy lista és annak munkalapjai / statisztikái azonnali mentése a felhőbe (Push)
 */
export async function pushListToCloud(user, listData) {
  if (!user || !user.uid || !listData || !listData.id) return false;

  if (isFirebaseActive()) {
    try {
      const db = getFirestoreInstance();
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const docRef = doc(db, `users/${user.uid}/wordLists`, listData.id);
      
      const cleanData = {
        ...listData,
        updatedAt: listData.updatedAt || new Date().toISOString()
      };

      await setDoc(docRef, cleanData, { merge: true });

      // Felhasználói metaadatok frissítése a felhőben
      try {
        const userRef = doc(db, `users/${user.uid}`);
        await setDoc(userRef, {
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || null,
          lastActive: new Date().toISOString(),
          lastSync: new Date().toISOString()
        }, { merge: true });
      } catch (metaErr) {
        // csendes figyelmeztetés
      }

      return true;
    } catch (err) {
      console.warn("Nem sikerült elmenteni a felhőbe:", err);
    }
  }

  return false;
}

/**
 * Egy lista végleges törlése a felhőből
 */
export async function deleteListFromCloud(user, listId) {
  if (!user || !user.uid || !listId) return false;

  if (isFirebaseActive()) {
    try {
      const db = getFirestoreInstance();
      const { doc, deleteDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const docRef = doc(db, `users/${user.uid}/wordLists`, listId);
      await deleteDoc(docRef);

      // Metaadat jelzés a törlésről
      const userRef = doc(db, `users/${user.uid}`);
      await setDoc(userRef, {
        lastSync: new Date().toISOString()
      }, { merge: true });

      return true;
    } catch (err) {
      console.warn("Hiba a felhőbeli törléskor:", err);
    }
  }

  return false;
}

/**
 * Valós idejű felhőfigyelő (Realtime Listener) - PC és Mobil közötti azonnali szinkronizációhoz
 */
export function setupRealtimeCloudListener(user, onRemoteChange) {
  if (!user || !user.uid || !isFirebaseActive()) {
    return () => {};
  }

  let unsubscribe = () => {};

  (async () => {
    try {
      const db = getFirestoreInstance();
      const { collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const listsRef = collection(db, `users/${user.uid}/wordLists`);

      unsubscribe = onSnapshot(listsRef, (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) {
          // Saját helyi írás, ezt nem kell visszahurkolni
          return;
        }

        const cloudLists = [];
        snapshot.forEach(docSnap => {
          cloudLists.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (typeof onRemoteChange === 'function') {
          onRemoteChange(cloudLists);
        }
      }, (error) => {
        console.warn("Valós idejű felhő figyelési hiba:", error);
      });
    } catch (err) {
      console.warn("Nem sikerült elindítani a valós idejű figyelőt:", err);
    }
  })();

  return () => {
    try {
      unsubscribe();
    } catch (e) {
      // ignore
    }
  };
}

/**
 * Kétirányú összefésülés a felhő és a helyi tároló között (Monotonic Conflict-Free Merge)
 */
export function mergeCloudAndLocalLists(cloudLists = [], localLists = []) {
  const mergedMap = new Map();
  let hasChangesToUpload = false;
  let hasChangesToDownload = false;

  const nowIso = new Date().toISOString();

  // 1. Felhőbeli listák feltérképezése
  cloudLists.forEach(cList => {
    if (cList && cList.id) {
      mergedMap.set(cList.id, { ...cList, _source: 'cloud' });
    }
  });

  // 2. Helyi listák összefésülése a felhőbeliekkel
  localLists.forEach(lList => {
    if (!lList || !lList.id) return;

    if (!mergedMap.has(lList.id)) {
      // Csak helyben létező lista -> fel kell tölteni a felhőbe
      mergedMap.set(lList.id, { ...lList, _source: 'local' });
      hasChangesToUpload = true;
    } else {
      // Mindkét helyen létezik: intelligens összefésülés mezőnként
      const cList = mergedMap.get(lList.id);
      const cloudUpdated = new Date(cList.updatedAt || cList.createdAt || 0).getTime();
      const localUpdated = new Date(lList.updatedAt || lList.createdAt || 0).getTime();

      // Szavak összefésülése
      const wordMap = new Map();
      (cList.words || []).forEach(w => {
        if (w && w.english) wordMap.set((w.english).toLowerCase().trim(), { ...w });
      });

      (lList.words || []).forEach(w => {
        if (!w || !w.english) return;
        const key = (w.english).toLowerCase().trim();
        if (!wordMap.has(key)) {
          wordMap.set(key, { ...w });
          hasChangesToUpload = true;
        } else {
          const existing = wordMap.get(key);
          const maxPracticed = Math.max(existing.timesPracticed || 0, w.timesPracticed || 0);
          const maxCorrect = Math.max(existing.timesCorrect || 0, w.timesCorrect || 0);
          const isStillNew = (existing.isNew === true) && (w.isNew === true);

          if (maxPracticed !== existing.timesPracticed || maxCorrect !== existing.timesCorrect) {
            hasChangesToUpload = true;
            hasChangesToDownload = true;
          }

          wordMap.set(key, {
            ...existing,
            hungarian: localUpdated >= cloudUpdated ? (w.hungarian || existing.hungarian) : (existing.hungarian || w.hungarian),
            timesPracticed: maxPracticed,
            timesCorrect: maxCorrect,
            isNew: isStillNew,
            addedAt: existing.addedAt || w.addedAt || nowIso
          });
        }
      });

      const mergedWords = Array.from(wordMap.values());

      // Munkalapok összefésülése
      const sheetMap = new Map();
      (cList.sheets || []).forEach(s => {
        if (s) sheetMap.set(s.id || s.order, { ...s });
      });

      (lList.sheets || []).forEach(s => {
        if (!s) return;
        const sKey = s.id || s.order;
        if (!sheetMap.has(sKey)) {
          sheetMap.set(sKey, { ...s });
          hasChangesToUpload = true;
        } else {
          const cSheet = sheetMap.get(sKey);
          const isUnlocked = Boolean(cSheet.isUnlocked || s.isUnlocked);
          const maxPerfect = Math.max(cSheet.consecutivePerfectScores || 0, s.consecutivePerfectScores || 0);
          const maxPracticed = Math.max(cSheet.timesPracticed || 0, s.timesPracticed || 0);
          const maxPassed = Math.max(cSheet.timesPassed || 0, s.timesPassed || 0);
          const maxCorrect = Math.max(cSheet.totalCorrect || 0, s.totalCorrect || 0);
          const maxIncorrect = Math.max(cSheet.totalIncorrect || 0, s.totalIncorrect || 0);

          if (isUnlocked !== cSheet.isUnlocked || maxPracticed !== cSheet.timesPracticed || maxPassed !== cSheet.timesPassed) {
            hasChangesToUpload = true;
            hasChangesToDownload = true;
          }

          sheetMap.set(sKey, {
            ...cSheet,
            name: localUpdated >= cloudUpdated ? (s.name || cSheet.name) : (cSheet.name || s.name),
            isUnlocked,
            consecutivePerfectScores: maxPerfect,
            timesPracticed: maxPracticed,
            timesPassed: maxPassed,
            totalCorrect: maxCorrect,
            totalIncorrect: maxIncorrect,
            words: s.words && s.words.length > 0 ? s.words : cSheet.words
          });
        }
      });

      const mergedSheets = Array.from(sheetMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));

      const mergedList = {
        ...cList,
        name: localUpdated >= cloudUpdated ? (lList.name || cList.name) : (cList.name || lList.name),
        wordCount: mergedWords.length,
        words: mergedWords,
        sheets: mergedSheets,
        updatedAt: new Date(Math.max(cloudUpdated, localUpdated, Date.now())).toISOString()
      };

      mergedMap.set(lList.id, mergedList);
    }
  });

  const mergedLists = Array.from(mergedMap.values()).map(l => {
    const clean = { ...l };
    delete clean._source;
    return clean;
  });

  return {
    mergedLists,
    hasChangesToUpload,
    hasChangesToDownload: hasChangesToDownload || (cloudLists.length !== localLists.length)
  };
}

/**
 * Teljes többeszközös szinkronizáció lefolytatása (Pull -> Merge -> Push)
 */
export async function syncMultiDeviceCloud(user) {
  if (!user || !user.uid) return [];
  const key = `wl_lists_${user.uid}`;
  const rawLocal = localStorage.getItem(key);
  let localLists = [];
  try {
    localLists = JSON.parse(rawLocal || '[]');
  } catch (e) {
    localLists = [];
  }

  const cloudLists = await pullUserCloudData(user);
  if (!cloudLists || (cloudLists.length === 0 && !hasActiveCloudBackend())) {
    return localLists;
  }

  // Kétirányú összefésülés
  const { mergedLists, hasChangesToUpload } = mergeCloudAndLocalLists(cloudLists, localLists);

  // Mentés a helyi gyorsítótárba
  localStorage.setItem(key, JSON.stringify(mergedLists));

  // Frissítések azonnali feltöltése a felhőbe
  if (hasChangesToUpload || (cloudLists.length === 0 && mergedLists.length > 0)) {
    for (const list of mergedLists) {
      await pushListToCloud(user, list);
    }
  }

  return mergedLists;
}
