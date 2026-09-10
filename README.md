# WL Wordly — Excel Alapú Szótanuló és Angol Szókincs Gyakorló

A **WL Wordly** (vagy *WLWordly*) egy modern, letisztult és felhasználóbarát webalkalmazás, amely segít az angol szavak gyakorlásában a felhasználó által feltöltött Excel (`.xlsx`, `.xls`) és `.csv` fájlok alapján, szigorú multi-tenant adatvédelemmel és célzott Google keresőoptimalizálással (SEO).

---

## 🌟 Főbb Képességek és Architektúra

### 1. 🛡️ Szigorú Adatvédelem és Adatszeparálás (Multi-Tenancy)
- **Kriptográfiai és Jogosultsági Elzárás (Zero-Trust)**:
  - Minden feltöltött szójegyzék (pl. *"Napi szavak"*, *"B2 nyelvvizsga"*, *"IT kifejezések"*), szópár és tanulási statisztika kizárólag a feltöltő felhasználó fiókjához (`user.uid`) kötődik.
  - Más felhasználó sem a felületen, sem közvetlen API kérésekkel vagy az adatbázis lekérdezésével **nem férhet hozzá mások adataihoz**.
- **Adatbázis-szintű Biztonsági Szabályok**:
  - **Firebase Firestore**: A `firestore.rules` fájl ellenőrzi, hogy `request.auth.uid == userId` legyen minden olvasási, létrehozási és törlési műveletnél, kiegészítve méret- és típusvalidációval.
  - **Supabase PostgreSQL**: A `supabase_rls.sql` fájl Row Level Security (RLS) házirendekkel (`auth.uid() = user_id`) garantálja a védelmet.
- **Hitelesítés**:
  - Email és jelszó regisztráció/bejelentkezés biztonságos token-alapú munkamenettel (JWT/Session).
  - Azonnal elérhető **Helyi / Vendég mód** a kipróbáláshoz külön regisztráció nélkül is.

### 2. 🔍 Célzott Google SEO ("WL Wordly" 1. helyezés)
- **Fő Kulcsszavak**: *"WL Wordly"*, *"WLWordly"*, *"WL Wordly szótanuló"*, *"excel szótanuló"*
- **Meta Adatok ([index.html](file:///c:/Users/user/Documents/WL/index.html))**:
  - `<title>`: `WL Wordly – Excel Alapú Szótanuló és Angol Szókincs Gyakorló`
  - `<meta name="description">`: `A WL Wordly segítségével egyszerűen és hatékonyan tanulhatsz angol szavakat a saját Excel fájljaidból bármilyen eszközön. Töltsd fel a szójegyzékedet és gyakorolj ingyen!`
  - `<meta name="keywords">`: `WL Wordly, WLWordly, WL Wordly szótanuló, excel szótanuló, angol szókincs gyakorlás, szótanulás excelből`
  - Open Graph és Twitter Card meta tagek a közösségi megosztásokhoz.
- **PWA & Cross-Platform Támogatás**:
  - `manifest.json` és Service Worker (`sw.js`) a teljes offline használathoz.
  - Telepíthető okostelefonra (Android, iOS Safari), táblagépre és számítógépre (Windows, macOS).
  - Érintőképernyőre és virtuális billentyűzetre szabott egykezes mobil felület (`enterkeyhint="go"`, alsó menüsáv).
- **Strukturált Adatok (Schema.org / JSON-LD)**:
  - `SoftwareApplication` és `WebApplication` típusú séma, amely kifejezetten jelzi a Google számára a *"WL Wordly"* nevet és az oktatási kategóriát.
- **Indexelhető Nyilvános Kezdőlap (Landing Page)**:
  - Kiemelt `<h1>` címsor: **"WL Wordly – Tanulj szavakat a saját Excel fájljaidból"**
  - Természetes kulcsszó-használat a szövegezésben és a GYIK (FAQ) szekcióban.
- **Keresőmotor Fájlok**:
  - `robots.txt`: Nyilvános utak engedélyezése (`Allow: /`), privát dashboard és gyakorló felületek védelme (`Disallow: /dashboard`, `Disallow: /practice`).
  - `sitemap.xml`: Érvényes XML webhelytérkép a Google Search Console-hoz.

### 3. 📊 Excel Fájlok Intelligens Kezelése (SheetJS)
- **Támogatott formátumok**: `.xlsx`, `.xls` és `.csv`.
- **Szerkezet**: 1. oszlop = Angol szó, 2. oszlop = Magyar jelentés.
- **Automatikus fejléc-érzékelés**: Észleli és átugorja a fejlécsorokat (*English, Angol, Word, Jelentés* stb.).
- **Lista menedzsment**:
  - Listák mentése külön-külön profilba (pl. *"Napi szavak"*, *"B2 nyelvvizsga"*).
  - Listák átnevezése, szavak egyedi szerkesztése/törlése és exportálása Excelbe.
- **Minta sablon generálás**: Egy kattintással letölthető 20 szavas minta `.xlsx` fájl a felületről.

### 4. 🎯 Gyakorlási és Kikérdezési Felület
- Nagy méretű, fókuszált kártya a véletlenszerű szóval.
- **Anyanyelvi Kiejtés (Web Speech API TTS)**: Hangfelolvasó funkció angol akcentussal.
- **Intelligens Szinonima-kezelés**: Ha egy szónak több jelentése van (pl. *"eredmény, teljesítmény"* vagy *"kutya / eb"*), bármelyik helyes választ elfogadja.
- **Visszajelzés**:
  - **Helyes válasz**: Zöld vizuális kiemelés, hang/animáció, streak növelése, konfetti effektek, és automatikus ugrás a következő szóra (vagy azonnal <kbd>Enter</kbd>-re).
  - **Helytelen válasz**: Piros kiemelés, pontos helyes jelentés bemutatása, és *"Következő szó"* gomb (<kbd>Enter</kbd>-rel is).
- Kétirányú gyakorlás: Angol → Magyar vagy Magyar → Angol.

---

## 💻 Helyi Futtatás (Windows)

A projekt futtatásához semmilyen külső programot nem szükséges telepíteni:

1. Nyisd meg a mappát:
   ```
   c:\Users\user\Documents\WL\
   ```
2. Kattints duplán a **`start.bat`** fájlra!
3. A script elindítja a beépített Windows PowerShell HTTP szervert (`server.ps1`), és automatikusan megnyitja az alkalmazást a böngésződben a `http://localhost:3000` címen.

---

## 🌐 Publikus Telepítés (Firebase Hosting / Vercel / Netlify)

A mellékelt konfigurációs fájlokkal a WL Wordly azonnal élesíthető HTTPS-en:

- **Firebase Hosting**:
  ```bash
  firebase deploy
  ```
  *(A `firebase.json` és `firestore.rules` már előre be van állítva).*
- **Vercel**: Importáld a projektet a Vercel felületén (a `vercel.json` gondoskodik az átirányításokról és a biztonsági HTTPS fejlécekről).
- **Netlify**: A `_headers` és `_redirects` fájlok biztosítják az azonnali SPA működést.
