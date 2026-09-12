/**
 * WL (Word Learning) - Kikérdező és Gyakorló Motor
 */

import { recordWordPractice } from './storage.js';

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

    const isCorrect = this.isAnswerMatching(this.lastUserInput, targetString);

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
      userAnswer: this.lastUserInput,
      correctAnswer: targetString,
      promptWord: isReverse ? this.currentWord.hungarian : this.currentWord.english,
      stats: { ...this.stats },
      isRoundFinished: this.isRoundComplete(),
      isPerfect: this.isPerfectScore()
    };
  }

  /**
   * Intelligens válaszösszehasonlítás
   * Kezeli a kis/nagybetűket, szóközöket, írásjeleket és a több szinonimát (pl. "futni, szaladni" vagy "kutya / eb")
   */
  isAnswerMatching(userAnswer, targetAnswer) {
    const cleanUser = this.normalizeText(userAnswer);
    const cleanTarget = this.normalizeText(targetAnswer);

    if (!cleanUser) return false;
    if (cleanUser === cleanTarget) return true;

    // Szinonimák bontása vessző, pontosvessző vagy perjel mentén
    const synonyms = targetAnswer
      .split(/[,;/]+/)
      .map(s => this.normalizeText(s))
      .filter(Boolean);

    // Ha a felhasználó bármelyik különálló szinonimát pontosan eltalálta
    if (synonyms.some(syn => syn === cleanUser)) {
      return true;
    }

    // Ha zárójelben van kiegészítés pl. "tud (valamit)" -> zárójel nélkül is elfogadjuk
    const withoutParentheses = this.normalizeText(targetAnswer.replace(/\([^)]*\)/g, ''));
    if (withoutParentheses && withoutParentheses === cleanUser) {
      return true;
    }

    // Szinonimák zárójelek nélkül
    if (synonyms.some(syn => {
      const cleanSyn = this.normalizeText(syn.replace(/\([^)]*\)/g, ''));
      return cleanSyn && cleanSyn === cleanUser;
    })) {
      return true;
    }

    return false;
  }

  normalizeText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[.!?]+$/, ''); // levágja a mondatvégi pontot
  }

  getAccuracyPercentage() {
    if (this.stats.totalAnswered === 0) return 0;
    return Math.round((this.stats.correctCount / this.stats.totalAnswered) * 100);
  }
}
