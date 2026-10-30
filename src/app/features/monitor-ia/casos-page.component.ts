// Casos de Salesforce dentro de Monitor-IA: campañas de calificación con IA de casos
// cerrados (Correo y Chat). Reemplaza a las Logic Apps que escribían en
// Calibracion_CasosEscritos.xlsx. Mismos roles que las llamadas:
//   · Analista:      ve campañas y resultados.
//   · Coordinador:   además crea campañas, descarta casos del sorteo, ejecuta y exporta.
//   · Administrador: además configura Salesforce y las plantillas de cada flujo.

import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { CampanaCasosListada, ConexionSf, MonitorIaCasosApi } from './casos.api';
import { CasosCampanaDetalleComponent } from './casos-campana-detalle.component';
import { CasosCampanaNuevaComponent } from './casos-campana-nueva.component';
import { CasosConfiguracionComponent } from './casos-configuracion.component';
import { ETIQUETA_FLUJO, estadoCampanaCasos } from './casos.domain';
import { PERM_CAMPANAS, PERM_CONFIG } from './monitor-ia.api';
import { fecha } from './monitor-ia.domain';

type Vista = 'campanas' | 'nueva' | 'config';

const REFRESCO_MS = 5000;

@Component({
  selector: 'alma-casos-page',
  host: { class: 'block space-y-4' },
  imports: [LucideAngularModule, AlmaLoaderComponent, CasosCampanaDetalleComponent, CasosCampanaNuevaComponent, CasosConfiguracionComponent],
  template: `
    <nav class="glass inline-flex flex-wrap gap-1 rounded-2xl p-1 shadow-[var(--shadow-sm)]" aria-label="Secciones de casos de Salesforce">
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

    @if (conexion(); as c) {
      @if (!c.configurada && vista() !== 'config') {
        <div class="glass flex flex-wrap items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-[var(--shadow-sm)]">
          <lucide-icon name="plug" [size]="18" class="mt-0.5 shrink-0 text-amber-600" />
          <p class="min-w-0 flex-1 text-foreground">
            <span class="font-semibold">Monitor-IA todavía no está conectado a Salesforce.</span>
            @if (puedeConfigurar()) {
              Crea la conexión en <button type="button" class="font-medium text-primary hover:underline" (click)="ir('config')">Configuración</button>.
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
          <alma-casos-campana-nueva [conexion]="c" (creada)="abrir($event)" />
        }
      }
      @case ('config') {
        <alma-casos-configuracion />
      }
      @default {
        @if (abierta(); as id) {
          <alma-casos-campana-detalle [campanaId]="id" (volver)="cerrar()" />
        } @else {
          <section class="glass overflow-hidden rounded-3xl shadow-[var(--shadow-sm)]">
            <header class="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <h2 class="text-sm font-bold text-foreground">Campañas de casos</h2>
              <button type="button" class="alma-btn alma-btn-ghost h-8 rounded-lg text-xs" [disabled]="cargando()" (click)="cargar()">
                <lucide-icon name="refresh-cw" [size]="14" [class.animate-spin]="cargando()" /> Actualizar
              </button>
            </header>
            @if (cargando() && !campanas().length) {
              <div class="flex justify-center py-10"><alma-loader [size]="56" label="Cargando campañas…" /></div>
            } @else if (!campanas().length) {
              <p class="px-5 py-10 text-center text-sm text-muted-foreground">
                Todavía no hay campañas de casos.
                @if (puedeGestionar()) { Crea la primera desde «Nueva campaña». }
              </p>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-[var(--table-header)] text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
                    <tr>
                      <th class="px-4 py-2">Campaña</th>
                      <th class="px-4 py-2">Estado</th>
                      <th class="px-4 py-2">Cerrados entre</th>
                      <th class="px-4 py-2 text-right">Casos</th>
                      <th class="px-4 py-2 text-right">Calificados</th>
                      <th class="px-4 py-2 text-right">Sin calificar</th>
                      <th class="px-4 py-2">Creada</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of campanas(); track c.id) {
                      <tr class="cursor-pointer border-t border-border/50 hover:bg-accent/60" tabindex="0" (click)="abrir(c.id)" (keydown.enter)="abrir(c.id)">
                        <td class="max-w-[16rem] px-4 py-2">
                          <p class="truncate font-medium text-foreground" [title]="c.nombre">{{ c.nombre }}</p>
                          <p class="truncate text-[11px] text-muted-foreground">Flujo {{ flujo[c.flujo] }}</p>
                        </td>
                        <td class="px-4 py-2">
                          <span class="alma-badge whitespace-nowrap" [class]="estado(c).clase">
                            @if (estado(c).enCurso) { <lucide-icon name="loader-2" [size]="12" class="mr-1 animate-spin" /> }
                            {{ estado(c).texto }}
                          </span>
                        </td>
                        <td class="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{{ fecha(c.desde) }} → {{ fecha(c.hasta) }}</td>
                        <td class="px-4 py-2 text-right tabular-nums">{{ c.casos }}</td>
                        <td class="px-4 py-2 text-right tabular-nums">{{ c.calificados }}</td>
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
  `,
})
export class CasosPageComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(MonitorIaCasosApi);
  private readonly toast = inject(ToastService);

  protected readonly fecha = fecha;
  protected readonly flujo = ETIQUETA_FLUJO;

  protected readonly puedeGestionar = computed(() => this.auth.hasPermission(PERM_CAMPANAS));
  protected readonly puedeConfigurar = computed(() => this.auth.hasPermission(PERM_CONFIG));

  protected readonly vista = signal<Vista>('campanas');
  protected readonly abierta = signal<string | null>(null);
  protected readonly conexion = signal<ConexionSf | null>(null);
  protected readonly campanas = signal<CampanaCasosListada[]>([]);
  protected readonly cargando = signal(false);

  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.temporizador) clearInterval(this.temporizador);
    });
    void this.cargarConexion();
    void this.cargar();
    // Refresco suave del listado mientras hay campañas trabajando en segundo plano.
    this.temporizador = setInterval(() => {
      if (this.vista() === 'campanas' && !this.abierta() && this.campanas().some((c) => estadoCampanaCasos(c.estado).enCurso)) {
        void this.cargar(false);
      }
    }, REFRESCO_MS);
  }

  protected estado(c: CampanaCasosListada) {
    return estadoCampanaCasos(c.estado);
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
      this.toast.error('No se pudo consultar la conexión con Salesforce', e instanceof Error ? e.message : String(e));
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
