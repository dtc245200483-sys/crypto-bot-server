/**
 * ============================================================================
 * Local Orchestrator Pro - Client Application Logic
 * ============================================================================
 * Bảng điều khiển phân tích kỹ thuật và giám sát tín hiệu phái sinh OKX.
 * Kiến trúc UI tích hợp 5 kỹ thuật & thư viện mã nguồn mở chuẩn GitHub:
 * 
 * 1. Biểu đồ nến: TradingView Lightweight Charts
 *    Tham khảo: https://github.com/tradingview/lightweight-charts (thư mục examples/)
 *    Pattern: createChart, addSeries(CandlestickSeries), createPriceLine (Entry/SL/TP).
 * 
 * 2. Animation mượt: GreenSock Animation Platform (GSAP)
 *    Tham khảo: https://github.com/greensock/GSAP (thư mục demos/docs)
 *    Pattern: GSAP stagger fade-in cho bảng dữ liệu và easing power2/power3 cho modal/studio.
 * 
 * 3. Bộ lọc/Tìm kiếm nhanh: Fuse.js
 *    Tham khảo: https://github.com/krisk/Fuse (README Usage/Options)
 *    Pattern: Fuzzy search theo keys ['symbol', 'cleanSymbol'], threshold: 0.35, kết hợp filter mảng thuần.
 * 
 * 4. Chế độ Dark / Light Mode chuẩn: GoogleChromeLabs
 *    Tham khảo: https://github.com/GoogleChromeLabs/dark-mode-toggle
 *    Pattern: data-theme trên <html>, CSS variables 2 bộ theme, localStorage & prefers-color-scheme.
 * 
 * 5. Bố cục responsive chuẩn Dashboard: Tabler
 *    Tham khảo: https://github.com/tabler/tabler
 *    Pattern: Sticky topbar, spacing scale chuẩn admin, zero-horizontal-scroll trên màn hình 1366px+.
 * ============================================================================
 */

// Trạng thái ứng dụng
let allSetups = [];
let previousSetupsCount = -1;
let countdownSec = 30;
let countdownInterval = null;
let currentFilter = 'all';
let currentSort = 'newest';
let fuseInstance = null;
let currentTheme = 'dark';
const expandedSetupIds = new Set();
const activeChartInstances = new Map();
let activeStudioSetup = null;
let currentStudioMode = 'grid';
const studioChartInstances = new Map();
const lookupChartInstances = new Map();
let lookupActiveCoin = 'BTC';
let lookupActiveMode = 'grid';
let lookupCachedData = null;
let lookupHasLoadedOnce = false;

let systemConfig = {
  thresholds: {
    minWinRate: 42.0,
    minProfitFactor: 0.8,
    minTotalPnL: 0.0
  },
  allowedBaseTimeframes: ['30m', '1h', '4h'],
  soundAlert: true,
  refreshIntervalSec: 30
};

// Truy xuất toàn bộ phần tử DOM
const elements = {
  // Navigation & Status
  countdownTimer: document.getElementById('countdownTimer'),
  serverStatusPill: document.getElementById('serverStatusPill'),
  serverStatusText: document.getElementById('serverStatusText'),
  soundToggleBtn: document.getElementById('soundToggleBtn'),
  soundOnIcon: document.getElementById('soundOnIcon'),
  soundOffIcon: document.getElementById('soundOffIcon'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeSunIcon: document.getElementById('themeSunIcon'),
  themeMoonIcon: document.getElementById('themeMoonIcon'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  hdrTf15m: document.getElementById('hdrTf15m'),
  hdrTf30m: document.getElementById('hdrTf30m'),
  hdrTf1h: document.getElementById('hdrTf1h'),
  hdrTf4h: document.getElementById('hdrTf4h'),

  // Metrics
  totalSetupsCount: document.getElementById('totalSetupsCount'),
  longSetupsCount: document.getElementById('longSetupsCount'),
  shortSetupsCount: document.getElementById('shortSetupsCount'),
  avgWinRate: document.getElementById('avgWinRate'),
  avgPfBadge: document.getElementById('avgPfBadge'),
  longRatioPill: document.getElementById('longRatioPill'),
  shortRatioPill: document.getElementById('shortRatioPill'),
  totalSetupsSub: document.getElementById('totalSetupsSub'),
  thresholdDisplaySub: document.getElementById('thresholdDisplaySub'),

  // Timeframe Strip
  count15m: document.getElementById('count15m'),
  count30m: document.getElementById('count30m'),
  count1h: document.getElementById('count1h'),
  count4h: document.getElementById('count4h'),
  chip15m: document.getElementById('chip15m'),
  chip30m: document.getElementById('chip30m'),
  chip1h: document.getElementById('chip1h'),
  chip4h: document.getElementById('chip4h'),
  showAllTfBtn: document.getElementById('showAllTfBtn'),

  // Auth Controls & Modal
  authHeaderWrap: document.getElementById('authHeaderWrap'),
  authOpenModalBtn: document.getElementById('authOpenModalBtn'),
  authBtnLabel: document.getElementById('authBtnLabel'),
  userProfileBadge: document.getElementById('userProfileBadge'),
  userDisplayName: document.getElementById('userDisplayName'),
  userAvatarMini: document.getElementById('userAvatarMini'),
  authLogoutBtn: document.getElementById('authLogoutBtn'),
  authModalOverlay: document.getElementById('authModalOverlay'),
  authModal: document.getElementById('authModal'),
  closeAuthBtn: document.getElementById('closeAuthBtn'),
  tabLoginBtn: document.getElementById('tabLoginBtn'),
  tabRegisterBtn: document.getElementById('tabRegisterBtn'),
  authFeedback: document.getElementById('authFeedback'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  googleLoginBtn: document.getElementById('googleLoginBtn'),
  regUsername: document.getElementById('regUsername'),
  regEmail: document.getElementById('regEmail'),
  regPassword: document.getElementById('regPassword'),
  regConfirmPassword: document.getElementById('regConfirmPassword'),

  // Toolbar
  searchInput: document.getElementById('searchInput'),
  quickFilterGroup: document.getElementById('quickFilterGroup'),
  timeframeFilter: document.getElementById('timeframeFilter'),
  signalFilter: document.getElementById('signalFilter'),
  sortSelect: document.getElementById('sortSelect'),
  refreshBtn: document.getElementById('refreshBtn'),
  clearSetupsBtn: document.getElementById('clearSetupsBtn'),
  tableShowingCount: document.getElementById('tableShowingCount'),

  // Table
  setupsTableBody: document.getElementById('setupsTableBody'),
  emptyMessage: document.getElementById('emptyMessage'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),

  // Footer & Support
  footWr: document.getElementById('footWr'),
  footPf: document.getElementById('footPf'),
  footPnl: document.getElementById('footPnl'),
  footActiveTfs: document.getElementById('footActiveTfs'),
  supportThresholdVal: document.getElementById('supportThresholdVal'),

  // Settings Modal
  settingsModalOverlay: document.getElementById('settingsModalOverlay'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  resetDefaultSettingsBtn: document.getElementById('resetDefaultSettingsBtn'),
  saveSpinner: document.getElementById('saveSpinner'),

  // Modal Fields
  toggleTf15m: document.getElementById('toggleTf15m'),
  toggleTf30m: document.getElementById('toggleTf30m'),
  toggleTf1h: document.getElementById('toggleTf1h'),
  toggleTf4h: document.getElementById('toggleTf4h'),
  cardTf15m: document.getElementById('cardTf15m'),
  cardTf30m: document.getElementById('cardTf30m'),
  cardTf1h: document.getElementById('cardTf1h'),
  cardTf4h: document.getElementById('cardTf4h'),
  statusText15m: document.getElementById('statusText15m'),
  statusText30m: document.getElementById('statusText30m'),
  statusText1h: document.getElementById('statusText1h'),
  statusText4h: document.getElementById('statusText4h'),

  cfgMinWinRate: document.getElementById('cfgMinWinRate'),
  cfgMinProfitFactor: document.getElementById('cfgMinProfitFactor'),
  cfgMinTotalPnL: document.getElementById('cfgMinTotalPnL'),
  cfgSoundAlert: document.getElementById('cfgSoundAlert'),
  cfgRefreshInterval: document.getElementById('cfgRefreshInterval'),
  btnTestSound: document.getElementById('btnTestSound'),

  // Toast
  toastContainer: document.getElementById('toastContainer'),

  // Docked Chart Studio
  chartStudioPanel: document.getElementById('chartStudioPanel'),
  studioSymbolTitle: document.getElementById('studioSymbolTitle'),
  studioSignalBadge: document.getElementById('studioSignalBadge'),
  studioTfBadge: document.getElementById('studioTfBadge'),
  studioEntryVal: document.getElementById('studioEntryVal'),
  studioSlVal: document.getElementById('studioSlVal'),
  studioTp1Val: document.getElementById('studioTp1Val'),
  studioTp2Val: document.getElementById('studioTp2Val'),
  studioTp3Val: document.getElementById('studioTp3Val'),
  studioModeToggle: document.getElementById('studioModeToggle'),
  studioSyncBtn: document.getElementById('studioSyncBtn'),
  studioCloseBtn: document.getElementById('studioCloseBtn'),
  studioViewport: document.getElementById('studioViewport')
};

// =============================================================================
// WEB AUDIO API - TẠO ÂM THANH CHUÔNG THÔNG BÁO TỔNG HỢP (SYNTH CHIME)
// =============================================================================
let audioCtx = null;

function playChimeSound() {
  if (!systemConfig.soundAlert) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioCtx) audioCtx = new AudioContext();

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    // Nốt 1: E5 (659.25 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Nốt 2: B5 (987.77 Hz)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn('Không thể phát âm thanh thông báo:', err);
  }
}

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================
function showToast(message, type = 'info', duration = 3000) {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// =============================================================================
// QUẢN LÝ GIAO DIỆN DARK / LIGHT MODE (GOOGLECHROMELABS PATTERN)
// =============================================================================
// GitHub Ref: https://github.com/GoogleChromeLabs/dark-mode-toggle
// Pattern: Switch data-theme attribute on <html>, persist in localStorage, fallback to prefers-color-scheme.

const COLOR_VARIANT_KEY = 'landing-color-variant';

function getSystemPreferredTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyColorVariant(variant, save = true) {
  if (variant === 'gray') {
    document.body.classList.add('variant-gray');
    document.documentElement.classList.add('variant-gray');
    applyTheme('dark', false);
  } else if (variant === 'white') {
    document.body.classList.remove('variant-gray');
    document.documentElement.classList.remove('variant-gray');
    applyTheme('light', false);
  } else {
    variant = 'dark';
    document.body.classList.remove('variant-gray');
    document.documentElement.classList.remove('variant-gray');
    applyTheme('dark', false);
  }

  // Update active state on color dots
  document.querySelectorAll('.color-dot').forEach((dot) => {
    dot.classList.toggle('active', dot.dataset.variant === variant);
  });

  if (save) {
    try {
      localStorage.setItem(COLOR_VARIANT_KEY, variant);
      localStorage.setItem('orchestrator_theme', variant === 'white' ? 'light' : 'dark');
    } catch (e) {}
  }
}

function applyTheme(theme, save = true) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  if (save) {
    try {
      localStorage.setItem('orchestrator_theme', theme);
    } catch (e) {}
  }

  // Đồng bộ trạng thái active trên các chấm chọn màu
  const isGray = document.body.classList.contains('variant-gray') || document.documentElement.classList.contains('variant-gray');
  const activeVariant = theme === 'light' ? 'white' : (isGray ? 'gray' : 'dark');
  document.querySelectorAll('.color-dot').forEach((dot) => {
    dot.classList.toggle('active', dot.dataset.variant === activeVariant);
  });

  // Cập nhật icon: Dark mode thì hiện Sun để bấm chuyển sang Sáng; Light mode thì hiện Moon để bấm chuyển sang Tối
  if (elements.themeSunIcon && elements.themeMoonIcon) {
    if (theme === 'dark') {
      elements.themeSunIcon.classList.remove('hidden');
      elements.themeMoonIcon.classList.add('hidden');
      if (elements.themeToggleBtn) {
        elements.themeToggleBtn.title = 'Chuyển sang giao diện Sáng (Light Mode)';
      }
    } else {
      elements.themeSunIcon.classList.add('hidden');
      elements.themeMoonIcon.classList.remove('hidden');
      if (elements.themeToggleBtn) {
        elements.themeToggleBtn.title = 'Chuyển sang giao diện Tối (Dark Mode)';
      }
    }
  }

  // Cập nhật theme cho các chart đang hiển thị nếu có
  updateStudioChartsTheme(theme);
}

function initTheme() {
  let savedVariant = null;
  let savedTheme = null;
  try {
    savedVariant = localStorage.getItem(COLOR_VARIANT_KEY);
    savedTheme = localStorage.getItem('orchestrator_theme');
  } catch (e) {}

  if (savedVariant) {
    applyColorVariant(savedVariant, false);
  } else if (savedTheme) {
    applyTheme(savedTheme, false);
  } else {
    const activeTheme = getSystemPreferredTheme();
    applyTheme(activeTheme, false);
  }

  // Lắng nghe sự kiện click các nút chọn màu (White / Gray / Dark)
  document.querySelectorAll('.color-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      const v = dot.dataset.variant;
      applyColorVariant(v, true);
      const labels = {
        white: 'Sáng (White)',
        gray: 'Xám Hiện Đại (Modern Gray)',
        dark: 'Tối Vũ Trụ (Cosmic Dark)'
      };
      showToast(`Đã chuyển sang giao diện ${labels[v] || v}`, 'info', 2000);
    });
  });

  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener('click', () => {
      const isGray = document.body.classList.contains('variant-gray');
      let nextVariant;
      if (currentTheme === 'dark') {
        nextVariant = 'white';
      } else {
        nextVariant = isGray ? 'gray' : 'dark';
      }
      applyColorVariant(nextVariant, true);
      showToast(`Đã chuyển sang giao diện ${nextVariant === 'white' ? 'Sáng (Light Mode)' : 'Tối (Dark Mode)'}`, 'info', 2000);
    });
  }

  // Lắng nghe thay đổi theme từ hệ thống nếu người dùng chưa chọn thủ công
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      if (!localStorage.getItem('orchestrator_theme') && !localStorage.getItem(COLOR_VARIANT_KEY)) {
        applyColorVariant(e.matches ? 'white' : 'dark', false);
      }
    });
  }

  // Khởi tạo điều hướng và chuyển đổi View (Trang Chủ vs Bảng Kèo)
  initViewRouting();
}

