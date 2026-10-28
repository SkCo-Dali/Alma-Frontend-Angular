// «Asignación › Reglas y bases» (prototipo subReglasBases + mRegla + mBase +
// mBQuitar): por cada grupo que asigna a personas, la cadena de reglas que se
// evalúa en orden hasta que una asigna — 0. continuidad del hilo (automática) →
// búsquedas en bases (cruces en cascada) → round-robin (obligatoria). Cada búsqueda
// muestra la tarjeta de su base. Debajo, las bases del buzón que ninguna búsqueda usa.

import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { Base, Buzon, BuzonApi, Categoria, FilaBase, Grupo, Persona, Proceso, ReglaAsignacionIn } from './buzon.api';
import { aGrupoIn } from './buzon-asignacion';
import { BUZON_PROTO_CSS } from './buzon-proto.styles';
import { camposDeGrupo, sinActivosTxt } from './asignacion-ui';
import { BaseCardComponent, UsoBase } from './base-card.component';
import { BusquedaW, ReglaEditorComponent, busquedaDe, columnasDe, conDefaults, materializar, nuevaBusqueda } from './regla-editor.component';

interface ModalRegla {
  grupoId: string;
  /** Índice de la búsqueda que se edita; null = nueva. */
  indice: number | null;
  w: BusquedaW;
  err: string;
}

interface ModalBase {
  modo: 'nueva' | 'actualizar';
  base: Base | null;
  w: BusquedaW;
  err: string;
}

interface ModalQuitar {
  base: Base;
  op: 'rr' | 'otra';
  otra: string;
}

