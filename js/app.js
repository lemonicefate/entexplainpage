/* ============================================================
 * 診間解說 · Explain
 * Vanilla JS PWA — home / player / calculator
 * ============================================================ */
(function () {
  'use strict';

  // --- State ---
  var state = {
    categories: [],
    procedures: [],
    activeFilter: 'all',         // all | pinned | explain | surgery | calc
    query: '',
    pins: loadPins(),
    current: null,               // current procedure data
    stepIndex: 0,
    activeTool: null,            // pen | spot | laser | null
    wakeLock: null,
    preloadAbort: null,
    chromeHidden: false,
    chromeTimer: null
  };

  var CHROME_AUTO_HIDE_MS = 3000;

  // --- DOM refs ---
  var $ = function (id) { return document.getElementById(id); };
  var homeView = $('home-view');
  var slideView = $('slide-view');
  var calcView = $('calc-view');
  var searchInput = $('search-input');
  var filterChips = $('filter-chips');
  var resultCount = $('result-count');
  var gridContainer = $('grid-container');
  var gridEmpty = $('grid-empty');
  var gridError = $('grid-error');
  // player
  var slideStage = $('slide-stage');
  var slideImage = $('slide-image');
  var imagePlaceholder = $('image-placeholder');
  var placeholderTitle = $('placeholder-title');
  var placeholderAlt = $('placeholder-alt');
  var stepIndicator = $('step-indicator');
  var playerTitle = $('player-title');
  var playerPageTitle = $('player-page-title');
  var prevBtn = $('prev-btn');
  var nextBtn = $('next-btn');
  var backBtn = $('back-btn');
  var endScreen = $('end-screen');
  var endBackBtn = $('end-back-btn');
  var thumbStrip = $('thumb-strip');
  var laserDot = $('laser-dot');
  var spotOverlay = $('spot-overlay');
  // tap zones (e-book navigation)
  var tapPrev = $('tap-prev');
  var tapToggle = $('tap-toggle');
  var tapNext = $('tap-next');
  // scrubber (mobile page slider)
  var scrubber = $('scrubber');
  var scrubberLabel = $('scrubber-label');
  // calculator
  var calcBack = $('calc-back');
  var calcTabs = $('calc-tabs');
  var calcBody = $('calc-body');
  // banners
  var offlineBanner = $('offline-banner');
  var updateBanner = $('update-banner');
  var updateBtn = $('update-btn');

  // ============================================================
  // Static metadata: built-in calculators (separate from JSON data)
  // ============================================================
  var CALCULATORS = [
    {id:'bmi',       title:'BMI 與肥胖分級',  subtitle:'身高體重 → BMI + 國健署分級',  type:'calc', kind:'calc'},
    {id:'lipid',     title:'血脂風險與 Statin 給付', subtitle:'LDL/HDL/TG + 共病 → ASCVD 風險 + 健保判讀', type:'calc', kind:'calc'},
    {id:'peds-dose', title:'小兒劑量（mg/kg）', subtitle:'體重 + 目標劑量 → 總 mg + ml 數', type:'calc', kind:'calc'}
  ];

  var TYPE_LABELS = { explain: '解釋病情', surgery: '手術流程', calc: '計算機' };

  // SVG namespace and helpers (avoid innerHTML so we don't trip XSS heuristics)
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svg(attrs, children) {
    var node = document.createElementNS(SVG_NS, 'svg');
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }
  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }
  function starIcon(filled) {
    return svg(
      { width: '14', height: '14', viewBox: '0 0 24 24',
        fill: filled ? 'currentColor' : 'none', stroke: 'currentColor',
        'stroke-width': '2', 'stroke-linecap': 'round' },
      [svgEl('path', { d: 'm12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z' })]
    );
  }

  // ============================================================
  // Pins (localStorage)
  // ============================================================
  function loadPins() {
    try { return JSON.parse(localStorage.getItem('clinic_pins') || '[]'); }
    catch (e) { return []; }
  }
  function savePins() {
    try { localStorage.setItem('clinic_pins', JSON.stringify(state.pins)); } catch (e) {}
  }
  function isPinned(id) { return state.pins.indexOf(id) !== -1; }
  function togglePin(id) {
    if (isPinned(id)) state.pins = state.pins.filter(function (p) { return p !== id; });
    else state.pins = state.pins.concat([id]);
    savePins();
    renderFilterChips();
    renderGrid();
  }

  // ============================================================
  // Init
  // ============================================================
  function init() {
    setupSearch();
    setupKeyboard();
    setupRouting();
    setupSwipe();
    setupOffline();
    setupPlayerControls();
    setupTapZones();
    setupScrubber();
    setupCalcShell();
    registerServiceWorker();
    loadIndex();
  }

  function loadIndex() {
    fetch('procedures/index.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        state.categories = data.categories || [];
        state.procedures = (data.procedures || []).map(normalizeProcedure);
        renderFilterChips();
        renderGrid();
        handleRoute();
      })
      .catch(function () { showGridError(); });
  }

  function normalizeProcedure(p) {
    return {
      id: p.id,
      title: p.title,
      category: p.category || '',
      thumbnail: p.thumbnail || '',
      subtitle: p.subtitle || '',
      type: p.type || 'surgery',         // explain | surgery
      region: p.region || '',
      slides: p.slides || null,
      kind: 'project'
    };
  }

  function loadProcedure(id) {
    return fetch('procedures/' + id + '.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  // ============================================================
  // Filter chips + grid
  // ============================================================
  var FILTERS = [
    { key: 'all',     label: '全部' },
    { key: 'pinned',  label: '★ 釘選' },
    { key: 'explain', label: '解釋病情' },
    { key: 'surgery', label: '手術流程' },
    { key: 'calc',    label: '計算機' }
  ];

  function renderFilterChips() {
    filterChips.textContent = '';
    FILTERS.forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', state.activeFilter === f.key ? 'true' : 'false');
      btn.dataset.filter = f.key;
      btn.textContent = f.key === 'pinned' ? '★ 釘選 (' + state.pins.length + ')' : f.label;
      btn.addEventListener('click', function () {
        state.activeFilter = f.key;
        renderFilterChips();
        renderGrid();
      });
      filterChips.appendChild(btn);
    });
  }

  function getAllItems() {
    var items = state.procedures.slice();
    CALCULATORS.forEach(function (c) { items.push(c); });
    return items;
  }

  function getFilteredItems() {
    var items = getAllItems();
    var f = state.activeFilter;
    if (f === 'pinned')      items = items.filter(function (i) { return isPinned(i.id); });
    else if (f === 'explain') items = items.filter(function (i) { return i.type === 'explain'; });
    else if (f === 'surgery') items = items.filter(function (i) { return i.type === 'surgery'; });
    else if (f === 'calc')    items = items.filter(function (i) { return i.kind === 'calc'; });

    var q = state.query.trim().toLowerCase();
    if (q) {
      items = items.filter(function (i) {
        return (i.title || '').toLowerCase().indexOf(q) !== -1
            || (i.subtitle || '').toLowerCase().indexOf(q) !== -1
            || (i.region || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    items.sort(function (a, b) {
      var ap = isPinned(a.id) ? 0 : 1;
      var bp = isPinned(b.id) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (a.title || '').localeCompare(b.title || '', 'zh-Hant');
    });
    return items;
  }

  function renderGrid() {
    gridEmpty.hidden = true;
    gridError.hidden = true;

    var items = getFilteredItems();
    resultCount.textContent = items.length + ' 個項目';

    if (!items.length) {
      gridContainer.textContent = '';
      gridEmpty.hidden = false;
      return;
    }

    var frag = document.createDocumentFragment();
    items.forEach(function (item) { frag.appendChild(buildCard(item)); });
    gridContainer.textContent = '';
    gridContainer.appendChild(frag);
  }

  function buildCard(item) {
    var pinned = isPinned(item.id);
    var card = document.createElement('a');
    card.className = 'card' + (pinned ? ' is-pinned' : '');
    card.href = item.kind === 'calc' ? '#/calc/' + item.id : '#/' + item.id;
    card.setAttribute('aria-label', item.title);

    if (item.kind === 'project' && item.thumbnail) {
      var img = document.createElement('img');
      img.className = 'card-thumb';
      img.src = item.thumbnail;
      img.alt = item.title;
      img.loading = 'lazy';
      img.onerror = function () {
        var ph = document.createElement('div');
        ph.className = 'card-thumb is-fallback';
        ph.textContent = (item.region || item.type) + ' · ' + (item.slides || '?') + ' slides';
        img.replaceWith(ph);
      };
      card.appendChild(img);
    } else {
      var ph = document.createElement('div');
      ph.className = 'card-thumb';
      ph.textContent = item.kind === 'calc'
        ? 'calculator'
        : ((item.region || item.type || '') + ' · ' + (item.slides ? item.slides + ' slides' : 'slides')).trim();
      card.appendChild(ph);
    }

    var info = document.createElement('div');
    info.className = 'card-info';

    var title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = item.title;
    info.appendChild(title);

    var sub = document.createElement('div');
    sub.className = 'card-sub';
    sub.textContent = item.subtitle || '';
    info.appendChild(sub);

    var foot = document.createElement('div');
    foot.className = 'card-foot';

    var tag = document.createElement('span');
    var validType = ['explain', 'surgery', 'calc'].indexOf(item.type) !== -1 ? item.type : 'surgery';
    tag.className = 'tag tag-' + validType;
    tag.textContent = TYPE_LABELS[validType] || '項目';
    foot.appendChild(tag);

    var pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = 'pin-btn' + (pinned ? ' is-on' : '');
    pinBtn.setAttribute('aria-label', pinned ? '取消釘選' : '釘選');
    pinBtn.appendChild(starIcon(pinned));
    pinBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); togglePin(item.id); });
    foot.appendChild(pinBtn);

    info.appendChild(foot);
    card.appendChild(info);
    return card;
  }

  function showGridError() {
    gridContainer.textContent = '';
    gridEmpty.hidden = true;
    gridError.hidden = false;
    resultCount.textContent = '';
  }

  // ============================================================
  // Search (⌘K)
  // ============================================================
  function setupSearch() {
    searchInput.addEventListener('input', function (e) {
      state.query = e.target.value;
      renderGrid();
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (state.query) { e.preventDefault(); state.query = ''; searchInput.value = ''; renderGrid(); }
        else searchInput.blur();
      }
    });
  }

  // ============================================================
  // Routing  (#  | #/<id> | #/calc | #/calc/<id>)
  // ============================================================
  function setupRouting() {
    window.addEventListener('hashchange', handleRoute);
  }

  function handleRoute() {
    var hash = window.location.hash || '';
    if (hash.indexOf('#/calc') === 0) {
      var calcId = hash.slice('#/calc'.length).replace(/^\//, '') || 'bmi';
      enterCalc(calcId);
      return;
    }
    if (hash.indexOf('#/') === 0 && hash.length > 2) {
      enterPlayer(hash.slice(2));
      return;
    }
    exitToHome();
  }

  function switchView(target) {
    [homeView, slideView, calcView].forEach(function (v) { v.classList.remove('active'); });
    target.classList.add('active');
    window.scrollTo(0, 0);
  }

  function exitToHome() {
    state.current = null;
    state.stepIndex = 0;
    setTool(null);
    cancelPreload();
    releaseWakeLock();
    clearChromeTimer();
    showChrome(); // reset so next entry starts with chrome visible
    switchView(homeView);
  }

  // ============================================================
  // Player
  // ============================================================
  function enterPlayer(id) {
    var proc = state.procedures.find(function (p) { return p.id === id; });
    if (!proc) { window.location.hash = ''; return; }

    loadProcedure(id)
      .then(function (data) {
        state.current = Object.assign({}, proc, data);
        state.stepIndex = 0;
        switchView(slideView);
        endScreen.hidden = true;
        playerTitle.textContent = state.current.title;
        renderThumbs();
        renderStep();
        preloadImages(data.steps);
        requestWakeLock();
        showChrome();
        scheduleChromeHide();
      })
      .catch(function () { window.location.hash = ''; });
  }

  function renderThumbs() {
    if (!state.current) return;
    var steps = state.current.steps || [];
    thumbStrip.textContent = '';
    steps.forEach(function (s, i) {
      var t = document.createElement('div');
      t.className = 'thumb' + (i === state.stepIndex ? ' is-active' : '');
      t.textContent = String(i + 1).padStart(2, '0') + ' · ' + (s.title || '');
      t.addEventListener('click', function () { state.stepIndex = i; renderStep(); });
      thumbStrip.appendChild(t);
    });
  }

  function renderStep() {
    if (!state.current) return;
    var steps = state.current.steps || [];
    if (!steps.length) return;
    var step = steps[state.stepIndex];
    var total = steps.length;

    stepIndicator.textContent = String(state.stepIndex + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    playerPageTitle.textContent = step.title || '';

    if (step.image) {
      slideImage.hidden = false;
      imagePlaceholder.hidden = true;
      slideImage.classList.add('is-loading');
      slideImage.src = step.image;
      slideImage.alt = step.alt || step.title || '';
      slideImage.onload = function () { slideImage.classList.remove('is-loading'); };
      slideImage.onerror = function () {
        slideImage.hidden = true;
        imagePlaceholder.hidden = false;
        placeholderTitle.textContent = step.title || '';
        placeholderAlt.textContent = step.description || step.alt || '';
      };
    } else {
      slideImage.hidden = true;
      imagePlaceholder.hidden = false;
      placeholderTitle.textContent = step.title || '';
      placeholderAlt.textContent = step.description || '';
    }

    prevBtn.disabled = state.stepIndex === 0;
    nextBtn.disabled = false;

    Array.prototype.forEach.call(thumbStrip.children, function (el, i) {
      el.classList.toggle('is-active', i === state.stepIndex);
    });
    var active = thumbStrip.querySelector('.thumb.is-active');
    if (active && active.scrollIntoView) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

    syncScrubber();
    endScreen.hidden = true;
  }

  function goNext() {
    if (!state.current) return;
    var total = (state.current.steps || []).length;
    if (state.stepIndex < total - 1) { state.stepIndex++; renderStep(); }
    else endScreen.hidden = false;
  }
  function goPrev() {
    if (!state.current) return;
    if (state.stepIndex > 0) { state.stepIndex--; renderStep(); }
  }
  function jumpTo(i) {
    if (!state.current) return;
    var total = (state.current.steps || []).length;
    if (i >= 0 && i < total) { state.stepIndex = i; renderStep(); }
  }

  function setupPlayerControls() {
    prevBtn.addEventListener('click', goPrev);
    nextBtn.addEventListener('click', goNext);
    backBtn.addEventListener('click', function () { window.location.hash = ''; });
    endBackBtn.addEventListener('click', function () { window.location.hash = ''; });
    calcBack.addEventListener('click', function () { window.location.hash = ''; });

    document.querySelectorAll('.tool[data-tool]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tool');
        setTool(state.activeTool === t ? null : t);
      });
    });
    var exitBtn = $('tool-exit');
    if (exitBtn) exitBtn.addEventListener('click', function () { window.location.hash = ''; });

    slideStage.addEventListener('mousemove', function (e) {
      if (!state.activeTool) return;
      var rect = slideStage.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      if (state.activeTool === 'laser') {
        laserDot.style.left = x + 'px';
        laserDot.style.top = y + 'px';
      } else if (state.activeTool === 'spot') {
        spotOverlay.style.setProperty('--spot-x', x + 'px');
        spotOverlay.style.setProperty('--spot-y', y + 'px');
      }
    });
  }

  function setTool(t) {
    state.activeTool = t;
    document.querySelectorAll('.tool[data-tool]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-tool') === t);
    });
    slideStage.classList.toggle('tool-laser', t === 'laser');
    slideStage.classList.toggle('tool-spot',  t === 'spot');
    slideStage.classList.toggle('tool-pen',   t === 'pen');
    laserDot.hidden = t !== 'laser';
    spotOverlay.hidden = t !== 'spot';
    // When a tool turns on, force chrome visible and cancel the auto-hide.
    // When the last tool turns off, restart the auto-hide countdown.
    if (t) { showChrome(); clearChromeTimer(); }
    else if (slideView.classList.contains('active')) { scheduleChromeHide(); }
  }

  // ============================================================
  // Keyboard
  // ============================================================
  function setupKeyboard() {
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        if (homeView.classList.contains('active')) { e.preventDefault(); searchInput.focus(); searchInput.select(); }
        return;
      }
      if (slideView.classList.contains('active')) {
        if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); return; }
        if (e.key === 'ArrowLeft')                   { e.preventDefault(); goPrev(); return; }
        if (e.key === 'Escape')                      { e.preventDefault(); window.location.hash = ''; return; }
        if (e.key >= '1' && e.key <= '9')            { jumpTo(parseInt(e.key, 10) - 1); return; }
        if (e.key === 'l' || e.key === 'L')          { setTool(state.activeTool === 'laser' ? null : 'laser'); return; }
        if (e.key === 's' || e.key === 'S')          { setTool(state.activeTool === 'spot'  ? null : 'spot');  return; }
        if (e.key === 'p' || e.key === 'P')          { setTool(state.activeTool === 'pen'   ? null : 'pen');   return; }
      }
      if (calcView.classList.contains('active') && e.key === 'Escape') {
        e.preventDefault(); window.location.hash = '';
      }
    });
  }

  // ============================================================
  // Touch / Swipe (player)
  // ============================================================
  // ============================================================
  // Tap zones (e-book style: left=prev, center=toggle chrome, right=next)
  // ============================================================
  function setupTapZones() {
    if (!tapPrev || !tapNext || !tapToggle) return;
    tapPrev.addEventListener('click', function () {
      if (state.activeTool) return; // let tools own the stage
      goPrev();
    });
    tapNext.addEventListener('click', function () {
      if (state.activeTool) return;
      goNext();
    });
    tapToggle.addEventListener('click', function () {
      if (state.activeTool) return;
      toggleChrome();
    });
  }

  function showChrome() {
    state.chromeHidden = false;
    slideView.classList.remove('is-immersive');
  }
  function hideChrome() {
    if (state.activeTool) return; // never hide while a tool is active
    state.chromeHidden = true;
    slideView.classList.add('is-immersive');
  }
  function clearChromeTimer() {
    if (state.chromeTimer) { clearTimeout(state.chromeTimer); state.chromeTimer = null; }
  }
  function scheduleChromeHide() {
    clearChromeTimer();
    state.chromeTimer = setTimeout(hideChrome, CHROME_AUTO_HIDE_MS);
  }
  function toggleChrome() {
    if (state.chromeHidden) { showChrome(); scheduleChromeHide(); }
    else                    { hideChrome(); clearChromeTimer(); }
  }

  // ============================================================
  // Scrubber (mobile page slider — replaces thumb strip < 768px)
  // ============================================================
  function setupScrubber() {
    if (!scrubber) return;
    scrubber.addEventListener('input', function (e) {
      var i = parseInt(e.target.value, 10);
      if (!isNaN(i)) jumpTo(i);
    });
  }
  function syncScrubber() {
    if (!scrubber || !state.current) return;
    var n = (state.current.steps || []).length;
    scrubber.max = String(Math.max(0, n - 1));
    scrubber.value = String(state.stepIndex);
    if (scrubberLabel) scrubberLabel.textContent = (state.stepIndex + 1) + ' / ' + n;
  }

  function setupSwipe() {
    var startX = 0, startY = 0, startTime = 0, touching = false, fingers = 0;
    slideStage.addEventListener('touchstart', function (e) {
      fingers = e.touches.length;
      if (fingers > 1) return;
      touching = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }, { passive: true });
    slideStage.addEventListener('touchend', function (e) {
      if (!touching || fingers > 1) { touching = false; return; }
      touching = false;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      var t = Date.now() - startTime;
      if (Math.abs(dx) < 50) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (t > 500) return;
      if (dx < 0) goNext(); else goPrev();
    }, { passive: true });
  }

  // ============================================================
  // Image preload
  // ============================================================
  function preloadImages(steps) {
    cancelPreload();
    state.preloadAbort = new AbortController();
    (steps || []).forEach(function (s) { if (s.image) { var img = new Image(); img.src = s.image; } });
  }
  function cancelPreload() {
    if (state.preloadAbort) { state.preloadAbort.abort(); state.preloadAbort = null; }
  }

  // ============================================================
  // Wake lock
  // ============================================================
  function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen')
      .then(function (lock) { state.wakeLock = lock; })
      .catch(function () {});
  }
  function releaseWakeLock() {
    if (state.wakeLock) { state.wakeLock.release().catch(function () {}); state.wakeLock = null; }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && slideView.classList.contains('active')) requestWakeLock();
  });

  // ============================================================
  // Offline / SW
  // ============================================================
  function setupOffline() {
    function update() { offlineBanner.hidden = navigator.onLine; }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js')
      .then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if (nw.state === 'activated' && navigator.serviceWorker.controller) updateBanner.hidden = false;
          });
        });
      })
      .catch(function () {});
    if (updateBtn) updateBtn.addEventListener('click', function () { updateBanner.hidden = true; window.location.reload(); });
  }

  // ============================================================
  // Calculator page
  // ============================================================
  var calcDefs = [
    { id: 'bmi',       label: 'BMI' },
    { id: 'lipid',     label: '血脂風險' },
    { id: 'peds-dose', label: '小兒劑量' }
  ];

  function setupCalcShell() {
    calcDefs.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'calc-tab';
      btn.dataset.calc = c.id;
      btn.textContent = c.label;
      btn.addEventListener('click', function () { window.location.hash = '#/calc/' + c.id; });
      calcTabs.appendChild(btn);
    });
  }

  function enterCalc(id) {
    if (calcDefs.findIndex(function (c) { return c.id === id; }) < 0) id = 'bmi';
    switchView(calcView);
    Array.prototype.forEach.call(calcTabs.children, function (b) {
      b.classList.toggle('is-active', b.dataset.calc === id);
    });
    if (id === 'bmi') renderBmi();
    else if (id === 'lipid') renderLipid();
    else if (id === 'peds-dose') renderPeds();
  }

  // ---------- Shared calc helpers ----------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function field(label, hint, value, unit, onInput, opts) {
    opts = opts || {};
    var labelWrap = el('div', null, [
      el('label', { class: 'field-label' }, [label]),
      hint ? el('span', { class: 'field-hint' }, [hint]) : null
    ]);
    var input = el('input', {
      type: 'number', class: 'field-input',
      value: String(value),
      min: opts.min != null ? String(opts.min) : '',
      max: opts.max != null ? String(opts.max) : '',
      step: opts.step ? String(opts.step) : 'any',
      oninput: function (e) { onInput(Number(e.target.value) || 0); }
    });
    return el('div', { class: 'field' }, [labelWrap, input, el('span', { class: 'field-unit' }, [unit || ''])]);
  }

  function check(label, checked, onChange) {
    var input = el('input', { type: 'checkbox' });
    input.checked = checked;
    var wrap = el('label', { class: 'check' + (checked ? ' is-on' : '') }, [input, el('span', null, [label])]);
    wrap.addEventListener('click', function (e) {
      if (e.target.tagName !== 'INPUT') input.checked = !input.checked;
      wrap.classList.toggle('is-on', input.checked);
      onChange(input.checked);
    });
    return wrap;
  }

  function section(label, children) {
    var s = el('div', { class: 'calc-section' }, [el('div', { class: 'section-label' }, [label])]);
    children.forEach(function (c) { if (c) s.appendChild(c); });
    return s;
  }

  function ruleList(rules) {
    var ul = el('ul', { class: 'rules' });
    rules.forEach(function (r) {
      ul.appendChild(el('li', { class: 'rule' + (r.ok ? ' is-met' : '') }, [
        el('span', { class: 'rule-mark ' + (r.ok ? 'ok' : 'no') }, [r.ok ? '●' : '○']),
        el('span', { class: 'rule-text' }, [r.text])
      ]));
    });
    return ul;
  }

  function summary(text) {
    return el('div', { class: 'summary' }, [
      el('strong', { class: 'summary-label' }, ['建議摘要']),
      document.createTextNode(text)
    ]);
  }

  function explainBlock(parts) {
    // parts = [ [{strong, text}, ' regular text', {strong: 'X'}, ...], [...next line] ]
    var wrap = el('div', { class: 'calc-explain' });
    parts.forEach(function (line) {
      var div = el('div', null, line.map(function (p) {
        if (typeof p === 'string') return document.createTextNode(p);
        return el('strong', null, [String(p.strong)]);
      }));
      wrap.appendChild(div);
    });
    return wrap;
  }

  function resultCard(opts) {
    var v = el('div', { class: 'result-value' }, [String(opts.value)]);
    if (opts.unit) v.appendChild(el('span', { class: 'result-unit' }, [opts.unit]));
    var head = el('div', { class: 'result-head' }, [
      el('div', { class: 'result-label' }, [opts.label]),
      v
    ]);

    var verdict = el('div', { class: 'verdict ' + opts.verdict.kind }, [
      el('span', { class: 'verdict-shape' }, [opts.verdict.shape]),
      el('strong', null, [opts.verdict.label])
    ]);

    var body = el('div', { class: 'result-body' }, [verdict].concat(opts.body || []));

    var actions = el('div', { class: 'result-actions' }, [
      el('button', { class: 'primary', type: 'button' }, ['投影給病人看']),
      el('button', {
        class: 'ghost', type: 'button',
        onclick: function () { window.print(); }
      }, ['列印'])
    ]);
    body.appendChild(actions);

    var disc = el('div', { class: 'result-disclaimer' }, [
      el('strong', null, ['注意']),
      document.createTextNode('本工具僅為臨床輔助，不取代醫師判斷。健保條件以機構最新版為準。')
    ]);

    return el('div', { class: 'result-card' }, [head, body, disc]);
  }

  function mountCalcLayout(left) {
    var right = el('div', { class: 'result-sticky', id: 'calc-result' });
    calcBody.textContent = '';
    calcBody.appendChild(el('div', { class: 'calc-layout' }, [left, right]));
    return right;
  }

  function setResult(node) {
    var host = $('calc-result');
    if (!host) return;
    host.textContent = '';
    host.appendChild(node);
  }

  // ---------- BMI ----------
  function renderBmi() {
    var s = { h: 170, w: 75 };
    function update() {
      var bmi = s.w / Math.pow(s.h / 100, 2);
      var grade = bmi < 18.5 ? { label: '體重過輕', kind: 'warn',   shape: '■' }
                : bmi < 24   ? { label: '正常範圍', kind: 'ok',     shape: '●' }
                : bmi < 27   ? { label: '過重',     kind: 'warn',   shape: '■' }
                : bmi < 30   ? { label: '輕度肥胖', kind: 'danger', shape: '▲' }
                : bmi < 35   ? { label: '中度肥胖', kind: 'danger', shape: '▲' }
                              : { label: '重度肥胖', kind: 'danger', shape: '▲' };
      var advice = bmi >= 27 ? '建議搭配生活型態介入與藥物治療評估。'
                  : bmi >= 24 ? '建議控制飲食與規律運動。'
                  : bmi < 18.5 ? '建議營養評估。'
                  : '維持良好生活習慣。';
      var rules = ruleList([
        { ok: bmi < 24,  text: 'BMI < 24：正常範圍' },
        { ok: bmi >= 27, text: 'BMI ≥ 27：符合肥胖症藥物治療考量' },
        { ok: bmi >= 35, text: 'BMI ≥ 35：符合減重手術考量' }
      ]);
      setResult(resultCard({
        label: 'BMI', value: bmi.toFixed(1), unit: 'kg/m²',
        verdict: grade,
        body: [rules, summary('BMI ' + bmi.toFixed(1) + '，屬於「' + grade.label + '」。' + advice)]
      }));
    }

    var inputs = el('div', { class: 'calc-card' }, [
      el('h3', null, ['BMI 與肥胖分級']),
      el('p', { class: 'lead' }, ['依國健署標準。BMI = 體重 (kg) ÷ 身高 (m)²']),
      section('基本測量', [
        field('身高', null, s.h, 'cm', function (v) { s.h = v; update(); }, { min: 100, max: 250 }),
        field('體重', null, s.w, 'kg', function (v) { s.w = v; update(); }, { min: 20, max: 250 })
      ])
    ]);
    mountCalcLayout(inputs);
    update();
  }

  // ---------- Lipid / Statin ----------
  function renderLipid() {
    var s = {
      ldl: 168, hdl: 38, tg: 220, tc: 248,
      age: 58, sex: 'M',
      dm: true, htn: true, cvd: false, ckd: false, smoke: false, fhx: false
    };

    function update() {
      var rf = 0;
      if (s.dm) rf++;
      if (s.htn) rf++;
      if (s.smoke) rf++;
      if (s.fhx) rf++;
      if (s.hdl < 40) rf++;
      if ((s.sex === 'M' && s.age >= 45) || (s.sex === 'F' && s.age >= 55)) rf++;

      var risk = s.cvd ? 25 : Math.min(rf * 3.2 + (s.ldl > 130 ? 4 : 0) + (s.age > 55 ? 3 : 0), 35);
      var grade = s.cvd ? { label: '極高風險（次級預防）', kind: 'danger', shape: '▲' }
                : risk > 15  ? { label: '高風險',   kind: 'danger', shape: '▲' }
                : risk > 7.5 ? { label: '中高風險', kind: 'warn',   shape: '■' }
                              : { label: '中低風險', kind: 'ok',     shape: '●' };

      var rules = [
        { ok: s.cvd,                                   text: '次級預防（已知 CVD 事件）' },
        { ok: s.dm && s.ldl >= 100,                    text: '糖尿病 + LDL ≥ 100 mg/dL' },
        { ok: rf >= 2 && s.ldl >= 130,                 text: '風險因子 ≥ 2 項 + LDL ≥ 130' },
        { ok: s.ldl >= 190,                            text: 'LDL ≥ 190 mg/dL（家族性高膽固醇血症）' },
        { ok: s.ckd && s.ldl >= 100,                   text: 'CKD Stage ≥ 3 + LDL ≥ 100' },
        { ok: s.tc >= 240 && rf >= 2,                  text: 'TC ≥ 240 + 風險因子 ≥ 2' }
      ];
      var qualified = rules.some(function (r) { return r.ok; });

      var summaryText = qualified
        ? '符合健保給付 Statin。建議起始 moderate-intensity statin（如 Atorvastatin 20 mg 或 Rosuvastatin 10 mg），6–12 週後追蹤 LDL。'
        : '目前未符合健保 Statin 給付條件。建議先以生活型態介入，3–6 個月後再評估。';

      setResult(resultCard({
        label: '10 年 ASCVD 風險', value: risk.toFixed(1), unit: '%',
        verdict: grade,
        body: [
          el('div', { class: 'rules-label' }, ['健保給付條件']),
          ruleList(rules),
          summary(summaryText)
        ]
      }));
    }

    function sexSeg() {
      var seg = el('div', { class: 'seg' });
      [['M', '男'], ['F', '女']].forEach(function (pair) {
        var b = el('button', { type: 'button', class: s.sex === pair[0] ? 'is-on' : '' }, [pair[1]]);
        b.addEventListener('click', function () {
          s.sex = pair[0];
          Array.prototype.forEach.call(seg.children, function (x) { x.classList.remove('is-on'); });
          b.classList.add('is-on');
          update();
        });
        seg.appendChild(b);
      });
      return el('div', { class: 'field' }, [
        el('div', null, [el('label', { class: 'field-label' }, ['性別'])]),
        seg,
        el('span', { class: 'field-unit' }, [''])
      ]);
    }

    var inputs = el('div', { class: 'calc-card' }, [
      el('h3', null, ['血脂風險與 Statin 健保給付']),
      el('p', { class: 'lead' }, ['依 2024/07 健保規範。即時計算 ASCVD 風險並逐條核對給付條件。']),
      section('血脂檢驗值', [
        field('LDL-C',             '低密度脂蛋白', s.ldl, 'mg/dL', function (v) { s.ldl = v; update(); }),
        field('HDL-C',             '高密度脂蛋白', s.hdl, 'mg/dL', function (v) { s.hdl = v; update(); }),
        field('Triglyceride',      '三酸甘油酯',   s.tg,  'mg/dL', function (v) { s.tg  = v; update(); }),
        field('Total Cholesterol', '總膽固醇',     s.tc,  'mg/dL', function (v) { s.tc  = v; update(); })
      ]),
      section('共病與風險因子', [
        check('糖尿病 (Type 2 DM)',          s.dm,    function (v) { s.dm    = v; update(); }),
        check('高血壓',                       s.htn,   function (v) { s.htn   = v; update(); }),
        check('已發生心血管事件（次級預防）', s.cvd,   function (v) { s.cvd   = v; update(); }),
        check('慢性腎臟病 (CKD Stage ≥ 3)',  s.ckd,   function (v) { s.ckd   = v; update(); }),
        check('吸菸',                         s.smoke, function (v) { s.smoke = v; update(); }),
        check('家族史（一等親早發 CVD）',     s.fhx,   function (v) { s.fhx   = v; update(); })
      ]),
      section('基本資料', [
        field('年齡', null, s.age, '歲', function (v) { s.age = v; update(); }, { min: 18, max: 100 }),
        sexSeg()
      ])
    ]);

    mountCalcLayout(inputs);
    update();
  }

  // ---------- Pediatric dose ----------
  function renderPeds() {
    var s = { wt: 15, dosePerKg: 10, concMl: 100 };
    function update() {
      var totalMg = s.wt * s.dosePerKg;
      var totalMl = totalMg / (s.concMl / 5);

      var explain = explainBlock([
        [{ strong: '體重' }, ' ' + s.wt + ' kg × ', { strong: '劑量' }, ' ' + s.dosePerKg + ' mg/kg = ', { strong: totalMg + ' mg' }],
        ['藥水濃度 ' + s.concMl + ' mg / 5 ml → 需 ', { strong: totalMl.toFixed(1) + ' ml' }]
      ]);

      setResult(resultCard({
        label: '每次總劑量', value: totalMg, unit: 'mg',
        verdict: { label: '= ' + totalMl.toFixed(1) + ' ml 藥水', kind: 'info', shape: '●' },
        body: [explain, summary(s.wt + ' kg 病童，每次給予 ' + totalMg + ' mg（' + totalMl.toFixed(1) + ' ml）。請依醫囑頻次給藥。')]
      }));
    }

    var inputs = el('div', { class: 'calc-card' }, [
      el('h3', null, ['小兒劑量換算（mg/kg）']),
      el('p', { class: 'lead' }, ['輸入體重與目標劑量，即時算出總 mg 與建議 ml 數。']),
      section('參數', [
        field('體重',     null,        s.wt,        'kg',     function (v) { s.wt        = v; update(); }, { min: 1, max: 120 }),
        field('目標劑量', '每公斤',    s.dosePerKg, 'mg/kg',  function (v) { s.dosePerKg = v; update(); }),
        field('藥水濃度', '每 5 ml 含', s.concMl,   'mg/5ml', function (v) { s.concMl    = v; update(); })
      ])
    ]);
    mountCalcLayout(inputs);
    update();
  }

  // ============================================================
  // Boot
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { state: state, goNext: goNext, goPrev: goPrev };
  }
})();
