import { Injectable, inject, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { RUNTIME_CONFIG } from './runtime-config';
import type { Database } from './database.types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(RUNTIME_CONFIG);
  readonly cloud = this.config.mode === 'supabase';
  readonly client: SupabaseClient<Database> | null = this.config.mode === 'supabase'
    ? createClient<Database>(this.config.url, this.config.publishableKey, {
        auth: { detectSessionInUrl: false },
      })
    : null;
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.client?.auth.onAuthStateChange((_event, session) => {
      this.user.set(session?.user ?? null);
    });
  }

  async initialize(): Promise<void> {
    try {
      if (this.client) {
        const { data, error } = await this.client.auth.getSession();
        if (error) throw error;
        this.user.set(data.session?.user ?? null);
      }
    } catch (error) {
      console.error('No se ha podido recuperar la sesión', error);
      this.error.set('No se ha podido recuperar la sesión. Vuelve a iniciar sesión.');
    } finally {
      this.ready.set(true);
    }
  }

  async login(email: string, password: string): Promise<void> {
    if (!this.client) throw new Error('Supabase no está configurado.');
    this.busy.set(true);
    this.error.set(null);
    try {
      const { error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      console.error('Error de inicio de sesión', error);
      this.error.set('No se ha podido iniciar sesión. Comprueba tus credenciales y la conexión.');
    } finally {
      this.busy.set(false);
    }
  }

  async logout(): Promise<void> {
    if (!this.client) throw new Error('Supabase no está configurado.');
    this.busy.set(true);
    this.error.set(null);
    try {
      const { error } = await this.client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      this.user.set(null);
    } catch (error) {
      console.error('Error al cerrar sesión', error);
      this.error.set('No se ha podido cerrar la sesión. Inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }
}
