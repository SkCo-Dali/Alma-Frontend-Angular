// «Asignación › Reglas y bases» (2.0): por cada grupo que asigna a personas, la
// cadena de búsquedas en bases que se evalúa en orden hasta que una asigna:
//   0. Continuidad del hilo (automática) → búsquedas en bases (cruces en cascada:
//   dato del JSON ↔ columna de la base con una comparación) → round-robin.
// Debajo, las bases del buzón: estado de la carga, subir/sincronizar, filas y
// «Vincular a…» para los responsables que no se reconocen en el equipo.

import { Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaSwitchComponent } from '../../shared/components/alma-switch.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import {
  Base,
  Buzon,
  BuzonApi,
  COMPARACIONES,
  CampoProceso,
  Categoria,
  Comparacion,
  Cruce,
  FilaBase,
  Grupo,
  Persona,
  Proceso,
  ReglaAsignacionIn,
} from './buzon.api';
import { aGrupoIn, comparacionPara, reconocer } from './buzon-asignacion';
import { BaseCardComponent } from './base-card.component';

interface ReglaForm {
  grupoId: string;
  indice: number | null;
  base_id: string;
  cruces: Cruce[];
  col_responsable: string;
  col_respaldo: string;
  activa: boolean;
}

const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Columna de la base que parece corresponder a un dato del JSON (codigo_pac → «CODIGO PAC»). */
function columnaPara(campo: string, columnas: string[]): string {
  const tokens = campo.toUpperCase().split('_').filter((t) => t.length > 2);
  for (const t of tokens) {
    const exacta = columnas.find((c) => norm(c) === t);
    if (exacta) return exacta;
  }
  for (const t of [...tokens].reverse()) {
    const parcial = columnas.find((c) => norm(c).includes(t));
    if (parcial) return parcial;
  }
  return columnas[0] ?? '';
}

