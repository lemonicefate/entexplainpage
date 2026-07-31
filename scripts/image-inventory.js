'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IMAGE_ROOT = path.join(ROOT, 'images');
const MIGRATION_MANIFEST = path.join(ROOT, 'docs', 'image-migration.json');
const RUNTIME_ROOT_FILES = [
  'index.html',
  'css/style.css',
  'js/app.js',
  'manifest.json',
  'sw.js',
  'procedures/index.json'
];

const MAX_RUNTIME_BYTES = 30 * 1024 * 1024;
const MAX_STEP_BYTES = 500 * 1024;
const MAX_THUMB_BYTES = 200 * 1024;
const MAX_THUMB_WIDTH = 800;
const MAX_THUMB_HEIGHT = 600;
const IMAGE_REFERENCE_RE = /(?:\.\/)?images\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|svg)/gi;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function runtimeFiles() {
  const index = readJson(path.join(ROOT, 'procedures/index.json'));
  return RUNTIME_ROOT_FILES.concat(
    (index.procedures || []).map((procedure) => `procedures/${procedure.id}.json`)
  ).filter((file, index, files) => files.indexOf(file) === index);
}

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(filePath) : [filePath];
  });
}

function extractImageReferences(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return [...new Set(content.match(IMAGE_REFERENCE_RE) || [])]
    .map((reference) => reference.replace(/^\.\//, ''));
}

function findCaseInsensitivePath(reference) {
  const parts = reference.split('/');
  let current = ROOT;
  let actual = [];

  for (const part of parts) {
    if (!fs.existsSync(current) || !fs.statSync(current).isDirectory()) return null;
    const entries = fs.readdirSync(current);
    const exact = entries.find((entry) => entry === part);
    const match = exact || entries.find((entry) => entry.toLowerCase() === part.toLowerCase());
    if (!match) return null;
    actual.push(match);
    current = path.join(current, match);
  }

  return actual.join('/');
}

function readJpegDimensions(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && offset + 7 <= buffer.length) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3)
      };
    }
    offset += segmentLength;
  }
  return null;
}

function readWebpDimensions(buffer) {
  if (buffer.toString('ascii', 12, 16) === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
      height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16)
    };
  }

  if (buffer.toString('ascii', 12, 16) === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }

  if (buffer.toString('ascii', 12, 16) === 'VP8L' && buffer.length >= 25) {
    const bits = buffer[21] | (buffer[22] << 8) | (buffer[23] << 16) | (buffer[24] << 24);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >>> 14) & 0x3fff)
    };
  }

  return null;
}

