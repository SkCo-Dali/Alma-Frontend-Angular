// Pestaña «Ajustes» del buzón — réplica de `ajustesTab` del prototipo validado
// (contexto-recaudos-pac/buzon-inteligente-v2.html): Parámetros (nombre fijo
// {TIPO}-{ALIAS}, descripción, carpeta vigilada), Módulos (asignación, búsqueda en
// bases, exportación), Clasificador (agente de Foundry o prompt de Alma) e Hilos y
// duplicados. Además, lo que Alma ya tenía y el prototipo no muestra: la conexión con
// Microsoft. Las etiquetas (umbral, acciones en Outlook) se editan en Reglas, junto a su proceso.
// Cada cambio se guarda al momento (PUT parcial del buzón).

import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaSwitchComponent } from '../../shared/components/alma-switch.component';
import { AvisoCuentaBuzonComponent } from './aviso-cuenta-buzon.component';
import { Buzon, BuzonApi, BuzonUpdate, CarpetaGraph, ModoConexion, SombraDosPasos } from './buzon.api';

type Modulo = 'mod_asignacion' | 'mod_bases' | 'mod_exportacion';

/** Carpeta del árbol con su profundidad, para el selector. */
interface CarpetaPlana {
  nombre: string;
  total: number;
  nivel: number;
}

