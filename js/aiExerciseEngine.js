/**
 * WL Wordly - AI Feladat- és Mondatgeneráló Motor
 * Funkciók:
 * 1. Feleletválasztós feladatok (1 helyes + 3 intelligens disztraktor)
 * 2. Mondatkiegészítés (kontextuális példamondatok behelyettesítendő '_____' résszel)
 * 3. Fordítási és Párosítási feladatok (Matching pairs)
 * 4. Írásos felidézés (Begépelés szinonima- és elgépelés-toleranciával)
 * 5. Helyi gyorsítótár (LocalStorage) és robusztus offline természetes nyelvi sablonmotor
 */

const SENTENCE_CACHE_KEY = 'wl_ai_sentence_cache';

// Helyi gyorsítótár betöltése
function getSentenceCache() {
  try {
    const raw = localStorage.getItem(SENTENCE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// Helyi gyorsítótár mentése
function saveSentenceCache(cache) {
  try {
    localStorage.setItem(SENTENCE_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Nem sikerült elmenteni az AI mondat gyorsítótárat:", e);
  }
}

/**
 * Szótár a leggyakoribb angol kifejezésekhez életszerű, kontextuális példamondatokkal
 */
const BUILTIN_SENTENCE_FRAMES = {
  achievement: {
    sentence: "Winning the national championship was her greatest achievement.",
    blankSentence: "Winning the national championship was her greatest _____.",
    hungarian: "A nemzeti bajnokság megnyerése volt a legnagyobb eredménye."
  },
  opportunity: {
    sentence: "Studying abroad provides a great opportunity to explore new cultures.",
    blankSentence: "Studying abroad provides a great _____ to explore new cultures.",
    hungarian: "A külföldi tanulás nagyszerű lehetőséget nyújt új kultúrák megismerésére."
  },
  development: {
    sentence: "Rapid economic development transformed the entire region in a decade.",
    blankSentence: "Rapid economic _____ transformed the entire region in a decade.",
    hungarian: "A gyors gazdasági fejlődés egy évtized alatt átalakította az egész térséget."
  },
  challenge: {
    sentence: "Climbing Mount Everest remains a dangerous challenge for mountaineers.",
    blankSentence: "Climbing Mount Everest remains a dangerous _____ for mountaineers.",
    hungarian: "A Mount Everest megmászása továbbra is veszélyes kihívás a hegymászók számára."
  },
  environment: {
    sentence: "We must reduce pollution to protect the natural environment.",
    blankSentence: "We must reduce pollution to protect the natural _____.",
    hungarian: "Csökkentenünk kell a szennyezést a természeti környezet védelme érdekében."
  },
  experience: {
    sentence: "Years of practical experience helped him make the right career decision.",
    blankSentence: "Years of practical _____ helped him make the right career decision.",
    hungarian: "Évek gyakorlati tapasztalata segített neki a helyes karrierdöntés meghozatalában."
  },
  knowledge: {
    sentence: "Sharing valuable knowledge is the most effective way to empower a team.",
    blankSentence: "Sharing valuable _____ is the most effective way to empower a team.",
    hungarian: "Az értékes tudás megosztása a leghatékonyabb módja a csapat fejlesztésének."
  },
  successful: {
    sentence: "Hard work and consistent dedication lead to a successful outcome.",
    blankSentence: "Hard work and consistent dedication lead to a _____ outcome.",
    hungarian: "A kemény munka és a következetes elkötelezettség sikeres eredményhez vezet."
  },
  improve: {
    sentence: "Regular practice will significantly improve your language fluency.",
    blankSentence: "Regular practice will significantly _____ your language fluency.",
    hungarian: "A rendszeres gyakorlás jelentősen fejleszti a nyelvi folyékonyságodat."
  },
  solution: {
    sentence: "The engineering team found an innovative solution to the technical problem.",
    blankSentence: "The engineering team found an innovative _____ to the technical problem.",
    hungarian: "A mérnökcsapat innovatív megoldást talált a technikai problémára."
  }
};

/**
 * Szintaktikai és kontextuális sablonok dinamikus offline mondatgeneráláshoz
 */
const GENERAL_SENTENCE_TEMPLATES = [
  {
    en: (w) => `It is essential to understand the importance of ${w} in daily communication.`,
    cloze: () => `It is essential to understand the importance of _____ in daily communication.`,
    hu: (h) => `Elengedhetetlen megérteni a(z) "${h}" fontosságát a napi kommunikációban.`
  },
  {
    en: (w) => `The expert explained how ${w} can help achieve better long-term results.`,
    cloze: () => `The expert explained how _____ can help achieve better long-term results.`,
    hu: (h) => `A szakértő elmagyarázta, hogyan segíthet a(z) "${h}" a jobb hosszú távú eredmények elérésében.`
  },
  {
    en: (w) => `Everyone agreed that ${w} was a critical factor during the final evaluation.`,
    cloze: () => `Everyone agreed that _____ was a critical factor during the final evaluation.`,
    hu: (h) => `Mindenki egyetértett abban, hogy a(z) "${h}" döntő tényező volt a végső értékelés során.`
  },
  {
    en: (w) => `Learning more about ${w} opened up entirely new perspectives for the students.`,
    cloze: () => `Learning more about _____ opened up entirely new perspectives for the students.`,
    hu: (h) => `A(z) "${h}" alaposabb megismerése teljesen új távlatokat nyitott meg a diákok előtt.`
  },
  {
    en: (w) => `You need to focus on ${w} if you want to make genuine progress in this field.`,
    cloze: () => `You need to focus on _____ if you want to make genuine progress in this field.`,
    hu: (h) => `A(z) "${h}" fogalmára kell összpontosítanod, ha valódi előrelépést szeretnél elérni ezen a területen.`
  }
];

/**
 * Kontextuális példamondat lekérése vagy dinamikus előállítása egy szóhoz
 */
export function getContextualSentence(wordObj) {
  if (!wordObj || !wordObj.english) {
    return {
      sentence: "Practice every day to master vocabulary.",
      blankSentence: "Practice every day to master _____.",
      hungarian: "Gyakorolj minden nap a szókincs elsajátításához."
    };
  }

  const enKey = wordObj.english.toLowerCase().trim();
  const huMeaning = wordObj.hungarian ? wordObj.hungarian.trim() : '';

  // 1. Gyorsítótár ellenőrzése
  const cache = getSentenceCache();
  if (cache[enKey]) {
    return cache[enKey];
  }

  // 2. Beépített minőségi példamondatok
  if (BUILTIN_SENTENCE_FRAMES[enKey]) {
    const entry = BUILTIN_SENTENCE_FRAMES[enKey];
    cache[enKey] = entry;
    saveSentenceCache(cache);
    return entry;
  }

  // 3. Determinisztikus sablonválasztás (a szó hossza és karakterkódjai alapján stabil)
  const charSum = enKey.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const templateIndex = charSum % GENERAL_SENTENCE_TEMPLATES.length;
  const template = GENERAL_SENTENCE_TEMPLATES[templateIndex];

  const generated = {
    sentence: template.en(wordObj.english),
    blankSentence: template.cloze(),
    hungarian: template.hu(huMeaning || wordObj.english)
  };

  cache[enKey] = generated;
  saveSentenceCache(cache);
  return generated;
}

/**
 * 1. Feleletválasztós kérdés generálása (Multiple Choice)
 * 1 helyes válasz + 3 disztraktor (értelmes alternatíva)
 */
export function generateMultipleChoiceQuestion(targetWord, wordPool, reverse = false) {
  const promptKey = reverse ? 'hungarian' : 'english';
  const targetKey = reverse ? 'english' : 'hungarian';

  const promptText = targetWord[promptKey];
  const correctOption = targetWord[targetKey];

  // Disztraktorok gyűjtése a szócsomagból
  const otherWords = wordPool.filter(w => w.id !== targetWord.id && w[targetKey] !== correctOption);
  
  // Véletlenszerű keverés
  const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());
  const selectedDistractors = shuffledOthers.slice(0, 3).map(w => w[targetKey]);

  // Ha nem lenne elég disztraktor a csomagban, alapértelmezett kiegészítők
  const fallbackDistractors = [
    "kihívás, feladat",
    "lehetőség, alkalom",
    "fejlődés, gyarapodás",
    "eredmény, siker",
    "környezet, közeg"
  ];
  while (selectedDistractors.length < 3) {
    const fallback = fallbackDistractors[selectedDistractors.length % fallbackDistractors.length];
    if (fallback !== correctOption && !selectedDistractors.includes(fallback)) {
      selectedDistractors.push(fallback);
    } else {
      selectedDistractors.push(`Egyéb jelentés ${selectedDistractors.length + 1}`);
    }
  }

  // 4 opció összeállítása és megkeverése
  const options = [
    { text: correctOption, isCorrect: true },
    ...selectedDistractors.map(d => ({ text: d, isCorrect: false }))
  ].sort(() => 0.5 - Math.random());

  return {
    type: 'MULTIPLE_CHOICE',
    targetWord: targetWord,
    prompt: promptText,
    promptLanguage: reverse ? 'hu' : 'en',
    targetLanguage: reverse ? 'en' : 'hu',
    options: options,
    correctAnswer: correctOption
  };
}

/**
 * 2. Mondatkiegészítés (Sentence Cloze) feladat generálása
 */
export function generateClozeQuestion(targetWord, wordPool) {
  const context = getContextualSentence(targetWord);
  
  // 4 választható szó opció (angol szavakból)
  const otherWords = wordPool.filter(w => w.id !== targetWord.id && w.english.toLowerCase() !== targetWord.english.toLowerCase());
  const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());
  const distractors = shuffledOthers.slice(0, 3).map(w => w.english);

  const fallbackWords = ['challenge', 'experience', 'knowledge', 'solution', 'progress'];
  while (distractors.length < 3) {
    const fw = fallbackWords[distractors.length];
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
    type: 'SENTENCE_CLOZE',
    targetWord: targetWord,
    sentenceWithBlank: context.blankSentence,
    fullSentence: context.sentence,
    sentenceTranslation: context.hungarian,
    targetMeaning: targetWord.hungarian,
    options: options,
    correctAnswer: targetWord.english
  };
}

/**
 * 3. Fordítási és Párosítási feladat generálása (Matching Pairs)
 * 4 angol és 4 magyar kifejezés összekötése
 */
export function generateMatchingQuestion(words, count = 4) {
  const sampleSize = Math.min(count, words.length);
  const sampleWords = [...words].sort(() => 0.5 - Math.random()).slice(0, sampleSize);

  const leftItems = sampleWords.map(w => ({
    id: w.id,
    text: w.english,
    pairId: w.id
  })).sort(() => 0.5 - Math.random());

  const rightItems = sampleWords.map(w => ({
    id: `hu_${w.id}`,
    text: w.hungarian,
    pairId: w.id
  })).sort(() => 0.5 - Math.random());

  return {
    type: 'MATCHING',
    pairsCount: sampleSize,
    words: sampleWords,
    leftItems: leftItems,
    rightItems: rightItems
  };
}

/**
 * 4. Írásos felidézés (Written Recall / Begépelés) feladat
 */
export function generateWrittenQuestion(targetWord, reverse = false) {
  const promptKey = reverse ? 'hungarian' : 'english';
  const targetKey = reverse ? 'english' : 'hungarian';

  const context = getContextualSentence(targetWord);

  return {
    type: 'WRITTEN_RECALL',
    targetWord: targetWord,
    prompt: targetWord[promptKey],
    promptLanguage: reverse ? 'hu' : 'en',
    targetLanguage: reverse ? 'en' : 'hu',
    exampleSentence: context.sentence,
    correctAnswer: targetWord[targetKey]
  };
}

/**
 * Univerzális vegyes feladat készítő egy szóhoz
 */
export function generateNextExercise(targetWord, wordPool, preferredType = 'AUTO_MIX', reverse = false) {
  if (preferredType === 'MULTIPLE_CHOICE') {
    return generateMultipleChoiceQuestion(targetWord, wordPool, reverse);
  }
  if (preferredType === 'SENTENCE_CLOZE') {
    return generateClozeQuestion(targetWord, wordPool);
  }
  if (preferredType === 'WRITTEN_RECALL') {
    return generateWrittenQuestion(targetWord, reverse);
  }

  // AUTO_MIX: Intelligens forgatás a feladattípusok között
  const r = Math.random();
  if (r < 0.45) {
    return generateMultipleChoiceQuestion(targetWord, wordPool, reverse);
  } else if (r < 0.75) {
    return generateClozeQuestion(targetWord, wordPool);
  } else {
    return generateWrittenQuestion(targetWord, reverse);
  }
}
