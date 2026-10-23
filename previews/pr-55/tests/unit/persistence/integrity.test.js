import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectRepository, projectIndexEntry } from '../../../persistence/index.js';

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'entexplain-integrity-'));
  fs.mkdirSync(path.join(root, 'procedures'), { recursive: true });
  fs.mkdirSync(path.join(root, 'images', 'guide-a'), { recursive: true });
  fs.mkdirSync(path.join(root, 'images', 'guide-b'), { recursive: true });
  fs.writeFileSync(path.join(root, 'images', 'guide-a', 'thumb.png'), 'thumb-a');
  fs.writeFileSync(path.join(root, 'images', 'guide-a', 'step1.png'), 'step-a');
  fs.writeFileSync(path.join(root, 'images', 'guide-b', 'thumb.png'), 'thumb-b');
  fs.writeFileSync(path.join(root, 'images', 'guide-b', 'step1.png'), 'step-b');

  const detail = {
    id: 'guide-a',
    title: 'Guide A',
    type: 'explain',
    subtitle: 'A subtitle',
    region: 'ENT',
    category: 'ent',
    categories: ['ent'],
    thumbnail: 'images/guide-a/thumb.png',
    steps: [{
      image: 'images/guide-a/step1.png',
      title: 'Step A',
      description: 'Description',
      alt: 'Step A image',
    }],
  };
  fs.writeFileSync(path.join(root, 'procedures', 'guide-a.json'), JSON.stringify(detail, null, 2));
  fs.writeFileSync(path.join(root, 'procedures', 'index.json'), JSON.stringify({
    categories: [{ id: 'ent', title: 'ENT' }],
    procedures: [projectIndexEntry(detail)],
  }, null, 2));
  return root;
}

describe('canonical repository inspection', () => {
  it('accepts the checked-in catalog while surfacing legacy alt warnings', () => {
    const report = inspectRepository(path.resolve(process.cwd()));

    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((diagnostic) => diagnostic.code === 'legacy-empty-alt')).toBe(true);
  });

  it('accepts a consistent detail and its exact index projection', () => {
    const root = makeFixture();

    expect(inspectRepository(root)).toMatchObject({ ok: true, errors: [], warnings: [] });
  });

  it('reports metadata drift, cross-content assets, and empty alt with separate severities', () => {
    const root = makeFixture();
    const detailPath = path.join(root, 'procedures', 'guide-a.json');
    const detail = JSON.parse(fs.readFileSync(detailPath, 'utf8'));
    detail.category = 'functional';
    detail.categories = ['functional'];
    detail.thumbnail = 'images/guide-b/thumb.png';
    detail.steps[0].image = 'images/guide-b/step1.png';
    detail.steps[0].alt = '';
    fs.writeFileSync(detailPath, JSON.stringify(detail, null, 2));

    const before = fs.readFileSync(detailPath, 'utf8');
    const report = inspectRepository(root);
    const after = fs.readFileSync(detailPath, 'utf8');
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code);

    expect(report.ok).toBe(false);
    expect(codes).toContain('metadata-category-drift');
    expect(codes).toContain('cross-content-asset');
    expect(report.warnings.some((diagnostic) => diagnostic.code === 'legacy-empty-alt')).toBe(true);
    expect(before).toBe(after);
  });
});

describe('canonical index projection', () => {
  it('derives slides from steps and retains presentation metadata', () => {
    expect(projectIndexEntry({
      id: 'x',
      title: 'X',
      type: 'surgery',
      subtitle: 'Subtitle',
      region: 'Head',
      category: 'ent',
      categories: ['ent', 'surgery'],
      thumbnail: 'images/x/thumb.webp',
      steps: [{}, {}],
    })).toEqual({
      id: 'x',
      title: 'X',
      type: 'surgery',
      category: 'ent',
      categories: ['ent', 'surgery'],
      subtitle: 'Subtitle',
      region: 'Head',
      slides: 2,
      thumbnail: 'images/x/thumb.webp',
    });
  });
});
