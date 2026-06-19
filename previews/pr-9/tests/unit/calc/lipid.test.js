import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Golden-file matrix for the NHI 降血脂藥物給付規定 (文件 031170) lookup.
// The rules are transcribed from an authoritative source, so these tests
// exist to answer "did we transcribe it correctly?" — when the規定改版,
// these tests must be updated in lockstep. See docs/adr/0001.

let lipidCoverage;

beforeEach(() => {
  const appSrc = fs.readFileSync(path.resolve(__dirname, '../../../js/app.js'), 'utf-8');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const win = dom.window;
  win.addEventListener('error', () => { /* swallow init throws on missing fetch */ });
  const script = win.document.createElement('script');
  script.textContent = appSrc;
  try { win.document.body.appendChild(script); }
  catch (e) { /* IIFE throw is fine — helper already exposed */ }
  lipidCoverage = win.__lipidCoverage;
});

// All-benign baseline: no risk factors, lipids well below every threshold.
function st(over) {
  return Object.assign({
    ldl: 0, hdl: 60, tg: 0, tc: 0,
    cvd: false, dm: false,
    htn: false, ageRisk: false, fhx: false, smoke: false
  }, over);
}

describe('lipidCoverage — exposure', () => {
  it('is exposed on window', () => {
    expect(typeof lipidCoverage).toBe('function');
  });
});

describe('statin — patient category', () => {
  it('CVD → cvd-dm tier', () => {
    expect(lipidCoverage(st({ cvd: true })).statin.category).toBe('cvd-dm');
  });
  it('DM → cvd-dm tier', () => {
    expect(lipidCoverage(st({ dm: true })).statin.category).toBe('cvd-dm');
  });
  it('CVD + DM → cvd-dm tier', () => {
    expect(lipidCoverage(st({ cvd: true, dm: true })).statin.category).toBe('cvd-dm');
  });
  it('DM is NOT counted as a risk factor (rfCount stays 0)', () => {
    expect(lipidCoverage(st({ dm: true })).rfCount).toBe(0);
  });
  it('2 risk factors → rf2 tier', () => {
    expect(lipidCoverage(st({ htn: true, ageRisk: true })).statin.category).toBe('rf2');
  });
  it('1 risk factor → rf1 tier', () => {
    expect(lipidCoverage(st({ htn: true })).statin.category).toBe('rf1');
  });
  it('0 risk factors → rf0 tier', () => {
    expect(lipidCoverage(st({})).statin.category).toBe('rf0');
  });
  it('HDL-C < 40 counts as a risk factor', () => {
    const r = lipidCoverage(st({ hdl: 39 }));
    expect(r.hdlLow).toBe(true);
    expect(r.rfCount).toBe(1);
    expect(r.statin.category).toBe('rf1');
  });
  it('all 5 risk factors count toward the tier', () => {
    const r = lipidCoverage(st({ htn: true, ageRisk: true, fhx: true, smoke: true, hdl: 30 }));
    expect(r.rfCount).toBe(5);
    expect(r.statin.category).toBe('rf2');
  });
  it('high tier overrides risk-factor count', () => {
    const r = lipidCoverage(st({ cvd: true, htn: true, ageRisk: true }));
    expect(r.statin.category).toBe('cvd-dm');
  });
});

describe('statin — cvd-dm tier thresholds (TC≧160 或 LDL-C≧100)', () => {
  it('LDL-C 100 meets, 99 does not', () => {
    expect(lipidCoverage(st({ dm: true, ldl: 100 })).statin.byLDL).toBe(true);
    expect(lipidCoverage(st({ dm: true, ldl: 99 })).statin.byLDL).toBe(false);
  });
  it('TC 160 meets, 159 does not', () => {
    expect(lipidCoverage(st({ dm: true, tc: 160 })).statin.byTC).toBe(true);
    expect(lipidCoverage(st({ dm: true, tc: 159 })).statin.byTC).toBe(false);
  });
  it('qualifies via TC path alone', () => {
    expect(lipidCoverage(st({ dm: true, tc: 160, ldl: 0 })).statin.qualified).toBe(true);
  });
  it('qualifies via LDL path alone', () => {
    expect(lipidCoverage(st({ dm: true, ldl: 100, tc: 0 })).statin.qualified).toBe(true);
  });
  it('both paths below threshold → not qualified', () => {
    expect(lipidCoverage(st({ dm: true, tc: 159, ldl: 99 })).statin.qualified).toBe(false);
  });
  it('non-drug therapy may run in parallel', () => {
    expect(lipidCoverage(st({ dm: true })).statin.parallel).toBe(true);
  });
});

describe('statin — rf2 tier thresholds (TC≧200 或 LDL-C≧130)', () => {
  const base = { htn: true, ageRisk: true };
  it('LDL-C 130 meets, 129 does not', () => {
    expect(lipidCoverage(st({ ...base, ldl: 130 })).statin.byLDL).toBe(true);
    expect(lipidCoverage(st({ ...base, ldl: 129 })).statin.byLDL).toBe(false);
  });
  it('TC 200 meets, 199 does not', () => {
    expect(lipidCoverage(st({ ...base, tc: 200 })).statin.byTC).toBe(true);
    expect(lipidCoverage(st({ ...base, tc: 199 })).statin.byTC).toBe(false);
  });
  it('qualifies via either path', () => {
    expect(lipidCoverage(st({ ...base, tc: 200 })).statin.qualified).toBe(true);
    expect(lipidCoverage(st({ ...base, ldl: 130 })).statin.qualified).toBe(true);
  });
  it('requires prior non-drug therapy (not parallel)', () => {
    expect(lipidCoverage(st({ ...base })).statin.parallel).toBe(false);
  });
});

