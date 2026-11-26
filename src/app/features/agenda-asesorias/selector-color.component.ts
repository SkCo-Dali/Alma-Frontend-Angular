// Selector del color de un tipo de cita: la paleta Skandia como sugerencia (validada para
// daltonismo en fondo claro y oscuro) y, si se quiere, cualquier color con el selector del
// sistema (RGB, HSL o hexadecimal) o escribiendo el hexadecimal.

import { Component, computed, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PALETA_TIPOS } from './agenda.api';

@Component({
  selector: 'alma-selector-color',
  imports: [LucideAngularModule],
  template: `
    <div class="flex flex-wrap items-center gap-1.5" role="radiogroup" [attr.aria-label]="etiqueta()">
      @for (c of paleta; track c.valor) {
        <button type="button" role="radio" class="flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow"
                [style.background]="c.valor" [title]="c.nombre + ' · ' + c.valor" [attr.aria-label]="c.nombre" [attr.aria-checked]="actual() === c.valor"
                [class.ring-2]="actual() === c.valor" [class.ring-foreground]="actual() === c.valor" (click)="elegir(c.valor)">
          @if (actual() === c.valor) { <lucide-icon name="check" [size]="14" class="text-white" /> }
        </button>
      }
      <!-- Color libre: el selector del sistema permite RGB, HSL o hexadecimal -->
      <label class="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background"
             [class.ring-2]="libre()" [class.ring-foreground]="libre()"
             [style.background]="libre() ? actual() : 'conic-gradient(#e03430, #ffae08, #8fe000, #00c73d, #52ffd9, #1f6feb, #8a4fd6, #bc6995, #e03430)'"
             title="Otro color (RGB o hexadecimal)">
        <input type="color" class="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Otro color" [value]="actual()"
               (input)="elegir($any($event.target).value)" />
        @if (libre()) { <lucide-icon name="check" [size]="14" [class]="claro() ? 'text-[#232323]' : 'text-white'" /> }
        @else { <lucide-icon name="plus" [size]="13" class="text-white drop-shadow" /> }
      </label>
      <input class="alma-input h-7 w-24 font-mono text-[11px] uppercase" maxlength="7" aria-label="Color en hexadecimal" placeholder="#RRGGBB"
             [value]="texto()" (input)="escribir($any($event.target).value)" (blur)="texto.set(actual())" />
    </div>
    @if (libre()) {
      <p class="mt-1 text-[11px] text-muted-foreground">Color personalizado: no está en la paleta Skandia ni validado para daltonismo; en el sitio siempre va junto al nombre del tipo.</p>
    }
  `,
})
export class SelectorColorComponent {
  readonly color = input.required<string>();
  readonly etiqueta = input('Color');
  readonly cambio = output<string>();

  protected readonly paleta = PALETA_TIPOS;
  protected readonly actual = computed(() => (this.color() || '').toLowerCase());
  protected readonly libre = computed(() => !!this.actual() && !PALETA_TIPOS.some((c) => c.valor === this.actual()));
  /** Lo que muestra el campo de texto mientras se escribe (puede estar incompleto). */
  protected readonly texto = signal('');

  constructor() {
    // El campo de texto arranca con el color actual.
    queueMicrotask(() => this.texto.set(this.actual()));
  }

  /** ¿Color claro? (para que el chulo se vea encima). */
  protected readonly claro = computed(() => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(this.actual());
    if (!m) return false;
    const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16));
    return 0.299 * r + 0.587 * g + 0.114 * b > 170;
  });

  protected elegir(valor: string): void {
    const v = valor.toLowerCase();
    this.texto.set(v);
    this.cambio.emit(v);
  }

  protected escribir(valor: string): void {
    let v = valor.trim().toLowerCase();
    if (v && !v.startsWith('#')) v = `#${v}`;
    this.texto.set(v);
    if (/^#[0-9a-f]{6}$/.test(v)) this.cambio.emit(v);
    else if (/^#[0-9a-f]{3}$/.test(v)) this.cambio.emit(`#${[...v.slice(1)].map((c) => c + c).join('')}`);
  }
}
