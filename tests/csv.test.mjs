import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './load-core.mjs';

const { parseCSV } = core;

test('splits simple comma-separated rows', () => {
  assert.deepEqual(parseCSV('a,b,c\n1,2,3'), [['a', 'b', 'c'], ['1', '2', '3']]);
});

test('keeps commas, quotes and newlines inside quoted fields', () => {
  const rows = parseCSV('name,formula\nx,"IF a, b"\ny,"say ""hi"""\nz,"line1\nline2"');
  assert.deepEqual(rows[1], ['x', 'IF a, b']);
  assert.deepEqual(rows[2], ['y', 'say "hi"']);
  assert.deepEqual(rows[3], ['z', 'line1\nline2']);
});

test('handles Windows line endings and a byte order mark', () => {
  assert.deepEqual(parseCSV('﻿a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
});

test('detects tab-separated exports', () => {
  assert.deepEqual(parseCSV('a\tb\n1,5\t2'), [['a', 'b'], ['1,5', '2']]);
});

test('drops blank lines but keeps rows with empty fields', () => {
  assert.deepEqual(parseCSV('a,b\n\n,2\n'), [['a', 'b'], ['', '2']]);
});
