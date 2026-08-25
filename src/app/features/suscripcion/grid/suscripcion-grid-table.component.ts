// Tabla del grid de la bandeja de Suscripción. tsx:
// - Drag horizontal de encabezados regulares (handle GripVertical); dnd-kit se
//   reemplaza por HTML5 drag & drop nativo.
// - Columnas sticky NroCotizacion y Asegurado con `left` calculado en JS según
//   los anchos actuales.
// - Resize por arrastre del borde derecho con clamp min/max del catálogo,
//   auto-fit estilo Excel con doble clic y auto-fit inicial de columnas
//   marcadas ui.autoFit (una vez por sesión de montaje).
// - Ancho total de la tabla SUMADO en JS (table-fixed + border-separate).
// - Header sticky top-0 dentro del scroll wrapper (CSS en styles.css).

import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TooltipDirective } from '../../../shared/tooltip.directive';
import {
  DECISION_BADGE,
  UW_BADGE,
  VEREDICTO_PILL,
  fmtCOP,
  fmtFecha,
} from '../suscripcion.domain';
import {
  ColumnConfig,
  DistinctBaseRequest,
  GridColumnDefinition,
  GridColumnsResponse,
  GridFilter,
  SuscripcionGridItem,
  SuscripcionRowMeta,
} from './suscripcion-grid.api';
import { ColumnHeaderMenuComponent } from './column-header-menu.component';
import { RangeOp } from './range-filter.component';

/** Columnas fijas (sticky) en este orden. No arrastrables, siempre visibles. */
const STICKY_COLUMNS = ['NroCotizacion', 'Asegurado'];
const DEFAULT_COL_WIDTH = 140;
const FALLBACK_MIN_COL_WIDTH = 80;
const FALLBACK_MAX_COL_WIDTH = 600;
const PADDING_BUFFER = 24;

interface CeldaRender {
  tipo: 'texto' | 'pill' | 'vacio';
  texto: string;
  cls?: string;
  icon?: string;
  mono?: boolean;
  bold?: boolean;
  nowrap?: boolean;
}

