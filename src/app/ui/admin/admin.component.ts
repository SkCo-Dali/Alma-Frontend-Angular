// Consola de Accesos v2: pestañas por permiso — Aplicaciones (solo plataforma),
// Usuarios, Roles, Auditoría y Métricas.

import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { APP_CATALOG } from '../../core/constants/app-catalog';
import { AccesosApi, RolCatalogo } from '../../core/services/accesos.api';
import { AdminTableComponent } from '../../shared/components/admin-table.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { AuditoriaAccesosComponent } from '../../features/accesos/auditoria-accesos.component';
import { UsuariosAccesosComponent } from '../../features/accesos/usuarios-accesos.component';
import { MetricasUsoComponent } from '../../features/metricas/metricas-uso.component';

type Tab = 'apps' | 'usuarios' | 'roles' | 'auditoria' | 'metricas';

@Component({
  selector: 'alma-admin',
  imports: [
    RouterLink,
    LucideAngularModule,
    PageHeaderComponent,
    AdminTableComponent,
    UsuariosAccesosComponent,
    AuditoriaAccesosComponent,
    MetricasUsoComponent,
  ],
  template: `
    <a
      routerLink="/"
      class="glass mb-4 inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] transition-colors hover:text-primary"
    >
      <lucide-icon name="arrow-left" [size]="16" />
      Inicio
    </a>

    <alma-page-header
      title="Accesos"
      description="Usuarios, roles, auditoría y métricas de la plataforma."
    />

    <div
      class="glass mb-5 flex flex-wrap gap-1 rounded-lg p-1 shadow-[var(--shadow-sm)]"
    >
      @for (t of visiblesTabs(); track t.id) {
        <button
          type="button"
          (click)="setTab(t.id)"
          class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          [class]="
            activeTab() === t.id
              ? 'bg-primary/10 text-primary'
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
        <!-- Catálogo de Apps registradas en la plataforma (registry del frontend) -->
        <alma-admin-table
          [headers]="['Aplicación', 'Categoría', 'Integración', 'Permiso requerido', 'Estado']"
          [rows]="catalogo"
          [rowTpl]="filaApp"
        />
        <ng-template #filaApp let-a>
          <td class="px-4 py-3">
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
          <td class="px-4 py-3 text-sm text-muted-foreground">{{ a.categoria }}</td>
          <td class="px-4 py-3 text-sm text-muted-foreground">{{ a.integrationType }}</td>
          <td class="px-4 py-3">
            <code class="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[11px]">
              {{ a.requiredPermission }}
            </code>
          </td>
          <td class="px-4 py-3 text-sm text-muted-foreground">{{ a.estado }}</td>
        </ng-template>
      }
      @case ('usuarios') {
        <alma-usuarios-accesos />
      }
      @case ('roles') {
        <!-- Roles reales del RBAC (alma.Roles vía API, filtrados al ámbito) -->
        @if (rolesCargando()) {
          <div class="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <lucide-icon name="loader-2" [size]="16" class="animate-spin" /> Cargando roles…
          </div>
        } @else if (rolesError(); as err) {
          <p class="py-8 text-sm text-destructive">{{ err }}</p>
        } @else {
          <alma-admin-table
            [headers]="['Ámbito', 'Rol', 'Descripción', 'Permisos']"
            [rows]="roles()"
            [rowTpl]="filaRol"
          />
          <ng-template #filaRol let-r>
            <td class="px-4 py-3 text-sm text-muted-foreground">
              @if (r.app) {
                {{ r.app }}
              } @else {
                <span class="font-medium text-primary">Plataforma</span>
              }
            </td>
            <td class="px-4 py-3">
              <span class="font-medium text-foreground">{{ r.name }}</span>
            </td>
            <td class="px-4 py-3 text-sm text-muted-foreground">{{ r.description ?? '—' }}</td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                @for (p of r.permissions; track p) {
                  <code class="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[11px]">
                    {{ p }}
                  </code>
                }
              </div>
            </td>
          </ng-template>
        }
      }
      @case ('auditoria') {
        <alma-auditoria-accesos />
      }
      @case ('metricas') {
        <alma-metricas-uso />
      }
    }
  `,
})
export class AdminComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly accesos = inject(AccesosApi);

  /** Query param ?tab= (withComponentInputBinding). */
  readonly tab = input<string | undefined>(undefined);

  protected readonly catalogo = APP_CATALOG;
  protected readonly roles = signal<RolCatalogo[]>([]);
  protected readonly rolesCargando = signal(true);
  protected readonly rolesError = signal<string | null>(null);

  // Admin de App = permiso comodín app.<slug>.*; admin de PLATAFORMA = platform.*
  private readonly esAdminDeApp = computed(() =>
    this.auth.user().permissions.some((p) => p.startsWith('app.') && p.endsWith('.*')),
  );
  private readonly esAdminPlataforma = computed(
    () =>
      this.auth.hasPermission('platform.access.view') ||
      this.auth.hasPermission('platform.audit.view') ||
      this.auth.hasPermission('platform.metrics.view'),
  );
  private readonly puedeAccesos = computed(
    () => this.auth.hasPermission('platform.access.view') || this.esAdminDeApp(),
  );
  private readonly puedeAuditoria = computed(
    () => this.auth.hasPermission('platform.audit.view') || this.esAdminDeApp(),
  );
  private readonly puedeMetricas = computed(
    () => this.auth.hasPermission('platform.metrics.view') || this.esAdminDeApp(),
  );

  protected readonly visiblesTabs = computed(() => {
    const tabs: { id: Tab; label: string; icon: string; visible: boolean }[] = [
      { id: 'apps', label: 'Aplicaciones', icon: 'layout-grid', visible: this.esAdminPlataforma() },
      { id: 'usuarios', label: 'Usuarios', icon: 'user-circle-2', visible: this.puedeAccesos() },
      { id: 'roles', label: 'Roles', icon: 'shield', visible: this.puedeAccesos() },
      { id: 'auditoria', label: 'Auditoría', icon: 'scroll-text', visible: this.puedeAuditoria() },
      { id: 'metricas', label: 'Métricas', icon: 'bar-chart-3', visible: this.puedeMetricas() },
    ];
    return tabs.filter((t) => t.visible);
  });

  protected readonly activeTab = computed<Tab>(() => {
    const visibles = this.visiblesTabs();
    const t = this.tab() as Tab | undefined;
    return t && visibles.some((v) => v.id === t) ? t : (visibles[0]?.id ?? 'usuarios');
  });

  constructor() {
    this.accesos
      .listarRoles()
      .then((r) => this.roles.set(r))
      .catch((e) => this.rolesError.set(e instanceof Error ? e.message : String(e)))
      .finally(() => this.rolesCargando.set(false));
  }

  protected setTab(t: Tab): void {
    void this.router.navigate([], { queryParams: { tab: t }, replaceUrl: true });
  }
}