describe('statin — rf1 tier thresholds (TC≧240 或 LDL-C≧160)', () => {
  const base = { htn: true };
  it('LDL-C 160 meets, 159 does not', () => {
    expect(lipidCoverage(st({ ...base, ldl: 160 })).statin.byLDL).toBe(true);
    expect(lipidCoverage(st({ ...base, ldl: 159 })).statin.byLDL).toBe(false);
  });
  it('TC 240 meets, 239 does not', () => {
    expect(lipidCoverage(st({ ...base, tc: 240 })).statin.byTC).toBe(true);
    expect(lipidCoverage(st({ ...base, tc: 239 })).statin.byTC).toBe(false);
  });
});

describe('statin — rf0 tier thresholds (LDL-C≧190, TC 不適用)', () => {
  it('LDL-C 190 meets, 189 does not', () => {
    expect(lipidCoverage(st({ ldl: 190 })).statin.qualified).toBe(true);
    expect(lipidCoverage(st({ ldl: 189 })).statin.qualified).toBe(false);
  });
  it('TC path is not available regardless of how high TC is', () => {
    const r = lipidCoverage(st({ tc: 9999, ldl: 0 }));
    expect(r.statin.startTC).toBeNull();
    expect(r.statin.byTC).toBe(false);
    expect(r.statin.qualified).toBe(false);
  });
});

describe('fibrate — cvd-dm row (TG≧200 且 (TC/HDL-C>5 或 HDL-C<40))', () => {
  it('TG≧200 + ratio>5 → qualified', () => {
    // tc 300 / hdl 50 = 6.0 > 5
    expect(lipidCoverage(st({ cvd: true, tg: 200, tc: 300, hdl: 50 })).fibrate.qualified).toBe(true);
  });
  it('TG≧200 + HDL-C<40 → qualified', () => {
    expect(lipidCoverage(st({ cvd: true, tg: 200, tc: 100, hdl: 39 })).fibrate.qualified).toBe(true);
  });
  it('TG≧200 but ratio≤5 and HDL-C≥40 → not qualified', () => {
    // tc 200 / hdl 50 = 4.0
    expect(lipidCoverage(st({ cvd: true, tg: 200, tc: 200, hdl: 50 })).fibrate.qualified).toBe(false);
  });
  it('TG 199 → not qualified even with ratio>5', () => {
    expect(lipidCoverage(st({ cvd: true, tg: 199, tc: 300, hdl: 50 })).fibrate.qualified).toBe(false);
  });
  it('ratio boundary: exactly 5 does NOT qualify (strict >5)', () => {
    // tc 250 / hdl 50 = 5.0
    expect(lipidCoverage(st({ cvd: true, tg: 200, tc: 250, hdl: 50 })).fibrate.qualified).toBe(false);
  });
  it('DM without CVD uses the cvd-dm row (looser TG≧200 threshold)', () => {
    const r = lipidCoverage(st({ dm: true, cvd: false, tg: 200, hdl: 35, tc: 100 }));
    expect(r.fibrate.category).toBe('cvd-dm');
    expect(r.fibrate.qualified).toBe(true);
  });
  it('non-drug therapy may run in parallel', () => {
    expect(lipidCoverage(st({ dm: true })).fibrate.parallel).toBe(true);
  });
  it('hdl 0 does not produce NaN ratio', () => {
    const r = lipidCoverage(st({ cvd: true, tg: 300, tc: 200, hdl: 0 }));
    expect(r.fibrate.ratio).toBe(0);
    // hdl 0 < 40 → hdlLow true → qualifies via the HDL-C<40 branch
    expect(r.fibrate.qualified).toBe(true);
  });
});

describe('fibrate — non-cvd-dm row (TG≧500)', () => {
  it('TG 500 meets, 499 does not', () => {
    expect(lipidCoverage(st({ tg: 500 })).fibrate.qualified).toBe(true);
    expect(lipidCoverage(st({ tg: 499 })).fibrate.qualified).toBe(false);
  });
  it('risk-factor count does NOT relax the fibrate threshold', () => {
    const r = lipidCoverage(st({ htn: true, ageRisk: true, fhx: true, tg: 200 }));
    expect(r.fibrate.category).toBe('non-cvd-dm');
    expect(r.fibrate.qualified).toBe(false);
  });
  it('requires prior non-drug therapy (not parallel)', () => {
    expect(lipidCoverage(st({})).fibrate.parallel).toBe(false);
  });
});

describe('fibrate — combined Statin/Fibrate warning', () => {
  it('fibrate qualified + LDL-C≧100 → comboWarning', () => {
    const r = lipidCoverage(st({ dm: true, tg: 200, hdl: 35, ldl: 100 }));
    expect(r.fibrate.qualified).toBe(true);
    expect(r.fibrate.comboWarning).toBe(true);
  });
  it('fibrate qualified + LDL-C 99 → no comboWarning', () => {
    const r = lipidCoverage(st({ dm: true, tg: 200, hdl: 35, ldl: 99 }));
    expect(r.fibrate.comboWarning).toBe(false);
  });
  it('fibrate not qualified → no comboWarning even with high LDL-C', () => {
    const r = lipidCoverage(st({ dm: true, tg: 100, ldl: 200 }));
    expect(r.fibrate.qualified).toBe(false);
    expect(r.fibrate.comboWarning).toBe(false);
  });
});
