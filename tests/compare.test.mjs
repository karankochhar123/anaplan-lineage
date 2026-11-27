import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './load-core.mjs';
import { readFileSync } from 'node:fs';
import { csv, parse } from './helpers.mjs';

const H = ['Module', 'Line Item', 'Formula', 'Format', 'Summary', 'Applies To', 'Time Scale', 'Cell Count'];
const side = (rows) => { const r = parse(csv([H, ...rows])); return { items: r.items, byName: r.mods, edges: r.edges }; };
const name = (it) => `${it.module}.${it.name}`;
const compare = (b, a) => core.compareModels(side(b), side(a));

// A small made-up model, before and after a round of changes.
const BEFORE = [
  ['', '--- CALCULATIONS ---'],
  ['', 'CAL01 Costs', '', '', '', 'Region', 'Month', '1000'],
  ['CAL01 Costs', 'Rate', '', 'Number', 'None', '', 'Month', '100'],
  ['CAL01 Costs', 'Volume', '', 'Number', 'Sum', '', 'Month', '100'],
  ['CAL01 Costs', 'Cost', 'Rate * Volume', 'Number', 'Sum', '', 'Month', '100'],
  ['CAL01 Costs', 'Old Uplift', 'Cost * 1.1', 'Number', 'Sum', '', 'Month', '100'],
  ['CAL01 Costs', 'Fee', 'Volume * 2.5', 'Number', 'Sum', '', 'Month', '100'],
  ['', 'REP01 Report', '', '', '', 'Region', 'Month', '500'],
  ['REP01 Report', 'Total', 'CAL01 Costs.Cost', 'Number', 'Sum', '', 'Month', '50'],
  ['', 'CAL09 Retired', '', '', '', 'Region', 'Month', '10'],
  ['CAL09 Retired', 'Gone', '', 'Number', 'Sum', '', 'Month', '10'],
];
const AFTER = [
  ['', '--- CALCULATIONS ---'],
  ['', 'CAL01 Costs', '', '', '', 'Region', 'Month', '1000'],
  ['CAL01 Costs', 'Rate', '', 'Number', 'None', '', 'Month', '100'],
  ['CAL01 Costs', 'Volume', '', 'Number', 'Sum', '', 'Month', '300'], // cells x3
  ['CAL01 Costs', 'Cost', 'Rate  *  Volume', 'Number', 'Sum', '', 'Month', '100'], // whitespace only
  ['CAL01 Costs', 'Discount', '', 'Number', 'None', '', 'Month', '100'], // new
  ['CAL01 Costs', 'Fee', 'Volume * Rate', 'Number', 'Sum', '', 'Month', '100'], // 2.5 replaced by Rate
  ['', 'REP01 Report', '', '', '', 'Region', 'Month', '500'],
  ['REP01 Report', 'Total', 'CAL01 Costs.Cost - CAL01 Costs.Discount', 'Number', 'Formula', '', 'Month', '50'], // formula + summary
  ['', 'REP02 New Report', '', '', '', 'Region', 'Month', '50'],
  ['REP02 New Report', 'Volume Copy', 'CAL01 Costs.Volume', 'Number', 'Sum', '', 'Month', '50'],
];

test('finds modules added and removed, ignoring section dividers', () => {
  const r = compare(BEFORE, AFTER);
  assert.deepEqual(r.modules.added.map((m) => m.name), ['REP02 New Report']);
  assert.deepEqual(r.modules.removed.map((m) => m.name), ['CAL09 Retired']);
});

test('finds line items added and removed (a rename is one of each)', () => {
  const r = compare(BEFORE, AFTER);
  assert.deepEqual(r.items.added.map(name).sort(), ['CAL01 Costs.Discount', 'REP02 New Report.Volume Copy']);
  assert.deepEqual(r.items.removed.map(name).sort(), ['CAL01 Costs.Old Uplift', 'CAL09 Retired.Gone']);
});

test('lists changed fields with old and new values, ignoring whitespace in formulas', () => {
  const r = compare(BEFORE, AFTER);
  assert.deepEqual(
    r.items.changed.map((c) => [name(c.after), c.diffs.map((d) => `${d.label}: ${d.from} -> ${d.to}`)]),
    [
      ['CAL01 Costs.Fee', ['Formula: Volume * 2.5 -> Volume * Rate']],
      ['REP01 Report.Total', ['Formula: CAL01 Costs.Cost -> CAL01 Costs.Cost - CAL01 Costs.Discount', 'Summary: Sum -> Formula']],
    ],
  );
});

test('compares Applies To as a set of lists', () => {
  const rows = (applies) => [['CAL01 Costs', 'x', '', 'Number', 'Sum', applies, 'Month', '1']];
  assert.equal(compare(rows('Region, Product'), rows('Product,Region')).items.changed.length, 0);
  assert.equal(compare(rows('Region, Product'), rows('Region')).items.changed[0].diffs[0].label, 'Applies To');
});

