// Grid de tarjetas de aplicación. Compartido entre el catálogo de aplicaciones y
// Favoritos.

import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Application } from '../../core/models/platform.models';
import { PreferencesService } from '../../core/services/preferences.service';

@Component({
  selector: 'alma-app-card-grid',
  imports: [LucideAngularModule],
  template: `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      @for (app of apps(); track app.id) {
        <div
          role="button"
          tabindex="0"
          (click)="open(app)"
          (keydown.enter)="open(app)"
          class="glass group flex cursor-pointer flex-col rounded-xl p-5 text-left shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div class="flex items-start justify-between">
            <div
              class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[26%] text-white shadow-[0_4px_10px_rgba(0,0,0,.18)]"
              [style.background]="
                'linear-gradient(160deg, ' + app.color + ', ' + app.color + 'bb)'
              "
            >
              <lucide-icon [name]="app.icono" [size]="26" [strokeWidth]="1.75" />
            </div>
            <div class="flex items-center gap-1.5">
              <span
                class="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                [class.text-primary]="app.estado === 'active'"
                [class.text-warning]="app.estado === 'beta'"
                [class.text-muted-foreground]="
                  app.estado !== 'active' && app.estado !== 'beta'
                "
              >
                {{ estadoLabel(app.estado) }}
              </span>
              <button
                type="button"
                (click)="toggleFavorite($event, app)"
                class="rounded-md p-1 transition-colors hover:bg-accent"
                [attr.aria-label]="
                  app.favorito ? 'Quitar de favoritos' : 'Agregar a favoritos'
                "
              >
                <lucide-icon
                  name="star"
                  [size]="15"
                  [class]="
                    app.favorito
                      ? 'text-warning fill-current'
                      : 'text-muted-foreground/50'
                  "
                />
              </button>
            </div>
          </div>
          <h3 class="mt-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {{ app.nombre }}
            @if (!app.internalRoute) {
              <lucide-icon
                name="external-link"
                [size]="13"
                class="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              />
            }
          </h3>
          <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {{ app.descripcion }}
          </p>
          <div class="mt-3 flex items-center justify-between">
            <span class="text-[11px] text-muted-foreground">{{ app.categoria }}</span>
            @if (app.lastUsedAt; as last) {
              <span class="text-[11px] text-muted-foreground/70">{{ last }}</span>
            }
          </div>
        </div>
      } @empty {
        <p class="col-span-full py-10 text-center text-sm text-muted-foreground">
          {{ emptyMessage() }}
        </p>
      }
    </div>
  `,
})
export class AppCardGridComponent {
  private readonly ui = inject(PreferencesService);
  private readonly router = inject(Router);

  readonly apps = input.required<Application[]>();
  readonly emptyMessage = input<string>('No hay aplicaciones para mostrar.');

  protected estadoLabel(estado: Application['estado']): string {
    switch (estado) {
      case 'active':
        return 'Activa';
      case 'beta':
        return 'Beta';
      case 'maintenance':
        return 'Mantenimiento';
      case 'deprecated':
        return 'Obsoleta';
    }
  }

  protected toggleFavorite(event: MouseEvent, app: Application): void {
    event.stopPropagation();
    this.ui.toggleFavorite(app.id);
  }

  protected open(app: Application): void {
    this.ui.pushRecent(app.id);
    if (app.internalRoute) {
      void this.router.navigateByUrl(app.internalRoute);
    } else {
      window.open(app.url, '_blank', 'noreferrer');
    }
  }
}
