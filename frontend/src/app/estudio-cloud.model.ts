import type { ActividadDia, AsignaturaDetalle, TemaNodo } from './estudio.models';

interface TemaSeed {
  titulo: string;
  hijos?: TemaSeed[];
}

export interface AsignaturaSeed {
  codigo: string;
  nombre: string;
  libro: string;
  examenSemana1: string;
  examenSemana2: string;
  temas: TemaSeed[];
}

export interface Progreso {
  version: 1;
  semanas: Record<string, 1 | 2>;
  estudiados: Record<string, string>;
}

export function progresoVacio(): Progreso {
  return { version: 1, semanas: {}, estudiados: {} };
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function leerProgreso(value: unknown): Progreso {
  if (!record(value) || value['version'] !== 1 ||
      !record(value['semanas']) || !record(value['estudiados'])) {
    throw new Error('El progreso guardado tiene un formato no compatible.');
  }
  const semanas: Record<string, 1 | 2> = {};
  const estudiados: Record<string, string> = {};
  for (const [key, semana] of Object.entries(value['semanas'])) {
    if (semana !== 1 && semana !== 2) throw new Error('Semana guardada no válida.');
    semanas[key] = semana;
  }
  for (const [key, fecha] of Object.entries(value['estudiados'])) {
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        !Number.isFinite(Date.parse(fecha)) ||
        new Date(fecha).toISOString().slice(0, 10) !== fecha) {
      throw new Error('Fecha de estudio guardada no válida.');
    }
    estudiados[key] = fecha;
  }
  return { version: 1, semanas, estudiados };
}

export function leerTemario(value: unknown): AsignaturaSeed[] {
  const nodo = (item: unknown): item is TemaSeed =>
    record(item) && typeof item['titulo'] === 'string' &&
    (item['hijos'] === undefined || (Array.isArray(item['hijos']) && item['hijos'].every(nodo)));
  if (!Array.isArray(value) || value.length === 0 || !value.every((a: unknown) =>
    record(a) && ['codigo', 'nombre', 'libro', 'examenSemana1', 'examenSemana2']
      .every((key) => typeof a[key] === 'string') &&
    Number.isFinite(Date.parse(String(a['examenSemana1']))) &&
    Number.isFinite(Date.parse(String(a['examenSemana2']))) &&
    Array.isArray(a['temas']) && a['temas'].length > 0 && a['temas'].every(nodo))) {
    throw new Error('El temario tiene un formato no válido.');
  }
  return value;
}

export function fechaMadrid(now: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

interface NodoIndexado {
  id: number;
  clave: string;
  titulo: string;
  hijos: NodoIndexado[];
}

export class EstudioCloudModel {
  private readonly asignaturas: { seed: AsignaturaSeed; id: number; temas: NodoIndexado[] }[];
  private readonly nodos = new Map<number, NodoIndexado>();

  constructor(temario: AsignaturaSeed[]) {
    let id = 0;
    const indexar = (nodo: TemaSeed, ruta: string[]): NodoIndexado => {
      const camino = [...ruta, nodo.titulo];
      const indexed = {
        id: ++id, clave: JSON.stringify(camino), titulo: nodo.titulo,
        hijos: (nodo.hijos ?? []).map((h) => indexar(h, camino)),
      };
      this.nodos.set(indexed.id, indexed);
      return indexed;
    };
    this.asignaturas = temario.map((seed, i) => ({
      seed, id: i + 1, temas: seed.temas.map((t) => indexar(t, [seed.codigo])),
    }));
  }

  detalles(progreso: Progreso, now = new Date()): AsignaturaDetalle[] {
    const nodo = (n: NodoIndexado): TemaNodo => {
      const hijos = n.hijos.map(nodo);
      const estudiado = hijos.length > 0
        ? hijos.every((h) => h.estudiado) : !!progreso.estudiados[n.clave];
      return {
        id: n.id, titulo: n.titulo, estudiado,
        fechaEstudiado: estudiado
          ? (hijos.length ? hijos.map((h) => h.fechaEstudiado!).sort().at(-1)! : progreso.estudiados[n.clave])
          : null,
        totalApartados: hijos.length ? hijos.reduce((n, h) => n + h.totalApartados, 0) : 1,
        apartadosEstudiados: hijos.length
          ? hijos.reduce((n, h) => n + h.apartadosEstudiados, 0) : Number(estudiado),
        hijos,
      };
    };
    return this.asignaturas.map(({ seed, id, temas }) => {
      const temario = temas.map(nodo);
      const semanaElegida = progreso.semanas[seed.codigo] ?? 1;
      const fechaExamen = semanaElegida === 1 ? seed.examenSemana1 : seed.examenSemana2;
      return {
        resumen: {
          id, codigo: seed.codigo, nombre: seed.nombre, libro: seed.libro,
          examenSemana1: seed.examenSemana1, examenSemana2: seed.examenSemana2,
          semanaElegida, fechaExamen,
          diasRestantes: Math.round(
            (Date.parse(fechaExamen.slice(0, 10)) - Date.parse(fechaMadrid(now))) / 86_400_000),
          totalApartados: temario.reduce((n, h) => n + h.totalApartados, 0),
          apartadosEstudiados: temario.reduce((n, h) => n + h.apartadosEstudiados, 0),
        },
        temario,
      };
    }).sort((a, b) => a.resumen.fechaExamen.localeCompare(b.resumen.fechaExamen));
  }

  marcar(progreso: Progreso, id: number, estudiado: boolean, now = new Date()): Progreso {
    const tema = this.nodos.get(id);
    if (!tema) throw new Error('Tema no encontrado.');
    const next = structuredClone(progreso);
    const marcar = (n: NodoIndexado): void => {
      if (n.hijos.length) n.hijos.forEach(marcar);
      else if (estudiado) next.estudiados[n.clave] ??= fechaMadrid(now);
      else delete next.estudiados[n.clave];
    };
    marcar(tema);
    return next;
  }

  cambiarSemana(progreso: Progreso, id: number, semana: 1 | 2): Progreso {
    const asignatura = this.asignaturas.find((a) => a.id === id);
    if (!asignatura) throw new Error('Asignatura no encontrada.');
    if (semana !== 1 && semana !== 2) throw new Error('Semana no válida.');
    return {
      ...progreso,
      semanas: { ...progreso.semanas, [asignatura.seed.codigo]: semana },
    };
  }

  actividad(progreso: Progreso): ActividadDia[] {
    const dias = new Map<string, ActividadDia>();
    const acumular = (n: NodoIndexado, asignaturaId: number): void => {
      if (n.hijos.length) { n.hijos.forEach((h) => acumular(h, asignaturaId)); return; }
      const fecha = progreso.estudiados[n.clave];
      if (!fecha) return;
      const clave = `${asignaturaId}:${fecha}`;
      const actual = dias.get(clave) ?? { fecha, asignaturaId, apartados: 0 };
      actual.apartados++;
      dias.set(clave, actual);
    };
    this.asignaturas.forEach((a) => a.temas.forEach((n) => acumular(n, a.id)));
    return [...dias.values()].sort((a, b) =>
      a.fecha.localeCompare(b.fecha) || a.asignaturaId - b.asignaturaId);
  }
}
