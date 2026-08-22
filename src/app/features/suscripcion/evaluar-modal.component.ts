// Modal "Evaluar con motor" (paridad con features/suscripcion/EvaluarModal.tsx):
// corrige datos, muestra el payload y ejecuta la evaluación en el backend.

import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  DECISION_META,
  DatosEvaluables,
  EvaluacionApi,
  MedicoFlags,
  SuscripcionApi,
  Tarea,
  Verificaciones,
} from './suscripcion.api';

const BRAND = '#00C73D';

const MED_CHIPS: Array<{ key: keyof MedicoFlags & string; label: string; icon: string }> = [
  { key: 'cardiovascular', label: 'Cardiovascular', icon: '♥' },
  { key: 'diabetes', label: 'Diabetes', icon: '◈' },
  { key: 'oncologico', label: 'Oncológico', icon: '✚' },
  { key: 'pulmonar', label: 'Pulmonar', icon: '◐' },
  { key: 'neurologico', label: 'Neurológico', icon: '◉' },
  { key: 'cirugia', label: 'Cirugía reciente', icon: '✂' },
  { key: 'tabaco', label: 'Tabaquismo', icon: '☁' },
  { key: 'alcohol', label: 'Alcohol', icon: '◒' },
  { key: 'discapacidad', label: 'Discapacidad', icon: '♿' },
  { key: 'medicacion', label: 'Medicación crónica', icon: '℞' },
];

