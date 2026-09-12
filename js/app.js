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
  updateWordInList,
  updateSheetProgress
} from './storage.js';

import { 
  parseExcelFile, 
  exportListToExcel, 
  exportListToCSV,
  exportListToJSON,
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
let currentActivePracticeConfig = { listId: null, sheetId: null, isMix: false };
let nextUnlockedSheetData = null;
let pendingDeleteTarget = null;

// DOM Elemek gyors elérése
const dom = {
  // Views
  viewLanding: document.getElementById('view-landing'),
  viewAuth: document.getElementById('view-auth'),
  viewDashboard: document.getElementById('view-dashboard'),
  viewPractice: document.getElementById('view-practice'),
  viewStats: document.getElementById('view-stats'),

  // Header Nav
  navLogo: document.getElementById('nav-logo'),
  publicNavLinks: document.getElementById('public-nav-links'),
  publicAuthButtons: document.getElementById('public-auth-buttons'),
  navBtnLogin: document.getElementById('nav-btn-login'),
  navBtnRegister: document.getElementById('nav-btn-register'),
  navBtnDashboard: document.getElementById('nav-btn-dashboard'),
  navBtnStats: document.getElementById('nav-btn-stats'),
  navLinkStats: document.getElementById('nav-link-stats'),
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

  // Mobile Bottom Nav
  mobileBottomNav: document.getElementById('mobile-bottom-nav'),
  bottomNavHome: document.getElementById('bottom-nav-home'),
  bottomNavLists: document.getElementById('bottom-nav-lists'),
  bottomNavStats: document.getElementById('bottom-nav-stats'),

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

  // Stats View
  statsListsContainer: document.getElementById('stats-lists-container'),
  statsEmptyState: document.getElementById('stats-empty-state'),
  statsTotalFiles: document.getElementById('stats-total-files'),
  statsTotalSheets: document.getElementById('stats-total-sheets'),
  statsMasteredSheets: document.getElementById('stats-mastered-sheets'),
  statsAvgAccuracy: document.getElementById('stats-avg-accuracy'),

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
  practiceSheetBadge: document.getElementById('practice-sheet-badge'),
  practiceCurrentSheetTitle: document.getElementById('practice-current-sheet-title'),
  practiceRoundCounterBadge: document.getElementById('practice-round-counter-badge'),
  practiceRoundProgress: document.getElementById('practice-round-progress'),
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
  uploadSheetsCountBadge: document.getElementById('upload-sheets-count-badge'),
  uploadSheetsPreviewTags: document.getElementById('upload-sheets-preview-tags'),
  uploadPreviewTable: document.getElementById('upload-preview-table'),
  btnCancelUpload: document.getElementById('btn-cancel-upload'),
  btnSaveUploadedList: document.getElementById('btn-save-uploaded-list'),

  // Round Completed Modal
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

  modalDownloadExport: document.getElementById('modal-download-export'),
  btnCloseDownloadModal: document.getElementById('btn-close-download-modal'),
  downloadListNameBadge: document.getElementById('download-list-name-badge'),
  downloadWordCounter: document.getElementById('download-word-counter'),
  downloadWordsPreviewList: document.getElementById('download-words-preview-list'),
  btnExportOptXlsx: document.getElementById('btn-export-opt-xlsx'),
  btnExportOptCsv: document.getElementById('btn-export-opt-csv'),
  btnExportOptJson: document.getElementById('btn-export-opt-json'),

  modalFirebaseSettings: document.getElementById('modal-firebase-settings'),
  btnCloseFirebaseModal: document.getElementById('btn-close-firebase-modal'),
  formFirebaseConfig: document.getElementById('form-firebase-config'),
  cfgApiKey: document.getElementById('cfg-api-key'),
  cfgAuthDomain: document.getElementById('cfg-auth-domain'),
  cfgProjectId: document.getElementById('cfg-project-id'),
  cfgStorageBucket: document.getElementById('cfg-storage-bucket'),
  cfgAppId: document.getElementById('cfg-app-id'),
  btnResetToLocal: document.getElementById('btn-reset-to-local'),

  // Delete Confirmation Modal & Toast
  modalDeleteConfirm: document.getElementById('modal-delete-confirm'),
  deleteConfirmTitle: document.getElementById('delete-confirm-title'),
  deleteConfirmMessage: document.getElementById('delete-confirm-message'),
  btnCancelDelete: document.getElementById('btn-cancel-delete'),
  btnCloseDeleteModal: document.getElementById('btn-close-delete-modal'),
  btnConfirmDelete: document.getElementById('btn-confirm-delete'),
  appToast: document.getElementById('app-toast'),
  appToastMessage: document.getElementById('app-toast-message'),
  appToastIcon: document.getElementById('app-toast-icon')
};

// ==========================================
// 1. INICIALIZÁLÁS ÉS TÉMAKEZELÉS
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  initPWA();
  refreshIcons();

  // Alapértelmezetten tiszta kijelentkezett állapot (alsó léc rejtve, felesleges margók nélkül)
  updateNavForUser(null);

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
      // Sikeres bejelentkezéskor vagy aktív munkamenet észlelésekor
      // a kezdőlapról (/) és az auth oldalról azonnal a fő munkafelületre (#dashboard) irányítunk
      let hash = window.location.hash || '';
      if (hash.startsWith('#/')) hash = '#' + hash.substring(2);
      if (hash === '#') hash = '';

      const isLandingOrAuth = !hash || hash === '#landing' || hash === '#home' || hash === '#auth' || hash === '#how-it-works' || hash === '#features' || hash === '#faq';

      if (isLandingOrAuth) {
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
    dom.firebaseStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 absolute top-1.5 right-1.5 ring-2 ring-white dark:ring-slate-900 inline-block';
    dom.firebaseStatusText.textContent = 'Firebase Felhő';
    if (dom.btnOpenFirebaseSettings) {
      dom.btnOpenFirebaseSettings.title = 'Firebase Felhő csatlakoztatva (Kattints a beállításokhoz)';
    }
  } else {
    dom.firebaseStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 absolute top-1.5 right-1.5 ring-2 ring-white dark:ring-slate-900 inline-block';
    dom.firebaseStatusText.textContent = 'Helyi tároló';
    if (dom.btnOpenFirebaseSettings) {
      dom.btnOpenFirebaseSettings.title = 'Helyi tárolási mód (Kattints a Firebase beállításához)';
    }
  }
}

