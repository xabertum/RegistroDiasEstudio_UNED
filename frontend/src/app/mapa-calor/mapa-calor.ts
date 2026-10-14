import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { EstudioStore } from '../estudio.store';

interface Celda {
  fecha: Date;
  apartados: number;
  nivel: number;
  porAsignatura: { nombre: string; apartados: number }[];
  /** Exámenes de ese día, con el índice de color de la tarjeta de su asignatura. */
  examenes: { nombre: string; color: number }[];
  hoy: boolean;
}

interface Semana {
  /** Siete huecos de lunes a domingo; null fuera del periodo mostrado. */
  dias: (Celda | null)[];
  /** Primer día de mes que cae en esta semana, para la etiqueta superior. */
  mes: Date | null;
}

/** Umbrales de apartados al día para cada nivel de color (estilo calendario de GitHub). */
const NIVELES = [
  { desde: 1, texto: '1' },
  { desde: 2, texto: '2–3' },
  { desde: 4, texto: '4–6' },
  { desde: 7, texto: '7+' },
];

/**
 * Calendario de calor con los apartados estudiados cada día, desde el inicio del mes actual
 * hasta el último examen.
 */
@Component({
  selector: 'app-mapa-calor',
  imports: [DatePipe],
  templateUrl: './mapa-calor.html',
})
export class MapaCalorComponent {
  protected readonly store = inject(EstudioStore);
  protected readonly niveles = NIVELES;
  protected readonly diasSemana = ['lun', '', 'mié', '', 'vie', '', ''];
  protected readonly tooltip = signal<{ celda: Celda; x: number; y: number } | null>(null);

  private readonly hoy = inicioDelDia(new Date());

  protected readonly inicio = computed(() => new Date(this.hoy.getFullYear(), this.hoy.getMonth(), 1));

  protected readonly fin = computed(() => {
    const fechas = this.store.asignaturas().map((a) => inicioDelDia(new Date(a.fechaExamen)).getTime());
    return fechas.length > 0 ? new Date(Math.max(...fechas)) : null;
  });

  protected readonly asignaturas = computed(() =>
    this.store.asignaturas().map((a, i) => ({ ...a, color: i % 2, examen: clave(new Date(a.fechaExamen)) })),
  );

  protected readonly semanas = computed<Semana[]>(() => {
    const fin = this.fin();
    if (!fin) return [];
    const asignaturas = this.asignaturas();
    const porDia = new Map<string, Map<number, number>>();
    for (const d of this.store.actividad()) {
      const dia = porDia.get(d.fecha) ?? new Map<number, number>();
      dia.set(d.asignaturaId, (dia.get(d.asignaturaId) ?? 0) + d.apartados);
      porDia.set(d.fecha, dia);
    }

    const inicio = this.inicio();
    // La primera columna empieza el lunes de la semana del día 1
    const cursor = new Date(inicio);
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    const semanas: Semana[] = [];
    while (cursor <= fin) {
      const semana: Semana = { dias: [], mes: null };
      for (let i = 0; i < 7; i++) {
        const fecha = new Date(cursor);
        if (fecha < inicio || fecha > fin) {
          semana.dias.push(null);
        } else {
          const actividad = porDia.get(clave(fecha));
          const porAsignatura = asignaturas
            .filter((a) => actividad?.has(a.id))
            .map((a) => ({ nombre: a.nombre, apartados: actividad!.get(a.id)! }));
          const apartados = porAsignatura.reduce((suma, a) => suma + a.apartados, 0);
          semana.dias.push({
            fecha,
            apartados,
            nivel: NIVELES.filter((n) => apartados >= n.desde).length,
            porAsignatura,
            examenes: asignaturas.filter((a) => a.examen === clave(fecha)).map((a) => ({ nombre: a.nombre, color: a.color })),
            hoy: fecha.getTime() === this.hoy.getTime(),
          });
          if (fecha.getDate() === 1) {
            semana.mes = fecha;
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      semanas.push(semana);
    }
    return semanas;
  });

  protected readonly resumen = computed(() => {
    const dias = this.semanas().flatMap((s) => s.dias).filter((c): c is Celda => c !== null && c.apartados > 0);
    return { apartados: dias.reduce((suma, c) => suma + c.apartados, 0), dias: dias.length };
  });

  /** Días con actividad en el periodo, para la vista en tabla. */
  protected readonly filas = computed(() =>
    this.semanas()
      .flatMap((s) => s.dias)
      .filter((c): c is Celda => c !== null && c.apartados > 0)
      .flatMap((c) => c.porAsignatura.map((a) => ({ fecha: c.fecha, ...a }))),
  );

  /**
   * El tooltip va con position: fixed para que no lo recorte el scroll horizontal del mapa,
   * y se mantiene dentro de la ventana en las celdas de los bordes.
   */
  protected mostrar(celda: Celda, evento: MouseEvent): void {
    const r = (evento.target as HTMLElement).getBoundingClientRect();
    const margen = 150;
    const x = Math.min(Math.max(r.left + r.width / 2, margen), window.innerWidth - margen);
    this.tooltip.set({ celda, x, y: r.top });
  }

  protected ocultar(): void {
    this.tooltip.set(null);
  }
}

function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/** Fecha local en formato yyyy-MM-dd, el mismo que usa la API. */
function clave(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