@Component({
  selector: 'alma-reglas-bases-tab',
  imports: [FormsModule, LucideAngularModule, AlmaSwitchComponent, TooltipDirective, BaseCardComponent],
  template: `
    @if (!gruposPersonas().length) {
      <div class="glass rounded-2xl p-5 text-sm text-muted-foreground">
        Ningún grupo asigna a personas. Cambia el destino de un grupo en «Grupos» para buscar responsables en bases.
      </div>
    } @else {
      <div class="glass inline-flex flex-wrap gap-1 rounded-xl p-1" role="tablist" aria-label="Grupo">
        @for (g of gruposPersonas(); track g.id) {
          <button type="button" role="tab" class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors" [attr.aria-selected]="g.id === grupo()?.id" [class]="g.id === grupo()?.id ? 'bg-primary text-primary-foreground shadow-[var(--shadow-sm)]' : 'text-muted-foreground hover:text-foreground'" (click)="grupoSel.set(g.id)">{{ g.nombre }}</button>
        }
      </div>
      @if (otrosGrupos().length) {
        <p class="text-on-wallpaper text-xs text-foreground/75">Sin cadena: {{ otrosGrupos() }}</p>
      }

      @if (grupo(); as g) {
        <section class="glass grid gap-2.5 rounded-2xl p-4 shadow-[var(--shadow-sm)]">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-foreground">Cadena de asignación · {{ g.nombre }}</h2>
            <span class="text-xs text-muted-foreground">Se evalúa en orden hasta que una asigna</span>
          </div>

          <div class="flex items-center gap-3 rounded-xl border border-dashed border-border/80 px-3 py-2.5">
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-xs font-bold text-muted-foreground">0</span>
            <div>
              <p class="text-sm font-semibold text-foreground">Continuidad del hilo</p>
              <p class="text-xs text-muted-foreground">Automática: las respuestas a un caso heredan la persona si sigue activa en el grupo.</p>
            </div>
          </div>

          @for (r of g.reglas; track $index; let i = $index) {
            <div class="grid gap-2">
              <div class="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card/50 px-3 py-2.5" [class.opacity-60]="!r.activa">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{{ i + 1 }}</span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-foreground">
                    Búsqueda en {{ baseDe(r.base_id)?.nombre ?? r.base_nombre ?? 'base quitada' }}
                    @if (!r.activa) { <span class="alma-badge ml-1 bg-zinc-500/15 text-zinc-600 dark:text-zinc-300">Desactivada</span> }
                  </p>
                  <p class="text-xs text-muted-foreground">
                    @for (c of r.cruces; track $index; let j = $index) {
                      {{ j ? 'luego ' : '' }}<span class="font-mono">{{ c.campo }}</span> ↔ {{ c.columna }} <span class="opacity-70">({{ nombreComparacion(c.comparacion) }})</span>{{ j < r.cruces.length - 1 ? ' · ' : '' }}
                    }
                    → <b class="font-medium text-foreground">{{ r.col_responsable }}</b>@if (r.col_respaldo) { (respaldo: {{ r.col_respaldo }})}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-0.5">
                  <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="guardando()" (click)="editarRegla(g, i)">Editar</button>
                  <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0" [disabled]="guardando() || i === 0" aria-label="Subir búsqueda" almaTooltip="Subir" (click)="moverRegla(g, i, -1)"><lucide-icon name="arrow-up" [size]="14" /></button>
                  <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0" [disabled]="guardando() || i === g.reglas.length - 1" aria-label="Bajar búsqueda" almaTooltip="Bajar" (click)="moverRegla(g, i, 1)"><lucide-icon name="arrow-down" [size]="14" /></button>
                  <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0" [disabled]="guardando()" [attr.aria-label]="r.activa ? 'Desactivar búsqueda' : 'Activar búsqueda'" [almaTooltip]="r.activa ? 'Desactivar' : 'Activar'" (click)="alternarRegla(g, i)"><lucide-icon [name]="r.activa ? 'power-off' : 'power'" [size]="14" /></button>
                  <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0 text-destructive" [disabled]="guardando()" aria-label="Quitar búsqueda" almaTooltip="Quitar" (click)="quitarRegla(g, i)"><lucide-icon name="x" [size]="14" /></button>
                </div>
              </div>
              @if (baseDe(r.base_id); as b) {
                <div class="ml-4 sm:ml-10">
                  <alma-base-card [base]="b" [equipo]="equipo()" [columnasResponsable]="usos(b.id).resp" [columnasCruce]="usos(b.id).cruce" [otrosUsos]="otrosUsosTxt(b.id, g.id)" (baseChange)="actualizarBase($event)" />
                </div>
              }
            </div>
          }

          @if (!camposDe(g).length) {
            <p class="flex items-start gap-1.5 rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-800 dark:text-sky-200">
              <lucide-icon name="info" [size]="13" class="mt-0.5 shrink-0" />
              Los procesos de este grupo no extraen datos: solo se reparte por round-robin. Agrega datos a extraer en «Procesos» para buscar en bases.
            </p>
          } @else {
            <button type="button" class="alma-btn alma-btn-outline h-8 justify-self-start rounded-lg text-xs" (click)="nuevaRegla(g)"><lucide-icon name="plus" [size]="14" /> Agregar búsqueda en base</button>
          }

          <div class="flex items-center gap-3 rounded-xl border border-dashed border-border/80 px-3 py-2.5">
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-[10px] font-bold text-muted-foreground">RR</span>
            <div>
              <p class="text-sm font-semibold text-foreground">Round-robin {{ g.nombre }}</p>
              <p class="text-xs text-muted-foreground">Obligatoria · el de menos correos hoy entre los activos del grupo · si no hay nadie activo, {{ sinActivosTxt(g) }}.</p>
            </div>
          </div>
        </section>
      }
    }

    <!-- Bases del buzón sin usar en este grupo -->
    <section class="glass grid gap-2.5 rounded-2xl p-4 shadow-[var(--shadow-sm)]">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-semibold text-foreground">{{ grupo() ? 'Otras bases del buzón' : 'Bases del buzón' }}</h2>
          <p class="text-xs text-muted-foreground">Tablas (Excel o CSV) con el responsable de cada caso. Una base puede servir a varios grupos.</p>
        </div>
        <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" (click)="abrirNuevaBase()"><lucide-icon name="plus" [size]="14" /> Nueva base</button>
      </div>
      @for (b of otrasBases(); track b.id) {
        <alma-base-card [base]="b" [equipo]="equipo()" [columnasResponsable]="usos(b.id).resp" [columnasCruce]="usos(b.id).cruce" [otrosUsos]="otrosUsosTxt(b.id, grupo()?.id ?? '')" (baseChange)="actualizarBase($event)">
          @if (grupo(); as g) {
            @if (camposDe(g).length && b.columnas.length) {
              <button type="button" class="alma-btn alma-btn-primary h-8 rounded-lg text-xs" (click)="nuevaRegla(g, b.id)"><lucide-icon name="plus" [size]="14" /> Usar en «{{ g.nombre }}»</button>
            }
          }
          @if (!b.usos) {
            <button type="button" class="alma-btn alma-btn-ghost h-8 rounded-lg text-xs text-destructive" (click)="eliminarBase(b)"><lucide-icon name="trash-2" [size]="14" /> Eliminar</button>
          }
        </alma-base-card>
      } @empty {
        <p class="text-xs text-muted-foreground">{{ bases().length ? 'Todas las bases del buzón están en uso en este grupo.' : 'Aún no hay bases. Crea una y sube el Excel con los responsables.' }}</p>
      }
    </section>

    <!-- Nueva base -->
    @if (nuevaBase(); as nb) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="nuevaBase.set(null)">
        <div class="surface-solid w-full max-w-md rounded-2xl border border-border p-5 shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true" aria-labelledby="nbase-t" (click)="$event.stopPropagation()">
          <h2 id="nbase-t" class="text-sm font-semibold text-foreground">Nueva base de responsables</h2>
          <div class="mt-3 grid gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="alma-label" for="nbase-n">Nombre *</label>
              <input id="nbase-n" class="alma-input" [(ngModel)]="nb.nombre" placeholder="BASE PAC" />
            </div>
            <fieldset class="grid gap-2">
              <legend class="alma-label mb-1">¿Dónde está el archivo?</legend>
              <label class="flex items-start gap-2 rounded-xl border border-border/60 p-2.5 text-sm" [class.border-primary]="nb.origen === 'archivo'">
                <input type="radio" name="nbase-o" value="archivo" [(ngModel)]="nb.origen" class="mt-1" />
                <span><b class="font-medium">Subir Excel o CSV</b><span class="block text-xs text-muted-foreground">Queda en Alma; lo reemplazas cuando cambie.</span></span>
              </label>
              <label class="flex items-start gap-2 rounded-xl border border-border/60 p-2.5 text-sm" [class.border-primary]="nb.origen === 'sharepoint'">
                <input type="radio" name="nbase-o" value="sharepoint" [(ngModel)]="nb.origen" class="mt-1" />
                <span><b class="font-medium">SharePoint</b><span class="block text-xs text-muted-foreground">Se edita en Excel en la nube y Alma sincroniza la última versión válida.</span></span>
              </label>
            </fieldset>
            @if (nb.origen === 'sharepoint') {
              <div class="flex flex-col gap-1.5">
                <label class="alma-label" for="nbase-u">Enlace del archivo en SharePoint *</label>
                <input id="nbase-u" class="alma-input" [(ngModel)]="nb.url" placeholder="https://empresa.sharepoint.com/sites/…/BASE.xlsx" />
              </div>
            }
            @if (errorBase(); as e) { <p class="text-xs text-destructive">{{ e }}</p> }
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" class="alma-btn alma-btn-outline" (click)="nuevaBase.set(null)">Cancelar</button>
            <button type="button" class="alma-btn alma-btn-primary" [disabled]="guardando()" (click)="crearBase(nb)"><lucide-icon name="save" [size]="15" /> Crear base</button>
          </div>
        </div>
      </div>
    }

    <!-- Editor de búsqueda -->
    @if (form(); as f) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cerrarEditor()">
        <div class="surface-solid flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-2xl border border-border shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true" aria-labelledby="re-t" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <div>
              <h2 id="re-t" class="text-sm font-semibold text-foreground">{{ f.indice === null ? 'Nueva búsqueda en base' : 'Editar búsqueda ' + (f.indice + 1) }}</h2>
              <p class="text-xs text-muted-foreground">Grupo {{ grupoForm()?.nombre }}</p>
            </div>
            <button type="button" class="alma-btn alma-btn-ghost" aria-label="Cerrar" (click)="cerrarEditor()"><lucide-icon name="x" [size]="16" /></button>
          </div>
          <div class="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
            <div class="flex flex-col gap-1.5">
              <label class="alma-label" for="re-base">Base</label>
              <select id="re-base" class="alma-input" [ngModel]="f.base_id" (ngModelChange)="elegirBase(f, $event)">
                <option value="">Elige la base…</option>
                @for (b of bases(); track b.id) {
                  <option [value]="b.id" [disabled]="!b.columnas.length">{{ b.nombre }}{{ b.columnas.length ? ' · ' + b.total_filas + ' filas' : ' (sin cargar)' }}</option>
                }
              </select>
              @if (!bases().length) { <p class="text-[11px] text-muted-foreground">Primero crea una base en «Bases del buzón» y sube su archivo.</p> }
            </div>

            @if (baseForm(); as b) {
              <div>
                <p class="text-xs font-semibold text-foreground">Cruces en cascada</p>
                <p class="text-[11px] text-muted-foreground">Si uno no encuentra el caso (el correo no trae el dato, no está en la base o hay responsables distintos), prueba el siguiente.</p>
                <div class="mt-2 space-y-1.5">
                  @for (c of f.cruces; track $index; let i = $index) {
                    <div class="flex flex-wrap items-center gap-1.5 rounded-xl bg-[var(--surface-sunken)] p-2">
                      <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-card text-[11px] font-bold">{{ i + 1 }}</span>
                      <select class="alma-input h-8 w-44 font-mono text-xs" [attr.aria-label]="'Dato del correo, cruce ' + (i + 1)" [(ngModel)]="c.campo" (ngModelChange)="c.comparacion = comparacionPara($event)">
                        @for (k of camposForm(); track k.clave) { <option [value]="k.clave">{{ k.clave }}{{ k.critico ? ' ★' : '' }}</option> }
                        @if (c.campo && !esCampo(c.campo)) { <option [value]="c.campo">{{ c.campo }} (no está en los procesos)</option> }
                      </select>
                      <span class="text-muted-foreground" aria-hidden="true">↔</span>
                      <select class="alma-input h-8 w-44 text-xs" [attr.aria-label]="'Columna de la base, cruce ' + (i + 1)" [(ngModel)]="c.columna">
                        @for (col of b.columnas; track col) { <option [value]="col">{{ col }}</option> }
                      </select>
                      <select class="alma-input h-8 w-52 text-xs" [attr.aria-label]="'Comparación, cruce ' + (i + 1)" [(ngModel)]="c.comparacion">
                        @for (k of comparaciones; track k.id) { <option [value]="k.id">{{ k.nombre }}</option> }
                      </select>
                      <span class="ml-auto flex">
                        <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0" [disabled]="i === 0" aria-label="Subir cruce" (click)="moverCruce(f, i, -1)"><lucide-icon name="arrow-up" [size]="13" /></button>
                        <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0" [disabled]="i === f.cruces.length - 1" aria-label="Bajar cruce" (click)="moverCruce(f, i, 1)"><lucide-icon name="arrow-down" [size]="13" /></button>
                        <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0 text-destructive" aria-label="Quitar cruce" (click)="f.cruces.splice(i, 1)"><lucide-icon name="x" [size]="13" /></button>
                      </span>
                    </div>
                  }
                </div>
                <button type="button" class="alma-btn alma-btn-ghost mt-1 h-8 text-xs" [disabled]="f.cruces.length >= 10" (click)="agregarCruce(f, b)"><lucide-icon name="plus" [size]="14" /> Agregar cruce</button>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <label class="alma-label" for="re-resp">Columna con el responsable *</label>
                  <select id="re-resp" class="alma-input" [(ngModel)]="f.col_responsable" (ngModelChange)="cargarFilasForm()">
                    <option value="">Elige la columna…</option>
                    @for (col of b.columnas; track col) { <option [value]="col">{{ col }}</option> }
                  </select>
                  <p class="text-[11px] text-muted-foreground">Debe traer el correo o el nombre de la persona; lo que no coincida se vincula en la base.</p>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="alma-label" for="re-bk">Columna de respaldo</label>
                  <select id="re-bk" class="alma-input" [(ngModel)]="f.col_respaldo">
                    <option value="">Sin respaldo</option>
                    @for (col of b.columnas; track col) { <option [value]="col">{{ col }}</option> }
                  </select>
                  <p class="text-[11px] text-muted-foreground">Se usa si el responsable está ausente o inactivo (con «respaldo fijo»).</p>
                </div>
              </div>

              @if (f.col_responsable && validacion(); as v) {
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2"><p class="text-[11px] text-muted-foreground">Responsables reconocidos</p><p class="text-lg font-bold tabular-nums text-emerald-600">{{ v.ok }}/{{ v.total }}</p></div>
                  <div class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2"><p class="text-[11px] text-muted-foreground">No reconocidos</p><p class="text-lg font-bold tabular-nums" [class.text-amber-600]="v.desconocidos.length">{{ v.desconocidos.length }}</p></div>
                  <div class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2"><p class="text-[11px] text-muted-foreground">Responsable vacío</p><p class="text-lg font-bold tabular-nums">{{ v.vacios }}</p></div>
                  <div class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2"><p class="text-[11px] text-muted-foreground">Filas revisadas</p><p class="text-lg font-bold tabular-nums">{{ v.total }}</p></div>
                </div>
                @if (v.desconocidos.length) {
                  <p class="flex items-start gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    <lucide-icon name="user-x" [size]="13" class="mt-0.5 shrink-0" />
                    <span>No se reconocen en el equipo: <b>{{ v.desconocidos.slice(0, 8).join(', ') }}</b>{{ v.desconocidos.length > 8 ? '…' : '' }}. Vincúlalos desde «Ver datos» de la base o esos casos seguirán a la siguiente búsqueda.</span>
                  </p>
                }
              }
              <label class="flex items-center gap-2 text-sm"><alma-switch [checked]="f.activa" (checkedChange)="f.activa = $event" ariaLabel="Búsqueda activa" /> Búsqueda activa</label>
            }
            @if (errorForm(); as e) { <p class="text-xs text-destructive">{{ e }}</p> }
          </div>
          <div class="flex justify-end gap-2 border-t border-border/60 px-5 py-3">
            <button type="button" class="alma-btn alma-btn-outline" (click)="cerrarEditor()">Cancelar</button>
            <button type="button" class="alma-btn alma-btn-primary" [disabled]="guardando()" (click)="guardarRegla(f)">
              <lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardando()" /> Guardar búsqueda
            </button>
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

  protected readonly comparaciones = COMPARACIONES;
  protected readonly comparacionPara = comparacionPara;
  protected readonly grupoSel = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly gruposPersonas = computed(() => this.grupos().filter((g) => g.destino === 'personas'));
  protected readonly grupo = computed<Grupo | null>(() => {
    const l = this.gruposPersonas();
    return l.find((g) => g.id === this.grupoSel()) ?? l[0] ?? null;
  });
  protected readonly otrosGrupos = computed(() =>
    this.grupos()
      .filter((g) => g.destino !== 'personas')
      .map((g) => `${g.nombre} (${g.destino === 'carpeta' ? `carpeta «${g.carpeta ?? '—'}»` : 'solo categorizar'})`)
      .join(' · '),
  );
  protected readonly otrasBases = computed(() => {
    const g = this.grupo();
    const usadas = new Set((g?.reglas ?? []).map((r) => r.base_id));
    return this.bases().filter((b) => !usadas.has(b.id));
  });

  // Editor
  protected readonly form = signal<ReglaForm | null>(null);
  protected readonly errorForm = signal<string | null>(null);
  private readonly filasForm = signal<FilaBase[]>([]);
  protected readonly grupoForm = computed(() => this.grupos().find((g) => g.id === this.form()?.grupoId) ?? null);
  protected readonly baseForm = computed(() => this.bases().find((b) => b.id === this.form()?.base_id) ?? null);
  protected readonly camposForm = computed(() => {
    const g = this.grupoForm();
    return g ? this.camposDe(g) : [];
  });
  /** Se recalcula al elegir la columna (cargarFilasForm actualiza filasForm). */
  protected readonly validacion = computed(() => {
    const f = this.form();
    const b = this.baseForm();
    const filas = this.filasForm();
    if (!f || !b || !filas.length) return null;
    let ok = 0;
    let vacios = 0;
    const desconocidos = new Set<string>();
    for (const fila of filas) {
      const v = fila[f.col_responsable];
      if (!v) vacios++;
      else if (reconocer(v, this.equipo(), b.vinculos)) ok++;
      else desconocidos.add(v);
    }
    return { ok, vacios, desconocidos: [...desconocidos], total: filas.length };
  });

  // Nueva base
  protected readonly nuevaBase = signal<{ nombre: string; origen: 'archivo' | 'sharepoint'; url: string } | null>(null);
  protected readonly errorBase = signal<string | null>(null);

  protected baseDe(id: string): Base | undefined {
    return this.bases().find((b) => b.id === id);
  }

  protected nombreComparacion(c: Comparacion): string {
    return COMPARACIONES.find((x) => x.id === c)?.nombre ?? c;
  }

  /** Datos que extraen los procesos de las etiquetas del grupo (críticos primero). */
  camposDe(g: Grupo): CampoProceso[] {
    const procIds = new Set(this.categorias().filter((c) => g.etiquetas.includes(c.clave) && c.proceso_id).map((c) => c.proceso_id));
    const vistos = new Map<string, CampoProceso>();
    this.procesos()
      .filter((p) => procIds.has(p.id))
      .forEach((p) => p.campos_extraer.forEach((c) => !vistos.has(c.clave) && vistos.set(c.clave, c)));
    return [...vistos.values()].sort((a, b) => Number(b.critico) - Number(a.critico));
  }

  protected esCampo(clave: string): boolean {
    return this.camposForm().some((c) => c.clave === clave);
  }

  protected usos(baseId: string): { resp: string[]; cruce: string[] } {
    const resp = new Set<string>();
    const cruce = new Set<string>();
    this.grupos().forEach((g) =>
      g.reglas
        .filter((r) => r.base_id === baseId && r.activa)
        .forEach((r) => {
          resp.add(r.col_responsable);
          if (r.col_respaldo) resp.add(r.col_respaldo);
          r.cruces.forEach((c) => cruce.add(c.columna));
        }),
    );
    return { resp: [...resp], cruce: [...cruce] };
  }

  protected otrosUsosTxt(baseId: string, grupoId: string): string {
    const otros = this.grupos().filter((g) => g.id !== grupoId && g.reglas.some((r) => r.base_id === baseId)).map((g) => g.nombre);
    return otros.length ? `también la usa: ${otros.join(', ')}` : '';
  }

  protected sinActivosTxt(g: Grupo): string {
    if (g.sin_activos_modo === 'carpeta' && g.sin_activos_carpeta) return `sus correos se envían a la carpeta «${g.sin_activos_carpeta}»`;
    if (g.sin_activos_modo === 'persona') {
      const p = this.equipo().find((x) => x.id === g.sin_activos_persona_id);
      if (p) return `se asignan a ${p.nombre}`;
    }
    return 'van a «Sin asignar» con alerta al líder';
  }

  protected actualizarBase(b: Base): void {
    this.bases.update((l) => l.map((x) => (x.id === b.id ? b : x)));
  }

  // ── Cadena ──
  private async guardarReglas(g: Grupo, reglas: ReglaAsignacionIn[], ok?: string): Promise<boolean> {
    this.guardando.set(true);
    try {
      const actualizado = await this.api.actualizarGrupo(g.id, aGrupoIn(g, { reglas }));
      this.grupos.update((l) => l.map((x) => (x.id === g.id ? actualizado : x)));
      // Los usos de las bases cambian con las reglas.
      this.bases.update((l) =>
        l.map((b) => ({ ...b, usos: this.grupos().reduce((n, x) => n + x.reglas.filter((r) => r.base_id === b.id).length, 0) })),
      );
      if (ok) this.toast.show(ok, g.nombre);
      return true;
    } catch (e) {
      this.toast.error('No se pudo guardar la cadena', e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  protected moverRegla(g: Grupo, i: number, d: number): void {
    const reglas = aGrupoIn(g).reglas;
    const [r] = reglas.splice(i, 1);
    reglas.splice(i + d, 0, r);
    void this.guardarReglas(g, reglas);
  }

  protected alternarRegla(g: Grupo, i: number): void {
    const reglas = aGrupoIn(g).reglas;
    reglas[i] = { ...reglas[i], activa: !reglas[i].activa };
    void this.guardarReglas(g, reglas, reglas[i].activa ? 'Búsqueda activada' : 'Búsqueda desactivada');
  }

  protected quitarRegla(g: Grupo, i: number): void {
    if (!confirm('¿Quitar esta búsqueda de la cadena? La base se conserva.')) return;
    const reglas = aGrupoIn(g).reglas.filter((_, j) => j !== i);
    void this.guardarReglas(g, reglas, 'Búsqueda quitada');
  }

  // ── Editor ──
  protected nuevaRegla(g: Grupo, baseId = ''): void {
    const f: ReglaForm = { grupoId: g.id, indice: null, base_id: '', cruces: [], col_responsable: '', col_respaldo: '', activa: true };
    this.errorForm.set(null);
    this.filasForm.set([]);
    this.filasDe = null;
    this.form.set(f);
    if (baseId) this.elegirBase(f, baseId);
  }

  protected editarRegla(g: Grupo, i: number): void {
    const r = g.reglas[i];
    this.errorForm.set(null);
    this.filasForm.set([]);
    this.filasDe = null;
    this.form.set({
      grupoId: g.id,
      indice: i,
      base_id: r.base_id,
      cruces: r.cruces.map((c) => ({ ...c })),
      col_responsable: r.col_responsable,
      col_respaldo: r.col_respaldo ?? '',
      activa: r.activa,
    });
    this.cargarFilasForm();
  }

  protected cerrarEditor(): void {
    if (!this.guardando()) this.form.set(null);
  }

  protected elegirBase(f: ReglaForm, baseId: string): void {
    const b = this.baseDe(baseId);
    // Nueva referencia: los computed que dependen del formulario se recalculan.
    const nuevo: ReglaForm = { ...f, base_id: baseId };
    if (b?.columnas.length) {
      const campos = this.camposDe(this.grupos().find((g) => g.id === f.grupoId)!);
      const id = campos.find((c) => c.critico) ?? campos[0];
      nuevo.cruces = id ? [{ campo: id.clave, columna: columnaPara(id.clave, b.columnas), comparacion: comparacionPara(id.clave) }] : [];
      nuevo.col_responsable = b.columnas.find((c) => /ANALISTA|RESPONSABLE/i.test(c) && !/BACKUP|RESPALDO/i.test(c)) ?? '';
      nuevo.col_respaldo = b.columnas.find((c) => /BACKUP|RESPALDO/i.test(c)) ?? '';
    }
    this.form.set(nuevo);
    this.cargarFilasForm();
  }

  protected cargarFilasForm(): void {
    const f = this.form();
    if (!f?.base_id) return;
    this.form.set({ ...f }); // recalcula la validación con la columna elegida
    if (this.filasDe === f.base_id) return;
    this.filasDe = f.base_id;
    this.filasForm.set([]);
    void this.api
      .filasBase(f.base_id, undefined, 500)
      .then((r) => {
        if (this.form()?.base_id === f.base_id) this.filasForm.set(r.items);
      })
      .catch(() => (this.filasDe = null));
  }

  /** Base cuyas filas están en filasForm (para no volver a pedirlas). */
  private filasDe: string | null = null;

  protected agregarCruce(f: ReglaForm, b: Base): void {
    const usados = new Set(f.cruces.map((c) => c.campo));
    const campo = this.camposForm().find((c) => !usados.has(c.clave)) ?? this.camposForm()[0];
    if (!campo) return;
    f.cruces.push({ campo: campo.clave, columna: columnaPara(campo.clave, b.columnas), comparacion: comparacionPara(campo.clave) });
  }

  protected moverCruce(f: ReglaForm, i: number, d: number): void {
    const [c] = f.cruces.splice(i, 1);
    f.cruces.splice(i + d, 0, c);
  }

  protected async guardarRegla(f: ReglaForm): Promise<void> {
    this.errorForm.set(null);
    const g = this.grupos().find((x) => x.id === f.grupoId);
    const b = this.baseDe(f.base_id);
    if (!g) return;
    if (!b) return this.errorForm.set('Elige la base.');
    if (!f.cruces.length) return this.errorForm.set('Agrega al menos un cruce.');
    if (f.cruces.some((c) => !c.campo || !c.columna)) return this.errorForm.set('Cada cruce necesita el dato del correo y la columna de la base.');
    if (!f.col_responsable) return this.errorForm.set('Elige la columna con el responsable.');
    const regla: ReglaAsignacionIn = {
      base_id: f.base_id,
      cruces: f.cruces.map((c) => ({ ...c })),
      col_responsable: f.col_responsable,
      col_respaldo: f.col_respaldo || null,
      activa: f.activa,
    };
    const reglas = aGrupoIn(g).reglas;
    if (f.indice === null) reglas.push(regla);
    else reglas[f.indice] = regla;
    if (await this.guardarReglas(g, reglas, f.indice === null ? 'Búsqueda agregada' : 'Búsqueda actualizada')) this.form.set(null);
  }

  // ── Bases ──
  protected abrirNuevaBase(): void {
    this.errorBase.set(null);
    this.nuevaBase.set({ nombre: '', origen: 'archivo', url: '' });
  }

  protected async crearBase(nb: { nombre: string; origen: 'archivo' | 'sharepoint'; url: string }): Promise<void> {
    this.errorBase.set(null);
    if (nb.nombre.trim().length < 2) return this.errorBase.set('Escribe el nombre de la base.');
    if (nb.origen === 'sharepoint' && !/^https:\/\/[a-z0-9.-]+\.sharepoint\.com\//i.test(nb.url.trim())) {
      return this.errorBase.set('Pega el enlace de SharePoint del archivo (https://…sharepoint.com/…).');
    }
    this.guardando.set(true);
    try {
      const b = await this.api.crearBase({
        nombre: nb.nombre.trim(),
        origen: nb.origen,
        sharepoint_url: nb.origen === 'sharepoint' ? nb.url.trim() : null,
        buzones: [this.buzon().id],
      });
      this.bases.update((l) => [...l, b]);
      this.nuevaBase.set(null);
      this.toast.show('Base creada', nb.origen === 'sharepoint' ? `${b.nombre}: sincronízala para leer el archivo.` : `${b.nombre}: sube el archivo con los responsables.`);
    } catch (e) {
      this.errorBase.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async eliminarBase(b: Base): Promise<void> {
    if (!confirm(`¿Eliminar la base «${b.nombre}»? Se borran sus filas y vínculos.`)) return;
    try {
      await this.api.eliminarBase(b.id);
      this.bases.update((l) => l.filter((x) => x.id !== b.id));
      this.toast.show('Base eliminada', b.nombre);
    } catch (e) {
      this.toast.error('No se pudo eliminar la base', e instanceof Error ? e.message : String(e));
    }
  }
}
