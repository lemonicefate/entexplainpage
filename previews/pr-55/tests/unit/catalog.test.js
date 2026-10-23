import { describe, it, expect, beforeEach } from 'vitest';
import vm from 'vm';
import fs from 'fs';
import path from 'path';

const appSrc = fs.readFileSync(path.resolve(__dirname, '../../js/app.js'), 'utf-8');

function loadCatalog() {
  const window = {};
  const context = {
    window,
    document: {
      readyState: 'loading',
      getElementById: () => null,
      addEventListener: () => {}
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    console,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(appSrc, context);
  return window.ClinicCatalog;
}

describe('ClinicCatalog projection', () => {
  let ClinicCatalog;

  beforeEach(() => {
    ClinicCatalog = loadCatalog();
  });

  it('projects procedures and calculators into the same semantic item shape', () => {
    const render = () => {};
    const catalog = ClinicCatalog.create({
      categories: [
        { id: 'ent', title: '耳鼻喉' },
        { id: 'calc', title: '計算機' }
      ],
      procedures: [{
        id: 'nose', title: '鼻塞', type: 'explain', category: 'ent',
        thumbnail: 'images/nose/thumb.png', slides: 3
      }],
      calculators: [{
        id: 'bmi', title: 'BMI', subtitle: '身高體重', tabLabel: 'BMI', render
      }]
    });

    expect(catalog.items()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'nose', title: '鼻塞', href: '#/nose',
        categories: ['ent'],
        cover: expect.objectContaining({ src: 'images/nose/thumb.png' }),
        tag: { id: 'ent', label: '耳鼻喉' }
      }),
      expect.objectContaining({
        id: 'bmi', title: 'BMI', href: '#/calc/bmi',
        categories: ['calc'],
        cover: expect.objectContaining({ src: '' }),
        tag: { id: 'calc', label: '計算機' },
        tabLabel: 'BMI', render
      })
    ]));
  });

  it('uses categories[] when populated and falls back to legacy category', () => {
    const catalog = ClinicCatalog.create({
      categories: [
        { id: 'ent', title: '耳鼻喉' },
        { id: 'calc', title: '計算機' }
      ],
      procedures: [
        { id: 'multi', title: '多分類', type: 'explain', category: 'ent', categories: ['ent', 'calc'], thumbnail: 'x' },
        { id: 'legacy', title: '舊格式', type: 'explain', category: 'ent', categories: [], thumbnail: 'y' }
      ],
      calculators: []
    });

    expect(catalog.item('multi').categories).toEqual(['ent', 'calc']);
    expect(catalog.item('legacy').categories).toEqual(['ent']);
    expect(catalog.filter({ category: 'calc' }).map(item => item.id)).toEqual(['multi']);
  });

  it('filters, pins first, and sorts titles with Chinese collation', () => {
    const catalog = ClinicCatalog.create({
      categories: [{ id: 'ent', title: '耳鼻喉' }],
      procedures: [
        { id: 'z', title: '鼻塞', type: 'explain', category: 'ent', thumbnail: 'z' },
        { id: 'a', title: '打呼', type: 'explain', category: 'ent', thumbnail: 'a' },
        { id: 'b', title: '耳鳴', type: 'explain', category: 'ent', thumbnail: 'b' }
      ],
      calculators: []
    });

    expect(catalog.filter({ query: '耳', pinnedIds: ['b'] }).map(item => item.id)).toEqual(['b']);
    expect(catalog.filter({ pinnedIds: ['z'] }).map(item => item.id)).toEqual(['z', 'a', 'b']);
  });

  it('rejects invalid definitions and duplicate ids clearly', () => {
    expect(() => ClinicCatalog.create({
      categories: [{ id: 'ent', title: '耳鼻喉' }],
      procedures: [{ id: 'bad', title: '壞資料', type: 'explain', category: 'missing', thumbnail: 'x' }],
      calculators: []
    })).toThrow(/unknown category.*missing/i);

    expect(() => ClinicCatalog.create({
      categories: [{ id: 'ent', title: '耳鼻喉' }],
      procedures: [{ id: 'same', title: '圖卡', type: 'explain', category: 'ent', thumbnail: 'x' }],
      calculators: [{ id: 'same', title: '計算機', tabLabel: '同名', render: () => {} }]
    })).toThrow(/duplicate.*same/i);
  });

  it('round-trips semantic hrefs and accepts only exact calculator routes', () => {
    const render = () => {};
    const catalog = ClinicCatalog.create({
      categories: [{ id: 'ent', title: '耳鼻喉' }],
      procedures: [{ id: 'nose', title: '鼻塞', type: 'explain', category: 'ent', thumbnail: 'x' }],
      calculators: [{ id: 'bmi', title: 'BMI', tabLabel: 'BMI', render }]
    });

    expect(catalog.resolve(catalog.item('nose').href)).toMatchObject({ kind: 'procedure', id: 'nose' });
    expect(catalog.resolve(catalog.item('bmi').href)).toMatchObject({ kind: 'calculator', id: 'bmi', render });
    ['#/calc', '#/calc/', '#/calc/bmi/', '#/calc/bmi/extra', '#/calcx/bmi', '#/calc/unknown']
      .forEach(hash => expect(catalog.resolve(hash)).toEqual({ kind: 'not-found' }));
  });
});
