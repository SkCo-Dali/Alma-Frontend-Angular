// Tarjeta de una base del buzón (prototipo baseCard + baseGrid): archivo y hoja,
// origen, filas, cuántas filas tienen problemas para la asignación, qué otros grupos
// la usan y el estado de la última carga (cargada, sincronizada o cambio rechazado
// con su motivo). «Ver datos y problemas» despliega la hoja en solo lectura con lo
// que afecta la asignación en ámbar y «Vincular a…» para los responsables que no se
// reconocen en el equipo. «Actualizar base» lo resuelve el padre (modal mBase).

import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { Base, BuzonApi, FilaBase, Grupo, Persona, ReglaAsignacion } from './buzon.api';
import { normaliza, reconocer } from './buzon-asignacion';

/** Una búsqueda que usa la base: el grupo y la regla. */
export interface UsoBase {
  grupo: Grupo;
  regla: ReglaAsignacion;
}

/** [mensaje, se puede vincular] por columna con problema. */
type Problemas = Map<string, [string, boolean]>;

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letra = (i: number) => (i < 26 ? LETRAS[i] : LETRAS[Math.floor(i / 26) - 1] + LETRAS[i % 26]);

/** «hoy 08:50» o «3 oct» (prototipo: sync). */
export function cuandoCargada(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const hoy = new Date();
  const hh = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
  return d.toDateString() === hoy.toDateString() ? `hoy ${hh}` : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

@Component({
  selector: 'alma-base-card',
  imports: [FormsModule, LucideAngularModule],
  styleUrls: ['./buzon-proto.css'],
  template: `
    @let f = base();
    <div class="sunk r-xl stack" style="padding:10px 12px;gap:8px" [style.box-shadow]="abierta() ? '0 0 0 2px var(--ring)' : null">
      <div class="row between" style="align-items:flex-start">
        <div style="min-width:0">
          <p class="sm b"><lucide-icon name="sheet" [size]="13" /> {{ f.nombre }} @if (f.archivo) { <span class="xxs muted mono">{{ f.archivo }}@if (f.hoja) { · hoja «{{ f.hoja }}»}</span> }</p>
          <p class="xxs muted">
            {{ f.origen === 'sharepoint' ? 'SharePoint' : 'Archivo subido' }} · {{ f.total_filas.toLocaleString('es-CO') }} filas ·
            @if (conProblemas()) { <b style="color:var(--amber)">{{ conProblemas() }} con problemas</b> } @else { sin problemas }
            @if (otros().length) { · también la usa: {{ otros().join(', ') }} }
          </p>
        </div>
        @if (f.motivo || f.estado === 'rechazado') {
          <span class="badge b-rose"><lucide-icon name="x-circle" [size]="13" /> Cambio rechazado</span>
        } @else if (f.estado === 'ok') {
          <span class="badge b-emerald"><lucide-icon name="check" [size]="13" /> {{ f.origen === 'archivo' ? 'Cargada' : 'Sincronizada' }} {{ cuando(f.cargada_en) }}</span>
        } @else {
          <span class="badge b-slate">Sin cargar</span>
        }
      </div>
      @if (f.motivo) {
        <p class="note b-rose"><lucide-icon name="x-circle" [size]="13" /> <span>{{ f.motivo }}</span></p>
      }
      <div class="row">
        <button type="button" class="btn outline sm" [attr.aria-expanded]="abierta()" (click)="alternar()">
          <lucide-icon [name]="abierta() ? 'chevron-up' : 'table'" [size]="13" /> {{ abierta() ? 'Ocultar datos' : 'Ver datos y problemas' + (conProblemas() ? ' (' + conProblemas() + ')' : '') }}
        </button>
        @if (puede()) {
          <button type="button" class="btn outline sm" (click)="actualizar.emit(f)"><lucide-icon name="refresh-cw" [size]="13" /> Actualizar base</button>
        }
        @if (f.origen === 'sharepoint' && f.sharepoint_url) {
          <a class="btn ghost" [href]="f.sharepoint_url" target="_blank" rel="noopener noreferrer" aria-label="Abrir en Excel" title="Abrir en Excel"><lucide-icon name="external-link" [size]="16" /></a>
        }
        <ng-content />
      </div>

      @if (abierta()) {
        <div class="stack" style="gap:8px;border-top:1px solid var(--border);padding-top:10px">
          <div class="row between">
            <p class="xs muted">Solo lectura · {{ f.total_filas.toLocaleString('es-CO') }} filas (muestra de {{ filas().length }}) · en ámbar lo que afecta la asignación</p>
            <div class="row">
              <label class="search sunk" [attr.for]="'qg-' + f.id" style="height:30px"><lucide-icon name="search" [size]="13" class="muted" /><input [id]="'qg-' + f.id" type="search" placeholder="Buscar en la tabla" [ngModel]="qg()" (change)="qg.set($any($event.target).value)" /></label>
              <label class="row xs" [attr.for]="'sp-' + f.id"><input type="checkbox" [id]="'sp-' + f.id" [checked]="soloProb()" (change)="soloProb.set($any($event.target).checked)" /> Solo filas con problemas ({{ conProblemas() }})</label>
            </div>
          </div>
          <div class="sheet-wrap">
            <div class="grid-scroll" style="max-height:300px">
              <table class="sheet">
                <tr>
                  <th class="rh"></th>
                  @for (c of f.columnas; track $index; let i = $index) {
                    <th>{{ letra(i) }} · {{ c }}@if (usadas()[c]; as u) { <span class="use">{{ u }}</span> }</th>
                  }
                </tr>
                @for (x of visibles(); track x.i) {
                  <tr>
                    <td class="rh">{{ x.i + filaDatos() }}</td>
                    @for (c of f.columnas; track $index) {
                      @let p = x.p.get(c);
                      <td [class.prob]="!!p" [attr.title]="p ? p[0] : null">
                        {{ x.r[c] }}
                        @if (p) {
                          <span class="xxs" style="color:var(--amber)">⚠ {{ p[0] }}</span>
                          @if (p[1] && puede()) {
                            <select class="input sm" style="min-width:170px;margin-top:4px" [attr.aria-label]="'Vincular ' + x.r[c]" [disabled]="vinculando()" (change)="vincular(x.r[c], $any($event.target).value)">
                              <option value="">Vincular a…</option>
                              @for (p2 of equipo(); track p2.id) { <option [value]="p2.correo">{{ p2.nombre }}</option> }
                            </select>
                          }
                        }
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr><td class="rh"></td><td [attr.colspan]="f.columnas.length || 1" class="xs muted">{{ cargando() ? 'Leyendo la base…' : 'Sin filas para mostrar.' }}</td></tr>
                }
              </table>
            </div>
          </div>
          @if (vinculos().length) {
            <p class="xxs muted"><lucide-icon name="link" [size]="13" /> Vínculos guardados en esta base: {{ vinculos().join(' · ') }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class BaseCardComponent {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly base = input.required<Base>();
  readonly equipo = input<Persona[]>([]);
  /** Búsquedas (de todos los grupos del buzón) que usan esta base. */
  readonly usos = input<UsoBase[]>([]);
  /** Grupo desde el que se muestra (los demás salen en «también la usa»). */
  readonly grupoActual = input<Grupo | null>(null);
  readonly puede = input(true);
  readonly baseChange = output<Base>();
  readonly actualizar = output<Base>();

  protected readonly letra = letra;
  protected readonly cuando = cuandoCargada;
  protected readonly abierta = signal(false);
  protected readonly soloProb = signal(false);
  protected readonly qg = signal('');
  protected readonly filas = signal<FilaBase[]>([]);
  protected readonly cargando = signal(false);
  protected readonly vinculando = signal(false);

  private readonly activas = computed(() => this.usos().filter((u) => u.regla.activa));
  protected readonly otros = computed(() => [
    ...new Set(this.usos().filter((u) => u.grupo.id !== this.grupoActual()?.id).map((u) => u.grupo.nombre)),
  ]);
  protected readonly usadas = computed(() => {
    const out: Record<string, string> = {};
    this.activas().forEach(({ regla: r }) => {
      r.cruces.forEach((c) => (out[c.columna] = 'cruce'));
      out[r.col_responsable] = 'resp.';
      if (r.col_respaldo) out[r.col_respaldo] = 'resp.';
    });
    return out;
  });
  protected readonly filaDatos = computed(() => (this.base().fila_encabezado ?? 1) + 1);

  /** Prototipo problemasG: lo que hace que una fila no sirva para asignar. */
  private readonly problemas = computed<Problemas[]>(() => {
    const filas = this.filas();
    const b = this.base();
    return filas.map((row) => {
      const out: Problemas = new Map();
      this.activas().forEach(({ regla: r }) => {
        const ri = r.col_responsable;
        if (b.columnas.includes(ri) && !out.has(ri)) {
          if (!row[ri]) out.set(ri, ['vacío → siguiente regla', false]);
          else if (!reconocer(row[ri], this.equipo(), b.vinculos)) out.set(ri, ['no reconocido en el equipo', true]);
        }
        r.cruces.forEach((cz) => {
          const ci = cz.columna;
          if (!b.columnas.includes(ci) || out.has(ci)) return;
          if (!row[ci] || row[ci] === '0') out.set(ci, ['sin valor', false]);
          else if (!normaliza(row[ci], cz.comparacion)) out.set(ci, ['no tiene el formato de la comparación', false]);
          else {
            const k = normaliza(row[ci], cz.comparacion);
            const d = new Set(filas.filter((x) => normaliza(x[ci], cz.comparacion) === k).map((x) => x[ri]).filter(Boolean));
            if (d.size > 1) out.set(ci, ['valor repetido con responsables distintos', false]);
          }
        });
      });
      return out;
    });
  });
  protected readonly conProblemas = computed(() => this.problemas().filter((p) => p.size).length);
  protected readonly visibles = computed(() => {
    const q = this.qg().trim().toLowerCase();
    const probs = this.problemas();
    return this.filas()
      .map((r, i) => ({ r, i, p: probs[i] ?? new Map() }))
      .filter((x) => (!this.soloProb() || x.p.size) && (!q || Object.values(x.r).join(' ').toLowerCase().includes(q)));
  });
  protected readonly vinculos = computed(() =>
    Object.entries(this.base().vinculos ?? {}).map(([v, correo]) => `${v} = ${reconocer(correo, this.equipo())?.nombre ?? correo}`),
  );

  constructor() {
    // Lee las filas al mostrar la tarjeta y cada vez que cambia la carga de la base.
    let clave = '';
    effect(() => {
      const b = this.base();
      const k = `${b.id}|${b.cargada_en}|${b.total_filas}`;
      if (k === clave) return;
      clave = k;
      void this.cargarFilas();
    });
  }

  private async cargarFilas(): Promise<void> {
    const b = this.base();
    if (!b.columnas.length) return this.filas.set([]);
    this.cargando.set(true);
    try {
      this.filas.set((await this.api.filasBase(b.id, undefined, 500)).items);
    } catch {
      this.filas.set([]);
    } finally {
      this.cargando.set(false);
    }
  }

  protected alternar(): void {
    this.abierta.update((x) => !x);
    if (this.abierta()) {
      this.soloProb.set(!!this.conProblemas());
      this.qg.set('');
    }
  }

  protected async vincular(valor: string, correo: string): Promise<void> {
    if (!correo) return;
    this.vinculando.set(true);
    try {
      const b = await this.api.vincular(this.base().id, valor, correo);
      this.baseChange.emit(b);
      const p = this.equipo().find((x) => x.correo === correo);
      this.toast.show(`«${valor}» vinculado a ${p?.nombre ?? correo} en ${b.nombre}`);
    } catch (e) {
      this.toast.error('No se pudo vincular', e instanceof Error ? e.message : String(e));
    } finally {
      this.vinculando.set(false);
    }
  }
}
