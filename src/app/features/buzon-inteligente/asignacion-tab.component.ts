// Pestaña «Asignación» de la configuración de un buzón (2.0). Sub-pestañas:
//  · Grupos: reúnen etiquetas y deciden el destino (personas, carpeta o solo
//    categorizar) y qué pasa si no hay nadie activo.
//  · Equipo: personas, disponibilidad y membresía por grupo (equipo-tab).
//  · Reglas y bases: búsquedas del responsable en bases (reglas-bases-tab).
//  · Probar: simula a quién iría un correo con una etiqueta y unos datos.

import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { AlmaSwitchComponent } from '../../shared/components/alma-switch.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import {
  Base,
  Buzon,
  BuzonApi,
  CampoProceso,
  Categoria,
  DestinoGrupo,
  Grupo,
  GrupoIn,
  Persona,
  Proceso,
  ResultadoAsignacion,
  SinActivosModo,
} from './buzon.api';
import { aGrupoIn } from './buzon-asignacion';
import { CarpetaPlana, CarpetaSelectComponent, aplanarCarpetas } from './carpeta-select.component';
import { EquipoTabComponent } from './equipo-tab.component';
import { ReglasBasesTabComponent } from './reglas-bases-tab.component';
import { TrazaAsignacionComponent } from './traza-asignacion.component';

type Sub = 'grupos' | 'equipo' | 'reglas' | 'probar';

interface GrupoForm {
  nombre: string;
  etiquetas: string[];
  destino: DestinoGrupo;
  carpeta: string | null;
  sin_activos_modo: SinActivosModo;
  sin_activos_carpeta: string | null;
  sin_activos_persona_id: string | null;
  activo: boolean;
}

