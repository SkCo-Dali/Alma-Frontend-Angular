// Configuración de los casos de Salesforce (Administrador):
//   · Conexión: Connected App con flujo client credentials. El secreto es de escritura:
//     se guarda cifrado y nunca vuelve al navegador.
//   · Plantilla de cada flujo (Correo / Chat): qué casos entran, el prompt, los criterios
//     y el modelo. Guardar crea una versión nueva; se puede probar con un caso real antes.

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import {
  ConfiguracionSf,
  Criterio,
  Flujo,
  MonitorIaCasosApi,
  Plantilla,
  PlantillaIn,
  PruebaPlantilla,
  VersionPlantilla,
} from './casos.api';
import { ETIQUETA_FLUJO, claseRespuesta, lineas } from './casos.domain';
import { fecha } from './monitor-ia.domain';

const CLAVE = /^[A-Za-z][A-Za-z0-9_]{0,59}$/;

@Component({
  selector: 'alma-casos-configuracion',
  imports: [FormsModule, LucideAngularModule, AlmaLoaderComponent],
  template: `
    <div class="space-y-4">
      <!-- Conexión con Salesforce -->
      <section class="glass space-y-4 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-bold text-foreground">Conexión con Salesforce</h2>
            <p class="text-xs text-muted-foreground">Nova solo LEE casos y usuarios; nunca escribe en Salesforce.</p>
          </div>
          @if (config(); as c) {
            @if (c.verificada_en) {
              <span class="alma-badge bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                <lucide-icon name="check" [size]="12" class="mr-1" /> Verificada {{ fecha(c.verificada_en) }}
              </span>
            } @else if (c.configurada) {
              <span class="alma-badge bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Sin verificar</span>
            } @else {
              <span class="alma-badge bg-muted text-muted-foreground">Sin configurar</span>
            }
          }
        </div>

        @if (!config()) {
          <div class="flex justify-center py-8"><alma-loader [size]="48" label="Cargando…" /></div>
        } @else {
          <details class="rounded-xl border border-border/70 bg-[var(--surface-sunken)] px-4 py-2 text-xs text-foreground">
            <summary class="cursor-pointer font-medium">Cómo crear la Connected App en Salesforce</summary>
            <ol class="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>En Configuración de Salesforce, App Manager → <em>New Connected App</em> (o <em>External Client App</em>).</li>
              <li>Habilita OAuth, con el ámbito <code>api</code>, y marca <em>Enable Client Credentials Flow</em>.</li>
              <li>En <em>Manage → Edit Policies</em>, elige el usuario de ejecución (<em>Run As</em>): un usuario de integración con perfil de solo lectura sobre Case y User.</li>
              <li>Copia el <em>Consumer Key</em> (Client ID) y el <em>Consumer Secret</em> y pégalos aquí. No los envíes por correo ni por chat.</li>
              <li>La instancia es la URL de My Domain, por ejemplo <code>https://skandia.my.salesforce.com</code>.</li>
            </ol>
          </details>

          <form class="grid gap-3 sm:grid-cols-2" (ngSubmit)="guardarConexion()">
            <label class="space-y-1 text-xs font-medium text-foreground sm:col-span-2">
              Instancia (My Domain)
              <input class="alma-input" name="instancia" placeholder="https://skandia.my.salesforce.com" required
                     [ngModel]="instancia()" (ngModelChange)="instancia.set($event)" />
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground">
              Client ID (Consumer Key)
              <input class="alma-input" name="clientId" autocomplete="off" [ngModel]="clientId()" (ngModelChange)="clientId.set($event)" />
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground">
              Client Secret
              <input class="alma-input" type="password" name="secreto" autocomplete="new-password"
                     [placeholder]="config()?.tiene_secreto ? 'Guardado · escribe uno nuevo para cambiarlo' : 'Pega el Consumer Secret'"
                     [ngModel]="secreto()" (ngModelChange)="secreto.set($event)" />
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground">
              Versión de API
              <input class="alma-input" name="api" placeholder="v62.0" [ngModel]="apiVersion()" (ngModelChange)="apiVersion.set($event)" />
            </label>
            <div class="grid grid-cols-3 gap-2">
              <label class="space-y-1 text-xs font-medium text-foreground">
                Por campaña
                <input class="alma-input" type="number" min="1" max="500" name="lote" [ngModel]="maxLote()" (ngModelChange)="maxLote.set(+$event)" />
              </label>
              <label class="space-y-1 text-xs font-medium text-foreground">
                Por día
                <input class="alma-input" type="number" min="1" max="10000" name="dia" [ngModel]="maxDia()" (ngModelChange)="maxDia.set(+$event)" />
              </label>
              <label class="space-y-1 text-xs font-medium text-foreground">
                Simultáneos
                <input class="alma-input" type="number" min="1" max="10" name="conc" [ngModel]="concurrencia()" (ngModelChange)="concurrencia.set(+$event)" />
              </label>
            </div>
            <div class="flex flex-wrap items-center gap-2 sm:col-span-2">
              <button type="submit" class="alma-btn alma-btn-primary h-9 rounded-xl px-4 text-sm" [disabled]="guardandoConexion() || !instancia().trim()">
                <lucide-icon [name]="guardandoConexion() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardandoConexion()" /> Guardar
              </button>
              <button type="button" class="alma-btn alma-btn-outline h-9 rounded-xl text-sm" [disabled]="probandoConexion() || !config()?.configurada" (click)="probarConexion()">
                <lucide-icon [name]="probandoConexion() ? 'loader-2' : 'plug'" [size]="15" [class.animate-spin]="probandoConexion()" /> Probar conexión
              </button>
              @if (config()?.actualizado_por) {
                <span class="text-[11px] text-muted-foreground">Última edición: {{ config()?.actualizado_por }} · {{ fecha(config()?.actualizado_en ?? null) }}</span>
              }
            </div>
          </form>
        }
      </section>

      <!-- Plantillas -->
      <section class="glass space-y-4 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-bold text-foreground">Plantilla de calificación</h2>
            <p class="text-xs text-muted-foreground">Cada cambio crea una versión nueva; los casos guardan la versión con que se calificaron.</p>
          </div>
          <nav class="inline-flex gap-1 rounded-xl bg-muted p-1" aria-label="Flujo">
            @for (f of flujos; track f) {
              <button type="button" class="h-7 rounded-lg px-3 text-xs font-medium"
                      [class]="flujo() === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                      (click)="elegirFlujo(f)">{{ etiquetaFlujo[f] }}</button>
            }
          </nav>
        </div>

        @if (cargandoPlantilla()) {
          <div class="flex justify-center py-8"><alma-loader [size]="48" label="Cargando plantilla…" /></div>
        } @else if (vigente(); as v) {
          <p class="text-xs text-muted-foreground">
            Vigente: <span class="font-semibold text-foreground">versión {{ v.version }}</span> · {{ v.creado_por }} · {{ fecha(v.creado_en) }}
            @if (cambiada()) { <span class="ml-1 font-semibold text-amber-700 dark:text-amber-400">· cambios sin guardar</span> }
          </p>

          <div class="grid gap-3 sm:grid-cols-3">
            <label class="space-y-1 text-xs font-medium text-foreground">
              Orígenes del caso (uno por línea)
              <textarea class="alma-input min-h-20 py-2" name="origenes" [ngModel]="origenes()" (ngModelChange)="origenes.set($event)"></textarea>
              <span class="block text-[11px] font-normal text-muted-foreground">Valores exactos del campo Origen en Salesforce.</span>
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground">
              «Responder a» que NO entran
              <textarea class="alma-input min-h-20 py-2" name="excluir" [ngModel]="excluir()" (ngModelChange)="excluir.set($event)"></textarea>
              <span class="block text-[11px] font-normal text-muted-foreground">Vacío = entran todos.</span>
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground">
              Modelo
              <select class="alma-input" name="modelo" [ngModel]="modelo()" (ngModelChange)="modelo.set($event)">
                @for (m of modelos(); track m) { <option [value]="m">{{ m }}</option> }
              </select>
              <span class="block text-[11px] font-normal text-muted-foreground">Siempre cerrados y con fecha de cierre en el período de la campaña.</span>
            </label>
          </div>

          <!-- Criterios -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-semibold text-foreground">Criterios ({{ criterios().length }}) · cada uno se califica «Si» o «No»</h3>
              <button type="button" class="text-xs font-medium text-primary hover:underline disabled:opacity-40" [disabled]="criterios().length >= 20" (click)="agregarCriterio()">
                + Agregar criterio
              </button>
            </div>
            <div class="space-y-1.5">
              @for (c of criterios(); track $index; let i = $index) {
                <div class="flex items-center gap-2">
                  <input class="alma-input h-8 w-56 shrink-0 font-mono text-xs" [class.border-destructive]="!claveValida(c.clave)" [name]="'clave' + i"
                         aria-label="Clave del criterio" [ngModel]="c.clave" (ngModelChange)="editarCriterio(i, 'clave', $event)" />
                  <input class="alma-input h-8 min-w-0 flex-1 text-xs" [name]="'nombre' + i" aria-label="Nombre visible del criterio"
                         [ngModel]="c.nombre" (ngModelChange)="editarCriterio(i, 'nombre', $event)" />
                  <button type="button" class="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" [attr.aria-label]="'Quitar ' + c.clave" (click)="quitarCriterio(i)">
                    <lucide-icon name="trash-2" [size]="14" />
                  </button>
                </div>
              }
            </div>
            <p class="text-[11px] text-muted-foreground">La clave es la que se usa en el prompt y en la columna del Excel: letras, números y guion bajo.</p>
          </div>

          <label class="block space-y-1 text-xs font-medium text-foreground">
            Instrucciones para la IA (prompt de sistema)
            <textarea class="alma-input min-h-64 py-2 font-mono text-xs leading-relaxed" name="sistema" [ngModel]="sistema()" (ngModelChange)="sistema.set($event)"></textarea>
            <span class="block text-[11px] font-normal text-muted-foreground">
              No hace falta describir el JSON: Nova exige la salida (resumen, un «Si»/«No» por criterio y análisis general).
            </span>
          </label>
          <label class="block space-y-1 text-xs font-medium text-foreground">
            Mensaje con el caso
            <textarea class="alma-input min-h-20 py-2 font-mono text-xs" name="usuario" [ngModel]="usuario()" (ngModelChange)="usuario.set($event)"></textarea>
            <span class="block text-[11px] font-normal" [class]="faltanMarcas().length ? 'text-destructive' : 'text-muted-foreground'">
              Debe incluir <code>{{ marcas[0] }}</code> y <code>{{ marcas[1] }}</code>: ahí va el texto del caso de Salesforce.
            </span>
          </label>

          @if (errorPlantilla(); as e) { <p class="text-xs text-destructive">{{ e }}</p> }

          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="alma-btn alma-btn-primary h-9 rounded-xl px-4 text-sm" [disabled]="!!errorPlantilla() || !cambiada() || guardandoPlantilla()" (click)="guardarPlantilla()">
              <lucide-icon [name]="guardandoPlantilla() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardandoPlantilla()" /> Guardar como versión {{ v.version + 1 }}
            </button>
            <button type="button" class="alma-btn alma-btn-ghost h-9 w-auto whitespace-nowrap rounded-xl px-3 text-sm" [disabled]="!cambiada()" (click)="cargarEnFormulario(v)">
              Descartar cambios
            </button>
          </div>

          <!-- Probar -->
          <div class="space-y-3 rounded-2xl border border-border/70 bg-[var(--surface-sunken)] p-4">
            <h3 class="text-xs font-semibold text-foreground">Probar con un caso real (no guarda nada)</h3>
            <div class="flex flex-wrap items-end gap-2">
              <label class="space-y-1 text-xs font-medium text-foreground">
                Número de caso
                <input class="alma-input h-9 w-40" name="caso" inputmode="numeric" [ngModel]="casoPrueba()" (ngModelChange)="casoPrueba.set($event)" />
              </label>
              <button type="button" class="alma-btn alma-btn-outline h-9 rounded-xl text-sm"
                      [disabled]="probando() || !!errorPlantilla() || !casoPrueba().trim() || !config()?.configurada" (click)="probar()">
                <lucide-icon [name]="probando() ? 'loader-2' : 'sparkles'" [size]="15" [class.animate-spin]="probando()" /> Calificar con la plantilla en edición
              </button>
            </div>
            @if (prueba(); as p) {
              <div class="space-y-2 text-sm">
                <p class="text-xs text-muted-foreground">Cumple {{ p.cumplidos }} de {{ p.total }} · {{ p.modelo }}</p>
                <div class="flex flex-wrap gap-1.5">
                  @for (k of clavesDe(p); track k) {
                    <span class="alma-badge" [class]="claseRespuesta(p.calificacion_general[k])">{{ k }}: {{ p.calificacion_general[k] }}</span>
                  }
                </div>
                <p class="whitespace-pre-line text-foreground"><span class="font-semibold">Resumen: </span>{{ p.resumen }}</p>
                <p class="whitespace-pre-line text-foreground"><span class="font-semibold">Análisis: </span>{{ p.analisis_general }}</p>
              </div>
            }
          </div>

          <!-- Versiones -->
          @if (versiones().length > 1) {
            <details class="text-xs">
              <summary class="cursor-pointer font-medium text-foreground">Versiones anteriores ({{ versiones().length - 1 }})</summary>
              <ul class="mt-2 divide-y divide-border/60">
                @for (x of versiones(); track x.id) {
                  @if (!x.activa) {
                    <li class="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span class="text-muted-foreground">v{{ x.version }} · {{ x.modelo }} · {{ x.creado_por }} · {{ fecha(x.creado_en) }}</span>
                      <span class="flex gap-3">
                        <button type="button" class="font-medium text-primary hover:underline" (click)="verVersion(x)">Cargar en el editor</button>
                        <button type="button" class="font-medium text-primary hover:underline" [disabled]="guardandoPlantilla()" (click)="restaurar(x)">Restaurar</button>
                      </span>
                    </li>
                  }
                }
              </ul>
            </details>
          }
        }
      </section>
    </div>
  `,
})
export class CasosConfiguracionComponent {
  private readonly api = inject(MonitorIaCasosApi);
  private readonly toast = inject(ToastService);

