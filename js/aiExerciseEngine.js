/**
 * WL Wordly - AI Feladat- és Mondatgeneráló Motor (A2-B1 Szint & 6 Interaktív Feladattípus)
 * 
 * 1. MULTIPLE_CHOICE (Feleletválasztós 4 opcióval)
 * 2. FILL_BLANK (Interaktív mondatkiegészítés szókártyákkal vagy kezdőbetűs gépeléssel)
 * 3. WORD_SCRAMBLE (Betűkeverő kattintható betűbuborékokkal)
 * 4. TRUE_FALSE (Gyors Villám-döntő Igaz/Hamis reflexkártya)
 * 5. CONTEXT_MATCH (Kontextus- és szituáció-párosító)
 * 6. LISTENING (Hallás utáni felidézés Web Speech API-val, rejtett szöveggel)
 * 
 * Szigorú válaszvédelem: a feladat leadása előtt SEMMI nem árulja el a helyes megoldást!
 */

const SENTENCE_CACHE_KEY = 'wl_ai_sentence_cache';

function getSentenceCache() {
  try {
    const raw = localStorage.getItem(SENTENCE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveSentenceCache(cache) {
  try {
    localStorage.setItem(SENTENCE_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Nem sikerült elmenteni az AI mondat gyorsítótárat:", e);
  }
}

/**
 * Egyszerű, természetes A2–B1 szintű hétköznapi példamondattár a leggyakoribb szavakhoz
 */
const BUILTIN_A2_SENTENCES = {
  achievement: {
    sentence: "Passing the exam was a big achievement for her.",
    blankSentence: "Passing the exam was a big _____ for her.",
    hungarian: "A vizsga letétele nagy eredmény volt számára.",
    situation: "Finishing a difficult task with success."
  },
  opportunity: {
    sentence: "This new job is a great opportunity for me.",
    blankSentence: "This new job is a great _____ for me.",
    hungarian: "Ez az új munka nagyszerű lehetőség számomra.",
    situation: "A good chance to do something useful or exciting."
  },
  development: {
    sentence: "Good sleep helps the healthy development of kids.",
    blankSentence: "Good sleep helps the healthy _____ of kids.",
    hungarian: "A jó alvás segíti a gyerekek egészséges fejlődését.",
    situation: "The process of growing and getting better over time."
  },
  challenge: {
    sentence: "Learning a new language is an exciting challenge.",
    blankSentence: "Learning a new language is an exciting _____.",
    hungarian: "Egy új nyelv tanulása izgalmas kihívás.",
    situation: "A difficult task that tests your skill and effort."
  },
  environment: {
    sentence: "We should keep our home and city environment clean.",
    blankSentence: "We should keep our home and city _____ clean.",
    hungarian: "Tisztán kell tartanunk az otthoni és városi környezetünket.",
    situation: "The air, nature, and places around us every day."
  },
  experience: {
    sentence: "She has three years of experience in cooking.",
    blankSentence: "She has three years of _____ in cooking.",
    hungarian: "Három év tapasztalata van a főzésben.",
    situation: "Skill and knowledge gained from doing something."
  },
  knowledge: {
    sentence: "Reading good books gives you useful knowledge.",
    blankSentence: "Reading good books gives you useful _____.",
    hungarian: "A jó könyvek olvasása hasznos tudást ad.",
    situation: "Information and facts you learn and remember."
  },
  successful: {
    sentence: "He worked hard every day and became successful.",
    blankSentence: "He worked hard every day and became _____.",
    hungarian: "Minden nap keményen dolgozott és sikeres lett.",
    situation: "Reaching your goals and getting good results."
  },
  improve: {
    sentence: "I want to improve my English speaking skills.",
    blankSentence: "I want to _____ my English speaking skills.",
    hungarian: "Szeretném fejleszteni az angol beszédkészségemet.",
    situation: "Making something better than it was before."
  },
  solution: {
    sentence: "We found a simple solution to the problem.",
    blankSentence: "We found a simple _____ to the problem.",
    hungarian: "Egyszerű megoldást találtunk a problémára.",
    situation: "An answer or way to fix a difficult problem."
  }
};

/**
 * Dinamikus A2–B1 szintű sablonok bármilyen feltöltött Excel/Google Sheet szóhoz
 */
const SIMPLE_TEMPLATES = [
  {
    en: (w) => `Today I want to learn more about ${w}.`,
    cloze: () => `Today I want to learn more about _____.`,
    hu: (h) => `Ma többet szeretnék megtudni erről: ${h}.`,
    situation: (w) => `Studying and understanding the meaning of ${w}.`
  },
  {
    en: (w) => `She told me that ${w} is very important here.`,
    cloze: () => `She told me that _____ is very important here.`,
    hu: (h) => `Azt mondta nekem, hogy ez nagyon fontos itt: ${h}.`,
    situation: (w) => `Talking about why ${w} matters in everyday life.`
  },
  {
    en: (w) => `Can you show me a clear example of ${w}?`,
    cloze: () => `Can you show me a clear example of _____?`,
    hu: (h) => `Tudsz mutatni egy világos példát erre: ${h}?`,
    situation: (w) => `Asking someone to explain or demonstrate ${w}.`
  },
  {
    en: (w) => `We need to find a better ${w} for our team.`,
    cloze: () => `We need to find a better _____ for our team.`,
    hu: (h) => `Jobb dolgot kell találnunk a csapatunknak: ${h}.`,
    situation: (w) => `Searching for a positive way forward with ${w}.`
  },
  {
    en: (w) => `My friend always talks about ${w} at work.`,
    cloze: () => `My friend always talks about _____ at work.`,
    hu: (h) => `A barátom mindig erről beszél a munkában: ${h}.`,
    situation: (w) => `Discussing ${w} with colleagues during the day.`
  }
];

/**
 * Rövid, egyszerű kontextus mondat előállítása
 */
export function getContextualSentence(wordObj) {
  if (!wordObj || !wordObj.english) {
    return {
      sentence: "Practice every day to learn new words.",
      blankSentence: "Practice every day to learn new _____.",
      hungarian: "Gyakorolj minden nap új szavak tanulásához.",
      situation: "Daily vocabulary practice."
    };
  }

  const enKey = wordObj.english.toLowerCase().trim();
  const huMeaning = wordObj.hungarian ? wordObj.hungarian.trim() : '';

  const cache = getSentenceCache();
  if (cache[enKey]) {
    return cache[enKey];
  }

  if (BUILTIN_A2_SENTENCES[enKey]) {
    const entry = BUILTIN_A2_SENTENCES[enKey];
    cache[enKey] = entry;
    saveSentenceCache(cache);
    return entry;
  }

  const charSum = enKey.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const template = SIMPLE_TEMPLATES[charSum % SIMPLE_TEMPLATES.length];

  const generated = {
    sentence: template.en(wordObj.english),
    blankSentence: template.cloze(),
    hungarian: template.hu(huMeaning || wordObj.english),
    situation: template.situation(wordObj.english)
  };

  cache[enKey] = generated;
  saveSentenceCache(cache);
  return generated;
}

/**
 * 1. FELELETVÁLASZTÓS KÉRDÉS (Multiple Choice)
 * Szigorú válaszvédelem: a kérdéshez NEM jelenik meg a magyar fordítás előre!
 */
export function generateMultipleChoiceQuestion(targetWord, wordPool, reverse = false) {
  const promptKey = reverse ? 'hungarian' : 'english';
  const targetKey = reverse ? 'english' : 'hungarian';

  const promptText = targetWord[promptKey];
  const correctOption = targetWord[targetKey];

  const otherWords = wordPool.filter(w => w.id !== targetWord.id && w[targetKey] !== correctOption);
  const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());
  const distractors = shuffledOthers.slice(0, 3).map(w => w[targetKey]);

  const fallbackList = [
    "kihívás, próbatétel",
    "nagyszerű lehetőség",
    "folyamatos fejlődés",
    "gyors megoldás",
    "természeti környezet",
    "gyakorlati tapasztalat"
  ];
  while (distractors.length < 3) {
    const fb = fallbackList[distractors.length % fallbackList.length];
    if (fb !== correctOption && !distractors.includes(fb)) {
      distractors.push(fb);
    } else {
      distractors.push(`Alternatíva ${distractors.length + 1}`);
    }
  }

  const options = [
    { text: correctOption, isCorrect: true },
    ...distractors.map(d => ({ text: d, isCorrect: false }))
  ].sort(() => 0.5 - Math.random());

  const context = getContextualSentence(targetWord);

  return {
    type: 'MULTIPLE_CHOICE',
    targetWord,
    prompt: promptText,
    promptLanguage: reverse ? 'hu' : 'en',
    targetLanguage: reverse ? 'en' : 'hu',
    options,
    correctAnswer: correctOption,
    // Megoldás után megjelenő magyarázat
    postReveal: {
      sentence: context.sentence,
      sentenceTranslation: context.hungarian,
      meaning: targetWord.hungarian
    }
  };
}

/**
 * 2. INTERAKTÍV MONDATKIEGÉSZÍTÉS (Fill-in-the-blank)
 * Rövid A2 mondat '_____' résszel.
 * Opciós vagy gépelős mód első betűs segítséggel.
 */
export function generateFillBlankQuestion(targetWord, wordPool, mode = 'options') {
  const context = getContextualSentence(targetWord);
  const firstLetter = targetWord.english.charAt(0).toUpperCase();

  const otherWords = wordPool.filter(w => w.id !== targetWord.id && w.english.toLowerCase() !== targetWord.english.toLowerCase());
  const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());
  const distractors = shuffledOthers.slice(0, 3).map(w => w.english);

  const fallbackWords = ['challenge', 'opportunity', 'solution', 'experience', 'knowledge'];
  while (distractors.length < 3) {
    const fw = fallbackWords[distractors.length % fallbackWords.length];
    if (fw.toLowerCase() !== targetWord.english.toLowerCase() && !distractors.includes(fw)) {
      distractors.push(fw);
    } else {
      distractors.push(`word_${distractors.length + 1}`);
    }
  }

  const options = [
    { text: targetWord.english, isCorrect: true },
    ...distractors.map(d => ({ text: d, isCorrect: false }))
  ].sort(() => 0.5 - Math.random());

  return {
    type: 'FILL_BLANK',
    subMode: mode, // 'options' vagy 'typing'
    targetWord,
    prompt: targetWord.hungarian, // A hiányzó szó magyar jelentése a feladat címe
    sentenceWithBlank: context.blankSentence,
    fullSentence: context.sentence,
    firstLetterHint: `${firstLetter}${'·'.repeat(Math.max(2, targetWord.english.length - 1))}`,
    options,
    correctAnswer: targetWord.english,
    postReveal: {
      sentence: context.sentence,
      sentenceTranslation: context.hungarian,
      meaning: targetWord.hungarian
    }
  };
}

/**
 * 3. BETŰKEVERŐ (Word Scramble / Anagramma)
 * Összekevert, kattintható betűbuborékok a szó kirakásához.
 */
export function generateScrambleQuestion(targetWord) {
  const context = getContextualSentence(targetWord);
  const rawWord = targetWord.english.trim();
  const letters = rawWord.split('').map((char, index) => ({
    id: `letter_${index}_${char}_${Math.random().toString(36).substring(2, 5)}`,
    char: char,
    originalIndex: index
  }));

  // Betűk összekeverése úgy, hogy ne egyezzen meg az eredetivel
  let scrambled = [...letters].sort(() => 0.5 - Math.random());
  let attempts = 0;
  while (scrambled.map(l => l.char).join('').toLowerCase() === rawWord.toLowerCase() && attempts < 10) {
    scrambled = [...letters].sort(() => 0.5 - Math.random());
    attempts++;
  }

  return {
    type: 'WORD_SCRAMBLE',
    targetWord,
    prompt: targetWord.hungarian, // Magyar jelentés a feladvány
    sentenceWithBlank: context.blankSentence,
    correctAnswer: rawWord,
    letters: scrambled,
    wordLength: rawWord.length,
    postReveal: {
      sentence: context.sentence,
      sentenceTranslation: context.hungarian,
      meaning: targetWord.hungarian
    }
  };
}

/**
 * 4. GYORS VILLÁM-DÖNTŐ (True or False Flashcard)
 * 50% eséllyel helyes, 50% eséllyel téves párosítás.
 */
export function generateTrueFalseQuestion(targetWord, wordPool) {
  const isMatch = Math.random() < 0.5;
  let shownMeaning = targetWord.hungarian;

  if (!isMatch) {
    const others = wordPool.filter(w => w.id !== targetWord.id && w.hungarian !== targetWord.hungarian);
    if (others.length > 0) {
      const randOther = others[Math.floor(Math.random() * others.length)];
      shownMeaning = randOther.hungarian;
    } else {
      shownMeaning = "teljesen más kifejezés";
    }
  }

  const context = getContextualSentence(targetWord);

  return {
    type: 'TRUE_FALSE',
    targetWord,
    wordText: targetWord.english,
    shownMeaning: shownMeaning,
    isTrueMatch: isMatch,
    correctAnswer: isMatch ? 'true' : 'false',
    sentenceWithBlank: context.blankSentence,
    postReveal: {
      actualMeaning: targetWord.hungarian,
      sentence: context.sentence,
      sentenceTranslation: context.hungarian
    }
  };
}

/**
 * 5. KONTEXTUS-PÁROSÍTÓ (Context Matching)
 * 3 rövid miniszituáció és 3 szó összekapcsolása
 */
export function generateContextMatchingQuestion(words, count = 3) {
  const sampleSize = Math.min(count, words.length);
  const sampleWords = [...words].sort(() => 0.5 - Math.random()).slice(0, sampleSize);

  const items = sampleWords.map((w, idx) => {
    const ctx = getContextualSentence(w);
    return {
      wordId: w.id,
      wordText: w.english,
      situationText: ctx.situation || `Context for ${w.english}: ${w.hungarian}`,
      hungarian: w.hungarian
    };
  });

  const situations = items.map(it => ({
    id: `sit_${it.wordId}`,
    text: it.situationText,
    pairId: it.wordId
  })).sort(() => 0.5 - Math.random());

  const wordChips = items.map(it => ({
    id: `chip_${it.wordId}`,
    text: it.wordText,
    pairId: it.wordId
  })).sort(() => 0.5 - Math.random());

  return {
    type: 'CONTEXT_MATCH',
    targetWord: sampleWords[0],
    situations,
    wordChips,
    totalPairs: sampleSize,
    correctAnswer: 'all_matched',
    pairs: items
  };
}

/**
 * 6. HALLÁS UTÁNI FELIDÉZÉS (Listening Speech Recall)
 * A szó nincs kiírva a képernyőn, hang alapján kell kiválasztani a jelentést!
 */
export function generateListeningQuestion(targetWord, wordPool) {
  const otherWords = wordPool.filter(w => w.id !== targetWord.id && w.hungarian !== targetWord.hungarian);
  const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());
  const distractors = shuffledOthers.slice(0, 3).map(w => w.hungarian);

  const fallbackList = ["lehetőség", "kihívás", "eredmény", "környezet", "tapasztalat"];
  while (distractors.length < 3) {
    const fb = fallbackList[distractors.length % fallbackList.length];
    if (fb !== targetWord.hungarian && !distractors.includes(fb)) {
      distractors.push(fb);
    } else {
      distractors.push(`Jelentés ${distractors.length + 1}`);
    }
  }

  const options = [
    { text: targetWord.hungarian, isCorrect: true },
    ...distractors.map(d => ({ text: d, isCorrect: false }))
  ].sort(() => 0.5 - Math.random());

  const context = getContextualSentence(targetWord);

  return {
    type: 'LISTENING',
    targetWord,
    audioWord: targetWord.english,
    options,
    correctAnswer: targetWord.hungarian,
    postReveal: {
      spokenWord: targetWord.english,
      meaning: targetWord.hungarian,
      sentence: context.sentence,
      sentenceTranslation: context.hungarian
    }
  };
}

/**
 * Intelligens feladatkiosztó: dinamikus, élvezetes rotáció a 6 feladattípus között
 */
export function generateNextExercise(targetWord, wordPool, preferredType = 'AUTO_MIX', reverse = false) {
  if (preferredType === 'MULTIPLE_CHOICE') {
    return generateMultipleChoiceQuestion(targetWord, wordPool, reverse);
  }
  if (preferredType === 'FILL_BLANK') {
    return generateFillBlankQuestion(targetWord, wordPool, 'options');
  }
  if (preferredType === 'WORD_SCRAMBLE') {
    return generateScrambleQuestion(targetWord);
  }
  if (preferredType === 'TRUE_FALSE') {
    return generateTrueFalseQuestion(targetWord, wordPool);
  }
  if (preferredType === 'CONTEXT_MATCH' && wordPool.length >= 3) {
    return generateContextMatchingQuestion(wordPool, 3);
  }
  if (preferredType === 'LISTENING') {
    return generateListeningQuestion(targetWord, wordPool);
  }

  // AUTO_MIX: Változatos, élvezetes rotáció
  const r = Math.random();
  if (r < 0.25) {
    // 25%: Feleletválasztós
    return generateMultipleChoiceQuestion(targetWord, wordPool, reverse);
  } else if (r < 0.45) {
    // 20%: Fill-in-the-blank (Mondatkiegészítés)
    const mode = Math.random() < 0.6 ? 'options' : 'typing';
    return generateFillBlankQuestion(targetWord, wordPool, mode);
  } else if (r < 0.65) {
    // 20%: Betűkeverő (Word Scramble)
    return generateScrambleQuestion(targetWord);
  } else if (r < 0.82) {
    // 17%: Gyors Villám-döntő (True/False)
    return generateTrueFalseQuestion(targetWord, wordPool);
  } else {
    // 18%: Hallás utáni (Listening)
    return generateListeningQuestion(targetWord, wordPool);
  }
}
