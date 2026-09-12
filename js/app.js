/**
 * WL (Word Learning) - Fő Alkalmazásvezérlő és Router (Route Guards) - JAVÍTOTT VÁLTOZAT
 */

import { 
  initAuth, 
  register, 
  login, 
  loginAsGuest, 
  loginWithGoogleCredential,
  loginWithGooglePopup,
  startFirebaseGoogleRedirect,
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
  updateSheetProgress,
  syncMultiDeviceCloud,
  setupRealtimeCloudListener
} from './storage.js';

import { 
  hasValidGoogleClientId,
  startGoogleRedirectAuth,
  checkAndProcessOAuthCallback,
  getGoogleClientId
} from './googleAuth.js';

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
import { 
  connectGoogleDriveList, 
  syncGoogleDriveList, 
  linkExistingListToGoogleDrive, 
  checkAllGoogleDriveListsOnStartup 
} from './googleDrive.js';

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
  userProfileBadgeBtn: document.getElementById('user-profile-badge-btn'),
  userProfileAvatar: document.getElementById('user-profile-avatar'),
  userProfileIcon: document.getElementById('user-profile-icon'),
  userEmailDisplay: document.getElementById('user-email-display'),
  userBadge: document.getElementById('user-badge'),
  btnLogout: document.getElementById('btn-logout'),

  // Mobile Bottom Nav
  mobileBottomNav: document.getElementById('mobile-bottom-nav'),
  bottomNavHome: document.getElementById('bottom-nav-home'),
  bottomNavLists: document.getElementById('bottom-nav-lists'),
  bottomNavStats: document.getElementById('bottom-nav-stats'),

  // Auth View
  authProtectedNotice: document.getElementById('auth-protected-notice'),
  tabLogin: document.getElementById('tab-login'),
  tabRegister: document.getElementById('tab-register'),
  googleBtnContainer: document.getElementById('google-btn-container'),
  btnGoogleSignin: document.getElementById('btn-google-signin'),
  btnGoogleText: document.getElementById('btn-google-text'),
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
  cloudSyncStatusBadge: document.getElementById('cloud-sync-status-badge'),
  cloudSyncStatusText: document.getElementById('cloud-sync-status-text'),
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
  appToastIcon: document.getElementById('app-toast-icon'),

  // Google Drive / Sheets Modal & Badges
  btnOpenGDriveModal: document.getElementById('btn-open-gdrive-modal'),
  modalGDriveConnect: document.getElementById('modal-gdrive-connect'),
  btnCloseGDriveModal: document.getElementById('btn-close-gdrive-modal'),
  btnCancelGDrive: document.getElementById('btn-cancel-gdrive'),
  formGDriveConnect: document.getElementById('form-gdrive-connect'),
  gdriveLinkInput: document.getElementById('gdrive-link-input'),
  gdriveCustomName: document.getElementById('gdrive-custom-name'),
  gdriveTargetListId: document.getElementById('gdrive-target-list-id'),
  gdriveNameGroup: document.getElementById('gdrive-name-group'),
  gdriveSheetNames: document.getElementById('gdrive-sheet-names'),
  btnSubmitGDrive: document.getElementById('btn-submit-gdrive'),
  iconGDriveSubmit: document.getElementById('icon-gdrive-submit'),
  textGDriveSubmit: document.getElementById('text-gdrive-submit'),
  gdriveModalAlert: document.getElementById('gdrive-modal-alert'),
  gdriveAlertIcon: document.getElementById('gdrive-alert-icon'),
  gdriveAlertMessage: document.getElementById('gdrive-alert-message'),
  practiceNewWordBadge: document.getElementById('practice-new-word-badge')
};