/**
 * Hệ thống điều phối View SPA:
 * 1. Landing View ('landing'): Trang Chủ & Giới Thiệu
 * 2. Dashboard View ('dashboard'): Bảng Kèo Trực Tiếp & Thống Kê Realtime
 * 3. Chart Lookup View ('chart-lookup'): Tra Cứu Nến Đa Khung 30p, 1h, 4h OKX
 * 4. Docs View ('docs'): Cẩm Nang Tỷ Lệ R:R & Điểm Chốt Lời / Vào Lệnh
 */
function initViewRouting() {
  const landingView = document.getElementById('landingView');
  const dashboardView = document.getElementById('dashboardView');
  const chartLookupView = document.getElementById('chartLookupView');
  const docsView = document.getElementById('docsView');

  const navLinkHero = document.getElementById('navLinkHero') || document.querySelector('.nav-link[href="#hero"]');
  const navLinkIntro = document.getElementById('navLinkIntro') || document.querySelector('.nav-link[href="#introSection"]');
  const navLinkDashboard = document.getElementById('navLinkDashboard') || document.querySelector('.nav-link[href="#dashboardSection"]');
  const navLinkLookup = document.getElementById('navLinkLookup') || document.querySelector('.nav-link[href="#chartLookupSection"]');
  const navLinkDocs = document.getElementById('navLinkDocs') || document.querySelector('.nav-link[href="#docsSection"]');
  const footerDocsLink = document.getElementById('footerDocsLink');

  const navBrandLogo = document.getElementById('navBrandLogo') || document.querySelector('.nav-brand-link');
  const exploreBtn = document.getElementById('exploreBtn');
  const introCtaBtn = document.querySelector('.intro-cta-btn');
  const btnBackLanding = document.getElementById('btnBackLanding');
  const btnBackFromLookup = document.getElementById('btnBackFromLookup');
  const btnGoToDashboardFromLookup = document.getElementById('btnGoToDashboardFromLookup');
  const btnBackFromDocs = document.getElementById('btnBackFromDocs');
  const btnGoToDashboardFromDocs = document.getElementById('btnGoToDashboardFromDocs');

  const heroVideo = document.getElementById('heroBgVideo');
  const moonVideo = document.getElementById('moonLayer');

  function setActiveNavLink(activeLink) {
    [navLinkHero, navLinkIntro, navLinkDashboard, navLinkLookup, navLinkDocs].forEach(link => {
      if (link) link.classList.toggle('active', link === activeLink);
    });
  }

  function hideAllViews() {
    if (landingView) landingView.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'none';
    if (chartLookupView) chartLookupView.style.display = 'none';
    if (docsView) docsView.style.display = 'none';
  }

  function switchView(targetView, options = {}) {
    const { scrollToTarget = null, updateHash = true } = options;

    hideAllViews();

    if (targetView === 'dashboard') {
      if (dashboardView) {
        dashboardView.style.display = 'block';
        dashboardView.classList.remove('hidden-view');
      }
      document.documentElement.setAttribute('data-active-view', 'dashboard');
      setActiveNavLink(navLinkDashboard);

      try {
        if (heroVideo && typeof heroVideo.pause === 'function') heroVideo.pause();
        if (moonVideo && typeof moonVideo.pause === 'function') moonVideo.pause();
      } catch (e) {}

      if (updateHash && window.location.hash !== '#dashboardSection') {
        try { history.pushState(null, '', '#dashboardSection'); } catch (e) {}
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } else if (targetView === 'chart-lookup') {
      if (chartLookupView) {
        chartLookupView.style.display = 'block';
      }
      document.documentElement.setAttribute('data-active-view', 'chart-lookup');
      setActiveNavLink(navLinkLookup);

      try {
        if (heroVideo && typeof heroVideo.pause === 'function') heroVideo.pause();
        if (moonVideo && typeof moonVideo.pause === 'function') moonVideo.pause();
      } catch (e) {}

      if (updateHash && window.location.hash !== '#chartLookupSection') {
        try { history.pushState(null, '', '#chartLookupSection'); } catch (e) {}
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Kích hoạt nạp dữ liệu nến lần đầu nếu chưa nạp
      if (typeof window.triggerInitialLookupIfNeeded === 'function') {
        window.triggerInitialLookupIfNeeded();
      }

    } else if (targetView === 'docs') {
      if (docsView) {
        docsView.style.display = 'block';
      }
      document.documentElement.setAttribute('data-active-view', 'docs');
      setActiveNavLink(navLinkDocs);

      try {
        if (heroVideo && typeof heroVideo.pause === 'function') heroVideo.pause();
        if (moonVideo && typeof moonVideo.pause === 'function') moonVideo.pause();
      } catch (e) {}

      if (updateHash && window.location.hash !== '#docsSection') {
        try { history.pushState(null, '', '#docsSection'); } catch (e) {}
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } else {
      // Landing View
      if (landingView) landingView.style.display = 'block';
      document.documentElement.setAttribute('data-active-view', 'landing');

      try {
        if (heroVideo && typeof heroVideo.play === 'function') heroVideo.play().catch(() => {});
        if (moonVideo && typeof moonVideo.play === 'function') moonVideo.play().catch(() => {});
      } catch (e) {}

      if (scrollToTarget) {
        const targetEl = document.querySelector(scrollToTarget);
        if (targetEl) {
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 40);
        }
        if (updateHash) {
          try { history.pushState(null, '', scrollToTarget); } catch (e) {}
        }
        if (scrollToTarget === '#introSection' || scrollToTarget === '#aboutSection') {
          setActiveNavLink(navLinkIntro);
        } else {
          setActiveNavLink(navLinkHero);
        }
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (updateHash && window.location.hash !== '#hero') {
          try { history.pushState(null, '', '#hero'); } catch (e) {}
        }
        setActiveNavLink(navLinkHero);
      }
    }
  }

  // Gắn sự kiện click
  if (navLinkDashboard) {
    navLinkDashboard.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('dashboard');
    });
  }

  if (navLinkLookup) {
    navLinkLookup.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('chart-lookup');
    });
  }

  if (navLinkDocs) {
    navLinkDocs.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('docs');
    });
  }

  if (footerDocsLink) {
    footerDocsLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('docs');
    });
  }

  if (btnBackFromLookup) {
    btnBackFromLookup.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('landing', { scrollToTarget: '#hero' });
    });
  }

  if (btnGoToDashboardFromLookup) {
    btnGoToDashboardFromLookup.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('dashboard');
    });
  }

  if (btnBackFromDocs) {
    btnBackFromDocs.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('landing', { scrollToTarget: '#hero' });
    });
  }

  if (btnGoToDashboardFromDocs) {
    btnGoToDashboardFromDocs.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('dashboard');
    });
  }

  if (navLinkHero) {
    navLinkHero.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('landing', { scrollToTarget: '#hero' });
    });
  }

  if (navBrandLogo) {
    navBrandLogo.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('landing', { scrollToTarget: '#hero' });
    });
  }

  if (navLinkIntro) {
    navLinkIntro.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('landing', { scrollToTarget: '#introSection' });
    });
  }

  if (exploreBtn) {
    exploreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('dashboard');
    });
  }

  if (introCtaBtn) {
    introCtaBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('dashboard');
    });
  }

  if (btnBackLanding) {
    btnBackLanding.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('landing', { scrollToTarget: '#hero' });
    });
  }

  // Tự động kiểm tra URL hash
  function handleHashRoute() {
    const hash = window.location.hash;
    if (hash === '#dashboardSection' || hash === '#dashboard' || hash === '#metricsSection') {
      switchView('dashboard', { updateHash: false });
    } else if (hash === '#chartLookupSection' || hash === '#traCuuNen' || hash === '#chart-lookup') {
      switchView('chart-lookup', { updateHash: false });
    } else if (hash === '#docsSection' || hash === '#taiLieu' || hash === '#docs') {
      switchView('docs', { updateHash: false });
    } else if (hash === '#introSection' || hash === '#aboutSection') {
      switchView('landing', { scrollToTarget: hash, updateHash: false });
    } else {
      switchView('landing', { updateHash: false });
    }
  }

  window.addEventListener('hashchange', handleHashRoute);
  window.addEventListener('popstate', handleHashRoute);

  window.addEventListener('scroll', () => {
    if (document.documentElement.getAttribute('data-active-view') !== 'landing') return;
    const scrollPos = window.scrollY + 140;
    const introEl = document.getElementById('introSection');
    if (introEl && introEl.offsetTop <= scrollPos) {
      setActiveNavLink(navLinkIntro);
    } else {
      setActiveNavLink(navLinkHero);
    }
  }, { passive: true });

  handleHashRoute();
}

/**
 * =============================================================================
 * CHỨC NĂNG TRA CỨU NẾN THỜI GIAN THỰC SÀN OKX (30P • 1H • 4H)
 * =============================================================================
 * - Nhận diện bất kỳ đồng coin nào giao dịch USDT trên OKX (BTC, ETH, SOL, SUI...)
 * - Tự động chuẩn hóa và gọi API /api/market/candles?symbol=:symbol
 * - Vẽ nến đồng thời 3 khung thời gian 30p, 1h, 4h bằng TradingView Lightweight Charts
 * - Hỗ trợ chế độ Lưới 3 khung hoặc xem chi tiết từng khung riêng lẻ
 */
