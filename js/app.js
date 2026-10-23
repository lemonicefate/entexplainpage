/* ============================================================
 * 診間解說 · Explain
 * Vanilla JS PWA — home / player / calculator
 * ============================================================ */
(function () {
  'use strict';

  // --- State ---
  var state = {
    categories: [],
    catalog: null,
    procedureStatus: 'loading',     // loading | available | unavailable
    activeCategory: 'all',       // all | surgery | ent | weight | functional | supplements | internal-medicine | calc
    query: '',
    pins: loadPins(),
    current: null,               // current procedure data
    stepIndex: 0,
    activeTool: null,            // pen | spot | laser | null
    wakeLock: null,
    preloadImages: [],
    chromeHidden: false,
    chromeTimer: null,
    readerLoading: false,
    readerErrorId: null,         // procedure id behind the Reader error state
    pendingNotice: ''            // one-shot notice to show on arrival home
  };

  var CHROME_AUTO_HIDE_MS = 3000;
  var readerSession = null;

  // --- DOM refs ---
  var $ = function (id) { return document.getElementById(id); };
  var homeView = $('home-view');
  var slideView = $('slide-view');
  var calcView = $('calc-view');
  var searchInput = $('search-input');
  var categoryChips = $('category-chips');
  var resultCount = $('result-count');
  var gridContainer = $('grid-container');
  var gridEmpty = $('grid-empty');
  var gridError = $('grid-error');
  // player
  var slideStage = $('slide-stage');
  var slideImage = $('slide-image');
  var imagePlaceholder = $('image-placeholder');
  var readerLoading = $('reader-loading');
  var readerLoadingTitle = $('reader-loading-title');
  var readerError = $('reader-error');
  var readerErrorTitle = $('reader-error-title');
  var readerErrorRetry = $('reader-error-retry');
  var readerErrorBack = $('reader-error-back');
  var tapHint = $('tap-hint');
  var tapHintClose = $('tap-hint-close');
  var homeNotice = $('home-notice');
  var homeNoticeText = $('home-notice-text');
  var homeNoticeClose = $('home-notice-close');
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
  // Built-in calculators live in js/calculators.js; the shell injects
  // el + calcBody there and consumes the returned registrations here.
  // ============================================================
  var calculators = Calculators.create({ el: el, calcBody: calcBody });
  var CALCULATOR_REGISTRATIONS = calculators.registrations;

  // ============================================================
  // Clinic catalog
  //
  // This is deliberately a data-only boundary. Adapters turn the two
  // application inputs (procedure metadata and calculator registrations)
  // into one semantic item shape. Nothing here knows about DOM, procedure
  // detail JSON, reader state, or calculator implementation.
  // ============================================================
  var ClinicCatalog = (function () {
    function validationError(message) {
      var error = new Error('ClinicCatalog validation error: ' + message);
      error.name = 'ClinicCatalogValidationError';
      return error;
    }

    function requiredString(value, field, index) {
      if (typeof value !== 'string' || !value.trim()) {
        throw validationError(field + ' is required at index ' + index);
      }
      return value.trim();
    }

    function normalizeCategories(value) {
      var values = Array.isArray(value) ? value : [value];
      return values.filter(function (id) {
        return typeof id === 'string' && id.trim();
      }).map(function (id) { return id.trim(); });
    }

    function create(options) {
      options = options || {};
      if (!Array.isArray(options.categories)) {
        throw validationError('categories must be an array');
      }
      if (!Array.isArray(options.procedures)) {
        throw validationError('procedures must be an array');
      }
      if (!Array.isArray(options.calculators)) {
        throw validationError('calculators must be an array');
      }

      var categoryMap = Object.create(null);
      var categories = [];
      options.categories.forEach(function (category, index) {
        if (!category || typeof category !== 'object') {
          throw validationError('category must be an object at index ' + index);
        }
        var id = requiredString(category.id, 'category.id', index);
        var title = requiredString(category.title, 'category.title', index);
        if (categoryMap[id]) throw validationError('duplicate category id ' + id);
        categoryMap[id] = { id: id, title: title };
        categories.push(categoryMap[id]);
      });
      if (!categoryMap.calc) {
        categoryMap.calc = { id: 'calc', title: '計算機' };
        categories.push(categoryMap.calc);
      }

      var ids = Object.create(null);
      function registerId(id, source, index) {
        if (ids[id]) throw validationError('duplicate id ' + id + ' (' + ids[id] + ' and ' + source + ' at index ' + index + ')');
        ids[id] = source + ' at index ' + index;
      }
      function validateItemCategories(itemCategories, source, index) {
        if (!itemCategories.length) throw validationError(source + ' must have at least one category at index ' + index);
        var seen = Object.create(null);
        itemCategories.forEach(function (id) {
          if (!categoryMap[id]) throw validationError(source + ' has unknown category ' + id + ' at index ' + index);
          if (seen[id]) throw validationError(source + ' repeats category ' + id + ' at index ' + index);
          seen[id] = true;
        });
      }

      function procedureAdapter(procedure, index) {
        if (!procedure || typeof procedure !== 'object') {
          throw validationError('procedure must be an object at index ' + index);
        }
        var id = requiredString(procedure.id, 'procedure.id', index);
        if (id.indexOf('/') !== -1) throw validationError('procedure.id cannot contain /: ' + id);
        var title = requiredString(procedure.title, 'procedure.title', index);
        var type = requiredString(procedure.type, 'procedure.type', index);
        if (type !== 'explain' && type !== 'surgery') {
          throw validationError('procedure.type must be explain or surgery at index ' + index);
        }
        var categoriesFromArray = Array.isArray(procedure.categories) ? normalizeCategories(procedure.categories) : [];
        var itemCategories = categoriesFromArray.length ? categoriesFromArray : normalizeCategories(procedure.category);
        validateItemCategories(itemCategories, 'procedure', index);
        requiredString(procedure.thumbnail, 'procedure.thumbnail', index);
        registerId(id, 'procedure', index);
        var slides = procedure.slides == null ? null : Number(procedure.slides);
        if (slides != null && (!Number.isInteger(slides) || slides < 1)) {
          throw validationError('procedure.slides must be a positive integer at index ' + index);
        }
        var firstCategory = itemCategories[0];
        return {
          id: id,
          title: title,
          subtitle: typeof procedure.subtitle === 'string' ? procedure.subtitle : '',
          region: typeof procedure.region === 'string' ? procedure.region : '',
          slides: slides,
          categories: itemCategories.slice(),
          href: '#/' + id,
          cover: {
            src: procedure.thumbnail.trim(),
            mode: 'image',
            fallback: ((procedure.region || type) + ' · ' + (slides || '?') + ' slides').trim()
          },
          tag: { id: firstCategory, label: categoryMap[firstCategory].title }
        };
      }

      function calculatorAdapter(calculator, index) {
        if (!calculator || typeof calculator !== 'object') {
          throw validationError('calculator must be an object at index ' + index);
        }
        var id = requiredString(calculator.id, 'calculator.id', index);
        if (id.indexOf('/') !== -1) throw validationError('calculator.id cannot contain /: ' + id);
        var title = requiredString(calculator.title, 'calculator.title', index);
        var tabLabel = requiredString(calculator.tabLabel, 'calculator.tabLabel', index);
        if (typeof calculator.render !== 'function') {
          throw validationError('calculator.render is required at index ' + index);
        }
        registerId(id, 'calculator', index);
        return {
          id: id,
          title: title,
          subtitle: typeof calculator.subtitle === 'string' ? calculator.subtitle : '',
          tabLabel: tabLabel,
          categories: ['calc'],
          href: '#/calc/' + id,
          cover: {
            src: typeof calculator.thumbnail === 'string' ? calculator.thumbnail : '',
            mode: calculator.thumbnailMode === 'logo' ? 'logo' : 'image',
            fallback: 'calculator'
          },
          tag: { id: 'calc', label: categoryMap.calc.title },
          render: calculator.render
        };
      }

      var procedureItems = options.procedures.map(procedureAdapter);
      var calculatorItems = options.calculators.map(calculatorAdapter);
      var allItems = procedureItems.concat(calculatorItems);

      function items() { return allItems.slice(); }
      function item(id) { return allItems.find(function (candidate) { return candidate.id === id; }); }
      function calculators() { return calculatorItems.slice(); }
      function filter(queryOptions) {
        queryOptions = queryOptions || {};
        var selectedCategory = queryOptions.category || 'all';
        var query = typeof queryOptions.query === 'string' ? queryOptions.query.trim().toLocaleLowerCase('zh-Hant') : '';
        var pinnedIds = Array.isArray(queryOptions.pinnedIds) ? queryOptions.pinnedIds : [];
        var filtered = allItems.filter(function (candidate) {
          if (selectedCategory !== 'all' && candidate.categories.indexOf(selectedCategory) === -1) return false;
          if (!query) return true;
          return [candidate.title, candidate.subtitle, candidate.region].some(function (text) {
            return text.toLocaleLowerCase('zh-Hant').indexOf(query) !== -1;
          });
        });
        filtered.sort(function (a, b) {
          var ap = pinnedIds.indexOf(a.id) === -1 ? 1 : 0;
          var bp = pinnedIds.indexOf(b.id) === -1 ? 1 : 0;
          if (ap !== bp) return ap - bp;
          var titleOrder = a.title.localeCompare(b.title, 'zh-Hant');
          return titleOrder || a.id.localeCompare(b.id);
        });
        return filtered;
      }
      function resolve(hash) {
        if (hash === '' || hash === '#') return { kind: 'home' };
        var calcMatch = /^#\/calc\/([^/]+)$/.exec(hash);
        if (calcMatch) {
          var calc = calculatorItems.find(function (candidate) { return candidate.id === calcMatch[1]; });
          return calc ? { kind: 'calculator', id: calc.id, item: calc, render: calc.render } : { kind: 'not-found' };
        }
        if (/^#\/calc(?:\/|$)/.test(hash)) return { kind: 'not-found' };
        var procedureMatch = /^#\/([^/]+)$/.exec(hash);
        if (procedureMatch) {
          var procedure = procedureItems.find(function (candidate) { return candidate.id === procedureMatch[1]; });
          return procedure ? { kind: 'procedure', id: procedure.id, item: procedure } : { kind: 'not-found' };
        }
        return { kind: 'not-found' };
      }

      return {
        categories: function () { return categories.slice(); },
        items: items,
        item: item,
        calculators: calculators,
        filter: filter,
        resolve: resolve
      };
    }

    return { create: create };
  })();

  if (typeof window !== 'undefined') {
    window.ClinicCatalog = ClinicCatalog;
    window.__ClinicCatalog = ClinicCatalog;
  }

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
    renderGrid();
  }

  // ============================================================
  // Init
  // ============================================================
  function init() {
    if (!homeView || !slideView || !calcView || !searchInput || !categoryChips || !resultCount || !gridContainer || !gridEmpty || !gridError || !calcBack || !calcTabs || !calcBody) {
      return;
    }
    // Validate program configuration outside the procedure fetch boundary.
    // A broken calculator registration is a developer error, not a partial
    // content-load condition.
    state.catalog = ClinicCatalog.create({
      categories: [],
      procedures: [],
      calculators: CALCULATOR_REGISTRATIONS
    });
    state.procedureStatus = 'loading';
    syncCatalogMetadata();
    setupSearch();
    setupKeyboard();
    setupReaderSession();
    setupRouting();
    setupSwipe();
    setupOffline();
    setupPlayerControls();
    setupReaderFeedback();
    setupTapZones();
    setupScrubber();
    setupPen();
    setupInstallHint();
    setupCalcShell();
    registerServiceWorker();
    loadIndex();
  }

  function loadIndex() {
    var calculatorCatalog = state.catalog;
    Promise.resolve()
      .then(function () { return fetch('procedures/index.json'); })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        // This create is inside the procedure boundary intentionally: any
        // malformed procedure metadata disables the whole procedure set.
        state.catalog = ClinicCatalog.create({
          categories: data.categories,
          procedures: data.procedures,
          calculators: CALCULATOR_REGISTRATIONS
        });
        state.procedureStatus = 'available';
        syncCatalogMetadata();
        renderCategoryChips();
        renderGrid();
        handleRoute();
      })
      .catch(function () {
        // Keep the already-validated static calculator catalog. Do not show a
        // partial set of medical content when one procedure is malformed.
        state.catalog = calculatorCatalog;
        state.procedureStatus = 'unavailable';
        state.activeCategory = 'all';
        syncCatalogMetadata();
        renderCategoryChips();
        renderGrid();
        handleRoute();
      });
  }

  function syncCatalogMetadata() {
    state.categories = state.catalog ? state.catalog.categories() : [];
  }

  function loadProcedure(id) {
    return fetch('procedures/' + id + '.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  function setupReaderSession() {
    readerSession = ReaderSession.create({
      load: loadProcedure,
      onStateChange: handleReaderSessionState
    });
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

  function renderCategoryChips() {
    if (!categoryChips) return;
    categoryChips.textContent = '';

    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'chip';
    allBtn.setAttribute('role', 'tab');
    allBtn.setAttribute('aria-selected', state.activeCategory === 'all' ? 'true' : 'false');
    allBtn.textContent = '全部';
    allBtn.addEventListener('click', function () {
      state.activeCategory = 'all';
      renderCategoryChips();
      renderGrid();
    });
    categoryChips.appendChild(allBtn);

    (state.categories || []).forEach(function (cat) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', state.activeCategory === cat.id ? 'true' : 'false');
      btn.dataset.category = cat.id;
      btn.textContent = cat.title;
      btn.addEventListener('click', function () {
        state.activeCategory = cat.id;
        renderCategoryChips();
        renderGrid();
      });
      categoryChips.appendChild(btn);
    });
  }

  function getFilteredItems() {
    if (!state.catalog) return [];
    return state.catalog.filter({
      category: state.activeCategory,
      query: state.query,
      pinnedIds: state.pins
    });
  }

  function renderGrid() {
    gridEmpty.hidden = true;
    gridError.hidden = state.procedureStatus !== 'unavailable';
    if (state.procedureStatus === 'unavailable') showGridError();

    var items = getFilteredItems();
    if (resultCount) resultCount.textContent = items.length + ' 個項目';

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
    card.href = item.href;
    card.setAttribute('aria-label', item.title);

    if (item.cover.src) {
      var img = document.createElement('img');
      img.className = 'card-thumb' + (item.cover.mode === 'logo' ? ' card-thumb-logo' : '');
      img.src = item.cover.src;
      img.alt = item.title;
      img.loading = 'lazy';
      img.onerror = function () {
        var ph = document.createElement('div');
        ph.className = 'card-thumb is-fallback';
        ph.textContent = item.cover.fallback;
        img.replaceWith(ph);
      };
      card.appendChild(img);
    } else {
      var ph = document.createElement('div');
      ph.className = 'card-thumb';
      ph.textContent = item.cover.fallback;
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
    tag.className = 'tag tag-' + item.tag.id;
    tag.textContent = item.tag.label;
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
    gridError.textContent = '';
    gridError.appendChild(el('p', { class: 'empty-title' }, ['衛教內容暫時無法載入']));
    gridError.appendChild(el('p', { class: 'empty-sub' }, ['圖卡目錄驗證或載入失敗，已暫停顯示醫療內容；計算機仍可使用。']));
    var retry = el('button', { class: 'btn-primary', type: 'button' }, ['重新整理']);
    retry.addEventListener('click', function () { window.location.reload(); });
    gridError.appendChild(retry);
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
  // Routing  (#  | #/<id> | #/calc/<id>)
  // ============================================================
  function setupRouting() {
    window.addEventListener('hashchange', handleRoute);
  }

  function handleRoute() {
    var hash = window.location.hash || '';
    if (!state.catalog) return;
    // While the index is pending, retain a direct calculator route. A
    // procedure route waits for the all-or-nothing procedure result instead
    // of being mistaken for an unknown id.
    if (state.procedureStatus === 'loading' && /^#\/(?!calc(?:\/|$))/.test(hash)) return;
    var destination = state.catalog.resolve(hash);
    if (destination.kind === 'calculator') {
      readerSession.transition({ type: 'leave' });
      enterCalc(destination);
      return;
    }
    if (destination.kind === 'procedure') {
      enterPlayer(destination.id);
      return;
    }
    if (destination.kind === 'not-found' && hash) {
      readerSession.transition({ type: 'leave' });
      // Never vanish silently (critique P1): explain on arrival home.
      state.pendingNotice = '找不到這個頁面，已返回首頁。';
      window.location.hash = '';
      return;
    }
    readerSession.transition({ type: 'leave' });
    exitToHome();
  }

  function switchView(target) {
    [homeView, slideView, calcView].forEach(function (v) { v.classList.remove('active'); });
    target.classList.add('active');
    window.scrollTo(0, 0);
  }

  function exitToHome() {
    switchView(homeView);
    if (state.pendingNotice) {
      showHomeNotice(state.pendingNotice);
      state.pendingNotice = '';
    }
  }

  function showHomeNotice(text) {
    if (!homeNotice || !homeNoticeText) return;
    homeNoticeText.textContent = text;
    homeNotice.hidden = false;
  }

  // ============================================================
  // Player
  // ============================================================
  function enterPlayer(id) {
    var proc = state.catalog && state.catalog.item(id);
    if (!proc || !proc.href || proc.href.indexOf('#/calc/') === 0) {
      readerSession.transition({ type: 'leave' });
      window.location.hash = '';
      return;
    }

    readerSession.transition({ type: 'procedure', id: id });
  }

  function handleReaderSessionState(event) {
    if (event.type === 'loading') {
      showReaderLoading(event.target.id);
      return;
    }
    if (event.type === 'active') {
      // A hash can change before the browser dispatches hashchange. Do not
      // let a completion that no longer matches the URL paint the Reader.
      if (window.location.hash !== '#/' + event.target.id) {
        readerSession.transition({ type: 'leave' });
        return;
      }
      commitReader(event.target.id, event.data);
      return;
    }
    if (event.type === 'error') {
      // Dedicated Reader error state (critique P1): stay in the player, say
      // what failed, and offer retry — never bounce home silently in front
      // of the patient. Stale errors (hash already moved on) never emit.
      if (window.location.hash === '#/' + event.target.id) showReaderError(event.target);
      return;
    }
    if (event.type === 'leave') resetReaderLifecycle();
  }

  function resetReaderLifecycle() {
    state.current = null;
    state.stepIndex = 0;
    state.readerLoading = false;
    state.readerErrorId = null;
    clearChromeTimer();
    setTool(null);
    clearChromeTimer();
    cancelPreload();
    releaseWakeLock();
    clearPen();
    penDrawing = false;
    thumbStrip.textContent = '';
    endScreen.hidden = true;
    if (readerLoading) readerLoading.hidden = true;
    if (readerError) readerError.hidden = true;
    if (tapHint) tapHint.hidden = true;
    if (readerLoadingTitle) readerLoadingTitle.textContent = '';
    slideView.classList.remove('reader-loading');
    slideView.setAttribute('aria-busy', 'false');
    showChrome(); // reset so next entry starts with chrome visible
    setReaderInteractionEnabled(false);
  }

  function setReaderInteractionEnabled(enabled) {
    [prevBtn, nextBtn].forEach(function (button) { if (button) button.disabled = !enabled; });
    document.querySelectorAll('.tool[data-tool]').forEach(function (button) {
      button.disabled = !enabled;
    });
    if (scrubber) scrubber.disabled = !enabled;
  }

  function showReaderLoading(id) {
    var proc = state.catalog && state.catalog.item(id);
    resetReaderLifecycle();
    state.readerLoading = true;
    switchView(slideView);
    slideView.classList.add('reader-loading');
    slideView.setAttribute('aria-busy', 'true');
    readerLoading.hidden = false;
    readerLoadingTitle.textContent = proc ? proc.title : id;
    playerTitle.textContent = proc ? proc.title : '';
    playerPageTitle.textContent = '載入中';
    stepIndicator.textContent = '— / —';
    if (slideImage) slideImage.hidden = true;
    if (imagePlaceholder) imagePlaceholder.hidden = true;
    setReaderInteractionEnabled(false);
  }

  function showReaderError(target) {
    var proc = state.catalog && state.catalog.item(target.id);
    resetReaderLifecycle();
    state.readerErrorId = target.id;
    switchView(slideView);
    slideView.setAttribute('aria-busy', 'false');
    if (readerErrorTitle) {
      readerErrorTitle.textContent = '「' + (proc ? proc.title : target.id) + '」載入失敗';
    }
    if (readerError) readerError.hidden = false;
    setReaderInteractionEnabled(false);
  }

  // One-time tap-zone hint (critique P1): the three tap zones have no visual
  // affordance, so the first Reader visit explains them once; dismissing (or
  // using a zone) records it in localStorage and it never shows again.
  var TAP_HINT_KEY = 'reader_tap_hint_seen';
  function tapHintSeen() {
    try { return localStorage.getItem(TAP_HINT_KEY) === '1'; } catch (e) { return false; }
  }
  function maybeShowTapHint() {
    if (!tapHint || tapHintSeen()) return;
    tapHint.hidden = false;
  }
  function dismissTapHint() {
    if (!tapHint || tapHint.hidden) return;
    tapHint.hidden = true;
    try { localStorage.setItem(TAP_HINT_KEY, '1'); } catch (e) {}
  }

  function setupReaderFeedback() {
    if (readerErrorRetry) readerErrorRetry.addEventListener('click', function () {
      if (!state.readerErrorId) return;
      readerSession.transition({ type: 'procedure', id: state.readerErrorId }, { force: true });
    });
    if (readerErrorBack) readerErrorBack.addEventListener('click', function () {
      window.location.hash = '';
    });
    if (tapHintClose) tapHintClose.addEventListener('click', dismissTapHint);
    if (homeNoticeClose) homeNoticeClose.addEventListener('click', function () {
      homeNotice.hidden = true;
    });
  }

  function commitReader(id, data) {
    var proc = state.catalog && state.catalog.item(id);
    if (!proc || !proc.href || proc.href.indexOf('#/calc/') === 0) return;
    state.current = Object.assign({}, proc, data);
    state.stepIndex = 0;
    state.readerLoading = false;
    switchView(slideView);
    slideView.classList.remove('reader-loading');
    slideView.setAttribute('aria-busy', 'false');
    readerLoading.hidden = true;
    endScreen.hidden = true;
    playerTitle.textContent = state.current.title;
    setReaderInteractionEnabled(true);
    resizePenCanvas(); // canvas only has real dimensions once slideView is active
    renderThumbs();
    renderStep();
    preloadImages(data.steps);
    requestWakeLock();
    showChrome();
    scheduleChromeHide();
    maybeShowTapHint();
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
    if (t && (!state.current || state.readerLoading)) return;
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
      if (state.activeTool || !state.current) return; // let tools own the stage
      dismissTapHint(); // using a zone means it has been discovered
      goPrev();
    });
    tapNext.addEventListener('click', function () {
      if (state.activeTool || !state.current) return;
      dismissTapHint();
      goNext();
    });
    tapToggle.addEventListener('click', function () {
      if (state.activeTool || !state.current) return;
      dismissTapHint();
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
    if (!state.current) return;
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
    (steps || []).forEach(function (s) {
      if (s.image) { var img = new Image(); img.src = s.image; state.preloadImages.push(img); }
    });
  }
  function cancelPreload() {
    state.preloadImages.forEach(function (img) { img.src = ''; });
    state.preloadImages = [];
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
    calcTabs.textContent = '';
    state.catalog.calculators().forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'calc-tab';
      btn.dataset.calc = c.id;
      btn.textContent = c.tabLabel;
      btn.addEventListener('click', function () { window.location.hash = c.href; });
      calcTabs.appendChild(btn);
    });
  }

  function enterCalc(destination) {
    var calculator = destination && destination.item;
    if (!calculator || typeof destination.render !== 'function') {
      window.location.hash = '';
      return;
    }
    switchView(calcView);
    Array.prototype.forEach.call(calcTabs.children, function (b) {
      b.classList.toggle('is-active', b.dataset.calc === calculator.id);
    });
    destination.render();
  }

  // ---------- Shared DOM builder (also injected into Calculators) ----------
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

  // Expose pure helpers for tests + browser debugging (must run before init()
  // so jsdom-based tests can access them even if init throws on missing fetch).
  if (typeof window !== 'undefined') {
    window.__mounjaroCalc = calculators.mounjaroCalc;
    window.__wegovyCalc = calculators.wegovyCalc;
    window.__mounjaroPens = calculators.mounjaroPens;
    window.__wegovyPens = calculators.wegovyPens;
    window.__formatNum = calculators.formatNum;
    window.__lipidCoverage = calculators.lipidCoverage;
    window.__bmiClassify = calculators.bmiClassify;
    window.__bmiAssess = calculators.bmiAssess;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      state: state,
      ClinicCatalog: ClinicCatalog,
      goNext: goNext,
      goPrev: goPrev,
      mounjaroCalc: calculators.mounjaroCalc,
      wegovyCalc: calculators.wegovyCalc,
      mounjaroPens: calculators.mounjaroPens,
      wegovyPens: calculators.wegovyPens,
      formatNum: calculators.formatNum,
      lipidCoverage: calculators.lipidCoverage,
      bmiClassify: calculators.bmiClassify,
      bmiAssess: calculators.bmiAssess
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
