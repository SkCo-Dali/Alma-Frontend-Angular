// Catálogos: tabla de catálogos a la izquierda y panel de detalle a la derecha, con
// activar/desactivar, editar, eliminar y administración de campos.

import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PortalDirective } from '../../../shared/portal.directive';
import { colocarPanel } from '../../../shared/popover-position';
import { AuthService } from '../../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../../shared/components/access-denied.component';
import { Catalog } from './catalogs.api';
import { CatalogsStore } from './catalogs.store';
import {
  CreateCatalogDialogComponent,
  EditCatalogDialogComponent,
} from './catalog-dialogs.component';
import { FieldsManagerDialogComponent } from './fields-manager-dialog.component';

@Component({
  selector: 'alma-catalogs-page',
  imports: [
    RouterLink,
    LucideAngularModule,
    PortalDirective,
    AccessDeniedComponent,
    CreateCatalogDialogComponent,
    EditCatalogDialogComponent,
    FieldsManagerDialogComponent,
  ],
  template: `
    @if (!tieneAcceso()) {
      <alma-access-denied />
    } @else {
      <div class="w-full max-w-full space-y-6 overflow-x-hidden px-4 py-4 lg:overflow-visible">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex min-w-0 items-center gap-4">
            <a
              routerLink="/apps/motor-comisiones"
              class="alma-btn shrink-0 gap-2 px-3 text-muted-foreground hover:text-foreground"
            >
              <lucide-icon name="arrow-left" [size]="16" />
              <span>Volver</span>
            </a>
            <h1 class="truncate text-lg font-bold tracking-tight sm:text-xl">Catálogos</h1>
          </div>
          <button
            type="button"
            (click)="creando.set(true)"
            class="alma-btn alma-btn-primary h-10 w-full shrink-0 rounded-xl px-6 lg:w-auto"
          >
            <lucide-icon name="plus" [size]="16" class="mr-2" />
            Crear Catálogo
          </button>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <!-- Listado -->
          <div class="lg:col-span-2">
            <div class="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
              <h2 class="pb-3 text-lg font-semibold">Todos los Catálogos</h2>

              @if (store.loading()) {
                <div class="flex items-center justify-center py-8 text-sm">
                  <lucide-icon name="loader-2" [size]="24" class="mr-2 animate-spin" />
                  Cargando catálogos…
                </div>
              } @else if (store.error(); as err) {
                <div class="py-8 text-center text-destructive">
                  <p>Error al cargar catálogos: {{ err }}</p>
                </div>
              } @else if (store.catalogs().length === 0) {
                <div class="py-8 text-center text-sm text-muted-foreground">
                  <p>No se encontraron catálogos. Crea tu primer catálogo para comenzar.</p>
                </div>
              } @else {
                <div class="scrollbar overflow-x-auto rounded-md border border-border">
                  <table class="alma-table w-full min-w-[820px]">
                    <thead>
                      <tr>
                        <th class="px-4 py-2 text-left">Nombre</th>
                        <th class="px-4 py-2 text-left">Descripción</th>
                        <th class="px-4 py-2 text-left">Ruta de Origen</th>
                        <th class="px-4 py-2 text-left">Estado</th>
                        <th class="px-4 py-2 text-left">Creado</th>
                        <th class="px-4 py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of store.catalogs(); track c.id) {
                        <tr
                          class="cursor-pointer hover:bg-muted/50"
                          [class.bg-muted]="seleccionado()?.id === c.id"
                          (click)="seleccionado.set(c)"
                        >
                          <td class="px-4 py-2 font-medium">{{ c.name }}</td>
                          <td class="max-w-xs truncate px-4 py-2">{{ c.description || '-' }}</td>
                          <td class="max-w-xs truncate px-4 py-2 font-mono text-xs">
                            {{ c.source_path || '-' }}
                          </td>
                          <td class="px-4 py-2">
                            <span
                              class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                              [class]="
                                c.is_active
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              "
                            >
                              {{ c.is_active ? 'Activo' : 'Inactivo' }}
                            </span>
                          </td>
                          <td class="px-4 py-2">{{ fecha(c.created_at) }}</td>
                          <td class="relative px-4 py-2 text-right">
                            <button
                              type="button"
                              (click)="alternarMenu(c, $event)"
                              class="h-8 w-8 rounded-full hover:bg-primary/10"
                              aria-label="Acciones del catálogo"
                            >
                              <lucide-icon name="more-horizontal" [size]="16" />
                            </button>

                            @if (menu() === c.id) {
                              <div almaPortal class="fixed inset-0 z-[80]" (click)="menu.set(null)"></div>
                              <div
                                #panel
                                almaPortal
                                class="surface-solid fixed z-[85] min-w-[160px] rounded-xl border border-border p-1 text-left text-sm normal-case tracking-normal text-foreground shadow-[var(--shadow-lg)]"
                              >
                                <button
                                  type="button"
                                  (click)="editar(c, $event)"
                                  class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50"
                                >
                                  <lucide-icon name="pencil" [size]="16" class="text-primary" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  (click)="alternarEstado(c, $event)"
                                  class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50"
                                >
                                  <lucide-icon
                                    [name]="c.is_active ? 'power-off' : 'power'"
                                    [size]="16"
                                  />
                                  {{ c.is_active ? 'Desactivar' : 'Activar' }}
                                </button>
                                <button
                                  type="button"
                                  (click)="pedirBorrado(c, $event)"
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
          </div>

          <!-- Detalle -->
          <div class="lg:col-span-1">
            @if (seleccionado(); as c) {
              <div
                class="h-fit rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
              >
                <div class="flex items-start justify-between pb-3">
                  <div class="space-y-1">
                    <h2 class="text-lg font-semibold">Detalles del Catálogo</h2>
                    <span
                      class="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                      [class]="
                        c.is_active
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      "
                    >
                      {{ c.is_active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </div>
                  <button
                    type="button"
                    (click)="seleccionado.set(null)"
                    class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent/50"
                    aria-label="Cerrar detalle"
                  >
                    <lucide-icon name="x" [size]="16" />
                  </button>
                </div>

                <div class="space-y-4">
                  <div>
                    <h3 class="mb-1 text-sm font-medium text-muted-foreground">Nombre</h3>
                    <p class="text-sm">{{ c.name }}</p>
                  </div>
                  <div class="border-t border-border"></div>
                  <div>
                    <h3 class="mb-1 text-sm font-medium text-muted-foreground">Descripción</h3>
                    <p class="text-sm">
                      {{ c.description || 'No se proporcionó descripción' }}
                    </p>
                  </div>
                  <div class="border-t border-border"></div>
                  <div>
                    <h3 class="mb-1 text-sm font-medium text-muted-foreground">
                      Ruta de Origen
                    </h3>
                    <p class="break-all font-mono text-xs">
                      {{ c.source_path || 'No especificado' }}
                    </p>
                  </div>
                  <div class="border-t border-border"></div>
                  <div>
                    <h3 class="mb-1 text-sm font-medium text-muted-foreground">Creado</h3>
                    <p class="text-sm">{{ fechaLarga(c.created_at) }}</p>
                  </div>
                  @if (c.updated_at) {
                    <div class="border-t border-border"></div>
                    <div>
                      <h3 class="mb-1 text-sm font-medium text-muted-foreground">
                        Última Actualización
                      </h3>
                      <p class="text-sm">{{ fechaLarga(c.updated_at) }}</p>
                    </div>
                  }
                  <div class="border-t border-border"></div>
                  <button
                    type="button"
                    (click)="administrando.set(c)"
                    class="alma-btn alma-btn-outline w-full"
                  >
                    <lucide-icon name="layers" [size]="16" class="mr-2" />
                    Administrar Campos
                  </button>
                </div>
              </div>
            } @else {
              <div
                class="flex h-[600px] items-center justify-center rounded-2xl border border-border bg-card p-4 text-center text-muted-foreground shadow-[var(--shadow-sm)]"
              >
                <div>
                  <lucide-icon
                    name="layers"
                    [size]="48"
                    class="mx-auto mb-4 opacity-50"
                  />
                  <p>Selecciona un catálogo para ver detalles</p>
                </div>
              </div>
            }
          </div>
        </div>

        @if (creando()) {
          <alma-create-catalog-dialog (closed)="creando.set(false)" />
        }
        @if (enEdicion(); as c) {
          <alma-edit-catalog-dialog [catalog]="c" (closed)="enEdicion.set(null)" />
        }
        @if (administrando(); as c) {
          <alma-fields-manager-dialog [catalog]="c" (closed)="administrando.set(null)" />
        }

        @if (porBorrar(); as c) {
          <div
            class="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
            (click)="porBorrar.set(null)"
          >
            <div
              class="surface-solid w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl"
              (click)="$event.stopPropagation()"
            >
              <h2 class="text-lg font-bold">¿Estás seguro?</h2>
              <p class="mt-2 text-sm text-muted-foreground">
                Esto eliminará permanentemente el catálogo
                <span class="font-semibold text-foreground">"{{ c.name }}"</span> y todos sus
                campos. Esta acción no se puede deshacer.
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
      </div>
    }
  `,
})
export class CatalogsPageComponent implements OnInit {
  protected readonly store = inject(CatalogsStore);
  private readonly auth = inject(AuthService);

