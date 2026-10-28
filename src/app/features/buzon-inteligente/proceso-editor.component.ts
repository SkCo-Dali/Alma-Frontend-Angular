// Editor de procesos en línea del Buzón Inteligente 2.0 — réplica de `editorInline` del
// prototipo validado (contexto-recaudos-pac/buzon-inteligente-v2.html): pestañas
// Reconocimiento · Etiquetas · Datos (JSON) · Validar · Discriminación. El mismo editor
// sirve en la pestaña Reglas (guarda en el borrador vN) y en el asistente «Nuevo buzón»
// («Aceptar proceso»). Guarda el proceso con sus etiquetas y su discriminación en una
// sola llamada (PUT /procesos-completo).

import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  Buzon,
  BuzonApi,
  CampoProceso,
  Categoria,
  CriterioEtiqueta,
  OperadorCondicion,
  OrigenRegla,
  Proceso,
  TipoCampo,
} from './buzon.api';

/** La base fija que agrega Alma a toda salida: no se redefine en un proceso. */
export const BASE_FIELDS = ['correlation_id', 'fecha_procesamiento', 'proceso', 'score_confianza', 'etiqueta', 'asunto_correo'];

/** Tipos de dato del prototipo ↔ tipos de Alma. */
export const TIPOS_CAMPO: { id: TipoCampo; nombre: string }[] = [
  { id: 'texto', nombre: 'texto' },
  { id: 'numero', nombre: 'número' },
  { id: 'fecha', nombre: 'fecha' },
  { id: 'booleano', nombre: 'booleano' },
  { id: 'lista', nombre: 'lista de texto' },
  { id: 'tabla', nombre: 'lista de objetos' },
];

type Pestana = 'rec' | 'et' | 'dat' | 'val' | 'dis';
type Critico = '0' | '1' | 'alt';

interface EtiquetaEd {
  clave: string;
  criterio: string;
  tipo: CriterioEtiqueta;
  origen: OrigenRegla;
  campo: string;
  op: OperadorCondicion;
  valor: string;
}

interface CampoEd {
  clave: string;
  tipo: TipoCampo;
  descripcion: string;
  critico: Critico;
  identificador: boolean;
  origen: OrigenRegla;
}

interface Borrador {
  nombre: string;
  clave: string;
  senales: string;
  excl: string[];
  etiquetas: EtiquetaEd[];
  extrae: boolean;
  campos: CampoEd[];
  af: string[];
  umbral: number;
  extras: string[];
  disc: { con: string; manda: string }[];
}

const RE_MAYUS = /^[A-Z0-9]+(_[A-Z0-9]+)*$/;
const RE_SNAKE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

