import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf-8');
const sessionSrc = fs.readFileSync(path.resolve(__dirname, '../../../js/reader-session.js'), 'utf-8');
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
  const dom = new JSDOM(htmlContent.replace('</body>', `<script>${sessionSrc}</script><script>${appSrc}</script></body>`), {
    url: 'http://localhost/#/calc/wegovy',
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

describe('Wegovy labelled specification safety baseline', () => {
  let win;

  beforeEach(() => {
    win = loadHelperWindow();
  });

  it('contains five traceable FlexTouch specifications', () => {
    expect(win.__wegovyPens).toHaveLength(5);
    expect(win.__wegovyPens.map(pen => [pen.doseMg, pen.totalMg, pen.totalMl, pen.labeledDoses, pen.doseMl])).toEqual([
      [0.25, 1, 1.5, 4, 0.375],
      [0.5, 2, 1.5, 4, 0.375],
      [1, 4, 3, 4, 0.75],
      [1.7, 6.8, 3, 4, 0.75],
      [2.4, 9.6, 3, 4, 0.75]
    ]);
    win.__wegovyPens.forEach(pen => {
      expect(pen.source).toMatchObject({
        market: expect.any(String),
        penType: expect.stringContaining('FlexTouch'),
        url: expect.stringMatching(/^https:\/\//),
        revision: expect.any(String),
        lastChecked: '2026-07-31'
      });
    });
  });

  it('fails closed when a labelled specification loses its source', () => {
    const pen = win.__wegovyPens[0];
    const originalDate = pen.source.lastChecked;
    pen.source.lastChecked = '';
    expect(win.__wegovyCalc(0.25, 'mg', 0.25)).toEqual({ mg: 0, ml: 0, clicks: 0, units: 0 });
    pen.source.lastChecked = originalDate;
  });

  it('fails closed when source revision metadata is missing', () => {
    const pen = win.__wegovyPens[0];
    const originalRevision = pen.source.revision;
    pen.source.revision = '';
    expect(win.__wegovyCalc(0.25, 'mg', 0.25)).toEqual({ mg: 0, ml: 0, clicks: 0, units: 0 });
    pen.source.revision = originalRevision;
  });

  it('keeps click conversion explicitly outside the labelled facts', () => {
    const estimate = win.__wegovyPens[0].estimates;
    expect(estimate.official).toBe(false);
    expect(estimate.clickVolumeMl).toBeGreaterThan(0);
  });

  it('maps every labelled dose to its labelled volume without rounding clicks to integers', () => {
    win.__wegovyPens.forEach(pen => {
      const result = win.__wegovyCalc(pen.doseMg, 'mg', pen.doseMg);
      expect(result.ml).toBeCloseTo(pen.doseMl, 6);
      expect(result.mg).toBeCloseTo(pen.doseMg, 6);
    });
    const estimate = win.__wegovyCalc(1.7, 'mg', 0.37).clicks;
    expect(estimate).not.toBe(Math.round(estimate));
  });
});

describe('Wegovy calculator safety presentation', () => {
  it('keeps source and safety metadata visible before input', async () => {
    const dom = await loadCalculator();
    const text = dom.window.document.getElementById('calc-body').textContent;

    expect(text).toContain('適用市場');
    expect(text).toContain('Wegovy FlexTouch');
    expect(text).toContain('來源');
    expect(text).toContain('最後查核日：2026-07-31');
    expect(text).toContain('醫療人員限定');
    expect(text).toContain('非病人自我操作指引');
    expect(text).toContain('分抽');
    expect(text).toContain('不以喀噠數作為標準');
    expect(text).toContain('殘液');
    expect(text).toContain('每次換新針');
    expect(text).toContain('開封後');
    expect(text).toContain('off-label');
  });
});
