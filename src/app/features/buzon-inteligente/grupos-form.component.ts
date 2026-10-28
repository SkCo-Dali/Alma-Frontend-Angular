// Formulario de grupos (prototipo gruposForm): cómo se reparten las etiquetas en
// grupos — uno solo, uno por proceso, uno por etiqueta o personalizado. Lo usan el
// modal «Editar grupos» de la pestaña Asignación y el paso 3 del asistente. Trabaja
// sobre un borrador (EstadoGrupos); quien lo usa decide cuándo guardarlo.

import { Component, computed, input, model } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { EstadoGrupos, EtiquetaProceso, GrupoBorrador, ModoGrupos, gruposPorModo } from './asignacion-ui';

const MODOS: [ModoGrupos, string][] = [
  ['uno', 'Un solo grupo para todo el buzón'],
  ['proceso', 'Un grupo por proceso'],
  ['etiqueta', 'Un grupo por etiqueta'],
  ['custom', 'Personalizado: yo armo los grupos'],
];

@Component({
  selector: 'alma-grupos-form',
  imports: [LucideAngularModule],
  styleUrls: ['./buzon-proto.css'],
  styles: [`:host { display: contents; }`],
  template: `
    @let s = st();
    <div class="stack" style="gap:6px">
      @for (m of modos; track m[0]) {
        <label class="row sm" [attr.for]="idp() + '-' + m[0]"><input type="radio" [name]="idp()" [id]="idp() + '-' + m[0]" [checked]="s.modo === m[0]" (change)="elegirModo(m[0])" /> {{ m[1] }}</label>
      }
    </div>
    @if (s.modo === 'custom') {
      <div class="row" style="gap:6px">
        @for (g of s.grupos; track g.key; let i = $index) {
          <span class="chipo"><input class="input sm" style="width:150px;height:24px" [value]="g.nombre" aria-label="Nombre del grupo" (change)="renombrar(i, $any($event.target).value)" /> <button type="button" class="mini" aria-label="Quitar grupo" (click)="quitar(i)">×</button></span>
        }
        <button type="button" class="btn outline sm" (click)="agregar()"><lucide-icon name="plus" [size]="13" /> Grupo</button>
      </div>
      <div class="scroll-x">
        <table class="t">
          <thead><tr><th>Etiqueta detectada</th><th>Proceso</th><th>Va al grupo</th></tr></thead>
          <tbody>
            @for (e of ets(); track e[0]) {
              <tr>
                <td class="mono xs">{{ e[0] }}</td>
                <td class="xs">{{ e[1] }}</td>
                <td>
                  <select class="input sm" [attr.aria-label]="'Grupo de ' + e[0]" (change)="mover(e[0], $any($event.target).value)">
                    <option value="" [selected]="indiceDe(e[0]) < 0">Sin grupo</option>
                    @for (g of s.grupos; track g.key; let i = $index) { <option [value]="i" [selected]="indiceDe(e[0]) === i">{{ g.nombre }}</option> }
                  </select>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="row" style="gap:6px">
        @for (g of s.grupos; track g.key) { <span class="chipo"><lucide-icon name="layers" [size]="13" /> {{ g.nombre }} · {{ g.etiquetas.length }} etiqueta(s)</span> }
      </div>
    }
    @if (sinGrupo().length) {
      <p class="note b-amber"><lucide-icon name="alert-triangle" [size]="13" /> <span>{{ sinGrupo().join(', ') }} no tiene grupo: sus correos quedarían sin asignar.</span></p>
    }
  `,
})
export class GruposFormComponent {
  readonly ets = input<EtiquetaProceso[]>([]);
  readonly st = model.required<EstadoGrupos>();
  /** Prefijo de los id de los radios (debe ser único en la página). */
  readonly idp = input('gm');

  protected readonly modos = MODOS;
  protected readonly sinGrupo = computed(() =>
    this.ets()
      .filter((e) => !this.st().grupos.some((g) => g.etiquetas.includes(e[0])))
      .map((e) => e[0]),
  );

  protected indiceDe(et: string): number {
    return this.st().grupos.findIndex((g) => g.etiquetas.includes(et));
  }

  private poner(grupos: GrupoBorrador[], modo = this.st().modo): void {
    this.st.set({ modo, grupos });
  }

  protected elegirModo(modo: ModoGrupos): void {
    const s = this.st();
    if (modo !== 'custom') this.poner(gruposPorModo(modo, this.ets(), s.grupos), modo);
    else this.poner(s.grupos.length ? s.grupos : gruposPorModo('proceso', this.ets(), []), modo);
  }

  protected renombrar(i: number, nombre: string): void {
    this.poner(this.st().grupos.map((g, j) => (j === i ? { ...g, nombre } : g)));
  }

  protected quitar(i: number): void {
    this.poner(this.st().grupos.filter((_, j) => j !== i));
  }

  protected agregar(): void {
    const n = this.st().grupos.length + 1;
    this.poner([
      ...this.st().grupos,
      { id: null, key: `G${n}_${Date.now() % 1000}`, nombre: `Grupo ${n}`, etiquetas: [], destino: 'personas', carpeta: null },
    ]);
  }

  protected mover(et: string, destino: string): void {
    const grupos = this.st().grupos.map((g) => ({ ...g, etiquetas: g.etiquetas.filter((x) => x !== et) }));
    if (destino !== '') grupos[Number(destino)].etiquetas.push(et);
    this.poner(grupos);
  }
}
