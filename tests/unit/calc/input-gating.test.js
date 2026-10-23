import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Critique P0: calculators must not render a verdict from preset or
// incomplete inputs. BMI used to open with 170/75 already graded; lipid
// used to pre-check DM/HTN/age and print 「不符合」 over empty lab fields.
// These tests pin the third state — 「等待輸入」 — plus per-field errors.

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf-8');
const sessionSrc = fs.readFileSync(path.resolve(__dirname, '../../../js/reader-session.js'), 'utf-8');
const calculatorsSrc = fs.readFileSync(path.resolve(__dirname, '../../../js/calculators.js'), 'utf-8');
const appSrc = fs.readFileSync(path.resolve(__dirname, '../../../js/app.js'), 'utf-8');

function loadCalculator(route) {
  const dom = new JSDOM(htmlContent.replace('</body>', `<script>${sessionSrc}</script><script>${calculatorsSrc}</script><script>${appSrc}</script></body>`), {
    url: 'http://localhost/' + route,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ categories: [], procedures: [] })
      });
      Object.defineProperty(window.navigator, 'serviceWorker', {
        value: { register: () => Promise.resolve({ addEventListener: () => {} }) },
        configurable: true
      });
    }
  });
  return new Promise(resolve => {
    dom.window.addEventListener('load', () => setTimeout(() => resolve(dom), 0));
  });
}

function type(dom, input, value) {
  input.value = value;
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

function fieldErrorOf(input) {
  return input.closest('.field').querySelector('.field-error');
}

describe('BMI input gating (critique P0)', () => {
  it('opens empty with a waiting state and no grade', async () => {
    const dom = await loadCalculator('#/calc/bmi');
    const doc = dom.window.document;
    const inputs = doc.querySelectorAll('#calc-body .field-input');

    expect(inputs[0].value).toBe('');
    expect(inputs[1].value).toBe('');
    expect(inputs[0].getAttribute('placeholder')).toContain('170');
    expect(inputs[1].getAttribute('placeholder')).toContain('75');

    const result = doc.getElementById('calc-result');
    expect(result.textContent).toContain('等待輸入');
    expect(result.querySelector('.result-value')).toBeNull();
    expect(result.textContent).not.toContain('過重');
    expect(result.textContent).not.toContain('正常範圍');
  });

  it('stays in the waiting state until both values are present', async () => {
    const dom = await loadCalculator('#/calc/bmi');
    const doc = dom.window.document;
    const inputs = doc.querySelectorAll('#calc-body .field-input');

    type(dom, inputs[0], '170');
    const result = doc.getElementById('calc-result');
    expect(result.textContent).toContain('等待輸入');
    expect(result.textContent).toContain('體重尚未輸入');
    expect(result.querySelector('.result-value')).toBeNull();

    type(dom, inputs[1], '75');
    expect(doc.querySelector('#calc-result .result-value').textContent).toContain('26.0');
    expect(doc.getElementById('calc-result').textContent).toContain('過重');
  });

  it('flags an out-of-range height instead of grading it', async () => {
    const dom = await loadCalculator('#/calc/bmi');
    const doc = dom.window.document;
    const inputs = doc.querySelectorAll('#calc-body .field-input');

    type(dom, inputs[0], '999');
    type(dom, inputs[1], '75');

    const err = fieldErrorOf(inputs[0]);
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain('身高');
    expect(inputs[0].getAttribute('aria-invalid')).toBe('true');
    const result = doc.getElementById('calc-result');
    expect(result.textContent).toContain('等待輸入');
    expect(result.querySelector('.result-value')).toBeNull();

    type(dom, inputs[0], '170');
    expect(fieldErrorOf(inputs[0]).hidden).toBe(true);
    expect(doc.querySelector('#calc-result .result-value').textContent).toContain('26.0');
  });

  it('treats zero as invalid, never as a graded 0', async () => {
    const dom = await loadCalculator('#/calc/bmi');
    const doc = dom.window.document;
    const inputs = doc.querySelectorAll('#calc-body .field-input');

    type(dom, inputs[0], '170');
    type(dom, inputs[1], '0');

    expect(fieldErrorOf(inputs[1]).hidden).toBe(false);
    expect(doc.getElementById('calc-result').querySelector('.result-value')).toBeNull();
  });
});

describe('Lipid input gating (critique P0)', () => {
  it('opens with nothing pre-checked and no verdict over empty labs', async () => {
    const dom = await loadCalculator('#/calc/lipid');
    const doc = dom.window.document;

    expect(doc.querySelectorAll('#calc-body .check.is-on')).toHaveLength(0);

    const result = doc.getElementById('calc-result');
    expect(result.textContent).toContain('等待輸入');
    expect(result.textContent).toContain('LDL-C');
    expect(result.textContent).not.toContain('符合健保');
    expect(result.querySelector('.result-value')).toBeNull();
  });

  it('lists the still-missing labs and renders no verdict until all four are in', async () => {
    const dom = await loadCalculator('#/calc/lipid');
    const doc = dom.window.document;
    const inputs = doc.querySelectorAll('#calc-body .field-input');

    type(dom, inputs[0], '100'); // LDL-C
    type(dom, inputs[1], '50');  // HDL-C
    type(dom, inputs[2], '150'); // TG

    const result = doc.getElementById('calc-result');
    expect(result.textContent).toContain('等待輸入');
    expect(result.textContent).toContain('Total Cholesterol');
    expect(result.querySelector('.result-value')).toBeNull();

    type(dom, inputs[3], '200'); // TC
    const text = doc.getElementById('calc-result').textContent;
    expect(text).toContain('降膽固醇藥物（Statin）健保給付');
    expect(text).toContain('降三酸甘油酯藥物（Fibrate）健保給付');
    // No category / risk factor selected, LDL 100 < 190 (rf0 tier).
    expect(text).toContain('尚未達');
  });

  it('rejects a negative lab value with a field message instead of judging with it', async () => {
    const dom = await loadCalculator('#/calc/lipid');
    const doc = dom.window.document;
    const inputs = doc.querySelectorAll('#calc-body .field-input');

    type(dom, inputs[0], '-5');
    type(dom, inputs[1], '50');
    type(dom, inputs[2], '150');
    type(dom, inputs[3], '200');

    const err = fieldErrorOf(inputs[0]);
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain('有效的檢驗值');
    const result = doc.getElementById('calc-result');
    expect(result.textContent).toContain('等待輸入');
    expect(result.querySelector('.result-value')).toBeNull();

    type(dom, inputs[0], '100');
    expect(fieldErrorOf(inputs[0]).hidden).toBe(true);
    expect(doc.getElementById('calc-result').textContent).toContain('健保給付');
  });
});
