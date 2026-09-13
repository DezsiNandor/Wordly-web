/**
 * WL Wordly - Kikérdező és Gyakorló Motor (AI Multi-Format Support)
 * Támogatja az összes interaktív feladattípust:
 * 1. MULTIPLE_CHOICE
 * 2. FILL_BLANK
 * 3. WORD_SCRAMBLE
 * 4. TRUE_FALSE
 * 5. CONTEXT_MATCH
 * 6. LISTENING
 * 7. WRITTEN_RECALL
 */

import { recordWordPractice, recordMixPractice } from './storage.js';
import { generateNextExercise } from './aiExerciseEngine.js';

/**
 * Szöveg normalizálása az összehasonlításhoz
 */
export function normalizeAnswer(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[.,?!:;'"„”`’/\\()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const normalizeText = normalizeAnswer;

/**
 * Két karakterlánc közötti Levenshtein-távolság kiszámítása
 */
export function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const m = s1.length;
  const n = s2.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const c1 = s1.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = c1 === s2.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  return prev[n];
}

/**
 * Tömb véletlenszerű összekeverése (Fisher-Yates)
 */
export function shuffleArray(arr) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Szavak prioritás szerinti rendezése:
 * 1. Újonnan hozzáadott szavak (isNew: true)
 * 2. Korábban elrontott szavak (timesPracticed > timesCorrect)
 * 3. Normál szavak
 */
export function generatePrioritizedRoundWords(words) {
  if (!Array.isArray(words) || words.length === 0) return [];
  const newWords = words.filter(w => w.isNew === true);
  const failedWords = words.filter(w => !w.isNew && (w.timesPracticed || 0) > (w.timesCorrect || 0));
  const normalWords = words.filter(w => !w.isNew && (w.timesPracticed || 0) <= (w.timesCorrect || 0));

  return [
    ...shuffleArray(newWords),
    ...shuffleArray(failedWords),
    ...shuffleArray(normalWords)
  ];
}

let sharedAudioCtx = null;

/**
 * Kíméletes sípoló hang (Web Audio API) a kitalálandó szó helyén írásos feladatoknál
 * Egyetlen megosztott AudioContext-et használ a böngészők 6-os hardverlimitjének megelőzésére.
 */
export function playBlankBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, sharedAudioCtx.currentTime); // D5 tiszta zenei hang
    gain.gain.setValueAtTime(0.12, sharedAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, sharedAudioCtx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start();
    osc.stop(sharedAudioCtx.currentTime + 0.22);
  } catch (e) {
    // AudioContext hiba vagy blokkolás némán lekezelve
  }
}

/**
 * Közvetlen hang lejátszó függvény (Web Speech API)
 * - Mindig meghívja a cancel()-t a beragadt hangsorok feloldására
 * - Normál: rate = 0.65 (kényelmes, jól artikulált tempó)
 * - Lassú (Csiga): rate = 0.4 (nagyon kimért, fonetikusan követhető tempó)
 */
export function playAudio(textToSpeak, rate = 0.65) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !textToSpeak) return;
  try {
    window.speechSynthesis.cancel(); // Előző hang törlése azonnal!
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    const cleanText = String(textToSpeak).trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = Number(rate) || 0.65;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const enVoice = voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en'));
      if (enVoice) {
        utterance.voice = enVoice;
      }
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("TTS hiba:", e);
  }
}

/**
 * Angol szó kiejtése beállításokkal (Normál: 0.65x / Lassú: 0.4x)
 */
export function speakEnglishWord(text, options = {}) {
  let rate = 0.65;
  if (typeof options === 'number') {
    rate = options;
  } else if (options && typeof options.rate === 'number') {
    rate = options.rate;
  } else if (options && options.slow) {
    rate = 0.4;
  }
  playAudio(text, rate);
}

/**
 * Példamondat felolvasása úgy, hogy a kitalálandó szó helyén sípolás / szünet / "blank" hallatszik
 * Szigorú válaszvédelem írásos és betűkirakós feladatokhoz!
 */
