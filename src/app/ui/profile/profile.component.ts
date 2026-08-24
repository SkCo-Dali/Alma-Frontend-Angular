// Mi perfil.

import { Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'alma-profile',
  imports: [LucideAngularModule, PageHeaderComponent],
  template: `
    <alma-page-header title="Mi perfil" description="Información y permisos asignados." />

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <img
          [src]="user().foto"
          [alt]="user().nombre"
          class="h-20 w-20 rounded-full border border-border"
        />
        <h2 class="mt-4 text-lg font-semibold text-foreground">{{ user().nombre }}</h2>
        <p class="text-sm text-muted-foreground">{{ user().cargo }}</p>
        <div class="mt-5 flex flex-col gap-2.5 text-sm">
          <div class="flex items-center gap-2 text-muted-foreground">
            <lucide-icon name="mail" [size]="16" /> {{ user().correo }}
          </div>
          <div class="flex items-center gap-2 text-muted-foreground">
            <lucide-icon name="briefcase" [size]="16" /> {{ user().cargo }}
          </div>
          <div class="flex items-center gap-2 text-muted-foreground">
            <lucide-icon name="users" [size]="16" /> {{ user().equipo }}
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-6 lg:col-span-2">
        <div class="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h3 class="text-sm font-semibold text-foreground">Roles</h3>
          <div class="mt-3 flex flex-wrap gap-2">
            @for (r of user().roles; track r) {
              <span
                class="rounded-full border border-border bg-[var(--surface-sunken)] px-3 py-1 text-xs font-medium text-foreground"
              >
                {{ r }}
              </span>
            } @empty {
              <span class="text-xs text-muted-foreground">Sin rol asignado en alma.Users.</span>
            }
          </div>
        </div>
        <div class="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h3 class="text-sm font-semibold text-foreground">Permisos</h3>
          <div class="mt-3 flex flex-wrap gap-2">
            @for (p of user().permissions; track p) {
              <span
                class="rounded-md border border-border bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                {{ p }}
              </span>
            } @empty {
              <span class="text-xs text-muted-foreground">Sin permisos asignados.</span>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  protected readonly user = this.auth.user;
}
