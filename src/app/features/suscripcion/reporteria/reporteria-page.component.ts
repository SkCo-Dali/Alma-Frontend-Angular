// Auditoría y reportería del Motor de Suscripción: indicadores del periodo
// (resultados del motor, estados, tiempos hasta emisión, alertas) y una traza
// fila por fila de cada solicitud con su última decisión.
//
// El periodo se aplica sobre la fecha de ingreso de la solicitud, así que todos
// los indicadores hablan del mismo conjunto de pólizas.

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { GridPaginationComponent } from '../../../shared/components/grid-pagination.component';
import { FiltroPeriodoComponent } from './filtro-periodo.component';
import { FiltroValoresComponent, OpcionFiltro } from './filtro-valores.component';
import {
  ConteoValor,
  FiltrosReporteria,
  OpcionesReporteria,
  PaginaAuditoria,
  ReporteriaApi,
  ResumenReporteria,
} from './reporteria.api';

/** La auditoría se lee en hora de Colombia, no en la del equipo de quien mira:
 *  es un registro de cuándo pasaron las cosas en la operación, y dos personas
 *  mirando la misma fila tienen que ver la misma hora. El backend manda UTC. */
const ZONA = { timeZone: 'America/Bogota' } as const;

@Component({
  selector: 'alma-reporteria-page',
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    GridPaginationComponent,
    FiltroPeriodoComponent,
    FiltroValoresComponent,
  ],
  template: `
    <div data-full-bleed class="flex flex-col gap-3 pb-6">
      <!-- ── Encabezado + periodo ── -->
      <div class="flex flex-wrap items-center gap-2">
        <a
          routerLink="/apps/suscripcion"
          class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] transition-colors hover:text-primary"
        >
          <lucide-icon name="arrow-left" [size]="16" />
          Suscripción
        </a>
        <h1 class="mr-auto flex items-center gap-2 text-lg font-bold text-foreground">
          <lucide-icon name="bar-chart-3" [size]="18" class="text-primary" />
          Auditoría y reportería
        </h1>

        <alma-filtro-periodo
          [fechas]="fechasArbol()"
          [desde]="desdeInput"
          [hasta]="hastaInput"
          (rango)="onRango($event)"
        />
        <alma-filtro-valores
          etiqueta="Resultado"
          icono="sliders-horizontal"
          todosLabel="Todos"
          [opciones]="opcionesDecision()"
          [seleccion]="decisionInput"
          (seleccionar)="onDecision($event)"
        />
        @if (desdeInput || hastaInput || decisionInput) {
          <button type="button" (click)="limpiarPeriodo()" class="alma-btn alma-btn-outline h-9 rounded-xl px-3 text-sm">
            <lucide-icon name="x" [size]="15" /> Limpiar
          </button>
        }
      </div>

      @if (error()) {
        <p class="flex items-center gap-1.5 text-xs text-destructive">
          <lucide-icon name="alert-triangle" [size]="14" /> {{ error() }}
        </p>
      }

      @if (decisionInput) {
        <p
          class="glass flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] text-muted-foreground shadow-[var(--shadow-sm)]"
        >
          <lucide-icon name="filter" [size]="12" class="text-primary" />
          Indicadores acotados a
          <span class="font-semibold text-foreground">{{ decisionInput }}</span>
          — la distribución por resultado del motor sigue mostrando todo el periodo.
        </p>
      }

      <!-- ── Indicadores ── -->
      @if (cards().length) {
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          @for (k of cards(); track k.label) {
            <div class="glass rounded-xl px-3 py-2 shadow-[var(--shadow-sm)]" [class.opacity-60]="cargandoResumen()">
              <p class="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <lucide-icon [name]="k.icon" [size]="12" /> {{ k.label }}
              </p>
              <p class="text-lg font-bold tabular-nums" [class]="k.clase">{{ k.valor }}</p>
              @if (k.sub) {
                <p class="truncate text-[11px] text-muted-foreground/70" [title]="k.sub">{{ k.sub }}</p>
              }
            </div>
          }
        </div>
      }

      <!-- ── Distribuciones ── -->
      <div class="grid gap-3 lg:grid-cols-2">
        <section class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
          <h2 class="mb-3 text-sm font-bold text-foreground">Resultado del motor</h2>
          <p class="mb-3 text-[11px] text-muted-foreground">
            Última decisión de cada solicitud (una solicitud puede re-evaluarse varias veces).
          </p>
          @for (d of resumen()?.decisiones ?? []; track d.decision) {
            <button
              type="button"
              (click)="onDecision(d.decision === decisionInput ? '' : d.decision)"
              class="mb-2 block w-full rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-accent/60"
              [class.bg-accent]="d.decision === decisionInput"
              [title]="d.decision === decisionInput ? 'Quitar el filtro' : 'Acotar los indicadores a ' + d.decision"
            >
              <div class="flex items-baseline justify-between gap-2 text-xs">
                <span class="min-w-0 truncate text-foreground" [class.font-semibold]="d.decision === decisionInput">
                  {{ d.decision }}
                </span>
                <span class="shrink-0 tabular-nums text-muted-foreground">
                  {{ d.total }} · {{ porcentaje(d.total, totalDecisiones()) }}
                </span>
              </div>
              <div class="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full"
                  [class]="d.decision === decisionInput || !decisionInput ? 'bg-primary' : 'bg-primary/35'"
                  [style.width.%]="ancho(d.total, maxDecision())"
                ></div>
              </div>
            </button>
          } @empty {
            <p class="text-sm text-muted-foreground">Sin evaluaciones en el periodo.</p>
          }
        </section>

        <section class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
          <h2 class="mb-3 text-sm font-bold text-foreground">Estado actual de las solicitudes</h2>
          <p class="mb-3 text-[11px] text-muted-foreground">
            Dónde están hoy las pólizas
            {{ decisionInput ? 'con ese resultado del motor' : 'del periodo' }}.
          </p>
          @for (e of resumen()?.estados ?? []; track e.estado) {
            <div class="mb-2">
              <div class="flex items-baseline justify-between gap-2 text-xs">
                <span class="capitalize text-foreground">{{ e.estado.replace('_', ' ') }}</span>
                <span class="shrink-0 tabular-nums text-muted-foreground">
                  {{ e.total }} · {{ porcentaje(e.total, resumen()?.solicitudes ?? 0) }}
                </span>
              </div>
              <div class="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full" [class]="colorEstado(e.estado)" [style.width.%]="ancho(e.total, maxEstado())"></div>
              </div>
            </div>
          } @empty {
            <p class="text-sm text-muted-foreground">Sin solicitudes en el periodo.</p>
          }
        </section>
      </div>

      <!-- ── Tiempos + alertas ── -->
      <div class="grid gap-3 lg:grid-cols-3">
        <section class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
          <h2 class="mb-1 text-sm font-bold text-foreground">Tiempo hasta emisión</h2>
          <p class="mb-3 text-[11px] text-muted-foreground">
            Desde el ingreso de la solicitud hasta que queda emitida.
          </p>
          @if (tiempos(); as t) {
            @if (t.n === 0) {
              <p class="text-sm text-muted-foreground">Ninguna solicitud del periodo llegó a emitirse.</p>
            } @else {
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <p class="text-[11px] text-muted-foreground">Mediana</p>
                  <p class="text-lg font-bold text-foreground">{{ duracion(t.medianaMin) }}</p>
                </div>
                <div>
                  <p class="text-[11px] text-muted-foreground">P90</p>
                  <p class="text-lg font-bold text-foreground">{{ duracion(t.p90Min) }}</p>
                </div>
                <div>
                  <p class="text-[11px] text-muted-foreground">Mínimo</p>
                  <p class="text-sm text-foreground">{{ duracion(t.minMin) }}</p>
                </div>
                <div>
                  <p class="text-[11px] text-muted-foreground">Máximo</p>
                  <p class="text-sm text-foreground">{{ duracion(t.maxMin) }}</p>
                </div>
              </div>
              <p class="mt-3 text-[11px] text-muted-foreground/70">Sobre {{ t.n }} emisiones.</p>
              @if (t.n < 30) {
                <p class="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
                  <lucide-icon name="alert-triangle" [size]="12" class="mt-0.5 shrink-0" />
                  Pocos casos: léelo como indicativo, no como tendencia.
                </p>
              }
            }
          }
        </section>

        <section class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
          <h2 class="mb-1 text-sm font-bold text-foreground">Alertas más frecuentes</h2>
          <p class="mb-3 text-[11px] text-muted-foreground">Variable que dispara la alerta.</p>
          @for (a of resumen()?.topAlertas ?? []; track a.valor) {
            <div class="mb-1.5 flex items-center gap-2">
              <span class="min-w-0 flex-1 truncate text-xs text-foreground" [title]="a.valor">{{ a.valor }}</span>
              <div class="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-[#FF9200]" [style.width.%]="ancho(a.total, maxAlerta())"></div>
              </div>
              <span class="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{{ a.total }}</span>
            </div>
          } @empty {
            <p class="text-sm text-muted-foreground">Sin alertas.</p>
          }
        </section>

        <section class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
          <h2 class="mb-1 text-sm font-bold text-foreground">Exclusiones más frecuentes</h2>
          <p class="mb-3 text-[11px] text-muted-foreground">Aplicadas en la última evaluación.</p>
          @for (x of resumen()?.topExclusiones ?? []; track x.valor) {
            <div class="mb-1.5 flex items-center gap-2">
              <span class="min-w-0 flex-1 truncate text-xs text-foreground" [title]="x.valor">{{ x.valor }}</span>
              <div class="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-destructive" [style.width.%]="ancho(x.total, maxExclusion())"></div>
              </div>
              <span class="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{{ x.total }}</span>
            </div>
          } @empty {
            <p class="text-sm text-muted-foreground">Sin exclusiones.</p>
          }
        </section>
      </div>

      <!-- ── Auditoría ── -->
      <section class="glass flex flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
        <header class="shrink-0 border-b border-border/60 px-4 py-3">
          <h2 class="text-sm font-bold text-foreground">Auditoría</h2>
          <p class="text-[11px] text-muted-foreground">
            Cada solicitud con su última decisión, quién la evaluó y su tiempo hasta emisión.
            @if (decisionInput) {
              <span> Acotada a <span class="font-medium text-foreground">{{ decisionInput }}</span>.</span>
            }
          </p>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <div class="glass flex h-8 min-w-[200px] flex-1 items-center gap-2 rounded-lg px-2.5">
              <lucide-icon name="search" [size]="14" class="shrink-0 text-muted-foreground" />
              <input
                [(ngModel)]="qInput"
                name="q"
                type="search"
                placeholder="Cotización, nombre o cédula…"
                class="h-full flex-1 border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <alma-filtro-valores
              etiqueta="Estado"
              todosLabel="Todos"
              [opciones]="opcionesEstado()"
              [seleccion]="estadoInput"
              (seleccionar)="onEstado($event)"
            />
            <input
              [(ngModel)]="analistaInput"
              name="analista"
              type="text"
              placeholder="Analista"
              class="alma-input h-8 w-32 rounded-lg px-2 text-xs"
            />
            <button type="button" (click)="aplicarAuditoria()" class="alma-btn alma-btn-outline h-8 rounded-lg px-3 text-xs">
              Filtrar
            </button>
          </div>
        </header>

        <div class="min-h-0 overflow-auto">
          @if (cargandoAuditoria()) {
            <div class="flex items-center justify-center py-10">
              <lucide-icon name="loader-2" [size]="18" class="animate-spin text-primary" />
            </div>
          } @else {
            <table class="w-full border-separate border-spacing-0 text-sm">
              <thead class="sticky top-0 z-10">
                <tr>
                  @for (c of columnas; track c) {
                    <th
                      class="whitespace-nowrap border-b border-border bg-[var(--table-header)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65"
                    >
                      {{ c }}
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (f of auditoria()?.data ?? []; track f.nroCotizacion) {
                  <tr class="transition-colors hover:bg-accent/60">
                    <td class="whitespace-nowrap border-b border-border/50 px-3 py-2 font-mono text-xs text-foreground">
                      {{ f.nroCotizacion }}
                    </td>
                    <td class="max-w-0 border-b border-border/50 px-3 py-2">
                      <p class="truncate text-foreground">{{ f.nombre }}</p>
                      <p class="truncate text-[11px] text-muted-foreground">{{ f.cedula }}</p>
                    </td>
                    <td class="whitespace-nowrap border-b border-border/50 px-3 py-2">
                      <span class="alma-badge capitalize" [class]="badgeEstado(f.estado)">
                        {{ f.estado.replace('_', ' ') }}
                      </span>
                    </td>
                    <td class="max-w-0 border-b border-border/50 px-3 py-2">
                      <p class="truncate text-xs text-foreground" [title]="f.decision || ''">{{ f.decision || '—' }}</p>
                    </td>
                    <td class="whitespace-nowrap border-b border-border/50 px-3 py-2 text-xs text-muted-foreground">
                      {{ f.analista || '—' }}
                    </td>
                    <td class="whitespace-nowrap border-b border-border/50 px-3 py-2 text-xs text-muted-foreground">
                      {{ fecha(f.fechaIngreso) }}
                      @if (hora(f.fechaIngreso); as h) {
                        <span class="ml-1 tabular-nums text-muted-foreground/70">{{ h }}</span>
                      }
                    </td>
                    <td class="whitespace-nowrap border-b border-border/50 px-3 py-2 text-xs text-muted-foreground">
                      {{ fecha(f.fechaEmision) }}
                      @if (hora(f.fechaEmision); as h) {
                        <span class="ml-1 tabular-nums text-muted-foreground/70">{{ h }}</span>
                      }
                    </td>
                    <td class="whitespace-nowrap border-b border-border/50 px-3 py-2 text-right text-xs tabular-nums text-foreground">
                      {{ duracion(f.minutosAEmision) }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="columnas.length" class="px-3 py-12 text-center">
                      <p class="text-sm text-muted-foreground">No hay solicitudes que coincidan.</p>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        <alma-grid-pagination
          [currentPage]="pagina()"
          [totalPages]="totalPaginas() || 1"
          [total]="auditoria()?.total ?? 0"
          [itemsPerPage]="tamanoPagina()"
          surfaceClass="bg-transparent"
          (pageChange)="irAPagina($event)"
          (itemsPerPageChange)="cambiarTamano($event)"
        />
      </section>
    </div>
  `,
})
export class ReporteriaPageComponent {
  private readonly api = inject(ReporteriaApi);

