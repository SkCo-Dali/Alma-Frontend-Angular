// Modal "Evaluar emisión con el motor" — layout de dos paneles: a la izquierda
// el formulario compacto (datos, producto, cuestionario, verificaciones,
// cúmulo); a la derecha un panel de RESULTADO siempre visible que pasa por
// vacío → evaluando → decisión con alertas y métricas, para que el analista vea
// la respuesta en el momento en que evalúa. Paridad EvaluarModal.tsx (v4).

import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  CumuloResultadoApi,
  DatosEvaluables,
  EvaluacionApi,
  NivelCumulo,
  SuscripcionApi,
  Verificaciones,
} from './suscripcion.api';
import { DECISION_META, MedicoFlags, Tarea } from './suscripcion.domain';

const MED_CHIPS: Array<{ key: keyof MedicoFlags & string; label: string }> = [
  { key: 'cardiovascular', label: 'Cardiovascular' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'oncologico', label: 'Oncológico' },
  { key: 'pulmonar', label: 'Pulmonar' },
  { key: 'neurologico', label: 'Neurológico' },
  { key: 'cirugia', label: 'Cirugía reciente' },
  { key: 'tabaco', label: 'Tabaquismo' },
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'discapacidad', label: 'Discapacidad' },
  { key: 'medicacion', label: 'Medicación crónica' },
];

const VERIF_CHIPS: Array<{ key: keyof Verificaciones & string; label: string }> = [
  { key: 'cumulo_verificado', label: 'Cúmulo' },
  { key: 'pipeline_revisado', label: 'Pipeline' },
  { key: 'pharos_revisado', label: 'Pharos' },
  { key: 'filenet_localizado', label: 'FileNet' },
  { key: 'correo_revisado', label: 'Correo' },
];

const NIVEL_CUMULO_META: Record<NivelCumulo, { label: string; color: string }> = {
  bajo: { label: 'Cúmulo bajo', color: '#00A32F' },
  medio: { label: 'Cúmulo medio — exámenes médicos', color: '#D97706' },
  alto: { label: 'Cúmulo alto — asegurabilidad completa', color: '#EA580C' },
  limite_reaseguro: { label: 'Supera límite de reaseguro', color: '#DC2626' },
};

