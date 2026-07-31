import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf-8');
const appSrc = fs.readFileSync(path.resolve(__dirname, '../../js/app.js'), 'utf-8');

function runApp(hash, fetchImpl) {
  const dom = new JSDOM(htmlContent.replace('</body>', `<script>${appSrc}</script></body>`), {
    url: 'http://localhost/' + (hash || ''),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.fetch = fetchImpl;
      Object.defineProperty(window.navigator, 'serviceWorker', {
        value: { register: () => Promise.resolve({ addEventListener: () => {} }) },
        configurable: true
      });
    }
  });
  return new Promise(resolve => {
    dom.window.addEventListener('load', () => {
      setTimeout(() => resolve(dom), 0);
    });
  });
}

function rejectedFetch() {
  return Promise.reject(new Error('network down'));
}

describe('procedure catalog failure fallback', () => {
  it('keeps calculator cards and shows a recognizable partial-content error', async () => {
    const dom = await runApp('', rejectedFetch);
    const doc = dom.window.document;

    expect(doc.getElementById('grid-error').hidden).toBe(false);
    expect(doc.getElementById('grid-error').textContent).toContain('衛教內容暫時無法載入');
    expect(doc.querySelectorAll('a.card[href^="#/calc/"]').length).toBe(5);
    expect(doc.querySelectorAll('a.card:not([href^="#/calc/"])').length).toBe(0);
  });

  it('disables every procedure when one metadata entry is invalid', async () => {
    const indexData = {
      categories: [{ id: 'ent', title: '耳鼻喉' }],
      procedures: [
        { id: 'good', title: '可用圖卡', type: 'explain', category: 'ent', thumbnail: 'good.png' },
        { id: 'bad', title: '壞圖卡', type: 'explain', category: 'unknown', thumbnail: 'bad.png' }
      ]
    };
    const dom = await runApp('', () => Promise.resolve({ ok: true, json: () => Promise.resolve(indexData) }));
    const doc = dom.window.document;

    expect(doc.getElementById('grid-error').hidden).toBe(false);
    expect(doc.querySelector('a[aria-label="可用圖卡"]')).toBeNull();
    expect(doc.querySelectorAll('a.card[href^="#/calc/"]').length).toBe(5);
  });

  it('keeps a valid direct calculator route during procedure failure', async () => {
    const dom = await runApp('#/calc/wegovy', rejectedFetch);
    const doc = dom.window.document;

    expect(doc.getElementById('calc-view').classList.contains('active')).toBe(true);
    expect(doc.getElementById('calc-body').textContent).toContain('週纖達針劑換算 (Wegovy)');
  });

  it('does not enter Reader for a procedure route after procedure failure', async () => {
    let fetchCalls = 0;
    const dom = await runApp('#/missing', () => {
      fetchCalls++;
      return rejectedFetch();
    });
    const doc = dom.window.document;

    expect(doc.getElementById('home-view').classList.contains('active')).toBe(true);
    expect(doc.getElementById('slide-view').classList.contains('active')).toBe(false);
    expect(fetchCalls).toBe(1);
  });
});
