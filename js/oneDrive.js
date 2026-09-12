/**
 * WL (Word Learning) - Microsoft OneDrive Szinkronizációs Modul
 * Felhőben tárolt Excel szójegyzékek automatikus és kézi szinkronizálása
 */

import { parseExcelBuffer } from './excel.js';
import { getListById, getUserLists, saveNewList, saveExistingList, mergeListWithNewExcelData } from './storage.js';

/**
 * Microsoft OneDrive megosztott hivatkozás átalakítása Graph API URL-safe megosztási tokenné:
 * 1. Base64 kódolás
 * 2. URL-biztos karakterek: '/' -> '_', '+' -> '-', '=' levágása
 * 3. 'u!' előtag hozzáadása
 */
export function getSharingToken(url) {
  if (!url) return '';
  const trimmed = url.trim();
  try {
    const base64 = btoa(unescape(encodeURIComponent(trimmed)))
      .replace(/=/g, '')
      .replace(/\//g, '_')
      .replace(/\+/g, '-');
    return 'u!' + base64;
  } catch (e) {
    console.error("Hiba a megosztási token képzésekor:", e);
    return '';
  }
}

/**
 * Közvetlen letöltési link előállítása OneDrive linkből
 */
export function resolveOneDriveDownloadUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  
  // Ha már api.onedrive.com link
  if (trimmed.includes('api.onedrive.com/v1.0/shares/')) {
    return trimmed.endsWith('/content') ? trimmed : `${trimmed}/content`;
  }

  // Ha már közvetlen letöltési link paraméterrel rendelkezik
  if (trimmed.includes('download=1') || trimmed.includes('/download?')) {
    return trimmed;
  }

  const token = getSharingToken(trimmed);
  if (!token) return trimmed;
  return `https://api.onedrive.com/v1.0/shares/${token}/root/content`;
}

/**
 * Fájl metaadatainak (ETag, utolsó módosítás, név, méret) lekérdezése
 */
export async function fetchOneDriveMetadata(url) {
  const token = getSharingToken(url);
  if (!token) return null;

  const metaUrl = `https://api.onedrive.com/v1.0/shares/${token}/root`;
  try {
    const resp = await fetch(metaUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) {
      console.warn(`OneDrive metaadat lekérési válasz: ${resp.status} ${resp.statusText}`);
      return null;
    }

    const data = await resp.json();
    return {
      id: data.id,
      name: data.name || 'OneDrive_Words.xlsx',
      eTag: data.eTag || data.cTag || null,
      lastModifiedDateTime: data.lastModifiedDateTime || null,
      size: data.size || 0,
      downloadUrl: data['@content.downloadUrl'] || null
    };
  } catch (err) {
    console.warn("Nem sikerült lekérni a OneDrive metaadatokat:", err);
    return null;
  }
}

/**
 * OneDrive Excel fájl bináris letöltése (ArrayBuffer)
 */
export async function downloadOneDriveExcel(url, metadata = null) {
  const directUrl = metadata?.downloadUrl || resolveOneDriveDownloadUrl(url);
  try {
    const resp = await fetch(directUrl);
    if (!resp.ok) {
      throw new Error(`Letöltési hiba: ${resp.status} ${resp.statusText}`);
    }
    return await resp.arrayBuffer();
  } catch (e) {
    // Fallback próba a shares végponttal, ha az első nem az volt
    const token = getSharingToken(url);
    const sharesUrl = `https://api.onedrive.com/v1.0/shares/${token}/root/content`;
    if (directUrl !== sharesUrl) {
      const resp = await fetch(sharesUrl);
      if (!resp.ok) {
        throw new Error(`OneDrive letöltés sikertelen (${resp.status}): ${e.message}`);
      }
      return await resp.arrayBuffer();
    }
    throw e;
  }
}

/**
 * Adott szólista szinkronizálása a hozzá kapcsolt OneDrive fájllal
 */
