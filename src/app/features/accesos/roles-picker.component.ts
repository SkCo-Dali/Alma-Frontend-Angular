// Selector de roles con búsqueda e ícono ⓘ con la descripción del rol. El panel usa
// posición fija calculada desde el trigger para no quedar recortado por contenedores con
// overflow.

import { Component, ElementRef, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { RolCatalogo, etiquetaRol } from '../../core/services/accesos.api';

const ANCHO_PANEL = 300;

@Component({
  selector: 'alma-roles-picker',
  imports: [LucideAngularModule],
  template: `
    <button
      #boton
      type="button"
      [disabled]="disabled()"
      (click)="abierto() ? abierto.set(false) : abrir()"
      class="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
      [class.opacity-50]="disabled()"
    >
      @if (triggerLabel(); as t) {
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          <lucide-icon name="plus" [size]="14" /> {{ t }}
        </span>
      } @else {
        <span class="truncate text-left">
          {{
            seleccionados().length === 0
              ? 'Selecciona roles…'
              : seleccionados().length +
                ' rol' +
                (seleccionados().length > 1 ? 'es' : '') +
                ' seleccionado' +
                (seleccionados().length > 1 ? 's' : '')
          }}
        </span>
        <lucide-icon name="chevron-down" [size]="16" class="shrink-0 text-muted-foreground" />
      }
    </button>

    @if (abierto()) {
      <div class="pointer-events-auto fixed inset-0 z-[60]" (click)="abierto.set(false)"></div>
      <div
        class="surface-solid pointer-events-auto fixed z-[70] rounded-lg border border-border p-2 shadow-[var(--shadow-lg)]"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        [style.width.px]="pos().width"
      >
        <div class="relative mb-2">
          <lucide-icon
            name="search"
            [size]="14"
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            #filtroInput
            [value]="filtro()"
            (input)="filtro.set(filtroInput.value)"
            placeholder="Filtrar roles…"
            class="h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-2 text-sm"
          />
        </div>
        <div class="max-h-56 overflow-y-auto overscroll-contain">
          @if (filtrados().length === 0) {
            <p class="px-2 py-3 text-center text-xs text-muted-foreground">
              Sin roles que coincidan.
            </p>
          }
          @for (r of filtrados(); track r.role_id) {
            <div
              class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              [class.bg-primary/5]="seleccionados().includes(r.role_id)"
              (click)="elegir(r.role_id)"
            >
              <span
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                [class]="
                  seleccionados().includes(r.role_id)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input'
                "
              >
                @if (seleccionados().includes(r.role_id)) {
                  <lucide-icon name="check" [size]="12" />
                }
              </span>
              <span class="min-w-0 flex-1 truncate">{{ etiqueta(r) }}</span>
              @if (r.description; as d) {
                <span
                  [title]="d"
                  (click)="$event.stopPropagation()"
                  class="shrink-0 cursor-help text-muted-foreground hover:text-foreground"
                >
                  <lucide-icon name="info" [size]="14" />
                </span>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class RolesPickerComponent {
  readonly roles = input.required<RolCatalogo[]>();
  readonly seleccionados = input.required<string[]>();
  readonly multiple = input(true);
  readonly disabled = input(false);
  /** Etiqueta compacta ("Agregar rol") en lugar del trigger estándar. */
  readonly triggerLabel = input<string | undefined>(undefined);
  readonly toggled = output<string>();

  @ViewChild('boton') private boton!: ElementRef<HTMLButtonElement>;

  protected readonly etiqueta = etiquetaRol;
  protected readonly abierto = signal(false);
  protected readonly filtro = signal('');
  protected readonly pos = signal({ top: 0, left: 0, width: ANCHO_PANEL });

  protected readonly filtrados = computed(() => {
    const q = this.filtro().trim().toLowerCase();
    if (!q) return this.roles();
    return this.roles().filter((r) =>
      [r.name, r.app ?? 'plataforma', r.slug, r.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  });

  protected abrir(): void {
    const r = this.boton.nativeElement.getBoundingClientRect();
    const width = Math.max(r.width, ANCHO_PANEL);
    this.pos.set({
      top: Math.min(r.bottom + 4, window.innerHeight - 300),
      left: Math.min(Math.max(8, r.left), window.innerWidth - width - 8),
      width,
    });
    this.filtro.set('');
    this.abierto.set(true);
  }

  protected elegir(roleId: string): void {
    this.toggled.emit(roleId);
    if (!this.multiple()) this.abierto.set(false);
  }
}
