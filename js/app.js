(function () {
  'use strict';

  // --- State ---
  var state = {
    categories: [],
    procedures: [],
    activeCategory: 'all',
    current: null,       // current procedure data
    stepIndex: 0,
    wakeLock: null,
    preloadAbort: null   // AbortController for image preloading
  };

  // --- DOM refs ---
  var $ = function (id) { return document.getElementById(id); };
  var gridView = $('grid-view');
  var slideView = $('slide-view');
  var gridContainer = $('grid-container');
  var gridEmpty = $('grid-empty');
  var gridError = $('grid-error');
  var categoryTabs = $('category-tabs');
  var slideImage = $('slide-image');
  var imagePlaceholder = $('image-placeholder');
  var placeholderAlt = $('placeholder-alt');
  var slideTitle = $('slide-title');
  var slideDesc = $('slide-desc');
  var stepIndicator = $('step-indicator');
  var prevBtn = $('prev-btn');
  var nextBtn = $('next-btn');
  var backBtn = $('back-btn');
  var endScreen = $('end-screen');
  var endBackBtn = $('end-back-btn');
  var slideContent = $('slide-content');
  var offlineBanner = $('offline-banner');
  var updateBanner = $('update-banner');
  var updateBtn = $('update-btn');

  // --- Init ---
  function init() {
    loadProcedureIndex();
    setupRouting();
    setupKeyboard();
    setupSwipe();
    setupOfflineDetection();
    registerServiceWorker();
  }

  // --- Data Loading ---
  function loadProcedureIndex() {
    fetch('procedures/index.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        state.categories = data.categories || [];
        state.procedures = data.procedures || [];
        renderCategoryTabs();
        renderGrid();
        handleRoute();
      })
      .catch(function () {
        showError();
      });
  }

  function loadProcedure(id) {
    return fetch('procedures/' + id + '.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
  }

  // --- Category Tabs ---
  function renderCategoryTabs() {
    categoryTabs.innerHTML = '';

    // "All" tab
    var allTab = document.createElement('button');
    allTab.className = 'tab' + (state.activeCategory === 'all' ? ' active' : '');
    allTab.setAttribute('role', 'tab');
    allTab.setAttribute('aria-selected', state.activeCategory === 'all' ? 'true' : 'false');
    allTab.dataset.category = 'all';
    allTab.textContent = '全部';
    allTab.addEventListener('click', function () { setCategory('all'); });
    categoryTabs.appendChild(allTab);

    // Category tabs
    state.categories.forEach(function (cat) {
      var tab = document.createElement('button');
      tab.className = 'tab' + (state.activeCategory === cat.id ? ' active' : '');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', state.activeCategory === cat.id ? 'true' : 'false');
      tab.dataset.category = cat.id;
      tab.textContent = cat.title;
      tab.addEventListener('click', function () { setCategory(cat.id); });
      categoryTabs.appendChild(tab);
    });
  }

  function setCategory(categoryId) {
    state.activeCategory = categoryId;
    renderCategoryTabs();
    renderGrid();
  }

  function getFilteredProcedures() {
    if (state.activeCategory === 'all') return state.procedures;
    return state.procedures.filter(function (p) { return p.category === state.activeCategory; });
  }

  // --- Grid Rendering ---
  function renderGrid() {
    gridContainer.innerHTML = '';
    gridEmpty.hidden = true;
    gridError.hidden = true;

    var filtered = getFilteredProcedures();
    if (filtered.length === 0) {
      showEmpty();
      return;
    }

    filtered.forEach(function (proc) {
      var card = document.createElement('a');
      card.className = 'card';
      card.href = '#/' + proc.id;
      card.tabIndex = 0;
      card.setAttribute('role', 'link');
      card.setAttribute('aria-label', proc.title);

      var thumb = document.createElement('img');
      thumb.className = 'card-thumb';
      thumb.src = proc.thumbnail;
      thumb.alt = proc.title;
      thumb.loading = 'lazy';
      thumb.onerror = function () {
        this.style.background = 'var(--border-light)';
        this.alt = proc.title;
      };

      var title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = proc.title;

      card.appendChild(thumb);
      card.appendChild(title);
      gridContainer.appendChild(card);
    });
  }

  function showEmpty() {
    gridContainer.innerHTML = '';
    gridEmpty.hidden = false;
    gridError.hidden = true;
  }

  function showError() {
    gridContainer.innerHTML = '';
    gridEmpty.hidden = true;
    gridError.hidden = false;
  }

  // --- Routing ---
  function setupRouting() {
    window.addEventListener('hashchange', handleRoute);
  }

  function handleRoute() {
    var hash = window.location.hash;
    if (hash.startsWith('#/') && hash.length > 2) {
      var id = hash.slice(2);
      enterSlideshow(id);
    } else {
      exitSlideshow();
    }
  }

  // --- Slideshow ---
  function enterSlideshow(id) {
    var proc = state.procedures.find(function (p) { return p.id === id; });
    if (!proc) {
      window.location.hash = '';
      return;
    }

    loadProcedure(id)
      .then(function (data) {
        state.current = data;
        state.stepIndex = 0;

        switchView(slideView);
        endScreen.hidden = true;
        preloadImages(data.steps);
        renderStep();
        requestWakeLock();
      })
      .catch(function () {
        window.location.hash = '';
      });
  }

  function exitSlideshow() {
    state.current = null;
    state.stepIndex = 0;
    cancelPreload();
    releaseWakeLock();
    switchView(gridView);
  }

  function switchView(target) {
    gridView.classList.remove('active');
    slideView.classList.remove('active');
    target.classList.add('active');
    target.classList.add('view-enter');
    setTimeout(function () { target.classList.remove('view-enter'); }, 200);
  }

  function renderStep() {
    if (!state.current) return;
    var steps = state.current.steps;
    var step = steps[state.stepIndex];

    // Update indicator
    stepIndicator.textContent = (state.stepIndex + 1) + ' / ' + steps.length;

    // Update image
    slideImage.hidden = false;
    imagePlaceholder.hidden = true;
    slideImage.classList.add('loading');
    slideImage.src = step.image;
    slideImage.alt = step.alt || step.title;
    slideImage.onload = function () {
      slideImage.classList.remove('loading');
    };
    slideImage.onerror = function () {
      slideImage.hidden = true;
      imagePlaceholder.hidden = false;
      placeholderAlt.textContent = step.alt || step.title;
    };

    // Update text
    slideTitle.textContent = step.title;
    slideDesc.textContent = step.description;

    // Update buttons
    prevBtn.disabled = state.stepIndex === 0;
    nextBtn.disabled = state.stepIndex === steps.length - 1;

    // Show/hide end screen
    endScreen.hidden = true;
  }

  function goNext() {
    if (!state.current) return;
    if (state.stepIndex < state.current.steps.length - 1) {
      state.stepIndex++;
      renderStep();
    } else {
      showEndScreen();
    }
  }

  function goPrev() {
    if (!state.current) return;
    if (state.stepIndex > 0) {
      state.stepIndex--;
      renderStep();
    }
  }

  function showEndScreen() {
    endScreen.hidden = false;
  }

  // --- Event Handlers ---
  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);
  backBtn.addEventListener('click', function () { window.location.hash = ''; });
  endBackBtn.addEventListener('click', function () { window.location.hash = ''; });

  // --- Keyboard Navigation ---
  function setupKeyboard() {
    document.addEventListener('keydown', function (e) {
      if (!slideView.classList.contains('active')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 'Escape') { e.preventDefault(); window.location.hash = ''; }
    });
  }

  // --- Touch / Swipe ---
  function setupSwipe() {
    var startX = 0;
    var startY = 0;
    var startTime = 0;
    var touching = false;
    var fingerCount = 0;

    slideContent.addEventListener('touchstart', function (e) {
      fingerCount = e.touches.length;
      if (fingerCount > 1) return; // ignore pinch-to-zoom
      touching = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }, { passive: true });

    slideContent.addEventListener('touchend', function (e) {
      if (!touching || fingerCount > 1) { touching = false; return; }
      touching = false;

      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;
      var deltaX = endX - startX;
      var deltaY = endY - startY;
      var elapsed = Date.now() - startTime;

      // Threshold: 50px minimum displacement, must be more horizontal than vertical
      if (Math.abs(deltaX) < 50) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;
      if (elapsed > 500) return; // too slow

      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    }, { passive: true });
  }

  // --- Image Preloading ---
  function preloadImages(steps) {
    cancelPreload();
    state.preloadAbort = new AbortController();

    steps.forEach(function (step) {
      var img = new Image();
      img.src = step.image;
    });
  }

  function cancelPreload() {
    if (state.preloadAbort) {
      state.preloadAbort.abort();
      state.preloadAbort = null;
    }
  }

  // --- Wake Lock ---
  function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen')
      .then(function (lock) { state.wakeLock = lock; })
      .catch(function () { /* graceful fallback */ });
  }

  function releaseWakeLock() {
    if (state.wakeLock) {
      state.wakeLock.release().catch(function () {});
      state.wakeLock = null;
    }
  }

  // Re-acquire wake lock on visibility change (iOS releases it when tab is hidden)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && slideView.classList.contains('active')) {
      requestWakeLock();
    }
  });

  // --- Offline Detection ---
  function setupOfflineDetection() {
    function updateOnlineStatus() {
      offlineBanner.hidden = navigator.onLine;
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
  }

  // --- Service Worker ---
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('js/sw.js')
      .then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              updateBanner.hidden = false;
            }
          });
        });
      })
      .catch(function () { /* SW registration failed, app still works */ });

    updateBtn.addEventListener('click', function () {
      updateBanner.hidden = true;
      window.location.reload();
    });
  }

  // --- Start ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { state: state, goNext: goNext, goPrev: goPrev, renderStep: renderStep };
  }
})();