export async function syncOneDriveList(listId, options = { force: false }) {
  const list = await getListById(listId);
  if (!list) {
    return { success: false, status: 'not_found', message: 'A szólista nem található.' };
  }

  if (!list.oneDriveUrl) {
    return { success: false, status: 'no_url', message: 'Nincs OneDrive hivatkozás társítva a listához.' };
  }

  try {
    // 1. Metaadatok ellenőrzése
    const metadata = await fetchOneDriveMetadata(list.oneDriveUrl);

    // 2. Ha nem kényszerített, és a metaadatok alapján nem történt módosítás
    if (!options.force && metadata) {
      const isETagSame = metadata.eTag && list.oneDriveETag && metadata.eTag === list.oneDriveETag;
      const isDateSame = metadata.lastModifiedDateTime && list.oneDriveLastModified && 
                         metadata.lastModifiedDateTime === list.oneDriveLastModified;

      if (isETagSame || isDateSame) {
        list.lastSyncCheckAt = new Date().toISOString();
        await saveExistingList(list.id, list);
        return {
          success: true,
          status: 'up_to_date',
          list,
          newWordsCount: 0,
          updatedWordsCount: 0,
          message: 'A OneDrive fájl naprakész, nem történt új változás.'
        };
      }
    }

    // 3. Fájl letöltése és feldolgozása
    const buffer = await downloadOneDriveExcel(list.oneDriveUrl, metadata);
    const parsedData = parseExcelBuffer(buffer, list.name, metadata?.name || 'OneDrive_Words.xlsx');

    // 4. Intelligens összefésülés a meglévő adatokkal
    const mergeResult = await mergeListWithNewExcelData(list, parsedData, {
      oneDriveUrl: list.oneDriveUrl,
      eTag: metadata?.eTag || null,
      lastModified: metadata?.lastModifiedDateTime || null
    });

    return {
      success: true,
      status: 'synced',
      ...mergeResult,
      message: `Sikeres szinkronizáció! ${mergeResult.newWordsCount} új szó bekerült a gyakorlási prioritásba.`
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
 * Új szólista importálása közvetlenül OneDrive megosztott hivatkozásból
 */
export async function connectOneDriveList(url, customName = null) {
  if (!url || !url.trim()) {
    throw new Error("Kérlek, adj meg egy érvényes OneDrive hivatkozást!");
  }

  const cleanUrl = url.trim();
  const metadata = await fetchOneDriveMetadata(cleanUrl);
  const buffer = await downloadOneDriveExcel(cleanUrl, metadata);

  const defaultName = metadata?.name ? metadata.name.replace(/\.[^/.]+$/, "") : "OneDrive Szólista";
  const finalName = (customName && customName.trim()) ? customName.trim() : defaultName;

  const parsedData = parseExcelBuffer(buffer, finalName, metadata?.name || 'OneDrive_Words.xlsx');

  // Új szavak megjelölése isNew: true flaggel
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

  // OneDrive metaadatok csatolása
  createdList.oneDriveUrl = cleanUrl;
  if (metadata?.eTag) createdList.oneDriveETag = metadata.eTag;
  if (metadata?.lastModifiedDateTime) createdList.oneDriveLastModified = metadata.lastModifiedDateTime;
  createdList.lastSyncAt = nowIso;

  await saveExistingList(createdList.id, createdList);

  return createdList;
}

/**
 * Meglévő szólista összekapcsolása egy OneDrive hivatkozással és azonnali szinkronizálás
 */
export async function linkExistingListToOneDrive(listId, url) {
  const list = await getListById(listId);
  if (!list) throw new Error("A lista nem található!");

  list.oneDriveUrl = url.trim();
  await saveExistingList(listId, list);

  return await syncOneDriveList(listId, { force: true });
}

/**
 * Alkalmazás indításakor a felhasználó összes OneDrive-kapcsolt listájának háttérbeli ellenőrzése
 */
export async function checkAllOneDriveListsOnStartup(onSyncSuccess = null) {
  try {
    const lists = await getUserLists();
    const linkedLists = lists.filter(l => Boolean(l.oneDriveUrl));

    if (linkedLists.length === 0) return;

    console.log(`[OneDrive] ${linkedLists.length} kapcsolt lista ellenőrzése a háttérben...`);

    for (const list of linkedLists) {
      try {
        const result = await syncOneDriveList(list.id, { force: false });
        if (result.success && result.status === 'synced' && result.newWordsCount > 0) {
          console.log(`[OneDrive] "${list.name}" frissült: +${result.newWordsCount} új szó!`);
          if (typeof onSyncSuccess === 'function') {
            onSyncSuccess(result);
          }
          window.dispatchEvent(new CustomEvent('onedrive-synced', { detail: result }));
        }
      } catch (err) {
        console.warn(`[OneDrive] Hiba a(z) "${list.name}" ellenőrzésekor:`, err);
      }
    }
  } catch (err) {
    console.warn("[OneDrive] Hiba a listák kezdeti ellenőrzésekor:", err);
  }
}
