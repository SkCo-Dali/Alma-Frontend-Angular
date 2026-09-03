// Combobox de un solo campo: se escribe en el input, se filtran las opciones
// y se puede elegir de la lista. El valor es el texto (permite completar una
// opción o dejar un valor escrito).

import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PortalDirective } from '../../../shared/portal.directive';

export interface ParamComboboxOption {
  label: string;
  value: string;
}

const MAX_VISIBLES = 80;

@Component({
  selector: 'alma-param-combobox',
  imports: [FormsModule, LucideAngularModule, PortalDirective],
  template: `
    <div class="relative">
      <input
        #inputEl
        class="alma-input cursor-text pr-9"
        [id]="inputId()"
        [disabled]="disabled()"
        [placeholder]="placeholder()"
        autocomplete="off"
        [ngModel]="value()"
        (ngModelChange)="escribir($event)"
        (focus)="abrir()"
        (keydown.escape)="cerrar()"
        (keydown.arrowDown)="abrir(); $event.preventDefault()"
      />
      <button
        type="button"
        tabindex="-1"
        class="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed"
        [disabled]="disabled()"
        (mousedown)="$event.preventDefault(); toggle()"
        [attr.aria-label]="'Abrir opciones'"
      >
        <lucide-icon name="chevron-down" [size]="16" />
      </button>
    </div>

    @if (abierto()) {
      <div
        #panel
        almaPortal
        class="surface-solid fixed z-[125] overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-lg)]"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        [style.width.px]="pos().width"
      >
        <div class="max-h-60 overflow-y-auto p-1.5">
          @if (visibles().length === 0) {
            <p class="px-3 py-3 text-center text-xs text-muted-foreground">
              Sin coincidencias. Puedes dejar el texto escrito.
            </p>
          }
          @for (o of visibles(); track o.value) {
            <button
              type="button"
              (mousedown)="elegir(o); $event.preventDefault()"
              class="flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              [class.bg-muted]="o.value === value()"
              [class.font-medium]="o.value === value()"
            >
              {{ o.label }}
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class ParamComboboxComponent {
  readonly inputId = input('');
  readonly value = input('');
  readonly opciones = input<ParamComboboxOption[]>([]);
  readonly disabled = input(false);
  readonly placeholder = input('Seleccionar o escribir…');
  readonly valueChange = output<string>();

  private readonly host = inject(ElementRef<HTMLElement>);
  @ViewChild('inputEl') private inputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;

  protected readonly abierto = signal(false);
  protected readonly pos = signal({ top: 0, left: 0, width: 240 });
  /** Independiente del valor: al abrir la lista se muestran todas las opciones. */
  private readonly filtro = signal('');

  protected readonly visibles = computed(() => {
    const q = this.filtro().trim().toLowerCase();
    const todas = this.opciones();
    const filtradas = q
      ? todas.filter(
          (o) =>
            o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
        )
      : todas;
    return filtradas.slice(0, MAX_VISIBLES);
  });

  @HostListener('document:mousedown', ['$event'])
  protected clickFuera(ev: MouseEvent): void {
    if (!this.abierto()) return;
    const t = ev.target as Node;
    if (this.host.nativeElement.contains(t)) return;
    if (this.panel?.nativeElement.contains(t)) return;
    this.cerrar();
  }

  protected escribir(texto: string): void {
    this.filtro.set(texto);
    this.valueChange.emit(texto);
    if (!this.abierto()) this.abrir();
  }

  protected toggle(): void {
    if (this.abierto()) this.cerrar();
    else {
      this.filtro.set('');
      this.abrir();
    }
  }

  protected abrir(): void {
    if (this.disabled()) return;
    const el = this.inputEl?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.pos.set({
      top: Math.min(r.bottom + 4, window.innerHeight - 240),
      left: r.left,
      width: Math.max(r.width, 200),
    });
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.filtro.set('');
  }

  protected elegir(o: ParamComboboxOption): void {
    this.valueChange.emit(o.value);
    this.cerrar();
  }
}