@Component({
  selector: 'alma-proceso-editor',
  imports: [FormsModule, LucideAngularModule],
  styleUrls: ['./buzon-proto.css'],
  template: `
    @let d = ed();
    <div class="stack" style="gap:12px;border-top:1px solid var(--border);padding-top:12px">
      <div class="tabs-line" role="tablist">
        @for (t of pestanas; track t[0]) {
          <button type="button" role="tab" [attr.aria-selected]="tab() === t[0]" (click)="cambiarTab(t[0])">{{ t[1] }}</button>
        }
      </div>

      @switch (tab()) {
        @case ('rec') {
          <div class="g2">
            <div class="fld"><label class="label" for="ep-nombre">Nombre *</label><input class="input" id="ep-nombre" [(ngModel)]="d.nombre" /></div>
            <div class="fld"><label class="label" for="ep-k">Clave (MAYÚSCULAS, sin espacios) *</label><input class="input mono" id="ep-k" [(ngModel)]="d.clave" /></div>
          </div>
          <div class="fld"><label class="label" for="ep-sen">Alcance y señales *</label><textarea class="input" id="ep-sen" rows="3" style="height:auto" [(ngModel)]="d.senales"></textarea></div>
          <div class="stack" style="gap:6px">
            <p class="label">Exclusiones propias (se evalúan antes que las señales)</p>
            @for (x of d.excl; track $index; let i = $index) {
              <div class="row" style="flex-wrap:nowrap">
                <input class="input sm" [(ngModel)]="d.excl[i]" [attr.aria-label]="'Exclusión ' + (i + 1)" />
                <button type="button" class="btn ghost danger" (click)="d.excl.splice(i, 1)" aria-label="Quitar"><lucide-icon name="x" [size]="13" /></button>
              </div>
            }
            <button type="button" class="btn outline sm" style="justify-self:start" (click)="d.excl.push('')"><lucide-icon name="plus" [size]="13" /> Agregar exclusión</button>
          </div>
        }
        @case ('et') {
          <p class="xs muted">Por datos: Alma evalúa la condición sobre el JSON (exacto y auditable). Por IA: la IA decide con el texto.</p>
          @for (e of d.etiquetas; track $index; let i = $index) {
            <div class="sunk r-xl" style="padding:10px 12px;display:grid;gap:8px">
              <div class="row" style="flex-wrap:nowrap">
                <span class="orig" [class.user]="e.origen === 'user'" [class.ia]="e.origen !== 'user'" [title]="e.origen === 'user' ? 'Ajustado por ti' : 'Propuesta de Alma'">{{ e.origen === 'user' ? '✎' : '✦' }}</span>
                <input class="input sm mono" style="max-width:240px" [(ngModel)]="e.clave" placeholder="CLAVE_ETIQUETA" aria-label="Clave de etiqueta" />
                <select class="input sm" style="width:auto" [(ngModel)]="e.tipo" aria-label="Tipo de criterio">
                  <option value="datos" [disabled]="!d.extrae || !d.campos.length">Por datos</option>
                  <option value="ia">Por IA</option>
                </select>
                <button type="button" class="btn ghost danger" (click)="d.etiquetas.splice(i, 1)" aria-label="Quitar"><lucide-icon name="x" [size]="13" /></button>
              </div>
              @if (e.tipo === 'datos') {
                <div class="row" style="flex-wrap:nowrap">
                  <select class="input sm" [(ngModel)]="e.campo" aria-label="Campo">
                    @for (f of d.campos; track f.clave) { <option [value]="f.clave">{{ f.clave }}</option> }
                  </select>
                  <select class="input sm" style="width:auto" [(ngModel)]="e.op" aria-label="Operador">
                    <option value="=">=</option><option value="contiene">contiene</option><option value="distinto de">distinto de</option>
                  </select>
                  <input class="input sm" [(ngModel)]="e.valor" placeholder="valor" aria-label="Valor" />
                </div>
              } @else {
                <input class="input sm" [(ngModel)]="e.criterio" placeholder="Cuándo aplica, en lenguaje natural" aria-label="Criterio" />
              }
            </div>
          }
          <button type="button" class="btn outline sm" style="justify-self:start" (click)="agregarEtiqueta()"><lucide-icon name="plus" [size]="13" /> Agregar etiqueta</button>
        }
        @case ('dat') {
          <p class="sm">¿Este proceso necesita extraer datos del correo?</p>
          <div class="g2">
            <button type="button" class="optcard" [attr.aria-pressed]="!d.extrae" (click)="d.extrae = false">
              <span class="row sm b"><lucide-icon name="tag" [size]="13" /> No, solo categorizar</span>
              <span class="xs muted">La salida es la base fija. Validar solo por confianza.</span>
            </button>
            <button type="button" class="optcard" [attr.aria-pressed]="d.extrae" (click)="activarExtraccion()">
              <span class="row sm b"><lucide-icon name="braces" [size]="13" /> Sí, extraer datos</span>
              <span class="xs muted">Define los campos del JSON de salida.</span>
            </button>
          </div>
          @if (d.extrae) {
            <div class="row between">
              <div class="pills">
                <button type="button" [attr.aria-selected]="!json()" (click)="verJson(false)"><lucide-icon name="table" [size]="13" /> Tabla</button>
                <button type="button" [attr.aria-selected]="json()" (click)="verJson(true)"><lucide-icon name="braces" [size]="13" /> JSON</button>
              </div>
              <div class="row">
                <button type="button" class="btn sm" (click)="restaurar()"><lucide-icon name="undo-2" [size]="13" /> Restaurar propuesta de Alma</button>
              </div>
            </div>
            <div class="ep-grid">
              <div class="stack" style="gap:6px;min-width:0">
                @if (json()) {
                  <textarea class="code-ed" spellcheck="false" aria-label="Esquema JSON" [(ngModel)]="jsonTexto"></textarea>
                } @else {
                  <div class="scroll-x">
                    <table class="t">
                      <thead><tr><th></th><th>Campo</th><th>Tipo</th><th>Qué extraer</th><th>Crítico</th><th>Id.</th><th></th></tr></thead>
                      <tbody>
                        @for (f of d.campos; track $index; let i = $index) {
                          <tr>
                            <td style="padding:4px"><span class="orig" [class.user]="f.origen === 'user'" [class.ia]="f.origen !== 'user'">{{ f.origen === 'user' ? '✎' : '✦' }}</span></td>
                            <td style="padding:4px"><input class="input sm mono" style="min-width:190px" [(ngModel)]="f.clave" aria-label="Campo" /></td>
                            <td style="padding:4px">
                              <select class="input sm" style="min-width:150px" [(ngModel)]="f.tipo" aria-label="Tipo">
                                @for (t of tipos; track t.id) { <option [value]="t.id">{{ t.nombre }}</option> }
                              </select>
                            </td>
                            <td style="padding:4px"><input class="input sm" style="min-width:260px" [(ngModel)]="f.descripcion" aria-label="Descripción" /></td>
                            <td style="padding:4px">
                              <select class="input sm" style="min-width:115px" [(ngModel)]="f.critico" aria-label="Crítico">
                                <option value="0">No</option><option value="1">Sí</option><option value="alt">Alterno</option>
                              </select>
                            </td>
                            <td style="padding:4px;text-align:center"><input type="checkbox" [(ngModel)]="f.identificador" aria-label="Identificador" /></td>
                            <td style="padding:4px"><button type="button" class="btn ghost danger" (click)="d.campos.splice(i, 1)" aria-label="Quitar campo"><lucide-icon name="x" [size]="13" /></button></td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <button type="button" class="btn outline sm" style="justify-self:start" (click)="agregarCampo()"><lucide-icon name="plus" [size]="13" /> Agregar campo</button>
                  @if (tieneLista()) {
                    <div class="sunk r-xl" style="padding:10px 12px;display:grid;gap:6px">
                      <p class="xs b">Campos de cada elemento de la lista</p>
                      <div class="row" style="gap:6px">
                        @for (a of d.af; track a; let i = $index) {
                          <span class="chipo">{{ a }} <button type="button" class="mini" (click)="d.af.splice(i, 1)" [attr.aria-label]="'Quitar ' + a">×</button></span>
                        }
                      </div>
                      <div class="row" style="flex-wrap:nowrap">
                        <input class="input sm mono" [(ngModel)]="afNuevo" placeholder="nuevo_campo (p. ej. subcuenta)" />
                        <button type="button" class="btn outline sm" (click)="agregarAf()">Agregar</button>
                      </div>
                    </div>
                  }
                }
              </div>
              <details class="ep-prev sunk r-xl" style="padding:8px 12px" open>
                <summary>Vista previa del JSON de salida</summary>
                <pre class="json"><span class="ln">{{ '{' }}</span><span class="ln base"><span class="c">  // base fija · la agrega Alma (6 campos)</span></span>@for (f of d.campos; track $index; let last = $last) {<span class="ln" [class.idf]="f.identificador">  <span class="k">"{{ f.clave || '…' }}"</span>: <span [class]="f.tipo === 'texto' || f.tipo === 'fecha' ? 's' : 'n'">{{ valorEjemplo(f) }}</span>{{ last ? '' : ',' }}@if (f.critico !== '0') {<span class="c"> // crítico{{ f.critico === 'alt' ? ' alterno' : '' }}</span>}</span>}<span class="ln">{{ '}' }}</span></pre>
              </details>
            </div>
          }
        }
        @case ('val') {
          <div class="fld">
            <label class="label" for="ep-umb">Confianza mínima: <b>{{ d.umbral }}%</b></label>
            <input type="range" id="ep-umb" min="50" max="95" step="5" [(ngModel)]="d.umbral" />
          </div>
          @if (d.extrae) {
            <p class="xs">Topes por críticos vacíos: máximo 60% si falta uno, 40% si faltan dos. Críticos:
              @for (f of criticos(); track f) { <span class="key">{{ f }}</span> } @empty { ninguno }
            </p>
          } @else {
            <p class="note b-sky"><lucide-icon name="info" [size]="13" /> <span>Solo categorización: Validar se decide únicamente por la confianza.</span></p>
          }
          <div class="stack" style="gap:6px">
            <p class="label">Causas adicionales (van a Validar aunque la confianza sea alta)</p>
            @for (x of d.extras; track $index; let i = $index) {
              <div class="row" style="flex-wrap:nowrap">
                <input class="input sm" [(ngModel)]="d.extras[i]" [attr.aria-label]="'Causa ' + (i + 1)" />
                <button type="button" class="btn ghost danger" (click)="d.extras.splice(i, 1)" aria-label="Quitar"><lucide-icon name="x" [size]="13" /></button>
              </div>
            }
            <button type="button" class="btn outline sm" style="justify-self:start" (click)="d.extras.push('')"><lucide-icon name="plus" [size]="13" /> Agregar causa</button>
          </div>
        }
        @case ('dis') {
          <p class="xs muted">Pares de procesos que se pueden confundir con {{ d.clave || 'este proceso' }}: cuándo es cada uno y qué señal manda.</p>
          @if (!otros().length) {
            <p class="note b-sky"><lucide-icon name="info" [size]="13" /> <span>Con un solo proceso no hay nada que discriminar.</span></p>
          }
          @for (x of d.disc; track $index; let i = $index) {
            <div class="sunk r-xl" style="padding:10px 12px;display:grid;gap:6px">
              <div class="row" style="flex-wrap:nowrap">
                <span class="key">{{ d.clave || '…' }}</span> ↔
                <select class="input sm" style="width:auto" [(ngModel)]="x.con" aria-label="Proceso">
                  @for (o of otros(); track o) { <option [value]="o">{{ o }}</option> }
                </select>
                <button type="button" class="btn ghost danger" (click)="d.disc.splice(i, 1)" aria-label="Quitar"><lucide-icon name="x" [size]="13" /></button>
              </div>
              <input class="input sm" [(ngModel)]="x.manda" placeholder="Qué señal manda" aria-label="Qué manda" />
            </div>
          }
          @if (otros().length) {
            <button type="button" class="btn outline sm" style="justify-self:start" (click)="d.disc.push({ con: otros()[0], manda: '' })"><lucide-icon name="plus" [size]="13" /> Agregar par</button>
          }
        }
      }

      @if (errores().length) {
        <div class="note b-rose" style="display:grid">@for (x of errores(); track x) { <span>• {{ x }}</span> }</div>
      }
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn outline sm" (click)="cancelado.emit()">Cancelar</button>
        <button type="button" class="btn primary sm" [disabled]="guardando()" (click)="guardar()">
          <lucide-icon [name]="modo() === 'wiz' ? 'check' : 'save'" [size]="13" />
          {{ guardando() ? 'Guardando…' : modo() === 'wiz' ? 'Aceptar proceso' : 'Guardar en el borrador v' + siguiente() }}
        </button>
      </div>
    </div>
  `,
})
export class ProcesoEditorComponent implements OnInit {
  private readonly api = inject(BuzonApi);

