// Loads the parsing core straight out of index.html, so the tests always check the code the app runs.
// It is wrapped in a function so its names stay out of the test's globals.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!match) throw new Error('index.html has no <script id="core"> block');

export const core = vm.runInThisContext(
  `(function () {\n${match[1]}\nreturn { norm, parseCSV, decodeFormat, decodeSummary, rowsToItems, tokenize, parseFiles, layerOf, architectChecks, hardCodedNumbers, hardCodedMembers, LARGE_CELLS, compareModels };\n})()`,
  { filename: 'index.html#core' },
);
