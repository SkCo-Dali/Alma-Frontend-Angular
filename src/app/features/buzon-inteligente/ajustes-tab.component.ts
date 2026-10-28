// Pestaña «Ajustes» del buzón — réplica de `ajustesTab` del prototipo validado
// (contexto-recaudos-pac/buzon-inteligente-v2.html): Parámetros (nombre fijo
// {TIPO}-{ALIAS}, descripción, carpeta vigilada), Módulos (asignación, búsqueda en
// bases, exportación), Clasificador (agente de Foundry o prompt de Alma) e Hilos y
// duplicados. Además, lo que Alma ya tenía y el prototipo no muestra: la conexión con
// Microsoft, la ejecución automática y las acciones en Outlook de cada etiqueta.
// Cada cambio se guarda al momento (PUT parcial del buzón).

import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { Buzon, BuzonApi, BuzonUpdate, CarpetaGraph, Categoria, CategoriaIn, resumenAccion } from './buzon.api';
import { BUZON_PROTO_CSS } from './buzon-proto.styles';
import { CategoriaEditorComponent } from './categoria-editor.component';

type Modulo = 'mod_asignacion' | 'mod_bases' | 'mod_exportacion';

/** Carpeta del árbol con su profundidad, para el selector. */
interface CarpetaPlana {
  nombre: string;
  total: number;
  nivel: number;
}