  readonly buzon = input.required<Buzon>();
  /** Proceso a editar; null = proceso nuevo. */
  readonly proceso = input<Proceso | null>(null);
  /** Abre una copia del proceso (clave _COPIA) en vez de editarlo. */
  readonly duplicar = input(false);
  readonly procesos = input<Proceso[]>([]);
  readonly categorias = input<Categoria[]>([]);
  readonly modo = input<'buzon' | 'wiz'>('buzon');
  /** Versión que recibirá el cambio (rótulo del botón). */
  readonly siguiente = input(1);
  readonly guardado = output<Proceso>();
  readonly cancelado = output<void>();

  protected readonly pestanas: [Pestana, string][] = [['rec', 'Reconocimiento'], ['et', 'Etiquetas'], ['dat', 'Datos (JSON)'], ['val', 'Validar'], ['dis', 'Discriminación']];
  protected readonly tipos = TIPOS_CAMPO;
  protected readonly tab = signal<Pestana>('rec');
  protected readonly json = signal(false);
  protected readonly errores = signal<string[]>([]);
  protected readonly guardando = signal(false);
  protected readonly ed = signal<Borrador>(this.vacio());
  protected jsonTexto = '';
  protected afNuevo = '';
  /** Como lo propuso Alma al abrir: «Restaurar» y las marcas ✦/✎. */
  private snap: Borrador = this.vacio();