function initCandleLookup() {
  const lookupForm = document.getElementById('lookupForm');
  const lookupCoinInput = document.getElementById('lookupCoinInput');
  const lookupSubmitBtn = document.getElementById('lookupSubmitBtn');
  const lookupRefreshBtn = document.getElementById('lookupRefreshBtn');
  const lookupViewport = document.getElementById('lookupViewport');
  const lookupModeToggle = document.getElementById('lookupModeToggle');
  const lookupSuggestionsDropdown = document.getElementById('lookupSuggestionsDropdown');
  const quickPillButtons = document.querySelectorAll('.coin-pill-btn');

  // Coin Bar Elements
  const lookupCoinAvatar = document.getElementById('lookupCoinAvatar');
  const lookupCoinName = document.getElementById('lookupCoinName');
  const lookupCoinInstId = document.getElementById('lookupCoinInstId');
  const lookupCoinPrice = document.getElementById('lookupCoinPrice');
  const lookupCoinChange = document.getElementById('lookupCoinChange');
  const lookupHigh24h = document.getElementById('lookupHigh24h');
  const lookupLow24h = document.getElementById('lookupLow24h');
  const lookupVol24h = document.getElementById('lookupVol24h');

  // Biến quản lý Autocomplete Gợi Ý
  let activeSuggestionIndex = -1;
  let currentSuggestions = [];
  let autocompleteDebounceTimer = null;

  function hideSuggestions() {
    if (lookupSuggestionsDropdown) {
      lookupSuggestionsDropdown.classList.add('hidden');
      lookupSuggestionsDropdown.innerHTML = '';
    }
    activeSuggestionIndex = -1;
    currentSuggestions = [];
  }

  function highlightMatch(coin, query) {
    if (!query) return coin;
    const qUpper = query.toUpperCase();
    const cUpper = coin.toUpperCase();
    const idx = cUpper.indexOf(qUpper);
    if (idx === -1) return coin;
    const before = coin.slice(0, idx);
    const match = coin.slice(idx, idx + query.length);
    const after = coin.slice(idx + query.length);
    return `${before}<span class="suggestion-match">${match}</span>${after}`;
  }

  function renderSuggestions(symbols, query) {
    if (!lookupSuggestionsDropdown) return;
    if (!symbols || symbols.length === 0) {
      hideSuggestions();
      return;
    }

    currentSuggestions = symbols;
    activeSuggestionIndex = -1;
    lookupSuggestionsDropdown.innerHTML = '';

    symbols.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'lookup-suggestion-item';
      el.setAttribute('role', 'option');
      el.setAttribute('data-index', index);
      el.innerHTML = `
        <div class="suggestion-left">
          <span class="suggestion-badge">${highlightMatch(item.coin, query)}</span>
          <span class="suggestion-name">${item.coin} / USDT</span>
        </div>
        <div class="suggestion-right">
          <span class="suggestion-tag">OKX SWAP</span>
          <span class="suggestion-hint">↵ Chọn</span>
        </div>
      `;

      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectSuggestion(item.coin);
      });

      lookupSuggestionsDropdown.appendChild(el);
    });

    lookupSuggestionsDropdown.classList.remove('hidden');
  }

  function updateSuggestionSelection() {
    if (!lookupSuggestionsDropdown) return;
    const items = lookupSuggestionsDropdown.querySelectorAll('.lookup-suggestion-item');
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === activeSuggestionIndex);
      if (idx === activeSuggestionIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function selectSuggestion(coin) {
    if (!coin) return;
    if (lookupCoinInput) {
      lookupCoinInput.value = coin;
    }
    hideSuggestions();
    fetchAndRenderLookup(coin);
  }

  async function queryAutocomplete(rawQuery) {
    const q = (rawQuery || '').trim();
    if (!q) {
      hideSuggestions();
      return;
    }

    try {
      const res = await fetch(`/api/market/symbols?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.symbols)) {
        renderSuggestions(data.symbols, q);
      } else {
        hideSuggestions();
      }
    } catch (err) {
      hideSuggestions();
    }
  }

  // Chuẩn hóa tên coin nhập từ người dùng
  function normalizeCoinQuery(raw) {
    if (!raw) return 'BTC';
    let s = String(raw).trim().toUpperCase();
    s = s.replace(/^OKX:/i, '');
    s = s.replace(/\.P$/i, '');
    s = s.replace(/-SWAP$/i, '');
    s = s.replace(/\/USDT$/i, '');
    s = s.replace(/-USDT$/i, '');
    if (s.endsWith('USDT') && s.length > 4) {
      s = s.slice(0, -4);
    }
    return s.trim() || 'BTC';
  }

  // Cập nhật trạng thái active của các nút chọn nhanh coin
  function updateQuickPillActive(coin) {
    quickPillButtons.forEach(btn => {
      const pillCoin = (btn.dataset.coin || btn.textContent).trim().toUpperCase();
      btn.classList.toggle('active', pillCoin === coin);
    });
  }

  // Tải và hiển thị dữ liệu nến
  async function fetchAndRenderLookup(rawCoin, isRefresh = false) {
    const coin = normalizeCoinQuery(rawCoin);
    lookupActiveCoin = coin;
    if (lookupCoinInput && lookupCoinInput.value.toUpperCase() !== coin) {
      lookupCoinInput.value = coin;
    }
    updateQuickPillActive(coin);
    hideSuggestions();

    if (lookupSubmitBtn) {
      lookupSubmitBtn.disabled = true;
      lookupSubmitBtn.classList.add('loading');
    }
    if (lookupRefreshBtn) {
      lookupRefreshBtn.classList.add('rotating');
    }

    if (!lookupCachedData || (lookupCachedData.cleanSymbol && lookupCachedData.cleanSymbol !== coin) || !isRefresh) {
      if (lookupViewport) {
        lookupViewport.innerHTML = `
          <div class="lookup-loading-state">
            <div class="loader"></div>
            <span>Đang đồng bộ nến 30p, 1h, 4h cho <strong>${coin}-USDT-SWAP</strong> từ OKX...</span>
          </div>
        `;
      }
    }

    try {
      const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(coin)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không tìm thấy dữ liệu cặp coin trên sàn OKX');
      }

      lookupCachedData = data;
      lookupHasLoadedOnce = true;

      // Cập nhật thanh thông tin Coin Bar — Đảm bảo luôn hiển thị tên coin chuẩn, không bao giờ bị undefined
      const displayName = (data && data.cleanSymbol) || coin || (data && data.symbol ? data.symbol.split('-')[0] : 'BTC');
      if (lookupCoinAvatar) lookupCoinAvatar.textContent = displayName;
      if (lookupCoinName) lookupCoinName.textContent = `${displayName} / USDT`;
      if (lookupCoinInstId) lookupCoinInstId.textContent = data.symbol || `${displayName}-USDT-SWAP`;
      
      const ticker = data.ticker || {};
      const lastPrice = Number(ticker.last) || 0;
      if (lookupCoinPrice) lookupCoinPrice.textContent = `$${formatPrice(lastPrice)}`;
      
      if (lookupCoinChange) {
        let changeStr = ticker.changePercent24h !== undefined ? String(ticker.changePercent24h) : '+0.00%';
        if (!changeStr.endsWith('%')) changeStr += '%';
        if (!changeStr.startsWith('-') && !changeStr.startsWith('+')) changeStr = '+' + changeStr;
        lookupCoinChange.textContent = changeStr;
        const isUp = !changeStr.startsWith('-');
        lookupCoinChange.className = `coin-change-pill ${isUp ? 'pill-green' : 'pill-red'}`;
      }

      if (lookupHigh24h) lookupHigh24h.textContent = `$${formatPrice(Number(ticker.high24h) || 0)}`;
      if (lookupLow24h) lookupLow24h.textContent = `$${formatPrice(Number(ticker.low24h) || 0)}`;
      if (lookupVol24h) {
        const vol = Number(ticker.vol24h) || 0;
        lookupVol24h.textContent = vol >= 1e6 ? `${(vol / 1e6).toFixed(2)}M USDT` : `${formatPrice(vol)} USDT`;
      }

      // Vẽ biểu đồ
      renderLookupCharts(data, lookupActiveMode);

    } catch (err) {
      console.warn('Lỗi tra cứu nến OKX:', err);
      if (lookupViewport) {
        lookupViewport.innerHTML = `
          <div class="lookup-empty-state">
            <div class="empty-icon">⚠️</div>
            <h3>Không thể tải dữ liệu nến cho "${coin}"</h3>
            <p>${err.message || 'Vui lòng kiểm tra lại tên coin có giao dịch hợp đồng USDT Perpetual trên sàn OKX.'}</p>
            <div class="empty-action-hint">Gợi ý thử các mã phổ biến: BTC, ETH, SOL, SUI, DOGE, PEPE, FLOCK, NEAR, XRP...</div>
          </div>
        `;
      }
    } finally {
      if (lookupSubmitBtn) {
        lookupSubmitBtn.disabled = false;
        lookupSubmitBtn.classList.remove('loading');
      }
      if (lookupRefreshBtn) {
        lookupRefreshBtn.classList.remove('rotating');
      }
    }
  }

  // Render biểu đồ theo chế độ 'grid' hoặc từng khung ('30m', '1H', '4H')
  function renderLookupCharts(data, mode) {
    if (!lookupViewport) return;

    // Hủy bỏ các chart instances và ResizeObserver cũ
    lookupChartInstances.forEach(item => {
      try {
        if (item.resizeObserver) item.resizeObserver.disconnect();
        if (item.chart) item.chart.remove();
      } catch (e) {}
    });
    lookupChartInstances.clear();
    lookupViewport.innerHTML = '';

    const isGrid = mode === 'grid';
    lookupViewport.className = `lookup-viewport ${isGrid ? 'mode-grid' : 'mode-single'}`;

    const timeframes = isGrid ? ['30m', '1H', '4H'] : [mode];
    const tfMeta = {
      '30m': { label: '30 Phút', tagClass: 'tf-30m' },
      '1H':  { label: '1 Giờ',   tagClass: 'tf-1H' },
      '4H':  { label: '4 Giờ',   tagClass: 'tf-4H' }
    };

    timeframes.forEach(tf => {
      const candles = (data.candles && data.candles[tf]) ? data.candles[tf] : [];
      const meta = tfMeta[tf] || { label: tf, tagClass: 'tf-1H' };
      const latestBar = candles.length > 0 ? candles[candles.length - 1] : null;
      const latestClose = latestBar ? formatPrice(latestBar.close) : '0.00';
      const isBarGreen = latestBar ? (latestBar.close >= latestBar.open) : true;

      const chartBox = document.createElement('div');
      chartBox.className = 'lookup-chart-box';
      chartBox.innerHTML = `
        <div class="lookup-chart-header">
          <div class="chart-tf-title">
            <span class="tf-tag ${meta.tagClass}">${meta.label}</span>
            <span class="chart-candles-count">${candles.length} nến gần nhất</span>
          </div>
          <div class="chart-price-latest ${isBarGreen ? 'text-green' : 'text-red'}">
            $${latestClose}
          </div>
        </div>
        <div class="lookup-chart-canvas-container" id="lookupCanvas_${tf}" style="width: 100%; height: ${isGrid ? '420px' : '500px'};"></div>
      `;
      lookupViewport.appendChild(chartBox);

      const canvasContainer = chartBox.querySelector(`#lookupCanvas_${tf}`);
      if (!canvasContainer || typeof window.LightweightCharts === 'undefined') return;

      const themeOpts = getChartThemeOptions(currentTheme);
      const chart = window.LightweightCharts.createChart(canvasContainer, {
        width: canvasContainer.clientWidth || 360,
        height: isGrid ? 420 : 500,
        ...themeOpts,
        crosshair: {
          mode: window.LightweightCharts.CrosshairMode ? window.LightweightCharts.CrosshairMode.Normal : 1,
        },
        rightPriceScale: {
          ...themeOpts.rightPriceScale,
          scaleMargins: { top: 0.12, bottom: 0.12 }
        },
        timeScale: {
          ...themeOpts.timeScale,
          timeVisible: true,
          secondsVisible: false
        }
      });

      const seriesOptions = {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444'
      };

      const series = (typeof chart.addSeries === 'function' && window.LightweightCharts?.CandlestickSeries)
        ? chart.addSeries(window.LightweightCharts.CandlestickSeries, seriesOptions)
        : chart.addCandlestickSeries(seriesOptions);

      series.setData(candles);
      chart.timeScale().fitContent();

      // Responsive Resize
      const resizeObserver = new ResizeObserver(entries => {
        if (!entries || entries.length === 0) return;
        const entry = entries[0];
        const newWidth = Math.floor(entry.contentRect.width);
        if (newWidth > 100) {
          chart.applyOptions({ width: newWidth });
        }
      });
      resizeObserver.observe(canvasContainer);

      lookupChartInstances.set(tf, {
        chart,
        series,
        container: canvasContainer,
        resizeObserver
      });
    });
  }

  // Sự kiện gửi Form tra cứu
  if (lookupForm) {
    lookupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      hideSuggestions();
      const val = lookupCoinInput ? lookupCoinInput.value.trim() : '';
      if (val) {
        fetchAndRenderLookup(val);
      }
    });
  }

  // Lắng nghe gõ phím trên ô input để gợi ý Autocomplete
  if (lookupCoinInput) {
    lookupCoinInput.addEventListener('input', (e) => {
      const val = e.target.value;
      clearTimeout(autocompleteDebounceTimer);
      autocompleteDebounceTimer = setTimeout(() => {
        queryAutocomplete(val);
      }, 100);
    });

    lookupCoinInput.addEventListener('keydown', (e) => {
      if (!lookupSuggestionsDropdown || lookupSuggestionsDropdown.classList.contains('hidden')) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentSuggestions.length > 0) {
          activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
          updateSuggestionSelection();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentSuggestions.length > 0) {
          activeSuggestionIndex = (activeSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
          updateSuggestionSelection();
        }
      } else if (e.key === 'Enter') {
        if (activeSuggestionIndex >= 0 && activeSuggestionIndex < currentSuggestions.length) {
          e.preventDefault();
          selectSuggestion(currentSuggestions[activeSuggestionIndex].coin);
        }
      } else if (e.key === 'Escape') {
        hideSuggestions();
      }
    });

    lookupCoinInput.addEventListener('blur', () => {
      setTimeout(hideSuggestions, 200);
    });

    lookupCoinInput.addEventListener('focus', () => {
      const val = lookupCoinInput.value.trim();
      if (val) {
        queryAutocomplete(val);
      }
    });
  }

  // Đóng gợi ý nếu click ngoài form
  document.addEventListener('click', (e) => {
    if (lookupForm && !lookupForm.contains(e.target)) {
      hideSuggestions();
    }
  });

  // Sự kiện bấm chọn nút Coin nhanh (BTC, ETH, SOL, SUI...)
  quickPillButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const coin = (btn.dataset.coin || btn.textContent).trim();
      fetchAndRenderLookup(coin);
    });
  });

  // Sự kiện chuyển đổi chế độ hiển thị nến (Lưới 3 khung / 30p / 1h / 4h)
  if (lookupModeToggle) {
    lookupModeToggle.querySelectorAll('.lookup-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode || 'grid';
        lookupActiveMode = mode;
        lookupModeToggle.querySelectorAll('.lookup-mode-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
        if (lookupCachedData) {
          renderLookupCharts(lookupCachedData, lookupActiveMode);
        }
      });
    });
  }

  // Sự kiện bấm Làm mới nến
  if (lookupRefreshBtn) {
    lookupRefreshBtn.addEventListener('click', () => {
      fetchAndRenderLookup(lookupActiveCoin, true);
    });
  }

  // Hàm kích hoạt lần đầu khi người dùng chuyển sang view tra cứu nến
  window.triggerInitialLookupIfNeeded = function() {
    if (!lookupHasLoadedOnce) {
      fetchAndRenderLookup(lookupActiveCoin || 'BTC');
    } else {
      setTimeout(() => {
        lookupChartInstances.forEach(item => {
          try {
            if (item.container && item.chart) {
              item.chart.applyOptions({ width: item.container.clientWidth });
              item.chart.timeScale().fitContent();
            }
          } catch (e) {}
        });
      }, 60);
    }
  };

  // Khởi chạy nếu URL ban đầu mở trực tiếp tab Tra Cứu Nến
  const curHash = window.location.hash;
  if (curHash === '#chartLookupSection' || curHash === '#traCuuNen' || curHash === '#chart-lookup') {
    fetchAndRenderLookup('BTC');
  }
}

