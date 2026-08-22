// Editores de la configuración del Simulador: selector de resultado, segmentos
// de IMC, catálogos (tabla buscable), matriz de exámenes, paquetes y listas de
// texto. Port de los subcomponentes de SimuladorConfigPage.tsx.

import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../../core/services/toast.service';
import { inject } from '@angular/core';
import { ResultadoItem } from '../simulador/simulador.api';
import { FilaMatriz, ItemCatalogo, SegmentoImc } from './simulador-config.api';

export const RESULTADOS: ResultadoItem[] = [
  'Estándar',
  'Información adicional',
  'Rechazar',
];

export const RESULTADO_CLS: Record<string, string> = {
  Estándar: 'text-emerald-700 dark:text-emerald-300',
  'Información adicional': 'text-amber-700 dark:text-amber-300',
  Rechazar: 'text-red-700 dark:text-red-300',
};

const MAX_FILAS_CATALOGO = 40;

// ── Selector de resultado ────────────────────────────────────────────────────

@Component({
  selector: 'alma-resultado-select',
  imports: [],
  template: `
    <select
      class="alma-input h-8 w-40 rounded-lg text-xs"
      [class]="clase()"
      [value]="value()"
      (change)="valueChange.emit($any($event.target).value)"
    >
      @for (r of resultados; track r) {
        <option [value]="r">{{ r }}</option>
      }
    </select>
  `,
})
export class ResultadoSelectComponent {
  readonly value = input.required<string>();
  readonly valueChange = output<ResultadoItem>();
  protected readonly resultados = RESULTADOS;
  protected readonly clase = computed(() => RESULTADO_CLS[this.value()] ?? '');
}

// ── Lista de textos (un renglón por ítem) ────────────────────────────────────

@Component({
  selector: 'alma-lista-texto-editor',
  imports: [FormsModule],
  template: `
    <div>
      <textarea
        class="alma-input min-h-28 rounded-xl py-2 text-xs"
        [value]="texto()"
        (input)="onInput($any($event.target).value)"
        (blur)="normalizar()"
      ></textarea>
      <p class="mt-1 text-[10px] text-muted-foreground">Un requisito por renglón.</p>
    </div>
  `,
})
export class ListaTextoEditorComponent {
  readonly value = input.required<string[]>();
  readonly valueChange = output<string[]>();

  protected readonly texto = computed(() => this.value().join('\n'));

  protected onInput(v: string): void {
    this.valueChange.emit(v.split('\n'));
  }

  protected normalizar(): void {
    this.valueChange.emit(this.value().map((x) => x.trim()).filter(Boolean));
  }
}

// ── Segmentos de IMC ─────────────────────────────────────────────────────────

@Component({
  selector: 'alma-segmentos-editor',
  imports: [LucideAngularModule, ResultadoSelectComponent],
  template: `
    <div class="overflow-x-auto rounded-xl border border-border/50">
      <table class="w-full min-w-[640px] text-xs">
        <thead>
          <tr class="border-b border-border/50 bg-muted/30 text-left">
            @for (h of headers; track h) {
              <th
                class="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {{ h }}
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (s of value(); track $index; let i = $index) {
            <tr class="border-b border-border/30 last:border-0">
              <td class="w-20 px-2 py-1">
                <input
                  type="number"
                  class="alma-input h-8 rounded-lg text-xs"
                  [value]="s.desde"
                  (input)="set(i, { desde: entero($any($event.target).value) })"
                />
              </td>
              <td class="w-20 px-2 py-1">
                <input
                  type="number"
                  class="alma-input h-8 rounded-lg text-xs"
                  [value]="s.hasta"
                  (input)="set(i, { hasta: entero($any($event.target).value) })"
                />
              </td>
              <td class="w-44 px-2 py-1">
                <input
                  class="alma-input h-8 rounded-lg text-xs"
                  [value]="s.categoria"
                  (input)="set(i, { categoria: $any($event.target).value })"
                />
              </td>
              <td class="px-2 py-1">
                <alma-resultado-select
                  [value]="s.resultado"
                  (valueChange)="set(i, { resultado: $event })"
                />
              </td>
              <td class="px-2 py-1">
                <input
                  class="alma-input h-8 min-w-56 rounded-lg text-xs"
                  [value]="s.requisito"
                  (input)="set(i, { requisito: $any($event.target).value })"
                  placeholder="—"
                />
              </td>
              <td class="w-9 px-1 py-1">
                <button
                  type="button"
                  aria-label="Eliminar segmento"
                  (click)="eliminar(i)"
                  class="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <lucide-icon name="trash-2" [size]="14" class="mx-auto" />
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
      <div class="border-t border-border/30 p-1.5">
        <button
          type="button"
          (click)="agregar()"
          class="flex h-7 items-center rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <lucide-icon name="plus" [size]="12" class="mr-1" /> Agregar segmento
        </button>
      </div>
    </div>
  `,
})
export class SegmentosEditorComponent {
  readonly value = input.required<SegmentoImc[]>();
  readonly valueChange = output<SegmentoImc[]>();

