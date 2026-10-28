// Editor de una búsqueda en base (prototipo reglaEditor, compartido por el modal
// «Agregar búsqueda en base», «Agregar base» y el paso 4 del asistente). Sin base:
// subir un Excel/CSV, conectar un archivo de SharePoint u OneDrive o usar una base
// del buzón. Con base: vista de la hoja, cruces en cascada (dato del JSON ↔ columna
// con una comparación), columna del responsable y de respaldo, validación de los
// responsables contra el equipo («Vincular a…») y prueba con un caso.
// Un archivo subido se lee sin guardarse; `materializar` crea la base al guardar.

import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { Base, BuzonApi, COMPARACIONES, CampoProceso, Cruce, FilaBase, LecturaArchivo, Persona, ReglaAsignacion } from './buzon.api';
import { comparacionPara, normaliza, nrm, reconocer } from './buzon-asignacion';

/** Estado de una búsqueda mientras se edita (prototipo W). */
export interface BusquedaW {
  /** Base del buzón elegida (o creada al guardar). */
  baseId: string | null;
  /** Archivo subido que aún no es una base. */
  archivo: File | null;
  lectura: LecturaArchivo | null;
  cruces: Cruce[];
  resp: string;
  bk: string;
  test: Record<string, string>;
  browse: boolean;
  /** Vínculos hechos sobre el archivo subido (se guardan al crear la base). */
  vinculos: Record<string, string>;
  /** La búsqueda está activa en la cadena. */
  activa: boolean;
}

export function nuevaBusqueda(): BusquedaW {
  return { baseId: null, archivo: null, lectura: null, cruces: [], resp: '', bk: '', test: {}, browse: false, vinculos: {}, activa: true };
}

export function busquedaDe(r: ReglaAsignacion): BusquedaW {
  return { ...nuevaBusqueda(), baseId: r.base_id, cruces: r.cruces.map((c) => ({ ...c })), resp: r.col_responsable, bk: r.col_respaldo ?? '', activa: r.activa };
}

export function columnasDe(w: BusquedaW, bases: Base[]): string[] {
  return w.baseId ? (bases.find((b) => b.id === w.baseId)?.columnas ?? []) : (w.lectura?.columnas ?? []);
}

/** La búsqueda tiene base, al menos un cruce y responsable. */
export function busquedaCompleta(w: BusquedaW, bases: Base[]): boolean {
  const cols = columnasDe(w, bases);
  return !!cols.length && !!w.cruces.length && w.cruces.every((c) => c.campo && cols.includes(c.columna)) && !!w.resp;
}

const normCol = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Columna de la base que parece corresponder a un dato del JSON (codigo_pac → «CODIGO PAC»); '' si ninguna. */
function colMatch(campo: string, cols: string[]): string {
  const tk = campo.toUpperCase().split('_').filter((x) => x.length > 2);
  for (const t of tk) {
    const ex = cols.find((c) => normCol(c) === t);
    if (ex) return ex;
  }
  for (const t of [...tk].reverse()) {
    const hit = cols.find((c) => normCol(c).includes(t));
    if (hit) return hit;
  }
  return '';
}
const colPara = (campo: string, cols: string[]) => colMatch(campo, cols) || cols[0] || '';

/** Cruce sugerido y columnas de responsable/respaldo al elegir una base. */
export function conDefaults(w: BusquedaW, campos: CampoProceso[], cols: string[]): BusquedaW {
  const id = campos.find((f) => f.critico && colMatch(f.clave, cols)) ?? campos.find((f) => colMatch(f.clave, cols)) ?? campos[0];
  return {
    ...w,
    cruces: id ? [{ campo: id.clave, columna: colPara(id.clave, cols), comparacion: comparacionPara(id.clave) }] : [],
    resp: cols.find((c) => /ANALISTA|RESPONSABLE/i.test(c) && !/BACKUP|RESPALDO/i.test(c)) ?? '',
    bk: cols.find((c) => /BACKUP|RESPALDO/i.test(c)) ?? '',
  };
}

/** Nombre de la base a partir del archivo («base_polizas.xlsx» → «BASE POLIZAS»). */
export function nombreBase(archivo: string): string {
  return archivo.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ').toUpperCase();
}