@Component({
  selector: 'alma-suscripcion-grid-table',
  imports: [NgTemplateOutlet, LucideAngularModule, ColumnHeaderMenuComponent,
    TooltipDirective,
  ],
  template: `
    <div class="leads-table-container-scroll relative w-full">
      <!-- Altura: crece hasta ~25 filas (tope 800px) en pantallas altas, con
           scroll interno para el resto; en pantallas bajas manda el
           viewport-calc, que reserva el encabezado del portal + el toolbar en UNA
           fila [búsqueda · filtro por etapa · Columnas] + la paginación + un
           colchón inferior de aire. Bajó 500→415 (al quitar la banda del Dock),
           415→355 (al fusionar journey y toolbar en una fila) y 355→340 (al
           reducir el header h-24→h-20). Solo scrollea la tabla, nunca el <main>. -->
      <div
        class="leads-table-scroll-wrapper w-full"
        [class.susc-scrolled-x]="scrolledX()"
        (scroll)="onHScroll($event)"
        style="height: min(calc(100dvh - 340px), 800px); min-height: 320px"
      >
        <div class="leads-table-inner-scroll">
          <table
            class="w-full table-fixed border-separate border-spacing-0"
            [style.width.px]="tableWidth()"
            [style.minWidth.px]="tableWidth()"
            style="font-variant-numeric: tabular-nums"
          >
            <thead class="susc-grid-header-sticky">
              <tr>
                <!-- Columnas fijas — no arrastrables -->
                @for (col of stickyCols(); track col.key; let ci = $index) {
                  <th
                    [attr.data-col-key]="col.key"
                    class="susc-header-cell relative h-auto select-none px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65"
                    [class]="ci === 0 ? 'susc-col1-sticky' : 'susc-col2-sticky'"
                    [style.width.px]="ancho(col.key)"
                    [style.minWidth.px]="ancho(col.key)"
                    [style.maxWidth.px]="ancho(col.key)"
                    [style.left.px]="stickyLeft(ci)"
                  >
                    <div class="flex w-full min-w-0 items-center gap-1">
                      <span class="min-w-0 flex-1 truncate">{{ col.label }}</span>
                      <alma-column-header-menu
                        [field]="col.key"
                        [label]="col.label"
                        [def]="allColumnDefs()[col.key]"
                        [sortField]="sortField()"
                        [sortDir]="sortDir()"
                        [filters]="filters()"
                        [buildDistinctRequest]="buildDistinctRequest()"
                        (sorted)="sorted.emit($event)"
                        (discreteFilterChange)="discreteFilterChange.emit($event)"
                        (textFilterChange)="textFilterChange.emit($event)"
                        (rangeFilterChange)="rangeFilterChange.emit($event)"
                        (dateFilterChange)="dateFilterChange.emit($event)"
                        (clearFilter)="clearFilter.emit($event)"
                      />
                    </div>
                    <div
                      class="absolute -right-[2px] top-0 z-30 h-full w-[5px] cursor-col-resize hover:bg-primary/60"
                      (mousedown)="resizeStart(col.key, $any($event))"
                      (dblclick)="autoFit(col.key, true, $any($event))"
                      (click)="$event.stopPropagation()"
                      title="Doble clic para autoajustar"
                    ></div>
                  </th>
                }

                <!-- Columnas regulares — arrastrables -->
                @for (col of regularCols(); track col.key) {
                  <th
                    [attr.data-col-key]="col.key"
                    class="susc-header-cell relative h-auto select-none px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65"
                    [class.opacity-50]="arrastrando() === col.key"
                    [style.width.px]="ancho(col.key)"
                    [style.minWidth.px]="ancho(col.key)"
                    [style.maxWidth.px]="ancho(col.key)"
                    (dragover)="onDragOver($any($event), col.key)"
                    (drop)="$event.preventDefault()"
                  >
                    <div class="flex w-full min-w-0 items-center gap-1">
                      <span
                        class="flex-shrink-0 cursor-grab rounded p-0.5 hover:bg-accent active:cursor-grabbing"
                        draggable="true"
                        (dragstart)="onDragStart($any($event), col.key)"
                        (dragend)="onDragEnd()"
                        (click)="$event.stopPropagation()"
                      >
                        <lucide-icon
                          name="grip-vertical"
                          [size]="10"
                          class="text-muted-foreground/50"
                        />
                      </span>
                      <span
                        class="min-w-0 flex-1 truncate"
                        [class.cursor-help]="col.tooltip"
                        [class.border-b]="col.tooltip"
                        [class.border-dotted]="col.tooltip"
                        [class.border-muted-foreground/50]="col.tooltip"
                        [almaTooltip]="col.tooltip ?? ''"
                        almaTooltipSide="bottom"
                        almaTooltipMaxWidth="200px"
                      >
                        {{ col.label }}
                      </span>
                      <alma-column-header-menu
                        [field]="col.key"
                        [label]="col.label"
                        [def]="allColumnDefs()[col.key]"
                        [sortField]="sortField()"
                        [sortDir]="sortDir()"
                        [filters]="filters()"
                        [buildDistinctRequest]="buildDistinctRequest()"
                        (sorted)="sorted.emit($event)"
                        (discreteFilterChange)="discreteFilterChange.emit($event)"
                        (textFilterChange)="textFilterChange.emit($event)"
                        (rangeFilterChange)="rangeFilterChange.emit($event)"
                        (dateFilterChange)="dateFilterChange.emit($event)"
                        (clearFilter)="clearFilter.emit($event)"
                      />
                    </div>
                    <div
                      class="absolute -right-[2px] top-0 z-30 h-full w-[5px] cursor-col-resize hover:bg-primary/60"
                      (mousedown)="resizeStart(col.key, $any($event))"
                      (dblclick)="autoFit(col.key, true, $any($event))"
                      (click)="$event.stopPropagation()"
                      title="Doble clic para autoajustar"
                    ></div>
                  </th>
                }
              </tr>
            </thead>

            <tbody>
              @if (isLoading()) {
                @for (fila of skeletons; track fila) {
                  <tr>
                    @for (col of stickyCols(); track col.key; let ci = $index) {
                      <td
                        [attr.data-col-key]="col.key"
                        class="susc-body-cell px-2 py-1.5 text-left text-xs text-foreground"
                        [class]="ci === 0 ? 'susc-col1-sticky' : 'susc-col2-sticky'"
                        [style.width.px]="ancho(col.key)"
                        [style.minWidth.px]="ancho(col.key)"
                        [style.maxWidth.px]="ancho(col.key)"
                        [style.left.px]="stickyLeft(ci)"
                      >
                        <div class="h-4 w-20 animate-pulse rounded bg-muted"></div>
                      </td>
                    }
                    @for (col of regularCols(); track col.key) {
                      <td
                        [attr.data-col-key]="col.key"
                        class="susc-body-cell px-2 py-1.5 text-left text-xs text-foreground"
                        [style.width.px]="ancho(col.key)"
                        [style.minWidth.px]="ancho(col.key)"
                        [style.maxWidth.px]="ancho(col.key)"
                      >
                        <div class="h-4 w-20 animate-pulse rounded bg-muted"></div>
                      </td>
                    }
                  </tr>
                }
              } @else if (data().length === 0) {
                <tr>
                  <td [attr.colspan]="stickyCols().length + regularCols().length" class="p-4">
                    <div
                      class="rounded-xl border-2 border-dashed border-border/50 bg-muted/20 py-12 text-center text-muted-foreground"
                    >
                      <p class="text-sm font-medium text-foreground">Sin cotizaciones aquí</p>
                      <p class="mt-1 text-xs">
                        {{ emptyHint() ?? 'El worker sincroniza cada 5 minutos.' }}
                      </p>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (row of data(); track row.Id) {
                  <tr
                    class="cursor-pointer text-xs leading-tight transition-colors hover:bg-primary/5"
                    (click)="rowClick.emit(row)"
                  >
                    @for (col of stickyCols(); track col.key; let ci = $index) {
                      <td
                        [attr.data-col-key]="col.key"
                        class="susc-body-cell px-2 py-1.5 text-left text-xs text-foreground"
                        [class]="ci === 0 ? 'susc-col1-sticky' : 'susc-col2-sticky'"
                        [style.width.px]="ancho(col.key)"
                        [style.minWidth.px]="ancho(col.key)"
                        [style.maxWidth.px]="ancho(col.key)"
                        [style.left.px]="stickyLeft(ci)"
                      >
                        <div class="w-full min-w-0 truncate">
                          <ng-container
                            *ngTemplateOutlet="celda; context: { c: render(row, col.key) }"
                          />
                        </div>
                      </td>
                    }
                    @for (col of regularCols(); track col.key) {
                      <td
                        [attr.data-col-key]="col.key"
                        class="susc-body-cell px-2 py-1.5 text-xs text-foreground"
                        [class]="alineadoDerecha(col.key) ? 'text-right' : 'text-left'"
                        [style.width.px]="ancho(col.key)"
                        [style.minWidth.px]="ancho(col.key)"
                        [style.maxWidth.px]="ancho(col.key)"
                      >
                        <ng-container
                          *ngTemplateOutlet="celda; context: { c: render(row, col.key) }"
                        />
                      </td>
                    }
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Render de una celda según su forma (texto / pill / vacío) -->
    <ng-template #celda let-c="c">
      @if (c.tipo === 'vacio') {
        <span class="text-muted-foreground">—</span>
      } @else if (c.tipo === 'pill') {
        <span
          class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium"
          [class]="c.cls"
        >
          @if (c.icon) {
            <lucide-icon [name]="c.icon" [size]="12" />
          }
          {{ c.texto }}
        </span>
      } @else {
        <span
          [class.font-mono]="c.mono"
          [class.font-semibold]="c.bold"
          [class.whitespace-nowrap]="c.nowrap"
          [class.tabular-nums]="c.nowrap"
          class="text-xs"
        >
          {{ c.texto }}
        </span>
      }
    </ng-template>
  `,
})
export class SuscripcionGridTableComponent {
  readonly data = input.required<SuscripcionGridItem[]>();
  readonly columns = input.required<ColumnConfig[]>();
  readonly allColumnDefs = input.required<GridColumnsResponse>();
  readonly sortField = input.required<string>();
  readonly sortDir = input.required<'asc' | 'desc'>();
  readonly filters = input.required<GridFilter[]>();
  readonly buildDistinctRequest = input.required<() => DistinctBaseRequest>();
  readonly isLoading = input(false);
  readonly initialColumnWidths = input<Record<string, number>>({});
  readonly emptyHint = input<string | undefined>(undefined);

