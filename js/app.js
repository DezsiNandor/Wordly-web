/**
 * WL (Word Learning) - Fő Alkalmazásvezérlő és Router (Route Guards)
 */

import { 
  initAuth, 
  register, 
  login, 
  loginAsGuest, 
  logout, 
  getCurrentUser, 
  onAuthStateChangedCustom,
  isFirebaseActive 
} from './auth.js';

import { 
  getUserLists, 
  getListById, 
  saveNewList, 
  updateListName, 
  deleteList, 
  addWordToList, 
  deleteWordFromList, 
  updateWordInList 
} from './storage.js';

import { 
  parseExcelFile, 
  exportListToExcel, 
  downloadSampleExcel 
} from './excel.js';

import { PracticeSession } from './practice.js';

import { 
  getSavedFirebaseConfig, 
  saveFirebaseConfig, 
  clearFirebaseConfig 
} from './firebaseConfig.js';

import { initPWA } from './pwa.js';

// Alkalmazás állapot
let activeUser = null;
let currentPracticeSession = null;
let activeManageListId = null;
let pendingExcelData = null;
let autoAdvanceTimeout = null;
let isReversePractice = false;
let isSoundEnabled = true;

// DOM Elemek gyors elérése
const dom = {
  // Views
  viewLanding: document.getElementById('view-landing'),
  viewAuth: document.getElementById('view-auth'),
  viewDashboard: document.getElementById('view-dashboard'),
  viewPractice: document.getElementById('view-practice'),

  // Header Nav
  navLogo: document.getElementById('nav-logo'),
  publicNavLinks: document.getElementById('public-nav-links'),
  publicAuthButtons: document.getElementById('public-auth-buttons'),
  navBtnLogin: document.getElementById('nav-btn-login'),
  navBtnRegister: document.getElementById('nav-btn-register'),
  navBtnDashboard: document.getElementById('nav-btn-dashboard'),
  btnOpenFirebaseSettings: document.getElementById('btn-open-firebase-settings'),
  firebaseStatusDot: document.getElementById('firebase-status-dot'),
  firebaseStatusText: document.getElementById('firebase-status-text'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  iconThemeMoon: document.getElementById('icon-theme-moon'),
  iconThemeSun: document.getElementById('icon-theme-sun'),
  userProfileMenu: document.getElementById('user-profile-menu'),
  userEmailDisplay: document.getElementById('user-email-display'),
  userBadge: document.getElementById('user-badge'),
  btnLogout: document.getElementById('btn-logout'),

  // Landing Page Buttons
  btnLandingSampleExcel: document.getElementById('btn-landing-sample-excel'),
  btnLandingGuestTry: document.getElementById('btn-landing-guest-try'),

  // Auth View
  authProtectedNotice: document.getElementById('auth-protected-notice'),
  tabLogin: document.getElementById('tab-login'),
  tabRegister: document.getElementById('tab-register'),
  formAuth: document.getElementById('form-auth'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  authPasswordConfirm: document.getElementById('auth-password-confirm'),
  authConfirmPasswordContainer: document.getElementById('auth-confirm-password-container'),
  authErrorBanner: document.getElementById('auth-error-banner'),
  authErrorText: document.getElementById('auth-error-text'),
  btnAuthSubmit: document.getElementById('btn-auth-submit'),
  btnAuthText: document.getElementById('btn-auth-text'),
  btnGuestLogin: document.getElementById('btn-guest-login'),

  // Dashboard View
  statTotalLists: document.getElementById('stat-total-lists'),
  statTotalWords: document.getElementById('stat-total-words'),
  statTotalPracticed: document.getElementById('stat-total-practiced'),
  listCountBadge: document.getElementById('list-count-badge'),
  listsGrid: document.getElementById('lists-grid'),
  emptyListsContainer: document.getElementById('empty-lists-container'),
  btnOpenUploadModal: document.getElementById('btn-open-upload-modal'),
  btnDownloadSampleExcel: document.getElementById('btn-download-sample-excel'),
  btnCreateEmptyList: document.getElementById('btn-create-empty-list'),
  btnEmptyUpload: document.getElementById('btn-empty-upload'),
  btnEmptySample: document.getElementById('btn-empty-sample'),

  // Practice View
  btnExitPractice: document.getElementById('btn-exit-practice'),
  btnToggleDirection: document.getElementById('btn-toggle-direction'),
  directionLabel: document.getElementById('direction-label'),
  btnToggleSound: document.getElementById('btn-toggle-sound'),
  iconSoundOn: document.getElementById('icon-sound-on'),
  iconSoundOff: document.getElementById('icon-sound-off'),
  practiceStreakCounter: document.getElementById('practice-streak-counter'),
  practiceCorrectCount: document.getElementById('practice-correct-count'),
  practiceTotalCount: document.getElementById('practice-total-count'),
  quizCard: document.getElementById('quiz-card'),
  practiceCurrentListTitle: document.getElementById('practice-current-list-title'),
  practicePromptWord: document.getElementById('practice-prompt-word'),
  practicePromptHint: document.getElementById('practice-prompt-hint'),
  btnSpeakWord: document.getElementById('btn-speak-word'),
  practiceAnswerInput: document.getElementById('practice-answer-input'),
  practiceFeedbackContainer: document.getElementById('practice-feedback-container'),
  btnPracticeSubmit: document.getElementById('btn-practice-submit'),
  practiceBtnText: document.getElementById('practice-btn-text'),

  // Modals
  modalUploadExcel: document.getElementById('modal-upload-excel'),
  btnCloseUploadModal: document.getElementById('btn-close-upload-modal'),
  excelDropzone: document.getElementById('excel-dropzone'),
  excelFileInput: document.getElementById('excel-file-input'),
  uploadPreviewSection: document.getElementById('upload-preview-section'),
  uploadListName: document.getElementById('upload-list-name'),
  uploadWordCountBadge: document.getElementById('upload-word-count-badge'),
  uploadPreviewTable: document.getElementById('upload-preview-table'),
  btnCancelUpload: document.getElementById('btn-cancel-upload'),
  btnSaveUploadedList: document.getElementById('btn-save-uploaded-list'),

  modalManageList: document.getElementById('modal-manage-list'),
  btnCloseManageModal: document.getElementById('btn-close-manage-modal'),
  manageModalTitle: document.getElementById('manage-modal-title'),
  manageModalSubtitle: document.getElementById('manage-modal-subtitle'),
  formAddWord: document.getElementById('form-add-word'),
  addWordEnglish: document.getElementById('add-word-english'),
  addWordHungarian: document.getElementById('add-word-hungarian'),
  manageSearchInput: document.getElementById('manage-search-input'),
  manageWordCounter: document.getElementById('manage-word-counter'),
  manageWordsTable: document.getElementById('manage-words-table'),
  btnExportCurrentList: document.getElementById('btn-export-current-list'),
  btnDoneManageModal: document.getElementById('btn-done-manage-modal'),

  modalFirebaseSettings: document.getElementById('modal-firebase-settings'),
  btnCloseFirebaseModal: document.getElementById('btn-close-firebase-modal'),
  formFirebaseConfig: document.getElementById('form-firebase-config'),
  cfgApiKey: document.getElementById('cfg-api-key'),
  cfgAuthDomain: document.getElementById('cfg-auth-domain'),
  cfgProjectId: document.getElementById('cfg-project-id'),
  cfgStorageBucket: document.getElementById('cfg-storage-bucket'),
  cfgAppId: document.getElementById('cfg-app-id'),
  btnResetToLocal: document.getElementById('btn-reset-to-local')
};

// ==========================================
// 1. INICIALIZÁLÁS ÉS TÉMAKEZELÉS
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  initPWA();
  refreshIcons();

  // Hitelesítés inicializálása
  const authStatus = await initAuth();
  updateFirebaseStatusUI(authStatus.isFirebase);

  // Hash-alapú router figyelése
  window.addEventListener('hashchange', handleRouting);

  // Felhasználó figyelése (Auth state listener)
  onAuthStateChangedCustom(async (user) => {
    activeUser = user;
    updateNavForUser(user);

    if (user) {
      // Ha belépett, és épp az auth oldalon van, vigyük a dashboardra
      const currentHash = window.location.hash;
      if (currentHash === '#auth' || !currentHash || currentHash === '#') {
        navigateTo('#dashboard');
      } else {
        handleRouting();
      }
      await renderDashboard();
    } else {
      handleRouting();
    }
    refreshIcons();
  });
});

