// Configuración de Monitor-IA (Administrador): conexión con Genesys, topes y
// formularios que el Coordinador puede usar. El secreto es de SOLO ESCRITURA: se
// guarda cifrado y nunca vuelve a la pantalla; dejar el campo vacío lo conserva.

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { AlmaSwitchComponent } from '../../shared/components/alma-switch.component';
import { Configuracion, FormularioGenesys, MonitorIaApi } from './monitor-ia.api';
import { fecha } from './monitor-ia.domain';

@Component({
  selector: 'alma-monitor-ia-configuracion',
  imports: [FormsModule, LucideAngularModule, AlmaLoaderComponent, AlmaSwitchComponent],
  template: `
    @if (cargando()) {
      <div class="flex justify-center py-16"><alma-loader [size]="56" label="Cargando configuración…" /></div>
    } @else if (config(); as c) {
      <div class="space-y-4">
        <!-- Conexión -->
        <form class="glass space-y-4 rounded-3xl p-5 shadow-[var(--shadow-sm)]" (ngSubmit)="guardar()">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-bold text-foreground">Conexión con Genesys Cloud</h2>
            <span class="alma-badge" [class]="estadoConexion().clase">{{ estadoConexion().texto }}</span>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-1 text-xs font-medium text-foreground">
              Región
              <input class="alma-input" name="region" required maxlength="60" placeholder="mxc1.pure.cloud"
                     [ngModel]="region()" (ngModelChange)="region.set($event)" />
              <span class="block text-[11px] font-normal text-muted-foreground">Dominio de Genesys Cloud de tu organización, por ejemplo mxc1.pure.cloud.</span>
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground">
              Client ID
              <input class="alma-input" name="clientId" autocomplete="off" maxlength="100"
                     [ngModel]="clientId()" (ngModelChange)="clientId.set($event)" />
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground sm:col-span-2">
              Client Secret
              <input class="alma-input" type="password" name="clientSecret" autocomplete="new-password" maxlength="300"
                     [placeholder]="c.tiene_secreto ? '•••••••••••• guardado — déjalo vacío para conservarlo' : 'Pega aquí el secreto del cliente OAuth'"
                     [ngModel]="clientSecret()" (ngModelChange)="clientSecret.set($event)" />
              <span class="block text-[11px] font-normal text-muted-foreground">
                Se guarda cifrado y nunca se vuelve a mostrar. Usa un cliente OAuth propio de Alma con permisos mínimos:
                leer colas, usuarios y analítica de conversaciones, y crear y consultar evaluaciones.
              </span>
            </label>
          </div>

          <div class="border-t border-border/60 pt-4">
            <h3 class="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/65">Topes</h3>
            <div class="grid gap-3 sm:grid-cols-3">
              <label class="space-y-1 text-xs font-medium text-foreground">
                Máximo por campaña
                <input class="alma-input" type="number" name="maxLote" min="1" max="200" required [ngModel]="maxLote()" (ngModelChange)="maxLote.set(+$event)" />
              </label>
              <label class="space-y-1 text-xs font-medium text-foreground">
                Máximo por día
                <input class="alma-input" type="number" name="maxDia" min="1" max="5000" required [ngModel]="maxDia()" (ngModelChange)="maxDia.set(+$event)" />
              </label>
              <label class="space-y-1 text-xs font-medium text-foreground">
                Solicitudes simultáneas
                <input class="alma-input" type="number" name="concurrencia" min="1" max="10" required [ngModel]="concurrencia()" (ngModelChange)="concurrencia.set(+$event)" />
              </label>
            </div>
            <p class="mt-2 text-[11px] text-muted-foreground">
              Las solicitudes simultáneas se mantienen bajas a propósito: Genesys responde con límites de uso (429) si se le envía demasiado de golpe.
            </p>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-[11px] text-muted-foreground">
              @if (c.actualizado_por) { Última actualización: {{ c.actualizado_por }} · {{ fecha(c.actualizado_en, true) }} }
            </p>
            <div class="flex gap-2">
              <button type="button" class="alma-btn alma-btn-outline h-9 rounded-xl text-sm" [disabled]="ocupado() || !c.configurada" (click)="probar()">
                <lucide-icon [name]="probando() ? 'loader-2' : 'plug-zap'" [size]="15" [class.animate-spin]="probando()" /> Probar conexión
              </button>
              <button type="submit" class="alma-btn alma-btn-primary h-9 rounded-xl px-4 text-sm" [disabled]="ocupado() || !puedeGuardar()">
                <lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardando()" /> Guardar
              </button>
            </div>
          </div>
        </form>

        <!-- Formularios -->
        <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-bold text-foreground">Formularios habilitados</h2>
              <p class="text-xs text-muted-foreground">El Coordinador solo puede elegir entre los que habilites aquí.</p>
            </div>
            <button type="button" class="alma-btn alma-btn-outline h-9 rounded-xl text-sm" [disabled]="!c.configurada || cargandoFormularios()" (click)="cargarFormularios()">
              <lucide-icon [name]="cargandoFormularios() ? 'loader-2' : 'refresh-cw'" [size]="14" [class.animate-spin]="cargandoFormularios()" />
              {{ formularios() ? 'Volver a consultar Genesys' : 'Ver formularios de Genesys' }}
            </button>
          </div>

          @if (!c.configurada) {
            <p class="text-xs text-muted-foreground">Guarda primero las credenciales de Genesys.</p>
          } @else if (errorFormularios(); as e) {
            <p class="text-xs text-destructive">{{ e }}</p>
          } @else if (formularios(); as lista) {
            <div class="divide-y divide-border/50 rounded-xl border border-border/60">
              @for (f of lista; track f.id) {
                <div class="flex items-center justify-between gap-3 px-3 py-2">
                  <div class="min-w-0">
                    <p class="break-words text-sm text-foreground">{{ f.name }}</p>
                    @if (f.type) { <p class="text-[11px] text-muted-foreground">{{ f.type }}</p> }
                  </div>
                  <alma-switch [checked]="habilitados().has(f.id)" (checkedChange)="alternarFormulario(f.id, $event)" [ariaLabel]="'Habilitar ' + f.name" />
                </div>
              } @empty {
                <p class="px-3 py-6 text-center text-xs text-muted-foreground">Genesys no tiene formularios de evaluación publicados.</p>
              }
            </div>
            <div class="flex justify-end">
              <button type="button" class="alma-btn alma-btn-primary h-9 rounded-xl px-4 text-sm" [disabled]="guardandoFormularios()" (click)="guardarFormularios()">
                <lucide-icon [name]="guardandoFormularios() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardandoFormularios()" />
                Guardar formularios ({{ habilitados().size }})
              </button>
            </div>
          }
        </section>
      </div>
    }
  `,
})
export class ConfiguracionComponent {
  private readonly api = inject(MonitorIaApi);
  private readonly toast = inject(ToastService);

