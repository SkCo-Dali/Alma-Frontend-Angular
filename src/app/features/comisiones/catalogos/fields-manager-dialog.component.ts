// Administrador de campos de un catálogo: tabla de campos con editar/eliminar y botón
// para agregar.

import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PortalDirective } from '../../../shared/portal.directive';
import { colocarPanel } from '../../../shared/popover-position';
import { Catalog, CatalogField } from './catalogs.api';
import { CatalogsStore } from './catalogs.store';
import {
  CreateFieldsDialogComponent,
  EditFieldDialogComponent,
} from './catalog-dialogs.component';

/** Color del chip por tipo de dato (mismo criterio que el original). */
const COLOR_TIPO: Record<string, string> = {
  string: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  int: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  bigint: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  decimal: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  double: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  date: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  datetime: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
};

@Component({
  selector: 'alma-fields-manager-dialog',
  imports: [
    LucideAngularModule,
    PortalDirective,
    CreateFieldsDialogComponent,
    EditFieldDialogComponent,
  ],
  template: `
    <div
      class="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
      (click)="cerrar()"
    >
      <div
        class="surface-solid flex max-h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border p-6 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold">Administrar Campos — {{ catalog().name }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              Configurar los campos para este catálogo
            </p>
          </div>
          <button
            type="button"
            (click)="agregando.set(true)"
            class="alma-btn alma-btn-primary h-9 px-3 text-xs"
          >
            <lucide-icon name="plus" [size]="16" class="mr-2" />
            Agregar Campo
          </button>
        </div>

        <div class="mt-4 min-h-0 flex-1 overflow-auto">
          @if (cargando()) {
            <div class="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <lucide-icon name="loader-2" [size]="24" class="mr-2 animate-spin" />
              Cargando campos…
            </div>
          } @else if (campos().length === 0) {
            <div class="py-8 text-center text-sm text-muted-foreground">
              No hay campos definidos aún. Agrega tu primer campo para comenzar.
            </div>
          } @else {
            <div class="scrollbar w-full overflow-auto">
              <table class="alma-table w-full min-w-[1100px] border-separate border-spacing-0">
                <thead class="sticky top-0 z-20 bg-[var(--table-header)] backdrop-blur-md">
                  <tr>
                    @for (h of encabezados; track h) {
                      <th
                        class="h-[48px] border-b border-border px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground/65"
                      >
                        {{ h }}
                      </th>
                    }
                    <th
                      class="h-[48px] w-[100px] border-b border-border px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-foreground/65"
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of campos(); track f.id) {
                    <tr class="group transition-colors hover:bg-primary/5">
                      <td class="border-b border-border px-4 py-2 font-mono text-xs">
                        {{ f.field_name }}
                      </td>
                      <td class="border-b border-border px-4 py-2 text-xs font-medium">
                        {{ f.display_name || '-' }}
                      </td>
                      <td class="border-b border-border px-4 py-2 text-xs">
                        <span
                          class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          [class]="colorTipo(f.field_type)"
                        >
                          {{ f.field_type }}
                        </span>
                      </td>
                      <td class="max-w-xs truncate border-b border-border px-4 py-2 text-xs">
                        {{ f.description || '-' }}
                      </td>
                      <td class="border-b border-border px-4 py-2 text-xs">
                        @if (f.is_filterable) {
                          <lucide-icon name="filter" [size]="16" class="text-primary" />
                        } @else {
                          <span class="text-muted-foreground">-</span>
                        }
                      </td>
                      <td class="border-b border-border px-4 py-2 text-xs">
                        @if (f.is_visible) {
                          <lucide-icon name="eye" [size]="16" class="text-primary" />
                        } @else {
                          <lucide-icon
                            name="eye-off"
                            [size]="16"
                            class="text-muted-foreground"
                          />
                        }
                      </td>
                      <td
                        class="max-w-xs truncate border-b border-border px-4 py-2 font-mono text-xs"
                      >
                        {{ f.example_value || '-' }}
                      </td>
                      <td class="relative border-b border-border px-4 py-2 text-center text-xs">
                        <button
                          type="button"
                          (click)="abrirMenu(f.id, $event)"
                          class="h-8 w-8 rounded-full hover:bg-primary/10"
                          aria-label="Acciones del campo"
                        >
                          <lucide-icon name="more-horizontal" [size]="16" />
                        </button>
                        @if (menu() === f.id) {
                          <div almaPortal class="fixed inset-0 z-[115]" (click)="menu.set(null)"></div>
                          <div
                            #panel
                            almaPortal
                            class="surface-solid fixed z-[116] min-w-[150px] rounded-xl border border-border p-1 text-left text-sm normal-case tracking-normal text-foreground shadow-[var(--shadow-lg)]"
                          >
                            <button
                              type="button"
                              (click)="editar(f)"
                              class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50"
                            >
                              <lucide-icon name="pencil" [size]="16" class="text-primary" />
                              Editar
                            </button>
                            <button
                              type="button"
                              (click)="porBorrar.set(f); menu.set(null)"
                              class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                            >
                              <lucide-icon name="trash-2" [size]="16" />
                              Eliminar
                            </button>
                          </div>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <div class="mt-4 flex justify-end border-t border-border pt-4">
          <button type="button" (click)="cerrar()" class="alma-btn alma-btn-outline">
            Cerrar
          </button>
        </div>
      </div>
    </div>

    @if (porBorrar(); as f) {
      <div
        class="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
        (click)="porBorrar.set(null)"
      >
        <div
          class="surface-solid w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <h2 class="text-lg font-bold">¿Estás seguro?</h2>
          <p class="mt-2 text-sm text-muted-foreground">
            Esto eliminará permanentemente el campo
            <span class="font-semibold text-foreground">"{{ f.field_name }}"</span>. Esta
            acción no se puede deshacer.
          </p>
          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              (click)="porBorrar.set(null)"
              class="alma-btn alma-btn-outline"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="confirmarBorrado()"
              [disabled]="borrando()"
              class="alma-btn bg-destructive text-white hover:bg-destructive/90"
            >
              {{ borrando() ? 'Eliminando…' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (agregando()) {
      <alma-create-fields-dialog
        [catalogId]="catalog().id"
        (closed)="agregando.set(false)"
      />
    }

    @if (enEdicion(); as f) {
      <alma-edit-field-dialog
        [catalogId]="catalog().id"
        [field]="f"
        (closed)="enEdicion.set(null)"
      />
    }
  `,
})
export class FieldsManagerDialogComponent implements OnInit {
  readonly catalog = input.required<Catalog>();
  readonly closed = output<void>();

