// Panel lateral de la pestaña Aplicaciones (/admin): quién tiene acceso a una App
// y con qué rol. Un rol da acceso si alguno de sus permisos cubre el permiso que
// exige la App (exacto, comodín de App app.<slug>.* o '*'), la misma regla del
// backend (app/authz.py tiene_permiso); así también aparecen los roles de
// plataforma con acceso total.

import { Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Application } from '../../core/models/platform.models';
import { RolCatalogo, UsuarioDirectorio } from '../../core/services/accesos.api';

interface GrupoRol {
  rol: RolCatalogo;
  usuarios: UsuarioDirectorio[];
}

function concede(permisos: string[], requerido: string): boolean {
  return permisos.some(
    (p) => p === '*' || p === requerido || (p.endsWith('.*') && requerido.startsWith(p.slice(0, -1))),
  );
}

@Component({
  selector: 'alma-app-accesos-panel',
  imports: [LucideAngularModule],
  template: `
    <div class="fixed inset-0 z-[90] flex justify-end bg-black/30 backdrop-blur-[2px]" (click)="cerrar.emit()">
      <aside
        class="surface-solid flex h-full w-full max-w-lg flex-col border-l border-border shadow-[var(--shadow-lg)]"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Accesos de ' + app().nombre"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-start gap-3 border-b border-border px-5 py-4">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            [style.backgroundColor]="app().color + '18'"
            [style.color]="app().color"
          >
            <lucide-icon [name]="app().icono" [size]="20" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-lg font-bold text-foreground">{{ app().nombre }}</h2>
            <div class="mt-1 flex flex-wrap gap-1">
              @for (p of permisosApp(); track p) {
                <code class="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[11px]">{{ p }}</code>
              }
            </div>
          </div>
          <button
            type="button"
            class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Cerrar"
            (click)="cerrar.emit()"
          >
            <lucide-icon name="x" [size]="18" />
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          @if (cargando()) {
            <div class="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <lucide-icon name="loader-2" [size]="16" class="animate-spin" /> Cargando accesos…
            </div>
          } @else if (error(); as err) {
            <p class="py-8 text-sm text-destructive">{{ err }}</p>
          } @else {
            <p class="mb-4 text-sm text-muted-foreground">
              @if (totalPersonas() === 0) {
                Nadie tiene acceso a esta aplicación todavía.
              } @else {
                <span class="font-semibold text-foreground">{{ totalPersonas() }}</span>
                {{ totalPersonas() === 1 ? 'persona tiene' : 'personas tienen' }} acceso
                @if (inactivos() > 0) {
                  ({{ inactivos() }} {{ inactivos() === 1 ? 'inactiva' : 'inactivas' }})
                }
              }
            </p>

            <div class="flex flex-col gap-4">
              @for (g of grupos(); track g.rol.role_id) {
                <section class="rounded-xl border border-border">
                  <header class="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold text-foreground">{{ g.rol.name }}</p>
                      <p class="text-[11px] text-muted-foreground">
                        @if (g.rol.app) { Rol de la App } @else {
                          <span class="font-medium text-primary">Rol de plataforma</span>
                        }
                      </p>
                    </div>
                    <span class="shrink-0 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                      {{ g.usuarios.length }}
                    </span>
                  </header>
                  @if (g.usuarios.length === 0) {
                    <p class="px-4 py-3 text-xs text-muted-foreground">Sin personas con este rol.</p>
                  } @else {
                    <ul class="divide-y divide-border">
                      @for (u of g.usuarios; track u.user_id) {
                        <li class="flex items-center justify-between gap-3 px-4 py-2.5">
                          <div class="min-w-0">
                            <p class="truncate text-sm font-medium text-foreground">{{ u.name }}</p>
                            <p class="truncate text-xs text-muted-foreground">{{ u.email }}</p>
                          </div>
                          @if (!u.is_active) {
                            <span class="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                              Inactivo
                            </span>
                          }
                        </li>
                      }
                    </ul>
                  }
                </section>
              }
            </div>
          }
        </div>

        <footer class="border-t border-border px-5 py-3">
          <button type="button" class="alma-btn alma-btn-outline w-full justify-center gap-2" (click)="gestionar.emit()">
            <lucide-icon name="user-circle-2" [size]="16" /> Gestionar en Usuarios
          </button>
        </footer>
      </aside>
    </div>
  `,
  host: { '(document:keydown.escape)': 'cerrar.emit()' },
})
export class AppAccesosPanelComponent {
  readonly app = input.required<Application>();
  readonly roles = input.required<RolCatalogo[]>();
  readonly usuarios = input.required<UsuarioDirectorio[]>();
  readonly cargando = input(false);
  readonly error = input<string | null>(null);
  readonly cerrar = output<void>();
  readonly gestionar = output<void>();

  protected readonly permisosApp = computed(() => {
    const a = this.app();
    return a.requiredAnyPermission?.length ? a.requiredAnyPermission : [a.requiredPermission];
  });

  /** Roles que dan acceso a la App, con sus personas. Primero los de la App
   *  (los que tienen gente antes), al final los de plataforma. */
  protected readonly grupos = computed<GrupoRol[]>(() => {
    const requeridos = this.permisosApp();
    const roles = this.roles().filter((r) => requeridos.some((p) => concede(r.permissions, p)));
    const ids = new Set(roles.map((r) => r.role_id));
    const porRol = new Map<string, UsuarioDirectorio[]>();
    for (const u of this.usuarios()) {
      for (const r of u.roles) {
        if (!ids.has(r.role_id)) continue;
        const lista = porRol.get(r.role_id) ?? [];
        lista.push(u);
        porRol.set(r.role_id, lista);
      }
    }
    return roles
      .map((rol) => ({
        rol,
        usuarios: (porRol.get(rol.role_id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort(
        (a, b) =>
          Number(!a.rol.app) - Number(!b.rol.app) ||
          Number(a.usuarios.length === 0) - Number(b.usuarios.length === 0) ||
          a.rol.name.localeCompare(b.rol.name),
      );
  });

  private readonly personas = computed(() => {
    const m = new Map<string, UsuarioDirectorio>();
    for (const g of this.grupos()) for (const u of g.usuarios) m.set(u.user_id, u);
    return [...m.values()];
  });
  protected readonly totalPersonas = computed(() => this.personas().length);
  protected readonly inactivos = computed(() => this.personas().filter((u) => !u.is_active).length);
}