test('skips fields that one of the exports does not have', () => {
  const b = side([['CAL01 Costs', 'x', 'a + 1', 'Number', 'Sum', '', 'Month', '1'], ['CAL01 Costs', 'a', '', 'Number', 'Sum', '', 'Month', '1']]);
  const thin = core.parseFiles([{ name: 'thin.csv', text: 'Module,Line Item,Formula\nCAL01 Costs,x,a + 1\nCAL01 Costs,a,\n' }]);
  const r = core.compareModels(b, { items: thin.items, byName: thin.mods, edges: thin.edges });
  assert.equal(r.items.changed.length, 0);
});

test('finds lineage added and removed between line items present in both exports', () => {
  const r = compare(BEFORE, AFTER);
  const links = (list) => list.map(([s, t]) => `${name(s)} -> ${name(t)}`).sort();
  // Discount -> Total is not listed: Discount is new, so it is already reported as an added line item.
  assert.deepEqual(links(r.links.added), ['CAL01 Costs.Rate -> CAL01 Costs.Fee']);
  assert.deepEqual(links(r.links.removed), []);
  const swap = compare(
    [['M', 'a', ''], ['M', 'b', ''], ['M', 'c', 'a * 2']].map((x) => [...x, 'Number']),
    [['M', 'a', ''], ['M', 'b', ''], ['M', 'c', 'b * 2']].map((x) => [...x, 'Number']),
  );
  assert.deepEqual(links(swap.links.added), ['M.b -> M.c']);
  assert.deepEqual(links(swap.links.removed), ['M.a -> M.c']);
});

test('finds architect check findings that are new or resolved', () => {
  const r = compare(BEFORE, AFTER);
  const f = (list) => list.map((x) => `${x.check}: ${name(x.it)}`).sort();
  // Old Uplift's finding is not "resolved": the line item was removed, and is listed as removed.
  assert.deepEqual(f(r.findings.resolved), ['Hard-coded numbers in formulas: CAL01 Costs.Fee']);
  assert.deepEqual(f(r.findings.added), ['Inputs in calculation modules: CAL01 Costs.Discount', 'Summary method "Formula": REP01 Report.Total']);
});

test('finds cell counts that moved by 10% or more, biggest change first', () => {
  const r = compare(BEFORE, AFTER);
  assert.deepEqual(r.cells.items.map((c) => [name(c.after), c.from, c.to]), [['CAL01 Costs.Volume', 100, 300]]);
  assert.deepEqual(r.cells.modules, []); // module rows give the same 1,000 cells
});

test('reports nothing when the exports are the same', () => {
  const r = compare(BEFORE, BEFORE);
  for (const group of Object.values(r)) for (const list of Object.values(group)) assert.equal(list.length, 0);
});

test('the two sample files differ in the ways the older one was built to show', () => {
  const read = (f) => { const r = parse(readFileSync(new URL(`../examples/${f}`, import.meta.url), 'utf8')); return { items: r.items, byName: r.mods, edges: r.edges }; };
  const r = core.compareModels(read('sample-model-older.csv'), read('sample-model.csv'));
  assert.deepEqual(r.modules.removed.map((m) => m.name), ['INP02 Old Drivers']);
  assert.deepEqual(r.items.added.map(name).sort(), ['CAL03 Variance.Old Budget Uplift', 'CAL03 Variance.Variance Comment', 'REP02 Headcount Dashboard.Salary Cost']);
  assert.deepEqual(r.items.removed.map(name).sort(), ['INP02 Old Drivers.Inflation %', 'REP02 Headcount Dashboard.Headcount Cost']);
  assert.deepEqual(r.items.changed.map((c) => `${name(c.after)}: ${c.diffs.map((d) => d.label)}`).sort(), ['CAL02 Opex Forecast.Forecast: Formula', 'CAL03 Variance.Variance %: Summary']);
  assert.deepEqual(r.links.added.map(([s, t]) => `${name(s)} -> ${name(t)}`), ['INP01 Assumptions.Opex Growth % -> CAL02 Opex Forecast.Forecast']);
  // Replacing the hard-coded 3% with the assumption also puts Opex Growth % to use.
  assert.deepEqual(r.findings.resolved.map((f) => `${f.check}: ${name(f.it)}`).sort(), [
    'Hard-coded numbers in formulas: CAL02 Opex Forecast.Forecast',
    'Not referenced by anything: INP01 Assumptions.Opex Growth %',
  ]);
  assert.ok(r.findings.added.some((f) => f.check === 'Summary method "Formula"' && name(f.it) === 'CAL03 Variance.Variance %'));
  assert.deepEqual(r.cells.modules.map((c) => [c.after.name, c.from, c.to]), [['CAL02 Opex Forecast', 192000, 384000]]);
});