  private readonly store = inject(CatalogsStore);

  protected readonly encabezados = [
    'Nombre del Campo',
    'Nombre para Mostrar',
    'Tipo',
    'Descripción',
    'Filtrable',
    'Visible',
    'Ejemplo',
  ];

  protected readonly menu = signal<string | null>(null);
  private anchor: DOMRect | null = null;

  /** El menú se monta en <body> y se coloca bajo el botón. */
  @ViewChild('panel') set panelRef(el: ElementRef<HTMLElement> | undefined) {
    if (el && this.anchor) colocarPanel(el.nativeElement, this.anchor, 'end');
  }

  protected abrirMenu(id: string, ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.menu() === id) {
      this.menu.set(null);
      return;
    }
    this.anchor = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.menu.set(id);
  }
  protected readonly agregando = signal(false);
  protected readonly enEdicion = signal<CatalogField | null>(null);
  protected readonly porBorrar = signal<CatalogField | null>(null);
  protected readonly borrando = signal(false);

  protected readonly cargando = this.store.loadingFields;
  protected readonly campos = computed(() => this.store.camposDe(this.catalog().id));

  ngOnInit(): void {
    // Se refresca al abrir: el catálogo pudo cambiar desde otra pantalla.
    void this.store.cargarCampos(this.catalog().id, true);
  }

  protected colorTipo(tipo: string): string {
    return COLOR_TIPO[tipo] || 'bg-muted text-muted-foreground';
  }

  protected editar(f: CatalogField): void {
    this.menu.set(null);
    this.enEdicion.set(f);
  }

  protected async confirmarBorrado(): Promise<void> {
    const f = this.porBorrar();
    if (!f) return;
    this.borrando.set(true);
    try {
      if (await this.store.eliminarCampo(this.catalog().id, f.id)) {
        this.porBorrar.set(null);
      }
    } finally {
      this.borrando.set(false);
    }
  }

  protected cerrar(): void {
    this.closed.emit();
  }
}
