// Bandeja de comunicaciones: grid al estilo de Cotizaciones — buscador arriba y
// encabezados con menú por columna (ordenar + filtrar por valores). Emite `abrir`
// al elegir una fila. Es cliente 100% (el índice hoy es mock del storage).

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ComunicacionRef } from './comunicaciones.mock';
import { EmlService } from './eml.service';
import { ColMenuComponent } from './col-menu.component';

type Campo = 'remitente' | 'destinatarios' | 'asunto' | 'tipo' | 'fecha' | 'adjuntos' | 'tamano';

interface Columna {
  campo: Campo;
  label: string;
  /** Campo con filtro discreto por valores (menú de columna). */
  filtrable?: boolean;
  /** Columna de fecha ⇒ el menú filtra por rango Desde/Hasta. */
  esFecha?: boolean;
  clase?: string;
}

@Component({
  selector: 'alma-bandeja-comunicaciones',
  imports: [LucideAngularModule, ColMenuComponent],
  template: `
    <div class="glass flex h-full flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
      <!-- Cabecera + buscador -->
      <header class="shrink-0 px-5 pb-3 pt-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-lg font-bold text-foreground">Bandeja de comunicaciones</h1>
            <p class="text-xs text-muted-foreground">
              Correos disponibles en el repositorio. Selecciona uno para visualizarlo.
            </p>
          </div>
          <div
            class="glass flex h-9 min-w-[240px] max-w-sm flex-1 items-center gap-2 overflow-hidden rounded-xl px-3 focus-within:ring-2 focus-within:ring-ring"
          >
            <lucide-icon name="search" [size]="16" class="shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por remitente, destinatario o asunto…"
              [value]="q()"
              (input)="q.set($any($event.target).value)"
              class="h-full flex-1 border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            @if (q()) {
              <button
                type="button"
                (click)="q.set('')"
                class="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <lucide-icon name="x" [size]="15" />
              </button>
            }
          </div>
        </div>
      </header>

      <!-- Grid -->
      <div class="min-h-0 flex-1 overflow-auto">
        <table class="w-full border-separate border-spacing-0 text-sm">
          <thead class="sticky top-0 z-10">
            <tr>
              @for (col of columnas; track col.campo; let last = $last) {
                <th
                  class="whitespace-nowrap border-b border-border bg-[var(--table-header)] px-4 py-2.5 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-foreground/65"
                  [class]="(col.clase || '') + (last ? '' : ' border-r border-border/40')"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="truncate">{{ col.label }}</span>
                    <alma-col-menu
                      [sortActive]="sortField() === col.campo"
                      [sortDir]="sortDir()"
                      [valores]="col.filtrable ? valoresDe(col.campo) : null"
                      [seleccion]="filtros()[col.campo] ?? []"
                      [esFecha]="col.esFecha || false"
                      [fechas]="col.esFecha ? fechasLista() : []"
                      [fechaActiva]="!!(fechaRango().desde || fechaRango().hasta)"
                      (sort)="ordenar(col.campo, $event)"
                      (filtrar)="setFiltro(col.campo, $event)"
                      (rango)="fechaRango.set($event)"
                    />
                  </div>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (c of filtradas(); track c.id) {
              <tr
                (click)="abrir.emit(c)"
                class="cursor-pointer transition-colors hover:bg-accent"
                [class.opacity-60]="abriendoId() !== null"
              >
                <td class="border-b border-border/50 px-4 py-2.5">
                  <p class="font-medium text-foreground">{{ c.remitente }}</p>
                  <p class="text-xs text-muted-foreground">{{ c.remitenteEmail }}</p>
                </td>
                <td class="hidden max-w-0 border-b border-border/50 px-4 py-2.5 text-muted-foreground xl:table-cell">
                  <p class="truncate">
                    {{ c.destinatarios[0] }}
                    @if (c.destinatarios.length > 1) {
                      <span class="text-xs text-muted-foreground/70">+{{ c.destinatarios.length - 1 }}</span>
                    }
                  </p>
                </td>
                <td class="max-w-0 border-b border-border/50 px-4 py-2.5">
                  <p class="truncate text-foreground">{{ c.asunto }}</p>
                </td>
                <td class="hidden border-b border-border/50 px-4 py-2.5 md:table-cell">
                  <span class="alma-badge" [class]="claseTipo(c.tipo)">{{ c.tipo }}</span>
                </td>
                <td
                  class="hidden whitespace-nowrap border-b border-border/50 px-4 py-2.5 text-muted-foreground sm:table-cell"
                >
                  {{ fechaCorta(c.fecha) }}
                </td>
                <td class="border-b border-border/50 px-4 py-2.5 text-center">
                  @if (c.adjuntos > 0) {
                    <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <lucide-icon name="paperclip" [size]="13" /> {{ c.adjuntos }}
                    </span>
                  } @else {
                    <span class="text-xs text-muted-foreground/40">—</span>
                  }
                </td>
                <td
                  class="hidden whitespace-nowrap border-b border-border/50 px-4 py-2.5 text-right text-muted-foreground lg:table-cell"
                >
                  {{ eml.formatBytes(c.tamanoBytes) }}
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="px-4 py-16 text-center">
                  <div class="flex flex-col items-center gap-2">
                    <lucide-icon name="inbox" [size]="28" class="text-muted-foreground/40" />
                    <p class="text-sm text-muted-foreground">No hay comunicaciones que coincidan.</p>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Pie: conteo -->
      <div class="shrink-0 border-t border-border/60 px-5 py-2 text-xs text-muted-foreground">
        {{ filtradas().length }} de {{ comunicaciones().length }} comunicaciones
      </div>
    </div>
  `,
  styles: `:host { display: block; height: 100%; }`,
})
export class BandejaComunicacionesComponent {
  readonly comunicaciones = input.required<ComunicacionRef[]>();
  readonly abriendoId = input<string | null>(null);
  readonly abrir = output<ComunicacionRef>();

