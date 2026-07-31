'use strict';

const http = require('node:http');
const path = require('node:path');
const { createPersistenceModule, PersistenceError } = require('../persistence');

const PORT = Number(process.env.ADMIN_PORT || 3001);
const ROOT = path.resolve(__dirname, '..');
const SIZE_LIMIT = 50 * 1024 * 1024;

function jsonResponse(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function errorResponse(res, error) {
  const statusCode = error instanceof PersistenceError ? error.statusCode : error.statusCode || 500;
  jsonResponse(res, statusCode, {
    error: error.message || 'Internal server error',
    ...(error.code ? { code: error.code } : {}),
    ...(Array.isArray(error.issues) && error.issues.length ? { issues: error.issues } : {}),
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > SIZE_LIMIT) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (_) { reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 })); }
    });
  });
}

/** Parse one complete multipart request without writing anything to disk. */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
    if (!boundaryMatch) {
      reject(Object.assign(new Error('Missing multipart boundary'), { statusCode: 400 }));
      return;
    }
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const chunks = [];
    let totalSize = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return;
      totalSize += chunk.length;
      if (totalSize > SIZE_LIMIT) {
        rejected = true;
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', (error) => { if (!rejected) reject(error); });
    req.on('end', () => {
      if (rejected) return;
      try {
        const body = Buffer.concat(chunks);
        const firstBoundary = Buffer.from(`--${boundary}`);
        const nextBoundary = Buffer.from(`\r\n--${boundary}`);
        const headerSeparator = Buffer.from('\r\n\r\n');
        const parts = [];
        let position = body.indexOf(firstBoundary);
        if (position < 0) return resolve(parts);
        position += firstBoundary.length;
        while (position < body.length) {
          if (body[position] === 0x2d && body[position + 1] === 0x2d) break;
          if (body[position] === 0x0d && body[position + 1] === 0x0a) position += 2;
          else break;
          const next = body.indexOf(nextBoundary, position);
          if (next < 0) break;
          const part = body.slice(position, next);
          const split = part.indexOf(headerSeparator);
          if (split < 0) { position = next + nextBoundary.length; continue; }
          const headers = {};
          part.slice(0, split).toString('utf8').split('\r\n').forEach((line) => {
            const colon = line.indexOf(':');
            if (colon >= 0) headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
          });
          const disposition = headers['content-disposition'] || '';
          const name = disposition.match(/name="([^"]+)"/i);
          if (name) {
            const filename = disposition.match(/filename="([^"]*)"/i);
            parts.push({
              fieldName: name[1],
              filename: filename ? filename[1] : null,
              contentType: headers['content-type'] || 'text/plain; charset=utf-8',
              data: part.slice(split + headerSeparator.length),
            });
          }
          position = next + nextBoundary.length;
        }
        resolve(parts);
      } catch (error) { reject(error); }
    });
  });
}

function uploadFromPart(part) {
  return { kind: 'upload', filename: part.filename || 'upload', contentType: part.contentType, data: part.data };
}

function parseCommitMultipart(parts, operation, routeId) {
  const payloadPart = parts.find((part) => part.fieldName === 'payload');
  if (!payloadPart) throw Object.assign(new Error('Missing payload field'), { statusCode: 400 });
  let payload;
  try { payload = JSON.parse(payloadPart.data.toString('utf8')); }
  catch (_) { throw Object.assign(new Error('Invalid JSON payload'), { statusCode: 400 }); }
  if (!payload || typeof payload !== 'object') throw Object.assign(new Error('Payload must be an object'), { statusCode: 400 });
  const id = routeId || payload.id;
  if (routeId && payload.id && payload.id !== routeId) throw Object.assign(new Error('Payload id does not match route id'), { statusCode: 400 });
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  const assetsByField = new Map(parts.filter((part) => part.fieldName.startsWith('asset:')).map((part) => [part.fieldName, part]));
  const stepAssets = steps.map((step, index) => {
    const key = step && step.assetKey;
    const part = key ? assetsByField.get(`asset:${key}`) : null;
    if (part) return uploadFromPart(part);
    if (step && step.assetHandle) return { kind: 'existing', handle: step.assetHandle };
    return undefined;
  });
  const thumbnailPart = assetsByField.get('asset:thumbnail');
  const assets = {
    steps: stepAssets,
    ...(thumbnailPart ? { thumbnail: uploadFromPart(thumbnailPart) } : {}),
  };
  if (!thumbnailPart && payload.thumbnailAssetHandle) assets.thumbnail = { kind: 'existing', handle: payload.thumbnailAssetHandle };
  return {
    operation,
    id,
    revision: payload.revision,
    content: {
      id,
      title: payload.title,
      type: payload.type,
      subtitle: payload.subtitle,
      region: payload.region,
      category: payload.category,
      categories: payload.categories,
      steps: steps.map((step) => ({
        title: step.title,
        description: step.description,
        alt: step.alt,
      })),
    },
    assets,
  };
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
    '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  }[ext] || 'application/octet-stream';
}

