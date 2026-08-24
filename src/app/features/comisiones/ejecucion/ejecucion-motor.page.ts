// Ejecución del motor de Comisiones: pestaña de procesos + 4 pestañas de datos (pre-
// calculadas, finales, mantenimiento y distribución de correos) con sus diálogos de
// confirmar ejecución, ver error, editar destinatario y excluir.

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
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
    AccessDeniedComponent,
    MotorEjecucionTabComponent,
    MotorTableToolbarComponent,
    MotorDataTableComponent,
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
        <div class="flex justify-center border-b border-border/30 pb-3">
          <div
            class="glass flex max-w-full flex-wrap justify-center gap-1 rounded-full bg-[var(--surface-sunken)] p-1 px-2"
          >
            @for (t of tabs; track t.value) {
              <button
                type="button"
                (click)="cambiarTab(t.value)"
                class="flex items-center gap-2 whitespace-nowrap rounded-full px-2 py-2.5 text-sm font-semibold transition-colors"
                [class]="
                  tab() === t.value
                    ? 'bg-card text-foreground shadow-[var(--shadow-sm)]'
                    : 'bg-transparent text-muted-foreground hover:text-foreground'
                "
              >
                @if (t.value === 'motor' && store.stats().running > 0) {
                  <span class="h-2 w-2 animate-pulse rounded-full bg-sky-300"></span>
                }
                {{ t.label }}
              </button>
            }
          </div>
        </div>

        <div class="glass min-h-[500px] rounded-2xl p-3 shadow-[var(--shadow-md)]">
          @if (tab() === 'motor') {
            <alma-motor-ejecucion-tab
              (confirmar)="pedirConfirmacion($event)"
              (verError)="errorDe.set($event)"
            />
          } @else {
            @let dataTab = tabDatos();
            @let estado = store.tableData()[dataTab];
            <div class="space-y-4">
              <div>
                <h2 class="text-lg font-bold">{{ titulo(dataTab).titulo }}</h2>
                <p class="text-xs text-muted-foreground">{{ titulo(dataTab).subtitulo }}</p>
              </div>

              <div class="overflow-hidden rounded-xl border border-border/30 bg-card">
                <alma-motor-table-toolbar
                  [variant]="dataTab === 'correos' ? 'correos' : 'comisiones'"
                  [search]="store.filtros(dataTab).search"
                  [periodos]="store.periodosByTab()[dataTab] || []"
                  [periodo]="periodoActual(dataTab)"
                  [compania]="companiaActual(dataTab)"
                  [segmento]="segmentoActual(dataTab)"
                  [estado]="estadoActual(dataTab)"
                  [roles]="store.roles()"
                  [itemsPerPage]="estado.page_size"
                  [cargando]="estado.loading"
                  [exportando]="exportando()"
                  (searchChange)="store.setFiltro(dataTab, 'search', $event)"
                  (filtroChange)="store.setFiltro(dataTab, $event.key, $event.value)"
                  (filtrar)="store.aplicarFiltros(dataTab)"
                  (limpiar)="store.limpiarFiltros(dataTab)"
                  (exportar)="exportar(dataTab)"
                  (itemsPerPageChange)="store.cambiarTamanoPagina(dataTab, $event)"
                />

                <alma-motor-data-table
                  [columns]="estado.cols"
                  [rows]="estado.rows"
                  [loading]="estado.loading"
                  [currentPage]="estado.page"
                  [pageSize]="estado.page_size"
                  [totalPages]="estado.pages"
                  [totalRecords]="estado.total"
                  [columnLabels]="dataTab === 'correos' ? { IdTercero: 'Id' } : {}"
                  [conAcciones]="dataTab === 'correos'"
                  [filtersResetKey]="store.filterResetKeys()[dataTab]"
                  (pageChange)="store.cambiarPagina(dataTab, $event)"
                  (pageSizeChange)="store.cambiarTamanoPagina(dataTab, $event)"
                  (editar)="abrirEdicionCorreo($event)"
                  (excluir)="porExcluir.set(aCorreo($event))"
                />
              </div>
            </div>
          }
        </div>
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
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-primary dark:bg-emerald-500/15"
            >
              ⚙️
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
              <button
                type="button"
                (click)="porConfirmar.set(null)"
                class="alma-btn alma-btn-outline w-full rounded-xl sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="ejecutar()"
                class="alma-btn alma-btn-primary w-full rounded-xl sm:w-auto"
              >
                Sí, ejecutar
              </button>
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
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-lg font-bold text-destructive"
            >
              ⚠️
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
              <button
                type="button"
                (click)="errorDe.set(null)"
                class="alma-btn alma-btn-outline w-full rounded-xl sm:w-auto"
              >
                Cerrar
              </button>
              <button
                type="button"
                (click)="reintentar()"
                class="alma-btn w-full rounded-xl bg-destructive text-white hover:bg-destructive/90 sm:w-auto"
              >
                Reintentar
              </button>
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
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
            >
              ✉️
            </div>
            <h2 class="mt-3 text-center text-lg font-bold">Editar destinatario</h2>
            <p class="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
              Modifica el nombre y correo. El campo
              <strong class="text-foreground">CorreoOrigen</strong> quedará marcado como
              <strong class="text-foreground">MANUAL</strong>.
            </p>

            <div class="space-y-4 py-4">
              <div class="space-y-1">
                <label
                  class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  for="correo-nombre"
                >
                  Nombre Destinatario
                </label>
                <input
                  id="correo-nombre"
                  class="alma-input h-10 rounded-xl"
                  [(ngModel)]="nombreDestinatario"
                />
              </div>
              <div class="space-y-1">
                <label
                  class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  for="correo-mail"
                >
                  Correo
                </label>
                <input
                  id="correo-mail"
                  type="email"
                  class="alma-input h-10 rounded-xl"
                  [(ngModel)]="correoDestinatario"
                />
              </div>
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                (click)="porEditar.set(null)"
                class="alma-btn alma-btn-outline w-full rounded-xl sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="guardarCorreo(data)"
                class="alma-btn alma-btn-primary w-full rounded-xl sm:w-auto"
              >
                Guardar
              </button>
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
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-lg font-bold text-destructive"
            >
              🚫
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
              <button
                type="button"
                (click)="porExcluir.set(null)"
                class="alma-btn alma-btn-outline w-full rounded-xl sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmarExclusion(data)"
                class="alma-btn w-full rounded-xl bg-destructive text-white hover:bg-destructive/90 sm:w-auto"
              >
                Excluir
              </button>
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

  /** El tab actual acotado a los de datos (la plantilla ya excluye 'motor'). */
  protected readonly tabDatos = computed<MotorDataTab>(() => {
    const t = this.tab();
    return t === 'motor' ? 'pre' : t;
  });

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