  protected readonly eml = inject(EmlService);

  protected readonly q = signal('');
  protected readonly filtros = signal<Partial<Record<Campo, string[]>>>({});
  protected readonly fechaRango = signal<{ desde: string | null; hasta: string | null }>({
    desde: null,
    hasta: null,
  });
  protected readonly sortField = signal<Campo>('fecha');
  protected readonly sortDir = signal<'asc' | 'desc'>('desc');

  protected readonly columnas: Columna[] = [
    { campo: 'remitente', label: 'Remitente', filtrable: true },
    { campo: 'destinatarios', label: 'Destinatarios', clase: 'hidden xl:table-cell' },
    { campo: 'asunto', label: 'Asunto' },
    { campo: 'tipo', label: 'Tipo', filtrable: true, clase: 'hidden md:table-cell' },
    { campo: 'fecha', label: 'Fecha', esFecha: true, clase: 'hidden sm:table-cell' },
    { campo: 'adjuntos', label: 'Adjuntos', clase: 'text-center' },
    { campo: 'tamano', label: 'Tamaño', clase: 'hidden text-right lg:table-cell' },
  ];

  protected readonly fechasLista = computed(() => this.comunicaciones().map((c) => c.fecha));

  protected valoresDe(campo: Campo): string[] {
    const key = campo === 'remitente' ? 'remitente' : 'tipo';
    return [...new Set(this.comunicaciones().map((c) => c[key]))].sort();
  }

  protected readonly filtradas = computed(() => {
    const term = this.q().toLowerCase().trim();
    const f = this.filtros();
    const field = this.sortField();
    const dir = this.sortDir() === 'asc' ? 1 : -1;

    const { desde, hasta } = this.fechaRango();

    return this.comunicaciones()
      .filter((c) => {
        const rem = f.remitente ?? [];
        const tip = f.tipo ?? [];
        if (rem.length && !rem.includes(c.remitente)) return false;
        if (tip.length && !tip.includes(c.tipo)) return false;
        const dia = c.fecha.slice(0, 10);
        if (desde && dia < desde) return false;
        if (hasta && dia > hasta) return false;
        if (
          term &&
          !c.remitente.toLowerCase().includes(term) &&
          !c.remitenteEmail.toLowerCase().includes(term) &&
          !c.destinatarios.join(' ').toLowerCase().includes(term) &&
          !c.asunto.toLowerCase().includes(term)
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        let r = 0;
        if (field === 'fecha') r = a.fecha.localeCompare(b.fecha);
        else if (field === 'tamano') r = a.tamanoBytes - b.tamanoBytes;
        else if (field === 'adjuntos') r = a.adjuntos - b.adjuntos;
        else r = String(a[field]).localeCompare(String(b[field]), 'es');
        return r * dir;
      });
  });

  protected ordenar(campo: Campo, dir: 'asc' | 'desc'): void {
    this.sortField.set(campo);
    this.sortDir.set(dir);
  }

  protected setFiltro(campo: Campo, valores: string[]): void {
    this.filtros.update((f) => ({ ...f, [campo]: valores }));
  }

  protected claseTipo(tipo: string): string {
    switch (tipo) {
      case 'Comercial':
        return 'bg-[#02B1FF]/12 text-[#0270b8] dark:text-[#5cc3ff]';
      case 'Siniestro':
        return 'bg-[#FF9200]/14 text-[#b56800] dark:text-[#ffb04a]';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }

  protected fechaCorta(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