@Component({
  selector: 'alma-ajustes-tab',
  imports: [FormsModule, LucideAngularModule, AlmaSwitchComponent, AvisoCuentaBuzonComponent],
  styleUrls: ['./buzon-proto.css'],
  template: `
    @let b = buzon();
    <div class="g2" style="align-items:start">
      <div class="stack">
        <div class="glass r-2xl stack" style="padding:20px">
          <h2 class="sm b">Parámetros</h2>
          <div class="fld"><span class="label">Nombre (estructura fija {{ '{' }}TIPO{{ '}' }}-{{ '{' }}ALIAS{{ '}' }}, no editable)</span><p class="mono sm b">{{ b.nombre }}</p></div>
          <div class="fld">
            <label class="label" for="aj-d">Descripción</label>
            <input class="input" id="aj-d" [(ngModel)]="descripcion" (change)="guardar({ descripcion: descripcion.trim() || null })" />
          </div>
          <div class="fld">
            <label class="label" for="aj-c">Carpeta vigilada</label>
            <select class="input" id="aj-c" [ngModel]="b.carpeta_vigilada" (ngModelChange)="guardar({ carpeta_vigilada: $event })" [disabled]="!carpetas().length">
              @if (!carpetas().length) { <option [value]="b.carpeta_vigilada">{{ nombreCarpeta(b.carpeta_vigilada) }}</option> }
              @for (f of carpetas(); track f.nombre) {
                <option [value]="f.nombre">{{ f.nivel ? '— ' : '' }}{{ f.nombre }} ({{ f.total.toLocaleString('es-CO') }})</option>
              }
            </select>
            <span class="xxs muted">{{ carpetas().length ? 'Carpetas leídas de ' + b.direccion + ' con la conexión vigente.' : 'Conecta el buzón para leer sus carpetas.' }}</span>
          </div>
          <div class="row between sunk r-xl" style="padding:10px 12px;flex-wrap:nowrap">
            <div style="min-width:0">
              <p class="sm b">Conexión con Microsoft</p>
              <p class="xxs muted">{{ textoConexion() }}</p>
            </div>
            @if (b.puede_reconectar) {
              <div style="display:grid;gap:4px;justify-items:end;flex-shrink:0">
                <button type="button" class="btn outline sm" (click)="reconectar.emit(undefined)"><lucide-icon name="log-in" [size]="13" /> {{ b.estado_conexion === 'conectada' ? 'Reconectar' : 'Conectar' }}</button>
                @if (b.conexion_compartida) {
                  <button type="button" class="linkbtn xxs" (click)="reconectar.emit('propia')">Usar la cuenta del buzón</button>
                }
              </div>
            }
          </div>
          @if (b.tipo_cuenta === 'gen' && !b.conexion_compartida) {
            <alma-aviso-cuenta-buzon />
          }
          <p class="note b-sky"><lucide-icon name="zap" [size]="13" /> <span>Nova ejecuta automáticamente todo lo que alcanza el umbral de confianza. Solo va a <b>Validar</b> lo que queda por debajo, lo que la IA marca para revisión humana y los posibles duplicados.</span></p>
          <div class="sunk r-xl stack" style="padding:10px 12px;gap:6px">
            <div class="row between" style="flex-wrap:nowrap">
              <div style="min-width:0">
                <p class="sm b">Marcar en Outlook lo que queda en Validar</p>
                <p class="xxs muted">Le pone esta categoría al correo para que quien trabaja desde Outlook sepa que debe revisarlo en Nova. Se quita al aprobarlo, ignorarlo o cuando Nova lo resuelve.</p>
              </div>
              <alma-switch [checked]="!!b.etiqueta_validar" (checkedChange)="alternarEtiquetaValidar($event)" ariaLabel="Marcar en Outlook lo que queda en Validar" />
            </div>
            @if (b.etiqueta_validar) {
              <input class="input sm" [(ngModel)]="etiquetaValidar" (change)="guardarEtiquetaValidar()" maxlength="80" aria-label="Nombre de la categoría de Outlook" />
            }
          </div>
        </div>

        <div class="glass r-2xl stack" style="padding:20px">
          <h2 class="sm b">Módulos</h2>
          @for (m of modulos(); track m.id) {
            <div class="row between sunk r-xl" style="padding:10px 12px;flex-wrap:nowrap">
              <div style="min-width:0">
                <p class="sm b">{{ m.titulo }}</p>
                <p class="xxs muted">{{ m.desc }} @if (m.requiere) { · <span style="color:var(--amber)">{{ m.requiere }}</span> }</p>
              </div>
              <button type="button" class="sw" role="switch" [attr.aria-checked]="b[m.id]" [attr.aria-label]="m.titulo" [disabled]="!!m.requiere" (click)="alternarModulo(m.id)"></button>
            </div>
          }
          <p class="xxs muted">Desactivar un módulo conserva su configuración; se puede reactivar sin volver a configurarlo.</p>
        </div>
      </div>

      <div class="stack">
        <div class="glass r-2xl stack" style="padding:20px">
          <h2 class="sm b">Clasificador</h2>
          <div class="g2">
            <button type="button" class="optcard" [attr.aria-pressed]="b.modo_clasificacion === 'agente'" (click)="guardar({ modo_clasificacion: 'agente' })">
              <span class="row sm b"><lucide-icon name="bot" [size]="13" /> Agente de Foundry</span>
              <span class="xs muted">El área administra su agente; Nova lo invoca y valida cada respuesta.</span>
            </button>
            <button type="button" class="optcard" [attr.aria-pressed]="b.modo_clasificacion === 'prompt'" (click)="guardar({ modo_clasificacion: 'prompt' })">
              <span class="row sm b"><lucide-icon name="scroll-text" [size]="13" /> Prompt generado por Nova</span>
              <span class="xs muted">Las reglas viven en Nova; salida estructurada estricta.</span>
            </button>
          </div>
          @if (b.modo_clasificacion === 'agente') {
            <div class="g2">
              <div class="fld"><label class="label" for="ag-proy">Proyecto</label><input class="input" id="ag-proy" [(ngModel)]="agenteProyecto" (change)="guardar({ agente_proyecto: agenteProyecto.trim() || null })" /></div>
              <div class="fld"><label class="label" for="ag-nom">Agente</label><input class="input" id="ag-nom" [(ngModel)]="agenteNombre" (change)="guardar({ agente_nombre: agenteNombre.trim() || null })" placeholder="Nombre del agente en Foundry" /></div>
            </div>
            <div class="fld">
              <span class="label">Versión</span>
              <label class="row sm" for="vr-u"><input type="radio" name="vr" id="vr-u" [checked]="!b.agente_version_fija" (change)="guardar({ agente_version_fija: null })" /> Usar siempre la última publicada</label>
              <label class="row sm" for="vr-f"><input type="radio" name="vr" id="vr-f" [checked]="!!b.agente_version_fija" (change)="fijarVersion()" /> Fijar en
                <input class="input sm" style="width:90px" [(ngModel)]="versionFija" (change)="fijarVersion()" placeholder="v1" aria-label="Versión fija" />: una versión nueva se adopta solo después de probarla</label>
            </div>
            <div class="fld">
              <span class="label">¿Dónde se editan las reglas?</span>
              <label class="row sm" for="ra-f"><input type="radio" name="ra" id="ra-f" [checked]="b.reglas_admin === 'foundry'" (change)="guardar({ reglas_admin: 'foundry' })" /> En Foundry (en Nova son de solo lectura)</label>
              <label class="row sm" for="ra-a"><input type="radio" name="ra" id="ra-a" [checked]="b.reglas_admin === 'alma'" (change)="guardar({ reglas_admin: 'alma' })" /> En Nova, que publica nuevas versiones al agente</label>
            </div>
            <p class="note b-amber"><lucide-icon name="shield-alert" [size]="13" /> <span>Leer la versión publicada del agente y publicarle reglas desde Nova requiere que TI habilite el acceso de Nova al proyecto de Foundry. Mientras tanto Nova invoca el agente por su nombre.</span></p>
          } @else {
            <div class="g2">
              <div class="fld">
                <label class="label" for="pm-mod">Modelo</label>
                <select class="input" id="pm-mod" [ngModel]="b.modelo ?? ''" (ngModelChange)="guardar({ modelo: $event || null })">
                  <option value="">El de la plataforma{{ modelos()[0] ? ' (' + modelos()[0] + ')' : '' }}</option>
                  @for (m of modelos(); track m) { <option [value]="m">{{ m }}</option> }
                </select>
              </div>
              <div class="fld"><span class="label">Salida</span><p class="sm">Estructurada estricta (esquema JSON por proceso)</p></div>
            </div>
            <!-- 075: clasificación en dos pasos, con prueba en sombra antes de activarla. -->
            <div class="sunk r-xl stack" style="padding:10px 12px;gap:8px">
              <div class="row between" style="flex-wrap:nowrap">
                <div style="min-width:0">
                  <p class="sm b">Clasificar en dos pasos</p>
                  <p class="xxs muted">Un modelo rápido (gpt-4.1-mini) decide el proceso con las descripciones cortas; luego el modelo del buzón aplica solo las reglas de ese proceso. Lo que no es de ningún proceso no llega al segundo paso. Si el primer paso duda, se clasifica como hoy.</p>
                </div>
                <alma-switch [checked]="!!b.dos_pasos" (checkedChange)="guardar({ dos_pasos: $event })" ariaLabel="Clasificar en dos pasos" />
              </div>
              <div class="row">
                <button type="button" class="btn outline sm" [disabled]="probandoSombra()" (click)="probarSombra()"><lucide-icon name="flask-conical" [size]="13" /> {{ probandoSombra() ? 'Probando… (1 a 3 min)' : 'Probar en sombra' }}</button>
                <span class="xxs muted">Clasifica en dos pasos los últimos 20 correos ya decididos y lo compara. No ejecuta nada.</span>
              </div>
              @if (sombra(); as S) {
                @if (!S.total) {
                  <p class="note b-sky"><lucide-icon name="info" [size]="13" /> <span>Aún no hay correos decididos con qué comparar en este buzón.</span></p>
                } @else {
                  <div class="g3">
                    <div class="stat"><p class="l">Coincide con las analistas</p><p class="v">{{ pctSombra(S.por_referencia.humano) }}</p><p class="xxs muted">{{ S.por_referencia.humano.etiqueta_ok }}/{{ S.por_referencia.humano.total }} etiquetas</p></div>
                    <div class="stat"><p class="l">Coincide con el método actual</p><p class="v">{{ pctSombra(S.por_referencia.actual) }}</p><p class="xxs muted">{{ S.por_referencia.actual.etiqueta_ok }}/{{ S.por_referencia.actual.total }} etiquetas</p></div>
                    <div class="stat"><p class="l">Tokens por correo</p><p class="v">{{ S.tokens_prom_dos_pasos != null ? S.tokens_prom_dos_pasos.toLocaleString('es-CO') : '—' }}</p><p class="xxs muted">hoy {{ S.tokens_prom_actual != null ? S.tokens_prom_actual.toLocaleString('es-CO') : '—' }}</p></div>
                  </div>
                  <p class="xxs muted">Camino: {{ S.rutas.ninguno }} sin proceso (solo paso 1) · {{ S.rutas.proceso }} a un proceso · {{ S.rutas.completo }} con el prompt completo{{ S.rutas.regla ? ' · ' + S.rutas.regla + ' por regla fija' : '' }}{{ S.no_disponibles ? ' · ' + S.no_disponibles + ' ya no están en el buzón' : '' }}{{ S.errores ? ' · ' + S.errores + ' con error' : '' }}{{ S.omitidos ? ' · ' + S.omitidos + ' sin tiempo' : '' }}</p>
                  @for (f of S.fallos; track f.correo_id) {
                    <p class="xxs">✗ {{ f.asunto }} · esperaba <span class="key">{{ f.esperado }}</span> y salió <span class="key">{{ f.obtenido || '—' }}</span> ({{ f.referencia === 'humano' ? 'decisión de analista' : 'método actual' }})</p>
                  }
                  <p class="note" [class]="aptoSombra(S) ? 'note b-emerald' : 'note b-amber'"><lucide-icon [name]="aptoSombra(S) ? 'check' : 'alert-triangle'" [size]="13" /> <span>{{ aptoSombra(S) ? 'Coincide en 95 % o más: se puede activar en este buzón.' : 'Coincide en menos de 95 %: revisa los casos que no coinciden antes de activarlo.' }}</span></p>
                }
              }
            </div>
          }
        </div>

        <div class="glass r-2xl stack" style="padding:20px">
          <h2 class="sm b">Hilos y duplicados</h2>
          <div class="g2">
            <div class="fld"><label class="label" for="aj-v">Ventana para reconocer hilos por asunto (días)</label>
              <input class="input" id="aj-v" type="number" min="1" max="90" [(ngModel)]="ventana" (change)="guardarVentana()" /></div>
            <div class="fld"><label class="label" for="aj-r">Respuesta sin información nueva</label>
              <select class="input" id="aj-r" [ngModel]="b.respuesta_sin_novedad" (ngModelChange)="guardar({ respuesta_sin_novedad: $event })">
                <option value="vincular">Vincular sin reasignar</option><option value="validar">Llevar a Validar</option>
              </select></div>
          </div>
          <p class="note b-sky"><lucide-icon name="info" [size]="13" /> <span>Un correo ya registrado nunca se vuelve a procesar: se identifica por <span class="mono">internet_message_id</span>.</span></p>
        </div>

        <p class="note b-sky"><lucide-icon name="tags" [size]="13" /> <span>El umbral, las acciones en Outlook y el resto de cada etiqueta se editan en <b>Reglas</b>, dentro de su proceso (lápiz junto a la etiqueta).</span></p>
      </div>
    </div>

  `,
})
export class AjustesTabComponent implements OnInit {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  readonly buzonActualizado = output<Buzon>();
  /** Volver a conectar con Microsoft (lo resuelve la página: arma la URL de inicio de sesión). */
  /** Sin modo: reconectar como ya está; con modo (genéricas): cambiar de forma de conexión. */
  readonly reconectar = output<ModoConexion | undefined>();

