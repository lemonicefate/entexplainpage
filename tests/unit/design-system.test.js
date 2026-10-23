import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Static design-system guards for the impeccable critique P2 fixes:
// print stylesheet, small-text token contrast (DESIGN.md §9 AA), and
// admin.html staying aligned with DESIGN.md §1 instead of drifting.

const root = path.resolve(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf-8');
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf-8');
const design = fs.readFileSync(path.join(root, 'DESIGN.md'), 'utf-8');

function tokenIn(text, name) {
  const m = text.match(new RegExp(name.replace(/-/g, '\\-') + ':\\s*(#[0-9a-fA-F]{6})'));
  return m ? m[1].toLowerCase() : null;
}

function designToken(name) {
  const m = design.match(new RegExp('\\|\\s*`' + name + '`\\s*\\|\\s*`(#[0-9a-fA-F]{6})`'));
  return m ? m[1].toLowerCase() : null;
}

function luminance(hex) {
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(hex.slice(1 + i, 3 + i), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('Print stylesheet (critique P2)', () => {
  const printCss = css.slice(css.indexOf('@media print'));

  it('exists and keeps only the result card', () => {
    expect(css).toContain('@media print');
    expect(printCss).toContain('.result-card');
    expect(printCss).toContain('break-inside: avoid');
  });

  it('hides input card, tabs, topbar and banners', () => {
    expect(printCss).toContain('.calc-tabs');
    expect(printCss).toContain('.calc-topbar');
    expect(printCss).toContain('.banner');
    expect(printCss).toMatch(/display:\s*none/);
  });

  it('keeps the pen source panel from inside the input card', () => {
    expect(printCss).toContain('.calc-card > *:not(.pen-source-panel)');
    expect(printCss).toContain('.pen-source-panel');
  });
});

describe('Small-text token contrast (DESIGN.md §9 AA 4.5:1)', () => {
  const tint1 = tokenIn(css, '--tint-1');

  it('--ink-3 passes AA on white and on --tint-1', () => {
    const ink3 = tokenIn(css, '--ink-3');
    expect(contrastRatio(ink3, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink3, tint1)).toBeGreaterThanOrEqual(4.5);
  });

  it('--teal-2 passes AA on white and on --tint-1', () => {
    const teal2 = tokenIn(css, '--teal-2');
    expect(contrastRatio(teal2, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(teal2, tint1)).toBeGreaterThanOrEqual(4.5);
  });

  it('DESIGN.md token table matches style.css values', () => {
    expect(designToken('--ink-3')).toBe(tokenIn(css, '--ink-3'));
    expect(designToken('--teal-2')).toBe(tokenIn(css, '--teal-2'));
  });
});

describe('Admin design-system alignment (critique P2)', () => {
  it('admin token values mirror DESIGN.md §1', () => {
    const pairs = [
      ['--accent', '--teal'],
      ['--accent-hover', '--teal-deep'],
      ['--bg-dark', '--fg'],
      ['--bg-muted', '--tint-2'],
      ['--text-muted', '--muted'],
      ['--text-disabled', '--ink-3'],
      ['--border-light', '--line'],
      ['--gold', '--gold'],
    ];
    pairs.forEach(([adminName, designName]) => {
      expect(tokenIn(admin, adminName)).toBe(designToken(designName));
    });
    // Semantic colors live in style.css :root (DESIGN.md §2 lists them as
    // the `danger` verdict row rather than --danger-* table entries).
    expect(tokenIn(admin, '--danger')).toBe(tokenIn(css, '--danger-fg'));
    expect(tokenIn(admin, '--danger-bg')).toBe(tokenIn(css, '--danger-bg'));
  });

  it('uses the gold focus ring instead of outline:none + border recolor', () => {
    expect(admin).not.toMatch(/outline:\s*none/);
    expect(admin).toContain('outline: 2px solid var(--gold)');
  });

  it('preview follows the player skeleton (topbar title, image, caption below)', () => {
    expect(admin).not.toContain('preview-overlay');
    expect(admin).toContain('preview-topbar');
    expect(admin).toContain('preview-caption');
    const titleAt = admin.indexOf('id="previewStepTitle"');
    const imageAt = admin.indexOf('id="previewViewport"');
    const descAt = admin.indexOf('id="previewStepDesc"');
    expect(titleAt).toBeGreaterThan(-1);
    expect(titleAt).toBeLessThan(imageAt);
    expect(descAt).toBeGreaterThan(imageAt);
  });
});
