import { InjectionToken } from '@angular/core';

export type RuntimeConfig =
  | { mode: 'backend' }
  | { mode: 'supabase'; url: string; publishableKey: string };

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RuntimeConfig');

export function parseConfig(value: unknown): RuntimeConfig {
  if (!value || typeof value !== 'object' || !('mode' in value)) {
    throw new Error('Falta la configuración de la aplicación.');
  }
  if (value.mode === 'backend') return { mode: 'backend' };
  if (
    value.mode !== 'supabase' ||
    !('url' in value) || typeof value.url !== 'string' ||
    !('publishableKey' in value) || typeof value.publishableKey !== 'string' ||
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(value.url) ||
    !value.publishableKey.startsWith('sb_publishable_')
  ) {
    throw new Error('Configura la URL y la clave publicable de Supabase. No uses claves secretas.');
  }
  return { mode: 'supabase', url: value.url, publishableKey: value.publishableKey };
}
