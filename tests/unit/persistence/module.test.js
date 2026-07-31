import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPersistenceModule, ConflictError, ValidationError, SimulatedCrashError } from '../../../persistence/index.js';

function makeRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'entexplain-module-'));
  fs.mkdirSync(path.join(root, 'procedures'), { recursive: true });
  fs.mkdirSync(path.join(root, 'images'), { recursive: true });
  fs.writeFileSync(path.join(root, 'procedures', 'index.json'), JSON.stringify({
    categories: [{ id: 'ent', title: 'ENT' }, { id: 'supplements', title: 'Supplements' }],
    procedures: [],
  }, null, 2));
  return root;
}

function upload(name, content = name) {
  return { kind: 'upload', filename: name, contentType: 'image/png', data: Buffer.from(content) };
}

function content(id = 'new-guide') {
  return {
    id,
    title: 'New guide',
    type: 'explain',
    subtitle: 'A subtitle',
    region: 'Head',
    category: 'ent',
    categories: ['ent'],
    steps: [{ title: 'First step', description: 'Explain it', alt: 'First step image' }],
  };
}

describe('persistence Module Interface', () => {
  it('creates a complete guide with one commit and returns opaque asset handles', async () => {
    const root = makeRepository();
    const repository = createPersistenceModule({ rootDir: root });

    const receipt = await repository.commit({
      operation: 'create',
      content: content(),
      assets: { steps: [upload('step.png')] },
    });
    const read = await repository.read('new-guide');

    expect(receipt.operation).toBe('create');
    expect(receipt.id).toBe('new-guide');
    expect(receipt.revision).toEqual(expect.any(String));
    expect(read.procedure).toMatchObject({
      id: 'new-guide', title: 'New guide', category: 'ent', categories: ['ent'],
      thumbnail: expect.any(Object),
    });
    expect(read.assets.thumbnail.handle).toEqual(expect.any(String));
    expect(read.assets.steps[0].handle).toEqual(expect.any(String));
    expect(read.assets.steps[0].handle).not.toContain('images/');
    expect(fs.existsSync(path.join(root, 'procedures', 'new-guide.json'))).toBe(true);
    expect(repository.inspect().ok).toBe(true);
  });

  it('validates all fields before mutating the repository', async () => {
    const root = makeRepository();
    const before = fs.readFileSync(path.join(root, 'procedures', 'index.json'), 'utf8');
    const repository = createPersistenceModule({ rootDir: root });

    await expect(repository.commit({
      operation: 'create',
      content: { ...content(), id: '../escape', steps: [{ title: '', description: '', alt: '' }] },
      assets: { steps: [upload('step.png')] },
    })).rejects.toBeInstanceOf(ValidationError);

    expect(fs.readFileSync(path.join(root, 'procedures', 'index.json'), 'utf8')).toBe(before);
    expect(fs.readdirSync(path.join(root, 'procedures'))).toEqual(['index.json']);
  });

  it('rejects a stale replace and keeps the latest content', async () => {
    const root = makeRepository();
    const repository = createPersistenceModule({ rootDir: root });
    await repository.commit({ operation: 'create', content: content(), assets: { steps: [upload('step.png')] } });
    const first = await repository.read('new-guide');

    await repository.commit({
      operation: 'replace',
      id: 'new-guide',
      revision: first.revision,
      content: { ...content(), title: 'Updated once' },
      assets: { thumbnail: first.assets.thumbnail, steps: [first.assets.steps[0]] },
    });

    await expect(repository.commit({
      operation: 'replace',
      id: 'new-guide',
      revision: first.revision,
      content: { ...content(), title: 'Stale write' },
      assets: { thumbnail: first.assets.thumbnail, steps: [first.assets.steps[0]] },
    })).rejects.toBeInstanceOf(ConflictError);
    expect((await repository.read('new-guide')).procedure.title).toBe('Updated once');
  });

  it('detects a manual JSON edit as a revision conflict', async () => {
    const root = makeRepository();
    const repository = createPersistenceModule({ rootDir: root });
    await repository.commit({ operation: 'create', content: content(), assets: { steps: [upload('step.png')] } });
    const first = await repository.read('new-guide');
    const detailPath = path.join(root, 'procedures', 'new-guide.json');
    const detail = JSON.parse(fs.readFileSync(detailPath, 'utf8'));
    detail.title = 'Edited by hand';
    fs.writeFileSync(detailPath, JSON.stringify(detail, null, 2));

    await expect(repository.commit({
      operation: 'replace', id: 'new-guide', revision: first.revision,
      content: { ...content(), title: 'Stale admin edit' },
      assets: { thumbnail: first.assets.thumbnail, steps: [first.assets.steps[0]] },
    })).rejects.toBeInstanceOf(ConflictError);
  });

  it('keeps image identity attached to a step when steps are reordered', async () => {
    const root = makeRepository();
    const repository = createPersistenceModule({ rootDir: root });
    const originalContent = {
      ...content(),
      steps: [
        { title: 'A', description: '', alt: 'A image' },
        { title: 'B', description: '', alt: 'B image' },
      ],
    };
    await repository.commit({
      operation: 'create',
      content: originalContent,
      assets: { steps: [upload('a.png', 'asset-A'), upload('b.png', 'asset-B')] },
    });
    const current = await repository.read('new-guide');
    await repository.commit({
      operation: 'replace', id: 'new-guide', revision: current.revision,
      content: { ...originalContent, steps: [originalContent.steps[1], originalContent.steps[0]] },
      assets: { thumbnail: current.assets.thumbnail, steps: [current.assets.steps[1], current.assets.steps[0]] },
    });
    const updated = await repository.read('new-guide');

    expect(updated.procedure.steps.map((step) => step.title)).toEqual(['B', 'A']);
    expect(fs.readFileSync(path.join(root, updated.assets.steps[0].path), 'utf8')).toBe('asset-B');
    expect(fs.readFileSync(path.join(root, updated.assets.steps[1].path), 'utf8')).toBe('asset-A');
  });

  it('deletes detail, index projection, and owned assets as one revision-safe commit', async () => {
    const root = makeRepository();
    const repository = createPersistenceModule({ rootDir: root });
    await repository.commit({ operation: 'create', content: content(), assets: { steps: [upload('step.png')] } });
    const current = await repository.read('new-guide');

    await expect(repository.commit({ operation: 'delete', id: 'new-guide', revision: 'stale' })).rejects.toBeInstanceOf(ConflictError);
    const receipt = await repository.commit({ operation: 'delete', id: 'new-guide', revision: current.revision });

    expect(receipt).toMatchObject({ operation: 'delete', id: 'new-guide', warnings: [] });
    await expect(repository.read('new-guide')).rejects.toThrow(/not found/i);
    expect(fs.existsSync(path.join(root, 'images', 'new-guide'))).toBe(false);
    expect(repository.inspect().ok).toBe(true);
  });

  it('rolls back a failed index promotion and leaves the before state readable', async () => {
    const root = makeRepository();
    const repository = createPersistenceModule({
      rootDir: root,
      faultInjector(operation) {
        if (operation === 'promote-index') throw new Error('index unavailable');
      },
    });

    await expect(repository.commit({ operation: 'create', content: content(), assets: { steps: [upload('step.png')] } }))
      .rejects.toThrow('index unavailable');
    expect(repository.inspect().ok).toBe(true);
    expect(fs.readdirSync(path.join(root, 'procedures'))).toEqual(['index.json']);
    expect(fs.readdirSync(path.join(root, 'images'))).toEqual([]);
  });

  it.each(['stage', 'trash', 'promote-images', 'promote-detail', 'promote-index', 'commit-marker'])
    ('rolls back when the %s phase fails', async (failedPhase) => {
      const root = makeRepository();
      const repository = createPersistenceModule({
        rootDir: root,
        faultInjector(operation) {
          if (operation === failedPhase) throw new Error(`${failedPhase} unavailable`);
        },
      });

      await expect(repository.commit({ operation: 'create', content: content(), assets: { steps: [upload('step.png')] } }))
        .rejects.toThrow(`${failedPhase} unavailable`);
      expect(repository.inspect().ok).toBe(true);
      expect(fs.readFileSync(path.join(root, 'procedures', 'index.json'), 'utf8')).toContain('"procedures": []');
    });

  it('returns success with a cleanup warning after the commit point', async () => {
    const root = makeRepository();
    const repository = createPersistenceModule({
      rootDir: root,
      faultInjector(operation) {
        if (operation === 'cleanup') throw new Error('trash cleanup unavailable');
      },
    });

    const receipt = await repository.commit({ operation: 'create', content: content(), assets: { steps: [upload('step.png')] } });
    expect(receipt.warnings).toEqual([{ code: 'cleanup-pending', message: 'trash cleanup unavailable' }]);
    expect((await repository.read('new-guide')).procedure.title).toBe('New guide');
    expect(repository.inspect().warnings.some((warning) => warning.code === 'orphan-transaction')).toBe(true);
  });

  it('recovers an interrupted pre-commit transaction to before', async () => {
    const root = makeRepository();
    const crashing = createPersistenceModule({
      rootDir: root,
      faultInjector(operation) {
        if (operation === 'after-promote-detail') throw new SimulatedCrashError('power loss');
      },
    });

    await expect(crashing.commit({ operation: 'create', content: content(), assets: { steps: [upload('step.png')] } }))
      .rejects.toBeInstanceOf(SimulatedCrashError);

    const recovered = createPersistenceModule({ rootDir: root });
    await recovered.start();
    await expect(recovered.read('new-guide')).rejects.toThrow(/not found/i);
    expect(recovered.inspect().errors.some((error) => error.code === 'orphan-transaction')).toBe(false);
  });

  it('completes an interrupted post-commit cleanup on startup', async () => {
    const root = makeRepository();
    const crashing = createPersistenceModule({
      rootDir: root,
      faultInjector(operation) {
        if (operation === 'after-commit-marker') throw new SimulatedCrashError('power loss');
      },
    });

    await expect(crashing.commit({ operation: 'create', content: content(), assets: { steps: [upload('step.png')] } }))
      .rejects.toBeInstanceOf(SimulatedCrashError);

    const recovered = createPersistenceModule({ rootDir: root });
    await recovered.start();
    expect((await recovered.read('new-guide')).procedure.title).toBe('New guide');
    expect(recovered.inspect().warnings.some((warning) => warning.code === 'orphan-transaction')).toBe(false);
  });
});
