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
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent, SkDropdownComponent, SkInputComponent, SkTextareaComponent } from '@skandia/ui';
import { Tabs, TabList, Tab as PTab, TabPanels, TabPanel } from 'primeng/tabs';
import { PortalDirective } from '../../../shared/portal.directive';
import { colocarPanel } from '../../../shared/popover-position';
import { CatalogsStore } from '../catalogos/catalogs.store';
import { ComisionesToast } from '../comisiones-toast.service';
import { CommissionRule } from './commission-plans.api';
import { CommissionRulesApi } from './commission-rules.api';
import {
  ConditionRow,
  FORMULA_FUNCTIONS,
  MATH_OPERATORS,
  getConditionOptions,
  mapApiOperatorToUI,
  mapUIOperatorToAPI,
} from './rule-form.domain';

type Tab = 'information' | 'rule' | 'preview';

@Component({
  selector: 'alma-rule-dialog',
  imports: [
    FormsModule,
    LucideAngularModule,
    SkButtonComponent,
    SkDropdownComponent,
    SkInputComponent,
    SkTextareaComponent,
    PortalDirective,
    Tabs,
    TabList,
    PTab,
    TabPanels,
    TabPanel,
  ],
  template: `
    <div
      class="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      (click)="cancelar()"
    >
      <div
        class="surface-solid my-6 w-full max-w-[800px] rounded-2xl border border-border p-4 shadow-2xl sm:p-6"
        (click)="$event.stopPropagation()"
      >
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
        <p-tabs
          [value]="tab()"
          (valueChange)="tab.set($any($event))"
          [lazy]="true"
        >
          <p-tablist aria-label="Secciones de la regla">
            @for (t of tabs; track t.id) {
              <p-tab [value]="t.id">{{ t.label }}</p-tab>
            }
          </p-tablist>
          <p-tabpanels>
            <!-- Información -->
            <p-tabpanel value="information">
              <div class="mt-4 space-y-4">
                <div>
                  <sk-input
                    label="Nombre *"
                    placeholder="AIS_FRONT1_OMPEV_MASTER"
                    [(ngModel)]="nombre"
                  />
                </div>
                <div>
                  <sk-textarea
                    label="Descripción"
                    [rows]="3"
                    placeholder="No se difiere la comisión, esta se paga el 100% con la prima 1"
                    [(ngModel)]="descripcion"
                  />
                </div>
              </div>
            </p-tabpanel>

            <!-- Regla -->
            <p-tabpanel value="rule">
              <div class="mt-4 space-y-4">
            <div>
              <sk-dropdown
                label="Catálogo *"
                [options]="catalogoOptions()"
                [placeholder]="
                  catalogos.loading() ? 'Cargando catálogos…' : 'Seleccionar un catálogo'
                "
                [disabled]="catalogos.loading()"
                [ngModel]="catalogo()"
                (ngModelChange)="cambiarCatalogo($event)"
              />
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 sm:gap-6">
              <!-- Fórmula -->
              <div>
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-sm font-medium" for="rule-formula">Fórmula</label>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-medium text-muted-foreground">Funciones:</span>
                    <sk-dropdown
                      class="w-[130px]"
                      label="Insertar función"
                      [options]="funcionOptions"
                      [ngModel]="''"
                      (ngModelChange)="insertarFuncion($event)"
                    />
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
                <div class="mt-2 flex flex-wrap gap-1">
                  @for (op of operadores; track op.symbol) {
                    <sk-button
                      variant="secondary"
                      type="button"
                      [label]="op.label"
                      (clicked)="insertarTexto(op.symbol)"
                    />
                  }
                </div>
              </div>

              <!-- Campos insertables -->
              <div>
                <label class="text-sm font-medium">Haz clic para insertar campos</label>
                <div class="mt-1 space-y-2">
                  <sk-input
                    placeholder="Escribe para buscar"
                    iconLeft="search"
                    [(ngModel)]="busquedaCampo"
                    (ngModelChange)="busquedaCampoSig.set($event)"
                  />
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
                <sk-button
                  variant="secondary"
                  type="button"
                  iconOnly
                  icon="plus"
                  ariaLabel="Agregar condición"
                  (clicked)="agregarCondicion()"
                />
              </div>

              <div class="space-y-3">
                @for (c of condiciones(); track c.id; let i = $index) {
                  <div
                    class="relative flex flex-col items-start gap-2 rounded-xl border border-border bg-muted/10 p-4 sm:grid sm:grid-cols-12 sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
                  >
                    <div
                      class="hidden text-center text-sm font-medium text-muted-foreground sm:col-span-1 sm:block"
                    >
                      {{ i === 0 ? 'Si' : 'y' }}
                    </div>
                    <div
                      class="text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:hidden"
                    >
                      {{ i === 0 ? 'Si' : 'y' }}
                    </div>

                    <div class="w-full sm:col-span-3">
                      <sk-dropdown
                        [disabled]="!catalogo()"
                        [label]="catalogo() ? 'Campo' : 'Primero selecciona catálogo'"
                        [options]="campoOptions()"
                        [ngModel]="c.field"
                        (ngModelChange)="cambiarCondicion(c.id, 'field', $event)"
                      />
                    </div>

                    <div class="w-full sm:col-span-2">
                      <sk-dropdown
                        [disabled]="!c.field"
                        label="Condición"
                        [options]="condicionOptions(c.fieldType)"
                        [ngModel]="c.condition"
                        (ngModelChange)="cambiarCondicion(c.id, 'condition', $event)"
                      />
                    </div>

                    <div class="w-full sm:col-span-2">
                      <sk-dropdown
                        label="Tipo de valor"
                        [options]="valueTypeOptions"
                        [ngModel]="c.valueType"
                        (ngModelChange)="cambiarCondicion(c.id, 'valueType', $event)"
                      />
                    </div>

                    <div class="relative w-full sm:col-span-3">
                      <sk-button
                        variant="secondary"
                        type="button"
                        class="w-full"
                        [class.text-muted-foreground]="!c.value"
                        [label]="c.value || 'Valor'"
                        (clicked)="alternarValores(c, $event)"
                      />

                      @if (valoresAbiertos() === c.id) {
                        <div
                          #panel
                          almaPortal
                          class="surface-solid fixed z-[120] min-w-[240px] rounded-lg border border-border p-1 text-left text-sm normal-case tracking-normal text-foreground shadow-[var(--shadow-lg)]"
                        >
                          <sk-input
                            class="mb-1"
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
                        class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive"
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
            </p-tabpanel>

            <!-- Vista previa -->
            <p-tabpanel value="preview">
              <div class="mt-4 py-8 text-center">
                <p class="mb-2 text-sm text-muted-foreground">
                  Las siguientes 10 comisiones principales mostradas son solo una vista previa
                  del total que tu regla podría generar.
                </p>
                <p class="font-medium">Vista previa no disponible.</p>
              </div>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>

        <div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <sk-button
            variant="secondary"
            type="button"
            class="w-full sm:w-auto"
            label="Cancelar"
            [disabled]="guardando()"
            (clicked)="cancelar()"
          />
          <sk-button
            variant="primary"
            type="button"
            class="w-full sm:w-auto"
            [label]="textoGuardar()"
            [disabled]="guardando()"
            (clicked)="guardar()"
          />
        </div>
      </div>
    </div>
  `,
})
export class RuleDialogComponent implements OnInit {
  readonly mode = input<'create' | 'edit'>('create');
  readonly planId = input.required<string>();
  readonly rule = input<CommissionRule | null>(null);
  readonly closed = output<void>();
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