  protected readonly fecha = fecha;
  protected readonly flujos: Flujo[] = ['CORREO', 'CHAT'];
  protected readonly etiquetaFlujo = ETIQUETA_FLUJO;
  protected readonly claseRespuesta = claseRespuesta;

  // Conexión
  protected readonly config = signal<ConfiguracionSf | null>(null);
  protected readonly instancia = signal('');
  protected readonly clientId = signal('');
  protected readonly secreto = signal('');
  protected readonly apiVersion = signal('v62.0');
  protected readonly maxLote = signal(100);
  protected readonly maxDia = signal(500);
  protected readonly concurrencia = signal(3);
  protected readonly guardandoConexion = signal(false);
  protected readonly probandoConexion = signal(false);

  // Plantilla
  protected readonly flujo = signal<Flujo>('CORREO');
  protected readonly cargandoPlantilla = signal(true);
  protected readonly guardandoPlantilla = signal(false);
  protected readonly vigente = signal<Plantilla | null>(null);
  protected readonly versiones = signal<VersionPlantilla[]>([]);
  protected readonly modelos = signal<string[]>([]);
  protected readonly origenes = signal('');
  protected readonly excluir = signal('');
  protected readonly modelo = signal('');
  protected readonly criterios = signal<Criterio[]>([]);
  protected readonly sistema = signal('');
  protected readonly usuario = signal('');
  protected readonly casoPrueba = signal('');
  protected readonly probando = signal(false);
  protected readonly prueba = signal<PruebaPlantilla | null>(null);

