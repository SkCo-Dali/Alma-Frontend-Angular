// Pestaña «Asignación» de la configuración de un buzón (2.0), réplica del prototipo
// validado (asigTab). Sub-secciones:
//  · Grupos y destino: cada grupo reúne etiquetas y decide qué pasa con sus correos
//    (asignar a personas, enviar a una carpeta o solo categorizar) y qué pasa si no
//    hay nadie activo. «Editar grupos» abre el formulario de grupos (mGrupos).
//  · Equipo: personas, disponibilidad y membresía por grupo (equipo-tab).
//  · Reglas y bases: cadena de búsquedas en bases por grupo (reglas-bases-tab). Solo
//    si el buzón tiene activo el módulo de búsqueda en bases (mod_bases).
//  · Probar: recorrido de la asignación de un correo con unos datos de prueba.

import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { Base, Buzon, BuzonApi, Categoria, DestinoGrupo, Grupo, PasoTraza, Persona, Proceso, SinActivosModo } from './buzon.api';
import { aGrupoIn } from './buzon-asignacion';
import { EstadoGrupos, activosEn, borradorDe, etiquetasDe, sincronizarGrupos, sinActivosTxt } from './asignacion-ui';
import { CarpetaPlana, CarpetaSelectComponent, aplanarCarpetas } from './carpeta-select.component';
import { EquipoTabComponent } from './equipo-tab.component';
import { GruposFormComponent } from './grupos-form.component';
import { ReglasBasesTabComponent } from './reglas-bases-tab.component';
import { TrazaAsignacionComponent } from './traza-asignacion.component';

type Sub = 'grupos' | 'equipo' | 'reglas' | 'probar';

const DESTINO_TXT: Record<DestinoGrupo, string> = { personas: 'Asignar a personas', carpeta: 'Enviar a carpeta', categorizar: 'Solo categorizar' };
const DESTINO_BADGE: Record<DestinoGrupo, string> = { personas: 'b-emerald', carpeta: 'b-sky', categorizar: 'b-slate' };

/** Cambios de un grupo que aún no se pueden guardar (p. ej. «a carpeta» sin carpeta). */
type Pendiente = Partial<Pick<Grupo, 'destino' | 'carpeta' | 'sin_activos_modo' | 'sin_activos_carpeta' | 'sin_activos_persona_id'>>;

