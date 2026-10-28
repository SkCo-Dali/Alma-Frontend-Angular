// Pasos 3 «Asignación» y 4 «Formato específico» del asistente «Nuevo buzón»
// (prototipo mNuevoBuzon, m.step 3 y 4, y la sub-vista «import»). Trabaja sobre el
// buzón real ya creado en estado «config»: los grupos, el equipo y las búsquedas en
// bases se guardan con la misma API que la pestaña Asignación, a medida que se
// configuran. El shell del asistente lee `estado` para el pie (Continuar / por qué
// no) y guarda la elección «Sí/No» como módulos del buzón (asig → mod_asignacion,
// esp → mod_bases).

import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AccesosApi } from '../../core/services/accesos.api';
import { ToastService } from '../../core/services/toast.service';
import { Base, Buzon, BuzonApi, Categoria, DestinoGrupo, Grupo, Persona, PersonaIn, Proceso } from './buzon.api';
import { aGrupoIn, aPersonaIn } from './buzon-asignacion';
import {
  EstadoGrupos,
  GrupoBorrador,
  borradorDe,
  camposDeGrupo,
  etiquetasDe,
  gruposPorModo,
  nombresDirectorio,
  parseCorreos,
  personaNueva,
  sincronizarGrupos,
} from './asignacion-ui';
import { CarpetaPlana, CarpetaSelectComponent, aplanarCarpetas } from './carpeta-select.component';
import { GruposFormComponent } from './grupos-form.component';
import { ImportEquipoComponent } from './import-equipo.component';
import { BusquedaW, ReglaEditorComponent, busquedaCompleta, busquedaDe, columnasDe, materializar, nuevaBusqueda } from './regla-editor.component';

/** Estado del paso para el pie del asistente. `omitido` = eligió «No» (null: aún no elige). */
export interface EstadoPasoAsignacion {
  puedeSeguir: boolean;
  porque: string;
  omitido: boolean | null;
}

interface CfgEsp {
  reglas: BusquedaW[];
  sel: number;
}

