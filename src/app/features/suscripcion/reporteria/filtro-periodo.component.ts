// Botón de periodo de la reportería: abre el mismo popover de fechas que usan
// Cotizaciones y el visor (árbol año/mes/día + presets). El popover sale a
// <body> vía almaPortal para no recortarse dentro del panel .glass.

import { Component, ElementRef, ViewChild, computed, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { DateFilterPopoverComponent } from '../../../shared/components/date-filter-popover.component';
import { colocarPanel } from '../../../shared/popover-position';
import { PortalDirective } from '../../../shared/portal.directive';

@Component({
  selector: 'alma-filtro-periodo',
  imports: [LucideAngularModule, PortalDirective, DateFilterPopoverComponent],
  template: `
    <button
      #boton
      type="button"
      (click)="alternar($event)"
      class="glass flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm transition-colors hover:text-primary"
      [class]="activo() ? 'text-foreground' : 'text-muted-foreground'"
      [title]="activo() ? 'Periodo aplicado — clic para cambiarlo' : 'Filtrar por periodo'"
    >
      <lucide-icon name="calendar-clock" [size]="15" [class.text-primary]="activo()" />
      <span [class.font-medium]="activo()">{{ etiqueta() }}</span>
      <lucide-icon name="chevron-down" [size]="14" />
    </button>

    @if (abierto()) {
      <div almaPortal class="fixed inset-0 z-[90]" (click)="cerrar()"></div>
      <div
        #panel
        almaPortal
        class="surface-solid fixed z-[95] w-80 rounded-lg border border-border p-3 text-left text-sm text-foreground shadow-[var(--shadow-lg)]"
        (click)="$event.stopPropagation()"
      >
        <alma-date-filter-popover
          [fechas]="fechas()"
          (aplicado)="onRango($event)"
          (cerrar)="cerrar()"
        />
      </div>
    }
  `,
})
export class FiltroPeriodoComponent {
  /** Días con solicitudes, repetidos tantas veces como su conteo (el árbol los cuenta). */
  readonly fechas = input<string[]>([]);
  readonly desde = input<string>('');
  readonly hasta = input<string>('');

  readonly rango = output<{ desde: string; hasta: string }>();

  @ViewChild('boton') private boton!: ElementRef<HTMLButtonElement>;
  @ViewChild('panel') set panelRef(el: ElementRef<HTMLElement> | undefined) {
    if (el && this.anchor) colocarPanel(el.nativeElement, this.anchor);
  }

  protected readonly abierto = signal(false);
  private anchor: DOMRect | null = null;

  protected readonly activo = computed(() => !!(this.desde() || this.hasta()));

  /** "Periodo" sin filtro; "12 sept" si es un día; "01 – 12 sept" si es rango. */
  protected readonly etiqueta = computed(() => {
    const d = this.desde();
    const h = this.hasta();
    if (!d && !h) return 'Periodo';
    if (d && h) return d === h ? this.corta(d) : `${this.corta(d)} – ${this.corta(h)}`;
    return d ? `desde ${this.corta(d)}` : `hasta ${this.corta(h)}`;
  });

  private corta(iso: string): string {
    const [a, m, d] = iso.split('-');
    if (!a || !m || !d) return iso;
    // Fecha suelta (sin hora): se construye local para que no se corra un día.
    return new Date(+a, +m - 1, +d).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
    });
  }

  protected alternar(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    this.anchor = this.boton.nativeElement.getBoundingClientRect();
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected onRango(r: { from: string | null; to: string | null }): void {
    this.rango.emit({ desde: r.from ?? '', hasta: r.to ?? '' });
    this.cerrar();
  }
}