  protected readonly fecha = fecha;

  protected readonly cargando = signal(true);
  protected readonly config = signal<Configuracion | null>(null);

  protected readonly region = signal('mxc1.pure.cloud');
  protected readonly clientId = signal('');
  protected readonly clientSecret = signal('');
  protected readonly maxLote = signal(50);
  protected readonly maxDia = signal(200);
  protected readonly concurrencia = signal(5);

  protected readonly guardando = signal(false);
  protected readonly probando = signal(false);
  protected readonly ocupado = computed(() => this.guardando() || this.probando());

  protected readonly formularios = signal<FormularioGenesys[] | null>(null);
  protected readonly habilitados = signal<Set<string>>(new Set());
  protected readonly cargandoFormularios = signal(false);
  protected readonly guardandoFormularios = signal(false);
  protected readonly errorFormularios = signal<string | null>(null);

  protected readonly estadoConexion = computed(() => {
    const c = this.config();
    if (!c?.configurada) return { texto: 'Sin configurar', clase: 'bg-muted text-muted-foreground' };
    if (!c.verificada_en) return { texto: 'Sin verificar', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' };
    return { texto: `Verificada · ${fecha(c.verificada_en)}`, clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' };
  });

  protected readonly puedeGuardar = computed(() => {
    const c = this.config();
    const hayCredenciales = !!this.clientId().trim() && (!!this.clientSecret().trim() || !!c?.tiene_secreto);
    return !!this.region().trim() && hayCredenciales && this.maxLote() >= 1 && this.maxDia() >= this.maxLote() && this.concurrencia() >= 1;
  });

  constructor() {
    void this.cargar();
  }

  private aplicar(c: Configuracion): void {
    this.config.set(c);
    this.region.set(c.region);
    this.clientId.set(c.client_id ?? '');
    this.clientSecret.set('');
    this.maxLote.set(c.max_por_lote);
    this.maxDia.set(c.max_por_dia);
    this.concurrencia.set(c.concurrencia);
  }

  private async cargar(): Promise<void> {
    try {
      this.aplicar(await this.api.configuracion());
      if (this.config()?.configurada) void this.cargarHabilitados();
    } catch (e) {
      this.toast.error('No se pudo cargar la configuración', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Los ya habilitados se conocen sin ir a Genesys. */
  private async cargarHabilitados(): Promise<void> {
    try {
      const ya = await this.api.formulariosHabilitados();
      this.habilitados.set(new Set(ya.map((f) => f.id)));
    } catch {
      /* se verán al consultar Genesys */
    }
  }

  protected async guardar(): Promise<void> {
    if (!this.puedeGuardar() || this.ocupado()) return;
    this.guardando.set(true);
    try {
      const guardada = await this.api.guardarConfiguracion({
        region: this.region().trim(),
        client_id: this.clientId().trim() || null,
        client_secret: this.clientSecret().trim() || null,
        max_por_lote: this.maxLote(),
        max_por_dia: this.maxDia(),
        concurrencia: this.concurrencia(),
      });
      this.aplicar(guardada);
      this.toast.show('Configuración guardada', guardada.verificada_en ? undefined : 'Prueba la conexión para verificarla.');
    } catch (e) {
      this.toast.error('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async probar(): Promise<void> {
    this.probando.set(true);
    try {
      this.aplicar(await this.api.probarConexion());
      this.toast.show('Conexión verificada', 'Genesys aceptó las credenciales.');
    } catch (e) {
      this.toast.error('No se pudo conectar con Genesys', e instanceof Error ? e.message : String(e));
    } finally {
      this.probando.set(false);
    }
  }

  protected async cargarFormularios(): Promise<void> {
    this.cargandoFormularios.set(true);
    this.errorFormularios.set(null);
    try {
      const lista = await this.api.formulariosGenesys();
      this.formularios.set(lista);
      this.habilitados.set(new Set(lista.filter((f) => f.habilitado).map((f) => f.id)));
    } catch (e) {
      this.errorFormularios.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargandoFormularios.set(false);
    }
  }

  protected alternarFormulario(id: string, activo: boolean): void {
    const nuevo = new Set(this.habilitados());
    if (activo) nuevo.add(id);
    else nuevo.delete(id);
    this.habilitados.set(nuevo);
  }

  protected async guardarFormularios(): Promise<void> {
    this.guardandoFormularios.set(true);
    try {
      await this.api.habilitarFormularios([...this.habilitados()]);
      this.toast.show('Formularios guardados', `${this.habilitados().size} habilitados para el Coordinador.`);
    } catch (e) {
      this.toast.error('No se pudieron guardar los formularios', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoFormularios.set(false);
    }
  }
}
