// Desplegable de valores de la reportería, con el lenguaje del filtro discreto
// de Cotizaciones: buscador, opciones con su conteo y pie Limpiar/Cancelar/
// Aplicar. A diferencia del de la bandeja, la selección es de un solo valor
// —así filtra el backend— y los conteos llegan ya calculados, sin distincts.

import { Component, ElementRef, ViewChild, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { colocarPanel } from '../../../shared/popover-position';
import { PortalDirective } from '../../../shared/portal.directive';

export interface OpcionFiltro {
  valor: string;
  total: number;
}

@Component({
  selector: 'alma-filtro-valores',
  imports: [FormsModule, LucideAngularModule, PortalDirective],
  template: `
    <button
      #boton
      type="button"
      (click)="alternar($event)"
      class="glass flex h-9 max-w-[260px] items-center gap-1.5 rounded-xl px-3 text-sm transition-colors hover:text-primary"
      [class]="seleccion() ? 'text-foreground' : 'text-muted-foreground'"
      [title]="etiqueta() + ': ' + (seleccion() || todosLabel())"
    >
      @if (icono(); as ic) {
        <lucide-icon [name]="ic" [size]="15" [class.text-primary]="!!seleccion()" />
      }
      <span class="shrink-0">{{ etiqueta() }}</span>
      <span class="min-w-0 truncate" [class.font-medium]="!!seleccion()">
        {{ seleccion() || todosLabel() }}
      </span>
      <lucide-icon name="chevron-down" [size]="14" class="shrink-0" />
    </button>

    @if (abierto()) {
      <div almaPortal class="fixed inset-0 z-[90]" (click)="cerrar()"></div>
      <div
        #panel
        almaPortal
        class="surface-solid fixed z-[95] w-72 rounded-lg border border-border p-3 text-left text-sm text-foreground shadow-[var(--shadow-lg)]"
        (click)="$event.stopPropagation()"
      >
        @if (opciones().length > 8) {
          <div class="mb-2 flex h-8 items-center gap-2 rounded-lg border border-border px-2.5">
            <lucide-icon name="search" [size]="14" class="shrink-0 text-muted-foreground" />
            <input
              [ngModel]="busqueda()"
              (ngModelChange)="busqueda.set($event)"
              type="search"
              placeholder="Buscar valores…"
              class="h-full w-full border-none bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
        }

        <div class="max-h-64 space-y-0.5 overflow-y-auto">
          <button
            type="button"
            (click)="elegir('')"
            class="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs transition-colors hover:bg-accent"
          >
            <span class="shrink-0" [class]="marca(!borrador())"></span>
            <span class="min-w-0 flex-1 truncate font-medium">{{ todosLabel() }}</span>
          </button>

          @for (o of visibles(); track o.valor) {
            <button
              type="button"
              (click)="elegir(o.valor)"
              class="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs transition-colors hover:bg-accent"
            >
              <span class="shrink-0" [class]="marca(borrador() === o.valor)"></span>
              <span class="min-w-0 flex-1 truncate" [title]="o.valor">{{ o.valor }}</span>
              <span class="shrink-0 tabular-nums text-muted-foreground">({{ o.total }})</span>
            </button>
          } @empty {
            <p class="py-4 text-center text-xs text-muted-foreground">Sin coincidencias</p>
          }
        </div>

        <div class="mt-3 flex justify-between border-t border-border/60 pt-3">
          <button
            type="button"
            (click)="limpiar()"
            class="alma-btn alma-btn-outline h-8 rounded-lg text-xs text-muted-foreground"
          >
            Limpiar
          </button>
          <div class="flex gap-2">
            <button
              type="button"
              (click)="cerrar()"
              class="alma-btn alma-btn-outline h-8 rounded-lg text-xs text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="aplicar()"
              class="alma-btn alma-btn-primary h-8 rounded-lg text-xs"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class FiltroValoresComponent {
  readonly etiqueta = input.required<string>();
  readonly opciones = input<OpcionFiltro[]>([]);
  /** Valor aplicado; vacío = sin filtro. */
  readonly seleccion = input<string>('');
  readonly todosLabel = input('Todos');
  readonly icono = input<string | null>(null);

  readonly seleccionar = output<string>();

  @ViewChild('boton') private boton!: ElementRef<HTMLButtonElement>;
  @ViewChild('panel') set panelRef(el: ElementRef<HTMLElement> | undefined) {
    if (el && this.anchor) colocarPanel(el.nativeElement, this.anchor);
  }

  protected readonly abierto = signal(false);
  /** Selección tentativa: no se aplica hasta darle Aplicar (como en la bandeja). */
  protected readonly borrador = signal('');
  protected readonly busqueda = signal('');
  private anchor: DOMRect | null = null;

  constructor() {
    // Si el valor aplicado cambia desde fuera (p. ej. al hacer clic en una barra
    // del panel de resultados), el borrador tiene que seguirlo.
    effect(() => this.borrador.set(this.seleccion()));
  }

  protected readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const todas = this.opciones();
    return q ? todas.filter((o) => o.valor.toLowerCase().includes(q)) : todas;
  });

  /** Círculo de selección, igual que el de los filtros de la bandeja. */
  protected marca(activo: boolean): string {
    return activo
      ? 'h-3.5 w-3.5 rounded-full border-[4px] border-primary'
      : 'h-3.5 w-3.5 rounded-full border border-muted-foreground/50';
  }

  protected alternar(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    this.borrador.set(this.seleccion());
    this.busqueda.set('');
    this.anchor = this.boton.nativeElement.getBoundingClientRect();
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected elegir(v: string): void {
    this.borrador.set(v);
  }

  protected aplicar(): void {
    this.seleccionar.emit(this.borrador());
    this.cerrar();
  }

  protected limpiar(): void {
    this.borrador.set('');
    this.seleccionar.emit('');
    this.cerrar();
  }
}
