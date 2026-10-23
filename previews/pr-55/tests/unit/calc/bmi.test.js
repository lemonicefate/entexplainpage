import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Golden-file for 國健署成人 BMI 分級 (衛福部國民健康署).
// 邊界值 (18.5 / 24 / 27 / 30 / 35) 是抄寫自權威來源,所以這份測試的
// 唯一任務是「抄對了嗎」— 國健署改版時這份測試必須跟著改。
// 上游公告改了 → 改 js/app.js 的 bmiClassify 同 PR 改這份。

let bmiClassify;
let bmiAssess;

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
  catch (e) { /* IIFE throw fine — helpers already exposed */ }
  bmiClassify = win.__bmiClassify;
  bmiAssess = win.__bmiAssess;
});

describe('bmiClassify — exposure', () => {
  it('exposes bmiClassify on window', () => {
    expect(typeof bmiClassify).toBe('function');
  });
  it('exposes bmiAssess on window', () => {
    expect(typeof bmiAssess).toBe('function');
  });
});

describe('bmiClassify — 國健署邊界值 golden file', () => {
  // 國健署成人 BMI 分級表:
  //   BMI < 18.5            → 體重過輕 underweight
  //   18.5 ≤ BMI < 24       → 正常範圍 normal
  //   24   ≤ BMI < 27       → 過重 overweight
  //   27   ≤ BMI < 30       → 輕度肥胖 obese-1
  //   30   ≤ BMI < 35       → 中度肥胖 obese-2
  //   BMI ≥ 35              → 重度肥胖 obese-3
  const cases = [
    { bmi: 10.0,  code: 'underweight', label: '體重過輕', desc: '極低值' },
    { bmi: 18.49, code: 'underweight', label: '體重過輕', desc: '18.5 下緣' },
    { bmi: 18.5,  code: 'normal',      label: '正常範圍', desc: '18.5 (含)' },
    { bmi: 22.0,  code: 'normal',      label: '正常範圍', desc: '正常中段' },
    { bmi: 23.99, code: 'normal',      label: '正常範圍', desc: '24 下緣' },
    { bmi: 24.0,  code: 'overweight',  label: '過重',     desc: '24 (含)' },
    { bmi: 26.99, code: 'overweight',  label: '過重',     desc: '27 下緣' },
    { bmi: 27.0,  code: 'obese-1',     label: '輕度肥胖', desc: '27 (含)' },
    { bmi: 29.99, code: 'obese-1',     label: '輕度肥胖', desc: '30 下緣' },
    { bmi: 30.0,  code: 'obese-2',     label: '中度肥胖', desc: '30 (含)' },
    { bmi: 34.99, code: 'obese-2',     label: '中度肥胖', desc: '35 下緣' },
    { bmi: 35.0,  code: 'obese-3',     label: '重度肥胖', desc: '35 (含)' },
    { bmi: 50.0,  code: 'obese-3',     label: '重度肥胖', desc: '極高值' }
  ];

  cases.forEach(({ bmi, code, label, desc }) => {
    it(`BMI=${bmi} (${desc}) → ${code} / ${label}`, () => {
      const g = bmiClassify(bmi);
      expect(g.code).toBe(code);
      expect(g.label).toBe(label);
    });
  });
});

describe('bmiClassify — verdict kind/shape (UI 對應)', () => {
  // kind/shape 用來決定 result card 顏色與圖示,改動會影響 UI 風險訊息。
  it('underweight → warn ■', () => {
    expect(bmiClassify(17)).toMatchObject({ kind: 'warn', shape: '■' });
  });
  it('normal → ok ●', () => {
    expect(bmiClassify(22)).toMatchObject({ kind: 'ok', shape: '●' });
  });
  it('overweight → warn ■', () => {
    expect(bmiClassify(25)).toMatchObject({ kind: 'warn', shape: '■' });
  });
  it('obese-1/2/3 → danger ▲', () => {
    expect(bmiClassify(28)).toMatchObject({ kind: 'danger', shape: '▲' });
    expect(bmiClassify(32)).toMatchObject({ kind: 'danger', shape: '▲' });
    expect(bmiClassify(40)).toMatchObject({ kind: 'danger', shape: '▲' });
  });
});

describe('bmiAssess — height/weight → BMI math', () => {
  // BMI = 體重 (kg) ÷ 身高 (m)². 用容易心算的整數驗證公式是否抄對。
  it('170 cm / 73.5 kg → BMI ≈ 25.43 (overweight)', () => {
    const r = bmiAssess(170, 73.5);
    expect(r.bmi).toBeCloseTo(25.43, 2);
    expect(r.grade.code).toBe('overweight');
  });
  it('160 cm / 60 kg → BMI ≈ 23.44 (normal)', () => {
    const r = bmiAssess(160, 60);
    expect(r.bmi).toBeCloseTo(23.44, 2);
    expect(r.grade.code).toBe('normal');
  });
  it('170 cm / 100 kg → BMI ≈ 34.60 (obese-2)', () => {
    const r = bmiAssess(170, 100);
    expect(r.bmi).toBeCloseTo(34.60, 2);
    expect(r.grade.code).toBe('obese-2');
  });
  it('150 cm / 80 kg → BMI ≈ 35.56 (obese-3)', () => {
    const r = bmiAssess(150, 80);
    expect(r.bmi).toBeCloseTo(35.56, 2);
    expect(r.grade.code).toBe('obese-3');
  });
  it('180 cm / 55 kg → BMI ≈ 16.98 (underweight)', () => {
    const r = bmiAssess(180, 55);
    expect(r.bmi).toBeCloseTo(16.98, 2);
    expect(r.grade.code).toBe('underweight');
  });
});

describe('bmiAssess — 健保臨床決策門檻 (safety-critical)', () => {
  // 這兩個閾值出現在 UI 的 ruleList,直接影響「是否符合健保肥胖症藥物 / 減重手術」
  // 的臨床判讀。抄錯會誤導醫師。
  it('BMI ≥ 27 落在 obese-1 以上 (符合肥胖症藥物治療門檻)', () => {
    // 170cm: 78.03 kg → BMI=27.00 入 obese-1; 77 kg → BMI≈26.64 仍 overweight
    expect(['obese-1', 'obese-2', 'obese-3']).toContain(bmiAssess(170, 78.1).grade.code);
    expect(bmiAssess(170, 77).grade.code).toBe('overweight');
  });
  it('BMI ≥ 35 落在 obese-3 (符合減重手術門檻)', () => {
    // 170cm: 101.15 kg → BMI=35.00 入 obese-3; 100 kg → BMI≈34.60 仍 obese-2
    expect(bmiAssess(170, 101.2).grade.code).toBe('obese-3');
    expect(bmiAssess(170, 100).grade.code).toBe('obese-2');
  });
});
