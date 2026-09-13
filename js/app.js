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
  practicePromptWord: document.getElementById('practice-prompt-word'),
  practicePromptHint: document.getElementById('practice-prompt-hint'),
  btnSpeakWord: document.getElementById('btn-speak-word'),
  practiceContextEn: document.getElementById('practice-context-en'),
  practiceContextHu: document.getElementById('practice-context-hu'),
  containerMultipleChoice: document.getElementById('container-multiple-choice'),
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
      if (lists.length > 0 && lists[0].sheets && lists[0].sheets.length > 0) {
        const firstUnlocked = lists[0].sheets.find(s => s.isUnlocked) || lists[0].sheets[0];
        startUnitPractice(lists[0].id, firstUnlocked.id);
      } else {
        dom.practicePromptWord.textContent = "Nincs betöltött tananyag";
        dom.practicePromptHint.textContent = "Kérlek tölts fel egy Excel fájlt a Tananyagok fülön!";
      }
    });
    return;
  }

  renderCurrentQuestion();
}

/**
 * Aktuális kérdés renderelése (AI Multi-Format)
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
    'SENTENCE_CLOZE': 'Mondatkiegészítés',
    'WRITTEN_RECALL': 'Begépelés'
  };
  dom.practiceTypeLabel.textContent = typeMap[exercise.type] || 'Gyakorlat';

  // Prompt és kontextus
  dom.practicePromptWord.textContent = exercise.prompt || word.english;

  // Példamondat kiírása
  const contextSentence = (exercise.type === 'SENTENCE_CLOZE') 
    ? exercise.sentenceWithBlank 
    : (exercise.exampleSentence || `"${word.english}"`);
  
  dom.practiceContextEn.textContent = contextSentence;
  dom.practiceContextHu.textContent = exercise.sentenceTranslation || (isReverseMode ? word.english : word.hungarian);

  // Visszajelzés konténer elrejtése
  dom.practiceFeedbackContainer.classList.add('hidden');
  dom.practiceFeedbackContainer.innerHTML = '';

  // Formátum specifikus felület aktiválása
  if (exercise.type === 'MULTIPLE_CHOICE' || exercise.type === 'SENTENCE_CLOZE') {
    dom.containerMultipleChoice.classList.remove('hidden');
    dom.containerWrittenRecall.classList.add('hidden');
    renderMultipleChoiceOptions(exercise.options);
  } else {
    // Írásos begépelés
    dom.containerMultipleChoice.classList.add('hidden');
    dom.containerWrittenRecall.classList.remove('hidden');
    dom.practiceAnswerInput.value = '';
    dom.practiceAnswerInput.disabled = false;
    dom.btnPracticeSubmit.disabled = false;
    dom.practiceAnswerInput.focus();
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Feleletválasztós gombok renderelése
 */
function renderMultipleChoiceOptions(options) {
  dom.containerMultipleChoice.innerHTML = '';

  (options || []).forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'mc-option-btn p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-brand-500 font-semibold text-xs sm:text-sm text-left transition-all flex items-center justify-between';
    btn.dataset.index = idx;

    btn.innerHTML = `
      <span class="option-text text-slate-100">${escapeHtml(opt.text)}</span>
      <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">${idx + 1}</span>
    `;

    btn.addEventListener('click', () => {
      submitPracticeAnswer(opt.text, btn);
    });

    dom.containerMultipleChoice.appendChild(btn);
  });
}

/**
 * Válasz beküldése és kiértékelése
 */
async function submitPracticeAnswer(userAnswer, targetBtn = null) {
  if (!currentSession || currentSession.state !== 'WAITING_INPUT') return;

  const result = await currentSession.checkAnswer(userAnswer);
  if (!result) return;

  // Frissítjük a számlálókat azonnal
  dom.practiceStreakCounter.textContent = result.stats.streak;
  dom.practiceCorrectCount.textContent = result.stats.correctCount;

  // Feleletválasztós gombok színezése
  if (dom.containerMultipleChoice && !dom.containerMultipleChoice.classList.contains('hidden')) {
    const allBtns = dom.containerMultipleChoice.querySelectorAll('.mc-option-btn');
    allBtns.forEach(b => {
      b.disabled = true;
      const text = b.querySelector('.option-text').textContent.trim();
      if (text === result.correctAnswer) {
        b.classList.add('correct');
      }
    });

    if (targetBtn) {
      if (!result.isCorrect) {
        targetBtn.classList.add('incorrect');
      }
    }
  }

  // Visszajelzés megjelenítése
  dom.practiceFeedbackContainer.classList.remove('hidden');
  if (result.isCorrect) {
    dom.practiceFeedbackContainer.className = 'mt-4 p-4 rounded-2xl text-left text-xs sm:text-sm bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 animate-pop-in';
    dom.practiceFeedbackContainer.innerHTML = `
      <div class="flex items-center justify-between font-bold">
        <span>🎉 Helyes válasz! ${result.hasTypo ? '(Apró elütéssel elfogadva)' : ''}</span>
        <span class="text-xs text-emerald-400 font-mono">+1 pont</span>
      </div>
      <div class="text-xs text-emerald-300 mt-1">"${escapeHtml(result.correctAnswer)}"</div>
    `;
  } else {
    dom.practiceFeedbackContainer.className = 'mt-4 p-4 rounded-2xl text-left text-xs sm:text-sm bg-rose-950/60 border border-rose-800/80 text-rose-200 animate-pop-in';
    dom.practiceFeedbackContainer.innerHTML = `
      <div class="flex items-center justify-between font-bold">
        <span>❌ Helytelen válasz</span>
      </div>
      <div class="text-xs text-slate-300 mt-1">A helyes megoldás: <strong class="text-emerald-400 font-bold">${escapeHtml(result.correctAnswer)}</strong></div>
    `;
  }

  // Automatikus továbblépés
  clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = setTimeout(() => {
    if (currentSession.isRoundComplete()) {
      handleRoundCompleted();
    } else {
      currentSession.nextQuestion();
      renderCurrentQuestion();
    }
  }, currentSession.options.autoAdvanceMs || 900);
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

  // Billentyűzet gyorsgombok (1, 2, 3, 4 választáshoz)
  window.addEventListener('keydown', (e) => {
    if (activeTab !== 'practice' || !currentSession || currentSession.state !== 'WAITING_INPUT') return;
    if (dom.containerMultipleChoice && !dom.containerMultipleChoice.classList.contains('hidden')) {
      const keyIndex = parseInt(e.key, 10) - 1;
      if (keyIndex >= 0 && keyIndex < 4) {
        const btns = dom.containerMultipleChoice.querySelectorAll('.mc-option-btn');
        if (btns[keyIndex]) {
          btns[keyIndex].click();
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