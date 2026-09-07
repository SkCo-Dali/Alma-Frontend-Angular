// Creación de un plan de compensación. Nace en borrador; las reglas se agregan después
// desde el editor.

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommissionPlan } from './commission-plans.api';

@Component({
  selector: 'alma-create-plan-dialog',
  imports: [FormsModule],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      (click)="cerrar()"
    >
      <div
        class="surface-solid my-6 w-full max-w-[600px] rounded-2xl border border-border p-4 shadow-2xl sm:p-6"
        (click)="$event.stopPropagation()"
      >
        <div class="flex flex-col items-center justify-center space-y-2">
          <h2 class="text-xl font-bold">Crear Plan de Comisiones</h2>
          <p class="text-center text-xs text-muted-foreground sm:text-sm">
            Crea un nuevo plan de comisiones con reglas y asignaciones.
          </p>
        </div>

        <div class="mt-4 space-y-3 sm:space-y-4">
          <div>
            <label class="text-sm font-medium" for="new-plan-name">
              Nombre <span class="text-destructive">*</span>
            </label>
            <input
              id="new-plan-name"
              class="alma-input mt-1"
              placeholder="Ingrese el nombre del plan"
              [ngModel]="nombre()"
              (ngModelChange)="nombre.set($event)"
            />
            @if (!nombre().trim()) {
              <p class="mt-1 text-xs text-destructive">Nombre es obligatorio</p>
            }
          </div>

          <div>
            <label class="text-sm font-medium" for="new-plan-desc">
              Descripción <span class="text-destructive">*</span>
            </label>
            <textarea
              id="new-plan-desc"
              class="alma-input mt-1"
              rows="3"
              placeholder="Ingrese la descripción del plan"
              [ngModel]="descripcion()"
              (ngModelChange)="descripcion.set($event)"
            ></textarea>
            @if (!descripcion().trim()) {
              <p class="mt-1 text-xs text-destructive">Descripción es obligatorio</p>
            }
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium" for="new-plan-start">
                Fecha de Inicio <span class="text-destructive">*</span>
              </label>
              <input
                id="new-plan-start"
                type="date"
                class="alma-input"
                [ngModel]="inicio()"
                (ngModelChange)="inicio.set($event)"
              />
              @if (!inicio()) {
                <p class="text-xs text-destructive">Fecha de Inicio es obligatorio</p>
              }
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium" for="new-plan-end">
                Fecha de Fin <span class="text-destructive">*</span>
              </label>
              <input
                id="new-plan-end"
                type="date"
                class="alma-input"
                [min]="inicio()"
                [ngModel]="fin()"
                (ngModelChange)="fin.set($event)"
              />
              @if (!fin()) {
                <p class="text-xs text-destructive">Fecha de Fin es obligatorio</p>
              }
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            (click)="cerrar()"
            [disabled]="guardando()"
            class="alma-btn alma-btn-outline rounded-xl"
          >
            Cancelar
          </button>
          <button
            type="button"
            (click)="crear()"
            [disabled]="guardando() || !puedeGuardar()"
            class="alma-btn alma-btn-primary rounded-xl"
          >
            {{ guardando() ? 'Creando…' : 'Crear Plan' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CreatePlanDialogComponent {
  readonly createPlan =
    input.required<(data: Partial<CommissionPlan>) => Promise<CommissionPlan | null>>();
  readonly closed = output<void>();

  protected readonly guardando = signal(false);
  protected readonly nombre = signal('');
  protected readonly descripcion = signal('');
  protected readonly inicio = signal('');
  protected readonly fin = signal('');

  protected readonly puedeGuardar = computed(
    () =>
      this.nombre().trim().length > 0 &&
      this.descripcion().trim().length > 0 &&
      !!this.inicio() &&
      !!this.fin(),
  );

  protected async crear(): Promise<void> {
    if (!this.puedeGuardar()) return;
    this.guardando.set(true);
    try {
      const res = await this.createPlan()({
        name: this.nombre().trim(),
        description: this.descripcion().trim(),
        startDate: this.inicio(),
        endDate: this.fin(),
        assignmentType: 'all_users',
      });
      if (res) this.closed.emit();
    } finally {
      this.guardando.set(false);
    }
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    this.closed.emit();
  }
}
