// Bandeja de aprobación del Motor de Suscripción (paridad con
// features/suscripcion/BandejaSuscripcion.tsx): KPIs, tabs por estado, cola de
// casos y panel de detalle con decisiones. Refresco automático cada 60 s.

import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  DecisionSlug,
  EstadoTarea,
  SuscripcionApi,
  Tarea,
  apiToTarea,
  fmtCOP,
  fmtCOPShort,
  hrsTxt,
} from './suscripcion.api';
import { EvaluarModalComponent } from './evaluar-modal.component';

const BRAND = '#00C73D';

const ESTADOS: Array<{ key: EstadoTarea; label: string }> = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'aprobado', label: 'Aprobados' },
  { key: 'devuelto', label: 'Devueltos' },
];

const DECISIONES: Array<{ value: DecisionSlug | 'todas'; label: string }> = [
  { value: 'todas', label: 'Todas las decisiones' },
  { value: 'emision_automatica', label: 'Emisión automática' },
  { value: 'emision_estandar', label: 'Emisión estándar' },
  { value: 'alerta_estandar', label: 'Alerta / estándar' },
  { value: 'condicionada', label: 'Condicionada' },
  { value: 'flujo_suscriptor', label: 'Flujo suscriptor' },
  { value: 'devolucion', label: 'Devolución' },
];

