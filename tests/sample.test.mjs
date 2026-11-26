import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { core } from './load-core.mjs';
import { parse, edges } from './helpers.mjs';

// The "Try sample model" button and examples/sample-model.csv must stay the same made-up model.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inApp = vm.runInThisContext(html.match(/const SAMPLE_ROWS=(\[[\s\S]*?\n\]);/)[1]);
const file = readFileSync(new URL('../examples/sample-model.csv', import.meta.url), 'utf8');

test('examples/sample-model.csv matches the in-app sample', () => {
  assert.deepEqual(core.parseCSV(file), inApp);
});

test('the sample model parses into the expected lineage', () => {
  const r = parse(file);
  assert.equal(r.source, 'formula');
  assert.equal(r.items.length, 31);
  assert.equal(r.modules.length, 14); // 10 modules and 4 section dividers
  assert.equal(r.edges.length, 36);
  assert.ok(edges(r).includes('CAL01 Salary Calc.Total Cost -> CAL02 Opex Forecast.Salary Cost'));
  assert.ok(edges(r).includes('REP01 P&L Report.Opex -> CAL03 Variance.Prior Report Opex')); // the deliberate flow against DISCO
});
