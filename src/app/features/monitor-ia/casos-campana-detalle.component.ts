// Detalle de una campaña de casos: el sorteo para revisar (el Coordinador puede descartar
// casos), el avance mientras la IA califica y el resultado de cada caso: criterios Si/No,
// resumen y análisis. El Analista solo consulta; el Coordinador además exporta a Excel.

import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AlmaCheckboxComponent } from '../../shared/components/alma-checkbox.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { CampanaCasosDetalle, Caso, MonitorIaCasosApi } from './casos.api';
import { ETIQUETA_FLUJO, claseRespuesta, descargar, estadoCampanaCasos, estadoCaso } from './casos.domain';
import { PERM_CAMPANAS } from './monitor-ia.api';
import { fecha } from './monitor-ia.domain';

const REFRESCO_MS = 3000;

@Component({
  selector: 'alma-casos-campana-detalle',
  imports: [LucideAngularModule, AlmaCheckboxComponent, AlmaLoaderComponent],
  template: `
    <div class="space-y-4">
      <button type="button" class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary" (click)="volver.emit()">
        <lucide-icon name="arrow-left" [size]="16" /> Campañas
      </button>

      @if (cargando() && !campana()) {
        <div class="flex justify-center py-16"><alma-loader [size]="56" label="Cargando campaña…" /></div>
      } @else if (error() && !campana()) {
        <section class="glass rounded-3xl p-6 text-sm text-destructive shadow-[var(--shadow-sm)]">{{ error() }}</section>
      } @else if (campana(); as c) {
        <!-- Encabezado -->
        <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="break-words text-lg font-bold text-foreground">{{ c.nombre }}</h2>
              <p class="text-xs text-muted-foreground">
                Flujo {{ flujo[c.flujo] }} · creada por {{ c.creado_por }} el {{ fecha(c.creado_en, true) }}
              </p>
            </div>
            <span class="alma-badge whitespace-nowrap" [class]="etiqueta().clase">
              @if (etiqueta().enCurso) { <lucide-icon name="loader-2" [size]="12" class="mr-1 animate-spin" /> }
              {{ etiqueta().texto }}
            </span>
          </div>

          <dl class="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div><dt class="inline text-muted-foreground">Cerrados entre: </dt><dd class="inline text-foreground">{{ fecha(c.desde, true) }} → {{ fecha(c.hasta, true) }}</dd></div>
            <div><dt class="inline text-muted-foreground">Propietarios: </dt><dd class="inline text-foreground">{{ c.propietarios.length }} × {{ c.por_propietario }} casos</dd></div>
            @if (c.iniciado_por) {
              <div><dt class="inline text-muted-foreground">Iniciada por: </dt><dd class="inline text-foreground">{{ c.iniciado_por }} · {{ fecha(c.iniciado_en) }}</dd></div>
            }
          </dl>

          @if (c.error) {
            <p class="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <lucide-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0" /> {{ c.error }}
            </p>
          }

          @if (puedeGestionar()) {
            <div class="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              @if (c.estado === 'PREVISUALIZADO') {
                <button type="button" class="alma-btn alma-btn-primary h-9 rounded-xl px-4 text-sm" [disabled]="ocupado() || !kpis().seleccionados" (click)="iniciar()">
                  <lucide-icon name="play" [size]="15" /> Calificar con IA ({{ kpis().seleccionados }})
                </button>
              }
              @if (c.estado === 'PREVISUALIZADO' || c.estado === 'PREVISUALIZANDO' || c.estado === 'EJECUTANDO') {
                <button type="button" class="alma-btn alma-btn-outline h-9 rounded-xl text-sm" [disabled]="ocupado()" (click)="cancelar()">
                  <lucide-icon name="square" [size]="14" /> {{ c.estado === 'EJECUTANDO' ? 'Detener lo que falta' : 'Cancelar' }}
                </button>
              }
              @if ((c.estado === 'TERMINADA' || c.estado === 'ERROR') && kpis().conError) {
                <button type="button" class="alma-btn alma-btn-outline h-9 rounded-xl text-sm" [disabled]="ocupado()" (click)="reintentar()">
                  <lucide-icon name="rotate-ccw" [size]="14" /> Reintentar los {{ kpis().conError }} con error
                </button>
              }
              @if (kpis().calificados) {
                <button type="button" class="alma-btn alma-btn-outline h-9 rounded-xl text-sm" [disabled]="exportando()" (click)="exportar()">
                  <lucide-icon [name]="exportando() ? 'loader-2' : 'file-spreadsheet'" [size]="14" [class.animate-spin]="exportando()" /> Exportar a Excel
                </button>
              }
              @if (c.estado === 'PREVISUALIZADO') {
                <span class="text-xs text-muted-foreground">Desmarca los casos que no quieras calificar antes de iniciar.</span>
              }
            </div>
          }
        </section>

        <!-- Indicadores -->
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          @for (k of tarjetas(); track k.label) {
            <div class="glass rounded-2xl px-3 py-2 shadow-[var(--shadow-sm)]" [attr.title]="k.ayuda">
              <p class="text-[11px] text-muted-foreground">{{ k.label }}</p>
              <p class="text-lg font-bold tabular-nums" [class]="k.clase">{{ k.valor }}</p>
            </div>
          }
        </div>

        @if (c.estado === 'EJECUTANDO') {
          <div class="glass rounded-2xl px-4 py-3 shadow-[var(--shadow-sm)]">
            <div class="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Calificación con IA</span>
              <span class="tabular-nums">{{ kpis().procesados }} de {{ kpis().seleccionados }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary transition-all" [style.width.%]="avance()"></div>
            </div>
          </div>
        }

        <!-- Cumplimiento por criterio -->
        @if (porCriterio().length) {
          <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <h3 class="mb-3 text-sm font-bold text-foreground">Cumplimiento por criterio</h3>
            <div class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              @for (k of porCriterio(); track k.clave) {
                <div class="text-xs">
                  <div class="mb-0.5 flex justify-between gap-2">
                    <span class="min-w-0 break-words text-foreground">{{ k.clave }}</span>
                    <span class="shrink-0 tabular-nums text-muted-foreground">{{ k.si }} / {{ k.total }}</span>
                  </div>
                  <div class="h-1.5 overflow-hidden rounded-full bg-destructive/20">
                    <div class="h-full rounded-full bg-emerald-500" [style.width.%]="(k.si / k.total) * 100"></div>
                  </div>
                </div>
              }
            </div>
          </section>
        }

        <!-- Casos -->
        <section class="glass overflow-hidden rounded-3xl shadow-[var(--shadow-sm)]">
          <header class="border-b border-border/60 px-5 py-3">
            <h3 class="text-sm font-bold text-foreground">Casos ({{ c.casos.length }})</h3>
          </header>
          @if (!c.casos.length) {
            <p class="px-5 py-10 text-center text-sm text-muted-foreground">
              @if (c.estado === 'PREVISUALIZANDO') { Sorteando la muestra en Salesforce… }
              @else { No hubo casos para sortear con estos criterios. }
            </p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-[var(--table-header)] text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
                  <tr>
                    @if (c.estado === 'PREVISUALIZADO' && puedeGestionar()) { <th class="w-10 px-3 py-2"><span class="sr-only">Incluir</span></th> }
                    <th class="px-3 py-2">Caso</th>
                    <th class="px-3 py-2">Propietario</th>
                    <th class="px-3 py-2">Cierre</th>
                    <th class="px-3 py-2">Origen / tema</th>
                    <th class="px-3 py-2">Estado</th>
                    <th class="px-3 py-2 text-right">Cumple</th>
                    <th class="w-8 px-2 py-2"><span class="sr-only">Ver</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (x of c.casos; track x.id) {
                    <tr class="border-t border-border/50" [class.opacity-50]="!x.seleccionada">
                      @if (c.estado === 'PREVISUALIZADO' && puedeGestionar()) {
                        <td class="px-3 py-2">
                          <alma-checkbox [checked]="x.seleccionada" (checkedChange)="seleccionar(x, $event)" [ariaLabel]="'Incluir caso ' + (x.case_number ?? x.case_id)" />
                        </td>
                      }
                      <td class="whitespace-nowrap px-3 py-2">
                        @if (x.enlace_salesforce) {
                          <a [href]="x.enlace_salesforce" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                            {{ x.case_number ?? x.case_id }} <lucide-icon name="external-link" [size]="12" />
                          </a>
                        } @else {
                          <span class="font-medium text-foreground">{{ x.case_number ?? x.case_id }}</span>
                        }
                      </td>
                      <td class="min-w-[10rem] px-3 py-2">
                        <p class="text-foreground">{{ x.owner_nombre ?? '—' }}</p>
                        @if (x.pool !== null) { <p class="text-[11px] text-muted-foreground">entre {{ x.pool }}</p> }
                      </td>
                      <td class="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{{ fecha(x.cerrado_en) }}</td>
                      <td class="min-w-[14rem] px-3 py-2 text-xs">
                        <p class="text-foreground">{{ x.origen ?? '—' }}</p>
                        <p class="break-words text-muted-foreground">{{ x.tema ?? '' }}</p>
                      </td>
                      <td class="px-3 py-2">
                        <span class="alma-badge whitespace-nowrap" [class]="estadoCaso(x.estado).clase" [attr.title]="x.error">{{ estadoCaso(x.estado).texto }}</span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        @if (x.cumplidos !== null) {
                          <span [class.text-destructive]="x.cumplidos < (x.total_criterios ?? 0)">{{ x.cumplidos }} / {{ x.total_criterios }}</span>
                        } @else { — }
                      </td>
                      <td class="px-2 py-2">
                        @if (x.resultado || x.error) {
                          <button type="button" class="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                  [attr.aria-expanded]="abierto() === x.id" [attr.aria-label]="'Ver resultado del caso ' + (x.case_number ?? '')"
                                  (click)="abierto.set(abierto() === x.id ? null : x.id)">
                            <lucide-icon [name]="abierto() === x.id ? 'chevron-up' : 'chevron-down'" [size]="16" />
                          </button>
                        }
                      </td>
                    </tr>
                    @if (abierto() === x.id) {
                      <tr class="bg-[var(--surface-sunken)]">
                        <td [attr.colspan]="columnas()" class="space-y-3 px-5 py-4 text-sm">
                          @if (x.error) {
                            <p class="text-xs text-destructive">{{ x.error }}</p>
                          }
                          @if (x.resultado; as r) {
                            <div class="flex flex-wrap gap-1.5">
                              @for (k of claves(r.calificacion_general); track k) {
                                <span class="alma-badge" [class]="claseRespuesta(r.calificacion_general[k])">{{ k }}: {{ r.calificacion_general[k] }}</span>
                              }
                            </div>
                            <div>
                              <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resumen</p>
                              <p class="whitespace-pre-line text-foreground">{{ r.resumen }}</p>
                            </div>
                            <div>
                              <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Análisis general</p>
                              <p class="whitespace-pre-line text-foreground">{{ r.analisis_general }}</p>
                            </div>
                            <p class="text-[11px] text-muted-foreground">
                              {{ x.tipo ?? '' }}@if (x.producto) { · {{ x.producto }} } · calificado {{ fecha(x.calificado_en) }} · {{ x.modelo }}
                            </p>
                          }
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class CasosCampanaDetalleComponent {
  private readonly api = inject(MonitorIaCasosApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly campanaId = input.required<string>();
  readonly volver = output<void>();

  protected readonly fecha = fecha;
  protected readonly flujo = ETIQUETA_FLUJO;
  protected readonly estadoCaso = estadoCaso;
  protected readonly claseRespuesta = claseRespuesta;

  protected readonly puedeGestionar = computed(() => this.auth.hasPermission(PERM_CAMPANAS));
  protected readonly campana = signal<CampanaCasosDetalle | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly exportando = signal(false);
  protected readonly abierto = signal<number | null>(null);

  protected readonly etiqueta = computed(() => estadoCampanaCasos(this.campana()?.estado ?? ''));

  protected readonly kpis = computed(() => {
    const casos = (this.campana()?.casos ?? []).filter((x) => x.seleccionada);
    const calificados = casos.filter((x) => x.estado === 'CALIFICADO');
    const cumplidos = calificados.reduce((s, x) => s + (x.cumplidos ?? 0), 0);
    const posibles = calificados.reduce((s, x) => s + (x.total_criterios ?? 0), 0);
    return {
      seleccionados: casos.length,
      calificados: calificados.length,
      conError: casos.filter((x) => x.estado === 'ERROR').length,
      sinTexto: casos.filter((x) => x.estado === 'SIN_TEXTO').length,
      procesados: casos.filter((x) => x.estado !== 'PENDIENTE').length,
      cumplimiento: posibles ? Math.round((cumplidos / posibles) * 100) : null,
      perfectos: calificados.filter((x) => x.cumplidos === x.total_criterios).length,
    };
  });

  protected readonly tarjetas = computed(() => {
    const k = this.kpis();
    return [
      { label: 'Casos elegidos', valor: k.seleccionados, clase: 'text-foreground', ayuda: 'Casos del sorteo que se califican.' },
      { label: 'Calificados', valor: k.calificados, clase: 'text-foreground', ayuda: `${k.perfectos} cumplen todos los criterios.` },
      {
        label: 'Cumplimiento',
        valor: k.cumplimiento === null ? '—' : `${k.cumplimiento} %`,
        clase: 'text-foreground',
        ayuda: 'Criterios en «Si» sobre el total de criterios calificados.',
      },
      {
        label: 'Sin calificar',
        valor: k.conError + k.sinTexto,
        clase: k.conError + k.sinTexto ? 'text-destructive' : 'text-foreground',
        ayuda: `${k.conError} con error, ${k.sinTexto} sin descripción ni solución.`,
      },
    ];
  });

  protected readonly avance = computed(() => {
    const k = this.kpis();
    return k.seleccionados ? (k.procesados / k.seleccionados) * 100 : 0;
  });

  /** Cuántos «Si» tiene cada criterio entre los casos calificados. */
  protected readonly porCriterio = computed(() => {
    const cuenta = new Map<string, { si: number; total: number }>();
    for (const x of this.campana()?.casos ?? []) {
      if (!x.seleccionada || !x.resultado) continue;
      for (const [k, v] of Object.entries(x.resultado.calificacion_general)) {
        const c = cuenta.get(k) ?? { si: 0, total: 0 };
        c.total += 1;
        if (v === 'Si') c.si += 1;
        cuenta.set(k, c);
      }
    }
    return [...cuenta.entries()].map(([clave, c]) => ({ clave, ...c }));
  });

  protected readonly columnas = computed(() =>
    this.campana()?.estado === 'PREVISUALIZADO' && this.puedeGestionar() ? 8 : 7,
  );

  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const id = this.campanaId();
      untracked(() => {
        this.campana.set(null);
        void this.cargar(id);
      });
    });
    this.temporizador = setInterval(() => {
      if (this.etiqueta().enCurso) void this.cargar(this.campanaId(), false);
    }, REFRESCO_MS);
    inject(DestroyRef).onDestroy(() => {
      if (this.temporizador) clearInterval(this.temporizador);
    });
  }

  protected claves(calificacion: Record<string, string>): string[] {
    return Object.keys(calificacion);
  }

  private async cargar(id: string, mostrar = true): Promise<void> {
    if (mostrar) this.cargando.set(true);
    try {
      this.campana.set(await this.api.campana(id));
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async seleccionar(caso: Caso, marcado: boolean): Promise<void> {
    const c = this.campana();
    if (!c) return;
    this.campana.set({ ...c, casos: c.casos.map((x) => (x.id === caso.id ? { ...x, seleccionada: marcado } : x)) });
    try {
      await this.api.seleccionarCaso(c.id, caso.id, marcado);
    } catch (e) {
      this.toast.error('No se pudo cambiar la selección', e instanceof Error ? e.message : String(e));
      await this.cargar(c.id, false);
    }
  }

  private async accion(fn: () => Promise<unknown>, exito: string, detalle = ''): Promise<void> {
    this.ocupado.set(true);
    try {
      await fn();
      if (exito) this.toast.show(exito, detalle);
      await this.cargar(this.campanaId(), false);
    } catch (e) {
      this.toast.error('No se pudo completar la acción', e instanceof Error ? e.message : String(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  protected iniciar(): Promise<void> {
    return this.accion(() => this.api.iniciar(this.campanaId()), 'Calificando con IA', 'El avance se actualiza solo.');
  }

  protected cancelar(): Promise<void> {
    return this.accion(() => this.api.cancelar(this.campanaId()), 'Campaña cancelada');
  }

  protected reintentar(): Promise<void> {
    return this.accion(() => this.api.reintentar(this.campanaId()), 'Reintentando los casos con error');
  }

  protected async exportar(): Promise<void> {
    this.exportando.set(true);
    try {
      const { blob, nombre } = await this.api.exportar(this.campanaId());
      descargar(blob, nombre);
    } catch (e) {
      this.toast.error('No se pudo exportar', e instanceof Error ? e.message : String(e));
    } finally {
      this.exportando.set(false);
    }
  }
}
