// Inicio de la App "Buzón Inteligente" (propuesta 5, validada con el negocio):
// encabezado centrado, tres botones «vivos» (Bandeja, Buzones, Métricas) con datos
// reales de /resumen y, debajo, el flujo «Cómo funciona · hoy» con los conteos del
// día. Pasar sobre un botón ilumina el paso del flujo del que viene.
// El revisor no ve el botón Buzones (no configura nada).

import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { Buzon, BuzonApi, Correo, PERM_ADMIN_BUZON, PERM_VER_BUZON, ResumenInicio } from './buzon.api';
import { DemoBadgeComponent } from './demo-badge.component';

interface Paso {
  icon: string;
  titulo: string;
  texto: string;
  gradiente: string;
}

const G_BANDEJA = 'linear-gradient(150deg, #00C83C, #0089B8)';
const G_BUZONES = 'linear-gradient(150deg, #BF5AF2, #6D4AE0)';
const G_METRICAS = 'linear-gradient(150deg, #FF9F0A, #FF375F)';
const REFRESCO_MS = 60_000;

@Component({
  selector: 'alma-buzon-landing',
  imports: [DecimalPipe, LucideAngularModule, AccessDeniedComponent, DemoBadgeComponent],
  styles: [
    `
      .bz-pulse { animation: bz-pulse 2s infinite; }
      @keyframes bz-pulse {
        0% { box-shadow: 0 0 0 0 rgb(16 185 129 / 0.6); }
        70% { box-shadow: 0 0 0 8px transparent; }
        100% { box-shadow: 0 0 0 0 transparent; }
      }
      .bz-tile { transition: transform 0.25s, box-shadow 0.25s; }
      .bz-tile:hover, .bz-tile:focus-visible { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
      .bz-tile .bz-cta { transition: gap 0.2s; }
      .bz-tile:hover .bz-cta { gap: 10px; }
      .bz-track {
        position: absolute; left: 6%; right: 6%; top: 28px; height: 2px; z-index: 0;
        background: repeating-linear-gradient(90deg, color-mix(in oklch, var(--foreground) 18%, transparent) 0 6px, transparent 6px 12px);
      }
      .bz-track i {
        position: absolute; top: -3px; width: 8px; height: 8px; border-radius: 9999px;
        background: var(--primary); animation: bz-travel 5s linear infinite;
      }
      .bz-track i:nth-child(2) { animation-delay: -1.7s; }
      .bz-track i:nth-child(3) { animation-delay: -3.4s; }
      @keyframes bz-travel { from { left: 0; } to { left: 100%; } }
      .bz-node { transition: background 0.25s, box-shadow 0.25s, transform 0.25s; }
      .bz-node.bz-lit, .bz-node[aria-expanded='true'] {
        background: color-mix(in oklch, var(--card) 85%, transparent);
        box-shadow: var(--shadow-md);
        transform: translateY(-3px);
      }
      @media (prefers-reduced-motion: reduce) {
        .bz-pulse, .bz-track i { animation: none; }
        .bz-track i { display: none; }
        .bz-tile, .bz-node, .bz-tile .bz-cta { transition: none; }
        .bz-tile:hover, .bz-tile:focus-visible, .bz-node.bz-lit, .bz-node[aria-expanded='true'] { transform: none; }
      }
    `,
  ],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-6xl space-y-6 px-4 py-4 sm:px-6 sm:py-6">
        <!-- Encabezado centrado -->
        <header class="grid justify-items-center gap-2.5 pt-1 text-center">
          <h1 class="text-on-wallpaper text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">Buzón Inteligente</h1>
          <p class="text-on-wallpaper max-w-2xl text-sm text-foreground/80">
            Cada área describe qué correos recibe, qué datos necesita de cada uno y a quién le corresponden. Alma los lee,
            incluidos los adjuntos, los clasifica y los asigna a la persona indicada.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-2.5">
            <span class="text-on-wallpaper inline-flex items-center gap-1.5 text-xs text-foreground/75" aria-live="polite">
              <span class="bz-pulse h-2 w-2 rounded-full bg-emerald-500"></span>
              @if (actualizadoEn()) { Actualizado {{ haceTxt() }} } @else { Cargando… }
            </span>
            <alma-demo-badge />
          </div>
        </header>

        @if (error(); as e) {
          <p class="glass mx-auto flex max-w-xl items-start gap-2 rounded-2xl px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
            <lucide-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0" /> No se pudo cargar el resumen: {{ e }}
          </p>
        }

        <!-- Botones vivos -->
        <div class="grid grid-cols-1 gap-3.5" [class]="puedeConfigurar() ? 'lg:grid-cols-3' : 'lg:grid-cols-2'">
          <!-- Bandeja -->
          <button
            type="button"
            class="bz-tile relative flex min-h-[340px] min-w-0 flex-col gap-3.5 overflow-hidden rounded-3xl p-[18px] text-left text-white shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            [style.background]="g.bandeja"
            (click)="irBandeja()"
            (mouseenter)="lit.set(2)" (mouseleave)="lit.set(null)" (focus)="lit.set(2)" (blur)="lit.set(null)"
          >
            <span class="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(255,255,255,.28),transparent_60%)]"></span>
            <span class="relative flex items-center justify-between gap-2">
              <span class="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/25"><lucide-icon name="inbox" [size]="21" /></span>
              @if (validar() > 0 && flujo()?.validar_desde) {
                <span class="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#FFD60A] px-2 py-0.5 text-[11px] font-bold text-[#3a2a00]">
                  <lucide-icon name="clock-3" [size]="12" /> En espera desde {{ duracion(flujo()!.validar_desde!) }}
                </span>
              }
            </span>
            <span class="relative inline-flex items-center gap-1.5 self-start rounded-full bg-black/15 px-2.5 py-0.5 text-[11px] font-bold">
              <lucide-icon name="corner-left-down" [size]="12" /> Paso 3 · cuando Alma duda
            </span>
            <span class="relative">
              <span class="block text-[17px] font-bold leading-snug">Bandeja de revisión</span>
              <span class="mt-0.5 block text-[13px] text-white/90">Correos clasificados: aprueba, corrige o reclasifica en un clic.</span>
            </span>
            <span class="relative flex items-baseline gap-2">
              <span class="text-[2.4rem] font-extrabold leading-none tabular-nums tracking-tight">{{ validar() }}</span>
              <span class="text-[13px] text-white/90">{{ validar() === 1 ? 'correo en Validar' : 'correos en Validar' }}</span>
            </span>
            <span class="relative grid min-w-0 gap-1.5">
              @for (c of pendientes(); track c.id) {
                <span class="flex min-w-0 items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-2.5 py-1.5 text-[13px]">
                  <span class="min-w-0 flex-1 truncate">{{ c.asunto }}</span>
                  @if (c.categoria_clave) { <span class="max-w-[40%] truncate rounded-full bg-white/25 px-2 py-px text-[11px] font-bold">{{ c.categoria_clave }}</span> }
                  @if (c.confianza !== null) { <span class="text-[11px] tabular-nums">{{ c.confianza * 100 | number: '1.0-0' }}%</span> }
                </span>
              } @empty {
                @if (actualizadoEn()) {
                  <span class="flex items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-2.5 py-1.5 text-[13px]">
                    <lucide-icon name="check-circle-2" [size]="14" /> Nada pendiente: todo al día.
                  </span>
                }
              }
            </span>
            <span class="bz-cta relative mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-white/95 px-3 py-1.5 text-[13px] font-bold text-[#1c1c1e]">
              Revisar ahora <lucide-icon name="arrow-right" [size]="14" />
            </span>
          </button>

          <!-- Buzones (solo quien configura) -->
          @if (puedeConfigurar()) {
            <button
              type="button"
              class="bz-tile relative flex min-h-[340px] min-w-0 flex-col gap-3.5 overflow-hidden rounded-3xl p-[18px] text-left text-white shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              [style.background]="g.buzones"
              (click)="irA('/apps/buzon-inteligente/buzones')"
              (mouseenter)="lit.set('todos')" (mouseleave)="lit.set(null)" (focus)="lit.set('todos')" (blur)="lit.set(null)"
            >
              <span class="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(255,255,255,.28),transparent_60%)]"></span>
              <span class="relative flex items-center justify-between gap-2">
                <span class="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/25"><lucide-icon name="sliders-horizontal" [size]="21" /></span>
                @if (alertas().length) {
                  <span class="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#C4183C]">{{ alertas().length }} por atender</span>
                }
              </span>
              <span class="relative inline-flex items-center gap-1.5 self-start rounded-full bg-black/15 px-2.5 py-0.5 text-[11px] font-bold">
                <lucide-icon name="corner-left-down" [size]="12" /> Define los pasos 1 a 4
              </span>
              <span class="relative">
                <span class="block text-[17px] font-bold leading-snug">Buzones</span>
                <span class="mt-0.5 block text-[13px] text-white/90">Configura los procesos, las reglas y la asignación (grupos, equipo y bases) de cada buzón.</span>
              </span>
              <span class="relative grid min-w-0 gap-1.5">
                @for (b of buzonesTile(); track b.id) {
                  <span class="flex min-w-0 items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-2.5 py-1.5 text-[13px]">
                    <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="b.estado_conexion === 'conectada' && b.activo ? '#30D158' : '#ffffff'" [attr.aria-label]="b.estado_conexion === 'conectada' ? 'Conectado' : 'Sin conexión'"></span>
                    <span class="min-w-0 flex-1 truncate font-semibold">{{ b.nombre }}</span>
                    <span class="shrink-0 text-[11px] text-white/90">{{ estadoLectura(b) }}</span>
                  </span>
                }
                @for (a of alertas().slice(0, 3); track $index) {
                  <span class="flex min-w-0 items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-2.5 py-1.5 text-[13px]">
                    <lucide-icon [name]="iconoAlerta(a.tipo)" [size]="14" class="shrink-0" />
                    <span class="min-w-0 flex-1 truncate">{{ a.texto }}</span>
                  </span>
                }
                @if (alertas().length > 3) { <span class="text-[11px] text-white/85">y {{ alertas().length - 3 }} más</span> }
              </span>
              <span class="bz-cta relative mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-white/95 px-3 py-1.5 text-[13px] font-bold text-[#1c1c1e]">
                Configurar <lucide-icon name="arrow-right" [size]="14" />
              </span>
            </button>
          }

          <!-- Métricas -->
          <button
            type="button"
            class="bz-tile relative flex min-h-[340px] min-w-0 flex-col gap-3.5 overflow-hidden rounded-3xl p-[18px] text-left text-white shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            [style.background]="g.metricas"
            (click)="irA('/apps/buzon-inteligente/metricas')"
            (mouseenter)="lit.set(3)" (mouseleave)="lit.set(null)" (focus)="lit.set(3)" (blur)="lit.set(null)"
          >
            <span class="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(255,255,255,.28),transparent_60%)]"></span>
            <span class="relative flex items-center justify-between gap-2">
              <span class="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/25"><lucide-icon name="bar-chart-3" [size]="21" /></span>
              @if (variacion(); as v) {
                <span class="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold">
                  <lucide-icon [name]="v >= 0 ? 'trending-up' : 'trending-down'" [size]="12" /> {{ v > 0 ? '+' : '' }}{{ v }}% vs ayer
                </span>
              }
            </span>
            <span class="relative inline-flex items-center gap-1.5 self-start rounded-full bg-black/15 px-2.5 py-0.5 text-[11px] font-bold">
              <lucide-icon name="corner-left-down" [size]="12" /> Mide el resultado del paso 4
            </span>
            <span class="relative">
              <span class="block text-[17px] font-bold leading-snug">Métricas y auditoría</span>
              <span class="mt-0.5 block text-[13px] text-white/90">Volumen por tipo de correo, precisión de la IA y la traza de cada acción ejecutada.</span>
            </span>
            <span class="relative flex flex-wrap gap-[18px]">
              <span class="grid"><b class="text-lg tabular-nums">{{ precision() !== null ? (precision()! | number: '1.0-0') + '%' : '—' }}</b><span class="text-[11px] text-white/85">precisión IA</span></span>
              <span class="grid"><b class="text-lg tabular-nums">{{ flujo()?.ejecutados ?? 0 }}</b><span class="text-[11px] text-white/85">ejecutados hoy</span></span>
              <span class="grid"><b class="text-lg tabular-nums">{{ flujo()?.asignados ?? 0 }}</b><span class="text-[11px] text-white/85">asignados hoy</span></span>
            </span>
            <span class="relative block">
              <svg class="block h-11 w-full" viewBox="0 0 200 44" preserveAspectRatio="none" aria-hidden="true">
                <path [attr.d]="spark().area" fill="#fff" fill-opacity=".18" />
                <path [attr.d]="spark().linea" fill="none" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
              </svg>
              <span class="text-[11px] text-white/85">Ejecutados por día · última semana</span>
            </span>
            <span class="bz-cta relative mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-white/95 px-3 py-1.5 text-[13px] font-bold text-[#1c1c1e]">
              Ver métricas <lucide-icon name="arrow-right" [size]="14" />
            </span>
          </button>
        </div>

        <!-- Cómo funciona · hoy -->
        <section class="glass grid gap-2 rounded-3xl px-4 py-3.5 shadow-[var(--shadow-sm)] sm:px-5" aria-labelledby="bz-flujo">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="bz-flujo" class="text-[15px] font-bold text-foreground">Cómo funciona · hoy</h2>
            <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span class="bz-pulse h-2 w-2 rounded-full bg-emerald-500"></span> En vivo · toca un paso para ver qué hace</span>
          </div>
          <div class="relative grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <div class="bz-track hidden md:block" aria-hidden="true"><i></i><i></i><i></i></div>
            @for (p of pasos; track p.titulo; let i = $index) {
              <button
                type="button"
                class="bz-node relative z-[1] grid justify-items-center gap-1 rounded-[18px] px-1.5 py-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [class.bz-lit]="iluminado(i)"
                [attr.aria-expanded]="abierto() === i"
                [attr.aria-controls]="'bz-paso-detalle'"
                (click)="abierto.set(abierto() === i ? null : i)"
              >
                <span class="flex h-10 w-10 items-center justify-center rounded-[13px] text-white shadow-[var(--shadow-md)]" [style.background]="p.gradiente"><lucide-icon [name]="p.icon" [size]="19" /></span>
                <span class="text-xl font-extrabold leading-tight tabular-nums text-foreground">{{ conteos()[i].n }}</span>
                <span class="text-xs font-semibold text-foreground">{{ p.titulo }}</span>
                <span class="text-[11px] leading-tight" [class]="conteos()[i].alerta ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-muted-foreground'">{{ conteos()[i].sub }}</span>
              </button>
            }
          </div>
          @if (abierto() !== null) {
            <p id="bz-paso-detalle" class="flex items-start gap-1.5 px-1 pb-0.5 pt-1 text-[13px] text-muted-foreground">
              <lucide-icon name="info" [size]="14" class="mt-0.5 shrink-0" />
              <span><b class="text-foreground">Paso {{ abierto()! + 1 }}.</b> {{ pasos[abierto()!].texto }}</span>
            </p>
          }
        </section>
      </div>
    }
  `,
})
export class BuzonLandingComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(BuzonApi);

  protected readonly g = { bandeja: G_BANDEJA, buzones: G_BUZONES, metricas: G_METRICAS };
  protected readonly puedeVer = computed(() => this.auth.hasPermission(PERM_VER_BUZON));

  protected readonly resumen = signal<ResumenInicio | null>(null);
  protected readonly buzones = signal<Buzon[]>([]);
  protected readonly pendientes = signal<Correo[]>([]);
  protected readonly precision = signal<number | null>(null);
  protected readonly actualizadoEn = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly ahora = signal(Date.now());

  /** Paso iluminado por el botón bajo el mouse: índice, 'todos' o null. */
  protected readonly lit = signal<number | 'todos' | null>(null);
  protected readonly abierto = signal<number | null>(null);

  protected readonly pasos: Paso[] = [
    { icon: 'inbox', titulo: 'Llega el correo', texto: 'Alma vigila la carpeta del buzón y reconoce si es la respuesta de un caso que ya existe.', gradiente: G_BANDEJA },
    { icon: 'scan-text', titulo: 'Lo lee completo', texto: 'Cuerpo y adjuntos: PDF, imágenes y Excel pasan por lectura de documentos.', gradiente: G_BUZONES },
    { icon: 'sparkles', titulo: 'Clasifica y estructura', texto: 'Con las reglas del área decide el proceso y la etiqueta y extrae los datos. Si duda, lo deja en Validar para que una persona lo revise.', gradiente: G_METRICAS },
    { icon: 'user-check', titulo: 'Asigna y entrega', texto: 'Busca al responsable en las bases del área, o reparte entre el equipo activo, y mueve el correo a su carpeta.', gradiente: G_BANDEJA },
  ];

  protected readonly esAdmin = computed(() => this.auth.hasPermission(PERM_ADMIN_BUZON));
  /** Admin o editor de algún buzón. El revisor no ve «Buzones». */
  protected readonly puedeConfigurar = computed(() => this.esAdmin() || this.buzones().some((b) => b.puede_administrar));

  protected readonly flujo = computed(() => this.resumen()?.flujo ?? null);
  protected readonly validar = computed(() => this.flujo()?.validar ?? 0);
  protected readonly alertas = computed(() => this.resumen()?.alertas ?? []);

  protected readonly buzonesTile = computed(() => {
    const editables = new Set(this.buzones().filter((b) => b.puede_administrar).map((b) => b.id));
    return (this.resumen()?.buzones ?? []).filter((b) => editables.has(b.id)).slice(0, 4);
  });

  protected readonly conteos = computed(() => {
    const f = this.flujo();
    const sinAsignar = this.resumen()?.sin_asignar ?? 0;
    return [
      { n: f?.llegaron ?? 0, sub: 'llegaron hoy', alerta: false },
      { n: f?.con_adjuntos ?? 0, sub: 'con adjuntos', alerta: false },
      { n: f?.clasificados ?? 0, sub: `${f?.validar ?? 0} a Validar`, alerta: (f?.validar ?? 0) > 0 },
      { n: f?.asignados ?? 0, sub: sinAsignar ? `${sinAsignar} sin asignar` : 'asignados', alerta: sinAsignar > 0 },
    ];
  });

  /** Serie de 7 días (hoy al final), con ceros en los días sin ejecutados. */
  private readonly semana = computed(() => {
    const porFecha = new Map((this.flujo()?.semana ?? []).map((d) => [d.fecha.slice(0, 10), d.ejecutados]));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10);
      return porFecha.get(d) ?? 0;
    });
  });

  protected readonly variacion = computed<number | null>(() => {
    const s = this.semana();
    const [ayer, hoy] = [s[5], s[6]];
    if (!ayer) return null;
    return Math.round(((hoy - ayer) / ayer) * 100);
  });

  protected readonly spark = computed(() => {
    const pts = this.semana();
    const w = 200;
    const h = 44;
    const max = Math.max(...pts, 1);
    const xy = pts.map((p, i) => [i * (w / (pts.length - 1)), h - 4 - (p / max) * (h - 10)]);
    const linea = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return { linea, area: `${linea} L ${w} ${h} L 0 ${h} Z` };
  });

  protected readonly haceTxt = computed(() => {
    const s = Math.max(0, Math.round((this.ahora() - (this.actualizadoEn() ?? this.ahora())) / 1000));
    return s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`;
  });

  constructor() {
    void this.cargar();
    const reloj = setInterval(() => this.ahora.set(Date.now()), 1000);
    const refresco = setInterval(() => void this.cargar(), REFRESCO_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(reloj);
      clearInterval(refresco);
    });
  }

  private async cargar(): Promise<void> {
    const [resumen, buzones, pendientes, metricas] = await Promise.allSettled([
      this.api.resumen(),
      this.api.listarBuzones(),
      this.api.listarCorreos({ estado: 'revision', limit: 3 }),
      this.api.metricas(undefined, 30),
    ]);
    if (resumen.status === 'fulfilled') {
      this.resumen.set(resumen.value);
      this.error.set(null);
    } else {
      this.error.set(resumen.reason instanceof Error ? resumen.reason.message : String(resumen.reason));
    }
    if (buzones.status === 'fulfilled') this.buzones.set(buzones.value);
    if (pendientes.status === 'fulfilled') this.pendientes.set(pendientes.value.data.slice(0, 3));
    if (metricas.status === 'fulfilled') this.precision.set(metricas.value.precision.porcentaje);
    this.actualizadoEn.set(Date.now());
  }

  protected iluminado(i: number): boolean {
    const l = this.lit();
    return l === 'todos' || l === i;
  }

  protected iconoAlerta(tipo: string): string {
    const iconos: Record<string, string> = { conexion: 'plug', error: 'alert-triangle', reglas: 'scroll-text', equipo: 'users', base: 'file-spreadsheet' };
    return iconos[tipo] ?? 'alert-triangle';
  }

  protected estadoLectura(b: { estado_conexion: string; activo: boolean; ultima_sincronizacion: string | null }): string {
    if (b.estado_conexion !== 'conectada') return 'Sin conexión';
    if (!b.activo) return 'Pausado';
    return b.ultima_sincronizacion ? `Leído ${this.hace(b.ultima_sincronizacion)}` : 'Aún sin leer';
  }

  private hace(iso: string): string {
    const min = Math.max(0, Math.round((this.ahora() - new Date(iso).getTime()) / 60_000));
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
  }

  /** «6 h», «25 min», «2 d» desde una fecha. */
  protected duracion(iso: string): string {
    const min = Math.max(0, Math.round((this.ahora() - new Date(iso).getTime()) / 60_000));
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
  }

  protected irBandeja(): void {
    void this.router.navigate(['/apps/buzon-inteligente/bandeja'], { queryParams: { estado: 'revision' } });
  }

  protected irA(path: string): void {
    void this.router.navigateByUrl(path);
  }
}
