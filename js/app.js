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
  var penCanvas = $('pen-canvas');
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
  var installHint = $('install-hint');
  var installHintClose = $('install-hint-close');

  // ============================================================
  // Static metadata: built-in calculators (separate from JSON data)
  // ============================================================
  var CALCULATORS = [
    {id:'bmi',       title:'BMI 與肥胖分級',  subtitle:'身高體重 → BMI + 國健署分級',  type:'calc', kind:'calc', tabLabel:'BMI'},
    {id:'lipid',     title:'血脂異常用藥健保給付', subtitle:'LDL/HDL/TG/TC + 病人類別 → Statin / Fibrate 健保給付判定', type:'calc', kind:'calc', tabLabel:'血脂給付'},
    {id:'peds-dose', title:'小兒劑量（mg/kg）', subtitle:'體重 + 目標劑量 → 總 mg + ml 數', type:'calc', kind:'calc', tabLabel:'小兒劑量'},
    {id:'mounjaro',  title:'猛健樂針劑換算 (Mounjaro)', subtitle:'Tirzepatide 筆針劑量、刻度與殘劑互算', type:'calc', kind:'calc', tabLabel:'猛健樂'}
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
    setupPen();
    setupInstallHint();
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
    clearPen();
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
        resizePenCanvas(); // canvas only has real dimensions once slideView is active
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
    bumpChromeTimer();
    clearPen();        // drawings belong to the previous slide — wipe on step change
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

    // Pointer Events unify mouse, touch, and stylus.
    // - mouse hover: fires continuously even without press (desktop laser feel)
    // - touch:       fires only while finger is down (iPad: tap-and-drag laser)
    // Touch offsets the visual above the finger so the user can see it
    // (finger pad ~60px obscures the 10px dot). Mouse + pen stay on-axis.
    slideStage.addEventListener('pointermove', function (e) {
      if (!state.activeTool || state.activeTool === 'pen') return;
      var rect = slideStage.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var yOffset = e.pointerType === 'touch' ? -50 : 0;
      if (state.activeTool === 'laser') {
        laserDot.style.left = x + 'px';
        laserDot.style.top = (y + yOffset) + 'px';
      } else if (state.activeTool === 'spot') {
        spotOverlay.style.setProperty('--spot-x', x + 'px');
        spotOverlay.style.setProperty('--spot-y', (y + yOffset) + 'px');
      }
    });
    // On iPad, the first touchdown needs to position the laser immediately —
    // otherwise the dot stays at the last hover position until the finger moves.
    slideStage.addEventListener('pointerdown', function (e) {
      if (!state.activeTool || state.activeTool === 'pen') return;
      if (e.pointerType === 'touch') e.preventDefault(); // block page-pan
      var rect = slideStage.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var yOffset = e.pointerType === 'touch' ? -50 : 0;
      if (state.activeTool === 'laser') {
        laserDot.style.left = x + 'px';
        laserDot.style.top = (y + yOffset) + 'px';
      } else if (state.activeTool === 'spot') {
        spotOverlay.style.setProperty('--spot-x', x + 'px');
        spotOverlay.style.setProperty('--spot-y', (y + yOffset) + 'px');
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
  // iOS Safari install hint (one-time banner)
  // ============================================================
  function setupInstallHint() {
    if (!installHint || !installHintClose) return;
    // Skip if user already dismissed
    try { if (localStorage.getItem('dismissed_install_hint') === '1') return; }
    catch (e) { /* storage disabled — show the hint anyway */ }

    // Already installed to home screen → no hint
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;
    if (navigator.standalone === true) return; // legacy iOS

    // Show only on iPhone / iPad Safari. UA sniffing is fragile but this
    // is a purely cosmetic hint — false negatives are fine.
    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(ua);
    var isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    if (!isIOS && !isIPadOS) return;

    installHint.hidden = false;
    installHintClose.addEventListener('click', function () {
      installHint.hidden = true;
      try { localStorage.setItem('dismissed_install_hint', '1'); } catch (e) {}
    });
  }

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
  // Called on every navigation (tap/swipe/keyboard/scrubber) so active use
  // keeps the UI visible instead of vanishing mid-interaction.
  function bumpChromeTimer() {
    if (state.chromeHidden) return;                      // already hidden — don't pull it back
    if (!slideView.classList.contains('active')) return; // only in player
    if (state.activeTool) return;                        // tool mode forces visibility separately
    scheduleChromeHide();
  }
  function toggleChrome() {
    if (state.chromeHidden) { showChrome(); scheduleChromeHide(); }
    else                    { hideChrome(); clearChromeTimer(); }
  }

  // ============================================================
  // Pen (canvas drawing, pointer events for mouse + touch + stylus)
  // ============================================================
  var penCtx = null;
  var penDrawing = false;
  var PEN_STROKE = 'rgba(255,59,59,0.85)';
  var PEN_WIDTH = 4;

  function resizePenCanvas() {
    if (!penCanvas) return;
    var rect = penCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var dpr = window.devicePixelRatio || 1;
    // Setting width/height clears the canvas — caller must accept loss here.
    penCanvas.width  = Math.round(rect.width  * dpr);
    penCanvas.height = Math.round(rect.height * dpr);
    penCtx = penCanvas.getContext('2d');
    penCtx.scale(dpr, dpr);
    penCtx.strokeStyle = PEN_STROKE;
    penCtx.lineWidth = PEN_WIDTH;
    penCtx.lineCap = 'round';
    penCtx.lineJoin = 'round';
  }
  function clearPen() {
    if (!penCtx || !penCanvas) return;
    var dpr = window.devicePixelRatio || 1;
    penCtx.clearRect(0, 0, penCanvas.width / dpr, penCanvas.height / dpr);
  }
  function setupPen() {
    if (!penCanvas || !('PointerEvent' in window)) return;
    resizePenCanvas();
    window.addEventListener('resize', function () {
      // Resizing clears strokes — acceptable; drawings belong to current slide only.
      resizePenCanvas();
    });
    penCanvas.addEventListener('pointerdown', function (e) {
      if (state.activeTool !== 'pen' || !penCtx) return;
      e.preventDefault();
      penDrawing = true;
      if (penCanvas.setPointerCapture) penCanvas.setPointerCapture(e.pointerId);
      var rect = penCanvas.getBoundingClientRect();
      penCtx.beginPath();
      penCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });
    penCanvas.addEventListener('pointermove', function (e) {
      if (!penDrawing || state.activeTool !== 'pen' || !penCtx) return;
      var rect = penCanvas.getBoundingClientRect();
      penCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      penCtx.stroke();
    });
    function endStroke() {
      if (!penDrawing) return;
      penDrawing = false;
      if (penCtx) penCtx.closePath();
    }
    penCanvas.addEventListener('pointerup', endStroke);
    penCanvas.addEventListener('pointercancel', endStroke);
    penCanvas.addEventListener('pointerleave', endStroke);
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
          // Capture controller state at update-found time, NOT at activation.
          // On first install, clients.claim() sets controller during activate,
          // so checking controller at statechange would be true — false positive.
          // A real update is defined by: a controller already existed when the
          // new SW began installing.
          var hadController = !!navigator.serviceWorker.controller;
          nw.addEventListener('statechange', function () {
            if (nw.state === 'activated' && hadController) updateBanner.hidden = false;
          });
        });
      })
      .catch(function () {});
    if (updateBtn) updateBtn.addEventListener('click', function () { updateBanner.hidden = true; window.location.reload(); });
  }

  // ============================================================
  // Calculator page
  // ============================================================
  function setupCalcShell() {
    CALCULATORS.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'calc-tab';
      btn.dataset.calc = c.id;
      btn.textContent = c.tabLabel;
      btn.addEventListener('click', function () { window.location.hash = '#/calc/' + c.id; });
      calcTabs.appendChild(btn);
    });
  }

  function enterCalc(id) {
    if (CALCULATORS.findIndex(function (c) { return c.id === id; }) < 0) id = 'bmi';
    switchView(calcView);
    Array.prototype.forEach.call(calcTabs.children, function (b) {
      b.classList.toggle('is-active', b.dataset.calc === id);
    });
    if (id === 'bmi') renderBmi();
    else if (id === 'lipid') renderLipid();
    else if (id === 'peds-dose') renderPeds();
    else if (id === 'mounjaro') renderMounjaro();
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
      oninput: function (e) {
        var raw = e.target.value;
        onInput(opts.allowEmpty && raw === '' ? '' : Number(raw) || 0);
      }
    });
    return el('div', { class: 'field' }, [labelWrap, input, el('span', { class: 'field-unit' }, [unit || ''])]);
  }

  function check(label, checked, onChange) {
    var input = el('input', { type: 'checkbox' });
    input.checked = checked;
    // Plain <div>, not <label>: a <label> wrapping its own checkbox fires
    // the click handler AND native label activation, double-toggling to a
    // no-op. The input keeps pointer-events:none, so the div handler owns it.
    var wrap = el('div', { class: 'check' + (checked ? ' is-on' : '') }, [input, el('span', null, [label])]);
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

  function note(text, kind) {
    return el('div', { class: 'calc-note' + (kind ? ' ' + kind : '') }, [text]);
  }

  // Static, non-interactive checkbox-style row whose state is derived from
  // other inputs (e.g. HDL-C < 40 follows the HDL-C number field).
  function derivedRow(label, ok) {
    var input = el('input', { type: 'checkbox' });
    input.checked = ok;
    var row = el('div', { class: 'check check-derived' + (ok ? ' is-on' : '') }, [
      input, el('span', null, [label])
    ]);
    row.setState = function (next) {
      row.classList.toggle('is-on', next);
      input.checked = next;
    };
    return row;
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
  // Pure 國健署成人 BMI 分級查表 (衛福部國民健康署). Golden-file 測試見
  // tests/unit/calc/bmi.test.js — 標準改版時這兩個函式跟測試一起改。
  function bmiClassify(bmi) {
    if (bmi < 18.5) return { code: 'underweight', label: '體重過輕', kind: 'warn',   shape: '■' };
    if (bmi < 24)   return { code: 'normal',      label: '正常範圍', kind: 'ok',     shape: '●' };
    if (bmi < 27)   return { code: 'overweight',  label: '過重',     kind: 'warn',   shape: '■' };
    if (bmi < 30)   return { code: 'obese-1',     label: '輕度肥胖', kind: 'danger', shape: '▲' };
    if (bmi < 35)   return { code: 'obese-2',     label: '中度肥胖', kind: 'danger', shape: '▲' };
    return                  { code: 'obese-3',    label: '重度肥胖', kind: 'danger', shape: '▲' };
  }
  function bmiAssess(heightCm, weightKg) {
    var bmi = weightKg / Math.pow(heightCm / 100, 2);
    return { bmi: bmi, grade: bmiClassify(bmi) };
  }
  function renderBmi() {
    var s = { h: 170, w: 75 };
    function update() {
      var r = bmiAssess(s.h, s.w);
      var bmi = r.bmi;
      var grade = r.grade;
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

  // ---------- Lipid / Statin / Fibrate ----------
  // Pure NHI reimbursement lookup, transcribed from 健保 降血脂藥物給付規定
  // (文件 031170). No clinical risk scoring — see docs/adr/0001.
  var LIPID_STATIN_TIERS = {
    'cvd-dm': { label: '心血管疾病或糖尿病病人', startTC: 160,  startLDL: 100, parallel: true },
    'rf2':    { label: '2 個危險因子或以上',     startTC: 200,  startLDL: 130, parallel: false },
    'rf1':    { label: '1 個危險因子',           startTC: 240,  startLDL: 160, parallel: false },
    'rf0':    { label: '0 個危險因子',           startTC: null, startLDL: 190, parallel: false }
  };
  var LIPID_MONITOR_NOTE =
    '處方規定：第一年每 3–6 個月抽血一次，第二年以後至少每 6–12 個月一次，' +
    '並注意肝功能異常與橫紋肌溶解症。';

  // s = { ldl, hdl, tg, tc, cvd, dm, htn, ageRisk, fhx, smoke }
  function lipidCoverage(s) {
    var hdlLow = s.hdl !== '' && s.hdl < 40;
    var rfCount = (s.htn ? 1 : 0) + (s.ageRisk ? 1 : 0) + (s.fhx ? 1 : 0) +
                  (hdlLow ? 1 : 0) + (s.smoke ? 1 : 0);
    var highTier = !!(s.cvd || s.dm);

    var statinCat = highTier ? 'cvd-dm'
                  : rfCount >= 2 ? 'rf2'
                  : rfCount === 1 ? 'rf1'
                  : 'rf0';
    var tier = LIPID_STATIN_TIERS[statinCat];
    var byTC = tier.startTC != null && s.tc >= tier.startTC;
    var byLDL = s.ldl >= tier.startLDL;

    var ratio = s.hdl > 0 ? s.tc / s.hdl : 0;
    var fibrateQualified = highTier
      ? (s.tg >= 200 && (ratio > 5 || hdlLow))
      : (s.tg >= 500);

    return {
      hdlLow: hdlLow,
      rfCount: rfCount,
      highTier: highTier,
      statin: {
        category: statinCat,
        startTC: tier.startTC,
        startLDL: tier.startLDL,
        byTC: byTC,
        byLDL: byLDL,
        qualified: byTC || byLDL,
        parallel: tier.parallel
      },
      fibrate: {
        category: highTier ? 'cvd-dm' : 'non-cvd-dm',
        ratio: ratio,
        qualified: fibrateQualified,
        parallel: highTier,
        comboWarning: fibrateQualified && s.ldl >= 100
      }
    };
  }

  function renderLipid() {
    var s = {
      ldl: '', hdl: '', tg: '', tc: '',
      cvd: false, dm: true,
      htn: true, ageRisk: true, fhx: false, smoke: false
    };

    var hdlRow = derivedRow('HDL-C < 40 mg/dL（依 HDL-C 數值自動判定）', s.hdl !== '' && s.hdl < 40);

    function statinCard(r) {
      var st = r.statin;
      var tier = LIPID_STATIN_TIERS[st.category];
      var startText = st.startTC != null
        ? 'TC ≧ ' + st.startTC + ' 或 LDL-C ≧ ' + st.startLDL
        : 'LDL-C ≧ ' + st.startLDL;
      var targetText = st.startTC != null
        ? 'TC < ' + st.startTC + ' 或 LDL-C < ' + st.startLDL
        : 'LDL-C < ' + st.startLDL;

      var rules = [
        { ok: st.byLDL, text: 'LDL-C ' + s.ldl + ' mg/dL ≧ ' + st.startLDL }
      ];
      if (st.startTC != null) {
        rules.push({ ok: st.byTC, text: 'TC ' + s.tc + ' mg/dL ≧ ' + st.startTC });
      }

      var summaryText = st.qualified
        ? '符合健保 Statin 給付。病人類別「' + tier.label + '」，血脂目標值 ' + targetText +
          '。' + (st.parallel ? '非藥物治療可與藥物並行。' : '健保要求給藥前應有 3–6 個月非藥物治療。')
        : '尚未達「' + tier.label + '」起始藥物治療閾值（' + startText + '）。' +
          (st.parallel ? '' : '健保亦要求給藥前應有 3–6 個月非藥物治療。');

      // The rf tiers already name the count; only annotate it for cvd-dm,
      // where the category is set by CVD/DM but the RF count still matters
      // for the fibrate card and is worth surfacing.
      var verdictLabel = st.category === 'cvd-dm'
        ? tier.label + '（危險因子 ' + r.rfCount + ' 項）'
        : tier.label;

      return resultCard({
        label: '降膽固醇藥物（Statin）健保給付',
        value: st.qualified ? '符合' : '不符合',
        verdict: {
          label: verdictLabel,
          kind: st.qualified ? 'ok' : 'warn',
          shape: st.qualified ? '●' : '○'
        },
        body: [
          el('div', { class: 'rules-label' }, ['起始藥物治療閾值（' + startText + '）']),
          ruleList(rules),
          summary(summaryText),
          note(LIPID_MONITOR_NOTE)
        ]
      });
    }

    function fibrateCard(r) {
      var fb = r.fibrate;
      var rules = fb.category === 'cvd-dm'
        ? [
            { ok: s.tg >= 200, text: 'TG ' + s.tg + ' mg/dL ≧ 200' },
            {
              ok: fb.ratio > 5 || r.hdlLow,
              text: 'TC/HDL-C 比值 ' + fb.ratio.toFixed(1) + ' > 5 或 HDL-C < 40' +
                    '（' + (fb.ratio > 5 ? '比值符合' : r.hdlLow ? 'HDL-C 符合' : '皆未達') + '）'
            }
          ]
        : [
            { ok: s.tg >= 500, text: 'TG ' + s.tg + ' mg/dL ≧ 500' }
          ];

      var catLabel = fb.category === 'cvd-dm' ? '心血管疾病或糖尿病病人' : '非 CVD 且非 DM 病人';
      var startText = fb.category === 'cvd-dm'
        ? 'TG ≧ 200 且（TC/HDL-C > 5 或 HDL-C < 40）'
        : 'TG ≧ 500';
      var targetText = fb.category === 'cvd-dm' ? 'TG < 200' : 'TG < 500';

      var summaryText = fb.qualified
        ? '符合健保 Fibrate 給付。病人類別「' + catLabel + '」，三酸甘油酯目標值 ' + targetText +
          '。' + (fb.parallel ? '非藥物治療可與藥物並行。' : '健保要求給藥前應有 3–6 個月非藥物治療。')
        : '尚未達「' + catLabel + '」起始藥物治療閾值（' + startText + '）。' +
          (fb.parallel ? '' : '健保亦要求給藥前應有 3–6 個月非藥物治療。');

      var body = [
        el('div', { class: 'rules-label' }, ['起始藥物治療閾值（' + startText + '）']),
        ruleList(rules),
        summary(summaryText)
      ];
      if (fb.comboWarning) {
        body.push(note(
          '⚠ 此病人 LDL-C ≧ 100 mg/dL，臨床上可能需併用 Statin。Fibrate 與 Statin 併用' +
          '會增加橫紋肌溶解症與肝功能異常風險，抽血追蹤時須特別注意副作用。', 'warn'));
      }
      body.push(note(LIPID_MONITOR_NOTE));

      return resultCard({
        label: '降三酸甘油酯藥物（Fibrate）健保給付',
        value: fb.qualified ? '符合' : '不符合',
        verdict: {
          label: catLabel,
          kind: fb.qualified ? 'ok' : 'warn',
          shape: fb.qualified ? '●' : '○'
        },
        body: body
      });
    }

    function update() {
      var r = lipidCoverage(s);
      hdlRow.setState(r.hdlLow);
      setResult(el('div', null, [statinCard(r), fibrateCard(r)]));
    }

    var inputs = el('div', { class: 'calc-card' }, [
      el('h3', null, ['血脂異常用藥健保給付判定']),
      el('p', { class: 'lead' }, ['依健保署降血脂藥物給付規定（文件 031170）逐條核對 Statin 與 Fibrate 給付資格。']),
      section('血脂檢驗值', [
        field('LDL-C',             '低密度脂蛋白', s.ldl, 'mg/dL', function (v) { s.ldl = v; update(); }, { allowEmpty: true }),
        field('HDL-C',             '高密度脂蛋白', s.hdl, 'mg/dL', function (v) { s.hdl = v; update(); }, { allowEmpty: true }),
        field('Triglyceride',      '三酸甘油酯',   s.tg,  'mg/dL', function (v) { s.tg  = v; update(); }, { allowEmpty: true }),
        field('Total Cholesterol', '總膽固醇',     s.tc,  'mg/dL', function (v) { s.tc  = v; update(); }, { allowEmpty: true })
      ]),
      section('病人類別', [
        check('心血管疾病（CVD）', s.cvd, function (v) { s.cvd = v; update(); }),
        el('p', { class: 'check-hint' }, [
          '健保定義：心絞痛經心導管／缺氧心電圖／負荷試驗證實、腦梗塞、腦內出血、' +
          '陣發性腦缺血（TIA）、有症狀之頸動脈狹窄。'
        ]),
        check('糖尿病（Type 2 DM）', s.dm, function (v) { s.dm = v; update(); })
      ]),
      section('危險因子（健保定義）', [
        check('高血壓', s.htn, function (v) { s.htn = v; update(); }),
        check('年齡符合（男性 ≧45 / 女性 ≧55 或停經）', s.ageRisk, function (v) { s.ageRisk = v; update(); }),
        check('早發性冠心病家族史（一等親 男 ≦55 / 女 ≦65 發病）', s.fhx, function (v) { s.fhx = v; update(); }),
        check('吸菸', s.smoke, function (v) { s.smoke = v; update(); }),
        el('p', { class: 'check-hint' }, [
          '※ 若僅因吸菸而符合起步治療準則、且未戒菸，健保規定應自費治療。'
        ]),
        hdlRow
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

  // ---------- Mounjaro (tirzepatide KwikPen) split-draw / residual ----------
  // KwikPen: 2.4 ml total, 4 doses × 0.6 ml, 60 clicks per labeled dose,
  // 1 click = 0.01 ml. 6 strengths share fixed volume; concentration scales.
  var MOUNJARO_PENS = [2.5, 5, 7.5, 10, 12.5, 15];
  var MOUNJARO_PEN_VOL_ML = 2.4;
  var MOUNJARO_DOSE_VOL_ML = 0.6;
  var MOUNJARO_RESIDUAL_LO_ML = 0.3;
  var MOUNJARO_RESIDUAL_HI_ML = 0.6;

  // Pure math: given pen mg-strength + which field anchors + its value,
  // return all four linked values { mg, ml, clicks, units }.
  // Empty/invalid anchor -> all zeros.
  function mounjaroCalc(pen, anchor, value) {
    var v = Number(value);
    if (!pen || !isFinite(v) || v < 0) return { mg: 0, ml: 0, clicks: 0, units: 0 };
    var conc = pen / MOUNJARO_DOSE_VOL_ML; // mg/ml
    var ml;
    if (anchor === 'mg')          ml = v / conc;
    else if (anchor === 'ml')     ml = v;
    else if (anchor === 'clicks') ml = v / 100;
    else if (anchor === 'units')  ml = v / 100;
    else                          ml = 0;
    return { mg: ml * conc, ml: ml, clicks: ml * 100, units: ml * 100 };
  }

  // Display: round to 3 decimals, strip trailing zeros.
  function formatNum(n) {
    if (n == null || !isFinite(n)) return '';
    var rounded = Math.round(n * 1000) / 1000;
    if (rounded === 0) return '0';
    var s = rounded.toFixed(3);
    return s.replace(/\.?0+$/, '');
  }

  function renderMounjaro() {
    var s = { pen: null, mg: '', ml: '', clicks: '', lastEdited: null };

    function recompute() {
      if (!s.pen || !s.lastEdited) return;
      var anchor = s.lastEdited;
      var anchorVal = s[anchor];
      if (anchorVal === '' || anchorVal == null) return;
      var r = mounjaroCalc(s.pen, anchor, anchorVal);
      // Write all three, but skip the anchor itself so user keeps typing freely.
      if (anchor !== 'mg')     s.mg     = formatNum(r.mg);
      if (anchor !== 'ml')     s.ml     = formatNum(r.ml);
      if (anchor !== 'clicks') s.clicks = formatNum(r.clicks);
    }

    function makePenPicker() {
      var seg = el('div', { class: 'seg' });
      MOUNJARO_PENS.forEach(function (p) {
        var b = el('button', { type: 'button', class: s.pen === p ? 'is-on' : '' }, [p + ' mg']);
        b.addEventListener('click', function () {
          s.pen = p;
          Array.prototype.forEach.call(seg.children, function (x) { x.classList.remove('is-on'); });
          b.classList.add('is-on');
          recompute();
          rerender();
        });
        seg.appendChild(b);
      });
      return el('div', { class: 'field field-wide' }, [
        el('div', null, [el('label', { class: 'field-label' }, ['Pen 規格'])]),
        seg
      ]);
    }

    function makeField(key, label, hint, unit) {
      var input = el('input', {
        type: 'number', class: 'field-input',
        value: s[key],
        step: 'any',
        min: '0',
        oninput: function (e) {
          s[key] = e.target.value;
          s.lastEdited = key;
          recompute();
          // Re-render only the other fields' DOM values, not the whole tree,
          // so the user's caret position in this input isn't reset.
          ['mg', 'ml', 'clicks'].forEach(function (k) {
            if (k === key) return;
            var other = document.querySelector('[data-mj-field="' + k + '"]');
            if (other) other.value = s[k];
          });
          updateResult();
        }
      });
      input.setAttribute('data-mj-field', key);
      var labelWrap = el('div', null, [
        el('label', { class: 'field-label' }, [label]),
        hint ? el('span', { class: 'field-hint' }, [hint]) : null
      ]);
      return el('div', { class: 'field' }, [labelWrap, input, el('span', { class: 'field-unit' }, [unit])]);
    }

    function refLine() {
      if (!s.pen) {
        return el('p', { class: 'lead' }, ['請先選擇 pen 規格。']);
      }
      var conc = s.pen / MOUNJARO_DOSE_VOL_ML;
      var total = s.pen * 4;
      var perClick = formatNum(conc / 100);
      var resLo = formatNum(MOUNJARO_RESIDUAL_LO_ML * conc);
      var resHi = formatNum(MOUNJARO_RESIDUAL_HI_ML * conc);
      return el('p', { class: 'lead' }, [
        s.pen + ' mg pen:標示總容量 ' + MOUNJARO_PEN_VOL_ML + ' ml(4 × ' + MOUNJARO_DOSE_VOL_ML + ' ml)= ' + total + ' mg。' +
        '每喀噠 ≈ ' + perClick + ' mg。' +
        '4 劑後殘量約 ' + MOUNJARO_RESIDUAL_LO_ML + '–' + MOUNJARO_RESIDUAL_HI_ML + ' ml(≈ ' + resLo + '–' + resHi + ' mg)。'
      ]);
    }

    function safetyLine() {
      return el('p', { class: 'field-hint', style: 'margin-top:12px;line-height:1.6' }, [
        '分抽與殘劑使用屬 off-label,請注意:單支 pen 限同一病人、重複穿刺橡膠塞有 sterility 風險、開封後保存期依藥廠規範。'
      ]);
    }

    function updateResult() {
      if (!s.pen) {
        setResult(el('div', { class: 'result-card' }, [
          el('div', { class: 'result-head' }, [el('div', { class: 'result-label' }, ['等待輸入'])]),
          el('div', { class: 'result-body' }, [el('p', { class: 'lead' }, ['選擇 pen 規格後,任一欄輸入數字即會即時換算。'])])
        ]));
        return;
      }
      var hasInput = ['mg','ml','clicks'].some(function (k) { return s[k] !== '' && s[k] != null; });
      if (!hasInput) {
        setResult(el('div', { class: 'result-card' }, [
          el('div', { class: 'result-head' }, [el('div', { class: 'result-label' }, [s.pen + ' mg pen 已選'])]),
          el('div', { class: 'result-body' }, [el('p', { class: 'lead' }, ['任一欄輸入數字即會即時換算其他三欄。'])])
        ]));
        return;
      }
      var mg = formatNum(Number(s.mg));
      var ml = formatNum(Number(s.ml));
      var clicks = formatNum(Number(s.clicks));
      var explain = explainBlock([
        [{ strong: s.pen + ' mg pen' }, ' · 濃度 ', { strong: formatNum(s.pen / MOUNJARO_DOSE_VOL_ML) + ' mg/ml' }],
        ['抽取體積 ', { strong: ml + ' ml' }, ' = 劑量 ', { strong: mg + ' mg' }],
        ['= 旋鈕 ', { strong: clicks + ' 喀噠' }]
      ]);
      setResult(resultCard({
        label: '目標劑量', value: mg, unit: 'mg',
        verdict: { label: '抽 ' + ml + ' ml / 數 ' + clicks + ' 喀噠', kind: 'info', shape: '●' },
        body: [explain, summary('從 ' + s.pen + ' mg pen 抽取 ' + ml + ' ml,相當於 ' + mg + ' mg(' + clicks + ' 喀噠)。')]
      }));
    }

    var inputsHost;

    function rerender() {
      var card = el('div', { class: 'calc-card' }, [
        el('h3', null, ['猛健樂針劑換算 (Mounjaro)']),
        el('p', { class: 'lead' }, ['Tirzepatide KwikPen 分抽 / 殘劑換算。選 pen 規格後,任一欄輸入即時連動其他三欄。']),
        section('Pen 規格', [makePenPicker()]),
        section('劑量換算(3 欄連動)', [
          makeField('mg',     '目標劑量 (mg)', null,                'mg'),
          makeField('ml',     '抽取體積 (ml)', null,                'ml'),
          makeField('clicks', '旋鈕喀噠數',    '1 喀噠 = 0.01 ml',  '喀噠')
        ]),
        refLine(),
        safetyLine()
      ]);
      if (inputsHost && inputsHost.parentNode) {
        inputsHost.parentNode.replaceChild(card, inputsHost);
      } else {
        mountCalcLayout(card);
      }
      inputsHost = card;
      updateResult();
    }

    rerender();
  }

  // Expose pure helpers for tests + browser debugging (must run before init()
  // so jsdom-based tests can access them even if init throws on missing fetch).
  if (typeof window !== 'undefined') {
    window.__mounjaroCalc = mounjaroCalc;
    window.__formatNum = formatNum;
    window.__lipidCoverage = lipidCoverage;
    window.__bmiClassify = bmiClassify;
    window.__bmiAssess = bmiAssess;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      state: state,
      goNext: goNext,
      goPrev: goPrev,
      mounjaroCalc: mounjaroCalc,
      formatNum: formatNum,
      lipidCoverage: lipidCoverage,
      bmiClassify: bmiClassify,
      bmiAssess: bmiAssess
    };
  }

  // ============================================================
  // Boot
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