  readonly sorted = output<{ field: string; dir: 'asc' | 'desc' }>();
  readonly rowClick = output<SuscripcionGridItem>();
  readonly columnsChange = output<ColumnConfig[]>();
  readonly columnWidthsChange = output<Record<string, number>>();
  readonly discreteFilterChange = output<{
    field: string;
    values: (string | number | boolean)[];
  }>();
  readonly textFilterChange = output<{ field: string; op: string; value: string }>();
  readonly rangeFilterChange = output<{
    field: string;
    op: RangeOp | 'clear';
    value?: number;
    value2?: number;
  }>();
  readonly dateFilterChange = output<{ field: string; from?: string; to?: string }>();
  readonly clearFilter = output<string>();

  protected readonly skeletons = Array.from({ length: 10 }, (_, i) => i);

  /** Anchos por columna (redimensionables). */
  private readonly widths = signal<Record<string, number>>({});
  protected readonly arrastrando = signal<string | null>(null);
  /** true cuando la tabla está desplazada en horizontal: activa la sombra del
   *  panel de columnas fijas (señala que hay contenido oculto tras el borde). */
  protected readonly scrolledX = signal(false);
  protected onHScroll(ev: Event): void {
    this.scrolledX.set((ev.target as HTMLElement).scrollLeft > 0);
  }
  private dragKey: string | null = null;
  /** Columnas ya auto-ajustadas (no re-ajustar en cada refetch). */
  private readonly autoFitted = new Set<string>();