function fmtSumaTxt(n: number): string {
  return '$ ' + n.toLocaleString('es-CO');
}
function parseSumaTxt(s: string): number {
  const n = Number(String(s).replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

@Component({
  selector: 'alma-evaluar-modal',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 sm:p-6"
      (click)="closed.emit()"
      role="dialog"
      aria-modal="true"
      aria-label="Evaluar emisión con el motor"
    >
      <div
        class="surface-solid flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div
          class="flex flex-none items-start justify-between gap-4 border-b border-border px-5 py-3.5"
        >
          <div class="min-w-0">
            <h2 class="text-base font-bold tracking-tight text-foreground">
              Evaluar emisión con el motor
            </h2>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">
              {{ tarea().asegurado.nombre }} ·
              <span class="tabular-nums">{{ tarea().nro_cotizacion }}</span> — ajusta los
              datos y evalúa; el resultado aparece al lado.
            </p>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            aria-label="Cerrar"
            class="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--surface-sunken)] hover:text-foreground"
          >
            <lucide-icon name="x" [size]="16" />
          </button>
        </div>

        <!-- Cuerpo: formulario | resultado -->
        <div class="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px]">
          <!-- ── Formulario ── -->
          <div class="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
            <div class="flex flex-col gap-4">
              <!-- Datos del asegurado -->
              <div>
                <div class="mb-2 flex flex-wrap items-baseline gap-x-2">
                  <h3
                    class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Datos del asegurado
                  </h3>
                </div>
                <div class="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                  <label class="flex min-w-0 flex-col gap-1">
                    <span class="text-[11px] font-semibold text-muted-foreground">
                      Fecha de nacimiento
                    </span>
                    <input type="date" class="campo" [(ngModel)]="fecha" />
                  </label>
                  <label class="flex min-w-0 flex-col gap-1">
                    <span class="text-[11px] font-semibold text-muted-foreground">Género</span>
                    <!-- Segmented control -->
                    <div
                      class="grid h-9 grid-cols-2 gap-0.5 rounded-lg bg-[var(--surface-sunken)] p-0.5"
                    >
                      <button
                        type="button"
                        (click)="genero = 'F'"
                        [attr.aria-pressed]="genero === 'F'"
                        class="rounded-[7px] text-xs font-semibold transition-all"
                        [class]="
                          genero === 'F'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        "
                      >
                        Femenino
                      </button>
                      <button
                        type="button"
                        (click)="genero = 'M'"
                        [attr.aria-pressed]="genero === 'M'"
                        class="rounded-[7px] text-xs font-semibold transition-all"
                        [class]="
                          genero === 'M'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        "
                      >
                        Masculino
                      </button>
                    </div>
                  </label>
                  <label class="flex min-w-0 flex-col gap-1">
                    <span class="text-[11px] font-semibold text-muted-foreground">Ciudad</span>
                    <input class="campo" [(ngModel)]="ciudad" />
                  </label>
                  <label class="flex min-w-0 flex-col gap-1">
                    <span class="text-[11px] font-semibold text-muted-foreground">
                      Ocupación
                    </span>
                    <input class="campo" [(ngModel)]="ocupacion" />
                  </label>
                </div>
              </div>

              <!-- Producto -->
              <div>
                <div class="mb-2 flex flex-wrap items-baseline gap-x-2">
                  <h3
                    class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Producto
                  </h3>
                  <span class="text-[11px] text-muted-foreground/70">
                    Lo toma el motor de la cotización (define qué reglas aplica); no es
                    editable.
                  </span>
                </div>
                <div
                  class="mb-2.5 rounded-lg border border-border bg-[var(--surface-sunken)] px-3 py-2"
                >
                  <p class="text-[11px] font-semibold text-muted-foreground">
                    Producto de la cotización
                  </p>
                  <p class="mt-0.5 text-sm font-semibold text-foreground">
                    {{ productoLabel() }}
                  </p>
                </div>
                <div class="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
                  <label class="flex min-w-0 flex-col gap-1">
                    <span class="text-[11px] font-semibold text-muted-foreground">
                      Suma asegurada
                    </span>
                    <input
                      class="campo font-semibold"
                      [(ngModel)]="sumaTxt"
                      (blur)="normalizarSuma()"
                    />
                  </label>
                  <label class="flex min-w-0 flex-col gap-1">
                    <span class="text-[11px] font-semibold text-muted-foreground">
                      Años vigencia
                    </span>
                    <input type="number" class="campo" [(ngModel)]="anios" />
                  </label>
                  <label class="flex min-w-0 flex-col gap-1">
                    <span class="text-[11px] font-semibold text-muted-foreground">
                      Peso y talla
                    </span>
                    <div class="grid grid-cols-2 gap-1.5">
                      <input
                        type="number"
                        aria-label="Peso (kg)"
                        placeholder="kg"
                        class="campo"
                        [(ngModel)]="medico.peso"
                      />
                      <input
                        type="number"
                        aria-label="Talla (cm)"
                        placeholder="cm"
                        class="campo"
                        [(ngModel)]="medico.talla"
                      />
                    </div>
                  </label>
                </div>
              </div>

              <!-- Cuestionario médico -->
              <div>
                <div class="mb-2 flex flex-wrap items-baseline gap-x-2">
                  <h3
                    class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Cuestionario médico
                  </h3>
                  <span class="text-[11px] text-muted-foreground/70">
                    Marca solo las condiciones declaradas.
                  </span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  @for (c of medChips; track c.key) {
                    <button
                      type="button"
                      (click)="toggleMedico(c.key)"
                      [attr.aria-pressed]="medicoOn(c.key)"
                      class="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                      [class]="
                        medicoOn(c.key)
                          ? 'border-amber-400/60 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      "
                    >
                      {{ c.label }}
                    </button>
                  }
                </div>
              </div>

              <!-- Verificaciones + cúmulo -->
              <div>
                <div class="mb-2 flex flex-wrap items-baseline gap-x-2">
                  <h3
                    class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Verificaciones
                  </h3>
                  <span class="text-[11px] text-muted-foreground/70">
                    Las cinco deben estar completas: el motor se bloquea si falta alguna.
                  </span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  @for (v of verifChips; track v.key) {
                    <button
                      type="button"
                      (click)="toggleVerif(v.key)"
                      [attr.aria-pressed]="verif[v.key]"
                      class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                      [class]="
                        verif[v.key]
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      "
                    >
                      @if (verif[v.key]) {
                        <span aria-hidden="true">✓</span>
                      }
                      {{ v.label }}
                    </button>
                  }
                </div>

                <!-- Cúmulo automático contra Pharos -->
                <div class="mt-2.5 flex flex-col gap-2">
                  <div>
                    <button
                      type="button"
                      (click)="consultarCumulo()"
                      [disabled]="cumuloLoading()"
                      class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-60"
                    >
                      @if (cumuloLoading()) {
                        <lucide-icon name="loader-2" [size]="14" class="animate-spin" />
                      } @else {
                        <lucide-icon name="sigma" [size]="14" />
                      }
                      {{
                        cumuloLoading()
                          ? 'Consultando pólizas en Pharos…'
                          : 'Verificar cúmulo en Pharos'
                      }}
                    </button>
                  </div>

                  @if (cumuloError(); as err) {
                    <div
                      class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                    >
                      {{ err }}
                    </div>
                  }

                  @if (cumulo(); as c) {
                    <div
                      class="rounded-xl border p-3"
                      [style.borderColor]="nivelMeta(c.nivel).color"
                      [style.background]="nivelMeta(c.nivel).color + '0d'"
                    >
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div
                          class="text-sm font-bold"
                          [style.color]="nivelMeta(c.nivel).color"
                        >
                          {{ nivelMeta(c.nivel).label }}
                        </div>
                        <div class="text-xs text-muted-foreground">
                          {{
                            c.tercero
                              ? 'Tercero Pharos ' + c.tercero.partyCode
                              : 'Sin tercero en Pharos'
                          }}
                        </div>
                      </div>

                      <div class="mt-2 flex flex-wrap gap-2">
                        <span class="metrica">
                          <span>Pólizas vigentes:</span>
                          <b>
                            {{ suma(c.cumulo_acumulado) }} ({{ c.polizas_vigentes.length }})
                          </b>
                        </span>
                        <span class="metrica">
                          <span>Cúmulo total:</span><b>{{ suma(c.cumulo_total) }}</b>
                        </span>
                        @if (c.nivel_examen !== 'ninguno') {
                          <span class="metrica">
                            <span>Exámenes:</span><b>Nivel {{ c.nivel_examen }}</b>
                          </span>
                        }
                        @if (c.psa_requerido) {
                          <span class="metrica"><span>PSA:</span><b>Requerido</b></span>
                        }
                      </div>

                      @if (c.examen_detalle) {
                        <div class="mt-1.5 text-xs text-muted-foreground">
                          Requisitos nivel {{ c.nivel_examen }}: {{ c.examen_detalle }}
                        </div>
                      }

                      @if (c.polizas_vigentes.length > 0) {
                        <div class="mt-2 overflow-hidden rounded-lg border border-border">
                          @for (p of c.polizas_vigentes; track p.numero_poliza) {
                            <div
                              class="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5 text-xs last:border-b-0"
                            >
                              <span class="text-muted-foreground">
                                {{ p.producto_pharos }} · {{ p.numero_poliza }}
                              </span>
                              <span class="font-semibold tabular-nums text-foreground">
                                {{ suma(p.suma_asegurada) }}
                              </span>
                            </div>
                          }
                        </div>
                      }

                      @for (msg of mensajesCumulo(c); track $index) {
                        <div class="mt-1.5 text-xs text-muted-foreground">• {{ msg }}</div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Payload colapsado: útil para auditoría, no roba espacio. -->
              <details class="group rounded-xl border border-border/60">
                <summary
                  class="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  <lucide-icon
                    name="chevron-down"
                    [size]="14"
                    class="transition-transform group-open:rotate-180"
                  />
                  Datos que se envían al motor
                </summary>
                <pre
                  class="max-h-48 overflow-auto border-t border-border/60 bg-[var(--surface-sunken)] p-3 font-mono text-[11px] leading-relaxed text-muted-foreground"
                  >{{ payloadJson() }}</pre
                >
              </details>
            </div>
          </div>

          <!-- ── Panel de resultado (siempre visible) ── -->
          <aside
            #panel
            class="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain border-t border-border bg-muted/20 p-4 md:border-l md:border-t-0"
          >
            <button
              type="button"
              (click)="evaluar()"
              [disabled]="loading()"
              class="inline-flex h-10 w-full flex-none items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:bg-[var(--primary-hover)] active:scale-[0.99] disabled:opacity-60"
            >
              @if (loading()) {
                <lucide-icon name="loader-2" [size]="16" class="animate-spin" />
              } @else {
                <lucide-icon name="zap" [size]="16" />
              }
              {{
                loading() ? 'Evaluando…' : result() ? 'Evaluar de nuevo' : 'Evaluar con motor'
              }}
            </button>

            @if (error(); as err) {
              <div
                class="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-medium leading-snug text-destructive"
              >
                {{ err }}
              </div>
            }

            @if (!result() && !error() && !loading()) {
              <div
                class="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 px-4 py-10 text-center"
              >
                <lucide-icon name="sparkles" [size]="24" class="text-muted-foreground/50" />
                <p class="text-xs leading-snug text-muted-foreground">
                  La respuesta del motor aparecerá aquí:<br />decisión, métricas y alertas.
                </p>
              </div>
            }

            @if (result(); as r) {
              <div class="flex flex-col gap-3">
                <!-- Decisión -->
                <div
                  class="rounded-xl border p-3.5"
                  [style.borderColor]="resultMeta().color"
                  [style.background]="resultMeta().color + '12'"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white"
                      [style.background]="resultMeta().color"
                    >
                      <lucide-icon name="zap" [size]="16" />
                    </div>
                    <div class="min-w-0">
                      <p
                        class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                      >
                        Respuesta del motor
                      </p>
                      <p class="text-[15px] font-bold leading-tight text-foreground">
                        {{ resultMeta().label }}
                      </p>
                    </div>
                  </div>
                  <p class="mt-2 text-xs leading-snug text-foreground/85">
                    {{ resultMeta().accion }}
                  </p>
                  @if (r.producto) {
                    <p
                      class="mt-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground"
                    >
                      Reglas aplicadas:
                      <span class="font-semibold text-foreground">{{ r.producto }}</span>
                    </p>
                  }
                </div>

                <!-- Métricas -->
                <div class="grid grid-cols-3 gap-1.5">
                  @if (r.imc !== null) {
                    <div class="rounded-lg bg-card px-2 py-1.5 text-center">
                      <p class="text-sm font-bold tabular-nums text-foreground">
                        {{ r.imc.toFixed(1) }}
                      </p>
                      <p class="text-[10px] text-muted-foreground">IMC</p>
                    </div>
                  }
                  @if (r.edad !== null) {
                    <div class="rounded-lg bg-card px-2 py-1.5 text-center">
                      <p class="text-sm font-bold tabular-nums text-foreground">{{ r.edad }}</p>
                      <p class="text-[10px] text-muted-foreground">Edad</p>
                    </div>
                  }
                  @if (r.relacion_prima !== null) {
                    <div class="rounded-lg bg-card px-2 py-1.5 text-center">
                      <p class="text-sm font-bold tabular-nums text-foreground">
                        {{ r.relacion_prima.toFixed(0) }}%
                      </p>
                      <p class="text-[10px] text-muted-foreground">Rel. prima</p>
                    </div>
                  }
                </div>

                <!-- Alertas del motor -->
                @if (r.alertas.length > 0) {
                  <div>
                    <p
                      class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Alertas ({{ r.alertas.length }})
                    </p>
                    <ul class="flex flex-col gap-1.5">
                      @for (a of r.alertas; track $index) {
                        <li
                          class="flex items-start gap-2 rounded-lg bg-card px-2.5 py-2 text-xs leading-snug text-foreground/90"
                        >
                          <lucide-icon
                            name="alert-triangle"
                            [size]="14"
                            class="mt-0.5 shrink-0"
                            [class]="
                              a.prioridad === 'Alta' ? 'text-destructive' : 'text-amber-500'
                            "
                          />
                          {{ a.mensaje }}
                        </li>
                      }
                    </ul>
                  </div>
                }

                @if (r.exclusiones.length > 0) {
                  <div>
                    <p
                      class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Exclusiones
                    </p>
                    <ul class="flex flex-col gap-1">
                      @for (e of r.exclusiones; track $index) {
                        <li class="text-xs leading-snug text-foreground/85">• {{ e }}</li>
                      }
                    </ul>
                  </div>
                }

                <button
                  type="button"
                  (click)="aplicar()"
                  class="inline-flex h-9 w-full items-center justify-center rounded-xl border border-primary text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  Aplicar resultado al caso
                </button>
              </div>
            }

            <button
              type="button"
              (click)="closed.emit()"
              class="mt-auto inline-flex h-8 w-full flex-none items-center justify-center rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cerrar
            </button>
          </aside>
        </div>
      </div>
    </div>
  `,
  styles: `
    .campo {
      height: 2.25rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background-color: var(--card);
      padding: 0 0.75rem;
      font-size: 0.875rem;
      color: var(--foreground);
      outline: none;
      font-variant-numeric: tabular-nums;
      transition: border-color 0.15s ease;
    }
    .campo:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary) 30%, transparent);
    }
    .metrica {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background-color: var(--card);
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      color: var(--muted-foreground);
    }
    .metrica b {
      color: var(--foreground);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class EvaluarModalComponent implements OnInit {
  private readonly api = inject(SuscripcionApi);

  readonly tarea = input.required<Tarea>();
  readonly closed = output<void>();
  /** Se emite al aplicar el resultado (el padre refresca la cotización). */
  readonly aplicado = output<void>();

  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;

  protected readonly medChips = MED_CHIPS;
  protected readonly verifChips = VERIF_CHIPS;

  protected fecha = '';
  protected genero: 'F' | 'M' = 'M';
  protected ciudad = '';
  protected ocupacion = '';
  protected sumaTxt = '';
  protected anios = 0;
  protected medico!: MedicoFlags;
  protected verif: Verificaciones = {
    cumulo_verificado: true,
    pipeline_revisado: true,
    pharos_revisado: true,
    filenet_localizado: true,
    correo_revisado: true,
  };

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<EvaluacionApi | null>(null);
  protected readonly cumulo = signal<CumuloResultadoApi | null>(null);
  protected readonly cumuloLoading = signal(false);
  protected readonly cumuloError = signal<string | null>(null);

  protected readonly suma = fmtSumaTxt;

  protected readonly productoLabel = computed(
    () =>
      this.tarea().afiliacion?.producto_desc ??
      this.tarea().afiliacion?.product_code ??
      'Sin producto — el motor evalúa como Crea Patrimonio',
  );

  protected readonly resultMeta = computed(() => {
    const r = this.result();
    return r
      ? (DECISION_META[r.decision_slug] ?? DECISION_META['flujo_suscriptor'])
      : DECISION_META['flujo_suscriptor'];
  });

  ngOnInit(): void {
    const t = this.tarea();
    this.fecha = t.asegurado.fecha_nacimiento;
    this.genero = t.asegurado.genero;
    this.ciudad = t.asegurado.ciudad;
    this.ocupacion = t.asegurado.ocupacion;
    this.sumaTxt = fmtSumaTxt(t.producto.suma_asegurada);
    this.anios = t.producto.anios_vigencia;
    this.medico = { ...t.medico };
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  protected nivelMeta(n: NivelCumulo): { label: string; color: string } {
    return NIVEL_CUMULO_META[n];
  }

  protected mensajesCumulo(c: CumuloResultadoApi): string[] {
    return [...c.alertas.map((a) => a.mensaje), ...c.advertencias];
  }

  protected normalizarSuma(): void {
    this.sumaTxt = fmtSumaTxt(parseSumaTxt(this.sumaTxt));
  }

  protected medicoOn(key: keyof MedicoFlags & string): boolean {
    return Boolean(this.medico[key]);
  }

  protected toggleMedico(key: keyof MedicoFlags & string): void {
    const m = this.medico as unknown as Record<string, boolean>;
    m[key] = !m[key];
  }

  protected toggleVerif(key: keyof Verificaciones & string): void {
    this.verif[key] = !this.verif[key];
  }

  private payload(): DatosEvaluables {
    const t = this.tarea();
    return {
      fecha_nacimiento: this.fecha,
      genero: this.genero,
      ciudad: this.ciudad,
      ocupacion: this.ocupacion,
      suma_asegurada: parseSumaTxt(this.sumaTxt),
      prima_mensual: t.producto.prima_mensual,
      anios_vigencia: Number(this.anios) || 0,
      ingresos: t.financiero.ingresos,
      egresos: t.financiero.egresos,
      ...this.medico,
      peso: Number(this.medico.peso) || 0,
      talla: Number(this.medico.talla) || 0,
      verificaciones: this.verif,
    };
  }

  protected payloadJson(): string {
    return JSON.stringify(this.payload(), null, 2);
  }

  protected async consultarCumulo(): Promise<void> {
    this.cumuloLoading.set(true);
    this.cumuloError.set(null);
    try {
      const r = await this.api.verificarCumulo(this.tarea().tarea_id);
      this.cumulo.set(r);
      // La evidencia queda a la vista; la verificación se marca sola salvo que
      // el cúmulo supere el límite de reaseguro (decisión del analista).
      if (!r.supera_reaseguro) this.verif.cumulo_verificado = true;
    } catch (err) {
      this.cumuloError.set(
        err instanceof Error ? err.message : 'Error consultando el cúmulo en Pharos',
      );
    } finally {
      this.cumuloLoading.set(false);
    }
  }

  protected async evaluar(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      // Persiste las correcciones + registra la evaluación en la auditoría
      this.result.set(await this.api.evaluarSolicitud(this.tarea().tarea_id, this.payload()));
      // En pantallas angostas el panel queda abajo: llevar la vista al resultado.
      setTimeout(
        () => this.panel?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
        60,
      );
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Error desconocido al llamar al motor',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected aplicar(): void {
    this.aplicado.emit();
    this.closed.emit();
  }
}