@Component({
  selector: 'alma-asignacion-tab',
  imports: [LucideAngularModule, AlmaLoaderComponent, CarpetaSelectComponent, EquipoTabComponent, GruposFormComponent, ReglasBasesTabComponent, TrazaAsignacionComponent],
  styleUrls: ['./buzon-proto.css'],
  styles: [`:host { display: grid; gap: 16px; min-width: 0; }`],
  template: `
    <div class="pills glass r-xl" style="padding:4px;justify-self:start" role="tablist">
      @for (s of subs(); track s[0]) {
        <button type="button" role="tab" [attr.aria-selected]="sub() === s[0]" (click)="sub.set(s[0])"><lucide-icon [name]="s[1]" [size]="13" /> {{ s[2] }}</button>
      }
    </div>

    @if (cargando()) {
      <div style="display:flex;justify-content:center;padding:48px 0"><alma-loader [size]="56" label="Cargando asignación…" /></div>
    } @else if (error(); as e) {
      <div class="glass r-2xl stack" style="padding:16px">
        <p class="note b-rose"><lucide-icon name="alert-triangle" [size]="13" /> <span>No se pudo cargar la asignación. {{ e }}</span></p>
        <button type="button" class="btn outline sm" style="justify-self:start" (click)="cargar()"><lucide-icon name="refresh-cw" [size]="13" /> Reintentar</button>
      </div>
    } @else {
      @if (avisoCarpetas(); as a) { <p class="note b-amber"><lucide-icon name="folder-x" [size]="13" /> <span>{{ a }}</span></p> }
      @switch (sub()) {
        @case ('grupos') {
          <div class="row between">
            <p class="sm muted" style="max-width:720px">Cada grupo reúne etiquetas y decide qué pasa con sus correos: asignarlos a personas, enviarlos a una carpeta o solo categorizarlos.</p>
            @if (puede()) { <button type="button" class="btn primary sm" (click)="editarGrupos()"><lucide-icon name="layers" [size]="13" /> Editar grupos</button> }
          </div>
          @if (sinGrupo().length) {
            <p class="note b-amber"><lucide-icon name="alert-triangle" [size]="13" /> <span>Etiquetas sin grupo: <b>{{ sinGrupo().join(', ') }}</b>. Sus correos quedarían sin asignar.</span></p>
          }
          <div class="g2">
            @for (g0 of grupos(); track g0.id) {
              @let g = vista(g0);
              @let pers = activos(g);
              <article class="glass r-2xl stack" style="padding:16px">
                <div class="row between">
                  <p class="sm bb">{{ g.nombre }}@if (!g.activo) { <span class="badge b-slate">Inactivo</span> }</p>
                  <span class="badge" [class]="'badge ' + destinoBadge[g.destino]">{{ destinoTxt[g.destino] }}</span>
                </div>
                <div class="row" style="gap:6px">
                  @for (e of g.etiquetas; track e) { <span class="chipo"><lucide-icon name="tag" [size]="13" /> {{ e }}</span> }
                </div>
                <div class="g2">
                  <div class="fld">
                    <label class="label" [attr.for]="'gd-' + g.id">Destino de los correos</label>
                    <select class="input sm" [id]="'gd-' + g.id" [disabled]="!puede() || guardando() === g.id" (change)="cambiar(g0, { destino: $any($event.target).value })">
                      <option value="personas" [selected]="g.destino === 'personas'">Asignar a personas</option>
                      <option value="carpeta" [selected]="g.destino === 'carpeta'">Enviar a una carpeta</option>
                      <option value="categorizar" [selected]="g.destino === 'categorizar'">Solo categorizar</option>
                    </select>
                  </div>
                  @if (g.destino === 'carpeta') {
                    <div class="fld">
                      <span class="label">Carpeta del buzón</span>
                      @if (puede()) {
                        <alma-carpeta-select [carpetas]="carpetas()" [valor]="g.carpeta" (valorChange)="cambiar(g0, { carpeta: $event })" [disabled]="guardando() === g.id" />
                      } @else { <p class="sm">{{ g.carpeta || '—' }}</p> }
                    </div>
                  } @else if (g.destino === 'personas') {
                    <div class="fld"><span class="label">Equipo</span><p class="sm">{{ pers }} persona{{ pers === 1 ? '' : 's' }} activa{{ pers === 1 ? '' : 's' }} · {{ busquedas(g) }} búsqueda(s) en bases</p></div>
                  } @else {
                    <div class="fld"><span class="label">Resultado</span><p class="sm">Se etiqueta y se queda en la carpeta vigilada</p></div>
                  }
                </div>
                @if (g.destino === 'personas') {
                  <div class="g2">
                    <div class="fld">
                      <label class="label" [attr.for]="'gsa-' + g.id">Si no hay nadie activo en el grupo</label>
                      <select class="input sm" [id]="'gsa-' + g.id" [disabled]="!puede() || guardando() === g.id" (change)="cambiar(g0, { sin_activos_modo: $any($event.target).value, sin_activos_carpeta: null, sin_activos_persona_id: null })">
                        <option value="cola" [selected]="g.sin_activos_modo === 'cola'">Dejar en «Sin asignar» y alertar</option>
                        <option value="carpeta" [selected]="g.sin_activos_modo === 'carpeta'">Enviar a una carpeta</option>
                        <option value="persona" [selected]="g.sin_activos_modo === 'persona'">Asignar a una persona de respaldo</option>
                      </select>
                    </div>
                    @if (g.sin_activos_modo === 'carpeta') {
                      <div class="fld"><span class="label">Carpeta de pausa</span><alma-carpeta-select [carpetas]="carpetas()" [valor]="g.sin_activos_carpeta" (valorChange)="cambiar(g0, { sin_activos_carpeta: $event })" [disabled]="!puede() || guardando() === g.id" /></div>
                    } @else if (g.sin_activos_modo === 'persona') {
                      <div class="fld">
                        <label class="label" [attr.for]="'gsp-' + g.id">Persona de respaldo</label>
                        <select class="input sm" [id]="'gsp-' + g.id" [disabled]="!puede() || guardando() === g.id" (change)="cambiar(g0, { sin_activos_persona_id: $any($event.target).value || null })">
                          <option value="">Elige la persona…</option>
                          @for (p of equipo(); track p.id) { <option [value]="p.id" [selected]="g.sin_activos_persona_id === p.id">{{ p.nombre }}</option> }
                        </select>
                      </div>
                    } @else { <span></span> }
                  </div>
                }
                @if (g.destino === 'carpeta' && !g.carpeta) {
                  <p class="note b-amber"><lucide-icon name="folder-x" [size]="13" /> <span>Elige la carpeta del buzón a la que se envían estos correos.</span></p>
                }
                @if (g.destino === 'personas' && !pers) {
                  <p class="note b-amber"><lucide-icon name="user-x" [size]="13" /> <span>Nadie activo atiende este grupo: sus correos {{ sinActivos(g) }}. <button type="button" class="linkbtn" (click)="sub.set('equipo')">Ir a Equipo</button></span></p>
                }
              </article>
            } @empty {
              <div class="glass r-2xl" style="padding:16px"><p class="sm muted">Aún no hay grupos. Usa «Editar grupos» para repartir las etiquetas.</p></div>
            }
          </div>
        }

        @case ('equipo') {
          <alma-equipo-tab [buzon]="buzon()" [grupos]="grupos()" [carpetas]="carpetas()" [(equipo)]="equipo" />
        }

        @case ('reglas') {
          <alma-reglas-bases-tab [buzon]="buzon()" [(grupos)]="grupos" [(bases)]="bases" [equipo]="equipo()" [procesos]="procesos()" [categorias]="categorias()" [(gSel)]="gSel" />
        }

        @case ('probar') {
          @if (!grupos().length) {
            <div class="glass r-2xl" style="padding:16px"><p class="sm muted">Configura los grupos primero.</p></div>
          } @else if (grupoProbar(); as g) {
            <div class="pills glass r-xl" style="padding:4px;justify-self:start" role="tablist">
              @for (x of grupos(); track x.id) { <button type="button" role="tab" [attr.aria-selected]="x.id === g.id" (click)="gSel.set(x.id)">{{ x.nombre }}</button> }
            </div>
            <div class="g2" style="align-items:start">
              <div class="glass r-2xl stack" style="padding:16px">
                <h2 class="sm b">Datos del correo de prueba</h2>
                @if (camposProbar().length) {
                  <div class="g2">
                    @for (c of camposProbar(); track c) {
                      <div class="fld"><label class="label mono" [attr.for]="'tv-' + c">{{ c }}</label><input class="input" [id]="'tv-' + c" [value]="tv()[c] || ''" (change)="ponerTv(c, $any($event.target).value)" /></div>
                    }
                  </div>
                } @else {
                  <p class="xs muted">Este grupo no usa datos para asignar.</p>
                }
                <label class="row xs" for="tv-hilo"><input type="checkbox" id="tv-hilo" [checked]="tvHilo()" (change)="tvHilo.set($any($event.target).checked)" /> Es una respuesta en un hilo existente</label>
                <p class="xxs muted">Cambia una membresía en Equipo o desactiva una regla y vuelve a probar.</p>
              </div>
              <div class="glass r-2xl stack" style="padding:16px">
                <h2 class="sm b">Recorrido</h2>
                @if (errorProbar(); as e) { <p class="err">{{ e }}</p> }
                <alma-traza-asignacion [traza]="recorrido()" [vacio]="probando() ? 'Probando…' : 'Sin recorrido de asignación.'" />
              </div>
            </div>
          }
        }
      }
    }

    <!-- Editar grupos (mGrupos) -->
    @if (stGrupos(); as st) {
      <div class="scrim" (click)="cerrarGrupos()">
        <div class="modal solid xl" role="dialog" aria-modal="true" aria-label="Editar grupos" (click)="$event.stopPropagation()">
          <div class="row between">
            <div><h2 class="sm b">Editar grupos</h2><p class="xs muted">Agrupa las etiquetas como trabaja tu equipo. Las membresías del equipo se conservan en los grupos que mantienen su id.</p></div>
            <button type="button" class="btn ghost" aria-label="Cerrar" (click)="cerrarGrupos()"><lucide-icon name="x" [size]="16" /></button>
          </div>
          <alma-grupos-form [ets]="ets()" [st]="st" (stChange)="stGrupos.set($event)" idp="gm" />
          @if (errGrupos(); as e) { <p class="err">{{ e }}</p> }
          <div class="row" style="justify-content:flex-end">
            <button type="button" class="btn outline" (click)="cerrarGrupos()">Cancelar</button>
            <button type="button" class="btn primary" [disabled]="!!guardando()" (click)="guardarGrupos(st)"><lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="16" [class.animate-spin]="!!guardando()" /> Guardar grupos</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AsignacionTabComponent {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  readonly categorias = input<Categoria[]>([]);

  protected readonly destinoTxt = DESTINO_TXT;
  protected readonly destinoBadge = DESTINO_BADGE;
  protected readonly sub = signal<Sub>('grupos');
  /** Módulo de búsqueda en bases del buzón (sin el campo, se asume activo). */
  private readonly conBases = computed(() => this.buzon().mod_bases !== false);
  protected readonly subs = computed<[Sub, string, string][]>(() => [
    ['grupos', 'layers', 'Grupos y destino'],
    ['equipo', 'users', 'Equipo'],
    ...(this.conBases() ? [['reglas', 'database', 'Reglas y bases'] as [Sub, string, string]] : []),
    ['probar', 'flask-conical', 'Probar'],
  ]);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly grupos = signal<Grupo[]>([]);
  protected readonly equipo = signal<Persona[]>([]);
  protected readonly bases = signal<Base[]>([]);
  protected readonly procesos = signal<Proceso[]>([]);
  protected readonly carpetas = signal<CarpetaPlana[]>([]);
  protected readonly avisoCarpetas = signal<string | null>(null);
  /** Grupo que se está guardando (o 'todos' al guardar el formulario de grupos). */
  protected readonly guardando = signal<string | null>(null);
  private readonly pendientes = signal<Record<string, Pendiente>>({});
  /** Grupo elegido en «Reglas y bases» y «Probar». */
  protected readonly gSel = signal<string | null>(null);

  protected readonly puede = computed(() => this.buzon().puede_administrar);
  protected readonly ets = computed(() => etiquetasDe(this.categorias(), this.procesos()));
  protected readonly sinGrupo = computed(() => this.ets().filter((e) => !this.grupos().some((g) => g.etiquetas.includes(e[0]))).map((e) => e[0]));

  // mGrupos
  protected readonly stGrupos = signal<EstadoGrupos | null>(null);
  protected readonly errGrupos = signal<string | null>(null);

  // Probar
  protected readonly tv = signal<Record<string, string>>({});
  protected readonly tvHilo = signal(false);
  protected readonly probando = signal(false);
  protected readonly errorProbar = signal<string | null>(null);
  private readonly trazaApi = signal<PasoTraza[]>([]);
  protected readonly grupoProbar = computed(() => this.grupos().find((g) => g.id === this.gSel()) ?? this.grupos()[0] ?? null);
  protected readonly camposProbar = computed(() => {
    const out: string[] = [];
    this.grupoProbar()?.reglas.forEach((r) => r.activa && r.cruces.forEach((c) => !out.includes(c.campo) && out.push(c.campo)));
    return out;
  });
  /** Prototipo simularG: carpeta, solo categorizar y respuestas en hilo se resuelven sin buscar. */
  private readonly recorridoLocal = computed<PasoTraza[] | null>(() => {
    const g = this.grupoProbar();
    if (!g) return null;
    if (g.destino === 'carpeta') return [{ estado: 'ok', titulo: `Destino: carpeta «${g.carpeta || '—'}»`, detalle: 'Se etiqueta y se mueve, sin asignar a personas' }];
    if (g.destino === 'categorizar') return [{ estado: 'ok', titulo: 'Destino: solo categorizar', detalle: 'Se etiqueta y se queda en la carpeta vigilada' }];
    if (this.tvHilo()) return [{ estado: 'ok', titulo: 'Continuidad del hilo', detalle: 'Respuesta vinculada a un caso existente → hereda la persona, sin reasignar' }];
    if (!g.etiquetas.length) return [{ estado: 'bad', titulo: 'Sin etiquetas', detalle: 'El grupo no tiene etiquetas: ningún correo llega a él' }];
    return null;
  });
  protected readonly recorrido = computed(() => this.recorridoLocal() ?? this.trazaApi());

  constructor() {
    queueMicrotask(() => void this.cargar());
    // Sin el módulo de bases, «Reglas y bases» no se muestra.
    effect(() => {
      if (!this.conBases() && this.sub() === 'reglas') this.sub.set('grupos');
    });
    // «Probar»: vuelve a correr la asignación al cambiar el grupo, los datos, el equipo o las reglas.
    let turno = 0;
    effect(() => {
      if (this.sub() !== 'probar' || this.recorridoLocal()) return;
      const g = this.grupoProbar();
      const datos = Object.fromEntries(Object.entries(this.tv()).filter(([k, v]) => v.trim() && this.camposProbar().includes(k)));
      this.equipo();
      if (!g) return;
      const t = ++turno;
      this.probando.set(true);
      this.errorProbar.set(null);
      void this.api
        .probarAsignacion(this.buzon().id, g.etiquetas[0], datos)
        .then((r) => {
          if (t !== turno) return;
          const hilo = r.traza.some((p) => /hilo/i.test(p.titulo));
          this.trazaApi.set(hilo ? r.traza : [{ estado: 'skip', titulo: 'Continuidad del hilo', detalle: 'Correo inicial: no aplica' }, ...r.traza]);
        })
        .catch((e) => t === turno && this.errorProbar.set(e instanceof Error ? e.message : String(e)))
        .finally(() => t === turno && this.probando.set(false));
    });
  }

  async cargar(): Promise<void> {
    const id = this.buzon().id;
    this.cargando.set(true);
    this.error.set(null);
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
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
    // Las carpetas vienen de Outlook: si el buzón no está conectado, se avisa sin bloquear.
    try {
      this.carpetas.set(aplanarCarpetas(await this.api.carpetas(id)));
      this.avisoCarpetas.set(null);
    } catch (e) {
      this.carpetas.set([]);
      this.avisoCarpetas.set(`No se pudieron leer las carpetas del buzón (${e instanceof Error ? e.message : String(e)}). Conéctalo para elegir carpetas.`);
    }
  }

  protected vista(g: Grupo): Grupo {
    return { ...g, ...this.pendientes()[g.id] };
  }

  protected activos(g: Grupo): number {
    return activosEn(g, this.equipo());
  }

  protected busquedas(g: Grupo): number {
    return g.reglas.filter((r) => r.activa).length;
  }

  protected sinActivos(g: Grupo): string {
    return sinActivosTxt(g, this.equipo());
  }

  // ── Grupos y destino: se guarda al cambiar (si el cambio está completo) ──
  protected async cambiar(g: Grupo, cambios: Pendiente): Promise<void> {
    const v: Grupo = { ...this.vista(g), ...cambios };
    if (v.destino !== 'carpeta') v.carpeta = null;
    const sa = v.sin_activos_modo as SinActivosModo;
    const completo =
      (v.destino !== 'carpeta' || !!v.carpeta) &&
      (v.destino !== 'personas' || sa === 'cola' || (sa === 'carpeta' && !!v.sin_activos_carpeta) || (sa === 'persona' && !!v.sin_activos_persona_id));
    const aviso =
      'destino' in cambios
        ? `${g.nombre}: ${{ personas: 'se asigna a personas', carpeta: v.carpeta ? `se envía a la carpeta «${v.carpeta}»` : 'elige la carpeta del buzón', categorizar: 'solo se categoriza' }[v.destino]}`
        : 'carpeta' in cambios
          ? `${g.nombre}: ${v.carpeta ? `se envía a la carpeta «${v.carpeta}»` : 'elige una carpeta'}`
          : `${g.nombre}: si no hay nadie activo, ${sinActivosTxt(v, this.equipo())}`;
    const pend: Pendiente = {
      destino: v.destino,
      carpeta: v.carpeta,
      sin_activos_modo: v.sin_activos_modo,
      sin_activos_carpeta: v.sin_activos_carpeta,
      sin_activos_persona_id: v.sin_activos_persona_id,
    };
    if (!completo) {
      this.pendientes.update((m) => ({ ...m, [g.id]: pend }));
      this.toast.show(aviso);
      return;
    }
    this.guardando.set(g.id);
    try {
      const personas = v.destino === 'personas';
      const actualizado = await this.api.actualizarGrupo(
        g.id,
        aGrupoIn(g, {
          ...pend,
          sin_activos_modo: personas ? sa : 'cola',
          sin_activos_carpeta: personas && sa === 'carpeta' ? v.sin_activos_carpeta : null,
          sin_activos_persona_id: personas && sa === 'persona' ? v.sin_activos_persona_id : null,
        }),
      );
      this.grupos.update((l) => l.map((x) => (x.id === g.id ? actualizado : x)));
      this.pendientes.update(({ [g.id]: _x, ...m }) => m);
      this.toast.show(aviso);
    } catch (e) {
      this.toast.error('No se pudo guardar el grupo', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(null);
    }
  }

  // ── mGrupos ──
  protected editarGrupos(): void {
    this.errGrupos.set(null);
    this.stGrupos.set({ modo: 'custom', grupos: this.grupos().map(borradorDe) });
  }

  protected cerrarGrupos(): void {
    if (!this.guardando()) this.stGrupos.set(null);
  }

  protected async guardarGrupos(st: EstadoGrupos): Promise<void> {
    this.guardando.set('todos');
    this.errGrupos.set(null);
    try {
      const r = await sincronizarGrupos(this.api, this.buzon().id, this.grupos(), st.grupos);
      this.grupos.set(r.grupos);
      this.pendientes.set({});
      this.equipo.set(await this.api.listarEquipo(this.buzon().id));
      this.stGrupos.set(null);
      this.toast.show(`Grupos guardados: ${r.grupos.length}`);
    } catch (e) {
      this.errGrupos.set(e instanceof Error ? e.message : String(e));
      this.grupos.set(await this.api.listarGrupos(this.buzon().id).catch(() => this.grupos()));
    } finally {
      this.guardando.set(null);
    }
  }

  // ── Probar ──
  protected ponerTv(campo: string, valor: string): void {
    this.tv.update((t) => ({ ...t, [campo]: valor }));
  }
}