export function speakSentenceWithBlank(sentence, options = {}, targetWord = '') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !sentence) return;
  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    playBlankBeep();

    let rate = 0.65;
    if (typeof options === 'number') {
      rate = options;
    } else if (options && typeof options.rate === 'number') {
      rate = options.rate;
    } else if (options && options.slow) {
      rate = 0.4;
    }

    // A hiányzó rész és a cél szó helyére tiszta 'blank' szót teszünk a mondatban
    let safeText = String(sentence).replace(/<[^>]*>/g, '');
    if (targetWord) {
      try {
        const escaped = String(targetWord).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        safeText = safeText.replace(new RegExp(escaped, 'gi'), 'blank');
      } catch (e) {}
    }
    safeText = safeText
      .replace(/_{2,}/g, ' blank ')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(safeText);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const enVoice = voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en'));
      if (enVoice) {
        utterance.voice = enVoice;
      }
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("TTS sentence hiba:", e);
  }
}

/**
 * Ellenőrzi, hogy a feladat olyan feladat-e, ahol a szó kiejtése elárulná a megoldást.
 * Spoileres: WORD_SCRAMBLE, FILL_BLANK (bármely mód), gépelés, fordított mód, és ha a kérdés nem maga a szó.
 */
export function isAudioSpoilerExercise(exercise, options = {}) {
  if (!exercise) return false;
  if (exercise.type === 'LISTENING') return false;

  // 1. Betűkeverő (Word Scramble): a betűkből kell kirakni az angol szót
  if (exercise.type === 'WORD_SCRAMBLE') return true;

  // 2. Mondatkiegészítés (akár gépelős, akár opciós! Mert a cél a hiányzó szó megtalálása)
  if (exercise.type === 'FILL_BLANK') return true;

  // 3. Írásbeli visszahívás vagy gépelős feladat
  if (exercise.subMode === 'typing' || exercise.type === 'WRITTEN_RECALL') return true;

  // 4. Fordított mód (magyarról angolra) vagy a válasz célnyelve angol
  const isReverse = Boolean(options && (options.reverse || exercise.targetLanguage === 'en'));
  if (isReverse) return true;

  // 5. Ha a fejlécben nem maga az angol szó szerepel
  if (exercise.promptLanguage === 'hu' || (exercise.prompt && exercise.targetWord && exercise.prompt !== exercise.targetWord.english)) {
    return true;
  }

  return false;
}

/**
 * Gyakorlási munkamenet osztály (PracticeSession)
 */
export class PracticeSession {
  constructor(list, options = {}) {
    this.list = list;
    this.options = {
      reverse: options.reverse || false,
      autoAdvanceMs: options.autoAdvanceMs || 1000,
      soundEnabled: options.soundEnabled !== false,
      sheetId: options.sheetId || null,
      isMix: options.isMix || false,
      customWords: options.customWords || null,
      exerciseType: options.exerciseType || 'AUTO_MIX',
      ...options
    };

    this.sheet = null;

    if (this.options.customWords && Array.isArray(this.options.customWords)) {
      this.words = [...this.options.customWords];
      this.modeTitle = "Mix Gyakorló (Kiválasztott egységek)";
    } else if (this.options.sheetId && list && list.sheets) {
      this.sheet = list.sheets.find(s => s.id === this.options.sheetId) || null;
      if (this.sheet) {
        this.words = [...(this.sheet.words || [])];
        this.modeTitle = `${list.name} • ${this.sheet.name}`;
      } else {
        this.words = [...(list.words || [])];
        this.modeTitle = list.name;
      }
    } else if (this.options.isMix && list && list.sheets) {
      const unlockedSheets = list.sheets.filter(s => s.isUnlocked);
      const pool = unlockedSheets.length > 0 ? unlockedSheets : list.sheets;
      const collected = [];
      pool.forEach(s => {
        if (s.words) collected.push(...s.words);
      });
      this.words = collected.length > 0 ? collected : [...(list.words || [])];
      this.modeTitle = "Mix Gyakorlás (Feloldott egységek)";
    } else {
      this.words = [...(list ? (list.words || []) : [])];
      this.modeTitle = list ? list.name : "Gyakorlás";
    }

    this.roundWords = generatePrioritizedRoundWords(this.words);
    this.roundTotal = this.roundWords.length;
    this.currentIndex = 0;

    this.currentWord = null;
    this.currentExercise = null;
    this.previousWord = null;
    this.state = 'WAITING_INPUT';
    this.lastUserInput = '';

    this.stats = {
      totalAnswered: 0,
      correctCount: 0,
      incorrectCount: 0,
      streak: 0,
      bestStreak: 0
    };
  }