function initTheme() {
  const savedTheme = localStorage.getItem('wl_theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
    dom.iconThemeMoon.classList.remove('hidden');
    dom.iconThemeSun.classList.add('hidden');
  } else {
    document.documentElement.classList.remove('dark');
    dom.iconThemeMoon.classList.add('hidden');
    dom.iconThemeSun.classList.remove('hidden');
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('wl_theme', isDark ? 'dark' : 'light');
  if (isDark) {
    dom.iconThemeMoon.classList.remove('hidden');
    dom.iconThemeSun.classList.add('hidden');
  } else {
    dom.iconThemeMoon.classList.add('hidden');
    dom.iconThemeSun.classList.remove('hidden');
  }
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function updateFirebaseStatusUI(isFirebase) {
  if (isFirebase) {
    dom.firebaseStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-500/30';
    dom.firebaseStatusText.textContent = 'Firebase Felhő';
  } else {
    dom.firebaseStatusDot.className = 'w-2 h-2 rounded-full bg-amber-500 inline-block ring-2 ring-amber-500/30';
    dom.firebaseStatusText.textContent = 'Helyi tároló';
  }
}

function updateNavForUser(user) {
  if (user) {
    dom.publicAuthButtons.classList.add('hidden');
    dom.userProfileMenu.classList.remove('hidden');
    dom.userProfileMenu.classList.add('flex');
    dom.userEmailDisplay.textContent = user.email || 'Vendég';
    dom.userBadge.textContent = user.isGuest ? 'Vendég mód' : (user.isFirebase ? 'Firebase fiók' : 'Helyi profil');
  } else {
    dom.publicAuthButtons.classList.remove('hidden');
    dom.publicAuthButtons.classList.add('flex');
    dom.userProfileMenu.classList.add('hidden');
    dom.userProfileMenu.classList.remove('flex');
  }
}

// ==========================================
// 2. ROUTER ÉS ROUTE GUARDS
// ==========================================

function navigateTo(hash) {
  if (window.location.hash === hash) {
    handleRouting();
  } else {
    window.location.hash = hash;
  }
}

function handleRouting() {
  const hash = window.location.hash || '#landing';

  // Sima anchor linkek a landing page-en belül (pl. #how-it-works, #features, #faq)
  if (hash === '#how-it-works' || hash === '#features' || hash === '#faq') {
    if (!dom.viewLanding.classList.contains('hidden')) {
      const targetEl = document.querySelector(hash);
      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    showView('landing');
    setTimeout(() => {
      const targetEl = document.querySelector(hash);
      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return;
  }

  // Védett útvonalak ellenőrzése (Route Guard)
  if (hash === '#dashboard' || hash === '#practice') {
    if (!activeUser) {
      // Nem bejelentkezett látogató védett útvonalra lépne -> átirányítás az Auth nézetre
      dom.authProtectedNotice.classList.remove('hidden');
      showView('auth');
      return;
    }

    if (hash === '#practice' && !currentPracticeSession) {
      navigateTo('#dashboard');
      return;
    }

    showView(hash.substring(1));
    return;
  }

  if (hash === '#auth') {
    if (activeUser) {
      navigateTo('#dashboard');
      return;
    }
    dom.authProtectedNotice.classList.add('hidden');
    showView('auth');
    return;
  }

  // Alapértelmezett: Landing Page
  showView('landing');
}

function showView(viewName) {
  dom.viewLanding.classList.add('hidden');
  dom.viewAuth.classList.add('hidden');
  dom.viewDashboard.classList.add('hidden');
  dom.viewPractice.classList.add('hidden');

  if (viewName === 'landing') {
    dom.viewLanding.classList.remove('hidden');
  } else if (viewName === 'auth') {
    dom.viewAuth.classList.remove('hidden');
  } else if (viewName === 'dashboard') {
    dom.viewDashboard.classList.remove('hidden');
    renderDashboard();
  } else if (viewName === 'practice') {
    dom.viewPractice.classList.remove('hidden');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  refreshIcons();
}

// ==========================================
// 3. ESEMÉNYKEZELŐK REGISZTRÁLÁSA
// ==========================================

function setupEventListeners() {
  // Theme & Navigation
  dom.btnThemeToggle.addEventListener('click', toggleTheme);
  
  dom.navLogo.addEventListener('click', () => {
    if (activeUser) {
      navigateTo('#dashboard');
    } else {
      navigateTo('#landing');
    }
  });

  dom.navBtnDashboard.addEventListener('click', () => {
    navigateTo('#dashboard');
  });

  // Landing Page Buttons
  if (dom.btnLandingSampleExcel) {
    dom.btnLandingSampleExcel.addEventListener('click', () => downloadSampleExcel());
  }
  if (dom.btnLandingGuestTry) {
    dom.btnLandingGuestTry.addEventListener('click', () => {
      loginAsGuest();
      navigateTo('#dashboard');
    });
  }

  // Logout
  dom.btnLogout.addEventListener('click', async () => {
    if (confirm("Biztosan ki szeretnél jelentkezni?")) {
      await logout();
      navigateTo('#landing');
    }
  });

  // Auth Tabs
  let isRegisterMode = false;
  dom.tabLogin.addEventListener('click', () => {
    isRegisterMode = false;
    dom.tabLogin.className = 'flex-1 min-h-[44px] py-2.5 px-3 text-sm sm:text-sm font-semibold rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm transition-all';
    dom.tabRegister.className = 'flex-1 min-h-[44px] py-2.5 px-3 text-sm sm:text-sm font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
    dom.authConfirmPasswordContainer.classList.add('hidden');
    dom.btnAuthText.textContent = 'Bejelentkezés';
    hideAuthError();
  });

  dom.tabRegister.addEventListener('click', () => {
    isRegisterMode = true;
    dom.tabRegister.className = 'flex-1 min-h-[44px] py-2.5 px-3 text-sm sm:text-sm font-semibold rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm transition-all';
    dom.tabLogin.className = 'flex-1 min-h-[44px] py-2.5 px-3 text-sm sm:text-sm font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
    dom.authConfirmPasswordContainer.classList.remove('hidden');
    dom.btnAuthText.textContent = 'Fiók létrehozása';
    hideAuthError();
  });

  // Auth Form Submit
  dom.formAuth.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError();

    const email = dom.authEmail.value.trim();
    const password = dom.authPassword.value;
    const confirmPass = dom.authPasswordConfirm.value;

    if (isRegisterMode && password !== confirmPass) {
      showAuthError("A két jelszó nem egyezik meg!");
      return;
    }

    try {
      dom.btnAuthSubmit.disabled = true;
      dom.btnAuthText.textContent = "Folyamatban...";

      if (isRegisterMode) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      navigateTo('#dashboard');
    } catch (err) {
      showAuthError(err.message || "Hiba történt a művelet során.");
    } finally {
      dom.btnAuthSubmit.disabled = false;
      dom.btnAuthText.textContent = isRegisterMode ? 'Fiók létrehozása' : 'Bejelentkezés';
    }
  });

  // Guest login inside Auth Modal
  dom.btnGuestLogin.addEventListener('click', () => {
    loginAsGuest();
    navigateTo('#dashboard');
  });

  // Excel Upload Modal trigger
  dom.btnOpenUploadModal.addEventListener('click', () => openUploadModal());
  dom.btnEmptyUpload.addEventListener('click', () => openUploadModal());
  dom.btnCloseUploadModal.addEventListener('click', () => closeUploadModal());
  dom.btnCancelUpload.addEventListener('click', () => closeUploadModal());

  // Download Sample Excel
  dom.btnDownloadSampleExcel.addEventListener('click', () => downloadSampleExcel());
  dom.btnEmptySample.addEventListener('click', () => downloadSampleExcel());

  // Dropzone & File picker
  dom.excelDropzone.addEventListener('click', () => dom.excelFileInput.click());
  dom.excelFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedExcelFile(e.target.files[0]);
    }
  });

  // Drag & drop events
  dom.excelDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.excelDropzone.classList.add('border-brand-500', 'bg-brand-50/40', 'dark:bg-brand-950/40');
  });

  dom.excelDropzone.addEventListener('dragleave', () => {
    dom.excelDropzone.classList.remove('border-brand-500', 'bg-brand-50/40', 'dark:bg-brand-950/40');
  });

  dom.excelDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.excelDropzone.classList.remove('border-brand-500', 'bg-brand-50/40', 'dark:bg-brand-950/40');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedExcelFile(e.dataTransfer.files[0]);
    }
  });

  // Save Uploaded List
  dom.btnSaveUploadedList.addEventListener('click', async () => {
    if (!pendingExcelData) return;
    const customName = dom.uploadListName.value.trim() || pendingExcelData.listName;

    try {
      dom.btnSaveUploadedList.disabled = true;
      dom.btnSaveUploadedList.textContent = "Mentés...";
      await saveNewList(customName, pendingExcelData.words);
      closeUploadModal();
      await renderDashboard();
    } catch (err) {
      alert("Nem sikerült elmenteni a listát: " + err.message);
    } finally {
      dom.btnSaveUploadedList.disabled = false;
      dom.btnSaveUploadedList.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Lista mentése</span>`;
      refreshIcons();
    }
  });

  // Create empty list button
  dom.btnCreateEmptyList.addEventListener('click', async () => {
    const listName = prompt("Add meg az új szólista nevét (pl. B2 Kifejezések):");
    if (listName && listName.trim()) {
      await saveNewList(listName.trim(), []);
      await renderDashboard();
    }
  });

  // Manage Words Modal
  dom.btnCloseManageModal.addEventListener('click', () => closeManageModal());
  dom.btnDoneManageModal.addEventListener('click', () => closeManageModal());

  // Add word in manage modal
  dom.formAddWord.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeManageListId) return;

    const en = dom.addWordEnglish.value.trim();
    const hu = dom.addWordHungarian.value.trim();
    if (!en || !hu) return;

    await addWordToList(activeManageListId, en, hu);
    dom.addWordEnglish.value = '';
    dom.addWordHungarian.value = '';
    dom.addWordEnglish.focus();
    await renderManageModal(activeManageListId);
    await renderDashboard();
  });

  // Search in manage modal
  dom.manageSearchInput.addEventListener('input', (e) => {
    filterManageWords(e.target.value);
  });

  // Export from manage modal
  dom.btnExportCurrentList.addEventListener('click', async () => {
    if (!activeManageListId) return;
    const target = await getListById(activeManageListId);
    if (target) {
      exportListToExcel(target.name, target.words);
    }
  });

  // Practice session controls
  dom.btnExitPractice.addEventListener('click', () => {
    if (confirm("Biztosan vissza akarsz térni a szólistákhoz?")) {
      clearAutoAdvance();
      currentPracticeSession = null;
      navigateTo('#dashboard');
    }
  });

  dom.btnToggleDirection.addEventListener('click', () => {
    isReversePractice = !isReversePractice;
    dom.directionLabel.textContent = isReversePractice 
      ? '🇭🇺 Magyar → 🇬🇧 Angol' 
      : '🇬🇧 Angol → 🇭🇺 Magyar';
    
    if (currentPracticeSession) {
      currentPracticeSession.options.reverse = isReversePractice;
      dom.practicePromptHint.textContent = isReversePractice 
        ? "Írd be a megfelelő angol kifejezést:" 
        : "Írd be a megfelelő magyar jelentést:";
      renderCurrentQuizWord();
    }
  });

  dom.btnToggleSound.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    dom.iconSoundOn.classList.toggle('hidden', !isSoundEnabled);
    dom.iconSoundOff.classList.toggle('hidden', isSoundEnabled);
    if (currentPracticeSession) {
      currentPracticeSession.options.soundEnabled = isSoundEnabled;
    }
  });

  dom.btnSpeakWord.addEventListener('click', () => {
    if (currentPracticeSession) {
      currentPracticeSession.speakCurrentWord();
    }
  });

  // Practice Answer Submit & Enter handling
  dom.btnPracticeSubmit.addEventListener('click', handlePracticeAction);
  dom.practiceAnswerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePracticeAction();
    }
  });

  // Firebase Settings Modal
  dom.btnOpenFirebaseSettings.addEventListener('click', openFirebaseModal);
  dom.btnCloseFirebaseModal.addEventListener('click', closeFirebaseModal);

  dom.formFirebaseConfig.addEventListener('submit', async (e) => {
    e.preventDefault();
    const config = {
      apiKey: dom.cfgApiKey.value.trim(),
      authDomain: dom.cfgAuthDomain.value.trim(),
      projectId: dom.cfgProjectId.value.trim(),
      storageBucket: dom.cfgStorageBucket.value.trim(),
      appId: dom.cfgAppId.value.trim()
    };

    if (!config.apiKey || !config.projectId) {
      alert("Az API Key és a Project ID megadása kötelező!");
      return;
    }

    saveFirebaseConfig(config);
    alert("Firebase konfiguráció elmentve! Az oldal újratöltődik a felhő kapcsolathoz.");
    window.location.reload();
  });

  dom.btnResetToLocal.addEventListener('click', () => {
    if (confirm("Biztosan visszaállítod az alkalmazást a Helyi tárolási módra?")) {
      clearFirebaseConfig();
      window.location.reload();
    }
  });
}

function showAuthError(msg) {
  dom.authErrorText.textContent = msg;
  dom.authErrorBanner.classList.remove('hidden');
}

function hideAuthError() {
  dom.authErrorBanner.classList.add('hidden');
}

// ==========================================
// 4. DASHBOARD RENDERELÉSE
// ==========================================

async function renderDashboard() {
  if (!activeUser) return;
  const lists = await getUserLists();

  // Metrics
  const totalLists = lists.length;
  let totalWords = 0;
  let totalPracticed = 0;

  lists.forEach(l => {
    totalWords += (l.words ? l.words.length : 0);
    if (l.words) {
      totalPracticed += l.words.filter(w => (w.timesPracticed || 0) > 0).length;
    }
  });

  dom.statTotalLists.textContent = totalLists;
  dom.statTotalWords.textContent = totalWords;
  dom.statTotalPracticed.textContent = totalPracticed;
  dom.listCountBadge.textContent = totalLists;

  dom.listsGrid.innerHTML = '';

  if (lists.length === 0) {
    dom.emptyListsContainer.classList.remove('hidden');
    dom.listsGrid.classList.add('hidden');
    return;
  }

  dom.emptyListsContainer.classList.add('hidden');
  dom.listsGrid.classList.remove('hidden');

  lists.forEach(list => {
    const card = document.createElement('div');
    card.className = 'group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:border-brand-500/40 transition-all flex flex-col justify-between';

    const wordCount = list.words ? list.words.length : 0;
    const formattedDate = new Date(list.createdAt || Date.now()).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const wordsWithPractice = (list.words || []).filter(w => (w.timesPracticed || 0) > 0);
    const practicedCount = wordsWithPractice.length;
    const progressPercent = wordCount > 0 ? Math.round((practicedCount / wordCount) * 100) : 0;

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <i data-lucide="book-marked" class="w-5 h-5"></i>
            </div>
            <div>
              <h4 class="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1" title="${escapeHtml(list.name)}">
                ${escapeHtml(list.name)}
              </h4>
              <div class="text-[11px] text-slate-400">Létrehozva: ${formattedDate}</div>
            </div>
          </div>

          <!-- Kártya menü gombok -->
          <div class="flex items-center gap-1">
            <button class="btn-rename-list p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Átnevezés">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button class="btn-delete-list p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Lista törlése">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Szavak száma és haladás -->
        <div class="my-4 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500 dark:text-slate-400 font-medium">${wordCount} szó</span>
            <span class="text-brand-600 dark:text-brand-400 font-semibold">${progressPercent}% átvéve</span>
          </div>
          <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full" style="width: ${progressPercent}%"></div>
          </div>
        </div>
      </div>

      <!-- Kártya alsó gombok -->
      <div class="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
        <button class="btn-start-practice flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]">
          <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
          <span>Gyakorlás</span>
        </button>

        <button class="btn-view-words min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs transition-colors" title="Szavak megtekintése és szerkesztése">
          <i data-lucide="list" class="w-4 h-4"></i>
        </button>

        <button class="btn-export-list min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs transition-colors" title="Exportálás Excelbe">
          <i data-lucide="download" class="w-4 h-4"></i>
        </button>
      </div>
    `;

    // Eseménykezelők kártyán belül
    card.querySelector('.btn-start-practice').addEventListener('click', () => {
      startPractice(list.id);
    });

    card.querySelector('.btn-view-words').addEventListener('click', () => {
      openManageModal(list.id);
    });

    card.querySelector('.btn-export-list').addEventListener('click', () => {
      exportListToExcel(list.name, list.words || []);
    });

    card.querySelector('.btn-rename-list').addEventListener('click', async () => {
      const newName = prompt("Lista új neve:", list.name);
      if (newName && newName.trim() && newName.trim() !== list.name) {
        await updateListName(list.id, newName.trim());
        await renderDashboard();
      }
    });

    card.querySelector('.btn-delete-list').addEventListener('click', async () => {
      if (confirm(`Biztosan törölni szeretnéd a(z) "${list.name}" listát?`)) {
        await deleteList(list.id);
        await renderDashboard();
      }
    });

    dom.listsGrid.appendChild(card);
  });

  refreshIcons();
}