/**
 * Cấu hình màu sắc Lightweight Charts theo Dark / Light mode
 * GitHub Ref: https://github.com/tradingview/lightweight-charts (thư mục examples/)
 */
function getChartThemeOptions(theme) {
  const isDark = theme === 'dark';
  return {
    layout: {
      background: { color: isDark ? 'transparent' : '#ffffff' },
      textColor: isDark ? '#94a3b8' : '#475569',
      fontSize: 11,
      fontFamily: "'JetBrains Mono', monospace"
    },
    grid: {
      vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.06)' },
      horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.06)' }
    },
    rightPriceScale: {
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.12)'
    },
    timeScale: {
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.12)'
    }
  };
}

function updateStudioChartsTheme(theme) {
  const opts = getChartThemeOptions(theme);
  studioChartInstances.forEach((chart) => {
    try {
      chart.applyOptions(opts);
    } catch (e) {}
  });
  lookupChartInstances.forEach((item) => {
    try {
      if (item && item.chart) item.chart.applyOptions(opts);
    } catch (e) {}
  });
}

// =============================================================================
// TÌM KIẾM MỜ VÀ BỘ LỌC DỮ LIỆU FUSE.JS (KRISK/FUSE PATTERN)
// =============================================================================
// GitHub Ref: https://github.com/krisk/Fuse
// Pattern: Fuzzy search trên keys ['symbol', 'cleanSymbol'], threshold 0.35, kết hợp lọc mảng theo điều kiện đa khung.

function buildFuseIndex() {
  if (typeof window.Fuse === 'undefined') {
    fuseInstance = null;
    return;
  }
  const searchableList = allSetups.map(s => ({
    ...s,
    cleanSymbol: cleanDisplaySymbol(s.symbol)
  }));

  const fuseOptions = {
    keys: [
      { name: 'cleanSymbol', weight: 0.7 },
      { name: 'symbol', weight: 0.3 }
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 1
  };

  fuseInstance = new window.Fuse(searchableList, fuseOptions);
}

// =============================================================================
// ĐỊNH DẠNG DỮ LIỆU
// =============================================================================
function formatPrice(num) {
  if (typeof num !== 'number' || isNaN(num)) return '0.00';
  if (num >= 1000) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (num >= 1) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  } else {
    return num.toFixed(6);
  }
}

function calculateGainPct(entry, target, signal) {
  if (!entry || !target) return '';
  const diff = signal === 'long' ? (target - entry) : (entry - target);
  const pct = (diff / entry) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'N/A';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 15) return 'Vừa xong';
  if (diffSec < 60) return `${diffSec}s trước`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  return new Date(timestamp).toLocaleDateString('vi-VN');
}

/**
 * Chuẩn hóa tên symbol để hiển thị: bỏ "OKX:" và bỏ ".P", "-SWAP"
 * Ví dụ: "OKX:RKLBUSDT.P" -> "RKLBUSDT", "OKX:BTCUSDT.P" -> "BTCUSDT"
 */
function cleanDisplaySymbol(sym) {
  if (!sym) return '';
  return String(sym)
    .replace(/^OKX:/i, '')
    .replace(/\.P$/i, '')
    .replace(/-SWAP$/i, '');
}

// =============================================================================
// QUẢN LÝ CẤU HÌNH & GIAO DIỆN
// =============================================================================

/**
 * Cập nhật giao diện theo trạng thái cấu hình (Header pills, footer, modal inputs)
 */
function applyConfigToUI() {
  const allowed = (systemConfig.allowedBaseTimeframes || ['30m', '1h', '4h']).map(t => t.toLowerCase());

  // 1. Cập nhật các pill trạng thái trên Top Nav
  if (elements.hdrTf15m) {
    elements.hdrTf15m.className = 'header-tf-pill active';
    elements.hdrTf15m.title = 'Khung 15p: Chỉ dùng xem & xác nhận phụ (không vào lệnh)';
  }
  const updateHdrPill = (elem, tf) => {
    if (!elem) return;
    const isAct = allowed.includes(tf);
    elem.className = `header-tf-pill ${isAct ? 'active' : 'disabled'}`;
    elem.title = `Khung ${tf.replace('m', 'p')}: ${isAct ? 'Đang bật vào lệnh' : 'Đã tạm dừng'}`;
  };
  updateHdrPill(elements.hdrTf30m, '30m');
  updateHdrPill(elements.hdrTf1h, '1h');
  updateHdrPill(elements.hdrTf4h, '4h');

  // 2. Cập nhật Footer
  if (elements.footWr) elements.footWr.innerHTML = `Win Rate &gt; <b>${systemConfig.thresholds.minWinRate}%</b>`;
  if (elements.footPf) elements.footPf.innerHTML = `Profit Factor &gt; <b>${systemConfig.thresholds.minProfitFactor}</b>`;
  if (elements.footPnl) elements.footPnl.innerHTML = `Total PnL &gt; <b>$${systemConfig.thresholds.minTotalPnL}</b>`;

  const activeNames = allowed.map(tf => tf.replace('m', 'p')).join(', ');
  if (elements.footActiveTfs) {
    elements.footActiveTfs.innerHTML = `Đang nhận: <b>${activeNames || 'Chưa bật khung nào'}</b>`;
  }

  // Cập nhật chuẩn dữ liệu ở Support Footer
  if (elements.supportThresholdVal && systemConfig.thresholds) {
    const minWr = systemConfig.thresholds.minWinRate;
    const minPf = Number(systemConfig.thresholds.minProfitFactor).toFixed(2);
    elements.supportThresholdVal.textContent = `Win Rate > ${minWr}% • PF > ${minPf}`;
  }

  // 3. Cập nhật Icon âm thanh
  if (elements.soundOnIcon && elements.soundOffIcon) {
    if (systemConfig.soundAlert) {
      elements.soundOnIcon.classList.remove('hidden');
      elements.soundOffIcon.classList.add('hidden');
    } else {
      elements.soundOnIcon.classList.add('hidden');
      elements.soundOffIcon.classList.remove('hidden');
    }
  }

  // 4. Đồng bộ Form trong Settings Modal
  if (elements.toggleTf15m) elements.toggleTf15m.checked = allowed.includes('15m');
  if (elements.toggleTf30m) elements.toggleTf30m.checked = allowed.includes('30m');
  if (elements.toggleTf1h) elements.toggleTf1h.checked = allowed.includes('1h');
  if (elements.toggleTf4h) elements.toggleTf4h.checked = allowed.includes('4h');

  updateToggleCardStyles();

  if (elements.cfgMinWinRate) elements.cfgMinWinRate.value = systemConfig.thresholds.minWinRate;
  if (elements.cfgMinProfitFactor) elements.cfgMinProfitFactor.value = systemConfig.thresholds.minProfitFactor;
  if (elements.cfgMinTotalPnL) elements.cfgMinTotalPnL.value = systemConfig.thresholds.minTotalPnL;
  if (elements.cfgSoundAlert) elements.cfgSoundAlert.checked = !!systemConfig.soundAlert;
  if (elements.cfgRefreshInterval) elements.cfgRefreshInterval.value = String(systemConfig.refreshIntervalSec ?? 30);
}

function updateToggleCardStyles() {
  const syncCard = (card, chk, text) => {
    if (!card || !chk || !text) return;
    if (chk.checked) {
      card.classList.remove('disabled');
      text.textContent = 'Đang nhận';
      text.style.color = 'var(--long-green)';
    } else {
      card.classList.add('disabled');
      text.textContent = 'Tạm dừng';
      text.style.color = 'var(--text-faint)';
    }
  };
  syncCard(elements.cardTf15m, elements.toggleTf15m, elements.statusText15m);
  syncCard(elements.cardTf30m, elements.toggleTf30m, elements.statusText30m);
  syncCard(elements.cardTf1h, elements.toggleTf1h, elements.statusText1h);
  syncCard(elements.cardTf4h, elements.toggleTf4h, elements.statusText4h);
}

/**
 * Tải cấu hình từ Server qua GET /api/config
 */
async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.config) {
        systemConfig = {
          ...systemConfig,
          ...data.config,
          thresholds: {
            ...systemConfig.thresholds,
            ...(data.config.thresholds || {})
          }
        };
        applyConfigToUI();
      }
    }
  } catch (err) {
    console.warn('Không thể nạp cấu hình từ server, sử dụng cấu hình mặc định:', err);
  }
}

/**
 * Lưu cấu hình lên Server qua POST /api/config
 */
async function saveConfigToServer() {
  try {
    elements.saveSpinner.classList.remove('hidden');
    elements.saveSettingsBtn.disabled = true;

    // Thu thập các khung giờ được bật để VÀO LỆNH (chỉ 30m, 1h, 4h; 15m chỉ để xem/xác nhận)
    const selectedTfs = [];
    if (elements.toggleTf30m.checked) selectedTfs.push('30m');
    if (elements.toggleTf1h.checked) selectedTfs.push('1h');
    if (elements.toggleTf4h.checked) selectedTfs.push('4h');

    if (selectedTfs.length === 0) {
      alert('Vui lòng bật ít nhất một khung thời gian (30p, 1h hoặc 4h) để vào lệnh!');
      return;
    }

    const payload = {
      thresholds: {
        minWinRate: parseFloat(elements.cfgMinWinRate.value) || 36.0,
        minProfitFactor: parseFloat(elements.cfgMinProfitFactor.value) || 0.7,
        minTotalPnL: parseFloat(elements.cfgMinTotalPnL.value) || 0.0
      },
      allowedBaseTimeframes: selectedTfs,
      requiredConfirmations: ['15m', '30m', '1h', '4h'],
      soundAlert: elements.cfgSoundAlert.checked,
      refreshIntervalSec: parseInt(elements.cfgRefreshInterval.value, 10)
    };

    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success && data.config) {
      systemConfig = { ...systemConfig, ...data.config };
      applyConfigToUI();
      closeSettingsModal();
      showToast('Đã lưu cấu hình bộ lọc thành công!', 'success');
      // Làm mới lại dữ liệu ngay
      fetchSetups();
      restartCountdown();
    } else {
      throw new Error(data.error || 'Lỗi không xác định khi lưu');
    }
  } catch (err) {
    console.error('Lỗi khi lưu cấu hình:', err);
    showToast(`Lỗi khi lưu cấu hình: ${err.message}`, 'error');
  } finally {
    elements.saveSpinner.classList.add('hidden');
    elements.saveSettingsBtn.disabled = false;
  }
}

