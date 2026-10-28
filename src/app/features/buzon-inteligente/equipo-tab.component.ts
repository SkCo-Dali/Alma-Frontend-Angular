// «Asignación › Equipo» (prototipo subEquipo + mPersona + mQuitar + mImport): las
// personas que reciben correos del buzón, una columna por grupo que asigna a
// personas. Recibe correos de un grupo si está disponible y su membresía en ese
// grupo está activa. Los interruptores guardan al instante (PATCH); agregar, quitar,
// cambiar carpeta, editar o importar reemplaza el equipo completo (PUT).

import { Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AccesosApi } from '../../core/services/accesos.api';
import { ToastService } from '../../core/services/toast.service';
import { AlDesactivar, Buzon, BuzonApi, DisponibilidadIn, Grupo, MembresiaGrupo, Persona, PersonaIn } from './buzon.api';
import { aPersonaIn } from './buzon-asignacion';
import { BUZON_PROTO_CSS } from './buzon-proto.styles';
import { iniciales, nombresDirectorio, parseCorreos, personaNueva, sinActivosTxt } from './asignacion-ui';
import { CarpetaPlana, CarpetaSelectComponent } from './carpeta-select.component';
import { ImportEquipoComponent } from './import-equipo.component';

interface EdicionPersona {
  id: string;
  carpeta: string | null;
  disponible: boolean;
  grupos: Record<string, MembresiaGrupo>;
}

