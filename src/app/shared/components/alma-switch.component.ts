// Interruptor de Alma. Port EXACTO del Switch de Alma (components/ui/switch.tsx):
// toggle "Liquid Glass" estilo iOS 26 / macOS Tahoe — pista translúcida con
// desenfoque, brillo especular en la mitad superior y pulgar de vidrio con
// reflejo radial. Reemplaza los <input type="checkbox"> que se habían usado
// como toggles durante la migración.

import { Component, input, model } from '@angular/core';

@Component({
  selector: 'alma-switch',
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="ariaLabel() || null"
      [disabled]="disabled()"
      (click)="alternar($event)"
      class="group peer relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer items-center overflow-hidden rounded-full border border-white/20 p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,.25)] backdrop-blur-md transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
      [style.background]="
        checked()
          ? 'color-mix(in oklch, var(--primary) 85%, transparent)'
          : 'color-mix(in oklch, var(--foreground) 16%, transparent)'
      "
    >
      <!-- Brillo especular (sheen) — el reflejo de vidrio líquido -->
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/45 to-transparent"
      ></span>
      <span
        class="pointer-events-none relative block h-[22px] w-[22px] rounded-full border border-black/5 bg-[radial-gradient(120%_120%_at_30%_25%,#ffffff_0%,#f2f2f5_60%,#e4e4e9_100%)] shadow-[0_1px_3px_rgba(0,0,0,.35),inset_0_1px_1px_rgba(255,255,255,.9)] transition-transform duration-300 ease-[cubic-bezier(.3,1.3,.5,1)]"
        [style.transform]="checked() ? 'translateX(20px)' : 'translateX(0)'"
      ></span>
    </button>
  `,
})
export class AlmaSwitchComponent {
  readonly checked = model(false);
  readonly disabled = input(false);
  readonly ariaLabel = input('');

  protected alternar(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.disabled()) return;
    this.checked.set(!this.checked());
  }
}
