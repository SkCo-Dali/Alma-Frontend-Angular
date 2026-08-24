// Panel lateral del Simulador de asegurabilidad (réplica del Excel del equipo
// operativo). Patrón "Tu Dali": panel fixed a la derecha SIN overlay en desktop
// — el usuario interactúa con el panel y con la página al mismo tiempo.
//
// Precarga: con `solicitudId` (subpágina de detalle) trae la entrada precargada
// + la pre-simulación automática del worker; en la bandeja permite buscar una
// cotización por número/asegurado y precargarla.
// Paridad SimuladorPanel.tsx.

import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaSwitchComponent } from '../../../shared/components/alma-switch.component';
import { ToastService } from '../../../core/services/toast.service';
import { SuscripcionGridApi } from '../grid/suscripcion-grid.api';
import { CatalogoComboboxComponent } from './catalogo-combobox.component';
import {
  CatalogosSimulador,
  EntradaSimulador,
  ItemSimulado,
  PrecargaSimulador,
  ResultadoSimulador,
  SimuladorApi,
} from './simulador.api';

const fmtMiles = (n: number | null | undefined): string =>
  n == null || Number.isNaN(n) ? '' : Math.round(n).toLocaleString('es-CO');

const parseMiles = (t: string): number | null => {
  const digitos = t.replace(/[^\d]/g, '');
  return digitos ? Number(digitos) : null;
};

const ITEM_LABEL: Record<string, string> = {
  imc: 'IMC',
  preexistencia: 'Preexistencia',
  ocupacion: 'Ocupación',
  hobby: 'Hobby',
  pais: 'País de residencia',
};

const ITEM_ICONO: Record<string, string> = {
  imc: 'activity',
  preexistencia: 'heart-pulse',
  ocupacion: 'briefcase',
  hobby: 'bike',
  pais: 'globe',
};

