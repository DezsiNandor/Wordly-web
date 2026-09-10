/**
 * WL (Word Learning) - Adattárolási és Szinkronizációs Réteg
 * Támogatja a Firebase Cloud Firestore-t és a Helyi LocalStorage-t
 */

import { getCurrentUser, getFirestoreInstance, isFirebaseActive } from './auth.js';

const STARTER_WORDS = [
  { id: 'w_1', english: 'achievement', hungarian: 'teljesítmény, eredmény', timesPracticed: 0, timesCorrect: 0 },
  { id: 'w_2', english: 'opportunity', hungarian: 'lehetőség', timesPracticed: 0, timesCorrect: 0 },
  { id: 'w_3', english: 'development', hungarian: 'fejlesztés, fejlődés', timesPracticed: 0, timesCorrect: 0 },
  { id: 'w_4', english: 'challenge', hungarian: 'kihívás', timesPracticed: 0, timesCorrect: 0 },
  { id: 'w_5', english: 'environment', hungarian: 'környezet', timesPracticed: 0, timesCorrect: 0 },
  { id: 'w_6', english: 'experience', hungarian: 'tapasztalat, élmény', timesPracticed: 0, timesCorrect: 0 },
  { id: 'w_7', english: 'knowledge', hungarian: 'tudás, ismeret', timesPracticed: 0, timesCorrect: 0 },
  { id: 'w_8', english: 'successful', hungarian: 'sikeres', timesPracticed: 0, timesCorrect: 0 },
  { id: 'w_9', english: 'improve', hungarian: 'fejleszt, javít', timesPracticed: 0, timesCorrect: 0 },
  { id: 'w_10', english: 'solution', hungarian: 'megoldás', timesPracticed: 0, timesCorrect: 0 }
];

/**
 * Lekéri a bejelentkezett felhasználó összes szólistáját
 */
export async function getUserLists() {
  const user = getCurrentUser();
  if (!user) return [];

  if (isFirebaseActive()) {
    try {
      const db = getFirestoreInstance();
      const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const listsRef = collection(db, `users/${user.uid}/wordLists`);
      const q = query(listsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const lists = [];
      snapshot.forEach(docSnap => {
        lists.push({ id: docSnap.id, ...docSnap.data() });
      });

      if (lists.length === 0) {
        // Inicializálunk egy minta listát a Firebase-en is
        const starter = await saveNewList("Kezdő minta szókincs (Starter)", STARTER_WORDS);
        return [starter];
      }

      return lists;
    } catch (err) {
      console.warn("Hiba a Firestore szólisták lekérésekor, helyi másolat használata:", err);
    }
  }

  // Helyi LocalStorage tároló
  const key = `wl_lists_${user.uid}`;
  try {
    let lists = JSON.parse(localStorage.getItem(key) || '[]');
    if (!lists || lists.length === 0) {
      const starterList = {
        id: 'starter_pack_' + Date.now(),
        name: 'Kezdő minta szókincs (Starter)',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        wordCount: STARTER_WORDS.length,
        words: STARTER_WORDS
      };
      lists = [starterList];
      localStorage.setItem(key, JSON.stringify(lists));
    }
    return lists;
  } catch (e) {
    console.error("Hiba a helyi listák betöltésekor:", e);
    return [];
  }
}

/**
 * Lekér egy konkrét listát az ID alapján
 */
export async function getListById(listId) {
  const lists = await getUserLists();
  return lists.find(l => l.id === listId) || null;
}

/**
 * Új szólista mentése
 */
export async function saveNewList(name, words) {
  const user = getCurrentUser();
  if (!user) throw new Error("Bejelentkezés szükséges a lista mentéséhez!");

  const cleanName = (name || "Névtelen lista").trim();
  const listId = 'list_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const formattedWords = words.map((w, idx) => ({
    id: w.id || `w_${idx + 1}_${Date.now()}`,
    english: String(w.english || '').trim(),
    hungarian: String(w.hungarian || '').trim(),
    timesPracticed: w.timesPracticed || 0,
    timesCorrect: w.timesCorrect || 0
  })).filter(w => w.english.length > 0 && w.hungarian.length > 0);

  const listData = {
    id: listId,
    name: cleanName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    wordCount: formattedWords.length,
    words: formattedWords
  };

  if (isFirebaseActive()) {
    try {
      const db = getFirestoreInstance();
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const docRef = doc(db, `users/${user.uid}/wordLists`, listId);
      await setDoc(docRef, listData);
      return listData;
    } catch (err) {
      console.warn("Nem sikerült elmenteni a Firestore-ba, mentés helyi tárolóba:", err);
    }
  }

  // Helyi mentés
  const key = `wl_lists_${user.uid}`;
  const lists = JSON.parse(localStorage.getItem(key) || '[]');
  lists.unshift(listData);
  localStorage.setItem(key, JSON.stringify(lists));
  return listData;
}