const VERIF_CHIPS: Array<{ key: keyof Verificaciones & string; label: string; icon: string }> = [
  { key: 'cumulo_verificado', label: 'Cúmulo verificado', icon: '∑' },
  { key: 'pipeline_revisado', label: 'Pipeline revisado', icon: '⇉' },
  { key: 'pharos_revisado', label: 'Pharos revisado', icon: '◎' },
  { key: 'filenet_localizado', label: 'FileNet localizado', icon: '▤' },
  { key: 'correo_revisado', label: 'Correo revisado', icon: '✉' },
];

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
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      (click)="close.emit()"
    >
      <div
        class="flex max-h-[90vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div
          class="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card px-6 py-4"
        >
          <div>
            <div class="text-lg font-bold text-foreground">Evaluar emisión con el motor</div>
            <div class="mt-0.5 text-xs text-muted-foreground">
              Revisa la información que se enviará al motor de suscripción ·
              {{ tarea().asegurado.nombre }} · {{ tarea().nro_cotizacion }}
            </div>
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-[var(--surface-sunken)] hover:text-foreground"
          >
            <lucide-icon name="x" [size]="16" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-6 py-5">
          <div class="flex flex-col gap-5">
            <!-- Asegurado -->
            <div>
              <div class="section-title">Datos del asegurado</div>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label class="flex flex-col gap-1.5">
                  <span class="field-label">Fecha de nacimiento</span>
                  <input type="date" class="field-input" [(ngModel)]="fecha" />
                </label>
                <div class="flex flex-col gap-1.5">
                  <span class="field-label">Género</span>
                  <div class="flex gap-1.5">
                    <button
                      type="button"
                      (click)="genero = 'F'"
                      class="chip flex-1"
                      [class.chip-on]="genero === 'F'"
                      [style.background]="genero === 'F' ? brand : null"
                    >
                      Femenino
                    </button>
                    <button
                      type="button"
                      (click)="genero = 'M'"
                      class="chip flex-1"
                      [class.chip-on]="genero === 'M'"
                      [style.background]="genero === 'M' ? brand : null"
                    >
                      Masculino
                    </button>
                  </div>
                </div>
                <label class="flex flex-col gap-1.5">
                  <span class="field-label">Ciudad</span>
                  <input class="field-input" [(ngModel)]="ciudad" />
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="field-label">Ocupación</span>
                  <input class="field-input" [(ngModel)]="ocupacion" />
                </label>
              </div>
            </div>

            <!-- Producto -->
            <div>
              <div class="section-title">Producto</div>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label class="flex flex-col gap-1.5">
                  <span class="field-label">Suma asegurada</span>
                  <input
                    class="field-input font-semibold"
                    [(ngModel)]="sumaTxt"
                    (blur)="normalizarSuma()"
                  />
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="field-label">Años vigencia</span>
                  <input type="number" class="field-input" [(ngModel)]="anios" />
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="field-label">Cotización</span>
                  <input
                    class="field-input cursor-not-allowed bg-[var(--surface-sunken)] text-muted-foreground"
                    [value]="tarea().nro_cotizacion"
                    disabled
                    title="El número de cotización no se puede modificar"
                  />
                </label>
              </div>
            </div>

            <!-- Cuestionario médico -->
            <div>
              <div class="section-title">Cuestionario médico</div>
              <div class="mb-3 flex flex-wrap items-end gap-3">
                <label class="flex w-28 flex-col gap-1.5">
                  <span class="field-label">Peso (kg)</span>
                  <input type="number" class="field-input" [(ngModel)]="medico.peso" />
                </label>
                <label class="flex w-28 flex-col gap-1.5">
                  <span class="field-label">Talla (cm)</span>
                  <input type="number" class="field-input" [(ngModel)]="medico.talla" />
                </label>
              </div>
              <div class="flex flex-wrap gap-2">
                @for (c of medChips; track c.key) {
                  <button
                    type="button"
                    (click)="toggleMedico(c.key)"
                    class="chip"
                    [class.chip-on]="isMedicoOn(c.key)"
                    [style.background]="isMedicoOn(c.key) ? brand : null"
                  >
                    <span class="text-[11px]">{{ c.icon }}</span>
                    {{ c.label }}
                  </button>
                }
              </div>
            </div>

            <!-- Verificaciones -->
            <div>
              <div class="section-title">Verificaciones</div>
              <div class="flex flex-wrap gap-2">
                @for (v of verifChips; track v.key) {
                  <button
                    type="button"
                    (click)="verif[v.key] = !verif[v.key]"
                    class="chip"
                    [class.chip-on]="verif[v.key]"
                    [style.background]="verif[v.key] ? '#007A26' : null"
                  >
                    <span class="text-[11px]">{{ v.icon }}</span>
                    {{ v.label }}
                  </button>
                }
              </div>
            </div>

            <!-- Payload preview -->
            <div>
              <div class="section-title">Información que se enviará al motor</div>
              <pre
                class="max-h-56 overflow-auto rounded-lg bg-[#0F172A] p-4 font-mono text-[11px] leading-relaxed text-[#E2E8F0]"
                >{{ payloadJson() }}</pre
              >
            </div>

            @if (error(); as err) {
              <div
                class="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#DC2626]"
              >
                {{ err }}
              </div>
            }

            @if (result(); as r) {
              <div
                class="rounded-xl border p-4"
                [style.borderColor]="resultMeta().color"
                [style.background]="resultMeta().color + '0d'"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-card text-xl font-bold"
                    [style.color]="resultMeta().color"
                  >
                    <lucide-icon name="zap" [size]="20" />
                  </div>
                  <div>
                    <div
                      class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      Respuesta del motor
                    </div>
                    <div class="text-base font-bold text-foreground">
                      {{ resultMeta().label }}
                    </div>
                  </div>
                </div>
                <div class="mt-3 text-sm text-muted-foreground">{{ resultMeta().accion }}</div>
                <div class="mt-3 flex flex-wrap gap-2">
                  @if (r.imc !== null) {
                    <span class="metric"><span>IMC:</span><b>{{ r.imc.toFixed(1) }}</b></span>
                  }
                  @if (r.edad !== null) {
                    <span class="metric"><span>Edad:</span><b>{{ r.edad }}</b></span>
                  }
                  @if (r.relacion_prima !== null) {
                    <span class="metric">
                      <span>Rel. prima:</span><b>{{ r.relacion_prima.toFixed(0) }}%</b>
                    </span>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Footer -->
        <div
          class="flex flex-none items-center justify-end gap-2 border-t border-border bg-card px-6 py-3"
        >
          <button
            type="button"
            (click)="close.emit()"
            class="rounded-md border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-[var(--surface-sunken)]"
          >
            Cerrar
          </button>
          @if (result()) {
            <button
              type="button"
              (click)="aplicarYCerrar()"
              class="rounded-md px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
              [style.background]="brand"
            >
              Aplicar resultado al caso
            </button>
          } @else {
            <button
              type="button"
              (click)="submit()"
              [disabled]="loading()"
              class="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              [style.background]="brand"
            >
              @if (loading()) {
                <lucide-icon name="loader-2" [size]="14" class="animate-spin" />
              } @else {
                <lucide-icon name="zap" [size]="14" />
              }
              {{ loading() ? 'Evaluando...' : 'Evaluar con motor' }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .section-title {
      margin-bottom: 0.625rem;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted-foreground);
    }
    .field-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted-foreground);
    }
    .field-input {
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      background-color: var(--card);
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      color: var(--foreground);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--primary);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      background-color: var(--card);
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--foreground);
      transition: background-color 0.15s ease, color 0.15s ease;
      cursor: pointer;
    }
    .chip:hover { background-color: var(--surface-sunken); }
    .chip-on { border-color: transparent; color: #fff; }
    .metric {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      background-color: var(--card);
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      color: var(--muted-foreground);
    }
    .metric b { color: var(--foreground); }
  `,
})
export class EvaluarModalComponent {
  private readonly api = inject(SuscripcionApi);

  readonly tarea = input.required<Tarea>();
  readonly close = output<void>();
  readonly result$ = output<void>({ alias: 'resultado' });

  protected readonly brand = BRAND;
  protected readonly medChips = MED_CHIPS;
  protected readonly verifChips = VERIF_CHIPS;

  protected fecha = '';
  protected genero: 'F' | 'M' = 'F';
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
    this.close.emit();
  }

  protected normalizarSuma(): void {
    this.sumaTxt = fmtSumaTxt(parseSumaTxt(this.sumaTxt));
  }

  protected isMedicoOn(key: keyof MedicoFlags & string): boolean {
    return Boolean(this.medico[key]);
  }

  protected toggleMedico(key: keyof MedicoFlags & string): void {
    (this.medico as unknown as Record<string, boolean>)[key] = !(
      this.medico as unknown as Record<string, boolean>
    )[key];
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
      verificaciones: this.verif,
    };
  }

  protected payloadJson(): string {
    return JSON.stringify(this.payload(), null, 2);
  }

  protected async submit(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);
    try {
      // Persiste las correcciones + registra la evaluación en la auditoría
      this.result.set(await this.api.evaluarSolicitud(this.tarea().tarea_id, this.payload()));
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Error desconocido al llamar al motor',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected aplicarYCerrar(): void {
    if (this.result()) this.result$.emit();
    this.close.emit();
  }
}
