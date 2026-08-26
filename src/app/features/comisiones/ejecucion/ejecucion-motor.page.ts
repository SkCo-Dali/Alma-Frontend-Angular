// Ejecución del motor de Comisiones: pestaña de procesos + 4 pestañas de datos (pre-
// calculadas, finales, mantenimiento y distribución de correos) con sus diálogos de
// confirmar ejecución, ver error, editar destinatario y excluir.

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Tabs, TabList, Tab as PTab, TabPanels, TabPanel } from 'primeng/tabs';
import { SkButtonComponent, SkInputComponent } from '@skandia/ui';
import { AuthService } from '../../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../../shared/components/access-denied.component';
import { CorreoModalData, EjecucionMotorStore } from './ejecucion-motor.store';
import { MotorDataTableComponent } from './motor-data-table.component';
import { MotorEjecucionTabComponent } from './motor-ejecucion-tab.component';
import { MotorTableToolbarComponent } from './motor-table-toolbar.component';
import { MotorDataTab, MotorTableRow } from './motor.api';

type Tab = 'motor' | MotorDataTab;

const TABS: { value: Tab; label: string }[] = [
  { value: 'motor', label: 'Ejecución del Motor' },
  { value: 'pre', label: 'Comisiones Pre - Calculadas' },
  { value: 'post', label: 'Comisiones Finales' },
  { value: 'mant', label: 'Reporte de Mantenimiento' },
  { value: 'correos', label: 'Distribución de Correos' },
];

const TITULOS: Record<MotorDataTab, { titulo: string; subtitulo: string }> = {
  pre: {
    titulo: 'Comisiones Pre - Calculadas',
    subtitulo: 'Resultado del motor antes de aplicar ajustes manuales del período',
  },
  post: {
    titulo: 'Comisiones Finales',
    subtitulo: 'Resultado definitivo del período con todos los ajustes aplicados',
  },
  mant: {
    titulo: 'Reporte de Mantenimiento',
    subtitulo: 'Estado y mantenimiento por asesor',
  },
  correos: {
    titulo: 'Distribución de Correos',
    subtitulo: 'Datos para el envío de liquidaciones a asesores por canal y rol',
  },
};