// ==========================================
// 5. EXCEL FELTÖLTÉS MODAL KEZELÉSE
// ==========================================

function openUploadModal() {
  pendingExcelData = null;
  dom.excelFileInput.value = '';
  dom.uploadPreviewSection.classList.add('hidden');
  dom.excelDropzone.classList.remove('hidden');
  dom.modalUploadExcel.classList.remove('hidden');
  dom.modalUploadExcel.classList.add('flex');
  refreshIcons();
}

function closeUploadModal() {
  dom.modalUploadExcel.classList.add('hidden');
  dom.modalUploadExcel.classList.remove('flex');
}

async function handleSelectedExcelFile(file) {
  try {
    const result = await parseExcelFile(file);
    pendingExcelData = result;

    dom.uploadListName.value = result.listName;
    dom.uploadWordCountBadge.textContent = result.wordCount;

    dom.uploadPreviewTable.innerHTML = '';
    result.preview.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between py-1 px-2 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      row.innerHTML = `
        <span class="font-medium truncate max-w-[45%]">${escapeHtml(item.english)}</span>
        <span class="text-slate-400">→</span>
        <span class="text-slate-500 dark:text-slate-400 truncate max-w-[45%] text-right">${escapeHtml(item.hungarian)}</span>
      `;
      dom.uploadPreviewTable.appendChild(row);
    });

    dom.excelDropzone.classList.add('hidden');
    dom.uploadPreviewSection.classList.remove('hidden');
    refreshIcons();
  } catch (err) {
    alert("Nem sikerült feldolgozni a fájlt:\n" + err.message);
  }
}