  /**
   * Következő feladat lekérése
   */
  nextQuestion() {
    if (this.currentIndex >= this.roundWords.length) {
      this.currentWord = null;
      this.currentExercise = null;
      return null;
    }

    this.currentWord = this.roundWords[this.currentIndex];
    this.currentIndex++;
    this.previousWord = this.currentWord;
    this.state = 'WAITING_INPUT';
    this.lastUserInput = '';

    // AI feladat generálása
    this.currentExercise = generateNextExercise(
      this.currentWord,
      this.words,
      this.options.exerciseType,
      this.options.reverse
    );

    // Kiejtés lejátszása: KIZÁRÓLAG Listening típusnál fut le automatikusan a kérdés betöltésekor!
    // Semmilyen más feladatnál (írásos/gépelős/scramble/fordított/stb.) NEM futhat auto-speak!
    if (this.options.soundEnabled && this.currentWord && this.currentWord.english) {
      if (this.currentExercise && this.currentExercise.type === 'LISTENING') {
        playAudio(this.currentWord.english, 0.65);
      }
    }

    return {
      word: this.currentWord,
      exercise: this.currentExercise,
      progress: this.getProgress()
    };
  }

  getCurrentExercise() {
    return this.currentExercise;
  }

  getProgress() {
    const current = Math.min(this.currentIndex, this.roundTotal);
    return {
      current,
      total: this.roundTotal,
      percent: this.roundTotal > 0 ? Math.round((current / this.roundTotal) * 100) : 0
    };
  }

  isRoundComplete() {
    return this.stats.totalAnswered >= this.roundTotal && this.roundTotal > 0;
  }

  isPerfectScore() {
    return this.stats.totalAnswered > 0 &&
           this.stats.incorrectCount === 0 &&
           this.stats.correctCount === this.stats.totalAnswered;
  }