@Component({
  selector: 'alma-ejecucion-motor-page',
  providers: [EjecucionMotorStore],
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    SkButtonComponent,
    SkInputComponent,
    AccessDeniedComponent,
    MotorEjecucionTabComponent,
    MotorTableToolbarComponent,
    MotorDataTableComponent,
    Tabs,
    TabList,
    PTab,
    TabPanels,
    TabPanel,
  ],
  template: `
    @if (!tieneAcceso()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 pb-20 sm:px-6 sm:py-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
          <a
            routerLink="/apps/motor-comisiones"
            class="alma-btn h-9 w-fit shrink-0 gap-2 rounded-xl px-3 text-muted-foreground hover:text-foreground"
          >
            <lucide-icon name="arrow-left" [size]="16" />
            Volver
          </a>
          <h1 class="text-lg font-bold tracking-tight sm:text-xl">
            Ejecución del motor de Comisiones
          </h1>
        </div>

        <!-- Pestañas -->
        <p-tabs
          [value]="tab()"
          (valueChange)="cambiarTab($any($event))"
          [lazy]="true"
          styleClass="flex flex-col items-center border-b border-border/30 pb-3"
        >
          <p-tablist
            aria-label="Vistas de Ejecución del motor"
            class="glass flex max-w-full flex-wrap justify-center gap-1 rounded-full bg-[var(--surface-sunken)] p-1 px-2"
          >
            @for (t of tabs; track t.value) {
              <p-tab [value]="t.value" class="inline-flex items-center gap-2">
                @if (t.value === 'motor' && store.stats().running > 0) {
                  <span class="h-2 w-2 animate-pulse rounded-full bg-sky-300"></span>
                }
                {{ t.label }}
              </p-tab>
            }
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="motor">
              <div class="glass min-h-[500px] rounded-2xl p-3 shadow-[var(--shadow-md)]">
                <alma-motor-ejecucion-tab
                  (confirmar)="pedirConfirmacion($event)"
                  (verError)="errorDe.set($event)"
                />
              </div>
            </p-tabpanel>
            @for (dt of dataTabs; track dt) {
              <p-tabpanel [value]="dt">
                <div class="glass min-h-[500px] rounded-2xl p-3 shadow-[var(--shadow-md)]">
                  @let estado = store.tableData()[dt];
                  <div class="space-y-4">
                    <div>
                      <h2 class="text-lg font-bold">{{ titulo(dt).titulo }}</h2>
                      <p class="text-xs text-muted-foreground">{{ titulo(dt).subtitulo }}</p>
                    </div>

                    <div class="overflow-hidden rounded-xl border border-border/30 bg-card">
                      <alma-motor-table-toolbar
                        [variant]="dt === 'correos' ? 'correos' : 'comisiones'"
                        [search]="store.filtros(dt).search"
                        [periodos]="store.periodosByTab()[dt] || []"
                        [periodo]="periodoActual(dt)"
                        [compania]="companiaActual(dt)"
                        [segmento]="segmentoActual(dt)"
                        [estado]="estadoActual(dt)"
                        [roles]="store.roles()"
                        [itemsPerPage]="estado.page_size"
                        [cargando]="estado.loading"
                        [exportando]="exportando()"
                        (searchChange)="store.setFiltro(dt, 'search', $event)"
                        (filtroChange)="store.setFiltro(dt, $event.key, $event.value)"
                        (filtrar)="store.aplicarFiltros(dt)"
                        (limpiar)="store.limpiarFiltros(dt)"
                        (exportar)="exportar(dt)"
                        (itemsPerPageChange)="store.cambiarTamanoPagina(dt, $event)"
                      />

                      <alma-motor-data-table
                        [columns]="estado.cols"
                        [rows]="estado.rows"
                        [loading]="estado.loading"
                        [currentPage]="estado.page"
                        [pageSize]="estado.page_size"
                        [totalPages]="estado.pages"
                        [totalRecords]="estado.total"
                        [columnLabels]="dt === 'correos' ? { IdTercero: 'Id' } : {}"
                        [conAcciones]="dt === 'correos'"
                        [filtersResetKey]="store.filterResetKeys()[dt]"
                        (pageChange)="store.cambiarPagina(dt, $event)"
                        (pageSizeChange)="store.cambiarTamanoPagina(dt, $event)"
                        (editar)="abrirEdicionCorreo($event)"
                        (excluir)="porExcluir.set(aCorreo($event))"
                      />
                    </div>
                  </div>
                </div>
              </p-tabpanel>
            }
          </p-tabpanels>
        </p-tabs>
      </div>

      <!-- Confirmar ejecución -->
      @if (porConfirmar() !== null) {
        <div
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          (click)="porConfirmar.set(null)"
        >
          <div
            class="surface-solid w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl"
            (click)="$event.stopPropagation()"
          >
            <div
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-primary dark:bg-emerald-500/15"
            >
              <lucide-icon name="settings" [size]="22" />
            </div>
            <h2 class="mt-3 text-center text-lg font-bold">Confirmar ejecución</h2>
            <p class="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
              ¿Deseas iniciar el proceso
              <strong class="text-foreground">"{{ nombreProceso(porConfirmar()) }}"</strong>?
            </p>
            <div
              class="mt-4 rounded-xl border border-border/50 bg-muted/20 p-3 text-center text-xs text-muted-foreground"
            >
              {{ descripcionProceso(porConfirmar()) }}
            </div>
            <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <sk-button
                type="button"
                variant="secondary"
                label="Cancelar"
                class="w-full rounded-xl sm:w-auto"
                (clicked)="porConfirmar.set(null)"
              />
              <sk-button
                type="button"
                variant="primary"
                label="Sí, ejecutar"
                class="w-full rounded-xl sm:w-auto"
                (clicked)="ejecutar()"
              />
            </div>
          </div>
        </div>
      }

      <!-- Detalle del error -->
      @if (errorDe() !== null) {
        <div
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          (click)="errorDe.set(null)"
        >
          <div
            class="surface-solid w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl"
            (click)="$event.stopPropagation()"
          >
            <div
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            >
              <lucide-icon name="alert-triangle" [size]="22" />
            </div>
            <h2 class="mt-3 text-center text-lg font-bold">Error en la ejecución</h2>
            <p class="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
              El proceso <strong class="text-foreground">"{{ nombreProceso(errorDe()) }}"</strong>
              finalizó con un error.
            </p>
            <div
              class="mt-4 max-h-40 overflow-y-auto break-all rounded-xl border border-destructive/10 bg-destructive/5 p-4 font-mono text-[11px] text-destructive"
            >
              {{ detalleError() }}
            </div>
            <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <sk-button
                type="button"
                variant="secondary"
                label="Cerrar"
                class="w-full rounded-xl sm:w-auto"
                (clicked)="errorDe.set(null)"
              />
              <sk-button
                type="button"
                variant="primary"
                severity="danger"
                label="Reintentar"
                class="w-full rounded-xl sm:w-auto"
                (clicked)="reintentar()"
              />
            </div>
          </div>
        </div>
      }

      <!-- Editar destinatario -->
      @if (porEditar(); as data) {
        <div
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          (click)="porEditar.set(null)"
        >
          <div
            class="surface-solid w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl"
            (click)="$event.stopPropagation()"
          >
            <div
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
            >
              <lucide-icon name="mail" [size]="22" />
            </div>
            <h2 class="mt-3 text-center text-lg font-bold">Editar destinatario</h2>
            <p class="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
              Modifica el nombre y correo. El campo
              <strong class="text-foreground">CorreoOrigen</strong> quedará marcado como
              <strong class="text-foreground">MANUAL</strong>.
            </p>

            <div class="space-y-4 py-4">
              <div class="space-y-1">
                <sk-input
                  label="Nombre Destinatario"
                  class="rounded-xl"
                  [(ngModel)]="nombreDestinatario"
                />
              </div>
              <div class="space-y-1">
                <sk-input
                  label="Correo"
                  type="email"
                  class="rounded-xl"
                  [(ngModel)]="correoDestinatario"
                />
              </div>
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <sk-button
                type="button"
                variant="secondary"
                label="Cancelar"
                class="w-full rounded-xl sm:w-auto"
                (clicked)="porEditar.set(null)"
              />
              <sk-button
                type="button"
                variant="primary"
                label="Guardar"
                class="w-full rounded-xl sm:w-auto"
                (clicked)="guardarCorreo(data)"
              />
            </div>
          </div>
        </div>
      }

      <!-- Excluir del envío -->
      @if (porExcluir(); as data) {
        <div
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          (click)="porExcluir.set(null)"
        >
          <div
            class="surface-solid w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl"
            (click)="$event.stopPropagation()"
          >
            <div
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            >
              <lucide-icon name="x-circle" [size]="22" />
            </div>
            <h2 class="mt-3 text-center text-lg font-bold">Excluir del envío</h2>
            <p
              class="mt-2 text-center text-sm font-medium leading-relaxed text-muted-foreground"
            >
              El correo <span class="font-bold text-foreground">{{ data.archivo }}</span> será
              marcado como <strong class="text-foreground">Excluido</strong> y no se enviará en la
              ejecución del job 07.
            </p>
            <div
              class="mt-4 rounded-xl border border-border/50 bg-muted/30 p-3 text-center text-xs text-muted-foreground"
            >
              Esta acción solo aplica si el registro está en estado <strong>Pendiente</strong>.
            </div>
            <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <sk-button
                type="button"
                variant="secondary"
                label="Cancelar"
                class="w-full rounded-xl sm:w-auto"
                (clicked)="porExcluir.set(null)"
              />
              <sk-button
                type="button"
                variant="primary"
                severity="danger"
                label="Excluir"
                class="w-full rounded-xl sm:w-auto"
                (clicked)="confirmarExclusion(data)"
              />
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class EjecucionMotorPageComponent implements OnInit {
  protected readonly store = inject(EjecucionMotorStore);
  private readonly auth = inject(AuthService);

  protected readonly tabs = TABS;
  protected readonly dataTabs: MotorDataTab[] = ['pre', 'post', 'mant', 'correos'];
  protected readonly tab = signal<Tab>('motor');
  protected readonly exportando = signal(false);

  protected readonly porConfirmar = signal<number | 'adf' | null>(null);
  protected readonly errorDe = signal<number | 'adf' | null>(null);
  protected readonly porEditar = signal<CorreoModalData | null>(null);
  protected readonly porExcluir = signal<CorreoModalData | null>(null);

  protected nombreDestinatario = '';
  protected correoDestinatario = '';

  protected readonly tieneAcceso = computed(() =>
    this.auth.hasPermission('app.motor-comisiones.view'),
  );

  protected readonly detalleError = computed(() => {
    const id = this.errorDe();
    if (id === null) return '';
    if (id === 'adf') return this.store.adfError() ?? 'Error desconocido';
    return this.store.estadoDe(id).errorDetail ?? 'Error desconocido';
  });

  ngOnInit(): void {
    void this.store.init();
  }

  protected titulo(tab: MotorDataTab) {
    return TITULOS[tab];
  }

  protected cambiarTab(t: Tab): void {
    this.tab.set(t);
    if (t !== 'motor') {
      void this.store.cargarPeriodos(t);
      void this.store.reiniciarYCargar(t);
    }
  }

  protected periodoActual(tab: MotorDataTab): string {
    return this.store.filtros(tab).periodo;
  }

  protected companiaActual(tab: MotorDataTab): string {
    const f = this.store.filtros(tab);
    return 'compania' in f ? f.compania : '';
  }

  protected segmentoActual(tab: MotorDataTab): string {
    const f = this.store.filtros(tab);
    return 'segmento' in f ? f.segmento : '';
  }

  protected estadoActual(tab: MotorDataTab): string {
    const f = this.store.filtros(tab);
    return 'estado' in f ? f.estado : '';
  }

  protected async exportar(tab: MotorDataTab): Promise<void> {
    this.exportando.set(true);
    try {
      await this.store.exportarExcel(tab);
    } finally {
      this.exportando.set(false);
    }
  }

  // ── Diálogos de jobs ──────────────────────────────────────────────────────

  protected pedirConfirmacion(id: number | 'adf'): void {
    this.porConfirmar.set(id);
  }

  protected nombreProceso(id: number | 'adf' | null): string {
    if (id === null) return '';
    if (id === 'adf') return 'Ingesta - Ajustes y Parametrización';
    return this.store.jobPorId(id)?.nombre ?? '';
  }

  protected descripcionProceso(id: number | 'adf' | null): string {
    if (id === null) return '';
    if (id === 'adf') {
      return 'Copia las tablas fuente de SQL Server al Unity Catalog de Databricks vía Azure Data Factory.';
    }
    return this.store.jobPorId(id)?.descripcion ?? '';
  }

  protected async ejecutar(): Promise<void> {
    const id = this.porConfirmar();
    this.porConfirmar.set(null);
    if (id === 'adf') await this.store.ejecutarADF();
    else if (id !== null) await this.store.ejecutarJob(id);
  }

  /** Reintentar desde el error reabre la confirmación del mismo proceso. */
  protected reintentar(): void {
    const id = this.errorDe();
    this.errorDe.set(null);
    if (id !== null) this.porConfirmar.set(id);
  }

  // ── Diálogos de correos ───────────────────────────────────────────────────

  protected aCorreo(row: MotorTableRow): CorreoModalData {
    return {
      periodo: row['Periodo'] ?? '',
      segmento: String(row['Segmento'] ?? ''),
      archivo: String(row['NombreArchivo'] ?? ''),
      correo: row['Correo'] != null ? String(row['Correo']) : undefined,
      nombre:
        row['NombreDestinatario'] != null ? String(row['NombreDestinatario']) : undefined,
    };
  }

  protected abrirEdicionCorreo(row: MotorTableRow): void {
    const data = this.aCorreo(row);
    this.nombreDestinatario = data.nombre ?? '';
    this.correoDestinatario = data.correo ?? '';
    this.porEditar.set(data);
  }

  protected async guardarCorreo(data: CorreoModalData): Promise<void> {
    const ok = await this.store.editarCorreo(
      data,
      this.correoDestinatario,
      this.nombreDestinatario,
    );
    if (ok) this.porEditar.set(null);
  }

  protected async confirmarExclusion(data: CorreoModalData): Promise<void> {
    if (await this.store.excluirCorreo(data)) this.porExcluir.set(null);
  }
}