  protected readonly datos = computed<PlantillaIn>(() => ({
    origenes: lineas(this.origenes()),
    responder_a_excluir: lineas(this.excluir()),
    prompt_sistema: this.sistema().trim(),
    prompt_usuario: this.usuario().trim(),
    criterios: this.criterios().map((c) => ({ clave: c.clave.trim(), nombre: c.nombre.trim() })),
    modelo: this.modelo(),
  }));

  /** Marcas del mensaje con el caso (en el template, las llaves se leerían como ICU). */
  protected readonly marcas = ['{descripcion}', '{solucion}'];

  protected readonly faltanMarcas = computed(() => this.marcas.filter((m) => !this.usuario().includes(m)));

  protected readonly errorPlantilla = computed(() => {
    const d = this.datos();
    if (!d.origenes.length) return 'Indica al menos un origen.';
    if (!d.criterios.length) return 'La plantilla necesita al menos un criterio.';
    if (d.criterios.some((c) => !CLAVE.test(c.clave))) return 'Hay claves de criterio no válidas.';
    if (new Set(d.criterios.map((c) => c.clave)).size !== d.criterios.length) return 'Hay criterios con la misma clave.';
    if (!d.prompt_sistema) return 'Escribe las instrucciones para la IA.';
    if (this.faltanMarcas().length) return `El mensaje con el caso debe incluir ${this.faltanMarcas().join(' y ')}.`;
    return null;
  });

