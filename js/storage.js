/**
 * WL Wordly - Helyi Adattárolási és Haladási Réteg (Local-First Storage)
 * 100% Bejelentkezésmentes, tartós helyi tárolás (LocalStorage)
 * 20 szavas automatikus Chunking (Egységek) és 2x 100% feloldási mechanika
 */

const STORAGE_KEY = 'wl_vocab_packages';
const MIX_STATS_KEY = 'wl_mix_stats';
const CHUNK_SIZE = 20;

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
 * Szavak automatikus felosztása legfeljebb 20 szavas egységekre (Chunking)
 */
export function chunkWordsIntoUnits(words, baseName = 'Egység') {
  if (!Array.isArray(words) || words.length === 0) {
    return [{
      id: `unit_${Date.now()}_0`,
      name: `${baseName} 1`,
      order: 0,
      isUnlocked: true,
      consecutivePerfectScores: 0,
      timesPracticed: 0,
      timesPassed: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      words: []
    }];
  }

  const units = [];
  const total = words.length;

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunkWords = words.slice(i, i + CHUNK_SIZE);
    const unitIndex = Math.floor(i / CHUNK_SIZE);
    const rangeText = total > CHUNK_SIZE ? ` (${i + 1}-${Math.min(i + CHUNK_SIZE, total)}. szó)` : '';

    units.push({
      id: `unit_${unitIndex}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${baseName} ${unitIndex + 1}${rangeText}`,
      order: unitIndex,
      isUnlocked: unitIndex === 0, // Első blokk alapértelmezetten nyitva
      consecutivePerfectScores: 0,
      timesPracticed: 0,
      timesPassed: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      words: chunkWords
    });
  }

  return units;
}

/**
 * Biztosítja, hogy a lista egységei érvényesek és max 20 szavasak legyenek
 */
export function ensureListSheets(list) {
  if (!list) return list;

  // Ha nincsenek munkalapok/egységek, a teljes szólistát 20 szavas blokkokra vágjuk
  if (!list.sheets || !Array.isArray(list.sheets) || list.sheets.length === 0) {
    list.sheets = chunkWordsIntoUnits(list.words || [], list.name || 'Egység');
    return list;
  }

  // Ha a létező egységek valamelyike meghaladja a 20 szót, újrafelosztjuk őket
  const verifiedSheets = [];
  let currentOrder = 0;

  list.sheets.forEach((sheet, sIdx) => {
    const words = sheet.words || [];
    if (words.length <= CHUNK_SIZE) {
      // Normál méretű egység
      verifiedSheets.push({
        id: sheet.id || `unit_${sIdx}_${Date.now()}`,
        name: sheet.name || `Egység ${sIdx + 1}`,
        order: currentOrder++,
        isUnlocked: typeof sheet.isUnlocked === 'boolean' ? sheet.isUnlocked : (sIdx === 0),
        consecutivePerfectScores: sheet.consecutivePerfectScores || 0,
        timesPracticed: sheet.timesPracticed || 0,
        timesPassed: sheet.timesPassed || 0,
        totalCorrect: sheet.totalCorrect || words.reduce((acc, w) => acc + (w.timesCorrect || 0), 0),
        totalIncorrect: sheet.totalIncorrect || words.reduce((acc, w) => acc + Math.max(0, (w.timesPracticed || 0) - (w.timesCorrect || 0)), 0),
        words: words
      });
    } else {
      // Túlméretezett munkalap felosztása 20 szavas al-egységekre
      const subUnits = chunkWordsIntoUnits(words, sheet.name || `Egység ${sIdx + 1}`);
      subUnits.forEach((sub, subIdx) => {
        sub.order = currentOrder++;
        // Ha az eredeti lap fel volt oldva, az első felosztott része is fel van oldva
        sub.isUnlocked = (subIdx === 0 && (sheet.isUnlocked || sIdx === 0));
        sub.timesPassed = (subIdx === 0 ? (sheet.timesPassed || 0) : 0);
        sub.consecutivePerfectScores = (subIdx === 0 ? (sheet.consecutivePerfectScores || 0) : 0);
        verifiedSheets.push(sub);
      });
    }
  });

  list.sheets = verifiedSheets;
  return list;
}

/**
 * Szólisták / Szócsomagok betöltése a LocalStorage-ból
 */