  protected readonly headers = [
    'IMC desde',
    'IMC hasta',
    'Categoría',
    'Resultado',
    'Requisito',
    '',
  ];

  protected entero(v: string): number {
    return Number.parseInt(v, 10) || 0;
  }

  protected set(i: number, patch: Partial<SegmentoImc>): void {
    this.valueChange.emit(
      this.value().map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  }

  protected eliminar(i: number): void {
    this.valueChange.emit(this.value().filter((_, idx) => idx !== i));
  }

  protected agregar(): void {
    const ultimo = this.value()[this.value().length - 1];
    this.valueChange.emit([
      ...this.value(),
      {
        desde: (ultimo?.hasta ?? 0) + 1,
        hasta: (ultimo?.hasta ?? 0) + 2,
        categoria: '',
        resultado: 'Estándar',
        requisito: '',
      },
    ]);
  }
}

// ── Catálogo (tabla buscable con edición inline) ─────────────────────────────

@Component({
  selector: 'alma-catalogo-editor',
  imports: [FormsModule, LucideAngularModule, ResultadoSelectComponent],
  template: `
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-52 flex-1">
          <lucide-icon
            name="search"
            [size]="14"
            class="absolute left-2.5 top-2 text-muted-foreground"
          />
          <input
            class="alma-input h-8 rounded-lg pl-8 text-xs"
            [(ngModel)]="filtro"
            (ngModelChange)="filtroSig.set($event)"
            [placeholder]="'Buscar entre ' + value().length + ' ítems…'"
          />
        </div>
        <div class="flex items-center gap-1.5">
          <input
            class="alma-input h-8 w-44 rounded-lg text-xs"
            [(ngModel)]="nuevo"
            (keydown.enter)="agregar()"
            placeholder="Nuevo ítem…"
          />
          <button
            type="button"
            (click)="agregar()"
            class="alma-btn alma-btn-outline h-8 rounded-lg text-xs"
          >
            <lucide-icon name="plus" [size]="12" /> Agregar
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-border/50">
        <table class="w-full min-w-[620px] text-xs">
          <thead>
            <tr class="border-b border-border/50 bg-muted/30 text-left">
              @for (h of headers; track h) {
                <th
                  class="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {{ h }}
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @if (visibles().length === 0) {
              <tr>
                <td colspan="4" class="px-3 py-4 text-center text-muted-foreground">
                  Sin coincidencias.
                </td>
              </tr>
            }
            @for (v of visibles(); track v.i) {
              <tr class="border-b border-border/30 align-top last:border-0">
                <td class="w-56 px-2 py-1">
                  <input
                    class="alma-input h-8 rounded-lg text-xs"
                    [value]="v.x.nombre"
                    (input)="set(v.i, { nombre: $any($event.target).value })"
                  />
                </td>
                <td class="px-2 py-1">
                  <alma-resultado-select
                    [value]="v.x.resultado"
                    (valueChange)="set(v.i, { resultado: $event })"
                  />
                </td>
                <td class="px-2 py-1">
                  <textarea
                    rows="1"
                    class="alma-input min-h-8 min-w-64 rounded-lg py-1.5 text-xs"
                    [value]="v.x.requisito"
                    (input)="set(v.i, { requisito: $any($event.target).value })"
                    placeholder="—"
                  ></textarea>
                </td>
                <td class="w-9 px-1 py-1">
                  <button
                    type="button"
                    [attr.aria-label]="'Eliminar ' + v.x.nombre"
                    (click)="eliminar(v.i)"
                    class="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
                  >
                    <lucide-icon name="trash-2" [size]="14" class="mx-auto" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (indices().length > max) {
          <p
            class="border-t border-border/30 px-3 py-1.5 text-center text-[10px] text-muted-foreground"
          >
            Mostrando {{ max }} de {{ indices().length }} — usa el buscador para ver el resto.
          </p>
        }
      </div>
    </div>
  `,
})
export class CatalogoEditorComponent {
  private readonly toast = inject(ToastService);

