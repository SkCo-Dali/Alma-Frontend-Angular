// Landing de la App "Buzón Inteligente": explica el flujo en 4 pasos (para que se
// entienda de un vistazo) y abre los módulos con tiles estilo Atajos, como Suscripción.

import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { Buzon, BuzonApi } from './buzon.api';
import { DemoBadgeComponent } from './demo-badge.component';

interface Modulo {
  title: string;
  description: string;
  icon: string;
  path: string;
  gradient: string;
  hidden?: boolean;
}

@Component({
  selector: 'alma-buzon-landing',
  imports: [LucideAngularModule, AccessDeniedComponent, DemoBadgeComponent],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-5xl space-y-8 px-4 py-4 sm:px-6 sm:py-6">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-on-wallpaper text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Buzón Inteligente
            </h1>
            <p class="text-on-wallpaper mt-2 max-w-2xl text-sm text-foreground/80">
              Cada área describe qué correos recibe y qué hacer con cada uno. Alma los lee, incluidos
              los adjuntos, los clasifica y ejecuta la acción o la deja lista para aprobar.
            </p>
          </div>
          <alma-demo-badge />
        </div>

        <!-- Resumen vivo -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          @for (k of kpis(); track k.label) {
            <div class="glass rounded-2xl px-4 py-3 shadow-[var(--shadow-sm)]">
              <p class="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <lucide-icon [name]="k.icon" [size]="12" /> {{ k.label }}
              </p>
              <p class="mt-0.5 text-2xl font-bold tabular-nums text-foreground">{{ k.valor }}</p>
            </div>
          }
        </div>

        <!-- Tiles -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          @for (m of modulos(); track m.path) {
            <div
              role="button"
              tabindex="0"
              [style.background]="m.gradient"
              class="group relative flex min-h-36 cursor-pointer flex-col justify-between overflow-hidden rounded-3xl p-4 text-white shadow-[var(--shadow-md)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              (click)="irA(m.path)"
              (keydown.enter)="irA(m.path)"
              (keydown.space)="irA(m.path)"
            >
              <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(255,255,255,.28),transparent_60%)]"></div>
              <div class="relative flex items-start justify-between">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/25 backdrop-blur-sm">
                  <lucide-icon [name]="m.icon" [size]="20" [strokeWidth]="2" />
                </div>
                <lucide-icon name="move-right" [size]="16" class="opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-90" />
              </div>
              <div class="relative">
                <h2 class="text-[15px] font-bold leading-snug">{{ m.title }}</h2>
                <p class="mt-1 line-clamp-2 text-xs leading-snug text-white/85">{{ m.description }}</p>
              </div>
            </div>
          }
        </div>

        <!-- Cómo funciona -->
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <h2 class="text-sm font-semibold text-foreground">Cómo funciona</h2>
          <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            @for (p of pasos; track p.titulo; let i = $index) {
              <div class="relative flex gap-3">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" [style.background]="p.color">
                  <lucide-icon [name]="p.icon" [size]="18" />
                </div>
                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paso {{ i + 1 }}</p>
                  <p class="text-sm font-semibold text-foreground">{{ p.titulo }}</p>
                  <p class="mt-0.5 text-xs leading-snug text-muted-foreground">{{ p.texto }}</p>
                </div>
              </div>
            }
          </div>
        </section>
      </div>
    }
  `,
})
export class BuzonLandingComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(BuzonApi);

  protected readonly puedeVer = computed(() => this.auth.hasPermission('app.buzon-inteligente.view'));
  protected readonly buzones = signal<Buzon[]>([]);

  protected readonly pasos = [
    { titulo: 'Llega el correo', texto: 'Alma vigila la carpeta del buzón del área cada pocos minutos.', icon: 'inbox', color: 'linear-gradient(150deg,#0089B8,#00C83C)' },
    { titulo: 'Lo lee completo', texto: 'Cuerpo y adjuntos: PDF, imágenes y Excel pasan por lectura de documentos.', icon: 'scan-text', color: 'linear-gradient(150deg,#6D4AE0,#BF5AF2)' },
    { titulo: 'Clasifica y extrae', texto: 'Con el contexto que dio el área decide la categoría, la confianza y los datos clave.', icon: 'sparkles', color: 'linear-gradient(150deg,#FF9F0A,#FF375F)' },
    { titulo: 'Actúa o sugiere', texto: 'Etiqueta, mueve, reenvía o asigna. Si duda, lo deja en la bandeja para aprobar en un clic.', icon: 'zap', color: 'linear-gradient(150deg,#00C83C,#0089B8)' },
  ];

  protected readonly kpis = computed(() => {
    const b = this.buzones();
    return [
      { label: 'Buzones activos', valor: b.filter((x) => x.activo).length, icon: 'mail' },
      { label: 'Por revisar', valor: b.reduce((n, x) => n + x.en_revision, 0), icon: 'mail-warning' },
      { label: 'Ejecutados hoy', valor: b.reduce((n, x) => n + x.ejecutados_hoy, 0), icon: 'mail-check' },
      { label: 'Categorías', valor: b.reduce((n, x) => n + x.categorias_count, 0), icon: 'tags' },
    ];
  });

  protected readonly modulos = computed<Modulo[]>(() =>
    (<Modulo[]>[
      {
        title: 'Bandeja de revisión',
        description: 'Correos clasificados por la IA: aprueba, corrige o ignora en un clic y mira qué se ejecutó.',
        icon: 'inbox',
        path: '/apps/buzon-inteligente/bandeja',
        gradient: 'linear-gradient(150deg, #00C83C, #0089B8)',
      },
      {
        title: 'Buzones y reglas',
        description: 'Registra el buzón del área, describe los tipos de correo y define las acciones.',
        icon: 'sliders-horizontal',
        path: '/apps/buzon-inteligente/buzones',
        gradient: 'linear-gradient(150deg, #BF5AF2, #6D4AE0)',
      },
      {
        title: 'Métricas y auditoría',
        description: 'Volumen por categoría, precisión de la IA y la traza de cada acción ejecutada.',
        icon: 'bar-chart-3',
        path: '/apps/buzon-inteligente/metricas',
        gradient: 'linear-gradient(150deg, #FF9F0A, #FF375F)',
      },
    ]).filter((m) => !m.hidden),
  );

  constructor() {
    void this.api.listarBuzones().then((b) => this.buzones.set(b)).catch(() => this.buzones.set([]));
  }

  protected irA(path: string): void {
    void this.router.navigateByUrl(path);
  }
}