  protected nombre = '';
  protected descripcion = '';
  protected formula = '';
  protected readonly catalogo = signal('');

  protected busquedaCampo = '';
  protected readonly busquedaCampoSig = signal('');
  protected valorLibre = '';
  protected readonly valoresAbiertos = signal<string | null>(null);

  protected readonly condiciones = signal<ConditionRow[]>([]);
  private secuencia = 0;

  protected readonly esEdicion = computed(() => this.mode() === 'edit');

  protected readonly campos = computed(() => this.catalogos.camposDe(this.catalogo()));

  protected readonly camposFiltrados = computed(() => {
    const q = this.busquedaCampoSig().trim().toLowerCase();
    const lista = this.campos();
    return q ? lista.filter((f) => f.field_name.toLowerCase().includes(q)) : lista;
  });

  /** Opciones sk-dropdown para el selector de catálogo. */
  protected readonly catalogoOptions = computed(() =>
    this.catalogos.activos().map((c) => ({ label: c.name, value: c.id })),
  );

  /** Opciones sk-dropdown para el selector de campo de cada condición. */
  protected readonly campoOptions = computed(() =>
    this.campos().map((f) => ({ label: f.display_name || f.field_name, value: f.field_name })),
  );

  /** Opciones sk-dropdown estáticas del selector "tipo de valor" de cada condición. */
  protected readonly valueTypeOptions: { label: string; value: string }[] = [
    { label: 'Columna', value: 'column' },
    { label: 'Texto', value: 'text' },
  ];