  /**
   * Válasz kiértékelése
   */
  async checkAnswer(userAnswer) {
    if (!this.currentWord || this.state !== 'WAITING_INPUT') return null;

    this.lastUserInput = String(userAnswer || '').trim();
    const isReverse = this.options.reverse;
    let isCorrect = false;
    let hasTypo = false;
    let matchedCandidate = null;

    const exercise = this.currentExercise;

    if (exercise && exercise.type === 'MULTIPLE_CHOICE') {
      const targetStr = exercise.correctAnswer;
      const cleanUser = normalizeAnswer(this.lastUserInput);
      const cleanTarget = normalizeAnswer(targetStr);
      isCorrect = (cleanUser === cleanTarget);
      matchedCandidate = targetStr;
    } else if (exercise && exercise.type === 'FILL_BLANK') {
      const targetStr = exercise.correctAnswer;
      const cleanUser = normalizeAnswer(this.lastUserInput);
      const cleanTarget = normalizeAnswer(targetStr);
      isCorrect = (cleanUser === cleanTarget);
      matchedCandidate = targetStr;
    } else if (exercise && exercise.type === 'WORD_SCRAMBLE') {
      const targetStr = exercise.correctAnswer;
      const cleanUser = normalizeAnswer(this.lastUserInput);
      const cleanTarget = normalizeAnswer(targetStr);
      isCorrect = (cleanUser === cleanTarget);
      matchedCandidate = targetStr;
    } else if (exercise && exercise.type === 'TRUE_FALSE') {
      isCorrect = (this.lastUserInput.toLowerCase() === String(exercise.correctAnswer).toLowerCase());
      matchedCandidate = exercise.targetWord.hungarian;
    } else if (exercise && exercise.type === 'CONTEXT_MATCH') {
      isCorrect = (this.lastUserInput === 'all_matched');
      matchedCandidate = exercise.targetWord.english;
    } else if (exercise && exercise.type === 'LISTENING') {
      const targetStr = exercise.correctAnswer;
      const cleanUser = normalizeAnswer(this.lastUserInput);
      const cleanTarget = normalizeAnswer(targetStr);
      isCorrect = (cleanUser === cleanTarget);
      matchedCandidate = targetStr;
    } else {
      const targetString = isReverse ? this.currentWord.english : this.currentWord.hungarian;
      const matchResult = this.isAnswerMatching(this.lastUserInput, targetString);
      isCorrect = matchResult.isCorrect;
      hasTypo = matchResult.hasTypo;
      matchedCandidate = matchResult.matchedCandidate;
    }

    const wasNew = Boolean(this.currentWord.isNew);
    this.stats.totalAnswered++;

    if (isCorrect) {
      this.state = 'CORRECT';
      this.stats.correctCount++;
      this.stats.streak++;
      if (this.stats.streak > this.stats.bestStreak) {
        this.stats.bestStreak = this.stats.streak;
      }
      if (wasNew) {
        this.currentWord.isNew = false;
      }
    } else {
      this.state = 'INCORRECT';
      this.stats.incorrectCount++;
      this.stats.streak = 0;
    }

    try {
      const listId = this.list ? this.list.id : null;
      const sheetId = this.sheet ? this.sheet.id : null;
      if (listId) {
        await recordWordPractice(listId, this.currentWord.id, isCorrect, sheetId);
      }
      if (this.options.isMix) {
        recordMixPractice(isCorrect ? 1 : 0, 1);
      }
    } catch (e) {
      console.warn("Gyakorlás rögzítési figyelmeztetés:", e);
    }

    const targetDisplay = (exercise && exercise.correctAnswer) ? exercise.correctAnswer : (isReverse ? this.currentWord.english : this.currentWord.hungarian);
    const promptDisplay = isReverse ? this.currentWord.hungarian : this.currentWord.english;

    return {
      isCorrect,
      hasTypo,
      learnedNewWord: isCorrect && wasNew,
      matchedCandidate,
      userAnswer: this.lastUserInput,
      correctAnswer: targetDisplay,
      promptWord: promptDisplay,
      exercise: this.currentExercise,
      postReveal: exercise ? exercise.postReveal : null,
      stats: { ...this.stats },
      isRoundFinished: this.isRoundComplete(),
      isPerfect: this.isPerfectScore()
    };
  }

  isAnswerMatching(userAnswer, targetAnswer) {
    const cleanUser = normalizeAnswer(userAnswer);
    if (!cleanUser) return { isCorrect: false, hasTypo: false };

    const candidates = this.extractAnswerCandidates(targetAnswer);

    for (const candidate of candidates) {
      const cleanTarget = normalizeAnswer(candidate);
      if (cleanTarget && cleanUser === cleanTarget) {
        return { isCorrect: true, hasTypo: false, matchedCandidate: candidate };
      }
    }

    for (const candidate of candidates) {
      const cleanTarget = normalizeAnswer(candidate);
      if (cleanTarget && cleanTarget.length >= 5 && Math.abs(cleanUser.length - cleanTarget.length) <= 1) {
        const dist = levenshteinDistance(cleanUser, cleanTarget);
        if (dist <= 1) {
          return { isCorrect: true, hasTypo: true, matchedCandidate: candidate };
        }
      }
    }

    return { isCorrect: false, hasTypo: false };
  }

  extractAnswerCandidates(targetAnswer) {
    if (!targetAnswer) return [];
    const candidates = new Set();
    const raw = String(targetAnswer).trim();
    if (!raw) return [];

    candidates.add(raw);
    const withoutParens = raw.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    if (withoutParens) candidates.add(withoutParens);

    const parts = raw.split(/[,;/]+/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        candidates.add(trimmed);
        const pNoParens = trimmed.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
        if (pNoParens) candidates.add(pNoParens);
      }
    }

    return Array.from(candidates);
  }

  getAccuracyPercentage() {
    if (this.stats.totalAnswered === 0) return 0;
    return Math.round((this.stats.correctCount / this.stats.totalAnswered) * 100);
  }
}
