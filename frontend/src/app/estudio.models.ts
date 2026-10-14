export interface AsignaturaResumen {
  id: number;
  codigo: string;
  nombre: string;
  libro: string;
  examenSemana1: string;
  examenSemana2: string;
  semanaElegida: 1 | 2;
  fechaExamen: string;
  diasRestantes: number;
  totalApartados: number;
  apartadosEstudiados: number;
}

export interface TemaNodo {
  id: number;
  titulo: string;
  estudiado: boolean;
  fechaEstudiado: string | null;
  totalApartados: number;
  apartadosEstudiados: number;
  hijos: TemaNodo[];
}

export interface AsignaturaDetalle {
  resumen: AsignaturaResumen;
  temario: TemaNodo[];
}

/** Apartados de una asignatura marcados como estudiados en un día (fecha en formato yyyy-MM-dd). */
export interface ActividadDia {
  fecha: string;
  asignaturaId: number;
  apartados: number;
}