// ==========================================
// 6. SZÓLISTA SZERKESZTŐ (MANAGE) MODAL
// ==========================================

async function openManageModal(listId) {
  activeManageListId = listId;
  await renderManageModal(listId);
  dom.modalManageList.classList.remove('hidden');
  dom.modalManageList.classList.add('flex');
  refreshIcons();
}

function closeManageModal() {
  activeManageListId = null;
  dom.modalManageList.classList.add('hidden');
  dom.modalManageList.classList.remove('flex');
}

async function renderManageModal(listId) {
  const list = await getListById(listId);
  if (!list) return;

  dom.manageModalTitle.textContent = `${list.name} — Szavak`;
  dom.manageModalSubtitle.textContent = `Összesen ${list.words ? list.words.length : 0} szó rögzítve`;
  dom.manageWordCounter.textContent = `${list.words ? list.words.length : 0} szó`;
  dom.manageSearchInput.value = '';

  renderWordsListRows(list.words || []);
}

function renderWordsListRows(words) {
  dom.manageWordsTable.innerHTML = '';

  if (words.length === 0) {
    dom.manageWordsTable.innerHTML = `
      <div class="text-center py-8 text-xs text-slate-400">
        Nincsenek szavak ebben a listában. Használd a fenti űrlapot új szó hozzáadásához!
      </div>
    `;
    return;
  }

  words.forEach(word => {
    const item = document.createElement('div');
    item.className = 'group flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-sm sm:text-xs transition-colors';
    item.dataset.english = word.english.toLowerCase();
    item.dataset.hungarian = word.hungarian.toLowerCase();

    item.innerHTML = `
      <div class="flex-1 grid grid-cols-2 gap-2 mr-2">
        <span class="font-semibold text-slate-900 dark:text-slate-100 truncate">${escapeHtml(word.english)}</span>
        <span class="text-slate-600 dark:text-slate-300 truncate">${escapeHtml(word.hungarian)}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button class="btn-edit-word p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-400 hover:text-brand-600 rounded-xl transition-colors" title="Szerkesztés">
          <i data-lucide="pencil" class="w-4 h-4"></i>
        </button>
        <button class="btn-delete-word p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-xl transition-colors" title="Törlés">
          <i data-lucide="trash" class="w-4 h-4"></i>
        </button>
      </div>
    `;

    item.querySelector('.btn-edit-word').addEventListener('click', async () => {
      const newEn = prompt("Angol kifejezés módosítása:", word.english);
      if (newEn === null) return;
      const newHu = prompt("Magyar jelentés módosítása:", word.hungarian);
      if (newHu === null) return;

      if (newEn.trim() && newHu.trim()) {
        await updateWordInList(activeManageListId, word.id, newEn.trim(), newHu.trim());
        await renderManageModal(activeManageListId);
        await renderDashboard();
      }
    });

    item.querySelector('.btn-delete-word').addEventListener('click', async () => {
      if (confirm(`Biztosan törlöd a(z) "${word.english}" szót ebből a listából?`)) {
        await deleteWordFromList(activeManageListId, word.id);
        await renderManageModal(activeManageListId);
        await renderDashboard();
      }
    });

    dom.manageWordsTable.appendChild(item);
  });

  refreshIcons();
}

