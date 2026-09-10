/**
 * WL (Word Learning) - Kikérdező és Gyakorló Motor
 */

import { recordWordPractice } from './storage.js';

export class PracticeSession {
  constructor(list, options = {}) {
    this.list = list;
    this.words = [...(list.words || [])];
    this.options = {
      reverse: options.reverse || false, // false: EN -> HU, true: HU -> EN
      autoAdvanceMs: options.autoAdvanceMs || 800,
      soundEnabled: options.soundEnabled !== false,
      ...options
    };

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
   * Új véletlenszerű szó kiválasztása
   */
  nextWord() {
    if (this.words.length === 0) {
      this.currentWord = null;
      return null;
    }

    if (this.words.length === 1) {
      this.currentWord = this.words[0];
      this.state = 'WAITING_INPUT';
      this.lastUserInput = '';
      return this.currentWord;
    }

    // Olyan szót választunk véletlenszerűen, ami nem azonos az előzővel
    let availableWords = this.words.filter(w => !this.previousWord || w.id !== this.previousWord.id);
    if (availableWords.length === 0) availableWords = this.words;

    // Súlyozás: a még nem vagy ritkábban gyakorolt szavak előnyben részesítése
    const randomIndex = Math.floor(Math.random() * availableWords.length);
    this.currentWord = availableWords[randomIndex];
    this.previousWord = this.currentWord;
    this.state = 'WAITING_INPUT';
    this.lastUserInput = '';

    return this.currentWord;
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

    // Eredmény mentése az adatbázisba / tárolóba
    try {
      await recordWordPractice(this.list.id, this.currentWord.id, isCorrect);
    } catch (e) {
      console.warn("Nem sikerült elmenteni a gyakorlási statisztikát:", e);
    }

    return {
      isCorrect,
      userAnswer: this.lastUserInput,
      correctAnswer: targetString,
      promptWord: isReverse ? this.currentWord.hungarian : this.currentWord.english,
      stats: { ...this.stats }
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