  protected readonly carpetas = signal<CarpetaPlana[]>([]);
  protected readonly modelos = signal<string[]>([]);
  /** 075: prueba en sombra de los dos pasos. */
  protected readonly sombra = signal<SombraDosPasos | null>(null);
  protected readonly probandoSombra = signal(false);
  protected descripcion = '';
  protected agenteProyecto = '';
  protected agenteNombre = '';
  protected versionFija = '';
  protected ventana = 15;
  protected etiquetaValidar = 'Nova · Validar';

  protected readonly modulos = computed(() => {
    const b = this.buzon();
    const publicado = !!b.version_reglas;
    return [
      { id: 'mod_asignacion' as Modulo, titulo: 'Asignación', desc: 'Grupos, equipo, bases y reglas por grupo', requiere: publicado || b.mod_asignacion ? '' : 'Publica las reglas primero' },
      { id: 'mod_bases' as Modulo, titulo: 'Búsqueda en bases (formato específico)', desc: 'Responsable fijo según una base de Excel', requiere: b.mod_asignacion ? '' : 'Activa primero la asignación' },
      { id: 'mod_exportacion' as Modulo, titulo: 'Exportación', desc: 'Archivo por proceso: tabla según el JSON o plantilla propia', requiere: publicado || b.mod_exportacion ? '' : 'Publica las reglas primero' },
    ];
  });

