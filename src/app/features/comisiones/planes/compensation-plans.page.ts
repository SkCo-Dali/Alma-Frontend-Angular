// Planes de Compensación: 5 tabs por estado (con conteo), buscador con debounce y la
// tabla del estado activo.

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent } from '@skandia/ui';
import { AuthService } from '../../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../../shared/components/access-denied.component';
import { BusquedaDebounceComponent } from '../ui/busqueda-debounce.component';
import {
  ALL_STATUSES,
  CommissionPlanStatus,
  STATUS_LABELS,
} from './commission-plans.api';
import { CommissionPlansStore } from './commission-plans.store';
import { CreatePlanDialogComponent } from './create-plan-dialog.component';
import { PlansTableComponent } from './plans-table.component';

@Component({
  selector: 'alma-compensation-plans-page',
  providers: [CommissionPlansStore],
  imports: [
    RouterLink,
    LucideAngularModule,
    SkButtonComponent,
    AccessDeniedComponent,
    BusquedaDebounceComponent,
    CreatePlanDialogComponent,
    PlansTableComponent,
  ],
  template: `
    @if (!tieneAcceso()) {
      <alma-access-denied />
    } @else {
      <div class="w-full max-w-full space-y-3 overflow-x-hidden px-4 py-3 lg:overflow-visible">
        <!-- Toolbar de una fila para dejarle el máximo alto a la tabla -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <a
              routerLink="/apps/motor-comisiones"
              class="alma-btn shrink-0 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            >
              <lucide-icon name="arrow-left" [size]="16" />
              <span class="hidden sm:inline">Volver</span>
            </a>
            <h1 class="truncate text-lg font-bold tracking-tight sm:text-xl">
              Planes de Compensación
            </h1>
          </div>
          <sk-button
            type="button"
            variant="primary"
            label="Crear Plan"
            class="h-9 shrink-0 rounded-xl px-4"
            (clicked)="creando.set(true)"
          />
        </div>

        <!-- Búsqueda y limpieza de filtros -->
        <div class="flex w-full flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div class="flex w-full flex-wrap items-center gap-2 sm:max-w-md">
            <div class="min-w-[200px] flex-1">
              <alma-busqueda-debounce
                [searchTerm]="store.searchTerm()"
                (searchChange)="store.setSearchTerm($event)"
              />
            </div>
            <div class="flex items-center gap-2">
              @if (store.hayFiltros()) {
                <sk-button
                  type="button"
                  variant="tertiary"
                  icon="times"
                  label="Limpiar"
                  ariaLabel="Limpiar filtros"
                  class="h-10 shrink-0"
                  (clicked)="store.clearAllFilters()"
                />
              }
              @if (store.loadingAll() && store.hayFiltros()) {
                <div
                  class="flex animate-pulse items-center whitespace-nowrap rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] text-primary sm:text-xs"
                >
                  <lucide-icon name="loader-2" [size]="12" class="mr-1.5 animate-spin" />
                  Actualizando…
                </div>
              }
            </div>
          </div>
        </div>

        @if (store.loading()) {
          <div class="flex items-center justify-center py-8 text-sm">
            <lucide-icon name="loader-2" [size]="24" class="mr-2 animate-spin" />
            Cargando planes de comisiones…
          </div>
        } @else if (store.error(); as err) {
          <div class="py-8 text-center text-destructive">
            <p>Error al cargar planes de comisiones: {{ err }}</p>
          </div>
        } @else {
          <div class="flex w-full min-w-0 flex-col">
            <!-- Tabs móvil/tablet -->
            <div class="mb-2 flex flex-col gap-2 px-1 lg:hidden">
              <p class="px-1 text-[10px] font-semibold uppercase text-muted-foreground">
                Estado del Plan
              </p>
              <div class="grid grid-cols-2 gap-2">
                @for (s of estados; track s) {
                  <button
                    type="button"
                    (click)="store.handleStatusChange(s)"
                    class="flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-medium transition-all"
                    [class]="
                      store.activeStatus() === s
                        ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent'
                    "
                  >
                    <span class="truncate">{{ etiqueta(s) }}</span>
                    <span
                      class="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                      [class]="
                        store.activeStatus() === s
                          ? 'bg-white/25 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      "
                    >
                      {{ store.conteoTab(s) }}
                    </span>
                  </button>
                }
              </div>
            </div>

            <!-- Tabs escritorio estilo pestañas de navegador -->
            <div class="no-scrollbar hidden overflow-x-auto overflow-y-hidden pt-1 lg:flex">
              <div class="flex min-w-full flex-nowrap">
                @for (s of estados; track s) {
                  <button
                    type="button"
                    (click)="store.handleStatusChange(s)"
                    class="relative flex shrink-0 cursor-pointer items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-medium transition-all duration-200 ease-out focus:outline-none"
                    [class]="
                      store.activeStatus() === s
                        ? 'border border-b-0 border-border bg-background text-foreground shadow-sm after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[1px] after:bg-background'
                        : 'translate-y-[2px] border border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                    "
                  >
                    {{ etiqueta(s) }}
                    <span
                      class="ml-2 rounded-full px-1.5 py-0.5 text-xs"
                      [class]="
                        store.activeStatus() === s
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      "
                    >
                      {{ store.conteoTab(s) }}
                    </span>
                  </button>
                }
              </div>
            </div>

            <!-- Contenido pegado a las pestañas -->
            <div class="-mt-[1px] rounded-b-lg rounded-tr-lg border border-border bg-background">
              <alma-plans-table
                [plans]="filas()"
                [currentPage]="pagina()"
                [totalPages]="totalPaginas()"
                [totalCount]="conteo()"
                [itemsPerPage]="porPagina()"
              />
            </div>
          </div>
        }

        @if (creando()) {
          <alma-create-plan-dialog [createPlan]="crear" (closed)="creando.set(false)" />
        }
      </div>
    }
  `,
})
export class CompensationPlansPageComponent implements OnInit {
  protected readonly store = inject(CommissionPlansStore);
  private readonly auth = inject(AuthService);

  protected readonly estados = ALL_STATUSES;
  protected readonly creando = signal(false);

  protected readonly tieneAcceso = computed(() =>
    this.auth.hasPermission('app.motor-comisiones.view'),
  );

  protected readonly filas = computed(() =>
    this.store.planesPaginados(this.store.activeStatus()),
  );
  protected readonly pagina = computed(
    () => this.store.currentPage()[this.store.activeStatus()],
  );
  protected readonly porPagina = computed(
    () => this.store.itemsPerPage()[this.store.activeStatus()],
  );
  protected readonly conteo = computed(() =>
    this.store.conteoTab(this.store.activeStatus()),
  );
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.conteo() / this.porPagina())),
  );

  protected readonly crear = (data: Parameters<CommissionPlansStore['createPlan']>[0]) =>
    this.store.createPlan(data);

  ngOnInit(): void {
    void this.store.init();
  }

  protected etiqueta(s: CommissionPlanStatus): string {
    return STATUS_LABELS[s];
  }
}