// ==========================================
// 1. INICIALIZÁLÁS ÉS TÉMAKEZELÉS
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  initPWA();
  refreshIcons();

  // Azonnali munkamenet-ellenőrzés
  const savedSessionRaw = localStorage.getItem('wl_current_session');
  if (savedSessionRaw) {
    try {
      const savedUser = JSON.parse(savedSessionRaw);
      if (savedUser && savedUser.uid) {
        activeUser = savedUser;
        updateNavForUser(savedUser);
      }
    } catch (e) {
      activeUser = null;
      updateNavForUser(null);
    }
  } else {
    updateNavForUser(null);
  }

  // Hitelesítés inicializálása
  const authStatus = await initAuth();
  updateFirebaseStatusUI(authStatus.isFirebase);

  // Google OAuth 2.0 Átirányításos visszatérés
  try {
    const oAuthResult = checkAndProcessOAuthCallback();
    if (oAuthResult) {
      showToast("Google fiók sikeresen azonosítva! Bejelentkezés...", "info");
      await loginWithGoogleCredential(oAuthResult.idToken, oAuthResult);
      navigateTo('#dashboard');
    }
  } catch (oauthErr) {
    console.error("Google OAuth callback hiba:", oauthErr);
    showAuthError(oauthErr.message || "A Google bejelentkezés nem sikerült.");
  }

  // Hash-alapú router figyelése
  window.addEventListener('hashchange', handleRouting);

  // Felhasználó állapotának figyelése
  onAuthStateChangedCustom(async (user) => {
    activeUser = user;
    updateNavForUser(user);

    if (user) {
      let hash = window.location.hash || '';
      if (hash.startsWith('#/')) hash = '#' + hash.substring(2);
      if (hash === '#') hash = '';

      const isLandingOrAuth = !hash || hash === '#landing' || hash === '#home' || hash === '#auth' || hash === '#how-it-works' || hash === '#features' || hash === '#faq';

      if (isLandingOrAuth) {
        navigateTo('#dashboard');
      } else {
        handleRouting();
      }

      // Központi többeszközös felhőszinkronizáció
      syncMultiDeviceCloud(user).then(async (syncedLists) => {
        if (syncedLists && syncedLists.length > 0 && !dom.viewDashboard.classList.contains('hidden')) {
          await renderDashboard();
        }
      }).catch(err => console.warn("Többeszközös szinkronizáció figyelmeztetés:", err));

      // Valós idejű szinkronizációs figyelő
      if (window._realtimeCloudUnsubscribe) {
        window._realtimeCloudUnsubscribe();
        window._realtimeCloudUnsubscribe = null;
      }
      window._realtimeCloudUnsubscribe = setupRealtimeCloudListener(user, async () => {
        if (!dom.viewDashboard.classList.contains('hidden')) {
          await renderDashboard();
        }
        if (dom.viewStats && !dom.viewStats.classList.contains('hidden')) {
          await renderStatsView();
        }
      });

      // Google Drive indulási ellenőrzés
      checkAllGoogleDriveListsOnStartup(async (syncResult) => {
        if (!dom.viewDashboard.classList.contains('hidden')) {
          await renderDashboard();
        }
        if (syncResult && syncResult.newWordsCount > 0) {
          showToast(`Google Táblázat: ${syncResult.newWordsCount} új szó szinkronizálva!`, 'info');
        }
      });
    } else {
      if (window._realtimeCloudUnsubscribe) {
        window._realtimeCloudUnsubscribe();
        window._realtimeCloudUnsubscribe = null;
      }
      handleRouting();
    }
    refreshIcons();
  });

  window.addEventListener('gdrive-synced', async () => {
    if (!dom.viewDashboard.classList.contains('hidden')) {
      await renderDashboard();
    }
  });

  // Első routing futtatás
  handleRouting();
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
  } else {
    dom.firebaseStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 absolute top-1.5 right-1.5 ring-2 ring-white dark:ring-slate-900 inline-block';
    dom.firebaseStatusText.textContent = 'Helyi tároló';
  }
}

