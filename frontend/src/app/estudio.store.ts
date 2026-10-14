import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AsignaturaDetalle, AsignaturaResumen } from './estudio.models';

@Injectable({ providedIn: 'root' })
export class EstudioStore {
  private readonly http = inject(HttpClient);

  readonly asignaturas = signal<AsignaturaResumen[]>([]);
  readonly detalle = signal<AsignaturaDetalle | null>(null);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  /** Última orden de "expandir/contraer todo"; cada nodo del árbol la aplica a su estado local. */
  readonly ordenPlegado = signal<{ abrir: boolean } | null>(null);

  async cargar(): Promise<void> {
    await this.ejecutar(async () => {
      const lista = await firstValueFrom(this.http.get<AsignaturaResumen[]>('/api/asignaturas'));
      this.asignaturas.set(lista);
      if (!this.detalle() && lista.length > 0) {
        await this.seleccionar(lista[0].id);
      }
    });
  }

  async seleccionar(id: number): Promise<void> {
    await this.ejecutar(async () => {
      this.detalle.set(await firstValueFrom(this.http.get<AsignaturaDetalle>(`/api/asignaturas/${id}`)));
    });
  }

  async marcar(temaId: number, estudiado: boolean): Promise<void> {
    await this.ejecutar(async () => {
      const detalle = await firstValueFrom(
        this.http.patch<AsignaturaDetalle>(`/api/temas/${temaId}`, { estudiado }),
      );
      this.detalle.set(detalle);
      this.reemplazarResumen(detalle.resumen);
    });
  }

  async cambiarSemana(asignaturaId: number, semana: 1 | 2): Promise<void> {
    await this.ejecutar(async () => {
      const resumen = await firstValueFrom(
        this.http.patch<AsignaturaResumen>(`/api/asignaturas/${asignaturaId}/semana`, { semana }),
      );
      this.reemplazarResumen(resumen);
      this.detalle.update((d) => (d?.resumen.id === resumen.id ? { ...d, resumen } : d));
    });
  }

  plegarTodo(abrir: boolean): void {
    this.ordenPlegado.set({ abrir });
  }

  private reemplazarResumen(resumen: AsignaturaResumen): void {
    this.asignaturas.update((lista) => lista.map((a) => (a.id === resumen.id ? resumen : a)));
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.guardando.set(true);
    this.error.set(null);
    try {
      await accion();
    } catch {
      this.error.set('No se ha podido conectar con el servidor. ¿Está arrancado el backend?');
    } finally {
      this.guardando.set(false);
    }
  }
}
