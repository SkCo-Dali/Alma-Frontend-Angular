// Desarrollo Comercial del Motor de Comisiones: pestañas con búsqueda y tabla.
// La clasificación se actualiza con un dropdown por fila (POST override).

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../../shared/components/alma-loader.component';
import { ParamRow, ParamTableComponent } from '../parametrizacion/param-table.component';
import { MOTOR_COMISIONES_PERMS } from '../motor-comisiones.permissions';
import { DC_SECCIONES, DC_VISTAS, DcSeccionSpec } from './dc-specs';
import { DesarrolloComercialStore, DcSeccionId } from './desarrollo-comercial.store';
import { CalificacionAgenteRecord } from './desarrollo-comercial.domain';

@Component({
  selector: 'alma-desarrollo-comercial-page',
  providers: [DesarrolloComercialStore],
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    AccessDeniedComponent,
    AlmaLoaderComponent,
    ParamTableComponent,
  ],
  template: `
    @if (!tieneAcceso()) {
      <alma-access-denied />
    } @else {
      <div class="w-full max-w-full space-y-4 overflow-x-hidden px-4 py-4 lg:overflow-visible">
        <div class="flex items-center gap-3">
          <a
            routerLink="/apps/motor-comisiones"
            class="alma-btn shrink-0 gap-2 px-3 text-muted-foreground hover:text-foreground"
          >
            <lucide-icon name="arrow-left" [size]="16" />
            <span class="hidden sm:inline">Volver</span>
          </a>
          <h1 class="truncate text-lg font-bold tracking-tight sm:text-xl">
            Desarrollo Comercial
          </h1>
        </div>

        <!-- Pestañas: selector en móvil, pills en escritorio -->
        <select
          class="alma-input cursor-pointer lg:hidden"
          [ngModel]="vista()"
          (ngModelChange)="cambiarVista($event)"
        >
          @for (v of vistas; track v.value) {
            <option [value]="v.value">{{ v.label }}</option>
          }
        </select>

        <div
          class="glass hidden w-fit gap-1 rounded-full bg-[var(--surface-sunken)] p-1 lg:inline-flex"
        >
          @for (v of vistas; track v.value) {
            <button
              type="button"
              (click)="cambiarVista(v.value)"
              class="cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-all"
              [class]="
                vista() === v.value
                  ? 'bg-card text-foreground shadow-[var(--shadow-sm)]'
                  : 'text-muted-foreground hover:text-foreground'
              "
            >
              {{ v.label }}
            </button>
          }
        </div>

        @for (id of seccionesVisibles(); track id) {
          @let spec = seccion(id);
          <div class="space-y-3 pt-2">
            <div>
              <h2 class="text-base font-bold">{{ spec.titulo }}</h2>
              @if (spec.subtitulo) {
                <p class="text-xs text-muted-foreground">{{ spec.subtitulo }}</p>
              }
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div class="relative flex w-full items-center sm:max-w-md">
                <span class="pointer-events-none absolute left-3 z-20 flex items-center">
                  <lucide-icon name="search" [size]="16" class="text-muted-foreground" />
                </span>
                <input
                  class="alma-input pl-10"
                  [placeholder]="spec.placeholderBusqueda"
                  [ngModel]="busqueda()[id] || ''"
                  (ngModelChange)="setBusqueda(id, $event)"
                />
              </div>

              @if (busqueda()[id]) {
                <button
                  type="button"
                  (click)="limpiar(id)"
                  title="Limpiar filtros"
                  class="alma-btn alma-btn-outline h-10 shrink-0 text-muted-foreground"
                >
                  <lucide-icon name="x" [size]="16" class="mr-2" />
                  Limpiar
                </button>
              }
            </div>

            @if (store.loading()[id]) {
              <div class="flex items-center justify-center py-16">
                <alma-loader [size]="72" label="Cargando registros…" />
              </div>
            } @else {
              @if (id === 'clasificacionAgentes' && store.errorClasificacionAgentes()) {
                <div
                  class="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  No se pudo consultar la API de clasificación de agentes. Revisa la consola
                  para validar la respuesta del servicio.
                </div>
              }
              <alma-param-table
                [columns]="spec.columnas"
                [rows]="filas(id)"
                [page]="pagina(id)"
                [itemsPerPage]="porPagina(id)"
                [conAcciones]="!spec.soloLectura"
                [anchoMinimo]="spec.anchoMinimo"
                (pageChange)="setPagina(id, $event)"
                (itemsPerPageChange)="setPorPagina(id, $event)"
                (seleccion)="onSeleccion(id, $event)"
              />
            }
          </div>
        }
      </div>
    }
  `,
})
export class DesarrolloComercialPageComponent implements OnInit {
  protected readonly store = inject(DesarrolloComercialStore);
  private readonly auth = inject(AuthService);