  // Funciones y no computed: el borrador se edita en el sitio (ngModel) y un computed no lo vería.
  protected readonly otros = () => this.procesos().map((p) => p.clave).filter((k) => k !== this.ed().clave && k !== this.proceso()?.clave);
  protected readonly criticos = () => this.ed().campos.filter((f) => f.critico !== '0').map((f) => f.clave);
  protected readonly tieneLista = () => this.ed().campos.some((f) => f.tipo === 'tabla');

  ngOnInit(): void {
    const p = this.proceso();
    const b = this.desde(p);
    if (p && this.duplicar()) {
      b.nombre += ' (copia)';
      b.clave += '_COPIA';
      b.etiquetas = b.etiquetas.map((e) => ({ ...e, clave: e.clave + '_COPIA' }));
    }
    this.snap = structuredClone(b);
    this.ed.set(b);
  }

  private vacio(): Borrador {
    return {
      nombre: '', clave: '', senales: '', excl: [], extrae: false, campos: [], af: [], extras: [], disc: [],
      etiquetas: [{ clave: '', criterio: '', tipo: 'ia', origen: 'user', campo: '', op: '=', valor: '' }],
      umbral: 70,
    };
  }

  private desde(p: Proceso | null): Borrador {
    if (!p) return { ...this.vacio(), umbral: Math.round((this.buzon().umbral_confianza ?? 0.7) * 100) };
    const cats = this.categorias().filter((c) => c.proceso_id === p.id && c.activa).sort((a, c) => a.orden - c.orden);
    const campos = p.campos_extraer.map<CampoEd>((f) => ({
      clave: f.clave, tipo: f.tipo ?? 'texto', descripcion: f.descripcion, identificador: !!f.identificador, origen: f.origen ?? 'ia',
      critico: f.critico ? (f.alterno ? 'alt' : '1') : '0',
    }));
    return {
      nombre: p.nombre, clave: p.clave, senales: p.descripcion ?? '',
      excl: (p.exclusiones ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
      etiquetas: cats.map((c) => ({
        clave: c.clave, criterio: c.descripcion, tipo: c.criterio ?? 'ia', origen: c.origen ?? 'ia',
        campo: c.condicion?.campo ?? campos[0]?.clave ?? '', op: c.condicion?.op ?? '=', valor: c.condicion?.valor ?? '',
      })),
      extrae: campos.length > 0, campos,
      af: p.campos_extraer.find((f) => f.tipo === 'tabla')?.campos ?? [],
      umbral: Math.round((p.umbral ?? this.buzon().umbral_confianza ?? 0.7) * 100),
      extras: [...(p.causas_validar ?? [])],
      disc: this.buzon().discriminacion
        .filter((x) => x.a === p.clave || x.b === p.clave)
        .map((x) => ({ con: x.a === p.clave ? x.b : x.a, manda: x.manda })),
    };
  }

  protected cambiarTab(t: Pestana): void {
    if (this.json() && this.tab() === 'dat' && !this.desdeJson()) return;
    this.tab.set(t);
    this.errores.set([]);
  }

  protected agregarEtiqueta(): void {
    this.ed().etiquetas.push({ clave: '', criterio: '', tipo: 'ia', origen: 'user', campo: this.ed().campos[0]?.clave ?? '', op: '=', valor: '' });
  }

  protected activarExtraccion(): void {
    const d = this.ed();
    d.extrae = true;
    if (!d.campos.length) this.agregarCampo();
  }

  protected agregarCampo(): void {
    this.ed().campos.push({ clave: 'nuevo_campo', tipo: 'texto', descripcion: 'Describe qué extraer', critico: '0', identificador: false, origen: 'user' });
  }

  protected agregarAf(): void {
    const v = this.afNuevo.trim();
    if (!RE_SNAKE.test(v)) {
      this.errores.set(['El campo de la lista debe ir en snake_case (p. ej. subcuenta).']);
      return;
    }
    if (!this.ed().af.includes(v)) this.ed().af.push(v);
    this.afNuevo = '';
    this.errores.set([]);
  }

  protected restaurar(): void {
    const d = this.ed();
    d.campos = structuredClone(this.snap.campos);
    d.af = [...this.snap.af];
    this.json.set(false);
    this.errores.set([]);
  }

  protected valorEjemplo(f: CampoEd): string {
    if (f.tipo === 'tabla') return `[ { ${this.ed().af.join(', ') || '…'} } ]`;
    if (f.tipo === 'lista') return '[]';
    if (f.tipo === 'booleano') return 'true | false';
    return `"<${f.descripcion.toLowerCase()}>"`;
  }

  protected verJson(si: boolean): void {
    if (si) {
      const o: Record<string, unknown> = {};
      for (const f of this.ed().campos) {
        o[f.clave] = {
          tipo: f.tipo, descripcion: f.descripcion, critico: f.critico === 'alt' ? 'alterno' : f.critico === '1', identificador: f.identificador,
          ...(f.tipo === 'tabla' ? { campos: this.ed().af } : {}),
        };
      }
      this.jsonTexto = JSON.stringify(o, null, 2);
      this.json.set(true);
    } else if (this.desdeJson()) {
      this.json.set(false);
      this.errores.set([]);
    }
  }

  /** Lee el esquema JSON escrito a mano; false (con el error) si no es válido. */
  private desdeJson(): boolean {
    try {
      const o = JSON.parse(this.jsonTexto) as Record<string, { tipo?: TipoCampo; descripcion?: string; critico?: boolean | string; identificador?: boolean; campos?: string[] }>;
      if (typeof o !== 'object' || o === null || Array.isArray(o)) throw new Error('debe ser un objeto { "campo": { … } }');
      const previos = new Map(this.ed().campos.map((f) => [f.clave, f]));
      const d = this.ed();
      d.campos = Object.entries(o).map(([k, x]) => {
        if (Array.isArray(x?.campos)) d.af = x.campos;
        const nf: CampoEd = {
          clave: k, tipo: TIPOS_CAMPO.some((t) => t.id === x?.tipo) ? x.tipo! : 'texto', descripcion: x?.descripcion ?? '',
          critico: x?.critico === 'alterno' ? 'alt' : x?.critico ? '1' : '0', identificador: !!x?.identificador, origen: 'user',
        };
        const pf = previos.get(k);
        if (pf && pf.tipo === nf.tipo && pf.descripcion === nf.descripcion && pf.critico === nf.critico && pf.identificador === nf.identificador) nf.origen = pf.origen;
        return nf;
      });
      return true;
    } catch (e) {
      this.errores.set(['Corrige el JSON del esquema: ' + (e instanceof Error ? e.message : String(e))]);
      return false;
    }
  }

  protected async guardar(): Promise<void> {
    if (this.json() && this.tab() === 'dat' && !this.desdeJson()) return;
    const d = this.ed();
    d.clave = d.clave.trim().toUpperCase();
    const errs: string[] = [];
    if (!d.nombre.trim()) errs.push('El nombre es obligatorio.');
    if (!RE_MAYUS.test(d.clave)) errs.push('La clave debe ir en MAYÚSCULAS, sin espacios ni tildes (p. ej. RECLAMACION).');
    if (this.procesos().some((p) => p.clave === d.clave && p.id !== (this.duplicar() ? '' : this.proceso()?.id))) errs.push(`Ya existe un proceso con la clave ${d.clave}.`);
    if (!d.senales.trim()) errs.push('Describe el alcance y las señales del proceso.');
    const ets = d.etiquetas.filter((e) => e.clave.trim()).map((e) => ({ ...e, clave: e.clave.trim().toUpperCase() }));
    if (!ets.length) errs.push('Agrega al menos una etiqueta.');
    for (const e of ets) {
      if (!RE_MAYUS.test(e.clave)) errs.push(`La etiqueta «${e.clave}» debe ir en MAYÚSCULAS sin espacios.`);
      if (e.tipo === 'ia' && !e.criterio.trim()) errs.push(`La etiqueta «${e.clave}» no tiene criterio.`);
      if (e.tipo === 'datos' && (!d.extrae || !d.campos.some((f) => f.clave === e.campo))) errs.push(`La etiqueta «${e.clave}» es por datos: elige un dato que el proceso extraiga.`);
    }
    if (d.extrae) {
      const vistos = new Set<string>();
      for (const f of d.campos) {
        if (!RE_SNAKE.test(f.clave)) errs.push(`El campo «${f.clave}» debe ir en snake_case.`);
        if (BASE_FIELDS.includes(f.clave)) errs.push(`«${f.clave}» es de la base fija y no se redefine.`);
        if (vistos.has(f.clave)) errs.push(`El campo «${f.clave}» está repetido.`);
        vistos.add(f.clave);
      }
      if (!d.campos.length) errs.push('Con extracción activa, define al menos un campo.');
    }
    if (errs.length) {
      this.errores.set(errs);
      return;
    }
    this.marcarOrigen(d, ets);
    const campos: CampoProceso[] = d.extrae
      ? d.campos.map((f) => ({
          clave: f.clave, tipo: f.tipo, descripcion: f.descripcion, critico: f.critico !== '0', alterno: f.critico === 'alt',
          identificador: f.identificador, origen: f.origen, ...(f.tipo === 'tabla' ? { campos: d.af } : {}),
        }))
      : [];
    this.guardando.set(true);
    try {
      const p = this.proceso();
      const guardado = await this.api.guardarProcesoCompleto(this.buzon().id, {
        original: p && !this.duplicar() ? p.clave : null,
        proceso: {
          clave: d.clave, nombre: d.nombre.trim(), descripcion: d.senales.trim(), exclusiones: d.excl.map((x) => x.trim()).filter(Boolean).join('\n') || null,
          campos_extraer: campos, color: p && !this.duplicar() ? p.color : null, activo: p?.activo ?? true,
          umbral: d.umbral / 100, causas_validar: d.extras.map((x) => x.trim()).filter(Boolean),
        },
        etiquetas: ets.map((e) => ({
          clave: e.clave,
          descripcion: e.tipo === 'datos' ? `${e.campo} ${e.op} ${e.valor}` : e.criterio.trim(),
          criterio: e.tipo, condicion: e.tipo === 'datos' ? { campo: e.campo, op: e.op, valor: e.valor } : null, origen: e.origen,
        })),
        discriminacion: d.disc.filter((x) => x.con && x.manda.trim()).map((x) => ({ con: x.con, manda: x.manda.trim() })),
      });
      this.guardado.emit(guardado);
    } catch (e) {
      this.errores.set([e instanceof Error ? e.message : String(e)]);
    } finally {
      this.guardando.set(false);
    }
  }

  /** ✦ se conserva solo en lo que no cambió desde la propuesta de Alma; lo demás es ✎. */
  private marcarOrigen(d: Borrador, ets: EtiquetaEd[]): void {
    const sf = new Map(this.snap.campos.map((f) => [f.clave, f]));
    for (const f of d.campos) {
      const o = sf.get(f.clave);
      f.origen = o && o.tipo === f.tipo && o.descripcion === f.descripcion && o.critico === f.critico && o.identificador === f.identificador ? o.origen : 'user';
    }
    const se = new Map(this.snap.etiquetas.map((e) => [e.clave, e]));
    for (const e of ets) {
      const o = se.get(e.clave);
      e.origen = o && o.criterio === e.criterio && o.tipo === e.tipo && o.campo === e.campo && o.op === e.op && o.valor === e.valor ? o.origen : 'user';
    }
  }
}
