// Filtro de columnas de fecha en cascada (año → mes → día). Emite la lista de fechas
// concretas en dd/MM/yyyy que cumplen la selección, porque el filtrado compara contra el
// texto que muestra la tabla.

import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent, SkDropdownComponent } from '@skandia/ui';
import { PortalDirective } from '../../../shared/portal.directive';
import { colocarPanel } from '../../../shared/popover-position';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const TODOS = 'all';

function fmt(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

@Component({
  selector: 'alma-date-column-filter',
  imports: [FormsModule, LucideAngularModule, SkButtonComponent, SkDropdownComponent, PortalDirective],
  template: `
    <button
      #boton
      type="button"
      (click)="abrir($event)"
      class="flex h-8 w-8 items-center justify-center rounded p-0 transition-colors hover:bg-accent"
      [class]="tieneFiltros() ? 'text-primary' : 'text-muted-foreground/60'"
      [title]="'Filtrar por ' + label()"
    >
      <lucide-icon name="filter" [size]="12" />
    </button>

    @if (abierto()) {
      <div almaPortal class="fixed inset-0 z-[90]" (click)="abierto.set(false)"></div>
      <div
        #panel
        almaPortal
        class="surface-solid fixed z-[95] w-80 overflow-hidden rounded-xl border border-border p-4 text-left text-sm normal-case tracking-normal text-foreground shadow-[var(--shadow-lg)]"
        (click)="$event.stopPropagation()"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-bold">Filtrar por {{ label() }}</h3>
          @if (tieneFiltros()) {
            <span
              class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              Activo
            </span>
          }
        </div>

        <div class="min-h-[220px] space-y-4">
          <div class="space-y-1.5">
            <sk-dropdown
              label="Año"
              [options]="anioOpciones()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="anio()"
              (ngModelChange)="cambiarAnio($event)"
            />
          </div>

          <div class="space-y-1.5">
            <sk-dropdown
              label="Mes"
              [disabled]="anio() === TODOS"
              [options]="mesOpciones()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="mes()"
              (ngModelChange)="cambiarMes($event)"
            />
          </div>

          <div class="space-y-1.5">
            <sk-dropdown
              label="Día"
              [disabled]="mes() === TODOS"
              [options]="diaOpciones()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="dia()"
              (ngModelChange)="dia.set($event)"
            />
          </div>

          @if (anio() === TODOS) {
            <p class="pt-2 text-center text-[11px] italic text-muted-foreground">
              Selecciona un año para ver meses y días disponibles
            </p>
          }
        </div>

        <div class="mt-6 flex justify-between border-t border-border pt-4">
          <sk-button
            type="button"
            variant="secondary"
            size="small"
            label="Limpiar"
            (clicked)="limpiar()"
          />
          <div class="flex gap-2">
            <sk-button
              type="button"
              variant="secondary"
              size="small"
              label="Cancelar"
              (clicked)="abierto.set(false)"
            />
            <sk-button
              type="button"
              variant="primary"
              size="small"
              label="Aplicar"
              (clicked)="aplicar()"
            />
          </div>
        </div>
      </div>
    }
  `,
})
export class DateColumnFilterComponent {
  readonly column = input.required<string>();
  readonly label = input.required<string>();
  /** Fechas crudas (ISO) del conjunto sobre el que se filtra. */
  readonly fechas = input.required<(string | undefined)[]>();
  readonly currentFilters = input.required<string[]>();
  readonly filterChange = output<{ column: string; values: string[] }>();

  @ViewChild('boton') private boton!: ElementRef<HTMLButtonElement>;

  /** Al aparecer el panel (ya en <body>) se coloca con su medida real. */
  @ViewChild('panel') set panelRef(el: ElementRef<HTMLElement> | undefined) {
    if (el && this.anchor) colocarPanel(el.nativeElement, this.anchor);
  }

  private anchor: DOMRect | null = null;

  protected readonly TODOS = TODOS;
  protected readonly abierto = signal(false);
  protected readonly anio = signal(TODOS);
  protected readonly mes = signal(TODOS);
  protected readonly dia = signal(TODOS);

  protected readonly tieneFiltros = computed(() => this.currentFilters().length > 0);

  private readonly disponibles = computed(() =>
    this.fechas()
      .filter((v): v is string => Boolean(v))
      .map((v) => new Date(v))
      .filter((d) => !Number.isNaN(d.getTime())),
  );

  protected readonly anios = computed(() =>
    Array.from(new Set(this.disponibles().map((d) => String(d.getFullYear())))).sort(
      (a, b) => b.localeCompare(a),
    ),
  );

  protected readonly meses = computed(() => {
    if (this.anio() === TODOS) return [];
    const m = this.disponibles()
      .filter((d) => String(d.getFullYear()) === this.anio())
      .map((d) => String(d.getMonth() + 1));
    return Array.from(new Set(m)).sort((a, b) => Number(a) - Number(b));
  });

  protected readonly dias = computed(() => {
    if (this.anio() === TODOS || this.mes() === TODOS) return [];
    const d = this.disponibles()
      .filter(
        (f) =>
          String(f.getFullYear()) === this.anio() &&
          String(f.getMonth() + 1) === this.mes(),
      )
      .map((f) => String(f.getDate()));
    return Array.from(new Set(d)).sort((a, b) => Number(a) - Number(b));
  });

  /** Opciones {label, value} para los sk-dropdown de año/mes/día. */
  protected readonly anioOpciones = computed(() => [
    { label: 'Todos los años', value: TODOS },
    ...this.anios().map((a) => ({ label: a, value: a })),
  ]);

  protected readonly mesOpciones = computed(() => [
    { label: 'Todos los meses', value: TODOS },
    ...this.meses().map((m) => ({ label: this.nombreMes(m), value: m })),
  ]);

  protected readonly diaOpciones = computed(() => [
    { label: 'Todos los días', value: TODOS },
    ...this.dias().map((d) => ({ label: d, value: d })),
  ]);

  constructor() {
    // Al abrirse, la cascada refleja lo que ya está filtrado.
    effect(() => {
      if (!this.abierto()) return;
      const filtros = this.currentFilters();
      if (filtros.length === 0) {
        this.anio.set(TODOS);
        this.mes.set(TODOS);
        this.dia.set(TODOS);
        return;
      }
      const partes = filtros
        .map((f) => f.split('/'))
        .filter((p) => p.length === 3);
      if (partes.length === 0) return;
      const anios = new Set(partes.map((p) => p[2]));
      if (anios.size === 1) {
        this.anio.set(partes[0][2]);
        const meses = new Set(partes.map((p) => String(Number(p[1]))));
        if (meses.size === 1) {
          this.mes.set(String(Number(partes[0][1])));
          if (partes.length === 1) this.dia.set(String(Number(partes[0][0])));
          else this.dia.set(TODOS);
        } else {
          this.mes.set(TODOS);
          this.dia.set(TODOS);
        }
      }
    });
  }

  protected nombreMes(m: string): string {
    return MESES[Number(m) - 1] ?? m;
  }

  protected abrir(ev: MouseEvent): void {
    ev.stopPropagation();
    this.anchor = this.boton.nativeElement.getBoundingClientRect();
    this.abierto.set(true);
  }

  protected cambiarAnio(v: string): void {
    this.anio.set(v);
    this.mes.set(TODOS);
    this.dia.set(TODOS);
  }

  protected cambiarMes(v: string): void {
    this.mes.set(v);
    this.dia.set(TODOS);
  }

  protected aplicar(): void {
    let valores: string[] = [];
    if (this.anio() !== TODOS) {
      let filtradas = this.disponibles().filter(
        (d) => String(d.getFullYear()) === this.anio(),
      );
      if (this.mes() !== TODOS) {
        filtradas = filtradas.filter((d) => String(d.getMonth() + 1) === this.mes());
        if (this.dia() !== TODOS) {
          filtradas = filtradas.filter((d) => String(d.getDate()) === this.dia());
        }
      }
      valores = Array.from(new Set(filtradas.map(fmt)));
    }
    this.filterChange.emit({ column: this.column(), values: valores });
    this.abierto.set(false);
  }

  protected limpiar(): void {
    this.anio.set(TODOS);
    this.mes.set(TODOS);
    this.dia.set(TODOS);
    this.filterChange.emit({ column: this.column(), values: [] });
    this.abierto.set(false);
  }
}