  protected readonly vistas = DC_VISTAS;

  protected readonly vista = signal('clasificacion_agentes');
  protected readonly busqueda = signal<Record<string, string>>({});
  protected readonly paginas = signal<Record<string, number>>({});
  protected readonly tamanos = signal<Record<string, number>>({});

  protected readonly tieneAcceso = computed(() =>
    this.auth.hasPermission(MOTOR_COMISIONES_PERMS.desarrolloComercial),
  );

  protected readonly seccionesVisibles = computed(
    () => DC_VISTAS.find((v) => v.value === this.vista())?.secciones ?? [],
  );

  ngOnInit(): void {
    this.store.cargarPestana(this.vista());
  }

  protected seccion(id: DcSeccionId): DcSeccionSpec {
    return DC_SECCIONES[id];
  }

  protected cambiarVista(v: string): void {
    this.vista.set(v);
    this.store.cargarPestana(v);
  }

  protected setBusqueda(id: DcSeccionId, texto: string): void {
    this.busqueda.update((prev) => ({ ...prev, [id]: texto }));
    this.setPagina(id, 1);
  }

  protected limpiar(id: DcSeccionId): void {
    this.busqueda.update((prev) => ({ ...prev, [id]: '' }));
    this.setPagina(id, 1);
  }

  protected pagina(id: DcSeccionId): number {
    return this.paginas()[id] ?? 1;
  }

  protected setPagina(id: DcSeccionId, p: number): void {
    this.paginas.update((prev) => ({ ...prev, [id]: p }));
  }

  protected porPagina(id: DcSeccionId): number {
    return this.tamanos()[id] ?? 20;
  }

  protected setPorPagina(id: DcSeccionId, n: number): void {
    this.tamanos.update((prev) => ({ ...prev, [id]: n }));
    this.setPagina(id, 1);
  }

  protected filas(id: DcSeccionId): ParamRow[] {
    const spec = this.seccion(id);
    let filas = this.store.datos(id) as ParamRow[];
    const q = (this.busqueda()[id] ?? '').trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((r) =>
      spec.buscarEn(r).some((v) => String(v ?? '').toLowerCase().includes(q)),
    );
  }

  /** Dropdown de clasificación → POST override con los campos del contrato. */
  protected onSeleccion(
    id: DcSeccionId,
    ev: { row: ParamRow; key: string; value: string },
  ): void {
    if (id !== 'clasificacionAgentes' || ev.key !== 'ClasificacionAgente') return;
    const fila: Partial<CalificacionAgenteRecord> = {
      IdAgte: Number(ev.row['IdAgte']) || 0,
      IdSociedad: Number(ev.row['IdSociedad']) || 0,
      CanalId: Number(ev.row['CanalId']) || 0,
      Periodo: Number(ev.row['Periodo']) || 0,
      ClasificacionAgente: ev.value,
      Activo: Boolean(ev.row['Activo']),
    };
    void this.store.overrideClasificacion(fila);
  }
}
