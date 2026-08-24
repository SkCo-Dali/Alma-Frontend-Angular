// Actualización de estados en Pipeline (Sigscg.TrkApplications) desde Alma.
//
// Cada caso corresponde al documento "ESTADOS CONTROL Y EMISIÓN" del área de
// Control y Emisión (ago-2026): el analista elige el caso, diligencia lo mismo
// que diligenciaría en la pantalla de Pipeline, y Alma escribe allá.
//
// El diálogo tiene dos pasos: elegir el caso y llenar sus campos. Los campos
// que se dejen vacíos NO se tocan en Pipeline (el backend usa COALESCE), así
// que el registro de exámenes se puede diligenciar por etapas.

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  CasoEstado,
  EstadoAplicadoApi,
  EstadosCatalogosApi,
  ExamenesIn,
  SuscripcionApi,
} from './suscripcion.api';
import { Tarea } from './suscripcion.domain';

interface CasoDef {
  id: CasoEstado;
  titulo: string;
  detalle: string;
  icon: string;
}

/** Los 7 casos del documento, en el orden en que ocurren en la operación. */
const CASOS: CasoDef[] = [
  {
    id: 'informacion_adicional',
    titulo: 'Información adicional',
    detalle: 'Se le pide algo al asesor (ocupación, historia clínica…).',
    icon: 'mail-question',
  },
  {
    id: 'examen_medico',
    titulo: 'Exámen médico',
    detalle: 'El cliente va a exámenes. Luego se registra la cita.',
    icon: 'stethoscope',
  },
  {
    id: 'examenes',
    titulo: 'Registro de exámenes',
    detalle: 'Paquete, cita, unidad y entrega de resultados.',
    icon: 'clipboard-list',
  },
  {
    id: 'reaseguro',
    titulo: 'Reaseguro',
    detalle: 'La solicitud se escala al reasegurador.',
    icon: 'building-2',
  },
  {
    id: 'reaseguro_seguimiento',
    titulo: 'Respuesta de reaseguro',
    detalle: 'Fechas de envío y recibido, y su concepto.',
    icon: 'mail-check',
  },
  {
    id: 'pendiente_fondeo',
    titulo: 'Pendiente fondeo',
    detalle: 'Capital + Seguro a la espera del aporte.',
    icon: 'piggy-bank',
  },
  {
    id: 'cobertura',
    titulo: 'Definir cobertura',
    detalle: 'Estándar, exclusión o rechazo de ITP.',
    icon: 'shield-check',
  },
];