@Component({
  selector: 'alma-asignacion-wizard',
  imports: [FormsModule, LucideAngularModule, CarpetaSelectComponent, GruposFormComponent, ImportEquipoComponent, ReglaEditorComponent],
  styleUrls: ['./buzon-proto.css'],
  styles: [`:host { display: grid; gap: 16px; min-width: 0; }`],
  template: `
    @if (cargando()) {
      <p class="xs muted">Cargando…</p>
    } @else if (error(); as e) {
      <p class="note b-rose"><lucide-icon name="x-circle" [size]="13" /> <span>{{ e }}</span></p>
    } @else if (paso() === 3 && importando()) {
      <!-- Sub-vista «import» -->
      <div class="row between"><button type="button" class="btn outline sm" title="Volver al equipo" (click)="importando.set(false)"><lucide-icon name="arrow-left" [size]="13" /> Volver</button></div>
      <h3 class="sm b">Importar hoja del equipo</h3>
      <alma-import-equipo [buzonId]="buzon().id" [grupos]="gpGuardados()" [equipo]="equipo()" [carpetas]="carpetas()" idp="nb-imp" (importado)="equipo.set($event); importando.set(false)" />
    } @else if (paso() === 3) {
      <p class="sm">¿Tu área reparte los correos entre personas?</p>
      <div class="g2">
        <button type="button" class="optcard" [attr.aria-pressed]="asig() === true" (click)="elegirAsig(true)"><span class="row sm b"><lucide-icon name="check" [size]="13" /> Sí, asignar</span><span class="xs muted">Por grupos de etiquetas, con round-robin entre los activos.</span></button>
        <button type="button" class="optcard" [attr.aria-pressed]="asig() === false" (click)="elegirAsig(false)"><span class="row sm b"><lucide-icon name="skip-forward" [size]="13" /> No, solo categorizar</span><span class="xs muted">Los correos se etiquetan; nadie se asigna.</span></button>
      </div>
      @if (asig()) {
        <div class="sunk r-xl stack" style="padding:12px 14px;gap:10px">
          <p class="xs b">1 · ¿Cómo se reparten las etiquetas?</p>
          <alma-grupos-form [ets]="ets()" [st]="st()" (stChange)="ponerSt($event)" idp="wgm" />
        </div>
        <div class="sunk r-xl stack" style="padding:12px 14px;gap:8px">
          <p class="xs b">2 · Destino de cada grupo</p>
          @for (g of st().grupos; track g.key) {
            <div class="row" style="flex-wrap:nowrap">
              <span class="sm b" style="min-width:150px">{{ g.nombre }}</span>
              <select class="input sm" style="width:auto;min-width:210px" [attr.aria-label]="'Destino de ' + g.nombre" (change)="ponerGrupo(g.key, { destino: $any($event.target).value })">
                <option value="personas" [selected]="g.destino === 'personas'">Asignar a personas</option>
                <option value="carpeta" [selected]="g.destino === 'carpeta'">Enviar a una carpeta</option>
                <option value="categorizar" [selected]="g.destino === 'categorizar'">Solo categorizar</option>
              </select>
              @if (g.destino === 'carpeta') {
                <alma-carpeta-select [carpetas]="carpetas()" [valor]="g.carpeta" (valorChange)="ponerGrupo(g.key, { carpeta: $event })" />
              }
            </div>
          }
        </div>
        @if (gp().length) {
          <div class="sunk r-xl stack" style="padding:12px 14px;gap:8px">
            <div class="row between">
              <p class="xs b">3 · Equipo · columnas = grupos</p>
              <div class="row"><button type="button" class="btn outline sm" (click)="importando.set(true)"><lucide-icon name="file-up" [size]="13" /> Importar hoja</button></div>
            </div>
            <div class="row" style="flex-wrap:nowrap">
              <input class="input sm" id="nb-eq-mail" placeholder="Escribe o pega correos separados por coma…" aria-label="Correos" [(ngModel)]="correos" (keydown.enter)="$event.preventDefault(); agregar()" autocomplete="off" />
              <button type="button" class="btn primary sm" [disabled]="guardandoEq()" (click)="agregar()"><lucide-icon name="user-plus" [size]="13" /> Agregar</button>
            </div>
            @if (eqErr().length) {
              <div class="note b-rose" style="display:grid">@for (x of eqErr(); track $index) { <span>• {{ x }}</span> }</div>
            }
            <div class="scroll-x">
              <table class="t">
                <thead><tr><th class="num">#</th><th>Persona</th><th>Carpeta</th>@for (g of gp(); track g.key) { <th>{{ g.nombre }}</th> }<th></th></tr></thead>
                <tbody>
                  @for (e of equipo(); track e.id + ':' + version(); let i = $index) {
                    <tr>
                      <td class="num xs muted">{{ i + 1 }}</td>
                      <td><b class="sm">{{ e.nombre }}</b><p class="xxs muted">{{ e.correo }}</p></td>
                      <td style="padding:4px"><alma-carpeta-select [carpetas]="carpetas()" [valor]="e.carpeta" (valorChange)="cambiarCarpeta(e, $event)" vacia="Sin carpeta (vigilada)" [disabled]="guardandoEq()" /></td>
                      @for (g of gp(); track g.key) {
                        <td style="text-align:center"><input type="checkbox" [checked]="!!(g.id && e.grupos[g.id])" [disabled]="!g.id || guardandoEq()" [attr.aria-label]="e.nombre + ' en ' + g.nombre" (change)="alternarGrupo(e, g.id!, $any($event.target).checked)" /></td>
                      }
                      <td><button type="button" class="btn ghost danger" aria-label="Quitar" [disabled]="guardandoEq()" (click)="quitar(e)"><lucide-icon name="x" [size]="13" /></button></td>
                    </tr>
                    @if (ninguno(e)) {
                      <tr><td [attr.colspan]="4 + gp().length" class="xs" style="color:var(--amber);padding-top:0">↑ ¿Qué grupos atiende {{ e.nombre.split(' ')[0] }}? Marca al menos uno.</td></tr>
                    }
                  } @empty {
                    <tr><td colspan="9" class="xs muted">Agrega a las personas que atienden los correos.</td></tr>
                  }
                </tbody>
              </table>
            </div>
            @for (g of gpSinNadie(); track g.key) {
              <p class="note b-amber"><lucide-icon name="user-x" [size]="13" /> <span>Nadie atiende <b>{{ g.nombre }}</b>.</span></p>
            }
          </div>
        } @else {
          <p class="note b-sky"><lucide-icon name="info" [size]="13" /> <span>Ningún grupo asigna a personas: no hace falta equipo.</span></p>
        }
      }
    } @else {
      @if (!ge().length) {
        <p class="note b-sky"><lucide-icon name="info" [size]="13" /> <span>Ningún grupo que asigna a personas tiene procesos que extraigan datos: la búsqueda en bases no aplica. Continúa.</span></p>
      } @else if (grupoEsp(); as g) {
        <p class="sm">¿Algunos casos tienen un responsable fijo según una base de Excel?</p>
        <div class="g2">
          <button type="button" class="optcard" [attr.aria-pressed]="esp() === true" (click)="esp.set(true)"><span class="row sm b"><lucide-icon name="check" [size]="13" /> Sí, buscar en una base</span><span class="xs muted">Ej.: la base de pólizas define el analista de cada póliza.</span></button>
          <button type="button" class="optcard" [attr.aria-pressed]="esp() === false" (click)="esp.set(false)"><span class="row sm b"><lucide-icon name="skip-forward" [size]="13" /> No</span><span class="xs muted">Solo round-robin por grupo.</span></button>
        </div>
        @if (esp()) {
          @let cfg = cfgDe(g);
          <div class="pills" role="tablist">
            @for (x of ge(); track x.id) { <button type="button" role="tab" [attr.aria-selected]="x.id === g.id" (click)="espSel.set(x.id)">{{ x.nombre }}{{ conResp(x) ? ' ✓' : '' }}</button> }
          </div>
          <p class="xs muted">Grupo <b>{{ g.nombre }}</b> · datos disponibles: @for (f of camposG(); track f.clave) { <span class="key">{{ f.clave }}</span> } . Si ningún cruce encuentra el caso, sigue el round-robin del grupo. Para un grupo sin base, deja la búsqueda vacía.</p>
          @if (cfg.reglas.length > 1) {
            <div class="pills">
              @for (w of cfg.reglas; track $index; let i = $index) { <button type="button" [attr.aria-selected]="i === cfg.sel" (click)="ponerCfg(g.id, { ...cfg, sel: i })">Búsqueda {{ i + 1 }}{{ nombreW(w) ? ' · ' + nombreW(w) : '' }}</button> }
            </div>
          }
          <div class="sunk r-xl stack" style="padding:12px 14px;gap:10px">
            <alma-regla-editor [w]="cfg.reglas[cfg.sel]" (wChange)="ponerW(g.id, $event)" [campos]="camposG()" [equipo]="equipo()" [bases]="bases()" [buzonId]="buzon().id" idp="nb-rb" (baseChange)="actualizarBase($event)" />
          </div>
          <div class="row">
            <button type="button" class="btn outline sm" (click)="ponerCfg(g.id, { reglas: [...cfg.reglas, nueva()], sel: cfg.reglas.length })"><lucide-icon name="plus" [size]="13" /> Agregar otra base (si la primera no encuentra)</button>
            @if (cfg.reglas.length > 1 || colsW(cfg.reglas[cfg.sel]).length) {
              <button type="button" class="btn sm danger" (click)="quitarBusqueda(g.id, cfg)"><lucide-icon name="trash-2" [size]="13" /> Quitar esta búsqueda</button>
            }
          </div>
          @if (errEsp(); as e) { <p class="err">{{ e }}</p> }
        }
      }
    }
  `,
})
export class AsignacionWizardComponent {
  private readonly api = inject(BuzonApi);
  private readonly accesos = inject(AccesosApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  readonly categorias = input<Categoria[]>([]);
  readonly paso = input.required<3 | 4>();
  /** Emite cada cambio de `estado` (también se puede leer el computed). */
  readonly estadoChange = output<EstadoPasoAsignacion>();

  /** Elección «Sí/No» del paso 3 (→ mod_asignacion) y del paso 4 (→ mod_bases). */
  readonly asig = signal<boolean | null>(null);
  readonly esp = signal<boolean | null>(null);

  protected readonly nueva = nuevaBusqueda;
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly grupos = signal<Grupo[]>([]);
  protected readonly equipo = signal<Persona[]>([]);
  protected readonly bases = signal<Base[]>([]);
  protected readonly procesos = signal<Proceso[]>([]);
  protected readonly carpetas = signal<CarpetaPlana[]>([]);
  protected readonly st = signal<EstadoGrupos>({ modo: 'proceso', grupos: [] });
  protected readonly importando = signal(false);
  protected readonly guardandoEq = signal(false);
  protected readonly version = signal(0);
  protected readonly eqErr = signal<string[]>([]);
  protected correos = '';
  private readonly sincronizando = signal(false);
  private grupoSucio = false;

  // Paso 4
  protected readonly espSel = signal<string | null>(null);
  private readonly espCfg = signal<Record<string, CfgEsp>>({});
  private readonly guardandoEsp = signal(0);
  protected readonly errEsp = signal<string | null>(null);
  private temporizadores: Record<string, ReturnType<typeof setTimeout>> = {};

  protected readonly ets = computed(() => etiquetasDe(this.categorias(), this.procesos()));
  protected readonly gp = computed(() => this.st().grupos.filter((g) => g.destino === 'personas'));
  /** Grupos de personas ya guardados (los que el equipo puede referenciar). */
  protected readonly gpGuardados = computed(() => this.grupos().filter((g) => g.destino === 'personas'));
  protected readonly gpSinNadie = computed(() => this.gp().filter((g) => !g.id || !this.equipo().some((e) => e.grupos[g.id!])));
  /** Grupos que asignan a personas y extraen datos para cruzar (nbGruposEsp). */
  protected readonly ge = computed(() => this.gpGuardados().filter((g) => camposDeGrupo(g, this.categorias(), this.procesos()).length));
  protected readonly grupoEsp = computed(() => this.ge().find((g) => g.id === this.espSel()) ?? this.ge()[0] ?? null);
  protected readonly camposG = computed(() => {
    const g = this.grupoEsp();
    return g ? camposDeGrupo(g, this.categorias(), this.procesos()) : [];
  });

  /** Grupos con una búsqueda a medias (base elegida sin cruce o sin responsable). */
  private readonly espFaltan = computed(() =>
    this.ge()
      .filter((g) => this.cfgDe(g).reglas.some((w) => this.colsW(w).length && (!w.cruces.length || !w.resp)))
      .map((g) => g.nombre),
  );
  private readonly espAlguna = computed(() => this.ge().some((g) => this.cfgDe(g).reglas.some((w) => busquedaCompleta(w, this.bases()))));

  readonly estado = computed<EstadoPasoAsignacion>(() => {
    if (this.paso() === 3) {
      const a = this.asig();
      const grupos = this.st().grupos;
      const ok =
        a === false ||
        (a === true &&
          !this.sincronizando() &&
          !!grupos.length &&
          grupos.every((g) => !!g.id) &&
          !this.ets().some((e) => !grupos.some((g) => g.etiquetas.includes(e[0]))) &&
          this.gp().every((g) => this.equipo().some((e) => !!g.id && !!e.grupos[g.id])) &&
          grupos.every((g) => g.destino !== 'carpeta' || !!g.carpeta));
      const porque = ok
        ? ''
        : a === null
          ? 'Elige una opción'
          : this.sincronizando()
            ? 'Guardando los grupos…'
            : 'Cada etiqueta debe tener grupo, cada grupo de personas al menos una persona y cada grupo a carpeta su carpeta';
      return { puedeSeguir: ok, porque, omitido: a === null ? null : !a };
    }
    const e = this.esp();
    const sinGrupos = !this.ge().length;
    const ok = sinGrupos || e === false || (e === true && !this.guardandoEsp() && !this.espFaltan().length && this.espAlguna());
    const porque = ok
      ? ''
      : e === null
        ? 'Elige una opción'
        : this.espFaltan().length
          ? `Completa cruce y responsable en: ${this.espFaltan().join(', ')}`
          : this.guardandoEsp()
            ? 'Guardando las búsquedas…'
            : 'Configura al menos una base o elige «No»';
    return { puedeSeguir: ok, porque, omitido: e === null ? (sinGrupos ? true : null) : !e };
  });

  constructor() {
    queueMicrotask(() => void this.cargar());
    effect(() => this.estadoChange.emit(this.estado()));
  }

  private async cargar(): Promise<void> {
    const id = this.buzon().id;
    this.cargando.set(true);
    try {
      const [grupos, equipo, bases, procesos] = await Promise.all([
        this.api.listarGrupos(id),
        this.api.listarEquipo(id),
        this.api.listarBases(id),
        this.api.listarProcesos(id),
      ]);
      this.grupos.set(grupos);
      this.equipo.set(equipo);
      this.bases.set(bases);
      this.procesos.set(procesos);
      // Si el buzón ya tiene grupos (se retoma el asistente) se parte de ellos.
      if (grupos.length) this.st.set({ modo: 'custom', grupos: grupos.map(borradorDe) });
      const cfg: Record<string, CfgEsp> = {};
      grupos.filter((g) => g.reglas.length).forEach((g) => (cfg[g.id] = { reglas: g.reglas.map(busquedaDe), sel: 0 }));
      this.espCfg.set(cfg);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
    try {
      this.carpetas.set(aplanarCarpetas(await this.api.carpetas(id)));
    } catch {
      this.carpetas.set([]);
    }
  }

  /** Espera a que terminen los guardados pendientes (por si el shell quiere asegurarse antes de avanzar). */
  async guardar(): Promise<boolean> {
    Object.entries(this.temporizadores).forEach(([gid, t]) => {
      clearTimeout(t);
      delete this.temporizadores[gid];
      void this.guardarEsp(gid);
    });
    while (this.sincronizando() || this.guardandoEsp()) await new Promise((r) => setTimeout(r, 100));
    return this.estado().puedeSeguir;
  }

  // ── Paso 3: grupos ──
  protected elegirAsig(v: boolean): void {
    this.asig.set(v);
    if (v && !this.st().grupos.length) this.ponerSt({ modo: this.st().modo, grupos: gruposPorModo(this.st().modo, this.ets(), []) });
  }

  protected ponerSt(st: EstadoGrupos): void {
    this.st.set(st);
    void this.sincronizar();
  }

  protected ponerGrupo(key: string, cambios: Partial<Pick<GrupoBorrador, 'destino' | 'carpeta'>>): void {
    const destino = cambios.destino as DestinoGrupo | undefined;
    this.ponerSt({
      ...this.st(),
      grupos: this.st().grupos.map((g) => (g.key === key ? { ...g, ...cambios, carpeta: (destino ?? g.destino) === 'carpeta' ? (cambios.carpeta ?? g.carpeta) : null } : g)),
    });
  }

  /** Lleva el borrador al backend; si cambia mientras guarda, vuelve a guardar al terminar. */
  private async sincronizar(): Promise<void> {
    if (this.sincronizando()) {
      this.grupoSucio = true;
      return;
    }
    this.sincronizando.set(true);
    try {
      do {
        this.grupoSucio = false;
        const r = await sincronizarGrupos(this.api, this.buzon().id, this.grupos(), this.st().grupos);
        this.grupos.set(r.grupos);
        // Los grupos creados reciben su id (por llave), aunque el borrador haya cambiado mientras tanto.
        const ids = new Map(r.borrador.map((b) => [b.key, b.id]));
        this.st.update((s) => ({ ...s, grupos: s.grupos.map((g) => (g.id ? g : { ...g, id: ids.get(g.key) ?? null })) }));
      } while (this.grupoSucio);
      this.equipo.set(await this.api.listarEquipo(this.buzon().id));
    } catch (e) {
      this.toast.error('No se pudieron guardar los grupos', e instanceof Error ? e.message : String(e));
      this.grupos.set(await this.api.listarGrupos(this.buzon().id).catch(() => this.grupos()));
    } finally {
      this.sincronizando.set(false);
    }
  }

  // ── Paso 3: equipo ──
  protected ninguno(e: Persona): boolean {
    return !this.gp().some((g) => g.id && e.grupos[g.id]);
  }

  private todos(): PersonaIn[] {
    const eq = this.equipo();
    return eq.map((p) => aPersonaIn(p, eq));
  }

  private async guardarEquipo(personas: PersonaIn[], ok?: string): Promise<boolean> {
    this.guardandoEq.set(true);
    try {
      this.equipo.set(await this.api.guardarEquipo(this.buzon().id, personas));
      if (ok) this.toast.show(ok);
      return true;
    } catch (e) {
      this.toast.error('No se pudo guardar el equipo', e instanceof Error ? e.message : String(e));
      this.version.update((v) => v + 1);
      return false;
    } finally {
      this.guardandoEq.set(false);
    }
  }

  protected async agregar(): Promise<void> {
    const r = parseCorreos(this.correos, this.equipo().map((p) => p.correo));
    this.eqErr.set(r.err);
    if (!r.ok.length) return;
    const nombres = await nombresDirectorio(this.accesos, r.ok);
    if (await this.guardarEquipo([...this.todos(), ...r.ok.map((c) => personaNueva(c, nombres[c]))])) this.correos = '';
  }

  protected cambiarCarpeta(p: Persona, carpeta: string | null): void {
    if ((p.carpeta ?? null) === carpeta) return;
    void this.guardarEquipo(this.todos().map((x) => (x.correo === p.correo ? { ...x, carpeta } : x)));
  }

  protected alternarGrupo(p: Persona, gid: string, marcado: boolean): void {
    void this.guardarEquipo(
      this.todos().map((x) => {
        if (x.correo !== p.correo) return x;
        const grupos = { ...x.grupos };
        if (marcado) grupos[gid] = { activa: true, respaldo: null };
        else delete grupos[gid];
        return { ...x, grupos };
      }),
    );
  }

  protected quitar(p: Persona): void {
    void this.guardarEquipo(this.todos().filter((x) => x.correo !== p.correo));
  }

  // ── Paso 4: búsquedas en bases ──
  cfgDe(g: Grupo): CfgEsp {
    return this.espCfg()[g.id] ?? { reglas: [nuevaBusqueda()], sel: 0 };
  }

  protected colsW(w: BusquedaW): string[] {
    return columnasDe(w, this.bases());
  }

  protected nombreW(w: BusquedaW): string {
    return w.archivo?.name ?? this.bases().find((b) => b.id === w.baseId)?.nombre ?? '';
  }

  protected conResp(g: Grupo): boolean {
    return this.cfgDe(g).reglas.some((w) => !!w.resp);
  }

  protected actualizarBase(b: Base): void {
    this.bases.update((l) => (l.some((x) => x.id === b.id) ? l.map((x) => (x.id === b.id ? b : x)) : [...l, b]));
  }

  protected ponerCfg(gid: string, cfg: CfgEsp): void {
    this.espCfg.update((m) => ({ ...m, [gid]: cfg }));
    this.programar(gid);
  }

  protected ponerW(gid: string, w: BusquedaW): void {
    const g = this.ge().find((x) => x.id === gid);
    if (!g) return;
    const cfg = this.cfgDe(g);
    this.ponerCfg(gid, { ...cfg, reglas: cfg.reglas.map((x, i) => (i === cfg.sel ? w : x)) });
  }

  protected quitarBusqueda(gid: string, cfg: CfgEsp): void {
    const reglas = cfg.reglas.filter((_, i) => i !== cfg.sel);
    this.ponerCfg(gid, { reglas: reglas.length ? reglas : [nuevaBusqueda()], sel: 0 });
  }

  /** Guarda las búsquedas completas del grupo poco después del último cambio. */
  private programar(gid: string): void {
    clearTimeout(this.temporizadores[gid]);
    this.temporizadores[gid] = setTimeout(() => {
      delete this.temporizadores[gid];
      void this.guardarEsp(gid);
    }, 700);
  }

  private async guardarEsp(gid: string): Promise<void> {
    const g = this.grupos().find((x) => x.id === gid);
    if (!g) return;
    this.guardandoEsp.update((n) => n + 1);
    this.errEsp.set(null);
    try {
      const cfg = this.cfgDe(g);
      const reglas = [];
      const nuevas: BusquedaW[] = [];
      for (const w0 of cfg.reglas) {
        if (!busquedaCompleta(w0, this.bases())) {
          nuevas.push(w0);
          continue;
        }
        const { w, base } = await materializar(this.api, this.buzon().id, w0);
        if (base) this.actualizarBase(base);
        nuevas.push(w);
        reglas.push({ base_id: w.baseId!, cruces: w.cruces.map((c) => ({ ...c })), col_responsable: w.resp, col_respaldo: w.bk || null, activa: w.activa });
      }
      // Las búsquedas con archivo subido ya son bases: se guarda su id para no volver a crearlas.
      this.espCfg.update((m) => {
        const actual = m[gid] ?? cfg;
        return { ...m, [gid]: { ...actual, reglas: actual.reglas.map((x, i) => (cfg.reglas[i] === x ? nuevas[i] : x)) } };
      });
      const cuerpo = aGrupoIn(g, { reglas });
      if (JSON.stringify(cuerpo) !== JSON.stringify(aGrupoIn(g))) {
        const act = await this.api.actualizarGrupo(gid, cuerpo);
        this.grupos.update((l) => l.map((x) => (x.id === gid ? act : x)));
      }
    } catch (e) {
      this.errEsp.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoEsp.update((n) => n - 1);
    }
  }
}