  // Periodo (aplica a TODOS los indicadores y a la auditoría).
  protected desdeInput = '';
  protected hastaInput = '';
  /** Resultado del motor (última decisión): acota indicadores Y auditoría. */
  protected decisionInput = '';
  // Filtros propios de la tabla de auditoría.
  protected qInput = '';
  protected estadoInput = '';
  protected analistaInput = '';

  protected readonly resumen = signal<ResumenReporteria | null>(null);
  protected readonly opciones = signal<OpcionesReporteria | null>(null);
  protected readonly auditoria = signal<PaginaAuditoria | null>(null);
  protected readonly cargandoResumen = signal(false);
  protected readonly cargandoAuditoria = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(50);

  protected readonly columnas = [
    'Cotización',
    'Asegurado',
    'Estado',
    'Última decisión',
    'Evaluó',
    'Ingreso',
    'Emisión',
    'Tiempo',
  ];

  protected readonly totalPaginas = computed(() =>
    Math.ceil((this.auditoria()?.total ?? 0) / this.tamanoPagina()),
  );
  protected readonly tiempos = computed(() => this.resumen()?.tiempoEmision ?? null);
  protected readonly maxDecision = computed(() =>
    Math.max(1, ...(this.resumen()?.decisiones ?? []).map((d) => d.total)),
  );
  protected readonly maxEstado = computed(() =>
    Math.max(1, ...(this.resumen()?.estados ?? []).map((e) => e.total)),
  );
  /** Días con solicitudes, repetidos por su conteo: así los cuenta el árbol. */
  protected readonly fechasArbol = computed(() =>
    (this.opciones()?.fechas ?? []).flatMap((f) => Array<string>(f.total).fill(f.fecha)),
  );
  /** Opciones del desplegable de resultado. Se toman del resumen, no de
   *  /opciones, para que los conteos sean los del periodo y cuadren con las
   *  barras de al lado; /opciones queda de respaldo si el resumen falló. */
  protected readonly opcionesDecision = computed<OpcionFiltro[]>(() =>
    (this.resumen()?.decisiones ?? this.opciones()?.decisiones ?? []).map((d) => ({
      valor: d.decision,
      total: d.total,
    })),
  );
  protected readonly opcionesEstado = computed<OpcionFiltro[]>(() =>
    (this.resumen()?.estados ?? []).map((e) => ({ valor: e.estado, total: e.total })),
  );