function updateNavForUser(user) {
  if (user) {
    dom.publicAuthButtons.classList.add('hidden');
    dom.publicAuthButtons.classList.remove('flex');
    if (dom.publicNavLinks) {
      dom.publicNavLinks.classList.add('hidden');
      dom.publicNavLinks.classList.remove('md:flex');
    }
    const footerLinks = document.getElementById('footer-public-links');
    if (footerLinks) footerLinks.classList.add('hidden');

    dom.userProfileMenu.classList.remove('hidden');
    dom.userProfileMenu.classList.add('flex');
    dom.userEmailDisplay.textContent = user.email || 'Vendég';
    dom.userBadge.textContent = user.isGuest ? 'Vendég mód' : (user.isFirebase ? 'Firebase fiók' : 'Helyi profil');
    const badgeBtn = document.getElementById('user-profile-badge-btn');
    if (badgeBtn) {
      badgeBtn.title = `${user.email || 'Vendég'} (${user.isGuest ? 'Vendég mód' : (user.isFirebase ? 'Firebase fiók' : 'Helyi profil')})`;
    }

    // Alsó navigációs sáv véglegesen kikapcsolva / eltávolítva a DOM-ból
    if (dom.mobileBottomNav) {
      dom.mobileBottomNav.remove();
      dom.mobileBottomNav = null;
    }
    const bottomNavEl = document.getElementById('mobile-bottom-nav');
    if (bottomNavEl) bottomNavEl.remove();

    document.body.classList.remove('has-bottom-nav');
    document.body.classList.add('no-bottom-nav');
  } else {
    dom.publicAuthButtons.classList.remove('hidden');
    dom.publicAuthButtons.classList.add('flex');
    if (dom.publicNavLinks) {
      dom.publicNavLinks.classList.remove('hidden');
      dom.publicNavLinks.classList.add('md:flex');
    }
    const footerLinks = document.getElementById('footer-public-links');
    if (footerLinks) footerLinks.classList.remove('hidden');

    dom.userProfileMenu.classList.add('hidden');
    dom.userProfileMenu.classList.remove('flex');

    // Alsó navigációs sáv véglegesen kikapcsolva / eltávolítva
    if (dom.mobileBottomNav) {
      dom.mobileBottomNav.remove();
      dom.mobileBottomNav = null;
    }
    const bottomNavEl = document.getElementById('mobile-bottom-nav');
    if (bottomNavEl) bottomNavEl.remove();

    document.body.classList.remove('has-bottom-nav');
    document.body.classList.add('no-bottom-nav');
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
  let hash = window.location.hash || '';
  // Normalizálás (#/szolistak -> #szolistak, #/ -> üres, # -> üres)
  if (hash.startsWith('#/')) {
    hash = '#' + hash.substring(2);
  }
  if (hash === '#') hash = '';

  updateActiveBottomNav(hash);

  const isHomeOrLanding = !hash || hash === '#landing' || hash === '#home' || hash === '#how-it-works' || hash === '#features' || hash === '#faq';

  // 1. BEJELENTKEZETT FELHASZNÁLÓK ÚTVÁLASZTÁSA ÉS ROUTE GUARD:
  // Bejelentkezett állapotban a „Kezdőlap” felület nem érhető el vagy látható.
  // Ha a bejelentkezett felhasználó manuálisan a gyökér útvonalra (/), a kezdőlapra (#landing / #home)
  // vagy a bejelentkező felületre navigál, azonnal átirányítjuk a fő munkafelületre (#dashboard / #szolistak).
  if (activeUser) {
    if (isHomeOrLanding || hash === '#auth') {
      navigateTo('#dashboard');
      return;
    }
  }

  // 2. Szólisták / Fő munkafelület és Gyakorlás (#dashboard, #szolistak, #lists, #practice)
  if (hash === '#dashboard' || hash === '#szolistak' || hash === '#lists' || hash === '#practice') {
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

    if (hash === '#szolistak' || hash === '#lists') {
      showView('dashboard');
      return;
    }

    showView(hash.substring(1));
    return;
  }

  // 3. Statisztika menüpont (#stats, #statistics, #statisztika)
  if (hash === '#stats' || hash === '#statistics' || hash === '#statisztika') {
    if (!activeUser) {
      dom.authProtectedNotice.classList.remove('hidden');
      showView('auth');
      return;
    }
    showView('stats');
    return;
  }

  // 4. Auth nézet (bejelentkezés / regisztráció nem bejelentkezett felhasználóknak)
  if (hash === '#auth') {
    if (activeUser) {
      navigateTo('#dashboard');
      return;
    }
    dom.authProtectedNotice.classList.add('hidden');
    showView('auth');
    return;
  }

  // 5. Landing page szekciói (csak nem bejelentkezett látogatóknak)
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

  // 6. Alapértelmezett navigáció:
  // Bejelentkezett állapotban a fő munkafelületre (#dashboard), vendégként a Kezdőlapra irányít.
  if (activeUser) {
    navigateTo('#dashboard');
  } else {
    showView('landing');
  }
}

function updateActiveBottomNav(hash) {
  const current = hash || window.location.hash || '#landing';
  const navItems = document.querySelectorAll('#public-nav-links a');
  navItems.forEach(item => {
    const href = item.getAttribute('href');
    if (href && (href === current || (current === '' && href === '#landing'))) {
      item.classList.remove('text-slate-600', 'dark:text-slate-400');
      item.classList.add('text-brand-600', 'dark:text-brand-400');
    } else if (href) {
      item.classList.add('text-slate-600', 'dark:text-slate-400');
      item.classList.remove('text-brand-600', 'dark:text-brand-400');
    }
  });
}

function showView(viewName) {
  // Bejelentkezett állapotban a Kezdőlap (landing) semmilyen körülmények között nem renderelődhet:
  if (viewName === 'landing' && activeUser) {
    navigateTo('#dashboard');
    return;
  }

  dom.viewLanding.classList.add('hidden');
  dom.viewAuth.classList.add('hidden');
  dom.viewDashboard.classList.add('hidden');
  dom.viewPractice.classList.add('hidden');
  if (dom.viewStats) dom.viewStats.classList.add('hidden');

  if (viewName === 'landing') {
    dom.viewLanding.classList.remove('hidden');
  } else if (viewName === 'auth') {
    dom.viewAuth.classList.remove('hidden');
  } else if (viewName === 'dashboard') {
    dom.viewDashboard.classList.remove('hidden');
    renderDashboard();
  } else if (viewName === 'stats') {
    if (dom.viewStats) {
      dom.viewStats.classList.remove('hidden');
      renderStatsView();
    }
  } else if (viewName === 'practice') {
    dom.viewPractice.classList.remove('hidden');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  const appHeader = document.getElementById('app-header') || document.querySelector('header');
  if (appHeader) appHeader.classList.remove('header-hidden');
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

  if (dom.navBtnStats) {
    dom.navBtnStats.addEventListener('click', () => {
      navigateTo('#stats');
    });
  }

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
      await saveNewList(customName, pendingExcelData.words, pendingExcelData.sheets);
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
      openDownloadModal(target.name, target.words || []);
    }
  });

  // Download / Export modal format actions
  if (dom.btnCloseDownloadModal) {
    dom.btnCloseDownloadModal.addEventListener('click', closeDownloadModal);
  }

  if (dom.modalDownloadExport) {
    dom.modalDownloadExport.addEventListener('click', (e) => {
      if (e.target === dom.modalDownloadExport) closeDownloadModal();
    });
  }

  if (dom.btnExportOptXlsx) {
    dom.btnExportOptXlsx.addEventListener('click', () => {
      if (!activeDownloadData) return;
      exportListToExcel(activeDownloadData.name, activeDownloadData.words);
      closeDownloadModal();
    });
  }

  if (dom.btnExportOptCsv) {
    dom.btnExportOptCsv.addEventListener('click', () => {
      if (!activeDownloadData) return;
      exportListToCSV(activeDownloadData.name, activeDownloadData.words);
      closeDownloadModal();
    });
  }

  if (dom.btnExportOptJson) {
    dom.btnExportOptJson.addEventListener('click', () => {
      if (!activeDownloadData) return;
      exportListToJSON(activeDownloadData.name, activeDownloadData.words);
      closeDownloadModal();
    });
  }

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

  // Round Completed Modal Controls
  if (dom.btnRoundRetry) {
    dom.btnRoundRetry.addEventListener('click', () => {
      closeRoundCompletedModal();
      if (currentActivePracticeConfig.sheetId) {
        startSheetPractice(currentActivePracticeConfig.listId, currentActivePracticeConfig.sheetId);
      } else if (currentActivePracticeConfig.isMix) {
        startMixPractice(currentActivePracticeConfig.listId);
      } else if (currentActivePracticeConfig.listId) {
        startPractice(currentActivePracticeConfig.listId);
      }
    });
  }

  if (dom.btnRoundNextLevel) {
    dom.btnRoundNextLevel.addEventListener('click', () => {
      closeRoundCompletedModal();
      if (nextUnlockedSheetData) {
        startSheetPractice(nextUnlockedSheetData.listId, nextUnlockedSheetData.sheetId);
      }
    });
  }

  if (dom.btnRoundExit) {
    dom.btnRoundExit.addEventListener('click', () => {
      closeRoundCompletedModal();
      navigateTo('#stats');
    });
  }

  // Dinamikus fejléc elrejtése görgetéskor
  setupHeaderScrollHide();

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

  // Delete Confirmation Modal Event Listeners
  if (dom.btnCancelDelete) {
    dom.btnCancelDelete.addEventListener('click', closeDeleteModal);
  }
  if (dom.btnCloseDeleteModal) {
    dom.btnCloseDeleteModal.addEventListener('click', closeDeleteModal);
  }
  if (dom.modalDeleteConfirm) {
    dom.modalDeleteConfirm.addEventListener('click', (e) => {
      if (e.target === dom.modalDeleteConfirm) {
        closeDeleteModal();
      }
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.modalDeleteConfirm && !dom.modalDeleteConfirm.classList.contains('hidden')) {
      closeDeleteModal();
    }
  });

  if (dom.btnConfirmDelete) {
    dom.btnConfirmDelete.addEventListener('click', async () => {
      if (!pendingDeleteTarget) return;

      const targetListId = pendingDeleteTarget.id;
      const targetListName = pendingDeleteTarget.name;
      const isStarter = pendingDeleteTarget.id?.startsWith('starter_') || 
                        pendingDeleteTarget.name?.includes('Starter') || 
                        pendingDeleteTarget.name?.includes('Kezdő minta') ||
                        pendingDeleteTarget.isStarter;

      // 1. Törlési modál azonnali bezárása
      closeDeleteModal();

      // 2. Végleges törlés a perzisztens tárolóból és adatbázisból (LocalStorage, Firestore)
      await deleteList(targetListId);

      // 3. Globális állapot azonnali tisztítása (ha épp ezt a feladatot gyakorolják vagy szerkesztik)
      if (currentPracticeSession && currentPracticeSession.list && currentPracticeSession.list.id === targetListId) {
        currentPracticeSession = null;
        if (!dom.viewPractice.classList.contains('hidden')) {
          navigateTo('#dashboard');
        }
      }

      if (activeManageListId === targetListId) {
        activeManageListId = null;
        closeManageModal();
      }

      // 4. Azonnali UI és Statisztika frissítés oldalújratöltés nélkül
      await renderDashboard();
      await renderStatsView();

      // 5. Megerősítő toast visszajelzés
      showToast(
        isStarter 
          ? "A kezdő minta feladat és minden kapcsolódó statisztika véglegesen törölve!" 
          : `A(z) "${targetListName}" feladat és minden statisztikája sikeresen törölve!`,
        'danger'
      );
    });
  }
}