const VEREDICTO_UI: Record<string, { label: string; cls: string }> = {
  continua: {
    label: 'CONTINUA',
    cls: 'border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  },
  informacion_adicional: {
    label: 'INFORMACIÓN ADICIONAL',
    cls: 'border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  },
  no_asegurable: {
    label: 'NO ASEGURABLE',
    cls: 'border-red-300/60 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
  },
};

interface ItemVista {
  item: ItemSimulado;
  label: string;
  icono: string;
  estadoIcono: string;
  estadoCls: string;
  estadoTexto: string;
  entradaTxt: string | null;
}

@Component({
  selector: 'alma-simulador-panel',
  imports: [
    FormsModule,
    LucideAngularModule,
    AlmaSwitchComponent,
    CatalogoComboboxComponent,
  ],
  template: `
    <aside
      aria-label="Simulador de asegurabilidad"
      [attr.aria-hidden]="!open()"
      class="surface-solid fixed bottom-4 right-0 top-24 z-20 flex w-full max-w-[420px] flex-col overflow-hidden rounded-l-2xl border border-border shadow-[var(--shadow-lg)] transition-transform duration-300 md:w-[400px]"
      [class]="open() ? 'translate-x-0' : 'pointer-events-none translate-x-full'"
    >
      <!-- Cabecera -->
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <lucide-icon name="calculator" [size]="16" class="text-primary" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold leading-tight text-foreground">
            Simulador de asegurabilidad
          </p>
          @if (precarga(); as p) {
            <p class="truncate text-[11px] text-muted-foreground">
              {{ p.nro_cotizacion }} · {{ p.asegurado ?? '—' }}
            </p>
          }
        </div>
        <button
          type="button"
          (click)="limpiar()"
          class="h-7 rounded-lg px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Limpiar
        </button>
        <button
          type="button"
          (click)="closed.emit()"
          aria-label="Cerrar simulador"
          class="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <lucide-icon name="x" [size]="16" class="mx-auto" />
        </button>
      </div>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-8">
        <!-- Precarga desde una cotización (solo en la bandeja) -->
        @if (!solicitudId()) {
          <div class="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-2.5">
            <p
              class="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
            >
              <lucide-icon name="sparkles" [size]="12" />
              Precargar desde una cotización (opcional)
            </p>
            <div class="flex gap-1.5">
              <input
                class="alma-input h-8 rounded-lg text-xs"
                [(ngModel)]="textoBusqueda"
                (keydown.enter)="buscar()"
                placeholder="N° de cotización o asegurado…"
              />
              <button
                type="button"
                (click)="buscar()"
                aria-label="Buscar cotización"
                class="alma-btn alma-btn-outline h-8 w-8 shrink-0 rounded-lg p-0"
              >
                <lucide-icon name="search" [size]="14" />
              </button>
            </div>
            @if (cotizacion(); as c) {
              <p class="truncate text-[11px] text-foreground">
                <lucide-icon name="check" [size]="12" class="mr-1 inline text-primary" />
                {{ c.etiqueta }}
              </p>
            }
            @if (buscando()) {
              <p class="text-[11px] text-muted-foreground">Buscando…</p>
            }
            @if (resultadosBusqueda().length === 0 && busquedaHecha() && !buscando()) {
              <p class="text-[11px] text-muted-foreground">Sin resultados.</p>
            }
            @if (resultadosBusqueda().length > 0) {
              <ul class="max-h-36 space-y-0.5 overflow-y-auto">
                @for (r of resultadosBusqueda(); track r.id) {
                  <li>
                    <button
                      type="button"
                      (click)="seleccionarCotizacion(r)"
                      class="w-full truncate rounded-lg px-2 py-1 text-left text-[11px] text-foreground transition-colors hover:bg-accent"
                    >
                      {{ r.etiqueta }}
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
        }
        @if (cargandoPrecarga()) {
          <p class="flex items-center gap-2 text-xs text-muted-foreground">
            <lucide-icon name="refresh-cw" [size]="14" class="animate-spin" /> Precargando
            datos de la cotización…
          </p>
        }

        <!-- ── Formulario ── -->
        <div class="grid grid-cols-2 gap-2.5">
          <div class="min-w-0 space-y-1">
            <p class="text-xs font-medium text-foreground">Edad</p>
            <input
              type="number"
              class="alma-input h-9 rounded-xl text-sm"
              [(ngModel)]="edad"
              [placeholder]="rangoEdad()"
            />
          </div>
          <div class="min-w-0 space-y-1">
            <p class="text-xs font-medium text-foreground">Sexo</p>
            <select class="alma-input h-9 rounded-xl text-sm" [(ngModel)]="sexo">
              <option value="">—</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
            </select>
          </div>
          <div class="min-w-0 space-y-1">
            <p class="text-xs font-medium text-foreground">Estatura (m)</p>
            <input
              type="number"
              step="0.01"
              class="alma-input h-9 rounded-xl text-sm"
              [(ngModel)]="estatura"
              (ngModelChange)="imcTick.set(imcTick() + 1)"
              placeholder="1.70"
            />
          </div>
          <div class="min-w-0 space-y-1">
            <p class="text-xs font-medium text-foreground">Peso (kg)</p>
            <input
              type="number"
              class="alma-input h-9 rounded-xl text-sm"
              [(ngModel)]="peso"
              (ngModelChange)="imcTick.set(imcTick() + 1)"
              placeholder="70"
            />
          </div>
        </div>
        @if (imcLocal(); as imc) {
          <p class="text-[11px] text-muted-foreground">
            IMC calculado: <span class="font-semibold text-foreground">{{ imc }}</span>
          </p>
        }

        <div class="min-w-0 space-y-1">
          <p class="text-xs font-medium text-foreground">País actual de residencia</p>
          <alma-catalogo-combobox
            [value]="pais()"
            [opciones]="catalogos()?.paises ?? []"
            placeholder="Selecciona el país…"
            (valueChange)="pais.set($event)"
          />
        </div>

        <div class="min-w-0 space-y-1">
          <p class="text-xs font-medium text-foreground">
            Preexistencias médicas o enfermedades
          </p>
          <div class="space-y-1.5">
            @if (preexistencias().length === 0) {
              <p class="text-[11px] text-muted-foreground">
                Sin preexistencias seleccionadas.
              </p>
            } @else {
              <div class="flex flex-wrap gap-1.5">
                @for (v of preexistencias(); track v) {
                  <span
                    class="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-primary"
                  >
                    {{ v }}
                    <button
                      type="button"
                      [attr.aria-label]="'Quitar ' + v"
                      (click)="quitarPreexistencia(v)"
                      class="rounded-full p-0.5 text-primary/70 hover:bg-primary/15 hover:text-primary"
                    >
                      <lucide-icon name="x" [size]="12" />
                    </button>
                  </span>
                }
              </div>
            }
            <alma-catalogo-combobox
              [value]="null"
              [opciones]="preexistenciasDisponibles()"
              [clearable]="false"
              placeholder="Agregar preexistencia…"
              (valueChange)="agregarPreexistencia($event)"
            />
          </div>
        </div>

        <div class="min-w-0 space-y-1">
          <p class="text-xs font-medium text-foreground">
            Profesión, ocupación o cargo actual
          </p>
          <alma-catalogo-combobox
            [value]="ocupacion()"
            [opciones]="catalogos()?.ocupaciones ?? []"
            placeholder="Selecciona la ocupación…"
            (valueChange)="ocupacion.set($event)"
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium text-foreground">
              ¿Practica algún hobby o actividad extracurricular?
            </p>
            <alma-switch
              [checked]="practicaHobby()"
              (checkedChange)="practicaHobby.set($event)"
              ariaLabel="¿Practica algún hobby?"
            />
          </div>
          @if (practicaHobby()) {
            <div class="space-y-1.5">
              @if (hobbies().length === 0) {
                <p class="text-[11px] text-muted-foreground">
                  Selecciona el hobby que practica.
                </p>
              } @else {
                <div class="flex flex-wrap gap-1.5">
                  @for (v of hobbies(); track v) {
                    <span
                      class="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-primary"
                    >
                      {{ v }}
                      <button
                        type="button"
                        [attr.aria-label]="'Quitar ' + v"
                        (click)="quitarHobby(v)"
                        class="rounded-full p-0.5 text-primary/70 hover:bg-primary/15 hover:text-primary"
                      >
                        <lucide-icon name="x" [size]="12" />
                      </button>
                    </span>
                  }
                </div>
              }
              <alma-catalogo-combobox
                [value]="null"
                [opciones]="hobbiesDisponibles()"
                [clearable]="false"
                placeholder="Agregar hobby…"
                (valueChange)="agregarHobby($event)"
              />
            </div>
          }
          @if (hobbyActivo() && catalogos()?.generales?.nota_hobby) {
            <p
              class="rounded-xl border border-amber-200/60 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
            >
              {{ catalogos()?.generales?.nota_hobby }}
            </p>
          }
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div class="min-w-0 space-y-1">
            <p class="text-xs font-medium text-foreground">Valor asegurado</p>
            <input
              class="alma-input h-9 rounded-xl text-sm"
              [(ngModel)]="valorAsegurado"
              (blur)="valorAsegurado = fmt(parse(valorAsegurado))"
              placeholder="0"
            />
          </div>
          <div class="min-w-0 space-y-1">
            <p class="text-xs font-medium text-foreground">Valor cúmulo</p>
            <input
              class="alma-input h-9 rounded-xl text-sm"
              [(ngModel)]="valorCumulo"
              (blur)="valorCumulo = fmt(parse(valorCumulo))"
              placeholder="0"
            />
          </div>
        </div>

        <button
          type="button"
          (click)="simular()"
          [disabled]="simulando() || cargandoCatalogos()"
          class="alma-btn alma-btn-primary h-9 w-full rounded-xl"
        >
          @if (simulando()) {
            <lucide-icon name="refresh-cw" [size]="14" class="animate-spin" />
          } @else {
            <lucide-icon name="calculator" [size]="14" />
          }
          Simular
        </button>

        <!-- ── Resultado ── -->
        @if (resultado(); as r) {
          <div class="space-y-3 border-t border-border pt-3">
            <div class="flex items-center justify-between">
              <p
                class="text-[10px] font-semibold uppercase tracking-wider text-foreground/65"
              >
                Resultado de tu consulta
              </p>
              @if (origen() === 'auto') {
                <span
                  class="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"
                >
                  Pre-análisis automático{{ fechaAuto() ? ' · ' + fechaAuto() : '' }}
                </span>
              }
            </div>

            @if (veredictoUi(); as ui) {
              <div class="rounded-xl border px-3 py-2.5" [class]="ui.cls">
                <p class="text-sm font-bold tracking-wide">{{ ui.label }}</p>
                @if (r.mensaje) {
                  <p class="mt-1 whitespace-pre-line text-xs leading-snug opacity-90">
                    {{ r.mensaje }}
                  </p>
                }
              </div>
            }

            <!-- Semáforo por ítem -->
            <ul class="space-y-1.5">
              @for (v of itemsVista(); track $index) {
                <li class="rounded-xl border border-border/50 bg-muted/15 px-2.5 py-2">
                  <div class="flex items-center gap-2">
                    <lucide-icon
                      [name]="v.icono"
                      [size]="14"
                      class="shrink-0 text-muted-foreground"
                    />
                    <span
                      class="min-w-0 flex-1 truncate text-xs font-medium text-foreground"
                    >
                      {{ v.label }}
                      @if (v.entradaTxt) {
                        <span class="font-normal text-muted-foreground">
                          · {{ v.entradaTxt }}
                        </span>
                      }
                      @if (v.item.categoria) {
                        <span class="font-normal text-muted-foreground">
                          ({{ v.item.categoria.trim() }})
                        </span>
                      }
                    </span>
                    <span
                      class="flex shrink-0 items-center gap-1 text-[11px] font-medium"
                      [class]="v.estadoCls"
                    >
                      <lucide-icon [name]="v.estadoIcono" [size]="14" /> {{ v.estadoTexto }}
                    </span>
                  </div>
                  @if (v.item.requisito) {
                    <p
                      class="mt-1 whitespace-pre-line pl-5 text-[11px] leading-snug text-muted-foreground"
                    >
                      {{ v.item.requisito }}
                    </p>
                  }
                </li>
              }
            </ul>

            <!-- Exámenes médicos -->
            @if (!r.examenes.sin_dato) {
              <div class="rounded-xl border border-border/50 bg-muted/15 px-2.5 py-2">
                <div class="flex items-center gap-2">
                  <lucide-icon
                    name="flask-conical"
                    [size]="14"
                    class="shrink-0 text-muted-foreground"
                  />
                  <span class="flex-1 text-xs font-medium text-foreground">
                    Exámenes médicos
                  </span>
                  @if (r.examenes.requiere) {
                    <span
                      class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                    >
                      Requiere · Paquete {{ r.examenes.paquete ?? '—' }}
                    </span>
                  } @else {
                    <span
                      class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                    >
                      No requiere
                    </span>
                  }
                </div>
                @if (r.examenes.valor_total !== null) {
                  <p class="mt-1 text-[11px] text-muted-foreground">
                    Valor total (asegurado + cúmulo): \${{ fmt(r.examenes.valor_total) }}
                  </p>
                }
                @if (r.examenes.requiere && r.examenes.examenes.length > 0) {
                  <ul class="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-0.5">
                    @for (e of r.examenes.examenes; track e) {
                      <li class="text-[11px] text-muted-foreground">• {{ e }}</li>
                    }
                  </ul>
                }
              </div>
            }

            <!-- Residente en el extranjero -->
            @if (r.extranjero.aplica) {
              <div
                class="rounded-xl border border-sky-200/60 bg-sky-50 px-2.5 py-2 text-sky-900 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200"
              >
                <p class="flex items-center gap-1.5 text-xs font-medium">
                  <lucide-icon name="plane" [size]="14" /> Requisitos residentes en el
                  extranjero
                </p>
                @for (req of r.extranjero.requisitos ?? []; track req) {
                  <p class="mt-1 text-[11px] leading-snug opacity-90">{{ req }}</p>
                }
                @if (r.extranjero.nota) {
                  <p class="mt-1.5 text-[10px] leading-snug opacity-75">
                    {{ r.extranjero.nota }}
                  </p>
                }
              </div>
            }

            <!-- Alertas y datos incompletos -->
            @if (r.alertas.length > 0) {
              <ul class="space-y-1">
                @for (a of r.alertas; track $index) {
                  <li
                    class="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300"
                  >
                    <lucide-icon name="alert-triangle" [size]="12" class="mt-0.5 shrink-0" />
                    {{ a }}
                  </li>
                }
              </ul>
            }
            @if (r.datos_incompletos.length > 0) {
              <p class="text-[11px] text-muted-foreground">
                Sin información: {{ r.datos_incompletos.join(', ') }}. Complétala para un
                resultado definitivo.
              </p>
            }
          </div>
        }
      </div>
    </aside>
  `,
})
export class SimuladorPanelComponent {
  private readonly api = inject(SimuladorApi);
  private readonly gridApi = inject(SuscripcionGridApi);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  /** Presente en la subpágina de detalle: precarga automática. */
  readonly solicitudId = input<string | undefined>(undefined);
  readonly closed = output<void>();

  protected readonly fmt = fmtMiles;
  protected readonly parse = parseMiles;

  // ── Estado del formulario ──
  protected edad = '';
  protected sexo: 'F' | 'M' | '' = '';
  protected estatura = '';
  protected peso = '';
  protected valorAsegurado = '';
  protected valorCumulo = '';
  protected readonly pais = signal<string | null>('Colombia');
  protected readonly preexistencias = signal<string[]>([]);
  protected readonly ocupacion = signal<string | null>(null);
  protected readonly practicaHobby = signal(false);
  protected readonly hobbies = signal<string[]>([]);
  protected readonly imcTick = signal(0);

  protected readonly catalogos = signal<CatalogosSimulador | null>(null);
  protected readonly cargandoCatalogos = signal(false);
  protected readonly precarga = signal<PrecargaSimulador | null>(null);
  protected readonly cargandoPrecarga = signal(false);
  protected readonly resultado = signal<ResultadoSimulador | null>(null);
  protected readonly origen = signal<'manual' | 'auto' | null>(null);
  protected readonly simulando = signal(false);

  // Buscador de cotización (solo en la bandeja)
  protected textoBusqueda = '';
  protected readonly buscando = signal(false);
  protected readonly busquedaHecha = signal(false);
  protected readonly resultadosBusqueda = signal<{ id: string; etiqueta: string }[]>([]);
  protected readonly cotizacion = signal<{ id: string; etiqueta: string } | null>(null);

  private catalogosCargados = false;
  private precargaAplicada: string | null = null;

  constructor() {
    // Los catálogos se cargan la primera vez que el panel se abre.
    effect(() => {
      if (this.open() && !this.catalogosCargados) {
        this.catalogosCargados = true;
        void this.cargarCatalogos();
      }
    });

    // Precarga cuando hay una cotización asociada (ruta de detalle o búsqueda).
    effect(() => {
      const id = this.solicitudId() ?? this.cotizacion()?.id;
      if (!this.open() || !id || this.precargaAplicada === id) return;
      this.precargaAplicada = id;
      void this.cargarPrecarga(id);
    });
  }

  protected readonly rangoEdad = computed(() => {
    const g = this.catalogos()?.generales;
    return g ? `${g.edad_min}–${g.edad_max}` : '';
  });

  protected readonly preexistenciasDisponibles = computed(() =>
    (this.catalogos()?.preexistencias ?? []).filter(
      (o) => !this.preexistencias().includes(o),
    ),
  );

  protected readonly hobbiesDisponibles = computed(() =>
    (this.catalogos()?.hobbies ?? []).filter((o) => !this.hobbies().includes(o)),
  );

  protected readonly hobbyActivo = computed(
    () =>
      this.practicaHobby() &&
      this.hobbies().some((h) => h.toLowerCase() !== 'ninguno'),
  );

  protected readonly imcLocal = computed(() => {
    this.imcTick(); // recalcula al tipear peso/estatura
    const p = this.peso ? Number(String(this.peso).replace(',', '.')) : null;
    let e = this.estatura ? Number(String(this.estatura).replace(',', '.')) : null;
    if (!p || !e) return null;
    if (e > 3) e = e / 100;
    return Math.round((p / (e * e)) * 100) / 100;
  });

  protected readonly veredictoUi = computed(() => {
    const v = this.resultado()?.veredicto;
    return v ? VEREDICTO_UI[v] : null;
  });

  protected readonly fechaAuto = computed(() => {
    if (this.origen() !== 'auto') return null;
    const f = this.precarga()?.ultima_simulacion?.ejecutada_en;
    return f ? f.slice(0, 10) : null;
  });

  protected readonly itemsVista = computed<ItemVista[]>(() =>
    (this.resultado()?.items ?? []).map((i) => {
      let estadoIcono = 'circle-dashed';
      let estadoCls = 'text-muted-foreground';
      let estadoTexto = 'Sin información';
      if (!i.sin_dato) {
        if (i.resultado === 'Estándar') {
          estadoIcono = 'check';
          estadoCls = 'text-emerald-600 dark:text-emerald-400';
          estadoTexto = 'Estándar';
        } else if (i.resultado === 'Rechazar') {
          estadoIcono = 'x-circle';
          estadoCls = 'text-destructive';
          estadoTexto = 'Rechazar';
        } else {
          estadoIcono = 'alert-triangle';
          estadoCls = 'text-amber-600 dark:text-amber-400';
          estadoTexto = 'Información adicional';
        }
      }
      return {
        item: i,
        label: ITEM_LABEL[i.item] ?? i.item,
        icono: ITEM_ICONO[i.item] ?? 'activity',
        estadoIcono,
        estadoCls,
        estadoTexto,
        entradaTxt: i.entrada != null ? String(i.entrada) : null,
      };
    }),
  );

  private async cargarCatalogos(): Promise<void> {
    this.cargandoCatalogos.set(true);
    try {
      this.catalogos.set(await this.api.getCatalogos());
    } catch {
      this.catalogos.set(null);
    } finally {
      this.cargandoCatalogos.set(false);
    }
  }

  private async cargarPrecarga(id: string): Promise<void> {
    this.cargandoPrecarga.set(true);
    try {
      const p = await this.api.getPrecarga(id);
      this.precarga.set(p);
      this.aplicarEntrada(p.entrada);
      const ultima = p.ultima_simulacion;
      if (ultima?.resultado) {
        this.resultado.set(ultima.resultado);
        this.origen.set(ultima.origen);
      } else {
        this.resultado.set(null);
        this.origen.set(null);
      }
    } catch {
      this.precarga.set(null);
    } finally {
      this.cargandoPrecarga.set(false);
    }
  }

  private aplicarEntrada(e: EntradaSimulador): void {
    this.edad = e.edad != null ? String(e.edad) : '';
    this.sexo = e.sexo === 'F' || e.sexo === 'M' ? e.sexo : '';
    this.estatura = e.estatura != null ? String(e.estatura) : '';
    this.peso = e.peso != null ? String(e.peso) : '';
    this.pais.set(e.pais ?? null);
    this.preexistencias.set(e.preexistencias ?? []);
    this.ocupacion.set(e.ocupacion ?? null);
    this.hobbies.set(e.hobbies ?? []);
    this.practicaHobby.set((e.hobbies ?? []).some((h) => h.toLowerCase() !== 'ninguno'));
    this.valorAsegurado = fmtMiles(e.valor_asegurado);
    this.valorCumulo = fmtMiles(e.valor_cumulo);
    this.imcTick.update((n) => n + 1);
  }

  private entrada(): EntradaSimulador {
    return {
      edad: this.edad ? Number(this.edad) : null,
      sexo: this.sexo || null,
      estatura: this.estatura ? Number(String(this.estatura).replace(',', '.')) : null,
      peso: this.peso ? Number(String(this.peso).replace(',', '.')) : null,
      pais: this.pais(),
      preexistencias: this.preexistencias(),
      ocupacion: this.ocupacion(),
      practica_hobby: this.practicaHobby(),
      hobbies: this.practicaHobby() ? this.hobbies() : [],
      valor_asegurado: parseMiles(this.valorAsegurado),
      valor_cumulo: parseMiles(this.valorCumulo),
    };
  }

  protected agregarPreexistencia(v: string | null): void {
    if (v) this.preexistencias.update((prev) => [...prev, v]);
  }

  protected quitarPreexistencia(v: string): void {
    this.preexistencias.update((prev) => prev.filter((x) => x !== v));
  }

  protected agregarHobby(v: string | null): void {
    if (v) this.hobbies.update((prev) => [...prev, v]);
  }

  protected quitarHobby(v: string): void {
    this.hobbies.update((prev) => prev.filter((x) => x !== v));
  }

  protected async simular(): Promise<void> {
    this.simulando.set(true);
    try {
      const id = this.solicitudId() ?? this.cotizacion()?.id ?? null;
      this.resultado.set(await this.api.evaluar(this.entrada(), id));
      this.origen.set('manual');
    } catch (e) {
      this.toast.error('No se pudo simular', e instanceof Error ? e.message : String(e));
    } finally {
      this.simulando.set(false);
    }
  }

  /** Busca cotizaciones reutilizando POST /grid (mismo contrato de la bandeja). */
  protected async buscar(): Promise<void> {
    const q = this.textoBusqueda.trim();
    if (q.length < 3) return;
    this.buscando.set(true);
    this.busquedaHecha.set(true);
    try {
      const res = await this.gridApi.fetchGridData({ search: q, page: 1, pageSize: 6 });
      this.resultadosBusqueda.set(
        res.items.map((row) => ({
          id: row.Id,
          etiqueta: `${String(row['NroCotizacion'] ?? '')} · ${String(row['Asegurado'] ?? '—')}`,
        })),
      );
    } catch {
      this.resultadosBusqueda.set([]);
    } finally {
      this.buscando.set(false);
    }
  }

  protected seleccionarCotizacion(c: { id: string; etiqueta: string }): void {
    this.precargaAplicada = null;
    this.cotizacion.set(c);
    this.resultadosBusqueda.set([]);
  }

  protected limpiar(): void {
    this.aplicarEntrada({ pais: 'Colombia' });
    this.cotizacion.set(null);
    this.resultado.set(null);
    this.origen.set(null);
    this.precarga.set(null);
    this.precargaAplicada = null;
  }
}