function createAdminServer(options = {}) {
  const rootDir = path.resolve(options.rootDir || ROOT);
  const repository = options.repository || createPersistenceModule({ rootDir });

  async function handleStatic(req, res, pathname) {
    const decoded = decodeURIComponent(pathname);
    const relative = decoded.replace(/^\/+/, '') || 'index.html';
    const isManaged = relative === 'procedures/index.json' || relative.startsWith('procedures/') || relative.startsWith('images/');
    try {
      const data = await repository.readStatic(relative);
      res.writeHead(200, { 'Content-Type': mimeFor(relative), 'Content-Length': data.length, 'Cache-Control': isManaged ? 'no-store' : 'no-cache' });
      res.end(data);
    } catch (error) { errorResponse(res, error); }
  }

  async function router(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    let url;
    try { url = new URL(req.url, `http://localhost:${PORT}`); }
    catch (_) { jsonResponse(res, 400, { error: 'Invalid URL' }); return; }
    const pathname = url.pathname;
    try {
      if (req.method === 'GET' && pathname === '/api/index') return jsonResponse(res, 200, await repository.list());
      if (req.method === 'GET' && pathname === '/api/inspect') return jsonResponse(res, 200, repository.inspect());
      const procedureMatch = pathname.match(/^\/api\/procedures\/([a-z0-9-]+)$/);
      if (procedureMatch && req.method === 'GET') {
        const record = await repository.read(procedureMatch[1]);
        return jsonResponse(res, 200, { ...record.procedure, revision: record.revision, assets: record.assets });
      }
      if (pathname === '/api/procedures' && req.method === 'POST') {
        const command = parseCommitMultipart(await parseMultipart(req), 'create');
        return jsonResponse(res, 201, await repository.commit(command));
      }
      if (procedureMatch && req.method === 'PUT') {
        const command = parseCommitMultipart(await parseMultipart(req), 'replace', procedureMatch[1]);
        return jsonResponse(res, 200, await repository.commit(command));
      }
      if (procedureMatch && req.method === 'DELETE') {
        const body = await readJsonBody(req);
        return jsonResponse(res, 200, await repository.commit({ operation: 'delete', id: procedureMatch[1], revision: body.revision }));
      }
      if (req.method === 'GET') return handleStatic(req, res, pathname);
      jsonResponse(res, 404, { error: 'Not found' });
    } catch (error) { errorResponse(res, error); }
  }

  const server = http.createServer(router);
  return { server, repository, start: () => repository.start().then(() => new Promise((resolve, reject) => {
    const onError = (error) => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolve(server); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(options.port == null ? PORT : options.port, options.host || '127.0.0.1');
  })) };
}

if (require.main === module) {
  const app = createAdminServer();
  app.start().then(() => {
    console.log(`Main site:    http://localhost:${PORT}/`);
    console.log(`Admin editor: http://localhost:${PORT}/admin.html`);
  }).catch((error) => {
    console.error(`Unable to start admin server: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { createAdminServer, parseMultipart, parseCommitMultipart };