@Component({
  selector: 'alma-equipo-tab',
  imports: [FormsModule, LucideAngularModule, CarpetaSelectComponent, ImportEquipoComponent],
  styles: [BUZON_PROTO_CSS, `:host { display: contents; }`],
  template: `
    <div class="glass r-2xl" style="overflow:hidden">
      <div class="row between" style="padding:14px 16px">
        <div>
          <h2 class="sm b">Equipo · columnas = grupos que asignan a personas</h2>
          <p class="xs muted">Recibe correos de un grupo si está disponible y su membresía en ese grupo está activa. En las bases se reconoce por su correo o su nombre.</p>
        </div>
        @if (puede()) {
          <div class="row"><button type="button" class="btn outline sm" (click)="importando.set(true)"><lucide-icon name="file-up" [size]="13" /> Importar hoja</button></div>
        }
      </div>
      @if (puede()) {
        <div class="row" style="padding:0 16px 12px;flex-wrap:nowrap">
          <input class="input sm" id="eq-mail" placeholder="Escribe o pega correos (separados por coma o salto de línea)…" aria-label="Correos a agregar" [(ngModel)]="correos" (keydown.enter)="$event.preventDefault(); agregar()" autocomplete="off" />
          <button type="button" class="btn primary sm" [disabled]="guardando()" (click)="agregar()"><lucide-icon name="user-plus" [size]="13" /> Agregar</button>
        </div>
        @if (eqErr().length) {
          <div class="note b-rose" style="margin:0 16px 12px;display:grid">@for (x of eqErr(); track $index) { <span>• {{ x }}</span> }</div>
        }
      }
      <div class="scroll-x">
        <table class="t">
          <thead>
            <tr>
              <th class="num">#</th><th>Persona</th><th>Carpeta en el buzón</th><th>Disponibilidad</th>
              @for (g of gs(); track g.id) { <th>{{ g.nombre }}</th> }
              <th class="num">Carga hoy</th><th></th>
            </tr>
          </thead>
          <tbody>
            @for (p of equipo(); track p.id + ':' + version(); let n = $index) {
              <tr>
                <td class="num xs muted">{{ n + 1 }}</td>
                <td>
                  <div class="row" style="flex-wrap:nowrap">
                    <span class="avatar s">{{ iniciales(p.nombre) }}</span>
                    <div><b class="sm">{{ p.nombre }}</b><p class="xxs muted">{{ p.correo }}</p></div>
                  </div>
                </td>
                <td>
                  @if (puede()) {
                    <alma-carpeta-select [carpetas]="carpetas()" [valor]="p.carpeta" (valorChange)="cambiarCarpeta(p, $event)" vacia="Sin carpeta (vigilada)" [disabled]="guardando()" />
                  } @else {
                    <span class="xs"><lucide-icon name="folder" [size]="13" /> {{ p.carpeta || 'Sin carpeta' }}</span>
                  }
                </td>
                <td>
                  @if (p.disponible) { <span class="badge b-emerald">Disponible</span> } @else { <span class="badge b-amber">Ausente</span> }
                </td>
                @if (ninguno(p)) {
                  <td [attr.colspan]="gs().length">
                    <div class="row" style="gap:6px">
                      <span class="xs" style="color:var(--amber)">¿Qué grupos atiende?</span>
                      @for (g of gs(); track g.id) { <button type="button" class="chipo" [disabled]="!puede() || ocupado() === p.id" (click)="patch(p, { grupo_id: g.id, activa: true })">+ {{ g.nombre }}</button> }
                    </div>
                  </td>
                } @else {
                  @for (g of gs(); track g.id) {
                    @let m = p.grupos[g.id];
                    @if (!m) {
                      <td><button type="button" class="chipo" [attr.aria-label]="'Agregar a ' + g.nombre" [disabled]="!puede() || ocupado() === p.id" (click)="patch(p, { grupo_id: g.id, activa: true })">+</button></td>
                    } @else {
                      <td>
                        <div class="row" style="flex-wrap:nowrap;gap:6px">
                          <button type="button" class="sw" role="switch" [attr.aria-checked]="m.activa" [attr.aria-label]="p.nombre + ' en ' + g.nombre" [disabled]="!puede() || ocupado() === p.id" (click)="patch(p, { grupo_id: g.id, activa: !m.activa })"></button>
                          <span class="xxs muted">{{ respaldoTxt(m) }}</span>
                        </div>
                      </td>
                    }
                  }
                }
                <td class="num">{{ p.carga_hoy }}</td>
                <td style="white-space:nowrap">
                  @if (puede()) {
                    <button type="button" class="btn ghost" [attr.aria-label]="'Editar ' + p.nombre" (click)="editar(p)"><lucide-icon name="pencil" [size]="16" /></button>
                    <button type="button" class="btn ghost danger" [attr.aria-label]="'Quitar ' + p.nombre" (click)="quitando.set(p)"><lucide-icon name="user-minus" [size]="16" /></button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="9" class="xs muted">Sin personas. Escribe sus correos arriba o importa la hoja.</td></tr>
            }
          </tbody>
        </table>
      </div>
      @for (g of gruposSinActivos(); track g.id) {
        <p class="note b-amber" style="margin:0 16px 12px"><lucide-icon name="user-x" [size]="13" /> <span>Nadie activo atiende <b>{{ g.nombre }}</b>: sus correos {{ sinActivos(g) }}.</span></p>
      }
    </div>
    <div class="glass r-xl row" style="padding:8px 12px;font-size:.78rem;justify-self:start">
      <label class="muted" for="desact">Al desactivar a alguien</label>
      <select class="input sm" id="desact" style="width:auto" [disabled]="!puede()" [ngModel]="alDesactivar()" (ngModelChange)="cambiarAlDesactivar($event)">
        <option value="respaldo">Respaldo fijo</option>
        <option value="roundrobin">Round-robin entre activos</option>
      </select>
    </div>

    <!-- Editar persona (mPersona) -->
    @if (edicion(); as e) {
      @let p = personaDe(e.id);
      <div class="scrim side" (click)="edicion.set(null)">
        <aside class="panel solid" role="dialog" aria-modal="true" aria-label="Editar persona" (click)="$event.stopPropagation()">
          <div class="row between">
            <div><h2 class="sm b">Editar · {{ p?.nombre }}</h2><p class="xs muted">{{ p?.correo }}</p></div>
            <button type="button" class="btn ghost" aria-label="Cerrar" (click)="edicion.set(null)"><lucide-icon name="x" [size]="16" /></button>
          </div>
          <div class="fld">
            <span class="label">Carpeta en el buzón</span>
            <alma-carpeta-select [carpetas]="carpetas()" [(valor)]="e.carpeta" vacia="Sin carpeta (queda en la carpeta vigilada)" />
            <span class="xxs muted">Carpetas leídas del buzón con la conexión vigente.</span>
          </div>
          <div class="fld">
            <label class="label" for="pe-disp">Disponibilidad</label>
            <select class="input" id="pe-disp" [(ngModel)]="e.disponible">
              <option [ngValue]="true">Disponible</option>
              <option [ngValue]="false">Ausente</option>
            </select>
          </div>
          <div class="stack" style="gap:8px">
            <p class="label">Grupos que atiende</p>
            @for (g of gs(); track g.id) {
              @let mm = e.grupos[g.id];
              <div class="sunk r-xl" style="padding:10px 12px;display:grid;gap:8px">
                <div class="row between">
                  <label class="row sm b" [attr.for]="'pm-' + g.id"><input type="checkbox" [id]="'pm-' + g.id" [checked]="!!mm" (change)="alternarGrupo(e, g.id)" /> {{ g.nombre }}</label>
                  @if (mm) {
                    <span class="row xs">Activa <button type="button" class="sw" role="switch" [attr.aria-checked]="mm.activa" [attr.aria-label]="'Activa en ' + g.nombre" (click)="mm.activa = !mm.activa"></button></span>
                  }
                </div>
                @if (mm) {
                  <div class="fld">
                    <label class="label" [attr.for]="'pr-' + g.id">Respaldo en {{ g.nombre }}</label>
                    <select class="input sm" [id]="'pr-' + g.id" [(ngModel)]="mm.respaldo_id">
                      <option [ngValue]="null">Sin respaldo</option>
                      @for (t of equipo(); track t.id) { @if (t.id !== e.id) { <option [ngValue]="t.id">{{ t.nombre }}</option> } }
                    </select>
                  </div>
                }
              </div>
            }
          </div>
          <div class="row" style="justify-content:flex-end">
            <button type="button" class="btn outline" (click)="edicion.set(null)">Cancelar</button>
            <button type="button" class="btn primary" [disabled]="guardando()" (click)="guardarPersona(e)"><lucide-icon name="save" [size]="16" /> Guardar</button>
          </div>
        </aside>
      </div>
    }

    <!-- Quitar persona (mQuitar) -->
    @if (quitando(); as p) {
      <div class="scrim" (click)="quitando.set(null)">
        <div class="modal solid sm" role="dialog" aria-modal="true" aria-label="Quitar persona" (click)="$event.stopPropagation()">
          <h2 class="sm b">¿Quitar a {{ p.nombre }} del buzón?</h2>
          <p class="sm">Tiene <b>{{ p.abiertos }} casos abiertos</b>. Con el parámetro actual ({{ alDesactivar() === 'respaldo' ? 'respaldo fijo' : 'round-robin' }}) se {{ alDesactivar() === 'respaldo' ? 'pasan a su respaldo en cada grupo' : 'reparten entre los activos de cada grupo' }}.</p>
          <p class="xs muted">Su historial y las asignaciones pasadas se conservan para auditoría.</p>
          <div class="row" style="justify-content:flex-end">
            <button type="button" class="btn outline" (click)="quitando.set(null)">Cancelar</button>
            <button type="button" class="btn primary" style="background:var(--rose)" [disabled]="guardando()" (click)="quitar(p)"><lucide-icon name="user-minus" [size]="16" /> Quitar y redistribuir</button>
          </div>
        </div>
      </div>
    }

    <!-- Importar hoja (mImport) -->
    @if (importando()) {
      <div class="scrim" (click)="importando.set(false)">
        <div class="modal solid xl" role="dialog" aria-modal="true" aria-label="Importar hoja" (click)="$event.stopPropagation()">
          <div class="row between">
            <div><h2 class="sm b">Importar hoja del equipo</h2></div>
            <button type="button" class="btn ghost" aria-label="Cerrar" (click)="importando.set(false)"><lucide-icon name="x" [size]="16" /></button>
          </div>
          <alma-import-equipo [buzonId]="buzon().id" [grupos]="gs()" [equipo]="equipo()" [carpetas]="carpetas()" idp="eq-imp" (importado)="equipo.set($event); importando.set(false)" />
        </div>
      </div>
    }
  `,
})
export class EquipoTabComponent {
  private readonly api = inject(BuzonApi);
  private readonly accesos = inject(AccesosApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  readonly grupos = input<Grupo[]>([]);
  readonly carpetas = input<CarpetaPlana[]>([]);
  readonly equipo = model<Persona[]>([]);

  protected readonly iniciales = iniciales;
  protected readonly guardando = signal(false);
  protected readonly ocupado = signal<string | null>(null);
  /** Sube cuando un guardado falla: recrea las filas para devolver los controles a su estado. */
  protected readonly version = signal(0);
  protected readonly eqErr = signal<string[]>([]);
  protected correos = '';
  protected readonly edicion = signal<EdicionPersona | null>(null);
  protected readonly quitando = signal<Persona | null>(null);
  protected readonly importando = signal(false);
  /** Parámetro del buzón «Al desactivar a alguien» (se guarda al cambiarlo). */
  private readonly alDesactivarLocal = signal<AlDesactivar | null>(null);
  protected readonly alDesactivar = computed(() => this.alDesactivarLocal() ?? this.buzon().al_desactivar);

  protected readonly puede = computed(() => this.buzon().puede_administrar);
  protected readonly gs = computed(() => this.grupos().filter((g) => g.destino === 'personas'));
  protected readonly gruposSinActivos = computed(() => this.gs().filter((g) => !this.equipo().some((p) => p.disponible && p.grupos[g.id]?.activa)));

  protected ninguno(p: Persona): boolean {
    return !!this.gs().length && !this.gs().some((g) => p.grupos[g.id]);
  }

  protected respaldoTxt(m: MembresiaGrupo): string {
    const r = this.equipo().find((x) => x.id === m.respaldo_id);
    return r ? `resp. ${r.nombre.split(' ')[0]}` : '';
  }

  protected sinActivos(g: Grupo): string {
    return sinActivosTxt(g, this.equipo());
  }

  protected personaDe(id: string): Persona | undefined {
    return this.equipo().find((p) => p.id === id);
  }

  // ── Cambios rápidos (PATCH) ──
  protected async patch(p: Persona, body: DisponibilidadIn): Promise<void> {
    this.ocupado.set(p.id);
    try {
      this.equipo.set(await this.api.cambiarDisponibilidad(p.id, body));
    } catch (e) {
      this.toast.error('No se pudo guardar el cambio', e instanceof Error ? e.message : String(e));
      this.version.update((v) => v + 1);
    } finally {
      this.ocupado.set(null);
    }
  }

  // ── Cambios del equipo completo (PUT) ──
  private async guardarTodo(personas: PersonaIn[], ok?: string): Promise<boolean> {
    this.guardando.set(true);
    try {
      this.equipo.set(await this.api.guardarEquipo(this.buzon().id, personas));
      if (ok) this.toast.show(ok);
      return true;
    } catch (e) {
      this.toast.error('No se pudo guardar el equipo', e instanceof Error ? e.message : String(e));
      this.version.update((v) => v + 1);
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  private todos(): PersonaIn[] {
    const equipo = this.equipo();
    return equipo.map((p) => aPersonaIn(p, equipo));
  }

  protected cambiarCarpeta(p: Persona, carpeta: string | null): void {
    if ((p.carpeta ?? null) === carpeta) return;
    const personas = this.todos().map((x) => (x.correo === p.correo ? { ...x, carpeta } : x));
    void this.guardarTodo(personas, `${p.nombre}: ${carpeta ? `carpeta «${carpeta}»` : 'sin carpeta: queda en la carpeta vigilada'}`);
  }

  protected async agregar(): Promise<void> {
    const r = parseCorreos(this.correos, this.equipo().map((p) => p.correo));
    this.eqErr.set(r.err);
    if (!r.ok.length) return;
    const nombres = await nombresDirectorio(this.accesos, r.ok);
    const ok = await this.guardarTodo(
      [...this.todos(), ...r.ok.map((c) => personaNueva(c, nombres[c]))],
      `${r.ok.length} persona(s) agregada(s): marca qué grupos atiende`,
    );
    if (ok) this.correos = '';
  }

  // ── Editar persona ──
  protected editar(p: Persona): void {
    this.edicion.set({
      id: p.id,
      carpeta: p.carpeta,
      disponible: p.disponible,
      grupos: Object.fromEntries(Object.entries(p.grupos).map(([k, m]) => [k, { ...m }])),
    });
  }

  protected alternarGrupo(e: EdicionPersona, gid: string): void {
    const grupos = { ...e.grupos };
    if (grupos[gid]) delete grupos[gid];
    else grupos[gid] = { activa: true, respaldo_id: null };
    this.edicion.set({ ...e, grupos });
  }

  protected async guardarPersona(e: EdicionPersona): Promise<void> {
    const p = this.personaDe(e.id);
    if (!p) return;
    const correoDe = (id: string | null) => this.equipo().find((x) => x.id === id)?.correo ?? null;
    const personas = this.todos().map((x) =>
      x.correo === p.correo
        ? {
            ...x,
            carpeta: e.carpeta,
            disponible: e.disponible,
            grupos: Object.fromEntries(Object.entries(e.grupos).map(([k, m]) => [k, { activa: m.activa, respaldo: correoDe(m.respaldo_id) }])),
          }
        : x,
    );
    if (await this.guardarTodo(personas, `Cambios guardados para ${p.nombre}`)) this.edicion.set(null);
  }

  protected async quitar(p: Persona): Promise<void> {
    const ok = await this.guardarTodo(
      this.todos().filter((x) => x.correo !== p.correo),
      `${p.nombre} quitada · ${p.abiertos} casos redistribuidos`,
    );
    if (ok) this.quitando.set(null);
  }

  protected async cambiarAlDesactivar(v: AlDesactivar): Promise<void> {
    const antes = this.alDesactivar();
    this.alDesactivarLocal.set(v);
    try {
      await this.api.actualizarBuzon(this.buzon().id, { al_desactivar: v });
      this.toast.show(v === 'respaldo' ? 'Al desactivar: respaldo fijo' : 'Al desactivar: round-robin');
    } catch (e) {
      this.alDesactivarLocal.set(antes);
      this.toast.error('No se pudo guardar el parámetro', e instanceof Error ? e.message : String(e));
    }
  }
}