// =============================================================================
// MODAL CONTROLS
// =============================================================================
function openSettingsModal() {
  if (!AuthManager.currentUser) {
    showToast('Vui lòng đăng nhập để mở Cài đặt', 'error');
    AuthManager.openModal('login');
    return;
  }
  applyConfigToUI();
  elements.settingsModalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSettingsModal() {
  elements.settingsModalOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

// Gắn sự kiện thay đổi trực tiếp cho switch trong modal
[elements.toggleTf15m, elements.toggleTf30m, elements.toggleTf1h, elements.toggleTf4h].forEach(sw => {
  if (sw) sw.addEventListener('change', updateToggleCardStyles);
});

// =============================================================================
// THỐNG KÊ & BỘ ĐẾM
// =============================================================================
function updateMetricsAndDistribution(setups) {
  const total = setups.length;
  const longs = setups.filter(s => s.signal === 'long').length;
  const shorts = setups.filter(s => s.signal === 'short').length;

  const count15m = setups.filter(s => Array.isArray(s.confirmedBy) && s.confirmedBy.some(t => t.toLowerCase() === '15m')).length;
  const count30m = setups.filter(s => String(s.baseTimeframe).toLowerCase() === '30m').length;
  const count1h = setups.filter(s => String(s.baseTimeframe).toLowerCase() === '1h').length;
  const count4h = setups.filter(s => String(s.baseTimeframe).toLowerCase() === '4h').length;

  let avgWr = 0;
  let avgPf = 0;
  if (total > 0) {
    const validWrSetups = setups.filter(s => {
      const w = Number(s.winRate);
      return !isNaN(w) && w >= 0 && w <= 100;
    });
    const validPfSetups = setups.filter(s => {
      const p = Number(s.profitFactor);
      return !isNaN(p) && p >= 0 && p <= 100;
    });
    const sumWr = validWrSetups.reduce((acc, s) => acc + Number(s.winRate), 0);
    const sumPf = validPfSetups.reduce((acc, s) => acc + Number(s.profitFactor), 0);
    avgWr = validWrSetups.length > 0 ? (sumWr / validWrSetups.length).toFixed(1) : '0.0';
    avgPf = validPfSetups.length > 0 ? (sumPf / validPfSetups.length).toFixed(2) : '0.00';
  }

  // Cập nhật thẻ chỉ số chính
  elements.totalSetupsCount.textContent = String(total);
  elements.longSetupsCount.textContent = String(longs);
  elements.shortSetupsCount.textContent = String(shorts);
  elements.avgWinRate.textContent = `${avgWr}%`;
  elements.avgPfBadge.textContent = `PF: ${avgPf}`;

  const longRatio = total > 0 ? Math.round((longs / total) * 100) : 0;
  const shortRatio = total > 0 ? Math.round((shorts / total) * 100) : 0;
  elements.longRatioPill.textContent = `${longRatio}%`;
  elements.shortRatioPill.textContent = `${shortRatio}%`;

  // Cập nhật thanh phân bổ khung (nếu có trên DOM)
  if (elements.count15m) elements.count15m.textContent = String(count15m);
  if (elements.count30m) elements.count30m.textContent = String(count30m);
  if (elements.count1h) elements.count1h.textContent = String(count1h);
  if (elements.count4h) elements.count4h.textContent = String(count4h);

  // Cập nhật thông số ngưỡng hiển thị
  const allowed = systemConfig.allowedBaseTimeframes || ['30m', '1h', '4h'];
  const formattedTfNames = allowed.map(t => t.replace('m', 'p')).join(' • ');
  elements.totalSetupsSub.textContent = `Vào lệnh: ${formattedTfNames || 'Chưa bật'} (15p xác nhận)`;
  elements.thresholdDisplaySub.textContent = `Ngưỡng: WR > ${systemConfig.thresholds.minWinRate}% • PF > ${systemConfig.thresholds.minProfitFactor}`;
}

// =============================================================================
// LỌC & SẮP XẾP DỮ LIỆU
// =============================================================================
// GitHub Ref: https://github.com/krisk/Fuse & https://github.com/tabler/tabler
// Pattern: Chaining Fuse.js fuzzy candidate extraction with Tabler multi-criteria filter & sort.
function getFilteredAndSortedSetups() {
  const rawQuery = (elements.searchInput?.value || '').trim();

  let baseList;
  if (rawQuery && fuseInstance) {
    const results = fuseInstance.search(rawQuery);
    baseList = results.map(r => r.item);
  } else if (rawQuery) {
    const qUpper = rawQuery.toUpperCase();
    baseList = allSetups.filter(s => {
      const sym = (s.symbol || '').toUpperCase();
      const clean = cleanDisplaySymbol(s.symbol).toUpperCase();
      return sym.includes(qUpper) || clean.includes(qUpper);
    });
  } else {
    baseList = allSetups;
  }

  let list = baseList.filter(s => {
    // 1. Lọc theo quick filter tab
    const baseTf = String(s.baseTimeframe).toLowerCase();
    const sig = String(s.signal).toLowerCase();

    // 15m chỉ là khung xem và xác nhận: lọc các kèo có 15m xác nhận
    if (currentFilter === '15m') {
      const has15m = Array.isArray(s.confirmedBy) && s.confirmedBy.some(t => t.toLowerCase() === '15m');
      if (!has15m) return false;
    }
    if (currentFilter === '30m' && baseTf !== '30m') return false;
    if (currentFilter === '1h' && baseTf !== '1h') return false;
    if (currentFilter === '4h' && baseTf !== '4h') return false;
    if (currentFilter === 'long' && sig !== 'long') return false;
    if (currentFilter === 'short' && sig !== 'short') return false;

    // 2. Khung 15p chỉ dùng để xem và xác nhận, không hiển thị làm kèo vào lệnh
    if (baseTf === '15m') return false;

    // 3. Lọc theo ngưỡng kỹ thuật tập trung đã cài đặt (Win Rate, PF, Total PnL)
    const minWr = Number(systemConfig.thresholds?.minWinRate) || 0;
    const minPf = Number(systemConfig.thresholds?.minProfitFactor) || 0;
    const minPnl = Number(systemConfig.thresholds?.minTotalPnL) || 0;

    const wr = Number(s.winRate) || 0;
    const pf = Number(s.profitFactor) || 0;
    const pnl = Number(s.totalPnL) || 0;

    if (minWr > 0 && wr < minWr) return false;
    if (minPf > 0 && pf < minPf) return false;
    if (pnl < minPnl) return false;

    return true;
  });

  // Sắp xếp
  list.sort((a, b) => {
    if (currentSort === 'winrate') {
      return (Number(b.winRate) || 0) - (Number(a.winRate) || 0);
    } else if (currentSort === 'pf') {
      return (Number(b.profitFactor) || 0) - (Number(a.profitFactor) || 0);
    } else if (currentSort === 'pnl') {
      return (Number(b.totalPnL) || 0) - (Number(a.totalPnL) || 0);
    } else {
      // Mặc định: newest
      return (b.scannedAt || 0) - (a.scannedAt || 0);
    }
  });

  return list;
}

// =============================================================================
// RENDER BẢNG DỮ LIỆU
// =============================================================================
// =============================================================================
// RENDER BẢNG DỮ LIỆU PRO TRADING MATRIX (ZERO HORIZONTAL SCROLL - 8 CỘT)
// =============================================================================
function renderTable() {
  const filtered = getFilteredAndSortedSetups();
  elements.setupsTableBody.innerHTML = '';

  // 1. Kiểm tra trạng thái đăng nhập: nếu chưa đăng nhập -> ẨN TOÀN BỘ KÈO
  if (!AuthManager.currentUser) {
    elements.tableShowingCount.innerHTML = `<span class="auth-lock-badge">🔒 Đã khóa</span> Yêu cầu đăng nhập để xem kèo`;
    elements.emptyMessage.classList.add('hidden');

    const tr = document.createElement('tr');
    tr.className = 'auth-locked-row';
    tr.innerHTML = `
      <td colspan="9">
        <div class="auth-locked-container">
          <div class="locked-icon-halo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h3 class="locked-title">Bảng Kèo Trực Tiếp Đang Được Bảo Vệ</h3>
          <div class="locked-action-row">
            <button class="btn-locked-login" id="lockedLoginBtn" type="button">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span>Đăng Nhập Tài Khoản</span>
            </button>
            <button class="btn-locked-google" id="lockedGoogleBtn" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Đăng Nhập bằng Gmail</span>
            </button>
          </div>
        </div>
      </td>
    `;
    elements.setupsTableBody.appendChild(tr);

    const lBtn = tr.querySelector('#lockedLoginBtn');
    if (lBtn) lBtn.addEventListener('click', () => AuthManager.openModal('login'));
    const gBtn = tr.querySelector('#lockedGoogleBtn');
    if (gBtn) gBtn.addEventListener('click', () => AuthManager.loginWithGoogle());

    return;
  }

  // 2. Đã đăng nhập: hiển thị số lượng và danh sách kèo
  elements.tableShowingCount.innerHTML = `Đang hiển thị <b>${filtered.length}</b> / ${allSetups.length} setup`;

  if (filtered.length === 0) {
    elements.emptyMessage.classList.remove('hidden');
    return;
  }

  elements.emptyMessage.classList.add('hidden');
  const fragment = document.createDocumentFragment();

  filtered.forEach((s, index) => {
    const tr = document.createElement('tr');
    tr.id = `row-setup-${s.id}`;

    if (activeStudioSetup && activeStudioSetup.id === s.id) {
      tr.classList.add('row-active');
    }

    const tf = String(s.baseTimeframe).toLowerCase();
    const isLong = s.signal === 'long';
    const entry = Number(s.entry) || 0;

    // Chuẩn hóa tên hiển thị: bỏ OKX: và bỏ .P, -SWAP (VD: OKX:RKLBUSDT.P -> RKLBUSDT)
    const displaySym = cleanDisplaySymbol(s.symbol);
    // Tách mã coin gốc (VD: RKLBUSDT -> RKLB)
    const cleanSym = displaySym.replace(/USDT$/i, '').replace(/-USDT$/i, '');

    // Xác định class cho khung thời gian
    let tfBadgeClass = 'tf-badge-1h';
    let tfDisplayName = s.baseTimeframe.replace('m', 'p');
    if (tf === '15m') tfBadgeClass = 'tf-badge-15m';
    else if (tf === '30m') tfBadgeClass = 'tf-badge-30m';
    else if (tf === '1h')  tfBadgeClass = 'tf-badge-1h';
    else if (tf === '4h')  tfBadgeClass = 'tf-badge-4h';

    // Tính % gain cho TP và SL
    const tp1Pct = s.tp1 ? calculateGainPct(entry, s.tp1, s.signal) : '';
    const tp2Pct = s.tp2 ? calculateGainPct(entry, s.tp2, s.signal) : '';
    const tp3Pct = s.tp3 ? calculateGainPct(entry, s.tp3, s.signal) : '';
    const slPct = s.sl ? calculateGainPct(entry, s.sl, s.signal) : '';

    const pnl = Number(s.totalPnL) || 0;
    const wr = Number(s.winRate) || 0;
    const pf = Number(s.profitFactor) || 0;

    tr.innerHTML = `
      <td style="text-align: center; color: var(--text-faint); font-family: var(--font-mono); font-size: 11px;">
        ${index + 1}
      </td>
      <td>
        <div class="symbol-cell-wrap">
          <span class="coin-icon">${cleanSym.slice(0, 3)}</span>
          <div class="symbol-name-wrap">
            <div class="symbol-title-row">
              <b>${displaySym}</b>
              <button class="btn-copy-coin" data-clean="${displaySym}" data-coin="${cleanSym}" title="Sao chép tên coin ${displaySym}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </td>
      <td style="text-align: right;">
        <div class="entry-cell-standalone">
          <span class="entry-price-val">$${formatPrice(entry)}</span>
        </div>
      </td>
      <td style="text-align: center;">
        <div class="dual-tf-sig">
          <span class="tf-badge ${tfBadgeClass}">${tfDisplayName}</span>
          <span class="signal-pill ${isLong ? 'long' : 'short'}">${isLong ? 'LONG' : 'SHORT'}</span>
        </div>
      </td>
      <td style="text-align: right;">
        <div class="sl-cell-standalone">
          <span class="sl-price">${s.sl ? `SL $${formatPrice(s.sl)} <small>(${slPct})</small>` : '-'}</span>
        </div>
      </td>
      <td style="text-align: center;">
        <div class="tp-chip-group">
          ${s.tp1 ? `<div class="tp-clean-item" title="Mục tiêu 1: $${formatPrice(s.tp1)}"><span class="tp-num">TP1</span> <span class="tp-price-val">$${formatPrice(s.tp1)}</span> <span class="tp-gain">(${tp1Pct})</span></div>` : '-'}
          ${s.tp2 ? `<div class="tp-clean-item" title="Mục tiêu 2: $${formatPrice(s.tp2)}"><span class="tp-num">TP2</span> <span class="tp-price-val">$${formatPrice(s.tp2)}</span> <span class="tp-gain">(${tp2Pct})</span></div>` : ''}
          ${s.tp3 ? `<div class="tp-clean-item" title="Mục tiêu 3: $${formatPrice(s.tp3)}"><span class="tp-num">TP3</span> <span class="tp-price-val">$${formatPrice(s.tp3)}</span> <span class="tp-gain">(${tp3Pct})</span></div>` : ''}
        </div>
      </td>
      <td style="text-align: center;">
        <div class="perf-matrix-cell">
          <div class="perf-matrix-top">
            <span class="wr-val">${wr.toFixed(1)}%</span>
            <div class="wr-bar-bg">
              <div class="wr-bar-fill" style="width: ${Math.min(wr, 100)}%;"></div>
            </div>
          </div>
          <div class="perf-matrix-bottom">
            <span class="pf-pill">PF: ${pf.toFixed(2)}</span>
            <span class="pnl-cell" style="color: ${pnl >= 0 ? 'var(--long-green)' : 'var(--short-red)'}; font-weight: 700;">
              ${pnl >= 0 ? '+$' : '$'}${pnl.toFixed(1)}
            </span>
          </div>
        </div>
      </td>
      <td style="text-align: center;">
        <div class="consensus-time-cell">
          <span class="confirm-pill">${(Array.isArray(s.confirmedBy) ? s.confirmedBy : ['15m', '30m']).join(' & ')}</span>
          <span class="time-cell" title="${new Date(s.scannedAt).toLocaleString('vi-VN')}">${formatRelativeTime(s.scannedAt)}</span>
        </div>
      </td>
      <td style="text-align: center;">
        <div class="matrix-action-cell">
          <button class="btn-open-studio ${activeStudioSetup?.id === s.id ? 'active' : ''}" data-id="${s.id}" title="Mở phòng xem nến 3 khung">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18"/>
              <path d="M18 17V9"/>
              <path d="M13 17V5"/>
              <path d="M8 17v-3"/>
            </svg>
            <span>Xem nến</span>
          </button>
          <button class="btn-action-copy" data-id="${s.id}" title="Sao chép toàn bộ chi tiết kèo">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      </td>
    `;

    // 1. Click cả dòng để mở phòng xem nến (trừ khi click nút sao chép)
    tr.addEventListener('click', () => {
      openChartStudio(s);
    });

    // 2. Gắn sự kiện nút sao chép tên coin
    const copyCoinBtn = tr.querySelector('.btn-copy-coin');
    if (copyCoinBtn) {
      copyCoinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const coinName = copyCoinBtn.dataset.clean;
        navigator.clipboard.writeText(coinName).then(() => {
          copyCoinBtn.classList.add('copied');
          copyCoinBtn.title = 'Đã sao chép!';
          showToast(`Đã sao chép: ${coinName}`, 'success');
          setTimeout(() => {
            copyCoinBtn.classList.remove('copied');
            copyCoinBtn.title = `Sao chép tên coin ${coinName}`;
          }, 1500);
        }).catch(() => {
          showToast('Không thể truy cập Clipboard', 'error');
        });
      });
    }

    // 3. Gắn sự kiện nút mở phòng xem nến
    const studioBtn = tr.querySelector('.btn-open-studio');
    if (studioBtn) {
      studioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openChartStudio(s);
      });
    }

    // 4. Gắn sự kiện sao chép toàn bộ kèo
    const copyBtn = tr.querySelector('.btn-action-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copySetupToClipboard(s);
      });
    }

    fragment.appendChild(tr);
  });

  elements.setupsTableBody.appendChild(fragment);

  // GitHub Ref: https://github.com/greensock/GSAP (thư mục demos/docs)
  // Pattern: Staggered entrance animation for data table rows on refresh with power2.out easing.
  if (window.gsap) {
    const rows = elements.setupsTableBody.querySelectorAll('tr');
    if (rows.length > 0) {
      window.gsap.fromTo(rows,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.025, ease: 'power2.out', clearProps: 'transform' }
      );
    }
  }
}

