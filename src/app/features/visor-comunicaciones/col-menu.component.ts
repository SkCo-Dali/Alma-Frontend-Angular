// Menú de encabezado de columna (estilo Cotizaciones): caret que abre un popover
// con ordenar (asc/desc) y, si la columna trae valores, un filtro discreto por
// checkboxes. El popover sale a <body> (almaPortal) para no recortarse dentro del
// panel .glass y se posiciona con colocarPanel.

import { Component, ElementRef, ViewChild, computed, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PortalDirective } from '../../shared/portal.directive';
import { colocarPanel } from '../../shared/popover-position';
import { DateFilterComunicacionesComponent } from './date-filter-comunicaciones.component';

@Component({
  selector: 'alma-col-menu',
  imports: [LucideAngularModule, PortalDirective, DateFilterComunicacionesComponent],
  template: `
    <button
      #boton
      type="button"
      (click)="toggle($event)"
      class="relative inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors"
      [class]="
        activo()
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground'
      "
      title="Ordenar y filtrar"
    >
      <lucide-icon name="chevron-down" [size]="12" [strokeWidth]="2.5" />
      @if (sortActive()) {
        <span
          class="absolute -right-[3px] -top-[3px] inline-flex h-[9px] w-[9px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
        >
          <lucide-icon
            [name]="sortDir() === 'asc' ? 'arrow-up' : 'arrow-down'"
            [size]="7"
            [strokeWidth]="3"
          />
        </span>
      }
    </button>

    @if (abierto()) {
      <div almaPortal class="fixed inset-0 z-[90]" (click)="cerrar()"></div>
      <div
        #panel
        almaPortal
        class="surface-solid fixed z-[95] rounded-lg border border-border p-0 text-left text-sm normal-case tracking-normal text-foreground shadow-[var(--shadow-lg)]"
        [style.width.px]="esFecha() ? 320 : 224"
        (click)="$event.stopPropagation()"
      >
        <div class="py-1.5">
          <button
            type="button"
            (click)="ordenar('asc')"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
            [class.font-medium]="sortActive() && sortDir() === 'asc'"
            [class.text-primary]="sortActive() && sortDir() === 'asc'"
          >
            <lucide-icon name="arrow-up" [size]="14" /> {{ ascLabel() }}
          </button>
          <button
            type="button"
            (click)="ordenar('desc')"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
            [class.font-medium]="sortActive() && sortDir() === 'desc'"
            [class.text-primary]="sortActive() && sortDir() === 'desc'"
          >
            <lucide-icon name="arrow-down" [size]="14" /> {{ descLabel() }}
          </button>
        </div>

        @if (esFecha()) {
          <div class="border-t border-border/60"></div>
          <div class="p-2">
            <alma-date-filter-comunicaciones
              [fechas]="fechas()"
              (aplicado)="onFecha($event)"
              (cerrar)="cerrar()"
            />
          </div>
        } @else if (valores()?.length) {
          <div class="border-t border-border/60"></div>
          @if (filtroActivo()) {
            <button
              type="button"
              (click)="limpiar()"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
            >
              <lucide-icon name="x-circle" [size]="14" /> Quitar filtro
            </button>
            <div class="border-t border-border/60"></div>
          }
          <div class="max-h-56 overflow-auto p-1.5">
            @for (v of valores(); track v) {
              <label
                class="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-accent"
              >
                <input
                  type="checkbox"
                  [checked]="sel().has(v)"
                  (change)="toggleVal(v)"
                  [style.accent-color]="'var(--primary)'"
                  class="h-3.5 w-3.5"
                />
                <span class="min-w-0 flex-1 truncate">{{ v }}</span>
              </label>
            }
          </div>
        }
      </div>
    }
  `,
})
export class ColMenuComponent {
  readonly sortActive = input(false);
  readonly sortDir = input<'asc' | 'desc'>('asc');
  /** Valores distintos para el filtro discreto; null/[] ⇒ solo ordenar. */
  readonly valores = input<string[] | null>(null);
  /** Valores seleccionados (vacío ⇒ sin filtro). */
  readonly seleccion = input<string[]>([]);
  /** Columna de fecha ⇒ el cuerpo del menú es el filtro de fecha (árbol + presets). */
  readonly esFecha = input(false);
  /** Fechas del índice (para el árbol año/mes/día). */
  readonly fechas = input<string[]>([]);
  /** true si hay un rango de fecha aplicado (para marcar el caret activo). */
  readonly fechaActiva = input(false);

  readonly sort = output<'asc' | 'desc'>();
  readonly filtrar = output<string[]>();
  readonly rango = output<{ desde: string | null; hasta: string | null }>();

  @ViewChild('boton') private boton!: ElementRef<HTMLButtonElement>;
  @ViewChild('panel') set panelRef(el: ElementRef<HTMLElement> | undefined) {
    if (el && this.anchor) colocarPanel(el.nativeElement, this.anchor);
  }

  protected readonly abierto = signal(false);
  private anchor: DOMRect | null = null;

  protected readonly sel = computed(() => new Set(this.seleccion()));
  protected readonly filtroActivo = computed(() =>
    this.esFecha() ? this.fechaActiva() : this.seleccion().length > 0,
  );
  protected readonly activo = computed(() => this.sortActive() || this.filtroActivo());

  protected readonly ascLabel = computed(() =>
    this.esFecha() ? 'Ordenar de más antiguo a más reciente' : 'Ascendente',
  );
  protected readonly descLabel = computed(() =>
    this.esFecha() ? 'Ordenar de más reciente a más antiguo' : 'Descendente',
  );

  protected toggle(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    this.anchor = this.boton.nativeElement.getBoundingClientRect();
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected ordenar(dir: 'asc' | 'desc'): void {
    this.sort.emit(dir);
    this.cerrar();
  }

  protected toggleVal(v: string): void {
    const s = new Set(this.seleccion());
    if (s.has(v)) s.delete(v);
    else s.add(v);
    this.filtrar.emit([...s]);
  }

  protected limpiar(): void {
    this.filtrar.emit([]);
    this.cerrar();
  }

  protected onFecha(r: { from: string | null; to: string | null }): void {
    this.rango.emit({ desde: r.from, hasta: r.to });
  }
}