  /** Total de la distribución por resultado (no se acota: es el selector). */
  protected readonly totalDecisiones = computed(() =>
    (this.resumen()?.decisiones ?? []).reduce((a, d) => a + d.total, 0),
  );
  protected readonly maxAlerta = computed(() => this.maxDe(this.resumen()?.topAlertas));
  protected readonly maxExclusion = computed(() => this.maxDe(this.resumen()?.topExclusiones));

  /** Cards de indicadores; vacío hasta la primera carga. */
  protected readonly cards = computed(() => {
    const r = this.resumen();
    if (!r) return [];
    const n = (v: number) => v.toLocaleString('es-CO');
    return [
      { label: 'Solicitudes', icon: 'list-checks', valor: n(r.solicitudes), sub: `${n(r.evaluaciones)} evaluaciones`, clase: 'text-foreground' },
      { label: 'Emitidas', icon: 'check-circle-2', valor: n(r.emitidas), sub: this.porcentaje(r.emitidas, r.solicitudes), clase: 'text-[#047857] dark:text-[#34d399]' },
      { label: 'Emisión automática', icon: 'send', valor: n(r.emisionAutomatica), sub: this.porcentaje(r.emisionAutomatica, r.solicitudes), clase: 'text-primary' },
      { label: 'Mediana a emisión', icon: 'clock-3', valor: this.duracion(r.tiempoEmision.medianaMin), sub: `sobre ${r.tiempoEmision.n} emisiones`, clase: 'text-foreground' },
      { label: 'Devoluciones', icon: 'shield-alert', valor: n(this.devoluciones(r)), sub: this.porcentaje(this.devoluciones(r), r.solicitudes), clase: 'text-destructive' },
    ];
  });

