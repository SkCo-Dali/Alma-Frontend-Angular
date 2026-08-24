// Inicio "command center": la esfera de Alma saluda sobre la escena solarpunk,
// con una barra para pedirle cosas al Agente, chips de acciones frecuentes y
// una fila de widgets (continuar trabajando, pendientes, actividad, novedades
// y accesos rápidos).
//
// Los widgets sin backend todavía (pendientes, actividad de procesos) muestran
// datos ILUSTRATIVOS marcados como tales aquí; cuando exista el API de
// resúmenes se conectan sin cambiar el layout.

import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ApplicationsService } from '../../core/services/applications.service';
import { LaunchpadService } from '../../core/services/launchpad.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { AlmaHousingComponent } from '../../shared/components/alma-housing.component';
import { AppIconArtComponent } from '../../shared/components/app-icon-art.component';
import { firstName } from '../../core/utils/name';
import { Application } from '../../core/models/platform.models';

/** Llave con la que el chat del Agente recoge un mensaje escrito desde Inicio. */
export const AGENTE_BORRADOR_KEY = 'alma-agente-borrador';

interface Chip {
  icon: string;
  label: string;
  /** Ruta interna, o prompt para el Agente si empieza con '>'. */
  action: string;
}

const CHIPS: Chip[] = [
  { icon: 'message-square-text', label: 'Consultar un caso', action: '>Quiero consultar el estado de un caso de Salesforce' },
  { icon: 'wallet', label: 'Buscar un cheque', action: '/apps/cheques' },
  { icon: 'bar-chart-3', label: 'Analizar datos', action: '>Ayúdame a analizar datos de la operación' },
  { icon: 'zap', label: 'Crear automatización', action: '>Quiero crear una automatización para un proceso repetitivo' },
];

interface Novedad {
  icon: string;
  tono: string;
  nuevo: boolean;
  titulo: string;
  texto: string;
  to?: string;
}

/** Novedades de la plataforma (contenido editorial, se actualiza a mano). */
const NOVEDADES: Novedad[] = [
  {
    icon: 'bar-chart-3',
    tono: 'text-primary bg-primary/10',
    nuevo: true,
    titulo: 'Nueva plataforma Angular',
    texto: 'ALMA ahora corre sobre su nueva base: más rápida y lista para apps de otros equipos.',
  },
  {
    icon: 'message-circle',
    tono: 'text-sky-600 bg-sky-500/10 dark:text-sky-400',
    nuevo: false,
    titulo: 'Usuarios SAC en ALMA',
    texto: 'La gestión de usuarios del SAC ya se abre aquí, con tu misma sesión.',
    to: '/apps/sac-usuarios',
  },
];

/** Pendientes: ilustrativos hasta que exista el API de resúmenes. */
const PENDIENTES = [
  { n: 3, label: 'Casos asignados', icon: 'briefcase', tono: 'text-amber-600 bg-amber-500/10 dark:text-amber-400' },
  { n: 2, label: 'Aprobaciones', icon: 'check-circle-2', tono: 'text-primary bg-primary/10' },
  { n: 1, label: 'Tarea urgente', icon: 'flag', tono: 'text-red-600 bg-red-500/10 dark:text-red-400' },
];

interface AccionRapida {
  icon: string;
  label: string;
  to?: string;
  prompt?: string;
}

const ACCIONES_RAPIDAS: AccionRapida[] = [
  { icon: 'file-text', label: 'Generar reporte', to: '/apps/motor-comisiones/info-gerencial' },
  { icon: 'file-down', label: 'Exportar información', to: '/apps/suscripcion/cotizaciones' },
  { icon: 'calendar-clock', label: 'Programar recordatorio', prompt: 'Quiero programar un recordatorio' },
  { icon: 'workflow', label: 'Crear flujo de trabajo', prompt: 'Quiero crear un flujo de trabajo' },
];

/** Sparkline ilustrativa del widget de actividad. */
const SPARK = [4, 6, 5, 8, 7, 10, 9, 12];

