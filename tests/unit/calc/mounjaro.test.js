import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf-8');
const appSrc = fs.readFileSync(path.resolve(__dirname, '../../../js/app.js'), 'utf-8');

function loadHelperWindow() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  dom.window.addEventListener('error', () => {});
  const script = dom.window.document.createElement('script');
  script.textContent = appSrc;
  try { dom.window.document.body.appendChild(script); } catch (e) {}
  return dom.window;
}

function loadCalculator() {
  const dom = new JSDOM(htmlContent.replace('</body>', `<script>${appSrc}</script></body>`), {
    url: 'http://localhost/#/calc/mounjaro',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ categories: [], procedures: [] })
      });
      Object.defineProperty(window.navigator, 'serviceWorker', {
        value: { register: () => Promise.resolve({ addEventListener: () => {} }) },
        configurable: true
      });
    }
  });
  return new Promise(resolve => {
    dom.window.addEventListener('load', () => setTimeout(() => resolve(dom), 0));
  });
}

describe('Mounjaro labelled specification safety baseline', () => {
  let win;

  beforeEach(() => {
    win = loadHelperWindow();
  });

  it('contains six traceable KwikPen specifications', () => {
    expect(win.__mounjaroPens).toHaveLength(6);
    expect(win.__mounjaroPens.map(pen => [pen.doseMg, pen.totalMg, pen.totalMl, pen.labeledDoses, pen.doseMl])).toEqual([
      [2.5, 10, 2.4, 4, 0.6],
      [5, 20, 2.4, 4, 0.6],
      [7.5, 30, 2.4, 4, 0.6],
      [10, 40, 2.4, 4, 0.6],
      [12.5, 50, 2.4, 4, 0.6],
      [15, 60, 2.4, 4, 0.6]
    ]);
    win.__mounjaroPens.forEach(pen => {
      expect(pen.source).toMatchObject({
        market: expect.any(String),
        penType: expect.stringContaining('KwikPen'),
        url: expect.stringMatching(/^https:\/\//),
        revision: expect.any(String),
        lastChecked: '2026-07-31'
      });
    });
  });

  it('fails closed when a labelled specification loses its source', () => {
    const pen = win.__mounjaroPens[0];
    const originalUrl = pen.source.url;
    pen.source.url = '';
    expect(win.__mounjaroCalc(2.5, 'mg', 1)).toEqual({ mg: 0, ml: 0, clicks: 0, units: 0 });
    pen.source.url = originalUrl;
  });

  it('fails closed when source revision metadata is missing', () => {
    const pen = win.__mounjaroPens[0];
    const originalRevision = pen.source.revision;
    pen.source.revision = '';
    expect(win.__mounjaroCalc(2.5, 'mg', 1)).toEqual({ mg: 0, ml: 0, clicks: 0, units: 0 });
    pen.source.revision = originalRevision;
  });

  it('keeps click and residual values in the estimate layer', () => {
    const estimate = win.__mounjaroPens[0].estimates;
    expect(estimate.official).toBe(false);
    expect(estimate.clickVolumeMl).toBeGreaterThan(0);
    expect(estimate.residualMl.min).toBeGreaterThanOrEqual(0);
    expect(estimate.residualMl.max).toBeGreaterThan(estimate.residualMl.min);
  });

  it('maps every labelled dose to its labelled volume without rounding clicks to integers', () => {
    win.__mounjaroPens.forEach(pen => {
      const result = win.__mounjaroCalc(pen.doseMg, 'mg', pen.doseMg);
      expect(result.ml).toBeCloseTo(pen.doseMl, 6);
      expect(result.mg).toBeCloseTo(pen.doseMg, 6);
    });
    expect(win.__mounjaroCalc(5, 'mg', 1.234).clicks).not.toBe(Math.round(win.__mounjaroCalc(5, 'mg', 1.234).clicks));
  });
});

describe('Mounjaro calculator safety presentation', () => {
  it('keeps source and safety metadata visible before input', async () => {
    const dom = await loadCalculator();
    const text = dom.window.document.getElementById('calc-body').textContent;

    expect(text).toContain('適用市場');
    expect(text).toContain('MOUNJARO KwikPen');
    expect(text).toContain('來源');
    expect(text).toContain('最後查核日：2026-07-31');
    expect(text).toContain('醫療人員限定');
    expect(text).toContain('非病人自我操作指引');
    expect(text).toContain('分抽');
    expect(text).toContain('喀噠');
    expect(text).toContain('殘液');
    expect(text).toContain('每次換新針');
    expect(text).toContain('sterility');
    expect(text).toContain('開封後');
    expect(text).toContain('off-label');
  });

  it('uses neutral equivalence wording in a result', async () => {
    const dom = await loadCalculator();
    const doc = dom.window.document;
    doc.querySelector('#calc-body .seg button').click();
    const input = doc.querySelector('[data-mj-field="mg"]');
    input.value = '2.5';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    const resultText = doc.getElementById('calc-result').textContent;
    expect(resultText).toContain('理論約略喀噠值');
    expect(resultText).toContain('體積');
    expect(resultText).not.toContain('抽取');
    expect(resultText).not.toContain('給藥');
    expect(resultText).not.toContain('=');
  });

  it('does not render a normal result when the selected source becomes unavailable', async () => {
    const dom = await loadCalculator();
    const doc = dom.window.document;
    doc.querySelector('#calc-body .seg button').click();
    dom.window.__mounjaroPens[0].source.url = '';
    const input = doc.querySelector('[data-mj-field="mg"]');
    input.value = '1';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    expect(doc.querySelector('#calc-result .result-value')).toBeNull();
    expect(doc.getElementById('calc-result').textContent).toContain('已停止一般成功結果');
  });
});
