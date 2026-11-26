import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { core } from './load-core.mjs';
import { csv, parse } from './helpers.mjs';

const { hardCodedNumbers, hardCodedMembers, architectChecks, layerOf, LARGE_CELLS } = core;

/** Findings of one check as "Module.Item" strings (with " [detail]" when withDetail is set). */
function findings(result, title, withDetail = false) {
  const check = architectChecks({ items: result.items, byName: result.mods, edges: result.edges }).find((c) => c.t === title);
  assert.ok(check, `no check called "${title}"`);
  return check.rows.map((r) => `${r.it.module}.${r.it.name}` + (withDetail && r.detail ? ` [${r.detail}]` : '')).sort();
}
const H = ['Module', 'Line Item', 'Formula', 'Format', 'Applies To', 'Time Scale', 'Cell Count', 'Style'];
const model = (rows) => parse(csv([H, ...rows]));
const BIG = String(LARGE_CELLS * 2);

test('reads the DISCO layer from module name prefixes', () => {
  assert.equal(layerOf('DAT01 GL Actuals'), 'Data');
  assert.equal(layerOf('INP02 Assumptions'), 'Input');
  assert.equal(layerOf('SYS03 Time'), 'System');
  assert.equal(layerOf('CAL01 Payroll'), 'Calculation');
  assert.equal(layerOf('REP01 P&L'), 'Output');
  assert.equal(layerOf('Misc'), 'Other');
});

test('finds numbers typed into formulas', () => {
  assert.deepEqual(hardCodedNumbers('Budget * 1.1'), ['1.1']);
  assert.deepEqual(hardCodedNumbers('IF a > 5 THEN 10 ELSE 2'), ['5', '10', '2']);
  assert.deepEqual(hardCodedNumbers("'SYS01 Rates'.Rate * 12"), ['12']);
  assert.deepEqual(hardCodedNumbers('OFFSET(x, -3, 0) * 4'), ['4']);
});

test('ignores 0, 1, 100, numbers in names and quotes, and positions in LAG, OFFSET, ROUND and LEFT', () => {
  for (const f of ['x + 0 + 1 - 1 + 100', 'Item 2 + x', 'CAL01 Calc.Total', "'FY 2025'.Budget", '"Version 2" & x', 'LAG(x, 2, 0)', 'ROUND(x, 2)', 'LEFT(Code, 3)']) {
    assert.deepEqual(hardCodedNumbers(f), [], f);
  }
});

test('finds hard-coded list members', () => {
  const r = model([['SYS01 Flags', 'Region', '', 'List: Region']]);
  const own = r.mods.get('sys01 flags');
  assert.equal(hardCodedMembers('x[SELECT: Versions.Actual]', own, r.mods).length, 1);
  assert.equal(hardCodedMembers('IF ITEM(Versions) = Versions.Actual THEN 1 ELSE 0', own, r.mods).length, 1);
  assert.equal(hardCodedMembers("IF 'Cost Centre'.North <> ITEM('Cost Centre') THEN 1 ELSE 0", own, r.mods).length, 1);
});

test('does not flag ITEM() compared with a line item', () => {
  const r = model([['SYS01 Flags', 'Region', '', 'List: Region']]);
  assert.deepEqual(hardCodedMembers('ITEM(Region) = SYS01 Flags.Region', r.mods.get('sys01 flags'), r.mods), []);
});

test('flags inputs in calculation modules but not headings or No data items', () => {
  const r = model([
    ['CAL01 Calc', 'Typed In', '', 'Number'],
    ['CAL01 Calc', 'Section', '', 'No Data', '', '', '', 'Heading 1'],
    ['CAL01 Calc', 'Worked Out', 'Typed In * 2', 'Number'],
    ['INP01 Inputs', 'Rate', '', 'Number'],
  ]);
  assert.deepEqual(findings(r, 'Inputs in calculation modules'), ['CAL01 Calc.Typed In']);
});

