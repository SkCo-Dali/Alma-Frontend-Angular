// Diálogos del módulo de Catálogos:
//  - CreateCatalogDialogComponent: catálogo nuevo + sus campos (el catálogo se
//    crea primero porque los campos necesitan su id; si un campo falla, los
//    demás siguen, igual que el original).
//  - EditCatalogDialogComponent: nombre, descripción y ruta de origen.
//  - CreateFieldsDialogComponent: agrega campos a un catálogo existente.
//  - EditFieldDialogComponent: edita un campo.

import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SkButtonComponent,
  SkDropdownComponent,
  SkInputComponent,
  SkSwitchComponent,
  SkTextareaComponent,
} from '@skandia/ui';
import {
  CATALOG_FIELD_TYPES,
  Catalog,
  CatalogField,
  CatalogFieldType,
  CreateCatalogFieldRequest,
} from './catalogs.api';
import { CatalogsStore } from './catalogs.store';
import { FieldRowsComponent, camposCompletos, campoVacio } from './field-rows.component';

@Component({
  selector: 'alma-create-catalog-dialog',
  imports: [
    FormsModule,
    SkSwitchComponent,
    FieldRowsComponent,
    SkButtonComponent,
    SkInputComponent,
    SkTextareaComponent,
  ],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      (click)="cerrar()"
    >
      <div
        class="surface-solid my-6 w-full max-w-[560px] rounded-2xl border border-border p-6 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <h2 class="text-lg font-bold">Crear Nuevo Catálogo</h2>
        <p class="text-sm text-muted-foreground">
          Crear un nuevo catálogo de datos para cálculos de comisiones
        </p>

        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <sk-input
              label="Nombre del Catálogo *"
              placeholder="ej., Pólizas"
              fluid
              [(ngModel)]="nombre"
            />
          </div>

          <div class="space-y-2">
            <sk-textarea
              label="Descripción"
              [rows]="3"
              placeholder="ej., Transacciones de pólizas"
              fluid
              [(ngModel)]="descripcion"
            />
          </div>

          <div class="space-y-2">
            <sk-input
              label="Ruta de Origen"
              placeholder="ej., dbfs:/mnt/fact/polizas_delta"
              helpText="Ruta al conjunto de datos en Storage/Databricks"
              fluid
              [(ngModel)]="rutaOrigen"
            />
          </div>

          <label class="flex items-center justify-between">
            <div class="space-y-0.5">
              <span class="text-sm font-medium">Activo</span>
              <p class="text-xs text-muted-foreground">
                Habilitar este catálogo para usar en reglas
              </p>
            </div>
            <sk-switch
              [checked]="activo()"
              [label]="''"
              (valueChange)="activo.set($any($event).checked)"
            />
          </label>

          <div class="mt-4 border-t border-border pt-4">
            <alma-field-rows [(campos)]="campos" />
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <sk-button
            variant="secondary"
            type="button"
            [disabled]="guardando()"
            label="Cancelar"
            (clicked)="cerrar()"
          />
          <sk-button
            variant="primary"
            type="button"
            [disabled]="guardando() || !puedeGuardar()"
            [label]="guardando() ? 'Creando…' : 'Crear Catálogo'"
            (clicked)="crear()"
          />
        </div>
      </div>
    </div>
  `,
})
export class CreateCatalogDialogComponent {
  readonly closed = output<void>();

  private readonly store = inject(CatalogsStore);

  protected nombre = '';
  protected descripcion = '';
  protected rutaOrigen = '';
  protected readonly activo = signal(true);
  protected readonly campos = signal<CreateCatalogFieldRequest[]>([campoVacio()]);
  protected readonly guardando = signal(false);

  protected readonly puedeGuardar = computed(
    () => this.nombre.trim().length > 0 && camposCompletos(this.campos()),
  );

  protected async crear(): Promise<void> {
    if (!this.puedeGuardar()) return;
    this.guardando.set(true);
    try {
      const catalogo = await this.store.crear({
        name: this.nombre.trim(),
        description: this.descripcion,
        source_path: this.rutaOrigen,
        is_active: this.activo(),
      });
      if (!catalogo) return;
      // Un campo que falle no aborta los demás (igual que el original).
      for (const campo of this.campos()) {
        try {
          await this.store.crearCampo(catalogo.id, campo);
        } catch (e) {
          console.error('Error creando el campo del catálogo:', e);
        }
      }
      this.closed.emit();
    } finally {
      this.guardando.set(false);
    }
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    this.closed.emit();
  }
}

@Component({
  selector: 'alma-edit-catalog-dialog',
  imports: [FormsModule, SkButtonComponent, SkInputComponent, SkTextareaComponent],
  template: `
    <div
      class="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
      (click)="cerrar()"
    >
      <div
        class="surface-solid w-full max-w-[560px] rounded-2xl border border-border p-6 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <h2 class="text-lg font-bold">Editar Catálogo</h2>
        <p class="text-sm text-muted-foreground">Actualizar la información del catálogo</p>

        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <sk-input label="Nombre *" fluid [(ngModel)]="nombre" />
          </div>
          <div class="space-y-2">
            <sk-textarea label="Descripción" [rows]="3" fluid [(ngModel)]="descripcion" />
          </div>
          <div class="space-y-2">
            <sk-input
              label="Ruta de Origen"
              helpText="Ruta de referencia al conjunto de datos en Storage/Databricks"
              fluid
              [(ngModel)]="rutaOrigen"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <sk-button
            variant="secondary"
            type="button"
            [disabled]="guardando()"
            label="Cancelar"
            (clicked)="cerrar()"
          />
          <sk-button
            variant="primary"
            type="button"
            [disabled]="guardando() || !nombre.trim()"
            [label]="guardando() ? 'Guardando…' : 'Guardar Cambios'"
            (clicked)="guardar()"
          />
        </div>
      </div>
    </div>
  `,
})
export class EditCatalogDialogComponent implements OnInit {
  readonly catalog = input.required<Catalog>();
  readonly closed = output<void>();

  private readonly store = inject(CatalogsStore);

  protected nombre = '';
  protected descripcion = '';
  protected rutaOrigen = '';
  protected readonly guardando = signal(false);

  ngOnInit(): void {
    const c = this.catalog();
    this.nombre = c.name;
    this.descripcion = c.description ?? '';
    this.rutaOrigen = c.source_path ?? '';
  }

  protected async guardar(): Promise<void> {
    if (!this.nombre.trim()) return;
    this.guardando.set(true);
    try {
      const ok = await this.store.actualizar(this.catalog().id, {
        name: this.nombre.trim(),
        description: this.descripcion,
        source_path: this.rutaOrigen,
      });
      if (ok) this.closed.emit();
    } finally {
      this.guardando.set(false);
    }
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    this.closed.emit();
  }
}

@Component({
  selector: 'alma-create-fields-dialog',
  imports: [FieldRowsComponent, SkButtonComponent],
  template: `
    <div
      class="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      (click)="cerrar()"
    >
      <div
        class="surface-solid my-6 w-full max-w-[700px] rounded-2xl border border-border p-6 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <h2 class="text-lg font-bold">Agregar Nuevos Campos</h2>
        <p class="text-sm text-muted-foreground">Define uno o más campos para este catálogo</p>

        <div class="max-h-[60vh] overflow-y-auto py-4">
          <alma-field-rows
            [(campos)]="campos"
            [minimoUno]="true"
            textoAgregar="Agregar Otro Campo"
          />
        </div>

        <div class="flex justify-end gap-2">
          <sk-button
            variant="secondary"
            type="button"
            [disabled]="guardando()"
            label="Cancelar"
            (clicked)="cerrar()"
          />
          <sk-button
            variant="primary"
            type="button"
            [disabled]="guardando() || !puedeGuardar()"
            [label]="guardando() ? 'Creando…' : 'Crear Campos'"
            (clicked)="crear()"
          />
        </div>
      </div>
    </div>
  `,
})
export class CreateFieldsDialogComponent {
  readonly catalogId = input.required<string>();
  readonly closed = output<void>();

  private readonly store = inject(CatalogsStore);

  protected readonly campos = signal<CreateCatalogFieldRequest[]>([campoVacio()]);
  protected readonly guardando = signal(false);

  protected readonly puedeGuardar = computed(() => camposCompletos(this.campos()));

  protected async crear(): Promise<void> {
    if (!this.puedeGuardar()) return;
    this.guardando.set(true);
    try {
      for (const campo of this.campos()) {
        await this.store.crearCampo(this.catalogId(), campo);
      }
      this.closed.emit();
    } catch (e) {
      console.error('Error creando los campos:', e);
    } finally {
      this.guardando.set(false);
    }
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    this.closed.emit();
  }
}

@Component({
  selector: 'alma-edit-field-dialog',
  imports: [
    FormsModule,
    SkSwitchComponent,
    SkButtonComponent,
    SkDropdownComponent,
    SkInputComponent,
    SkTextareaComponent,
  ],
  template: `
    <div
      class="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      (click)="cerrar()"
    >
      <div
        class="surface-solid my-6 w-full max-w-[560px] rounded-2xl border border-border p-6 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <h2 class="text-lg font-bold">Editar Campo</h2>
        <p class="text-sm text-muted-foreground">Actualizar la definición del campo</p>

        <div class="space-y-4 py-4">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="space-y-2">
              <sk-input label="Nombre del Campo *" fluid [(ngModel)]="nombre" />
            </div>
            <div class="space-y-2">
              <sk-dropdown
                label="Tipo de Campo *"
                [options]="tipoOpciones"
                fluid
                [ngModel]="tipo()"
                (ngModelChange)="tipo.set($event)"
              />
            </div>
            <div class="space-y-2">
              <sk-input label="Nombre para Mostrar" fluid [(ngModel)]="etiqueta" />
            </div>
            <div class="space-y-2">
              <sk-input label="Valor de Ejemplo" fluid [(ngModel)]="ejemplo" />
            </div>
          </div>

          <div class="space-y-2">
            <sk-textarea label="Descripción" [rows]="2" fluid [(ngModel)]="descripcion" />
          </div>

          <div class="flex gap-6">
            <label class="flex items-center gap-2 text-sm">
              <sk-switch
                [checked]="filtrable()"
                [label]="''"
                (valueChange)="filtrable.set($any($event).checked)"
              />
              Filtrable
            </label>
            <label class="flex items-center gap-2 text-sm">
              <sk-switch
                [checked]="visible()"
                [label]="''"
                (valueChange)="visible.set($any($event).checked)"
              />
              Visible
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <sk-button
            variant="secondary"
            type="button"
            [disabled]="guardando()"
            label="Cancelar"
            (clicked)="cerrar()"
          />
          <sk-button
            variant="primary"
            type="button"
            [disabled]="guardando() || !nombre.trim()"
            [label]="guardando() ? 'Guardando…' : 'Guardar Cambios'"
            (clicked)="guardar()"
          />
        </div>
      </div>
    </div>
  `,
})
export class EditFieldDialogComponent implements OnInit {
  readonly catalogId = input.required<string>();
  readonly field = input.required<CatalogField>();
  readonly closed = output<void>();

  private readonly store = inject(CatalogsStore);

  protected readonly tipoOpciones = CATALOG_FIELD_TYPES.map((t) => ({ label: t, value: t }));
  protected readonly guardando = signal(false);

  protected nombre = '';
  protected etiqueta = '';
  protected descripcion = '';
  protected ejemplo = '';
  protected readonly tipo = signal<CatalogFieldType>('string');
  protected readonly filtrable = signal(false);
  protected readonly visible = signal(true);

  ngOnInit(): void {
    const f = this.field();
    this.nombre = f.field_name;
    this.etiqueta = f.display_name ?? '';
    this.descripcion = f.description ?? '';
    this.ejemplo = f.example_value ?? '';
    this.tipo.set(f.field_type);
    this.filtrable.set(f.is_filterable);
    this.visible.set(f.is_visible);
  }

  protected async guardar(): Promise<void> {
    if (!this.nombre.trim()) return;
    this.guardando.set(true);
    try {
      const ok = await this.store.actualizarCampo(this.catalogId(), this.field().id, {
        field_name: this.nombre.trim(),
        field_type: this.tipo(),
        display_name: this.etiqueta,
        description: this.descripcion,
        example_value: this.ejemplo,
        is_filterable: this.filtrable(),
        is_visible: this.visible(),
      });
      if (ok) this.closed.emit();
    } finally {
      this.guardando.set(false);
    }
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    this.closed.emit();
  }
}
