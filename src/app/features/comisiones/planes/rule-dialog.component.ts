// Editor de reglas de comisión (crear y editar en un solo componente).
//
// Diferencias de comportamiento entre modos, conservadas del original:
// - Crear: las condiciones se arman en memoria y se guardan DESPUÉS de crear
//   la regla (necesitan su id), en una sola tanda.
// - Editar: la regla ya existe, así que cada condición completa se sincroniza
//   al instante (POST la primera vez, PUT las siguientes) y borrarla pega al
//   API salvo que aún sea temporal.
//
// Las pestañas Incentivos y Pagos venían comentadas en el editar y sin efecto
// en el crear (el API no las recibe), así que no se portan.

import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PortalDirective } from '../../../shared/portal.directive';
import { colocarPanel } from '../../../shared/popover-position';
import { ApiHttpError, motivoDeError } from '../api-error';
import { CatalogsStore } from '../catalogos/catalogs.store';
import { ComisionesToast } from '../comisiones-toast.service';
import { CommissionRule } from './commission-plans.api';
import {
  CommissionRulesApi,
  RulePreviewRequest,
  RulePreviewResponse,
  RuleSimulateField,
  RuleSimulateResponse,
} from './commission-rules.api';
import {
  ConditionRow,
  FORMULA_FUNCTIONS,
  MATH_OPERATORS,
  getConditionOptions,
  mapApiOperatorToUI,
  mapUIOperatorToAPI,
} from './rule-form.domain';
import { NovaDialogComponent } from '../../../shared/components/nova-dialog/nova-dialog.component';

type Tab = 'information' | 'rule' | 'preview';

