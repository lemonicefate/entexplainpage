'use strict';

// One-time migration for the checked-in static catalog. It deliberately copies
// presentation metadata from the existing index before the integrity gate is
// enabled; it does not invent values or reorder procedures.

const fs = require('node:fs');
const path = require('node:path');
const { projectIndexEntry } = require('../persistence');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'procedures', 'index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

index.procedures = (index.procedures || []).map((legacyEntry) => {
  const detailPath = path.join(root, 'procedures', `${legacyEntry.id}.json`);
  const detail = JSON.parse(fs.readFileSync(detailPath, 'utf8'));
  const categories = Array.isArray(legacyEntry.categories) && legacyEntry.categories.length
    ? legacyEntry.categories.slice()
    : [legacyEntry.category];

  const canonical = {
    id: detail.id,
    title: detail.title,
    type: detail.type,
    subtitle: legacyEntry.subtitle || '',
    region: legacyEntry.region || '',
    category: categories[0],
    categories,
    thumbnail: legacyEntry.thumbnail,
    steps: detail.steps,
  };

  fs.writeFileSync(detailPath, `${JSON.stringify(canonical, null, 2)}\n`);
  return projectIndexEntry(canonical);
});

fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