@Component({
  selector: 'alma-home',
  imports: [RouterLink, FormsModule, LucideAngularModule, AlmaHousingComponent, AppIconArtComponent],
  template: `
    <div class="mx-auto flex w-full max-w-[1480px] flex-col items-center">
      <!-- Saludo + esfera -->
      <div class="flex w-full flex-col items-center pt-2 text-center">
        <h1
          class="flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          {{ greeting() }}
          <lucide-icon name="sprout" [size]="26" class="text-primary" />
        </h1>
        <p class="mt-1.5 text-sm text-muted-foreground sm:text-base">¿Qué quieres lograr hoy?</p>
        <alma-housing [size]="210" [interactive]="true" class="-my-2" />
      </div>

      <!-- Pídeselo a Alma -->
      <form
        class="spk-prompt flex w-full max-w-2xl items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5"
        (submit)="$event.preventDefault(); enviarPrompt()"
      >
        <lucide-icon name="sparkles" [size]="17" class="shrink-0 text-primary" />
        <input
          type="text"
          name="prompt"
          [(ngModel)]="prompt"
          placeholder="Pregúntale o pídele algo a Alma…"
          autocomplete="off"
          class="h-9 w-full border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          aria-label="Enviar a Alma"
        >
          <lucide-icon name="arrow-up-right" [size]="17" />
        </button>
      </form>

      <!-- Acciones frecuentes -->
      <div class="mt-4 flex flex-wrap items-center justify-center gap-2.5">
        @for (chip of chips; track chip.label) {
          <button type="button" class="spk-chip" (click)="accionChip(chip)">
            <lucide-icon [name]="chip.icon" [size]="15" class="text-primary" />
            {{ chip.label }}
          </button>
        }
        <button type="button" class="spk-chip" (click)="launchpad.open.set(true)">
          <lucide-icon name="more-horizontal" [size]="15" class="text-primary" />
          Más acciones
        </button>
      </div>

      <!-- Widgets -->
      <div class="mt-8 grid w-full gap-4 md:grid-cols-2 xl:grid-cols-5">
        <!-- Continuar trabajando -->
        <section class="spk-card flex flex-col p-4">
          <header class="mb-2.5 flex items-baseline justify-between">
            <h2 class="text-sm font-semibold text-foreground">Continuar trabajando</h2>
            <button
              type="button"
              class="text-xs font-medium text-primary hover:underline"
              (click)="launchpad.open.set(true)"
            >
              Ver todo
            </button>
          </header>
          <div class="flex flex-col gap-1">
            @for (app of recientes(); track app.id) {
              <a
                [routerLink]="app.internalRoute ?? null"
                [attr.href]="app.internalRoute ? null : app.url"
                [attr.target]="app.internalRoute ? null : '_blank'"
                [attr.rel]="app.internalRoute ? null : 'noreferrer'"
                class="group flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-accent/60"
              >
                <span class="h-9 w-9 shrink-0 overflow-hidden rounded-[26%] shadow-sm">
                  <alma-app-icon-art [app]="app" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[13px] font-medium text-foreground">
                    {{ app.nombre }}
                  </span>
                  <span class="block truncate text-[11px] text-muted-foreground">
                    {{ app.lastUsedAt ?? app.categoria }}
                  </span>
                </span>
                <lucide-icon
                  name="chevron-right"
                  [size]="14"
                  class="text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
                />
              </a>
            } @empty {
              <p class="px-1.5 py-3 text-xs text-muted-foreground">
                Tus apps recientes aparecerán aquí.
              </p>
            }
          </div>
        </section>

        <!-- Pendientes para ti -->
        <section class="spk-card flex flex-col p-4">
          <header class="mb-2.5 flex items-baseline justify-between">
            <h2 class="text-sm font-semibold text-foreground">Pendientes para ti</h2>
            <span class="text-[11px] text-muted-foreground">Hoy</span>
          </header>
          <div class="flex flex-1 flex-col justify-center gap-2.5">
            @for (p of pendientes; track p.label) {
              <div class="flex items-center gap-3 px-1">
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  [class]="p.tono"
                >
                  <lucide-icon [name]="p.icon" [size]="17" />
                </span>
                <span class="flex items-baseline gap-2">
                  <span class="text-xl font-bold tabular-nums text-foreground">{{ p.n }}</span>
                  <span class="text-[13px] text-muted-foreground">{{ p.label }}</span>
                </span>
              </div>
            }
          </div>
        </section>

        <!-- Actividad de procesos -->
        <section class="spk-card flex flex-col p-4">
          <header class="mb-2 flex items-baseline justify-between">
            <h2 class="text-sm font-semibold text-foreground">Actividad de procesos</h2>
            <span class="text-[11px] text-muted-foreground">Hoy</span>
          </header>
          <div class="flex flex-1 flex-col items-center justify-center gap-1.5">
            <div class="relative h-[104px] w-[104px]">
              <svg viewBox="0 0 42 42" class="h-full w-full -rotate-90">
                <circle cx="21" cy="21" r="17.5" fill="none" stroke="var(--muted)" stroke-width="4.5" />
                <circle
                  cx="21" cy="21" r="17.5" fill="none"
                  stroke="var(--primary)" stroke-width="4.5" stroke-linecap="round"
                  [attr.stroke-dasharray]="donutDash"
                />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-2xl font-bold tabular-nums text-foreground">12</span>
                <span class="text-[9.5px] leading-tight text-muted-foreground">procesos<br />ejecutados</span>
              </div>
            </div>
            <span class="flex items-center gap-1 text-[11.5px] font-medium text-primary">
              <lucide-icon name="arrow-up" [size]="12" /> 25% vs. ayer
            </span>
            <svg viewBox="0 0 100 22" class="h-5 w-full max-w-[150px]" preserveAspectRatio="none">
              <path [attr.d]="sparkArea" fill="var(--primary)" opacity="0.12" />
              <path [attr.d]="sparkLine" fill="none" stroke="var(--primary)" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </div>
        </section>

        <!-- Novedades -->
        <section class="spk-card flex flex-col p-4">
          <header class="mb-2.5 flex items-baseline justify-between">
            <h2 class="text-sm font-semibold text-foreground">Novedades</h2>
          </header>
          <div class="flex flex-col gap-3">
            @for (n of novedades; track n.titulo) {
              <div class="flex items-start gap-2.5">
                <span
                  class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  [class]="n.tono"
                >
                  <lucide-icon [name]="n.icon" [size]="15" />
                </span>
                <div class="min-w-0">
                  @if (n.nuevo) {
                    <span
                      class="mb-0.5 inline-block rounded-full bg-primary px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary-foreground"
                    >
                      Nuevo
                    </span>
                  }
                  <p class="text-[13px] font-semibold leading-snug text-foreground">{{ n.titulo }}</p>
                  <p class="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{{ n.texto }}</p>
                  @if (n.to) {
                    <a
                      [routerLink]="n.to"
                      class="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline"
                    >
                      Conocer más <lucide-icon name="move-right" [size]="12" />
                    </a>
                  }
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Acciones rápidas -->
        <section class="spk-card flex flex-col p-4">
          <header class="mb-1.5 flex items-baseline justify-between">
            <h2 class="text-sm font-semibold text-foreground">Acciones rápidas</h2>
          </header>
          <div class="flex flex-1 flex-col justify-center">
            @for (a of acciones; track a.label; let last = $last) {
              <button
                type="button"
                (click)="accionRapida(a)"
                class="group flex items-center gap-2.5 py-2 text-left"
                [class.border-b]="!last"
                [class.border-border/50]="!last"
              >
                <lucide-icon [name]="a.icon" [size]="16" class="shrink-0 text-primary" />
                <span class="flex-1 text-[13px] font-medium text-foreground">{{ a.label }}</span>
                <lucide-icon
                  name="chevron-right"
                  [size]="14"
                  class="text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
                />
              </button>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class HomeComponent {
  private readonly auth = inject(AuthService);
  private readonly apps = inject(ApplicationsService);
  private readonly prefs = inject(PreferencesService);
  private readonly router = inject(Router);
  protected readonly launchpad = inject(LaunchpadService);

  protected prompt = '';
  protected readonly chips = CHIPS;
  protected readonly novedades = NOVEDADES;
  protected readonly pendientes = PENDIENTES;
  protected readonly acciones = ACCIONES_RAPIDAS;

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `${saludo}, ${firstName(this.auth.user().nombre)}`;
  });

  /** Recientes (orden de uso), con favoritos como respaldo el primer día. */
  protected readonly recientes = computed<Application[]>(() => {
    const porId = new Map(this.apps.applications().map((a) => [a.id, a]));
    const recientes = this.prefs
      .recentApps()
      .map((id) => porId.get(id))
      .filter((a): a is Application => !!a);
    const respaldo = this.apps.favorites().filter((a) => !recientes.includes(a));
    return [...recientes, ...respaldo].slice(0, 3);
  });

  // Donut: 12 de 16 procesos del día (ilustrativo) sobre circunferencia 2π·17.5
  protected readonly donutDash = `${(12 / 16) * 110} 110`;
  protected readonly sparkLine = sparkPath(false);
  protected readonly sparkArea = sparkPath(true);

  protected enviarPrompt(): void {
    const texto = this.prompt.trim();
    this.irAlAgente(texto || undefined);
  }

  protected accionChip(chip: Chip): void {
    if (chip.action.startsWith('>')) this.irAlAgente(chip.action.slice(1));
    else void this.router.navigateByUrl(chip.action);
  }

  protected accionRapida(a: AccionRapida): void {
    if (a.prompt) this.irAlAgente(a.prompt);
    else if (a.to) void this.router.navigateByUrl(a.to);
  }

  /** Abre el Agente Alma; si hay texto, el chat lo envía apenas cargue. */
  private irAlAgente(texto?: string): void {
    if (texto) {
      try {
        sessionStorage.setItem(AGENTE_BORRADOR_KEY, texto);
      } catch {
        /* sin sessionStorage el usuario simplemente vuelve a escribirlo */
      }
    }
    this.prompt = '';
    void this.router.navigateByUrl('/apps/agente-alma');
  }
}

/** Traza la sparkline (y su área) del widget de actividad. */
function sparkPath(area: boolean): string {
  const max = Math.max(...SPARK);
  const pts = SPARK.map((v, i) => {
    const x = (i / (SPARK.length - 1)) * 100;
    const y = 20 - (v / max) * 17;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const linea = `M${pts.join(' L')}`;
  return area ? `${linea} L100 22 L0 22 Z` : linea;
}