export async function getUserLists() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    
    // Visszafelé kompatibilitás korábbi mentésekkel
    if (!raw) {
      raw = localStorage.getItem('wl_lists_local');
    }
    if (!raw) {
      // Esetleges korábbi bejelentkezett kulcsok átmentése
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('wl_lists_')) {
          raw = localStorage.getItem(k);
          if (raw) break;
        }
      }
    }

    if (!raw) {
      // Első indítás: Kezdő minta betöltése
      const starterList = {
        id: 'starter_pack_' + Date.now(),
        name: 'Kezdő minta szókincs (WL Starter)',
        isStarter: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        wordCount: STARTER_WORDS.length,
        words: STARTER_WORDS,
        sheets: [
          {
            id: 'unit_starter_1',
            name: '1. Alapszavak (1-10. szó)',
            order: 0,
            isUnlocked: true,
            consecutivePerfectScores: 0,
            timesPracticed: 0,
            timesPassed: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            words: STARTER_WORDS
          }
        ]
      };
      const initialLists = [starterList];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialLists));
      return initialLists;
    }

    let parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) parsed = [];
    return parsed.map(l => ensureListSheets(l));
  } catch (e) {
    console.error("Hiba a szólisták betöltésekor:", e);
    return [];
  }
}

/**
 * Egy konkrét lista lekérése ID alapján
 */
export async function getListById(listId) {
  const lists = await getUserLists();
  const list = lists.find(l => l.id === listId) || null;
  return list ? ensureListSheets(list) : null;
}

/**
 * Új szólista mentése automatikus 20 szavas egységekre bontással
 */
export async function saveNewList(name, words, sheets = null) {
  const cleanName = (name || "Új szószedet").trim();
  const listId = 'list_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const nowIso = new Date().toISOString();

  const formattedWords = (words || []).map((w, idx) => ({
    id: w.id || `w_${idx + 1}_${Date.now()}`,
    english: String(w.english || '').trim(),
    hungarian: String(w.hungarian || '').trim(),
    timesPracticed: w.timesPracticed || 0,
    timesCorrect: w.timesCorrect || 0,
    isNew: typeof w.isNew === 'boolean' ? w.isNew : false,
    addedAt: w.addedAt || nowIso
  })).filter(w => w.english.length > 0 && w.hungarian.length > 0);

  let formattedSheets = [];

  if (sheets && Array.isArray(sheets) && sheets.length > 0) {
    // Ha már előre definiált munkalapok érkeztek, mindegyiket max 20 szavas blokkokra tagoljuk
    sheets.forEach((s, sIdx) => {
      const sheetWords = (s.words || []).map((w, wIdx) => ({
        id: w.id || `w_${sIdx}_${wIdx}_${Date.now()}`,
        english: String(w.english || '').trim(),
        hungarian: String(w.hungarian || '').trim(),
        timesPracticed: w.timesPracticed || 0,
        timesCorrect: w.timesCorrect || 0,
        isNew: typeof w.isNew === 'boolean' ? w.isNew : false,
        addedAt: w.addedAt || nowIso
      })).filter(w => w.english.length > 0 && w.hungarian.length > 0);

      const chunked = chunkWordsIntoUnits(sheetWords, s.name || `Egység ${sIdx + 1}`);
      formattedSheets.push(...chunked);
    });

    // Sorrend és feloldás igazítása
    formattedSheets.forEach((s, idx) => {
      s.order = idx;
      if (idx === 0) s.isUnlocked = true;
    });
  } else {
    // Automatikus chunking a teljes szókészletre
    formattedSheets = chunkWordsIntoUnits(formattedWords, cleanName);
  }

  const listData = {
    id: listId,
    name: cleanName,
    createdAt: nowIso,
    updatedAt: nowIso,
    wordCount: formattedWords.length,
    words: formattedWords,
    sheets: formattedSheets
  };

  const lists = await getUserLists();
  lists.unshift(listData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));

  return listData;
}

/**
 * Meglévő szólista felülírása / perzisztálása
 */