  constructor() {
    // Merge de anchos guardados que llegan tarde (sin pisar ediciones locales).
    effect(() => {
      const iniciales = this.initialColumnWidths();
      if (!iniciales) return;
      untracked(() => {
        this.widths.update((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const [k, v] of Object.entries(iniciales)) {
            if (next[k] == null && typeof v === 'number' && v > 0) {
              next[k] = v;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      });
    });

    // Auto-fit inicial: columnas con ui.autoFit y sin ancho guardado, una vez
    // por columna por sesión de montaje (no en cada refetch).
    effect(() => {
      const cargando = this.isLoading();
      const filas = this.data();
      const defs = this.allColumnDefs();
      const visibles = this.visibleCols();
      if (cargando || filas.length === 0 || Object.keys(defs).length === 0) return;
      untracked(() => {
        const pendientes = visibles
          .filter((c) => defs[c.key]?.ui?.autoFit)
          .filter((c) => this.widths()[c.key] == null)
          .filter((c) => !this.autoFitted.has(c.key))
          .map((c) => c.key);
        if (pendientes.length === 0) return;
        requestAnimationFrame(() => {
          for (const key of pendientes) {
            this.autoFitted.add(key);
            this.autoFit(key, false);
          }
        });
      });
    });
  }

  protected readonly visibleCols = computed(() => this.columns().filter((c) => c.visible));

  protected readonly stickyCols = computed(
    () =>
      STICKY_COLUMNS.map((key) => this.visibleCols().find((c) => c.key === key)).filter(
        (c): c is ColumnConfig => Boolean(c),
      ),
  );

  protected readonly regularCols = computed(() =>
    this.visibleCols().filter((c) => !STICKY_COLUMNS.includes(c.key)),
  );

  private minWidth(key: string): number {
    return Math.max(1, this.allColumnDefs()[key]?.ui?.minWidth ?? FALLBACK_MIN_COL_WIDTH);
  }

  private maxWidth(key: string): number {
    return Math.max(
      this.minWidth(key),
      this.allColumnDefs()[key]?.ui?.maxWidth ?? FALLBACK_MAX_COL_WIDTH,
    );
  }

  /** Precedencia del ancho: local/pref guardada → ui.defaultWidth → fallback. */
  protected ancho(key: string): number {
    const guardado = this.widths()[key];
    if (guardado != null) return guardado;
    const base = this.allColumnDefs()[key]?.ui?.defaultWidth ?? DEFAULT_COL_WIDTH;
    return Math.min(this.maxWidth(key), Math.max(this.minWidth(key), base));
  }

  /** Ancho total de la tabla, sumado en JS (table-fixed). */
  protected readonly tableWidth = computed(() => {
    this.widths(); // dependencia explícita
    return (
      this.stickyCols().reduce((s, c) => s + this.ancho(c.key), 0) +
      this.regularCols().reduce((s, c) => s + this.ancho(c.key), 0)
    );
  });

  /** left de cada sticky según los anchos actuales de las sticky previas. */
  protected stickyLeft(index: number): number {
    let left = 0;
    for (let i = 0; i < index; i++) {
      left += this.ancho(this.stickyCols()[i]?.key ?? '');
    }
    return left;
  }

  protected alineadoDerecha(key: string): boolean {
    const t = this.allColumnDefs()[key]?.type;
    return t === 'number' || t === 'currency' || t === 'date';
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  protected resizeStart(field: string, e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = this.ancho(field);
    const min = this.minWidth(field);
    const max = this.maxWidth(field);
    let lastWidth = startWidth;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      lastWidth = Math.min(max, Math.max(min, startWidth + delta));
      this.widths.update((prev) => ({ ...prev, [field]: lastWidth }));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (lastWidth !== startWidth) {
        this.columnWidthsChange.emit({ ...this.widths() });
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  /** Auto-fit estilo Excel: mide el contenido más ancho (header + celdas) con
   *  un medidor off-DOM. persist=true cuando lo dispara el usuario. */
  protected autoFit(field: string, persist = true, ev?: MouseEvent): void {
    ev?.stopPropagation();
    const escaped = field.replace(/"/g, '\\"');
    const cells = document.querySelectorAll<HTMLElement>(`[data-col-key="${escaped}"]`);
    if (cells.length === 0) return;

    const measurer = document.createElement('div');
    measurer.style.cssText = [
      'position:absolute',
      'left:-99999px',
      'top:-99999px',
      'visibility:hidden',
      'white-space:nowrap',
      'display:inline-block',
      'pointer-events:none',
      'padding:0',
      'margin:0',
      'border:0',
    ].join(';');
    document.body.appendChild(measurer);

    let max = 0;
    try {
      cells.forEach((cell) => {
        const cs = window.getComputedStyle(cell);
        // Replica la tipografía para que la medición coincida con la celda.
        measurer.style.fontFamily = cs.fontFamily;
        measurer.style.fontSize = cs.fontSize;
        measurer.style.fontWeight = cs.fontWeight;
        measurer.style.fontStyle = cs.fontStyle;
        measurer.style.letterSpacing = cs.letterSpacing;
        measurer.style.textTransform = cs.textTransform;
        measurer.style.fontVariantNumeric = cs.fontVariantNumeric;
        measurer.innerHTML = cell.innerHTML;
        // Fuerza a los descendientes a no restringir ancho ni envolver.
        measurer.querySelectorAll<HTMLElement>('*').forEach((el) => {
          el.style.maxWidth = 'none';
          el.style.minWidth = '0';
          el.style.width = 'auto';
          el.style.whiteSpace = 'nowrap';
          el.style.overflow = 'visible';
          el.style.textOverflow = 'clip';
        });
        const w = measurer.scrollWidth;
        if (w > max) max = w;
      });
    } finally {
      document.body.removeChild(measurer);
    }

    const nuevo = Math.min(
      this.maxWidth(field),
      Math.max(this.minWidth(field), max + PADDING_BUFFER),
    );
    this.widths.update((prev) => ({ ...prev, [field]: nuevo }));
    if (persist) this.columnWidthsChange.emit({ ...this.widths() });
  }

  // ── Drag de columnas regulares ─────────────────────────────────────────────

  protected onDragStart(ev: DragEvent, key: string): void {
    this.dragKey = key;
    this.arrastrando.set(key);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }

  protected onDragOver(ev: DragEvent, targetKey: string): void {
    ev.preventDefault();
    const from = this.dragKey;
    if (!from || from === targetKey) return;
    const regular = [...this.regularCols()];
    const oldIndex = regular.findIndex((c) => c.key === from);
    const newIndex = regular.findIndex((c) => c.key === targetKey);
    if (oldIndex < 0 || newIndex < 0) return;
    const [moved] = regular.splice(oldIndex, 1);
    regular.splice(newIndex, 0, moved);
    // Conserva las columnas no visibles al final.
    const ocultas = this.columns().filter((c) => !c.visible);
    this.columnsChange.emit([...this.stickyCols(), ...regular, ...ocultas]);
  }

  protected onDragEnd(): void {
    this.dragKey = null;
    this.arrastrando.set(null);
  }

  // ── Renderers de celda (badges y formatos del dominio) ────────────────────

  protected render(row: SuscripcionGridItem, colKey: string): CeldaRender {
    const value = row[colKey];
    const meta = (row.meta ?? {}) as Partial<SuscripcionRowMeta>;
    const vacio: CeldaRender = { tipo: 'vacio', texto: '' };

    switch (colKey) {
      case 'NroCotizacion':
        return {
          tipo: 'texto',
          texto: String(value ?? '—'),
          mono: true,
          nowrap: true,
        };
      case 'Asegurado':
        return { tipo: 'texto', texto: String(value ?? '—'), bold: true };
      case 'Cedula':
        return { tipo: 'texto', texto: String(value ?? '—'), nowrap: true };
      case 'Producto':
        return value
          ? { tipo: 'pill', texto: String(value), cls: 'bg-primary/10 text-primary' }
          : vacio;
      case 'EstadoPipeline':
        return value
          ? {
              tipo: 'pill',
              texto: String(value),
              cls: UW_BADGE[meta.uw_status ?? ''] ?? 'bg-muted text-muted-foreground',
            }
          : vacio;
      case 'Declaraciones': {
        const slug = meta.veredicto_slug ?? null;
        const conf = slug ? VEREDICTO_PILL[slug] : undefined;
        if (!value && !conf)
          return {
            tipo: 'pill',
            texto: 'Sin sincronizar',
            cls: 'bg-muted text-muted-foreground',
          };
        return {
          tipo: 'pill',
          texto: String(value ?? 'Sin diligenciar'),
          cls: conf?.cls ?? 'bg-muted text-muted-foreground',
          icon: conf?.icon ?? 'help-circle',
        };
      }
      case 'Motor':
        return value
          ? {
              tipo: 'pill',
              texto: String(value),
              cls:
                DECISION_BADGE[meta.decision_slug ?? ''] ?? 'bg-muted text-muted-foreground',
            }
          : vacio;
      case 'Suma':
      case 'PrimaMensual': {
        const num = typeof value === 'number' ? value : Number(value);
        if (value === null || value === undefined || isNaN(num)) return vacio;
        return { tipo: 'texto', texto: fmtCOP(num), bold: true, nowrap: true };
      }
      case 'Recibida':
      case 'FechaPharos':
        return { tipo: 'texto', texto: fmtFecha(value), nowrap: true };
      case 'Emitible':
        return value
          ? { tipo: 'pill', texto: 'Hoy', cls: 'bg-primary/10 text-primary', icon: 'send' }
          : vacio;
      default:
        return this.renderPorTipo(value, this.allColumnDefs()[colKey]);
    }
  }

  /** Fallback genérico por tipo (columnas sin renderer dedicado). */
  private renderPorTipo(value: unknown, def?: GridColumnDefinition): CeldaRender {
    if (value === null || value === undefined || value === '')
      return { tipo: 'vacio', texto: '' };
    if (!def) return { tipo: 'texto', texto: String(value) };

    switch (def.type) {
      case 'boolean':
        return value
          ? { tipo: 'pill', texto: 'Sí', cls: 'bg-primary/10 text-primary' }
          : { tipo: 'vacio', texto: '' };
      case 'currency': {
        const num = typeof value === 'number' ? value : Number(value);
        return isNaN(num)
          ? { tipo: 'texto', texto: String(value) }
          : { tipo: 'texto', texto: fmtCOP(num), nowrap: true };
      }
      case 'number': {
        const num = typeof value === 'number' ? value : Number(value);
        return isNaN(num)
          ? { tipo: 'texto', texto: String(value) }
          : { tipo: 'texto', texto: Math.trunc(num).toLocaleString('es-CO'), nowrap: true };
      }
      case 'date':
        return { tipo: 'texto', texto: fmtFecha(value), nowrap: true };
      default:
        return { tipo: 'texto', texto: String(value) };
    }
  }
}