// FEJLÉC ÉS GOMBOK SZIGORÚ SZÉTVÁLASZTÁSA
function updateNavForUser(user) {
  if (user) {
    document.body.classList.add('logged-in');
    document.body.classList.remove('logged-out');

    // Bejelentkezve a logó mindenhol látható
    if (dom.navLogo) {
      dom.navLogo.classList.remove('hidden');
      dom.navLogo.classList.add('flex');
    }

    // Vendég gombok teljes eltüntetése
    dom.publicAuthButtons.classList.add('hidden');
    dom.publicAuthButtons.classList.remove('flex');

    if (dom.publicNavLinks) {
      dom.publicNavLinks.classList.add('hidden');
      dom.publicNavLinks.classList.remove('md:flex');
    }
    const footerLinks = document.getElementById('footer-public-links');
    if (footerLinks) footerLinks.classList.add('hidden');

    // Bejelentkezett menü megjelenítése (Narancssárga Fiók gomb és profil)
    dom.userProfileMenu.classList.remove('hidden');
    dom.userProfileMenu.classList.add('flex');

    // Ha van külön Fiók gombod kijelentkezve, azt itt rejtjük
    if (dom.navBtnRegister) {
      dom.navBtnRegister.classList.add('hidden');
    }

    dom.userEmailDisplay.textContent = user.displayName || user.email || 'Vendég';
    dom.userBadge.textContent = user.isGoogle ? 'Google fiók' : (user.isGuest ? 'Vendég mód' : 'Helyi profil');
    
    if (dom.userProfileAvatar && dom.userProfileIcon) {
      if (user.photoURL) {
        dom.userProfileAvatar.src = user.photoURL;
        dom.userProfileAvatar.classList.remove('hidden');
        dom.userProfileIcon.classList.add('hidden');
      } else {
        dom.userProfileAvatar.classList.add('hidden');
        dom.userProfileAvatar.src = '';
        dom.userProfileIcon.classList.remove('hidden');
      }
    }
  } else {
    document.body.classList.remove('logged-in');
    document.body.classList.add('logged-out');

    // Kijelentkezve mobilon NINCS logó, PC-n van
    if (dom.navLogo) {
      dom.navLogo.classList.add('hidden');
      dom.navLogo.classList.add('md:flex');
      dom.navLogo.classList.remove('flex');
    }

    // Csak a kék Bejelentkezés gomb látszódhat, a narancssárga Fiók NEM!
    dom.publicAuthButtons.classList.remove('hidden');
    dom.publicAuthButtons.classList.add('flex');
    
    if (dom.navBtnLogin) {
      dom.navBtnLogin.classList.remove('hidden');
    }
    if (dom.navBtnRegister) {
      dom.navBtnRegister.classList.add('hidden'); // Vendégként ne legyen kint a Fiók gomb!
    }

    if (dom.publicNavLinks) {
      dom.publicNavLinks.classList.add('hidden');
      dom.publicNavLinks.classList.add('md:flex');
      dom.publicNavLinks.classList.remove('flex');
    }
    const footerLinks = document.getElementById('footer-public-links');
    if (footerLinks) footerLinks.classList.remove('hidden');

    // Bejelentkezett menü elrejtése
    dom.userProfileMenu.classList.add('hidden');
    dom.userProfileMenu.classList.remove('flex');
  }

  // Fogaskerék garantált végleges kiirtása
  if (dom.btnOpenFirebaseSettings) {
    dom.btnOpenFirebaseSettings.remove();
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
  if (hash.startsWith('#/')) hash = '#' + hash.substring(2);
  if (hash === '#') hash = '';

  const isHomeOrLanding = !hash || hash === '#landing' || hash === '#home' || hash === '#how-it-works' || hash === '#features' || hash === '#faq';

  if (!activeUser) {
    activeUser = getCurrentUser();
    updateNavForUser(activeUser);
  }

  // Bejelentkezve nincs kezdőlap, azonnal dashboard
  if (activeUser) {
    if (isHomeOrLanding || hash === '#auth') {
      navigateTo('#dashboard');
      return;
    }
  }

  // Szólisták / Dashboard védelme
  if (hash === '#dashboard' || hash === '#szolistak' || hash === '#lists' || hash === '#practice') {
    if (!activeUser) {
      dom.authProtectedNotice.classList.remove('hidden');
      showView('auth');
      return;
    }

    if (hash === '#practice' && !currentPracticeSession) {
      navigateTo('#dashboard');
      return;
    }

    showView(hash === '#practice' ? 'practice' : 'dashboard');
    return;
  }

  // Statisztika védelme
  if (hash === '#stats' || hash === '#statistics' || hash === '#statisztika') {
    if (!activeUser) {
      dom.authProtectedNotice.classList.remove('hidden');
      showView('auth');
      return;
    }
    showView('stats');
    return;
  }

  // Auth oldal vendégeknek
  if (hash === '#auth') {
    if (activeUser) {
      navigateTo('#dashboard');
      return;
    }
    dom.authProtectedNotice.classList.add('hidden');
    showView('auth');
    return;
  }

  // Alapértelmezett ág
  if (activeUser) {
    showView('dashboard');
  } else {
    showView('landing');
  }
}

// SZIGORÚ NÉZETSZÉTVÁLASZTÁS
function showView(viewName) {
  const user = activeUser || getCurrentUser();
  const isAuthenticated = Boolean(user && user.uid);

  let targetView = viewName;
  if (!isAuthenticated) {
    if (targetView !== 'auth') {
      targetView = 'landing';
    }
  } else {
    if (targetView === 'landing' || targetView === 'auth') {
      targetView = 'dashboard';
    }
  }

  // 1. MINDEN NÉZETET ELREJTÜNK
  dom.viewLanding.classList.add('hidden');
  dom.viewAuth.classList.add('hidden');
  dom.viewDashboard.classList.add('hidden');
  dom.viewPractice.classList.add('hidden');
  if (dom.viewStats) dom.viewStats.classList.add('hidden');

  // 2. KIZÁRÓLAG AZ EGYETLEN ENGEDÉLYEZETT NÉZET JELENIK MEG
  if (targetView === 'landing') {
    dom.viewLanding.classList.remove('hidden');
  } else if (targetView === 'auth') {
    dom.viewAuth.classList.remove('hidden');
  } else if (targetView === 'dashboard') {
    dom.viewDashboard.classList.remove('hidden');
    renderDashboard(); // Csak ekkor hívjuk meg!
  } else if (targetView === 'stats') {
    if (dom.viewStats) {
      dom.viewStats.classList.remove('hidden');
      renderStatsView();
    }
  } else if (targetView === 'practice') {
    dom.viewPractice.classList.remove('hidden');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  refreshIcons();
}

// ==========================================
// 3. ESEMÉNYKEZELŐK REGISZTRÁLÁSA
// ==========================================

function setupEventListeners() {
  dom.btnThemeToggle.addEventListener('click', toggleTheme);
  
  dom.navLogo.addEventListener('click', () => {
    if (activeUser) {
      navigateTo('#dashboard');
    } else {
      navigateTo('#landing');
    }
  });

  if (dom.navBtnDashboard) {
    dom.navBtnDashboard.addEventListener('click', () => navigateTo('#dashboard'));
  }

  if (dom.navBtnStats) {
    dom.navBtnStats.addEventListener('click', () => navigateTo('#stats'));
  }

  // Kijelentkezés
  dom.btnLogout.addEventListener('click', async () => {
    if (confirm("Biztosan ki szeretnél jelentkezni?")) {
      if (window._realtimeCloudUnsubscribe) {
        window._realtimeCloudUnsubscribe();
        window._realtimeCloudUnsubscribe = null;
      }
      await logout();
      activeUser = null;
      updateNavForUser(null);
      navigateTo('#landing');
    }
  });

  // Auth lapok váltása
  let isRegisterMode = false;
  dom.tabLogin.addEventListener('click', () => {
    isRegisterMode = false;
    dom.tabLogin.className = 'flex-1 min-h-[44px] py-2.5 px-3 text-sm font-semibold rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm transition-all';
    dom.tabRegister.className = 'flex-1 min-h-[44px] py-2.5 px-3 text-sm font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
    dom.authConfirmPasswordContainer.classList.add('hidden');
    dom.btnAuthText.textContent = 'Bejelentkezés';
    hideAuthError();
  });

  dom.tabRegister.addEventListener('click', () => {
    isRegisterMode = true;
    dom.tabRegister.className = 'flex-1 min-h-[44px] py-2.5 px-3 text-sm font-semibold rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm transition-all';
    dom.tabLogin.className = 'flex-1 min-h-[44px] py-2.5 px-3 text-sm font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
    dom.authConfirmPasswordContainer.classList.remove('hidden');
    dom.btnAuthText.textContent = 'Fiók létrehozása';
    hideAuthError();
  });

  // Auth űrlap beküldése
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

  dom.btnGuestLogin.addEventListener('click', () => {
    loginAsGuest();
    navigateTo('#dashboard');
  });

  // Google bejelentkezés
  if (dom.btnGoogleSignin) {
    dom.btnGoogleSignin.addEventListener('click', async () => {
      hideAuthError();
      dom.btnGoogleSignin.disabled = true;
      if (dom.btnGoogleText) dom.btnGoogleText.textContent = "Átirányítás...";

      try {
        if (isFirebaseActive()) {
          const started = await startFirebaseGoogleRedirect();
          if (started) return;
        }
        startGoogleRedirectAuth();
      } catch (err) {
        showToast(err.message || "Hiba a Google átirányításkor!", "error");
        dom.btnGoogleSignin.disabled = false;
        if (dom.btnGoogleText) dom.btnGoogleText.textContent = "Folytatás Google-fiókkal";
      }
    });
  }

  // Modálok és műveletek
  dom.btnOpenUploadModal.addEventListener('click', openUploadModal);
  dom.btnEmptyUpload.addEventListener('click', openUploadModal);
  dom.btnCloseUploadModal.addEventListener('click', closeUploadModal);
  dom.btnCancelUpload.addEventListener('click', closeUploadModal);

  dom.btnDownloadSampleExcel.addEventListener('click', downloadSampleExcel);
  dom.btnEmptySample.addEventListener('click', downloadSampleExcel);

  dom.excelDropzone.addEventListener('click', () => dom.excelFileInput.click());
  dom.excelFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedExcelFile(e.target.files[0]);
    }
  });

  dom.btnSaveUploadedList.addEventListener('click', async () => {
    if (!pendingExcelData) return;
    const customName = dom.uploadListName.value.trim() || pendingExcelData.listName;

    try {
      dom.btnSaveUploadedList.disabled = true;
      await saveNewList(customName, pendingExcelData.words, pendingExcelData.sheets);
      closeUploadModal();
      await renderDashboard();
      showToast("Sikeres mentés!", "success");
    } catch (err) {
      alert("Nem sikerült elmenteni a listát: " + err.message);
    } finally {
      dom.btnSaveUploadedList.disabled = false;
    }
  });

  dom.btnCreateEmptyList.addEventListener('click', async () => {
    const listName = prompt("Add meg az új szólista nevét:");
    if (listName && listName.trim()) {
      await saveNewList(listName.trim(), []);
      await renderDashboard();
    }
  });

  // Gyakorlás vezérlők
  dom.btnExitPractice.addEventListener('click', () => {
    if (confirm("Biztosan vissza akarsz térni a szólistákhoz?")) {
      clearAutoAdvance();
      currentPracticeSession = null;
      navigateTo('#dashboard');
    }
  });

  dom.btnToggleDirection.addEventListener('click', () => {
    isReversePractice = !isReversePractice;
    dom.directionLabel.textContent = isReversePractice ? '🇭🇺 Magyar → 🇬🇧 Angol' : '🇬🇧 Angol → 🇭🇺 Magyar';
    if (currentPracticeSession) {
      currentPracticeSession.options.reverse = isReversePractice;
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
    if (currentPracticeSession) currentPracticeSession.speakCurrentWord();
  });

  dom.btnPracticeSubmit.addEventListener('click', handlePracticeAction);
  dom.practiceAnswerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePracticeAction();
    }
  });

  if (dom.btnRoundRetry) {
    dom.btnRoundRetry.addEventListener('click', () => {
      closeRoundCompletedModal();
      if (currentActivePracticeConfig.sheetId) {
        startSheetPractice(currentActivePracticeConfig.listId, currentActivePracticeConfig.sheetId);
      } else if (currentActivePracticeConfig.listId) {
        startPractice(currentActivePracticeConfig.listId);
      }
    });
  }

  if (dom.btnRoundExit) {
    dom.btnRoundExit.addEventListener('click', () => {
      closeRoundCompletedModal();
      navigateTo('#dashboard');
    });
  }

  // Törlés modál
  if (dom.btnCancelDelete) dom.btnCancelDelete.addEventListener('click', closeDeleteModal);
  if (dom.btnCloseDeleteModal) dom.btnCloseDeleteModal.addEventListener('click', closeDeleteModal);
  if (dom.btnConfirmDelete) {
    dom.btnConfirmDelete.addEventListener('click', async () => {
      if (!pendingDeleteTarget) return;
      const targetId = pendingDeleteTarget.id;
      closeDeleteModal();
      await deleteList(targetId);
      await renderDashboard();
      showToast("Szólista sikeresen törölve!", "danger");
    });
  }

  // Google Drive integráció
  if (dom.btnOpenGDriveModal) dom.btnOpenGDriveModal.addEventListener('click', () => openGDriveModal());
  if (dom.btnCloseGDriveModal) dom.btnCloseGDriveModal.addEventListener('click', closeGDriveModal);
  if (dom.btnCancelGDrive) dom.btnCancelGDrive.addEventListener('click', closeGDriveModal);
  if (dom.formGDriveConnect) dom.formGDriveConnect.addEventListener('submit', handleGDriveSubmit);
}

