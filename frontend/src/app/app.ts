import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { AsignaturaResumen } from './estudio.models';
import { EstudioStore } from './estudio.store';
import { MapaCalorComponent } from './mapa-calor/mapa-calor';
import { TemaNodoComponent } from './tema-nodo/tema-nodo';

@Component({
  selector: 'app-root',
  imports: [DatePipe, DecimalPipe, MapaCalorComponent, TemaNodoComponent],
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly store = inject(EstudioStore);
  protected readonly hoy = new Date();
  protected readonly seleccionadaId = computed(() => this.store.detalle()?.resumen.id ?? null);

  ngOnInit(): void {
    this.store.cargar();
  }

  protected porcentaje(a: AsignaturaResumen): number {
    return a.totalApartados === 0 ? 0 : Math.round((100 * a.apartadosEstudiados) / a.totalApartados);
  }

  /** Apartados que habría que estudiar cada semana para terminar el temario antes del examen. */
  protected ritmoSemanal(a: AsignaturaResumen): number {
    const pendientes = a.totalApartados - a.apartadosEstudiados;
    return (pendientes * 7) / Math.max(a.diasRestantes, 1);
  }

  /** Días restantes expresados en semanas completas más los días sueltos, p. ej. "14 semanas y 6 días". */
  protected textoSemanas(dias: number): string {
    const semanas = Math.floor(dias / 7);
    const resto = dias % 7;
    const textoSemanas = semanas === 1 ? '1 semana' : `${semanas} semanas`;
    if (resto === 0) return textoSemanas;
    return `${textoSemanas} y ${resto === 1 ? '1 día' : `${resto} días`}`;
  }

  /** Tiempo hasta el examen en meses naturales más los días sueltos, p. ej. "3 meses y 14 días". */
  protected textoMeses(fechaExamen: string): string | null {
    const desde = new Date(this.hoy.getFullYear(), this.hoy.getMonth(), this.hoy.getDate());
    const examen = new Date(fechaExamen);
    const hasta = new Date(examen.getFullYear(), examen.getMonth(), examen.getDate());

    let meses = (hasta.getFullYear() - desde.getFullYear()) * 12 + hasta.getMonth() - desde.getMonth();
    if (this.sumarMeses(desde, meses) > hasta) meses--;
    if (meses < 1) return null;
    const resto = Math.round((hasta.getTime() - this.sumarMeses(desde, meses).getTime()) / 86_400_000);

    const textoMeses = meses === 1 ? '1 mes' : `${meses} meses`;
    if (resto === 0) return textoMeses;
    return `${textoMeses} y ${resto === 1 ? '1 día' : `${resto} días`}`;
  }

  /** Suma meses a una fecha sin desbordar al mes siguiente (31 ene + 1 mes = 28/29 feb). */
  private sumarMeses(fecha: Date, meses: number): Date {
    const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + meses + 1, 0).getDate();
    return new Date(fecha.getFullYear(), fecha.getMonth() + meses, Math.min(fecha.getDate(), ultimoDia));
  }

  protected textoDias(dias: number): string {
    if (dias < 0) return 'Examen realizado';
    if (dias === 0) return '¡El examen es hoy!';
    if (dias === 1) return 'Falta 1 día';
    return `Faltan ${dias} días`;
  }
}
