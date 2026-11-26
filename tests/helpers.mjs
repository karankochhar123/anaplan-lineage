import { core } from './load-core.mjs';

const quote = (c) => (/[",\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c);

/** Rows (arrays of strings) → CSV text. Short rows are padded to the header width. */
export function csv(rows) {
  const width = rows[0].length;
  return rows
    .map((r) => {
      const f = [...r];
      while (f.length < width) f.push('');
      return f.map((c) => quote(String(c))).join(',');
    })
    .join('\n');
}

/** Parse one or more CSV texts the way the app does. */
export function parse(...texts) {
  return core.parseFiles(texts.map((text, i) => ({ name: `file${i + 1}.csv`, text })));
}

/** Lineage edges as sorted "Module.Item -> Module.Item" strings (DCA edges are suffixed " [DCA]"). */
export function edges(result) {
  const name = (i) => `${result.items[i].module}.${result.items[i].name}`;
  return result.edges.map(([s, t, kind]) => `${name(s)} -> ${name(t)}${kind === 1 ? ' [DCA]' : ''}`).sort();
}

/** Shortcut: a single-file model with columns Module, Line Item, Formula. */
export function formulaModel(rows) {
  return parse(csv([['Module', 'Line Item', 'Formula'], ...rows]));
}
