/**
 * WL (Word Learning) - Google Drive / Google Sheets Szinkronizációs Modul
 * Felhőben tárolt Google Táblázatok automatikus és kézi szinkronizálása
 */

import { parseExcelBuffer } from './excel.js';
import { getListById, getUserLists, saveNewList, saveExistingList, mergeListWithNewExcelData } from './storage.js';

/**
 * Google File ID kinyerése különféle Google Drive és Google Sheets hivatkozásokból
 * Támogatott formátumok:
 * - https://docs.google.com/spreadsheets/d/{FILE_ID}/edit...
 * - https://drive.google.com/file/d/{FILE_ID}/view...
 * - https://drive.google.com/open?id={FILE_ID}
 * - https://drive.google.com/uc?id={FILE_ID}
 * - Közvetlen File ID karakterlánc
 */
export function extractGoogleFileId(url) {
  if (!url) return null;
  const str = String(url).trim();

  // 1. /d/{FILE_ID} formátum
  const dMatch = str.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
  if (dMatch && dMatch[1]) return dMatch[1];

  // 2. id={FILE_ID} formátum
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (idMatch && idMatch[1]) return idMatch[1];

  // 3. Közvetlenül megadott azonosító
  if (/^[a-zA-Z0-9_-]{20,}$/.test(str)) {
    return str;
  }

  return null;
}

/**
 * Közvetlen Google Sheets CSV export URL előállítása
 * Formátum: https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv(&sheet={SHEET_NAME})
 */
export function buildGoogleSheetsCsvUrl(fileIdOrUrl, sheetName = null) {
  const fileId = extractGoogleFileId(fileIdOrUrl);
  if (!fileId) return null;

  let url = `https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv`;
  if (sheetName && String(sheetName).trim()) {
    url += `&sheet=${encodeURIComponent(String(sheetName).trim())}`;
  }
  return url;
}

/**
 * Robusztus RFC 4180 kompatibilis CSV értelmező
 * Kezeli az idézőjeleket (""), a vesszőt, pontosvesszőt és tabulátort, valamint a sortöréseket
 */
export function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];

  // Sortörések normalizálása
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  // Elválasztójel automatikus felismerése az első nem üres sor alapján
  let delimiter = ',';
  const firstLine = text.split('\n').find(l => l.trim().length > 0) || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // Escaped idézőjel átugrása
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // Utolsó mező / sor hozzáadása
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Fejléc sor felismerése (English / Hungarian / Angol / Magyar / Szó / Word stb.)
 */
export function isHeaderRow(row) {
  if (!row || row.length < 2) return false;
  const col0 = String(row[0] || '').toLowerCase().trim();
  const col1 = String(row[1] || '').toLowerCase().trim();

  const headerKeywords = [
    'english', 'angol', 'szó', 'szo', 'word', 'kifejezés', 'kifejezes', 
    'hungarian', 'magyar', 'fordítás', 'forditas', 'jelentés', 'jelentes', 'meaning'
  ];

  return headerKeywords.includes(col0) || headerKeywords.includes(col1);
}

/**
 * CSV szöveg feldolgozása szópárok objektumtömbjévé
 */
