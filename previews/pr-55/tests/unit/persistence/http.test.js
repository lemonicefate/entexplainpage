import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAdminServer } from '../../../scripts/admin.js';

const servers = [];

function makeRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'entexplain-http-'));
  fs.mkdirSync(path.join(root, 'procedures'), { recursive: true });
  fs.mkdirSync(path.join(root, 'images'), { recursive: true });
  fs.writeFileSync(path.join(root, 'procedures', 'index.json'), JSON.stringify({
    categories: [{ id: 'ent', title: 'ENT' }], procedures: [],
  }));
  return root;
}

async function start(root) {
  const app = createAdminServer({ rootDir: root, port: 0 });
  await app.start();
  servers.push(app.server);
  return `http://127.0.0.1:${app.server.address().port}`;
}

function form({ mime = 'image/png', filename = 'step.png' } = {}) {
  const data = new FormData();
  data.append('payload', JSON.stringify({
    id: 'http-guide', title: 'HTTP guide', type: 'explain', subtitle: '', region: '', category: 'ent', categories: ['ent'],
    steps: [{ assetKey: 'stable-step-id', title: 'One', description: '', alt: 'One image' }],
  }));
  data.append('asset:stable-step-id', new Blob([Buffer.from('image')], { type: mime }), filename);
  return data;
}

afterEach(() => servers.splice(0).forEach((server) => server.close()));

describe('multipart HTTP adapter', () => {
  it('creates through one multipart commit and does not expose the legacy image endpoint', async () => {
    const base = await start(makeRepository());
    const response = await fetch(`${base}/api/procedures`, { method: 'POST', body: form() });

    expect(response.status).toBe(201);
    expect((await response.json()).operation).toBe('create');
    expect((await fetch(`${base}/api/procedures/http-guide`)).status).toBe(200);
    expect((await fetch(`${base}/api/procedures/http-guide/images`, { method: 'POST', body: new FormData() })).status).toBe(404);
  });

  it('maps multipart validation errors to field locations without touching files', async () => {
    const root = makeRepository();
    const base = await start(root);
    const response = await fetch(`${base}/api/procedures`, { method: 'POST', body: form({ mime: 'text/plain' }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('validation-error');
    expect(body.issues.some((issue) => issue.path === 'assets.steps[0].contentType')).toBe(true);
    expect(fs.readdirSync(path.join(root, 'procedures'))).toEqual(['index.json']);
  });
});
