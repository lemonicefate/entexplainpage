import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf-8');

function createDOM() {
  return new JSDOM(htmlContent, {
    url: 'http://localhost/',
    pretendToBeVisual: true
  });
}

describe('Home view', () => {
  let dom, document;

  beforeEach(() => {
    dom = createDOM();
    document = dom.window.document;
  });

  it('home-view is the active view by default', () => {
    const homeView = document.getElementById('home-view');
    expect(homeView.classList.contains('active')).toBe(true);
  });

  it('slide-view and calc-view are hidden by default', () => {
    expect(document.getElementById('slide-view').classList.contains('active')).toBe(false);
    expect(document.getElementById('calc-view').classList.contains('active')).toBe(false);
  });

  it('renders skeleton cards while loading', () => {
    const skeletons = document.querySelectorAll('.card.skeleton');
    expect(skeletons.length).toBe(3);
  });

  it('grid empty / error states are hidden by default', () => {
    expect(document.getElementById('grid-empty').hidden).toBe(true);
    expect(document.getElementById('grid-error').hidden).toBe(true);
  });

  it('search input exists with ARIA label', () => {
    const search = document.getElementById('search-input');
    expect(search).not.toBeNull();
    expect(search.getAttribute('aria-label')).toBe('搜尋');
  });

  it('filter chips container has tablist role', () => {
    const chips = document.getElementById('filter-chips');
    expect(chips).not.toBeNull();
    expect(chips.getAttribute('role')).toBe('tablist');
  });
});

describe('Slide player structure', () => {
  let dom, document;

  beforeEach(() => {
    dom = createDOM();
    document = dom.window.document;
  });

  it('back button has aria-label', () => {
    const backBtn = document.getElementById('back-btn');
    expect(backBtn).not.toBeNull();
    expect(backBtn.getAttribute('aria-label')).toBe('返回列表');
  });

  it('step indicator has aria-live', () => {
    const indicator = document.getElementById('step-indicator');
    expect(indicator.getAttribute('aria-live')).toBe('polite');
  });

  it('prev/next buttons have aria-labels', () => {
    expect(document.getElementById('prev-btn').getAttribute('aria-label')).toBe('上一頁');
    expect(document.getElementById('next-btn').getAttribute('aria-label')).toBe('下一頁');
  });

  it('slide-view has region role and label', () => {
    const slideView = document.getElementById('slide-view');
    expect(slideView.getAttribute('role')).toBe('region');
    expect(slideView.getAttribute('aria-label')).toBe('衛教投影片播放器');
  });

  it('end screen, banners hidden by default', () => {
    expect(document.getElementById('end-screen').hidden).toBe(true);
    expect(document.getElementById('offline-banner').hidden).toBe(true);
    expect(document.getElementById('update-banner').hidden).toBe(true);
  });

  it('player tools are present', () => {
    expect(document.getElementById('tool-pen')).not.toBeNull();
    expect(document.getElementById('tool-spot')).not.toBeNull();
    expect(document.getElementById('tool-laser')).not.toBeNull();
    expect(document.getElementById('thumb-strip')).not.toBeNull();
  });
});

describe('Reader mode (tap zones + scrubber + install hint)', () => {
  let dom, document;

  beforeEach(() => {
    dom = createDOM();
    document = dom.window.document;
  });

  it('three tap zones exist with labels inside slide-stage', () => {
    const zones = document.querySelectorAll('#slide-stage #tap-zones .tap-zone');
    expect(zones.length).toBe(3);
    expect(document.getElementById('tap-prev').getAttribute('aria-label')).toBe('上一頁');
    expect(document.getElementById('tap-toggle').getAttribute('aria-label')).toBe('切換工具列');
    expect(document.getElementById('tap-next').getAttribute('aria-label')).toBe('下一頁');
  });

  it('scrubber exists with range input and aria-live label', () => {
    const wrap = document.getElementById('scrubber-wrap');
    const input = document.getElementById('scrubber');
    const label = document.getElementById('scrubber-label');
    expect(wrap).not.toBeNull();
    expect(input).not.toBeNull();
    expect(input.getAttribute('type')).toBe('range');
    expect(input.getAttribute('aria-label')).toBe('跳至指定頁');
    expect(label.getAttribute('aria-live')).toBe('polite');
  });

  it('install hint banner is in DOM, hidden by default', () => {
    const hint = document.getElementById('install-hint');
    const closeBtn = document.getElementById('install-hint-close');
    expect(hint).not.toBeNull();
    expect(hint.hidden).toBe(true);
    expect(closeBtn).not.toBeNull();
    expect(closeBtn.getAttribute('aria-label')).toBe('關閉提示');
  });
});