test('flags calculations in data and input modules', () => {
  const r = model([
    ['DAT01 Loads', 'Amount', '', 'Number'],
    ['DAT01 Loads', 'Valid', 'Amount > 0', 'Boolean'],
    ['INP01 Inputs', 'Rate', '', 'Number'],
    ['CAL01 Calc', 'Out', 'DAT01 Loads.Amount * INP01 Inputs.Rate', 'Number'],
  ]);
  assert.deepEqual(findings(r, 'Calculations in data or input modules'), ['DAT01 Loads.Valid']);
});

test('flags subsidiary views against the module row', () => {
  const r = model([
    ['', 'CAL01 Calc', '', '', 'Region, Product', 'Month'],
    ['CAL01 Calc', 'Same', '', 'Number', '', 'Month'],
    ['CAL01 Calc', 'Same Lists', '', 'Number', 'Product, Region', 'Month'],
    ['CAL01 Calc', 'Fewer Lists', '', 'Number', 'Region', 'Month'],
    ['CAL01 Calc', 'Yearly', '', 'Number', '', 'Year'],
  ]);
  assert.deepEqual(findings(r, 'Subsidiary views'), ['CAL01 Calc.Fewer Lists', 'CAL01 Calc.Yearly']);
});

test('skips subsidiary views when the export has no module rows', () => {
  const r = model([['CAL01 Calc', 'Yearly', '', 'Number', 'Region', 'Year']]);
  assert.deepEqual(findings(r, 'Subsidiary views'), []);
});

test('flags the same formula on the same inputs, but not plain references or different inputs', () => {
  const r = model([
    ['SYS01 Rates', 'Rate', '', 'Number'],
    ['CAL01 Calc', 'Base', '', 'Number'],
    ['CAL01 Calc', 'Uplifted', 'Base * SYS01 Rates.Rate', 'Number'],
    ['CAL02 Calc', 'Base', '', 'Number'],
    ['CAL02 Calc', 'Uplifted', 'Base * SYS01 Rates.Rate', 'Number'], // same text, but its own Base
    ['REP01 Out', 'Uplift A', 'CAL01 Calc.Base * SYS01 Rates.Rate', 'Number'],
    ['REP02 Out', 'Uplift B', 'CAL01 Calc.Base * SYS01 Rates.Rate', 'Number'],
    ['REP01 Out', 'Rate Copy', 'SYS01 Rates.Rate', 'Number'],
    ['REP02 Out', 'Rate Copy', 'SYS01 Rates.Rate', 'Number'],
  ]);
  assert.deepEqual(findings(r, 'Repeated formulas'), ['REP01 Out.Uplift A', 'REP02 Out.Uplift B']);
});

test('flags formulas with four or more IFs', () => {
  const r = model([
    ['CAL01 Calc', 'a', '', 'Number'],
    ['CAL01 Calc', 'Three', 'IF a > 1 THEN 1 ELSE IF a > 2 THEN 2 ELSE IF a > 3 THEN 3 ELSE 0', 'Number'],
    ['CAL01 Calc', 'Four', 'IF a > 1 THEN 1 ELSE IF a > 2 THEN 2 ELSE IF a > 3 THEN 3 ELSE IF a > 4 THEN 4 ELSE 0', 'Number'],
    ['CAL01 Calc', 'Quoted', 'IF a > 1 THEN "IF IF IF" ELSE ""', 'Text'],
  ]);
  assert.deepEqual(findings(r, 'Deeply nested IFs', true), ['CAL01 Calc.Four [4 IFs]']);
});

test('flags costly functions only on line items above the threshold', () => {
  const r = model([
    ['CAL01 Calc', 'Code', '', 'Text', '', '', BIG],
    ['CAL01 Calc', 'Big Lookup', 'FINDITEM(Region, Code)', 'List: Region', '', '', BIG],
    ['CAL01 Calc', 'Big Label', 'Code & " total"', 'Text', '', '', BIG],
    ['CAL01 Calc', 'Small Rank', 'RANK(Code)', 'Number', '', '', '500'],
  ]);
  assert.deepEqual(findings(r, 'Costly functions on large line items', true), [
    'CAL01 Calc.Big Label [& · 2.0M cells]',
    'CAL01 Calc.Big Lookup [FINDITEM · 2.0M cells]',
  ]);
});

