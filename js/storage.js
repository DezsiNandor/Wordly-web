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

  const key = `wl_lists_${user.uid}`;
  const initializedKey = `wl_initialized_${user.uid}`;
  const starterDeletedKey = `wl_starter_deleted_${user.uid}`;

  if (isFirebaseActive()) {
    try {
      const db = getFirestoreInstance();
      const { collection, getDocs, query, orderBy, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const listsRef = collection(db, `users/${user.uid}/wordLists`);
      const q = query(listsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const lists = [];
      snapshot.forEach(docSnap => {
        const item = { id: docSnap.id, ...docSnap.data() };
        lists.push(ensureListSheets(item));
      });

      if (lists.length === 0) {
        // Ellenőrizzük, hogy a felhasználó korábban törölte-e már a kezdő mintát vagy inicializálva van-e
        const isLocallyDeleted = localStorage.getItem(starterDeletedKey) === 'true' || localStorage.getItem(initializedKey) === 'true';
        let isCloudDeleted = false;
        try {
          const userSnap = await getDoc(doc(db, `users/${user.uid}`));
          if (userSnap.exists() && (userSnap.data()?.starterDeleted || userSnap.data()?.initialized)) {
            isCloudDeleted = true;
          }
        } catch (e) {
          // ignore
        }

        if (isLocallyDeleted || isCloudDeleted) {
          // Véglegesen törölve van, nem generáljuk újra!
          return [];
        }

        // Első belépés: inicializálunk egy minta listát 2 munkalappal a Firebase-en is
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
        localStorage.setItem(initializedKey, 'true');
        return [starter];
      }

      return lists;
    } catch (err) {
      console.warn("Hiba a Firestore szólisták lekérésekor, helyi másolat használata:", err);
    }
  }

  // Helyi LocalStorage tároló
  try {
    const rawData = localStorage.getItem(key);
    const isStarterDeleted = localStorage.getItem(starterDeletedKey) === 'true';
    const isInitialized = localStorage.getItem(initializedKey) === 'true';

    // Csak és kizárólag a legelső megnyitáskor generálunk kezdő mintát, ha még semmi sem létezik:
    if (rawData === null && !isStarterDeleted && !isInitialized) {
      const starterList = {
        id: 'starter_pack_' + Date.now(),
        name: 'Kezdő minta szókincs (Starter)',
        isStarter: true,
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
      const lists = [starterList];
      localStorage.setItem(key, JSON.stringify(lists));
      localStorage.setItem(initializedKey, 'true');
      return lists;
    }

    let lists = JSON.parse(rawData || '[]');
    if (!Array.isArray(lists)) lists = [];
    return lists.map(l => ensureListSheets(l));
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
 * Lista és minden hozzá tartozó statisztika végleges, visszafordíthatatlan törlése
 */
export async function deleteList(listId) {
  const user = getCurrentUser();
  if (!user) return false;

  // 1. Megjelöljük a kezdő feladat törlését és a fiók inicializáltságát, hogy a minta soha ne generálódjon újra
  localStorage.setItem(`wl_starter_deleted_${user.uid}`, 'true');
  localStorage.setItem(`wl_initialized_${user.uid}`, 'true');

  // 2. Felhő tároló (Firebase Firestore) törlés
  if (isFirebaseActive()) {
    try {
      const db = getFirestoreInstance();
      const { doc, deleteDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const docRef = doc(db, `users/${user.uid}/wordLists`, listId);
      await deleteDoc(docRef);

      const userMetaRef = doc(db, `users/${user.uid}`);
      await setDoc(userMetaRef, { starterDeleted: true, initialized: true }, { merge: true });
    } catch (err) {
      console.warn("Hiba a lista törlésekor Firestore-ban:", err);
    }
  }

  // 3. Helyi perzisztens tároló (LocalStorage) törlés és szinkronizálás
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
        // Állapotváltás: ha a felhasználó egy új szót legalább egyszer helyesen megválaszol,
        // lekerül róla az isNew jelölés
        if (word.isNew) {
          word.isNew = false;
        }
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
            if (sheetWord.isNew) {
              sheetWord.isNew = false;
            }
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


// Segédfüggvény a teljes lista felülírására
export async function saveExistingList(listId, listData) {
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

/**
 * Meglévő szólista intelligens összefésülése új Excel adatokkal (pl. OneDrive szinkronizáció esetén):
 * 1. Kulcsképzés: sheetName + "_" + foreignWord
 * 2. Meglévő tanulási statisztikák (timesPracticed, timesCorrect, feloldott szintek, streak) megőrzése
 * 3. Újonnan érkező szavak detektálása: isNew: true, addedAt: ISO dátum
 * 4. Új munkalapok hozzáadása, meglévő munkalapok sorrendjének és státuszának megtartása
 */
export async function mergeListWithNewExcelData(existingList, parsedData, syncMeta = {}) {
  if (!existingList || !parsedData) return null;

  ensureListSheets(existingList);

  // 1. Meglévő szavak indexelése egyedi kulcs alapján
  // kulcs: (sheetName).toLowerCase().trim() + "_" + (foreignWord).toLowerCase().trim()
  const existingWordsMap = new Map();
  const existingSheetsMap = new Map();

  (existingList.sheets || []).forEach(s => {
    const sNameKey = (s.name || '').toLowerCase().trim();
    existingSheetsMap.set(sNameKey, s);
    (s.words || []).forEach(w => {
      const wKey = sNameKey + '_' + (w.english || '').toLowerCase().trim();
      existingWordsMap.set(wKey, w);
    });
  });

  // Ha voltak olyan szavak a listában, amelyek nem voltak munkalapban
  (existingList.words || []).forEach(w => {
    const wKey = '_' + (w.english || '').toLowerCase().trim();
    if (!existingWordsMap.has(wKey)) {
      existingWordsMap.set(wKey, w);
    }
  });

  let newWordsCount = 0;
  let updatedWordsCount = 0;
  const mergedSheets = [];
  const mergedAllWords = [];

  const nowIso = new Date().toISOString();

  // 2. Új Excel munkalapjainak és szavainak bejárása
  (parsedData.sheets || []).forEach((parsedSheet, sIdx) => {
    const sNameKey = (parsedSheet.name || '').toLowerCase().trim();
    const existingSheet = existingSheetsMap.get(sNameKey);

    const mergedSheetWords = [];

    (parsedSheet.words || []).forEach((pw, wIdx) => {
      const wKey = sNameKey + '_' + (pw.english || '').toLowerCase().trim();
      const existingWord = existingWordsMap.get(wKey) || existingWordsMap.get('_' + (pw.english || '').toLowerCase().trim());

      if (existingWord) {
        // Már létező szó: megőrizzük a tanulási statisztikákat
        const isHungarianChanged = existingWord.hungarian !== pw.hungarian;
        if (isHungarianChanged) updatedWordsCount++;

        const mergedWord = {
          ...existingWord,
          english: pw.english,
          hungarian: pw.hungarian, // frissítjük ha az Excelben módosult
          timesPracticed: existingWord.timesPracticed || 0,
          timesCorrect: existingWord.timesCorrect || 0,
          isNew: existingWord.isNew === true, // megmarad ha még nem tanulta meg
          addedAt: existingWord.addedAt || existingList.createdAt || nowIso
        };
        mergedSheetWords.push(mergedWord);
        mergedAllWords.push(mergedWord);
      } else {
        // Új szó detektálva!
        newWordsCount++;
        const newWord = {
          id: pw.id || `w_sync_${sIdx}_${wIdx}_${Date.now()}_${newWordsCount}`,
          english: pw.english,
          hungarian: pw.hungarian,
          timesPracticed: 0,
          timesCorrect: 0,
          isNew: true, // Kiemelt gyakorlási prioritás
          addedAt: nowIso
        };
        mergedSheetWords.push(newWord);
        mergedAllWords.push(newWord);
      }
    });

    if (existingSheet) {
      // Meglévő munkalap: megőrizzük a haladást és a feloldási állapotot
      mergedSheets.push({
        ...existingSheet,
        name: parsedSheet.name,
        order: sIdx,
        words: mergedSheetWords
      });
    } else {
      // Teljesen új munkalap érkezett
      mergedSheets.push({
        id: parsedSheet.id || `sheet_${sIdx}_${Date.now()}`,
        name: parsedSheet.name || `Munkalap ${sIdx + 1}`,
        order: sIdx,
        isUnlocked: sIdx === 0,
        consecutivePerfectScores: 0,
        timesPracticed: 0,
        timesPassed: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        words: mergedSheetWords
      });
    }
  });

  // 3. Lista tulajdonságok és szinkronizációs metaadatok frissítése
  existingList.words = mergedAllWords;
  existingList.sheets = mergedSheets;
  existingList.wordCount = mergedAllWords.length;
  existingList.updatedAt = nowIso;
  existingList.lastSyncAt = nowIso;

  if (syncMeta.oneDriveUrl) existingList.oneDriveUrl = syncMeta.oneDriveUrl;
  if (syncMeta.eTag) existingList.oneDriveETag = syncMeta.eTag;
  if (syncMeta.lastModified) existingList.oneDriveLastModified = syncMeta.lastModified;

  // 4. Perzisztens mentés
  await saveExistingList(existingList.id, existingList);

  return {
    updatedList: existingList,
    newWordsCount,
    updatedWordsCount,
    totalWords: mergedAllWords.length,
    sheetsCount: mergedSheets.length,
    syncedAt: nowIso
  };
}
