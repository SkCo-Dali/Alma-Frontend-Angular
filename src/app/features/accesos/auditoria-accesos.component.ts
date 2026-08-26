// Bitácora de cambios de acceso (solo lectura —

import { Component, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SkTagComponent } from '@skandia/ui';
import { AccesosApi, EventoAuditoria } from '../../core/services/accesos.api';
import { AdminTableComponent } from '../../shared/components/admin-table.component';

@Component({
  selector: 'alma-auditoria-accesos',
  imports: [LucideAngularModule, AdminTableComponent, SkTagComponent],
  template: `
    @if (cargando()) {
      <div class="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <lucide-icon name="loader-2" [size]="16" class="animate-spin" /> Cargando auditoría…
      </div>
    } @else if (error(); as err) {
      <p class="py-8 text-sm text-destructive">{{ err }}</p>
    } @else {
      <div class="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <lucide-icon name="scroll-text" [size]="14" />
        Últimos movimientos de acceso (solo lectura).
      </div>
      <alma-admin-table
        [headers]="['Fecha', 'Usuario', 'Rol', 'Acción', 'Realizado por']"
        [rows]="eventos()"
        [rowTpl]="fila"
        emptyMessage="Sin movimientos registrados."
      />
      <ng-template #fila let-e>
        <td class="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{{ e.date }}</td>
        <td class="px-4 py-3 text-sm text-muted-foreground">{{ e.email }}</td>
        <td class="px-4 py-3 text-sm text-muted-foreground">{{ e.role }}</td>
        <td class="px-4 py-3">
          <sk-tag
            [value]="e.action === 'granted' ? 'otorgado' : 'revocado'"
            [severity]="e.action === 'granted' ? 'success' : 'warn'"
          />
        </td>
        <td class="px-4 py-3 text-sm text-muted-foreground">{{ e.performed_by }}</td>
      </ng-template>
    }
  `,
})
export class AuditoriaAccesosComponent {
  private readonly api = inject(AccesosApi);

  protected readonly eventos = signal<EventoAuditoria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.api
      .listarAuditoria()
      .then((e) => this.eventos.set(e))
      .catch((e) => this.error.set(e instanceof Error ? e.message : String(e)))
      .finally(() => this.cargando.set(false));
  }
}
