// Host de los avisos flotantes (esquina inferior derecha, sobre el Dock).

import { Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'alma-toasts',
  imports: [LucideAngularModule],
  template: `
    @if (toasts.toasts().length > 0) {
      <div class="fixed bottom-28 right-4 z-[120] flex w-80 flex-col gap-2">
        @for (t of toasts.toasts(); track t.id) {
          <div
            class="surface-solid flex items-start gap-2 rounded-xl border p-3 shadow-[var(--shadow-lg)]"
            [class]="
              t.variant === 'destructive' ? 'border-destructive/40' : 'border-border'
            "
            [attr.role]="t.variant === 'destructive' ? 'alert' : 'status'"
          >
            <div class="min-w-0 flex-1">
              <p
                class="text-sm font-semibold"
                [class.text-destructive]="t.variant === 'destructive'"
              >
                {{ t.title }}
              </p>
              @if (t.description) {
                <p class="mt-0.5 text-xs text-muted-foreground">{{ t.description }}</p>
              }
            </div>
            <button
              type="button"
              (click)="toasts.dismiss(t.id)"
              class="text-muted-foreground hover:text-foreground"
              aria-label="Cerrar aviso"
            >
              <lucide-icon name="x" [size]="14" />
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class ToastsComponent {
  protected readonly toasts = inject(ToastService);
}