  protected readonly cambiada = computed(() => {
    const v = this.vigente();
    if (!v) return false;
    const { origenes, responder_a_excluir, prompt_sistema, prompt_usuario, criterios, modelo } = v;
    return (
      JSON.stringify(this.datos()) !==
      JSON.stringify({ origenes, responder_a_excluir, prompt_sistema, prompt_usuario, criterios, modelo })
    );
  });

  constructor() {
    void this.cargarConexion();
    void this.cargarPlantilla();
  }

  // ── conexión ─────────────────────────────────────────────────────────────

  private aplicarConexion(c: ConfiguracionSf): void {
    this.config.set(c);
    this.instancia.set(c.instancia ?? '');
    this.clientId.set(c.client_id ?? '');
    this.secreto.set('');
    this.apiVersion.set(c.api_version);
    this.maxLote.set(c.max_por_lote);
    this.maxDia.set(c.max_por_dia);
    this.concurrencia.set(c.concurrencia);
  }

  private async cargarConexion(): Promise<void> {
    try {
      this.aplicarConexion(await this.api.configuracion());
    } catch (e) {
      this.toast.error('No se pudo cargar la conexión con Salesforce', e instanceof Error ? e.message : String(e));
    }
  }

  protected async guardarConexion(): Promise<void> {
    this.guardandoConexion.set(true);
    try {
      this.aplicarConexion(
        await this.api.guardarConfiguracion({
          instancia: this.instancia().trim(),
          client_id: this.clientId().trim() || null,
          client_secret: this.secreto().trim() || null,
          api_version: this.apiVersion().trim() || 'v62.0',
          max_por_lote: this.maxLote(),
          max_por_dia: this.maxDia(),
          concurrencia: this.concurrencia(),
        }),
      );
      this.toast.show('Conexión guardada', 'Pruébala para verificar las credenciales.');
    } catch (e) {
      this.toast.error('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoConexion.set(false);
    }
  }

  protected async probarConexion(): Promise<void> {
    this.probandoConexion.set(true);
    try {
      this.aplicarConexion(await this.api.probarConexion());
      this.toast.show('Conexión verificada', 'Nova pudo leer casos de Salesforce.');
    } catch (e) {
      this.toast.error('La conexión falló', e instanceof Error ? e.message : String(e));
    } finally {
      this.probandoConexion.set(false);
    }
  }

  // ── plantilla ────────────────────────────────────────────────────────────

  protected elegirFlujo(f: Flujo): void {
    if (f === this.flujo()) return;
    if (this.cambiada() && !confirm('Hay cambios sin guardar en esta plantilla. ¿Descartarlos?')) return;
    this.flujo.set(f);
    void this.cargarPlantilla();
  }

  protected cargarEnFormulario(p: PlantillaIn): void {
    this.origenes.set(p.origenes.join('\n'));
    this.excluir.set(p.responder_a_excluir.join('\n'));
    this.modelo.set(p.modelo);
    this.criterios.set(p.criterios.map((c) => ({ ...c })));
    this.sistema.set(p.prompt_sistema);
    this.usuario.set(p.prompt_usuario);
  }

  private async cargarPlantilla(): Promise<void> {
    this.cargandoPlantilla.set(true);
    this.prueba.set(null);
    try {
      const r = await this.api.plantilla(this.flujo());
      this.vigente.set(r.vigente);
      this.versiones.set(r.versiones);
      // Si el modelo guardado ya no está en la lista, igual se muestra para no perderlo.
      this.modelos.set(r.modelos.includes(r.vigente.modelo) ? r.modelos : [r.vigente.modelo, ...r.modelos]);
      this.cargarEnFormulario(r.vigente);
    } catch (e) {
      this.toast.error('No se pudo cargar la plantilla', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargandoPlantilla.set(false);
    }
  }

  protected claveValida(clave: string): boolean {
    return CLAVE.test(clave.trim());
  }

  protected editarCriterio(i: number, campo: keyof Criterio, valor: string): void {
    this.criterios.set(this.criterios().map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));
  }

  protected agregarCriterio(): void {
    this.criterios.set([...this.criterios(), { clave: `Criterio_${this.criterios().length + 1}`, nombre: '' }]);
  }

  protected quitarCriterio(i: number): void {
    this.criterios.set(this.criterios().filter((_, j) => j !== i));
  }

  protected async guardarPlantilla(): Promise<void> {
    if (this.errorPlantilla()) return;
    this.guardandoPlantilla.set(true);
    try {
      const v = await this.api.guardarPlantilla(this.flujo(), this.datos());
      this.toast.show(`Versión ${v.version} guardada`, 'Se usará en las próximas calificaciones.');
      await this.cargarPlantilla();
    } catch (e) {
      this.toast.error('No se pudo guardar la plantilla', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoPlantilla.set(false);
    }
  }

  protected async verVersion(x: VersionPlantilla): Promise<void> {
    try {
      this.cargarEnFormulario(await this.api.version(this.flujo(), x.id));
      this.toast.show(`Versión ${x.version} en el editor`, 'Guárdala para dejarla vigente.');
    } catch (e) {
      this.toast.error('No se pudo cargar la versión', e instanceof Error ? e.message : String(e));
    }
  }

  protected async restaurar(x: VersionPlantilla): Promise<void> {
    if (!confirm(`¿Dejar vigente el contenido de la versión ${x.version}? Se creará una versión nueva.`)) return;
    this.guardandoPlantilla.set(true);
    try {
      await this.api.restaurarVersion(this.flujo(), x.id);
      await this.cargarPlantilla();
    } catch (e) {
      this.toast.error('No se pudo restaurar', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoPlantilla.set(false);
    }
  }

  protected clavesDe(p: PruebaPlantilla): string[] {
    return Object.keys(p.calificacion_general);
  }

  protected async probar(): Promise<void> {
    this.probando.set(true);
    this.prueba.set(null);
    try {
      this.prueba.set(await this.api.probarPlantilla(this.flujo(), this.datos(), this.casoPrueba().trim()));
    } catch (e) {
      this.toast.error('No se pudo calificar el caso', e instanceof Error ? e.message : String(e));
    } finally {
      this.probando.set(false);
    }
  }
}
