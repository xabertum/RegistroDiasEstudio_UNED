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