@Component({
  selector: 'alma-bandeja-suscripcion',
  imports: [FormsModule, LucideAngularModule, EvaluarModalComponent],
  template: `
    <div
      class="flex h-[calc(100vh-9rem)] min-h-[640px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm)]"
    >
      <!-- Header propio de la app -->
      <div class="flex-none border-b border-border bg-card">
        <div class="flex h-16 items-center justify-between px-6">
          <div class="flex items-center gap-3">
            <div class="h-8 w-1 rounded-full" [style.background]="brand"></div>
            <div>
              <div class="text-[15px] font-bold tracking-tight text-foreground">
                Bandeja de aprobación
              </div>
              <div class="text-xs text-muted-foreground">
                Motor de Suscripción · Crea Patrimonio · Vida Individual
              </div>
            </div>
          </div>
          <div class="hidden items-center gap-4 md:flex">
            @for (k of kpis(); track k.label) {
              <div
                class="border-r border-border pr-4 text-right last:border-none last:pr-0"
              >
                <div class="text-lg font-bold leading-tight" [style.color]="k.color">
                  {{ k.value }}
                </div>
                <div
                  class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {{ k.label }}
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Tabs + filtros -->
        <div class="flex flex-wrap items-center justify-between gap-3 px-6 pb-3">
          <div class="flex gap-1 rounded-lg bg-[var(--surface-sunken)] p-1">
            @for (e of estados; track e.key) {
              <button
                type="button"
                (click)="estadoFilter.set(e.key)"
                class="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                [class]="
                  estadoFilter() === e.key
                    ? 'bg-card text-foreground shadow-[var(--shadow-sm)]'
                    : 'text-muted-foreground hover:text-foreground'
                "
              >
                {{ e.label }}
                <span
                  class="rounded-full px-1.5 py-px text-[10px] font-bold"
                  [class]="
                    estadoFilter() === e.key
                      ? 'bg-[color:var(--surface-sunken)] text-foreground'
                      : 'bg-border text-muted-foreground'
                  "
                >
                  {{ counts()[e.key] || 0 }}
                </span>
              </button>
            }
          </div>
          <div class="flex items-center gap-2">
            <div
              class="flex items-center gap-2 rounded-md bg-[var(--surface-sunken)] px-3 py-2"
            >
              <lucide-icon name="search" [size]="14" class="text-muted-foreground" />
              <input
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
                placeholder="Buscar cotización o nombre…"
                class="w-56 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <select
              [ngModel]="decisionFilter()"
              (ngModelChange)="decisionFilter.set($event)"
              class="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
            >
              @for (d of decisiones; track d.value) {
                <option [value]="d.value">{{ d.label }}</option>
              }
            </select>
          </div>
        </div>
      </div>

      <!-- Body: cola + detalle -->
      <div class="flex min-h-0 flex-1">
        @if (cargando()) {
          <div
            class="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <lucide-icon
              name="loader-2"
              [size]="20"
              class="animate-spin"
              [style.color]="brand"
            />
            Cargando bandeja…
          </div>
        } @else if (error(); as err) {
          <div class="flex w-full flex-col items-center justify-center gap-2 p-10 text-center">
            <lucide-icon name="alert-triangle" [size]="32" class="text-[#DC2626]" />
            <p class="text-sm font-semibold text-foreground">No se pudo cargar la bandeja</p>
            <p class="max-w-sm text-xs text-muted-foreground">{{ err }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="mt-2 rounded-md px-4 py-2 text-xs font-semibold text-white"
              [style.background]="brand"
            >
              Reintentar
            </button>
          </div>
        } @else {
          <!-- Cola -->
          <div
            class="flex w-[340px] flex-none flex-col border-r border-border bg-[var(--surface-sunken)]"
          >
            <div
              class="flex-none px-4 pb-2 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
            >
              {{ queue().length }} caso{{ queue().length === 1 ? '' : 's' }} en cola
            </div>
            <div class="flex-1 space-y-2 overflow-auto px-3 pb-4">
              @for (t of queue(); track t.tarea_id) {
                <button
                  type="button"
                  (click)="selectTarea(t)"
                  class="w-full rounded-lg border bg-card p-3 text-left transition-all hover:shadow-[var(--shadow-md)]"
                  [class]="
                    t.tarea_id === selectedId()
                      ? 'border-primary shadow-[var(--shadow-md)]'
                      : 'border-border'
                  "
                  [style.borderLeft]="'4px solid ' + t.evaluacion.decision_color"
                >
                  <div class="mb-1 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-foreground">{{
                        t.nro_cotizacion
                      }}</span>
                      @if (t.nuevo) {
                        <span
                          class="rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white"
                          [style.background]="brand"
                        >
                          Nuevo
                        </span>
                      }
                    </div>
                    <span class="text-[10px] text-muted-foreground">{{ hrs(t._hrs) }}</span>
                  </div>
                  <div class="text-sm font-semibold text-foreground">
                    {{ t.asegurado.nombre }}
                  </div>
                  <div class="mb-2 text-[11px] text-muted-foreground">
                    {{ t.asegurado.ciudad }} · {{ copShort(t.producto.suma_asegurada) }}
                  </div>
                  <div class="flex items-center justify-between">
                    <span
                      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                      [style.background]="t.evaluacion.decision_color + '18'"
                      [style.color]="t.evaluacion.decision_color"
                    >
                      <span
                        class="h-1.5 w-1.5 rounded-full"
                        [style.background]="t.evaluacion.decision_color"
                      ></span>
                      {{ t.evaluacion.decision_label }}
                    </span>
                    @if (t.evaluacion.requiere_revision) {
                      <span class="text-[10px] font-bold text-[#7C3AED]">Requiere revisión</span>
                    }
                  </div>
                </button>
              } @empty {
                <div class="p-8 text-center text-xs text-muted-foreground">
                  No hay casos que coincidan con el filtro.
                </div>
              }
            </div>
          </div>

          <!-- Detalle -->
          <div class="min-h-0 flex-1 overflow-auto bg-[var(--surface-sunken)]">
            @if (selected(); as t) {
              <div class="mx-auto flex max-w-5xl flex-col gap-4 p-6">
                <!-- Header del caso -->
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="mb-1 flex flex-wrap items-center gap-2">
                      <h2 class="text-xl font-bold tracking-tight text-foreground">
                        {{ t.asegurado.nombre }}
                      </h2>
                      <span
                        class="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        [style.background]="t.evaluacion.decision_color + '18'"
                        [style.color]="t.evaluacion.decision_color"
                      >
                        {{ t.evaluacion.decision_label }}
                      </span>
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{ t.asegurado.cedula }} · {{ t.asegurado.ciudad }} ·
                      {{ t.asegurado.ocupacion }}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-bold" style="color: #007a26">
                      {{ t.nro_cotizacion }}
                    </div>
                    <div class="text-[11px] text-muted-foreground">
                      Ingresó {{ hrs(t._hrs) }}
                    </div>
                  </div>
                </div>

                <!-- Acción sugerida -->
                <div
                  class="flex items-start gap-3 rounded-lg border p-3"
                  [style.background]="t.evaluacion.decision_color + '0d'"
                  [style.borderColor]="t.evaluacion.decision_color + '55'"
                >
                  <lucide-icon
                    name="zap"
                    [size]="16"
                    class="flex-none"
                    [style.color]="t.evaluacion.decision_color"
                  />
                  <p class="text-xs leading-relaxed text-foreground">
                    {{ t.evaluacion.accion_sugerida }}
                  </p>
                </div>

                <!-- Métricas -->
                <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  @for (m of metrics(); track m.label) {
                    <div
                      class="rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-sm)]"
                    >
                      <div
                        class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {{ m.label }}
                      </div>
                      <div class="mt-1 text-lg font-bold text-foreground">{{ m.value }}</div>
                      <div class="mt-1 flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-full" [style.background]="m.dot"></span>
                        <span class="text-[11px] font-medium text-muted-foreground">{{
                          m.badge
                        }}</span>
                      </div>
                    </div>
                  }
                </div>

                <!-- Alertas -->
                @if (t.evaluacion.alertas.length > 0) {
                  <div
                    class="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
                  >
                    <div class="mb-3 text-sm font-semibold text-foreground">
                      Alertas del motor
                    </div>
                    <div class="space-y-2.5">
                      @for (a of t.evaluacion.alertas; track $index) {
                        <div class="flex items-start gap-2.5">
                          <span
                            class="flex-none rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                            [class]="
                              a.prioridad === 'alta'
                                ? 'bg-[oklch(0.95_0.05_25)] text-[oklch(0.45_0.2_25)]'
                                : 'bg-[oklch(0.95_0.05_75)] text-[oklch(0.4_0.14_75)]'
                            "
                          >
                            {{ a.prioridad }}
                          </span>
                          <div class="text-xs leading-relaxed text-foreground">
                            <span class="font-bold">{{ a.variable }}</span>
                            <span class="text-muted-foreground"> ({{ a.condicion }})</span> —
                            {{ a.mensaje }}
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Exclusiones -->
                @if (t.evaluacion.exclusiones.length > 0) {
                  <div
                    class="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
                  >
                    <div class="mb-3 text-sm font-semibold text-foreground">
                      Exclusiones a documentar
                    </div>
                    <div class="flex flex-wrap gap-2">
                      @for (ex of t.evaluacion.exclusiones; track ex) {
                        <span
                          class="inline-flex items-center gap-2 rounded-md border border-border bg-[var(--surface-sunken)] px-3 py-1.5 text-xs font-semibold text-foreground"
                        >
                          <lucide-icon name="paperclip" [size]="12" [style.color]="brand" />
                          {{ ex }}
                        </span>
                      }
                    </div>
                    <p class="mt-2 text-[11px] text-muted-foreground">
                      Marca las exclusiones confirmadas para incluirlas en la póliza.
                    </p>
                  </div>
                }

                <!-- Datos precargados -->
                <div
                  class="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
                >
                  <div class="mb-3 flex items-center justify-between">
                    <div class="text-sm font-semibold text-foreground">
                      Datos precargados de la solicitud
                    </div>
                    <span class="text-[11px] text-muted-foreground">
                      Origen: tabla de afiliaciones · Azure SQL
                    </span>
                  </div>
                  <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-xs md:grid-cols-3">
                    @for (f of fields(); track f.label) {
                      <div class="flex flex-col">
                        <span
                          class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {{ f.label }}
                        </span>
                        <span class="text-xs font-medium text-foreground">{{ f.value }}</span>
                      </div>
                    }
                  </div>
                </div>

                <!-- Decisión -->
                <div
                  class="sticky bottom-0 -mx-6 -mb-6 mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card/95 px-6 py-3 backdrop-blur"
                >
                  <button type="button" (click)="evalOpen.set(true)" class="action-btn">
                    <lucide-icon name="sparkles" [size]="14" [style.color]="brand" />
                    Evaluar con motor
                  </button>
                  <button
                    type="button"
                    (click)="decidir('escalado')"
                    class="action-btn text-[#7C3AED]"
                  >
                    <lucide-icon name="arrow-up" [size]="14" />
                    Escalar
                  </button>
                  <button
                    type="button"
                    (click)="decidir('devuelto')"
                    class="action-btn text-[#DC2626]"
                  >
                    <lucide-icon name="rotate-ccw" [size]="14" />
                    Devolver
                  </button>
                  <button
                    type="button"
                    (click)="decidir('aprobado')"
                    class="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                    [style.background]="brand"
                  >
                    <lucide-icon name="check-circle-2" [size]="14" />
                    Aprobar y emitir
                  </button>
                </div>
              </div>
            } @else {
              <div
                class="flex h-full flex-col items-center justify-center gap-4 p-10 text-center"
              >
                <lucide-icon
                  name="inbox"
                  [size]="64"
                  [style.color]="brand"
                  [strokeWidth]="1.3"
                />
                <p class="max-w-xs text-sm text-muted-foreground">
                  Selecciona un caso de la bandeja para revisar la evaluación del motor y
                  tomar una decisión.
                </p>
              </div>
            }
          </div>
        }
      </div>

      @if (selected() && evalOpen()) {
        <alma-evaluar-modal
          [tarea]="selected()!"
          (close)="evalOpen.set(false)"
          (resultado)="cargar()"
        />
      }
    </div>
  `,
  styles: `
    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background-color: var(--card);
      padding: 0.5rem 0.875rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--foreground);
      transition: background-color 0.15s ease;
      cursor: pointer;
    }
    .action-btn:hover {
      background-color: var(--surface-sunken);
    }
  `,
})
export class BandejaSuscripcionComponent implements OnDestroy {
  private readonly api = inject(SuscripcionApi);