// ==========================================
// TOAST ÉS SEGÉDFÜGGVÉNYEK
// ==========================================

let toastTimeout = null;
function showToast(message, type = 'success') {
  if (!dom.appToast) return;
  clearTimeout(toastTimeout);

  dom.appToastMessage.textContent = message;
  if (type === 'success') {
    dom.appToast.className = 'fixed top-20 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white border border-emerald-500 animate-pop-in';
  } else if (type === 'danger' || type === 'error') {
    dom.appToast.className = 'fixed top-20 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-semibold bg-rose-600 text-white border border-rose-500 animate-pop-in';
  } else {
    dom.appToast.className = 'fixed top-20 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-semibold bg-slate-900 text-white border border-slate-700 animate-pop-in';
  }

  dom.appToast.classList.remove('hidden');
  toastTimeout = setTimeout(() => {
    if (dom.appToast) dom.appToast.classList.add('hidden');
  }, 3500);
}

function showAuthError(msg) {
  dom.authErrorText.textContent = msg;
  dom.authErrorBanner.classList.remove('hidden');
}

function hideAuthError() {
  dom.authErrorBanner.classList.add('hidden');
}

function openDeleteModal(list) {
  pendingDeleteTarget = list;
  dom.deleteConfirmTitle.textContent = "Szólista törlése";
  dom.deleteConfirmMessage.innerHTML = `Biztosan törölni szeretnéd a(z) <strong>"${escapeHtml(list.name)}"</strong> listát?`;
  dom.modalDeleteConfirm.classList.remove('hidden');
  dom.modalDeleteConfirm.classList.add('flex');
}

