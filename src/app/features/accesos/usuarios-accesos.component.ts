// Directorio de usuarios con sus roles: crear, editar, otorgar y revocar.

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import {
  AccesosApi,
  RolCatalogo,
  UsuarioDirectorio,
  etiquetaRol,
} from '../../core/services/accesos.api';
import { AdminTableComponent } from '../../shared/components/admin-table.component';
import { RolesPickerComponent } from './roles-picker.component';

type FiltroEstado = 'todos' | 'activos' | 'inactivos';

@Component({
  selector: 'alma-usuarios-accesos',
  imports: [FormsModule, LucideAngularModule, AdminTableComponent, RolesPickerComponent],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Barra de filtros + crear -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-72 flex-1">
          <lucide-icon
            name="search"
            [size]="16"
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            class="alma-input pl-8"
            [(ngModel)]="filtro"
            placeholder="Buscar por nombre, correo o rol…"
          />
        </div>
        <select class="alma-input w-32" [(ngModel)]="estado">
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
        @if (puedeGestionar()) {
          <button type="button" class="alma-btn alma-btn-primary" (click)="creando.set(true)">
            <lucide-icon name="user-plus" [size]="16" />
            Crear usuario
          </button>
        }
      </div>

      @if (error(); as err) {
        <p class="text-xs text-destructive">{{ err }}</p>
      }

      @if (cargando()) {
        <div class="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <lucide-icon name="loader-2" [size]="16" class="animate-spin" /> Cargando usuarios…
        </div>
      } @else {
        <alma-admin-table
          [headers]="headers()"
          [rows]="filtrados()"
          [rowTpl]="fila"
          emptyMessage="Sin usuarios que coincidan con el filtro."
        />
        <ng-template #fila let-u>
          <td class="px-4 py-3 text-sm text-muted-foreground">
            @if (editando()?.user_id === u.user_id) {
              <input class="alma-input h-8" [(ngModel)]="nombreEdit" />
            } @else {
              <span class="font-medium text-foreground" [class.opacity-50]="!u.is_active">
                {{ u.name }}
              </span>
            }
          </td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
            {{ u.email }}
          </td>
          <td class="px-4 py-3 text-sm">
            @if (editando()?.user_id === u.user_id) {
              <select class="alma-input h-8 w-28" [(ngModel)]="activoEdit">
                <option [ngValue]="true">activo</option>
                <option [ngValue]="false">inactivo</option>
              </select>
            } @else {
              <span
                class="alma-badge"
                [class]="
                  u.is_active
                    ? 'alma-badge bg-primary/10 text-primary'
                    : 'alma-badge bg-muted text-muted-foreground'
                "
              >
                {{ u.is_active ? 'activo' : 'inactivo' }}
              </span>
            }
          </td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap items-center gap-1.5">
              @for (r of u.roles; track r.role_id) {
                <span
                  class="alma-badge gap-1 bg-[var(--surface-sunken)] font-normal text-foreground"
                  [class.border]="r.app === null"
                  [class.border-primary/40]="r.app === null"
                  [class.text-primary]="r.app === null"
                >
                  {{ etiqueta(r) }}
                  @if (puedeGestionar()) {
                    <button
                      (click)="revocar(u, r.role_id)"
                      class="ml-0.5 rounded-full hover:text-destructive"
                      title="Revocar"
                    >
                      <lucide-icon name="x" [size]="12" />
                    </button>
                  }
                </span>
              }
              @if (puedeGestionar() && u.is_active) {
                <div class="w-40">
                  <alma-roles-picker
                    [multiple]="false"
                    [roles]="rolesDisponibles(u)"
                    [seleccionados]="[]"
                    triggerLabel="Agregar rol"
                    (toggled)="otorgar(u, $event)"
                  />
                </div>
              }
              @if (u.roles.length === 0 && !puedeGestionar()) {
                <span class="text-xs text-muted-foreground">sin roles</span>
              }
            </div>
          </td>
          @if (puedeAsignarGlobal()) {
            <td class="px-4 py-3">
              @if (editando()?.user_id === u.user_id) {
                <div class="flex justify-end gap-1">
                  <button
                    type="button"
                    class="alma-btn alma-btn-primary h-8"
                    [disabled]="guardando()"
                    (click)="guardarEdicion()"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    class="alma-btn alma-btn-outline h-8"
                    (click)="editando.set(null)"
                  >
                    Cancelar
                  </button>
                </div>
              } @else {
                <div class="flex justify-end">
                  <button
                    type="button"
                    class="alma-btn alma-btn-ghost"
                    (click)="iniciarEdicion(u)"
                    title="Editar usuario"
                  >
                    <lucide-icon name="pencil" [size]="16" />
                  </button>
                </div>
              }
            </td>
          }
        </ng-template>
      }

      <!-- Modal de creación: solo correo (el nombre llega de Entra) + roles -->
      @if (creando()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            class="surface-solid w-[95vw] rounded-xl p-4 shadow-2xl sm:max-w-[480px] sm:rounded-2xl sm:p-6"
          >
            <div class="flex flex-col items-center justify-center space-y-1">
              <h2 class="text-xl font-bold">Crear usuario</h2>
              <p class="text-center text-xs text-muted-foreground sm:text-sm">
                Registra a alguien por su correo corporativo y asígnale roles.
              </p>
            </div>

            <div class="mt-4 flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Correo corporativo</label>
                <input
                  class="alma-input"
                  [(ngModel)]="email"
                  (ngModelChange)="nombreDir.set(null)"
                  (blur)="resolverNombre()"
                  placeholder="usuario@skandia.com.co"
                />
                @if (resolviendo()) {
                  <p class="text-xs text-muted-foreground">Buscando en el directorio…</p>
                } @else if (nombreDir(); as n) {
                  <p class="text-xs text-primary">Directorio: {{ n }}</p>
                } @else {
                  <p class="text-xs text-muted-foreground">
                    El nombre se toma del directorio; si no se encuentra, Entra ID lo
                    completa en su primer ingreso.
                  </p>
                }
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Roles iniciales</label>
                <alma-roles-picker
                  [roles]="roles()"
                  [seleccionados]="rolesSel()"
                  (toggled)="toggleRolSel($event)"
                />
              </div>
            </div>

            @if (errorCrear(); as err) {
              <p class="mt-1 text-xs text-destructive">{{ err }}</p>
            }

            <div class="mt-4 flex justify-end gap-2">
              <button type="button" class="alma-btn alma-btn-outline" (click)="cerrarCrear()">
                Cancelar
              </button>
              <button
                type="button"
                class="alma-btn alma-btn-primary"
                [disabled]="!email.includes('@') || creandoUsuario()"
                (click)="crear()"
              >
                @if (creandoUsuario()) {
                  <lucide-icon name="loader-2" [size]="16" class="animate-spin" />
                }
                Crear
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class UsuariosAccesosComponent {
  private readonly api = inject(AccesosApi);
  private readonly auth = inject(AuthService);

  protected readonly etiqueta = etiquetaRol;

  protected filtro = '';
  protected estado: FiltroEstado = 'todos';
  protected email = '';
  protected nombreEdit = '';
  protected activoEdit = true;

  protected readonly usuarios = signal<UsuarioDirectorio[]>([]);
  protected readonly roles = signal<RolCatalogo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly editando = signal<UsuarioDirectorio | null>(null);
  protected readonly guardando = signal(false);
  protected readonly creando = signal(false);
  protected readonly creandoUsuario = signal(false);
  protected readonly errorCrear = signal<string | null>(null);
  protected readonly nombreDir = signal<string | null>(null);
  protected readonly resolviendo = signal(false);
  protected readonly rolesSel = signal<string[]>([]);

  // Señales espejo del filtro (ngModel no es señal): recalcular con un tick.
  private readonly refreshTick = signal(0);

  protected readonly puedeAsignarGlobal = computed(() =>
    this.auth.hasPermission('platform.access.assign'),
  );
  protected readonly puedeGestionar = computed(
    () => this.puedeAsignarGlobal() || this.roles().length > 0,
  );
  protected readonly headers = computed(() => [
    'Usuario',
    'Correo',
    'Estado',
    'Roles',
    ...(this.puedeAsignarGlobal() ? ['Acciones'] : []),
  ]);

  protected readonly filtrados = computed(() => {
    this.refreshTick();
    const q = this.filtro.trim().toLowerCase();
    return this.usuarios().filter((u) => {
      if (this.estado === 'activos' && !u.is_active) return false;
      if (this.estado === 'inactivos' && u.is_active) return false;
      if (!q) return true;
      const texto = [u.name, u.email, ...u.roles.map((r) => etiquetaRol(r))]
        .join(' ')
        .toLowerCase();
      return texto.includes(q);
    });
  });

  constructor() {
    void this.cargar();
    // el ngModel de filtro/estado no dispara computeds: refrescar por intervalo corto.
    setInterval(() => this.refreshTick.update((n) => n + 1), 300);
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [usuarios, roles] = await Promise.all([
        this.api.listarUsuarios(),
        this.api.listarRoles().catch(() => []),
      ]);
      this.usuarios.set(usuarios);
      this.roles.set(roles);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected rolesDisponibles(u: UsuarioDirectorio): RolCatalogo[] {
    return this.roles().filter((r) => !u.roles.some((ur) => ur.role_id === r.role_id));
  }

  protected iniciarEdicion(u: UsuarioDirectorio): void {
    this.editando.set(u);
    this.nombreEdit = u.name;
    this.activoEdit = u.is_active;
  }

  protected async guardarEdicion(): Promise<void> {
    const u = this.editando();
    if (!u) return;
    this.guardando.set(true);
    try {
      await this.api.actualizarUsuario(u.user_id, this.nombreEdit, this.activoEdit);
      this.editando.set(null);
      this.error.set(null);
      await this.cargar();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected otorgar(u: UsuarioDirectorio, roleId: string): void {
    this.api
      .otorgarRol(u.user_id, roleId)
      .then(() => {
        this.error.set(null);
        return this.cargar();
      })
      .catch((e) => this.error.set(e instanceof Error ? e.message : String(e)));
  }

  protected revocar(u: UsuarioDirectorio, roleId: string): void {
    this.api
      .revocarRol(u.user_id, roleId)
      .then(() => this.cargar())
      .catch((e) => this.error.set(e instanceof Error ? e.message : String(e)));
  }

  protected async resolverNombre(): Promise<void> {
    const correo = this.email.trim().toLowerCase();
    if (!correo.includes('@')) return;
    this.resolviendo.set(true);
    try {
      this.nombreDir.set(await this.api.resolverNombreDirectorio(correo));
    } finally {
      this.resolviendo.set(false);
    }
  }

  protected toggleRolSel(id: string): void {
    this.rolesSel.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  protected cerrarCrear(): void {
    this.creando.set(false);
    this.email = '';
    this.rolesSel.set([]);
    this.nombreDir.set(null);
    this.errorCrear.set(null);
  }

  protected async crear(): Promise<void> {
    this.creandoUsuario.set(true);
    this.errorCrear.set(null);
    try {
      const nombre =
        this.nombreDir() ??
        (await this.api.resolverNombreDirectorio(this.email.trim().toLowerCase()));
      const { user_id } = await this.api.crearUsuario(this.email.trim(), nombre);
      for (const roleId of this.rolesSel()) {
        await this.api.otorgarRol(user_id, roleId);
      }
      this.cerrarCrear();
      await this.cargar();
    } catch (e) {
      this.errorCrear.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.creandoUsuario.set(false);
    }
  }
}