@Component({
  selector: 'alma-rule-dialog',
  imports: [NovaDialogComponent, FormsModule, LucideAngularModule, PortalDirective],
  template: `
    <nova-dialog
      #dlg
      ariaLabel="Regla de comisión"
      width="800px"
      [padded]="false"
      [showClose]="false"
      [dismissable]="!guardando()"
      (closed)="closed.emit()"
    >
      <div class="p-4 sm:p-6">
        <div class="mb-4">
          <h2 class="text-lg font-bold">
            {{ esEdicion() ? 'Editar Regla de Comisión' : 'Crear Regla de Comisión' }}
          </h2>
          <p class="text-sm text-muted-foreground">
            {{
              esEdicion()
                ? 'Actualiza los detalles de la regla, fórmula y condiciones.'
                : 'Define una nueva regla para el plan de comisiones con su fórmula y condiciones.'
            }}
          </p>
        </div>

        <!-- Pestañas -->
        <div class="glass flex w-full gap-1 rounded-full bg-[var(--surface-sunken)] p-1">
          @for (t of tabs; track t.id) {
            <button
              type="button"
              (click)="tab.set(t.id)"
              class="flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all sm:px-4 sm:text-sm"
              [class]="
                tab() === t.id
                  ? 'bg-card text-foreground shadow-[var(--shadow-sm)]'
                  : 'text-muted-foreground'
              "
            >
              {{ t.label }}
            </button>
          }
        </div>

        <!-- Información -->
        @if (tab() === 'information') {
          <div animate.enter="nova-entra" class="mt-4 space-y-4">
            <div>
              <label class="text-sm font-medium" for="rule-name">
                Nombre <span class="text-destructive">*</span>
              </label>
              <input
                id="rule-name"
                class="alma-input mt-1"
                placeholder="AIS_FRONT1_OMPEV_MASTER"
                [(ngModel)]="nombre"
              />
              @if (!nombre.trim()) {
                <p class="mt-1 text-xs text-destructive">Nombre es obligatorio</p>
              }
            </div>
            <div>
              <label class="text-sm font-medium" for="rule-desc">Descripción</label>
              <textarea
                id="rule-desc"
                class="alma-input mt-1"
                rows="3"
                placeholder="No se difiere la comisión, esta se paga el 100% con la prima 1"
                [(ngModel)]="descripcion"
              ></textarea>
            </div>
          </div>
        }

        <!-- Regla -->
        @if (tab() === 'rule') {
          <div animate.enter="nova-entra" class="mt-4 space-y-4">
            <div>
              <label class="text-sm font-medium" for="rule-catalog">
                Catálogo <span class="text-destructive">*</span>
              </label>
              <select
                id="rule-catalog"
                class="alma-input mt-1"
                [disabled]="catalogos.loading()"
                [ngModel]="catalogo()"
                (ngModelChange)="cambiarCatalogo($event)"
              >
                <option value="">
                  {{
                    catalogos.loading()
                      ? 'Cargando catálogos…'
                      : 'Seleccionar un catálogo'
                  }}
                </option>
                @for (c of catalogos.activos(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
              @if (!catalogo()) {
                <p class="mt-1 text-xs text-destructive">Catálogo es obligatorio</p>
              }
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 sm:gap-6">
              <!-- Fórmula -->
              <div>
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-sm font-medium" for="rule-formula">
                    Fórmula <span class="text-destructive">*</span>
                  </label>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-medium text-muted-foreground">Funciones:</span>
                    <select
                      class="alma-input h-8 w-[130px] border-none bg-muted/50 text-xs"
                      [ngModel]="''"
                      (ngModelChange)="insertarFuncion($event)"
                    >
                      <option value="">Insertar función</option>
                      @for (f of funciones; track f) {
                        <option [value]="f">{{ f }}()</option>
                      }
                    </select>
                  </div>
                </div>
                <textarea
                  #formulaRef
                  id="rule-formula"
                  class="alma-input font-mono text-sm"
                  rows="4"
                  placeholder="1.30 / 100 * record.ValorBase * 25 / 100"
                  [(ngModel)]="formula"
                ></textarea>
                @if (!formula.trim()) {
                  <p class="mt-1 text-xs text-destructive">Fórmula es obligatorio</p>
                }
                <div class="mt-2 flex flex-wrap gap-1">
                  @for (op of operadores; track op.symbol) {
                    <button
                      type="button"
                      (click)="insertarTexto(op.symbol)"
                      class="alma-btn alma-btn-outline h-8 px-3 text-sm"
                    >
                      {{ op.label }}
                    </button>
                  }
                </div>
              </div>

              <!-- Campos insertables -->
              <div>
                <label class="text-sm font-medium">Haz clic para insertar campos</label>
                <div class="mt-1 space-y-2">
                  <div class="relative flex items-center">
                    <span class="pointer-events-none absolute left-2.5 z-20 flex items-center">
                      <lucide-icon
                        name="search"
                        [size]="14"
                        class="text-muted-foreground"
                      />
                    </span>
                    <input
                      class="alma-input pl-8"
                      placeholder="Escribe para buscar"
                      [(ngModel)]="busquedaCampo"
                      (ngModelChange)="busquedaCampoSig.set($event)"
                    />
                  </div>
                  <div class="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    @if (catalogos.loadingFields()) {
                      <div class="py-4 text-center text-xs text-muted-foreground">
                        Cargando campos…
                      </div>
                    } @else if (!catalogo()) {
                      <div class="py-4 text-center text-xs text-muted-foreground">
                        Selecciona un catálogo para ver campos
                      </div>
                    } @else {
                      @for (f of camposFiltrados(); track f.id) {
                        <button
                          type="button"
                          [title]="f.description || ''"
                          (click)="insertarTexto('record.' + f.field_name)"
                          class="w-full rounded border border-primary/20 bg-primary/10 px-3 py-2 text-left text-sm transition-colors hover:bg-primary/20"
                        >
                          {{ f.display_name || f.field_name }}
                        </button>
                      } @empty {
                        <div class="py-4 text-center text-xs text-muted-foreground">
                          No se encontraron campos
                        </div>
                      }
                    }
                  </div>
                </div>
              </div>
            </div>

            <!-- Condiciones -->
            <div class="mt-6">
              <div class="mb-3 flex items-center justify-between">
                <label class="text-sm font-medium">Condiciones</label>
                <button
                  type="button"
                  (click)="agregarCondicion()"
                  [disabled]="tieneO()"
                  class="alma-btn alma-btn-outline h-8 px-3 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Agregar condición"
                >
                  <lucide-icon name="plus" [size]="16" />
                </button>
              </div>

              @if (tieneO()) {
                <p
                  class="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                >
                  Esta regla combina condiciones con «o». Para no cambiar su lógica no se
                  pueden agregar ni quitar condiciones aquí; sí puedes cambiar operadores y
                  valores.
                </p>
              }

              <div class="space-y-3">
                @for (c of condiciones(); track c.id; let i = $index) {
                  <div
                    class="relative flex flex-col items-start gap-2 rounded-xl border border-border bg-muted/10 p-4 sm:grid sm:grid-cols-12 sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
                  >
                    <div
                      class="hidden text-center text-sm font-medium text-muted-foreground sm:col-span-1 sm:block"
                      [class.text-amber-600]="union(i) === 'o'"
                      [class.font-semibold]="union(i) === 'o'"
                    >
                      {{ union(i) }}
                    </div>
                    <div
                      class="text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:hidden"
                      [class.text-amber-600]="union(i) === 'o'"
                    >
                      {{ union(i) }}
                    </div>

                    <div class="w-full sm:col-span-3">
                      <select
                        class="alma-input"
                        [disabled]="!catalogo()"
                        [ngModel]="c.field"
                        (ngModelChange)="cambiarCondicion(c.id, 'field', $event)"
                      >
                        <option value="">
                          {{ catalogo() ? 'Campo' : 'Primero selecciona catálogo' }}
                        </option>
                        @for (f of campos(); track f.id) {
                          <option [value]="f.field_name" [title]="f.description || ''">
                            {{ f.display_name || f.field_name }}
                          </option>
                        }
                      </select>
                    </div>

                    <div class="w-full sm:col-span-2">
                      <select
                        class="alma-input"
                        [disabled]="!c.field"
                        [ngModel]="c.condition"
                        (ngModelChange)="cambiarCondicion(c.id, 'condition', $event)"
                      >
                        <option value="">Condición</option>
                        @for (o of opcionesCondicion(c.fieldType); track o) {
                          <option [value]="o">{{ o }}</option>
                        }
                      </select>
                    </div>

                    <div class="w-full sm:col-span-2">
                      <select
                        class="alma-input"
                        [ngModel]="c.valueType"
                        (ngModelChange)="cambiarCondicion(c.id, 'valueType', $event)"
                      >
                        <option value="column">Columna</option>
                        <option value="text">Texto</option>
                      </select>
                    </div>

                    <div class="relative w-full sm:col-span-3">
                      <button
                        type="button"
                        (click)="alternarValores(c, $event)"
                        class="alma-btn alma-btn-outline w-full justify-between"
                        [class.text-muted-foreground]="!c.value"
                      >
                        <span class="truncate">{{ c.value || 'Valor' }}</span>
                        <lucide-icon
                          name="chevrons-up-down"
                          [size]="16"
                          class="ml-2 shrink-0 opacity-50"
                        />
                      </button>

                      @if (valoresAbiertos() === c.id) {
                        <div
                          #panel
                          almaPortal
                          class="surface-solid fixed z-[120] min-w-[240px] rounded-lg border border-border p-1 text-left text-sm normal-case tracking-normal text-foreground shadow-[var(--shadow-lg)]"
                        >
                          <input
                            class="alma-input mb-1 h-8 text-sm"
                            placeholder="Buscar o escribir valor…"
                            [(ngModel)]="valorLibre"
                            (keydown.enter)="confirmarValorLibre(c.id)"
                          />
                          <div class="max-h-52 overflow-y-auto">
                            @for (v of valores(c); track v.id) {
                              <button
                                type="button"
                                (click)="cambiarCondicion(c.id, 'value', v.value); valoresAbiertos.set(null)"
                                class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/50"
                              >
                                <lucide-icon
                                  name="check"
                                  [size]="14"
                                  class="mt-0.5 shrink-0"
                                  [class.opacity-0]="c.value !== v.value"
                                />
                                <span class="flex flex-col">
                                  <span>{{ v.label }}</span>
                                  @if (v.description) {
                                    <span class="text-xs text-muted-foreground">
                                      {{ v.description }}
                                    </span>
                                  }
                                </span>
                              </button>
                            } @empty {
                              <div class="px-2 py-3 text-center text-xs text-muted-foreground">
                                Escribe un valor y presiona Enter
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>

                    <div
                      class="absolute right-2 top-2 flex justify-end sm:static sm:col-span-1 sm:w-full sm:justify-center"
                    >
                      <button
                        type="button"
                        (click)="quitarCondicion(c.id)"
                        [disabled]="tieneO()"
                        class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                        aria-label="Quitar condición"
                      >
                        <lucide-icon name="x" [size]="16" />
                      </button>
                    </div>
                  </div>
                } @empty {
                  <div
                    class="rounded border border-dashed border-border py-4 text-center text-sm text-muted-foreground"
                  >
                    No se han agregado condiciones aún. Haz clic en el botón + para
                    agregar condiciones.
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- Vista previa -->
        @if (tab() === 'preview') {
          <div animate.enter="nova-entra" class="mt-4 space-y-3">
            <div
              class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <strong>Vista previa fuera del flujo de comisiones.</strong>
              Se calcula aplicando la fórmula y las condiciones directamente sobre el insumo
              del catálogo, sin los filtros, ajustes ni modificaciones que se hacen durante el
              flujo. El resultado del motor puede ser distinto si algún proceso de negocio
              altera estos registros.
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-sm text-muted-foreground">
                @if (vistaPrevia(); as vp) {
                  @if (vp.resultado_motor) {
                    Resultado del motor de {{ vp.catalogo }}, periodo {{ vp.periodo }} (último mes
                    cerrado; este catálogo depende del cálculo del motor).
                  } @else {
                    Insumo de {{ vp.catalogo }}, periodo {{ vp.periodo }} (el último cargado,
                    generalmente el mes en curso).
                  }
                } @else {
                  Usa el último insumo cargado del catálogo (el último mes cerrado si el catálogo
                  sale del motor) y
                  la regla como está en pantalla, aunque no esté guardada.
                }
              </p>
              <button
                type="button"
                (click)="generarVistaPrevia()"
                [disabled]="cargandoPrevia() || !puedeCalcular()"
                class="alma-btn alma-btn-outline w-full shrink-0 sm:w-auto"
              >
                {{ cargandoPrevia() ? 'Generando…' : 'Generar vista previa' }}
              </button>
            </div>

            @if (!puedeCalcular()) {
              <p class="text-sm text-muted-foreground">
                Selecciona el catálogo y escribe la fórmula para generar la vista previa.
              </p>
            } @else if (errorPrevia(); as error) {
              <p class="text-sm text-destructive">{{ error }}</p>
            } @else if (vistaPrevia(); as vp) {
              @if (vp.total === 0) {
                <p class="py-6 text-center font-medium">
                  Ningún registro del insumo {{ vp.periodo }} cumple las condiciones de la regla.
                </p>
              } @else {
                <p class="text-sm">
                  {{ formatearNumero(vp.total) }} registros cumplen las condiciones. Se muestran
                  los {{ vp.filas.length }} de mayor comisión.
                </p>
                <div class="overflow-x-auto rounded-lg border border-border">
                  <table class="alma-table min-w-full">
                    <thead class="bg-[var(--table-header)]">
                      <tr>
                        @for (col of vp.columnas; track col) {
                          <th class="whitespace-nowrap px-3 py-2 text-left text-[11px] uppercase tracking-wide">
                            {{ col === 'ValorComision' ? 'Comisión' : col }}
                          </th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (fila of vp.filas; track $index) {
                        <tr>
                          @for (col of vp.columnas; track col) {
                            <td
                              class="whitespace-nowrap px-3 py-2 text-xs"
                              [class.text-right]="col === 'ValorComision'"
                              [class.font-semibold]="col === 'ValorComision'"
                            >
                              {{ celda(fila[col], col) }}
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            } @else if (!cargandoPrevia()) {
              <p class="py-6 text-center text-sm text-muted-foreground">
                Las 10 comisiones principales que se muestren son solo una muestra del total que
                la regla podría generar.
              </p>
            }

            <!-- Simulación: solo cuando la vista previa no trajo datos -->
            @if (sinDatos() && puedeCalcular()) {
              <div class="space-y-3 rounded-lg border border-border p-3">
                @if (simulacion(); as s) {
                  <div
                    class="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
                  >
                    <strong>Simulación con datos inventados:</strong> no corresponde a clientes ni
                    contratos reales. Sirve para ver cuánto daría la regla con estos valores.
                  </div>
                  <div class="grid gap-2 sm:grid-cols-2">
                    @for (c of s.campos; track c.campo) {
                      <label class="flex flex-col gap-1 text-xs">
                        <span class="flex justify-between gap-2">
                          <span class="font-medium">{{ c.campo }}</span>
                          <span
                            [class.text-destructive]="c.origen === 'falta'"
                            [class.text-muted-foreground]="c.origen !== 'falta'"
                          >
                            {{ etiquetaOrigen(c) }}
                          </span>
                        </span>
                        <input
                          class="alma-input"
                          [type]="c.tipo === 'date' ? 'date' : 'text'"
                          [attr.inputmode]="c.tipo === 'int' || c.tipo === 'decimal' ? 'decimal' : null"
                          [placeholder]="c.tipo === 'int' || c.tipo === 'decimal' ? '0.00' : ''"
                          [(ngModel)]="valoresSim[c.campo]"
                        />
                      </label>
                    }
                  </div>
                  <div class="flex justify-end">
                    <button
                      type="button"
                      (click)="simular()"
                      [disabled]="cargandoSim()"
                      class="alma-btn alma-btn-outline w-full sm:w-auto"
                    >
                      {{ cargandoSim() ? 'Calculando…' : 'Calcular' }}
                    </button>
                  </div>
                  @if (s.faltan.length) {
                    <p class="text-sm text-amber-700 dark:text-amber-300">
                      Escribe un valor para: {{ s.faltan.join(', ') }}.
                    </p>
                  } @else if (s.cumple !== null) {
                    <div class="rounded-md border border-border p-3">
                      <p class="text-xs text-muted-foreground">Comisión con estos datos</p>
                      <p class="text-2xl font-semibold">{{ celda(s.comision, 'ValorComision') }}</p>
                      @if (s.cumple) {
                        <p class="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                          Con estos datos la regla aplica.
                        </p>
                      } @else {
                        <p class="mt-1 text-sm text-destructive">
                          Con estos datos la regla no aplicaría: el motor no pagaría esta comisión.
                        </p>
                      }
                      <ul class="mt-2 space-y-1 text-xs">
                        @for (cond of s.condiciones; track $index) {
                          <li [class.text-destructive]="!cond.cumple">
                            {{ cond.cumple ? '✓' : '✗' }} {{ cond.texto }}
                          </li>
                        }
                      </ul>
                    </div>
                  }
                } @else {
                  <div class="flex flex-col items-center gap-2 py-2 text-center">
                    <p class="text-sm text-muted-foreground">
                      No hay datos reales para mostrar. Puedes ver cuánto daría la regla con datos
                      de ejemplo.
                    </p>
                    <button
                      type="button"
                      (click)="simular()"
                      [disabled]="cargandoSim()"
                      class="alma-btn alma-btn-outline"
                    >
                      {{ cargandoSim() ? 'Preparando…' : 'Simular con datos de ejemplo' }}
                    </button>
                  </div>
                }
                @if (errorSim(); as error) {
                  <p class="text-sm text-destructive">{{ error }}</p>
                }
              </div>
            }
          </div>
        }

        <div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            (click)="cancelar()"
            [disabled]="guardando()"
            class="alma-btn alma-btn-outline w-full sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="button"
            (click)="guardar()"
            [disabled]="guardando() || !puedeGuardar()"
            class="alma-btn alma-btn-primary w-full sm:w-auto"
          >
            {{ textoGuardar() }}
          </button>
        </div>
      </div>
    </nova-dialog>
  `,
})
export class RuleDialogComponent implements OnInit {
  readonly mode = input<'create' | 'edit'>('create');
  readonly planId = input.required<string>();
  readonly rule = input<CommissionRule | null>(null);
  readonly closed = output<void>();
  private readonly dlg = viewChild.required<NovaDialogComponent>('dlg');
  readonly saved = output<void>();