/** Si la búsqueda usa un archivo subido, crea la base del buzón y lo carga (con sus vínculos). */
export async function materializar(api: BuzonApi, buzonId: string, w: BusquedaW): Promise<{ w: BusquedaW; base: Base | null }> {
  if (w.baseId || !w.archivo || !w.lectura) return { w, base: null };
  const creada = await api.crearBase({ nombre: nombreBase(w.archivo.name), origen: 'archivo', buzones: [buzonId] });
  const r = await api.cargarBase(creada.id, w.archivo, w.lectura.hoja, w.lectura.fila_encabezado);
  if (!r.aceptada) throw new Error(r.motivo ?? 'El archivo no sirve como base.');
  let base = r.base;
  for (const [valor, correo] of Object.entries(w.vinculos)) base = await api.vincular(base.id, valor, correo);
  return { w: { ...w, baseId: base.id, archivo: null, lectura: null, vinculos: {} }, base };
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letra = (i: number) => (i < 26 ? LETRAS[i] : LETRAS[Math.floor(i / 26) - 1] + LETRAS[i % 26]);

@Component({
  selector: 'alma-regla-editor',
  imports: [FormsModule, LucideAngularModule],
  styleUrls: ['./buzon-proto.css'],
  styles: [`:host { display: contents; }`],
  template: `
    @let W = w();
    @if (!cols().length) {
      <p class="sm">¿Dónde está la base con el responsable de cada caso?</p>
      <div class="g3">
        <label class="optcard" [attr.for]="idp() + '-file'" style="cursor:pointer"><span class="row sm b"><lucide-icon name="upload" [size]="13" /> Subir Excel o CSV</span><span class="xs muted">Alma lee la primera hoja. El archivo queda en Alma; se reemplaza cuando cambie.</span></label>
        <input type="file" [id]="idp() + '-file'" accept=".xlsx,.xls,.xlsm,.csv" hidden (change)="subir($event)" />
        <button type="button" class="optcard" [attr.aria-pressed]="W.browse" (click)="poner({ browse: !W.browse })"><span class="row sm b"><lucide-icon name="cloud" [size]="13" /> SharePoint u OneDrive</span><span class="xs muted">Se edita en Excel en la nube y Alma sincroniza la última versión válida.</span></button>
        @for (b of basesListas(); track b.id) {
          <button type="button" class="optcard" (click)="elegirBase(b.id)"><span class="row sm b"><lucide-icon name="sheet" [size]="13" /> {{ b.nombre }}</span><span class="xxs muted">Ya está en este buzón · {{ b.total_filas.toLocaleString('es-CO') }} filas</span></button>
        }
      </div>
      @if (W.browse) {
        <div class="sunk r-xl" style="padding:10px 12px;display:grid;gap:6px">
          <p class="xs b"><lucide-icon name="folder" [size]="13" /> Enlace del archivo en SharePoint u OneDrive</p>
          <div class="row" style="flex-wrap:nowrap">
            <input class="input sm" [(ngModel)]="spUrl" placeholder="https://empresa.sharepoint.com/sites/…/BASE.xlsx" aria-label="Enlace del archivo" />
            <button type="button" class="btn primary sm" [disabled]="conectando() || !spUrl.trim()" (click)="conectar()"><lucide-icon [name]="conectando() ? 'loader-2' : 'plug'" [size]="13" [class.animate-spin]="conectando()" /> Conectar</button>
          </div>
          @if (errSp(); as e) { <p class="err">{{ e }}</p> }
        </div>
      }
      @if (leyendo()) { <p class="xs muted">Leyendo el archivo…</p> }
      <p class="xxs muted">Alma lee la hoja de verdad (.xlsx y .csv) y detecta la fila de encabezados.</p>
    } @else {
      <div class="row between sunk r-xl" style="padding:8px 12px">
        <span class="row sm"><lucide-icon name="sheet" [size]="13" /> <b>{{ nombre() }}</b> <span class="xxs muted">{{ W.baseId ? 'base del buzón' : 'archivo subido' }} · hoja «{{ hoja() }}» · {{ total().toLocaleString('es-CO') }} filas</span></span>
        <button type="button" class="btn outline sm" (click)="limpiar()">Cambiar base</button>
      </div>
      <div class="sheet-wrap">
        <div class="grid-scroll" style="max-height:150px">
          <table class="sheet">
            <tr>
              <th class="rh"></th>
              @for (c of cols(); track $index; let i = $index) {
                <th>{{ letra(i) }} · {{ c }}@if (uso(c); as u) { <span class="use">{{ u }}</span> }</th>
              }
            </tr>
            @for (r of rows().slice(0, 4); track $index; let i = $index) {
              <tr><td class="rh">{{ i + filaDatos() }}</td>@for (c of cols(); track $index) { <td>{{ r[c] }}</td> }</tr>
            }
          </table>
        </div>
      </div>

      <div class="stack" style="gap:6px">
        <p class="xs b">Cruces en cascada · si uno no encuentra el caso, prueba el siguiente</p>
        @for (z of W.cruces; track $index; let i = $index) {
          <div class="row" style="flex-wrap:nowrap;gap:6px">
            <span class="key">{{ i + 1 }}</span>
            <select class="input sm" aria-label="Dato del JSON" [ngModel]="z.campo" (ngModelChange)="cruce(i, { campo: $event })">
              @for (f of campos(); track f.clave) { <option [value]="f.clave">{{ f.clave }}</option> }
              @if (z.campo && !esCampo(z.campo)) { <option [value]="z.campo">{{ z.campo }}</option> }
            </select>
            <span class="muted">↔</span>
            <select class="input sm" aria-label="Columna" [ngModel]="z.columna" (ngModelChange)="cruce(i, { columna: $event })">
              @for (c of cols(); track $index) { <option [value]="c">{{ c }}</option> }
            </select>
            <select class="input sm" style="width:auto;min-width:190px;flex:none" aria-label="Comparación" [ngModel]="z.comparacion" (ngModelChange)="cruce(i, { comparacion: $event })">
              @for (c of comparaciones; track c.id) { <option [value]="c.id">{{ c.nombre }}</option> }
            </select>
            <button type="button" class="mini" aria-label="Subir" (click)="moverCruce(i, -1)">‹</button>
            <button type="button" class="mini" aria-label="Bajar" (click)="moverCruce(i, 1)">›</button>
            <button type="button" class="btn ghost danger" aria-label="Quitar cruce" (click)="quitarCruce(i)"><lucide-icon name="x" [size]="13" /></button>
          </div>
        }
        @if (campos().length) {
          <button type="button" class="btn outline sm" style="justify-self:start" (click)="agregarCruce()"><lucide-icon name="plus" [size]="13" /> Agregar cruce</button>
        } @else {
          <p class="note b-amber"><lucide-icon name="alert-triangle" [size]="13" /> <span>Los procesos de este grupo no extraen datos para cruzar.</span></p>
        }
      </div>

      <div class="g2">
        <div class="fld">
          <label class="label" [attr.for]="idp() + '-resp'">Columna con el responsable *</label>
          <select class="input sm" [id]="idp() + '-resp'" aria-label="Columna" [ngModel]="W.resp" (ngModelChange)="poner({ resp: $event })">
            <option value="">Elige la columna…</option>
            @for (c of cols(); track $index) { <option [value]="c">{{ c }}</option> }
          </select>
          <span class="xxs muted">Debe traer el correo o el nombre de la persona; lo que no coincida se vincula abajo.</span>
        </div>
        <div class="fld">
          <label class="label" [attr.for]="idp() + '-bk'">Columna de respaldo</label>
          <select class="input sm" [id]="idp() + '-bk'" aria-label="Columna" [ngModel]="W.bk" (ngModelChange)="poner({ bk: $event })">
            <option value="">Sin respaldo</option>
            @for (c of cols(); track $index) { <option [value]="c">{{ c }}</option> }
          </select>
          <span class="xxs muted">Se usa si el responsable está ausente o inactivo.</span>
        </div>
      </div>

      @if (W.resp && validacion(); as V) {
        <div class="g4" style="gap:8px">
          <div class="stat"><p class="l">Responsables reconocidos</p><p class="v" style="color:var(--emerald)">{{ V.ok }}/{{ V.total }}</p></div>
          <div class="stat"><p class="l">No reconocidos</p><p class="v" [style.color]="V.desc.length ? 'var(--amber)' : 'inherit'">{{ V.desc.length }}</p></div>
          <div class="stat"><p class="l">Responsable vacío</p><p class="v">{{ V.vac }}</p></div>
          <div class="stat"><p class="l">Repetidos con otro responsable</p><p class="v">{{ V.dup }}</p></div>
        </div>
        @if (V.desc.length) {
          <p class="note b-amber"><lucide-icon name="user-x" [size]="13" /> <span>No se reconocen en el equipo (ni por correo ni por nombre). Vincúlalos o esos casos seguirán a la siguiente regla:</span></p>
          <div class="stack" style="gap:6px">
            @for (v of V.desc; track v) {
              <div class="row" style="flex-wrap:nowrap">
                <span class="key" style="min-width:140px">{{ v }}</span><span class="muted">→</span>
                <select class="input sm" style="min-width:220px;width:auto" [attr.aria-label]="'Vincular ' + v" [disabled]="vinculando()" (change)="vincular(v, $any($event.target).value)">
                  <option value="">Vincular a…</option>
                  @for (p of equipo(); track p.correo) { <option [value]="p.correo">{{ p.nombre }}</option> }
                </select>
              </div>
            }
          </div>
        }
      }

      @if (W.cruces.length) {
        <div class="sunk r-xl" style="padding:10px 12px;display:grid;gap:8px">
          <p class="xs b"><lucide-icon name="flask-conical" [size]="13" /> Probar con un caso</p>
          <div class="row">
            @for (c of camposPrueba(); track c) {
              <label class="fld" style="min-width:150px"><span class="label mono">{{ c }}</span><input class="input sm" [value]="W.test[c] || ''" placeholder="valor del correo" (change)="probarCon(c, $any($event.target).value)" /></label>
            }
          </div>
          @if (prueba(); as P) {
            <p class="note" [class]="P[0] === 'ok' ? 'note b-emerald' : 'note b-amber'"><lucide-icon [name]="P[0] === 'ok' ? 'check' : 'shuffle'" [size]="13" /> <span>{{ P[1] }}</span></p>
          }
        </div>
      }
    }
  `,
})
export class ReglaEditorComponent {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly w = model.required<BusquedaW>();
  readonly campos = input<CampoProceso[]>([]);
  readonly equipo = input<Pick<Persona, 'nombre' | 'correo'>[]>([]);
  /** Bases del buzón (para elegir una y leer sus columnas y vínculos). */
  readonly bases = input<Base[]>([]);
  /** Ofrecer las bases del buzón como opción (no en «Agregar base»). */
  readonly ofrecerBases = input(true);
  readonly buzonId = input.required<string>();
  /** Prefijo de los id del formulario (único en la página). */
  readonly idp = input('rb');
  /** Cómo se conecta un archivo de SharePoint (por defecto, crea una base del buzón y la sincroniza). */
  readonly conectarSp = input<((url: string) => Promise<Base>) | null>(null);
  /** Una base cambió o se creó (vínculos, SharePoint). */
  readonly baseChange = output<Base>();

  protected readonly comparaciones = COMPARACIONES;
  protected readonly letra = letra;
  protected spUrl = '';
  protected readonly conectando = signal(false);
  protected readonly errSp = signal<string | null>(null);
  protected readonly leyendo = signal(false);
  protected readonly vinculando = signal(false);

  /** Filas de las bases del buzón ya leídas (hasta 500 por base). */
  private readonly filasPorBase = signal<Record<string, FilaBase[]>>({});

  protected readonly base = computed(() => this.bases().find((b) => b.id === this.w().baseId) ?? null);
  protected readonly basesListas = computed(() => (this.ofrecerBases() ? this.bases().filter((b) => b.columnas.length) : []));
  protected readonly cols = computed(() => columnasDe(this.w(), this.bases()));
  protected readonly rows = computed<FilaBase[]>(() => {
    const W = this.w();
    if (W.baseId) return this.filasPorBase()[W.baseId] ?? [];
    return W.lectura ? (W.lectura.filas ?? W.lectura.muestra) : [];
  });
  protected readonly nombre = computed(() => this.base()?.nombre ?? this.w().archivo?.name ?? '');
  protected readonly hoja = computed(() => this.base()?.hoja ?? this.w().lectura?.hoja ?? 'CSV');
  protected readonly total = computed(() => this.base()?.total_filas ?? this.w().lectura?.total_filas ?? 0);
  /** Número de fila (en la hoja) de la primera fila de datos. */
  protected readonly filaDatos = computed(() => (this.base()?.fila_encabezado ?? this.w().lectura?.fila_encabezado ?? 1) + 1);
  private readonly vinculos = computed(() => (this.w().baseId ? (this.base()?.vinculos ?? {}) : this.w().vinculos));

  protected readonly validacion = computed(() => {
    const W = this.w();
    const rows = this.rows();
    if (!rows.length) return null;
    let ok = 0;
    let vac = 0;
    let dup = 0;
    const desc = new Set<string>();
    rows.forEach((r) => {
      const v = r[W.resp] ?? '';
      if (!v) vac++;
      else if (reconocer(v, this.equipo(), this.vinculos())) ok++;
      else desc.add(v);
    });
    const c0 = W.cruces[0];
    if (c0) {
      const vis = new Map<string, string>();
      rows.forEach((r) => {
        const k = normaliza(r[c0.columna], c0.comparacion);
        if (!k) return;
        if (vis.has(k) && vis.get(k) !== r[W.resp]) dup++;
        vis.set(k, r[W.resp]);
      });
    }
    return { ok, vac, desc: [...desc], dup, total: rows.length };
  });

  protected readonly camposPrueba = computed(() => [...new Set(this.w().cruces.map((z) => z.campo))]);

  /** Prototipo wProbar: el primer cruce que encuentra el caso decide. */
  protected readonly prueba = computed<['ok' | 'warn', string] | null>(() => {
    const W = this.w();
    if (!W.cruces.length) return null;
    const rows = this.rows();
    for (const [i, cz] of W.cruces.entries()) {
      const v = W.test[cz.campo];
      if (!v || !this.cols().includes(cz.columna)) continue;
      const nv = normaliza(v, cz.comparacion);
      const hit = rows.find((r) => nv && normaliza(r[cz.columna], cz.comparacion) === nv);
      if (!hit) continue;
      const resp = hit[W.resp] ?? '';
      const p = resp ? reconocer(resp, this.equipo(), this.vinculos()) : null;
      const fila = rows.indexOf(hit) + this.filaDatos();
      const fin = resp ? (p ? ` = ${p.nombre} · está en el equipo` : ' · no se reconoce en el equipo, sigue la siguiente regla') : ' · sigue la siguiente regla';
      return ['ok', `Cruce ${i + 1} (${cz.campo} ↔ ${cz.columna}) encontró la fila ${fila} → ${resp || 'responsable vacío'}${fin}`];
    }
    return ['warn', 'Ningún cruce encontró el caso → round-robin del grupo'];
  });

  constructor() {
    // Lee las filas de la base elegida (una vez por base).
    effect(() => {
      const id = this.w().baseId;
      const b = this.base();
      if (!id || !b?.columnas.length || this.filasPorBase()[id]) return;
      this.filasPorBase.update((m) => ({ ...m, [id]: [] }));
      void this.api
        .filasBase(id, undefined, 500)
        .then((r) => this.filasPorBase.update((m) => ({ ...m, [id]: r.items })))
        .catch(() => this.filasPorBase.update(({ [id]: _x, ...m }) => m));
    });
  }

  protected esCampo(clave: string): boolean {
    return this.campos().some((c) => c.clave === clave);
  }

  protected uso(c: string): string {
    const W = this.w();
    return W.cruces.some((z) => z.columna === c) ? 'cruce' : c === W.resp || c === W.bk ? 'resp.' : '';
  }

  protected poner(cambios: Partial<BusquedaW>): void {
    this.w.set({ ...this.w(), ...cambios });
  }

  protected cruce(i: number, cambios: Partial<Cruce>): void {
    this.poner({ cruces: this.w().cruces.map((z, j) => (j === i ? { ...z, ...cambios } : z)) });
  }

  protected moverCruce(i: number, d: number): void {
    const cz = [...this.w().cruces];
    const j = i + d;
    if (j < 0 || j >= cz.length) return;
    [cz[i], cz[j]] = [cz[j], cz[i]];
    this.poner({ cruces: cz });
  }

  protected quitarCruce(i: number): void {
    this.poner({ cruces: this.w().cruces.filter((_, j) => j !== i) });
  }

  protected agregarCruce(): void {
    const usados = this.w().cruces.map((z) => z.campo);
    const sig = this.campos().find((f) => !usados.includes(f.clave)) ?? this.campos()[0];
    if (!sig) return;
    this.poner({ cruces: [...this.w().cruces, { campo: sig.clave, columna: colPara(sig.clave, this.cols()), comparacion: comparacionPara(sig.clave) }] });
  }

  protected probarCon(campo: string, valor: string): void {
    this.poner({ test: { ...this.w().test, [campo]: valor } });
  }

  protected limpiar(): void {
    this.poner({ baseId: null, archivo: null, lectura: null, cruces: [], resp: '', bk: '', test: {}, vinculos: {} });
  }

  protected elegirBase(id: string): void {
    const cols = this.bases().find((b) => b.id === id)?.columnas ?? [];
    const W: BusquedaW = { ...this.w(), baseId: id, archivo: null, lectura: null, browse: false };
    this.w.set(this.campos().length ? conDefaults(W, this.campos(), cols) : W);
  }

  protected async subir(ev: Event): Promise<void> {
    const el = ev.target as HTMLInputElement;
    const f = el.files?.[0];
    el.value = '';
    if (!f) return;
    this.leyendo.set(true);
    try {
      const lectura = await this.api.leerArchivo(f);
      const W: BusquedaW = { ...this.w(), baseId: null, archivo: f, lectura, browse: false, vinculos: {} };
      this.w.set(this.campos().length ? conDefaults(W, this.campos(), lectura.columnas) : W);
      this.toast.show(`${f.name} cargado: revisa columnas y cruces`);
    } catch (e) {
      this.toast.error('No se pudo leer el archivo', e instanceof Error ? e.message : String(e));
    } finally {
      this.leyendo.set(false);
    }
  }

  protected async conectar(): Promise<void> {
    const url = this.spUrl.trim();
    this.errSp.set(null);
    if (!/^https:\/\/[a-z0-9.-]+\.sharepoint\.com\//i.test(url)) return this.errSp.set('Pega el enlace del archivo en SharePoint u OneDrive (https://…sharepoint.com/…).');
    this.conectando.set(true);
    try {
      const propia = this.conectarSp();
      let base: Base;
      if (propia) base = await propia(url);
      else {
        const archivo = decodeURIComponent(url.split('?')[0].split('/').pop() ?? 'BASE');
        const creada = await this.api.crearBase({ nombre: nombreBase(archivo), origen: 'sharepoint', sharepoint_url: url, buzones: [this.buzonId()] });
        const r = await this.api.sincronizarBase(creada.id);
        base = r.base;
        if (!r.aceptada) this.errSp.set(r.motivo ?? 'No se pudo leer el archivo de SharePoint.');
      }
      this.baseChange.emit(base);
      if (base.columnas.length) {
        this.spUrl = '';
        this.elegirBase(base.id);
      }
    } catch (e) {
      this.errSp.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.conectando.set(false);
    }
  }

  protected async vincular(valor: string, correo: string): Promise<void> {
    if (!correo) return;
    const W = this.w();
    if (!W.baseId) {
      this.poner({ vinculos: { ...W.vinculos, [nrm(valor)]: correo } });
      this.toast.show(`«${valor}» vinculado`);
      return;
    }
    this.vinculando.set(true);
    try {
      const b = await this.api.vincular(W.baseId, valor, correo);
      this.baseChange.emit(b);
      this.toast.show(`«${valor}» vinculado`);
    } catch (e) {
      this.toast.error('No se pudo vincular', e instanceof Error ? e.message : String(e));
    } finally {
      this.vinculando.set(false);
    }
  }
}