  constructor() {
    void this.cargar();
    void this.cargarOpciones();
  }

  /** Los filtros no dependen del periodo, así que se piden una sola vez. */
  private async cargarOpciones(): Promise<void> {
    try {
      this.opciones.set(await this.api.opciones());
    } catch (e) {
      // Sin esto la vista sigue sirviendo: los desplegables se alimentan del
      // resumen y el árbol de fechas queda vacío (quedan los presets).
      console.error('[reporteria] no se pudieron cargar las opciones de filtros', e);
    }
  }

  /** Lo que comparten los indicadores y la tabla: periodo + resultado del motor. */
  private filtrosBase(): FiltrosReporteria {
    return {
      desde: this.desdeInput || undefined,
      hasta: this.hastaInput || undefined,
      decision: this.decisionInput || undefined,
    };
  }

  private filtrosAuditoria(): FiltrosReporteria {
    return {
      ...this.filtrosBase(),
      estado: this.estadoInput || undefined,
      analista: this.analistaInput.trim() || undefined,
      q: this.qInput.trim() || undefined,
    };
  }

  private async cargar(): Promise<void> {
    this.error.set(null);
    this.cargandoResumen.set(true);
    try {
      this.resumen.set(await this.api.resumen(this.filtrosBase()));
    } catch (e) {
      console.error('[reporteria] no se pudo cargar el resumen', e);
      this.error.set('No se pudieron cargar los indicadores.');
    } finally {
      this.cargandoResumen.set(false);
    }
    await this.cargarAuditoria(1);
  }

