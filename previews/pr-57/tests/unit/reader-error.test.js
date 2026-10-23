import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Critique P1: Reader failures used to bounce the user home silently, the
// player tools were unlabelled 40px icons, chrome auto-hide took the back
// button with it, and the tap zones had no first-run explanation.

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf-8');
const sessionSrc = fs.readFileSync(path.resolve(__dirname, '../../js/reader-session.js'), 'utf-8');
const calculatorsSrc = fs.readFileSync(path.resolve(__dirname, '../../js/calculators.js'), 'utf-8');
const appSrc = fs.readFileSync(path.resolve(__dirname, '../../js/app.js'), 'utf-8');
const cssContent = fs.readFileSync(path.resolve(__dirname, '../../css/style.css'), 'utf-8');

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function settle() {
  await flush(); await flush(); await flush(); await flush();
}

function createApp(hash, procedureFetch) {
  const indexData = {
    categories: [{ id: 'ent', title: '耳鼻喉' }],
    procedures: [
      { id: 'a', title: 'A', type: 'explain', category: 'ent', thumbnail: 'a.webp' },
      { id: 'b', title: 'B', type: 'explain', category: 'ent', thumbnail: 'b.webp' }
    ]
  };
  const dom = new JSDOM(
    htmlContent.replace('</body>', `<script>${sessionSrc}</script><script>${calculatorsSrc}</script><script>${appSrc}</script></body>`),
    {
      url: 'http://localhost/' + (hash || ''),
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      beforeParse(window) {
        window.scrollTo = () => {};
        window.fetch = url => {
          if (url === 'procedures/index.json') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(indexData) });
          }
          const id = url.match(/procedures\/(.+)\.json$/)[1];
          return procedureFetch(id);
        };
        Object.defineProperty(window.navigator, 'serviceWorker', {
          value: { register: () => Promise.resolve({ addEventListener: () => {} }) },
          configurable: true
        });
      }
    }
  );
  return new Promise(resolve => {
    dom.window.addEventListener('load', () => setTimeout(() => resolve(dom), 0));
  });
}

function okProcedure(id) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ id, steps: [{ title: id.toUpperCase() + ' step' }] })
  });
}

describe('Reader error state (critique P1)', () => {
  it('shows an error state in the player instead of bouncing home silently', async () => {
    const dom = await createApp('#/a', () => Promise.reject(new Error('network down')));
    await settle();
    const document = dom.window.document;

    expect(document.getElementById('slide-view').classList.contains('active')).toBe(true);
    expect(document.getElementById('home-view').classList.contains('active')).toBe(false);
    expect(document.getElementById('reader-loading').hidden).toBe(true);
    expect(document.getElementById('reader-error').hidden).toBe(false);
    expect(document.getElementById('reader-error-title').textContent).toContain('A');
    expect(document.getElementById('reader-error-title').textContent).toContain('載入失敗');
  });

  it('retry reloads the same procedure and enters the reader on success', async () => {
    let calls = 0;
    const dom = await createApp('#/a', id => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('network down')) : okProcedure(id);
    });
    await settle();
    const document = dom.window.document;
    expect(document.getElementById('reader-error').hidden).toBe(false);

    document.getElementById('reader-error-retry').click();
    await settle();

    expect(calls).toBe(2);
    expect(document.getElementById('reader-error').hidden).toBe(true);
    expect(document.getElementById('player-title').textContent).toBe('A');
    expect(document.getElementById('step-indicator').textContent).toContain('01 / 01');
  });

  it('the error state back button returns home', async () => {
    const dom = await createApp('#/a', () => Promise.reject(new Error('network down')));
    await settle();
    const document = dom.window.document;

    document.getElementById('reader-error-back').click();
    await settle();

    expect(document.getElementById('home-view').classList.contains('active')).toBe(true);
    expect(document.getElementById('slide-view').classList.contains('active')).toBe(false);
  });

  it('an unknown hash lands home with a visible notice, not silence', async () => {
    const dom = await createApp('#/nope', okProcedure);
    await settle();
    const document = dom.window.document;

    expect(document.getElementById('home-view').classList.contains('active')).toBe(true);
    expect(document.getElementById('home-notice').hidden).toBe(false);
    expect(document.getElementById('home-notice-text').textContent).toContain('找不到');

    document.getElementById('home-notice-close').click();
    expect(document.getElementById('home-notice').hidden).toBe(true);
  });
});

describe('Tap-zone hint (critique P1)', () => {
  it('shows once on the first reader visit and stays dismissed afterwards', async () => {
    const dom = await createApp('#/a', okProcedure);
    await settle();
    const document = dom.window.document;

    expect(document.getElementById('tap-hint').hidden).toBe(false);
    expect(document.getElementById('tap-hint').textContent).toContain('上一頁');
    expect(document.getElementById('tap-hint').textContent).toContain('下一頁');

    document.getElementById('tap-hint-close').click();
    expect(document.getElementById('tap-hint').hidden).toBe(true);
    expect(dom.window.localStorage.getItem('reader_tap_hint_seen')).toBe('1');

    dom.window.location.hash = '';
    await settle();
    dom.window.location.hash = '#/a';
    await settle();
    expect(document.getElementById('player-title').textContent).toBe('A');
    expect(document.getElementById('tap-hint').hidden).toBe(true);
  });
});

describe('Player tool discoverability (critique P1)', () => {
  it('every tool button carries a visible text label', async () => {
    const dom = await createApp('', okProcedure);
    const document = dom.window.document;
    const labels = Array.from(document.querySelectorAll('.tool .tool-label')).map(n => n.textContent);
    expect(labels).toEqual(['畫筆', '聚光燈', '雷射', '退出']);
  });

  it('tool buttons meet the 44px touch target in CSS', () => {
    const toolRule = cssContent.match(/\.tool\s*\{[^}]*\}/)[0];
    expect(toolRule).toMatch(/min-width:\s*44px/);
    expect(toolRule).toMatch(/height:\s*(4[4-9]|[5-9]\d)px/);
    expect(cssContent).toMatch(/\.tool-label\s*\{/);
  });

  it('immersive chrome hiding never takes the back button with it', () => {
    expect(cssContent).not.toMatch(/#slide-view\.is-immersive\s+\.player-back\s*\{[^}]*opacity:\s*0/);
    // The rest of the chrome still fades.
    expect(cssContent).toMatch(/is-immersive[^{]*\.player-controls/);
  });
});
