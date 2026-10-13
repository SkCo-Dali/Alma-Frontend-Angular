// Detalle de una campaña: el sorteo para revisar (el Coordinador puede descartar
// llamadas), el avance mientras se piden las evaluaciones y los resultados de Genesys
// con la nota por grupo y pregunta. El Analista solo consulta.

import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AlmaCheckboxComponent } from '../../shared/components/alma-checkbox.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { CampanaDetalle, Llamada, LlamadaDetalle, MonitorIaApi, PERM_CAMPANAS } from './monitor-ia.api';
import {
  ETIQUETA_COLA,
  ETIQUETA_CRITERIO,
  ETIQUETA_SENTIDO,
  duracion,
  estadoCampana,
  estadoGenesys,
  estadoLlamada,
  fecha,
  nota,
} from './monitor-ia.domain';

const REFRESCO_MS = 3000;
const PEDIDAS = ['SOLICITADA', 'YA_EXISTIA', 'NO_CONFIRMADA'];
const FALLIDAS = ['ERROR', 'DUPLICADA'];

interface GrupoAnalista {
  agentId: string;
  nombre: string;
  pool: number | null;
  llamadas: Llamada[];
}

@Component({
  selector: 'alma-campana-detalle',
  imports: [DecimalPipe, LucideAngularModule, AlmaCheckboxComponent, AlmaLoaderComponent],
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
              <h2 class="truncate text-lg font-bold text-foreground">{{ c.nombre }}</h2>
              <p class="text-xs text-muted-foreground">
                {{ c.form_nombre }} · creada por {{ c.creado_por }} el {{ fecha(c.creado_en, true) }}
              </p>
            </div>
            <span class="alma-badge whitespace-nowrap" [class]="etiqueta().clase">
              @if (etiqueta().enCurso) { <lucide-icon name="loader-2" [size]="12" class="mr-1 animate-spin" /> }
              {{ etiqueta().texto }}
            </span>
          </div>

          <dl class="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div><dt class="inline text-muted-foreground">Período: </dt><dd class="inline text-foreground">{{ fecha(c.desde, true) }} → {{ fecha(c.hasta, true) }}</dd></div>
            <div><dt class="inline text-muted-foreground">Sentido: </dt><dd class="inline text-foreground">{{ sentido[c.sentido] }}</dd></div>
            <div><dt class="inline text-muted-foreground">Colas: </dt><dd class="inline text-foreground">{{ modoCola[c.modo_cola] }}@if (c.modo_cola === 'selected') { ({{ c.cola_ids.length }}) }</dd></div>
            <div><dt class="inline text-muted-foreground">Duración mínima: </dt><dd class="inline text-foreground">{{ c.duracion_min_seg / 60 | number: '1.0-1' }} min · {{ criterio[c.criterio_duracion] }}</dd></div>
            <div><dt class="inline text-muted-foreground">Analistas: </dt><dd class="inline text-foreground">{{ c.analistas.length }} × {{ c.por_analista }} llamadas</dd></div>
            @if (c.iniciado_por) {
              <div><dt class="inline text-muted-foreground">Iniciada por: </dt><dd class="inline text-foreground">{{ c.iniciado_por }} · {{ fecha(c.iniciado_en) }}</dd></div>
            }
          </dl>

          @if (c.error) {
            <p class="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <lucide-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0" /> {{ c.error }}
            </p>
          }

          <!-- Acciones -->
          @if (puedeGestionar()) {
            <div class="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              @if (c.estado === 'PREVISUALIZADO') {
                <button type="button" class="alma-btn alma-btn-primary h-9 rounded-xl px-4 text-sm" [disabled]="ocupado() || !kpis().seleccionadas" (click)="iniciar()">
                  <lucide-icon name="play" [size]="15" /> Iniciar campaña ({{ kpis().seleccionadas }})
                </button>
              }
              @if (c.estado === 'PREVISUALIZADO' || c.estado === 'PREVISUALIZANDO' || c.estado === 'EJECUTANDO') {
                <button type="button" class="alma-btn alma-btn-outline h-9 rounded-xl text-sm" [disabled]="ocupado()" (click)="cancelar()">
                  <lucide-icon name="square" [size]="14" /> {{ c.estado === 'EJECUTANDO' ? 'Detener lo que falta' : 'Cancelar' }}
                </button>
              }
              @if (c.estado === 'SOLICITUDES_ENVIADAS' || c.estado === 'RESULTADOS_ACTUALIZADOS') {
                <button type="button" class="alma-btn alma-btn-outline h-9 rounded-xl text-sm" [disabled]="ocupado()" (click)="actualizarResultados()">
                  <lucide-icon name="refresh-cw" [size]="14" [class.animate-spin]="ocupado()" /> Actualizar resultados
                </button>
              }
              @if (c.estado === 'PREVISUALIZADO') {
                <span class="text-xs text-muted-foreground">Desmarca las llamadas que no quieras evaluar antes de iniciar.</span>
              }
            </div>
          }
        </section>

        <!-- Indicadores -->
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
              <span>Solicitudes a Genesys</span>
              <span class="tabular-nums">{{ kpis().avance }} de {{ kpis().seleccionadas }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary transition-all" [style.width.%]="kpis().seleccionadas ? (kpis().avance / kpis().seleccionadas) * 100 : 0"></div>
            </div>
          </div>
        }

        <!-- Llamadas por analista -->
        @if (c.estado === 'PREVISUALIZANDO') {
          <section class="glass rounded-3xl px-6 py-10 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm)]">
            Consultando las llamadas de {{ c.analistas.length }} analistas en Genesys y sorteando la muestra…
            <span class="block text-xs">Esta pantalla se actualiza sola.</span>
          </section>
        } @else if (!c.llamadas.length) {
          <section class="glass rounded-3xl px-6 py-10 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm)]">
            No se encontraron llamadas que cumplan los criterios en ese período.
          </section>
        } @else {
          @for (g of grupos(); track g.agentId) {
            <section class="glass overflow-hidden rounded-3xl shadow-[var(--shadow-sm)]">
              <header class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-2.5">
                <h3 class="text-sm font-bold text-foreground">{{ g.nombre }}</h3>
                <span class="text-xs text-muted-foreground">
                  {{ g.llamadas.length }} sorteadas@if (g.pool !== null) { de {{ g.pool }} disponibles }
                </span>
              </header>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-[var(--table-header)] text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
                    <tr>
                      @if (c.estado === 'PREVISUALIZADO' && puedeGestionar()) { <th class="w-10 px-4 py-2">Incluir</th> }
                      <th class="px-4 py-2">Inicio</th>
                      <th class="px-4 py-2 text-right">Total</th>
                      <th class="px-4 py-2 text-right">Asesor</th>
                      <th class="px-4 py-2">Estado</th>
                      <th class="px-4 py-2">En Genesys</th>
                      <th class="px-4 py-2 text-right">Nota</th>
                      <th class="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (l of g.llamadas; track l.id) {
                      <tr class="border-t border-border/50 hover:bg-accent/60" [class.opacity-50]="!l.seleccionada">
                        @if (c.estado === 'PREVISUALIZADO' && puedeGestionar()) {
                          <td class="px-4 py-2">
                            <alma-checkbox [checked]="l.seleccionada" (checkedChange)="seleccionar(l, $event)" ariaLabel="Incluir esta llamada" />
                          </td>
                        }
                        <td class="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{{ fecha(l.inicio) }}</td>
                        <td class="px-4 py-2 text-right tabular-nums">{{ duracion(l.segundos_total) }}</td>
                        <td class="px-4 py-2 text-right tabular-nums">{{ duracion(l.segundos_agente) }}</td>
                        <td class="px-4 py-2">
                          @if (c.estado === 'PREVISUALIZADO' || !l.seleccionada) {
                            <span class="text-xs text-muted-foreground">{{ l.seleccionada ? 'Incluida' : 'Descartada' }}</span>
                          } @else {
                            <span class="alma-badge whitespace-nowrap" [class]="estadoLlamada(l.estado).clase" [attr.title]="l.error">{{ estadoLlamada(l.estado).texto }}</span>
                          }
                        </td>
                        <td class="px-4 py-2 text-xs text-muted-foreground">{{ estadoGenesys(l.estado_genesys) }}</td>
                        <td class="px-4 py-2 text-right font-semibold tabular-nums">{{ nota(l.puntaje, l.puntaje_max) }}</td>
                        <td class="whitespace-nowrap px-4 py-2 text-right">
                          @if (l.estado_genesys) {
                            <button type="button" class="mr-2 text-xs font-medium text-primary hover:underline" (click)="alternar(l)">
                              {{ abierta() === l.id ? 'Ocultar' : 'Ver detalle' }}
                            </button>
                          }
                          <a [href]="l.enlace_genesys" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary" title="Abrir la llamada en Genesys">
                            Genesys <lucide-icon name="external-link" [size]="12" />
                          </a>
                        </td>
                      </tr>
                      @if (l.error && !PEDIDAS.includes(l.estado)) {
                        <tr class="bg-destructive/5"><td [attr.colspan]="8" class="px-4 py-1.5 text-xs text-destructive">{{ l.error }}</td></tr>
                      }
                      @if (abierta() === l.id) {
                        <tr class="border-t border-border/50 bg-[var(--surface-sunken)]">
                          <td [attr.colspan]="8" class="px-4 py-3">
                            @if (detalle(); as d) {
                              @for (gr of d.detalle ?? []; track gr.grupo) {
                                <div class="mb-3 last:mb-0">
                                  <p class="mb-1 text-xs font-bold text-foreground">
                                    {{ gr.grupo }} — {{ nota(gr.puntaje, gr.maximo) }}
                                  </p>
                                  @for (p of gr.preguntas; track p.pregunta) {
                                    <div class="mb-1 rounded-lg bg-background/50 px-3 py-1.5 text-xs">
                                      <p class="text-foreground">{{ p.pregunta }}</p>
                                      <p class="text-muted-foreground">
                                        <span class="font-medium text-foreground">{{ p.respuesta ?? 'Sin respuesta' }}</span>
                                        @if (p.puntaje !== null) { · {{ p.puntaje }} pts }
                                      </p>
                                      @if (p.comentario) { <p class="mt-0.5 italic text-muted-foreground">{{ p.comentario }}</p> }
                                    </div>
                                  }
                                </div>
                              } @empty {
                                <p class="text-xs text-muted-foreground">Genesys todavía no devuelve las notas de esta evaluación.</p>
                              }
                            } @else {
                              <alma-loader [size]="32" label="Cargando detalle…" />
                            }
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }
        }
      }
    </div>
  `,
})
export class CampanaDetalleComponent {
  private readonly api = inject(MonitorIaApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly campanaId = input.required<string>();
  readonly volver = output<void>();

  protected readonly PEDIDAS = PEDIDAS;
  protected readonly sentido = ETIQUETA_SENTIDO;
  protected readonly modoCola = ETIQUETA_COLA;
  protected readonly criterio = ETIQUETA_CRITERIO;
  protected readonly fecha = fecha;
  protected readonly duracion = duracion;
  protected readonly nota = nota;
  protected readonly estadoLlamada = estadoLlamada;
  protected readonly estadoGenesys = estadoGenesys;

  protected readonly puedeGestionar = computed(() => this.auth.hasPermission(PERM_CAMPANAS));

  protected readonly campana = signal<CampanaDetalle | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly abierta = signal<number | null>(null);
  protected readonly detalle = signal<LlamadaDetalle | null>(null);

  private temporizador: ReturnType<typeof setInterval> | null = null;
  private pidiendo = false;

  protected readonly etiqueta = computed(() => estadoCampana(this.campana()?.estado ?? ''));

  protected readonly grupos = computed<GrupoAnalista[]>(() => {
    const porAnalista = new Map<string, GrupoAnalista>();
    for (const l of this.campana()?.llamadas ?? []) {
      let g = porAnalista.get(l.agent_id);
      if (!g) {
        g = { agentId: l.agent_id, nombre: l.agent_nombre ?? l.agent_id, pool: l.pool, llamadas: [] };
        porAnalista.set(l.agent_id, g);
      }
      g.llamadas.push(l);
    }
    return [...porAnalista.values()];
  });

  protected readonly kpis = computed(() => {
    const incluidas = (this.campana()?.llamadas ?? []).filter((l) => l.seleccionada);
    const conNota = incluidas.filter((l) => l.puntaje !== null && l.puntaje_max);
    const promedio = conNota.length
      ? conNota.reduce((a, l) => a + (l.puntaje as number) / (l.puntaje_max as number), 0) / conNota.length
      : null;
    return {
      seleccionadas: incluidas.length,
      pedidas: incluidas.filter((l) => PEDIDAS.includes(l.estado)).length,
      conNota: conNota.length,
      conError: incluidas.filter((l) => FALLIDAS.includes(l.estado)).length,
      promedio,
      avance: incluidas.filter((l) => l.estado !== 'PENDIENTE').length,
    };
  });

  protected readonly tarjetas = computed(() => {
    const k = this.kpis();
    return [
      { label: 'Llamadas incluidas', valor: String(k.seleccionadas), clase: 'text-foreground', ayuda: 'Las que se evaluarán (las descartadas no cuentan).' },
      { label: 'Solicitadas', valor: String(k.pedidas), clase: 'text-sky-700 dark:text-sky-300', ayuda: 'Ya pedidas a Genesys, o que Genesys ya tenía.' },
      { label: 'Con resultado', valor: String(k.conNota), clase: 'text-emerald-700 dark:text-emerald-400', ayuda: 'Genesys ya devolvió la nota.' },
      { label: 'Con error', valor: String(k.conError), clase: k.conError ? 'text-destructive' : 'text-foreground', ayuda: 'Genesys no aceptó la solicitud; el motivo está en la fila.' },
      { label: 'Nota promedio', valor: k.promedio === null ? '—' : `${(k.promedio * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`, clase: 'text-foreground', ayuda: 'Promedio de las notas como porcentaje del máximo.' },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detener());
    effect(() => {
      this.campanaId();
      untracked(() => {
        this.campana.set(null);
        this.abierta.set(null);
        this.cargando.set(true);
        void this.cargar();
      });
    });
  }

  private detener(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
  }

  /** Mientras hay trabajo en segundo plano la pantalla se refresca sola. */
  private programar(): void {
    const enCurso = this.etiqueta().enCurso;
    if (enCurso && !this.temporizador) {
      this.temporizador = setInterval(() => void this.cargar(), REFRESCO_MS);
    } else if (!enCurso) {
      this.detener();
    }
  }

  private async cargar(): Promise<void> {
    if (this.pidiendo) return;
    this.pidiendo = true;
    try {
      this.campana.set(await this.api.campana(this.campanaId()));
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.pidiendo = false;
      this.cargando.set(false);
      this.programar();
    }
  }

  private async ejecutar(accion: () => Promise<unknown>, falla: string): Promise<boolean> {
    this.ocupado.set(true);
    try {
      await accion();
      return true;
    } catch (e) {
      this.toast.error(falla, e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      this.ocupado.set(false);
      await this.cargar();
    }
  }

  protected async iniciar(): Promise<void> {
    const n = this.kpis().seleccionadas;
    if (!confirm(`¿Enviar ${n} solicitudes de autoevaluación a Genesys?\n\nEsto crea evaluaciones en Genesys y no se puede deshacer.`)) return;
    if (await this.ejecutar(() => this.api.iniciar(this.campanaId()), 'No se pudo iniciar la campaña')) {
      this.toast.show('Campaña iniciada', 'Se están enviando las solicitudes a Genesys.');
    }
  }

  protected async cancelar(): Promise<void> {
    const enCurso = this.campana()?.estado === 'EJECUTANDO';
    const aviso = enCurso
      ? 'Se detendrán las solicitudes que faltan. Las que ya se enviaron a Genesys se quedan.'
      : 'La campaña se cancelará.';
    if (!confirm(`${aviso}\n\n¿Continuar?`)) return;
    await this.ejecutar(() => this.api.cancelar(this.campanaId()), 'No se pudo cancelar la campaña');
  }

  protected async actualizarResultados(): Promise<void> {
    const id = this.campanaId();
    await this.ejecutar(async () => {
      const r = await this.api.actualizarResultados(id);
      this.toast.show('Resultados actualizados', `${r.actualizadas} evaluaciones consultadas en Genesys.`);
    }, 'No se pudieron actualizar los resultados');
  }

  protected async seleccionar(l: Llamada, marcada: boolean): Promise<void> {
    if (l.seleccionada === marcada) return;
    this.cambiarLocal(l.id, marcada);
    try {
      await this.api.seleccionarLlamada(this.campanaId(), l.id, marcada);
    } catch (e) {
      this.cambiarLocal(l.id, !marcada);
      this.toast.error('No se pudo cambiar la selección', e instanceof Error ? e.message : String(e));
    }
  }

  private cambiarLocal(id: number, seleccionada: boolean): void {
    const c = this.campana();
    if (!c) return;
    this.campana.set({ ...c, llamadas: c.llamadas.map((x) => (x.id === id ? { ...x, seleccionada } : x)) });
  }

  protected async alternar(l: Llamada): Promise<void> {
    if (this.abierta() === l.id) {
      this.abierta.set(null);
      return;
    }
    this.abierta.set(l.id);
    this.detalle.set(null);
    try {
      this.detalle.set(await this.api.llamada(this.campanaId(), l.id));
    } catch (e) {
      this.toast.error('No se pudo cargar el detalle', e instanceof Error ? e.message : String(e));
      this.abierta.set(null);
    }
  }
}
