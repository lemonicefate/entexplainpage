'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Multipart parser
// ---------------------------------------------------------------------------

/**
 * Parse a multipart/form-data request.
 * Returns Promise<Array<{ fieldName, filename, contentType, data }>>
 */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      return reject(Object.assign(new Error('Missing multipart boundary'), { statusCode: 400 }));
    }
    const boundary = boundaryMatch[1];

    const chunks = [];
    let totalSize = 0;
    const SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB

    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > SIZE_LIMIT) {
        req.destroy();
        return reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
      }
      chunks.push(chunk);
    });

    req.on('error', reject);

    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        const delimiter = Buffer.from('\r\n--' + boundary);
        const firstDelimiter = Buffer.from('--' + boundary);
        const headerSep = Buffer.from('\r\n\r\n');
        const parts = [];

        // Find all delimiter positions
        // Start after the first boundary
        let pos = body.indexOf(firstDelimiter);
        if (pos === -1) return resolve([]);
        pos += firstDelimiter.length;

        while (pos < body.length) {
          // Skip \r\n after boundary
          if (body[pos] === 0x0d && body[pos + 1] === 0x0a) {
            pos += 2;
          } else if (body[pos] === 0x2d && body[pos + 1] === 0x2d) {
            // '--' means epilogue, we're done
            break;
          } else {
            break;
          }

          // Find end of this part (next delimiter)
          const nextDelim = body.indexOf(delimiter, pos);
          if (nextDelim === -1) break;

          const partBuf = body.slice(pos, nextDelim);

          // Find header/body split
          const splitPos = partBuf.indexOf(headerSep);
          if (splitPos === -1) {
            pos = nextDelim + delimiter.length;
            continue;
          }

          const headerStr = partBuf.slice(0, splitPos).toString('utf8');
          const data = partBuf.slice(splitPos + headerSep.length);

          // Parse headers
          const headers = {};
          for (const line of headerStr.split('\r\n')) {
            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) continue;
            const key = line.slice(0, colonIdx).trim().toLowerCase();
            const val = line.slice(colonIdx + 1).trim();
            headers[key] = val;
          }

          // Parse Content-Disposition
          const disposition = headers['content-disposition'] || '';
          const nameMatch = disposition.match(/name="([^"]+)"/);
          const filenameMatch = disposition.match(/filename="([^"]*)"/);
          const fieldName = nameMatch ? nameMatch[1] : null;
          const filename = filenameMatch ? filenameMatch[1] : null;
          const partContentType = headers['content-type'] || 'application/octet-stream';

          if (fieldName) {
            parts.push({ fieldName, filename, contentType: partContentType, data });
          }

          pos = nextDelim + delimiter.length;
        }

        resolve(parts);
      } catch (err) {
        reject(err);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Extension detection
// ---------------------------------------------------------------------------

function extFromContentType(ct) {
  const base = (ct || '').split(';')[0].trim().toLowerCase();
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  return map[base] || '.jpg';
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function handleGetRoot(req, res) {
  const htmlPath = path.join(ROOT, 'admin.html');
  fs.readFile(htmlPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('admin.html not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': data.length,
    });
    res.end(data);
  });
}

function handleGetIndex(req, res) {
  const indexPath = path.join(ROOT, 'procedures', 'index.json');
  try {
    const data = readJsonFile(indexPath);
    jsonResponse(res, 200, data);
  } catch (err) {
    jsonResponse(res, 500, { error: 'Failed to read index.json' });
  }
}

