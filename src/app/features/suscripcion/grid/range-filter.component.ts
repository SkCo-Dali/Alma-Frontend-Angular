// Filtro de rango numérico (number/currency) embebido en el menú de columna.
// Hidrata el operador/valores desde los filtros actuales (gte+lte ⇒ between).
// Paridad RangeFilter.tsx.

import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GridFilter } from './suscripcion-grid.api';

export type RangeOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

const OPERATOR_OPTIONS: { value: RangeOp; label: string }[] = [
  { value: 'eq', label: 'Igual a...' },
  { value: 'neq', label: 'Diferente de...' },
  { value: 'gt', label: 'Mayor que...' },
  { value: 'gte', label: 'Mayor o igual a...' },
  { value: 'lt', label: 'Menor que...' },
  { value: 'lte', label: 'Menor o igual a...' },
  { value: 'between', label: 'Entre...' },
];

@Component({
  selector: 'alma-range-filter',
  imports: [FormsModule],
  template: `
    <div (click)="$event.stopPropagation()">
      <div class="space-y-3">
        <select class="alma-input h-8 text-sm" [(ngModel)]="op" (ngModelChange)="onOpChange()">
          @for (o of operadores; track o.value) {
            <option [value]="o.value">{{ o.label }}</option>
          }
        </select>

        <div>
          <label class="text-xs text-muted-foreground">
            {{ op === 'between' ? 'Desde' : 'Valor' }}
          </label>
          <input
            type="number"
            class="alma-input h-8 rounded-lg text-sm tabular-nums"
            [(ngModel)]="valor1"
          />
        </div>

        @if (op === 'between') {
          <div>
            <label class="text-xs text-muted-foreground">Hasta</label>
            <input
              type="number"
              class="alma-input h-8 rounded-lg text-sm tabular-nums"
              [(ngModel)]="valor2"
            />
          </div>
        }
      </div>

      <div class="mt-4 flex justify-between border-t border-border/60 pt-3">
        <button
          type="button"
          class="alma-btn alma-btn-outline h-8 rounded-lg text-xs text-muted-foreground"
          (click)="limpiar()"
        >
          Limpiar
        </button>
        <button
          type="button"
          class="alma-btn alma-btn-primary h-8 rounded-lg text-xs"
          (click)="aplicar()"
        >
          Aplicar
        </button>
      </div>
    </div>
  `,
})
export class RangeFilterComponent {
  readonly field = input.required<string>();
  readonly currentFilters = input.required<GridFilter[]>();
  readonly rangeChange = output<{
    field: string;
    op: RangeOp | 'clear';
    value?: number;
    value2?: number;
  }>();
  readonly requestClose = output<void>();

  protected readonly operadores = OPERATOR_OPTIONS;
  protected op: RangeOp = 'gte';
  protected valor1: number | string = '';
  protected valor2: number | string = '';

  constructor() {
    // Hidratación desde los filtros activos del campo.
    effect(() => {
      const field = this.field();
      const propios = this.currentFilters().filter((f) => f.field === field);
      if (propios.length === 0) {
        this.op = 'gte';
        this.valor1 = '';
        this.valor2 = '';
        return;
      }
      const gte = propios.find((f) => f.op === 'gte');
      const lte = propios.find((f) => f.op === 'lte');
      if (gte && lte) {
        this.op = 'between';
        this.valor1 = String(gte.value);
        this.valor2 = String(lte.value);
      } else if (propios.length === 1) {
        this.op = propios[0].op as RangeOp;
        this.valor1 = String(propios[0].value);
        this.valor2 = '';
      }
    });
  }

  protected onOpChange(): void {
    if (this.op !== 'between') this.valor2 = '';
  }

  protected aplicar(): void {
    if (this.op === 'between') {
      this.rangeChange.emit({
        field: this.field(),
        op: 'between',
        value: this.valor1 !== '' ? Number(this.valor1) : undefined,
        value2: this.valor2 !== '' ? Number(this.valor2) : undefined,
      });
    } else if (this.valor1 !== '') {
      this.rangeChange.emit({
        field: this.field(),
        op: this.op,
        value: Number(this.valor1),
      });
    }
    this.requestClose.emit();
  }

  protected limpiar(): void {
    this.valor1 = '';
    this.valor2 = '';
    this.op = 'gte';
    this.rangeChange.emit({ field: this.field(), op: 'clear' });
  }
}
