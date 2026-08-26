// Editor de una lista de campos de catálogo (nombre, tipo, etiqueta, ejemplo,
// descripción y banderas). Lo comparten el diálogo de crear catálogo y el de agregar
// campos a uno existente.

import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  SkButtonComponent,
  SkDropdownComponent,
  SkInputComponent,
  SkSwitchComponent,
  SkTextareaComponent,
} from '@skandia/ui';
import { CATALOG_FIELD_TYPES, CreateCatalogFieldRequest } from './catalogs.api';

export function campoVacio(): CreateCatalogFieldRequest {
  return {
    field_name: '',
    field_type: 'string',
    display_name: '',
    description: '',
    is_filterable: false,
    is_visible: true,
    example_value: '',
  };
}

/** Nombre, tipo, etiqueta y descripción son obligatorios en todos los campos. */
export function camposCompletos(campos: CreateCatalogFieldRequest[]): boolean {
  return (
    campos.length > 0 &&
    campos.every(
      (f) =>
        f.field_name.trim() &&
        f.field_type &&
        f.display_name?.trim() &&
        f.description?.trim(),
    )
  );
}

@Component({
  selector: 'alma-field-rows',
  imports: [
    FormsModule,
    LucideAngularModule,
    SkSwitchComponent,
    SkButtonComponent,
    SkDropdownComponent,
    SkInputComponent,
    SkTextareaComponent,
  ],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-base font-medium">
          Campos <span class="text-destructive">*</span>
        </span>
        <sk-button
          variant="secondary"
          type="button"
          class="h-8 px-3 text-xs"
          [label]="textoAgregar()"
          (clicked)="agregar()"
        />
      </div>

      @if (campos().length === 0) {
        <p class="text-sm text-muted-foreground">
          Se requiere al menos un campo. Haz clic en "{{ textoAgregar() }}" para empezar.
        </p>
      }

      @for (f of campos(); track $index; let i = $index) {
        <div class="relative space-y-3 rounded-lg border border-border p-4">
          @if (!minimoUno() || campos().length > 1) {
            <button
              type="button"
              (click)="quitar(i)"
              class="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive"
              aria-label="Quitar campo"
            >
              <lucide-icon name="x" [size]="16" />
            </button>
          }

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="space-y-2">
              <sk-input
                label="Nombre del Campo *"
                placeholder="ej., PolizaNumber"
                fluid
                [ngModel]="f.field_name"
                (ngModelChange)="actualizar(i, { field_name: $event })"
              />
            </div>

            <div class="space-y-2">
              <sk-dropdown
                label="Tipo de Campo *"
                [options]="tipoOpciones"
                fluid
                [ngModel]="f.field_type"
                (ngModelChange)="actualizar(i, { field_type: $event })"
              />
            </div>

            <div class="space-y-2">
              <sk-input
                label="Nombre para Mostrar *"
                placeholder="ej., Nro de Póliza"
                fluid
                [ngModel]="f.display_name"
                (ngModelChange)="actualizar(i, { display_name: $event })"
              />
            </div>

            <div class="space-y-2">
              <sk-input
                label="Valor de Ejemplo"
                placeholder="ej., 2025-ABC-000123"
                fluid
                [ngModel]="f.example_value"
                (ngModelChange)="actualizar(i, { example_value: $event })"
              />
            </div>
          </div>

          <div class="space-y-2">
            <sk-textarea
              label="Descripción *"
              [rows]="2"
              placeholder="Descripción del campo"
              fluid
              [ngModel]="f.description"
              (ngModelChange)="actualizar(i, { description: $event })"
            />
          </div>

          <div class="flex gap-6">
            <label class="flex items-center gap-2 text-sm">
              <sk-switch
                [checked]="!!f.is_filterable"
                [label]="''"
                (valueChange)="actualizar(i, { is_filterable: $any($event).checked })"
              />
              Filtrable
            </label>
            <label class="flex items-center gap-2 text-sm">
              <sk-switch
                [checked]="!!f.is_visible"
                [label]="''"
                (valueChange)="actualizar(i, { is_visible: $any($event).checked })"
              />
              Visible
            </label>
          </div>
        </div>
      }
    </div>
  `,
})
export class FieldRowsComponent {
  readonly campos = model.required<CreateCatalogFieldRequest[]>();
  /** Cuando es true no se puede quedar en cero campos (diálogo de agregar). */
  readonly minimoUno = input(false);
  readonly textoAgregar = input('Agregar Campo');

  protected readonly tipoOpciones = CATALOG_FIELD_TYPES.map((t) => ({ label: t, value: t }));

  protected agregar(): void {
    this.campos.update((prev) => [...prev, campoVacio()]);
  }

  protected quitar(i: number): void {
    this.campos.update((prev) => prev.filter((_, idx) => idx !== i));
  }

  protected actualizar(i: number, cambios: Partial<CreateCatalogFieldRequest>): void {
    this.campos.update((prev) =>
      prev.map((f, idx) => (idx === i ? { ...f, ...cambios } : f)),
    );
  }
}
