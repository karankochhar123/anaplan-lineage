import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csv, parse, edges, formulaModel } from './helpers.mjs';

test('links a line item to one in the same module', () => {
  assert.deepEqual(edges(formulaModel([['M', 'Price', ''], ['M', 'Revenue', 'Price * 2']])), ['M.Price -> M.Revenue']);
});

test('links across modules, quoted or not', () => {
  const r = formulaModel([
    ['SYS01 Rates', 'Rate', ''],
    ['REP01 P&L', 'Opex', ''],
    ['CAL01 Calc', 'A', 'SYS01 Rates.Rate'],
    ['CAL01 Calc', 'B', "'REP01 P&L'.Opex + 1"],
  ]);
  assert.deepEqual(edges(r), ['REP01 P&L.Opex -> CAL01 Calc.B', 'SYS01 Rates.Rate -> CAL01 Calc.A']);
});

test('links line items used inside [SUM: ...]', () => {
  const r = formulaModel([
    ['SYS02 Props', 'Cost Centre', ''],
    ['CAL01 Calc', 'Cost', ''],
    ['REP01 Out', 'Total', 'CAL01 Calc.Cost[SUM: SYS02 Props.Cost Centre]'],
  ]);
  assert.deepEqual(edges(r), ['CAL01 Calc.Cost -> REP01 Out.Total', 'SYS02 Props.Cost Centre -> REP01 Out.Total']);
});

test('reads names between IF, THEN, ELSE, AND and NOT', () => {
  const r = formulaModel([
    ['M', 'Is Actual', ''],
    ['M', 'Flag', ''],
    ['M', 'Actuals', ''],
    ['M', 'Forecast', ''],
    ['M', 'Out', 'IF Is Actual AND NOT Flag THEN Actuals ELSE Forecast'],
  ]);
  assert.deepEqual(edges(r), ['M.Actuals -> M.Out', 'M.Flag -> M.Out', 'M.Forecast -> M.Out', 'M.Is Actual -> M.Out']);
});

test('ignores text in double quotes, function names and numbers', () => {
  const r = formulaModel([
    ['M', 'Budget', ''],
    ['M', 'Text', ''],
    ['M', 'Comment', 'IF Budget > 1.5 THEN "Budget too high" ELSE "On " & TEXT(Budget)'],
  ]);
  assert.deepEqual(edges(r), ['M.Budget -> M.Comment']);
});

test('ignores self references such as PREVIOUS(x)', () => {
  assert.deepEqual(edges(formulaModel([['M', 'Balance', 'PREVIOUS(Balance) + 1']])), []);
});

test('skips the list argument of FINDITEM', () => {
  const r = formulaModel([
    ['M', 'Region', ''],
    ['M', 'Code', ''],
    ['M', 'Pick', 'FINDITEM(Region, Code)'],
  ]);
  assert.deepEqual(edges(r), ['M.Code -> M.Pick']);
});

test('counts a reference once even when it is used several times', () => {
  assert.equal(formulaModel([['M', 'a', ''], ['M', 'b', 'a + a * a']]).edges.length, 1);
});

test('adds dynamic cell access drivers as DCA links', () => {
  const r = parse(
    csv([
      ['Module', 'Line Item', 'Formula', 'Read Access Driver', 'Write Access Driver'],
      ['SYS01 Access', 'Can Read', '', '', ''],
      ['SYS01 Access', 'Can Write', '', '', ''],
      ['CAL01 Calc', 'Value', '', 'SYS01 Access.Can Read', 'SYS01 Access.Can Write'],
    ]),
  );
  assert.deepEqual(edges(r), [
    'SYS01 Access.Can Read -> CAL01 Calc.Value [DCA]',
    'SYS01 Access.Can Write -> CAL01 Calc.Value [DCA]',
  ]);
});

test("uses Anaplan's Referenced By column when the export has it", () => {
  const r = parse(
    csv([
      ['Module', 'Line Item', 'Formula', 'Referenced By'],
      ['M', 'a', '', "M.b, 'N, Inc'.c"],
      ['M', 'b', 'COLLECT()', ''],
      ['N, Inc', 'c', 'something the parser cannot read', ''],
    ]),
  );
  assert.equal(r.source, 'rb');
  assert.deepEqual(edges(r), ['M.a -> M.b', 'M.a -> N, Inc.c']);
});

test('falls back to formulas when Referenced By is present but empty', () => {
  const r = parse(csv([['Module', 'Line Item', 'Formula', 'Referenced By'], ['M', 'a', '', '-'], ['M', 'b', 'a', '-']]));
  assert.equal(r.source, 'formula');
  assert.deepEqual(edges(r), ['M.a -> M.b']);
});

test('explains an export with no line items', () => {
  assert.throws(() => parse('Module,Line Item,Formula\n'), /No line items found/);
});

// ---- Cases the earlier keyword-splitting parser got wrong ----

test('reads unquoted names that contain AND, OR or other keywords', () => {
  const r = formulaModel([['M', 'Profit and Loss', ''], ['M', 'Flag', 'IF Profit and Loss > 0 THEN 1 ELSE 0']]);
  assert.deepEqual(edges(r), ['M.Profit and Loss -> M.Flag']);
});

test('does not treat the LOOKUP keyword in brackets as a line item', () => {
  const r = formulaModel([['M', 'Lookup', ''], ['M', 'Src', ''], ['M', 'Key', ''], ['M', 'X', 'Src[LOOKUP: Key]']]);
  assert.deepEqual(edges(r), ['M.Key -> M.X', 'M.Src -> M.X']);
});

test('does not treat a function name after a keyword as a line item', () => {
  const r = formulaModel([['M', 'Value', ''], ['M', 'Code', ''], ['M', 'Out', 'IF Code = "" THEN 0 ELSE VALUE(Code)']]);
  assert.deepEqual(edges(r), ['M.Code -> M.Out']);
});

test('combines files with and without Referenced By', () => {
  // Referenced By is model-wide, so A's export already lists B.z. B.w feeds A.y2, which only B's formulas can show.
  const withRB = csv([
    ['Module', 'Line Item', 'Formula', 'Referenced By'],
    ['A', 'x', '', 'A.y'],
    ['A', 'y', 'x', 'B.z'],
    ['A', 'y2', 'B.w + 1', '-'],
  ]);
  const formulasOnly = csv([['Module', 'Line Item', 'Formula'], ['B', 'w', ''], ['B', 'z', 'A.y * 2']]);
  const r = parse(withRB, formulasOnly);
  assert.equal(r.source, 'mixed');
  assert.deepEqual(edges(r), ['A.x -> A.y', 'A.y -> B.z', 'B.w -> A.y2']);
});
