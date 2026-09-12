/**
 * WL (Word Learning) - Kikérdező és Gyakorló Motor
 */

import { recordWordPractice } from './storage.js';

/**
 * Szöveg normalizálása az összehasonlításhoz:
 * 1. Kis- és nagybetű függetlenség (toLowerCase)
 * 2. Ékezetmentesítés (Diakritikus jelek eltávolítása NFD segítségével: alma = álma, kutya = kútya, almafa = álmafá, szék = szek)
 * 3. Alapvető írásjelek eltávolítása/figyelmen kívül hagyása (pont, vessző, kötőjel, kérdőjel, felkiáltójel stb.)
 * 4. Felesleges kezdő, záró és többszörös belső szóközök tisztítása (trim, replace(/\s+/g, ' '))
 */
export function normalizeAnswer(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    // Ékezetmentesítés: NFD dekompozíció és a kombináló diakritikus jelek eltávolítása
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Kötőjelek szóközzé alakítása
    .replace(/[-–—]/g, ' ')
    // Alapvető írásjelek (pont, vessző, kérdőjel, felkiáltójel, kettőspont, idézőjelek stb.) eltávolítása
    .replace(/[.,?!:;'"„”`’/\\()[\]{}]/g, '')
    // Belső többszörös szóközök eggyé alakítása
    .replace(/\s+/g, ' ')
    // Kezdő és záró szóközök levágása
    .trim();
}

export const normalizeText = normalizeAnswer;

/**
 * Két karakterlánc közötti Levenshtein-távolság kiszámítása (dinamikus programozás, O(min(m, n)) memória)
 */
export function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const m = s1.length;
  const n = s2.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const c1 = s1.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = c1 === s2.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // törlés
        curr[j - 1] + 1,   // beszúrás
        prev[j - 1] + cost // csere
      );
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  return prev[n];
}

export class PracticeSession {
  constructor(list, options = {}) {
    this.list = list;
    this.options = {
      reverse: options.reverse || false, // false: EN -> HU, true: HU -> EN
      autoAdvanceMs: options.autoAdvanceMs || 800,
      soundEnabled: options.soundEnabled !== false,
      sheetId: options.sheetId || null,
      isMix: options.isMix || false,
      ...options
    };

    // Munkalap vagy Mix mód szavainak előkészítése
    this.sheet = null;
    if (this.options.sheetId && list.sheets) {
      this.sheet = list.sheets.find(s => s.id === this.options.sheetId) || null;
    }

    if (this.sheet) {
      this.words = [...(this.sheet.words || [])];
      this.modeTitle = this.sheet.name;
    } else if (this.options.isMix && list.sheets) {
      // Mix mód: a teljesített (vagy feloldott) munkalapok szavaiból válogat
      const masteredSheets = list.sheets.filter(s => 
        (s.consecutivePerfectScores >= 2) || ((s.timesPassed || 0) >= 2) || s.isUnlocked
      );
      const pool = masteredSheets.length > 0 ? masteredSheets : list.sheets;
      const collected = [];
      pool.forEach(s => {
        if (s.words) collected.push(...s.words);
      });
      this.words = collected.length > 0 ? collected : [...(list.words || [])];
      this.modeTitle = "Mix Gyakorlás (Mesterelt szintek)";
    } else {
      this.words = [...(list.words || [])];
      this.modeTitle = list.name;
    }

    // Kör előkészítése: a szavak véletlenszerű összekeverése
    this.roundWords = this.shuffleArray([...this.words]);
    this.roundTotal = this.roundWords.length;
    this.currentIndex = 0;

    this.currentWord = null;
    this.previousWord = null;
    this.state = 'WAITING_INPUT'; // 'WAITING_INPUT' | 'CORRECT' | 'INCORRECT'
    this.lastUserInput = '';
    
    // Munkamenet statisztikák
    this.stats = {
      totalAnswered: 0,
      correctCount: 0,
      incorrectCount: 0,
      streak: 0,
      bestStreak: 0
    };

    // Hangszintetizátor beállítása
    this.initSpeech();
  }

