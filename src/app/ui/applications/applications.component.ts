// Catálogo de aplicaciones con buscador y filtro por categoría
// (paridad con routes/applications.tsx + AppCard.tsx).

import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ApplicationsService } from '../../core/services/applications.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { Application } from '../../core/models/platform.models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'alma-applications',
  imports: [LucideAngularModule, PageHeaderComponent],
  template: `
    <alma-page-header
      title="Aplicaciones"
      description="Explora el catálogo de aplicaciones disponibles para tu perfil."
    />

    <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <lucide-icon
          name="search"
          [size]="16"
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          [value]="query()"
          (input)="query.set(inputValue($event))"
          placeholder="Buscar aplicación…"
          class="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-[oklch(0.85_0.08_255)]"
        />
      </div>
      <div class="flex flex-wrap gap-1.5">
        @for (c of allCategories(); track c) {
          <button
            type="button"
            (click)="category.set(c)"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
            [class]="
              category() === c
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            "
          >
            {{ c === 'all' ? 'Todas' : c }}
          </button>
        }
      </div>
    </div>

    <p class="mb-3 text-xs text-muted-foreground">
      {{ filtered().length }} de {{ apps.applications().length }} aplicaciones
    </p>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      @for (app of filtered(); track app.id) {
        <button
          type="button"
          (click)="open(app)"
          class="glass group flex flex-col rounded-xl p-5 text-left shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
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
            <span
              class="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
              [class.text-primary]="app.estado === 'active'"
              [class.text-warning]="app.estado === 'beta'"
              [class.text-muted-foreground]="app.estado !== 'active' && app.estado !== 'beta'"
            >
              {{ estadoLabel(app.estado) }}
            </span>
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
        </button>
      } @empty {
        <p class="col-span-full py-10 text-center text-sm text-muted-foreground">
          No hay aplicaciones que coincidan con tu búsqueda.
        </p>
      }
    </div>
  `,
})
export class ApplicationsComponent {
  protected readonly apps = inject(ApplicationsService);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiStateService);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  protected readonly category = signal('all');

  protected readonly allCategories = computed(() => ['all', ...this.apps.categories()]);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.category();
    return this.apps.applications().filter((a) => {
      const matchesQ =
        !q ||
        a.nombre.toLowerCase().includes(q) ||
        a.descripcion.toLowerCase().includes(q);
      const matchesCat = cat === 'all' || a.categoria === cat;
      return matchesQ && matchesCat;
    });
  });

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

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

  protected open(app: Application): void {
    this.ui.pushRecent(app.id);
    if (app.internalRoute) {
      void this.router.navigateByUrl(app.internalRoute);
    } else {
      window.open(app.url, '_blank', 'noreferrer');
    }
  }
}