function readDimensions(filePath, extension) {
  const buffer = fs.readFileSync(filePath);
  if (extension === '.png' && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (extension === '.jpg' || extension === '.jpeg') return readJpegDimensions(buffer);
  if (extension === '.webp' && buffer.toString('ascii', 0, 4) === 'RIFF') {
    return readWebpDimensions(buffer);
  }
  return null;
}

function imageRole(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (/^thumb(?:[-.])/.test(name)) return 'thumbnail';
  if (/^step\d+\./.test(name)) return 'step';
  return 'supporting';
}

function imageRecord(filePath) {
  const imagePath = relative(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const dimensions = readDimensions(filePath, extension);
  return {
    path: imagePath,
    role: imageRole(filePath),
    format: extension.slice(1),
    bytes: fs.statSync(filePath).size,
    width: dimensions ? dimensions.width : null,
    height: dimensions ? dimensions.height : null
  };
}

function readMigrationManifest() {
  if (!fs.existsSync(MIGRATION_MANIFEST)) return null;
  return readJson(MIGRATION_MANIFEST);
}

function thumbnailViolations(image, displayPath) {
  const violations = [];
  if (image.format !== 'webp') violations.push(`${displayPath}: thumbnail is not WebP`);
  if (image.bytes > MAX_THUMB_BYTES) violations.push(`${displayPath}: thumbnail exceeds 200 KiB`);
  if (image.width > MAX_THUMB_WIDTH || image.height > MAX_THUMB_HEIGHT) {
    violations.push(`${displayPath}: thumbnail exceeds 800x600`);
  }
  return violations;
}

function stepViolations(image, displayPath, enforceWebpTarget) {
  if ((enforceWebpTarget || image.format !== 'webp') && image.bytes > MAX_STEP_BYTES) {
    return [`${displayPath}: step image exceeds 500 KiB`];
  }
  return [];
}

function imageBudgetViolations(image, displayPath, enforceWebpTarget) {
  if (image.role === 'thumbnail') return thumbnailViolations(image, displayPath);
  if (image.role === 'step') return stepViolations(image, displayPath, enforceWebpTarget);
  return [];
}

function migrationViolations(manifest, imagesByPath) {
  if (!manifest) return [];
  const violations = [];
  const records = manifest.conversions || [];

  for (const conversion of records) {
    const target = imagesByPath.get(conversion.target);
    if (!target) {
      violations.push(`${conversion.target}: migration target is missing`);
      continue;
    }
    if (conversion.visualReview !== true) {
      violations.push(`${conversion.target}: visual review is not recorded`);
    }
    if (conversion.targetBytes !== target.bytes) {
      violations.push(`${conversion.target}: inventory bytes differ from migration record`);
    }
    if (conversion.targetFormat !== target.format) {
      violations.push(`${conversion.target}: inventory format differs from migration record`);
    }
    violations.push(...imageBudgetViolations(target, conversion.target, true));
  }

  return violations;
}

function buildInventory() {
  const files = runtimeFiles();
  const runtimeFilePaths = files.map((file) => path.join(ROOT, file));
  const imagePaths = walkFiles(IMAGE_ROOT).sort();
  const images = imagePaths.map(imageRecord);
  const imagesByPath = new Map(images.map((image) => [image.path, image]));
  const references = [...new Set(runtimeFilePaths.flatMap(extractImageReferences))].sort();
  const missingReferences = references.filter((reference) => !fs.existsSync(path.join(ROOT, reference)));
  const caseMismatches = missingReferences
    .map((reference) => ({ reference, actual: findCaseInsensitivePath(reference) }))
    .filter((entry) => entry.actual)
    .map((entry) => `${entry.reference} -> ${entry.actual}`);
  const resolvedReferences = references.filter((reference) => fs.existsSync(path.join(ROOT, reference)));
  const unreferencedImages = images
    .map((image) => image.path)
    .filter((imagePath) => !resolvedReferences.includes(imagePath));
  const migration = readMigrationManifest();
  const referencedImages = resolvedReferences.map((imagePath) => imagesByPath.get(imagePath)).filter(Boolean);
  const budgetViolations = referencedImages.flatMap((image) => imageBudgetViolations(image, image.path, false))
    .concat(migrationViolations(migration, imagesByPath));
  const runtimeEntries = files.concat(resolvedReferences).sort()
    .filter((file, index, all) => all.indexOf(file) === index);
  const runtimeBytes = runtimeEntries.reduce((sum, file) => sum + fs.statSync(path.join(ROOT, file)).size, 0);

  return {
    budget: {
      maxRuntimeBytes: MAX_RUNTIME_BYTES,
      maxStepBytes: MAX_STEP_BYTES,
      maxThumbnailBytes: MAX_THUMB_BYTES,
      maxThumbnailDimensions: [MAX_THUMB_WIDTH, MAX_THUMB_HEIGHT]
    },
    runtimeFiles: files,
    runtimeEntries,
    references,
    missingReferences,
    caseMismatches,
    unreferencedImages,
    budgetViolations,
    images,
    summary: {
      runtimeFileCount: runtimeEntries.length,
      runtimeBytes,
      runtimeImageFileCount: referencedImages.length,
      imageFileCount: images.length,
      imageBytes: images.reduce((sum, image) => sum + image.bytes, 0)
    }
  };
}

function runCli() {
  const report = buildInventory();
  const outputPath = process.argv[2] === '--write' ? process.argv[3] : null;
  if (outputPath) {
    const target = path.resolve(ROOT, outputPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(JSON.stringify(report.summary, null, 2));
  if (report.missingReferences.length || report.caseMismatches.length || report.budgetViolations.length) {
    console.error(JSON.stringify({
      missingReferences: report.missingReferences,
      caseMismatches: report.caseMismatches,
      budgetViolations: report.budgetViolations
    }, null, 2));
    process.exitCode = 1;
  }
  if (report.summary.runtimeBytes > MAX_RUNTIME_BYTES) {
    console.error(`runtime inventory exceeds ${MAX_RUNTIME_BYTES} bytes`);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  buildInventory,
  readDimensions
};