  shuffleArray(arr) {
    const array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  initSpeech() {
    this.hasSpeech = 'speechSynthesis' in window;
  }

  /**
   * Kiejti az angol szót szövegfelolvasóval
   */
  speakCurrentWord() {
    if (!this.hasSpeech || !this.currentWord) return;
    try {
      window.speechSynthesis.cancel();
      const textToSpeak = this.options.reverse ? this.currentWord.hungarian : this.currentWord.english;
      const lang = this.options.reverse ? 'hu-HU' : 'en-US';

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = lang;
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Beszédszintetizátor hiba:", e);
    }
  }

  /**
   * Új szó kiválasztása a körből
   */
  nextWord() {
    if (this.roundWords.length === 0) {
      this.currentWord = null;
      return null;
    }

    // Ha a kör végére értünk
    if (this.currentIndex >= this.roundWords.length) {
      this.currentWord = null;
      return null;
    }

    this.currentWord = this.roundWords[this.currentIndex];
    this.currentIndex++;
    this.previousWord = this.currentWord;
    this.state = 'WAITING_INPUT';
    this.lastUserInput = '';

    return this.currentWord;
  }

  /**
   * Kör előrehaladás lekérése (pl. 3 / 10)
   */
  getProgress() {
    const current = Math.min(this.currentIndex, this.roundTotal);
    return {
      current,
      total: this.roundTotal,
      percent: this.roundTotal > 0 ? Math.round((current / this.roundTotal) * 100) : 0
    };
  }

  /**
   * Ellenőrzi, hogy a kör véget ért-e
   */
  isRoundComplete() {
    return this.stats.totalAnswered >= this.roundTotal && this.roundTotal > 0;
  }

  /**
   * 100%-os hibátlan kör-e
   */
  isPerfectScore() {
    return this.stats.totalAnswered > 0 && 
           this.stats.incorrectCount === 0 && 
           this.stats.correctCount === this.stats.totalAnswered;
  }

  /**
   * Felhasználó válaszának kiértékelése
   */
  async checkAnswer(userAnswer) {
    if (!this.currentWord || this.state !== 'WAITING_INPUT') return null;

    this.lastUserInput = String(userAnswer || '').trim();
    const isReverse = this.options.reverse;
    const targetString = isReverse ? this.currentWord.english : this.currentWord.hungarian;

    const matchResult = this.isAnswerMatching(this.lastUserInput, targetString);
    const isCorrect = matchResult.isCorrect;
    const hasTypo = matchResult.hasTypo;

    this.stats.totalAnswered++;

    if (isCorrect) {
      this.state = 'CORRECT';
      this.stats.correctCount++;
      this.stats.streak++;
      if (this.stats.streak > this.stats.bestStreak) {
        this.stats.bestStreak = this.stats.streak;
      }
    } else {
      this.state = 'INCORRECT';
      this.stats.incorrectCount++;
      this.stats.streak = 0;
    }

    // Eredmény mentése a munkalap és a lista statisztikájába
    try {
      const sheetId = this.sheet ? this.sheet.id : null;
      await recordWordPractice(this.list.id, this.currentWord.id, isCorrect, sheetId);
    } catch (e) {
      console.warn("Nem sikerült elmenteni a gyakorlási statisztikát:", e);
    }

    return {
      isCorrect,
      hasTypo,
      matchedCandidate: matchResult.matchedCandidate,
      userAnswer: this.lastUserInput,
      correctAnswer: targetString,
      promptWord: isReverse ? this.currentWord.hungarian : this.currentWord.english,
      stats: { ...this.stats },
      isRoundFinished: this.isRoundComplete(),
      isPerfect: this.isPerfectScore()
    };
  }

  /**
   * Intelligens válaszösszehasonlítás:
   * 1. Kis- és nagybetű függetlenség, ékezetmentesítés, szóköz- és írásjeltisztítás
   * 2. Szinonimák és kiegészítő zárójeles kifejezések kezelése
   * 3. Apró elütések tolerálása (legalább 5 karakteres szavaknál legfeljebb 1 Levenshtein eltérés)
   */
  isAnswerMatching(userAnswer, targetAnswer) {
    const cleanUser = this.normalizeAnswer(userAnswer);
    if (!cleanUser) return { isCorrect: false, hasTypo: false };

    const candidates = this.extractAnswerCandidates(targetAnswer);

    // 1. Kör: Pontos normalizált egyezés (ékezet- és írásjelfüggetlen)
    for (const candidate of candidates) {
      const cleanTarget = this.normalizeAnswer(candidate);
      if (cleanTarget && cleanUser === cleanTarget) {
        return { isCorrect: true, hasTypo: false, matchedCandidate: candidate };
      }
    }

    // 2. Kör: Apró elütés tolerálása (Levenshtein távolság <= 1)
    // Csak ha a cél-kifejezés legalább 5 karakter hosszú
    for (const candidate of candidates) {
      const cleanTarget = this.normalizeAnswer(candidate);
      if (cleanTarget && cleanTarget.length >= 5 && Math.abs(cleanUser.length - cleanTarget.length) <= 1) {
        const dist = levenshteinDistance(cleanUser, cleanTarget);
        if (dist <= 1) {
          return { isCorrect: true, hasTypo: true, matchedCandidate: candidate };
        }
      }
    }

    return { isCorrect: false, hasTypo: false };
  }

  /**
   * Összes elfogadható cél-kifejezés kinyerése (szinonimák, zárójelek nélküli formák)
   */
  extractAnswerCandidates(targetAnswer) {
    if (!targetAnswer) return [];
    const candidates = new Set();
    const raw = String(targetAnswer).trim();
    if (!raw) return [];

    // 1. Teljes szöveg
    candidates.add(raw);

    // 2. Zárójelek eltávolításával (pl. "tud (valamit)" -> "tud")
    const withoutParens = raw.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    if (withoutParens) candidates.add(withoutParens);

    // 3. Szinonimák bontása vessző, pontosvessző, perjel mentén
    const parts = raw.split(/[,;/]+/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        candidates.add(trimmed);
        const partNoParens = trimmed.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
        if (partNoParens) candidates.add(partNoParens);
      }
    }

    return Array.from(candidates);
  }

  normalizeAnswer(text) {
    return normalizeAnswer(text);
  }

  normalizeText(str) {
    return normalizeAnswer(str);
  }

  getAccuracyPercentage() {
    if (this.stats.totalAnswered === 0) return 0;
    return Math.round((this.stats.correctCount / this.stats.totalAnswered) * 100);
  }
}