  readonly value = input.required<ItemCatalogo[]>();
  readonly valueChange = output<ItemCatalogo[]>();

  protected readonly headers = ['Nombre', 'Resultado', 'Requisito / mensaje', ''];
  protected readonly max = MAX_FILAS_CATALOGO;
  protected filtro = '';
  protected nuevo = '';
  protected readonly filtroSig = signal('');

  protected readonly indices = computed(() => {
    const f = this.filtroSig().trim().toLowerCase();
    return this.value()
      .map((x, i) => ({ x, i }))
      .filter(({ x }) => !f || x.nombre.toLowerCase().includes(f));
  });

  protected readonly visibles = computed(() => this.indices().slice(0, MAX_FILAS_CATALOGO));

  protected set(i: number, patch: Partial<ItemCatalogo>): void {
    this.valueChange.emit(
      this.value().map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
    );
  }

  protected eliminar(i: number): void {
    this.valueChange.emit(this.value().filter((_, idx) => idx !== i));
  }

  protected agregar(): void {
    const nombre = this.nuevo.trim();
    if (!nombre) return;
    if (this.value().some((x) => x.nombre.trim().toLowerCase() === nombre.toLowerCase())) {
      this.toast.error('Ya existe', `«${nombre}» ya está en el catálogo.`);
      return;
    }
    this.valueChange.emit([
      { nombre, resultado: 'Estándar', requisito: '' },
      ...this.value(),
    ]);
    this.nuevo = '';
    this.filtro = nombre;
    this.filtroSig.set(nombre);
  }
}

// ── Matriz de exámenes ───────────────────────────────────────────────────────

@Component({
  selector: 'alma-matriz-editor',
  imports: [LucideAngularModule],
  template: `
    <div class="space-y-2">
      @for (fila of value(); track $index; let i = $index) {
        <div class="rounded-xl border border-border/50 p-2.5">
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <span
              class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Edad
            </span>
            <input
              type="number"
              class="alma-input h-8 w-20 rounded-lg text-xs"
              [value]="fila.edadDesde"
              (input)="setFila(i, { edadDesde: entero($any($event.target).value) })"
            />
            <span class="text-xs text-muted-foreground">a</span>
            <input
              type="number"
              class="alma-input h-8 w-20 rounded-lg text-xs"
              [value]="fila.edadHasta ?? ''"
              placeholder="∞"
              (input)="setEdadHasta(i, $any($event.target).value)"
            />
            <span class="text-[10px] text-muted-foreground">(vacío = sin tope)</span>
            <button
              type="button"
              aria-label="Eliminar fila de edad"
              (click)="eliminarFila(i)"
              class="ml-auto h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
            >
              <lucide-icon name="trash-2" [size]="14" class="mx-auto" />
            </button>
          </div>
          <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            @for (r of fila.rangos; track $index; let j = $index) {
              <div class="flex items-center gap-1.5 rounded-lg bg-muted/20 px-2 py-1.5">
                <input
                  class="alma-input h-7 rounded-md text-[11px]"
                  [value]="miles(r.desde)"
                  (input)="setRango(i, j, { desde: soloDigitos($any($event.target).value) })"
                />
                <span class="text-[10px] text-muted-foreground">a</span>
                <input
                  class="alma-input h-7 rounded-md text-[11px]"
                  [value]="r.hasta === null ? '' : miles(r.hasta)"
                  placeholder="∞"
                  (input)="setHasta(i, j, $any($event.target).value)"
                />
                <input
                  class="alma-input h-7 w-12 rounded-md text-center text-[11px] font-semibold"
                  [value]="r.paquete"
                  aria-label="Paquete"
                  (input)="
                    setRango(i, j, { paquete: $any($event.target).value.toUpperCase() })
                  "
                />
                <button
                  type="button"
                  aria-label="Eliminar rango"
                  (click)="eliminarRango(i, j)"
                  class="rounded p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <lucide-icon name="trash-2" [size]="12" />
                </button>
              </div>
            }
          </div>
          <button
            type="button"
            (click)="agregarRango(i)"
            class="mt-1.5 flex h-7 items-center rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <lucide-icon name="plus" [size]="12" class="mr-1" /> Agregar rango
          </button>
        </div>
      }
      <button
        type="button"
        (click)="agregarFila()"
        class="flex h-7 items-center rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <lucide-icon name="plus" [size]="12" class="mr-1" /> Agregar fila de edad
      </button>
    </div>
  `,
})
export class MatrizEditorComponent {
  readonly value = input.required<FilaMatriz[]>();
  readonly valueChange = output<FilaMatriz[]>();

