import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './load-core.mjs';
import { csv } from './helpers.mjs';

const { decodeFormat, decodeSummary, rowsToItems, parseCSV } = core;
const items = (rows) => rowsToItems(parseCSV(csv(rows)), 'test.csv');

test('decodes plain-text formats', () => {
  assert.equal(decodeFormat('Number').type, 'Number');
  assert.equal(decodeFormat('Boolean').type, 'Boolean');
  assert.deepEqual({ ...decodeFormat('List: Cost Centre') }, { type: 'List', label: 'List: Cost Centre' });
  assert.equal(decodeFormat('Time Period: Month').type, 'Time period');
  assert.equal(decodeFormat('No Data').type, 'No data');
  assert.deepEqual({ ...decodeFormat('') }, { type: '', label: '' });
});

test('decodes JSON formats', () => {
  const f = decodeFormat('{"dataType":"NUMBER","unitsType":"PERCENTAGE","decimalPlaces":1}');
  assert.deepEqual({ ...f }, { type: 'Number', label: 'Number (%) · 1 dp' });
  assert.equal(decodeFormat('{"dataType":"ENTITY"}').type, 'List');
});

test('decodes summary methods in both forms', () => {
  assert.deepEqual(
    { ...decodeSummary('{"summaryMethod":"SUM","timeSummaryMethod":"CLOSING_BALANCE"}') },
    { method: 'Sum', time: 'Closing balance' },
  );
  assert.deepEqual(
    { ...decodeSummary('{"summaryMethod":"FORMULA","timeSummarySameAsMainSummary":true}') },
    { method: 'Formula', time: 'Formula' },
  );
});

test('names plain-text summary methods the same way as JSON ones', { todo: 'map through SUM_NAMES' }, () => {
  assert.equal(decodeSummary('FIRST_NON_BLANK').method, 'First non-blank');
  assert.equal(decodeSummary('CLOSING_BALANCE').method, 'Closing balance');
});

test('finds the header row below title rows', () => {
  const r = items([['Model export', '', ''], ['Module', 'Line Item', 'Formula'], ['M', 'x', '']]);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].name, 'x');
});

test('explains a missing Formula column', () => {
  assert.throws(() => items([['Module', 'Line Item'], ['M', 'x']]), /Could not find a "Formula" column/);
});

test('reads module rows (empty Module column) as module metadata', () => {
  const r = items([
    ['Module', 'Line Item', 'Formula', 'Applies To', 'Cell Count'],
    ['', 'CAL01 Costs', '', 'Region', '1,200'],
    ['CAL01 Costs', 'Amount', '', '', '1,200'],
  ]);
  assert.equal(r.modules.length, 1);
  assert.equal(r.modules[0].appliesTo, 'Region');
  assert.equal(r.modules[0].cells, 1200);
  assert.equal(r.items[0].module, 'CAL01 Costs');
});

test('reads numbers with thousands separators and percentages', () => {
  const r = items([
    ['Module', 'Line Item', 'Formula', 'Cell Count', 'Calculation Effort'],
    ['M', 'x', '', '96,000', '04.20%'],
  ]);
  assert.equal(r.items[0].p.cells, 96000);
  assert.equal(r.items[0].p.effort, 4.2);
});

test('uses the file name as the module when the export has no Module column', () => {
  const r = rowsToItems(parseCSV('Line Item,Formula\nx,\n'), 'CAL01 Costs - Blueprint.csv');
  assert.equal(r.items[0].module, 'CAL01 Costs');
});

test('flags a file as Referenced By only when the column has values', () => {
  assert.equal(items([['Module', 'Line Item', 'Formula', 'Referenced By'], ['M', 'x', '', '-']]).hasRB, false);
  assert.equal(items([['Module', 'Line Item', 'Formula', 'Referenced By'], ['M', 'x', '', 'M.y']]).hasRB, true);
  assert.equal(items([['Module', 'Line Item', 'Formula'], ['M', 'x', '']]).hasRB, false);
});
