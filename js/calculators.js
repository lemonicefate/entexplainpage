/*
 * Built-in calculators (BMI, lipid coverage, pen conversions).
 *
 * The browser app loads this file as a classic script before js/app.js,
 * while unit tests load it through CommonJS. Keeping the module boundary
 * small makes the calculators testable without the app shell: the shell
 * injects only the shared DOM builder (el) and the mount node (calcBody)
 * through create(deps), and consumes the returned registrations.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.Calculators = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function create(deps) {
    deps = deps || {};
    if (typeof deps.el !== 'function') throw new TypeError('Calculators requires an el function');
    var el = deps.el;
    var calcBody = deps.calcBody || null;
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
      var host = document.getElementById('calc-result');
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

    // ---------- Pen specification and safety baseline ----------
    // Labelled facts and off-label estimates intentionally live in separate
    // objects. A missing source invalidates the whole specification: the UI
    // must not show a normal conversion result from an untraceable baseline.
    var PEN_CLICK_VOLUME_ML = 0.01; // estimate only; neither label defines clicks

    var MOUNJARO_SOURCE = {
      market: '台灣',
      penType: '猛健樂筆 MOUNJARO® KwikPen 多劑預充填筆',
      label: '台灣仿單（台灣禮來）',
      url: 'https://www.fda.gov.tw/MLMS/H0001.aspx',
      revision: '2025-06-30',
      lastChecked: '2026-10-23'
    };
    var MOUNJARO_PENS = [
      { doseMg: 2.5, totalMg: 10, totalMl: 2.4, labeledDoses: 4, doseMl: 0.6, source: MOUNJARO_SOURCE },
      { doseMg: 5, totalMg: 20, totalMl: 2.4, labeledDoses: 4, doseMl: 0.6, source: MOUNJARO_SOURCE },
      { doseMg: 7.5, totalMg: 30, totalMl: 2.4, labeledDoses: 4, doseMl: 0.6, source: MOUNJARO_SOURCE },
      { doseMg: 10, totalMg: 40, totalMl: 2.4, labeledDoses: 4, doseMl: 0.6, source: MOUNJARO_SOURCE },
      { doseMg: 12.5, totalMg: 50, totalMl: 2.4, labeledDoses: 4, doseMl: 0.6, source: MOUNJARO_SOURCE },
      { doseMg: 15, totalMg: 60, totalMl: 2.4, labeledDoses: 4, doseMl: 0.6, source: MOUNJARO_SOURCE }
    ];
    var MOUNJARO_PEN_BY_DOSE = {};
    MOUNJARO_PENS.forEach(function (spec) { MOUNJARO_PEN_BY_DOSE[spec.doseMg] = spec; });
    MOUNJARO_PENS.forEach(function (spec) {
      spec.estimates = {
        official: false,
        clickVolumeMl: PEN_CLICK_VOLUME_ML,
        residualMl: { min: 0.3, max: 0.6 }
      };
    });

    var WEGOVY_SOURCE = {
      market: '台灣',
      penType: '週纖達諾特筆 Wegovy® FlexTouch 預充填筆',
      label: '台灣仿單（台灣諾和諾德）',
      url: 'https://www.fda.gov.tw/MLMS/H0001.aspx',
      revision: '2025-03-04',
      lastChecked: '2026-10-23'
    };
    var WEGOVY_PENS = [
      { doseMg: 0.25, totalMg: 1, totalMl: 1.5, labeledDoses: 4, doseMl: 0.375, source: WEGOVY_SOURCE },
      { doseMg: 0.5, totalMg: 2, totalMl: 1.5, labeledDoses: 4, doseMl: 0.375, source: WEGOVY_SOURCE },
      { doseMg: 1, totalMg: 4, totalMl: 3, labeledDoses: 4, doseMl: 0.75, source: WEGOVY_SOURCE },
      { doseMg: 1.7, totalMg: 6.8, totalMl: 3, labeledDoses: 4, doseMl: 0.75, source: WEGOVY_SOURCE },
      { doseMg: 2.4, totalMg: 9.6, totalMl: 3, labeledDoses: 4, doseMl: 0.75, source: WEGOVY_SOURCE }
    ];
    var WEGOVY_PEN_BY_DOSE = {};
    WEGOVY_PENS.forEach(function (spec) { WEGOVY_PEN_BY_DOSE[spec.doseMg] = spec; });
    WEGOVY_PENS.forEach(function (spec) {
      spec.estimates = {
        official: false,
        clickVolumeMl: PEN_CLICK_VOLUME_ML
      };
    });

    function emptyPenConversion() {
      return { mg: 0, ml: 0, clicks: 0, units: 0 };
    }

    function hasTraceableSource(source) {
      return !!(source && typeof source.market === 'string' && source.market.trim() &&
        typeof source.penType === 'string' && source.penType.trim() &&
        typeof source.label === 'string' && source.label.trim() &&
        typeof source.url === 'string' && /^https:\/\//.test(source.url) &&
        typeof source.revision === 'string' && source.revision.trim() &&
        typeof source.lastChecked === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source.lastChecked));
    }

    function isUsablePenSpec(spec) {
      return !!(spec && hasTraceableSource(spec.source) &&
        isFinite(spec.doseMg) && spec.doseMg > 0 &&
        isFinite(spec.totalMg) && spec.totalMg > 0 &&
        isFinite(spec.totalMl) && spec.totalMl > 0 &&
        isFinite(spec.labeledDoses) && spec.labeledDoses > 0 &&
        isFinite(spec.doseMl) && spec.doseMl > 0 &&
        Math.abs(spec.totalMg / spec.labeledDoses - spec.doseMg) < 1e-9 &&
        Math.abs(spec.totalMl / spec.labeledDoses - spec.doseMl) < 1e-9);
    }

    function convertPenValue(spec, anchor, value) {
      var v = Number(value);
      if (!isUsablePenSpec(spec) || !isFinite(v) || v < 0) return emptyPenConversion();
      var concentration = spec.totalMg / spec.totalMl;
      var ml;
      if (anchor === 'mg')          ml = v / concentration;
      else if (anchor === 'ml')     ml = v;
      else if (anchor === 'clicks') ml = v / (1 / PEN_CLICK_VOLUME_ML);
      else if (anchor === 'units')  ml = v / (1 / PEN_CLICK_VOLUME_ML);
      else                          ml = 0;
      return {
        mg: ml * concentration,
        ml: ml,
        clicks: ml / PEN_CLICK_VOLUME_ML,
        units: ml / PEN_CLICK_VOLUME_ML
      };
    }

    // Pure math: given pen strength + which field anchors + its value, return
    // all linked values. The click value is a theoretical estimate, not a
    // labelled dose setting. Empty/invalid/untraceable specs return all zeros.
    function mounjaroCalc(pen, anchor, value) {
      return convertPenValue(MOUNJARO_PEN_BY_DOSE[pen], anchor, value);
    }

    function wegovyCalc(pen, anchor, value) {
      return convertPenValue(WEGOVY_PEN_BY_DOSE[pen], anchor, value);
    }

    function sourcePanel(source, safetyText, noteText) {
      var sourceLink = el('a', {
        href: source.url,
        target: '_blank',
        rel: 'noreferrer noopener'
      }, [source.label]);
      var lines = [
        el('strong', null, ['標示規格與安全基線']),
        el('div', null, ['適用市場／筆型：' + source.market + ' · ' + source.penType]),
        el('div', null, ['來源：', sourceLink, ' · 仿單／資料版本：' + source.revision]),
        el('div', null, ['最後查核日：' + source.lastChecked]),
        el('div', null, ['醫療人員限定；非病人自我操作指引：本頁不提供分抽、喀噠給藥、穿刺或殘液使用步驟。']),
        el('div', null, [safetyText])
      ];
      if (noteText) lines.push(el('div', null, [noteText]));
      return el('div', { class: 'calc-note pen-source-panel' }, lines);
    }

    function unavailableSpecResult() {
      return el('div', { class: 'result-card' }, [
        el('div', { class: 'result-head' }, [el('div', { class: 'result-label' }, ['無法呈現換算結果'])]),
        el('div', { class: 'result-body' }, [
          note('標示規格來源不完整或無法追溯，已停止一般成功結果；請核對適用市場、筆型與最新仿單。', 'warn')
        ])
      ]);
    }

    // Display: round to 3 decimals, strip trailing zeros.
    function formatNum(n) {
      if (n == null || !isFinite(n)) return '';
      var rounded = Math.round(n * 1000) / 1000;
      if (rounded === 0) return '0';
      var s = rounded.toFixed(3);
      return s.replace(/\.?0+$/, '');
    }

    // ---------- Shared pen calculator renderer ----------
    // Both pen calculators share one DOM implementation: pen picker, three
    // linked fields (mg / ml / clicks) with anchor + caret preservation, and
    // the result card. A product adapter supplies only its specifications,
    // wording and reference-line text; behaviour never lives in the adapter.
    function renderPenCalculator(config) {
      var s = { pen: null, mg: '', ml: '', clicks: '', lastEdited: null };

      function recompute() {
        if (!s.pen || !s.lastEdited) return;
        var anchor = s.lastEdited;
        var anchorVal = s[anchor];
        if (anchorVal === '' || anchorVal == null) return;
        var r = config.calc(s.pen, anchor, anchorVal);
        // Write all three, but skip the anchor itself so user keeps typing freely.
        if (anchor !== 'mg')     s.mg     = formatNum(r.mg);
        if (anchor !== 'ml')     s.ml     = formatNum(r.ml);
        if (anchor !== 'clicks') s.clicks = formatNum(r.clicks);
      }

      function makePenPicker() {
        var seg = el('div', { class: 'seg' });
        config.pens.forEach(function (spec) {
          var b = el('button', { type: 'button', class: s.pen === spec.doseMg ? 'is-on' : '' }, [spec.doseMg + ' mg']);
          b.addEventListener('click', function () {
            s.pen = spec.doseMg;
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
              var other = document.querySelector('[' + config.fieldAttr + '="' + k + '"]');
              if (other) other.value = s[k];
            });
            updateResult();
          }
        });
        input.setAttribute(config.fieldAttr, key);
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
        var spec = config.penByDose[s.pen];
        if (!isUsablePenSpec(spec)) return el('p', { class: 'lead' }, ['標示規格來源不可用，已停止換算。']);
        return el('p', { class: 'lead' }, [config.refText(spec)]);
      }

      function safetyLine() {
        return sourcePanel(config.source, config.safetyText, config.sourceNote);
      }

      function updateResult() {
        if (!s.pen) {
          setResult(el('div', { class: 'result-card' }, [
            el('div', { class: 'result-head' }, [el('div', { class: 'result-label' }, ['等待輸入'])]),
            el('div', { class: 'result-body' }, [el('p', { class: 'lead' }, ['選擇 pen 規格後,任一欄輸入數字即會即時換算。'])])
          ]));
          return;
        }
        var spec = config.penByDose[s.pen];
        if (!isUsablePenSpec(spec)) {
          setResult(unavailableSpecResult());
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
          [{ strong: config.resultName(spec) }, ' · 濃度 ', { strong: formatNum(spec.totalMg / spec.totalMl) + ' mg/ml' }],
          ['劑量 ', { strong: mg + ' mg' }, ' · 體積 ', { strong: ml + ' ml' }],
          ['理論約略喀噠值 ', { strong: clicks }]
        ]);
        setResult(resultCard({
          label: '換算對照', value: mg, unit: 'mg',
          verdict: { label: '體積 ' + ml + ' ml · 理論約略喀噠值 ' + clicks, kind: 'info', shape: '●' },
          body: [explain, summary('此組數值為 ' + config.resultName(spec) + ' 的劑量、體積與理論約略喀噠值對照；喀噠與殘液均非官方標示刻度或用法。')]
        }));
      }

      var inputsHost;

      function rerender() {
        var card = el('div', { class: 'calc-card' }, [
          el('h3', null, [config.title]),
          el('p', { class: 'lead' }, [config.lead]),
          section('Pen 規格', [makePenPicker()]),
          section('劑量換算(3 欄連動)', [
            makeField('mg',     '目標劑量 (mg)', null,                'mg'),
            makeField('ml',     '體積 (ml)', null,                'ml'),
            makeField('clicks', '理論約略喀噠值', '非官方估算',  '喀噠')
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

    function renderMounjaro() {
      renderPenCalculator({
        pens: MOUNJARO_PENS,
        penByDose: MOUNJARO_PEN_BY_DOSE,
        calc: mounjaroCalc,
        fieldAttr: 'data-mj-field',
        title: '猛健樂針劑換算 (Mounjaro)',
        lead: 'Tirzepatide KwikPen 標示規格與 off-label 換算參考。選 pen 規格後，任一欄輸入即時連動其他欄位。',
        source: MOUNJARO_SOURCE,
        safetyText: '官方標示／仿單優先；分抽、喀噠值換算與殘液使用均屬 off-label；同一病人限用同一支筆，' +
          '每次換新針，重複穿刺橡膠塞有 sterility 風險；四個標示劑量後官方建議丟棄剩餘藥液；' +
          '開封後依來源保存規範（2–8°C 冷藏，或首次使用後 ≤30°C 最多 30 天），不得因本工具延長。',
        sourceNote: '每支筆總含量／總體積為依台灣仿單「4 劑 × 每劑劑量／體積」推算，台灣仿單未直接標示總量；其餘數值均為仿單標示值。',
        resultName: function (spec) { return spec.doseMg + ' mg pen'; },
        refText: function (spec) {
          var concentration = spec.totalMg / spec.totalMl;
          var resLo = formatNum(spec.estimates.residualMl.min * concentration);
          var resHi = formatNum(spec.estimates.residualMl.max * concentration);
          return '標示事實：' + spec.doseMg + ' mg pen 每支總量 ' + spec.totalMg + ' mg / ' + spec.totalMl +
            ' ml，共 ' + spec.labeledDoses + ' 個標示劑量，每劑 ' + spec.doseMl + ' ml。' +
            '非官方估算層：理論喀噠值以每喀噠 ' + spec.estimates.clickVolumeMl + ' ml 的換算假設計算；' +
            '四個標示劑量後殘液理論範圍約 ' + spec.estimates.residualMl.min + '–' + spec.estimates.residualMl.max +
            ' ml（約 ' + resLo + '–' + resHi + ' mg），不代表官方可用劑量。';
        }
      });
    }

    // ---------- Wegovy (semaglutide FlexTouch) off-label split-draw ----------
    function renderWegovy() {
      renderPenCalculator({
        pens: WEGOVY_PENS,
        penByDose: WEGOVY_PEN_BY_DOSE,
        calc: wegovyCalc,
        fieldAttr: 'data-wg-field',
        title: '週纖達針劑換算 (Wegovy)',
        lead: 'Semaglutide FlexTouch 諾特筆標示規格與 off-label 換算參考。選 pen 規格後，任一欄輸入即時連動其他欄位。',
        source: WEGOVY_SOURCE,
        safetyText: '官方標示／仿單優先；分抽、喀噠換算與殘液使用均屬 off-label；官方以劑量窗為準，' +
          '不以喀噠數作為標準給藥；同一病人限用同一支筆，每次換新針，重複穿刺有 sterility 風險；' +
          '四個標示劑量後殘液不足一個標示劑量，官方建議丟棄；開封後依來源保存規範（≤30°C 或 2–8°C 最多 6 週），不得因本工具延長。',
        sourceNote: '每劑體積（0.375／0.75 ml）為依台灣仿單每支筆總體積 ÷ 4 劑推算，台灣仿單未直接標示每劑體積；其餘數值均為仿單標示值。',
        resultName: function (spec) { return spec.doseMg + ' mg FlexTouch'; },
        refText: function (spec) {
          return '標示事實：' + spec.doseMg + ' mg FlexTouch 每支總量 ' + spec.totalMg + ' mg / ' + spec.totalMl +
            ' ml，共 ' + spec.labeledDoses + ' 個標示劑量，每劑 ' + spec.doseMl + ' ml。' +
            '非官方估算層：理論約略喀噠值以每喀噠 ' + spec.estimates.clickVolumeMl + ' ml 的換算假設計算；' +
            '四個標示劑量後若有殘液，官方建議丟棄，不代表可再使用。';
        }
      });
    }

    var registrations = [
      {id:'bmi',       title:'BMI 與肥胖分級',  subtitle:'身高體重 → BMI + 國健署分級',  tabLabel:'BMI', render: renderBmi},
      {id:'lipid',     title:'血脂異常用藥健保給付', subtitle:'LDL/HDL/TG/TC + 病人類別 → Statin / Fibrate 健保給付判定', tabLabel:'血脂給付', render: renderLipid},
      {id:'mounjaro',  title:'猛健樂針劑換算 (Mounjaro)', subtitle:'Tirzepatide 筆針劑量、刻度與殘劑互算', tabLabel:'猛健樂', thumbnail:'images/mounjaro/mounjaro-logo.svg', thumbnailMode:'logo', render: renderMounjaro},
      {id:'wegovy',    title:'週纖達針劑換算 (Wegovy)', subtitle:'Semaglutide FlexTouch 諾特筆劑量、體積與喀噠互算', tabLabel:'週纖達', thumbnail:'images/wegovy/wegovy-logo-nav.webp', thumbnailMode:'logo', render: renderWegovy}
    ];

    return {
      registrations: registrations,
      bmiClassify: bmiClassify,
      bmiAssess: bmiAssess,
      lipidCoverage: lipidCoverage,
      mounjaroCalc: mounjaroCalc,
      wegovyCalc: wegovyCalc,
      mounjaroPens: MOUNJARO_PENS,
      wegovyPens: WEGOVY_PENS,
      formatNum: formatNum
    };
  }

  return { create: create };
}));
