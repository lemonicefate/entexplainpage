import { describe, expect, it } from 'vitest';
import imageInventory from '../../scripts/image-inventory.js';

const { buildInventory } = imageInventory;

describe('runtime image inventory', () => {
  it('has no missing or case-mismatched image references', () => {
    const report = buildInventory();

    expect(report.missingReferences).toEqual([]);
    expect(report.caseMismatches).toEqual([]);
  });

  it('keeps the complete local runtime within the offline budget', () => {
    const report = buildInventory();

    expect(report.summary.runtimeBytes).toBeLessThanOrEqual(30 * 1024 * 1024);
    expect(report.budgetViolations).toEqual([]);
  });
});
