'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { inspectRepository, projectIndexEntry } = require('./integrity');

const ID_PATTERN = /^[a-z0-9-]+$/;
const TYPE_VALUES = new Set(['explain', 'surgery']);
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024;
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

class PersistenceError extends Error {
  constructor(message, { code = 'persistence-error', statusCode = 500, issues = [] } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.issues = issues;
  }
}

class ValidationError extends PersistenceError {
  constructor(issues) {
    super('Validation failed', { code: 'validation-error', statusCode: 400, issues });
  }
}

class ConflictError extends PersistenceError {
  constructor(message = 'Revision conflict') {
    super(message, { code: 'revision-conflict', statusCode: 409 });
  }
}

class NotFoundError extends PersistenceError {
  constructor(id) {
    super(`Procedure "${id}" not found`, { code: 'not-found', statusCode: 404 });
  }
}

class RecoveryRequiredError extends PersistenceError {
  constructor(message = 'Repository recovery is required') {
    super(message, { code: 'recovery-required', statusCode: 503 });
  }
}

class SimulatedCrashError extends Error {
  constructor(message = 'Simulated process crash') {
    super(message);
    this.name = 'SimulatedCrashError';
    this.simulatedCrash = true;
  }
}

function createPersistenceModule(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const proceduresDir = path.join(rootDir, 'procedures');
  const imagesDir = path.join(rootDir, 'images');
  const stateDir = path.join(rootDir, '.persistence');
  const transactionsDir = path.join(stateDir, 'transactions');
  const faultInjector = typeof options.faultInjector === 'function' ? options.faultInjector : () => {};
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  let started = false;
  let queue = Promise.resolve();

  function withLock(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  }

  function callFault(operation, context) {
    faultInjector(operation, context);
  }

  function ensureDirectory(directory) {
    fs.mkdirSync(directory, { recursive: true });
  }

  function ensureBaseDirectories() {
    ensureDirectory(proceduresDir);
    ensureDirectory(imagesDir);
    ensureDirectory(transactionsDir);
  }

  function jsonPath(filePath) {
    return path.resolve(filePath);
  }

  function safeInside(target, parent) {
    const resolvedTarget = jsonPath(target);
    const resolvedParent = jsonPath(parent);
    return resolvedTarget === resolvedParent || resolvedTarget.startsWith(resolvedParent + path.sep);
  }

  function writeJsonAtomic(filePath, value) {
    const target = jsonPath(filePath);
    ensureDirectory(path.dirname(target));
    const temporary = `${target}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, target);
  }

  function removePath(target) {
    if (!safeInside(target, rootDir) || jsonPath(target) === rootDir) throw new Error(`Unsafe remove path: ${target}`);
    fs.rmSync(target, { recursive: true, force: true });
  }

  function copyPath(source, destination) {
    if (fs.existsSync(source)) {
      const stat = fs.statSync(source);
      if (stat.isDirectory()) {
        ensureDirectory(destination);
        fs.readdirSync(source).forEach((name) => copyPath(path.join(source, name), path.join(destination, name)));
      } else {
        ensureDirectory(path.dirname(destination));
        fs.copyFileSync(source, destination);
      }
    }
  }

  function readIndex() {
    const filePath = path.join(proceduresDir, 'index.json');
    if (!fs.existsSync(filePath)) return { categories: [], procedures: [] };
    const index = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(index.categories)) index.categories = [];
    if (!Array.isArray(index.procedures)) index.procedures = [];
    return index;
  }

  function readDetail(id) {
    const filePath = path.join(proceduresDir, `${id}.json`);
    if (!fs.existsSync(filePath)) throw new NotFoundError(id);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function getCategoryIds(index) {
    return new Set((index.categories || []).map((category) => typeof category === 'string' ? category : category.id));
  }

  function normalizeAsset(asset, location, issues) {
    if (!asset || typeof asset !== 'object') {
      issues.push({ path: location, code: 'missing-asset', message: 'An image upload or existing asset handle is required' });
      return null;
    }
    if (asset.kind === 'upload') {
      const contentType = String(asset.contentType || '').split(';')[0].toLowerCase();
      const data = Buffer.isBuffer(asset.data) ? asset.data : Buffer.from(asset.data || '');
      if (!IMAGE_MIME_TYPES.has(contentType)) {
        issues.push({ path: `${location}.contentType`, code: 'invalid-mime', message: `Unsupported image MIME type: ${contentType || '(missing)'}` });
      }
      if (!asset.filename || typeof asset.filename !== 'string') {
        issues.push({ path: `${location}.filename`, code: 'missing-filename', message: 'Uploaded images need a filename' });
      }
      if (data.length === 0) issues.push({ path: `${location}.data`, code: 'empty-upload', message: 'Uploaded image is empty' });
      if (data.length > MAX_ASSET_BYTES) issues.push({ path: `${location}.data`, code: 'asset-too-large', message: `Image exceeds ${MAX_ASSET_BYTES} bytes` });
      return { kind: 'upload', contentType, filename: asset.filename, data };
    }
    if (asset.kind === 'existing' && typeof asset.handle === 'string' && asset.handle) {
      return { kind: 'existing', handle: asset.handle };
    }
    issues.push({ path: location, code: 'invalid-asset', message: 'Asset must be an upload or an existing opaque handle' });
    return null;
  }

  function normalizedContent(input, operation, current, assets) {
    const issues = [];
    const content = input && typeof input === 'object' ? input : {};
    const id = content.id || input.id;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
      issues.push({ path: 'content.id', code: 'invalid-id', message: 'Id must match /^[a-z0-9-]+$/' });
    }
    if (typeof content.title !== 'string' || !content.title.trim()) issues.push({ path: 'content.title', code: 'missing-title', message: 'Title is required' });
    if (!TYPE_VALUES.has(content.type)) issues.push({ path: 'content.type', code: 'invalid-type', message: 'Type must be explain or surgery' });
    if (typeof content.subtitle !== 'string') issues.push({ path: 'content.subtitle', code: 'missing-subtitle', message: 'Subtitle must be a string' });
    if (typeof content.region !== 'string') issues.push({ path: 'content.region', code: 'missing-region', message: 'Region must be a string' });

    const categories = Array.isArray(content.categories) ? content.categories.filter(Boolean) : [];
    if (!categories.length && typeof content.category === 'string' && content.category) categories.push(content.category);
    const categoryIds = getCategoryIds(readIndex());
    if (!categories.length) issues.push({ path: 'content.categories', code: 'missing-category', message: 'At least one category is required' });
    const seenCategories = new Set();
    categories.forEach((category, index) => {
      if (typeof category !== 'string' || !categoryIds.has(category)) {
        issues.push({ path: `content.categories[${index}]`, code: 'unknown-category', message: `Unknown category: ${String(category)}` });
      }
      if (seenCategories.has(category)) issues.push({ path: `content.categories[${index}]`, code: 'duplicate-category', message: `Category is repeated: ${category}` });
      seenCategories.add(category);
    });
    if (content.category !== categories[0]) issues.push({ path: 'content.category', code: 'primary-category-mismatch', message: 'category must equal the first categories entry' });

    if (!Array.isArray(content.steps) || content.steps.length === 0) {
      issues.push({ path: 'content.steps', code: 'missing-steps', message: 'At least one step is required' });
    }
    const assetInput = assets && typeof assets === 'object' ? assets : {};
    const stepAssets = Array.isArray(assetInput.steps) ? assetInput.steps : [];
    if (Array.isArray(content.steps) && stepAssets.length !== content.steps.length) {
      issues.push({ path: 'assets.steps', code: 'step-assets-mismatch', message: 'There must be one image asset for each step' });
    }
    const normalizedSteps = (Array.isArray(content.steps) ? content.steps : []).map((step, index) => {
      const item = step && typeof step === 'object' ? step : {};
      if (typeof item.title !== 'string' || !item.title.trim()) issues.push({ path: `content.steps[${index}].title`, code: 'missing-step-title', message: 'Step title is required' });
      if (typeof item.description !== 'string') issues.push({ path: `content.steps[${index}].description`, code: 'missing-step-description', message: 'Step description must be a string' });
      if (typeof item.alt !== 'string' || !item.alt.trim()) issues.push({ path: `content.steps[${index}].alt`, code: 'missing-step-alt', message: 'New and edited steps require non-empty alt text' });
      return {
        title: typeof item.title === 'string' ? item.title.trim() : '',
        description: typeof item.description === 'string' ? item.description : '',
        alt: typeof item.alt === 'string' ? item.alt.trim() : '',
      };
    });

    let thumbnailAsset = assetInput.thumbnail;
    if (!thumbnailAsset && operation === 'create') thumbnailAsset = stepAssets[0];
    if (!thumbnailAsset && operation === 'replace' && current) thumbnailAsset = current.assets.thumbnail;
    const normalizedThumbnail = normalizeAsset(thumbnailAsset, 'assets.thumbnail', issues);
    const normalizedStepAssets = stepAssets.map((asset, index) => normalizeAsset(asset, `assets.steps[${index}]`, issues));

    const currentHandles = current
      ? new Set([current.assets.thumbnail, ...current.assets.steps].map((asset) => asset.handle))
      : new Set();
    [normalizedThumbnail, ...normalizedStepAssets].forEach((asset, index) => {
      if (!asset || asset.kind !== 'existing') return;
      const location = index === 0 ? 'assets.thumbnail' : `assets.steps[${index - 1}]`;
      if (operation === 'create') {
        issues.push({ path: location, code: 'existing-asset-on-create', message: 'Create requires uploaded image assets' });
      } else if (!currentHandles.has(asset.handle)) {
        issues.push({ path: location, code: 'stale-asset-handle', message: 'Asset handle is no longer current' });
      }
    });

    const totalUploadBytes = [normalizedThumbnail, ...normalizedStepAssets].reduce((total, asset) => total + (asset && asset.kind === 'upload' ? asset.data.length : 0), 0);
    if (totalUploadBytes > MAX_PAYLOAD_BYTES) issues.push({ path: 'assets', code: 'payload-too-large', message: `Payload exceeds ${MAX_PAYLOAD_BYTES} bytes` });
    if (issues.length) throw new ValidationError(issues);

    return {
      id,
      content: {
        id,
        title: content.title.trim(),
        type: content.type,
        subtitle: content.subtitle,
        region: content.region,
        category: categories[0],
        categories,
        steps: normalizedSteps,
      },
      assets: { thumbnail: normalizedThumbnail, steps: normalizedStepAssets },
    };
  }

  function assetHandle(id, assetPath) {
    const bytes = fs.readFileSync(path.join(rootDir, assetPath));
    // The path and bytes identify the asset; its step position must not.
    return crypto.createHash('sha256').update(`${id}\0${assetPath}\0`).update(bytes).digest('base64url');
  }

  function rawAssets(id, detail) {
    const thumbnailPath = detail.thumbnail;
    const thumbnailAbsolute = path.resolve(rootDir, thumbnailPath);
    const contentImagesDir = path.join(imagesDir, id);
    if (!safeInside(thumbnailAbsolute, contentImagesDir) || !fs.existsSync(thumbnailAbsolute)) throw new PersistenceError(`Missing thumbnail for ${id}`, { code: 'missing-asset', statusCode: 500 });
    const stepAssets = detail.steps.map((step, index) => {
      const absolute = path.resolve(rootDir, step.image);
      if (!safeInside(absolute, contentImagesDir) || !fs.existsSync(absolute)) throw new PersistenceError(`Missing step image for ${id} step ${index + 1}`, { code: 'missing-asset', statusCode: 500 });
      return { kind: 'existing', handle: assetHandle(id, step.image), path: step.image };
    });
    return {
      thumbnail: { kind: 'existing', handle: assetHandle(id, thumbnailPath), path: thumbnailPath },
      steps: stepAssets,
    };
  }

  function readRecord(id) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new NotFoundError(id);
    const index = readIndex();
    const entry = index.procedures.find((procedure) => procedure.id === id);
    if (!entry) throw new NotFoundError(id);
    const detail = readDetail(id);
    const assets = rawAssets(id, detail);
    const revisionSource = JSON.stringify({ entry, detail, assets: assets.steps.map((asset) => asset.path).concat(assets.thumbnail.path).map((assetPath) => fs.readFileSync(path.join(rootDir, assetPath)).toString('base64')) });
    const revision = crypto.createHash('sha256').update(revisionSource).digest('base64url');
    const procedure = {
      id: detail.id,
      title: detail.title,
      type: detail.type,
      subtitle: detail.subtitle,
      region: detail.region,
      category: detail.category,
      categories: detail.categories.slice(),
      thumbnail: { handle: assets.thumbnail.handle, path: assets.thumbnail.path },
      steps: detail.steps.map((step, index) => ({
        title: step.title,
        description: step.description,
        alt: step.alt,
        image: { handle: assets.steps[index].handle, path: assets.steps[index].path },
      })),
    };
    return { revision, procedure, assets, detail, index };
  }

  function publicRead(record) {
    return { revision: record.revision, procedure: record.procedure, assets: record.assets };
  }

  function transactionId(id) {
    return `${now().toString(36)}-${id}-${crypto.randomBytes(6).toString('hex')}`;
  }

  function journalPath(txDir) { return path.join(txDir, 'journal.json'); }
  function saveJournal(txDir, journal) { writeJsonAtomic(journalPath(txDir), journal); }
  function loadJournal(txDir) { return JSON.parse(fs.readFileSync(journalPath(txDir), 'utf8')); }

  function snapshotBefore(txDir, id) {
    const beforeDir = path.join(txDir, 'before');
    ensureDirectory(beforeDir);
    const indexPath = path.join(proceduresDir, 'index.json');
    const procedurePath = path.join(proceduresDir, `${id}.json`);
    const imagePath = path.join(imagesDir, id);
    const snapshot = { index: fs.existsSync(indexPath), procedure: fs.existsSync(procedurePath), images: fs.existsSync(imagePath) };
    if (snapshot.index) copyPath(indexPath, path.join(beforeDir, 'index.json'));
    if (snapshot.procedure) copyPath(procedurePath, path.join(beforeDir, 'procedure.json'));
    if (snapshot.images) copyPath(imagePath, path.join(beforeDir, 'images'));
    return snapshot;
  }

  function existingAssetPath(current, asset) {
    if (!asset || asset.kind !== 'existing') return null;
    const all = [current.assets.thumbnail, ...current.assets.steps];
    const match = all.find((candidate) => candidate.handle === asset.handle);
    if (!match || !match.path) throw new ConflictError('An asset handle is no longer current');
    return match.path;
  }

  function extensionFor(asset) {
    const extensionMap = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
    return extensionMap[asset.contentType] || '.bin';
  }

  function stageAfter(txDir, normalized, current, operation) {
    const afterDir = path.join(txDir, 'after');
    const afterImages = path.join(afterDir, 'images', normalized.id);
    const detail = {
      ...normalized.content,
      thumbnail: '',
    };
    const stageAsset = (asset, role) => {
      let fileName;
      if (asset.kind === 'existing') {
        const source = existingAssetPath(current, asset);
        fileName = path.basename(source);
        copyPath(path.join(rootDir, source), path.join(afterImages, fileName));
      } else {
        fileName = `${role}-${txDir.split(path.sep).pop()}${extensionFor(asset)}`;
        ensureDirectory(afterImages);
        fs.writeFileSync(path.join(afterImages, fileName), asset.data);
      }
      return `images/${normalized.id}/${fileName}`;
    };

    detail.thumbnail = stageAsset(normalized.assets.thumbnail, 'thumb');
    detail.steps = normalized.content.steps.map((step, index) => ({
      ...step,
      image: stageAsset(normalized.assets.steps[index], `step${index + 1}`),
    }));
    ensureDirectory(path.join(afterDir, 'procedures'));
    writeJsonAtomic(path.join(afterDir, 'procedure.json'), detail);

    const index = readIndex();
    const projected = projectIndexEntry(detail);
    if (operation === 'create') index.procedures.push(projected);
    else if (operation === 'replace') {
      const indexPosition = index.procedures.findIndex((entry) => entry.id === normalized.id);
      if (indexPosition < 0) throw new NotFoundError(normalized.id);
      index.procedures[indexPosition] = projected;
    } else if (operation === 'delete') {
      index.procedures = index.procedures.filter((entry) => entry.id !== normalized.id);
    }
    writeJsonAtomic(path.join(afterDir, 'index.json'), index);
    return { detail };
  }

  function stageDelete(txDir, id) {
    const afterDir = path.join(txDir, 'after');
    ensureDirectory(afterDir);
    const index = readIndex();
    index.procedures = index.procedures.filter((entry) => entry.id !== id);
    writeJsonAtomic(path.join(afterDir, 'index.json'), index);
  }

  function trashCurrent(txDir, id, before) {
    const trashDir = path.join(txDir, 'trash');
    ensureDirectory(trashDir);
    if (before.procedure) fs.renameSync(path.join(proceduresDir, `${id}.json`), path.join(trashDir, 'procedure.json'));
    if (before.images) fs.renameSync(path.join(imagesDir, id), path.join(trashDir, 'images'));
  }

  function promote(txDir, id, operation) {
    const afterDir = path.join(txDir, 'after');
    const afterImages = path.join(afterDir, 'images', id);
    if (operation !== 'delete') {
      ensureDirectory(imagesDir);
      fs.renameSync(afterImages, path.join(imagesDir, id));
    }
    callFault('promote-images', { id, operation });
    if (operation !== 'delete') fs.renameSync(path.join(afterDir, 'procedure.json'), path.join(proceduresDir, `${id}.json`));
    callFault('after-promote-detail', { id, operation });
    callFault('promote-detail', { id, operation });
    const afterIndex = JSON.parse(fs.readFileSync(path.join(afterDir, 'index.json'), 'utf8'));
    callFault('promote-index', { id, operation });
    writeJsonAtomic(path.join(proceduresDir, 'index.json'), afterIndex);
    callFault('after-promote-index', { id, operation });
  }

  function restoreBefore(txDir, id, before) {
    const beforeDir = path.join(txDir, 'before');
    const liveProcedure = path.join(proceduresDir, `${id}.json`);
    const liveImages = path.join(imagesDir, id);
    if (fs.existsSync(liveProcedure)) fs.rmSync(liveProcedure, { force: true });
    if (fs.existsSync(liveImages)) fs.rmSync(liveImages, { recursive: true, force: true });
    if (before.procedure) copyPath(path.join(beforeDir, 'procedure.json'), liveProcedure);
    if (before.images) copyPath(path.join(beforeDir, 'images'), liveImages);
    const beforeIndex = path.join(beforeDir, 'index.json');
    if (before.index) copyPath(beforeIndex, path.join(proceduresDir, 'index.json'));
    else if (fs.existsSync(path.join(proceduresDir, 'index.json'))) fs.rmSync(path.join(proceduresDir, 'index.json'), { force: true });
  }

  function rollbackTransaction(txDir, journal) {
    callFault('rollback', journal);
    restoreBefore(txDir, journal.id, journal.before);
    removePath(txDir);
  }

  function finalizeTransaction(txDir) {
    removePath(txDir);
  }

  function recoveryMarkerPath() { return path.join(stateDir, 'recovery-required.json'); }

  function setRecoveryRequired(error, journal) {
    ensureDirectory(stateDir);
    writeJsonAtomic(recoveryMarkerPath(), { error: error.message, transaction: journal && journal.txId, at: new Date().toISOString() });
  }

  function recoverTransactions() {
    if (fs.existsSync(recoveryMarkerPath())) throw new RecoveryRequiredError();
    if (!fs.existsSync(transactionsDir)) return;
    const transactionNames = fs.readdirSync(transactionsDir);
    for (const name of transactionNames) {
      const txDir = path.join(transactionsDir, name);
      if (!fs.statSync(txDir).isDirectory()) continue;
      let journal;
      try { journal = loadJournal(txDir); } catch (error) {
        setRecoveryRequired(error, { txId: name });
        throw new RecoveryRequiredError(`Invalid transaction journal ${name}`);
      }
      try {
        if (journal.commitPoint || journal.phase === 'committed' || journal.phase === 'cleanup') finalizeTransaction(txDir);
        else rollbackTransaction(txDir, journal);
      } catch (error) {
        setRecoveryRequired(error, journal);
        throw new RecoveryRequiredError(`Unable to recover transaction ${journal.txId}`);
      }
    }
  }

  function inspect() {
    const report = inspectRepository(rootDir);
    const diagnostics = report.diagnostics.slice();
    if (fs.existsSync(recoveryMarkerPath())) {
      diagnostics.push({ code: 'recovery-required', severity: 'error', message: 'Repository is blocked until transaction recovery succeeds', location: '.persistence/recovery-required.json' });
    }
    if (fs.existsSync(transactionsDir)) {
      fs.readdirSync(transactionsDir).filter((name) => fs.statSync(path.join(transactionsDir, name)).isDirectory()).forEach((name) => {
        let phase = 'unknown';
        try { phase = loadJournal(path.join(transactionsDir, name)).phase; } catch (_) { /* startup will report invalid journal */ }
        diagnostics.push({ code: 'orphan-transaction', severity: 'warning', message: `Transaction ${name} remains in phase ${phase}`, location: `.persistence/transactions/${name}` });
      });
    }
    const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
    const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
    return { ok: errors.length === 0, errors, warnings, diagnostics, summary: { errors: errors.length, warnings: warnings.length } };
  }

  async function start() {
    return withLock(async () => {
      if (started) return;
      ensureBaseDirectories();
      recoverTransactions();
      started = true;
    });
  }

  async function ensureStarted() {
    if (!started) await start();
  }

  async function read(id) {
    await ensureStarted();
    return withLock(() => publicRead(readRecord(id)));
  }

  async function list() {
    await ensureStarted();
    return withLock(() => readIndex());
  }

  async function readStatic(relativePath) {
    await ensureStarted();
    return withLock(() => {
      const normalized = String(relativePath || '').replaceAll('\\', '/').replace(/^\/+/, '');
      if (normalized === '.persistence' || normalized.startsWith('.persistence/')) throw new NotFoundError(normalized);
      const target = path.resolve(rootDir, normalized);
      if (!safeInside(target, rootDir) || !fs.existsSync(target) || !fs.statSync(target).isFile()) throw new NotFoundError(normalized);
      return fs.readFileSync(target);
    });
  }

  async function commit(command) {
    await ensureStarted();
    return withLock(() => {
      const operation = command && command.operation;
      if (!['create', 'replace', 'delete'].includes(operation)) throw new ValidationError([{ path: 'operation', code: 'invalid-operation', message: 'Operation must be create, replace, or delete' }]);
      const id = command.id || (command.content && command.content.id);
      if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new ValidationError([{ path: 'id', code: 'invalid-id', message: 'Id must match /^[a-z0-9-]+$/' }]);
      const exists = fs.existsSync(path.join(proceduresDir, `${id}.json`));
      let current = null;
      if (operation !== 'create') current = readRecord(id);
      if (operation === 'create' && exists) throw new ConflictError(`Procedure "${id}" already exists`);
      if (operation !== 'create' && command.revision !== current.revision) throw new ConflictError(`Revision for "${id}" is stale`);
      if (operation === 'delete' && !exists) throw new NotFoundError(id);
      const normalized = operation === 'delete' ? null : normalizedContent({ ...command.content, id }, operation, current, command.assets);
      const txId = transactionId(id);
      const txDir = path.join(transactionsDir, txId);
      ensureDirectory(txDir);
      let before;
      let journal;
      try {
        before = snapshotBefore(txDir, id);
        journal = { version: 1, txId, operation, id, phase: 'staging', commitPoint: false, before };
        saveJournal(txDir, journal);
        callFault('stage', { id, operation, txId });
        if (operation === 'delete') stageDelete(txDir, id);
        else stageAfter(txDir, normalized, current, operation);
        journal.phase = 'trashing';
        saveJournal(txDir, journal);
        callFault('trash', { id, operation });
        trashCurrent(txDir, id, before);
        journal.phase = 'promoting';
        saveJournal(txDir, journal);
        promote(txDir, id, operation);
        callFault('commit-marker', { id, operation });
        journal.phase = 'committed';
        journal.commitPoint = true;
        saveJournal(txDir, journal);
        callFault('after-commit-marker', { id, operation });
      } catch (error) {
        if (error && error.simulatedCrash) throw error;
        if (!journal) {
          removePath(txDir);
          throw error;
        }
        try {
          rollbackTransaction(txDir, journal);
        } catch (rollbackError) {
          setRecoveryRequired(rollbackError, journal);
          throw new RecoveryRequiredError(`Commit failed and rollback failed: ${rollbackError.message}`);
        }
        throw error;
      }

      const warnings = [];
      try {
        journal.phase = 'cleanup';
        saveJournal(txDir, journal);
        callFault('cleanup', { id, operation });
        finalizeTransaction(txDir);
      } catch (error) {
        warnings.push({ code: 'cleanup-pending', message: error.message });
      }
      const receipt = { operation, id, revision: operation === 'delete' ? null : readRecord(id).revision, warnings };
      if (operation === 'delete') receipt.revision = null;
      return receipt;
    });
  }

  return {
    rootDir,
    start,
    read,
    list,
    readStatic,
    inspect,
    commit,
    create(command) { return commit({ ...command, operation: 'create' }); },
    replace(command) { return commit({ ...command, operation: 'replace' }); },
    remove(command) { return commit({ ...command, operation: 'delete' }); },
    recover: start,
  };
}

module.exports = {
  PersistenceError,
  ValidationError,
  ConflictError,
  NotFoundError,
  RecoveryRequiredError,
  SimulatedCrashError,
  createPersistenceModule,
};