  protected readonly brand = BRAND;
  protected readonly estados = ESTADOS;
  protected readonly decisiones = DECISIONES;
  protected readonly copShort = fmtCOPShort;
  protected readonly hrs = hrsTxt;

  protected readonly tareas = signal<Tarea[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoFilter = signal<EstadoTarea>('pendiente');
  protected readonly decisionFilter = signal<DecisionSlug | 'todas'>('todas');
  protected readonly search = signal('');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly evalOpen = signal(false);

  private readonly refreshTimer = setInterval(() => void this.cargar(true), 60_000);

  constructor() {
    void this.cargar();
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
  }

  protected async cargar(silencioso = false): Promise<void> {
    if (!silencioso) this.cargando.set(true);
    this.error.set(null);
    try {
      const data = await this.api.listSolicitudes();
      this.tareas.set(data.map(apiToTarea));
    } catch (e) {
      if (!silencioso) this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected readonly kpis = computed(() => {
    const t = this.tareas();
    return [
      {
        label: 'Pendientes',
        value: String(t.filter((x) => x.estado === 'pendiente').length),
        color: BRAND,
      },
      {
        label: 'Emisión auto.',
        value: String(t.filter((x) => x.evaluacion.decision === 'emision_automatica').length),
        color: '#007A26',
      },
      {
        label: 'Flujo suscriptor',
        value: String(t.filter((x) => x.evaluacion.decision === 'flujo_suscriptor').length),
        color: '#7C3AED',
      },
      {
        label: 'Devolución',
        value: String(t.filter((x) => x.evaluacion.decision === 'devolucion').length),
        color: '#DC2626',
      },
    ];
  });

  protected readonly counts = computed(() => {
    const c: Record<string, number> = {};
    for (const t of this.tareas()) c[t.estado] = (c[t.estado] || 0) + 1;
    return c;
  });

  protected readonly queue = computed(() => {
    const q = this.search().trim().toLowerCase();
    const estado = this.estadoFilter();
    const decision = this.decisionFilter();
    return this.tareas().filter((t) => {
      if (t.estado !== estado) return false;
      if (decision !== 'todas' && t.evaluacion.decision !== decision) return false;
      if (!q) return true;
      return (
        t.nro_cotizacion.toLowerCase().includes(q) ||
        t.asegurado.nombre.toLowerCase().includes(q)
      );
    });
  });

  protected readonly selected = computed(
    () => this.tareas().find((t) => t.tarea_id === this.selectedId()) ?? null,
  );

  protected readonly metrics = computed(() => {
    const t = this.selected();
    if (!t) return [];
    const e = t.evaluacion;
    const imcOk = e.imc >= 18.5 && e.imc <= 25;
    return [
      {
        label: 'Suma asegurada',
        value: fmtCOPShort(t.producto.suma_asegurada),
        dot: BRAND,
        badge: `${t.producto.anios_vigencia} años`,
      },
      {
        label: 'Prima mensual',
        value: fmtCOP(t.producto.prima_mensual),
        dot: '#007A26',
        badge: `${e.relacion_prima_pct}% del disponible`,
      },
      {
        label: 'IMC',
        value: e.imc.toFixed(1),
        dot: imcOk ? BRAND : '#D97706',
        badge: imcOk ? 'Normal' : 'Fuera de rango',
      },
      {
        label: 'Edad',
        value: `${e.edad} años`,
        dot: e.edad <= 49 ? BRAND : '#7C3AED',
        badge: e.edad <= 49 ? 'Auto' : 'Suscriptor',
      },
    ];
  });

  protected readonly fields = computed(() => {
    const t = this.selected();
    if (!t) return [];
    return [
      { label: 'Cédula', value: t.asegurado.cedula },
      { label: 'F. nacimiento', value: t.asegurado.fecha_nacimiento },
      { label: 'Género', value: t.asegurado.genero === 'F' ? 'Femenino' : 'Masculino' },
      { label: 'Ciudad', value: t.asegurado.ciudad },
      { label: 'Ocupación', value: t.asegurado.ocupacion },
      { label: 'Suma asegurada', value: fmtCOP(t.producto.suma_asegurada) },
      { label: 'Prima mensual', value: fmtCOP(t.producto.prima_mensual) },
      { label: 'Vigencia', value: `${t.producto.anios_vigencia} años` },
      { label: 'Ingresos', value: fmtCOP(t.financiero.ingresos) },
      { label: 'Egresos', value: fmtCOP(t.financiero.egresos) },
      { label: 'Disponible', value: fmtCOP(t.evaluacion.disponible_neto) },
      { label: 'Asesor', value: t.metadatos.asesor },
    ];
  });

  protected selectTarea(t: Tarea): void {
    this.selectedId.set(t.tarea_id);
    if (t.estado === 'pendiente') {
      void this.api
        .cambiarEstado(t.tarea_id, 'en_revision')
        .then(() => this.cargar(true))
        .catch(() => undefined);
    }
  }

  protected decidir(kind: 'aprobado' | 'devuelto' | 'escalado'): void {
    const t = this.selected();
    if (!t) return;
    void this.api
      .cambiarEstado(t.tarea_id, kind)
      .then(() => this.cargar(true))
      .catch((e) => this.error.set(e instanceof Error ? e.message : String(e)));
    this.selectedId.set(null);
  }
}