  private async cargarAuditoria(pagina: number): Promise<void> {
    this.cargandoAuditoria.set(true);
    try {
      const offset = (pagina - 1) * this.tamanoPagina();
      this.auditoria.set(
        await this.api.auditoria(this.filtrosAuditoria(), this.tamanoPagina(), offset),
      );
      this.pagina.set(pagina);
    } catch (e) {
      console.error('[reporteria] no se pudo cargar la auditoría', e);
      this.error.set('No se pudo cargar la auditoría.');
      this.auditoria.set(null);
    } finally {
      this.cargandoAuditoria.set(false);
    }
  }

  /** Nuevo periodo desde el popover de fechas: recarga todo. */
  protected onRango(r: { desde: string; hasta: string }): void {
    if (r.desde === this.desdeInput && r.hasta === this.hastaInput) return;
    this.desdeInput = r.desde;
    this.hastaInput = r.hasta;
    void this.cargar();
  }

  protected onEstado(valor: string): void {
    if (valor === this.estadoInput) return;
    this.estadoInput = valor;
    void this.cargarAuditoria(1);
  }

  protected limpiarPeriodo(): void {
    this.desdeInput = '';
    this.hastaInput = '';
    this.decisionInput = '';
    void this.cargar();
  }

  /** Cambiar el resultado del motor recarga indicadores y auditoría. */
  protected onDecision(valor: string): void {
    if (valor === this.decisionInput) return;
    this.decisionInput = valor;
    // El estado que se venía filtrando puede no existir en el nuevo universo.
    this.estadoInput = '';
    void this.cargar();
  }

