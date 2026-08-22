// Solicitudes de acceso (paridad con routes/access-requests.tsx).

import { Component } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ACCESS_REQUESTS } from '../../core/constants/app-catalog';
import { AccessRequest } from '../../core/models/platform.models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

const STATUS_MAP: Record<
  AccessRequest['status'],
  { label: string; icon: string; className: string }
> = {
  pending: {
    label: 'Pendiente',
    icon: 'clock-3',
    className: 'bg-[oklch(0.95_0.05_75)] text-[oklch(0.4_0.14_75)]',
  },
  approved: {
    label: 'Aprobada',
    icon: 'check-circle-2',
    className: 'bg-[oklch(0.95_0.05_155)] text-[oklch(0.35_0.12_155)]',
  },
  rejected: {
    label: 'Rechazada',
    icon: 'x-circle',
    className: 'bg-[oklch(0.95_0.05_25)] text-[oklch(0.45_0.16_25)]',
  },
};

@Component({
  selector: 'alma-access-requests',
  imports: [LucideAngularModule, PageHeaderComponent],
  template: `
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <alma-page-header
        class="mb-0 [&>div]:mb-0"
        title="Solicitudes de acceso"
        description="Estado de tus solicitudes de acceso a aplicaciones corporativas."
      />
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
      >
        <lucide-icon name="plus" [size]="16" /> Nueva solicitud
      </button>
    </div>

    <div
      class="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-sm)]"
    >
      <div class="divide-y divide-border">
        @for (r of requests; track r.id) {
          <div class="flex flex-wrap items-center gap-4 p-4">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-foreground">{{ r.applicationName }}</p>
              <p class="mt-0.5 truncate text-xs text-muted-foreground">
                {{ r.justification }}
              </p>
            </div>
            <span class="text-xs text-muted-foreground">{{ r.requestedAt }}</span>
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              [class]="statusMap[r.status].className"
            >
              <lucide-icon [name]="statusMap[r.status].icon" [size]="14" />
              {{ statusMap[r.status].label }}
            </span>
          </div>
        }
      </div>
    </div>
  `,
})
export class AccessRequestsComponent {
  protected readonly requests = ACCESS_REQUESTS;
  protected readonly statusMap = STATUS_MAP;
}
