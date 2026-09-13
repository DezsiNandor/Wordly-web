/**
 * WL Wordly - Fő Alkalmazásvezérlő és Tab-Router
 * - Állandó Sötét Mód
 * - 100% Bejelentkezésmentes (Local-First)
 * - 20 szavas egységek (Chunking) & 2x 100% feloldás
 * - AI Feladatgenerálás (Feleletválasztós, Mondatkiegészítés, Begépelés)
 * - Mix Gyakorló (Véletlen vagy egyéni blokk-választó)
 */

import { 
  getUserLists, 
  getListById, 
  saveNewList, 
  saveExistingList,
  updateListName, 
  deleteList, 
  addWordToList, 
  deleteWordFromList, 
  updateWordInList,
  updateSheetProgress,
  getMixStats,
  getOverallStats
} from './storage.js';

import { 
  parseExcelFile, 
  exportListToExcel 
} from './excel.js';

import { 
  PracticeSession, 
  speakEnglishWord 
} from './practice.js';

import { 
  initPWA, 
  showPwaGuideModal, 
  closePwaGuideModal 
} from './pwa.js';

import { 
  fetchGoogleSheetsData, 
  syncGoogleDriveList, 
  extractGoogleFileId 
} from './googleDrive.js';

import {
  generateNextExercise,
  generateMultipleChoiceQuestion,
  generateFillBlankQuestion,
  generateScrambleQuestion,
  generateTrueFalseQuestion,
  generateContextMatchingQuestion,
  generateListeningQuestion
} from './aiExerciseEngine.js';

// Globális állapot
let activeTab = 'packages'; // 'packages' | 'practice' | 'mix' | 'stats'
let currentSession = null;
let activeManageListId = null;
let pendingDeleteTargetId = null;
let pendingExcelData = null;
let autoAdvanceTimer = null;
let isReverseMode = false;
let isSoundOn = true;
let currentPracticeConfig = null;
let nextUnlockedUnitData = null;
let currentScrambleState = null;
let currentContextMatchState = null;

// DOM elemek gyors elérése
const dom = {
  // Nézetek és Konténerek
  viewLanding: document.getElementById('view-landing'),
  viewDashboard: document.getElementById('view-dashboard'),
  
  // Tab Navigáció
  mainTabNav: document.getElementById('main-tab-nav'),
  tabNavPackages: document.getElementById('tab-nav-packages'),
  tabNavPractice: document.getElementById('tab-nav-practice'),
  tabNavMix: document.getElementById('tab-nav-mix'),
  tabNavStats: document.getElementById('tab-nav-stats'),

  tabContentPackages: document.getElementById('tab-content-packages'),
  tabContentPractice: document.getElementById('tab-content-practice'),
  tabContentMix: document.getElementById('tab-content-mix'),
  tabContentStats: document.getElementById('tab-content-stats'),

  // Kezdőlap elemek
  btnLandingStart: document.getElementById('btn-landing-start'),

  // Fejléc elemek
  btnHeaderPwaInstall: document.getElementById('btn-header-pwa-install'),

  // Tananyagok fül
  statTotalLists: document.getElementById('stat-total-lists'),
  statTotalUnits: document.getElementById('stat-total-units'),
  statUnlockedUnits: document.getElementById('stat-unlocked-units'),
  statTotalWords: document.getElementById('stat-total-words'),
  listsGrid: document.getElementById('lists-grid'),
  emptyListsContainer: document.getElementById('empty-lists-container'),
  btnOpenUploadModal: document.getElementById('btn-open-upload-modal'),
  btnOpenGdriveModal: document.getElementById('btn-open-gdrive-modal'),
  btnCreateEmptyList: document.getElementById('btn-create-empty-list'),
  btnEmptyUpload: document.getElementById('btn-empty-upload'),
  btnDownloadSampleExcel: document.getElementById('btn-download-sample-excel'),

  // Gyakorlás fül
  btnExitPractice: document.getElementById('btn-exit-practice'),
  btnToggleDirection: document.getElementById('btn-toggle-direction'),
  directionLabel: document.getElementById('direction-label'),
  btnToggleSound: document.getElementById('btn-toggle-sound'),
  iconSoundOn: document.getElementById('icon-sound-on'),
  iconSoundOff: document.getElementById('icon-sound-off'),
  practiceStreakCounter: document.getElementById('practice-streak-counter'),
  practiceCorrectCount: document.getElementById('practice-correct-count'),
  practiceRoundProgress: document.getElementById('practice-round-progress'),
  quizCard: document.getElementById('quiz-card'),
  practiceCurrentListTitle: document.getElementById('practice-current-list-title'),
  practiceCurrentSheetTitle: document.getElementById('practice-current-sheet-title'),
  practiceTypeBadge: document.getElementById('practice-type-badge'),
  practiceTypeLabel: document.getElementById('practice-type-label'),
  practiceNewWordBadge: document.getElementById('practice-new-word-badge'),
  practicePromptWordWrapper: document.getElementById('practice-prompt-word-wrapper'),
  practicePromptWord: document.getElementById('practice-prompt-word'),
  practicePromptHint: document.getElementById('practice-prompt-hint'),
  btnSpeakWord: document.getElementById('btn-speak-word'),
  practiceContextSentenceBox: document.getElementById('practice-context-sentence-box'),
  practiceContextEn: document.getElementById('practice-context-en'),

  // Konténerek
  containerMultipleChoice: document.getElementById('container-multiple-choice'),

  containerFillBlank: document.getElementById('container-fill-blank'),
  fillBlankOptions: document.getElementById('fill-blank-options'),
  fillBlankTyping: document.getElementById('fill-blank-typing'),
  fillBlankHint: document.getElementById('fill-blank-hint'),
  fillBlankInput: document.getElementById('fill-blank-input'),
  btnFillBlankSubmit: document.getElementById('btn-fill-blank-submit'),

  containerScramble: document.getElementById('container-scramble'),
  scrambleSlots: document.getElementById('scramble-slots'),
  scrambleTiles: document.getElementById('scramble-tiles'),
  btnScrambleUndo: document.getElementById('btn-scramble-undo'),
  btnScrambleReset: document.getElementById('btn-scramble-reset'),

  containerTrueFalse: document.getElementById('container-true-false'),
  tfProposedMeaning: document.getElementById('tf-proposed-meaning'),
  btnTfTrue: document.getElementById('btn-tf-true'),
  btnTfFalse: document.getElementById('btn-tf-false'),

  containerContextMatch: document.getElementById('container-context-match'),
  contextMatchSituations: document.getElementById('context-match-situations'),
  contextMatchChips: document.getElementById('context-match-chips'),

  containerListening: document.getElementById('container-listening'),
  btnListeningReplay: document.getElementById('btn-listening-replay'),
  listeningOptions: document.getElementById('listening-options'),

  containerWrittenRecall: document.getElementById('container-written-recall'),
  practiceAnswerInput: document.getElementById('practice-answer-input'),
  btnPracticeSubmit: document.getElementById('btn-practice-submit'),
  practiceBtnText: document.getElementById('practice-btn-text'),
  practiceFeedbackContainer: document.getElementById('practice-feedback-container'),

  // Mix fül
  btnStartQuickMix: document.getElementById('btn-start-quick-mix'),
  btnStartCustomMix: document.getElementById('btn-start-custom-mix'),
  btnMixSelectAll: document.getElementById('btn-mix-select-all'),
  btnMixDeselectAll: document.getElementById('btn-mix-deselect-all'),
  mixUnitsCheckboxContainer: document.getElementById('mix-units-checkbox-container'),
  mixSelectedWordCount: document.getElementById('mix-selected-word-count'),
  mixSelectedUnitCount: document.getElementById('mix-selected-unit-count'),

  // Statisztika fül
  statsMasteredWords: document.getElementById('stats-mastered-words'),
  statsUnlockedRatio: document.getElementById('stats-unlocked-ratio'),
  statsUnlockedCount: document.getElementById('stats-unlocked-count'),
  statsAvgAccuracy: document.getElementById('stats-avg-accuracy'),
  statsTotalAnswers: document.getElementById('stats-total-answers'),
  statsHighestStreak: document.getElementById('stats-highest-streak'),
  statsMixQuestions: document.getElementById('stats-mix-questions'),
  statsMixAccuracy: document.getElementById('stats-mix-accuracy'),
  statsUnitsBreakdown: document.getElementById('stats-units-breakdown'),

  // Modals
  modalPwaGuide: document.getElementById('modal-pwa-guide'),
  modalUploadExcel: document.getElementById('modal-upload-excel'),
  btnCloseUploadModal: document.getElementById('btn-close-upload-modal'),
  excelDropzone: document.getElementById('excel-dropzone'),
  excelFileInput: document.getElementById('excel-file-input'),
  uploadPreviewSection: document.getElementById('upload-preview-section'),
  uploadListName: document.getElementById('upload-list-name'),
  uploadWordCountBadge: document.getElementById('upload-word-count-badge'),
  uploadSheetsCountBadge: document.getElementById('upload-sheets-count-badge'),
  uploadSheetsPreviewTags: document.getElementById('upload-sheets-preview-tags'),
  uploadPreviewTable: document.getElementById('upload-preview-table'),
  btnCancelUpload: document.getElementById('btn-cancel-upload'),
  btnSaveUploadedList: document.getElementById('btn-save-uploaded-list'),

  modalGdriveConnect: document.getElementById('modal-gdrive-connect'),
  btnCloseGdriveModal: document.getElementById('btn-close-gdrive-modal'),
  btnCancelGdrive: document.getElementById('btn-cancel-gdrive'),
  formGdriveConnect: document.getElementById('form-gdrive-connect'),
  gdriveCustomName: document.getElementById('gdrive-custom-name'),
  gdriveLinkInput: document.getElementById('gdrive-link-input'),
  gdriveSheetNames: document.getElementById('gdrive-sheet-names'),
  gdriveModalAlert: document.getElementById('gdrive-modal-alert'),
  gdriveAlertIcon: document.getElementById('gdrive-alert-icon'),
  gdriveAlertMessage: document.getElementById('gdrive-alert-message'),

  modalRoundCompleted: document.getElementById('modal-round-completed'),
  roundCompletedBadgeIcon: document.getElementById('round-completed-badge-icon'),
  roundCompletedTitle: document.getElementById('round-completed-title'),
  roundCompletedSubtitle: document.getElementById('round-completed-subtitle'),
  roundScorePercent: document.getElementById('round-score-percent'),
  roundScoreRatio: document.getElementById('round-score-ratio'),
  roundProgressionBox: document.getElementById('round-progression-box'),
  btnRoundNextLevel: document.getElementById('btn-round-next-level'),
  btnRoundRetry: document.getElementById('btn-round-retry'),
  btnRoundExit: document.getElementById('btn-round-exit'),

  modalManageList: document.getElementById('modal-manage-list'),
  manageModalTitle: document.getElementById('manage-modal-title'),
  btnCloseManageModal: document.getElementById('btn-close-manage-modal'),
  formAddWord: document.getElementById('form-add-word'),
  addWordEnglish: document.getElementById('add-word-english'),
  addWordHungarian: document.getElementById('add-word-hungarian'),
  manageSearchInput: document.getElementById('manage-search-input'),
  manageWordCounter: document.getElementById('manage-word-counter'),
  manageWordsTable: document.getElementById('manage-words-table'),
  btnDoneManageModal: document.getElementById('btn-done-manage-modal'),

  modalDeleteConfirm: document.getElementById('modal-delete-confirm'),
  btnCloseDeleteModal: document.getElementById('btn-close-delete-modal'),
  btnCancelDelete: document.getElementById('btn-cancel-delete'),
  btnConfirmDelete: document.getElementById('btn-confirm-delete'),

  appToast: document.getElementById('app-toast'),
  appToastIcon: document.getElementById('app-toast-icon'),
  appToastMessage: document.getElementById('app-toast-message')
};

