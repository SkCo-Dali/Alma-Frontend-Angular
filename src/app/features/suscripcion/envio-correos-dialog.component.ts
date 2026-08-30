// "Envío de Correos" — réplica del MassEmailSender de Dali para Suscripción:
// header con ícono degradado + subtítulo + contador de DESTINATARIOS, pestañas
// Nuevo Correo / Previsualizar / Historial, editor completo (toolbar Dali,
// asunto, campos de la cotización, lienzo Visual/HTML), previsualización con
// las variables resueltas con los datos reales, y el historial del buzón
// consultable por cualquier cédula o término.

import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '@env/environment';
import { AuthService } from '../../core/auth/auth.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { EditarPlantillaDialogComponent, PlantillaEnEdicion } from './editar-plantilla-dialog.component';
import { EditorCorreoComponent } from './editor-correo.component';
import { HtmlCorreoPipe } from './html-correo.pipe';
import { GaleriaPlantillasDialogComponent } from './galeria-plantillas-dialog.component';
import { CorreoClienteApi, CuentaCorreoApi, PlantillaCorreoApi, SuscripcionApi } from './suscripcion.api';

type Pestana = 'nuevo' | 'previsualizar' | 'historial';

@Component({
  selector: 'alma-envio-correos-dialog',
  imports: [FormsModule, LucideAngularModule, AlmaLoaderComponent, EditarPlantillaDialogComponent, EditorCorreoComponent, GaleriaPlantillasDialogComponent, HtmlCorreoPipe],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" (click)="closed.emit()">
      <div
        class="surface-solid flex max-h-[94vh] w-full max-w-[97vw] flex-col gap-2 rounded-2xl border-l-[3px] border border-border border-l-primary px-4 pb-3 pt-3 shadow-2xl lg:max-w-[82vw]"
        (click)="$event.stopPropagation()"
      >
        <!-- ── Header (Dali): ícono + título + DESTINATARIOS + X ── -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2.5">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 shadow-md shadow-primary/25">
              <lucide-icon name="mail" [size]="16" class="text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-base font-semibold leading-tight tracking-tight">Envío de Correos</h2>
              <p class="text-[10px] leading-tight text-muted-foreground">Compone, previsualiza y envía</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-2.5 py-1">
              <lucide-icon name="users" [size]="14" class="text-muted-foreground" />
              <div class="leading-none">
                <p class="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Destinatarios</p>
                <p class="text-xs font-bold">{{ destinatarios() }}</p>
              </div>
            </div>
            <button type="button" (click)="closed.emit()" aria-label="Cerrar"
                    class="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <lucide-icon name="x" [size]="16" />
            </button>
          </div>
        </div>

        <!-- ── Pestañas (Dali) ── -->
        <div class="flex items-center gap-1 border-b border-border/50">
          @for (t of pestanas; track t.id) {
            <button type="button" (click)="pestana.set(t.id)"
                    class="flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors"
                    [class]="pestana() === t.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'">
              <lucide-icon [name]="t.icon" [size]="14" /> {{ t.label }}
            </button>
          }
        </div>

        <!-- ── Nuevo Correo ── -->
        <div class="min-h-0 flex-1 overflow-y-auto" [hidden]="pestana() !== 'nuevo'">
          <alma-editor-correo
            [(asunto)]="asunto"
            [(value)]="cuerpoHtml"
            [variables]="variables()"
            [conPlantillas]="true"
            (abrirPlantillas)="selectorPlantillas.set(true)"
          />
        </div>

        <!-- ── Previsualizar ── -->
        @if (pestana() === 'previsualizar') {
          <div class="min-h-0 flex-1 overflow-y-auto">
            <div class="mb-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-xs">
              <p><span class="text-muted-foreground">Para:</span> <b>{{ para() ?? '(sin correo del FP)' }}</b></p>
              @if (ccDirector() && copiarDirector) {
                <p><span class="text-muted-foreground">CC:</span> {{ ccDirector() }}</p>
              }
              <p class="mt-0.5"><span class="text-muted-foreground">Asunto:</span> <b>{{ resolver(asunto) }}</b></p>
            </div>
            <div class="rounded-xl border border-border/50 bg-white p-3">
              <div class="mx-auto max-w-[720px] rounded-md bg-white p-5 text-[14px] leading-relaxed text-neutral-800"
                   style="font-family: Arial, 'Segoe UI', sans-serif;"
                   [innerHTML]="resolver(cuerpoHtml) | htmlCorreo"></div>
            </div>
          </div>
        }

        <!-- ── Historial ── -->
        @if (pestana() === 'historial') {
          <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <lucide-icon name="search" [size]="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input [(ngModel)]="busqueda" (keydown.enter)="buscarHistorial()"
                       placeholder="Buscar por cédula, cotización o texto… (vacío = este cliente)"
                       class="alma-input h-9 w-full rounded-xl pl-8" />
              </div>
              <button type="button" (click)="buscarHistorial()" class="alma-btn alma-btn-outline h-9 rounded-xl text-xs">
                Buscar
              </button>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/50">
              @if (cargandoHistorial()) {
                <div class="flex items-center justify-center gap-2 p-8 text-xs text-muted-foreground">
                  <alma-loader [size]="42" /> Buscando en el buzón…
                </div>
              } @else if (errorHistorial()) {
                <p class="p-4 text-center text-xs text-destructive">{{ errorHistorial() }}</p>
              } @else if (historial().length === 0) {
                <p class="p-6 text-center text-xs text-muted-foreground">Sin correos para esa búsqueda.</p>
              } @else {
                <div class="divide-y divide-border/40">
                  @for (c of historial(); track $index) {
                    <div class="px-3 py-2">
                      <div class="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p class="min-w-0 flex-1 truncate text-[13px] font-medium">{{ c.asunto ?? '(sin asunto)' }}</p>
                        <p class="text-xs tabular-nums text-muted-foreground">{{ dia(c.fecha) }}</p>
                      </div>
                      <p class="truncate text-xs text-muted-foreground">{{ c.de_nombre ?? c.de ?? '—' }}</p>
                      @if (c.resumen) {
                        <p class="mt-0.5 line-clamp-2 text-xs text-foreground/80">{{ c.resumen }}</p>
                      }
                      @if (c.enlace) {
                        <a [href]="c.enlace" target="_blank" rel="noopener"
                           class="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                          <lucide-icon name="external-link" [size]="11" /> Abrir en Outlook
                        </a>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }

        @if (errorEnvio(); as err) {
          <p class="rounded-xl bg-destructive/10 p-2 text-center text-xs text-destructive">{{ err }}</p>
        }
        @if (enviadoOk(); as ok) {
          <p class="rounded-xl bg-emerald-100 p-2 text-center text-xs font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            Correo enviado a {{ ok.para }}{{ ok.cc.length ? ' (CC ' + ok.cc.join(', ') + ')' : '' }}.
          </p>
        }

        <!-- ── Footer: cuenta del buzón + CC + acciones (patrón del modal de
             WhatsApp de Dali: el estado de conexión vive en el footer) ── -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex min-w-0 flex-wrap items-center gap-3">
            @if (cuenta(); as c) {
              @if (c.conectada) {
                <span class="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <lucide-icon name="plug-zap" [size]="13" /> Buzón conectado: {{ c.email }}
                  @if (puedeGestionar()) {
                    <button type="button" (click)="desconectarCuenta()"
                            class="font-normal text-muted-foreground underline-offset-2 hover:underline">
                      Desconectar
                    </button>
                  }
                </span>
              } @else {
                <span class="flex items-center gap-2 rounded-xl bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  <lucide-icon name="plug" [size]="13" />
                  {{ c.estado === 'requiere_reconexion'
                     ? 'El buzón requiere reconexión'
                     : 'Buzón de suscripción sin conectar' }}
                  @if (puedeGestionar()) {
                    <button type="button" (click)="conectarCuenta()"
                            class="rounded-lg bg-gradient-to-r from-primary to-emerald-500 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-95">
                      Conectar cuenta
                    </button>
                  }
                </span>
              }
            }
            <label class="flex cursor-pointer items-center gap-2 text-xs text-foreground">
              <input type="checkbox" [(ngModel)]="copiarDirector" class="h-4 w-4 accent-[var(--primary)]" />
              Con copia al director comercial
              @if (ccDirector(); as cc) { <span class="text-muted-foreground">({{ cc }})</span> }
            </label>
          </div>
          <div class="flex items-center gap-2">
            @if (pestana() === 'nuevo') {
              @if (puedeGestionar()) {
                <button type="button" (click)="guardarComoPlantilla()"
                        [disabled]="!asunto.trim() || !cuerpoHtml.trim()"
                        class="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-xs font-medium transition-all hover:border-primary hover:text-primary disabled:opacity-50">
                  <lucide-icon name="save" [size]="13" /> Guardar plantilla
                </button>
              }
              <button type="button" (click)="pestana.set('previsualizar')"
                      [disabled]="!asunto.trim() || !cuerpoHtml.trim()"
                      class="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-emerald-500 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-primary/25 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50">
                <lucide-icon name="eye" [size]="14" /> Previsualizar
              </button>
            } @else if (pestana() === 'previsualizar') {
              <button type="button" (click)="enviar()" [disabled]="enviando() || !para()"
                      class="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-emerald-500 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-primary/25 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50">
                @if (enviando()) { <lucide-icon name="loader-2" [size]="14" class="animate-spin" /> Enviando… }
                @else { <lucide-icon name="send" [size]="14" /> Enviar correo }
              </button>
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Galería de plantillas (estilo Dali, con miniaturas, autocargada); la
         elegida se renderiza con los datos reales de la cotización. -->
    @if (selectorPlantillas()) {
      <alma-galeria-plantillas-dialog
        (closed)="selectorPlantillas.set(false)"
        (seleccionar)="usarPlantilla($event)"
        (editar)="editarPlantilla($event)"
      />
    }

    <!-- Editor de plantilla (Editar desde la galería o "Guardar plantilla") -->
    @if (editandoPlantilla(); as ed) {
      <alma-editar-plantilla-dialog
        [plantilla]="ed"
        [variables]="variables()"
        (closed)="editandoPlantilla.set(null)"
        (guardada)="plantillaGuardada()"
      />
    }
  `,
})
export class EnvioCorreosDialogComponent {
  private readonly api = inject(SuscripcionApi);
  private readonly auth = inject(AuthService);

  readonly solicitudId = input.required<string>();
  readonly nroCotizacion = input<string>('');
  readonly closed = output<void>();
  readonly enviado = output<void>();

  protected readonly pestanas: Array<{ id: Pestana; label: string; icon: string }> = [
    { id: 'nuevo', label: 'Nuevo Correo', icon: 'mail' },
    { id: 'previsualizar', label: 'Previsualizar', icon: 'eye' },
    { id: 'historial', label: 'Historial', icon: 'history' },
  ];
  protected readonly pestana = signal<Pestana>('nuevo');

  protected asunto = '';
  protected cuerpoHtml = '';
  protected copiarDirector = true;
  protected busqueda = '';

  protected readonly variables = signal<Record<string, string>>({});
  private readonly valores = signal<Record<string, string>>({});
  protected readonly para = signal<string | null>(null);
  protected readonly ccDirector = signal<string | null>(null);
  protected readonly destinatarios = computed(() =>
    (this.para() ? 1 : 0) + (this.ccDirector() && this.copiarDirector ? 1 : 0) || 1);

  protected readonly selectorPlantillas = signal(false);
  protected readonly editandoPlantilla = signal<PlantillaEnEdicion | null>(null);
  private readonly galeria = viewChild(GaleriaPlantillasDialogComponent);

  // Cuenta del buzón (OAuth delegado): su estado vive en el footer del modal,
  // como el estado de conexión en el modal de WhatsApp de Dali.
  protected readonly cuenta = signal<CuentaCorreoApi | null>(null);
  protected readonly puedeGestionar = computed(() =>
    this.auth.hasPermission('app.suscripcion.solicitudes.manage'),
  );

  protected readonly historial = signal<CorreoClienteApi[]>([]);
  protected readonly cargandoHistorial = signal(false);
  protected readonly errorHistorial = signal<string | null>(null);
  private historialCargado = false;

  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly enviadoOk = signal<{ para: string; cc: string[] } | null>(null);

  private readonly editor = viewChild(EditorCorreoComponent);

  constructor() {
    effect(() => {
      const id = this.solicitudId();
      untracked(() => void this.iniciar(id));
    });
    effect(() => {
      if (this.pestana() === 'historial' && !this.historialCargado) {
        this.historialCargado = true;
        untracked(() => void this.buscarHistorial());
      }
    });
  }

  private async iniciar(id: string): Promise<void> {
    this.asunto = `Suscripción — cotización ${this.nroCotizacion()}`.trim();
    try {
      const ctx = await this.api.getContextoCorreo(id);
      this.variables.set(ctx.descripciones ?? {});
      this.valores.set(ctx.variables ?? {});
      this.para.set(ctx.para);
      this.ccDirector.set(ctx.cc_director);
    } catch {
      /* sin contexto: el editor funciona igual, sin valores para previsualizar */
    }
    if (Object.keys(this.variables()).length === 0) {
      // Sin contexto (bridge caído): al menos los chips de variables.
      try {
        const r = await this.api.getPlantillasCorreo(true);
        if (r.variables) this.variables.set(r.variables);
      } catch {
        /* el editor funciona igual, sin chips */
      }
    }
    void this.cargarCuenta();
  }

  private async cargarCuenta(): Promise<void> {
    try {
      this.cuenta.set(await this.api.getCuentaCorreo());
    } catch {
      this.cuenta.set(null);
    }
  }

  /**
   * Redirige al login de Microsoft para autorizar la cuenta del buzón
   * (OAuth delegado, patrón Dali). Vuelve por /graph-callback, que canjea el
   * código y regresa a esta cotización (state = URL actual).
   */
  protected conectarCuenta(): void {
    const scopes =
      this.cuenta()?.scopes ?? 'openid offline_access User.Read Mail.Send Mail.Read';
    const params = new URLSearchParams({
      client_id: environment.azure.clientId,
      response_type: 'code',
      redirect_uri: `${window.location.origin}/graph-callback`,
      response_mode: 'query',
      scope: scopes,
      // El analista tiene SU sesión activa: forzamos el selector de cuentas
      // para que entre con la del buzón, no con la personal.
      prompt: 'select_account',
      state: window.location.pathname + window.location.search,
    });
    const hint = this.cuenta()?.buzon_esperado;
    if (hint) params.set('login_hint', hint);
    window.location.href =
      `https://login.microsoftonline.com/${environment.azure.tenantId}` +
      `/oauth2/v2.0/authorize?${params.toString()}`;
  }

  protected async desconectarCuenta(): Promise<void> {
    try {
      await this.api.desconectarCuentaCorreo();
    } catch {
      /* el estado real se refleja al recargar */
    }
    await this.cargarCuenta();
  }

  /** "Guardar plantilla": el correo compuesto pasa al editor de plantillas. */
  protected guardarComoPlantilla(): void {
    this.editandoPlantilla.set({
      id: '',
      nombre: '',
      categoria: 'Suscripción',
      asunto: this.asunto,
      cuerpo_html: this.cuerpoHtml,
    });
  }

  /** Editar pedido desde la galería (todas las plantillas son compartidas). */
  protected editarPlantilla(p: PlantillaCorreoApi): void {
    this.editandoPlantilla.set({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      asunto: p.asunto,
      cuerpo_html: p.cuerpo_html,
    });
  }

  protected plantillaGuardada(): void {
    void this.galeria()?.recargar();
  }

  /** Sustituye {{variables}} con los datos reales (para la previsualización). */
  protected resolver(texto: string): string {
    const vals = this.valores();
    return (texto || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi,
      (_, clave: string) => vals[clave.toLowerCase()] ?? '');
  }

  protected async usarPlantilla(p: PlantillaCorreoApi): Promise<void> {
    this.selectorPlantillas.set(false);
    try {
      const r = await this.api.renderPlantillaCorreo(this.solicitudId(), p.id);
      this.asunto = r.asunto;
      this.cuerpoHtml = r.cuerpo_html;
      this.editor()?.cargar(r.asunto, r.cuerpo_html);
    } catch {
      // Sin render (bridge caído): plantilla cruda, las variables se resuelven al enviar.
      this.asunto = p.asunto;
      this.cuerpoHtml = p.cuerpo_html;
      this.editor()?.cargar(p.asunto, p.cuerpo_html);
    }
  }

  protected async buscarHistorial(): Promise<void> {
    this.cargandoHistorial.set(true);
    this.errorHistorial.set(null);
    try {
      const r = await this.api.getCorreosCliente(this.solicitudId(), this.busqueda.trim() || undefined);
      this.historial.set(r.items ?? []);
    } catch (e) {
      this.errorHistorial.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargandoHistorial.set(false);
    }
  }

  protected async enviar(): Promise<void> {
    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.enviadoOk.set(null);
    try {
      const res = await this.api.enviarCorreoAsesor(this.solicitudId(), {
        asunto: this.asunto.trim(),
        cuerpo_html: this.cuerpoHtml,
        copiar_director: this.copiarDirector,
      });
      this.enviadoOk.set({ para: res.para, cc: res.cc });
      this.enviado.emit();
    } catch (e) {
      this.errorEnvio.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.enviando.set(false);
    }
  }

  protected dia(iso: string | null): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  }
}
