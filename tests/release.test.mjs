import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the version in the app header matches the latest CHANGELOG entry', () => {
  const app = read('../index.html').match(/id="appVersion"[^>]*>v(\d+\.\d+\.\d+)</)?.[1];
  const changelog = read('../CHANGELOG.md').match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
  assert.ok(app, 'index.html has no #appVersion');
  assert.ok(changelog, 'CHANGELOG.md has no version heading');
  assert.equal(app, changelog);
});
