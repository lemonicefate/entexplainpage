'use strict';

const { inspectRepository } = require('../persistence');

const report = inspectRepository(process.argv[2] || process.cwd());
for (const diagnostic of report.diagnostics) {
  const prefix = diagnostic.severity === 'warning' ? 'WARN' : 'ERROR';
  console.log(`${prefix} [${diagnostic.code}] ${diagnostic.message}${diagnostic.location ? ` (${diagnostic.location})` : ''}`);
}
console.log(`Integrity: ${report.ok ? 'ok' : 'failed'}; ${report.summary.errors} error(s), ${report.summary.warnings} warning(s)`);
process.exitCode = report.ok ? 0 : 1;