/**
 * Toast értesítés megjelenítése
 */
function showToast(message, type = 'info') {
  if (!dom.appToast) return;
  dom.appToastMessage.textContent = message;

  const iconMap = {
    success: '🎉',
    error: '⚠️',
    info: 'ℹ️'
  };
  dom.appToastIcon.textContent = iconMap[type] || 'ℹ️';

  dom.appToast.classList.remove('hidden');
  dom.appToast.classList.add('flex');

  setTimeout(() => {
    dom.appToast.classList.add('hidden');
    dom.appToast.classList.remove('flex');
  }, 3200);
}

/**
 * FÜLEK KÖZÖTTI VÁLTÁS (Tab Switcher)
 */
export function switchTab(tabName) {
  activeTab = tabName;

  // Kezdőlap elrejtése, fül-tartalom megjelenítése
  dom.viewLanding.classList.add('hidden');
  dom.viewDashboard.classList.remove('hidden');

  // Navigációs gombok frissítése
  const tabButtons = [
    { name: 'packages', btn: dom.tabNavPackages, pane: dom.tabContentPackages },
    { name: 'practice', btn: dom.tabNavPractice, pane: dom.tabContentPractice },
    { name: 'mix', btn: dom.tabNavMix, pane: dom.tabContentMix },
    { name: 'stats', btn: dom.tabNavStats, pane: dom.tabContentStats }
  ];

  tabButtons.forEach(t => {
    if (t.name === tabName) {
      t.btn.classList.add('active', 'bg-brand-600', 'text-white', 'shadow-sm');
      t.btn.classList.remove('text-slate-400');
      t.pane.classList.remove('hidden');
    } else {
      t.btn.classList.remove('active', 'bg-brand-600', 'text-white', 'shadow-sm');
      t.btn.classList.add('text-slate-400');
      t.pane.classList.add('hidden');
    }
  });

  // URL hash frissítése
  if (window.location.hash !== `#${tabName}`) {
    window.location.hash = `#${tabName}`;
  }

  // Fül specifikus renderelés meghívása
  if (tabName === 'packages') {
    renderPackagesTab();
  } else if (tabName === 'practice') {
    renderPracticeTab();
  } else if (tabName === 'mix') {
    renderMixTab();
  } else if (tabName === 'stats') {
    renderStatsTab();
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * URL Hash router
 */
function handleRouting() {
  const hash = (window.location.hash || '').replace('#', '').toLowerCase();

  if (!hash || hash === 'landing' || hash === 'home') {
    dom.viewLanding.classList.remove('hidden');
    dom.viewDashboard.classList.add('hidden');
  } else if (['packages', 'dashboard'].includes(hash)) {
    switchTab('packages');
  } else if (['practice', 'learn'].includes(hash)) {
    switchTab('practice');
  } else if (['mix', 'review'].includes(hash)) {
    switchTab('mix');
  } else if (['stats', 'progress'].includes(hash)) {
    switchTab('stats');
  } else {
    switchTab('packages');
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * -----------------------------------------------------------------------------
 * 1. TANANYAGOK FÜL RENDERELÉSE (20 Szavas Egységekkel)
 * -----------------------------------------------------------------------------
 */
async function renderPackagesTab() {
  const lists = await getUserLists();

  let totalUnitsCount = 0;
  let unlockedUnitsCount = 0;
  let totalWordsCount = 0;

  lists.forEach(l => {
    totalWordsCount += (l.words || []).length;
    (l.sheets || []).forEach(s => {
      totalUnitsCount++;
      if (s.isUnlocked) unlockedUnitsCount++;
    });
  });

  if (dom.statTotalLists) dom.statTotalLists.textContent = lists.length;
  if (dom.statTotalUnits) dom.statTotalUnits.textContent = totalUnitsCount;
  if (dom.statUnlockedUnits) dom.statUnlockedUnits.textContent = unlockedUnitsCount;
  if (dom.statTotalWords) dom.statTotalWords.textContent = totalWordsCount;

  if (lists.length === 0) {
    dom.listsGrid.innerHTML = '';
    dom.emptyListsContainer.classList.remove('hidden');
    return;
  }

  dom.emptyListsContainer.classList.add('hidden');
  dom.listsGrid.innerHTML = '';

  lists.forEach(list => {
    const card = document.createElement('div');
    card.className = 'bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-5 shadow-lg';

    const sheets = list.sheets || [];
    const completedUnits = sheets.filter(s => (s.consecutivePerfectScores >= 2) || (s.timesPassed >= 2)).length;

    // Fejléc
    const headerHtml = `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-bold text-white">${escapeHtml(list.name)}</h3>
            ${list.googleDriveUrl ? `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                <i data-lucide="cloud" class="w-3 h-3 text-emerald-400"></i> Google Sheet
              </span>
            ` : ''}
          </div>
          <p class="text-xs text-slate-400 mt-0.5">
            ${(list.words || []).length} szó &bull; ${sheets.length} egység (${completedUnits} mesterelve)
          </p>
        </div>

        <div class="flex items-center gap-2">
          ${list.googleDriveUrl ? `
            <button class="btn-sync-gdrive p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors" data-id="${list.id}" title="Szinkronizálás">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
            </button>
          ` : ''}
          <button class="btn-edit-package p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors" data-id="${list.id}" title="Szavak szerkesztése">
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>
          <button class="btn-delete-package p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors" data-id="${list.id}" title="Törlés">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;

    // 20 szavas egységek rácsa
    let unitsHtml = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">';
    sheets.forEach((unit, idx) => {
      const isMastered = (unit.consecutivePerfectScores >= 2) || (unit.timesPassed >= 2);
      const isUnlocked = unit.isUnlocked;
      const wordCount = (unit.words || []).length;

      let statusBadge = '';
      let cardClass = '';

      if (isMastered) {
        statusBadge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/80 flex items-center gap-1">⭐ 2x 100% Mesterelt</span>';
        cardClass = 'unit-card-mastered';
      } else if (isUnlocked) {
        statusBadge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-950 text-brand-300 border border-brand-800/60 flex items-center gap-1">🔓 Feloldva</span>';
        cardClass = 'unit-card-unlocked';
      } else {
        statusBadge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">🔒 Zárolt</span>';
        cardClass = 'unit-card-locked';
      }

      unitsHtml += `
        <div class="bg-slate-800/60 rounded-2xl p-4 border border-slate-750 flex flex-col justify-between gap-3 ${cardClass}">
          <div>
            <div class="flex items-center justify-between mb-1.5">
              ${statusBadge}
              <span class="text-[11px] text-slate-400 font-medium">${wordCount} szó</span>
            </div>
            <h4 class="font-bold text-white text-sm">${escapeHtml(unit.name)}</h4>
            <div class="text-[11px] text-slate-400 mt-1">
              Teljesítve: <strong class="text-slate-200">${unit.timesPassed || 0}x</strong> hibátlanul
            </div>
          </div>

          <div>
            ${isUnlocked ? `
              <button class="btn-start-unit w-full min-h-[38px] py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]" data-list-id="${list.id}" data-sheet-id="${unit.id}">
                <i data-lucide="play" class="w-3.5 h-3.5"></i>
                <span>Gyakorlás indítása</span>
              </button>
            ` : `
              <button disabled class="w-full min-h-[38px] py-2 px-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-500 font-semibold text-xs cursor-not-allowed flex items-center justify-center gap-1.5" title="Oldd fel az előző egység 2x 100%-os teljesítésével">
                <i data-lucide="lock" class="w-3.5 h-3.5"></i>
                <span>Zárolt egység</span>
              </button>
            `}
          </div>
        </div>
      `;
    });
    unitsHtml += '</div>';

    card.innerHTML = headerHtml + unitsHtml;
    dom.listsGrid.appendChild(card);
  });

  // Eseménykezelők bekötése
  dom.listsGrid.querySelectorAll('.btn-start-unit').forEach(btn => {
    btn.addEventListener('click', () => {
      const listId = btn.dataset.listId;
      const sheetId = btn.dataset.sheetId;
      startUnitPractice(listId, sheetId);
    });
  });

  dom.listsGrid.querySelectorAll('.btn-edit-package').forEach(btn => {
    btn.addEventListener('click', () => {
      openManageWordsModal(btn.dataset.id);
    });
  });

  dom.listsGrid.querySelectorAll('.btn-delete-package').forEach(btn => {
    btn.addEventListener('click', () => {
      openDeleteModal(btn.dataset.id);
    });
  });

  dom.listsGrid.querySelectorAll('.btn-sync-gdrive').forEach(btn => {
    btn.addEventListener('click', async () => {
      const listId = btn.dataset.id;
      showToast("Google Táblázat szinkronizálása...", "info");
      const res = await syncGoogleDriveList(listId);
      if (res.success) {
        showToast(res.message || "Sikeres szinkronizáció!", "success");
        renderPackagesTab();
      } else {
        showToast(res.message || "Hiba történt a szinkronizáláskor.", "error");
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * -----------------------------------------------------------------------------
 * 2. GYAKORLÁS FÜL ÉS AI FELADAT ÉLETCICKLUS
 * -----------------------------------------------------------------------------
 */

/**
 * Gyakorlás indítása adott 20 szavas egységre
 */
async function startUnitPractice(listId, sheetId) {
  const list = await getListById(listId);
  if (!list) return;

  currentPracticeConfig = { listId, sheetId, isMix: false, customWords: null };

  currentSession = new PracticeSession(list, {
    sheetId,
    reverse: isReverseMode,
    soundEnabled: isSoundOn,
    exerciseType: 'AUTO_MIX'
  });

  switchTab('practice');
}

/**
 * Mix Gyakorlás indítása megadott szavakkal
 */
function startMixPracticeSession(words, mixTitle = "Mix Gyakorló") {
  if (!words || words.length === 0) {
    showToast("Nincsenek elérhető szavak a gyakorláshoz!", "error");
    return;
  }

  currentPracticeConfig = { listId: null, sheetId: null, isMix: true, customWords: words };

  currentSession = new PracticeSession(null, {
    customWords: words,
    reverse: isReverseMode,
    soundEnabled: isSoundOn,
    isMix: true,
    exerciseType: 'AUTO_MIX'
  });

  switchTab('practice');
}

/**
 * Gyakorlás fül felületének frissítése a jelenlegi állapot alapján
 */
function renderPracticeTab() {
  if (!currentSession) {
    // Ha még nincs aktív munkamenet, indítsuk az első feloldott egységet
    getUserLists().then(lists => {
      if (lists && lists.length > 0 && lists[0].sheets && lists[0].sheets.length > 0) {
        const firstUnlocked = lists[0].sheets.find(s => s.isUnlocked) || lists[0].sheets[0];
        startUnitPractice(lists[0].id, firstUnlocked.id);
      } else {
        const fallbackWords = [
          { id: 'fb_1', english: 'opportunity', hungarian: 'lehetőség' },
          { id: 'fb_2', english: 'challenge', hungarian: 'kihívás' },
          { id: 'fb_3', english: 'development', hungarian: 'fejlesztés, fejlődés' },
          { id: 'fb_4', english: 'achievement', hungarian: 'teljesítmény' },
          { id: 'fb_5', english: 'environment', hungarian: 'környezet' }
        ];
        startMixPracticeSession(fallbackWords, "Alap Gyakorló");
      }
    }).catch(err => {
      console.warn("Hiba a listák betöltésekor:", err);
      const fallbackWords = [
        { id: 'fb_1', english: 'opportunity', hungarian: 'lehetőség' },
        { id: 'fb_2', english: 'challenge', hungarian: 'kihívás' },
        { id: 'fb_3', english: 'development', hungarian: 'fejlesztés, fejlődés' }
      ];
      startMixPracticeSession(fallbackWords, "Alap Gyakorló");
    });
    return;
  }

  renderCurrentQuestion();
}

/**
 * Minden feladattípus konténerének elrejtése
 */
function hideAllExerciseContainers() {
  const containers = [
    dom.containerMultipleChoice,
    dom.containerFillBlank,
    dom.containerScramble,
    dom.containerTrueFalse,
    dom.containerContextMatch,
    dom.containerListening,
    dom.containerWrittenRecall
  ];
  containers.forEach(c => {
    if (c) c.classList.add('hidden');
  });
}

/**
 * Automatikus vagy manuális továbblépés a következő feladatra
 */
function advanceToNextQuestion() {
  clearTimeout(autoAdvanceTimer);
  if (!currentSession) return;
  if (currentSession.isRoundComplete()) {
    handleRoundCompleted();
  } else {
    currentSession.nextQuestion();
    renderCurrentQuestion();
  }
}

/**
 * 1. MULTIPLE_CHOICE felület renderelése
 */
function renderMultipleChoiceExercise(exercise, word) {
  if (dom.containerMultipleChoice) dom.containerMultipleChoice.classList.remove('hidden');
  if (dom.practicePromptWordWrapper) dom.practicePromptWordWrapper.classList.remove('hidden');

  const safeWord = word || (currentSession && currentSession.currentWord) || { english: 'opportunity', hungarian: 'lehetőség' };
  const promptWordText = exercise.prompt || (isReverseMode ? (safeWord.hungarian || 'Kérdés') : (safeWord.english || 'Question'));
  dom.practicePromptWord.textContent = promptWordText;

  dom.practicePromptHint.textContent = isReverseMode
    ? "Válaszd ki a hiányzó angol szót a mondatba:"
    : "Válaszd ki a helyes magyar jelentést:";

  // Példamondat kiemelt megjelenítése a 4 opció felett, kitalálandó szó helyén világos "______" résszel
  dom.practiceContextSentenceBox.classList.remove('hidden');
  let rawSentence = exercise.sentenceWithBlank;
  if (!rawSentence && exercise.fullSentence) {
    const escapedEn = (safeWord.english || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rawSentence = exercise.fullSentence.replace(new RegExp(`\\b${escapedEn}\\b`, 'gi'), '______');
  }
  if (!rawSentence || (!rawSentence.includes('______') && !rawSentence.includes('_____'))) {
    rawSentence = "We can see a clear ______ in this situation.";
  }

  const blankFormatted = escapeHtml(rawSentence).replace(/_{3,}/g, '<span class="blank-slot">______</span>');
  dom.practiceContextEn.innerHTML = blankFormatted;

  renderMultipleChoiceOptions(exercise.options, exercise.correctAnswer, safeWord);
}

function renderMultipleChoiceOptions(options, correctAnswer, word) {
  if (!dom.containerMultipleChoice) return;
  dom.containerMultipleChoice.innerHTML = '';

  const safeWord = word || (currentSession && currentSession.currentWord) || { english: 'opportunity', hungarian: 'lehetőség' };
  const fallbackTarget = correctAnswer || (isReverseMode ? safeWord.english : safeWord.hungarian);

  // Mindig pontosan 4 opció garantálása
  let safeOptions = Array.isArray(options) && options.length > 0 ? [...options] : [];
  if (safeOptions.length < 4) {
    const defaultPool = isReverseMode
      ? ['opportunity', 'challenge', 'development', 'solution', 'experience', 'environment']
      : ['lehetőség', 'kihívás, próbatétel', 'fejlesztés, fejlődés', 'megoldás', 'tapasztalat', 'környezet'];

    if (!safeOptions.some(o => o.text === fallbackTarget)) {
      safeOptions.unshift({ text: fallbackTarget, isCorrect: true });
    }

    for (const item of defaultPool) {
      if (safeOptions.length >= 4) break;
      if (!safeOptions.some(o => o.text && o.text.toLowerCase() === item.toLowerCase())) {
        safeOptions.push({ text: item, isCorrect: item === fallbackTarget });
      }
    }
    while (safeOptions.length < 4) {
      safeOptions.push({ text: `Opció ${safeOptions.length + 1}`, isCorrect: false });
    }
  }

  // Konzol naplózás a hiba felderítéséhez és transzparenciához
  console.log('[Wordly Practice] Aktuális szó:', safeWord, 'Opciók:', safeOptions);

  safeOptions.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-option-btn p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-brand-500 font-semibold text-xs sm:text-sm text-left transition-all flex items-center justify-between cursor-pointer select-none';
    btn.dataset.index = idx;

    btn.innerHTML = `
      <span class="option-text text-slate-100">${escapeHtml(opt.text || '')}</span>
      <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">${idx + 1}</span>
    `;

    const clickHandler = (e) => {
      if (e) e.preventDefault();
      submitPracticeAnswer(opt.text, btn);
    };

    btn.onclick = clickHandler;
    btn.addEventListener('click', clickHandler);

    dom.containerMultipleChoice.appendChild(btn);
  });
}

/**
 * 2. FILL_BLANK felület renderelése (Opciós vagy gépelős)
 */
function renderFillBlankExercise(exercise, word) {
  if (dom.containerFillBlank) dom.containerFillBlank.classList.remove('hidden');
  if (dom.practicePromptWordWrapper) dom.practicePromptWordWrapper.classList.remove('hidden');

  dom.practicePromptWord.textContent = exercise.prompt || word.hungarian;
  dom.practiceContextSentenceBox.classList.remove('hidden');
  
  const blankFormatted = escapeHtml(exercise.sentenceWithBlank || '').replace('_____', '<span class="blank-slot">_____</span>');
  dom.practiceContextEn.innerHTML = blankFormatted;

  if (exercise.subMode === 'typing') {
    if (dom.fillBlankOptions) dom.fillBlankOptions.classList.add('hidden');
    if (dom.fillBlankTyping) dom.fillBlankTyping.classList.remove('hidden');
    if (dom.fillBlankHint) dom.fillBlankHint.textContent = exercise.firstLetterHint || 'A · · ·';
    if (dom.fillBlankInput) {
      dom.fillBlankInput.value = '';
      dom.fillBlankInput.disabled = false;
      setTimeout(() => dom.fillBlankInput.focus(), 60);
    }
    dom.practicePromptHint.textContent = 'Gépeld be a hiányzó angol szót a mondatba:';
  } else {
    if (dom.fillBlankTyping) dom.fillBlankTyping.classList.add('hidden');
    if (dom.fillBlankOptions) {
      dom.fillBlankOptions.classList.remove('hidden');
      renderFillBlankOptions(exercise.options);
    }
    dom.practicePromptHint.textContent = 'Válaszd ki a hiányzó angol szót a mondatba:';
  }
}

function renderFillBlankOptions(options) {
  if (!dom.fillBlankOptions) return;
  dom.fillBlankOptions.innerHTML = '';

  (options || []).forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-option-btn p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-brand-500 font-semibold text-xs sm:text-sm text-left transition-all flex items-center justify-between cursor-pointer select-none';
    btn.dataset.index = idx;
    btn.innerHTML = `
      <span class="option-text text-slate-100">${escapeHtml(opt.text)}</span>
      <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">${idx + 1}</span>
    `;

    const clickHandler = (e) => {
      if (e) e.preventDefault();
      submitPracticeAnswer(opt.text, btn);
    };

    btn.onclick = clickHandler;
    btn.addEventListener('click', clickHandler);

    dom.fillBlankOptions.appendChild(btn);
  });
}

/**
 * 3. WORD_SCRAMBLE felület renderelése
 */
function renderScrambleExercise(exercise, word) {
  if (dom.containerScramble) dom.containerScramble.classList.remove('hidden');
  if (dom.practicePromptWordWrapper) dom.practicePromptWordWrapper.classList.remove('hidden');

  dom.practicePromptWord.textContent = exercise.prompt || word.hungarian;
  dom.practicePromptHint.textContent = 'Kattints a betűkre vagy gépeld be őket a szó kirakásához:';

  dom.practiceContextSentenceBox.classList.remove('hidden');
  const blankFormatted = escapeHtml(exercise.sentenceWithBlank || '').replace('_____', '<span class="blank-slot">_____</span>');
  dom.practiceContextEn.innerHTML = blankFormatted;

  const rawLetters = exercise.letters || [];
  currentScrambleState = {
    targetWord: exercise.correctAnswer,
    wordLength: exercise.wordLength || exercise.correctAnswer.length,
    tiles: rawLetters.map(l => ({ ...l, used: false })),
    assembled: []
  };

  updateScrambleUI();
}

function updateScrambleUI() {
  if (!currentScrambleState || !dom.scrambleSlots || !dom.scrambleTiles) return;

  // Render üres és betöltött rések (slots)
  dom.scrambleSlots.innerHTML = '';
  for (let i = 0; i < currentScrambleState.wordLength; i++) {
    const slot = document.createElement('div');
    const filledTile = currentScrambleState.assembled[i];
    if (filledTile) {
      slot.className = 'scramble-slot filled';
      slot.textContent = filledTile.char;
      slot.title = 'Kattints a visszavonáshoz';
      slot.addEventListener('click', () => undoSpecificScrambleTile(i));
    } else {
      slot.className = 'scramble-slot';
      slot.textContent = '';
    }
    dom.scrambleSlots.appendChild(slot);
  }

  // Render elérhető betűkockák (tiles)
  dom.scrambleTiles.innerHTML = '';
  currentScrambleState.tiles.forEach(tile => {
    const tileBtn = document.createElement('button');
    tileBtn.className = `scramble-tile ${tile.used ? 'used' : ''}`;
    tileBtn.textContent = tile.char;
    tileBtn.disabled = tile.used;
    tileBtn.addEventListener('click', () => placeScrambleTile(tile));
    dom.scrambleTiles.appendChild(tileBtn);
  });
}

function placeScrambleTile(tile) {
  if (!currentScrambleState || tile.used) return;
  if (currentScrambleState.assembled.length >= currentScrambleState.wordLength) return;

  tile.used = true;
  currentScrambleState.assembled.push(tile);
  updateScrambleUI();

  // Ha minden rés kitöltve, automatikus ellenőrzés
  if (currentScrambleState.assembled.length === currentScrambleState.wordLength) {
    const formed = currentScrambleState.assembled.map(t => t.char).join('');
    submitPracticeAnswer(formed);
  }
}

function undoSpecificScrambleTile(index) {
  if (!currentScrambleState || !currentScrambleState.assembled[index]) return;
  const removed = currentScrambleState.assembled.splice(index, 1)[0];
  if (removed) removed.used = false;
  updateScrambleUI();
}

function undoLastScrambleTile() {
  if (!currentScrambleState || currentScrambleState.assembled.length === 0) return;
  const removed = currentScrambleState.assembled.pop();
  if (removed) removed.used = false;
  updateScrambleUI();
}

function resetScrambleTiles() {
  if (!currentScrambleState) return;
  currentScrambleState.tiles.forEach(t => t.used = false);
  currentScrambleState.assembled = [];
  updateScrambleUI();
}

/**
 * 4. TRUE_FALSE Villám-döntő renderelése
 */
function renderTrueFalseExercise(exercise, word) {
  if (dom.containerTrueFalse) dom.containerTrueFalse.classList.remove('hidden');
  if (dom.practicePromptWordWrapper) dom.practicePromptWordWrapper.classList.remove('hidden');

  dom.practicePromptWord.textContent = exercise.wordText || word.english;
  dom.practicePromptHint.textContent = 'Helyes ez a megadott magyar párosítás?';

  dom.practiceContextSentenceBox.classList.remove('hidden');
  const blankFormatted = escapeHtml(exercise.sentenceWithBlank || '').replace('_____', '<span class="blank-slot">_____</span>');
  dom.practiceContextEn.innerHTML = blankFormatted;

  if (dom.tfProposedMeaning) {
    dom.tfProposedMeaning.textContent = `"${exercise.shownMeaning}"`;
  }

  if (dom.btnTfTrue) {
    dom.btnTfTrue.disabled = false;
    dom.btnTfTrue.className = 'tf-btn py-4 px-5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white flex items-center justify-center gap-2.5 border border-emerald-400/50 shadow-lg shadow-emerald-950/50';
  }
  if (dom.btnTfFalse) {
    dom.btnTfFalse.disabled = false;
    dom.btnTfFalse.className = 'tf-btn py-4 px-5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white flex items-center justify-center gap-2.5 border border-rose-400/50 shadow-lg shadow-rose-950/50';
  }
}

/**
 * 5. CONTEXT_MATCH Szituáció-párosító renderelése
 */
function renderContextMatchExercise(exercise, word) {
  if (dom.containerContextMatch) dom.containerContextMatch.classList.remove('hidden');
  if (dom.practicePromptWordWrapper) dom.practicePromptWordWrapper.classList.remove('hidden');

  dom.practicePromptWord.textContent = 'Szituáció-párosító';
  dom.practicePromptHint.textContent = 'Kattints egy helyzetre, majd a hozzá illő angol kifejezésre:';
  dom.practiceContextSentenceBox.classList.add('hidden'); // Mondatdoboz rejtve

  currentContextMatchState = {
    selectedSituationId: null,
    matchedPairs: new Set(),
    totalPairs: exercise.totalPairs || (exercise.situations ? exercise.situations.length : 3),
    situations: exercise.situations || [],
    wordChips: exercise.wordChips || []
  };

  updateContextMatchUI();
}

function updateContextMatchUI() {
  if (!currentContextMatchState || !dom.contextMatchSituations || !dom.contextMatchChips) return;

  dom.contextMatchSituations.innerHTML = '';
  currentContextMatchState.situations.forEach(sit => {
    const card = document.createElement('div');
    const isMatched = currentContextMatchState.matchedPairs.has(sit.pairId);
    const isSelected = currentContextMatchState.selectedSituationId === sit.id;

    card.className = `ctx-card p-3.5 rounded-2xl border text-xs sm:text-sm font-medium ${
      isMatched
        ? 'matched bg-emerald-950/80 border-emerald-600 text-emerald-200'
        : isSelected
          ? 'selected bg-indigo-950/90 border-indigo-500 text-white shadow-lg'
          : 'bg-slate-800/80 border-slate-700 hover:border-indigo-400 text-slate-200'
    }`;
    card.innerHTML = `
      <div class="flex items-start gap-2.5">
        <span class="text-indigo-400 mt-0.5">${isMatched ? '✓' : '💬'}</span>
        <span class="leading-snug">${escapeHtml(sit.text)}</span>
      </div>
    `;

    if (!isMatched) {
      card.addEventListener('click', () => {
        currentContextMatchState.selectedSituationId = sit.id;
        updateContextMatchUI();
      });
    }

    dom.contextMatchSituations.appendChild(card);
  });

  dom.contextMatchChips.innerHTML = '';
  currentContextMatchState.wordChips.forEach(chip => {
    const btn = document.createElement('button');
    const isMatched = currentContextMatchState.matchedPairs.has(chip.pairId);

    btn.className = `min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
      isMatched
        ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300 opacity-60 pointer-events-none'
        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-brand-500 text-slate-100'
    }`;
    btn.textContent = chip.text;

    if (!isMatched) {
      btn.addEventListener('click', () => {
        if (!currentContextMatchState.selectedSituationId) {
          dom.practicePromptHint.textContent = 'Előbb válassz ki egy helyzetet a fenti listából!';
          return;
        }

        const selectedSit = currentContextMatchState.situations.find(s => s.id === currentContextMatchState.selectedSituationId);
        if (selectedSit && selectedSit.pairId === chip.pairId) {
          currentContextMatchState.matchedPairs.add(chip.pairId);
          currentContextMatchState.selectedSituationId = null;
          updateContextMatchUI();

          if (currentContextMatchState.matchedPairs.size >= currentContextMatchState.totalPairs) {
            submitPracticeAnswer('all_matched');
          }
        } else {
          btn.classList.add('bg-rose-950', 'border-rose-500', 'text-rose-200');
          setTimeout(() => {
            btn.classList.remove('bg-rose-950', 'border-rose-500', 'text-rose-200');
          }, 600);
        }
      });
    }

    dom.contextMatchChips.appendChild(btn);
  });
}

/**
 * 6. LISTENING Hallás utáni megértés renderelése
 */
function renderListeningExercise(exercise, word) {
  if (dom.containerListening) dom.containerListening.classList.remove('hidden');
  if (dom.practicePromptWordWrapper) dom.practicePromptWordWrapper.classList.remove('hidden');

  // Angol szót és mondatot elrejtjük előre! Zéró szivárgás!
  dom.practicePromptWord.textContent = '🎧 Hallgasd meg a szót!';
  dom.practiceContextSentenceBox.classList.add('hidden');
  dom.practicePromptHint.textContent = 'Hallgasd meg a kiejtést, és válaszd ki a magyar jelentést:';

  if (dom.listeningOptions) {
    dom.listeningOptions.innerHTML = '';
    (exercise.options || []).forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mc-option-btn p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-brand-500 font-semibold text-xs sm:text-sm text-left transition-all flex items-center justify-between cursor-pointer select-none';
      btn.dataset.index = idx;
      btn.innerHTML = `
        <span class="option-text text-slate-100">${escapeHtml(opt.text)}</span>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">${idx + 1}</span>
      `;
      const clickHandler = (e) => {
        if (e) e.preventDefault();
        submitPracticeAnswer(opt.text, btn);
      };
      btn.onclick = clickHandler;
      btn.addEventListener('click', clickHandler);
      dom.listeningOptions.appendChild(btn);
    });
  }

  if (isSoundOn && exercise.audioWord) {
    speakEnglishWord(exercise.audioWord);
  }
}

/**
 * 7. WRITTEN_RECALL Írásbeli visszahívás
 */
function renderWrittenRecallExercise(exercise, word) {
  if (dom.containerWrittenRecall) dom.containerWrittenRecall.classList.remove('hidden');
  if (dom.practicePromptWordWrapper) dom.practicePromptWordWrapper.classList.remove('hidden');

  dom.practicePromptWord.textContent = isReverseMode ? word.english : word.hungarian;
  dom.practicePromptHint.textContent = isReverseMode ? 'Írd be az angol megfelelőjét:' : 'Írd be a magyar jelentést:';

  if (dom.practiceAnswerInput) {
    dom.practiceAnswerInput.value = '';
    dom.practiceAnswerInput.disabled = false;
    setTimeout(() => dom.practiceAnswerInput.focus(), 60);
  }
  if (dom.btnPracticeSubmit) dom.btnPracticeSubmit.disabled = false;
}

/**
 * Fő renderelő: az aktuális kérdés és a megfelelő feladatformátum betöltése
 */
function renderCurrentQuestion() {
  if (!currentSession) return;

  // Ha a kör véget ért
  if (currentSession.isRoundComplete()) {
    handleRoundCompleted();
    return;
  }

  // Következő feladat lekérése ha még nincs
  if (!currentSession.currentExercise || currentSession.state !== 'WAITING_INPUT') {
    const qData = currentSession.nextQuestion();
    if (!qData) {
      handleRoundCompleted();
      return;
    }
  }

  const exercise = currentSession.currentExercise;
  const word = currentSession.currentWord;
  const progress = currentSession.getProgress();

  // Fejléc címek és progress
  dom.practiceCurrentListTitle.textContent = currentSession.list ? currentSession.list.name : "Mix Gyakorló";
  dom.practiceCurrentSheetTitle.textContent = currentSession.sheet ? currentSession.sheet.name : "Vegyes";
  dom.practiceRoundProgress.textContent = `${progress.current} / ${progress.total}`;
  dom.practiceStreakCounter.textContent = currentSession.stats.streak;
  dom.practiceCorrectCount.textContent = currentSession.stats.correctCount;

  // Új szó badge
  if (word && word.isNew) {
    dom.practiceNewWordBadge.classList.remove('hidden');
  } else {
    dom.practiceNewWordBadge.classList.add('hidden');
  }

  // Típus badge
  const typeMap = {
    'MULTIPLE_CHOICE': 'Feleletválasztós',
    'FILL_BLANK': 'Mondatkiegészítés',
    'WORD_SCRAMBLE': 'Betűkeverő',
    'TRUE_FALSE': 'Villám-döntő (Igaz/Hamis)',
    'CONTEXT_MATCH': 'Szituáció-párosító',
    'LISTENING': 'Hallás utáni',
    'WRITTEN_RECALL': 'Begépelés'
  };
  dom.practiceTypeLabel.textContent = typeMap[exercise.type] || 'Gyakorlat';

  // Minden konténer elrejtése
  hideAllExerciseContainers();

  // Visszajelzés konténer elrejtése
  dom.practiceFeedbackContainer.classList.add('hidden');
  dom.practiceFeedbackContainer.innerHTML = '';

  // Formátum specifikus felület aktiválása
  switch (exercise.type) {
    case 'MULTIPLE_CHOICE':
      renderMultipleChoiceExercise(exercise, word);
      break;
    case 'FILL_BLANK':
      renderFillBlankExercise(exercise, word);
      break;
    case 'WORD_SCRAMBLE':
      renderScrambleExercise(exercise, word);
      break;
    case 'TRUE_FALSE':
      renderTrueFalseExercise(exercise, word);
      break;
    case 'CONTEXT_MATCH':
      renderContextMatchExercise(exercise, word);
      break;
    case 'LISTENING':
      renderListeningExercise(exercise, word);
      break;
    case 'WRITTEN_RECALL':
    default:
      renderWrittenRecallExercise(exercise, word);
      break;
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Válasz beküldése és kiértékelése (Szigorú zéró szivárgás, post-reveal magyarázat)
 */
async function submitPracticeAnswer(userAnswer, targetBtn = null) {
  if (!currentSession || currentSession.state !== 'WAITING_INPUT') return;

  const result = await currentSession.checkAnswer(userAnswer);
  if (!result) return;

  // Statisztikák azonnali frissítése
  dom.practiceStreakCounter.textContent = result.stats.streak;
  dom.practiceCorrectCount.textContent = result.stats.correctCount;

  // Feleletválasztós / Mondatkiegészítés / Hallás utáni gombok azonnali vizuális visszajelzése
  const allOptionBtns = document.querySelectorAll('.mc-option-btn');
  allOptionBtns.forEach(b => {
    b.disabled = true;
    const textSpan = b.querySelector('.option-text');
    const text = textSpan ? textSpan.textContent.trim() : b.textContent.trim();
    if (text === result.correctAnswer) {
      b.classList.add('correct');
    }
  });

  if (targetBtn) {
    targetBtn.disabled = true;
    if (!result.isCorrect) {
      targetBtn.classList.add('incorrect');
    } else {
      targetBtn.classList.add('correct');
    }
  }

  // True/False gombok visszajelzése
  if (dom.containerTrueFalse && !dom.containerTrueFalse.classList.contains('hidden')) {
    if (dom.btnTfTrue) dom.btnTfTrue.disabled = true;
    if (dom.btnTfFalse) dom.btnTfFalse.disabled = true;
    const exercise = currentSession.currentExercise;
    const correctBtn = (exercise && exercise.correctAnswer === 'true') ? dom.btnTfTrue : dom.btnTfFalse;
    if (correctBtn) correctBtn.classList.add('ring-4', 'ring-emerald-400');
    if (targetBtn && !result.isCorrect) {
      targetBtn.classList.add('ring-4', 'ring-rose-500');
    }
  }

  // Szigorú Post-Reveal visszajelzés (Csak a válasz leadása után jelenik meg a helyes válasz és magyarázat!)
  const post = result.postReveal || {};
  const currentWord = currentSession.currentWord || {};
  dom.practiceFeedbackContainer.classList.remove('hidden');

  if (result.isCorrect) {
    dom.practiceFeedbackContainer.className = 'mt-4 p-4 rounded-2xl text-left text-xs sm:text-sm bg-emerald-950/70 border border-emerald-800/80 text-emerald-200 animate-pop-in shadow-lg';
    dom.practiceFeedbackContainer.innerHTML = `
      <div class="flex items-center justify-between font-bold">
        <span class="flex items-center gap-1.5 text-emerald-300">
          <i data-lucide="check-circle-2" class="w-4 h-4"></i>
          <span>🎉 Helyes válasz! ${result.hasTypo ? '(Apró elütéssel elfogadva)' : ''}</span>
        </span>
        <span class="text-xs text-emerald-400 font-mono font-bold">+1 pont</span>
      </div>
      <div class="text-sm font-bold text-white mt-1.5 flex items-center gap-2">
        <span class="text-slate-100">${escapeHtml(currentWord.english || '')}</span>
        <span class="text-emerald-400 font-medium">➔</span>
        <span class="text-emerald-300">${escapeHtml(currentWord.hungarian || result.correctAnswer)}</span>
      </div>
      ${post.sentence ? `
        <div class="mt-2.5 pt-2.5 border-t border-emerald-850/60 bg-emerald-950/50 p-2.5 rounded-xl">
          <div class="text-sm font-bold text-slate-100">"${escapeHtml(post.sentence)}"</div>
          <div class="text-xs text-emerald-300/90 italic mt-0.5">${escapeHtml(post.sentenceTranslation || '')}</div>
        </div>
      ` : ''}
      <div class="mt-3 flex items-center justify-end">
        <button id="btn-next-question" class="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all active:scale-95">
          <span>Következő</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          <kbd class="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-black/30 rounded">Enter / Space</kbd>
        </button>
      </div>
    `;
  } else {
    dom.practiceFeedbackContainer.className = 'mt-4 p-4 rounded-2xl text-left text-xs sm:text-sm bg-rose-950/70 border border-rose-800/80 text-rose-200 animate-pop-in shadow-lg';
    dom.practiceFeedbackContainer.innerHTML = `
      <div class="flex items-center justify-between font-bold">
        <span class="flex items-center gap-1.5 text-rose-300">
          <i data-lucide="x-circle" class="w-4 h-4"></i>
          <span>❌ Helytelen válasz</span>
        </span>
      </div>
      <div class="text-xs sm:text-sm text-slate-200 mt-1.5">
        A helyes megoldás: <strong class="text-white font-extrabold text-sm sm:text-base bg-rose-900/60 px-2.5 py-0.5 rounded-lg border border-rose-700/60">${escapeHtml(result.correctAnswer)}</strong>
      </div>
      <div class="text-xs text-slate-300 mt-1">
        ${escapeHtml(currentWord.english || '')} = <strong class="text-emerald-300">${escapeHtml(currentWord.hungarian || '')}</strong>
      </div>
      ${post.sentence ? `
        <div class="mt-2.5 pt-2.5 border-t border-rose-850/60 bg-rose-950/50 p-2.5 rounded-xl">
          <div class="text-sm font-bold text-slate-100">"${escapeHtml(post.sentence)}"</div>
          <div class="text-xs text-rose-200/90 italic mt-0.5">${escapeHtml(post.sentenceTranslation || '')}</div>
        </div>
      ` : ''}
      <div class="mt-3 flex items-center justify-end">
        <button id="btn-next-question" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 shadow border border-slate-700 transition-all active:scale-95">
          <span>Tovább</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          <kbd class="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white/20 rounded">Enter / Space</kbd>
        </button>
      </div>
    `;
  }

  if (window.lucide) window.lucide.createIcons();

  const nextBtn = dom.practiceFeedbackContainer.querySelector('#btn-next-question');
  if (nextBtn) {
    nextBtn.addEventListener('click', advanceToNextQuestion);
  }

  // Automatikus továbblépési időzítő (1.0–1.5 másodperc)
  clearTimeout(autoAdvanceTimer);
  const autoDelay = result.isCorrect ? 1200 : 1500;
  autoAdvanceTimer = setTimeout(() => {
    advanceToNextQuestion();
  }, autoDelay);
}

/**
 * Gyakorlási kör befejezése (2x 100% Feloldási Logika)
 */
async function handleRoundCompleted() {
  if (!currentSession) return;

  const stats = currentSession.stats;
  const isPerfect = currentSession.isPerfectScore();
  const accuracy = currentSession.getAccuracyPercentage();

  dom.roundScorePercent.textContent = `${accuracy}%`;
  dom.roundScoreRatio.textContent = `${stats.correctCount} / ${stats.totalAnswered}`;

  // Haladás perzisztálása ha 20 szavas egység volt
  nextUnlockedUnitData = null;
  if (currentSession.sheet && currentSession.list) {
    const progressResult = await updateSheetProgress(
      currentSession.list.id,
      currentSession.sheet.id,
      {
        correctCount: stats.correctCount,
        incorrectCount: stats.incorrectCount,
        isPerfect
      }
    );

    if (progressResult) {
      const timesPassed = progressResult.timesPassed;
      const isUnlockedNext = progressResult.unlockedNextSheet;

      if (isUnlockedNext) {
        // Konfetti és következő szint gomb
        if (window.confetti) {
          window.confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        }
        dom.roundCompletedBadgeIcon.textContent = "🏆";
        dom.roundCompletedTitle.textContent = "Új 20 szavas egység feloldva!";
        dom.roundProgressionBox.innerHTML = `
          <div class="text-emerald-400 font-bold">Gratulálunk! 2x hibátlanul megoldottad ezt az egységet!</div>
          <div class="text-slate-300 mt-0.5">Feloldva: <strong>${escapeHtml(progressResult.nextSheetName || 'Következő egység')}</strong></div>
        `;
        dom.btnRoundNextLevel.classList.remove('hidden');
        nextUnlockedUnitData = {
          listId: currentSession.list.id,
          nextSheetIndex: progressResult.sheetIndex + 1
        };
      } else if (isPerfect) {
        dom.roundCompletedBadgeIcon.textContent = "🎉";
        dom.roundCompletedTitle.textContent = "Hibátlan kör!";
        dom.roundProgressionBox.innerHTML = `
          <div class="text-emerald-400 font-bold">100%-os eredmény! (${timesPassed} / 2 teljesítve)</div>
          <div class="text-slate-400 mt-0.5">Oldd meg még ${Math.max(0, 2 - timesPassed)}x hibátlanul a következő egység megnyitásához.</div>
        `;
        dom.btnRoundNextLevel.classList.add('hidden');
      } else {
        dom.roundCompletedBadgeIcon.textContent = "👏";
        dom.roundCompletedTitle.textContent = "Kör Teljesítve!";
        dom.roundProgressionBox.innerHTML = `
          <div class="text-slate-300">Gyakorolj még a 100%-os hibátlan eredményért és a szintek feloldásáért!</div>
        `;
        dom.btnRoundNextLevel.classList.add('hidden');
      }
    }
  } else {
    // Mix gyakorló volt
    dom.roundCompletedBadgeIcon.textContent = "🔥";
    dom.roundCompletedTitle.textContent = "Mix Gyakorlás Kész!";
    dom.roundProgressionBox.innerHTML = `
      <div class="text-purple-300 font-bold">Remek ismétlés! Folytasd a vegyes gyakorlást a szavak szilárd rögzüléséhez.</div>
    `;
    dom.btnRoundNextLevel.classList.add('hidden');
  }

  // Modal megnyitása
  dom.modalRoundCompleted.classList.remove('hidden');
  dom.modalRoundCompleted.classList.add('flex');
}

/**
 * -----------------------------------------------------------------------------
 * 3. MIX GYAKORLÓ FÜL (Véletlen vagy Pipálható Egység-választó)
 * -----------------------------------------------------------------------------
 */
async function renderMixTab() {
  const lists = await getUserLists();
  dom.mixUnitsCheckboxContainer.innerHTML = '';

  let totalAvailableUnits = 0;

  lists.forEach(list => {
    const unlockedUnits = (list.sheets || []).filter(s => s.isUnlocked);
    if (unlockedUnits.length === 0) return;

    totalAvailableUnits += unlockedUnits.length;

    const listGroup = document.createElement('div');
    listGroup.className = 'p-3 rounded-2xl bg-slate-850 border border-slate-800 space-y-2';

    let unitsCheckboxesHtml = `
      <div class="text-xs font-bold text-slate-300 flex items-center justify-between">
        <span>${escapeHtml(list.name)}</span>
        <span class="text-[10px] text-slate-500">${unlockedUnits.length} feloldott egység</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
    `;

    unlockedUnits.forEach(unit => {
      const isMastered = (unit.consecutivePerfectScores >= 2) || (unit.timesPassed >= 2);
      const wordCount = (unit.words || []).length;

      unitsCheckboxesHtml += `
        <label class="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 cursor-pointer text-xs select-none transition-colors">
          <input type="checkbox" class="mix-unit-checkbox rounded text-brand-600 focus:ring-brand-500 w-4 h-4 bg-slate-700 border-slate-600" data-list-id="${list.id}" data-sheet-id="${unit.id}" data-word-count="${wordCount}">
          <span class="flex-1 text-slate-200 font-medium truncate">${escapeHtml(unit.name)}</span>
          ${isMastered ? '<span class="text-[10px] text-emerald-400">⭐</span>' : ''}
          <span class="text-[10px] text-slate-500">${wordCount} szó</span>
        </label>
      `;
    });

    unitsCheckboxesHtml += '</div>';
    listGroup.innerHTML = unitsCheckboxesHtml;
    dom.mixUnitsCheckboxContainer.appendChild(listGroup);
  });

  if (totalAvailableUnits === 0) {
    dom.mixUnitsCheckboxContainer.innerHTML = `
      <div class="text-center py-8 text-xs text-slate-400">
        Még nincsenek feloldott egységek. Tölts fel egy tananyagot a kezdéshez!
      </div>
    `;
  }

  // Checkboxok eseménykezelője
  const checkboxes = dom.mixUnitsCheckboxContainer.querySelectorAll('.mix-unit-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', updateMixSelectionCounters);
  });

  updateMixSelectionCounters();
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Mix kiválasztási számlálók frissítése
 */
function updateMixSelectionCounters() {
  const checkboxes = dom.mixUnitsCheckboxContainer.querySelectorAll('.mix-unit-checkbox:checked');
  let selectedWords = 0;
  checkboxes.forEach(cb => {
    selectedWords += parseInt(cb.dataset.wordCount || '0', 10);
  });

  dom.mixSelectedWordCount.textContent = selectedWords;
  dom.mixSelectedUnitCount.textContent = checkboxes.length;
  dom.btnStartCustomMix.disabled = (checkboxes.length === 0);
}

/**
 * Gyors Véletlen Mix indítása
 */
async function launchQuickMix() {
  const lists = await getUserLists();
  const allUnlockedWords = [];

  lists.forEach(l => {
    (l.sheets || []).forEach(s => {
      if (s.isUnlocked && s.words) {
        allUnlockedWords.push(...s.words);
      }
    });
  });

  if (allUnlockedWords.length === 0) {
    showToast("Nincs még feloldott egység a mixhez!", "error");
    return;
  }

  // Véletlenszerű 20 szó
  const shuffled = [...allUnlockedWords].sort(() => 0.5 - Math.random());
  const mixSubset = shuffled.slice(0, Math.min(20, shuffled.length));

  startMixPracticeSession(mixSubset, "Gyors Véletlen Mix");
}

/**
 * Egyéni kiválasztott Mix indítása
 */
async function launchCustomMix() {
  const checkboxes = dom.mixUnitsCheckboxContainer.querySelectorAll('.mix-unit-checkbox:checked');
  if (checkboxes.length === 0) {
    showToast("Válassz ki legalább egy egységet a mixhez!", "error");
    return;
  }

  const lists = await getUserLists();
  const selectedWords = [];

  checkboxes.forEach(cb => {
    const listId = cb.dataset.listId;
    const sheetId = cb.dataset.sheetId;
    const targetList = lists.find(l => l.id === listId);
    if (targetList && targetList.sheets) {
      const targetSheet = targetList.sheets.find(s => s.id === sheetId);
      if (targetSheet && targetSheet.words) {
        selectedWords.push(...targetSheet.words);
      }
    }
  });

  if (selectedWords.length === 0) {
    showToast("A kiválasztott egységekben nem találhatók szavak!", "error");
    return;
  }

  startMixPracticeSession(selectedWords, "Egyéni Mix Gyakorlás");
}

/**
 * -----------------------------------------------------------------------------
 * 4. STATISZTIKA FÜL RENDERELÉSE
 * -----------------------------------------------------------------------------
 */
async function renderStatsTab() {
  const stats = await getOverallStats();
  const lists = await getUserLists();

  dom.statsMasteredWords.textContent = stats.masteredWords;
  dom.statsUnlockedRatio.textContent = `${stats.unitCompletionRate}%`;
  dom.statsUnlockedCount.textContent = `${stats.unlockedUnits} / ${stats.totalUnits} egység feloldva`;
  dom.statsAvgAccuracy.textContent = `${stats.accuracyPercent}%`;
  dom.statsTotalAnswers.textContent = `${stats.totalPracticedTimes} gyakorolt válasz`;
  dom.statsHighestStreak.textContent = `🔥 ${stats.highestStreak}`;

  dom.statsMixQuestions.textContent = stats.mixStats.totalQuestionsAnswered;
  const mixAcc = stats.mixStats.totalQuestionsAnswered > 0
    ? Math.round((stats.mixStats.totalCorrect / stats.mixStats.totalQuestionsAnswered) * 100)
    : 0;
  dom.statsMixAccuracy.textContent = `${mixAcc}%`;

  // Részletes egység lebontás
  dom.statsUnitsBreakdown.innerHTML = '';

  lists.forEach(list => {
    const box = document.createElement('div');
    box.className = 'bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-3';

    let tableRows = '';
    (list.sheets || []).forEach(unit => {
      const isMastered = (unit.consecutivePerfectScores >= 2) || (unit.timesPassed >= 2);
      const totalAnswers = (unit.totalCorrect || 0) + (unit.totalIncorrect || 0);
      const unitAcc = totalAnswers > 0 ? Math.round(((unit.totalCorrect || 0) / totalAnswers) * 100) : 0;

      tableRows += `
        <tr class="border-b border-slate-800 text-xs">
          <td class="py-2.5 px-3 font-semibold text-white flex items-center gap-1.5">
            ${isMastered ? '⭐' : (unit.isUnlocked ? '🔓' : '🔒')}
            <span>${escapeHtml(unit.name)}</span>
          </td>
          <td class="py-2.5 px-3 text-slate-400">${(unit.words || []).length} szó</td>
          <td class="py-2.5 px-3 text-emerald-400 font-semibold">${unitAcc}%</td>
          <td class="py-2.5 px-3 text-slate-300 font-medium">${unit.timesPassed || 0} alkalommal 100%</td>
          <td class="py-2.5 px-3 text-right">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isMastered ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80' : (unit.isUnlocked ? 'bg-brand-950 text-brand-300 border border-brand-800/60' : 'bg-slate-800 text-slate-400')}">
              ${isMastered ? 'Mesterelt' : (unit.isUnlocked ? 'Feloldva' : 'Zárolt')}
            </span>
          </td>
        </tr>
      `;
    });

    box.innerHTML = `
      <div class="flex items-center justify-between pb-2 border-b border-slate-800">
        <h4 class="font-bold text-white text-sm">${escapeHtml(list.name)}</h4>
        <span class="text-xs text-slate-400 font-mono">${(list.words || []).length} szó</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-800">
              <th class="py-2 px-3">20 szavas egység</th>
              <th class="py-2 px-3">Szavak</th>
              <th class="py-2 px-3">Pontosság</th>
              <th class="py-2 px-3">100%-os körök</th>
              <th class="py-2 px-3 text-right">Állapot</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;

    dom.statsUnitsBreakdown.appendChild(box);
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * -----------------------------------------------------------------------------
 * 5. SZÓLISTA SZERKESZTŐ MODÁLIS (Szavak megtekintése, hozzáadás, törlés)
 * -----------------------------------------------------------------------------
 */
async function openManageWordsModal(listId) {
  activeManageListId = listId;
  const list = await getListById(listId);
  if (!list) return;

  dom.manageModalTitle.textContent = `${list.name} — Szavak áttekintése`;
  renderManageWordsList(list);

  dom.modalManageList.classList.remove('hidden');
  dom.modalManageList.classList.add('flex');
}

function renderManageWordsList(list) {
  const words = list.words || [];
  const searchFilter = (dom.manageSearchInput.value || '').toLowerCase().trim();

  const filtered = words.filter(w => 
    w.english.toLowerCase().includes(searchFilter) || 
    w.hungarian.toLowerCase().includes(searchFilter)
  );

  dom.manageWordCounter.textContent = `${filtered.length} / ${words.length} szó`;
  dom.manageWordsTable.innerHTML = '';

  if (filtered.length === 0) {
    dom.manageWordsTable.innerHTML = '<div class="text-center py-6 text-xs text-slate-400">Nincs találat.</div>';
    return;
  }

  filtered.forEach(w => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between p-2.5 rounded-xl bg-slate-800 border border-slate-700/80 text-xs';
    item.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="font-bold text-white">${escapeHtml(w.english)}</span>
        <span class="text-slate-400">→</span>
        <span class="text-slate-300">${escapeHtml(w.hungarian)}</span>
      </div>
      <button class="btn-del-word p-1 text-slate-400 hover:text-rose-400 transition-colors" data-id="${w.id}" title="Szó törlése">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    `;

    item.querySelector('.btn-del-word').addEventListener('click', async () => {
      await deleteWordFromList(list.id, w.id);
      const updated = await getListById(list.id);
      renderManageWordsList(updated);
      renderPackagesTab();
    });

    dom.manageWordsTable.appendChild(item);
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * -----------------------------------------------------------------------------
 * 6. MODÁLIS ABLAKOK ÉS ESEMÉNYEK INICIALIZÁLÁSA
 * -----------------------------------------------------------------------------
 */
function initModalsAndEvents() {
  // Kezdőlap "Kezdés" gomb
  if (dom.btnLandingStart) {
    dom.btnLandingStart.addEventListener('click', () => {
      switchTab('packages');
    });
  }

  // Fő Tab Navigáció gombok
  [
    { btn: dom.tabNavPackages, name: 'packages' },
    { btn: dom.tabNavPractice, name: 'practice' },
    { btn: dom.tabNavMix, name: 'mix' },
    { btn: dom.tabNavStats, name: 'stats' }
  ].forEach(t => {
    if (t.btn) {
      t.btn.addEventListener('click', () => switchTab(t.name));
    }
  });

  // Gyakorlás felső gombok
  if (dom.btnExitPractice) {
    dom.btnExitPractice.addEventListener('click', () => switchTab('packages'));
  }

  if (dom.btnToggleDirection) {
    dom.btnToggleDirection.addEventListener('click', () => {
      isReverseMode = !isReverseMode;
      dom.directionLabel.textContent = isReverseMode ? "🇭🇺 Magyar → 🇬🇧 Angol" : "🇬🇧 Angol → 🇭🇺 Magyar";
      if (currentSession) {
        currentSession.options.reverse = isReverseMode;
        currentSession.nextQuestion();
        renderCurrentQuestion();
      }
    });
  }

  if (dom.btnToggleSound) {
    dom.btnToggleSound.addEventListener('click', () => {
      isSoundOn = !isSoundOn;
      if (isSoundOn) {
        dom.iconSoundOn.classList.remove('hidden');
        dom.iconSoundOff.classList.add('hidden');
      } else {
        dom.iconSoundOn.classList.add('hidden');
        dom.iconSoundOff.classList.remove('hidden');
      }
      if (currentSession) {
        currentSession.options.soundEnabled = isSoundOn;
      }
    });
  }

  if (dom.btnSpeakWord) {
    dom.btnSpeakWord.addEventListener('click', () => {
      if (currentSession && currentSession.currentWord) {
        speakEnglishWord(currentSession.currentWord.english);
      }
    });
  }

  // Begépelős feladat beküldése
  if (dom.btnPracticeSubmit) {
    dom.btnPracticeSubmit.addEventListener('click', () => {
      submitPracticeAnswer(dom.practiceAnswerInput.value);
    });
  }

  if (dom.practiceAnswerInput) {
    dom.practiceAnswerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitPracticeAnswer(dom.practiceAnswerInput.value);
      }
    });
  }

  // Fill-in-the-blank gépelés beküldése
  if (dom.btnFillBlankSubmit) {
    dom.btnFillBlankSubmit.addEventListener('click', () => {
      submitPracticeAnswer(dom.fillBlankInput.value);
    });
  }

  if (dom.fillBlankInput) {
    dom.fillBlankInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitPracticeAnswer(dom.fillBlankInput.value);
      }
    });
  }

  // Betűkeverő (Word Scramble) vezérlők
  if (dom.btnScrambleUndo) {
    dom.btnScrambleUndo.addEventListener('click', undoLastScrambleTile);
  }

  if (dom.btnScrambleReset) {
    dom.btnScrambleReset.addEventListener('click', resetScrambleTiles);
  }

  // Villám-döntő (True / False) gombok
  if (dom.btnTfTrue) {
    dom.btnTfTrue.addEventListener('click', () => {
      submitPracticeAnswer('true', dom.btnTfTrue);
    });
  }

  if (dom.btnTfFalse) {
    dom.btnTfFalse.addEventListener('click', () => {
      submitPracticeAnswer('false', dom.btnTfFalse);
    });
  }

  // Hallás utáni (Listening) újrahallgatás gomb
  if (dom.btnListeningReplay) {
    dom.btnListeningReplay.addEventListener('click', () => {
      if (currentSession && currentSession.currentExercise && currentSession.currentExercise.audioWord) {
        speakEnglishWord(currentSession.currentExercise.audioWord);
      } else if (currentSession && currentSession.currentWord) {
        speakEnglishWord(currentSession.currentWord.english);
      }
    });
  }

  // Billentyűzet gyorsgombok és intelligens interakció
  window.addEventListener('keydown', (e) => {
    if (activeTab !== 'practice' || !currentSession) return;

    // Ha az eredmény visszajelzés látható, Enter vagy Szóköz azonnal a következőre lép!
    if (currentSession.state !== 'WAITING_INPUT') {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        advanceToNextQuestion();
      }
      return;
    }

    const exercise = currentSession.currentExercise;
    if (!exercise) return;

    // 1..4 billentyűk: Feleletválasztós / Hallás utáni / Mondatkiegészítés opciós mód
    const activeOptionsContainer = [
      dom.containerMultipleChoice,
      dom.fillBlankOptions,
      dom.listeningOptions
    ].find(c => c && !c.classList.contains('hidden') && c.offsetParent !== null);

    if (activeOptionsContainer) {
      const keyIndex = parseInt(e.key, 10) - 1;
      if (keyIndex >= 0 && keyIndex < 4) {
        const btns = activeOptionsContainer.querySelectorAll('.mc-option-btn');
        if (btns[keyIndex]) {
          e.preventDefault();
          btns[keyIndex].click();
          return;
        }
      }
    }

    // Villám-döntő (True/False): 1/y/i = Igaz, 2/n/h = Hamis
    if (dom.containerTrueFalse && !dom.containerTrueFalse.classList.contains('hidden')) {
      const k = e.key.toLowerCase();
      if (k === '1' || k === 'y' || k === 'i') {
        e.preventDefault();
        if (dom.btnTfTrue) dom.btnTfTrue.click();
        return;
      }
      if (k === '2' || k === 'n' || k === 'h') {
        e.preventDefault();
        if (dom.btnTfFalse) dom.btnTfFalse.click();
        return;
      }
    }

    // Betűkeverő (Word Scramble) billentyű leütés és visszavonás
    if (dom.containerScramble && !dom.containerScramble.classList.contains('hidden') && currentScrambleState) {
      if (e.key === 'Backspace') {
        e.preventDefault();
        undoLastScrambleTile();
        return;
      }
      if (e.key.length === 1 && /[a-zA-Z]/i.test(e.key)) {
        const matchingTile = currentScrambleState.tiles.find(
          t => !t.used && t.char.toLowerCase() === e.key.toLowerCase()
        );
        if (matchingTile) {
          e.preventDefault();
          placeScrambleTile(matchingTile);
          return;
        }
      }
    }
  });

  // Kör vége modal gombok
  if (dom.btnRoundRetry) {
    dom.btnRoundRetry.addEventListener('click', () => {
      dom.modalRoundCompleted.classList.add('hidden');
      dom.modalRoundCompleted.classList.remove('flex');
      if (currentPracticeConfig) {
        if (currentPracticeConfig.isMix) {
          startMixPracticeSession(currentPracticeConfig.customWords);
        } else {
          startUnitPractice(currentPracticeConfig.listId, currentPracticeConfig.sheetId);
        }
      }
    });
  }

  if (dom.btnRoundExit) {
    dom.btnRoundExit.addEventListener('click', () => {
      dom.modalRoundCompleted.classList.add('hidden');
      dom.modalRoundCompleted.classList.remove('flex');
      switchTab('packages');
    });
  }

  if (dom.btnRoundNextLevel) {
    dom.btnRoundNextLevel.addEventListener('click', async () => {
      dom.modalRoundCompleted.classList.add('hidden');
      dom.modalRoundCompleted.classList.remove('flex');
      if (nextUnlockedUnitData) {
        const list = await getListById(nextUnlockedUnitData.listId);
        if (list && list.sheets && list.sheets[nextUnlockedUnitData.nextSheetIndex]) {
          startUnitPractice(list.id, list.sheets[nextUnlockedUnitData.nextSheetIndex].id);
        } else {
          switchTab('packages');
        }
      } else {
        switchTab('packages');
      }
    });
  }

  // Mix gombok
  if (dom.btnStartQuickMix) {
    dom.btnStartQuickMix.addEventListener('click', launchQuickMix);
  }

  if (dom.btnStartCustomMix) {
    dom.btnStartCustomMix.addEventListener('click', launchCustomMix);
  }

  if (dom.btnMixSelectAll) {
    dom.btnMixSelectAll.addEventListener('click', () => {
      dom.mixUnitsCheckboxContainer.querySelectorAll('.mix-unit-checkbox').forEach(cb => cb.checked = true);
      updateMixSelectionCounters();
    });
  }

  if (dom.btnMixDeselectAll) {
    dom.btnMixDeselectAll.addEventListener('click', () => {
      dom.mixUnitsCheckboxContainer.querySelectorAll('.mix-unit-checkbox').forEach(cb => cb.checked = false);
      updateMixSelectionCounters();
    });
  }

  // Excel feltöltés Modal eseményei
  if (dom.btnOpenUploadModal) {
    dom.btnOpenUploadModal.addEventListener('click', () => {
      dom.modalUploadExcel.classList.remove('hidden');
      dom.modalUploadExcel.classList.add('flex');
      dom.uploadPreviewSection.classList.add('hidden');
    });
  }

  if (dom.btnEmptyUpload) {
    dom.btnEmptyUpload.addEventListener('click', () => {
      dom.modalUploadExcel.classList.remove('hidden');
      dom.modalUploadExcel.classList.add('flex');
    });
  }

  if (dom.btnCloseUploadModal) {
    dom.btnCloseUploadModal.addEventListener('click', () => {
      dom.modalUploadExcel.classList.add('hidden');
      dom.modalUploadExcel.classList.remove('flex');
    });
  }

  if (dom.btnCancelUpload) {
    dom.btnCancelUpload.addEventListener('click', () => {
      dom.modalUploadExcel.classList.add('hidden');
      dom.modalUploadExcel.classList.remove('flex');
    });
  }

  if (dom.excelDropzone && dom.excelFileInput) {
    dom.excelDropzone.addEventListener('click', () => dom.excelFileInput.click());
    dom.excelFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const parsed = await parseExcelFile(file);
        pendingExcelData = parsed;
        dom.uploadListName.value = parsed.listName;
        dom.uploadWordCountBadge.textContent = parsed.wordCount;
        dom.uploadSheetsCountBadge.textContent = `${parsed.sheets.length} egység`;
        
        dom.uploadPreviewTable.innerHTML = parsed.preview.map(w => `
          <div class="flex items-center justify-between text-slate-300">
            <span class="font-semibold text-white">${escapeHtml(w.english)}</span>
            <span>${escapeHtml(w.hungarian)}</span>
          </div>
        `).join('');

        dom.uploadPreviewSection.classList.remove('hidden');
      } catch (err) {
        showToast(err.message || "Hiba az Excel beolvasásakor!", "error");
      }
    });
  }

  if (dom.btnSaveUploadedList) {
    dom.btnSaveUploadedList.addEventListener('click', async () => {
      if (!pendingExcelData) return;
      const listName = dom.uploadListName.value.trim() || pendingExcelData.listName;
      await saveNewList(listName, pendingExcelData.words, pendingExcelData.sheets);
      dom.modalUploadExcel.classList.add('hidden');
      dom.modalUploadExcel.classList.remove('flex');
      showToast("Szócsomag sikeresen mentve 20 szavas egységekben!", "success");
      renderPackagesTab();
    });
  }

  // Google Drive Modal eseményei
  if (dom.btnOpenGdriveModal) {
    dom.btnOpenGdriveModal.addEventListener('click', () => {
      dom.modalGdriveConnect.classList.remove('hidden');
      dom.modalGdriveConnect.classList.add('flex');
    });
  }

  if (dom.btnCloseGdriveModal) {
    dom.btnCloseGdriveModal.addEventListener('click', () => {
      dom.modalGdriveConnect.classList.add('hidden');
      dom.modalGdriveConnect.classList.remove('flex');
    });
  }

  if (dom.btnCancelGdrive) {
    dom.btnCancelGdrive.addEventListener('click', () => {
      dom.modalGdriveConnect.classList.add('hidden');
      dom.modalGdriveConnect.classList.remove('flex');
    });
  }

  if (dom.formGdriveConnect) {
    dom.formGdriveConnect.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = dom.gdriveLinkInput.value.trim();
      const name = dom.gdriveCustomName.value.trim();
      const sheetName = dom.gdriveSheetNames.value.trim();

      showToast("Google Táblázat letöltése...", "info");
      try {
        const parsed = await fetchGoogleSheetsData(url, sheetName ? [sheetName] : []);
        if (!parsed || !parsed.words || parsed.words.length === 0) {
          throw new Error("Nem sikerült szavakat találni a táblázatban.");
        }

        await saveNewList(name || parsed.listName || "Google Táblázat", parsed.words, parsed.sheets);
        dom.modalGdriveConnect.classList.add('hidden');
        dom.modalGdriveConnect.classList.remove('flex');
        showToast("Google Táblázat szinkronizálva!", "success");
        renderPackagesTab();
      } catch (err) {
        showToast(err.message || "Hiba a Google Táblázat letöltésekor.", "error");
      }
    });
  }

  // Új üres lista készítése
  if (dom.btnCreateEmptyList) {
    dom.btnCreateEmptyList.addEventListener('click', async () => {
      const name = prompt("Add meg az új szólista nevét:", "Saját szószedet");
      if (name && name.trim()) {
        await saveNewList(name.trim(), []);
        showToast("Új üres lista létrehozva!", "success");
        renderPackagesTab();
      }
    });
  }

  // Szavak szerkesztése modal
  if (dom.btnCloseManageModal) {
    dom.btnCloseManageModal.addEventListener('click', () => {
      dom.modalManageList.classList.add('hidden');
      dom.modalManageList.classList.remove('flex');
    });
  }

  if (dom.btnDoneManageModal) {
    dom.btnDoneManageModal.addEventListener('click', () => {
      dom.modalManageList.classList.add('hidden');
      dom.modalManageList.classList.remove('flex');
      renderPackagesTab();
    });
  }

  if (dom.formAddWord) {
    dom.formAddWord.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeManageListId) return;
      const en = dom.addWordEnglish.value.trim();
      const hu = dom.addWordHungarian.value.trim();
      if (en && hu) {
        await addWordToList(activeManageListId, en, hu);
        dom.addWordEnglish.value = '';
        dom.addWordHungarian.value = '';
        const list = await getListById(activeManageListId);
        renderManageWordsList(list);
        renderPackagesTab();
      }
    });
  }

  if (dom.manageSearchInput) {
    dom.manageSearchInput.addEventListener('input', async () => {
      if (activeManageListId) {
        const list = await getListById(activeManageListId);
        renderManageWordsList(list);
      }
    });
  }

  // Törlés modal
  if (dom.btnCloseDeleteModal) {
    dom.btnCloseDeleteModal.addEventListener('click', closeDeleteModal);
  }
  if (dom.btnCancelDelete) {
    dom.btnCancelDelete.addEventListener('click', closeDeleteModal);
  }
  if (dom.btnConfirmDelete) {
    dom.btnConfirmDelete.addEventListener('click', async () => {
      if (pendingDeleteTargetId) {
        await deleteList(pendingDeleteTargetId);
        closeDeleteModal();
        showToast("Szólista törölve.", "info");
        renderPackagesTab();
      }
    });
  }

  // Minta excel letöltése
  if (dom.btnDownloadSampleExcel) {
    dom.btnDownloadSampleExcel.addEventListener('click', () => {
      exportListToExcel("Minta_WL_Szokincs", [
        { english: "achievement", hungarian: "teljesítmény, eredmény" },
        { english: "opportunity", hungarian: "lehetőség" },
        { english: "development", hungarian: "fejlesztés, fejlődés" },
        { english: "challenge", hungarian: "kihívás" },
        { english: "environment", hungarian: "környezet" },
        { english: "experience", hungarian: "tapasztalat, élmény" },
        { english: "knowledge", hungarian: "tudás, ismeret" },
        { english: "successful", hungarian: "sikeres" },
        { english: "improve", hungarian: "fejleszt, javít" },
        { english: "solution", hungarian: "megoldás" }
      ]);
    });
  }

  // Hash váltások figyelése
  window.addEventListener('hashchange', handleRouting);
}

function openDeleteModal(listId) {
  pendingDeleteTargetId = listId;
  dom.modalDeleteConfirm.classList.remove('hidden');
  dom.modalDeleteConfirm.classList.add('flex');
}

function closeDeleteModal() {
  pendingDeleteTargetId = null;
  dom.modalDeleteConfirm.classList.add('hidden');
  dom.modalDeleteConfirm.classList.remove('flex');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Alkalmazás indítása
 */
function initApp() {
  initPWA();
  initModalsAndEvents();
  handleRouting();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

window.__wordly = {
  getCurrentSession: () => currentSession,
  setCurrentSession: (s) => { currentSession = s; },
  renderCurrentQuestion,
  submitPracticeAnswer,
  advanceToNextQuestion,
  generateNextExercise,
  generateMultipleChoiceQuestion,
  generateFillBlankQuestion,
  generateScrambleQuestion,
  generateTrueFalseQuestion,
  generateContextMatchingQuestion,
  generateListeningQuestion
};