  /** Opciones sk-dropdown del selector "insertar función" de la fórmula. */
  protected readonly funcionOptions = FORMULA_FUNCTIONS.map((f) => ({
    label: `${f}()`,
    value: f,
  }));

  protected readonly textoGuardar = computed(() => {
    if (this.guardando()) return this.esEdicion() ? 'Actualizando…' : 'Creando…';
    return this.esEdicion() ? 'Actualizar Regla' : 'Guardar';
  });

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

  /** Opciones sk-dropdown del selector de operador de cada condición. */
  protected condicionOptions(fieldType?: string): { label: string; value: string }[] {
    return this.opcionesCondicion(fieldType).map((o) => ({ label: o, value: o }));
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
      this.toast.errorGenerico('delete', e instanceof Error ? e.message : String(e));
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

  /** POST la primera vez (id temporal) y PUT en adelante. */
  private async sincronizar(fila: ConditionRow): Promise<void> {
    const ruleId = this.rule()?.id;
    if (!ruleId) return;
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
      this.toast.errorGenericoConMensaje(
        'La condición se actualizó en pantalla pero no se pudo guardar en el servidor.',
        'Advertencia',
      );
    }
  }

  // ── Guardar ───────────────────────────────────────────────────────────────

  protected async guardar(): Promise<void> {
    if (!this.nombre || !this.formula || !this.catalogo()) {
      this.toast.errorGenericoConMensaje(
        'Por favor completa todos los campos requeridos (Nombre, Fórmula, Catálogo).',
        'Error de validación',
      );
      this.tab.set(!this.nombre ? 'information' : 'rule');
      return;
    }

    this.guardando.set(true);
    try {
      const payload = {
        name: this.nombre,
        description: this.descripcion,
        formula: this.formula,
        catalog: this.catalogo(),
        is_active: true,
      };

      if (this.esEdicion()) {
        const ruleId = this.rule()?.id;
        if (!ruleId) return;
        await this.api.update(ruleId, payload);
        this.toast.ok('Regla actualizada', `La regla "${this.nombre}" se actualizó.`);
      } else {
        const creada = await this.api.create(this.planId(), payload);
        // Las condiciones necesitan el id de la regla: van después, en tanda.
        const completas = this.condiciones().filter(
          (c) => c.field && c.condition && c.value,
        );
        if (completas.length > 0) {
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
        }
        this.toast.ok(
          'Regla creada',
          `La regla "${this.nombre}" se creó con ${completas.length} condición(es).`,
        );
      }
      this.saved.emit();
      this.closed.emit();
    } catch (e) {
      this.toast.errorMutacion(e, this.esEdicion() ? 'update' : 'create');
    } finally {
      this.guardando.set(false);
    }
  }

  protected cancelar(): void {
    if (this.guardando()) return;
    this.closed.emit();
  }
}
