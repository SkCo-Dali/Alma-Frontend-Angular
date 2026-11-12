// Editor de un filtro de casos de Salesforce (Origen del caso / Responder a): una lista de
// condiciones «campo [es igual a | contiene | …] valor». Basta cumplir UNA de las positivas
// y deben cumplirse TODAS las de exclusión; el texto de abajo lo dice con las palabras del
// propio filtro para que quien lo edita vea qué casos entran.

import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CondicionFiltro, Operador } from './casos.api';
import { OPERADORES, describirFiltro, limpiarCondiciones } from './casos.domain';

@Component({
  selector: 'alma-filtro-condiciones',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-xs font-semibold text-foreground">{{ titulo() }}</h3>
        <button type="button" class="text-xs font-medium text-primary hover:underline disabled:opacity-40"
                [disabled]="condiciones().length >= maximo" (click)="agregar()">
          + Agregar condición
        </button>
      </div>

      <div class="space-y-1.5">
        @for (c of condiciones(); track $index; let i = $index) {
          <div class="flex items-center gap-2">
            <select class="alma-input h-8 w-36 shrink-0 text-xs" [name]="id() + 'op' + i" [attr.aria-label]="'Operador de la condición ' + (i + 1) + ' de ' + titulo()"
                    [ngModel]="c.operador" (ngModelChange)="editar(i, { operador: $event })">
              @for (o of operadores; track o.valor) { <option [value]="o.valor">{{ o.texto }}</option> }
            </select>
            <input class="alma-input h-8 min-w-0 flex-1 text-xs" maxlength="100" autocomplete="off" [name]="id() + 'valor' + i"
                   [attr.aria-label]="'Valor de la condición ' + (i + 1) + ' de ' + titulo()" [placeholder]="ejemplo()"
                   [ngModel]="c.valor" (ngModelChange)="editar(i, { valor: $event })" />
            <button type="button" class="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    [attr.aria-label]="'Quitar la condición ' + (i + 1) + ' de ' + titulo()" (click)="quitar(i)">
              <lucide-icon name="trash-2" [size]="14" />
            </button>
          </div>
        } @empty {
          <p class="rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
            {{ vacio() }}
          </p>
        }
      </div>

      @if (frase(); as f) {
        <p class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2 text-[11px] text-muted-foreground">
          <span class="font-semibold text-foreground">Entran los casos cuyo </span>{{ f }}.
        </p>
      }
    </div>
  `,
})
export class FiltroCondicionesComponent {
  readonly condiciones = model.required<CondicionFiltro[]>();
  readonly titulo = input.required<string>();
  /** Nombre del campo en la frase de resumen («Origen», «Responder a»). */
  readonly campo = input.required<string>();
  readonly id = input.required<string>();
  readonly ejemplo = input('');
  readonly vacio = input('Sin condiciones.');

  protected readonly maximo = 20;
  protected readonly operadores = OPERADORES;

  protected readonly frase = computed(() => describirFiltro(this.campo(), limpiarCondiciones(this.condiciones())));

  protected agregar(): void {
    this.condiciones.set([...this.condiciones(), { operador: 'igual', valor: '' }]);
  }

  protected quitar(i: number): void {
    this.condiciones.set(this.condiciones().filter((_, j) => j !== i));
  }

  protected editar(i: number, cambio: { operador?: Operador; valor?: string }): void {
    this.condiciones.set(this.condiciones().map((c, j) => (j === i ? { ...c, ...cambio } : c)));
  }
}