test('flags large Text line items', () => {
  const r = model([
    ['CAL01 Calc', 'Big Text', '', 'Text', '', '', BIG],
    ['CAL01 Calc', 'Small Text', '', 'Text', '', '', '10'],
    ['CAL01 Calc', 'Big Number', '', 'Number', '', '', BIG],
  ]);
  assert.deepEqual(findings(r, 'Large Text line items'), ['CAL01 Calc.Big Text']);
});

test('marks details that quote formulas as sensitive, for Anonymise', () => {
  const r = model([['CAL01 Calc', 'a', '', 'Number'], ['CAL01 Calc', 'b', 'a * 1.5 + x[SELECT: Versions.Actual]', 'Number']]);
  const checks = architectChecks({ items: r.items, byName: r.mods, edges: r.edges });
  for (const t of ['Hard-coded numbers in formulas', 'Hard-coded list members']) {
    assert.equal(checks.find((c) => c.t === t).rows[0].sensitive, true, t);
  }
});

test('the sample model shows one finding for each check it was built to show', () => {
  const r = parse(readFileSync(new URL('../examples/sample-model.csv', import.meta.url), 'utf8'));
  assert.deepEqual(findings(r, 'Inputs in calculation modules'), ['CAL03 Variance.Budget']);
  assert.deepEqual(findings(r, 'Subsidiary views'), ['SYS01 Time Settings.Forecast Start']);
  assert.deepEqual(findings(r, 'Repeated formulas'), ['CAL02 Opex Forecast.Salary Cost', 'REP02 Headcount Dashboard.Salary Cost']);
  assert.deepEqual(findings(r, 'Hard-coded numbers in formulas', true), [
    'CAL01 Salary Calc.Monthly Salary [12]',
    'CAL03 Variance.Old Budget Uplift [1.1]',
  ]);
});

test('keeps the original summary and tidiness checks', () => {
  const r = parse(csv([
    ['Module', 'Line Item', 'Formula', 'Format', 'Summary'],
    ['CAL01 Calc', 'Label', '', 'Text', 'Sum'],
    ['CAL01 Calc', 'Flag', '', 'Boolean', 'Any'],
    ['CAL01 Calc', 'Ratio', 'Label', 'Number', 'Formula'],
    ['CAL01 Calc', 'Long', 'Flag' + ' + 0'.repeat(80), 'Number', 'None'],
    ['REP01 Out', 'Shown', 'CAL01 Calc.Ratio', 'Number', 'Sum'],
  ]));
  assert.deepEqual(findings(r, 'Non-numeric line items with a summary method', true), ['CAL01 Calc.Label [Text · Sum]']);
  assert.deepEqual(findings(r, 'Boolean line items with a summary method', true), ['CAL01 Calc.Flag [Any]']);
  assert.deepEqual(findings(r, 'Summary method "Formula"'), ['CAL01 Calc.Ratio']);
  assert.deepEqual(findings(r, 'Not referenced by anything'), ['CAL01 Calc.Long']); // REP01 Out is an output module
  assert.deepEqual(findings(r, 'Very long formulas (300+ characters)', true), ['CAL01 Calc.Long [324 chars]']);
});

test('leaves out the summary checks when the export has no format or summary columns', () => {
  const r = parse('Module,Line Item,Formula\nCAL01 Calc,a,\nCAL01 Calc,b,a\n');
  const titles = architectChecks({ items: r.items, byName: r.mods, edges: r.edges }).map((c) => c.t);
  assert.ok(!titles.includes('Summary method "Formula"'));
  assert.ok(titles.includes('Not referenced by anything'));
});
