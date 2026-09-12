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
 * Segédfüggvény: biztosítja, hogy a lista és minden munkalapja rendelkezzen a progresszív adatokkal
 */
export function ensureListSheets(list) {
  if (!list) return list;

  if (!list.sheets || !Array.isArray(list.sheets) || list.sheets.length === 0) {
    const listWords = list.words || [];
    list.sheets = [
      {
        id: `sheet_0_${list.id}`,
        name: '1. Munkalap',
        order: 0,
        isUnlocked: true,
        consecutivePerfectScores: 0,
        timesPracticed: 0,
        timesPassed: 0,
        totalCorrect: listWords.reduce((acc, w) => acc + (w.timesCorrect || 0), 0),
        totalIncorrect: listWords.reduce((acc, w) => acc + Math.max(0, (w.timesPracticed || 0) - (w.timesCorrect || 0)), 0),
        words: listWords
      }
    ];
  } else {
    // Minden meglévő munkalap mezőinek érvényesítése
    list.sheets.forEach((s, idx) => {
      if (!s.id) s.id = `sheet_${idx}_${Date.now()}`;
      if (!s.name) s.name = `Munkalap ${idx + 1}`;
      if (typeof s.order !== 'number') s.order = idx;
      if (typeof s.isUnlocked !== 'boolean') s.isUnlocked = (idx === 0);
      if (typeof s.consecutivePerfectScores !== 'number') s.consecutivePerfectScores = 0;
      if (typeof s.timesPracticed !== 'number') s.timesPracticed = 0;
      if (typeof s.timesPassed !== 'number') s.timesPassed = 0;
      if (typeof s.totalCorrect !== 'number') s.totalCorrect = (s.words || []).reduce((acc, w) => acc + (w.timesCorrect || 0), 0);
      if (typeof s.totalIncorrect !== 'number') s.totalIncorrect = (s.words || []).reduce((acc, w) => acc + Math.max(0, (w.timesPracticed || 0) - (w.timesCorrect || 0)), 0);
      if (!Array.isArray(s.words)) s.words = [];
    });
  }

  return list;
}

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
        const item = { id: docSnap.id, ...docSnap.data() };
        lists.push(ensureListSheets(item));
      });

      if (lists.length === 0) {
        // Inicializálunk egy minta listát 2 munkalappal a Firebase-en is
        const starter = await saveNewList("Kezdő minta szókincs (Starter)", STARTER_WORDS, [
          {
            id: 'sheet_starter_1',
            name: '1. Alapszavak (Szint 1)',
            order: 0,
            isUnlocked: true,
            consecutivePerfectScores: 0,
            timesPracticed: 0,
            timesPassed: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            words: STARTER_WORDS.slice(0, 5)
          },
          {
            id: 'sheet_starter_2',
            name: '2. Haladó szavak (Szint 2)',
            order: 1,
            isUnlocked: false,
            consecutivePerfectScores: 0,
            timesPracticed: 0,
            timesPassed: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            words: STARTER_WORDS.slice(5)
          }
        ]);
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
        words: STARTER_WORDS,
        sheets: [
          {
            id: 'sheet_starter_1',
            name: '1. Alapszavak (Szint 1)',
            order: 0,
            isUnlocked: true,
            consecutivePerfectScores: 0,
            timesPracticed: 0,
            timesPassed: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            words: STARTER_WORDS.slice(0, 5)
          },
          {
            id: 'sheet_starter_2',
            name: '2. Haladó szavak (Szint 2)',
            order: 1,
            isUnlocked: false,
            consecutivePerfectScores: 0,
            timesPracticed: 0,
            timesPassed: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            words: STARTER_WORDS.slice(5)
          }
        ]
      };
      lists = [starterList];
      localStorage.setItem(key, JSON.stringify(lists));
    } else {
      lists = lists.map(l => ensureListSheets(l));
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
  const list = lists.find(l => l.id === listId) || null;
  return list ? ensureListSheets(list) : null;
}

/**
 * Új szólista mentése munkalap támogatással
 */