function filterManageWords(query) {
  const q = query.trim().toLowerCase();
  const rows = dom.manageWordsTable.querySelectorAll('div[data-english]');
  rows.forEach(row => {
    const en = row.dataset.english || '';
    const hu = row.dataset.hungarian || '';
    if (!q || en.includes(q) || hu.includes(q)) {
      row.classList.remove('hidden');
    } else {
      row.classList.add('hidden');
    }
  });
}

// ==========================================
// 7. GYAKORLÁSI ÉS KIKÉRDEZÉSI MÓD ENGINE
// ==========================================

async function startPractice(listId) {
  const list = await getListById(listId);
  if (!list || !list.words || list.words.length === 0) {
    alert("Ez a lista nem tartalmaz szavakat a gyakorláshoz! Tölts fel vagy adj hozzá szavakat.");
    return;
  }

  currentPracticeSession = new PracticeSession(list, {
    reverse: isReversePractice,
    soundEnabled: isSoundEnabled
  });

  dom.practiceCurrentListTitle.textContent = list.name;
  dom.practicePromptHint.textContent = isReversePractice 
    ? "Írd be a megfelelő angol kifejezést:" 
    : "Írd be a megfelelő magyar jelentést:";

  navigateTo('#practice');
  renderCurrentQuizWord();
}

