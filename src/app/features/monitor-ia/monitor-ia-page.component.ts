// App «Monitor-IA» (Servicio de Atención al Cliente): campañas de autoevaluación
// automática de llamadas en Genesys Cloud. Reemplaza al script de escritorio de SAC.
//
//   · Analista:      ve campañas, resultados y enlaces a Genesys.
//   · Coordinador:   además crea campañas, descarta llamadas del sorteo y las ejecuta.
//   · Administrador: además configura Genesys, los topes y los formularios.

import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { CampanaDetalleComponent } from './campana-detalle.component';
import { CampanaNuevaComponent } from './campana-nueva.component';
import { CasosPageComponent } from './casos-page.component';
import { ConfiguracionComponent } from './configuracion.component';
import { CampanaListada, Conexion, MonitorIaApi, PERM_CAMPANAS, PERM_CONFIG, PERM_VIEW } from './monitor-ia.api';
import { estadoCampana, fecha } from './monitor-ia.domain';

type Vista = 'campanas' | 'nueva' | 'config';

const REFRESCO_MS = 5000;

@Component({
  selector: 'alma-monitor-ia-page',
  imports: [
    RouterLink,
    LucideAngularModule,
    AccessDeniedComponent,
    AlmaLoaderComponent,
    CampanaDetalleComponent,
    CampanaNuevaComponent,
    CasosPageComponent,
    ConfiguracionComponent,
  ],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-[1600px] space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-center gap-3">
          <a routerLink="/" class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary">
            <lucide-icon name="arrow-left" [size]="16" /> Inicio
          </a>
          <div>
            <h1 class="text-on-wallpaper text-2xl font-bold tracking-tight text-foreground">Monitor-IA</h1>
            <p class="text-on-wallpaper text-sm text-foreground/80">
              {{ fuente() === 'llamadas' ? 'Autoevaluación automática de llamadas en Genesys Cloud.' : 'Calificación con IA de casos de Salesforce (correo y chat).' }}
            </p>
          </div>
          <!-- Qué se monitorea: llamadas (Genesys) o casos escritos (Salesforce) -->
          <div class="glass ml-auto inline-flex gap-1 rounded-2xl p-1 shadow-[var(--shadow-sm)]" role="group" aria-label="Qué monitorear">
            <button type="button" class="inline-flex h-8 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-colors"
                    [class]="claseFuente('llamadas')" [attr.aria-pressed]="fuente() === 'llamadas'" (click)="fuente.set('llamadas')">
              <lucide-icon name="phone" [size]="14" /> Llamadas
            </button>
            <button type="button" class="inline-flex h-8 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-colors"
                    [class]="claseFuente('casos')" [attr.aria-pressed]="fuente() === 'casos'" (click)="fuente.set('casos')">
              <lucide-icon name="mail" [size]="14" /> Casos Salesforce
            </button>
          </div>
        </div>

        @if (fuente() === 'casos') {
          <alma-casos-page />
        } @else {
        <!-- Pestañas -->
        <nav class="glass inline-flex flex-wrap gap-1 rounded-2xl p-1 shadow-[var(--shadow-sm)]" aria-label="Secciones de Monitor-IA">
          <button type="button" class="h-8 rounded-xl px-3.5 text-sm font-medium transition-colors" [class]="clasePestana('campanas')" (click)="ir('campanas')">
            Campañas
          </button>
          @if (puedeGestionar()) {
            <button type="button" class="h-8 rounded-xl px-3.5 text-sm font-medium transition-colors" [class]="clasePestana('nueva')" (click)="ir('nueva')">
              Nueva campaña
            </button>
          }
          @if (puedeConfigurar()) {
            <button type="button" class="h-8 rounded-xl px-3.5 text-sm font-medium transition-colors" [class]="clasePestana('config')" (click)="ir('config')">
              Configuración
            </button>
          }
        </nav>

        <!-- Aviso: sin conexión con Genesys -->
        @if (conexion(); as c) {
          @if (!c.configurada && vista() !== 'config') {
            <div class="glass flex flex-wrap items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-[var(--shadow-sm)]">
              <lucide-icon name="plug" [size]="18" class="mt-0.5 shrink-0 text-amber-600" />
              <p class="min-w-0 flex-1 text-foreground">
                <span class="font-semibold">Monitor-IA todavía no está conectado a Genesys.</span>
                @if (puedeConfigurar()) {
                  Carga las credenciales en <button type="button" class="font-medium text-primary hover:underline" (click)="ir('config')">Configuración</button>.
                } @else {
                  Pídele al Administrador que configure la conexión.
                }
              </p>
            </div>
          }
        }

        @switch (vista()) {
          @case ('nueva') {
            @if (conexion(); as c) {
              <alma-campana-nueva [conexion]="c" (creada)="abrir($event)" />
            }
          }
          @case ('config') {
            <alma-monitor-ia-configuracion />
          }
          @default {
            @if (abierta(); as id) {
              <alma-campana-detalle [campanaId]="id" (volver)="cerrar()" />
            } @else {
              <section class="glass overflow-hidden rounded-3xl shadow-[var(--shadow-sm)]">
                <header class="flex items-center justify-between border-b border-border/60 px-5 py-3">
                  <h2 class="text-sm font-bold text-foreground">Campañas</h2>
                  <button type="button" class="alma-btn alma-btn-ghost h-8 w-auto rounded-lg px-2.5 text-xs" [disabled]="cargando()" (click)="cargar()">
                    <lucide-icon name="refresh-cw" [size]="14" [class.animate-spin]="cargando()" /> Actualizar
                  </button>
                </header>
                @if (cargando() && !campanas().length) {
                  <div class="flex justify-center py-10"><alma-loader [size]="56" label="Cargando campañas…" /></div>
                } @else if (!campanas().length) {
                  <p class="px-5 py-10 text-center text-sm text-muted-foreground">
                    Todavía no hay campañas.
                    @if (puedeGestionar()) { Crea la primera desde «Nueva campaña». }
                  </p>
                } @else {
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead class="bg-[var(--table-header)] text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
                        <tr>
                          <th class="px-4 py-2">Campaña</th>
                          <th class="px-4 py-2">Estado</th>
                          <th class="px-4 py-2">Período</th>
                          <th class="px-4 py-2 text-right">Llamadas</th>
                          <th class="px-4 py-2 text-right">Solicitadas</th>
                          <th class="px-4 py-2 text-right">Errores</th>
                          <th class="px-4 py-2">Creada</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (c of campanas(); track c.id) {
                          <tr class="cursor-pointer border-t border-border/50 hover:bg-accent/60" tabindex="0" (click)="abrir(c.id)" (keydown.enter)="abrir(c.id)">
                            <td class="min-w-[16rem] px-4 py-2">
                              <p class="break-words font-medium text-foreground">{{ c.nombre }}</p>
                              <p class="break-words text-[11px] text-muted-foreground">{{ c.form_nombre }}</p>
                            </td>
                            <td class="px-4 py-2">
                              <span class="alma-badge whitespace-nowrap" [class]="estado(c).clase">
                                @if (estado(c).enCurso) { <lucide-icon name="loader-2" [size]="12" class="mr-1 animate-spin" /> }
                                {{ estado(c).texto }}
                              </span>
                            </td>
                            <td class="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{{ fecha(c.desde) }} → {{ fecha(c.hasta) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">{{ c.llamadas }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">{{ c.solicitadas }}</td>
                            <td class="px-4 py-2 text-right tabular-nums" [class.text-destructive]="c.con_error > 0">{{ c.con_error }}</td>
                            <td class="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{{ c.creado_por }} · {{ fecha(c.creado_en) }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </section>
            }
          }
        }
        }
      </div>
    }
  `,
})
export class MonitorIaPageComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(MonitorIaApi);
  private readonly toast = inject(ToastService);

  protected readonly fecha = fecha;

  protected readonly puedeVer = computed(() => this.auth.hasPermission(PERM_VIEW));
  protected readonly puedeGestionar = computed(() => this.auth.hasPermission(PERM_CAMPANAS));
  protected readonly puedeConfigurar = computed(() => this.auth.hasPermission(PERM_CONFIG));

  protected readonly fuente = signal<'llamadas' | 'casos'>('llamadas');
  protected readonly vista = signal<Vista>('campanas');
  protected readonly abierta = signal<string | null>(null);
  protected readonly conexion = signal<Conexion | null>(null);
  protected readonly campanas = signal<CampanaListada[]>([]);
  protected readonly cargando = signal(false);

  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.temporizador) clearInterval(this.temporizador);
    });
    if (this.puedeVer()) {
      void this.cargarConexion();
      void this.cargar();
      // Refresco suave del listado mientras hay campañas trabajando en segundo plano.
      this.temporizador = setInterval(() => {
        if (this.fuente() === 'llamadas' && this.vista() === 'campanas' && !this.abierta() && this.campanas().some((c) => estadoCampana(c.estado).enCurso)) {
          void this.cargar(false);
        }
      }, REFRESCO_MS);
    }
  }

  protected estado(c: CampanaListada) {
    return estadoCampana(c.estado);
  }

  protected claseFuente(f: 'llamadas' | 'casos'): string {
    return this.fuente() === f
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground';
  }

  protected clasePestana(v: Vista): string {
    return this.vista() === v
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground';
  }

  protected ir(v: Vista): void {
    this.vista.set(v);
    this.abierta.set(null);
    if (v === 'campanas') void this.cargar(false);
    // La configuración puede haber cambiado la conexión.
    if (v !== 'nueva') void this.cargarConexion();
  }

  protected abrir(id: string): void {
    this.vista.set('campanas');
    this.abierta.set(id);
  }

  protected cerrar(): void {
    this.abierta.set(null);
    void this.cargar(false);
  }

  private async cargarConexion(): Promise<void> {
    try {
      this.conexion.set(await this.api.conexion());
    } catch (e) {
      this.toast.error('No se pudo consultar la conexión con Genesys', e instanceof Error ? e.message : String(e));
    }
  }

  protected async cargar(mostrar = true): Promise<void> {
    if (mostrar) this.cargando.set(true);
    try {
      this.campanas.set(await this.api.campanas());
    } catch (e) {
      if (mostrar) this.toast.error('No se pudieron cargar las campañas', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
