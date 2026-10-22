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
        auth: { detectSessionInUrl: true },
      })
    : null;
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly passwordRecovery = signal(false);
  readonly resetEmailSent = signal(false);

  constructor() {
    this.client?.auth.onAuthStateChange((event, session) => {
      this.user.set(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        this.passwordRecovery.set(true);
        this.error.set(null);
      } else if (event === 'SIGNED_OUT') {
        this.passwordRecovery.set(false);
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      if (this.client) {
        if (this.authCallbackError()) {
          this.error.set('El enlace de recuperación ha caducado o no es válido. Solicita uno nuevo.');
        }
        const { data, error } = await this.client.auth.getSession();
        if (error) throw error;
        this.user.set(data.session?.user ?? null);
      }
    } catch (error) {
      console.error('No se ha podido recuperar la sesión', error);
      this.error.set(this.authCallbackError()
        ? 'El enlace de recuperación ha caducado o no es válido. Solicita uno nuevo.'
        : 'No se ha podido recuperar la sesión. Vuelve a iniciar sesión.');
    } finally {
      this.ready.set(true);
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    if (!this.client) throw new Error('Supabase no está configurado.');
    this.busy.set(true);
    this.error.set(null);
    this.resetEmailSent.set(false);
    try {
      const redirectTo = new URL(
        document.querySelector('base')?.getAttribute('href') ?? '/',
        window.location.origin,
      ).href;
      const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      this.resetEmailSent.set(true);
    } catch (error) {
      console.error('Error al solicitar el cambio de contraseña', error);
      this.error.set('No se ha podido solicitar el cambio de contraseña. Comprueba el correo y la conexión.');
    } finally {
      this.busy.set(false);
    }
  }

  async updatePassword(password: string): Promise<void> {
    if (!this.client || !this.passwordRecovery()) {
      this.error.set('No hay una recuperación de contraseña activa. Solicita un enlace nuevo.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const { error } = await this.client.auth.updateUser({ password });
      if (error) throw error;
      this.passwordRecovery.set(false);
    } catch (error) {
      console.error('Error al actualizar la contraseña', error);
      this.error.set('No se ha podido cambiar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.');
    } finally {
      this.busy.set(false);
    }
  }

  clearPasswordReset(): void {
    this.resetEmailSent.set(false);
    this.error.set(null);
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

  private authCallbackError(): boolean {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    return query.has('error') || query.has('error_description') ||
      fragment.has('error') || fragment.has('error_description');
  }
}
