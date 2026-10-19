import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { parseConfig, RUNTIME_CONFIG } from './app/runtime-config';

async function main(): Promise<void> {
  const response = await fetch(new URL('config.json', document.baseURI), { cache: 'no-store' });
  if (!response.ok) throw new Error('No se ha podido cargar config.json.');
  const config = parseConfig(await response.json());
  await bootstrapApplication(App, {
    ...appConfig,
    providers: [...appConfig.providers, { provide: RUNTIME_CONFIG, useValue: config }],
  });
}

main().catch((error: unknown) => {
  console.error(error);
  const root = document.querySelector('app-root');
  if (root) {
    root.textContent = error instanceof Error ? error.message : 'No se ha podido iniciar la aplicación.';
  }
});