let toastTimeout = null;
function showToast(message, type = 'success') {
  if (!dom.appToast) return;
  clearTimeout(toastTimeout);

  dom.appToastMessage.textContent = message;
  if (type === 'success') {
    dom.appToast.className = 'fixed top-20 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white border border-emerald-500 shadow-emerald-600/20 transition-all pointer-events-none animate-pop-in';
    dom.appToastIcon.innerHTML = '✓';
  } else if (type === 'danger') {
    dom.appToast.className = 'fixed top-20 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-semibold bg-rose-600 text-white border border-rose-500 shadow-rose-600/20 transition-all pointer-events-none animate-pop-in';
    dom.appToastIcon.innerHTML = '🗑️';
  } else {
    dom.appToast.className = 'fixed top-20 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-semibold bg-slate-900 text-white border border-slate-700 shadow-slate-900/20 transition-all pointer-events-none animate-pop-in';
    dom.appToastIcon.innerHTML = 'ℹ️';
  }

  dom.appToast.classList.remove('hidden');

  toastTimeout = setTimeout(() => {
    if (dom.appToast) {
      dom.appToast.classList.add('hidden');
    }
  }, 3500);
}

function openDeleteModal(list) {
  pendingDeleteTarget = list;
  const isStarter = list.id?.startsWith('starter_') || 
                    list.name?.includes('Starter') || 
                    list.name?.includes('Kezdő minta') || 
                    list.isStarter;

  if (isStarter) {
    dom.deleteConfirmTitle.textContent = "Kezdő minta feladat törlése";
    dom.deleteConfirmMessage.innerHTML = `Biztosan törölni szeretnéd a <strong>minta feladatot</strong>? Ezzel minden kapcsolódó statisztika és előzmény is végleg törlődik.`;
  } else {
    dom.deleteConfirmTitle.textContent = "Szólista végleges törlése";
    dom.deleteConfirmMessage.innerHTML = `Biztosan törölni szeretnéd a(z) <strong>"${escapeHtml(list.name)}"</strong> feladatot? Ezzel minden kapcsolódó munkalap, statisztika és előzmény is végleg törlődik.`;
  }

  dom.modalDeleteConfirm.classList.remove('hidden');
  dom.modalDeleteConfirm.classList.add('flex');
  refreshIcons();
}