  protected readonly textoConexion = computed(() => {
    const b = this.buzon();
    if (b.estado_conexion === 'conectada') return `Conectado${b.conectada_por ? ' por ' + b.conectada_por : ''}${b.conexion_compartida ? ' · acceso delegado' : b.tipo_cuenta === 'gen' ? ' · con la cuenta del buzón' : ''}`;
    return b.estado_conexion === 'requiere_reconexion' ? 'La conexión venció: hay que volver a conectarlo.' : 'Sin conectar: Nova no lo lee.';
  });

  ngOnInit(): void {
    const b = this.buzon();
    this.descripcion = b.descripcion ?? '';
    this.agenteProyecto = b.agente_proyecto ?? '';
    this.agenteNombre = b.agente_nombre ?? '';
    this.versionFija = b.agente_version_fija ?? '';
    this.ventana = b.ventana_hilos_dias;
    this.etiquetaValidar = b.etiqueta_validar || 'Nova · Validar';
    void this.api.opciones().then((o) => this.modelos.set(o.modelos)).catch(() => undefined);
    if (b.estado_conexion === 'conectada') {
      void this.api.carpetas(b.id).then((t) => this.carpetas.set(aplanar(t))).catch(() => undefined);
    }
  }

  protected nombreCarpeta(n: string): string {
    return n.toLowerCase() === 'inbox' ? 'Bandeja de entrada' : n;
  }

