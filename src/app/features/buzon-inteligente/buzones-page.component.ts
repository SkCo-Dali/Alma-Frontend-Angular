// Buzones del Buzón Inteligente: tarjetas por área con estado de conexión, modo,
// contadores y accesos a configurar / sincronizar / conectar. Alta con modal.

import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import { Buzon, BuzonApi, BuzonIn, EstadoConexion } from './buzon.api';
import { DemoBadgeComponent } from './demo-badge.component';

const CONEXION: Record<EstadoConexion, { nombre: string; clase: string; icon: string }> = {
  conectada: { nombre: 'Conectado', clase: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', icon: 'plug-zap' },
  app_only: { nombre: 'Acceso de plataforma', clase: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', icon: 'shield-check' },
  sin_conectar: { nombre: 'Sin conectar', clase: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', icon: 'plug' },
  requiere_reconexion: { nombre: 'Reconectar', clase: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', icon: 'alert-triangle' },
};

@Component({
  selector: 'alma-buzones-page',
  imports: [DecimalPipe, FormsModule, RouterLink, LucideAngularModule, AccessDeniedComponent, AlmaLoaderComponent, TooltipDirective, DemoBadgeComponent],
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
              <h1 class="text-on-wallpaper text-2xl font-bold tracking-tight text-foreground">Buzones y reglas</h1>
              <p class="text-on-wallpaper text-sm text-foreground/80">Un buzón por área. Cada uno tiene sus categorías, reglas y acciones.</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <alma-demo-badge />
            @if (puedeGestionar()) {
              <button type="button" class="alma-btn alma-btn-primary rounded-xl" (click)="abrirNuevo()">
                <lucide-icon name="plus" [size]="16" /> Nuevo buzón
              </button>
            }
          </div>
        </div>

        @if (cargando()) {
          <div class="flex justify-center py-16"><alma-loader [size]="72" label="Cargando buzones…" /></div>
        } @else if (buzones().length === 0) {
          <div class="glass flex flex-col items-center gap-3 rounded-3xl p-10 text-center">
            <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><lucide-icon name="mail" [size]="26" /></span>
            <p class="text-sm font-semibold text-foreground">Aún no hay buzones</p>
            <p class="max-w-sm text-xs text-muted-foreground">Registra el buzón de tu área y describe qué correos recibe. Alma empieza a clasificar en minutos.</p>
            @if (puedeGestionar()) {
              <button type="button" class="alma-btn alma-btn-primary rounded-xl" (click)="abrirNuevo()"><lucide-icon name="plus" [size]="16" /> Nuevo buzón</button>
            }
          </div>
        } @else {
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            @for (b of buzones(); track b.id) {
              <article class="glass flex flex-col gap-4 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex min-w-0 items-center gap-3">
                    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style="background:linear-gradient(150deg,#BF5AF2,#6D4AE0)">
                      <lucide-icon name="mail" [size]="20" />
                    </div>
                    <div class="min-w-0">
                      <h2 class="truncate text-base font-bold text-foreground">{{ b.nombre }}</h2>
                      <p class="truncate text-xs text-muted-foreground">{{ b.direccion }} @if (b.area) {· {{ b.area }}}</p>
                    </div>
                  </div>
                  <span class="alma-badge shrink-0 gap-1" [class]="'alma-badge shrink-0 gap-1 ' + conexion[b.estado_conexion].clase">
                    <lucide-icon [name]="conexion[b.estado_conexion].icon" [size]="12" /> {{ conexion[b.estado_conexion].nombre }}
                  </span>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <div class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2">
                    <p class="text-[11px] text-muted-foreground">Por revisar</p>
                    <p class="text-lg font-bold tabular-nums" [class.text-amber-600]="b.en_revision > 0">{{ b.en_revision }}</p>
                  </div>
                  <div class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2">
                    <p class="text-[11px] text-muted-foreground">Ejecutados hoy</p>
                    <p class="text-lg font-bold tabular-nums text-emerald-600">{{ b.ejecutados_hoy }}</p>
                  </div>
                  <div class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2">
                    <p class="text-[11px] text-muted-foreground">Categorías</p>
                    <p class="text-lg font-bold tabular-nums">{{ b.categorias_count }}</p>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span class="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
                    <lucide-icon [name]="b.modo === 'automatico' ? 'zap' : 'user-check'" [size]="12" />
                    {{ b.modo === 'automatico' ? 'Automático' : 'Solo sugiere' }} · umbral {{ (b.umbral_confianza * 100) | number: '1.0-0' }}%
                  </span>
                  <span class="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
                    <lucide-icon name="folder-open" [size]="12" /> {{ b.carpeta_vigilada === 'Inbox' ? 'Bandeja de entrada' : b.carpeta_vigilada }}
                  </span>
                  <span class="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5" [almaTooltip]="b.ultimo_error ?? ''">
                    <lucide-icon name="refresh-cw" [size]="12" />
                    {{ b.ultima_sincronizacion ? 'Sincronizado ' + hace(b.ultima_sincronizacion) : 'Nunca sincronizado' }}
                    @if (b.ultimo_error) { <lucide-icon name="alert-triangle" [size]="12" class="text-rose-500" /> }
                  </span>
                </div>

                <div class="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <div class="flex -space-x-1.5">
                    @for (m of b.miembros.slice(0, 4); track m.email) {
                      <span class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary/15 text-[10px] font-bold text-primary" [almaTooltip]="(m.name || m.email) + ' · ' + m.rol">{{ iniciales(m.name || m.email) }}</span>
                    }
                    @if (b.miembros.length === 0) { <span class="text-xs text-muted-foreground">Visible para toda la App</span> }
                  </div>
                  <div class="flex items-center gap-1.5">
                    @if (b.estado_conexion !== 'conectada' && b.estado_conexion !== 'app_only' && b.puede_administrar) {
                      <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" (click)="conectar(b)">
                        <lucide-icon name="plug" [size]="14" /> Conectar
                      </button>
                    }
                    @if (b.puede_administrar) {
                      <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="sincronizando() === b.id" (click)="sincronizar(b)">
                        <lucide-icon name="refresh-cw" [size]="14" [class.animate-spin]="sincronizando() === b.id" /> Sincronizar
                      </button>
                    }
                    <a [routerLink]="['/apps/buzon-inteligente/buzones', b.id]" class="alma-btn alma-btn-primary h-8 rounded-lg text-xs">
                      <lucide-icon name="sliders-horizontal" [size]="14" /> Configurar
                    </a>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      </div>

      <!-- Modal nuevo buzón -->
      @if (formAbierto()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cerrar()">
          <div class="surface-solid w-full max-w-lg rounded-2xl border border-border p-5 shadow-[var(--shadow-lg)]" (click)="$event.stopPropagation()">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <h2 class="text-sm font-semibold text-foreground">Nuevo buzón</h2>
                <p class="text-xs text-muted-foreground">La cuenta del área que recibe los correos. Después defines sus categorías.</p>
              </div>
              <button type="button" class="alma-btn alma-btn-ghost" (click)="cerrar()"><lucide-icon name="x" [size]="16" /></button>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5 sm:col-span-2">
                <label class="alma-label">Dirección de correo *</label>
                <input class="alma-input" [(ngModel)]="form.direccion" placeholder="area@skandia.com.co" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="alma-label">Nombre *</label>
                <input class="alma-input" [(ngModel)]="form.nombre" placeholder="Recaudos" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="alma-label">Área</label>
                <input class="alma-input" [(ngModel)]="form.area" placeholder="Recaudos Voluntarios" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="alma-label">Carpeta vigilada</label>
                <input class="alma-input" [(ngModel)]="form.carpeta_vigilada" placeholder="Inbox" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="alma-label">Modo</label>
                <select class="alma-input" [(ngModel)]="form.modo">
                  <option value="sugerir">Solo sugiere (revisión humana)</option>
                  <option value="automatico">Automático sobre el umbral</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5 sm:col-span-2">
                <label class="alma-label">Contexto del área para la IA</label>
                <textarea class="alma-input min-h-24 py-2" [(ngModel)]="form.contexto" placeholder="Qué hace el área, qué documentos suelen llegar, glosario, NIT, cuentas…"></textarea>
              </div>
            </div>
            @if (errorForm(); as e) { <p class="mt-3 text-xs text-destructive">{{ e }}</p> }
            <div class="mt-5 flex justify-end gap-2">
              <button type="button" class="alma-btn alma-btn-outline" (click)="cerrar()">Cancelar</button>
              <button type="button" class="alma-btn alma-btn-primary" [disabled]="!valido() || guardando()" (click)="guardar()">
                <lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="16" [class.animate-spin]="guardando()" /> Crear buzón
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class BuzonesPageComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly conexion = CONEXION;
  protected readonly puedeVer = computed(() => this.auth.hasPermission('app.buzon-inteligente.view'));
  protected readonly puedeGestionar = computed(() => this.auth.hasPermission('app.buzon-inteligente.manage'));

  protected readonly buzones = signal<Buzon[]>([]);
  protected readonly cargando = signal(true);
  protected readonly sincronizando = signal<string | null>(null);

  protected readonly formAbierto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorForm = signal<string | null>(null);
  protected form: BuzonIn = { direccion: '', nombre: '', area: '', carpeta_vigilada: 'Inbox', modo: 'sugerir', contexto: '' };

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.buzones.set(await this.api.listarBuzones());
    } catch (e) {
      this.toast.error('No se pudieron cargar los buzones', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected iniciales(n: string): string {
    return n
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected hace(iso: string): string {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} d`;
  }

  protected abrirNuevo(): void {
    this.form = { direccion: '', nombre: '', area: '', carpeta_vigilada: 'Inbox', modo: 'sugerir', contexto: '' };
    this.errorForm.set(null);
    this.formAbierto.set(true);
  }

  protected cerrar(): void {
    this.formAbierto.set(false);
  }

  protected valido(): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.form.direccion.trim()) && this.form.nombre.trim().length >= 2;
  }

  protected async guardar(): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      const nuevo = await this.api.crearBuzon({ ...this.form, direccion: this.form.direccion.trim().toLowerCase() });
      this.toast.show('Buzón creado', `${nuevo.nombre} · ${nuevo.direccion}`);
      this.cerrar();
      void this.router.navigate(['/apps/buzon-inteligente/buzones', nuevo.id]);
    } catch (e) {
      this.errorForm.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async sincronizar(b: Buzon): Promise<void> {
    this.sincronizando.set(b.id);
    try {
      const r = await this.api.sincronizar(b.id);
      this.toast.show(
        `Sincronizado ${b.nombre}`,
        `${r.ingresados} nuevos · ${r.ejecutados} ejecutados · ${r.en_revision} por revisar${r.errores ? ` · ${r.errores} con error` : ''}`,
      );
      await this.cargar();
    } catch (e) {
      this.toast.error('No se pudo sincronizar', e instanceof Error ? e.message : String(e));
    } finally {
      this.sincronizando.set(null);
    }
  }

  protected async conectar(b: Buzon): Promise<void> {
    try {
      const c = await this.api.conexion(b.id);
      if (!c.configurado) {
        this.toast.error('Correo no configurado', 'El ambiente no tiene credenciales de Microsoft Graph.');
        return;
      }
      if (this.api.modoDemo()) {
        this.toast.show('Modo demostración', 'Aquí se abriría el inicio de sesión de Microsoft con la cuenta del buzón.');
        return;
      }
      window.location.assign(this.api.urlConectar(b.correo_buzon_id, c.scopes, '/apps/buzon-inteligente/buzones'));
    } catch (e) {
      this.toast.error('No se pudo iniciar la conexión', e instanceof Error ? e.message : String(e));
    }
  }
}
