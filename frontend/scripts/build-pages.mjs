import { spawnSync } from 'node:child_process';
import { copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) ||
    !publishableKey?.startsWith('sb_publishable_')) {
  throw new Error('Define SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY (sb_publishable_...). Nunca uses service_role ni sb_secret_.');
}
const root = new URL('../', import.meta.url);
const cli = fileURLToPath(new URL('node_modules/@angular/cli/bin/ng.js', root));
const result = spawnSync(process.execPath, [cli, 'build', '--base-href=/RegistroDiasEstudio_UNED/'], {
  cwd: fileURLToPath(root), stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const output = new URL('dist/frontend/browser/', root);
writeFileSync(new URL('config.json', output), JSON.stringify({ mode: 'supabase', url, publishableKey }));
copyFileSync(new URL('../backend/src/main/resources/temario.json', root), new URL('temario.json', output));
writeFileSync(new URL('.nojekyll', output), '');
console.log('Sitio listo en frontend/dist/frontend/browser. Configuración pública, sin secretos.');