export function parseCSVWords(csvText) {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return [];

  let startIndex = 0;
  if (isHeaderRow(rows[0])) {
    startIndex = 1;
  }

  const words = [];
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const english = String(row[0] || '').trim();
    const hungarian = String(row[1] || '').trim();

    if (english && hungarian) {
      words.push({
        id: `w_csv_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        english,
        hungarian,
        timesPracticed: 0,
        timesCorrect: 0
      });
    }
  }

  return words;
}

/**
 * Felhasználó által megadott munkalap nevek értelmezése
 */
export function parseSheetNamesInput(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(s => String(s).trim()).filter(Boolean);
  }
  return String(input)
    .split(/[,;\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Letöltési URL-ek előállítása prioritási sorrendben
 */
export function buildGoogleDownloadUrls(fileIdOrUrl) {
  const fileId = extractGoogleFileId(fileIdOrUrl);
  if (!fileId) return [];

  const str = String(fileIdOrUrl || '');
  const isSheets = str.includes('spreadsheets');

  if (isSheets) {
    return [
      `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`,
      `https://drive.google.com/uc?export=download&id=${fileId}`
    ];
  }

  return [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`
  ];
}

/**
 * Google Táblázat / Drive Excel bináris ArrayBuffer letöltése
 */
export async function downloadGoogleSheetExcel(url) {
  const fileId = extractGoogleFileId(url);
  if (!fileId) {
    throw new Error("Érvénytelen Google Drive vagy Google Sheets hivatkozás! Kérlek, ellenőrizd a megadott linket.");
  }

  const candidateUrls = buildGoogleDownloadUrls(url);
  let lastError = null;

  for (const downloadUrl of candidateUrls) {
    try {
      const resp = await fetch(downloadUrl);

      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          throw new Error("A fájlhoz nincs hozzáférés! Kérlek, a Google Táblázatban a Megosztás menüben állítsd a hozzáférést: 'Bárki, akinél megvan a link' megtekintőre.");
        }
        if (resp.status === 404) {
          throw new Error("A Google Táblázat nem található! Ellenőrizd, hogy helyes-e a link.");
        }
        throw new Error(`Letöltési hiba (${resp.status}): ${resp.statusText}`);
      }

      // Ellenőrizzük, nem HTML bejelentkező oldal tért-e vissza (ha a fájl nem publikus)
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const text = await resp.text();
        if (text.includes('ServiceLogin') || text.includes('accounts.google.com') || text.includes('Sign in') || text.trim().startsWith('<!DOCTYPE html>')) {
          throw new Error("A Google Táblázat privát! Kérlek, engedélyezd a megosztást: 'Bárki, akinél megvan a link' jogosultsággal.");
        }
      }

      const buffer = await resp.arrayBuffer();
      if (!buffer || buffer.byteLength === 0) {
        throw new Error("A letöltött fájl üres.");
      }

      return { buffer, fileId };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Nem sikerült elérni a Google Táblázatot.");
}

/**
 * Egyetlen munkalap CSV adatainak közvetlen letöltése (fetch) Google gviz/tq végpontról
 */
export async function fetchSheetCSV(fileIdOrUrl, sheetName = null) {
  const fileId = extractGoogleFileId(fileIdOrUrl);
  if (!fileId) {
    throw new Error("Érvénytelen Google Drive vagy Google Sheets hivatkozás! Kérlek, ellenőrizd a megadott linket.");
  }

  const csvUrl = buildGoogleSheetsCsvUrl(fileId, sheetName);
  let resp;
  try {
    resp = await fetch(csvUrl);
  } catch (netErr) {
    throw new Error("Hálózati hiba a Google Táblázat elérésekor. Ellenőrizd az internetkapcsolatot!");
  }

  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error("A Google Táblázat nem nyilvános! Kérlek, a Google Táblázatban a Megosztás menüben állítsd be: 'Bárki, akinél megvan a link' (megtekintő).");
    }
    if (resp.status === 404) {
      throw new Error("A Google Táblázat nem található! Ellenőrizd, hogy helyes-e a megadott link.");
    }
    throw new Error(`Nem sikerült letölteni a Google Táblázatot (${resp.status}): ${resp.statusText}`);
  }

  const contentType = resp.headers.get('content-type') || '';
  const text = await resp.text();

  // Ellenőrizzük, hogy privát HTML bejelentkező oldal tért-e vissza
  if (contentType.includes('text/html') || 
      text.includes('accounts.google.com') || 
      text.includes('ServiceLogin') || 
      text.trim().startsWith('<!DOCTYPE html>')) {
    throw new Error("A Google Táblázat nem nyilvános! Kérlek, a Google Táblázatban a Megosztás menüben állítsd be: 'Bárki, akinél megvan a link' (megtekintő).");
  }

  const words = parseCSVWords(text);
  return {
    sheetName: sheetName || '1. Munkalap',
    words,
    rawText: text
  };
}

/**
 * Több munkalap közvetlen CSV letöltése és összerakása egyetlen struktúrába
 */
export async function fetchMultipleSheetsCSV(fileIdOrUrl, sheetNames = []) {
  const fileId = extractGoogleFileId(fileIdOrUrl);
  if (!fileId) {
    throw new Error("Érvénytelen Google Drive vagy Google Sheets hivatkozás! Kérlek, ellenőrizd a megadott linket.");
  }

  const cleanNames = parseSheetNamesInput(sheetNames);

  // Ha nem adott meg munkalap neveket, az alapértelmezett munkalapot töltjük le
  if (cleanNames.length === 0) {
    const singleResult = await fetchSheetCSV(fileId, null);
    return {
      fileId,
      fileName: 'Google_Sheets_Export.csv',
      words: singleResult.words,
      sheets: [{
        id: `sheet_0_${Date.now()}`,
        name: singleResult.sheetName || 'Munkalap 1',
        order: 0,
        words: singleResult.words,
        isUnlocked: true,
        consecutivePerfectScores: 0,
        timesPracticed: 0,
        timesPassed: 0,
        totalCorrect: 0,
        totalAnswers: 0
      }]
    };
  }

  // Több megadott munkalap egymás utáni lekérése
  const sheets = [];
  const allWords = [];

  for (let i = 0; i < cleanNames.length; i++) {
    const sName = cleanNames[i];
    const sheetData = await fetchSheetCSV(fileId, sName);
    sheets.push({
      id: `sheet_${i}_${Date.now()}_${i}`,
      name: sName,
      order: i,
      words: sheetData.words,
      isUnlocked: i === 0,
      consecutivePerfectScores: 0,
      timesPracticed: 0,
      timesPassed: 0,
      totalCorrect: 0,
      totalAnswers: 0
    });
    allWords.push(...sheetData.words);
  }

  return {
    fileId,
    fileName: 'Google_Sheets_Export.csv',
    words: allWords,
    sheets
  };
}

/**
 * Intelligens Google Táblázat adatlekérés:
 * 1. Ha megadott munkalap neveket: közvetlen CSV lekérés a gviz/tq végponton laponként
 * 2. Ha nem adott meg munkalap neveket: megpróbálja a teljes munkafüzetet (XLSX) letölteni automatikus fülfelismeréssel,
 *    illetve ha ez meghiúsulna, közvetlen alapértelmezett CSV-ként tölti le
 */
export async function fetchGoogleSheetsData(fileIdOrUrl, sheetNames = []) {
  const fileId = extractGoogleFileId(fileIdOrUrl);
  if (!fileId) {
    throw new Error("Érvénytelen Google Drive vagy Google Sheets hivatkozás! Kérlek, ellenőrizd a megadott linket.");
  }

  const cleanNames = parseSheetNamesInput(sheetNames);

  // Ha a felhasználó konkrét munkalap neveket adott meg, a direct CSV gviz/tq végpontot használjuk!
  if (cleanNames.length > 0) {
    return await fetchMultipleSheetsCSV(fileId, cleanNames);
  }

  // Ha nincs megadva külön munkalap név, elsőként próbáljuk a teljes XLSX munkafüzetet letölteni
  // (ezzel a Google Sheets automatikusan az összes fület tartalmazó Excel fájlt ad vissza login nélkül)
  try {
    const { buffer } = await downloadGoogleSheetExcel(fileIdOrUrl);
    const parsed = parseExcelBuffer(buffer, "Google Táblázat", "Google_Sheets_Import.xlsx");
    if (parsed && parsed.words && parsed.words.length > 0) {
      return parsed;
    }
  } catch (xlsxErr) {
    console.warn("[Google Drive] XLSX letöltés sikertelen, fallback közvetlen CSV-re:", xlsxErr);
  }

  // Fallback: közvetlen CSV export az alapértelmezett munkalapról
  return await fetchMultipleSheetsCSV(fileId, []);
}

/**
 * Adott szólista szinkronizálása a hozzá kapcsolt Google Drive / Sheets táblázattal
 */
export async function syncGoogleDriveList(listId, options = { force: false }) {
  const list = await getListById(listId);
  if (!list) {
    return { success: false, status: 'not_found', message: 'A szólista nem található.' };
  }

  const cloudUrl = list.googleDriveUrl || list.oneDriveUrl;
  if (!cloudUrl) {
    return { success: false, status: 'no_url', message: 'Nincs Google Drive hivatkozás társítva ehhez a listához.' };
  }

  try {
    const sheetNames = list.googleDriveSheetNames || [];
    const parsedData = await fetchGoogleSheetsData(cloudUrl, sheetNames);

    if (!parsedData.words || parsedData.words.length === 0) {
      return {
        success: false,
        status: 'empty',
        message: 'A Google Táblázat nem tartalmazott feldolgozható szópárokat.'
      };
    }

    // Intelligens összefésülés a meglévő adatokkal (tanulási statisztikák védelmével)
    const mergeResult = await mergeListWithNewExcelData(list, parsedData, {
      googleDriveUrl: cloudUrl,
      googleDriveFileId: extractGoogleFileId(cloudUrl),
      googleDriveSheetNames: sheetNames,
      lastModified: new Date().toISOString()
    });

    return {
      success: true,
      status: 'synced',
      ...mergeResult,
      message: `Sikeres frissítés: ${mergeResult.newWordsCount} új szó hozzáadva!`
    };
  } catch (err) {
    console.error(`Hiba a szólista szinkronizálásakor (${listId}):`, err);
    return {
      success: false,
      status: 'error',
      message: err.message || 'Hiba történt a szinkronizálás során.'
    };
  }
}

/**
 * Új szólista importálása közvetlenül Google Drive / Google Sheets hivatkozásból
 */
export async function connectGoogleDriveList(url, customName = null, sheetNames = []) {
  if (!url || !url.trim()) {
    throw new Error("Kérlek, adj meg egy érvényes Google Drive vagy Google Sheets hivatkozást!");
  }

  const cleanUrl = url.trim();
  const cleanNames = parseSheetNamesInput(sheetNames);
  const parsedData = await fetchGoogleSheetsData(cleanUrl, cleanNames);

  if (!parsedData.words || parsedData.words.length === 0) {
    throw new Error("A Google Táblázatban nem találhatók szópárok! Ellenőrizd a táblázat oszlopait (angol és magyar oszlop).");
  }

  const defaultName = "Google Táblázat Szólista";
  const finalName = (customName && customName.trim()) ? customName.trim() : defaultName;

  // Új szavak megjelölése isNew: true flaggel és addedAt időbélyeggel
  const nowIso = new Date().toISOString();
  const wordsWithNewFlag = (parsedData.words || []).map(w => ({
    ...w,
    isNew: true,
    addedAt: nowIso
  }));

  const sheetsWithNewFlags = (parsedData.sheets || []).map(sheet => ({
    ...sheet,
    words: (sheet.words || []).map(w => ({
      ...w,
      isNew: true,
      addedAt: nowIso
    }))
  }));

  const createdList = await saveNewList(finalName, wordsWithNewFlag, sheetsWithNewFlags);

  // Google Drive metaadatok csatolása
  createdList.googleDriveUrl = cleanUrl;
  createdList.googleDriveFileId = extractGoogleFileId(cleanUrl);
  createdList.googleDriveSheetNames = cleanNames;
  createdList.lastSyncAt = nowIso;

  await saveExistingList(createdList.id, createdList);

  return createdList;
}

/**
 * Meglévő szólista összekapcsolása egy Google Drive / Google Sheets hivatkozással és azonnali szinkronizálás
 */
export async function linkExistingListToGoogleDrive(listId, url, sheetNames = []) {
  const list = await getListById(listId);
  if (!list) throw new Error("A szólista nem található!");

  const cleanUrl = url.trim();
  const cleanNames = parseSheetNamesInput(sheetNames);

  list.googleDriveUrl = cleanUrl;
  list.googleDriveFileId = extractGoogleFileId(cleanUrl);
  list.googleDriveSheetNames = cleanNames;
  await saveExistingList(listId, list);

  return await syncGoogleDriveList(listId, { force: true });
}

/**
 * Alkalmazás indításakor a felhasználó összes Google Drive kapcsolt listájának háttérbeli ellenőrzése
 */
export async function checkAllGoogleDriveListsOnStartup(onSyncSuccess = null) {
  try {
    const lists = await getUserLists();
    const linkedLists = lists.filter(l => Boolean(l.googleDriveUrl));

    if (linkedLists.length === 0) return;

    console.log(`[Google Drive] ${linkedLists.length} kapcsolt lista ellenőrzése a háttérben...`);

    for (const list of linkedLists) {
      try {
        const result = await syncGoogleDriveList(list.id, { force: false });
        if (result.success && result.status === 'synced' && result.newWordsCount > 0) {
          console.log(`[Google Drive] "${list.name}" frissült: +${result.newWordsCount} új szó!`);
          if (typeof onSyncSuccess === 'function') {
            onSyncSuccess(result);
          }
          window.dispatchEvent(new CustomEvent('gdrive-synced', { detail: result }));
        }
      } catch (err) {
        console.warn(`[Google Drive] Hiba a(z) "${list.name}" ellenőrzésekor:`, err);
      }
    }
  } catch (err) {
    console.warn("[Google Drive] Hiba a listák kezdeti ellenőrzésekor:", err);
  }
}
