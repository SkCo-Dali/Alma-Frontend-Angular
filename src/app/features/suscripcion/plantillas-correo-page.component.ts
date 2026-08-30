// Galería de plantillas de correo de Suscripción — réplica del concepto del
// módulo de correos de Dali: tarjetas por categoría con vista previa, y editor
// (nombre, categoría, asunto, HTML a mano) con chips de variables de la
// solicitud. Quien tiene manage crea/edita/desactiva; el analista las usa
// desde el diálogo "Correo al asesor" del detalle.

import { KeyValuePipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '@env/environment';
import { AuthService } from '../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { EditorCorreoComponent } from './editor-correo.component';
import { GaleriaPlantillasDialogComponent } from './galeria-plantillas-dialog.component';
import { PlantillaCorreoApi, SuscripcionApi } from './suscripcion.api';

@Component({
  selector: 'alma-plantillas-correo-page',
  imports: [FormsModule, KeyValuePipe, RouterLink, LucideAngularModule, AccessDeniedComponent, AlmaLoaderComponent, EditorCorreoComponent, GaleriaPlantillasDialogComponent],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header class="glass rounded-2xl px-5 py-4 shadow-[var(--shadow-sm)]">
          <a
            routerLink="/apps/suscripcion"
            class="-ml-2 flex h-8 w-fit items-center gap-1.5 rounded-xl px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <lucide-icon name="arrow-left" [size]="16" /> Suscripción de Seguros
          </a>
          <div class="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 class="text-2xl font-bold tracking-tight">Plantillas de correo</h1>
              <p class="mt-0.5 text-sm text-muted-foreground">
                Correos que el analista envía al FP desde el detalle de la cotización.
                Usa variables como
                <code class="rounded bg-muted px-1">{{ '{{asegurado}}' }}</code> o
                <code class="rounded bg-muted px-1">{{ '{{mensaje}}' }}</code> — se
                reemplazan con los datos reales al enviar.
              </p>
            </div>
            @if (puedeGestionar()) {
              <button type="button" (click)="nueva()" class="alma-btn alma-btn-primary rounded-xl">
                <lucide-icon name="plus" [size]="16" /> Nueva plantilla
              </button>
            }
          </div>
        </header>

        <!-- Cuenta del buzón conectada (OAuth delegado, como en Dali) -->
        <section class="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 shadow-[var(--shadow-sm)]">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full"
                 [class]="cuenta()?.conectada
                   ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                   : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'">
              <lucide-icon [name]="cuenta()?.conectada ? 'plug-zap' : 'plug'" [size]="18" />
            </div>
            <div>
              <p class="text-sm font-semibold">
                @if (cuenta()?.conectada) {
                  Buzón conectado: {{ cuenta()?.email }}
                } @else if (cuenta()?.estado === 'requiere_reconexion') {
                  El buzón requiere reconexión
                } @else {
                  Buzón de suscripción sin conectar
                }
              </p>
              <p class="text-xs text-muted-foreground">
                @if (cuenta()?.conectada) {
                  Autorizado por {{ cuenta()?.conectada_por }} — los correos salen con
                  permisos delegados del buzón y el token se renueva solo.
                } @else {
                  Inicia sesión UNA vez con la cuenta
                  {{ cuenta()?.buzon_esperado ?? 'del buzón de suscripción' }} y autoriza
                  el envío. No requiere aprobación del administrador.
                }
              </p>
              @if (conectando()) {
                <p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <lucide-icon name="loader-2" [size]="12" class="animate-spin" />
                  Completando la conexión…
                </p>
              }
              @if (errorCuenta(); as err) {
                <p class="mt-1 text-xs font-medium text-destructive">{{ err }}</p>
              }
            </div>
          </div>
          @if (puedeGestionar()) {
            <div class="flex gap-2">
              @if (cuenta()?.conectada) {
                <button type="button" (click)="desconectarCuenta()" class="alma-btn alma-btn-outline h-9 rounded-xl text-xs">
                  Desconectar
                </button>
                <button type="button" (click)="conectarCuenta()" class="alma-btn alma-btn-outline h-9 rounded-xl text-xs">
                  Reconectar
                </button>
              } @else {
                <button type="button" (click)="conectarCuenta()" class="alma-btn alma-btn-primary h-9 rounded-xl text-xs">
                  <lucide-icon name="plug-zap" [size]="14" /> Conectar cuenta
                </button>
              }
            </div>
          }
        </section>

        @if (cargando()) {
          <div class="flex flex-col items-center gap-3 p-12">
            <alma-loader [size]="80" />
            <p class="text-sm text-muted-foreground">Cargando plantillas…</p>
          </div>
        } @else if (error()) {
          <p class="glass rounded-2xl p-6 text-center text-sm text-destructive">{{ error() }}</p>
        } @else {
          @if (items().length === 0) {
            <div class="rounded-2xl border-2 border-dashed border-border/50 p-12 text-center text-sm text-muted-foreground">
              Aún no hay plantillas. Crea la primera con "Nueva plantilla".
            </div>
          }
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            @for (p of items(); track p.id) {
              <section
                class="glass flex flex-col rounded-2xl p-4 shadow-[var(--shadow-sm)]"
                [class.opacity-60]="!p.activa"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {{ p.categoria }}
                    </p>
                    <h2 class="truncate text-sm font-bold text-foreground">{{ p.nombre }}</h2>
                  </div>
                  <span
                    class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                    [class]="p.activa
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground'"
                  >
                    {{ p.activa ? 'Activa' : 'Inactiva' }}
                  </span>
                </div>
                <p class="mt-1.5 truncate text-xs text-muted-foreground" [title]="p.asunto">
                  {{ p.asunto }}
                </p>
                <!-- Vista previa (Angular sanea el HTML al enlazarlo). -->
                <div
                  class="mt-2 max-h-40 flex-1 overflow-hidden rounded-xl border border-border/50 bg-white p-3 text-[11px] leading-snug text-neutral-800"
                  [innerHTML]="p.cuerpo_html"
                ></div>
                @if (puedeGestionar()) {
                  <div class="mt-3 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      (click)="editar(p)"
                      class="alma-btn alma-btn-outline h-8 rounded-xl text-xs"
                    >
                      <lucide-icon name="pencil" [size]="13" /> Editar
                    </button>
                    <button
                      type="button"
                      (click)="alternarActiva(p)"
                      class="alma-btn alma-btn-outline h-8 rounded-xl text-xs"
                    >
                      {{ p.activa ? 'Desactivar' : 'Activar' }}
                    </button>
                    <button
                      type="button"
                      (click)="confirmarEliminar.set(p)"
                      class="alma-btn h-8 rounded-xl text-xs text-destructive hover:bg-destructive/10"
                      aria-label="Eliminar plantilla"
                    >
                      <lucide-icon name="trash-2" [size]="13" />
                    </button>
                  </div>
                }
              </section>
            }
          </div>
        }
      </div>

      <!-- ── Editor de plantilla: réplica del EditTemplateDialog de Dali ── -->
      @if (editando(); as ed) {
        <div
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          (click)="cerrarEditor()"
        >
          <div
            class="surface-solid flex max-h-[92vh] w-full max-w-5xl flex-col gap-2 rounded-2xl border-l-[3px] border border-border border-l-primary px-4 pb-3 pt-3 shadow-2xl"
            (click)="$event.stopPropagation()"
          >
            <!-- Header: ícono degradado + título + subtítulo + X (Dali) -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex min-w-0 items-center gap-2.5">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 shadow-md shadow-primary/25">
                  <lucide-icon name="mail" [size]="16" class="text-white" />
                </div>
                <div class="min-w-0">
                  <h2 class="text-base font-semibold leading-tight tracking-tight">
                    {{ ed.id ? 'Editar plantilla' : 'Nueva plantilla' }}
                  </h2>
                  <p class="text-[10px] leading-tight text-muted-foreground">
                    Modifica el nombre, categoría, contenido y asunto
                  </p>
                </div>
              </div>
              <button
                type="button"
                (click)="cerrarEditor()"
                class="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar"
              >
                <lucide-icon name="x" [size]="16" />
              </button>
            </div>

            <!-- Toolbar + asunto + campos + lienzo (el editor completo) -->
            <div class="min-h-0 flex-1 overflow-y-auto">
              <alma-editor-correo
                [(asunto)]="ed.asunto"
                [(value)]="ed.cuerpo_html"
                [variables]="variables()"
                [conPlantillas]="items().length > 0"
                (abrirPlantillas)="selectorBase.set(true)"
              />
            </div>

            @if (errorEditor(); as err) {
              <p class="rounded-xl bg-destructive/10 p-2 text-center text-xs text-destructive">
                {{ err }}
              </p>
            }

            <!-- Footer pill: Nombre Plantilla + Categoría (+ nueva) + acciones (Dali) -->
            <div class="rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 shadow-sm">
              <div class="flex flex-row flex-wrap items-center gap-2">
                <div class="flex min-w-[180px] flex-1 items-center border-b border-border/50 transition-colors focus-within:border-primary">
                  <span class="whitespace-nowrap pl-1 pr-1.5 text-xs font-medium text-muted-foreground">Nombre Plantilla:</span>
                  <input [(ngModel)]="ed.nombre" maxlength="150" placeholder="Sin nombre"
                         class="h-8 w-full border-0 bg-transparent px-0 text-sm outline-none" />
                </div>
                @if (!nuevaCategoria()) {
                  <div class="flex min-w-[160px] items-center border-b border-border/50 transition-colors focus-within:border-primary">
                    <span class="whitespace-nowrap pl-1 pr-1.5 text-xs font-medium text-muted-foreground">Categoría:</span>
                    <select [(ngModel)]="ed.categoria"
                            class="h-8 cursor-pointer border-0 bg-transparent text-sm text-foreground outline-none">
                      @for (c of categorias(); track c) { <option [value]="c">{{ c }}</option> }
                    </select>
                    <button type="button" title="Crear nueva categoría" (click)="nuevaCategoria.set(true)"
                            class="ml-0.5 flex h-6 w-6 items-center justify-center rounded-md text-primary hover:bg-primary/10">
                      <lucide-icon name="plus" [size]="12" />
                    </button>
                  </div>
                } @else {
                  <div class="flex min-w-[160px] items-center gap-1 border-b border-border/50 focus-within:border-primary">
                    <span class="whitespace-nowrap pl-1 pr-1.5 text-xs font-medium text-muted-foreground">Nueva:</span>
                    <input #nuevaCat maxlength="60" placeholder="Categoría…"
                           class="h-8 w-28 border-0 bg-transparent px-0 text-sm outline-none"
                           (keydown.enter)="crearCategoria(nuevaCat.value); nuevaCat.value=''" />
                    <button type="button" class="h-6 px-1.5 text-[10px] font-medium text-primary"
                            (click)="crearCategoria(nuevaCat.value); nuevaCat.value=''">Crear</button>
                    <button type="button" class="h-6 px-1 text-[10px] text-muted-foreground"
                            (click)="nuevaCategoria.set(false)">✕</button>
                  </div>
                }
                <div class="ml-auto flex items-center gap-2">
                  <button type="button" (click)="cerrarEditor()" [disabled]="guardando()"
                          class="rounded-xl border border-border/60 bg-background/50 px-3 py-1.5 text-xs transition-all hover:border-amber-500 hover:bg-amber-500 hover:text-white">
                    Cancelar
                  </button>
                  <button type="button" (click)="guardar()"
                          [disabled]="guardando() || !ed.nombre.trim() || !ed.asunto.trim() || !ed.cuerpo_html.trim()"
                          class="flex items-center gap-1 rounded-xl bg-gradient-to-r from-primary to-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-primary/25 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50">
                    @if (guardando()) {
                      <lucide-icon name="loader-2" [size]="12" class="animate-spin" /> Guardando…
                    } @else {
                      <lucide-icon name="save" [size]="12" /> {{ ed.id ? 'Actualizar' : 'Guardar' }}
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Galería (estilo Dali) para usar otra plantilla como base -->
        @if (selectorBase()) {
          <alma-galeria-plantillas-dialog
            [plantillas]="items()"
            (closed)="selectorBase.set(false)"
            (seleccionar)="usarComoBase($event)"
          />
        }
      }

      <!-- Confirmación de eliminación -->
      @if (confirmarEliminar(); as p) {
        <div class="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" (click)="confirmarEliminar.set(null)">
          <div class="surface-solid w-full max-w-sm rounded-2xl border border-border p-6 shadow-2xl" (click)="$event.stopPropagation()">
            <h2 class="text-base font-bold">¿Eliminar "{{ p.nombre }}"?</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              Esta acción no se puede deshacer. Si solo quieres sacarla de la galería,
              usa "Desactivar".
            </p>
            <div class="mt-4 flex justify-end gap-2">
              <button type="button" (click)="confirmarEliminar.set(null)" class="alma-btn alma-btn-outline rounded-xl">
                Cancelar
              </button>
              <button type="button" (click)="eliminar(p)" class="alma-btn rounded-xl bg-destructive text-white hover:bg-destructive/90">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class PlantillasCorreoPageComponent {
  private readonly api = inject(SuscripcionApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly editor = viewChild(EditorCorreoComponent);
  protected readonly nuevaCategoria = signal(false);
  protected readonly selectorBase = signal(false);
  /** Categorías creadas en esta sesión (además de las de las plantillas). */
  private readonly categoriasExtra = signal<string[]>([]);

  protected readonly categorias = computed<string[]>(() => {
    const set = new Set<string>(['Suscripción', 'General']);
    for (const p of this.items()) set.add(p.categoria);
    for (const c of this.categoriasExtra()) set.add(c);
    return [...set].sort();
  });

  protected crearCategoria(nombre: string): void {
    const limpio = nombre.trim();
    if (!limpio) return;
    this.categoriasExtra.set([...this.categoriasExtra(), limpio]);
    const ed = this.editando();
    if (ed) {
      ed.categoria = limpio;
      this.editando.set({ ...ed });
    }
    this.nuevaCategoria.set(false);
  }

  protected usarComoBase(p: PlantillaCorreoApi): void {
    this.selectorBase.set(false);
    const ed = this.editando();
    if (!ed) return;
    ed.asunto = p.asunto;
    ed.cuerpo_html = p.cuerpo_html;
    this.editando.set({ ...ed });
    this.editor()?.cargar(p.asunto, p.cuerpo_html);
  }

  // Cuenta del buzón (OAuth delegado)
  protected readonly cuenta = signal<{
    configurado: boolean;
    conectada: boolean;
    estado: string | null;
    email: string | null;
    conectada_por: string | null;
    buzon_esperado: string | null;
    scopes: string;
  } | null>(null);
  protected readonly conectando = signal(false);
  protected readonly errorCuenta = signal<string | null>(null);

  protected readonly items = signal<PlantillaCorreoApi[]>([]);
  protected readonly variables = signal<Record<string, string>>({});
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorEditor = signal<string | null>(null);
  protected readonly confirmarEliminar = signal<PlantillaCorreoApi | null>(null);

  /** Copia editable (null = editor cerrado). id vacío = nueva. */
  protected readonly editando = signal<{
    id: string;
    nombre: string;
    categoria: string;
    asunto: string;
    cuerpo_html: string;
  } | null>(null);

  protected readonly puedeVer = computed(() =>
    this.auth.hasPermission('app.suscripcion.view'),
  );
  protected readonly puedeGestionar = computed(() =>
    this.auth.hasPermission('app.suscripcion.solicitudes.manage'),
  );

  constructor() {
    void this.cargar();
    void this.cargarCuenta();
    // Retorno del flujo OAuth: Microsoft redirige aquí con ?code=...
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) void this.completarConexion(code);
    else if (this.route.snapshot.queryParamMap.get('error')) {
      this.errorCuenta.set(
        this.route.snapshot.queryParamMap.get('error_description') ??
          'La autorización fue cancelada.',
      );
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  private redirectUri(): string {
    return `${window.location.origin}/apps/suscripcion/plantillas`;
  }

  private async cargarCuenta(): Promise<void> {
    try {
      this.cuenta.set(await this.api.getCuentaCorreo());
    } catch {
      this.cuenta.set(null);
    }
  }

  /** Redirige al login de Microsoft para autorizar la cuenta del buzón. */
  protected conectarCuenta(): void {
    const scopes = this.cuenta()?.scopes ?? 'openid offline_access User.Read Mail.Send Mail.Read';
    const params = new URLSearchParams({
      client_id: environment.azure.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri(),
      response_mode: 'query',
      scope: scopes,
      // El analista tiene SU sesión activa: forzamos el selector de cuentas
      // para que entre con la del buzón, no con la personal.
      prompt: 'select_account',
    });
    const hint = this.cuenta()?.buzon_esperado;
    if (hint) params.set('login_hint', hint);
    window.location.href =
      `https://login.microsoftonline.com/${environment.azure.tenantId}` +
      `/oauth2/v2.0/authorize?${params.toString()}`;
  }

  private async completarConexion(code: string): Promise<void> {
    this.conectando.set(true);
    this.errorCuenta.set(null);
    try {
      await this.api.conectarCuentaCorreo(code, this.redirectUri());
    } catch (e) {
      this.errorCuenta.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.conectando.set(false);
      await this.cargarCuenta();
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  protected async desconectarCuenta(): Promise<void> {
    try {
      await this.api.desconectarCuentaCorreo();
      await this.cargarCuenta();
    } catch (e) {
      this.errorCuenta.set(e instanceof Error ? e.message : String(e));
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const r = await this.api.getPlantillasCorreo();
      this.items.set(r.items);
      this.variables.set(r.variables ?? {});
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected nueva(): void {
    this.errorEditor.set(null);
    this.editando.set({
      id: '',
      nombre: '',
      categoria: 'Suscripción',
      asunto: '',
      cuerpo_html:
        '<p>Buen día {{fp}},</p>\n<p>Sobre la cotización <strong>{{nro_cotizacion}}</strong> ' +
        'del asegurado <strong>{{asegurado}}</strong>:</p>\n<p>{{mensaje}}</p>\n' +
        '<p>Cordialmente,<br/>{{analista}}<br/>Suscripción de Seguros — Skandia</p>',
    });
  }

  protected editar(p: PlantillaCorreoApi): void {
    this.errorEditor.set(null);
    this.editando.set({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      asunto: p.asunto,
      cuerpo_html: p.cuerpo_html,
    });
  }

  protected cerrarEditor(): void {
    this.editando.set(null);
  }

  protected async guardar(): Promise<void> {
    const ed = this.editando();
    if (!ed) return;
    this.guardando.set(true);
    this.errorEditor.set(null);
    const body = {
      nombre: ed.nombre.trim(),
      categoria: ed.categoria.trim() || 'General',
      asunto: ed.asunto.trim(),
      cuerpo_html: ed.cuerpo_html,
    };
    try {
      if (ed.id) await this.api.actualizarPlantillaCorreo(ed.id, body);
      else await this.api.crearPlantillaCorreo(body);
      this.editando.set(null);
      await this.cargar();
    } catch (e) {
      this.errorEditor.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async alternarActiva(p: PlantillaCorreoApi): Promise<void> {
    try {
      await this.api.actualizarPlantillaCorreo(p.id, { activa: !p.activa });
      await this.cargar();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  protected async eliminar(p: PlantillaCorreoApi): Promise<void> {
    this.confirmarEliminar.set(null);
    try {
      await this.api.eliminarPlantillaCorreo(p.id);
      await this.cargar();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

}