export async function saveExistingList(listId, updatedData) {
  const lists = await getUserLists();
  const index = lists.findIndex(l => l.id === listId);
  if (index !== -1) {
    lists[index] = ensureListSheets({
      ...lists[index],
      ...updatedData,
      updatedAt: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    return true;
  }
  return false;
}

/**
 * Szólista átnevezése
 */
export async function updateListName(listId, newName) {
  const cleanName = (newName || '').trim();
  if (!cleanName) return false;

  const lists = await getUserLists();
  const target = lists.find(l => l.id === listId);
  if (target) {
    target.name = cleanName;
    target.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    return true;
  }
  return false;
}

/**
 * Szólista végleges törlése
 */
export async function deleteList(listId) {
  let lists = await getUserLists();
  lists = lists.filter(l => l.id !== listId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  return true;
}

/**
 * Szó hozzáadása meglévő listához
 */
export async function addWordToList(listId, english, hungarian) {
  const targetList = await getListById(listId);
  if (!targetList) return false;

  const newWord = {
    id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    english: english.trim(),
    hungarian: hungarian.trim(),
    timesPracticed: 0,
    timesCorrect: 0,
    isNew: true,
    addedAt: new Date().toISOString()
  };

  targetList.words.push(newWord);
  targetList.wordCount = targetList.words.length;
  
  // Hozzáadjuk a megfelelő 20 szavas egységhez vagy új egységet nyitunk
  if (targetList.sheets && targetList.sheets.length > 0) {
    const lastSheet = targetList.sheets[targetList.sheets.length - 1];
    if ((lastSheet.words || []).length < CHUNK_SIZE) {
      lastSheet.words.push(newWord);
    } else {
      // Új 20 szavas egység
      targetList.sheets.push({
        id: `unit_${targetList.sheets.length}_${Date.now()}`,
        name: `${targetList.name} ${targetList.sheets.length + 1}`,
        order: targetList.sheets.length,
        isUnlocked: false,
        consecutivePerfectScores: 0,
        timesPracticed: 0,
        timesPassed: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        words: [newWord]
      });
    }
  }

  return await saveExistingList(listId, targetList);
}

/**
 * Szó törlése listából
 */
export async function deleteWordFromList(listId, wordId) {
  const targetList = await getListById(listId);
  if (!targetList) return false;

  targetList.words = (targetList.words || []).filter(w => w.id !== wordId);
  targetList.wordCount = targetList.words.length;

  if (targetList.sheets) {
    targetList.sheets.forEach(s => {
      s.words = (s.words || []).filter(w => w.id !== wordId);
    });
  }

  return await saveExistingList(listId, targetList);
}

/**
 * Szó módosítása listában
 */
export async function updateWordInList(listId, wordId, english, hungarian) {
  const targetList = await getListById(listId);
  if (!targetList) return false;

  const w = (targetList.words || []).find(item => item.id === wordId);
  if (w) {
    w.english = english.trim();
    w.hungarian = hungarian.trim();
  }

  if (targetList.sheets) {
    targetList.sheets.forEach(s => {
      const sw = (s.words || []).find(item => item.id === wordId);
      if (sw) {
        sw.english = english.trim();
        sw.hungarian = hungarian.trim();
      }
    });
  }

  return await saveExistingList(listId, targetList);
}

/**
 * Gyakorlási eredmény rögzítése egy szónál
 */
export async function recordWordPractice(listId, wordId, isCorrect, sheetId = null) {
  if (!listId || !wordId) return;
  const targetList = await getListById(listId);
  if (!targetList) return;

  // Fő szólistában
  if (targetList.words) {
    const word = targetList.words.find(w => w.id === wordId);
    if (word) {
      word.timesPracticed = (word.timesPracticed || 0) + 1;
      if (isCorrect) {
        word.timesCorrect = (word.timesCorrect || 0) + 1;
        if (word.isNew) word.isNew = false;
      }
    }
  }

  // Egységben
  if (targetList.sheets) {
    targetList.sheets.forEach(sheet => {
      if (!sheetId || sheet.id === sheetId) {
        const sw = (sheet.words || []).find(w => w.id === wordId);
        if (sw) {
          sw.timesPracticed = (sw.timesPracticed || 0) + 1;
          if (isCorrect) {
            sw.timesCorrect = (sw.timesCorrect || 0) + 1;
            if (sw.isNew) sw.isNew = false;
          }
        }
      }
    });
  }

  await saveExistingList(listId, targetList);
}

/**
 * 20 szavas egység (Unit) gyakorlási körének lezárása és feloldási logika (2x 100%)
 */
export async function updateSheetProgress(listId, sheetId, sessionStats) {
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

    // Feloldási feltétel: legalább 2x hibátlan (100%-os) teljesítés
    if (sheet.consecutivePerfectScores >= 2 || sheet.timesPassed >= 2) {
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
    // Nem hibátlan kör: egymást követő tökéletes számláló nullázódik
    sheet.consecutivePerfectScores = 0;
  }

  await saveExistingList(listId, targetList);

  return {
    sheet,
    sheetIndex,
    unlockedNextSheet,
    nextSheetName,
    consecutivePerfectScores: sheet.consecutivePerfectScores,
    timesPassed: sheet.timesPassed
  };
}

/**
 * Új Excel vagy Google Sheet szavak dinamikus összefésülése a meglévő szótárral:
 * - Megőrzi a már megtanult szavak és egységek haladását
 * - Csak az újonnan bekerülő szavakat jelöli 'isNew: true' állapottal
 * - 20 szavas chunking szabályok fenntartása
 */
export async function mergeListWithNewExcelData(existingList, parsedData, syncMeta = {}) {
  if (!existingList || !parsedData) return null;
  ensureListSheets(existingList);

  const existingWordsMap = new Map();
  (existingList.words || []).forEach(w => {
    existingWordsMap.set((w.english || '').toLowerCase().trim(), w);
  });

  const nowIso = new Date().toISOString();
  let newWordsCount = 0;
  let updatedWordsCount = 0;
  const mergedWords = [];

  const incomingWords = parsedData.words || [];
  incomingWords.forEach((pw, idx) => {
    const key = (pw.english || '').toLowerCase().trim();
    const existing = existingWordsMap.get(key);

    if (existing) {
      if (existing.hungarian !== pw.hungarian) updatedWordsCount++;
      mergedWords.push({
        ...existing,
        english: pw.english,
        hungarian: pw.hungarian,
        timesPracticed: existing.timesPracticed || 0,
        timesCorrect: existing.timesCorrect || 0,
        isNew: existing.isNew === true,
        addedAt: existing.addedAt || nowIso
      });
    } else {
      newWordsCount++;
      mergedWords.push({
        id: `w_sync_${Date.now()}_${idx}_${newWordsCount}`,
        english: pw.english,
        hungarian: pw.hungarian,
        timesPracticed: 0,
        timesCorrect: 0,
        isNew: true,
        addedAt: nowIso
      });
    }
  });

  // Egységek frissítése
  existingList.words = mergedWords;
  existingList.wordCount = mergedWords.length;
  existingList.sheets = chunkWordsIntoUnits(mergedWords, existingList.name || 'Egység');
  existingList.updatedAt = nowIso;
  existingList.lastSyncAt = nowIso;

  if (syncMeta.googleDriveUrl) existingList.googleDriveUrl = syncMeta.googleDriveUrl;
  if (syncMeta.googleDriveFileId) existingList.googleDriveFileId = syncMeta.googleDriveFileId;

  await saveExistingList(existingList.id, existingList);

  return {
    updatedList: existingList,
    newWordsCount,
    updatedWordsCount,
    totalWords: mergedWords.length,
    sheetsCount: existingList.sheets.length,
    syncedAt: nowIso
  };
}

/**
 * Mix Gyakorló Statisztikák lekérése és mentése
 */
export function getMixStats() {
  try {
    const raw = localStorage.getItem(MIX_STATS_KEY);
    return raw ? JSON.parse(raw) : {
      totalQuestionsAnswered: 0,
      totalCorrect: 0,
      sessionsCompleted: 0,
      lastPracticedAt: null
    };
  } catch (e) {
    return { totalQuestionsAnswered: 0, totalCorrect: 0, sessionsCompleted: 0, lastPracticedAt: null };
  }
}

export function recordMixPractice(correctCount, totalCount) {
  const current = getMixStats();
  current.totalQuestionsAnswered += totalCount;
  current.totalCorrect += correctCount;
  current.sessionsCompleted += 1;
  current.lastPracticedAt = new Date().toISOString();

  try {
    localStorage.setItem(MIX_STATS_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn("Mix statisztika mentési hiba:", e);
  }
  return current;
}

/**
 * Teljes körű statisztikai összegzés lekérése
 */
export async function getOverallStats() {
  const lists = await getUserLists();
  const mixStats = getMixStats();

  let totalWords = 0;
  let masteredWords = 0;
  let totalUnits = 0;
  let unlockedUnits = 0;
  let totalPracticedTimes = 0;
  let totalCorrectAnswers = 0;
  let highestStreak = 0;

  lists.forEach(list => {
    (list.words || []).forEach(w => {
      totalWords++;
      totalPracticedTimes += (w.timesPracticed || 0);
      totalCorrectAnswers += (w.timesCorrect || 0);
      // Elsajátított szó: legalább 2x sikeresen megválaszolva
      if ((w.timesCorrect || 0) >= 2) {
        masteredWords++;
      }
    });

    (list.sheets || []).forEach(s => {
      totalUnits++;
      if (s.isUnlocked) unlockedUnits++;
      if ((s.consecutivePerfectScores || 0) > highestStreak) {
        highestStreak = s.consecutivePerfectScores;
      }
    });
  });

  const accuracyPercent = totalPracticedTimes > 0 
    ? Math.round((totalCorrectAnswers / totalPracticedTimes) * 100) 
    : 0;

  const unitCompletionRate = totalUnits > 0
    ? Math.round((unlockedUnits / totalUnits) * 100)
    : 0;

  return {
    totalPackages: lists.length,
    totalWords,
    masteredWords,
    totalUnits,
    unlockedUnits,
    unitCompletionRate,
    totalPracticedTimes,
    totalCorrectAnswers,
    accuracyPercent,
    highestStreak,
    mixStats
  };
}

// Kompatibilitási no-op függvények cloud sync hivatkozásokhoz
export async function pushListToCloud() { return true; }
export async function deleteListFromCloud() { return true; }
export async function pullUserCloudData() { return await getUserLists(); }
export async function syncMultiDeviceCloud() { return { success: true }; }
export function setupRealtimeCloudListener() { return () => {}; }
export function mergeCloudAndLocalLists(cloudLists, localLists) { return localLists; }