  protected async probarSombra(): Promise<void> {
    this.probandoSombra.set(true);
    try {
      this.sombra.set(await this.api.sombraDosPasos(this.buzon().id, 20));
    } catch (e) {
      this.toast.error('No se pudo hacer la prueba en sombra', e instanceof Error ? e.message : String(e));
    } finally {
      this.probandoSombra.set(false);
    }
  }

  protected pctSombra(g: { total: number; etiqueta_ok: number }): string {
    return g.total ? Math.round((g.etiqueta_ok / g.total) * 100) + ' %' : '—';
  }

  /** Apta si, sumando ambas referencias, las etiquetas coinciden en 95 % o más. */
  protected aptoSombra(S: SombraDosPasos): boolean {
    const t = S.por_referencia.humano.total + S.por_referencia.actual.total;
    const ok = S.por_referencia.humano.etiqueta_ok + S.por_referencia.actual.etiqueta_ok;
    return t > 0 && ok / t >= 0.95;
  }

  protected alternarEtiquetaValidar(on: boolean): void {
    void this.guardar({ etiqueta_validar: on ? this.etiquetaValidar.trim() || 'Nova · Validar' : '' });
  }

  protected guardarEtiquetaValidar(): void {
    const v = this.etiquetaValidar.trim();
    if (!v) {
      this.etiquetaValidar = this.buzon().etiqueta_validar || 'Nova · Validar';
      return;
    }
    void this.guardar({ etiqueta_validar: v });
  }

  protected async guardar(cambio: BuzonUpdate): Promise<void> {
    try {
      const b = await this.api.actualizarBuzon(this.buzon().id, cambio);
      this.buzonActualizado.emit(b);
    } catch (e) {
      this.toast.error('No se pudo guardar', e instanceof Error ? e.message : String(e));
    }
  }

  protected async alternarModulo(m: Modulo): Promise<void> {
    const b = this.buzon();
    const activo = !b[m];
    await this.guardar(m === 'mod_asignacion' && !activo ? { mod_asignacion: false, mod_bases: false } : { [m]: activo });
    const nombre = { mod_asignacion: 'asignación', mod_bases: 'búsqueda en bases', mod_exportacion: 'exportación' }[m];
    this.toast.show(activo ? `Activado: ${nombre}` : `Desactivado (se conserva la configuración): ${nombre}`);
  }

  protected fijarVersion(): void {
    const v = this.versionFija.trim();
    if (v) void this.guardar({ agente_version_fija: v });
  }

  protected guardarVentana(): void {
    const v = Math.min(90, Math.max(1, Math.round(Number(this.ventana) || 15)));
    this.ventana = v;
    void this.guardar({ ventana_hilos_dias: v });
  }

}

/** Árbol de carpetas → lista con profundidad (raíz y un nivel, como lo lee Graph). */
export function aplanar(t: CarpetaGraph[], nivel = 0): CarpetaPlana[] {
  return t.flatMap((c) => [{ nombre: c.nombre, total: c.total, nivel }, ...aplanar(c.hijas ?? [], nivel + 1)]);
}