/**
 * Lista nevének módosítása (átnevezés)
 */
export async function updateListName(listId, newName) {
  const user = getCurrentUser();
  if (!user) return false;
  const cleanName = newName.trim();
  if (!cleanName) return false;

  if (isFirebaseActive()) {
    try {
      const db = getFirestoreInstance();
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const docRef = doc(db, `users/${user.uid}/wordLists`, listId);
      await updateDoc(docRef, {
        name: cleanName,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.warn("Hiba a név frissítésekor Firestore-ban:", err);
    }
  }

  const key = `wl_lists_${user.uid}`;
  const lists = JSON.parse(localStorage.getItem(key) || '[]');
  const index = lists.findIndex(l => l.id === listId);
  if (index !== -1) {
    lists[index].name = cleanName;
    lists[index].updatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(lists));
    return true;
  }
  return false;
}

/**
 * Lista törlése
 */
export async function deleteList(listId) {
  const user = getCurrentUser();
  if (!user) return false;

  if (isFirebaseActive()) {
    try {
      const db = getFirestoreInstance();
      const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const docRef = doc(db, `users/${user.uid}/wordLists`, listId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn("Hiba a lista törlésekor Firestore-ban:", err);
    }
  }

  const key = `wl_lists_${user.uid}`;
  let lists = JSON.parse(localStorage.getItem(key) || '[]');
  lists = lists.filter(l => l.id !== listId);
  localStorage.setItem(key, JSON.stringify(lists));
  return true;
}

/**
 * Szó hozzáadása egy meglévő listához
 */
export async function addWordToList(listId, english, hungarian) {
  const user = getCurrentUser();
  if (!user) return false;

  const targetList = await getListById(listId);
  if (!targetList) return false;

  const newWord = {
    id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    english: english.trim(),
    hungarian: hungarian.trim(),
    timesPracticed: 0,
    timesCorrect: 0
  };

  targetList.words.push(newWord);
  targetList.wordCount = targetList.words.length;
  targetList.updatedAt = new Date().toISOString();

  return await saveExistingList(listId, targetList);
}

/**
 * Szó törlése listából
 */
export async function deleteWordFromList(listId, wordId) {
  const user = getCurrentUser();
  if (!user) return false;

  const targetList = await getListById(listId);
  if (!targetList) return false;

  targetList.words = targetList.words.filter(w => w.id !== wordId);
  targetList.wordCount = targetList.words.length;
  targetList.updatedAt = new Date().toISOString();

  return await saveExistingList(listId, targetList);
}

/**
 * Szó módosítása listában
 */
export async function updateWordInList(listId, wordId, english, hungarian) {
  const user = getCurrentUser();
  if (!user) return false;

  const targetList = await getListById(listId);
  if (!targetList) return false;

  const word = targetList.words.find(w => w.id === wordId);
  if (!word) return false;

  word.english = english.trim();
  word.hungarian = hungarian.trim();
  targetList.updatedAt = new Date().toISOString();

  return await saveExistingList(listId, targetList);
}

/**
 * Gyakorlási eredmény rögzítése egy szónál
 */
export async function recordWordPractice(listId, wordId, isCorrect) {
  const user = getCurrentUser();
  if (!user) return;

  const targetList = await getListById(listId);
  if (!targetList) return;

  const word = targetList.words.find(w => w.id === wordId);
  if (!word) return;

  word.timesPracticed = (word.timesPracticed || 0) + 1;
  if (isCorrect) {
    word.timesCorrect = (word.timesCorrect || 0) + 1;
  }
  targetList.updatedAt = new Date().toISOString();

  await saveExistingList(listId, targetList);
}

// Belső segédfüggvény a teljes lista felülírására
async function saveExistingList(listId, listData) {
  const user = getCurrentUser();
  if (!user) return false;

  if (isFirebaseActive()) {
    try {
      const db = getFirestoreInstance();
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const docRef = doc(db, `users/${user.uid}/wordLists`, listId);
      await setDoc(docRef, listData);
      return true;
    } catch (e) {
      console.warn("Hiba a lista frissítésekor:", e);
    }
  }

  const key = `wl_lists_${user.uid}`;
  const lists = JSON.parse(localStorage.getItem(key) || '[]');
  const index = lists.findIndex(l => l.id === listId);
  if (index !== -1) {
    lists[index] = listData;
    localStorage.setItem(key, JSON.stringify(lists));
    return true;
  }
  return false;
}