@Component({
  selector: 'alma-estado-pipeline-dialog',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      (click)="cerrar()"
    >
      <div
        class="surface-solid flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <!-- ── Encabezado ── -->
        <header class="flex items-start gap-3 border-b border-border/50 px-5 py-4">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <lucide-icon name="git-pull-request-arrow" [size]="18" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-bold leading-tight">Actualizar en Pipeline</h2>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">
              Cotización {{ tarea().nro_cotizacion }} · {{ tarea().asegurado.nombre }}
            </p>
          </div>
          <button
            type="button"
            (click)="cerrar()"
            class="-mr-1 -mt-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <lucide-icon name="x" [size]="18" />
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          @if (aplicado(); as res) {
            <!-- ── Confirmación ── -->
            <div class="flex flex-col items-center gap-3 py-6 text-center">
              <div
                class="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              >
                <lucide-icon name="check-circle-2" [size]="24" />
              </div>
              <div>
                <p class="text-base font-bold">{{ res.accion }}</p>
                <p class="mt-1 text-sm text-muted-foreground">
                  Aplicado en Pipeline sobre la cotización {{ res.nro_cotizacion }}.
                </p>
              </div>
              @if (res.advertencia; as adv) {
                <p
                  class="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50 px-3 py-2 text-left text-xs leading-snug text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                >
                  <lucide-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0" />
                  {{ adv }}
                </p>
              }
            </div>
          } @else if (!caso()) {
            <!-- ── Paso 1: elegir el caso ── -->
            <p class="mb-3 text-xs text-muted-foreground">
              ¿Qué le pasó a esta solicitud?
            </p>
            <ul class="grid gap-1.5">
              @for (c of casos; track c.id) {
                <li>
                  <button
                    type="button"
                    (click)="elegir(c)"
                    class="flex w-full items-center gap-3 rounded-xl border border-border/50 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <lucide-icon
                      [name]="c.icon"
                      [size]="18"
                      class="shrink-0 text-muted-foreground"
                    />
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-medium text-foreground">{{
                        c.titulo
                      }}</span>
                      <span class="block text-xs leading-snug text-muted-foreground">{{
                        c.detalle
                      }}</span>
                    </span>
                    <lucide-icon
                      name="chevron-right"
                      [size]="16"
                      class="shrink-0 text-muted-foreground"
                    />
                  </button>
                </li>
              }
            </ul>
          } @else {
            <!-- ── Paso 2: el formulario del caso ── -->
            <button
              type="button"
              (click)="volver()"
              class="-ml-1.5 mb-3 flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <lucide-icon name="chevron-left" [size]="14" /> Cambiar de caso
            </button>

            <p class="mb-3 text-sm font-semibold text-foreground">{{ tituloCaso() }}</p>

            <!-- Resumen de lo que quedará en Pipeline -->
            @if (efecto(); as ef) {
              <p
                class="mb-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-xs leading-snug text-muted-foreground"
              >
                {{ ef }}
              </p>
            }

            <div class="grid gap-3">
              @if (caso() === 'informacion_adicional' || caso() === 'pendiente_fondeo') {
                <label class="block space-y-1">
                  <span class="text-xs font-medium text-foreground"
                    >Fecha de envío del correo al asesor</span
                  >
                  <input
                    type="date"
                    class="alma-input h-9 rounded-xl text-sm"
                    [(ngModel)]="fechaCorreo"
                  />
                </label>
              }

              @if (caso() === 'cobertura') {
                <label class="block space-y-1">
                  <span class="text-xs font-medium text-foreground">Estado de cobertura</span>
                  <select
                    class="alma-input h-9 rounded-xl text-sm"
                    [(ngModel)]="estadoCobertura"
                  >
                    @for (op of opcionesEstadoCobertura(); track op.codigo) {
                      <option [value]="op.codigo">{{ op.label }}</option>
                    }
                  </select>
                </label>
                <label class="block space-y-1">
                  <span class="text-xs font-medium text-foreground"
                    >Cobertura resultante</span
                  >
                  <select class="alma-input h-9 rounded-xl text-sm" [(ngModel)]="cobertura">
                    <option value="">Sin cambio</option>
                    @for (op of opcionesCobertura(); track op.codigo) {
                      <option [value]="op.codigo">{{ op.label }}</option>
                    }
                  </select>
                  @if (estadoCobertura === 'RE') {
                    <span class="block text-[11px] leading-snug text-muted-foreground">
                      Al rechazar ITP, la cobertura suele pasar de «Vida + ITP» a «Vida».
                    </span>
                  }
                </label>
              }

              @if (caso() === 'examenes') {
                <div class="grid grid-cols-2 gap-2.5">
                  <label class="block min-w-0 space-y-1">
                    <span class="text-xs font-medium text-foreground">Paquete solicitado</span>
                    <select
                      class="alma-input h-9 rounded-xl text-sm"
                      [(ngModel)]="ex.tipo_examen"
                    >
                      <option value="">—</option>
                      @for (p of catalogos()?.paquetesExamen ?? []; track p) {
                        <option [value]="p">{{ p }}</option>
                      }
                    </select>
                  </label>
                  <label class="block min-w-0 space-y-1">
                    <span class="text-xs font-medium text-foreground">Envío de solicitud</span>
                    <input
                      type="date"
                      class="alma-input h-9 rounded-xl text-sm"
                      [(ngModel)]="ex.fecha_envio_solicitud"
                    />
                  </label>
                  <label class="block min-w-0 space-y-1">
                    <span class="text-xs font-medium text-foreground">Número de cita</span>
                    <input
                      type="text"
                      class="alma-input h-9 rounded-xl text-sm"
                      [(ngModel)]="ex.numero_cita"
                      placeholder="9005000"
                    />
                  </label>
                  <label class="block min-w-0 space-y-1">
                    <span class="text-xs font-medium text-foreground">Llamada al cliente</span>
                    <input
                      type="date"
                      class="alma-input h-9 rounded-xl text-sm"
                      [(ngModel)]="ex.fecha_llamada_cliente"
                    />
                  </label>
                  <label class="block min-w-0 space-y-1">
                    <span class="text-xs font-medium text-foreground">Fecha y hora de la cita</span>
                    <input
                      type="datetime-local"
                      class="alma-input h-9 rounded-xl text-sm"
                      [(ngModel)]="ex.fecha_cita"
                    />
                  </label>
                  <label class="block min-w-0 space-y-1">
                    <span class="text-xs font-medium text-foreground">Prueba de esfuerzo</span>
                    <input
                      type="datetime-local"
                      class="alma-input h-9 rounded-xl text-sm"
                      [(ngModel)]="ex.fecha_prueba_esfuerzo"
                    />
                  </label>
                  <label class="block min-w-0 space-y-1">
                    <span class="text-xs font-medium text-foreground">Unidad</span>
                    <select class="alma-input h-9 rounded-xl text-sm" [(ngModel)]="ex.unidad">
                      <option value="">—</option>
                      @for (op of opcionesUnidad(); track op.codigo) {
                        <option [value]="op.codigo">{{ op.label }}</option>
                      }
                    </select>
                  </label>
                  <label class="block min-w-0 space-y-1">
                    <span class="text-xs font-medium text-foreground">Entrega de resultados</span>
                    <input
                      type="date"
                      class="alma-input h-9 rounded-xl text-sm"
                      [(ngModel)]="ex.fecha_entrega_resultados"
                    />
                  </label>
                </div>
                <label class="block space-y-1">
                  <span class="text-xs font-medium text-foreground"
                    >Dirección / unidad de la cita</span
                  >
                  <input
                    type="text"
                    class="alma-input h-9 rounded-xl text-sm"
                    [(ngModel)]="ex.direccion_domicilio"
                  />
                </label>
                <label class="block space-y-1">
                  <span class="text-xs font-medium text-foreground"
                    >Observaciones del proveedor</span
                  >
                  <textarea
                    rows="2"
                    class="alma-input rounded-xl py-2 text-sm"
                    [(ngModel)]="ex.observaciones_proveedor"
                  ></textarea>
                </label>
              }

              @if (caso() === 'reaseguro_seguimiento') {
                <div class="grid grid-cols-2 gap-2.5">
                  <label class="block min-w-0 space-y-1">
                    <span class="text-xs font-medium text-foreground">Envío a reaseguro</span>
                    <input
                      type="date"
                      class="alma-input h-9 rounded-xl text-sm"
                      [(ngModel)]="fechaEnvioReaseguro"
                    />
                  </label>
                  <label class="block min-w-0 space-y-1">
                    <span class="text-xs font-medium text-foreground">Respuesta recibida</span>
                    <input
                      type="date"
                      class="alma-input h-9 rounded-xl text-sm"
                      [(ngModel)]="fechaRecibidoReaseguro"
                    />
                  </label>
                </div>
              }

              @if (caso() !== 'examenes') {
                <label class="block space-y-1">
                  <span class="text-xs font-medium text-foreground">
                    {{
                      caso() === 'reaseguro_seguimiento'
                        ? 'Concepto del reasegurador'
                        : 'Observaciones'
                    }}
                  </span>
                  <textarea
                    rows="3"
                    [maxlength]="maxObservaciones()"
                    class="alma-input rounded-xl py-2 text-sm"
                    [(ngModel)]="observaciones"
                    placeholder="Queda en la bitácora del caso."
                  ></textarea>
                  <span class="block text-[11px] text-muted-foreground">
                    {{ observaciones.length }}/{{ maxObservaciones() }} · Pipeline conserva
                    la última observación; Alma guarda el historial completo.
                  </span>
                </label>
              }
            </div>

            @if (error(); as err) {
              <p
                class="mt-3 rounded-xl bg-destructive/10 p-2 text-center text-xs text-destructive"
              >
                {{ err }}
              </p>
            }
          }
        </div>

        <!-- ── Pie ── -->
        <footer class="flex justify-end gap-2 border-t border-border/50 px-5 py-3">
          @if (aplicado()) {
            <button
              type="button"
              (click)="cerrar()"
              class="alma-btn alma-btn-primary rounded-xl"
            >
              Listo
            </button>
          } @else {
            <button
              type="button"
              (click)="cerrar()"
              class="alma-btn alma-btn-outline rounded-xl"
            >
              Cancelar
            </button>
            @if (caso()) {
              <button
                type="button"
                [disabled]="!puedeAplicar() || aplicando()"
                (click)="aplicar()"
                class="alma-btn alma-btn-primary rounded-xl"
              >
                @if (aplicando()) {
                  <lucide-icon name="loader-2" [size]="16" class="animate-spin" />
                }
                {{ aplicando() ? 'Aplicando…' : 'Aplicar en Pipeline' }}
              </button>
            }
          }
        </footer>
      </div>
    </div>
  `,
})
export class EstadoPipelineDialogComponent {
  private readonly api = inject(SuscripcionApi);

  readonly tarea = input.required<Tarea>();
  readonly closed = output<void>();
  /** Se emite tras una escritura exitosa (el padre refresca la cotización). */
  readonly aplicadoOk = output<void>();

  protected readonly casos = CASOS;
  protected readonly caso = signal<CasoEstado | null>(null);
  protected readonly catalogos = signal<EstadosCatalogosApi | null>(null);
  protected readonly aplicando = signal(false);
  protected readonly aplicado = signal<EstadoAplicadoApi | null>(null);
  protected readonly error = signal<string | null>(null);

  // Campos del formulario (uno por caso; se limpian al cambiar de caso).
  protected fechaCorreo = '';
  protected observaciones = '';
  protected estadoCobertura = 'ES';
  protected cobertura = '';
  protected fechaEnvioReaseguro = '';
  protected fechaRecibidoReaseguro = '';
  protected ex: ExamenesIn = {};

  protected readonly tituloCaso = computed(
    () => CASOS.find((c) => c.id === this.caso())?.titulo ?? '',
  );

  protected readonly maxObservaciones = computed(
    () => this.catalogos()?.observacionesMax ?? 500,
  );

  /** Lo que quedará escrito en Pipeline, en el lenguaje de la pantalla. */
  protected readonly efecto = computed(() => {
    const cat = this.catalogos();
    switch (this.caso()) {
      case 'informacion_adicional':
        return 'Subestado «Información Adicional» y estado de cobertura «Pendiente».';
      case 'pendiente_fondeo':
        return 'Subestado «Pendiente Fondeo» y estado de cobertura «Pendiente». Aplica a Capital + Seguro.';
      case 'examen_medico':
        return 'Subestado «Exámen Médico» y estado de cobertura «Pendiente».';
      case 'reaseguro':
        return 'Subestado «Reaseguro» y estado de cobertura «Pendiente».';
      case 'cobertura':
        return `Estado de cobertura «${cat?.estadoCobertura?.[this.estadoCobertura] ?? this.estadoCobertura}».`;
      case 'examenes':
        return 'Solo se escriben los campos que diligencies; los demás quedan como están.';
      case 'reaseguro_seguimiento':
        return 'Fechas y observaciones del ciclo con el reasegurador.';
      default:
        return null;
    }
  });

  protected readonly opcionesEstadoCobertura = computed(() =>
    this.mapaAOpciones(this.catalogos()?.estadoCobertura, ['ES', 'EX', 'RE', 'PE']),
  );
  protected readonly opcionesCobertura = computed(() =>
    this.mapaAOpciones(this.catalogos()?.cobertura, ['VI', 'VT', 'EG', 'PE']),
  );
  protected readonly opcionesUnidad = computed(() =>
    this.mapaAOpciones(this.catalogos()?.unidadExamenes),
  );

  /**
   * Botón habilitado solo cuando hay algo que escribir: los casos de registro
   * (exámenes/reaseguro) no tienen sentido con el formulario vacío.
   */
  protected readonly puedeAplicar = computed(() => {
    switch (this.caso()) {
      case 'examenes':
        return Object.values(this.ex).some((v) => v !== null && v !== undefined && v !== '');
      case 'reaseguro_seguimiento':
        return Boolean(
          this.fechaEnvioReaseguro || this.fechaRecibidoReaseguro || this.observaciones,
        );
      case null:
        return false;
      default:
        return true;
    }
  });

  constructor() {
    void this.cargarCatalogos();
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      this.catalogos.set(await this.api.getCatalogosEstados());
    } catch {
      this.catalogos.set(null); // los selects caen a los códigos crudos
    }
  }

  private mapaAOpciones(
    mapa: Record<string, string> | undefined,
    soloCodigos?: string[],
  ): { codigo: string; label: string }[] {
    const entradas = Object.entries(mapa ?? {});
    const filtradas = soloCodigos
      ? soloCodigos.map((c) => [c, mapa?.[c] ?? c] as [string, string])
      : entradas;
    return filtradas.map(([codigo, label]) => ({ codigo, label }));
  }

  protected elegir(c: CasoDef): void {
    this.limpiar();
    this.caso.set(c.id);
    // La fecha del correo al asesor es, por defecto, hoy: es el día en que el
    // analista lo envía (así lo hace en Pipeline).
    if (c.id === 'informacion_adicional' || c.id === 'pendiente_fondeo') {
      this.fechaCorreo = new Date().toISOString().slice(0, 10);
    }
  }

  protected volver(): void {
    this.limpiar();
    this.caso.set(null);
  }

  private limpiar(): void {
    this.fechaCorreo = '';
    this.observaciones = '';
    this.estadoCobertura = 'ES';
    this.cobertura = '';
    this.fechaEnvioReaseguro = '';
    this.fechaRecibidoReaseguro = '';
    this.ex = {};
    this.error.set(null);
  }

  /** '' → null: un campo vacío significa "no tocar", no "borrar". */
  private v(valor: string | null | undefined): string | null {
    const t = (valor ?? '').trim();
    return t === '' ? null : t;
  }

  protected async aplicar(): Promise<void> {
    const id = this.tarea().tarea_id;
    const obs = this.v(this.observaciones);
    this.aplicando.set(true);
    this.error.set(null);
    try {
      let res: EstadoAplicadoApi;
      switch (this.caso()) {
        case 'informacion_adicional':
          res = await this.api.marcarInformacionAdicional(id, this.v(this.fechaCorreo), obs);
          break;
        case 'pendiente_fondeo':
          res = await this.api.marcarPendienteFondeo(id, this.v(this.fechaCorreo), obs);
          break;
        case 'examen_medico':
          res = await this.api.marcarExamenMedico(id, obs);
          break;
        case 'reaseguro':
          res = await this.api.marcarReaseguro(id, obs);
          break;
        case 'cobertura':
          res = await this.api.definirCobertura(
            id,
            this.estadoCobertura,
            this.v(this.cobertura),
            obs,
          );
          break;
        case 'examenes':
          res = await this.api.registrarExamenes(id, this.examenesLimpios());
          break;
        case 'reaseguro_seguimiento':
          res = await this.api.registrarReaseguro(
            id,
            this.v(this.fechaEnvioReaseguro),
            this.v(this.fechaRecibidoReaseguro),
            obs,
          );
          break;
        default:
          return;
      }
      this.aplicado.set(res);
      this.aplicadoOk.emit();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.aplicando.set(false);
    }
  }

  /** Solo los campos diligenciados: el backend no toca los ausentes. */
  private examenesLimpios(): ExamenesIn {
    const salida: Record<string, string> = {};
    for (const [k, valor] of Object.entries(this.ex)) {
      const t = this.v(valor as string);
      if (t !== null) salida[k] = t;
    }
    return salida as ExamenesIn;
  }

  protected cerrar(): void {
    this.closed.emit();
  }
}