  protected aplicarAuditoria(): void {
    void this.cargarAuditoria(1);
  }

  protected irAPagina(p: number): void {
    void this.cargarAuditoria(p);
  }

  protected cambiarTamano(n: number): void {
    this.tamanoPagina.set(n);
    void this.cargarAuditoria(1);
  }

  // ── Formato ──
  private maxDe(lista?: ConteoValor[]): number {
    return Math.max(1, ...(lista ?? []).map((x) => x.total));
  }

  private devoluciones(r: ResumenReporteria): number {
    // `decisiones` viene sin acotar (es el selector): si hay un resultado
    // elegido, la card habla de ese universo, no del periodo completo.
    if (r.decision) return r.decision.toLowerCase().includes('devoluc') ? r.solicitudes : 0;
    return (r.decisiones ?? [])
      .filter((d) => (d.decision || '').toLowerCase().includes('devoluc'))
      .reduce((a, d) => a + d.total, 0);
  }

  protected ancho(valor: number, max: number): number {
    return max > 0 ? Math.max(2, Math.round((valor / max) * 100)) : 0;
  }

  protected porcentaje(valor: number, total: number): string {
    return total > 0 ? `${Math.round((valor / total) * 100)}%` : '';
  }

  /** Minutos -> "2h 15m" / "3d 4h". */
  protected duracion(min: number | null | undefined): string {
    if (min == null) return '—';
    if (min < 60) return `${min}m`;
    const horas = Math.floor(min / 60);
    if (horas < 24) return `${horas}h ${min % 60}m`;
    return `${Math.floor(horas / 24)}d ${horas % 24}h`;
  }

  protected fecha(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es-CO', { ...ZONA, day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Hora del ingreso/emisión. Vacío si no hay fecha. */
  protected hora(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-CO', { ...ZONA, hour: '2-digit', minute: '2-digit' });
  }

  protected colorEstado(estado: string): string {
    switch (estado) {
      case 'emitido':
        return 'bg-[#10b981]';
      case 'devuelto':
        return 'bg-destructive';
      case 'escalado':
        return 'bg-[#FF9200]';
      case 'en_revision':
        return 'bg-primary';
      default:
        return 'bg-muted-foreground';
    }
  }

  protected badgeEstado(estado: string): string {
    switch (estado) {
      case 'emitido':
        return 'bg-[#10b981]/12 text-[#047857] dark:text-[#34d399]';
      case 'devuelto':
        return 'bg-destructive/12 text-destructive';
      case 'escalado':
        return 'bg-[#FF9200]/14 text-[#b56800] dark:text-[#ffb04a]';
      case 'en_revision':
        return 'bg-[#02B1FF]/12 text-[#0270b8] dark:text-[#5cc3ff]';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }
}
