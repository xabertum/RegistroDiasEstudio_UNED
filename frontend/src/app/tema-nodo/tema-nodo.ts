import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { TemaNodo } from '../estudio.models';
import { EstudioStore } from '../estudio.store';

@Component({
  selector: 'app-tema-nodo',
  imports: [DatePipe],
  templateUrl: './tema-nodo.html',
})
export class TemaNodoComponent {
  protected readonly store = inject(EstudioStore);

  readonly nodo = input.required<TemaNodo>();
  readonly nivel = input(0);

  protected readonly abierto = signal(false);
  protected readonly tieneHijos = computed(() => this.nodo().hijos.length > 0);
  protected readonly parcial = computed(() => {
    const n = this.nodo();
    return !n.estudiado && n.apartadosEstudiados > 0;
  });
  protected readonly porcentaje = computed(() => {
    const n = this.nodo();
    return Math.round((100 * n.apartadosEstudiados) / n.totalApartados);
  });

  constructor() {
    effect(() => {
      const orden = this.store.ordenPlegado();
      if (orden) {
        this.abierto.set(orden.abrir);
      }
    });
  }

  protected marcar(evento: Event): void {
    this.store.marcar(this.nodo().id, (evento.target as HTMLInputElement).checked);
  }
}
