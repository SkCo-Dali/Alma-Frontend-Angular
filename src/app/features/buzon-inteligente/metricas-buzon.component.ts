// Métricas y auditoría del Buzón Inteligente: KPIs, volumen por categoría, serie de
// 14 días (SVG propio, sin librerías) y la traza de las últimas acciones ejecutadas.

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { Buzon, BuzonApi, Metricas, iconoAccion, nombreAccion } from './buzon.api';
import { DemoBadgeComponent } from './demo-badge.component';

@Component({
  selector: 'alma-metricas-buzon',
  imports: [FormsModule, RouterLink, LucideAngularModule, AccessDeniedComponent, AlmaLoaderComponent, DemoBadgeComponent],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-6xl space-y-5 px-4 py-4 sm:px-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <a routerLink="/apps/buzon-inteligente" class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary">
              <lucide-icon name="arrow-left" [size]="16" /> Buzón Inteligente
            </a>
            <div>
              <h1 class="text-on-wallpaper text-2xl font-bold tracking-tight text-foreground">Métricas y auditoría</h1>
              <p class="text-on-wallpaper text-sm text-foreground/80">Qué llega, qué hace Alma sola y qué tan bien le va.</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <alma-demo-badge />
            <select class="alma-input w-48" [(ngModel)]="buzonId" (ngModelChange)="cargar()">
              <option value="">Todos los buzones</option>
              @for (b of buzones(); track b.id) { <option [value]="b.id">{{ b.nombre }}</option> }
            </select>
            <select class="alma-input w-32" [(ngModel)]="dias" (ngModelChange)="cargar()">
              <option [ngValue]="7">7 días</option>
              <option [ngValue]="30">30 días</option>
              <option [ngValue]="90">90 días</option>
            </select>
          </div>
        </div>

        @if (cargando()) {
          <div class="flex justify-center py-16"><alma-loader [size]="72" label="Calculando…" /></div>
        } @else if (m(); as m) {
          <!-- KPIs -->
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
            @for (k of kpis(); track k.label) {
              <div class="glass rounded-2xl px-4 py-3 shadow-[var(--shadow-sm)]">
                <p class="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><lucide-icon [name]="k.icon" [size]="12" /> {{ k.label }}</p>
                <p class="mt-0.5 text-2xl font-bold tabular-nums" [class]="k.clase">{{ k.valor }}</p>
                @if (k.sub) { <p class="text-[11px] text-muted-foreground">{{ k.sub }}</p> }
              </div>
            }
          </div>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <!-- Serie -->
            <section class="glass rounded-2xl p-5 shadow-[var(--shadow-sm)] lg:col-span-2">
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-semibold text-foreground">Correos por día</h2>
                <div class="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-emerald-500"></span> Ejecutados por Alma</span>
                  <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-amber-400"></span> A revisión</span>
                </div>
              </div>
              <svg [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" class="mt-3 h-48 w-full">
                @for (b of barras(); track b.fecha) {
                  <rect [attr.x]="b.x" [attr.y]="b.yRev" [attr.width]="b.w" [attr.height]="b.hRev" rx="3" class="fill-amber-400" />
                  <rect [attr.x]="b.x" [attr.y]="b.yEje" [attr.width]="b.w" [attr.height]="b.hEje" rx="3" class="fill-emerald-500" />
                  <text [attr.x]="b.x + b.w / 2" [attr.y]="alto - 4" text-anchor="middle" class="fill-[var(--muted-foreground)] text-[9px]">{{ b.dia }}</text>
                  <text [attr.x]="b.x + b.w / 2" [attr.y]="b.yRev - 3" text-anchor="middle" class="fill-[var(--foreground)] text-[9px] font-semibold">{{ b.total }}</text>
                }
              </svg>
            </section>

            <!-- Por categoría -->
            <section class="glass rounded-2xl p-5 shadow-[var(--shadow-sm)]">
              <h2 class="text-sm font-semibold text-foreground">Por tipo de correo</h2>
              <div class="mt-3 flex flex-col gap-2.5">
                @for (c of m.por_categoria; track c.clave) {
                  <div>
                    <div class="flex items-center justify-between text-xs">
                      <span class="inline-flex items-center gap-1.5 font-medium text-foreground"><span class="h-2.5 w-2.5 rounded-full" [style.background]="c.color || '#8E8E93'"></span>{{ c.nombre }}</span>
                      <span class="tabular-nums text-muted-foreground">{{ c.total }}</span>
                    </div>
                    <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]"><div class="h-full rounded-full" [style.background]="c.color || '#8E8E93'" [style.width.%]="(c.total / maxCategoria()) * 100"></div></div>
                  </div>
                }
              </div>
            </section>
          </div>

          <!-- Últimas ejecuciones -->
          <section class="glass overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
            <div class="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <h2 class="text-sm font-semibold text-foreground">Últimas acciones ejecutadas</h2>
              <a routerLink="/apps/buzon-inteligente/bandeja" [queryParams]="{ estado: 'ejecutado' }" class="text-xs font-medium text-primary hover:underline">Ver bandeja</a>
            </div>
            @if (!m.ultimas_ejecuciones.length) {
              <p class="p-8 text-center text-sm text-muted-foreground">Todavía no hay acciones ejecutadas.</p>
            } @else {
              <div class="overflow-x-auto">
                <table class="alma-table">
                  <thead><tr><th>Cuándo</th><th>Acción</th><th>Correo</th><th>Buzón</th><th>Resultado</th><th>Por</th></tr></thead>
                  <tbody>
                    @for (e of m.ultimas_ejecuciones; track e.id) {
                      <tr>
                        <td class="whitespace-nowrap text-xs text-muted-foreground">{{ fecha(e.ejecutado_en) }}</td>
                        <td><span class="inline-flex items-center gap-1.5 text-sm"><lucide-icon [name]="icono(e.tipo)" [size]="14" class="text-primary" /> {{ nombre(e.tipo) }}</span>@if (e.detalle) { <p class="text-[11px] text-muted-foreground">{{ e.detalle }}</p> }</td>
                        <td class="max-w-72 truncate text-sm">{{ e.asunto }}</td>
                        <td class="text-xs">{{ e.buzon_nombre }}</td>
                        <td><span class="alma-badge" [class]="'alma-badge ' + claseResultado(e.resultado)">{{ e.resultado }}</span></td>
                        <td class="text-xs text-muted-foreground">{{ e.ejecutado_por }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        }
      </div>
    }
  `,
})
export class MetricasBuzonComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  protected readonly puedeVer = computed(() => this.auth.hasPermission('app.buzon-inteligente.view'));
  protected readonly buzones = signal<Buzon[]>([]);
  protected readonly m = signal<Metricas | null>(null);
  protected readonly cargando = signal(true);
  protected buzonId = '';
  protected dias = 30;

  protected readonly ancho = 560;
  protected readonly alto = 190;
  protected readonly icono = iconoAccion;
  protected readonly nombre = nombreAccion;

  protected readonly maxCategoria = computed(() => Math.max(1, ...(this.m()?.por_categoria.map((c) => c.total) ?? [1])));

  protected readonly kpis = computed(() => {
    const m = this.m();
    if (!m) return [];
    const pct = m.total ? Math.round((m.automatizados / m.total) * 100) : 0;
    return [
      { label: 'Correos procesados', valor: m.total, icon: 'mail', clase: 'text-foreground', sub: `últimos ${this.dias} días` },
      { label: 'Resueltos por Alma', valor: `${pct}%`, icon: 'zap', clase: 'text-emerald-600', sub: `${m.automatizados} sin intervención` },
      { label: 'Precisión de la IA', valor: m.precision.porcentaje !== null ? `${m.precision.porcentaje}%` : '—', icon: 'target', clase: 'text-primary', sub: `${m.precision.coincidencias} de ${m.precision.decisiones_humanas} decisiones humanas coinciden` },
      { label: 'Por revisar', valor: m.por_estado['revision'] ?? 0, icon: 'mail-warning', clase: 'text-amber-600', sub: `${m.por_estado['error'] ?? 0} con error` },
      { label: 'Tiempo a decisión', valor: m.tiempo_medio_decision_min !== null ? this.duracion(m.tiempo_medio_decision_min) : '—', icon: 'timer', clase: 'text-foreground', sub: 'promedio desde que llega' },
    ];
  });

  protected readonly barras = computed(() => {
    const serie = this.m()?.serie ?? [];
    if (!serie.length) return [];
    const max = Math.max(1, ...serie.map((s) => s.total));
    const gap = 6;
    const w = (this.ancho - gap * (serie.length + 1)) / serie.length;
    const hMax = this.alto - 28;
    return serie.map((s, i) => {
      const hEje = (s.ejecutados / max) * hMax;
      const hRev = (s.revision / max) * hMax;
      const yEje = this.alto - 16 - hEje;
      const yRev = yEje - hRev;
      return { fecha: s.fecha, dia: s.fecha.slice(8, 10), total: s.total, x: gap + i * (w + gap), w, hEje, hRev, yEje, yRev };
    });
  });

  constructor() {
    void this.api.listarBuzones().then((b) => this.buzones.set(b)).catch(() => undefined);
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.m.set(await this.api.metricas(this.buzonId || undefined, Number(this.dias)));
    } catch (e) {
      this.toast.error('No se pudieron cargar las métricas', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected duracion(min: number): string {
    if (min < 1) return `${Math.round(min * 60)} s`;
    if (min < 60) return `${min.toFixed(min < 10 ? 1 : 0)} min`;
    return `${(min / 60).toFixed(1)} h`;
  }
  protected fecha(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  protected claseResultado(r: string): string {
    return r === 'ok' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : r === 'error' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-slate-500/15 text-slate-600 dark:text-slate-300';
  }
}
