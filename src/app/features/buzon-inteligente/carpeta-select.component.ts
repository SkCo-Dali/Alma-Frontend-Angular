// Selector de carpetas del buzón (prototipo folderSel): carpetas leídas de Outlook
// con la conexión vigente. Nunca se supone una carpeta: se elige de la lista. Si el
// valor guardado ya no existe en el buzón se muestra marcado para que lo corrijan.
// Si hay VARIAS carpetas con el mismo nombre (p. ej. «2026 › NOVIEMBRE» en la raíz y
// dentro de la bandeja), se guarda la ruta completa «Bandeja de entrada/2026/NOVIEMBRE»
// para que el correo llegue a la carpeta exacta que se eligió.

import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CarpetaGraph } from './buzon.api';

export interface CarpetaPlana {
  nombre: string;
  nivel: number;
  total: number;
  /** Lo que se guarda: el nombre, o la ruta completa si el nombre se repite. */
  valor?: string;
  /** Carpetas que la contienen («Bandeja de entrada › 2026»), '' en la raíz. */
  padre?: string;
  repetida?: boolean;
}

/** Separador de la ruta que entiende el backend (buzon_graph.SEPARADOR_RUTA). */
export const SEPARADOR_RUTA = '/';

/** Árbol de Graph (todas las subcarpetas) → lista plana para un <select>. */
export function aplanarCarpetas(arbol: CarpetaGraph[]): CarpetaPlana[] {
  const plana: (CarpetaPlana & { camino: string[] })[] = [];
  const recorrer = (nodos: CarpetaGraph[], camino: string[]): void =>
    nodos.forEach((c) => {
      plana.push({ nombre: c.nombre, nivel: camino.length, total: c.total, camino });
      recorrer(c.hijas ?? [], [...camino, c.nombre]);
    });
  recorrer(arbol, []);
  const veces = new Map<string, number>();
  plana.forEach((c) => veces.set(c.nombre.trim().toLowerCase(), (veces.get(c.nombre.trim().toLowerCase()) ?? 0) + 1));
  return plana.map(({ camino, ...c }) => {
    const repetida = (veces.get(c.nombre.trim().toLowerCase()) ?? 0) > 1;
    return { ...c, repetida, padre: camino.join(' › '), valor: repetida ? [...camino, c.nombre].join(SEPARADOR_RUTA) : c.nombre };
  });
}

/** Valor que se guarda para una carpeta de la lista. */
export function valorCarpeta(c: CarpetaPlana): string {
  return c.valor ?? c.nombre;
}

/** Texto legible de un valor guardado: «Bandeja de entrada/2026/NOVIEMBRE» → «NOVIEMBRE (Bandeja de entrada › 2026)». */
export function textoCarpeta(v: string | null | undefined): string {
  if (!v || !v.includes(SEPARADOR_RUTA)) return v ?? '';
  const partes = v.split(SEPARADOR_RUTA);
  return `${partes.at(-1)} (${partes.slice(0, -1).join(' › ')})`;
}

/** Sangría de un <option> según la profundidad: los espacios normales se colapsan. */
export function sangria(nivel: number): string {
  return nivel ? '   '.repeat(nivel - 1) + '— ' : '';
}

@Component({
  selector: 'alma-carpeta-select',
  imports: [FormsModule],
  styleUrls: ['./buzon-proto.css'],
  styles: [`:host { display: contents; }`],
  template: `
    <select
      class="input sm"
      [style.min-width]="compacto() ? null : '200px'"
      [attr.aria-label]="ariaLabel()"
      [attr.id]="inputId() || null"
      [disabled]="disabled()"
      [ngModel]="valor() ?? ''"
      (ngModelChange)="valor.set($event || null)"
    >
      <option value="">{{ vacia() }}</option>
      @for (c of carpetas(); track $index) {
        <option [value]="valorCarpeta(c)">{{ sangria(c.nivel) }}{{ c.nombre }}{{ c.repetida ? '  · en ' + (c.padre || 'la raíz') : '' }}</option>
      }
      @if (huerfana(); as h) {
        <option [value]="h.valor">⚠ {{ h.texto }}</option>
      } @else if (!carpetas().length && valor()) {
        <option [value]="valor()">{{ textoCarpeta(valor()) }}</option>
      }
    </select>
  `,
})
export class CarpetaSelectComponent {
  protected readonly sangria = sangria;
  protected readonly valorCarpeta = valorCarpeta;
  protected readonly textoCarpeta = textoCarpeta;
  readonly carpetas = input<CarpetaPlana[]>([]);
  readonly valor = model<string | null>(null);
  readonly vacia = input('Elige la carpeta…');
  readonly ariaLabel = input('Carpeta del buzón');
  readonly inputId = input('');
  readonly disabled = input(false);
  readonly compacto = input(false);

  protected readonly huerfana = computed(() => {
    const v = this.valor();
    const lista = this.carpetas();
    // Sin lista (buzón sin conexión) no se puede afirmar que no exista.
    if (!v || !lista.length || lista.some((c) => valorCarpeta(c) === v)) return null;
    const repetida = lista.some((c) => c.repetida && c.nombre.trim().toLowerCase() === v.trim().toLowerCase());
    return { valor: v, texto: repetida ? `${v} (hay varias carpetas con este nombre: elige cuál)` : `${textoCarpeta(v)} (no existe en el buzón)` };
  });
}
