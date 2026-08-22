// Centro de ayuda (paridad con routes/help.tsx).

import { Component } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

const RESOURCES = [
  {
    icon: 'book-open',
    title: 'Documentación',
    description: 'Guías de uso, buenas prácticas y preguntas frecuentes.',
  },
  {
    icon: 'life-buoy',
    title: 'Soporte técnico',
    description: 'Contacta al equipo de operaciones digitales.',
  },
  {
    icon: 'message-circle',
    title: 'Sugerencias',
    description: 'Cuéntanos cómo podemos mejorar el portal.',
  },
];

@Component({
  selector: 'alma-help',
  imports: [LucideAngularModule, PageHeaderComponent],
  template: `
    <alma-page-header
      title="Ayuda"
      description="Recursos, documentación y soporte del portal."
    />
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      @for (r of resources; track r.title) {
        <div class="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-md bg-[oklch(0.94_0.03_255)] text-primary"
          >
            <lucide-icon [name]="r.icon" [size]="20" />
          </div>
          <h3 class="mt-4 text-sm font-semibold text-foreground">{{ r.title }}</h3>
          <p class="mt-1 text-xs text-muted-foreground">{{ r.description }}</p>
        </div>
      }
    </div>
  `,
})
export class HelpComponent {
  protected readonly resources = RESOURCES;
}