function closeDeleteModal() {
  pendingDeleteTarget = null;
  if (dom.modalDeleteConfirm) {
    dom.modalDeleteConfirm.classList.add('hidden');
    dom.modalDeleteConfirm.classList.remove('flex');
  }
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

    const sheets = list.sheets || [];
    const sheetsCount = sheets.length;
    const masteredCount = sheets.filter(s => (s.consecutivePerfectScores >= 2) || (s.timesPassed >= 2)).length;
    const canMix = masteredCount > 0;

    const wordsWithPractice = (list.words || []).filter(w => (w.timesPracticed || 0) > 0);
    const practicedCount = wordsWithPractice.length;
    const progressPercent = wordCount > 0 ? Math.round((practicedCount / wordCount) * 100) : 0;

    // Sheet preview badges HTML
    const sheetsBadgesHtml = sheets.slice(0, 4).map((s, idx) => {
      const isUnl = s.isUnlocked;
      const isMast = (s.consecutivePerfectScores >= 2) || (s.timesPassed >= 2);
      const badgeClass = isMast 
        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
        : (isUnl 
            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700');
      const icon = isMast ? '⭐' : (isUnl ? '🔓' : '🔒');
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${badgeClass}" title="${escapeHtml(s.name)}">${icon} ${escapeHtml(s.name)}</span>`;
    }).join('');

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

        <!-- Munkalapok előnézete & haladás -->
        <div class="my-3 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500 dark:text-slate-400 font-medium">${wordCount} szó &bull; ${sheetsCount} munkalap</span>
            <span class="text-brand-600 dark:text-brand-400 font-semibold">${masteredCount}/${sheetsCount} elsajátítva ⭐</span>
          </div>

          <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full" style="width: ${progressPercent}%"></div>
          </div>

          <div class="flex flex-wrap gap-1 pt-1">
            ${sheetsBadgesHtml}
            ${sheets.length > 4 ? `<span class="text-[11px] text-slate-400 self-center">+${sheets.length - 4} további</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Kártya alsó gombok -->
      <div class="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
        <button class="btn-start-practice flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]" title="Gyakorlás indítása az aktív munkalapon">
          <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
          <span>Gyakorlás</span>
        </button>

        ${canMix ? `
        <button class="btn-card-mix min-h-[44px] px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1 shadow-sm" title="Mix Gyakorlás az elsajátított munkalapokból">
          <i data-lucide="shuffle" class="w-3.5 h-3.5"></i>
          <span>Mix</span>
        </button>
        ` : ''}

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

    if (canMix) {
      const cardMixBtn = card.querySelector('.btn-card-mix');
      if (cardMixBtn) {
        cardMixBtn.addEventListener('click', () => {
          startMixPractice(list.id);
        });
      }
    }

    card.querySelector('.btn-view-words').addEventListener('click', () => {
      openManageModal(list.id);
    });

    card.querySelector('.btn-export-list').addEventListener('click', () => {
      openDownloadModal(list.name, list.words || []);
    });

    card.querySelector('.btn-rename-list').addEventListener('click', async () => {
      const newName = prompt("Lista új neve:", list.name);
      if (newName && newName.trim() && newName.trim() !== list.name) {
        await updateListName(list.id, newName.trim());
        await renderDashboard();
      }
    });

    card.querySelector('.btn-delete-list').addEventListener('click', () => {
      openDeleteModal(list);
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

    if (dom.uploadSheetsCountBadge) {
      const sheetCount = (result.sheets || []).length;
      dom.uploadSheetsCountBadge.textContent = `${sheetCount} munkalap`;
    }

    if (dom.uploadSheetsPreviewTags) {
      dom.uploadSheetsPreviewTags.innerHTML = '';
      (result.sheets || []).forEach((s, idx) => {
        const tag = document.createElement('span');
        tag.className = 'px-2 py-0.5 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
        tag.textContent = `${idx === 0 ? '🔓' : '🔒'} ${s.name} (${(s.words || []).length} szó)`;
        dom.uploadSheetsPreviewTags.appendChild(tag);
      });
    }

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
// 5.5. LETÖLTÉS / EXPORT PANEL (MODAL)
// ==========================================

let activeDownloadData = null;

function openDownloadModal(listName, words) {
  activeDownloadData = { name: listName, words: words || [] };
  if (dom.downloadListNameBadge) {
    dom.downloadListNameBadge.textContent = `${listName} — ${activeDownloadData.words.length} szó`;
  }
  if (dom.downloadWordCounter) {
    dom.downloadWordCounter.textContent = `${activeDownloadData.words.length} szó`;
  }
  if (dom.downloadWordsPreviewList) {
    dom.downloadWordsPreviewList.innerHTML = '';
    if (activeDownloadData.words.length === 0) {
      dom.downloadWordsPreviewList.innerHTML = '<div class="text-xs text-slate-400 py-3 text-center whitespace-nowrap">Nincsenek szavak ebben a listában.</div>';
    } else {
      activeDownloadData.words.slice(0, 40).forEach(w => {
        const item = document.createElement('div');
        item.className = 'download-word-item flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs shadow-xs';
        item.innerHTML = `
          <span class="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0" style="white-space: nowrap !important; word-break: keep-all !important;">${escapeHtml(w.english || '')}</span>
          <span class="text-slate-400 text-[10px] shrink-0">→</span>
          <span class="text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0" style="white-space: nowrap !important; word-break: keep-all !important;">${escapeHtml(w.hungarian || '')}</span>
        `;
        dom.downloadWordsPreviewList.appendChild(item);
      });
      if (activeDownloadData.words.length > 40) {
        const more = document.createElement('div');
        more.className = 'text-center text-[11px] text-slate-400 py-1 whitespace-nowrap';
        more.textContent = `...és további ${activeDownloadData.words.length - 40} szó a letöltendő fájlban`;
        dom.downloadWordsPreviewList.appendChild(more);
      }
    }
  }

  if (dom.modalDownloadExport) {
    dom.modalDownloadExport.classList.remove('hidden');
    dom.modalDownloadExport.classList.add('flex');
  }
  refreshIcons();
}

function closeDownloadModal() {
  activeDownloadData = null;
  if (dom.modalDownloadExport) {
    dom.modalDownloadExport.classList.add('hidden');
    dom.modalDownloadExport.classList.remove('flex');
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
      <div class="flex-1 grid grid-cols-2 gap-2 mr-2 min-w-0" style="white-space: nowrap;">
        <span class="font-semibold text-slate-900 dark:text-slate-100 truncate whitespace-nowrap" style="white-space: nowrap !important; word-break: keep-all !important;">${escapeHtml(word.english)}</span>
        <span class="text-slate-600 dark:text-slate-300 truncate whitespace-nowrap" style="white-space: nowrap !important; word-break: keep-all !important;">${escapeHtml(word.hungarian)}</span>
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
// 7. GYAKORLÁSI ÉS KIKÉRDEZÉSI MÓD ENGINE (Munkalap & Mix Támogatással)
// ==========================================

async function startSheetPractice(listId, sheetId) {
  const list = await getListById(listId);
  if (!list || !list.sheets) {
    alert("Ez a lista nem található vagy nem tartalmaz munkalapokat!");
    return;
  }

  const sheet = list.sheets.find(s => s.id === sheetId);
  if (!sheet) {
    alert("A kiválasztott munkalap nem található!");
    return;
  }

  if (!sheet.isUnlocked) {
    alert("Ez a szint még zárolva van! Teljesítsd az előző munkalapot 2 egymást követő alkalommal 100%-os eredménnyel a feloldásához.");
    return;
  }

  if (!sheet.words || sheet.words.length === 0) {
    alert("Ez a munkalap nem tartalmaz szavakat a gyakorláshoz!");
    return;
  }

  currentActivePracticeConfig = { listId, sheetId, isMix: false };
  nextUnlockedSheetData = null;

  currentPracticeSession = new PracticeSession(list, {
    reverse: isReversePractice,
    soundEnabled: isSoundEnabled,
    sheetId: sheetId,
    isMix: false
  });

  dom.practiceCurrentListTitle.textContent = list.name;
  if (dom.practiceCurrentSheetTitle) dom.practiceCurrentSheetTitle.textContent = sheet.name;
  if (dom.practiceSheetBadge) dom.practiceSheetBadge.classList.remove('hidden');

  dom.practicePromptHint.textContent = isReversePractice 
    ? "Írd be a megfelelő angol kifejezést:" 
    : "Írd be a megfelelő magyar jelentést:";

  navigateTo('#practice');
  renderCurrentQuizWord();
}

async function startMixPractice(listId) {
  const list = await getListById(listId);
  if (!list || !list.sheets) {
    alert("A lista nem található!");
    return;
  }

  // Ellenőrizzük, hogy van-e legalább egy elsajátított (vagy feloldott) munkalap
  const masteredSheets = list.sheets.filter(s => 
    (s.consecutivePerfectScores >= 2) || ((s.timesPassed || 0) >= 2) || s.isUnlocked
  );

  if (masteredSheets.length === 0) {
    alert("A Mix gyakorláshoz először teljesíts legalább egy szintet 2x egymás után 100%-kal!");
    return;
  }

  currentActivePracticeConfig = { listId, sheetId: null, isMix: true };
  nextUnlockedSheetData = null;

  currentPracticeSession = new PracticeSession(list, {
    reverse: isReversePractice,
    soundEnabled: isSoundEnabled,
    sheetId: null,
    isMix: true
  });

  dom.practiceCurrentListTitle.textContent = list.name;
  if (dom.practiceCurrentSheetTitle) dom.practiceCurrentSheetTitle.textContent = "Mix (Mesterelt szintek)";
  if (dom.practiceSheetBadge) dom.practiceSheetBadge.classList.remove('hidden');

  dom.practicePromptHint.textContent = isReversePractice 
    ? "Írd be a megfelelő angol kifejezést:" 
    : "Írd be a megfelelő magyar jelentést:";

  navigateTo('#practice');
  renderCurrentQuizWord();
}

async function startPractice(listId) {
  const list = await getListById(listId);
  if (!list) {
    alert("A lista nem található!");
    return;
  }

  // Ha a lista rendelkezik munkalapokkal (új struktúra)
  if (list.sheets && list.sheets.length > 0) {
    // Keressük meg az első feloldott munkalapot, ami még nincs mesterelve (consecutivePerfectScores < 2)
    let targetSheet = list.sheets.find(s => s.isUnlocked && (s.consecutivePerfectScores || 0) < 2);
    // Ha mindegyik mesterelt, válasszuk az utolsó feloldottat vagy a legelsőt
    if (!targetSheet) {
      const unlockedSheets = list.sheets.filter(s => s.isUnlocked);
      targetSheet = unlockedSheets[unlockedSheets.length - 1] || list.sheets[0];
    }
    return startSheetPractice(listId, targetSheet.id);
  }

  // Hagyományos kompatibilitási ág (ha nem lennének munkalapok)
  if (!list.words || list.words.length === 0) {
    alert("Ez a lista nem tartalmaz szavakat a gyakorláshoz! Tölts fel vagy adj hozzá szavakat.");
    return;
  }

  currentActivePracticeConfig = { listId, sheetId: null, isMix: false };
  nextUnlockedSheetData = null;

  currentPracticeSession = new PracticeSession(list, {
    reverse: isReversePractice,
    soundEnabled: isSoundEnabled
  });

  dom.practiceCurrentListTitle.textContent = list.name;
  if (dom.practiceSheetBadge) dom.practiceSheetBadge.classList.add('hidden');
  dom.practicePromptHint.textContent = isReversePractice 
    ? "Írd be a megfelelő angol kifejezést:" 
    : "Írd be a megfelelő magyar jelentést:";

  navigateTo('#practice');
  renderCurrentQuizWord();
}

function renderCurrentQuizWord() {
  clearAutoAdvance();
  if (!currentPracticeSession) return;

  const word = currentPracticeSession.nextWord();
  if (!word) {
    if (currentPracticeSession.isRoundComplete()) {
      onPracticeRoundFinished();
    } else {
      alert("A kör véget ért!");
      navigateTo('#dashboard');
    }
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
  dom.quizCard.className = 'quiz-card bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 p-6 sm:p-12 shadow-xl shadow-slate-200/40 dark:shadow-none text-center relative overflow-hidden transition-all duration-300';
  dom.practiceFeedbackContainer.classList.add('hidden');
  dom.practiceFeedbackContainer.innerHTML = '';
  dom.practiceBtnText.textContent = 'Ellenőrzés';
  dom.btnPracticeSubmit.className = 'w-full min-h-[50px] py-3.5 px-6 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-base shadow-lg shadow-brand-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2';
}

async function handlePracticeAction() {
  if (!currentPracticeSession) return;

  // Ha épp a kiértékelést nézi a felhasználó (CORRECT vagy INCORRECT állapot), a gombnyomás a következő szóra / lezárásra visz
  if (currentPracticeSession.state === 'INCORRECT' || currentPracticeSession.state === 'CORRECT') {
    clearAutoAdvance();
    if (currentPracticeSession.isRoundComplete()) {
      await onPracticeRoundFinished();
    } else {
      renderCurrentQuizWord();
    }
    return;
  }

  const answer = dom.practiceAnswerInput.value.trim();
  if (!answer) {
    dom.practiceAnswerInput.focus();
    return;
  }

  dom.practiceAnswerInput.disabled = true;
  const result = await currentPracticeSession.checkAnswer(answer);
  if (!result) {
    dom.practiceAnswerInput.disabled = false;
    return;
  }

  updatePracticeStatsUI();

  if (result.isCorrect) {
    // === HELYES VÁLASZ ===
    dom.quizCard.classList.remove('border-slate-200', 'dark:border-slate-800');
    dom.quizCard.classList.add('border-emerald-500', 'dark:border-emerald-500', 'animate-bounce-success');

    if (result.hasTypo) {
      dom.practiceFeedbackContainer.className = 'p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/70 text-amber-900 dark:text-amber-200 animate-pop-in flex flex-col sm:flex-row sm:items-center justify-between gap-2';
      dom.practiceFeedbackContainer.innerHTML = `
        <div class="flex flex-wrap items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
          <span class="text-xl">👌</span>
          <span>Elfogadva (apró elütés)!</span>
          <span class="text-xs font-normal text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
            Pontosan: <strong>${escapeHtml(result.correctAnswer)}</strong>
          </span>
        </div>
        <div class="text-xs text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 shrink-0">
          <span>Továbbugrás...</span>
          <kbd class="px-1.5 py-0.5 text-[10px] bg-amber-200/60 dark:bg-amber-800/60 rounded">Enter</kbd>
        </div>
      `;
    } else {
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
    }

    dom.btnPracticeSubmit.className = 'w-full min-h-[50px] py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2';
    dom.practiceBtnText.textContent = result.isRoundFinished ? 'Kör befejezése' : 'Következő szó';

    if (result.stats.streak > 0 && result.stats.streak % 5 === 0 && window.confetti) {
      window.confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    }

    clearAutoAdvance();
    autoAdvanceTimeout = setTimeout(async () => {
      if (currentPracticeSession && currentPracticeSession.state === 'CORRECT') {
        if (currentPracticeSession.isRoundComplete()) {
          await onPracticeRoundFinished();
        } else {
          renderCurrentQuizWord();
        }
      }
    }, result.hasTypo ? 1500 : 900);

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

    dom.btnPracticeSubmit.className = 'w-full min-h-[50px] py-3.5 px-6 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-base shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2';
    dom.practiceBtnText.textContent = result.isRoundFinished ? 'Kör befejezése' : 'Következő szó';

    refreshIcons();
    dom.btnPracticeSubmit.focus();
  }
}

async function onPracticeRoundFinished() {
  clearAutoAdvance();
  if (!currentPracticeSession) return;

  const isPerfect = currentPracticeSession.isPerfectScore();
  const stats = currentPracticeSession.stats;
  const { listId, sheetId } = currentActivePracticeConfig;

  let sheetProgressResult = null;
  if (listId && sheetId) {
    sheetProgressResult = await updateSheetProgress(listId, sheetId, {
      correctCount: stats.correctCount,
      incorrectCount: stats.incorrectCount,
      isPerfect: isPerfect
    });
  }

  await showRoundCompletedModal(sheetProgressResult);
}

async function showRoundCompletedModal(sheetProgressResult) {
  if (!dom.modalRoundCompleted) return;

  const stats = currentPracticeSession ? currentPracticeSession.stats : { correctCount: 0, totalAnswered: 0 };
  const pct = stats.totalAnswered > 0 ? Math.round((stats.correctCount / stats.totalAnswered) * 100) : 0;
  const isPerfect = currentPracticeSession ? currentPracticeSession.isPerfectScore() : false;

  dom.roundScorePercent.textContent = `${pct}%`;
  dom.roundScoreRatio.textContent = `${stats.correctCount} / ${stats.totalAnswered}`;

  if (sheetProgressResult) {
    if (sheetProgressResult.unlockedNextSheet) {
      // 2 egymást követő 100% elérve és következő szint feloldva!
      dom.roundCompletedBadgeIcon.textContent = '🏆';
      dom.roundCompletedTitle.textContent = 'Szint Feloldva! 🎉';
      dom.roundCompletedSubtitle.textContent = 'Kétszer egymás után 100%-os eredménnyel zártad a munkalapot!';
      
      dom.roundProgressionBox.className = 'p-4 rounded-2xl text-left text-xs space-y-1.5 border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100';
      dom.roundProgressionBox.innerHTML = `
        <div class="font-bold flex items-center gap-1.5 text-sm mb-1 text-emerald-700 dark:text-emerald-300">
          <i data-lucide="unlock" class="w-4 h-4"></i>
          <span>Új szint elérhető: <strong>${escapeHtml(sheetProgressResult.nextSheetName)}</strong></span>
        </div>
        <p class="leading-relaxed">Sikeresen teljesítetted a feloldási feltételt (2 egymást követő 100%-os kör). A következő munkalap zárolása feloldódott és azonnal gyakorolható!</p>
      `;

      // Következő munkalap beállítása
      const list = await getListById(currentActivePracticeConfig.listId);
      if (list && list.sheets) {
        const nextSheet = list.sheets.find(s => s.name === sheetProgressResult.nextSheetName);
        if (nextSheet) {
          nextUnlockedSheetData = { listId: list.id, sheetId: nextSheet.id };
        }
      }

      if (dom.btnRoundNextLevel) {
        dom.btnRoundNextLevel.classList.remove('hidden');
        const btnSpan = dom.btnRoundNextLevel.querySelector('span');
        if (btnSpan) btnSpan.textContent = `Következő szint: ${sheetProgressResult.nextSheetName}`;
      }

      if (window.confetti) {
        window.confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
      }

    } else if (sheetProgressResult.consecutivePerfectScores === 1) {
      // 1 db 100%-os kör teljesítve
      dom.roundCompletedBadgeIcon.textContent = '🔥';
      dom.roundCompletedTitle.textContent = 'Hibátlan Kör! (1 / 2)';
      dom.roundCompletedSubtitle.textContent = 'Már csak 1 hibátlan kör kell a következő szint feloldásához!';

      dom.roundProgressionBox.className = 'p-4 rounded-2xl text-left text-xs space-y-1.5 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100';
      dom.roundProgressionBox.innerHTML = `
        <div class="font-bold flex items-center gap-1.5 text-sm mb-1 text-amber-700 dark:text-amber-300">
          <i data-lucide="flame" class="w-4 h-4"></i>
          <span>Hibátlan sorozat: <strong>1 / 2 teljesítve</strong></span>
        </div>
        <p class="leading-relaxed">Kiváló! A következő szint feloldásához még egy egymást követő hibátlan (100%) gyakorlás szükséges.</p>
      `;

      if (dom.btnRoundNextLevel) dom.btnRoundNextLevel.classList.add('hidden');
      nextUnlockedSheetData = null;

    } else if (isPerfect && sheetProgressResult.isMastered) {
      // Korábban már elsajátított szint újbóli 100%-os teljesítése
      dom.roundCompletedBadgeIcon.textContent = '⭐';
      dom.roundCompletedTitle.textContent = 'Mesterelt Munkalap!';
      dom.roundCompletedSubtitle.textContent = 'Ezt a munkalapot már sikeresen elsajátítottad!';

      dom.roundProgressionBox.className = 'p-4 rounded-2xl text-left text-xs space-y-1.5 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100';
      dom.roundProgressionBox.innerHTML = `
        <div class="font-bold flex items-center gap-1.5 text-sm mb-1 text-indigo-700 dark:text-indigo-300">
          <i data-lucide="award" class="w-4 h-4"></i>
          <span>Elsajátított munkalap</span>
        </div>
        <p class="leading-relaxed">A munkalap szavai szerepelnek az összesített Mix Gyakorlásban is.</p>
      `;

      if (dom.btnRoundNextLevel) dom.btnRoundNextLevel.classList.add('hidden');
      nextUnlockedSheetData = null;

    } else {
      // Volt legalább 1 hiba -> sorozat nullázódott (0/2)
      dom.roundCompletedBadgeIcon.textContent = '💪';
      dom.roundCompletedTitle.textContent = 'Kör Befejezve';
      dom.roundCompletedSubtitle.textContent = 'Gyakorolj újra a 100%-os eredményért!';

      dom.roundProgressionBox.className = 'p-4 rounded-2xl text-left text-xs space-y-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300';
      dom.roundProgressionBox.innerHTML = `
        <div class="font-bold flex items-center gap-1.5 text-sm mb-1 text-slate-900 dark:text-white">
          <i data-lucide="info" class="w-4 h-4 text-amber-500"></i>
          <span>A feloldáshoz 2 egymást követő 100% szükséges</span>
        </div>
        <p class="leading-relaxed">Mivel hiba történt a körben, a számláló 0-ra állt vissza (0 / 2). Fuss neki újra a hibátlan eredményért!</p>
      `;

      if (dom.btnRoundNextLevel) dom.btnRoundNextLevel.classList.add('hidden');
      nextUnlockedSheetData = null;
    }
  } else {
    // Mix mód vagy általános lista
    if (isPerfect) {
      dom.roundCompletedBadgeIcon.textContent = '🌟';
      dom.roundCompletedTitle.textContent = 'Tökéletes Mix Kör!';
      dom.roundCompletedSubtitle.textContent = 'Minden szót hibátlanul megválaszoltál a feladatokból!';

      dom.roundProgressionBox.className = 'p-4 rounded-2xl text-left text-xs space-y-1.5 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100';
      dom.roundProgressionBox.innerHTML = `
        <div class="font-bold flex items-center gap-1.5 text-sm mb-1 text-emerald-700 dark:text-emerald-300">
          <i data-lucide="sparkles" class="w-4 h-4"></i>
          <span>Kiváló tudásmélyítés!</span>
        </div>
        <p class="leading-relaxed">Az elsajátított munkalapok szavait biztosan tudod.</p>
      `;
    } else {
      dom.roundCompletedBadgeIcon.textContent = '🎯';
      dom.roundCompletedTitle.textContent = 'Mix Gyakorlás Befejezve';
      dom.roundCompletedSubtitle.textContent = 'Átismételted az aktív munkalapok szavait!';

      dom.roundProgressionBox.className = 'p-4 rounded-2xl text-left text-xs space-y-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300';
      dom.roundProgressionBox.innerHTML = `
        <div class="font-bold flex items-center gap-1.5 text-sm mb-1 text-slate-900 dark:text-white">
          <i data-lucide="rotate-ccw" class="w-4 h-4 text-brand-500"></i>
          <span>Gyakorlás teszi a mestert</span>
        </div>
        <p class="leading-relaxed">Bármikor újrakezdheted a mixelést az ismeretek felfrissítéséhez.</p>
      `;
    }

    if (dom.btnRoundNextLevel) dom.btnRoundNextLevel.classList.add('hidden');
    nextUnlockedSheetData = null;
  }

  dom.modalRoundCompleted.classList.remove('hidden');
  dom.modalRoundCompleted.classList.add('flex');
  refreshIcons();
}

function closeRoundCompletedModal() {
  if (dom.modalRoundCompleted) {
    dom.modalRoundCompleted.classList.add('hidden');
    dom.modalRoundCompleted.classList.remove('flex');
  }
}

function updatePracticeStatsUI() {
  if (!currentPracticeSession) return;
  const stats = currentPracticeSession.stats;
  dom.practiceStreakCounter.textContent = stats.streak;
  dom.practiceCorrectCount.textContent = stats.correctCount;
  dom.practiceTotalCount.textContent = stats.totalAnswered;

  const prog = currentPracticeSession.getProgress();
  if (dom.practiceRoundProgress) {
    dom.practiceRoundProgress.textContent = `${prog.current} / ${prog.total}`;
  }
}

function clearAutoAdvance() {
  if (autoAdvanceTimeout) {
    clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }
}

// ==========================================
// 7.5. MUNKALAP-SZINTŰ STATISZTIKA NÉZET
// ==========================================

async function renderStatsView() {
  if (!dom.statsListsContainer) return;

  const lists = await getUserLists();
  if (!lists || lists.length === 0) {
    dom.statsEmptyState.classList.remove('hidden');
    dom.statsListsContainer.innerHTML = '';
    if (dom.statsTotalFiles) dom.statsTotalFiles.textContent = '0';
    if (dom.statsTotalSheets) dom.statsTotalSheets.textContent = '0';
    if (dom.statsMasteredSheets) dom.statsMasteredSheets.textContent = '0';
    if (dom.statsAvgAccuracy) dom.statsAvgAccuracy.textContent = '0%';
    return;
  }

  dom.statsEmptyState.classList.add('hidden');
  dom.statsListsContainer.innerHTML = '';

  let totalFiles = lists.length;
  let totalSheets = 0;
  let masteredCount = 0;
  let grandCorrect = 0;
  let grandIncorrect = 0;

  lists.forEach((list) => {
    const sheets = list.sheets || [];
    totalSheets += sheets.length;

    // Ellenőrizzük van-e mesterelt lap a Mix gombhoz
    const canMix = sheets.some(s => (s.consecutivePerfectScores >= 2) || ((s.timesPassed || 0) >= 2));

    const listCard = document.createElement('div');
    listCard.className = 'bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm';

    listCard.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <i data-lucide="file-spreadsheet" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">${escapeHtml(list.name)}</h3>
            <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span>${sheets.length} munkalap</span>
              <span>&bull;</span>
              <span>${list.words?.length || 0} szó összesen</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 self-start sm:self-auto">
          ${canMix ? `
          <button class="btn-stats-mix min-h-[40px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95" title="Mix gyakorlás a mesterelt munkalapokból">
            <i data-lucide="shuffle" class="w-3.5 h-3.5"></i>
            <span>Mix Gyakorlás</span>
          </button>
          ` : ''}
          <button class="btn-stats-start-all min-h-[40px] px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95" title="Gyakorlás indítása az aktuális munkalapon">
            <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
            <span>Gyakorlás</span>
          </button>
        </div>
      </div>

      <!-- Munkalapok rácsa -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sheets-grid">
        <!-- Sheet kártyák -->
      </div>
    `;

    const sheetsGrid = listCard.querySelector('.sheets-grid');

    sheets.forEach((sheet, idx) => {
      const correct = sheet.totalCorrect || 0;
      const incorrect = sheet.totalIncorrect || 0;
      const totalAnswers = correct + incorrect;
      const accuracy = totalAnswers > 0 ? Math.round((correct / totalAnswers) * 100) : 0;
      const isMastered = (sheet.consecutivePerfectScores >= 2) || ((sheet.timesPassed || 0) >= 2);
      
      if (isMastered) masteredCount++;
      grandCorrect += correct;
      grandIncorrect += incorrect;

      const isUnlocked = !!sheet.isUnlocked;
      const streak = sheet.consecutivePerfectScores || 0;

      let badgeHtml = '';
      if (!isUnlocked) {
        badgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"><i data-lucide="lock" class="w-3 h-3"></i> Zárolva</span>`;
      } else if (isMastered) {
        badgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"><i data-lucide="award" class="w-3 h-3"></i> Elsajátítva</span>`;
      } else {
        badgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"><i data-lucide="flame" class="w-3 h-3"></i> Sorozat: ${streak}/2</span>`;
      }

      const sheetCard = document.createElement('div');
      sheetCard.className = `p-4 rounded-2xl border transition-all ${
        !isUnlocked 
          ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75' 
          : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 shadow-sm hover:border-brand-300 dark:hover:border-brand-700'
      }`;

      sheetCard.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2 truncate">
            <span class="text-xs font-bold text-slate-400 font-mono">#${idx + 1}</span>
            <h4 class="font-bold text-slate-900 dark:text-white text-sm truncate" title="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</h4>
          </div>
          ${badgeHtml}
        </div>

        <div class="space-y-2 mb-3 text-xs">
          <div>
            <div class="flex items-center justify-between text-slate-600 dark:text-slate-300 font-medium mb-1">
              <span>Találati arány:</span>
              <span class="font-bold ${accuracy >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}">${accuracy}%</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500 ${accuracy >= 80 ? 'bg-emerald-500' : 'bg-brand-500'}" style="width: ${accuracy}%"></div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <div>Szavak: <strong class="text-slate-700 dark:text-slate-200">${sheet.words?.length || 0} db</strong></div>
            <div>Gyakorolva: <strong class="text-slate-700 dark:text-slate-200">${sheet.timesPracticed || 0}x</strong></div>
            <div class="text-emerald-600 dark:text-emerald-400">Helyes: <strong>${correct}</strong></div>
            <div class="text-rose-600 dark:text-rose-400">Hibás: <strong>${incorrect}</strong></div>
          </div>
        </div>

        <div>
          ${isUnlocked ? `
          <button class="btn-sheet-practice w-full min-h-[40px] py-2 px-3 rounded-xl bg-slate-100 hover:bg-brand-600 hover:text-white dark:bg-slate-700/80 dark:hover:bg-brand-600 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]">
            <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
            <span>Munkalap gyakorlása</span>
          </button>
          ` : `
          <div class="w-full min-h-[40px] py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 font-medium text-xs flex items-center justify-center gap-1.5 cursor-not-allowed">
            <i data-lucide="lock" class="w-3.5 h-3.5"></i>
            <span>Zárolt (Előző szint 2x 100%)</span>
          </div>
          `}
        </div>
      `;

      if (isUnlocked) {
        sheetCard.querySelector('.btn-sheet-practice').addEventListener('click', () => {
          startSheetPractice(list.id, sheet.id);
        });
      }

      sheetsGrid.appendChild(sheetCard);
    });

    // Fejléc gombok eseménykezelői
    listCard.querySelector('.btn-stats-start-all').addEventListener('click', () => {
      startPractice(list.id);
    });

    if (canMix) {
      const mixBtn = listCard.querySelector('.btn-stats-mix');
      if (mixBtn) {
        mixBtn.addEventListener('click', () => {
          startMixPractice(list.id);
        });
      }
    }

    dom.statsListsContainer.appendChild(listCard);
  });

  // Összesített statisztikai kártyák frissítése
  if (dom.statsTotalFiles) dom.statsTotalFiles.textContent = totalFiles;
  if (dom.statsTotalSheets) dom.statsTotalSheets.textContent = totalSheets;
  if (dom.statsMasteredSheets) dom.statsMasteredSheets.textContent = masteredCount;
  
  const grandTotal = grandCorrect + grandIncorrect;
  const overallAvg = grandTotal > 0 ? Math.round((grandCorrect / grandTotal) * 100) : 0;
  if (dom.statsAvgAccuracy) dom.statsAvgAccuracy.textContent = `${overallAvg}%`;

  refreshIcons();
}

// ==========================================
// 7.6. DINAMIKUS FEJLÉC ELREJTÉSE GÖRGETÉSKOR
// ==========================================

function setupHeaderScrollHide() {
  const header = document.getElementById('app-header') || document.querySelector('header');
  if (!header) return;

  function getScrollPosition(e) {
    let y = window.scrollY || 
            window.pageYOffset || 
            document.documentElement.scrollTop || 
            document.body.scrollTop || 
            0;

    if (e && e.target && e.target !== document && e.target !== window && typeof e.target.scrollTop === 'number') {
      y = Math.max(y, e.target.scrollTop);
    }
    return Math.max(0, y);
  }

  let lastScrollY = getScrollPosition();

  function handleScroll(e) {
    const currentScrollY = getScrollPosition(e);
    const delta = currentScrollY - lastScrollY;

    // 1. Lap tetején (scrollY <= 10) mindig legyen látható
    if (currentScrollY <= 10) {
      header.classList.remove('header-hidden');
    } 
    // 2. Lefelé görgetés: ha lefelé haladunk és meghaladtuk a fejléc magasságát (50px)
    else if (delta > 4 && currentScrollY > 50) {
      header.classList.add('header-hidden');
    } 
    // 3. Felfelé görgetés: azonnal csússzon vissza
    else if (delta < -4) {
      header.classList.remove('header-hidden');
    }

    lastScrollY = currentScrollY;
  }

  // Eseményfigyelők regisztrálása capture fázissal is, hogy bármely belső tároló görgetését is érzékelje
  window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
  document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
  if (document.body) {
    document.body.addEventListener('scroll', handleScroll, { passive: true });
  }

  const mainEl = document.querySelector('main');
  if (mainEl) {
    mainEl.addEventListener('scroll', handleScroll, { passive: true });
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
