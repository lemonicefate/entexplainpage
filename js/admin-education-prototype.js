(function () {
  'use strict';

  var variants = [
    {
      id: 'direct',
      label: 'A · 直接產圖',
      workflow: 'AI 生成完整內容區',
      source: '一張完整圖像',
      editable: '需重新生成整張內容區',
      summary: '圖片模型負責整個內容區的構圖、文字與插圖；系統只加上固定品牌框架。'
    },
    {
      id: 'editorial',
      label: 'B · 敘事模板',
      workflow: '圖文範本搭配插圖',
      source: '文字欄位與插圖分開管理',
      editable: '可逐欄編修（概念）',
      summary: '大面積插圖搭配明確的敘事階層，適合由醫師指著逐點說明。'
    },
    {
      id: 'modular',
      label: 'C · 模組模板',
      workflow: '欄位組合成資訊卡',
      source: '結構化內容卡片',
      editable: '可逐卡編修（概念）',
      summary: '以可預測的卡片或表格容量承載比較、生活建議與規則速查。'
    }
  ];

  var topics = {
    menieres: {
      category: '疾病比較',
      title: '常見眩暈疾病比較',
      topic: '梅尼爾氏症',
      eyebrow: '眩暈大解密',
      lede: '發作時間、聽力變化與誘發方式，是區分三種常見周邊性眩暈的重要線索。',
      page: '01 / 03',
      accent: '#2f8f88',
      accentSoft: '#dcefeb',
      directImage: 'images/prototype-education/menieres-direct.webp',
      illustration: 'images/prototype-education/menieres-illustration.webp',
      items: [
        {title: '耳石脫落症', text: '轉頭或躺下時突然天旋地轉，通常少於一分鐘。', detail: ['姿勢誘發', '通常無聽力變化'], color: '#e5966a'},
        {title: '梅尼爾氏症', text: '反覆發作二十分鐘至數小時，常伴耳鳴與聽力波動。', detail: ['自發發作', '可能合併耳悶'], color: '#2f8f88'},
        {title: '前庭神經炎', text: '持續數天的劇烈眩暈，走路不穩但通常沒有聽力變化。', detail: ['持續性', '常需前庭復健'], color: '#d58545'}
      ]
    },
    oral: {
      category: '生活建議',
      title: '口腔潰瘍生活處方箋',
      topic: '口腔潰瘍',
      eyebrow: '擊退嘴破',
      lede: '減少刺激、維持口腔濕潤並充分休息，多數小型潰瘍會在一至兩週內改善。',
      page: '03 / 04',
      accent: '#d66f52',
      accentSoft: '#fae6df',
      directImage: 'images/prototype-education/oral-direct.webp',
      illustration: 'images/prototype-education/oral-illustration.webp',
      items: [
        {title: '多喝水', text: '保持口腔濕潤，避免黏膜因乾燥而更加不舒服。', detail: ['每日分次補充', '避免過燙飲品'], color: '#63a9cf'},
        {title: '避開刺激', text: '暫停菸酒、檳榔，以及辛辣、酸或過硬的食物。', detail: ['選擇柔軟食物', '餐後溫和漱口'], color: '#dc735d'},
        {title: '睡眠放鬆', text: '規律睡眠與減少壓力，有助於身體修復。', detail: ['固定作息', '安排休息時間'], color: '#9b86c4'},
        {title: '留意警訊', text: '超過兩週未癒、持續變大或反覆同處發作，應就醫檢查。', detail: ['兩週未改善', '合併硬塊或出血'], color: '#d8a545'}
      ]
    },
    influenza: {
      category: '規則速查',
      title: '公費流感抗病毒藥物高風險條件',
      topic: '流感公費用藥規則',
      eyebrow: '規則速查',
      lede: '符合高風險慢性疾病只是評估的一部分，實際診斷與用藥仍由醫師依健保規範判定。',
      page: '02 / 04',
      accent: '#536aa8',
      accentSoft: '#e4e8f4',
      directImage: 'images/prototype-education/influenza-direct.webp',
      illustration: 'images/prototype-education/influenza-illustration.webp',
      items: [
        {title: '傳染與免疫', text: 'HIV、慢性病毒性肝炎、免疫缺陷與類肉瘤病。', detail: ['B20、B18–19', 'D80–89'], color: '#4b9cb5'},
        {title: '代謝與內分泌', text: '糖尿病及其併發症、肥胖與澱粉樣變性。', detail: ['E08–13', 'E66、E85'], color: '#77a65b'},
        {title: '神經系統', text: '巴金森氏病、失智、多發性硬化、癲癇與中風後遺症。', detail: ['G20、G30–46', 'G70–72'], color: '#d28b55'},
        {title: '心血管疾病', text: '高血壓、缺血性心臟病、心衰竭與腦血管疾病。', detail: ['I00–09、I34–51', 'I60–79'], color: '#c85d61'},
        {title: '呼吸系統', text: '氣喘、COPD、肺病與呼吸衰竭。', detail: ['J40–45、J47', 'J60–70、J82–99'], color: '#8e77b8'},
        {title: '消化、泌尿與其他', text: '慢性肝病、慢性腎病、自體免疫疾病與無脾症。', detail: ['K70–76、N00–27', 'M05–35、Z90.81'], color: '#c0a13d'}
      ]
    }
  };

  var topicOrder = Object.keys(topics);
  var variantOrder = variants.map(function (variant) { return variant.id; });
  var page = document.getElementById('education-page');
  var topicSelect = document.getElementById('topic-select');
  var workflowOptions = Array.prototype.slice.call(document.querySelectorAll('.workflow-option'));
  var narrativePager = document.getElementById('narrative-pager');
  var previewDialog = document.getElementById('preview-dialog');
  var previewDialogContent = document.getElementById('preview-dialog-content');

  function getParams() { return new URLSearchParams(window.location.search); }
  function getVariant() {
    var id = getParams().get('variant') || 'direct';
    return variants.find(function (variant) { return variant.id === id; }) || variants[0];
  }
  function getTopicId() {
    var id = getParams().get('topic') || topicOrder[0];
    return topics[id] ? id : topicOrder[0];
  }
  function getEditorialPage(topic) {
    var total = Math.max(1, Math.ceil(topic.items.length / 3));
    var requested = parseInt(getParams().get('editorialPage') || '1', 10);
    return Math.min(total, Math.max(1, Number.isFinite(requested) ? requested : 1));
  }

  function setParams(next) {
    var params = getParams();
    Object.keys(next).forEach(function (key) {
      if (next[key] === null || next[key] === undefined) params.delete(key);
      else params.set(key, next[key]);
    });
    window.history.replaceState(null, '', window.location.pathname + '?' + params.toString());
    render();
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderShell(topic, content) {
    page.textContent = '';
    page.style.setProperty('--accent', topic.accent);
    page.style.setProperty('--accent-soft', topic.accentSoft);

    var header = el('header', 'education-header');
    var brand = el('div', 'education-brand');
    brand.appendChild(el('div', 'education-brand-mark', '衛'));
    var brandCopy = el('div', 'education-brand-copy');
    brandCopy.appendChild(el('strong', '', '診間解說'));
    brandCopy.appendChild(el('span', '', 'Explain'));
    brand.appendChild(brandCopy);
    header.appendChild(brand);
    header.appendChild(el('div', 'education-publisher', 'Dr. Wang · @clinic.explain'));

    var body = el('section', 'education-content');
    body.appendChild(content);

    var footer = el('footer', 'education-footer');
    footer.appendChild(el('div', 'education-topic', topic.topic));
    footer.appendChild(el('div', 'education-page-number', getPageLabel(topic, getVariant(), getEditorialPage(topic))));
    footer.appendChild(el('div', 'education-disclaimer', '本圖為一般衛教資訊，個別情況請由醫療人員評估。'));

    page.appendChild(header);
    page.appendChild(body);
    page.appendChild(footer);
  }

  function getPageLabel(topic, variant, editorialPage) {
    var match = topic.page.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return topic.page;
    var pages = variant.id === 'editorial' ? Math.max(1, Math.ceil(topic.items.length / 3)) : 1;
    if (pages === 1) return topic.page;
    var current = Number(match[1]) + editorialPage - 1;
    var total = Number(match[2]) + pages - 1;
    return String(current).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
  }

  function renderDirect(topic) {
    var wrap = el('div', 'direct-body');
    var image = document.createElement('img');
    image.src = topic.directImage;
    image.alt = topic.title + '，AI 直接產圖版';
    image.addEventListener('error', function () { wrap.classList.add('is-missing'); });
    wrap.appendChild(image);
    return wrap;
  }

  function renderEditorial(topic) {
    var wrap = el('div', 'editorial-layout');
    var visual = el('div', 'editorial-visual');
    var image = document.createElement('img');
    image.src = topic.illustration;
    image.alt = '';
    visual.appendChild(image);
    wrap.appendChild(visual);

    var copy = el('div', 'editorial-copy');
    copy.appendChild(el('div', 'page-eyebrow', topic.eyebrow));
    copy.appendChild(el('h2', 'page-title', topic.title));
    copy.appendChild(el('p', 'page-lede', topic.lede));
    var points = el('div', 'editorial-points');
    var editorialPage = getEditorialPage(topic);
    var start = (editorialPage - 1) * 3;
    topic.items.slice(start, start + 3).forEach(function (item, index) {
      var row = el('div', 'editorial-point');
      row.appendChild(el('b', '', String(start + index + 1).padStart(2, '0')));
      var pointCopy = el('div');
      pointCopy.appendChild(el('strong', '', item.title));
      pointCopy.appendChild(el('span', '', item.text));
      row.appendChild(pointCopy);
      points.appendChild(row);
    });
    copy.appendChild(points);
    wrap.appendChild(copy);
    return wrap;
  }

  function renderTopicCopy(topic) {
    var list = document.getElementById('topic-copy-list');
    var summary = document.getElementById('topic-copy-summary');
    list.textContent = '';
    summary.textContent = '檢視主題完整文字稿 · ' + topic.items.length + ' 項';
    topic.items.forEach(function (item) {
      var entry = el('li');
      entry.appendChild(el('strong', '', item.title));
      entry.appendChild(el('p', '', item.text));
      if (item.detail && item.detail.length) {
        var details = el('ul');
        item.detail.forEach(function (line) { details.appendChild(el('li', '', line)); });
        entry.appendChild(details);
      }
      list.appendChild(entry);
    });
  }

  function renderZoomPreview() {
    previewDialogContent.replaceChildren();
    var zoomedPage = page.cloneNode(true);
    zoomedPage.removeAttribute('id');
    zoomedPage.classList.add('zoomed-education-page');
    previewDialogContent.appendChild(zoomedPage);
  }

  function renderNarrativePager(variant, topic) {
    var total = Math.max(1, Math.ceil(topic.items.length / 3));
    var current = getEditorialPage(topic);
    var visible = variant.id === 'editorial' && total > 1;
    narrativePager.hidden = !visible;
    if (!visible) return;
    document.getElementById('narrative-page-status').textContent = '敘事頁 ' + current + ' / ' + total;
    document.getElementById('narrative-prev').disabled = current <= 1;
    document.getElementById('narrative-next').disabled = current >= total;
  }

  function renderModular(topic) {
    var wrap = el('div', 'modular-layout');
    var heading = el('div', 'modular-heading');
    var headingCopy = el('div');
    headingCopy.appendChild(el('div', 'page-eyebrow', topic.eyebrow));
    headingCopy.appendChild(el('h2', 'page-title', topic.title));
    heading.appendChild(headingCopy);
    heading.appendChild(el('div', 'modular-note', topic.lede));
    wrap.appendChild(heading);

    var grid = el('div', 'module-grid');
    grid.dataset.count = String(topic.items.length);
    topic.items.forEach(function (item) {
      var card = el('article', 'module-card');
      card.style.setProperty('--card-accent', item.color);
      card.appendChild(el('h3', '', item.title));
      card.appendChild(el('p', '', item.text));
      if (item.detail && item.detail.length) {
        var list = el('ul');
        item.detail.forEach(function (line) { list.appendChild(el('li', '', line)); });
        card.appendChild(list);
      }
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  function renderState(variant, topic) {
    document.getElementById('state-title').textContent = variant.label;
    document.getElementById('state-summary').textContent = variant.summary;
    document.getElementById('state-workflow').textContent = variant.workflow;
    var editorialPage = getEditorialPage(topic);
    var editorialPages = Math.max(1, Math.ceil(topic.items.length / 3));
    document.getElementById('state-layout').textContent = variant.id === 'direct'
      ? '模型自由布局'
      : (variant.id === 'editorial'
        ? '雙區敘事' + (editorialPages > 1 ? ' · 第 ' + editorialPage + ' / ' + editorialPages + ' 頁' : '')
        : topic.items.length + ' 卡模組');
    document.getElementById('state-source').textContent = variant.source;
    document.getElementById('state-editable').textContent = variant.editable;
    workflowOptions.forEach(function (option) {
      option.setAttribute('aria-pressed', String(option.dataset.variant === variant.id));
    });
    var announcement = '目前選擇「' + variant.label + '」，示範主題「' + topic.topic + '」';
    if (variant.id === 'editorial' && editorialPages > 1) announcement += '，敘事頁 ' + editorialPage + ' / ' + editorialPages;
    document.getElementById('state-announcement').textContent = announcement;
  }

  function render() {
    var variant = getVariant();
    var topic = topics[getTopicId()];
    topicSelect.value = getTopicId();
    var content = variant.id === 'direct' ? renderDirect(topic) : (variant.id === 'editorial' ? renderEditorial(topic) : renderModular(topic));
    renderShell(topic, content);
    renderTopicCopy(topic);
    renderNarrativePager(variant, topic);
    renderState(variant, topic);
    if (previewDialog.open) renderZoomPreview();
  }

  function cycleVariant(delta) {
    var current = variantOrder.indexOf(getVariant().id);
    var next = (current + delta + variantOrder.length) % variantOrder.length;
    setParams({variant: variantOrder[next], editorialPage: variantOrder[next] === 'editorial' ? getParams().get('editorialPage') : null});
  }

  topicOrder.forEach(function (id) {
    var option = document.createElement('option');
    option.value = id;
    option.textContent = topics[id].category + ' · ' + topics[id].topic;
    topicSelect.appendChild(option);
  });

  topicSelect.addEventListener('change', function () { setParams({topic: topicSelect.value, editorialPage: null}); });
  workflowOptions.forEach(function (option) {
    option.addEventListener('click', function () {
      setParams({variant: option.dataset.variant, editorialPage: option.dataset.variant === 'editorial' ? getParams().get('editorialPage') : null});
    });
  });
  document.getElementById('narrative-prev').addEventListener('click', function () {
    var nextPage = getEditorialPage(topics[getTopicId()]) - 1;
    setParams({editorialPage: nextPage === 1 ? null : String(nextPage)});
  });
  document.getElementById('narrative-next').addEventListener('click', function () {
    setParams({editorialPage: String(getEditorialPage(topics[getTopicId()]) + 1)});
  });
  document.getElementById('preview-zoom-open').addEventListener('click', function () {
    renderZoomPreview();
    previewDialog.showModal();
  });
  document.getElementById('preview-zoom-close').addEventListener('click', function () { previewDialog.close(); });
  previewDialog.addEventListener('close', function () { previewDialogContent.replaceChildren(); });
  window.addEventListener('keydown', function (event) {
    if (previewDialog.open) return;
    var target = event.target;
    if (target && (target.matches('input, textarea, select, button, a, summary') || target.isContentEditable)) return;
    if (event.key === 'ArrowLeft') { cycleVariant(-1); event.preventDefault(); }
    if (event.key === 'ArrowRight') { cycleVariant(1); event.preventDefault(); }
  });
  window.addEventListener('popstate', render);

  render();
})();