// =============================================================================
// DOCKED CHART STUDIO (PHÒNG XEM NẾN ĐỘC LẬP - ZERO HORIZONTAL SCROLL)
// =============================================================================
function openChartStudio(s, mode = currentStudioMode) {
  if (!s) return;
  activeStudioSetup = s;
  currentStudioMode = mode;

  // 1. Cập nhật dòng active trong bảng
  document.querySelectorAll('.data-table.pro-matrix tbody tr').forEach(r => {
    r.classList.remove('row-active');
  });
  const currentTr = document.getElementById(`row-setup-${s.id}`);
  if (currentTr) currentTr.classList.add('row-active');

  // Cập nhật trạng thái active trên các nút Xem nến
  document.querySelectorAll('.btn-open-studio').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === String(s.id));
  });

  // 2. Mở panel studio
  if (elements.chartStudioPanel) {
    const wasHidden = elements.chartStudioPanel.classList.contains('hidden');
    elements.chartStudioPanel.classList.remove('hidden');

    // GitHub Ref: https://github.com/greensock/GSAP (thư mục demos/docs)
    // Pattern: Smooth expand and reveal animation for docked chart studio panel with power3.out easing.
    if (wasHidden && window.gsap) {
      window.gsap.fromTo(elements.chartStudioPanel,
        { opacity: 0, y: 24, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out', clearProps: 'transform' }
      );
    }
  }

  // 3. Hiển thị thông tin coin và các mức giá
  const displaySym = cleanDisplaySymbol(s.symbol);
  if (elements.studioSymbolTitle) elements.studioSymbolTitle.textContent = displaySym;

  const isLong = s.signal === 'long';
  if (elements.studioSignalBadge) {
    elements.studioSignalBadge.className = `signal-pill ${isLong ? 'long' : 'short'}`;
    elements.studioSignalBadge.textContent = isLong ? '▲ LONG' : '▼ SHORT';
  }

  const tf = String(s.baseTimeframe).toLowerCase();
  let tfBadgeClass = 'tf-badge-1h';
  let tfDisplayName = s.baseTimeframe.replace('m', 'p');
  if (tf === '15m') tfBadgeClass = 'tf-badge-15m';
  else if (tf === '30m') tfBadgeClass = 'tf-badge-30m';
  else if (tf === '1h') tfBadgeClass = 'tf-badge-1h';
  else if (tf === '4h') tfBadgeClass = 'tf-badge-4h';

  if (elements.studioTfBadge) {
    elements.studioTfBadge.className = `tf-badge ${tfBadgeClass}`;
    elements.studioTfBadge.textContent = tfDisplayName;
  }

  const entry = Number(s.entry) || 0;
  if (elements.studioEntryVal) elements.studioEntryVal.textContent = `$${formatPrice(entry)}`;
  if (elements.studioSlVal) elements.studioSlVal.textContent = s.sl ? `$${formatPrice(s.sl)}` : 'N/A';
  if (elements.studioTp1Val) elements.studioTp1Val.textContent = s.tp1 ? `$${formatPrice(s.tp1)}` : 'N/A';
  if (elements.studioTp2Val) elements.studioTp2Val.textContent = s.tp2 ? `$${formatPrice(s.tp2)}` : 'N/A';
  if (elements.studioTp3Val) elements.studioTp3Val.textContent = s.tp3 ? `$${formatPrice(s.tp3)}` : 'N/A';

  // 4. Cập nhật nút chế độ (grid / 30m / 1H / 4H)
  if (elements.studioModeToggle) {
    elements.studioModeToggle.querySelectorAll('.studio-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  // 5. Khởi tạo viewport & tải nến
  buildStudioViewportDOM(s, mode);
  loadAndRenderStudioCandles(s, mode, false);

  // Cuộn nhẹ tới panel
  if (elements.chartStudioPanel) {
    elements.chartStudioPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function buildStudioViewportDOM(s, mode) {
  destroyAllStudioCharts();
  if (!elements.studioViewport) return;
  elements.studioViewport.innerHTML = '';

  if (mode === 'grid') {
    elements.studioViewport.className = 'studio-viewport grid-mode';
    const timeframes = [
      { key: '30m', label: 'Khung 30p', pillClass: 'tf-30m' },
      { key: '1H',  label: 'Khung 1h',  pillClass: 'tf-1h' },
      { key: '4H',  label: 'Khung 4h',  pillClass: 'tf-4h' }
    ];

    timeframes.forEach(item => {
      const box = document.createElement('div');
      box.className = 'studio-chart-box';
      box.innerHTML = `
        <div class="studio-chart-topbar">
          <span class="chart-tf-pill ${item.pillClass}">${item.label}</span>
          <span class="chart-last-price" id="studio-last-price-${item.key}">Đang tải...</span>
        </div>
        <div class="studio-chart-canvas" id="studio-chart-container-${item.key}">
          <div class="studio-loading-overlay"><span class="loader"></span> Đang nạp nến ${item.label}...</div>
        </div>
      `;
      elements.studioViewport.appendChild(box);
    });
  } else {
    // Chế độ phóng to toàn màn hình cho 1 khung duy nhất
    elements.studioViewport.className = 'studio-viewport focus-mode';
    let pillClass = 'tf-1h';
    let label = `Khung ${mode.replace('m', 'p')}`;
    if (mode === '30m') pillClass = 'tf-30m';
    else if (mode === '4H') pillClass = 'tf-4h';

    const box = document.createElement('div');
    box.className = 'studio-chart-box';
    box.innerHTML = `
      <div class="studio-chart-topbar">
        <span class="chart-tf-pill ${pillClass}">${label} (Phóng To Toàn Chiều Ngang)</span>
        <span class="chart-last-price" id="studio-last-price-${mode}">Đang tải...</span>
      </div>
      <div class="studio-chart-canvas" id="studio-chart-container-${mode}">
        <div class="studio-loading-overlay"><span class="loader"></span> Đang nạp nến ${label}...</div>
      </div>
    `;
    elements.studioViewport.appendChild(box);
  }
}

async function loadAndRenderStudioCandles(s, mode, forceSync = false) {
  const setupId = s.id;
  try {
    let url = `/api/setups/${setupId}/candles`;
    let method = 'GET';
    if (forceSync) {
      url = `/api/setups/${setupId}/candles/sync`;
      method = 'POST';
      showToast('Đang yêu cầu sàn OKX cập nhật nến mới nhất...', 'info');
    }

    const res = await fetch(url, { method });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Lỗi truy vấn nến sàn');
    }

    // Nếu chưa có nến và chưa forceSync, tự động gọi sync
    if ((!data.hasCandles || !data.candles || !data.candles['30m']?.length) && !forceSync) {
      return loadAndRenderStudioCandles(s, mode, true);
    }

    const tfsToRender = mode === 'grid' ? ['30m', '1H', '4H'] : [mode];

    tfsToRender.forEach(tf => {
      const container = document.getElementById(`studio-chart-container-${tf}`);
      const priceElem = document.getElementById(`studio-last-price-${tf}`);
      if (!container) return;

      const candles = (data.candles && data.candles[tf]) || [];
      container.innerHTML = '';

      if (candles.length === 0) {
        container.innerHTML = `<div class="studio-loading-overlay">Chưa có dữ liệu nến ${tf} từ sàn OKX</div>`;
        return;
      }

      const lastCandle = candles[candles.length - 1];
      if (priceElem && lastCandle) {
        priceElem.textContent = `$${formatPrice(lastCandle.close)}`;
      }

      if (!window.LightweightCharts) {
        container.innerHTML = `<div class="studio-loading-overlay">Đang tải thư viện biểu đồ...</div>`;
        return;
      }

      if (studioChartInstances.has(tf)) {
        try {
          studioChartInstances.get(tf).remove();
        } catch (e) {}
        studioChartInstances.delete(tf);
      }

      const chartHeight = mode === 'grid' ? 310 : 480;
      const themeOpts = getChartThemeOptions(currentTheme);

      // GitHub Ref: https://github.com/tradingview/lightweight-charts (thư mục examples/)
      // Pattern: createChart with dynamic theme options, CandlestickSeries, and createPriceLine for Entry/SL/TP levels.
      const chart = window.LightweightCharts.createChart(container, {
        width: container.clientWidth || 360,
        height: chartHeight,
        ...themeOpts,
        crosshair: {
          mode: window.LightweightCharts.CrosshairMode ? window.LightweightCharts.CrosshairMode.Normal : 1,
        },
        rightPriceScale: {
          ...themeOpts.rightPriceScale,
          scaleMargins: { top: 0.15, bottom: 0.15 }
        },
        timeScale: {
          ...themeOpts.timeScale,
          timeVisible: true,
          secondsVisible: false
        }
      });

      const seriesOptions = {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444'
      };

      const series = (typeof chart.addSeries === 'function' && window.LightweightCharts?.CandlestickSeries)
        ? chart.addSeries(window.LightweightCharts.CandlestickSeries, seriesOptions)
        : chart.addCandlestickSeries(seriesOptions);

      series.setData(candles);

      const lineStyleSolid = window.LightweightCharts?.LineStyle?.Solid ?? 0;
      const lineStyleDashed = window.LightweightCharts?.LineStyle?.Dashed ?? 2;
      const lineStyleDotted = window.LightweightCharts?.LineStyle?.Dotted ?? 1;

      // Kẻ đường Entry (Xanh Cyan)
      if (s.entry) {
        series.createPriceLine({
          price: Number(s.entry),
          color: '#38bdf8',
          lineWidth: 2,
          lineStyle: lineStyleSolid,
          axisLabelVisible: true,
          title: `ENTRY $${formatPrice(s.entry)}`
        });
      }

      // Kẻ đường SL (Đỏ)
      if (s.sl) {
        series.createPriceLine({
          price: Number(s.sl),
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: lineStyleDashed,
          axisLabelVisible: true,
          title: `SL $${formatPrice(s.sl)}`
        });
      }

      // Kẻ đường TP1, TP2, TP3 (Xanh lá)
      if (s.tp1) {
        series.createPriceLine({
          price: Number(s.tp1),
          color: '#22c55e',
          lineWidth: 1.5,
          lineStyle: lineStyleDotted,
          axisLabelVisible: true,
          title: `TP1 $${formatPrice(s.tp1)}`
        });
      }
      if (s.tp2) {
        series.createPriceLine({
          price: Number(s.tp2),
          color: '#10b981',
          lineWidth: 1.5,
          lineStyle: lineStyleDotted,
          axisLabelVisible: true,
          title: `TP2 $${formatPrice(s.tp2)}`
        });
      }
      if (s.tp3) {
        series.createPriceLine({
          price: Number(s.tp3),
          color: '#059669',
          lineWidth: 1.5,
          lineStyle: lineStyleDotted,
          axisLabelVisible: true,
          title: `TP3 $${formatPrice(s.tp3)}`
        });
      }

      chart.timeScale().fitContent();
      studioChartInstances.set(tf, chart);
    });

    if (forceSync) {
      showToast('Đã nạp nến mới nhất từ sàn OKX thành công!', 'success');
    }
  } catch (err) {
    console.error('Lỗi khi vẽ nến studio cho setup #' + setupId, err);
    showToast('Lỗi khi tải nến: ' + err.message, 'error');
  }
}

function switchStudioMode(newMode) {
  if (currentStudioMode === newMode && elements.studioViewport.children.length > 0) return;
  currentStudioMode = newMode;
  if (elements.studioModeToggle) {
    elements.studioModeToggle.querySelectorAll('.studio-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === newMode);
    });
  }
  if (activeStudioSetup) {
    buildStudioViewportDOM(activeStudioSetup, newMode);
    loadAndRenderStudioCandles(activeStudioSetup, newMode, false);
  }
}

// GitHub Ref: https://github.com/greensock/GSAP (thư mục demos/docs)
// Pattern: Smooth collapse animation for docked chart studio panel with power2.in easing.
function closeChartStudio() {
  const finishClose = () => {
    destroyAllStudioCharts();
    if (elements.chartStudioPanel) {
      elements.chartStudioPanel.classList.add('hidden');
      elements.chartStudioPanel.style.opacity = '';
      elements.chartStudioPanel.style.transform = '';
    }
  };

  if (elements.chartStudioPanel && window.gsap && !elements.chartStudioPanel.classList.contains('hidden')) {
    window.gsap.to(elements.chartStudioPanel, {
      opacity: 0,
      y: 16,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: finishClose
    });
  } else {
    finishClose();
  }

  document.querySelectorAll('.data-table.pro-matrix tbody tr').forEach(r => {
    r.classList.remove('row-active');
  });
  document.querySelectorAll('.btn-open-studio').forEach(btn => {
    btn.classList.remove('active');
  });
  activeStudioSetup = null;
}

function destroyAllStudioCharts() {
  studioChartInstances.forEach((chart) => {
    try {
      chart.remove();
    } catch (e) {}
  });
  studioChartInstances.clear();
}

// Xử lý co giãn biểu đồ tự động khi thay đổi kích thước cửa sổ trình duyệt
window.addEventListener('resize', () => {
  studioChartInstances.forEach((chart, tf) => {
    const container = document.getElementById(`studio-chart-container-${tf}`);
    if (container && chart) {
      chart.applyOptions({ width: container.clientWidth });
    }
  });
});

/**
 * Sao chép thông tin kèo vào Clipboard
 */
function copySetupToClipboard(s) {
  const isLong = s.signal === 'long';
  const displaySym = cleanDisplaySymbol(s.symbol);
  const text = [
    `🎯 [KÈO PHÁI SINH OKX] ${displaySym}`,
    `⚡ Khung cơ sở: ${s.baseTimeframe.replace('m', 'p')} | Vị thế: ${s.signal.toUpperCase()}`,
    `💵 Entry: $${formatPrice(s.entry)}`,
    s.tp1 ? `🎯 TP1: $${formatPrice(s.tp1)} (${calculateGainPct(s.entry, s.tp1, s.signal)})` : '',
    s.tp2 ? `🎯 TP2: $${formatPrice(s.tp2)} (${calculateGainPct(s.entry, s.tp2, s.signal)})` : '',
    s.tp3 ? `🎯 TP3: $${formatPrice(s.tp3)} (${calculateGainPct(s.entry, s.tp3, s.signal)})` : '',
    s.sl ? `🛑 Stop Loss: $${formatPrice(s.sl)} (${calculateGainPct(s.entry, s.sl, s.signal)})` : '',
    `📊 Win Rate: ${s.winRate}% | Profit Factor: ${s.profitFactor} | Total PnL: $${s.totalPnL}`,
    `⏱️ Quét lúc: ${new Date(s.scannedAt).toLocaleTimeString('vi-VN')} - Local Orchestrator Pro`
  ].filter(Boolean).join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast(`Đã sao chép tín hiệu ${displaySym} vào Clipboard!`, 'success');
  }).catch(() => {
    showToast('Không thể truy cập Clipboard trình duyệt.', 'error');
  });
}

