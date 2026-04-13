import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf-8');

function createDOM() {
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost/',
    pretendToBeVisual: true
  });
  return dom;
}

describe('Grid View', () => {
  let dom, document;

  beforeEach(() => {
    dom = createDOM();
    document = dom.window.document;
  });

  it('should have grid-view as the active view by default', () => {
    const gridView = document.getElementById('grid-view');
    expect(gridView.classList.contains('active')).toBe(true);
  });

  it('should have slide-view hidden by default', () => {
    const slideView = document.getElementById('slide-view');
    expect(slideView.classList.contains('active')).toBe(false);
  });

  it('should display skeleton loading cards initially', () => {
    const skeletons = document.querySelectorAll('.card.skeleton');
    expect(skeletons.length).toBe(3);
  });

  it('should have empty state hidden by default', () => {
    const emptyState = document.getElementById('grid-empty');
    expect(emptyState.hidden).toBe(true);
  });

  it('should have error state hidden by default', () => {
    const errorState = document.getElementById('grid-error');
    expect(errorState.hidden).toBe(true);
  });
});

describe('Slide View HTML structure', () => {
  let dom, document;

  beforeEach(() => {
    dom = createDOM();
    document = dom.window.document;
  });

  it('should have a back button with correct aria-label', () => {
    const backBtn = document.getElementById('back-btn');
    expect(backBtn).not.toBeNull();
    expect(backBtn.getAttribute('aria-label')).toBe('返回手術清單');
  });

  it('should have a step indicator with aria-live', () => {
    const indicator = document.getElementById('step-indicator');
    expect(indicator).not.toBeNull();
    expect(indicator.getAttribute('aria-live')).toBe('polite');
  });

  it('should have prev/next buttons with aria-labels', () => {
    const prev = document.getElementById('prev-btn');
    const next = document.getElementById('next-btn');
    expect(prev.getAttribute('aria-label')).toBe('上一步');
    expect(next.getAttribute('aria-label')).toBe('下一步');
  });

  it('should have slide-view with region role and aria-label', () => {
    const slideView = document.getElementById('slide-view');
    expect(slideView.getAttribute('role')).toBe('region');
    expect(slideView.getAttribute('aria-label')).toBe('衛教説明投影片');
  });

  it('should have end screen hidden by default', () => {
    const endScreen = document.getElementById('end-screen');
    expect(endScreen.hidden).toBe(true);
  });

  it('should have offline banner hidden by default', () => {
    const banner = document.getElementById('offline-banner');
    expect(banner.hidden).toBe(true);
  });

  it('should have update banner hidden by default', () => {
    const banner = document.getElementById('update-banner');
    expect(banner.hidden).toBe(true);
  });
});

describe('Category tabs', () => {
  let dom, document;

  beforeEach(() => {
    dom = createDOM();
    document = dom.window.document;
  });

  it('should have category-tabs container with tablist role', () => {
    const tabs = document.getElementById('category-tabs');
    expect(tabs).not.toBeNull();
    expect(tabs.getAttribute('role')).toBe('tablist');
  });

  it('should have "all" tab active by default', () => {
    const allTab = document.querySelector('.tab.active');
    expect(allTab).not.toBeNull();
    expect(allTab.dataset.category).toBe('all');
    expect(allTab.getAttribute('aria-selected')).toBe('true');
  });
});

describe('CSS design tokens', () => {
  let cssContent;

  beforeEach(() => {
    cssContent = fs.readFileSync(path.resolve(__dirname, '../../css/style.css'), 'utf-8');
  });

  it('should use the correct background colors', () => {
    expect(cssContent).toContain('--bg-primary: #FFFFFF');
    expect(cssContent).toContain('--bg-dark: #1A1A1A');
  });

  it('should use the correct accent color', () => {
    expect(cssContent).toContain('--accent: #0077B6');
  });

  it('should use Noto Sans TC as primary font', () => {
    expect(cssContent).toContain('Noto Sans TC');
  });

  it('should define 44px minimum touch targets', () => {
    expect(cssContent).toContain('min-width: 44px');
    expect(cssContent).toContain('min-height: 44px');
  });

  it('should have responsive breakpoints', () => {
    expect(cssContent).toContain('max-width: 1024px');
    expect(cssContent).toContain('max-width: 480px');
  });

  it('should not use outline: none (a11y)', () => {
    expect(cssContent).not.toContain('outline: none');
  });
});

describe('Procedure JSON schema', () => {
  it('index.json should have valid structure with categories', () => {
    const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../procedures/index.json'), 'utf-8'));
    expect(index.categories).toBeDefined();
    expect(Array.isArray(index.categories)).toBe(true);
    index.categories.forEach(cat => {
      expect(cat.id).toBeDefined();
      expect(cat.title).toBeDefined();
    });
    expect(index.procedures).toBeDefined();
    expect(Array.isArray(index.procedures)).toBe(true);
    index.procedures.forEach(proc => {
      expect(proc.id).toBeDefined();
      expect(proc.title).toBeDefined();
      expect(proc.thumbnail).toBeDefined();
      expect(proc.category).toBeDefined();
    });
  });

  it('should have the four clinic categories', () => {
    const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../procedures/index.json'), 'utf-8'));
    const categoryIds = index.categories.map(c => c.id);
    expect(categoryIds).toContain('surgery');
    expect(categoryIds).toContain('ent');
    expect(categoryIds).toContain('weight');
    expect(categoryIds).toContain('functional');
  });

  it('each procedure should reference a valid category', () => {
    const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../procedures/index.json'), 'utf-8'));
    const categoryIds = index.categories.map(c => c.id);
    index.procedures.forEach(proc => {
      expect(categoryIds).toContain(proc.category);
    });
  });

  it('each procedure JSON should have valid steps', () => {
    const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../procedures/index.json'), 'utf-8'));
    index.procedures.forEach(proc => {
      const filePath = path.resolve(__dirname, '../../procedures/' + proc.id + '.json');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
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

describe('Service Worker', () => {
  let swContent;

  beforeEach(() => {
    swContent = fs.readFileSync(path.resolve(__dirname, '../../js/sw.js'), 'utf-8');
  });

  it('should precache core resources', () => {
    expect(swContent).toContain('/index.html');
    expect(swContent).toContain('/css/style.css');
    expect(swContent).toContain('/js/app.js');
    expect(swContent).toContain('/procedures/index.json');
  });

  it('should use cache-first strategy', () => {
    expect(swContent).toContain('caches.match');
  });

  it('should clean up old caches on activate', () => {
    expect(swContent).toContain('caches.keys');
    expect(swContent).toContain('caches.delete');
  });
});

describe('PWA manifest', () => {
  it('should have valid manifest.json', () => {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../manifest.json'), 'utf-8'));
    expect(manifest.name).toBe('手術衛教');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('zh-TW');
    expect(manifest.theme_color).toBe('#0077B6');
  });
});
