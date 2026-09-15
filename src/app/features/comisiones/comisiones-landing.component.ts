// Landing de la App "Motor de Comisiones": tiles de módulos (estilo app Atajos de
// Apple).

import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { MOTOR_COMISIONES_PERMS } from './motor-comisiones.permissions';

interface MotorModule {
  title: string;
  description: string;
  icon: string;
  path: string;
  /** Gradiente vivo de la tarjeta (estilo app Atajos de Apple) */
  gradient: string;
  /** Si falta, el tile se oculta. */
  visible?: boolean;
  disabled?: boolean;
}

@Component({
  selector: 'alma-comisiones-landing',
  imports: [LucideAngularModule, AccessDeniedComponent],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-5xl space-y-8 px-4 py-4 sm:px-6 sm:py-6">
        <!-- Large Title estilo Apple -->
        <div>
          <h1 class="text-on-wallpaper text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Motor de Comisiones
          </h1>
          <p class="text-on-wallpaper mt-2 max-w-2xl text-sm text-foreground/80">
            Planes de comisiones, catálogos, reglas y parametrización.
          </p>
        </div>

        <!-- Tarjetas estilo app Atajos de Apple -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (m of modulos(); track m.path) {
            <div
              role="button"
              [tabindex]="m.disabled ? -1 : 0"
              [attr.aria-disabled]="m.disabled"
              [style.background]="m.gradient"
              class="group relative flex min-h-36 flex-col justify-between overflow-hidden rounded-3xl p-4 text-white shadow-[var(--shadow-md)] transition-all duration-300"
              [class]="
                m.disabled
                  ? 'cursor-not-allowed opacity-55'
                  : 'cursor-pointer hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
              "
              (click)="!m.disabled && irA(m.path)"
              (keydown.enter)="!m.disabled && irA(m.path)"
              (keydown.space)="!m.disabled && irA(m.path)"
            >
              <!-- brillo sutil arriba, como los tiles de Atajos -->
              <div
                class="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(255,255,255,.28),transparent_60%)]"
              ></div>

              <div class="relative flex items-start justify-between">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/25 backdrop-blur-sm"
                >
                  <lucide-icon [name]="m.icon" [size]="20" [strokeWidth]="2" />
                </div>
                @if (m.disabled) {
                  <span class="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold">
                    Próximamente
                  </span>
                } @else {
                  <lucide-icon
                    name="move-right"
                    [size]="16"
                    class="opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-90"
                  />
                }
              </div>

              <div class="relative">
                <h2 class="text-[15px] font-bold leading-snug">{{ m.title }}</h2>
                <p class="mt-1 line-clamp-2 text-xs leading-snug text-white/85">
                  {{ m.description }}
                </p>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class ComisionesLandingComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Entra con acceso general o solo con el permiso de Desarrollo Comercial. */
  protected readonly puedeVer = computed(() =>
    this.auth.hasAnyPermission([
      MOTOR_COMISIONES_PERMS.view,
      MOTOR_COMISIONES_PERMS.desarrolloComercial,
    ]),
  );

  protected readonly modulos = computed<MotorModule[]>(() => {
    // Gateo por PERMISO (RBAC por App), no por nombre de rol.
    const puedeApp = this.auth.hasPermission(MOTOR_COMISIONES_PERMS.view);
    const puedeCatalogos = this.auth.hasPermission(MOTOR_COMISIONES_PERMS.catalogs);
    // Parametrización y ejecución ESCRIBEN en el motor: desde la migración 036
    // el backend les exige `config`. Sin este gate, el analista veía las
    // tarjetas y se estrellaba con un 403 al primer guardado.
    const puedeConfigurar = this.auth.hasPermission(MOTOR_COMISIONES_PERMS.config);
    // Desarrollo Comercial tiene rol propio (migración 037): lo ven ese rol,
    // el supervisor y el administrador. `view` ya NO alcanza — si no, el
    // analista, cuyo alcance son los planes, seguiría entrando.
    const puedeDesarrolloComercial = this.auth.hasPermission(
      MOTOR_COMISIONES_PERMS.desarrolloComercial,
    );

    const todos: MotorModule[] = [
      {
        title: 'Planes de Compensación',
        description:
          'Administra y configura planes de comisiones para diferentes canales y tipos de asesores',
        icon: 'calendar-cog',
        path: '/apps/motor-comisiones/compensation-plans',
        gradient: 'linear-gradient(150deg, #0A84FF, #30B0C7)',
        visible: puedeApp,
      },
      {
        title: 'Catálogos',
        description: 'Administra catálogos de datos utilizados para cálculos de comisiones',
        icon: 'columns-3-cog',
        path: '/apps/motor-comisiones/catalogs',
        gradient: 'linear-gradient(150deg, #BF5AF2, #6D4AE0)',
        visible: puedeCatalogos,
      },
      {
        title: 'Métricas y Reportes',
        description: 'Dashboard con métricas y análisis de comisiones para supervisores',
        icon: 'chart-column-stacked',
        path: '/apps/motor-comisiones/info-gerencial',
        gradient: 'linear-gradient(150deg, #30D158, #00A032)',
        visible: puedeApp,
      },
      {
        title: 'Parametrización',
        description: 'Configura reglas, tipos de comisión y parámetros financieros',
        icon: 'settings',
        path: '/apps/motor-comisiones/accounting',
        gradient: 'linear-gradient(150deg, #FF9F0A, #FF6B22)',
        visible: puedeConfigurar,
      },
      {
        title: 'Desarrollo Comercial',
        description: 'Clasificación de agentes y parámetros de desarrollo comercial',
        icon: 'users',
        path: '/apps/motor-comisiones/desarrollo-comercial',
        gradient: 'linear-gradient(150deg, #FF375F, #FF6482)',
        visible: puedeDesarrolloComercial,
      },
      {
        title: 'Ejecución del motor de Comisiones',
        description:
          'Lanza y monitorea los procesos del motor de comisiones y distribución de correos',
        icon: 'play',
        path: '/apps/motor-comisiones/ejecucion-motor',
        gradient: 'linear-gradient(150deg, #00C7BE, #0089B8)',
        visible: puedeConfigurar,
      },
    ];
    return todos.filter((m) => m.visible);
  });

  protected irA(path: string): void {
    void this.router.navigateByUrl(path);
  }
}