function renderCurrentQuizWord() {
  clearAutoAdvance();
  const word = currentPracticeSession.nextWord();
  if (!word) {
    alert("A lista összes szava átismételve!");
    navigateTo('#dashboard');
    return;
  }

  resetQuizCardState();

  const promptText = isReversePractice ? word.hungarian : word.english;
  dom.practicePromptWord.textContent = promptText;

  updatePracticeStatsUI();

  dom.practiceAnswerInput.value = '';
  dom.practiceAnswerInput.disabled = false;
  setTimeout(() => dom.practiceAnswerInput.focus(), 50);

  if (isSoundEnabled && !isReversePractice) {
    currentPracticeSession.speakCurrentWord();
  }
}

function resetQuizCardState() {
  dom.quizCard.className = 'quiz-card bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 p-8 sm:p-12 shadow-xl shadow-slate-200/40 dark:shadow-none text-center relative overflow-hidden transition-all duration-300';
  dom.practiceFeedbackContainer.classList.add('hidden');
  dom.practiceFeedbackContainer.innerHTML = '';
  dom.practiceBtnText.textContent = 'Ellenőrzés';
  dom.btnPracticeSubmit.className = 'w-full py-3.5 px-6 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-base shadow-lg shadow-brand-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2';
}

async function handlePracticeAction() {
  if (!currentPracticeSession) return;

  if (currentPracticeSession.state === 'INCORRECT' || currentPracticeSession.state === 'CORRECT') {
    clearAutoAdvance();
    renderCurrentQuizWord();
    return;
  }

  const answer = dom.practiceAnswerInput.value.trim();
  if (!answer) {
    dom.practiceAnswerInput.focus();
    return;
  }

  const result = await currentPracticeSession.checkAnswer(answer);
  if (!result) return;

  updatePracticeStatsUI();

  if (result.isCorrect) {
    // === HELYES VÁLASZ ===
    dom.quizCard.classList.remove('border-slate-200', 'dark:border-slate-800');
    dom.quizCard.classList.add('border-emerald-500', 'dark:border-emerald-500', 'animate-bounce-success');

    dom.practiceFeedbackContainer.className = 'p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200 animate-pop-in flex items-center justify-between';
    dom.practiceFeedbackContainer.innerHTML = `
      <div class="flex items-center gap-2.5 font-bold">
        <span class="text-xl">🎉</span>
        <span>Helyes válasz!</span>
      </div>
      <div class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
        <span>Továbbugrás...</span>
        <kbd class="px-1.5 py-0.5 text-[10px] bg-emerald-200/60 dark:bg-emerald-800/60 rounded">Enter</kbd>
      </div>
    `;

    dom.btnPracticeSubmit.className = 'w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2';
    dom.practiceBtnText.textContent = 'Következő szó';

    if (result.stats.streak > 0 && result.stats.streak % 5 === 0 && window.confetti) {
      window.confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    }

    clearAutoAdvance();
    autoAdvanceTimeout = setTimeout(() => {
      if (currentPracticeSession && currentPracticeSession.state === 'CORRECT') {
        renderCurrentQuizWord();
      }
    }, 900);

  } else {
    // === HELYTELEN VÁLASZ ===
    dom.quizCard.classList.remove('border-slate-200', 'dark:border-slate-800');
    dom.quizCard.classList.add('border-rose-500', 'dark:border-rose-500', 'animate-shake');

    dom.practiceFeedbackContainer.className = 'p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-100 animate-pop-in space-y-2';
    dom.practiceFeedbackContainer.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="font-bold flex items-center gap-2 text-rose-700 dark:text-rose-300">
          <i data-lucide="x-circle" class="w-5 h-5"></i>
          <span>Nem egészen...</span>
        </div>
      </div>
      <div class="text-xs pt-1 border-t border-rose-200 dark:border-rose-900/60 flex flex-col gap-1">
        <div>A te válaszod: <span class="line-through text-rose-600 dark:text-rose-400 font-medium">${escapeHtml(result.userAnswer)}</span></div>
        <div>Pontos helyes jelentés: <strong class="text-sm font-bold text-slate-900 dark:text-white bg-white/80 dark:bg-slate-900 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 inline-block">${escapeHtml(result.correctAnswer)}</strong></div>
      </div>
    `;

    dom.btnPracticeSubmit.className = 'w-full py-3.5 px-6 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-base shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2';
    dom.practiceBtnText.textContent = 'Következő szó';

    refreshIcons();
    dom.btnPracticeSubmit.focus();
  }
}

function updatePracticeStatsUI() {
  if (!currentPracticeSession) return;
  const stats = currentPracticeSession.stats;
  dom.practiceStreakCounter.textContent = stats.streak;
  dom.practiceCorrectCount.textContent = stats.correctCount;
  dom.practiceTotalCount.textContent = stats.totalAnswered;
}

function clearAutoAdvance() {
  if (autoAdvanceTimeout) {
    clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }
}

// ==========================================
// 8. FIREBASE BEÁLLÍTÁSOK MODAL
// ==========================================

function openFirebaseModal() {
  const cfg = getSavedFirebaseConfig() || {};
  dom.cfgApiKey.value = cfg.apiKey || '';
  dom.cfgAuthDomain.value = cfg.authDomain || '';
  dom.cfgProjectId.value = cfg.projectId || '';
  dom.cfgStorageBucket.value = cfg.storageBucket || '';
  dom.cfgAppId.value = cfg.appId || '';

  dom.modalFirebaseSettings.classList.remove('hidden');
  dom.modalFirebaseSettings.classList.add('flex');
  refreshIcons();
}

function closeFirebaseModal() {
  dom.modalFirebaseSettings.classList.add('hidden');
  dom.modalFirebaseSettings.classList.remove('flex');
}

// ==========================================
// 9. SEGÉDFÜGGVÉNYEK
// ==========================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