  protected miles(n: number): string {
    return Math.round(n).toLocaleString('es-CO');
  }

  protected soloDigitos(v: string): number {
    return Number(v.replace(/[^\d]/g, '')) || 0;
  }

  protected entero(v: string): number {
    return Number.parseInt(v, 10) || 0;
  }

  protected setFila(i: number, patch: Partial<FilaMatriz>): void {
    this.valueChange.emit(
      this.value().map((f, idx) => (idx === i ? { ...f, ...patch } : f)),
    );
  }

  protected setEdadHasta(i: number, v: string): void {
    this.setFila(i, { edadHasta: v === '' ? null : this.entero(v) });
  }

  protected setRango(i: number, j: number, patch: Partial<FilaMatriz['rangos'][0]>): void {
    const fila = this.value()[i];
    this.setFila(i, {
      rangos: fila.rangos.map((x, k) => (k === j ? { ...x, ...patch } : x)),
    });
  }

  protected setHasta(i: number, j: number, v: string): void {
    const limpio = v.replace(/[^\d]/g, '');
    this.setRango(i, j, { hasta: limpio ? Number(limpio) : null });
  }

  protected eliminarRango(i: number, j: number): void {
    const fila = this.value()[i];
    this.setFila(i, { rangos: fila.rangos.filter((_, k) => k !== j) });
  }

  protected agregarRango(i: number): void {
    const fila = this.value()[i];
    this.setFila(i, {
      rangos: [
        ...fila.rangos,
        {
          desde: (fila.rangos[fila.rangos.length - 1]?.hasta ?? 0) + 1,
          hasta: null,
          paquete: 'A',
        },
      ],
    });
  }

  protected eliminarFila(i: number): void {
    this.valueChange.emit(this.value().filter((_, idx) => idx !== i));
  }

  protected agregarFila(): void {
    const ultima = this.value()[this.value().length - 1];
    this.valueChange.emit([
      ...this.value(),
      {
        edadDesde: (ultima?.edadHasta ?? 64) + 1,
        edadHasta: null,
        rangos: [{ desde: 400_000_000, hasta: null, paquete: 'A' }],
      },
    ]);
  }
}

// ── Paquetes de exámenes ─────────────────────────────────────────────────────

@Component({
  selector: 'alma-paquetes-editor',
  imports: [],
  template: `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      @for (letra of letras(); track letra) {
        <div class="rounded-xl border border-border/50 p-2.5">
          <p class="mb-1.5 text-xs font-semibold text-foreground">Paquete {{ letra }}</p>
          <textarea
            class="alma-input min-h-32 rounded-lg py-2 text-[11px]"
            [value]="texto(letra)"
            (input)="onInput(letra, $any($event.target).value)"
            (blur)="normalizar(letra)"
          ></textarea>
          <p class="mt-1 text-[10px] text-muted-foreground">
            {{ conteo(letra) }} exámenes · uno por renglón.
          </p>
        </div>
      }
    </div>
  `,
})
export class PaquetesEditorComponent {
  readonly value = input.required<Record<string, string[]>>();
  readonly valueChange = output<Record<string, string[]>>();

  protected readonly letras = computed(() => Object.keys(this.value()).sort());

  protected texto(letra: string): string {
    return (this.value()[letra] ?? []).join('\n');
  }

  protected conteo(letra: string): number {
    return (this.value()[letra] ?? []).filter((x) => x.trim()).length;
  }

  protected onInput(letra: string, v: string): void {
    this.valueChange.emit({ ...this.value(), [letra]: v.split('\n') });
  }

  protected normalizar(letra: string): void {
    this.valueChange.emit({
      ...this.value(),
      [letra]: (this.value()[letra] ?? []).map((x) => x.trim()).filter(Boolean),
    });
  }
}
