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

/**
 * Angol kiejtés felolvasása böngésző TTS-sel (Web Speech API)
 */
export function speakEnglishWord(text) {
  if (!window.speechSynthesis || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text).trim());
    utterance.lang = 'en-US';
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => (v.lang.includes('en-US') || v.lang.includes('en-GB')) && !v.name.includes('Google'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.debug("TTS hiba:", e);
  }
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

    // Kiejtés lejátszása: ha Listening típus, vagy ha hang engedélyezve van és nem hallás utáni típus
    if (this.options.soundEnabled && this.currentWord.english) {
      if (this.currentExercise.type === 'LISTENING') {
        speakEnglishWord(this.currentWord.english);
      } else if (!this.options.reverse && this.currentExercise.type !== 'WORD_SCRAMBLE') {
        speakEnglishWord(this.currentWord.english);
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