function closeDeleteModal() {
  pendingDeleteTarget = null;
  if (dom.modalDeleteConfirm) {
    dom.modalDeleteConfirm.classList.add('hidden');
    dom.modalDeleteConfirm.classList.remove('flex');
  }
}

// ==========================================
// 4. DASHBOARD RENDERELÉSE
// ==========================================

async function renderDashboard() {
  if (!activeUser) return;
  const lists = await getUserLists();

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
    card.className = 'group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between';

    const wordCount = list.words ? list.words.length : 0;
    const sheets = list.sheets || [];

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <i data-lucide="book-marked" class="w-5 h-5"></i>
            </div>
            <div>
              <h4 class="font-bold text-slate-900 dark:text-white line-clamp-1">${escapeHtml(list.name)}</h4>
              <div class="text-[11px] text-slate-400">${wordCount} szó &bull; ${sheets.length} munkalap</div>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button class="btn-delete-list p-2 min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-xl transition-colors">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <button class="btn-start-practice flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-sm">
          <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
          <span>Gyakorlás</span>
        </button>
      </div>
    `;

    card.querySelector('.btn-start-practice').addEventListener('click', () => startPractice(list.id));
    card.querySelector('.btn-delete-list').addEventListener('click', () => openDeleteModal(list));

    dom.listsGrid.appendChild(card);
  });

  refreshIcons();
}

// ==========================================
// 5. MODÁLOK ÉS GYAKORLÁS LOGIKA
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
    dom.excelDropzone.classList.add('hidden');
    dom.uploadPreviewSection.classList.remove('hidden');
    refreshIcons();
  } catch (err) {
    alert("Nem sikerült feldolgozni a fájlt:\n" + err.message);
  }
}

function openGDriveModal() {
  dom.modalGDriveConnect.classList.remove('hidden');
  dom.modalGDriveConnect.classList.add('flex');
}

function closeGDriveModal() {
  dom.modalGDriveConnect.classList.add('hidden');
  dom.modalGDriveConnect.classList.remove('flex');
}

async function handleGDriveSubmit(e) {
  e.preventDefault();
  const url = dom.gdriveLinkInput ? dom.gdriveLinkInput.value.trim() : '';
  if (!url) return;

  try {
    const newList = await connectGoogleDriveList(url, null, '');
    closeGDriveModal();
    await renderDashboard();
    showToast(`Sikeres szinkronizáció!`, 'success');
  } catch (err) {
    showToast(err.message || "Hiba történt a Google Drive elérésekor!", 'danger');
  }
}

async function startPractice(listId) {
  const list = await getListById(listId);
  if (!list || !list.words || list.words.length === 0) {
    alert("Ez a lista nem tartalmaz szavakat!");
    return;
  }

  currentActivePracticeConfig = { listId, sheetId: null, isMix: false };
  currentPracticeSession = new PracticeSession(list, {
    reverse: isReversePractice,
    soundEnabled: isSoundEnabled
  });

  dom.practiceCurrentListTitle.textContent = list.name;
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
      navigateTo('#dashboard');
    }
    return;
  }

  dom.practiceFeedbackContainer.classList.add('hidden');
  dom.practiceBtnText.textContent = 'Ellenőrzés';
  dom.practicePromptWord.textContent = isReversePractice ? word.hungarian : word.english;
  dom.practiceAnswerInput.value = '';
  dom.practiceAnswerInput.disabled = false;
  setTimeout(() => dom.practiceAnswerInput.focus(), 50);

  if (isSoundEnabled && !isReversePractice) {
    currentPracticeSession.speakCurrentWord();
  }
}

async function handlePracticeAction() {
  if (!currentPracticeSession) return;

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
  if (!answer) return;

  dom.practiceAnswerInput.disabled = true;
  const result = await currentPracticeSession.checkAnswer(answer);

  if (result.isCorrect) {
    dom.practiceFeedbackContainer.className = 'p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 text-emerald-800 dark:text-emerald-200 flex items-center justify-between';
    dom.practiceFeedbackContainer.innerHTML = `<span>🎉 Helyes válasz!</span>`;
    dom.practiceFeedbackContainer.classList.remove('hidden');
    dom.practiceBtnText.textContent = result.isRoundFinished ? 'Kör befejezése' : 'Következő szó';

    autoAdvanceTimeout = setTimeout(() => {
      if (currentPracticeSession && currentPracticeSession.state === 'CORRECT') {
        if (currentPracticeSession.isRoundComplete()) {
          onPracticeRoundFinished();
        } else {
          renderCurrentQuizWord();
        }
      }
    }, 900);
  } else {
    dom.practiceFeedbackContainer.className = 'p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-900 dark:text-rose-100 space-y-1';
    dom.practiceFeedbackContainer.innerHTML = `<div>Helyes válasz: <strong>${escapeHtml(result.correctAnswer)}</strong></div>`;
    dom.practiceFeedbackContainer.classList.remove('hidden');
    dom.practiceBtnText.textContent = result.isRoundFinished ? 'Kör befejezése' : 'Következő szó';
  }
}

async function onPracticeRoundFinished() {
  clearAutoAdvance();
  alert("A gyakorlási kör véget ért!");
  navigateTo('#dashboard');
}

function clearAutoAdvance() {
  if (autoAdvanceTimeout) {
    clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }
}

// ==========================================
// 6. STATISZTIKA NÉZET
// ==========================================

async function renderStatsView() {
  if (!dom.statsListsContainer) return;
  const lists = await getUserLists();

  if (!lists || lists.length === 0) {
    dom.statsEmptyState.classList.remove('hidden');
    dom.statsListsContainer.innerHTML = '';
    return;
  }

  dom.statsEmptyState.classList.add('hidden');
  dom.statsListsContainer.innerHTML = '';

  lists.forEach(list => {
    const div = document.createElement('div');
    div.className = 'p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm';
    div.innerHTML = `
      <h3 class="font-bold text-lg text-slate-900 dark:text-white">${escapeHtml(list.name)}</h3>
      <p class="text-xs text-slate-500">${list.words ? list.words.length : 0} szó rögzítve</p>
    `;
    dom.statsListsContainer.appendChild(div);
  });
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