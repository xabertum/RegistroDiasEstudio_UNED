import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { EstudioCloudModel, Progreso, leerProgreso, leerTemario } from './estudio-cloud.model';

@Injectable({ providedIn: 'root' })
export class EstudioCloudService {
  private readonly auth = inject(AuthService);
  private model: EstudioCloudModel | null = null;

  async cargar() {
    const client = this.auth.client;
    const user = this.auth.user();
    if (!client || !user) throw new Error('Inicia sesión para consultar el progreso.');
    if (!this.model) {
      const response = await fetch(new URL('temario.json', document.baseURI));
      if (!response.ok) throw new Error('No se ha podido cargar el temario.');
      this.model = new EstudioCloudModel(leerTemario(await response.json()));
    }
    const { data, error } = await client.from('study_progress')
      .select('data, revision').eq('user_id', user.id).single();
    if (error) throw new Error('No se ha podido leer el progreso. Comprueba la conexión y que tu usuario esté autorizado.', { cause: error });
    const progreso = leerProgreso(data.data);
    if (!Number.isSafeInteger(data.revision) || data.revision < 0) {
      throw new Error('La revisión del progreso no es válida.');
    }
    return {
      userId: user.id,
      revision: Number(data.revision),
      progreso,
      model: this.model,
    };
  }

  async modificar(accion: (model: EstudioCloudModel, progreso: Progreso) => Progreso): Promise<void> {
    const actual = await this.cargar();
    const client = this.auth.client;
    if (!client || this.auth.user()?.id !== actual.userId) {
      throw new Error('La sesión ha cambiado. Vuelve a cargar la página.');
    }
    const next = accion(actual.model, actual.progreso);
    const { data, error } = await client.from('study_progress')
      .update({ data: next, revision: actual.revision + 1 })
      .eq('user_id', actual.userId).eq('revision', actual.revision).select('revision');
    if (error) throw new Error('No se ha podido guardar el progreso en Supabase.', { cause: error });
    if (data.length !== 1) {
      throw new Error('El progreso cambió en otro dispositivo. Repite la acción para cargar su última versión.');
    }
  }
}