// =============================================================================
// TRUY VẤN DỮ LIỆU TỪ SERVER (FETCH SETUPS)
// =============================================================================
async function fetchSetups() {
  try {
    elements.refreshBtn.classList.add('spinning');
    const res = await fetch('/api/setups?limit=150');

    if (!res.ok) {
      throw new Error(`Mã lỗi HTTP: ${res.status}`);
    }

    const data = await res.json();
    if (data.success && Array.isArray(data.setups)) {
      // Kiểm tra có kèo mới xuất hiện để phát chuông
      if (previousSetupsCount !== -1 && data.setups.length > previousSetupsCount) {
        playChimeSound();
        showToast(`Phát hiện ${data.setups.length - previousSetupsCount} kèo đẹp mới đạt chuẩn!`, 'success');
      }
      previousSetupsCount = data.setups.length;

      allSetups = data.setups;
      buildFuseIndex();
      updateMetricsAndDistribution(allSetups);
      renderTable();

      if (elements.serverStatusPill) elements.serverStatusPill.className = 'server-status-pill online';
      if (elements.serverStatusText) elements.serverStatusText.textContent = 'Online';
    }
  } catch (err) {
    console.error('Lỗi khi fetch setups:', err);
    if (elements.serverStatusPill) elements.serverStatusPill.className = 'server-status-pill offline';
    if (elements.serverStatusText) elements.serverStatusText.textContent = 'Mất kết nối server';
  } finally {
    elements.refreshBtn.classList.remove('spinning');
  }
}

// =============================================================================
// ĐẾM NGƯỢC TỰ ĐỘNG LÀM MỚI
// =============================================================================
function restartCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  const intervalSec = systemConfig.refreshIntervalSec ?? 30;
  if (intervalSec <= 0) {
    elements.countdownTimer.textContent = 'Tắt';
    return;
  }

  countdownSec = intervalSec;
  elements.countdownTimer.textContent = String(countdownSec);

  countdownInterval = setInterval(() => {
    countdownSec--;
    if (countdownSec <= 0) {
      countdownSec = intervalSec;
      fetchSetups();
    }
    elements.countdownTimer.textContent = String(countdownSec);
  }, 1000);
}

// =============================================================================
// EVENT LISTENERS & TƯƠNG TÁC NGƯỜI DÙNG
// =============================================================================

// 1. Phím tắt mở cài đặt & nút Cài Đặt
elements.openSettingsBtn.addEventListener('click', openSettingsModal);
elements.closeSettingsBtn.addEventListener('click', closeSettingsModal);
elements.cancelSettingsBtn.addEventListener('click', closeSettingsModal);
elements.saveSettingsBtn.addEventListener('click', saveConfigToServer);

// Đóng modal khi bấm ra ngoài nền
elements.settingsModalOverlay.addEventListener('click', (e) => {
  if (e.target === elements.settingsModalOverlay) {
    closeSettingsModal();
  }
});

// Đóng modal khi nhấn Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !elements.settingsModalOverlay.classList.contains('hidden')) {
    closeSettingsModal();
  }
  // Phím tắt Ctrl + K để focus vào ô tìm kiếm
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    elements.searchInput.focus();
    elements.searchInput.select();
  }
});

// Nút khôi phục mặc định cài đặt
elements.resetDefaultSettingsBtn.addEventListener('click', () => {
  if (confirm('Khôi phục toàn bộ cài đặt về trạng thái chuẩn ban đầu?')) {
    elements.toggleTf15m.checked = true;
    elements.toggleTf30m.checked = true;
    elements.toggleTf1h.checked = true;
    elements.toggleTf4h.checked = true;
    updateToggleCardStyles();

    elements.cfgMinWinRate.value = '42.0';
    elements.cfgMinProfitFactor.value = '0.80';
    elements.cfgMinTotalPnL.value = '0.0';
    elements.cfgSoundAlert.checked = true;
    elements.cfgRefreshInterval.value = '30';
  }
});

// Nút thử âm thanh
elements.btnTestSound.addEventListener('click', () => {
  const orig = systemConfig.soundAlert;
  systemConfig.soundAlert = true;
  playChimeSound();
  systemConfig.soundAlert = orig;
  showToast('Đang phát âm thanh thông báo mẫu...', 'info', 1500);
});

// Bật/tắt nhanh âm thanh từ Header
elements.soundToggleBtn.addEventListener('click', () => {
  systemConfig.soundAlert = !systemConfig.soundAlert;
  applyConfigToUI();
  if (systemConfig.soundAlert) {
    playChimeSound();
    showToast('Đã BẬT chuông thông báo kèo mới', 'success');
  } else {
    showToast('Đã TẮT chuông thông báo', 'info');
  }
  // Lưu trạng thái âm thanh lên server
  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ soundAlert: systemConfig.soundAlert })
  }).catch(() => {});
});

// Quick Filter Chips trên Toolbar
elements.quickFilterGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-chip');
  if (!btn) return;

  elements.quickFilterGroup.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');

  currentFilter = btn.dataset.filter || 'all';
  renderTable();
});

// Timeframe Distribution Strip Chips
[
  { chip: elements.chip15m, tf: '15m' },
  { chip: elements.chip30m, tf: '30m' },
  { chip: elements.chip1h,  tf: '1h' },
  { chip: elements.chip4h,  tf: '4h' }
].forEach(({ chip, tf }) => {
  if (chip) {
    chip.addEventListener('click', () => {
      currentFilter = tf;
      // Đồng bộ với quick filter chips
      elements.quickFilterGroup.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.filter === tf);
      });
      elements.showAllTfBtn.classList.remove('active');
      renderTable();
    });
  }
});

if (elements.showAllTfBtn) {
  elements.showAllTfBtn.addEventListener('click', () => {
    currentFilter = 'all';
    elements.quickFilterGroup.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.filter === 'all');
    });
    elements.showAllTfBtn.classList.add('active');
    renderTable();
  });
}

// Sắp xếp
elements.sortSelect.addEventListener('change', (e) => {
  currentSort = e.target.value;
  renderTable();
});

// Tìm kiếm
elements.searchInput.addEventListener('input', () => {
  renderTable();
});

// Nút làm mới thủ công
elements.refreshBtn.addEventListener('click', () => {
  fetchSetups();
  restartCountdown();
});

// Nút xóa dữ liệu
elements.clearSetupsBtn.addEventListener('click', async () => {
  if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách kèo hiện tại để bắt đầu phiên mới không?')) {
    return;
  }
  try {
    const res = await fetch('/api/setups', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      allSetups = [];
      buildFuseIndex();
      previousSetupsCount = 0;
      updateMetricsAndDistribution([]);
      renderTable();
      showToast('Đã dọn sạch toàn bộ dữ liệu kèo cũ.', 'info');
    }
  } catch (err) {
    showToast('Lỗi khi xóa dữ liệu: ' + err.message, 'error');
  }
});

// Nút đặt lại bộ lọc trong Empty State
elements.resetFiltersBtn.addEventListener('click', () => {
  elements.searchInput.value = '';
  currentFilter = 'all';
  currentSort = 'newest';
  elements.sortSelect.value = 'newest';
  elements.quickFilterGroup.querySelectorAll('.filter-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === 'all');
  });
  if (elements.showAllTfBtn) elements.showAllTfBtn.classList.add('active');
  renderTable();
});

