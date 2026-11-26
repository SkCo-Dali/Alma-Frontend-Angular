// «Analítica» de la Agenda: cómo van las asesorías (sin datos personales; GET /api/agenda/analitica).
//
// Hecho con la skill dataviz: forma según la tarea de cada dato (fila de indicadores, barra
// segmentada para el reparto por estado, columnas para la tendencia semanal, barras ordenadas
// de un solo tono para comparar tipos, tabla con medidores por asesor y mapa de calor
// secuencial para días y horas). Colores de estado validados con validate_palette.js (claro y
// oscuro). Todo valor que muestra un tooltip también está en una etiqueta o en una tabla.

import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { AgendaApi, Analitica, EstadoAnalitica, Servicio, hoyColombia, sumarDias } from './agenda.api';

type Rango = '30' | '90' | 'anio' | 'proximos' | 'personalizado';

const RANGOS: { id: Rango; rotulo: string }[] = [
  { id: '30', rotulo: 'Últimos 30 días' },
  { id: '90', rotulo: 'Últimos 90 días' },
  { id: 'anio', rotulo: 'Este año' },
  { id: 'proximos', rotulo: 'Próximos 30 días' },
  { id: 'personalizado', rotulo: 'Personalizado' },
];

/** Orden y color de los estados: los cuatro primeros, en este orden, pasan el validador (CVD
 *  y visión normal) en fondo claro y oscuro; «sin registrar» va en el gris de des-énfasis. */
const ESTADOS: { id: EstadoAnalitica; rotulo: string; color: string }[] = [
  { id: 'atendida', rotulo: 'Atendidas', color: '#009a2f' },
  { id: 'proxima', rotulo: 'Próximas', color: '#1f6feb' },
  { id: 'no_asistio', rotulo: 'No asistió', color: '#d06a22' },
  { id: 'cancelada', rotulo: 'Canceladas', color: '#8a4fd6' },
  { id: 'sin_registrar', rotulo: 'Sin registrar resultado', color: '#a5a5a5' },
];

const SERIE = '#009a2f';                 // un solo tono para magnitudes (verde Skandia, paso oscuro)
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const HORAS = Array.from({ length: 11 }, (_, i) => 7 + i);   // 7:00 a 17:00

interface Tooltip { x: number; y: number; titulo: string; lineas: { color?: string; texto: string; valor: string }[]; }

