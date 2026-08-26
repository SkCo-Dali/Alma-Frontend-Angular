// Creación de un plan de compensación. Nace en borrador; las reglas se agregan después
// desde el editor.

import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SkButtonComponent, SkInputComponent, SkTextareaComponent } from '@skandia/ui';
import { ComisionesToast } from '../comisiones-toast.service';
import { CommissionPlan } from './commission-plans.api';

@Component({
  selector: 'alma-create-plan-dialog',
  imports: [FormsModule, SkButtonComponent, SkInputComponent, SkTextareaComponent],
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
            <sk-input
              label="Nombre *"
              placeholder="Ingrese el nombre del plan"
              [(ngModel)]="nombre"
            />
          </div>

          <div>
            <sk-textarea
              label="Descripción"
              [rows]="3"
              placeholder="Ingrese la descripción del plan"
              [(ngModel)]="descripcion"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <sk-input label="Fecha de Inicio *" type="date" [(ngModel)]="inicio" />
            </div>
            <div class="flex flex-col gap-1.5">
              <sk-input label="Fecha de Fin *" type="date" [(ngModel)]="fin" />
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <sk-button
            variant="secondary"
            type="button"
            label="Cancelar"
            [disabled]="guardando()"
            (clicked)="cerrar()"
          />
          <sk-button
            variant="primary"
            type="button"
            [label]="guardando() ? 'Creando…' : 'Crear Plan'"
            [disabled]="guardando()"
            (clicked)="crear()"
          />
        </div>
      </div>
    </div>
  `,
})
export class CreatePlanDialogComponent {
  readonly createPlan =
    input.required<(data: Partial<CommissionPlan>) => Promise<CommissionPlan | null>>();
  readonly closed = output<void>();

  private readonly toast = inject(ComisionesToast);

  protected readonly guardando = signal(false);
  protected nombre = '';
  protected descripcion = '';
  protected inicio = '';
  protected fin = '';

  protected async crear(): Promise<void> {
    if (!this.nombre || !this.descripcion || !this.inicio || !this.fin) {
      this.toast.errorGenericoConMensaje(
        'Por favor completa todos los campos requeridos.',
        'Error de validación',
      );
      return;
    }
    this.guardando.set(true);
    try {
      const res = await this.createPlan()({
        name: this.nombre,
        description: this.descripcion,
        startDate: this.inicio,
        endDate: this.fin,
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