@Component({
  selector: 'alma-ajustes-tab',
  imports: [FormsModule, LucideAngularModule, CategoriaEditorComponent],
  styles: [BUZON_PROTO_CSS],
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
            @if (b.puede_conectar) {
              <button type="button" class="btn outline sm" (click)="reconectar.emit()"><lucide-icon name="log-in" [size]="13" /> {{ b.estado_conexion === 'conectada' ? 'Reconectar' : 'Conectar' }}</button>
            }
          </div>
          <div class="row between sunk r-xl" style="padding:10px 12px;flex-wrap:nowrap">
            <div style="min-width:0">
              <p class="sm b">Ejecución automática</p>
              <p class="xxs muted">Encendida: Alma ejecuta lo que no cae en Validar. Apagada: todo queda para aprobar en la bandeja.</p>
            </div>
            <button type="button" class="sw" role="switch" [attr.aria-checked]="b.modo === 'automatico'" aria-label="Ejecución automática" (click)="guardar({ modo: b.modo === 'automatico' ? 'sugerir' : 'automatico' })"></button>
          </div>
          <p class="note b-sky"><lucide-icon name="zap" [size]="13" /> <span>Alma ejecuta automáticamente todo lo que no cae en <b>Validar</b>. Validar es el único punto de ajuste manual.</span></p>
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
              <span class="xs muted">El área administra su agente; Alma lo invoca y valida cada respuesta.</span>
            </button>
            <button type="button" class="optcard" [attr.aria-pressed]="b.modo_clasificacion === 'prompt'" (click)="guardar({ modo_clasificacion: 'prompt' })">
              <span class="row sm b"><lucide-icon name="scroll-text" [size]="13" /> Prompt generado por Alma</span>
              <span class="xs muted">Las reglas viven en Alma; salida estructurada estricta.</span>
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
              <label class="row sm" for="ra-f"><input type="radio" name="ra" id="ra-f" [checked]="b.reglas_admin === 'foundry'" (change)="guardar({ reglas_admin: 'foundry' })" /> En Foundry (en Alma son de solo lectura)</label>
              <label class="row sm" for="ra-a"><input type="radio" name="ra" id="ra-a" [checked]="b.reglas_admin === 'alma'" (change)="guardar({ reglas_admin: 'alma' })" /> En Alma, que publica nuevas versiones al agente</label>
            </div>
            <p class="note b-amber"><lucide-icon name="shield-alert" [size]="13" /> <span>Leer la versión publicada del agente y publicarle reglas desde Alma requiere que TI habilite el acceso de Alma al proyecto de Foundry. Mientras tanto Alma invoca el agente por su nombre.</span></p>
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

        <div class="glass r-2xl stack" style="padding:20px">
          <h2 class="sm b">Acciones en Outlook por etiqueta</h2>
          <p class="xxs muted">Qué hace Alma en el buzón al ejecutar cada etiqueta (por defecto, la etiqueta como categoría de Outlook; el destino lo pone la asignación).</p>
          @for (c of etiquetas(); track c.id) {
            <div class="row between sunk r-xl" style="padding:8px 12px;flex-wrap:nowrap">
              <div style="min-width:0"><p class="xs b"><span class="key">{{ c.clave }}</span> {{ c.nombre }}</p><p class="xxs muted trunc">{{ acciones(c) }}</p></div>
              <button type="button" class="btn ghost" (click)="editando.set(c)" [attr.aria-label]="'Editar acciones de ' + c.clave"><lucide-icon name="pencil" [size]="16" /></button>
            </div>
          } @empty {
            <p class="xs muted">Aún no hay etiquetas.</p>
          }
        </div>
      </div>
    </div>

    @if (editando(); as c) {
      <alma-categoria-editor [categoria]="c" [guardando]="guardandoCategoria()" (guardar)="guardarCategoria(c, $event)" (cancelar)="editando.set(null)" />
    }
  `,
})
export class AjustesTabComponent implements OnInit {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  readonly buzonActualizado = output<Buzon>();
  /** Volver a conectar con Microsoft (lo resuelve la página: arma la URL de inicio de sesión). */
  readonly reconectar = output<void>();

  protected readonly carpetas = signal<CarpetaPlana[]>([]);
  protected readonly modelos = signal<string[]>([]);
  protected readonly etiquetas = signal<Categoria[]>([]);
  protected readonly editando = signal<Categoria | null>(null);
  protected readonly guardandoCategoria = signal(false);
  protected descripcion = '';
  protected agenteProyecto = '';
  protected agenteNombre = '';
  protected versionFija = '';
  protected ventana = 15;

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
    if (b.estado_conexion === 'conectada') return `Conectado${b.conectada_por ? ' por ' + b.conectada_por : ''}${b.conexion_compartida ? ' · acceso delegado' : ''}`;
    return b.estado_conexion === 'requiere_reconexion' ? 'La conexión venció: hay que volver a conectarlo.' : 'Sin conectar: Alma no lo lee.';
  });

  ngOnInit(): void {
    const b = this.buzon();
    this.descripcion = b.descripcion ?? '';
    this.agenteProyecto = b.agente_proyecto ?? '';
    this.agenteNombre = b.agente_nombre ?? '';
    this.versionFija = b.agente_version_fija ?? '';
    this.ventana = b.ventana_hilos_dias;
    void this.api.opciones().then((o) => this.modelos.set(o.modelos)).catch(() => undefined);
    void this.api.listarCategorias(b.id).then((c) => this.etiquetas.set(c.filter((x) => x.activa)));
    if (b.estado_conexion === 'conectada') {
      void this.api.carpetas(b.id).then((t) => this.carpetas.set(aplanar(t))).catch(() => undefined);
    }
  }

  protected nombreCarpeta(n: string): string {
    return n.toLowerCase() === 'inbox' ? 'Bandeja de entrada' : n;
  }

  protected acciones(c: Categoria): string {
    return c.acciones.filter((a) => a.activa).map((a) => resumenAccion(a)).join(' · ') || 'Sin acciones';
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

  protected async guardarCategoria(c: Categoria, body: CategoriaIn): Promise<void> {
    this.guardandoCategoria.set(true);
    try {
      await this.api.actualizarCategoria(c.id, { ...body, proceso_id: c.proceso_id });
      this.etiquetas.set((await this.api.listarCategorias(this.buzon().id)).filter((x) => x.activa));
      this.editando.set(null);
      this.toast.show('Acciones guardadas', c.clave);
    } catch (e) {
      this.toast.error('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoCategoria.set(false);
    }
  }
}

/** Árbol de carpetas → lista con profundidad (raíz y un nivel, como lo lee Graph). */
export function aplanar(t: CarpetaGraph[], nivel = 0): CarpetaPlana[] {
  return t.flatMap((c) => [{ nombre: c.nombre, total: c.total, nivel }, ...aplanar(c.hijas ?? [], nivel + 1)]);
}
