import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf-8');
const sessionSrc = fs.readFileSync(path.resolve(__dirname, '../../js/reader-session.js'), 'utf-8');
const appSrc = fs.readFileSync(path.resolve(__dirname, '../../js/app.js'), 'utf-8');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function procedureResponse(data) {
  return { ok: true, json: () => Promise.resolve(data) };
}

function createApp(hash, procedureRequests) {
  const indexData = {
    categories: [],
    procedures: [
      { id: 'a', title: 'A', type: 'explain', categories: ['explain'] },
      { id: 'b', title: 'B', type: 'explain', categories: ['explain'] }
    ]
  };
  const dom = new JSDOM(
    htmlContent.replace('</body>', `<script>${sessionSrc}</script><script>${appSrc}</script></body>`),
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
          return procedureRequests[id].promise;
        };
        Object.defineProperty(window.navigator, 'serviceWorker', {
          value: { register: () => Promise.resolve({ addEventListener: () => {} }) },
          configurable: true
        });
      }
    }
  );
  return new Promise(resolve => {
    dom.window.addEventListener('load', () => {
      setTimeout(() => resolve(dom), 0);
    });
  });
}

describe('Reader route transitions', () => {
  it('shows a non-interactive loading reader and cannot be reclaimed after returning home', async () => {
    const request = deferred();
    const dom = await createApp('#/a', { a: request, b: deferred() });
    const document = dom.window.document;

    expect(document.getElementById('slide-view').classList.contains('active')).toBe(true);
    expect(document.getElementById('reader-loading').hidden).toBe(false);
    expect(document.getElementById('slide-view').getAttribute('aria-busy')).toBe('true');
    expect(document.getElementById('next-btn').disabled).toBe(true);
    expect(document.getElementById('tool-pen').disabled).toBe(true);
    expect(document.getElementById('scrubber').disabled).toBe(true);

    dom.window.location.hash = '';
    await flush();
    request.resolve(procedureResponse({ id: 'a', steps: [{ title: 'A step' }] }));
    await flush();
    await flush();

    expect(document.getElementById('home-view').classList.contains('active')).toBe(true);
    expect(document.getElementById('slide-view').classList.contains('active')).toBe(false);
    expect(document.getElementById('slide-view').getAttribute('aria-busy')).toBe('false');
  });

  it('keeps B active when A and B finish in the opposite order', async () => {
    const requests = { a: deferred(), b: deferred() };
    const dom = await createApp('#/a', requests);
    const document = dom.window.document;

    dom.window.location.hash = '#/b';
    await flush();
    expect(document.getElementById('reader-loading').hidden).toBe(false);
    expect(document.getElementById('reader-loading-title').textContent).toBe('B');

    requests.b.resolve(procedureResponse({ id: 'b', steps: [{ title: 'B step' }] }));
    await flush();
    await flush();
    requests.a.resolve(procedureResponse({ id: 'a', steps: [{ title: 'A step' }] }));
    await flush();
    await flush();

    expect(document.getElementById('slide-view').classList.contains('active')).toBe(true);
    expect(document.getElementById('player-title').textContent).toBe('B');
    expect(document.getElementById('player-page-title').textContent).toBe('B step');
  });

  it('keeps the calculator active when a reader request finishes late', async () => {
    const request = deferred();
    const dom = await createApp('#/a', { a: request, b: deferred() });
    const document = dom.window.document;

    dom.window.location.hash = '#/calc/bmi';
    await flush();
    request.resolve(procedureResponse({ id: 'a', steps: [{ title: 'A step' }] }));
    await flush();
    await flush();

    expect(document.getElementById('calc-view').classList.contains('active')).toBe(true);
    expect(document.getElementById('slide-view').classList.contains('active')).toBe(false);
    expect(document.querySelector('.calc-card h3').textContent).toContain('BMI');
  });
});