describe('Tools (pen canvas + spot + laser)', () => {
  let dom, document;

  beforeEach(() => {
    dom = createDOM();
    document = dom.window.document;
  });

  it('pen canvas exists inside slide-stage', () => {
    const canvas = document.querySelector('#slide-stage canvas#pen-canvas');
    expect(canvas).not.toBeNull();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('pen canvas has aria-hidden (decorative drawing surface)', () => {
    const canvas = document.getElementById('pen-canvas');
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });

  it('laser-dot and spot-overlay still exist', () => {
    expect(document.getElementById('laser-dot')).not.toBeNull();
    expect(document.getElementById('spot-overlay')).not.toBeNull();
  });
});

describe('Tool CSS (pen + spot + laser)', () => {
  let cssContent;

  beforeEach(() => {
    cssContent = fs.readFileSync(path.resolve(__dirname, '../../css/style.css'), 'utf-8');
  });

  it('pen-canvas has touch-action none (drawing must not pan page)', () => {
    expect(cssContent).toMatch(/\.pen-canvas[\s\S]*?touch-action:\s*none/);
  });

  it('stage in tool modes disables touch-action (blocks browser pan)', () => {
    expect(cssContent).toMatch(/player-stage\.tool-[a-z]+[\s\S]*?touch-action:\s*none/);
  });

  it('spot-overlay uses responsive radius (clamp) and a plateau', () => {
    expect(cssContent).toMatch(/spot-overlay[\s\S]*?clamp\(\s*180px/);
    // transparent 40% marks the plateau edge, not 0→dark
    expect(cssContent).toMatch(/spot-overlay[\s\S]*?transparent\s+40%/);
  });
});

describe('Reader mode CSS tokens + rules', () => {
  let cssContent;

  beforeEach(() => {
    cssContent = fs.readFileSync(path.resolve(__dirname, '../../css/style.css'), 'utf-8');
  });

  it('defines --chrome-fade transition token', () => {
    expect(cssContent).toContain('--chrome-fade:');
  });

  it('slide-view uses 100dvh with 100vh fallback', () => {
    expect(cssContent).toMatch(/height:\s*100vh/);
    expect(cssContent).toMatch(/height:\s*100dvh/);
  });

  it('has is-immersive rules that fade chrome', () => {
    expect(cssContent).toContain('.is-immersive');
    expect(cssContent).toMatch(/is-immersive[^{]*\.player-controls/);
  });

  it('scrubber is hidden by default, shown on mobile (@media max-width 768px)', () => {
    // default: display none
    expect(cssContent).toMatch(/\.player-scrubber\s*\{[^}]*display:\s*none/);
    // media query shows it
    expect(cssContent).toMatch(/max-width:\s*768px[\s\S]*?\.player-scrubber\s*\{\s*display:\s*flex/);
  });
});

describe('Calculator view structure', () => {
  let dom, document;

  beforeEach(() => {
    dom = createDOM();
    document = dom.window.document;
  });

  it('calc-view has region role and label', () => {
    const v = document.getElementById('calc-view');
    expect(v.getAttribute('role')).toBe('region');
    expect(v.getAttribute('aria-label')).toBe('醫學計算機');
  });

  it('calc back button and tab list exist', () => {
    expect(document.getElementById('calc-back')).not.toBeNull();
    expect(document.getElementById('calc-tabs').getAttribute('role')).toBe('tablist');
    expect(document.getElementById('calc-body')).not.toBeNull();
  });
});

describe('CSS design tokens (Warm Teal × Peach)', () => {
  let cssContent;

  beforeEach(() => {
    cssContent = fs.readFileSync(path.resolve(__dirname, '../../css/style.css'), 'utf-8');
  });

  it('uses brand teal and deep navy tokens', () => {
    expect(cssContent).toContain('--teal:');
    expect(cssContent).toContain('#0e7c7b');
    expect(cssContent).toContain('--fg:');
    expect(cssContent).toContain('#0f2a42');
  });

  it('uses Noto Sans TC and Instrument Serif', () => {
    expect(cssContent).toContain('Noto Sans TC');
    expect(cssContent).toContain('Instrument Serif');
  });

  it('does not use outline:none (a11y)', () => {
    expect(cssContent).not.toMatch(/outline:\s*none/);
  });

  it('defines responsive breakpoints', () => {
    expect(cssContent).toContain('max-width: 1024px');
    expect(cssContent).toContain('max-width: 768px');
    expect(cssContent).toContain('max-width: 480px');
  });

  it('declares core design tokens in :root', () => {
    const required = [
      '--fg', '--teal', '--teal-2', '--bg', '--muted',
      '--ink', '--ink-2', '--ink-3',
      '--surface', '--line', '--line-strong',
      '--peach', '--gold',
      '--player-bg',
      '--ok-fg', '--ok-bg', '--warn-fg', '--warn-bg', '--danger-fg', '--danger-bg',
      '--tag-explain-bg', '--tag-surgery-bg', '--tag-calc-bg',
      '--font', '--font-serif', '--font-mono',
      '--r', '--r-md', '--r-pill',
      '--shadow-card', '--shadow-hover',
      '--t', '--t-fast'
    ];
    required.forEach(t => {
      expect(cssContent).toContain(t + ':');
    });
  });
});

describe('Procedure JSON schema', () => {
  it('index.json has valid structure with categories', () => {
    const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../procedures/index.json'), 'utf-8'));
    expect(Array.isArray(index.categories)).toBe(true);
    index.categories.forEach(cat => {
      expect(cat.id).toBeDefined();
      expect(cat.title).toBeDefined();
    });
    expect(Array.isArray(index.procedures)).toBe(true);
    index.procedures.forEach(proc => {
      expect(proc.id).toBeDefined();
      expect(proc.title).toBeDefined();
      expect(proc.thumbnail).toBeDefined();
      expect(proc.category).toBeDefined();
      expect(proc.type).toBeDefined();        // new field
    });
  });

  it('has the four clinic categories', () => {
    const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../procedures/index.json'), 'utf-8'));
    const ids = index.categories.map(c => c.id);
    ['surgery', 'ent', 'weight', 'functional'].forEach(id => expect(ids).toContain(id));
  });

  it('each procedure references a valid category', () => {
    const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../procedures/index.json'), 'utf-8'));
    const ids = index.categories.map(c => c.id);
    index.procedures.forEach(proc => expect(ids).toContain(proc.category));
  });

  it('each procedure JSON has valid steps', () => {
    const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../procedures/index.json'), 'utf-8'));
    index.procedures.forEach(proc => {
      const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../procedures/' + proc.id + '.json'), 'utf-8'));
      expect(data.id).toBe(proc.id);
      expect(data.title).toBeDefined();
      expect(Array.isArray(data.steps)).toBe(true);
      expect(data.steps.length).toBeGreaterThan(0);
      data.steps.forEach(step => {
        expect(step.image).toBeDefined();
        expect(step.title).toBeDefined();
        expect(step.description).toBeDefined();
        expect(step.alt).toBeDefined();
      });
    });
  });
});

describe('Service worker', () => {
  let swContent;

  beforeEach(() => {
    swContent = fs.readFileSync(path.resolve(__dirname, '../../sw.js'), 'utf-8');
  });

  it('precaches core resources (relative paths for project-site scope)', () => {
    expect(swContent).toContain('./index.html');
    expect(swContent).toContain('./css/style.css');
    expect(swContent).toContain('./js/app.js');
    expect(swContent).toContain('./procedures/index.json');
  });

  it('does not use absolute paths in PRECACHE (would 404 on GitHub Pages project site)', () => {
    expect(swContent).not.toMatch(/['"]\/index\.html['"]/);
    expect(swContent).not.toMatch(/['"]\/css\/style\.css['"]/);
    expect(swContent).not.toMatch(/['"]\/js\/app\.js['"]/);
  });

  it('uses cache-first strategy', () => {
    expect(swContent).toContain('caches.match');
  });

  it('cleans up old caches on activate', () => {
    expect(swContent).toContain('caches.keys');
    expect(swContent).toContain('caches.delete');
  });
});

describe('PWA manifest', () => {
  let manifest;

  beforeEach(() => {
    manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../manifest.json'), 'utf-8'));
  });

  it('valid manifest.json with new theme', () => {
    expect(manifest.name).toBe('診間解說 · Explain');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('zh-TW');
    expect(manifest.theme_color).toBe('#0e7c7b');
  });

  it('uses relative start_url and scope (project-site compatible)', () => {
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
  });
});
