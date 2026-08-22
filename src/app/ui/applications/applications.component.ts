// Catálogo de aplicaciones con buscador y filtro por categoría
// (paridad con routes/applications.tsx).

import { Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ApplicationsService } from '../../core/services/applications.service';
import { AppCardGridComponent } from '../../shared/components/app-card-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'alma-applications',
  imports: [LucideAngularModule, PageHeaderComponent, AppCardGridComponent],
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

    <alma-app-card-grid
      [apps]="filtered()"
      emptyMessage="No hay aplicaciones que coincidan con tu búsqueda."
    />
  `,
})
export class ApplicationsComponent {
  protected readonly apps = inject(ApplicationsService);

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
}
