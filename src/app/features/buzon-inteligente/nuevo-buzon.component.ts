// Asistente «Nuevo buzón» — réplica de `mNuevoBuzon` del prototipo validado
// (contexto-recaudos-pac/buzon-inteligente-v2.html), 6 pasos: Conectar buzón · Reglas ·
// Asignación · Formato específico · Exportación · Revisión. Activa solo lo que el área
// necesita; lo omitido se activa después desde el buzón.
//
// Diferencia con el prototipo: el buzón se crea «En configuración» (061) al pulsar
// «Conectar con Microsoft», porque el inicio de sesión sale de Alma y vuelve a
// /buzones?asistente=<id>. Desde ahí cada paso guarda en el borrador del buzón real
// (las mismas APIs de la configuración); el worker no lo lee hasta «Activar buzón»,
// que publica las reglas v1.

import { Component, computed, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { aplanar } from './ajustes-tab.component';
import { AsignacionWizardComponent, EstadoPasoAsignacion } from './asignacion-wizard.component';
import { AvisoCuentaBuzonComponent } from './aviso-cuenta-buzon.component';
import { Buzon, BuzonApi, Categoria, DOMINIOS_CORREO, Grupo, ModoConexion, NombreBuzon, Proceso, PruebaSeco, Salida, TipoCuenta } from './buzon.api';
import { ExportacionWizardComponent, SubvistaExportacion } from './exportacion-wizard.component';
import { ReglasTabComponent } from './reglas-tab.component';

const NOMBRES = ['Conectar buzón', 'Reglas', 'Asignación', 'Formato específico', 'Exportación', 'Revisión'];
const RE_CORREO = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

interface FilaResumen {
  icono: string;
  titulo: string;
  texto: string;
  omitido: boolean;
}

@Component({
  selector: 'alma-nuevo-buzon',
  imports: [FormsModule, LucideAngularModule, ReglasTabComponent, AsignacionWizardComponent, ExportacionWizardComponent, AvisoCuentaBuzonComponent],
  styleUrls: ['./buzon-proto.css'],
  template: `
    <div class="scrim">
      <div class="modal solid" [class.full]="paso() === 2" [class.xl]="paso() !== 2" role="dialog" aria-modal="true" aria-label="Nuevo buzón">
        @if (!subvista()) {
          <div class="row between">
            <div><h2 class="sm b">Nuevo buzón</h2><p class="xs muted">Activa solo lo que tu área necesita. Lo omitido se puede activar después desde el buzón.</p></div>
            <button type="button" class="btn ghost" (click)="pedirCierre()" aria-label="Cerrar"><lucide-icon name="x" [size]="16" /></button>
          </div>
          @if (confirmarCierre()) {
            <div class="note b-amber" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
              <span><lucide-icon name="alert-triangle" [size]="13" /> ¿Salir del asistente? {{ buzon() ? 'Lo configurado queda guardado «En configuración».' : 'Lo que no guardes se pierde.' }}</span>
              <span class="row">
                @if (buzon()) { <button type="button" class="btn outline sm" (click)="guardarDespues()">Guardar y continuar después</button> }
                @else { <button type="button" class="btn sm danger" (click)="cerrado.emit()">Salir sin guardar</button> }
                <button type="button" class="btn sm" (click)="confirmarCierre.set(false)">Seguir aquí</button>
              </span>
            </div>
          }
          <div class="nbsteps">
            @for (n of nombres; track n; let i = $index) {
              @let st = estadoPaso(i + 1);
              <span [class]="st">{{ st === 'done' ? '✓ ' : st === 'skip' ? '– ' : i + 1 + '. ' }}{{ n }}{{ st === 'skip' ? ' (omitido)' : '' }}</span>
            }
          </div>
        }

        @if (cargando()) {
          <p class="xs muted">Cargando…</p>
        } @else {
          @switch (paso()) {
            @case (1) {
              <p class="sm">Tipo de cuenta</p>
              <div class="g2">
                <button type="button" class="optcard" [attr.aria-pressed]="tipo() === 'gen'" [disabled]="!!buzon()" (click)="cambiarTipo('gen')">
                  <span class="row sm b"><lucide-icon name="users" [size]="13" /> Genérica (buzón de área)</span>
                  <span class="xs muted">Se conecta con la cuenta del buzón o con tu acceso delegado.</span>
                </button>
                <button type="button" class="optcard" [attr.aria-pressed]="tipo() === 'per'" [disabled]="!!buzon()" (click)="cambiarTipo('per')">
                  <span class="row sm b"><lucide-icon name="user" [size]="13" /> Personal</span>
                  <span class="xs muted">Solo la conecta su dueño. Se sugiere vigilar una subcarpeta dedicada.</span>
                </button>
              </div>
              <div class="fld">
                <label class="label" for="nb-correo">Dirección de correo *</label>
                <input class="input" id="nb-correo" [ngModel]="correo()" (ngModelChange)="cambiarCorreo($event)" [disabled]="!!buzon()"
                  [placeholder]="(tipo() === 'per' ? 'nombre.apellido' : 'area') + '@skandia.com.co'" />
              </div>
              <div class="namebox">
                <span class="label">Nombre en Alma (estructura {{ '{' }}TIPO{{ '}' }}-{{ '{' }}ALIAS{{ '}' }})</span>
                <p class="mono bb">{{ nombre() }}</p>
                @if (valido() && !dominioOk()) {
                  <p class="err"><lucide-icon name="x-circle" [size]="13" /> Dominio no permitido</p>
                } @else if (!buzon() && duplicado(); as d) {
                  <p class="err"><lucide-icon name="x-circle" [size]="13" /> Ya existe {{ d.nombre }}{{ d.misma_direccion ? ' con esta dirección' : '' }}. Usa otra dirección o abre el buzón existente.</p>
                } @else if (valido()) {
                  <p class="xs" style="color:var(--emerald)"><lucide-icon name="check" [size]="13" /> {{ buzon() ? 'Reservado para este buzón' : 'Nombre disponible' }}</p>
                }
              </div>
              @if (valido() && !dominioOk()) {
                <p class="note b-amber">
                  <lucide-icon name="alert-triangle" [size]="13" />
                  <span>
                    Solo se pueden conectar correos corporativos ({{ dominiosTxt() }}). Revisa la dirección: con otro dominio Microsoft no deja conectar el buzón.
                    @if (sugerencia(); as s) {
                      ¿Quisiste decir <button type="button" class="linkbtn" [disabled]="!!buzon()" (click)="cambiarCorreo(s)">{{ s }}</button>?
                    }
                  </span>
                </p>
              }
              @if (!conectado() && tipo() === 'gen') {
                <p class="sm">Cómo se conecta</p>
                <div class="g2">
                  <button type="button" class="optcard" [attr.aria-pressed]="modo() === 'propia'" (click)="modo.set('propia')">
                    <span class="row sm b"><lucide-icon name="key-round" [size]="13" /> Con la cuenta del buzón</span>
                    <span class="xs muted">Inicias sesión con {{ correo() || 'la genérica' }}, igual que una cuenta personal. No necesita aprobación de TI.</span>
                  </button>
                  <button type="button" class="optcard" [attr.aria-pressed]="modo() === 'compartida'" (click)="modo.set('compartida')">
                    <span class="row sm b"><lucide-icon name="user-check" [size]="13" /> Con mi cuenta (acceso delegado)</span>
                    <span class="xs muted">Tu cuenta con acceso completo al buzón. Requiere que TI apruebe el acceso delegado de Alma.</span>
                  </button>
                </div>
                @if (modo() === 'propia') {
                  <alma-aviso-cuenta-buzon [direccion]="correo()" />
                }
              }
              @if (!conectado()) {
                @if (buzon()) {
                  <p class="xs muted">
                    ¿La dirección quedó mal escrita?
                    <button type="button" class="linkbtn" [disabled]="trabajando()" (click)="cambiarDireccion()">Cambiar dirección</button>
                    (descarta este borrador sin conectar).
                  </p>
                }
                <div class="row">
                  <button type="button" class="btn primary" [disabled]="!valido() || !dominioOk() || !!duplicado() || conectando()" (click)="conectar()">
                    <lucide-icon name="log-in" [size]="13" /> {{ conectando() ? 'Conectando…' : 'Conectar con Microsoft' }}
                  </button>
                  <span class="xxs muted">{{ tipo() === 'per' ? 'Debes ser el dueño de la cuenta.' : modo() === 'propia' ? 'Inicia sesión con ' + (correo() || 'la cuenta del buzón') + ', no con la tuya.' : 'Tu cuenta debe tener acceso delegado al buzón.' }}</span>
                </div>
                @if (errorConexion()) {
                  <p class="note b-rose"><lucide-icon name="shield-x" [size]="13" /> <span>{{ errorConexion() }}</span></p>
                }
              } @else {
                <div class="row between sunk r-xl" style="padding:8px 12px">
                  <span class="row sm"><lucide-icon name="check-circle-2" [size]="13" /> Conectado como <b>{{ buzon()!.conectada_por }}</b>{{ buzon()!.conexion_compartida ? ' · acceso delegado a ' + correo() : '' }}</span>
                  <button type="button" class="btn sm" (click)="conectar()">Cambiar</button>
                </div>
                <div class="fld">
                  <span class="label">Carpeta vigilada · leída de {{ correo() }}</span>
                  <div class="sunk r-xl" style="padding:6px;display:grid;gap:2px;max-height:220px;overflow:auto" role="radiogroup" aria-label="Carpeta vigilada">
                    @for (f of carpetas(); track f.nombre; let i = $index) {
                      <label class="row sm" style="padding:4px 8px;flex-wrap:nowrap;border-radius:8px" [style.padding-left.px]="8 + f.nivel * 20"
                        [style.background]="carpeta() === f.nombre ? 'color-mix(in srgb,var(--primary) 12%,transparent)' : null" [for]="'fo-' + i">
                        <input type="radio" name="fo" [id]="'fo-' + i" [checked]="carpeta() === f.nombre" (change)="carpeta.set(f.nombre)" />
                        <lucide-icon [name]="i === 0 ? 'inbox' : 'folder'" [size]="13" /> {{ nombreCarpeta(f.nombre) }} <span class="xxs muted">{{ f.total.toLocaleString('es-CO') }}</span>
                      </label>
                    } @empty {
                      <p class="xs muted" style="padding:4px 8px">Leyendo carpetas…</p>
                    }
                  </div>
                  @if (tipo() === 'per' && !tieneAlma()) {
                    <button type="button" class="btn outline sm" style="justify-self:start" (click)="crearSubcarpeta()"><lucide-icon name="folder-plus" [size]="13" /> Crear subcarpeta «Alma» (recomendado)</button>
                  }
                </div>
                <div class="fld">
                  <label class="label" for="nb-desc">Descripción</label>
                  <input class="input" id="nb-desc" [(ngModel)]="descripcion" placeholder="Para qué se usa este buzón (aparece en la tarjeta)" />
                </div>
              }
              @if (tipo() === 'per') {
                <p class="note b-amber"><lucide-icon name="shield-alert" [size]="13" /> <span>Cuenta personal: Alma solo leerá la carpeta elegida. Usa una subcarpeta dedicada para no procesar tu correo personal.</span></p>
              }
            }
            @case (2) {
              <div class="row between">
                <p class="sm">¿Quién clasifica los correos?</p>
                <div class="pills">
                  <button type="button" [attr.aria-selected]="buzon()!.modo_clasificacion === 'prompt'" (click)="clasificador('prompt')"><lucide-icon name="scroll-text" [size]="13" /> Prompt de Alma</button>
                  <button type="button" [attr.aria-selected]="buzon()!.modo_clasificacion === 'agente'" (click)="clasificador('agente')"><lucide-icon name="bot" [size]="13" /> Agente de Foundry</button>
                </div>
              </div>
              @if (buzon()!.modo_clasificacion === 'agente') {
                <div class="g2">
                  <div class="fld"><label class="label" for="nb-ag-p">Proyecto</label><input class="input" id="nb-ag-p" [(ngModel)]="agenteProyecto" (change)="guardarAgente()" /></div>
                  <div class="fld"><label class="label" for="nb-ag-n">Agente</label><input class="input" id="nb-ag-n" [(ngModel)]="agenteNombre" (change)="guardarAgente()" placeholder="Nombre del agente en Foundry" /></div>
                </div>
                <p class="note b-amber"><lucide-icon name="plug" [size]="13" /> <span>Leer las instrucciones del agente desde Foundry requiere que TI habilite el acceso de Alma al proyecto. Mientras tanto, pega su prompt con «Pegar o subir prompt» y Alma lo convierte en reglas.</span></p>
              }
              <alma-reglas-tab [buzon]="buzon()!" modo="wiz" (buzonActualizado)="buzon.set($event)" (listo)="reglasListas.set($event)" />
            }
            @case (3) {
              <alma-asignacion-wizard #asig [buzon]="buzon()!" [categorias]="categorias()" [paso]="3" (estadoChange)="estadoAsig.set($event)" />
            }
            @case (4) {
              <alma-asignacion-wizard #asig [buzon]="buzon()!" [categorias]="categorias()" [paso]="4" (estadoChange)="estadoEsp.set($event)" />
            }
            @case (5) {
              <alma-exportacion-wizard #exp [buzon]="buzon()!" [categorias]="categorias()" (buzonActualizado)="buzon.set($event)"
                (subvistaChange)="subvista.set($event)" (cerrar)="pedirCierre()" />
            }
            @case (6) {
              <div class="stack" style="gap:6px">
                @for (r of resumen(); track r.titulo) {
                  <div class="row between sunk r-xl" style="padding:8px 12px;flex-wrap:nowrap;align-items:flex-start">
                    <span class="row sm" style="flex-wrap:nowrap;flex:none"><lucide-icon [name]="r.icono" [size]="13" /> <b>{{ r.titulo }}</b></span>
                    <span class="xs" [class.muted]="r.omitido" style="text-align:right">{{ r.texto }}</span>
                  </div>
                }
              </div>
              <div class="row">
                <button type="button" class="btn outline sm" [disabled]="probando()" (click)="pruebaSeco()"><lucide-icon name="flask-conical" [size]="13" /> {{ probando() ? 'Probando…' : 'Prueba en seco con los últimos 20 correos' }}</button>
              </div>
              @if (seco(); as s) {
                <div class="scroll-x">
                  <table class="t">
                    <thead><tr><th>Proceso</th><th>Resultado</th><th class="num">Correos</th></tr></thead>
                    <tbody>
                      @for (r of s.resumen; track $index) { <tr><td>{{ r.proceso }}</td><td class="xs">{{ r.resultado }}</td><td class="num">{{ r.correos }}</td></tr> }
                      <tr><td><span class="badge b-amber">Validar</span></td><td class="xs">confianza baja o críticos vacíos</td><td class="num">{{ s.validar }}</td></tr>
                    </tbody>
                  </table>
                </div>
                <p class="xxs muted">Simulación: no se tocó Outlook.</p>
              }
            }
          }
        }

        @if (error()) { <p class="err">{{ error() }}</p> }

        @if (!subvista()) {
          <div class="row between">
            <button type="button" class="btn outline" [disabled]="paso() === 1 || trabajando()" (click)="atras()">Atrás</button>
            @if (paso() < 6) {
              <div class="row">
                @if (porque()) { <span class="xxs muted">{{ porque() }}</span> }
                <button type="button" class="btn primary" [disabled]="!puedeSeguir() || trabajando()" (click)="continuar()">Continuar</button>
              </div>
            } @else {
              <div class="row">
                <button type="button" class="btn outline" [disabled]="trabajando()" (click)="guardarDespues()">Guardar y continuar después</button>
                <button type="button" class="btn primary" [disabled]="trabajando()" (click)="activar()"><lucide-icon name="power" [size]="13" /> {{ trabajando() ? 'Activando…' : 'Activar buzón' }}</button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class NuevoBuzonComponent implements OnInit {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Buzón «En configuración» que se retoma (al volver de Microsoft); null = nuevo. */
  readonly reanudar = input<string | null>(null);
  readonly cerrado = output<void>();

  protected readonly nombres = NOMBRES;
  protected readonly cargando = signal(false);
  protected readonly paso = signal(1);
  protected readonly buzon = signal<Buzon | null>(null);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly tipo = signal<TipoCuenta>('gen');
  /** Genéricas: con la cuenta del buzón (sin aprobación de TI) o con la del administrador. */
  protected readonly modo = signal<ModoConexion>('propia');
  protected readonly correo = signal('');
  protected readonly duplicado = signal<NombreBuzon['existente']>(null);
  protected readonly carpetas = signal<{ nombre: string; total: number; nivel: number }[]>([]);
  protected readonly carpeta = signal('Inbox');
  protected readonly conectando = signal(false);
  protected readonly errorConexion = signal('');
  protected readonly error = signal('');
  protected readonly trabajando = signal(false);
  protected readonly confirmarCierre = signal(false);
  protected readonly reglasListas = signal<{ puedeSeguir: boolean; porque: string }>({ puedeSeguir: false, porque: '' });
  protected readonly estadoAsig = signal<EstadoPasoAsignacion | null>(null);
  protected readonly estadoEsp = signal<EstadoPasoAsignacion | null>(null);
  protected readonly subvista = signal<SubvistaExportacion>(null);
  protected readonly probando = signal(false);
  protected readonly seco = signal<PruebaSeco | null>(null);
  /** Para el resumen del paso 6. */
  private readonly procesos = signal<Proceso[]>([]);
  private readonly grupos = signal<Grupo[]>([]);
  private readonly salidas = signal<Salida[]>([]);
  private readonly personas = signal(0);
  protected descripcion = '';
  protected agenteProyecto = '';
  protected agenteNombre = '';
  private consulta = 0;

  private readonly expWiz = viewChild(ExportacionWizardComponent);

  protected readonly nombre = computed(() => {
    const alias = (this.correo().split('@')[0] ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${this.tipo() === 'per' ? 'PER' : 'GEN'}-${alias || 'ALIAS'}`;
  });
  protected readonly valido = computed(() => RE_CORREO.test(this.correo().trim()));
  /** Dominios corporativos conectables (los del ambiente, por /opciones). */
  private readonly dominios = signal<string[]>(DOMINIOS_CORREO);
  private readonly dominio = computed(() => this.correo().trim().toLowerCase().split('@')[1] ?? '');
  protected readonly dominioOk = computed(() => this.dominios().includes(this.dominio()));
  protected readonly dominiosTxt = computed(() => this.dominios().map((d) => '@' + d).join(', '));
  /** «…@skandia.com» → «…@skandia.com.co»: el dominio permitido que empieza igual. */
  protected readonly sugerencia = computed(() => {
    const d = this.dominio();
    const ok = d && this.dominios().find((x) => x !== d && x.startsWith(d));
    return ok ? `${this.correo().trim().split('@')[0]}@${ok}` : null;
  });
  protected readonly conectado = computed(() => this.buzon()?.estado_conexion === 'conectada');
  protected readonly tieneAlma = computed(() => this.carpetas().some((c) => c.nombre === 'Alma'));

  /** Estado del paso 5 (lo calcula el componente de exportación). */
  private readonly estadoExp = computed(() => this.expWiz()?.estado() ?? null);

  protected readonly puedeSeguir = computed(() => {
    switch (this.paso()) {
      case 1: return this.conectado() && !!this.carpeta();
      case 2: return this.reglasListas().puedeSeguir;
      case 3: return !!this.estadoAsig()?.puedeSeguir;
      case 4: return !!this.estadoEsp()?.puedeSeguir;
      case 5: return !!this.estadoExp()?.puedeSeguir;
      default: return true;
    }
  });
  protected readonly porque = computed(() => {
    if (this.puedeSeguir()) return '';
    switch (this.paso()) {
      case 1: return this.conectado() ? 'Elige la carpeta' : 'Conecta el buzón para continuar';
      case 2: return this.reglasListas().porque;
      case 3: return this.estadoAsig()?.porque ?? '';
      case 4: return this.estadoEsp()?.porque ?? '';
      case 5: return this.estadoExp()?.porque ?? '';
      default: return '';
    }
  });

  protected readonly resumen = computed<FilaResumen[]>(() => {
    const b = this.buzon();
    if (!b) return [];
    const procesos = this.procesos();
    const grupos = this.grupos();
    const conDatos = procesos.filter((p) => p.campos_extraer.length).length;
    const destinos = grupos
      .filter((g) => g.destino !== 'personas')
      .map((g) => (g.destino === 'carpeta' ? `${g.nombre} → carpeta «${g.carpeta}»` : `${g.nombre} solo categorizar`));
    const reglasBases = grupos.reduce((n, g) => n + g.reglas.length, 0);
    const porProceso = procesos.map((p) => {
      const s = this.salidas().filter((x) => x.proceso_id === p.id && x.activa);
      return `${p.clave}: ${s.length ? s.map((x) => (x.modo === 'ninguno' ? 'sin archivo' : x.modo === 'tabla' ? 'tabla .' + b.tabla_formato : `plantilla «${x.nombre}»`)).join(' + ') : 'sin archivo'}`;
    });
    return [
      { icono: 'plug-zap', titulo: 'Conexión', texto: `${b.nombre} · ${b.direccion} · carpeta «${this.nombreCarpeta(b.carpeta_vigilada)}»`, omitido: false },
      { icono: 'scroll-text', titulo: 'Reglas', texto: `${b.modo_clasificacion === 'agente' ? 'Agente de Foundry' : 'Prompt de Alma'} · ${procesos.length} procesos · ${conDatos} con extracción`, omitido: false },
      { icono: 'users', titulo: 'Asignación', texto: b.mod_asignacion ? [`${grupos.length} grupos · ${this.personas()} personas`, ...destinos].join(' · ') : 'Omitida: solo categorización', omitido: !b.mod_asignacion },
      { icono: 'database', titulo: 'Formato específico', texto: b.mod_bases ? `${reglasBases} búsqueda(s) en bases` : 'Omitido', omitido: !b.mod_bases },
      { icono: 'file-spreadsheet', titulo: 'Exportación', texto: b.mod_exportacion ? porProceso.join(' · ') : 'Omitida', omitido: !b.mod_exportacion },
    ];
  });

  ngOnInit(): void {
    void this.api.opciones().then((o) => { if (o.dominios_correo?.length) this.dominios.set(o.dominios_correo); }).catch(() => undefined);
    const id = this.reanudar();
    if (id) void this.retomar(id);
  }

  private async retomar(id: string): Promise<void> {
    this.cargando.set(true);
    try {
      const b = await this.api.obtenerBuzon(id);
      this.buzon.set(b);
      this.tipo.set(b.tipo_cuenta);
      this.correo.set(b.direccion);
      this.descripcion = b.descripcion ?? '';
      this.carpeta.set(b.carpeta_vigilada || 'Inbox');
      this.agenteProyecto = b.agente_proyecto ?? '';
      this.agenteNombre = b.agente_nombre ?? '';
      if (b.estado_conexion === 'conectada') await this.leerCarpetas();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected nombreCarpeta(n: string): string {
    return !n || n.toLowerCase() === 'inbox' ? 'Bandeja de entrada' : n;
  }

  /** done / skip / on por paso, como el prototipo (nbEstado). */
  protected estadoPaso(i: number): string {
    const p = this.paso();
    const b = this.buzon();
    if (i === p) return 'on';
    if (i <= 2 || !b || p < i) return p > i ? 'done' : '';
    const activo = i === 3 ? b.mod_asignacion : i === 4 ? b.mod_asignacion && b.mod_bases : b.mod_exportacion;
    return activo ? 'done' : 'skip';
  }

  // ── Paso 1 ──
  protected cambiarTipo(t: TipoCuenta): void {
    this.tipo.set(t);
    void this.revisarNombre();
  }

  protected cambiarCorreo(v: string): void {
    this.correo.set(v);
    void this.revisarNombre();
  }

  /** El borrador aún no conectado se descarta para corregir la dirección: el
   *  buzón nace con ella y no se puede cambiar después. */
  protected async cambiarDireccion(): Promise<void> {
    const b = this.buzon();
    if (!b || this.conectado()) return;
    this.trabajando.set(true);
    try {
      await this.api.eliminarBuzon(b.id);
      this.buzon.set(null);
      this.errorConexion.set('');
      void this.router.navigate([], { queryParams: { asistente: null }, queryParamsHandling: 'merge', replaceUrl: true });
      void this.revisarNombre();
      queueMicrotask(() => document.getElementById('nb-correo')?.focus());
    } catch (e) {
      this.toast.error('No se pudo descartar el borrador', e instanceof Error ? e.message : String(e));
    } finally {
      this.trabajando.set(false);
    }
  }

  private async revisarNombre(): Promise<void> {
    this.duplicado.set(null);
    if (!this.valido()) return;
    const n = ++this.consulta;
    try {
      const r = await this.api.nombreBuzon(this.correo().trim().toLowerCase(), this.tipo());
      if (n === this.consulta) this.duplicado.set(r.existente);
    } catch {
      /* Si falla la consulta, el backend vuelve a validar al crear. */
    }
  }

  protected async conectar(): Promise<void> {
    this.conectando.set(true);
    this.errorConexion.set('');
    try {
      let b = this.buzon();
      if (!b) {
        b = await this.api.crearBuzon({
          direccion: this.correo().trim().toLowerCase(), nombre: this.nombre(), tipo_cuenta: this.tipo(), en_configuracion: true,
        });
        this.buzon.set(b);
      }
      const c = await this.api.conexion(b.id);
      if (!c.configurado) {
        this.errorConexion.set('El ambiente no tiene credenciales de Microsoft Graph.');
        return;
      }
      if (this.api.modoDemo()) {
        this.buzon.set(this.api.simularConexionDemo(b.id, this.modo()));
        await this.leerCarpetas();
        this.toast.show('Modo demostración', 'Aquí se abre el inicio de sesión de Microsoft; el buzón quedó conectado.');
        return;
      }
      window.location.assign(this.api.urlConectar(b, c, `/apps/buzon-inteligente/buzones?asistente=${b.id}`, this.modo()));
    } catch (e) {
      this.errorConexion.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.conectando.set(false);
    }
  }

  private async leerCarpetas(): Promise<void> {
    try {
      this.carpetas.set(aplanar(await this.api.carpetas(this.buzon()!.id)));
    } catch (e) {
      this.errorConexion.set('No se pudieron leer las carpetas: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  protected async crearSubcarpeta(): Promise<void> {
    try {
      this.carpetas.set(aplanar(await this.api.crearCarpeta(this.buzon()!.id, 'Alma')));
      this.carpeta.set('Alma');
      this.toast.show('Subcarpeta «Alma» creada', 'Mueve allí (o con una regla de Outlook) los correos que Alma debe leer.');
    } catch (e) {
      this.toast.error('No se pudo crear la subcarpeta', e instanceof Error ? e.message : String(e));
    }
  }

  // ── Paso 2 ──
  protected async clasificador(modo: 'prompt' | 'agente'): Promise<void> {
    this.buzon.set(await this.api.actualizarBuzon(this.buzon()!.id, { modo_clasificacion: modo }));
  }

  protected async guardarAgente(): Promise<void> {
    this.buzon.set(await this.api.actualizarBuzon(this.buzon()!.id, {
      agente_proyecto: this.agenteProyecto.trim() || null, agente_nombre: this.agenteNombre.trim() || null,
    }));
  }

  // ── Navegación ──
  protected async continuar(): Promise<void> {
    const b = this.buzon()!;
    this.error.set('');
    this.trabajando.set(true);
    try {
      const p = this.paso();
      if (p === 1) {
        this.buzon.set(await this.api.actualizarBuzon(b.id, { carpeta_vigilada: this.carpeta(), descripcion: this.descripcion.trim() || null }));
      }
      // Las etiquetas del borrador alimentan los grupos y las salidas de los pasos siguientes.
      if (p === 2 || p === 3) this.categorias.set(await this.api.listarCategorias(b.id));
      // Los «Sí / No» de cada paso son los módulos del buzón.
      if (p === 3) this.buzon.set(await this.api.actualizarBuzon(b.id, { mod_asignacion: !this.estadoAsig()?.omitido, ...(this.estadoAsig()?.omitido ? { mod_bases: false } : {}) }));
      if (p === 4) this.buzon.set(await this.api.actualizarBuzon(b.id, { mod_bases: !this.estadoEsp()?.omitido }));
      if (p === 5) this.buzon.set(await this.api.actualizarBuzon(b.id, { mod_exportacion: !this.estadoExp()?.omitido }));
      // Sin asignación no hay formato específico: se salta el paso 4.
      const sig = p === 3 && !this.buzon()!.mod_asignacion ? 5 : p + 1;
      if (sig === 6) await this.cargarResumen();
      this.paso.set(sig);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.trabajando.set(false);
    }
  }

  protected atras(): void {
    const p = this.paso();
    this.error.set('');
    this.paso.set(p === 5 && !this.buzon()?.mod_asignacion ? 3 : p - 1);
  }

  private async cargarResumen(): Promise<void> {
    const id = this.buzon()!.id;
    const [procesos, grupos, equipo, exp] = await Promise.all([
      this.api.listarProcesos(id),
      this.api.listarGrupos(id),
      this.api.listarEquipo(id),
      this.api.exportacion(id),
    ]);
    this.procesos.set(procesos.filter((p) => p.activo));
    this.grupos.set(grupos);
    this.personas.set(equipo.length);
    this.salidas.set(exp.procesos.flatMap((p) => p.salidas));
    this.buzon.set(await this.api.obtenerBuzon(id));
  }

  protected async pruebaSeco(): Promise<void> {
    this.probando.set(true);
    try {
      this.seco.set(await this.api.pruebaSeco(this.buzon()!.id));
    } catch (e) {
      this.toast.error('No se pudo hacer la prueba en seco', e instanceof Error ? e.message : String(e));
    } finally {
      this.probando.set(false);
    }
  }

  /** Publica las reglas v1: el buzón sale de «En configuración» y el worker empieza a leerlo. */
  protected async activar(): Promise<void> {
    const b = this.buzon()!;
    this.trabajando.set(true);
    this.error.set('');
    try {
      await this.api.publicarReglas(b.id);
      this.toast.show(`${b.nombre} activado`, 'Reglas v1 publicadas: Alma empieza a leer el buzón.');
      this.cerrado.emit();
      void this.router.navigate(['/apps/buzon-inteligente/buzones', b.id]);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.trabajando.set(false);
    }
  }

  protected guardarDespues(): void {
    const b = this.buzon();
    if (b) this.toast.show(`${b.nombre} guardado en configuración`, 'Continúa desde su tarjeta en Buzones.');
    this.cerrado.emit();
  }

  protected pedirCierre(): void {
    if (!this.buzon() && !this.correo().trim()) {
      this.cerrado.emit();
      return;
    }
    this.confirmarCierre.set(true);
  }
}