@Component({
  selector: 'alma-analitica-agenda',
  imports: [LucideAngularModule, AlmaLoaderComponent],
  styles: [`
    .tile-valor { font-size: 1.75rem; line-height: 1.1; font-weight: 600; }
    .cifra { font-variant-numeric: tabular-nums; }
    .hit:hover .col, .hit:focus .col { filter: brightness(1.12); }
    .hit:focus { outline: none; }
    .hit:focus-visible .col { stroke: currentColor; stroke-width: 2; }
  `],
  template: `
    <div class="space-y-4" (pointerleave)="tip.set(null)">
      <!-- Filtros: una fila, arriba de todo, rango primero -->
      <div class="glass flex flex-wrap items-center gap-2 rounded-2xl p-2 shadow-[var(--shadow-sm)]">
        <div class="inline-flex flex-wrap gap-1" role="radiogroup" aria-label="Periodo">
          @for (r of rangos; track r.id) {
            <button type="button" role="radio" class="h-8 rounded-xl px-3 text-xs font-medium transition-colors" [attr.aria-checked]="rango() === r.id"
                    [class]="rango() === r.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground'"
                    (click)="cambiarRango(r.id)">{{ r.rotulo }}</button>
          }
        </div>
        @if (rango() === 'personalizado') {
          <div class="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Periodo personalizado" (keydown.enter)="aplicarPersonalizado()">
            <label class="sr-only" for="an-desde">Desde</label>
            <input id="an-desde" type="date" class="alma-input h-8 w-36 text-xs" [value]="personalizado().desde" [max]="personalizado().hasta"
                   (change)="personalizado.set({ ...personalizado(), desde: $any($event.target).value })" />
            <span class="text-muted-foreground">a</span>
            <label class="sr-only" for="an-hasta">Hasta</label>
            <input id="an-hasta" type="date" class="alma-input h-8 w-36 text-xs" [value]="personalizado().hasta" [min]="personalizado().desde"
                   (change)="personalizado.set({ ...personalizado(), hasta: $any($event.target).value })" />
            <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" [disabled]="cargando()" (click)="aplicarPersonalizado()">Aplicar</button>
          </div>
        }
        <select class="alma-input h-8 w-56 text-xs" aria-label="Servicio" (change)="cambiarServicio(+$any($event.target).value || null)">
          <option value="">Todos los servicios</option>
          @for (s of servicios(); track s.Id) { <option [value]="s.Id" [selected]="servicio() === s.Id">{{ s.Titulo }}</option> }
        </select>
        @if (datos(); as d) { <span class="ml-auto pr-2 text-[11px] text-muted-foreground">{{ fechaCorta(d.desde) }} – {{ fechaCorta(d.hasta) }} · por fecha de la cita</span> }
      </div>

      @if (!datos()) {
        <div class="flex justify-center py-10"><alma-loader [size]="56" label="Calculando…" /></div>
      } @else {
      @let d = datos()!;
      <div class="space-y-4 transition-opacity" [class.opacity-50]="cargando()">

        <!-- Indicadores -->
        <div class="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <div class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
            <p class="text-xs text-muted-foreground">Citas</p>
            <p class="tile-valor mt-1 text-foreground">{{ numero(d.totales.citas) }}</p>
            <p class="mt-1 text-[11px] text-muted-foreground">{{ variacion() }}</p>
          </div>
          <div class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
            <p class="text-xs text-muted-foreground">Asistencia</p>
            <p class="tile-valor mt-1 text-foreground">{{ pct(d.totales.asistencia) }}</p>
            <p class="mt-1 text-[11px] text-muted-foreground">{{ d.totales.atendida }} atendidas · {{ d.totales.no_asistio }} no asistió</p>
          </div>
          <div class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
            <p class="text-xs text-muted-foreground">Cancelaciones</p>
            <p class="tile-valor mt-1 text-foreground">{{ pct(d.totales.cancelacion) }}</p>
            <p class="mt-1 text-[11px] text-muted-foreground">{{ d.totales.cancelada }} canceladas · {{ d.totales.reprogramaciones }} reprogramaciones</p>
          </div>
          <div class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
            <p class="flex items-center gap-1 text-xs text-muted-foreground">
              Sin registrar resultado
              @if (d.totales.sin_registrar) { <lucide-icon name="alert-triangle" [size]="13" class="text-amber-600 dark:text-amber-400" aria-label="Requiere atención" /> }
            </p>
            <p class="tile-valor mt-1 text-foreground">{{ numero(d.totales.sin_registrar) }}</p>
            <p class="mt-1 text-[11px] text-muted-foreground">Citas pasadas que el asesor no marcó</p>
          </div>
          <div class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
            <p class="text-xs text-muted-foreground">Anticipación promedio</p>
            <p class="tile-valor mt-1 text-foreground">{{ d.totales.anticipacionDias === null ? '—' : dec(d.totales.anticipacionDias) + ' días' }}</p>
            <p class="mt-1 text-[11px] text-muted-foreground">{{ pctDe(d.totales.desdeSitio, d.totales.citas) }} agendadas desde el sitio</p>
          </div>
        </div>

        @if (!d.totales.citas) {
          <p class="glass rounded-3xl py-10 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm)]">No hay citas en este periodo.</p>
        } @else {

        <!-- Estado: una barra segmentada (un todo en ≤ 6 partes) -->
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <h2 class="text-sm font-bold text-foreground">Estado de las citas</h2>
          <p class="mb-3 text-xs text-muted-foreground">{{ numero(d.totales.citas) }} citas del periodo; las reprogramadas cuentan una sola vez.</p>
          <div #barra class="flex h-7 w-full gap-0.5" role="img" [attr.aria-label]="resumenEstados()">
            @for (s of segmentos(); track s.id) {
              <div class="hit relative flex h-full min-w-0 items-center rounded px-1.5 text-[11px] font-semibold" tabindex="0"
                   [style.width.%]="s.pct" [style.background]="s.color" [style.color]="s.id === 'sin_registrar' ? '#232323' : '#ffffff'"
                   (pointermove)="mostrar($event, s.rotulo, [{ color: s.color, texto: 'Citas', valor: numero(s.n) + ' · ' + dec(s.pct) + ' %' }])"
                   (focus)="mostrarEn($event, s.rotulo, [{ color: s.color, texto: 'Citas', valor: numero(s.n) + ' · ' + dec(s.pct) + ' %' }])"
                   (pointerleave)="tip.set(null)" (blur)="tip.set(null)">
                <!-- La cifra va dentro solo si cabe (medido); si no, queda en la leyenda y el tooltip. -->
                @if (s.pct / 100 * anchoBarra() >= 42) { <span class="cifra whitespace-nowrap">{{ round(s.pct) }} %</span> }
              </div>
            }
          </div>
          <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-foreground">
            @for (s of segmentos(); track s.id) {
              <li class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" [style.background]="s.color" aria-hidden="true"></span>{{ s.rotulo }} <span class="cifra text-muted-foreground">{{ numero(s.n) }}</span></li>
            }
          </ul>
        </section>

        <div class="grid gap-4 xl:grid-cols-[3fr_2fr]">
          <!-- Tendencia semanal: columnas de un solo tono -->
          <section class="glass min-w-0 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <header class="mb-2 flex items-baseline gap-2">
              <h2 class="mr-auto text-sm font-bold text-foreground">Citas por semana</h2>
              <button type="button" class="text-[11px] text-muted-foreground underline-offset-2 hover:underline" (click)="tablaSemanas.set(!tablaSemanas())">{{ tablaSemanas() ? 'Ver gráfico' : 'Ver tabla' }}</button>
            </header>
            @if (!tablaSemanas()) {
              @let g = grafSemanas();
              <svg class="block h-56 w-full text-muted-foreground" [attr.viewBox]="'0 0 ' + g.ancho + ' ' + g.alto" preserveAspectRatio="none" role="img"
                   [attr.aria-label]="'Citas por semana, máximo ' + g.max + ' en una semana'">
                @for (t of g.ticks; track t.v) {
                  <line [attr.x1]="g.izq" [attr.x2]="g.ancho" [attr.y1]="t.y" [attr.y2]="t.y" stroke="currentColor" stroke-opacity="0.18" stroke-width="1" vector-effect="non-scaling-stroke" />
                }
                @for (c of g.cols; track c.semana) {
                  <g class="hit" tabindex="0" (pointermove)="mostrar($event, c.titulo, c.lineas)" (focus)="mostrarEn($event, c.titulo, c.lineas)" (pointerleave)="tip.set(null)" (blur)="tip.set(null)">
                    <rect [attr.x]="c.banda" y="0" [attr.width]="g.paso" [attr.height]="g.base" fill="transparent" />
                    @if (c.alto > 0) { <path class="col" [attr.d]="c.d" [attr.fill]="serie" [attr.fill-opacity]="c.futura ? 0.45 : 1" /> }
                  </g>
                }
                <line [attr.x1]="g.izq" [attr.x2]="g.ancho" [attr.y1]="g.base" [attr.y2]="g.base" stroke="currentColor" stroke-opacity="0.35" stroke-width="1" vector-effect="non-scaling-stroke" />
              </svg>
              <!-- Ejes en HTML para que el texto no se deforme con el SVG -->
              <div class="relative -mt-56 h-56 pointer-events-none text-[10px] text-muted-foreground cifra" aria-hidden="true">
                @for (t of g.ticks; track t.v) { <span class="absolute left-0 -translate-y-1/2" [style.top.%]="t.y / g.alto * 100">{{ t.v }}</span> }
              </div>
              <div class="relative mt-1 h-4 text-[10px] text-muted-foreground" aria-hidden="true">
                @for (e of g.etiquetas; track e.texto) { <span class="absolute -translate-x-1/2 whitespace-nowrap" [style.left.%]="e.x">{{ e.texto }}</span> }
              </div>
              @if (g.hayFuturas) { <p class="mt-1 text-[11px] text-muted-foreground">Las columnas claras son semanas que aún no terminan o no llegan.</p> }
            } @else {
              <div class="max-h-64 overflow-auto">
                <table class="w-full text-xs">
                  <thead class="text-left text-muted-foreground"><tr><th class="py-1">Semana del</th><th class="py-1 text-right">Citas</th><th class="py-1 text-right">Atendidas</th><th class="py-1 text-right">No asistió</th><th class="py-1 text-right">Canceladas</th></tr></thead>
                  <tbody class="cifra">
                    @for (s of d.porSemana; track s.semana) {
                      <tr class="border-t border-border/40"><td class="py-1">{{ fechaCorta(s.semana) }}</td><td class="py-1 text-right">{{ s.n }}</td><td class="py-1 text-right">{{ s.atendida }}</td><td class="py-1 text-right">{{ s.no_asistio }}</td><td class="py-1 text-right">{{ s.cancelada }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>

          <!-- Por tipo: barras ordenadas, un solo tono, valor en la punta -->
          <section class="glass min-w-0 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <h2 class="mb-3 text-sm font-bold text-foreground">Por tipo de cita</h2>
            <ul class="space-y-2.5">
              @for (t of d.porTipo; track t.tipoId) {
                <li class="hit" tabindex="0"
                    (pointermove)="mostrar($event, t.titulo, lineasTipo(t))" (focus)="mostrarEn($event, t.titulo, lineasTipo(t))" (pointerleave)="tip.set(null)" (blur)="tip.set(null)">
                  <p class="mb-1 flex items-center gap-1.5 text-xs text-foreground">
                    <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="t.color" aria-hidden="true"></span>
                    <span class="truncate">{{ t.titulo }}</span>
                    <span class="ml-auto shrink-0 text-[11px] text-muted-foreground">asistencia {{ pct(t.asistencia) }}</span>
                  </p>
                  <div class="flex items-center gap-2">
                    <div class="h-3 flex-1">
                      <div class="col h-full rounded-r" [style.width.%]="t.n / maxTipo() * 100" [style.background]="serie"></div>
                    </div>
                    <span class="cifra w-8 shrink-0 text-right text-xs font-semibold text-foreground">{{ t.n }}</span>
                  </div>
                </li>
              }
            </ul>
          </section>
        </div>

        <div class="grid gap-4 xl:grid-cols-2">
          <!-- Por asesor: tabla con medidor de asistencia -->
          <section class="glass min-w-0 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <h2 class="mb-3 text-sm font-bold text-foreground">Por asesor</h2>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead class="text-left text-muted-foreground">
                  <tr><th class="py-1.5 pr-2">Asesor</th><th class="py-1.5 text-right">Citas</th><th class="py-1.5 text-right">Atendidas</th><th class="py-1.5 text-right">No asistió</th><th class="py-1.5 text-right">Sin registrar</th><th class="py-1.5 pl-4">Asistencia</th></tr>
                </thead>
                <tbody class="cifra text-foreground">
                  @for (a of d.porAsesor; track a.asesorId) {
                    <tr class="border-t border-border/40">
                      <td class="py-2 pr-2 font-sans">{{ a.nombre }}</td>
                      <td class="py-2 text-right">{{ a.n }}</td>
                      <td class="py-2 text-right">{{ a.atendida }}</td>
                      <td class="py-2 text-right">{{ a.no_asistio }}</td>
                      <td class="py-2 text-right" [class.text-amber-700]="a.sin_registrar" [class.dark:text-amber-400]="a.sin_registrar">{{ a.sin_registrar }}</td>
                      <td class="py-2 pl-4">
                        <div class="flex items-center gap-2">
                          <div class="h-2 w-20 rounded-full bg-[#009a2f]/15"><div class="h-full rounded-full bg-[#009a2f]" [style.width.%]="(a.asistencia ?? 0) * 100"></div></div>
                          <span class="w-10 text-right">{{ pct(a.asistencia) }}</span>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <!-- Días y horas: mapa de calor secuencial (un tono, más es más intenso) -->
          <section class="glass min-w-0 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <h2 class="text-sm font-bold text-foreground">Cuándo son las citas</h2>
            <p class="mb-3 text-xs text-muted-foreground">Hora de inicio, en hora de Colombia.</p>
            <div class="overflow-x-auto">
              <div class="grid min-w-[26rem] gap-0.5" [style.grid-template-columns]="'2.5rem repeat(' + horas.length + ', minmax(0, 1fr))'" role="table" aria-label="Citas por día y hora">
                <span></span>
                @for (h of horas; track h) { <span class="pb-1 text-center text-[10px] text-muted-foreground cifra" role="columnheader">{{ h }}</span> }
                @for (dia of dias; track $index; let di = $index) {
                  <span class="flex items-center text-[11px] text-muted-foreground" role="rowheader">{{ dia }}</span>
                  @for (h of horas; track h) {
                    @let n = calor().get(di + '-' + h) ?? 0;
                    <div class="hit h-7 rounded-[3px] border border-border/30" role="cell" tabindex="0" [attr.aria-label]="dia + ' ' + h + ':00, ' + n + ' citas'"
                         [style.background]="n ? 'rgba(0, 199, 61,' + (0.15 + 0.85 * n / maxCalor()) + ')' : 'transparent'"
                         (pointermove)="mostrar($event, dia + ' · ' + h + ':00', [{ texto: 'Citas', valor: numero(n) }])"
                         (focus)="mostrarEn($event, dia + ' · ' + h + ':00', [{ texto: 'Citas', valor: numero(n) }])"
                         (pointerleave)="tip.set(null)" (blur)="tip.set(null)"></div>
                  }
                }
              </div>
            </div>
            <div class="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground" aria-hidden="true">
              <span>Menos</span>
              @for (o of [0.15, 0.36, 0.58, 0.79, 1]; track o) { <span class="h-2.5 w-5 rounded-sm" [style.background]="'rgba(0, 199, 61,' + o + ')'"></span> }
              <span>Más · máximo {{ maxCalor() }} en una hora</span>
            </div>
          </section>
        </div>
        }
      </div>
      }

      <!-- Tooltip: el valor primero y fuerte; el nombre detrás -->
      @if (tip(); as t) {
        <div class="pointer-events-none fixed z-50 min-w-36 rounded-xl border border-border/60 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
             [style.left.px]="t.x + 14" [style.top.px]="t.y + 14" role="tooltip">
          <p class="mb-1 font-semibold">{{ t.titulo }}</p>
          @for (l of t.lineas; track $index) {
            <p class="flex items-center gap-2">
              @if (l.color) { <span class="h-0.5 w-3 rounded" [style.background]="l.color"></span> }
              <span class="cifra font-semibold">{{ l.valor }}</span><span class="text-muted-foreground">{{ l.texto }}</span>
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class AnaliticaAgendaComponent {
  private readonly api = inject(AgendaApi);
  private readonly toast = inject(ToastService);

  protected readonly rangos = RANGOS;
  protected readonly dias = DIAS;
  protected readonly horas = HORAS;
  protected readonly serie = SERIE;
  protected readonly rango = signal<Rango>('30');
  protected readonly servicio = signal<number | null>(null);
  protected readonly servicios = signal<Servicio[]>([]);
  protected readonly datos = signal<Analitica | null>(null);
  protected readonly cargando = signal(false);
  protected readonly tablaSemanas = signal(false);
  protected readonly tip = signal<Tooltip | null>(null);
  protected readonly anchoBarra = signal(0);
  private readonly barra = viewChild<ElementRef<HTMLElement>>('barra');

  constructor() {
    // Ancho real de la barra de estados, para decidir si cada cifra cabe en su bloque.
    const obs = new ResizeObserver(([e]) => this.anchoBarra.set(e.contentRect.width));
    effect(() => {
      const el = this.barra()?.nativeElement;
      obs.disconnect();
      if (el) obs.observe(el);
    });
    inject(DestroyRef).onDestroy(() => obs.disconnect());
    void this.cargar();
    this.api.configuracion().then((c) => this.servicios.set(c.servicios)).catch(() => undefined);
  }

  /** Rango libre: arranca con el que se está viendo y se carga al «Aplicar». */
  protected readonly personalizado = signal({ desde: sumarDias(hoyColombia(), -29), hasta: hoyColombia() });

  protected cambiarRango(r: Rango): void {
    if (r === 'personalizado') {
      const d = this.datos();
      if (d) this.personalizado.set({ desde: d.desde, hasta: d.hasta });
      this.rango.set(r);
      return;
    }
    this.rango.set(r);
    void this.cargar();
  }

  protected aplicarPersonalizado(): void {
    const { desde, hasta } = this.personalizado();
    if (!desde || !hasta || hasta < desde) {
      this.toast.error('Revise el periodo', 'La fecha final debe ser igual o posterior a la inicial.');
      return;
    }
    if (diasEntre(desde, hasta) > 400) {
      this.toast.error('Periodo muy largo', 'Elija máximo 400 días.');
      return;
    }
    void this.cargar();
  }

  protected cambiarServicio(id: number | null): void {
    this.servicio.set(id);
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    const hoy = hoyColombia();
    const [desde, hasta] = ({
      '30': [sumarDias(hoy, -29), hoy],
      '90': [sumarDias(hoy, -89), hoy],
      anio: [`${hoy.slice(0, 4)}-01-01`, hoy],
      proximos: [hoy, sumarDias(hoy, 29)],
      personalizado: [this.personalizado().desde, this.personalizado().hasta],
    } as Record<Rango, [string, string]>)[this.rango()];
    this.cargando.set(true);        // el gráfico anterior queda atenuado, sin saltos
    try {
      this.datos.set(await this.api.analitica(desde, hasta, this.servicio()));
    } catch (e) {
      this.toast.error('No se pudo cargar la analítica', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  // ── Derivados ──
  protected readonly segmentos = computed(() => {
    const d = this.datos();
    if (!d?.totales.citas) return [];
    return ESTADOS.map((e) => ({ ...e, n: d.totales[e.id], pct: (d.totales[e.id] / d.totales.citas) * 100 })).filter((s) => s.n > 0);
  });

  protected readonly resumenEstados = computed(() =>
    this.segmentos().map((s) => `${s.rotulo}: ${s.n} (${Math.round(s.pct)} %)`).join('; '));

  protected readonly maxTipo = computed(() => Math.max(1, ...(this.datos()?.porTipo ?? []).map((t) => t.n)));

  protected readonly calor = computed(() => new Map((this.datos()?.calor ?? []).map((c) => [`${c.dia}-${c.hora}`, c.n])));
  protected readonly maxCalor = computed(() => Math.max(1, ...(this.datos()?.calor ?? []).filter((c) => c.dia < 5).map((c) => c.n)));

  protected readonly variacion = computed(() => {
    const t = this.datos()?.totales;
    if (!t || t.anteriores === null) return '';
    if (!t.anteriores) return 'Sin citas en el periodo anterior';
    const v = Math.round(((t.citas - t.anteriores) / t.anteriores) * 100);
    return `${v > 0 ? '+' : ''}${v} % frente al periodo anterior (${this.numero(t.anteriores)})`;
  });

  /** Geometría de las columnas semanales (columnas ≤ 24 px, punta redondeada de 4 px, base recta). */
  protected readonly grafSemanas = computed(() => {
    const semanas = this.datos()?.porSemana ?? [];
    const ancho = 600, alto = 220, izq = 24, base = alto - 4;
    const max = Math.max(1, ...semanas.map((s) => s.n));
    const paso = (ancho - izq) / Math.max(1, semanas.length);
    const grosor = Math.min(24, paso * 0.6);
    const escala = (v: number) => (v / tope) * (base - 8);
    const tope = limpio(max);
    const hoy = hoyColombia();
    const cols = semanas.map((s, i) => {
      const h = escala(s.n), x = izq + i * paso + (paso - grosor) / 2, y = base - h, r = Math.min(4, h, grosor / 2);
      const futura = sumarDias(s.semana, 6) >= hoy;
      return {
        semana: s.semana, banda: izq + i * paso, alto: h, futura,
        d: `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + grosor - r} Q${x + grosor},${y} ${x + grosor},${y + r} V${base} Z`,
        titulo: `Semana del ${this.fechaCorta(s.semana)}`,
        lineas: [{ color: SERIE, texto: 'citas', valor: String(s.n) }, { texto: 'atendidas', valor: String(s.atendida) },
                 { texto: 'no asistió', valor: String(s.no_asistio) }, { texto: 'canceladas', valor: String(s.cancelada) }],
      };
    });
    const ticks = [0, tope / 2, tope].map((v) => ({ v: Math.round(v), y: base - escala(v) }));
    const cada = Math.ceil(semanas.length / 6);
    // Una etiqueta cada tantas columnas, centrada bajo su columna.
    const etiquetas = semanas.map((s, i) => ({ i, texto: this.fechaCorta(s.semana) })).filter((e) => e.i % cada === 0)
      .map((e) => ({ texto: e.texto, x: ((izq + e.i * paso + paso / 2) / ancho) * 100 }));
    return { ancho, alto, izq, base, paso, max, ticks, cols, etiquetas, hayFuturas: cols.some((c) => c.futura && c.alto > 0) };
  });

  protected lineasTipo(t: Analitica['porTipo'][number]) {
    return [{ color: SERIE, texto: 'citas', valor: String(t.n) }, { texto: 'atendidas', valor: String(t.atendida) },
            { texto: 'no asistió', valor: String(t.no_asistio) }, { texto: 'asistencia', valor: this.pct(t.asistencia) }];
  }

  // ── Tooltip ──
  protected mostrar(e: PointerEvent, titulo: string, lineas: Tooltip['lineas']): void {
    this.tip.set({ x: Math.min(e.clientX, window.innerWidth - 200), y: e.clientY, titulo, lineas });
  }

  protected mostrarEn(e: FocusEvent, titulo: string, lineas: Tooltip['lineas']): void {
    const r = (e.target as Element).getBoundingClientRect();
    this.tip.set({ x: Math.min(r.left + r.width / 2, window.innerWidth - 200), y: r.top + r.height / 2, titulo, lineas });
  }

  // ── Formato ──
  protected numero(n: number): string {
    return n.toLocaleString('es-CO');
  }

  protected pct(r: number | null): string {
    return r === null ? '—' : `${Math.round(r * 100)} %`;
  }

  protected pctDe(a: number, b: number): string {
    return b ? `${Math.round((a / b) * 100)} %` : '—';
  }

  protected dec(n: number): string {
    return n.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  }

  protected round(n: number): number {
    return Math.round(n);
  }

  protected fechaCorta(f: string): string {
    const [a, m, d] = f.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

/** Tope del eje en un número limpio (1, 2, 5 × 10ⁿ). */
function limpio(v: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(1, v)));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v) ?? v;
}
