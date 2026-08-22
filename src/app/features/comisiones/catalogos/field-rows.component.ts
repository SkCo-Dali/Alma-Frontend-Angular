// Editor de una lista de campos de catálogo (nombre, tipo, etiqueta, ejemplo,
// descripción y banderas). Lo comparten el diálogo de crear catálogo y el de
// agregar campos a uno existente. Paridad CatalogFieldsList.tsx.

import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaSwitchComponent } from '../../../shared/components/alma-switch.component';
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
  imports: [FormsModule, LucideAngularModule, AlmaSwitchComponent],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-base font-medium">
          Campos <span class="text-destructive">*</span>
        </span>
        <button type="button" (click)="agregar()" class="alma-btn alma-btn-outline h-8 px-3 text-xs">
          {{ textoAgregar() }}
        </button>
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
              <label class="text-sm font-medium" [for]="'field_name_' + i">
                Nombre del Campo <span class="text-destructive">*</span>
              </label>
              <input
                [id]="'field_name_' + i"
                class="alma-input"
                placeholder="ej., PolizaNumber"
                [ngModel]="f.field_name"
                (ngModelChange)="actualizar(i, { field_name: $event })"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium" [for]="'field_type_' + i">
                Tipo de Campo <span class="text-destructive">*</span>
              </label>
              <select
                [id]="'field_type_' + i"
                class="alma-input"
                [ngModel]="f.field_type"
                (ngModelChange)="actualizar(i, { field_type: $event })"
              >
                @for (t of tipos; track t) {
                  <option [value]="t">{{ t }}</option>
                }
              </select>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium" [for]="'display_name_' + i">
                Nombre para Mostrar <span class="text-destructive">*</span>
              </label>
              <input
                [id]="'display_name_' + i"
                class="alma-input"
                placeholder="ej., Nro de Póliza"
                [ngModel]="f.display_name"
                (ngModelChange)="actualizar(i, { display_name: $event })"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium" [for]="'example_' + i">
                Valor de Ejemplo
              </label>
              <input
                [id]="'example_' + i"
                class="alma-input"
                placeholder="ej., 2025-ABC-000123"
                [ngModel]="f.example_value"
                (ngModelChange)="actualizar(i, { example_value: $event })"
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium" [for]="'description_' + i">
              Descripción <span class="text-destructive">*</span>
            </label>
            <textarea
              [id]="'description_' + i"
              class="alma-input"
              rows="2"
              placeholder="Descripción del campo"
              [ngModel]="f.description"
              (ngModelChange)="actualizar(i, { description: $event })"
            ></textarea>
          </div>

          <div class="flex gap-6">
            <div class="flex items-center gap-2 text-sm">
              <alma-switch
                [checked]="!!f.is_filterable"
                (checkedChange)="actualizar(i, { is_filterable: $event })"
                ariaLabel="Filtrable"
              />
              Filtrable
            </div>
            <div class="flex items-center gap-2 text-sm">
              <alma-switch
                [checked]="!!f.is_visible"
                (checkedChange)="actualizar(i, { is_visible: $event })"
                ariaLabel="Visible"
              />
              Visible
            </div>
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

  protected readonly tipos = CATALOG_FIELD_TYPES;

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
