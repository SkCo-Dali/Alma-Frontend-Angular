// Combobox buscable para los catálogos del simulador (países 229, ocupaciones 150,
// etc.): panel con buscador y lista acotada para mantener el render liviano.

import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

const MAX_VISIBLES = 60;

@Component({
  selector: 'alma-catalogo-combobox',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <button
      #boton
      type="button"
      role="combobox"
      [attr.aria-expanded]="abierto()"
      (click)="toggle()"
      class="alma-btn alma-btn-outline h-9 w-full justify-between rounded-xl px-3 text-sm font-normal"
      [class.text-muted-foreground]="!value()"
    >
      <span class="truncate">{{ value() || placeholder() }}</span>
      <span class="ml-1 flex shrink-0 items-center gap-0.5">
        @if (clearable() && value()) {
          <span
            (click)="limpiar($event)"
            class="text-muted-foreground hover:text-foreground"
          >
            <lucide-icon name="x" [size]="14" />
          </span>
        }
        <lucide-icon name="chevrons-up-down" [size]="14" class="opacity-50" />
      </span>
    </button>

    @if (abierto()) {
      <div class="fixed inset-0 z-[110]" (click)="cerrar()"></div>
      <div
        class="surface-solid fixed z-[115] rounded-xl border border-border p-0 shadow-[var(--shadow-lg)]"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        [style.width.px]="pos().width"
        (click)="$event.stopPropagation()"
      >
        <input
          #filtroInput
          class="h-9 w-full border-b border-border bg-transparent px-3 text-sm outline-none"
          placeholder="Buscar…"
          [(ngModel)]="filtro"
          (ngModelChange)="filtroSig.set($event)"
        />
        <div class="max-h-56 overflow-y-auto p-1">
          @if (visibles().length === 0) {
            <p class="py-4 text-center text-xs text-muted-foreground">Sin coincidencias.</p>
          }
          @for (opcion of visibles(); track opcion) {
            <button
              type="button"
              (click)="elegir(opcion)"
              class="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
            >
              <lucide-icon
                name="check"
                [size]="14"
                class="mr-2"
                [class.opacity-0]="value() !== opcion"
              />
              {{ opcion }}
            </button>
          }
          @if (visibles().length === max) {
            <p class="px-2 py-1.5 text-center text-[10px] text-muted-foreground">
              Hay más resultados: afina la búsqueda.
            </p>
          }
        </div>
      </div>
    }
  `,
})
export class CatalogoComboboxComponent {
  readonly value = input<string | null | undefined>(null);
  readonly opciones = input.required<string[]>();
  readonly placeholder = input('Selecciona…');
  readonly clearable = input(true);
  readonly valueChange = output<string | null>();

  @ViewChild('boton') private boton!: ElementRef<HTMLButtonElement>;

  protected readonly max = MAX_VISIBLES;
  protected readonly abierto = signal(false);
  protected filtro = '';
  protected readonly filtroSig = signal('');
  protected readonly pos = signal({ top: 0, left: 0, width: 240 });

  protected readonly visibles = computed(() => {
    const f = this.filtroSig().trim().toLowerCase();
    const base = f ? this.opciones().filter((o) => o.toLowerCase().includes(f)) : this.opciones();
    return base.slice(0, MAX_VISIBLES);
  });

  protected toggle(): void {
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    const r = this.boton.nativeElement.getBoundingClientRect();
    this.pos.set({
      top: Math.min(r.bottom + 4, window.innerHeight - 280),
      left: r.left,
      width: r.width,
    });
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.filtro = '';
    this.filtroSig.set('');
  }

  protected elegir(opcion: string): void {
    this.valueChange.emit(opcion === this.value() ? null : opcion);
    this.cerrar();
  }

  protected limpiar(ev: MouseEvent): void {
    ev.stopPropagation();
    this.valueChange.emit(null);
  }
}
