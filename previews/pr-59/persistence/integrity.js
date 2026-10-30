'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ID_PATTERN = /^[a-z0-9-]+$/;
const TYPE_VALUES = new Set(['explain', 'surgery']);

function projectIndexEntry(detail) {
  const categories = Array.isArray(detail.categories) && detail.categories.length
    ? detail.categories.slice()
    : [detail.category];

  return {
    id: detail.id,
    title: detail.title,
    type: detail.type,
    category: categories[0],
    categories,
    subtitle: typeof detail.subtitle === 'string' ? detail.subtitle : '',
    region: typeof detail.region === 'string' ? detail.region : '',
    slides: Array.isArray(detail.steps) ? detail.steps.length : 0,
    thumbnail: detail.thumbnail,
  };
}

function sameValue(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length || leftKeys.some((key, i) => key !== rightKeys[i])) return false;
  return leftKeys.every((key) => sameValue(left[key], right[key]));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function inspectRepository(rootDir) {
  const root = path.resolve(rootDir || process.cwd());
  const diagnostics = [];
  const indexPath = path.join(root, 'procedures', 'index.json');
  const proceduresDir = path.join(root, 'procedures');
  const knownCategories = new Set();
  const detailsById = new Map();
  const indexIds = new Map();
  const referencedAssets = new Map();

  function add(code, severity, message, location) {
    diagnostics.push({ code, severity, message, ...(location ? { location } : {}) });
  }

  let index;
  try {
    index = readJson(indexPath);
  } catch (error) {
    add('invalid-index', 'error', `Unable to read procedures/index.json: ${error.message}`, 'procedures/index.json');
    return reportFrom(diagnostics);
  }

  if (!Array.isArray(index.categories)) {
    add('invalid-category-dictionary', 'error', 'procedures/index.json categories must be an array', 'procedures/index.json');
  } else {
    index.categories.forEach((category, indexPosition) => {
      if (!category || typeof category.id !== 'string' || !ID_PATTERN.test(category.id)) {
        add('invalid-category-id', 'error', 'Category ids must be lowercase kebab-case', `procedures/index.json.categories[${indexPosition}]`);
        return;
      }
      if (knownCategories.has(category.id)) {
        add('duplicate-category-id', 'error', `Duplicate category id: ${category.id}`, `procedures/index.json.categories[${indexPosition}]`);
      }
      knownCategories.add(category.id);
    });
  }

  const indexProcedures = Array.isArray(index.procedures) ? index.procedures : [];
  if (!Array.isArray(index.procedures)) {
    add('invalid-procedure-index', 'error', 'procedures/index.json procedures must be an array', 'procedures/index.json');
  }

  indexProcedures.forEach((entry, indexPosition) => {
    const location = `procedures/index.json.procedures[${indexPosition}]`;
    const id = entry && entry.id;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
      add('invalid-id', 'error', 'Procedure ids must match /^[a-z0-9-]+$/', location);
      return;
    }
    if (indexIds.has(id)) {
      add('duplicate-index-id', 'error', `Duplicate procedure id in index: ${id}`, location);
    }
    indexIds.set(id, entry);

    const detailPath = path.join(proceduresDir, `${id}.json`);
    if (!fs.existsSync(detailPath)) {
      add('missing-detail', 'error', `Index entry ${id} has no procedures/${id}.json`, location);
      return;
    }

    let detail;
    try {
      detail = readJson(detailPath);
    } catch (error) {
      add('invalid-detail', 'error', `Unable to read procedures/${id}.json: ${error.message}`, `procedures/${id}.json`);
      return;
    }
    detailsById.set(id, detail);
    inspectDetail(detail, id, location);
    if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return;

    if (detail.id !== id) {
      add('detail-id-mismatch', 'error', `Detail id ${String(detail.id)} does not match index id ${id}`, `procedures/${id}.json.id`);
    }
    if (detail.category !== entry.category) {
      add('metadata-category-drift', 'error', `${id} category drift: detail=${String(detail.category)}, index=${String(entry.category)}`, `${location}.category`);
    }
    const projection = projectIndexEntry(detail);
    if (!sameValue(projection, entry)) {
      add('projection-mismatch', 'error', `Index metadata for ${id} is not the projection of its canonical detail`, location);
    }
  });

  if (fs.existsSync(proceduresDir)) {
    fs.readdirSync(proceduresDir).filter((name) => name.endsWith('.json') && name !== 'index.json').forEach((name) => {
      const id = name.slice(0, -'.json'.length);
      if (!indexIds.has(id)) {
        add('orphan-detail', 'error', `procedures/${name} is not listed in index.json`, `procedures/${name}`);
      }
      if (!detailsById.has(id)) {
        try { detailsById.set(id, readJson(path.join(proceduresDir, name))); } catch (_) { /* reported above */ }
      }
    });
  }

  for (const [assetPath, owners] of referencedAssets.entries()) {
    const distinctOwners = [...new Set(owners.map((owner) => owner.id))];
    if (distinctOwners.length > 1) {
      add('cross-content-asset', 'error', `${assetPath} is referenced by multiple contents: ${distinctOwners.join(', ')}`, assetPath);
    }
  }

  return reportFrom(diagnostics);

  function inspectDetail(detail, id, indexLocation) {
    const location = `procedures/${id}.json`;
    if (!detail || typeof detail !== 'object' || Array.isArray(detail)) {
      add('invalid-detail-shape', 'error', `${location} must contain an object`, location);
      return;
    }
    if (typeof detail.id !== 'string' || !ID_PATTERN.test(detail.id)) {
      add('invalid-id', 'error', `${location}.id must match /^[a-z0-9-]+$/`, `${location}.id`);
    }
    if (typeof detail.title !== 'string' || !detail.title.trim()) add('missing-title', 'error', `${id} needs a non-empty title`, `${location}.title`);
    if (!TYPE_VALUES.has(detail.type)) add('invalid-type', 'error', `${id} type must be explain or surgery`, `${location}.type`);
    if (typeof detail.subtitle !== 'string') add('missing-subtitle', 'error', `${id} needs canonical subtitle metadata`, `${location}.subtitle`);
    if (typeof detail.region !== 'string') add('missing-region', 'error', `${id} needs canonical region metadata`, `${location}.region`);
    if (Object.prototype.hasOwnProperty.call(detail, 'slides')) add('legacy-slides-field', 'error', `${id} must derive slides from steps; remove detail.slides`, `${location}.slides`);
    if (typeof detail.category !== 'string' || !knownCategories.has(detail.category)) {
      add('invalid-category', 'error', `${id} has an unknown category: ${String(detail.category)}`, `${location}.category`);
    }
    if (!Array.isArray(detail.categories) || detail.categories.length === 0) {
      add('missing-categories', 'error', `${id} needs a non-empty canonical categories array`, `${location}.categories`);
    } else {
      const categories = new Set();
      detail.categories.forEach((category, categoryIndex) => {
        if (typeof category !== 'string' || !knownCategories.has(category)) {
          add('invalid-category', 'error', `${id} references an unknown category: ${String(category)}`, `${location}.categories[${categoryIndex}]`);
        }
        if (categories.has(category)) add('duplicate-category-reference', 'error', `${id} repeats category ${category}`, `${location}.categories[${categoryIndex}]`);
        categories.add(category);
      });
      if (detail.categories[0] !== detail.category) {
        add('primary-category-mismatch', 'error', `${id} category must be the first canonical category`, `${location}.categories`);
      }
    }
    if (typeof detail.thumbnail !== 'string' || !detail.thumbnail) {
      add('missing-thumbnail', 'error', `${id} needs a canonical thumbnail reference`, `${location}.thumbnail`);
    } else {
      inspectAsset(detail.thumbnail, id, `${location}.thumbnail`, 'thumbnail');
    }
    if (!Array.isArray(detail.steps) || detail.steps.length === 0) {
      add('invalid-steps', 'error', `${id} needs at least one step`, `${location}.steps`);
      return;
    }
    detail.steps.forEach((step, stepIndex) => {
      const stepLocation = `${location}.steps[${stepIndex}]`;
      if (!step || typeof step !== 'object') {
        add('invalid-step', 'error', `${id} step ${stepIndex + 1} must be an object`, stepLocation);
        return;
      }
      if (typeof step.title !== 'string' || !step.title.trim()) add('missing-step-title', 'error', `${id} step ${stepIndex + 1} needs a non-empty title`, `${stepLocation}.title`);
      if (typeof step.description !== 'string') add('missing-step-description', 'error', `${id} step ${stepIndex + 1} needs a description string`, `${stepLocation}.description`);
      if (typeof step.alt !== 'string' || !step.alt.trim()) add('legacy-empty-alt', 'warning', `${id} step ${stepIndex + 1} has an empty alt text`, `${stepLocation}.alt`);
      if (typeof step.image !== 'string' || !step.image) add('missing-step-image', 'error', `${id} step ${stepIndex + 1} needs an image reference`, `${stepLocation}.image`);
      else inspectAsset(step.image, id, `${stepLocation}.image`, 'step');
    });
    if (indexLocation && indexIds.get(id) && indexIds.get(id).slides !== detail.steps.length) {
      add('step-count-mismatch', 'error', `${id} index slides must equal ${detail.steps.length}`, `${indexLocation}.slides`);
    }
  }

  function inspectAsset(assetReference, id, location, role) {
    const normalized = assetReference.replaceAll('\\', '/');
    const expectedPrefix = `images/${id}/`;
    const referencedOwner = normalized.startsWith('images/') ? normalized.slice('images/'.length).split('/')[0] : null;
    if (referencedOwner && referencedOwner !== id) {
      add('cross-content-asset', 'error', `${id} ${role} points at ${normalized}`, location);
    }
    if (normalized !== assetReference || !normalized.startsWith(expectedPrefix) || normalized.includes('/../') || normalized.endsWith('/..')) {
      add('asset-outside-content', 'error', `${id} ${role} must live under ${expectedPrefix}`, location);
      return;
    }
    const absolute = path.resolve(root, normalized);
    const contentRoot = path.resolve(root, 'images', id) + path.sep;
    if (!absolute.startsWith(contentRoot)) {
      add('asset-outside-content', 'error', `${id} ${role} resolves outside its content directory`, location);
      return;
    }
    let stat;
    try { stat = fs.statSync(absolute); } catch (_) { stat = null; }
    if (!stat || !stat.isFile()) {
      add('missing-asset', 'error', `${id} ${role} is missing: ${normalized}`, location);
    } else {
      const owners = referencedAssets.get(normalized) || [];
      owners.push({ id, location });
      referencedAssets.set(normalized, owners);
    }
  }
}

function reportFrom(diagnostics) {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    diagnostics,
    summary: { errors: errors.length, warnings: warnings.length },
  };
}

module.exports = { inspectRepository, projectIndexEntry, sameValue };
