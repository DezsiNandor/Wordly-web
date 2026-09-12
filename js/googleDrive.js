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
    // 1. Letöltés Google felhőből
    const { buffer, fileId } = await downloadGoogleSheetExcel(cloudUrl);

    // 2. Excel/Sheet bináris feldolgozása minden munkalappal
    const parsedData = parseExcelBuffer(buffer, list.name, 'Google_Sheets_Import.xlsx');

    // 3. Intelligens összefésülés a meglévő adatokkal (tanulási statisztikák védelmével)
    const mergeResult = await mergeListWithNewExcelData(list, parsedData, {
      googleDriveUrl: cloudUrl,
      googleDriveFileId: fileId,
      lastModified: new Date().toISOString()
    });

    return {
      success: true,
      status: 'synced',
      ...mergeResult,
      message: `Sikeres szinkronizáció! ${mergeResult.newWordsCount} új szó bekerült a gyakorlási prioritásba (${mergeResult.sheetsCount} munkalap).`
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
export async function connectGoogleDriveList(url, customName = null) {
  if (!url || !url.trim()) {
    throw new Error("Kérlek, adj meg egy érvényes Google Drive vagy Google Sheets hivatkozást!");
  }

  const cleanUrl = url.trim();
  const { buffer, fileId } = await downloadGoogleSheetExcel(cleanUrl);

  const defaultName = "Google Táblázat Szólista";
  const finalName = (customName && customName.trim()) ? customName.trim() : defaultName;

  const parsedData = parseExcelBuffer(buffer, finalName, 'Google_Sheets_Import.xlsx');

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
  createdList.googleDriveFileId = fileId;
  createdList.lastSyncAt = nowIso;

  await saveExistingList(createdList.id, createdList);

  return createdList;
}

/**
 * Meglévő szólista összekapcsolása egy Google Drive / Google Sheets hivatkozással és azonnali szinkronizálás
 */
export async function linkExistingListToGoogleDrive(listId, url) {
  const list = await getListById(listId);
  if (!list) throw new Error("A szólista nem található!");

  list.googleDriveUrl = url.trim();
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
