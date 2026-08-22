// Botón de copiar discreto con confirmación (check 1.2 s).

import { Component, OnDestroy, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-copy-button',
  imports: [LucideAngularModule],
  template: `
    <button
      type="button"
      [attr.aria-label]="'Copiar ' + label()"
      [title]="'Copiar ' + label()"
      (click)="copiar($event)"
      class="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      @if (ok()) {
        <lucide-icon name="check" [size]="12" class="text-primary" />
      } @else {
        <lucide-icon name="copy" [size]="12" />
      }
    </button>
  `,
})
export class CopyButtonComponent implements OnDestroy {
  readonly value = input.required<string>();
  readonly label = input('valor');

  protected readonly ok = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected copiar(ev: MouseEvent): void {
    ev.stopPropagation();
    void navigator.clipboard?.writeText(this.value()).then(() => {
      this.ok.set(true);
      this.timer = setTimeout(() => this.ok.set(false), 1200);
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