export async function saveNewList(name, words, sheets = null) {
  const user = getCurrentUser();
  if (!user) throw new Error("Bejelentkezés szükséges a lista mentéséhez!");

  const cleanName = (name || "Névtelen lista").trim();
  const listId = 'list_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const formattedWords = (words || []).map((w, idx) => ({
    id: w.id || `w_${idx + 1}_${Date.now()}`,
    english: String(w.english || '').trim(),
    hungarian: String(w.hungarian || '').trim(),
    timesPracticed: w.timesPracticed || 0,
    timesCorrect: w.timesCorrect || 0
  })).filter(w => w.english.length > 0 && w.hungarian.length > 0);

  let formattedSheets;
  if (sheets && Array.isArray(sheets) && sheets.length > 0) {
    formattedSheets = sheets.map((s, idx) => ({
      id: s.id || `sheet_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: s.name || `Munkalap ${idx + 1}`,
      order: typeof s.order === 'number' ? s.order : idx,
      isUnlocked: typeof s.isUnlocked === 'boolean' ? s.isUnlocked : (idx === 0),
      consecutivePerfectScores: s.consecutivePerfectScores || 0,
      timesPracticed: s.timesPracticed || 0,
      timesPassed: s.timesPassed || 0,
      totalCorrect: s.totalCorrect || 0,
      totalIncorrect: s.totalIncorrect || 0,
      words: (s.words || []).map((w, wIdx) => ({
        id: w.id || `w_${idx}_${wIdx}_${Date.now()}`,
        english: String(w.english || '').trim(),
        hungarian: String(w.hungarian || '').trim(),
        timesPracticed: w.timesPracticed || 0,
        timesCorrect: w.timesCorrect || 0
      })).filter(w => w.english.length > 0 && w.hungarian.length > 0)
    }));
  } else {
    formattedSheets = [
      {
        id: `sheet_0_${listId}`,
        name: '1. Munkalap',
        order: 0,
        isUnlocked: true,
        consecutivePerfectScores: 0,
        timesPracticed: 0,
        timesPassed: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        words: formattedWords
      }
    ];
  }

  const listData = {
    id: listId,
    name: cleanName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    wordCount: formattedWords.length,
    words: formattedWords,
    sheets: formattedSheets
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
 * Gyakorlási eredmény rögzítése egy szónál (mind a lista szavainál, mind a munkalap szavainál)
 */
export async function recordWordPractice(listId, wordId, isCorrect, sheetId = null) {
  const user = getCurrentUser();
  if (!user) return;

  const targetList = await getListById(listId);
  if (!targetList) return;

  // Frissítés a lista fő szótömbjében
  if (targetList.words) {
    const word = targetList.words.find(w => w.id === wordId);
    if (word) {
      word.timesPracticed = (word.timesPracticed || 0) + 1;
      if (isCorrect) {
        word.timesCorrect = (word.timesCorrect || 0) + 1;
      }
    }
  }

  // Frissítés a megfelelő munkalap(ok)ban
  if (targetList.sheets && Array.isArray(targetList.sheets)) {
    targetList.sheets.forEach(sheet => {
      if (!sheetId || sheet.id === sheetId) {
        const sheetWord = (sheet.words || []).find(w => w.id === wordId);
        if (sheetWord) {
          sheetWord.timesPracticed = (sheetWord.timesPracticed || 0) + 1;
          if (isCorrect) {
            sheetWord.timesCorrect = (sheetWord.timesCorrect || 0) + 1;
          }
        }
      }
    });
  }

  targetList.updatedAt = new Date().toISOString();
  await saveExistingList(listId, targetList);
}

/**
 * Munkalap-szintű kör lezárása, haladás mentése és szintfeloldás (2 egymást követő 100% esetén)
 */
export async function updateSheetProgress(listId, sheetId, sessionStats) {
  const user = getCurrentUser();
  if (!user) return null;

  const targetList = await getListById(listId);
  if (!targetList || !targetList.sheets) return null;

  const sheetIndex = targetList.sheets.findIndex(s => s.id === sheetId);
  if (sheetIndex === -1) return null;

  const sheet = targetList.sheets[sheetIndex];
  sheet.timesPracticed = (sheet.timesPracticed || 0) + 1;
  sheet.totalCorrect = (sheet.totalCorrect || 0) + (sessionStats.correctCount || 0);
  sheet.totalIncorrect = (sheet.totalIncorrect || 0) + (sessionStats.incorrectCount || 0);

  let unlockedNextSheet = false;
  let nextSheetName = null;

  if (sessionStats.isPerfect) {
    sheet.consecutivePerfectScores = (sheet.consecutivePerfectScores || 0) + 1;
    sheet.timesPassed = (sheet.timesPassed || 0) + 1;

    // Feloldási feltétel: pontosan vagy legalább 2 egymást követő hibátlan (100%-os) kör
    if (sheet.consecutivePerfectScores >= 2) {
      const nextIndex = sheetIndex + 1;
      if (nextIndex < targetList.sheets.length) {
        if (!targetList.sheets[nextIndex].isUnlocked) {
          targetList.sheets[nextIndex].isUnlocked = true;
          unlockedNextSheet = true;
          nextSheetName = targetList.sheets[nextIndex].name;
        }
      }
    }
  } else {
    // Ha nem volt 100%, a feloldási sorozat nullázódik (szigorú 2 egymást követő feltétel)
    sheet.consecutivePerfectScores = 0;
  }

  targetList.updatedAt = new Date().toISOString();
  await saveExistingList(listId, targetList);

  return {
    sheet,
    consecutivePerfectScores: sheet.consecutivePerfectScores,
    isMastered: sheet.consecutivePerfectScores >= 2 || (sheet.timesPassed || 0) >= 2,
    unlockedNextSheet,
    nextSheetName
  };
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