@Component({
  selector: 'alma-reglas-bases-tab',
  imports: [LucideAngularModule, BaseCardComponent, ReglaEditorComponent],
  styles: [BUZON_PROTO_CSS, `:host { display: contents; }`],
  template: `
    @if (!gs().length) {
      <div class="glass r-2xl" style="padding:16px"><p class="sm muted">Ningún grupo asigna a personas. Cámbialo en «Grupos y destino».</p></div>
    } @else if (grupo(); as g) {
      <div class="pills glass r-xl" style="padding:4px;justify-self:start" role="tablist">
        @for (x of gs(); track x.id) { <button type="button" role="tab" [attr.aria-selected]="x.id === g.id" (click)="gSel.set(x.id)">{{ x.nombre }}</button> }
      </div>
      @if (otros()) { <p class="xs muted on-wall">Sin cadena: {{ otros() }}</p> }
      <div class="glass r-2xl stack" style="padding:16px">
        <div class="row between"><h2 class="sm b">Cadena de reglas · {{ g.nombre }}</h2><span class="xs muted">Se evalúa en orden hasta que una asigna</span></div>
        <div class="rule fixed"><span class="i">0</span><div><p class="sm b">Continuidad del hilo</p><p class="xs muted">Automática: las respuestas heredan la persona</p></div><span></span></div>
        @for (r of g.reglas; track $index; let i = $index) {
          @let base = baseDe(r.base_id);
          <div class="stack" style="gap:6px">
            <div class="rule" [class.fixed]="!r.activa">
              <span class="i">{{ i + 1 }}</span>
              <div style="min-width:0">
                <p class="sm b">Búsqueda en {{ base?.nombre ?? r.base_nombre ?? 'base quitada' }}@if (!r.activa) { <span class="badge b-slate">Desactivada</span> }</p>
                <p class="xs muted">{{ crucesTxt(r.cruces) }} → {{ r.col_responsable }}@if (r.col_respaldo) { (respaldo: {{ r.col_respaldo }})}</p>
              </div>
              <div class="row" style="flex-wrap:nowrap;gap:4px">
                @if (puede()) {
                  <button type="button" class="btn outline sm" (click)="editarRegla(g, i)">Editar búsqueda</button>
                  <button type="button" class="btn ghost" [attr.aria-label]="r.activa ? 'Desactivar' : 'Activar'" [title]="r.activa ? 'Desactivar' : 'Activar'" [disabled]="guardando()" (click)="alternarRegla(g, i)"><lucide-icon [name]="r.activa ? 'pause' : 'play'" [size]="16" /></button>
                  <button type="button" class="btn ghost danger" aria-label="Quitar búsqueda" title="Quitar búsqueda" [disabled]="guardando()" (click)="quitarRegla(g, i)"><lucide-icon name="x" [size]="16" /></button>
                }
              </div>
            </div>
            @if (base) {
              <div style="margin-left:40px">
                <alma-base-card [base]="base" [equipo]="equipo()" [usos]="usosDe(base.id)" [grupoActual]="g" [puede]="puede()" (baseChange)="actualizarBase($event)" (actualizar)="abrirBase('actualizar', $event)" />
              </div>
            }
          </div>
        }
        @if (!campos().length) {
          <p class="note b-sky"><lucide-icon name="info" [size]="13" /> <span>Los procesos de este grupo no extraen datos: solo round-robin. Activa la extracción en Reglas para buscar en bases.</span></p>
        } @else if (puede()) {
          <button type="button" class="btn outline sm" style="justify-self:start" (click)="nuevaRegla(g)"><lucide-icon name="plus" [size]="13" /> Agregar búsqueda en base</button>
        }
        <div class="rule final"><span class="i">RR</span><div><p class="sm b">Round-robin {{ g.nombre }}</p><p class="xs muted">Obligatoria · menor carga entre activos del grupo · si no hay nadie activo, sus correos {{ sinActivos(g) }}</p></div><span></span></div>
      </div>
    }

    <div class="glass r-2xl stack" style="padding:16px">
      <div class="row between">
        <div><h2 class="sm b">Bases del buzón sin usar</h2><p class="xs muted">Están cargadas pero ninguna búsqueda las usa.</p></div>
        @if (puede()) { <button type="button" class="btn outline sm" (click)="abrirBase('nueva', null)"><lucide-icon name="plus" [size]="13" /> Agregar base</button> }
      </div>
      @for (b of libres(); track b.id) {
        <alma-base-card [base]="b" [equipo]="equipo()" [puede]="puede()" (baseChange)="actualizarBase($event)" (actualizar)="abrirBase('actualizar', $event)">
          @if (puede() && grupo() && b.columnas.length && campos().length) {
            <button type="button" class="btn primary sm" (click)="nuevaRegla(grupo()!, b.id)"><lucide-icon name="plus" [size]="13" /> Usar en «{{ grupo()!.nombre }}»</button>
          }
          @if (puede()) {
            <button type="button" class="btn sm danger" (click)="quitarBase.set({ base: b, op: 'rr', otra: '' })"><lucide-icon name="trash-2" [size]="13" /> Quitar</button>
          }
        </alma-base-card>
      } @empty {
        <p class="xs muted">Todas las bases del buzón están en uso.</p>
      }
    </div>

    <!-- Búsqueda en base (mRegla) -->
    @if (mRegla(); as M) {
      @let gM = grupoDe(M.grupoId);
      <div class="scrim" (click)="cerrarRegla()">
        <div class="modal solid xl" role="dialog" aria-modal="true" aria-label="Búsqueda en base" (click)="$event.stopPropagation()">
          <div class="row between">
            <div><h2 class="sm b">{{ M.indice === null ? 'Agregar' : 'Editar' }} búsqueda en base · {{ gM?.nombre }}</h2><p class="xs muted">Si ningún cruce encuentra el caso, sigue la siguiente regla y al final el round-robin.</p></div>
            <button type="button" class="btn ghost" aria-label="Cerrar" (click)="cerrarRegla()"><lucide-icon name="x" [size]="16" /></button>
          </div>
          <alma-regla-editor [w]="M.w" (wChange)="mRegla.set({ ...M, w: $event })" [campos]="camposM()" [equipo]="equipo()" [bases]="bases()" [buzonId]="buzon().id" idp="rb-m" (baseChange)="actualizarBase($event)" />
          @if (M.err) { <p class="err">{{ M.err }}</p> }
          <div class="row between">
            @if (M.indice !== null && gM) {
              <button type="button" class="btn sm danger" [disabled]="guardando()" (click)="quitarRegla(gM, M.indice)"><lucide-icon name="trash-2" [size]="13" /> Dejar de usar esta base (solo round-robin)</button>
            } @else { <span></span> }
            <div class="row">
              <button type="button" class="btn outline" (click)="cerrarRegla()">Cancelar</button>
              <button type="button" class="btn primary" [disabled]="guardando()" (click)="guardarRegla(M)"><lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="16" [class.animate-spin]="guardando()" /> Guardar regla</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Agregar / actualizar base (mBase) -->
    @if (mBase(); as M) {
      @let titulo = M.modo === 'nueva' ? 'Agregar base' : 'Actualizar base · ' + M.base?.nombre;
      <div class="scrim" (click)="cerrarBase()">
        <div class="modal solid xl" role="dialog" aria-modal="true" [attr.aria-label]="titulo" (click)="$event.stopPropagation()">
          <div class="row between">
            <div>
              <h2 class="sm b">{{ titulo }}</h2>
              <p class="xs muted">{{ M.modo === 'nueva' ? 'Después úsala en una búsqueda desde «Reglas y bases».' : 'Sube una nueva versión o tómala de SharePoint u OneDrive. Alma revisa que estén las columnas que usan las reglas antes de aceptar el cambio.' }}</p>
            </div>
            <button type="button" class="btn ghost" aria-label="Cerrar" (click)="cerrarBase()"><lucide-icon name="x" [size]="16" /></button>
          </div>
          @if (M.modo !== 'nueva' && M.base?.origen === 'sharepoint' && !colsBase().length) {
            <div class="row between sunk r-xl" style="padding:10px 12px">
              <span class="sm"><lucide-icon name="refresh-cw" [size]="13" /> Está en SharePoint: trae la última versión guardada en Excel.</span>
              <button type="button" class="btn primary sm" [disabled]="guardando()" (click)="sincronizar(M.base!)">Sincronizar ahora</button>
            </div>
            <p class="xs muted">O reemplázala por otro archivo:</p>
          }
          @if (colsBase().length) {
            <div class="row between sunk r-xl" style="padding:8px 12px">
              <span class="row sm"><lucide-icon name="sheet" [size]="13" /> <b>{{ M.w.archivo?.name ?? baseDe(M.w.baseId ?? '')?.nombre }}</b> <span class="xxs muted">{{ M.w.archivo ? 'archivo subido' : 'SharePoint' }} · {{ filasModal().length }} filas</span></span>
              <button type="button" class="btn outline sm" (click)="mBase.set({ ...M, w: nueva(), err: '' })">Elegir otro</button>
            </div>
            <div class="sheet-wrap">
              <div class="grid-scroll" style="max-height:150px">
                <table class="sheet">
                  <tr><th class="rh"></th>@for (c of colsBase(); track $index) { <th>{{ c }}</th> }</tr>
                  @for (r of filasModal().slice(0, 4); track $index; let i = $index) {
                    <tr><td class="rh">{{ i + 2 }}</td>@for (c of colsBase(); track $index) { <td>{{ r[c] }}</td> }</tr>
                  }
                </table>
              </div>
            </div>
            @if (requeridas().length) {
              <div class="stack" style="gap:4px">
                <p class="xs b">Columnas que usan las reglas</p>
                <div class="row" style="gap:6px">
                  @for (c of requeridas(); track c) { <span class="badge" [class]="colsBase().includes(c) ? 'badge b-emerald' : 'badge b-rose'">{{ colsBase().includes(c) ? '✓ ' : '✗ ' }}{{ c }}</span> }
                </div>
              </div>
              @if (faltan().length) {
                <p class="note b-rose"><lucide-icon name="x-circle" [size]="13" /> <span>Faltan {{ faltan().join(', ') }}. Corrige el archivo o ajusta las reglas antes de reemplazar; mientras tanto Alma sigue usando la versión vigente.</span></p>
              }
            }
          } @else {
            <alma-regla-editor [w]="M.w" (wChange)="mBase.set({ ...M, w: $event })" [bases]="bases()" [ofrecerBases]="false" [buzonId]="buzon().id" [conectarSp]="M.base ? spDe(M.base) : null" idp="rb-b" (baseChange)="actualizarBase($event)" />
          }
          @if (M.err) { <p class="err">{{ M.err }}</p> }
          <div class="row" style="justify-content:flex-end">
            <button type="button" class="btn outline" (click)="cerrarBase()">Cancelar</button>
            <button type="button" class="btn primary" [disabled]="guardando() || !colsBase().length || !!faltan().length" (click)="guardarBase(M)"><lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="16" [class.animate-spin]="guardando()" /> {{ M.modo === 'nueva' ? 'Agregar base' : 'Confirmar' }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Quitar base (mBQuitar) -->
    @if (quitarBase(); as M) {
      @let us = usosDe(M.base.id);
      @let otras = otrasBases(M.base.id);
      <div class="scrim" (click)="quitarBase.set(null)">
        <div class="modal solid sm" role="dialog" aria-modal="true" aria-label="Quitar base" (click)="$event.stopPropagation()">
          <div class="row between">
            <div><h2 class="sm b">¿Quitar {{ M.base.nombre }}?</h2></div>
            <button type="button" class="btn ghost" aria-label="Cerrar" (click)="quitarBase.set(null)"><lucide-icon name="x" [size]="16" /></button>
          </div>
          @if (us.length) {
            <p class="sm">La usan {{ us.length }} regla(s): {{ nombresUsos(us) }}.</p>
            <label class="row sm" for="bq-1"><input type="radio" name="bq" id="bq-1" [checked]="M.op !== 'otra'" (change)="quitarBase.set({ ...M, op: 'rr' })" /> Quitar también esas búsquedas: los grupos siguen con sus demás reglas y el round-robin</label>
            <label class="row sm" for="bq-2"><input type="radio" name="bq" id="bq-2" [checked]="M.op === 'otra'" [disabled]="!otras.length" (change)="quitarBase.set({ ...M, op: 'otra', otra: M.otra || otras[0].id })" /> Pasar las búsquedas a otra base{{ otras.length ? '' : ' (no hay otra base)' }}</label>
            @if (M.op === 'otra') {
              <select class="input sm" id="bq-otra" aria-label="Otra base" (change)="quitarBase.set({ ...M, otra: $any($event.target).value })">
                @for (x of otras; track x.id) { <option [value]="x.id" [selected]="x.id === M.otra">{{ x.nombre }}</option> }
              </select>
            }
          } @else {
            <p class="sm">Ninguna regla la usa.</p>
          }
          <p class="xs muted">El archivo no se borra de SharePoint; solo deja de estar conectado a este buzón.</p>
          <div class="row" style="justify-content:flex-end">
            <button type="button" class="btn outline" (click)="quitarBase.set(null)">Cancelar</button>
            <button type="button" class="btn primary" style="background:var(--rose)" [disabled]="guardando()" (click)="confirmarQuitarBase(M)"><lucide-icon name="trash-2" [size]="16" /> Quitar base</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ReglasBasesTabComponent {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  readonly grupos = model<Grupo[]>([]);
  readonly bases = model<Base[]>([]);
  readonly equipo = input<Persona[]>([]);
  readonly procesos = input<Proceso[]>([]);
  readonly categorias = input<Categoria[]>([]);
  /** Grupo elegido (compartido con «Probar»). */
  readonly gSel = model<string | null>(null);

  protected readonly nueva = nuevaBusqueda;
  protected readonly guardando = signal(false);
  protected readonly mRegla = signal<ModalRegla | null>(null);
  protected readonly mBase = signal<ModalBase | null>(null);
  protected readonly quitarBase = signal<ModalQuitar | null>(null);
  protected readonly filasModal = signal<FilaBase[]>([]);

  protected readonly puede = computed(() => this.buzon().puede_administrar);
  protected readonly gs = computed(() => this.grupos().filter((g) => g.destino === 'personas'));
  protected readonly grupo = computed<Grupo | null>(() => this.gs().find((g) => g.id === this.gSel()) ?? this.gs()[0] ?? null);
  protected readonly campos = computed(() => {
    const g = this.grupo();
    return g ? camposDeGrupo(g, this.categorias(), this.procesos()) : [];
  });
  protected readonly camposM = computed(() => {
    const g = this.grupoDe(this.mRegla()?.grupoId ?? '');
    return g ? camposDeGrupo(g, this.categorias(), this.procesos()) : [];
  });
  protected readonly otros = computed(() =>
    this.grupos()
      .filter((g) => g.destino !== 'personas')
      .map((o) => `${o.nombre} (${o.destino === 'carpeta' ? `carpeta «${o.carpeta || '—'}»` : 'solo categorizar'})`)
      .join(' · '),
  );
  protected readonly libres = computed(() => this.bases().filter((b) => !this.usosDe(b.id).length));

  // mBase
  protected readonly colsBase = computed(() => {
    const M = this.mBase();
    return M ? columnasDe(M.w, this.bases()) : [];
  });
  protected readonly requeridas = computed(() => {
    const M = this.mBase();
    if (!M?.base) return [];
    const req = new Set<string>();
    this.usosDe(M.base.id).forEach(({ regla: r }) => {
      r.cruces.forEach((c) => req.add(c.columna));
      [r.col_responsable, r.col_respaldo].forEach((c) => c && req.add(c));
    });
    return [...req];
  });
  protected readonly faltan = computed(() => (this.colsBase().length ? this.requeridas().filter((c) => !this.colsBase().includes(c)) : []));

  constructor() {
    // Filas de la vista previa de «Agregar / actualizar base».
    effect(() => {
      const w = this.mBase()?.w;
      if (!w) return;
      if (w.lectura) this.filasModal.set(w.lectura.filas ?? w.lectura.muestra);
      else if (w.baseId) {
        const id = w.baseId;
        void this.api.filasBase(id, undefined, 500).then((r) => this.mBase()?.w.baseId === id && this.filasModal.set(r.items)).catch(() => undefined);
      } else this.filasModal.set([]);
    });
  }

  protected baseDe(id: string): Base | undefined {
    return this.bases().find((b) => b.id === id);
  }

  protected grupoDe(id: string): Grupo | undefined {
    return this.grupos().find((g) => g.id === id);
  }

  protected usosDe(baseId: string): UsoBase[] {
    return this.grupos().flatMap((g) => g.reglas.filter((r) => r.base_id === baseId).map((regla) => ({ grupo: g, regla })));
  }

  protected otrasBases(baseId: string): Base[] {
    return this.bases().filter((b) => b.id !== baseId && b.columnas.length);
  }

  protected nombresUsos(us: UsoBase[]): string {
    return us.map((u) => u.grupo.nombre).join(', ');
  }

  protected crucesTxt(cruces: { campo: string; columna: string }[]): string {
    return cruces.map((c, j) => `${j ? 'luego ' : ''}${c.campo} ↔ ${c.columna}`).join(' · ');
  }

  protected sinActivos(g: Grupo): string {
    return sinActivosTxt(g, this.equipo());
  }

  protected actualizarBase(b: Base): void {
    this.bases.update((l) => (l.some((x) => x.id === b.id) ? l.map((x) => (x.id === b.id ? b : x)) : [...l, b]));
  }

  private async recargar(): Promise<void> {
    const id = this.buzon().id;
    const [grupos, bases] = await Promise.all([this.api.listarGrupos(id), this.api.listarBases(id)]);
    this.grupos.set(grupos);
    this.bases.set(bases);
  }

  // ── Cadena ──
  private async guardarReglas(g: Grupo, reglas: ReglaAsignacionIn[], ok: string): Promise<boolean> {
    this.guardando.set(true);
    try {
      const actualizado = await this.api.actualizarGrupo(g.id, aGrupoIn(g, { reglas }));
      this.grupos.update((l) => l.map((x) => (x.id === g.id ? actualizado : x)));
      this.toast.show(ok);
      return true;
    } catch (e) {
      this.toast.error('No se pudo guardar la cadena', e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  protected alternarRegla(g: Grupo, i: number): void {
    const reglas = aGrupoIn(g).reglas;
    reglas[i] = { ...reglas[i], activa: !reglas[i].activa };
    void this.guardarReglas(g, reglas, reglas[i].activa ? 'Búsqueda activada' : 'Búsqueda desactivada: se salta en la cadena');
  }

  protected async quitarRegla(g: Grupo, i: number): Promise<void> {
    const reglas = aGrupoIn(g).reglas.filter((_, j) => j !== i);
    if (await this.guardarReglas(g, reglas, `Búsqueda quitada: «${g.nombre}» sigue con sus demás reglas y el round-robin`)) this.mRegla.set(null);
  }

  // ── mRegla ──
  protected nuevaRegla(g: Grupo, baseId?: string): void {
    let w = nuevaBusqueda();
    if (baseId) w = conDefaults({ ...w, baseId }, camposDeGrupo(g, this.categorias(), this.procesos()), this.baseDe(baseId)?.columnas ?? []);
    this.mRegla.set({ grupoId: g.id, indice: null, w, err: '' });
  }

  protected editarRegla(g: Grupo, i: number): void {
    this.mRegla.set({ grupoId: g.id, indice: i, w: busquedaDe(g.reglas[i]), err: '' });
  }

  protected cerrarRegla(): void {
    if (!this.guardando()) this.mRegla.set(null);
  }

  protected async guardarRegla(M: ModalRegla): Promise<void> {
    const g = this.grupoDe(M.grupoId);
    if (!g) return;
    const cols = columnasDe(M.w, this.bases());
    const err = !cols.length
      ? 'Elige o sube la base.'
      : !M.w.cruces.length || M.w.cruces.some((z) => !cols.includes(z.columna))
        ? 'Define al menos un cruce con una columna de la base.'
        : !M.w.resp
          ? 'Elige la columna con el responsable.'
          : '';
    if (err) return this.mRegla.set({ ...M, err });
    this.guardando.set(true);
    try {
      const { w } = await materializar(this.api, this.buzon().id, M.w);
      const regla: ReglaAsignacionIn = { base_id: w.baseId!, cruces: w.cruces.map((c) => ({ ...c })), col_responsable: w.resp, col_respaldo: w.bk || null, activa: w.activa };
      const reglas = aGrupoIn(g).reglas;
      if (M.indice === null) reglas.push(regla);
      else reglas[M.indice] = regla;
      await this.api.actualizarGrupo(g.id, aGrupoIn(g, { reglas }));
      await this.recargar();
      this.mRegla.set(null);
      this.toast.show(`Regla guardada en «${g.nombre}»`);
    } catch (e) {
      this.mRegla.set({ ...M, err: e instanceof Error ? e.message : String(e) });
    } finally {
      this.guardando.set(false);
    }
  }

  // ── mBase ──
  protected abrirBase(modo: 'nueva' | 'actualizar', base: Base | null): void {
    this.mBase.set({ modo, base, w: nuevaBusqueda(), err: '' });
  }

  protected cerrarBase(): void {
    if (!this.guardando()) this.mBase.set(null);
  }

  /** Al actualizar una base, «SharePoint u OneDrive» cambia el origen de ESA base y la sincroniza. */
  protected spDe(base: Base): (url: string) => Promise<Base> {
    return async (url) => {
      await this.api.actualizarBase(base.id, { origen: 'sharepoint', sharepoint_url: url });
      const r = await this.api.sincronizarBase(base.id);
      if (!r.aceptada) throw new Error(r.motivo ?? 'No se pudo leer el archivo de SharePoint.');
      return r.base;
    };
  }

  protected async sincronizar(b: Base): Promise<void> {
    this.guardando.set(true);
    try {
      const r = await this.api.sincronizarBase(b.id);
      this.actualizarBase(r.base);
      if (r.aceptada) {
        this.toast.show(`${r.base.nombre} sincronizada`);
        this.mBase.set(null);
      } else this.mBase.update((M) => M && { ...M, err: r.motivo ?? 'Se conserva la versión vigente.' });
    } catch (e) {
      this.mBase.update((M) => M && { ...M, err: e instanceof Error ? e.message : String(e) });
    } finally {
      this.guardando.set(false);
    }
  }

  protected async guardarBase(M: ModalBase): Promise<void> {
    this.guardando.set(true);
    try {
      if (M.modo === 'nueva') {
        const { base } = await materializar(this.api, this.buzon().id, M.w);
        await this.recargar();
        this.toast.show('Base agregada: úsala desde «Reglas y bases»', base?.nombre);
      } else if (M.base && M.w.archivo && M.w.lectura) {
        const r = await this.api.cargarBase(M.base.id, M.w.archivo, M.w.lectura.hoja, M.w.lectura.fila_encabezado);
        this.actualizarBase(r.base);
        if (!r.aceptada) throw new Error(r.motivo ?? 'El archivo no sirve para esta base. Se conserva la versión vigente.');
        this.toast.show(`${r.base.nombre}: actualizada desde el archivo subido`);
      } else if (M.base) {
        this.toast.show(`${M.base.nombre}: actualizada desde SharePoint`);
      }
      this.mBase.set(null);
    } catch (e) {
      this.mBase.set({ ...M, err: e instanceof Error ? e.message : String(e) });
    } finally {
      this.guardando.set(false);
    }
  }

  // ── mBQuitar ──
  protected async confirmarQuitarBase(M: ModalQuitar): Promise<void> {
    const otra = M.op === 'otra' ? M.otra : null;
    this.guardando.set(true);
    try {
      for (const g of this.grupos()) {
        if (!g.reglas.some((r) => r.base_id === M.base.id)) continue;
        const reglas = aGrupoIn(g).reglas.flatMap((r) => (r.base_id !== M.base.id ? [r] : otra ? [{ ...r, base_id: otra }] : []));
        await this.api.actualizarGrupo(g.id, aGrupoIn(g, { reglas }));
      }
      const buzones = M.base.buzones.filter((x) => x !== this.buzon().id);
      if (buzones.length) await this.api.actualizarBase(M.base.id, { buzones });
      else await this.api.eliminarBase(M.base.id);
      await this.recargar();
      this.quitarBase.set(null);
      this.toast.show(`${M.base.nombre} quitada${otra ? `: sus búsquedas usan ${this.baseDe(otra)?.nombre ?? 'la otra base'}` : ': los grupos siguen con el round-robin'}`);
    } catch (e) {
      this.toast.error('No se pudo quitar la base', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
