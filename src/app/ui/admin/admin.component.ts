// Consola administrativa (paridad con routes/admin.tsx): tabs por query param
// ?tab= con tablas de aplicaciones, roles, equipos, usuarios y permisos.

import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { APP_CATALOG, ROLES, TEAMS } from '../../core/constants/app-catalog';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

type Tab = 'apps' | 'roles' | 'teams' | 'users' | 'permissions' | 'reports';

const VALID_TABS: Tab[] = ['apps', 'roles', 'teams', 'users', 'permissions', 'reports'];

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'apps', label: 'Aplicaciones', icon: 'layout-grid' },
  { id: 'roles', label: 'Roles', icon: 'shield' },
  { id: 'teams', label: 'Equipos', icon: 'users' },
  { id: 'users', label: 'Usuarios', icon: 'user-circle-2' },
  { id: 'permissions', label: 'Permisos', icon: 'key-round' },
  { id: 'reports', label: 'Reportes', icon: 'bar-chart-3' },
];

@Component({
  selector: 'alma-admin',
  imports: [LucideAngularModule, PageHeaderComponent],
  template: `
    <alma-page-header
      title="Administración"
      description="Consola de gestión del portal de operaciones."
    />

    <div
      class="mb-5 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 shadow-[var(--shadow-sm)]"
    >
      @for (t of tabs; track t.id) {
        <button
          type="button"
          (click)="setTab(t.id)"
          class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          [class]="
            activeTab() === t.id
              ? 'bg-[oklch(0.94_0.03_255)] text-[oklch(0.35_0.16_255)]'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          "
        >
          <lucide-icon [name]="t.icon" [size]="16" />
          {{ t.label }}
        </button>
      }
    </div>

    @switch (activeTab()) {
      @case ('apps') {
        <div class="admin-table">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr>
                  <th>Aplicación</th><th>Categoría</th><th>Integración</th><th>Permiso</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (a of catalog; track a.id) {
                  <tr>
                    <td>
                      <div class="flex items-center gap-2.5">
                        <div
                          class="flex h-8 w-8 items-center justify-center rounded-md"
                          [style.backgroundColor]="a.color + '18'"
                          [style.color]="a.color"
                        >
                          <lucide-icon [name]="a.icono" [size]="16" />
                        </div>
                        <span class="font-medium text-foreground">{{ a.nombre }}</span>
                      </div>
                    </td>
                    <td>{{ a.categoria }}</td>
                    <td>{{ a.integrationType }}</td>
                    <td><code>{{ a.requiredPermission }}</code></td>
                    <td>{{ a.estado }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
      @case ('roles') {
        <div class="admin-table">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr><th>Rol</th><th>Descripción</th><th>Permisos</th></tr></thead>
              <tbody>
                @for (r of roles; track r.id) {
                  <tr>
                    <td><span class="font-medium text-foreground">{{ r.nombre }}</span></td>
                    <td>{{ r.descripcion ?? '—' }}</td>
                    <td>
                      <div class="flex flex-wrap gap-1">
                        @for (p of r.permissions; track p) {
                          <code>{{ p }}</code>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
      @case ('teams') {
        <div class="admin-table">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr><th>Equipo</th><th>Miembros</th></tr></thead>
              <tbody>
                @for (t of teams; track t.id) {
                  <tr>
                    <td><span class="font-medium text-foreground">{{ t.nombre }}</span></td>
                    <td>{{ t.miembros }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
      @case ('users') {
        <div class="admin-table">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr><th>Usuario</th><th>Correo</th><th>Cargo</th><th>Equipo</th></tr></thead>
              <tbody>
                <tr>
                  <td>
                    <div class="flex items-center gap-2">
                      <img [src]="user().foto" class="h-7 w-7 rounded-full" alt="" />
                      <span class="font-medium text-foreground">{{ user().nombre }}</span>
                    </div>
                  </td>
                  <td>{{ user().correo }}</td>
                  <td>{{ user().cargo }}</td>
                  <td>{{ user().equipo }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      }
      @case ('permissions') {
        <div class="admin-table">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr><th>Permiso</th><th>Descripción</th></tr></thead>
              <tbody>
                @for (a of catalog; track a.id) {
                  <tr>
                    <td><code>{{ a.requiredPermission }}</code></td>
                    <td>Acceso a {{ a.nombre }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
      @case ('reports') {
        <div
          class="rounded-lg border border-dashed border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]"
        >
          <lucide-icon name="bar-chart-3" [size]="32" class="mx-auto text-muted-foreground" />
          <h3 class="mt-3 text-sm font-semibold text-foreground">
            Reportes de uso de la plataforma
          </h3>
          <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Maqueta — aquí vivirán los reportes de adopción, accesos y actividad por
            aplicación y equipo.
          </p>
        </div>
      }
    }
  `,
  styles: `
    .admin-table {
      overflow: hidden;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      background-color: var(--card);
      box-shadow: var(--shadow-sm);
    }
    thead {
      background-color: var(--surface-sunken);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted-foreground);
    }
    th { padding: 12px 16px; text-align: left; font-weight: 500; }
    tbody tr { border-top: 1px solid var(--border); }
    tbody tr:hover { background-color: var(--surface-sunken); }
    td { padding: 12px 16px; vertical-align: middle; color: var(--muted-foreground); }
    code {
      border-radius: 4px;
      background-color: var(--surface-sunken);
      padding: 2px 6px;
      font-size: 11px;
    }
  `,
})
export class AdminComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query param ?tab= (withComponentInputBinding). */
  readonly tab = input<string | undefined>(undefined);

  protected readonly tabs = TABS;
  protected readonly catalog = APP_CATALOG;
  protected readonly roles = ROLES;
  protected readonly teams = TEAMS;
  protected readonly user = this.auth.user;

  protected readonly activeTab = computed<Tab>(() => {
    const t = this.tab() as Tab | undefined;
    return t && VALID_TABS.includes(t) ? t : 'apps';
  });

  protected setTab(t: Tab): void {
    void this.router.navigate([], { queryParams: { tab: t }, replaceUrl: true });
  }
}
