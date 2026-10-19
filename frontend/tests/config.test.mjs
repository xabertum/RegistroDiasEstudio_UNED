import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseConfig } from '../src/app/runtime-config.ts';

test('configuration explicitly selects local or Supabase mode and rejects secret keys', () => {
  assert.deepEqual(parseConfig({ mode: 'backend' }), { mode: 'backend' });
  const cloud = {
    mode: 'supabase', url: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_nonfunctional_test',
  };
  assert.deepEqual(parseConfig(cloud), cloud);
  for (const invalid of [
    null, {}, { mode: 'unknown' },
    { ...cloud, publishableKey: 'sb_secret_never_public' },
    { ...cloud, publishableKey: 'eyJhbGciOiJIUzI1NiJ9.service_role' },
    { ...cloud, url: 'http://example.supabase.co' },
    { ...cloud, url: 'https://example.supabase.co.attacker.invalid' },
  ]) assert.throws(() => parseConfig(invalid));
});

test('Pages build refuses missing configuration or private credentials before compiling', () => {
  const script = fileURLToPath(new URL('../scripts/build-pages.mjs', import.meta.url));
  for (const key of ['', 'sb_secret_never_public', 'eyJ.service_role']) {
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: key },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Nunca uses service_role/);
  }
});