  protected readonly creando = signal(false);
  protected readonly seleccionado = signal<Catalog | null>(null);
  protected readonly enEdicion = signal<Catalog | null>(null);
  protected readonly administrando = signal<Catalog | null>(null);
  protected readonly porBorrar = signal<Catalog | null>(null);
  protected readonly borrando = signal(false);
  protected readonly menu = signal<string | null>(null);

  /** Catálogos es solo para administradores de la App (permiso `catalogs`). */
  protected readonly tieneAcceso = computed(() =>
    this.auth.hasPermission('app.motor-comisiones.catalogs'),
  );

  ngOnInit(): void {
    void this.store.cargar(true);
  }

  protected fecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO');
  }

  protected fechaLarga(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /** El menú se monta en <body> y se coloca bajo el botón. */
  @ViewChild('panel') set panelRef(el: ElementRef<HTMLElement> | undefined) {
    if (el && this.anchor) colocarPanel(el.nativeElement, this.anchor, 'end');
  }

  private anchor: DOMRect | null = null;

  protected alternarMenu(c: Catalog, ev: Event): void {
    ev.stopPropagation();
    if (this.menu() === c.id) {
      this.menu.set(null);
      return;
    }
    this.anchor = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.menu.set(c.id);
  }

  protected editar(c: Catalog, ev: Event): void {
    ev.stopPropagation();
    this.menu.set(null);
    this.enEdicion.set(c);
  }

  protected async alternarEstado(c: Catalog, ev: Event): Promise<void> {
    ev.stopPropagation();
    this.menu.set(null);
    await this.store.alternarEstado(c.id, !c.is_active);
    // El detalle abierto debe reflejar el estado nuevo.
    const actualizado = this.store.catalogs().find((x) => x.id === c.id) ?? null;
    if (this.seleccionado()?.id === c.id) this.seleccionado.set(actualizado);
  }

  protected pedirBorrado(c: Catalog, ev: Event): void {
    ev.stopPropagation();
    this.menu.set(null);
    this.porBorrar.set(c);
  }

  protected async confirmarBorrado(): Promise<void> {
    const c = this.porBorrar();
    if (!c) return;
    this.borrando.set(true);
    try {
      if (await this.store.eliminar(c.id)) {
        if (this.seleccionado()?.id === c.id) this.seleccionado.set(null);
        this.porBorrar.set(null);
      }
    } finally {
      this.borrando.set(false);
    }
  }
}