function handleGetProcedure(req, res, id) {
  const filePath = path.join(ROOT, 'procedures', `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return jsonResponse(res, 404, { error: `Procedure "${id}" not found` });
  }
  try {
    const data = readJsonFile(filePath);
    jsonResponse(res, 200, data);
  } catch (err) {
    jsonResponse(res, 500, { error: 'Failed to read procedure file' });
  }
}

function handlePostProcedures(req, res) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      return jsonResponse(res, 400, { error: 'Invalid JSON body' });
    }

    const { id, title, category, steps } = payload;

    // Validate id
    if (!id || !/^[a-z0-9-]+$/.test(id)) {
      return jsonResponse(res, 400, { error: 'Invalid id: must match /^[a-z0-9-]+$/' });
    }
    if (!title) return jsonResponse(res, 400, { error: 'Missing required field: title' });
    if (!category) return jsonResponse(res, 400, { error: 'Missing required field: category' });
    if (!Array.isArray(steps)) return jsonResponse(res, 400, { error: 'Missing required field: steps (array)' });

    const procPath = path.join(ROOT, 'procedures', `${id}.json`);

    // Check conflict
    if (fs.existsSync(procPath)) {
      return jsonResponse(res, 409, { error: `Procedure "${id}" already exists` });
    }

    try {
      // Create images directory
      fs.mkdirSync(path.join(ROOT, 'images', id), { recursive: true });

      // Build procedure JSON
      const procedure = {
        id,
        title,
        steps: steps.map((step, i) => ({
          image: `images/${id}/step${i + 1}.webp`,
          title: step.title || '',
          description: step.description || '',
          alt: step.alt || '',
        })),
      };

      // Write procedure file
      writeJsonFile(procPath, procedure);

      // Update index.json
      const indexPath = path.join(ROOT, 'procedures', 'index.json');
      const index = readJsonFile(indexPath);
      index.procedures.push({
        id,
        title,
        category,
        thumbnail: `images/${id}/thumb.webp`,
      });
      writeJsonFile(indexPath, index);

      jsonResponse(res, 201, procedure);
    } catch (err) {
      jsonResponse(res, 500, { error: err.message || 'Internal server error' });
    }
  });
  req.on('error', () => jsonResponse(res, 500, { error: 'Request error' }));
}

async function handlePostImages(req, res, id) {
  const procPath = path.join(ROOT, 'procedures', `${id}.json`);
  if (!fs.existsSync(procPath)) {
    return jsonResponse(res, 404, { error: `Procedure "${id}" not found` });
  }

  let parts;
  try {
    parts = await parseMultipart(req);
  } catch (err) {
    const status = err.statusCode || 400;
    return jsonResponse(res, status, { error: err.message });
  }

  try {
    const procedure = readJsonFile(procPath);
    const indexPath = path.join(ROOT, 'procedures', 'index.json');
    const index = readJsonFile(indexPath);

    const savedPaths = {};

    for (const part of parts) {
      const { fieldName, contentType, data } = part;
      const ext = extFromContentType(contentType);

      if (fieldName === 'thumb') {
        const thumbPath = path.join(ROOT, 'images', id, `thumb${ext}`);
        fs.writeFileSync(thumbPath, data);
        const relPath = `images/${id}/thumb${ext}`;
        savedPaths.thumb = relPath;

        // Update index.json thumbnail
        const procEntry = index.procedures.find((p) => p.id === id);
        if (procEntry) {
          procEntry.thumbnail = relPath;
        }
      } else if (/^step(\d+)$/.test(fieldName)) {
        const stepNum = parseInt(fieldName.match(/^step(\d+)$/)[1], 10);
        const stepPath = path.join(ROOT, 'images', id, `step${stepNum}${ext}`);
        fs.writeFileSync(stepPath, data);
        const relPath = `images/${id}/step${stepNum}${ext}`;
        savedPaths[fieldName] = relPath;

        // Update procedure step image
        if (procedure.steps && procedure.steps[stepNum - 1]) {
          procedure.steps[stepNum - 1].image = relPath;
        }
      }
    }

    writeJsonFile(procPath, procedure);
    writeJsonFile(indexPath, index);

    jsonResponse(res, 200, { updated: true, paths: savedPaths });
  } catch (err) {
    jsonResponse(res, 500, { error: err.message || 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function router(req, res) {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    if (method === 'GET' && pathname === '/') {
      return handleGetRoot(req, res);
    }

    if (method === 'GET' && pathname === '/api/index') {
      return handleGetIndex(req, res);
    }

    // GET /api/procedures/:id
    const procGetMatch = pathname.match(/^\/api\/procedures\/([a-z0-9-]+)$/);
    if (method === 'GET' && procGetMatch) {
      return handleGetProcedure(req, res, procGetMatch[1]);
    }

    // POST /api/procedures
    if (method === 'POST' && pathname === '/api/procedures') {
      return handlePostProcedures(req, res);
    }

    // POST /api/procedures/:id/images
    const imagesMatch = pathname.match(/^\/api\/procedures\/([a-z0-9-]+)\/images$/);
    if (method === 'POST' && imagesMatch) {
      return await handlePostImages(req, res, imagesMatch[1]);
    }

    jsonResponse(res, 404, { error: 'Not found' });
  } catch (err) {
    jsonResponse(res, 500, { error: err.message || 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const server = http.createServer(router);
server.listen(PORT, () => {
  console.log(`Admin server running at http://localhost:${PORT}`);
  console.log('Main site: http://localhost:3000');
});
