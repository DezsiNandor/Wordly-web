/**
 * WL (Word Learning) - Excel feldolgozó és exportáló modul (SheetJS)
 */

/**
 * Excel fájl (.xlsx, .xls) beolvasása és szavak kinyerése
 * 1. oszlop = Angol kifejezés, 2. oszlop = Magyar jelentés
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (!window.XLSX) {
      return reject(new Error("A SheetJS (XLSX) könyvtár még nem töltődött be. Ellenőrizze az internetkapcsolatot!"));
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("Az Excel fájl nem tartalmaz munkalapot!");
        }

        const sheets = [];
        const allWords = [];
        let globalWordCounter = 0;

        workbook.SheetNames.forEach((sheetName, sheetIndex) => {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) return;

          // Munkalap átalakítása 2 dimenziós tömbbé
          const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
          if (!rows || rows.length === 0) return;

          let startIndex = 0;
          // Fejléc felismerési logika
          if (rows.length > 0) {
            const firstRowCol1 = String(rows[0][0] || '').trim().toLowerCase();
            const firstRowCol2 = String(rows[0][1] || '').trim().toLowerCase();

            const commonHeadersCol1 = ['english', 'angol', 'word', 'szó', 'kifejezés', 'phrase', 'en'];
            const commonHeadersCol2 = ['hungarian', 'magyar', 'jelentés', 'meaning', 'fordítás', 'hu'];

            if (commonHeadersCol1.some(h => firstRowCol1.includes(h)) || 
                commonHeadersCol2.some(h => firstRowCol2.includes(h))) {
              startIndex = 1; // Átugorjuk a fejlécet
            }
          }

          const sheetWords = [];
          for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const col1 = String(row[0] || '').trim();
            const col2 = String(row[1] || '').trim();

            // Csak akkor adjuk hozzá, ha mindkét oszlopban van tartalom
            if (col1 && col2) {
              globalWordCounter++;
              const wordObj = {
                id: `w_${sheetIndex}_${i}_${Date.now()}_${globalWordCounter}`,
                english: col1,
                hungarian: col2,
                timesPracticed: 0,
                timesCorrect: 0
              };
              sheetWords.push(wordObj);
              allWords.push(wordObj);
            }
          }

          if (sheetWords.length > 0) {
            sheets.push({
              id: `sheet_${sheetIndex}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: sheetName || `Munkalap ${sheetIndex + 1}`,
              order: sheets.length,
              isUnlocked: sheets.length === 0, // Első munkalap alapértelmezetten fel van oldva
              consecutivePerfectScores: 0,
              timesPracticed: 0,
              timesPassed: 0,
              totalCorrect: 0,
              totalIncorrect: 0,
              words: sheetWords
            });
          }
        });

        if (sheets.length === 0 || allWords.length === 0) {
          throw new Error("Nem sikerült érvényes szópárokat kinyerni az Excel fájlból! Ellenőrizze, hogy az 1. oszlopban az angol szó, a 2. oszlopban a magyar jelentés található-e.");
        }

        // Fájlnévből lista alapértelmezett neve (kiterjesztés nélkül)
        let defaultName = file.name.replace(/\.[^/.]+$/, "");
        if (!defaultName.trim()) defaultName = "Új szószedet";

        resolve({
          fileName: file.name,
          listName: defaultName,
          wordCount: allWords.length,
          words: allWords,
          sheets: sheets,
          preview: allWords.slice(0, 6)
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error("Hiba történt a fájl beolvasása közben."));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Szólista exportálása Excel (.xlsx) formátumban és azonnali letöltés
 */
export function exportListToExcel(listName, words) {
  if (!window.XLSX) {
    alert("A letöltéshez szükséges XLSX modul nem érhető el.");
    return;
  }

  const data = [
    ["Angol kifejezés", "Magyar jelentés", "Gyakorolva", "Helyes válaszok"]
  ];

  words.forEach(w => {
    data.push([
      w.english,
      w.hungarian,
      w.timesPracticed || 0,
      w.timesCorrect || 0
    ]);
  });

  const ws = window.XLSX.utils.aoa_to_sheet(data);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Szavak");

  // Oszlopszélességek beállítása az esztétikus megjelenésért
  ws['!cols'] = [
    { wch: 25 },
    { wch: 30 },
    { wch: 14 },
    { wch: 18 }
  ];

  const safeFileName = `${(listName || 'wl_szolista').replace(/[\\/:*?"<>|]/g, '_')}.xlsx`;
  window.XLSX.writeFile(wb, safeFileName);
}

/**
 * Minta Excel sablon letöltése a felhasználónak (több munkalappal a progresszió teszteléséhez)
 */
export function downloadSampleExcel() {
  if (!window.XLSX) {
    alert("Az XLSX modul betöltése folyamatban...");
    return;
  }

  // 1. Munkalap: Alapszavak (1. Szint)
  const sheet1Data = [
    ["Angol szó", "Magyar jelentés"],
    ["achievement", "teljesítmény, eredmény"],
    ["opportunity", "lehetőség"],
    ["development", "fejlesztés, fejlődés"],
    ["challenge", "kihívás"],
    ["environment", "környezet"],
    ["experience", "tapasztalat, élmény"],
    ["knowledge", "tudás, ismeret"],
    ["successful", "sikeres"]
  ];

  // 2. Munkalap: Haladó kifejezések (2. Szint - zárolt a 2x 100% eléréséig)
  const sheet2Data = [
    ["Angol szó", "Magyar jelentés"],
    ["accurate", "pontos, szabatos"],
    ["achieve", "elér, megvalósít"],
    ["acquire", "megszerez, elsajátít"],
    ["adapt", "alkalmazkodik"],
    ["adequate", "megfelelő, elegendő"],
    ["affordable", "megfizethető"],
    ["ambitious", "törekvő, ambiciózus"],
    ["appreciate", "értékel, méltányol"]
  ];

  const wb = window.XLSX.utils.book_new();

  const ws1 = window.XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = [{ wch: 20 }, { wch: 25 }];
  window.XLSX.utils.book_append_sheet(wb, ws1, "1. Lecke - Alapszavak");

  const ws2 = window.XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = [{ wch: 20 }, { wch: 25 }];
  window.XLSX.utils.book_append_sheet(wb, ws2, "2. Lecke - Haladó");

  window.XLSX.writeFile(wb, "WL_Minta_Szolista_Tobb_Munkalappal.xlsx");
}

/**
 * Szólista exportálása CSV formátumban (.csv)
 */
export function exportListToCSV(listName, words) {
  const safeName = (listName || 'Wordly_lista').replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ_\-\s]/g, '_');
  const header = "Angol szó,Magyar jelentés\r\n";
  const rows = (words || []).map(w => {
    const en = (w.english || '').replace(/"/g, '""');
    const hu = (w.hungarian || '').replace(/"/g, '""');
    return `"${en}","${hu}"`;
  }).join("\r\n");

  const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Szólista exportálása strukturált JSON formátumban (.json)
 */
export function exportListToJSON(listName, words) {
  const safeName = (listName || 'Wordly_lista').replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ_\-\s]/g, '_');
  const payload = {
    app: "WL Wordly",
    version: "2.0",
    listName: listName,
    exportedAt: new Date().toISOString(),
    totalWords: (words || []).length,
    words: words || []
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
