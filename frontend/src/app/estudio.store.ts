import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActividadDia, AsignaturaDetalle, AsignaturaResumen } from './estudio.models';
import { AuthService } from './auth.service';
import { EstudioCloudService } from './estudio-cloud.service';

@Injectable({ providedIn: 'root' })
export class EstudioStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly cloud = inject(EstudioCloudService);
  private generation = 0;

  readonly asignaturas = signal<AsignaturaResumen[]>([]);
  readonly detalle = signal<AsignaturaDetalle | null>(null);
  readonly actividad = signal<ActividadDia[]>([]);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  /** Última orden de "expandir/contraer todo"; cada nodo del árbol la aplica a su estado local. */
  readonly ordenPlegado = signal<{ abrir: boolean } | null>(null);

  async cargar(): Promise<void> {
    await this.ejecutar(async () => {
      if (this.auth.cloud) {
        await this.refrescarCloud();
        return;
      }
      const lista = await firstValueFrom(this.http.get<AsignaturaResumen[]>('/api/asignaturas'));
      this.asignaturas.set(lista);
      await this.cargarActividad();
      if (!this.detalle() && lista.length > 0) {
        this.detalle.set(await firstValueFrom(
          this.http.get<AsignaturaDetalle>(`/api/asignaturas/${lista[0].id}`)));
      }
    });
  }

  async seleccionar(id: number): Promise<void> {
    await this.ejecutar(async () => {
      if (this.auth.cloud) {
        await this.refrescarCloud(id);
        return;
      }
      this.detalle.set(await firstValueFrom(this.http.get<AsignaturaDetalle>(`/api/asignaturas/${id}`)));
    });
  }

  async marcar(temaId: number, estudiado: boolean): Promise<void> {
    await this.ejecutar(async () => {
      if (this.auth.cloud) {
        await this.cloud.modificar((model, progreso) => model.marcar(progreso, temaId, estudiado));
        await this.refrescarCloud();
        return;
      }
      const detalle = await firstValueFrom(
        this.http.patch<AsignaturaDetalle>(`/api/temas/${temaId}`, { estudiado }),
      );
      this.detalle.set(detalle);
      this.reemplazarResumen(detalle.resumen);
      await this.cargarActividad();
    });
  }

  async cambiarSemana(asignaturaId: number, semana: 1 | 2): Promise<void> {
    await this.ejecutar(async () => {
      if (this.auth.cloud) {
        await this.cloud.modificar((model, progreso) => model.cambiarSemana(progreso, asignaturaId, semana));
        await this.refrescarCloud();
        return;
      }
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

  limpiar(): void {
    this.generation++;
    this.asignaturas.set([]);
    this.detalle.set(null);
    this.actividad.set([]);
    this.ordenPlegado.set(null);
    this.error.set(null);
    this.guardando.set(false);
  }

  private async refrescarCloud(id = this.detalle()?.resumen.id): Promise<void> {
    const generation = this.generation;
    const actual = await this.cloud.cargar();
    if (this.auth.user()?.id !== actual.userId || generation !== this.generation) return;
    const detalles = actual.model.detalles(actual.progreso);
    this.asignaturas.set(detalles.map((d) => d.resumen));
    this.detalle.set(detalles.find((d) => d.resumen.id === id) ?? detalles[0] ?? null);
    this.actividad.set(actual.model.actividad(actual.progreso));
  }

  private reemplazarResumen(resumen: AsignaturaResumen): void {
    this.asignaturas.update((lista) => lista.map((a) => (a.id === resumen.id ? resumen : a)));
  }

  private async cargarActividad(): Promise<void> {
    this.actividad.set(await firstValueFrom(this.http.get<ActividadDia[]>('/api/actividad')));
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    if (this.guardando()) return;
    const generation = this.generation;
    this.guardando.set(true);
    this.error.set(null);
    try {
      await accion();
    } catch (error) {
      console.error('Error en el registro de estudio', error);
      if (generation === this.generation) {
        this.error.set(error instanceof Error && !(error instanceof HttpErrorResponse)
          ? error.message
          : 'No se ha podido conectar con el servidor. ¿Está arrancado el backend?');
      }
    } finally {
      if (generation === this.generation) this.guardando.set(false);
    }
  }
}