// =============================================================================
// SỰ KIỆN PHÒNG XEM NẾN ĐỘC LẬP (DOCKED CHART STUDIO)
// =============================================================================
// Nút chuyển chế độ xem (Lưới 3 khung, 30p, 1h, 4h)
if (elements.studioModeToggle) {
  elements.studioModeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.studio-mode-btn');
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (mode) switchStudioMode(mode);
  });
}

// Nút đóng phòng xem nến
if (elements.studioCloseBtn) {
  elements.studioCloseBtn.addEventListener('click', () => {
    closeChartStudio();
  });
}

// Nút cập nhật nến từ OKX trong studio
if (elements.studioSyncBtn) {
  elements.studioSyncBtn.addEventListener('click', () => {
    if (activeStudioSetup) {
      loadAndRenderStudioCandles(activeStudioSetup, currentStudioMode, true);
    }
  });
}

// Đóng studio khi bấm phím Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && elements.chartStudioPanel && !elements.chartStudioPanel.classList.contains('hidden')) {
    // Chỉ đóng nếu settings modal không mở
    if (elements.settingsModalOverlay && elements.settingsModalOverlay.classList.contains('hidden')) {
      closeChartStudio();
    }
  }
});

// =============================================================================
// AUTHENTICATION MANAGER (ĐĂNG NHẬP / ĐĂNG KÝ / TÀI KHOẢN TRADER)
// =============================================================================
// AUTHENTICATION MANAGER (ĐĂNG NHẬP / ĐĂNG KÝ / GOOGLE OAUTH 2.0 CHÍNH HÃNG)
// =============================================================================
const GOOGLE_CLIENT_ID = '767037038958-6on9qqvnpcifsigfchaj2veipgtjh0hc.apps.googleusercontent.com';

const AuthManager = {
  currentUser: null,
  googleTokenClient: null,

  init() {
    // 1. Kiểm tra session từ localStorage
    try {
      const saved = localStorage.getItem('bot_crypto_user');
      if (saved) {
        this.currentUser = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Không thể đọc dữ liệu phiên đăng nhập:', e);
    }

    this.updateUI();
    this.bindEvents();
    this.initRealGoogleGIS();
  },

  /**
   * Khởi tạo Google Identity Services (GIS) chính hãng từ Google
   */
  initRealGoogleGIS() {
    if (typeof google === 'undefined' || !google.accounts) {
      setTimeout(() => this.initRealGoogleGIS(), 400);
      return;
    }

    try {
      // 1. Khởi tạo Google Token Client để mở Popup chọn tài khoản chính chủ của Google
      if (google.accounts.oauth2) {
        this.googleTokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              await this.handleGoogleAccessToken(tokenResponse.access_token);
            } else if (tokenResponse && tokenResponse.error) {
              console.warn('[Google OAuth Error]', tokenResponse);
              const errMsg = tokenResponse.error_description || tokenResponse.error;
              showToast(`Lỗi đăng nhập Google: ${errMsg}`, 'error');
            }
          }
        });
        console.log('[Auth] Google OAuth 2.0 Token Client chính hãng đã sẵn sàng.');
      }
    } catch (err) {
      console.warn('[Auth] Lỗi khởi tạo Google GIS:', err);
    }
  },

  /**
   * Gửi Access Token tới backend để lấy thông tin thật từ Google và nhận JWT
   */
  async handleGoogleAccessToken(accessToken) {
    if (!accessToken) return;
    showToast('Đang kết nối tài khoản Google...', 'info');

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken })
      });
      const data = await res.json();

      if (data.success && data.user) {
        this.onLoginSuccess(data.user, data.token);
      } else {
        showToast(data.message || 'Xác thực Google thất bại!', 'error');
      }
    } catch (err) {
      console.error('[Auth] Lỗi kết nối Google Auth:', err);
      showToast('Lỗi máy chủ khi đăng nhập Google.', 'error');
    }
  },

  /**
   * Gửi Google ID Token tới backend
   */
  async handleGoogleIdToken(idToken) {
    if (!idToken) return;
    showToast('Đang kết nối tài khoản Google...', 'info');

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json();

      if (data.success && data.user) {
        this.onLoginSuccess(data.user, data.token);
      } else {
        showToast(data.message || 'Xác thực Google thất bại!', 'error');
      }
    } catch (err) {
      console.error('[Auth] Lỗi kết nối Google Auth:', err);
      showToast('Lỗi máy chủ khi đăng nhập Google.', 'error');
    }
  },

  /**
   * Xử lý sau khi đăng nhập thành công
   */
  onLoginSuccess(user, token) {
    this.currentUser = user;
    localStorage.setItem('bot_crypto_user', JSON.stringify(user));
    if (token) {
      localStorage.setItem('bot_crypto_token', token);
    }
    this.closeModal();
    this.updateUI();
    renderTable();
    showToast(`Đăng nhập Google thành công! Chào mừng ${user.name || user.username}`, 'success');
  },

  /**
   * Kích hoạt cửa sổ đăng nhập Google chính hãng
   */
  loginWithGoogle() {
    if (this.googleTokenClient) {
      // Mở Popup thật của Google (accounts.google.com)
      this.googleTokenClient.requestAccessToken({ prompt: 'select_account' });
    } else {
      // Dự phòng: Mở cửa sổ OAuth Google chuẩn
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(window.location.origin)}&response_type=token&scope=openid%20email%20profile&prompt=select_account`;
      const popup = window.open(authUrl, 'GoogleLogin', 'width=520,height=620,top=100,left=150');
      if (!popup) {
        showToast('Vui lòng cho phép trình duyệt mở popup để đăng nhập Google!', 'error');
      }
    }
  },

  updateUI() {
    if (this.currentUser) {
      // Đã đăng nhập -> Hiện nút Cài đặt, ẩn nút Đăng nhập header
      if (elements.openSettingsBtn) elements.openSettingsBtn.classList.remove('hidden');
      if (elements.authOpenModalBtn) elements.authOpenModalBtn.classList.add('hidden');
      if (elements.userProfileBadge) {
        elements.userProfileBadge.classList.remove('hidden');
        if (elements.userDisplayName) {
          elements.userDisplayName.textContent = this.currentUser.name || this.currentUser.username || 'Trader';
        }
        if (elements.userAvatarMini) {
          if (this.currentUser.avatar) {
            elements.userAvatarMini.innerHTML = `<img src="${this.currentUser.avatar}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
            elements.userAvatarMini.style.backgroundColor = 'transparent';
          } else {
            const letter = (this.currentUser.name || this.currentUser.username || 'TR').substring(0, 2).toUpperCase();
            elements.userAvatarMini.textContent = letter;
            elements.userAvatarMini.style.backgroundColor = '';
          }
        }
      }
    } else {
      // Chưa đăng nhập -> Ẩn nút Cài đặt, hiện nút Đăng nhập
      if (elements.openSettingsBtn) elements.openSettingsBtn.classList.add('hidden');
      if (elements.authOpenModalBtn) elements.authOpenModalBtn.classList.remove('hidden');
      if (elements.userProfileBadge) elements.userProfileBadge.classList.add('hidden');
      if (elements.authBtnLabel) elements.authBtnLabel.textContent = 'Đăng Nhập';
    }
  },

  openModal(tab = 'login') {
    if (!elements.authModalOverlay) return;
    this.switchTab(tab);
    this.clearFeedback();
    elements.authModalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      if (tab === 'login' && elements.loginEmail) {
        elements.loginEmail.focus();
      } else if (tab === 'register' && elements.regUsername) {
        elements.regUsername.focus();
      }
    }, 100);
  },

  closeModal() {
    if (!elements.authModalOverlay) return;
    elements.authModalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    this.clearFeedback();
  },

  switchTab(tab) {
    if (!elements.tabLoginBtn || !elements.tabRegisterBtn) return;
    const isLogin = tab === 'login';
    elements.tabLoginBtn.classList.toggle('active', isLogin);
    elements.tabRegisterBtn.classList.toggle('active', !isLogin);
    elements.tabLoginBtn.setAttribute('aria-selected', isLogin ? 'true' : 'false');
    elements.tabRegisterBtn.setAttribute('aria-selected', !isLogin ? 'true' : 'false');

    if (elements.loginForm) elements.loginForm.classList.toggle('hidden', !isLogin);
    if (elements.registerForm) elements.registerForm.classList.toggle('hidden', isLogin);
    this.clearFeedback();
  },

  showFeedback(message, type = 'success') {
    if (!elements.authFeedback) return;
    elements.authFeedback.textContent = message;
    elements.authFeedback.className = `auth-feedback ${type}`;
    elements.authFeedback.classList.remove('hidden');
  },

  clearFeedback() {
    if (!elements.authFeedback) return;
    elements.authFeedback.classList.add('hidden');
    elements.authFeedback.textContent = '';
  },

  login(usernameOrEmail) {
    const user = {
      name: usernameOrEmail.includes('@') ? usernameOrEmail.split('@')[0] : usernameOrEmail,
      username: usernameOrEmail.includes('@') ? usernameOrEmail.split('@')[0] : usernameOrEmail,
      email: usernameOrEmail.includes('@') ? usernameOrEmail : `${usernameOrEmail}@botcrypto.pro`,
      loginTime: new Date().toISOString(),
      role: 'PRO VIP'
    };
    this.currentUser = user;
    try {
      localStorage.setItem('bot_crypto_user', JSON.stringify(user));
    } catch (e) {}

    this.showFeedback(`Đăng nhập thành công! Chào mừng ${user.username}`, 'success');
    this.updateUI();
    renderTable();

    setTimeout(() => {
      this.closeModal();
    }, 700);
  },

  logout() {
    this.currentUser = null;
    try {
      localStorage.removeItem('bot_crypto_user');
      localStorage.removeItem('bot_crypto_token');
    } catch (e) {}
    this.updateUI();
    renderTable();
    showToast('Đã đăng xuất tài khoản thành công', 'info');
  },

  bindEvents() {
    // Mở modal đăng nhập thường
    if (elements.authOpenModalBtn) {
      elements.authOpenModalBtn.addEventListener('click', () => this.openModal('login'));
    }

    // Đóng modal đăng nhập thường
    if (elements.closeAuthBtn) {
      elements.closeAuthBtn.addEventListener('click', () => this.closeModal());
    }

    if (elements.authModalOverlay) {
      elements.authModalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.authModalOverlay) {
          this.closeModal();
        }
      });
    }

    // Đăng xuất
    if (elements.authLogoutBtn) {
      elements.authLogoutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.logout();
      });
    }

    // Tab chuyển đổi
    if (elements.tabLoginBtn) {
      elements.tabLoginBtn.addEventListener('click', () => this.switchTab('login'));
    }
    if (elements.tabRegisterBtn) {
      elements.tabRegisterBtn.addEventListener('click', () => this.switchTab('register'));
    }

    // Ẩn/Hiện mật khẩu
    document.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          const isPwd = input.type === 'password';
          input.type = isPwd ? 'text' : 'password';
          btn.textContent = isPwd ? '🙈' : '👁️';
        }
      });
    });

    // Form Đăng Nhập
    if (elements.loginForm) {
      elements.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = elements.loginEmail ? elements.loginEmail.value.trim() : '';
        const pwd = elements.loginPassword ? elements.loginPassword.value : '';
        if (!email || !pwd) {
          this.showFeedback('Vui lòng điền đầy đủ Email và Mật khẩu', 'error');
          return;
        }
        this.login(email);
      });
    }

    // Đăng nhập bằng Gmail (Google)
    if (elements.googleLoginBtn) {
      elements.googleLoginBtn.addEventListener('click', () => {
        this.loginWithGoogle();
      });
    }

    // Form Đăng Ký
    if (elements.registerForm) {
      elements.registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = elements.regUsername ? elements.regUsername.value.trim() : '';
        const email = elements.regEmail ? elements.regEmail.value.trim() : '';
        const pwd = elements.regPassword ? elements.regPassword.value : '';
        const cfm = elements.regConfirmPassword ? elements.regConfirmPassword.value : '';

        if (!username || !email || !pwd) {
          this.showFeedback('Vui lòng điền đầy đủ thông tin đăng ký', 'error');
          return;
        }

        if (pwd !== cfm) {
          this.showFeedback('Mật khẩu xác nhận không trùng khớp!', 'error');
          return;
        }

        this.showFeedback('Đăng ký tài khoản thành công! Đang kích hoạt...', 'success');
        setTimeout(() => {
          this.login(username);
        }, 600);
      });
    }

    // ESC to close modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (elements.googleChooserOverlay && !elements.googleChooserOverlay.classList.contains('hidden')) {
          this.closeGoogleChooser();
        } else if (elements.authModalOverlay && !elements.authModalOverlay.classList.contains('hidden')) {
          this.closeModal();
        }
      }
    });
  }
};

// =============================================================================
// KHỞI CHẠY LẦN ĐẦU (INITIALIZATION)
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initCandleLookup();
  AuthManager.init();
  await fetchConfig();
  await fetchSetups();
  restartCountdown();
});