const DESTINOS: { id: DestinoGrupo; nombre: string; ayuda: string; clase: string }[] = [
  { id: 'personas', nombre: 'Asignar a personas', ayuda: 'Busca al responsable en las bases o reparte entre el equipo activo.', clase: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { id: 'carpeta', nombre: 'Enviar a una carpeta', ayuda: 'Se etiqueta y se mueve a una carpeta del buzón, sin asignar a nadie.', clase: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  { id: 'categorizar', nombre: 'Solo categorizar', ayuda: 'Se etiqueta y se queda en la carpeta vigilada.', clase: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300' },
];

@Component({
  selector: 'alma-asignacion-tab',
  imports: [
    FormsModule,
    LucideAngularModule,
    AlmaLoaderComponent,
    AlmaSwitchComponent,
    TooltipDirective,
    CarpetaSelectComponent,
    EquipoTabComponent,
    ReglasBasesTabComponent,
    TrazaAsignacionComponent,
  ],
  template: `
    <div class="glass inline-flex flex-wrap gap-1 rounded-xl p-1" role="tablist" aria-label="Asignación">
      @for (s of subs; track s.id) {
        <button type="button" role="tab" class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors" [attr.aria-selected]="sub() === s.id" [class]="sub() === s.id ? 'bg-primary text-primary-foreground shadow-[var(--shadow-sm)]' : 'text-muted-foreground hover:text-foreground'" (click)="sub.set(s.id)">
          <lucide-icon [name]="s.icon" [size]="15" /> {{ s.nombre }}
        </button>
      }
    </div>

    @if (cargando()) {
      <div class="flex justify-center py-12"><alma-loader [size]="56" label="Cargando asignación…" /></div>
    } @else if (error(); as e) {
      <div class="glass flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
        <lucide-icon name="alert-triangle" [size]="24" class="text-rose-500" />
        <p class="text-sm text-foreground">No se pudo cargar la asignación.</p>
        <p class="text-xs text-muted-foreground">{{ e }}</p>
        <button type="button" class="alma-btn alma-btn-outline mt-1" (click)="cargar()"><lucide-icon name="refresh-cw" [size]="15" /> Reintentar</button>
      </div>
    } @else {
      @if (avisoCarpetas(); as a) {
        <p class="flex items-start gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"><lucide-icon name="folder-open" [size]="13" class="mt-0.5 shrink-0" /> {{ a }}</p>
      }
      @switch (sub()) {
        <!-- ── GRUPOS ── -->
        @case ('grupos') {
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="max-w-3xl text-sm text-muted-foreground">Cada grupo reúne etiquetas y decide qué pasa con sus correos: asignarlos a personas, enviarlos a una carpeta o solo categorizarlos.</p>
            <button type="button" class="alma-btn alma-btn-primary rounded-xl" (click)="nuevoGrupo()"><lucide-icon name="plus" [size]="16" /> Nuevo grupo</button>
          </div>
          @if (etiquetasSinGrupo().length) {
            <p class="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <lucide-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0" />
              <span>Etiquetas sin grupo: <b>{{ etiquetasSinGrupo().join(', ') }}</b>. Sus correos quedan sin asignar.</span>
            </p>
          }
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            @for (g of grupos(); track g.id) {
              <article class="glass flex flex-col gap-3 rounded-2xl p-4 shadow-[var(--shadow-sm)]" [class.opacity-60]="!g.activo">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <h3 class="text-sm font-bold text-foreground">{{ g.nombre }}</h3>
                    @if (!g.activo) { <span class="alma-badge mt-1 bg-zinc-500/15 text-zinc-600 dark:text-zinc-300">Inactivo</span> }
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <span [class]="'alma-badge ' + destino(g.destino).clase">{{ destino(g.destino).nombre }}</span>
                    <button type="button" class="alma-btn alma-btn-ghost" almaTooltip="Editar" [attr.aria-label]="'Editar ' + g.nombre" (click)="editarGrupo(g)"><lucide-icon name="pencil" [size]="15" /></button>
                    <button type="button" class="alma-btn alma-btn-ghost text-destructive" almaTooltip="Eliminar" [attr.aria-label]="'Eliminar ' + g.nombre" (click)="eliminarGrupo(g)"><lucide-icon name="trash-2" [size]="15" /></button>
                  </div>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  @for (e of g.etiquetas; track e) {
                    <span class="inline-flex items-center gap-1 rounded-full border border-border/60 bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] text-foreground"><lucide-icon name="tag" [size]="11" /> {{ e }}</span>
                  } @empty {
                    <span class="text-[11px] italic text-muted-foreground">Sin etiquetas: no recibe correos.</span>
                  }
                </div>
                <p class="text-xs text-muted-foreground">
                  @switch (g.destino) {
                    @case ('personas') { {{ activosEn(g) }} {{ activosEn(g) === 1 ? 'persona activa' : 'personas activas' }} · {{ busquedasActivas(g) }} búsqueda(s) en bases · si no hay nadie activo, {{ sinActivosTxt(g) }}. }
                    @case ('carpeta') { Se etiqueta y se mueve a la carpeta <b class="font-medium text-foreground">«{{ g.carpeta || '—' }}»</b>. }
                    @default { Se etiqueta y se queda en la carpeta vigilada. }
                  }
                </p>
                @if (g.destino === 'carpeta' && !g.carpeta) {
                  <p class="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200"><lucide-icon name="folder-open" [size]="13" class="mt-0.5 shrink-0" /> Elige la carpeta del buzón a la que se envían estos correos.</p>
                }
                @if (g.destino === 'personas' && g.activo && !activosEn(g)) {
                  <p class="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200">
                    <lucide-icon name="user-x" [size]="13" class="mt-0.5 shrink-0" />
                    <span>Nadie activo atiende este grupo: sus correos {{ sinActivosTxt(g) }}. <button type="button" class="font-semibold underline" (click)="sub.set('equipo')">Ir a Equipo</button></span>
                  </p>
                }
              </article>
            } @empty {
              <div class="glass col-span-full flex flex-col items-center gap-3 rounded-3xl p-10 text-center">
                <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><lucide-icon name="layers" [size]="26" /></span>
                <p class="text-sm font-semibold text-foreground">Aún no hay grupos</p>
                <p class="max-w-md text-xs text-muted-foreground">Sin grupos, el buzón sigue con las acciones de cada tipo de correo. Crea un grupo por proceso para asignar a personas.</p>
                <button type="button" class="alma-btn alma-btn-primary rounded-xl" (click)="nuevoGrupo()"><lucide-icon name="plus" [size]="16" /> Nuevo grupo</button>
              </div>
            }
          </div>
        }

        <!-- ── EQUIPO ── -->
        @case ('equipo') {
          <alma-equipo-tab [buzon]="buzon()" [grupos]="grupos()" [carpetas]="carpetas()" [(equipo)]="equipo" />
        }

        <!-- ── REGLAS Y BASES ── -->
        @case ('reglas') {
          <alma-reglas-bases-tab [buzon]="buzon()" [(grupos)]="grupos" [(bases)]="bases" [equipo]="equipo()" [procesos]="procesos()" [categorias]="categorias()" />
        }

        <!-- ── PROBAR ── -->
        @case ('probar') {
          <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <section class="glass grid gap-3 rounded-2xl p-5 shadow-[var(--shadow-sm)]">
              <div>
                <h2 class="text-sm font-semibold text-foreground">Correo de prueba</h2>
                <p class="mt-0.5 text-xs text-muted-foreground">Elige la etiqueta y los datos que traería el correo. No toca Outlook ni guarda nada.</p>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="alma-label" for="pa-et">Etiqueta</label>
                <select id="pa-et" class="alma-input" [ngModel]="etiquetaPrueba()" (ngModelChange)="elegirEtiqueta($event)">
                  <option value="">Elige la etiqueta…</option>
                  @for (c of categoriasActivas(); track c.id) { <option [value]="c.clave">{{ c.clave }} · {{ c.nombre }}</option> }
                </select>
                @if (etiquetaPrueba()) {
                  <p class="text-[11px] text-muted-foreground">
                    @if (grupoPrueba(); as g) { Va al grupo <b class="text-foreground">{{ g.nombre }}</b> · {{ destino(g.destino).nombre.toLowerCase() }} } @else { Ningún grupo incluye esta etiqueta. }
                  </p>
                }
              </div>
              @if (etiquetaPrueba()) {
                <div class="flex items-center justify-between">
                  <span class="alma-label">Datos del correo</span>
                  <button type="button" class="alma-btn alma-btn-ghost h-7 text-xs" (click)="alternarJson()"><lucide-icon name="code" [size]="13" /> {{ modoJson() ? 'Ver como campos' : 'Editar como JSON' }}</button>
                </div>
                @if (modoJson()) {
                  <textarea class="alma-input min-h-40 py-2 font-mono text-xs" aria-label="Datos del correo en JSON" [(ngModel)]="jsonPrueba"></textarea>
                } @else {
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    @for (c of camposPrueba(); track c.clave) {
                      <div class="flex flex-col gap-1">
                        <label class="font-mono text-[11px] text-muted-foreground" [attr.for]="'pa-' + c.clave">{{ c.clave }}{{ c.critico ? ' ★' : '' }}</label>
                        <input class="alma-input h-9 text-sm" [id]="'pa-' + c.clave" [(ngModel)]="datosPrueba[c.clave]" [placeholder]="c.descripcion" />
                      </div>
                    } @empty {
                      <p class="text-xs text-muted-foreground sm:col-span-2">Este proceso no extrae datos: la asignación es por round-robin.</p>
                    }
                  </div>
                }
                @if (errorPrueba(); as e) { <p class="text-xs text-destructive">{{ e }}</p> }
                <button type="button" class="alma-btn alma-btn-primary justify-self-start rounded-xl" [disabled]="probando()" (click)="probar()">
                  <lucide-icon [name]="probando() ? 'loader-2' : 'route'" [size]="15" [class.animate-spin]="probando()" /> Probar asignación
                </button>
              }
              <p class="text-[11px] text-muted-foreground">Cambia una membresía en Equipo o desactiva una búsqueda y vuelve a probar.</p>
            </section>

            <section class="glass grid gap-3 rounded-2xl p-5 shadow-[var(--shadow-sm)]">
              <h2 class="text-sm font-semibold text-foreground">Recorrido</h2>
              @if (resultado(); as r) {
                <div class="rounded-xl p-3" [class]="r.estado === 'sin_asignar' ? 'bg-amber-500/10' : 'bg-emerald-500/10'">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Resultado</p>
                  <p class="mt-0.5 text-base font-bold" [class]="r.estado === 'sin_asignar' ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'">
                    @switch (r.estado) {
                      @case ('asignado') { Asignado a {{ r.persona?.nombre }} }
                      @case ('carpeta') { Carpeta «{{ r.carpeta }}» }
                      @case ('categorizar') { Solo categorizar }
                      @default { Sin asignar }
                    }
                  </p>
                  <p class="text-xs text-muted-foreground">
                    @if (r.estado === 'asignado') { {{ r.carpeta ? 'Se mueve a la carpeta «' + r.carpeta + '»' : 'Sin carpeta: se queda en la vigilada' }} · }
                    {{ r.via || (r.grupo ? 'Grupo ' + r.grupo.nombre : '') }}
                  </p>
                </div>
                <alma-traza-asignacion [traza]="r.traza" />
              } @else {
                <div class="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><lucide-icon name="route" [size]="26" /></span>
                  <p class="text-sm text-muted-foreground">Aquí verás cada paso: hilo, búsquedas en bases y round-robin.</p>
                </div>
              }
            </section>
          </div>
        }
      }
    }

    <!-- Editor de grupo -->
    @if (form(); as f) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cerrarEditor()">
        <div class="surface-solid flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-2xl border border-border shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true" aria-labelledby="ge-t" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <h2 id="ge-t" class="text-sm font-semibold text-foreground">{{ editando() ? 'Editar grupo' : 'Nuevo grupo' }}</h2>
            <button type="button" class="alma-btn alma-btn-ghost" aria-label="Cerrar" (click)="cerrarEditor()"><lucide-icon name="x" [size]="16" /></button>
          </div>
          <div class="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
            <div class="flex flex-col gap-1.5">
              <label class="alma-label" for="ge-n">Nombre *</label>
              <input id="ge-n" class="alma-input" [(ngModel)]="f.nombre" placeholder="PAC" />
            </div>
            <div>
              <span class="alma-label">Etiquetas</span>
              <p class="text-[11px] text-muted-foreground">Los correos con estas etiquetas siguen las reglas del grupo. Si una etiqueta está en varios grupos, manda el primero.</p>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                @for (c of categoriasActivas(); track c.id) {
                  <button type="button" class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors" [class]="f.etiquetas.includes(c.clave) ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'" [attr.aria-pressed]="f.etiquetas.includes(c.clave)" (click)="alternarEtiqueta(f, c.clave)">
                    <span class="h-2 w-2 rounded-full" [style.background]="c.color || '#8E8E93'"></span> {{ c.clave }}
                    @if (grupoDeOtra(c.clave); as o) { <span class="text-[10px] opacity-70">(en {{ o }})</span> }
                  </button>
                }
              </div>
            </div>
            <fieldset class="grid gap-2">
              <legend class="alma-label mb-1">Destino de los correos</legend>
              @for (d of destinos; track d.id) {
                <label class="flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-sm" [class]="f.destino === d.id ? 'border-primary bg-primary/5' : 'border-border/60'">
                  <input type="radio" name="ge-dest" class="mt-1" [value]="d.id" [(ngModel)]="f.destino" />
                  <span><b class="font-medium">{{ d.nombre }}</b><span class="block text-xs text-muted-foreground">{{ d.ayuda }}</span></span>
                </label>
              }
            </fieldset>
            @if (f.destino === 'carpeta') {
              <div class="flex flex-col gap-1.5">
                <label class="alma-label" for="ge-c">Carpeta del buzón *</label>
                <alma-carpeta-select inputId="ge-c" [carpetas]="carpetas()" [(valor)]="f.carpeta" />
              </div>
            }
            @if (f.destino === 'personas') {
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <label class="alma-label" for="ge-sa">Si no hay nadie activo en el grupo</label>
                  <select id="ge-sa" class="alma-input" [(ngModel)]="f.sin_activos_modo">
                    <option value="cola">Dejar en «Sin asignar» y alertar</option>
                    <option value="carpeta">Enviar a una carpeta</option>
                    <option value="persona">Asignar a una persona de respaldo</option>
                  </select>
                </div>
                @if (f.sin_activos_modo === 'carpeta') {
                  <div class="flex flex-col gap-1.5">
                    <label class="alma-label" for="ge-sac">Carpeta de espera *</label>
                    <alma-carpeta-select inputId="ge-sac" [carpetas]="carpetas()" [(valor)]="f.sin_activos_carpeta" />
                  </div>
                } @else if (f.sin_activos_modo === 'persona') {
                  <div class="flex flex-col gap-1.5">
                    <label class="alma-label" for="ge-sap">Persona de respaldo *</label>
                    <select id="ge-sap" class="alma-input" [(ngModel)]="f.sin_activos_persona_id">
                      <option [ngValue]="null">Elige la persona…</option>
                      @for (p of equipo(); track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
                    </select>
                    @if (!equipo().length) { <p class="text-[11px] text-muted-foreground">Primero agrega personas en «Equipo».</p> }
                  </div>
                }
              </div>
            }
            <label class="flex items-center gap-2 text-sm"><alma-switch [checked]="f.activo" (checkedChange)="f.activo = $event" ariaLabel="Grupo activo" /> Grupo activo</label>
            @if (errorForm(); as e) { <p class="text-xs text-destructive">{{ e }}</p> }
          </div>
          <div class="flex justify-end gap-2 border-t border-border/60 px-5 py-3">
            <button type="button" class="alma-btn alma-btn-outline" (click)="cerrarEditor()">Cancelar</button>
            <button type="button" class="alma-btn alma-btn-primary" [disabled]="guardando()" (click)="guardarGrupo(f)">
              <lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardando()" /> Guardar
            </button>
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

  protected readonly subs: { id: Sub; nombre: string; icon: string }[] = [
    { id: 'grupos', nombre: 'Grupos', icon: 'layers' },
    { id: 'equipo', nombre: 'Equipo', icon: 'users' },
    { id: 'reglas', nombre: 'Reglas y bases', icon: 'file-spreadsheet' },
    { id: 'probar', nombre: 'Probar', icon: 'flask-conical' },
  ];
  protected readonly destinos = DESTINOS;
  protected readonly sub = signal<Sub>('grupos');

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly grupos = signal<Grupo[]>([]);
  protected readonly equipo = signal<Persona[]>([]);
  protected readonly bases = signal<Base[]>([]);
  protected readonly procesos = signal<Proceso[]>([]);
  protected readonly carpetas = signal<CarpetaPlana[]>([]);
  protected readonly avisoCarpetas = signal<string | null>(null);

  protected readonly categoriasActivas = computed(() => this.categorias().filter((c) => c.activa));
  protected readonly etiquetasSinGrupo = computed(() => {
    const enGrupo = new Set(this.grupos().filter((g) => g.activo).flatMap((g) => g.etiquetas));
    return this.categoriasActivas()
      .map((c) => c.clave)
      .filter((k) => !enGrupo.has(k));
  });

  // Editor de grupo
  protected readonly form = signal<GrupoForm | null>(null);
  protected readonly editando = signal<Grupo | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorForm = signal<string | null>(null);

  // Probar
  protected readonly etiquetaPrueba = signal('');
  protected readonly modoJson = signal(false);
  protected readonly probando = signal(false);
  protected readonly resultado = signal<ResultadoAsignacion | null>(null);
  protected readonly errorPrueba = signal<string | null>(null);
  protected datosPrueba: Record<string, string> = {};
  protected jsonPrueba = '{}';

  protected readonly grupoPrueba = computed(() => {
    const et = this.etiquetaPrueba().toUpperCase();
    return [...this.grupos()].sort((a, b) => a.orden - b.orden).find((g) => g.activo && g.etiquetas.includes(et)) ?? null;
  });

  /** Datos de las búsquedas del grupo primero, luego los del proceso de la etiqueta. */
  protected readonly camposPrueba = computed<CampoProceso[]>(() => {
    const out = new Map<string, CampoProceso>();
    const cat = this.categorias().find((c) => c.clave === this.etiquetaPrueba());
    const proceso = this.procesos().find((p) => p.id === cat?.proceso_id);
    const delProceso = new Map((proceso?.campos_extraer ?? []).map((c) => [c.clave, c]));
    this.grupoPrueba()?.reglas.forEach((r) =>
      r.cruces.forEach((c) => !out.has(c.campo) && out.set(c.campo, delProceso.get(c.campo) ?? { clave: c.campo, descripcion: `Se cruza con ${c.columna}`, critico: true })),
    );
    delProceso.forEach((c, k) => !out.has(k) && out.set(k, c));
    return [...out.values()];
  });

  constructor() {
    queueMicrotask(() => void this.cargar());
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
      this.avisoCarpetas.set(
        `No se pudieron leer las carpetas del buzón (${e instanceof Error ? e.message : String(e)}). Conéctalo para elegir carpetas.`,
      );
    }
  }

  protected destino(d: DestinoGrupo) {
    return DESTINOS.find((x) => x.id === d) ?? DESTINOS[0];
  }

  protected activosEn(g: Grupo): number {
    return this.equipo().filter((p) => p.disponible && p.grupos[g.id]?.activa).length;
  }

  protected busquedasActivas(g: Grupo): number {
    return g.reglas.filter((r) => r.activa).length;
  }

  protected sinActivosTxt(g: Grupo): string {
    if (g.sin_activos_modo === 'carpeta' && g.sin_activos_carpeta) return `se envían a la carpeta «${g.sin_activos_carpeta}»`;
    const p = g.sin_activos_modo === 'persona' ? this.equipo().find((x) => x.id === g.sin_activos_persona_id) : undefined;
    return p ? `se asignan a ${p.nombre}` : 'van a «Sin asignar» con alerta al líder';
  }

  protected grupoDeOtra(clave: string): string | null {
    const actual = this.editando()?.id;
    return this.grupos().find((g) => g.id !== actual && g.etiquetas.includes(clave))?.nombre ?? null;
  }

  // ── Grupos ──
  protected nuevoGrupo(): void {
    this.editando.set(null);
    this.errorForm.set(null);
    this.form.set({
      nombre: '',
      etiquetas: [],
      destino: 'personas',
      carpeta: null,
      sin_activos_modo: 'cola',
      sin_activos_carpeta: null,
      sin_activos_persona_id: null,
      activo: true,
    });
  }

  protected editarGrupo(g: Grupo): void {
    this.editando.set(g);
    this.errorForm.set(null);
    this.form.set({
      nombre: g.nombre,
      etiquetas: [...g.etiquetas],
      destino: g.destino,
      carpeta: g.carpeta,
      sin_activos_modo: g.sin_activos_modo,
      sin_activos_carpeta: g.sin_activos_carpeta,
      sin_activos_persona_id: g.sin_activos_persona_id,
      activo: g.activo,
    });
  }

  protected cerrarEditor(): void {
    if (!this.guardando()) this.form.set(null);
  }

  protected alternarEtiqueta(f: GrupoForm, clave: string): void {
    f.etiquetas = f.etiquetas.includes(clave) ? f.etiquetas.filter((x) => x !== clave) : [...f.etiquetas, clave];
  }

  protected async guardarGrupo(f: GrupoForm): Promise<void> {
    this.errorForm.set(null);
    if (f.nombre.trim().length < 2) return this.errorForm.set('Escribe el nombre del grupo.');
    // Nunca se supone una carpeta: si el destino es una carpeta, hay que elegirla.
    if (f.destino === 'carpeta' && !f.carpeta) return this.errorForm.set('Elige la carpeta a la que se envían los correos del grupo.');
    if (f.destino === 'personas' && f.sin_activos_modo === 'carpeta' && !f.sin_activos_carpeta) return this.errorForm.set('Elige la carpeta para cuando no haya nadie activo.');
    if (f.destino === 'personas' && f.sin_activos_modo === 'persona' && !f.sin_activos_persona_id) return this.errorForm.set('Elige la persona de respaldo del grupo.');
    const personas = f.destino === 'personas';
    const cambios: Partial<GrupoIn> = {
      nombre: f.nombre.trim(),
      etiquetas: f.etiquetas,
      destino: f.destino,
      carpeta: f.destino === 'carpeta' ? f.carpeta : null,
      sin_activos_modo: personas ? f.sin_activos_modo : 'cola',
      sin_activos_carpeta: personas && f.sin_activos_modo === 'carpeta' ? f.sin_activos_carpeta : null,
      sin_activos_persona_id: personas && f.sin_activos_modo === 'persona' ? f.sin_activos_persona_id : null,
      activo: f.activo,
    };
    this.guardando.set(true);
    try {
      const actual = this.editando();
      if (actual) {
        const g = await this.api.actualizarGrupo(actual.id, aGrupoIn(actual, cambios));
        this.grupos.update((l) => l.map((x) => (x.id === g.id ? g : x)));
      } else {
        const g = await this.api.crearGrupo(this.buzon().id, { ...(cambios as GrupoIn), reglas: [] });
        this.grupos.update((l) => [...l, g]);
      }
      this.toast.show(actual ? 'Grupo actualizado' : 'Grupo creado', f.nombre.trim());
      this.form.set(null);
    } catch (e) {
      this.errorForm.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async eliminarGrupo(g: Grupo): Promise<void> {
    if (!confirm(`¿Eliminar el grupo «${g.nombre}»? Sus etiquetas quedan sin asignación y el equipo deja de estar en él.`)) return;
    try {
      await this.api.eliminarGrupo(g.id);
      this.grupos.update((l) => l.filter((x) => x.id !== g.id));
      this.equipo.set(await this.api.listarEquipo(this.buzon().id));
      this.toast.show('Grupo eliminado', g.nombre);
    } catch (e) {
      this.toast.error('No se pudo eliminar el grupo', e instanceof Error ? e.message : String(e));
    }
  }

  // ── Probar ──
  protected elegirEtiqueta(clave: string): void {
    this.etiquetaPrueba.set(clave);
    this.resultado.set(null);
    this.errorPrueba.set(null);
    const previos = this.datosPrueba;
    this.datosPrueba = Object.fromEntries(this.camposPrueba().map((c) => [c.clave, previos[c.clave] ?? '']));
    this.jsonPrueba = JSON.stringify(this.datosPrueba, null, 2);
  }

  protected alternarJson(): void {
    this.errorPrueba.set(null);
    if (this.modoJson()) {
      const d = this.leerJson();
      if (!d) return;
      this.datosPrueba = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)]));
    } else {
      this.jsonPrueba = JSON.stringify(this.limpios(), null, 2);
    }
    this.modoJson.update((x) => !x);
  }

  private leerJson(): Record<string, unknown> | null {
    try {
      const d: unknown = JSON.parse(this.jsonPrueba || '{}');
      if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('debe ser un objeto');
      return d as Record<string, unknown>;
    } catch (e) {
      this.errorPrueba.set(`El JSON no es válido: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  private limpios(): Record<string, string> {
    return Object.fromEntries(Object.entries(this.datosPrueba).filter(([, v]) => String(v ?? '').trim() !== ''));
  }

  protected async probar(): Promise<void> {
    this.errorPrueba.set(null);
    const datos = this.modoJson() ? this.leerJson() : this.limpios();
    if (!datos) return;
    this.probando.set(true);
    try {
      this.resultado.set(await this.api.probarAsignacion(this.buzon().id, this.etiquetaPrueba(), datos));
    } catch (e) {
      this.errorPrueba.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.probando.set(false);
    }
  }
}
