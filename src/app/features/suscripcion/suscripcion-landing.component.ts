// Landing de la App "Suscripción de Seguros": tiles de módulos (estilo app Atajos de
// Apple). La bandeja vive en /apps/suscripcion/cotizaciones, la configuración del motor
// en /apps/suscripcion/motor y la del simulador en /apps/suscripcion/simulador.

import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';

interface SuscripcionModule {
  title: string;
  description: string;
  icon: string;
  path: string;
  /** Gradiente vivo de la tarjeta (estilo app Atajos de Apple) */
  gradient: string;
  hidden?: boolean;
  disabled?: boolean;
}

@Component({
  selector: 'alma-suscripcion-landing',
  imports: [LucideAngularModule, AccessDeniedComponent],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-5xl space-y-8 px-4 py-4 sm:px-6 sm:py-6">
        <!-- Large Title estilo Apple -->
        <div>
          <h1 class="text-on-wallpaper text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Suscripción de Seguros
          </h1>
          <p class="text-on-wallpaper mt-2 max-w-2xl text-sm text-foreground/80">
            Cotizaciones de Vida, evaluación del motor y parámetros de suscripción.
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
export class SuscripcionLandingComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Gateo por PERMISO (RBAC por App), no por nombre de rol: app.suscripcion.view
  // lo tienen analista, coordinador, el admin de la App y el de plataforma.
  protected readonly puedeVer = computed(() =>
    this.auth.hasPermission('app.suscripcion.view'),
  );

  protected readonly modulos = computed<SuscripcionModule[]>(() => {
    const todos: SuscripcionModule[] = [
      {
        title: 'Bandeja de Cotizaciones',
        description:
          'Cotizaciones de Vida sincronizadas de Pipeline: declaraciones, evaluación del motor y emisión.',
        icon: 'inbox',
        path: '/apps/suscripcion/cotizaciones',
        gradient: 'linear-gradient(150deg, #00C83C, #0089B8)',
      },
      {
        title: 'Configuración del motor de reglas',
        description:
          'Parámetros vigentes del motor de suscripción: edítalos sin depender de despliegues.',
        icon: 'sliders-horizontal',
        path: '/apps/suscripcion/motor',
        gradient: 'linear-gradient(150deg, #BF5AF2, #6D4AE0)',
        // SOLO coordinador y admins (el analista no lo ve).
        hidden: !this.auth.hasPermission('app.suscripcion.motor.config'),
      },
      {
        title: 'Plantillas de correo',
        description:
          'Galería de correos al FP con variables de la cotización: crea, edita y activa plantillas.',
        icon: 'mail',
        path: '/apps/suscripcion/plantillas',
        gradient: 'linear-gradient(150deg, #30D158, #0A84FF)',
      },
      {
        title: 'Configuración del Simulador de asegurabilidad',
        description:
          'Tablas de IMC, catálogos (preexistencias, ocupaciones, hobbies, países) y exámenes del simulador.',
        icon: 'calculator',
        path: '/apps/suscripcion/simulador',
        gradient: 'linear-gradient(150deg, #FF9F0A, #FF375F)',
        // SOLO coordinador y admins (el analista usa el simulador, no su config).
        hidden: !this.auth.hasPermission('app.suscripcion.simulador.config'),
      },
    ];
    return todos.filter((m) => !m.hidden);
  });

  protected irA(path: string): void {
    void this.router.navigateByUrl(path);
  }
}