  protected readonly catalogos = inject(CatalogsStore);
  private readonly api = inject(CommissionRulesApi);
  private readonly toast = inject(ComisionesToast);

  @ViewChild('formulaRef') private formulaRef?: ElementRef<HTMLTextAreaElement>;

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'information', label: 'Información' },
    { id: 'rule', label: 'Regla' },
    { id: 'preview', label: 'Vista Previa' },
  ];
  protected readonly operadores = MATH_OPERATORS;
  protected readonly funciones = FORMULA_FUNCTIONS;

  protected readonly tab = signal<Tab>('information');
  protected readonly guardando = signal(false);

  protected readonly vistaPrevia = signal<RulePreviewResponse | null>(null);
  protected readonly cargandoPrevia = signal(false);
  protected readonly errorPrevia = signal<string | null>(null);

  /** La vista previa no trajo datos (0 registros o sin insumo): se ofrece simular. */
  protected readonly sinDatos = signal(false);
  protected readonly simulacion = signal<RuleSimulateResponse | null>(null);
  protected readonly cargandoSim = signal(false);
  protected readonly errorSim = signal<string | null>(null);
  protected valoresSim: Record<string, string> = {};
  /** Lo que propuso el back: solo se reenvía lo que el usuario cambió. */
  private propuestosSim: Record<string, string> = {};

  protected nombre = '';
  protected descripcion = '';
  protected formula = '';
  protected readonly catalogo = signal('');

  protected busquedaCampo = '';
  protected readonly busquedaCampoSig = signal('');
  protected valorLibre = '';
  protected readonly valoresAbiertos = signal<string | null>(null);

  protected readonly condiciones = signal<ConditionRow[]>([]);

  /** Reglas con «o» (p. ej. las Fpob por ramas): agregar o quitar una condición
   *  cambiaría a qué rama aplica cada una, así que en el editor no se permite. */
  protected readonly tieneO = computed(() => this.condiciones().some((c) => c.logical === 'OR'));

  /** Etiqueta de la fila: el motor une cada condición con la siguiente usando
   *  el operador lógico de la ANTERIOR. */
  protected union(i: number): string {
    if (i === 0) return 'Si';
    return this.condiciones()[i - 1]?.logical === 'OR' ? 'o' : 'y';
  }
  private secuencia = 0;

  protected readonly esEdicion = computed(() => this.mode() === 'edit');

  protected readonly campos = computed(() => this.catalogos.camposDe(this.catalogo()));

  protected readonly camposFiltrados = computed(() => {
    const q = this.busquedaCampoSig().trim().toLowerCase();
    const lista = this.campos();
    return q ? lista.filter((f) => f.field_name.toLowerCase().includes(q)) : lista;
  });

  protected readonly textoGuardar = computed(() => {
    if (this.guardando()) return this.esEdicion() ? 'Actualizando…' : 'Creando…';
    return this.esEdicion() ? 'Actualizar Regla' : 'Guardar';
  });

  protected puedeGuardar(): boolean {
    return this.nombre.trim().length > 0 && this.puedeCalcular();
  }

  /** Lo mínimo para calcular la regla: catálogo y fórmula. */
  protected puedeCalcular(): boolean {
    return this.formula.trim().length > 0 && !!this.catalogo();
  }

  // ── Vista previa ──────────────────────────────────────────────────────────

  /** Corre la regla como está en pantalla (guardada o no) sobre el último insumo. */
  protected async generarVistaPrevia(): Promise<void> {
    if (!this.puedeCalcular()) return;
    this.cargandoPrevia.set(true);
    this.errorPrevia.set(null);
    this.vistaPrevia.set(null);
    this.sinDatos.set(false);
    this.simulacion.set(null);
    this.errorSim.set(null);
    this.valoresSim = {};
    this.propuestosSim = {};
    try {
      const res = await this.api.preview(this.solicitudRegla());
      this.vistaPrevia.set(res);
      this.sinDatos.set(res.total === 0);
    } catch (e) {
      console.error('Error generando la vista previa:', e);
      this.errorPrevia.set(motivoDeError(e) || 'No se pudo generar la vista previa.');
      // 404: el catálogo no tiene insumo (o el motor no tiene mes cerrado).
      this.sinDatos.set(e instanceof ApiHttpError && e.status === 404);
    } finally {
      this.cargandoPrevia.set(false);
    }
  }

  /** La regla como está en pantalla (guardada o no). */
  private solicitudRegla(): RulePreviewRequest {
    const completas = this.condiciones().filter((c) => c.field && c.condition && c.value);
    return {
      rule_name: this.nombre.trim(),
      catalog_id: this.catalogo(),
      formula: this.formula,
      conditions: completas.map((c) => ({
        field_name: c.field,
        operator: mapUIOperatorToAPI(c.condition),
        field_value: c.value,
        value_type: c.valueType,
        logical_operator: c.logical ?? 'AND',
      })),
    };
  }

  /** Primera vez: el back propone valores. Después: recalcula con lo editado. */
  protected async simular(): Promise<void> {
    this.cargandoSim.set(true);
    this.errorSim.set(null);
    const valores: Record<string, string> = {};
    for (const [campo, valor] of Object.entries(this.valoresSim)) {
      const v = (valor ?? '').toString().trim();
      if (v && v !== this.propuestosSim[campo]) valores[campo] = v;
    }
    try {
      const res = await this.api.simulate({ ...this.solicitudRegla(), valores });
      for (const c of res.campos) {
        if (c.origen === 'condicion' || c.origen === 'ejemplo') this.propuestosSim[c.campo] = c.valor ?? '';
        this.valoresSim[c.campo] = c.valor ?? '';
      }
      this.simulacion.set(res);
    } catch (e) {
      console.error('Error en la simulación:', e);
      this.errorSim.set(motivoDeError(e) || 'No se pudo calcular la simulación.');
    } finally {
      this.cargandoSim.set(false);
    }
  }

  protected etiquetaOrigen(c: RuleSimulateField): string {
    const etiquetas: Record<RuleSimulateField['origen'], string> = {
      condicion: 'cumple la condición',
      ejemplo: 'ejemplo del catálogo',
      usuario: 'escrito',
      falta: 'falta',
    };
    return etiquetas[c.origen];
  }

  protected formatearNumero(n: number): string {
    return n.toLocaleString('es-CO');
  }

  protected celda(valor: string | number | boolean | null | undefined, col: string): string {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (col === 'ValorComision' && typeof valor === 'number') {
      return valor.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 2,
      });
    }
    return String(valor);
  }

  constructor() {
    // Al elegir catálogo se piden sus campos (una sola vez por catálogo).
    effect(() => {
      const id = this.catalogo();
      if (id) void this.catalogos.cargarCampos(id);
    });
  }

  ngOnInit(): void {
    void this.catalogos.cargar();
    const r = this.rule();
    if (this.esEdicion() && r) {
      this.nombre = r.name ?? '';
      this.descripcion = r.description ?? '';
      this.formula = r.formula ?? '';
      this.catalogo.set(r.catalog ?? '');
      void this.cargarCondiciones(r.id);
    }
  }

  /** Trae las condiciones guardadas y las traduce a filas del formulario. */
  private async cargarCondiciones(ruleId: string): Promise<void> {
    try {
      const res = await this.api.listConditions(ruleId, {
        order_by: 'condition_order',
        order_dir: 'asc',
      });
      // Los campos del catálogo deben estar cargados para resolver tipo e id.
      const catalogId = this.catalogo();
      if (catalogId) await this.catalogos.cargarCampos(catalogId);
      const campos = this.catalogos.camposDe(catalogId);

      const filas: ConditionRow[] = res.items.map((api) => {
        const campo = campos.find(
          (f) => f.field_name === api.field_name || f.display_name === api.field_name,
        );
        if (campo && catalogId) void this.catalogos.cargarValores(catalogId, campo.id);
        return {
          id: api.id,
          field: campo?.field_name || api.field_name,
          fieldId: campo?.id,
          fieldType: campo?.field_type,
          condition: mapApiOperatorToUI(api.operator),
          valueType: api.value_type || 'text',
          value: api.field_value,
          logical: api.logical_operator === 'OR' ? 'OR' : 'AND',
        };
      });
      this.condiciones.set(filas);
    } catch (e) {
      this.toast.errorGenerico('fetch', e instanceof Error ? e.message : String(e));
    }
  }

  protected opcionesCondicion(fieldType?: string): string[] {
    return getConditionOptions(fieldType);
  }

  protected valores(c: ConditionRow) {
    return this.catalogos.valoresDe(this.catalogo(), c.fieldId);
  }

  protected cambiarCatalogo(id: string): void {
    this.catalogo.set(id);
  }

  /** Al aparecer el panel (ya en <body>) se coloca bajo el botón de valor. */
  @ViewChild('panel') set panelRef(el: ElementRef<HTMLElement> | undefined) {
    if (el && this.anchorValor) colocarPanel(el.nativeElement, this.anchorValor);
  }

  private anchorValor: DOMRect | null = null;

  protected alternarValores(c: ConditionRow, ev?: MouseEvent): void {
    this.valorLibre = '';
    if (ev) {
      this.anchorValor = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    }
    this.valoresAbiertos.update((prev) => (prev === c.id ? null : c.id));
    if (c.fieldId && this.catalogo()) {
      void this.catalogos.cargarValores(this.catalogo(), c.fieldId);
    }
  }

  protected confirmarValorLibre(id: string): void {
    const v = this.valorLibre.trim();
    if (!v) return;
    this.cambiarCondicion(id, 'value', v);
    this.valoresAbiertos.set(null);
    this.valorLibre = '';
  }

  // ── Fórmula ───────────────────────────────────────────────────────────────

  /** Inserta en la posición del cursor y lo deja después de lo insertado. */
  protected insertarTexto(texto: string, desplazamiento = texto.length): void {
    const ta = this.formulaRef?.nativeElement;
    if (!ta) {
      this.formula += texto;
      return;
    }
    const inicio = ta.selectionStart ?? this.formula.length;
    const fin = ta.selectionEnd ?? inicio;
    this.formula = this.formula.substring(0, inicio) + texto + this.formula.substring(fin);
    setTimeout(() => {
      ta.focus();
      const pos = inicio + desplazamiento;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  /** `max()` con el cursor dentro del paréntesis. */
  protected insertarFuncion(func: string): void {
    if (!func) return;
    this.insertarTexto(`${func}()`, func.length + 1);
  }

  // ── Condiciones ───────────────────────────────────────────────────────────

  protected agregarCondicion(): void {
    if (this.tieneO()) return;
    this.condiciones.update((prev) => [
      ...prev,
      {
        id: `temp-${++this.secuencia}`,
        field: '',
        condition: '',
        valueType: 'text',
        value: '',
      },
    ]);
  }

  protected async quitarCondicion(id: string): Promise<void> {
    if (this.tieneO()) return;
    const quitarLocal = () =>
      this.condiciones.update((prev) => prev.filter((c) => c.id !== id));

    if (!this.esEdicion() || id.startsWith('temp-')) {
      quitarLocal();
      return;
    }
    const ruleId = this.rule()?.id;
    if (!ruleId) return;
    try {
      await this.api.removeCondition(ruleId, id);
      quitarLocal();
      this.toast.ok('Condición eliminada', 'La condición se eliminó correctamente.');
    } catch (e) {
      this.toast.errorGenerico('delete', e);
    }
  }

  /**
   * Actualiza una fila y, en edición, la sincroniza cuando ya está completa.
   * Al cambiar el campo se reinician condición y valor (cambia el tipo de dato),
   * y por eso ese cambio nunca dispara guardado.
   */
  protected cambiarCondicion(
    id: string,
    prop: 'field' | 'condition' | 'valueType' | 'value',
    valor: string,
  ): void {
    let actualizada: ConditionRow | undefined;

    this.condiciones.update((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (prop === 'field') {
          const campo = this.campos().find(
            (f) => f.field_name === valor || f.display_name === valor,
          );
          if (campo && this.catalogo()) {
            void this.catalogos.cargarValores(this.catalogo(), campo.id);
          }
          actualizada = {
            ...c,
            field: valor,
            fieldId: campo?.id,
            fieldType: campo?.field_type,
            condition: '',
            value: '',
          };
        } else if (prop === 'valueType') {
          actualizada = { ...c, valueType: valor === 'column' ? 'column' : 'text' };
        } else {
          actualizada = { ...c, [prop]: valor };
        }
        return actualizada;
      }),
    );

    if (!this.esEdicion() || !actualizada) return;
    const fila = actualizada;
    if (fila.field && fila.condition && fila.value) void this.sincronizar(fila);
  }

  /** Filas con un guardado en curso; el valor indica si cambió otra vez mientras tanto. */
  private readonly sincronizando = new Map<string, boolean>();

  /** POST la primera vez (id temporal) y PUT en adelante. Un guardado a la vez
   *  por fila: dos POST seguidos de la misma fila creaban la condición dos veces. */
  private async sincronizar(fila: ConditionRow): Promise<void> {
    const ruleId = this.rule()?.id;
    if (!ruleId) return;
    if (this.sincronizando.has(fila.id)) {
      this.sincronizando.set(fila.id, true);
      return;
    }
    this.sincronizando.set(fila.id, false);
    let idActual = fila.id;
    try {
      if (fila.id.startsWith('temp-')) {
        const orden = this.condiciones().findIndex((c) => c.id === fila.id);
        const creada = await this.api.createCondition(ruleId, {
          field_name: fila.field,
          operator: mapUIOperatorToAPI(fila.condition),
          field_value: fila.value,
          value_type: fila.valueType,
          logical_operator: 'AND',
          group_level: 0,
          condition_order: orden < 0 ? 0 : orden,
        });
        idActual = creada.id;
        this.condiciones.update((prev) =>
          prev.map((c) => (c.id === fila.id ? { ...c, id: creada.id } : c)),
        );
      } else {
        await this.api.updateCondition(ruleId, fila.id, {
          field_name: fila.field,
          operator: mapUIOperatorToAPI(fila.condition),
          field_value: fila.value,
          value_type: fila.valueType,
        });
      }
    } catch (e) {
      console.error('Error guardando la condición:', e);
      const motivo = motivoDeError(e);
      this.toast.errorGenericoConMensaje(
        motivo
          ? `La condición no se guardó en el servidor: ${motivo}`
          : 'La condición se actualizó en pantalla pero no se pudo guardar en el servidor.',
        'Advertencia',
      );
    } finally {
      const cambioDespues = this.sincronizando.get(fila.id);
      this.sincronizando.delete(fila.id);
      if (cambioDespues) {
        const ultima = this.condiciones().find((c) => c.id === idActual);
        if (ultima?.field && ultima.condition && ultima.value) void this.sincronizar(ultima);
      }
    }
  }

  // ── Guardar ───────────────────────────────────────────────────────────────

  protected async guardar(): Promise<void> {
    if (!this.puedeGuardar()) {
      this.tab.set(!this.nombre.trim() ? 'information' : 'rule');
      return;
    }

    if (this.guardando()) return;
    this.guardando.set(true);
    try {
      const payload = {
        name: this.nombre,
        description: this.descripcion,
        formula: this.formula,
        catalog: this.catalogo(),
      };

      if (this.esEdicion()) {
        const ruleId = this.rule()?.id;
        if (!ruleId) return;
        // Sin is_active: editar no reactiva una regla que estaba inactiva.
        await this.api.update(ruleId, payload);
        this.toast.ok('Regla actualizada', `La regla "${this.nombre}" se actualizó.`);
      } else {
        const creada = await this.api.create(this.planId(), { ...payload, is_active: true });
        // Las condiciones necesitan el id de la regla: van después, en tanda.
        const completas = this.condiciones().filter(
          (c) => c.field && c.condition && c.value,
        );
        try {
          await Promise.all(
            completas.map((c, i) =>
              this.api.createCondition(creada.id, {
                field_name: c.field,
                operator: mapUIOperatorToAPI(c.condition),
                field_value: c.value,
                value_type: c.valueType,
                logical_operator: 'AND',
                group_level: 0,
                condition_order: i,
              }),
            ),
          );
        } catch (e) {
          // Una regla sin todas sus condiciones pagaría de más: se deshace la creación.
          await this.deshacerCreacion(creada.id);
          throw e;
        }
        this.toast.ok(
          'Regla creada',
          `La regla "${this.nombre}" se creó con ${completas.length} condición(es).`,
        );
      }
      this.saved.emit();
      this.dlg().close();
    } catch (e) {
      this.toast.errorMutacion(e, this.esEdicion() ? 'update' : 'create');
    } finally {
      this.guardando.set(false);
    }
  }

  /** Borra la regla recién creada cuando fallaron sus condiciones. */
  private async deshacerCreacion(ruleId: string): Promise<void> {
    try {
      await this.api.remove(ruleId);
    } catch (e) {
      console.error('No se pudo deshacer la regla creada:', e);
      this.toast.errorGenericoConMensaje(
        `La regla "${this.nombre}" quedó creada sin todas sus condiciones. Elimínala o complétala antes de enviar el plan a aprobación.`,
        'Regla incompleta',
      );
      this.saved.emit();
    }
  }

  protected cancelar(): void {
    if (this.guardando()) return;
    this.dlg().close();
  }
}
