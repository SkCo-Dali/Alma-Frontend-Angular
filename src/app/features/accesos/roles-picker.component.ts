// Selector de roles con búsqueda e ícono ⓘ con la descripción del rol.
//
// El panel se saca a <body> con `almaPortal` y se coloca con `colocarPanel`: al estar
// dentro de una superficie .glass (backdrop-filter) ese ancestro se vuelve el bloque
// contenedor del `position: fixed` y el panel salía desplazado y recortado — el usuario
// veía el botón "Agregar rol" pero no el listado de roles.

import { Component, ElementRef, ViewChild, computed, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { RolCatalogo, etiquetaRol } from '../../core/services/accesos.api';
import { PortalDirective } from '../../shared/portal.directive';
import { colocarPanel } from '../../shared/popover-position';

const ANCHO_PANEL = 300;

@Component({
  selector: 'alma-roles-picker',
  imports: [LucideAngularModule, PortalDirective],
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
      <div
        almaPortal
        class="pointer-events-auto fixed inset-0 z-[60]"
        (click)="abierto.set(false)"
      ></div>
      <div
        #panel
        almaPortal
        class="surface-solid pointer-events-auto fixed z-[70] rounded-lg border border-border p-2 text-left text-sm normal-case tracking-normal text-foreground shadow-[var(--shadow-lg)]"
        [style.width.px]="ancho()"
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

  /** Al aparecer el panel (ya en <body>) se coloca con su medida real. */
  @ViewChild('panel') set panelRef(el: ElementRef<HTMLElement> | undefined) {
    if (el && this.anchor) colocarPanel(el.nativeElement, this.anchor);
  }

  private anchor: DOMRect | null = null;

  protected readonly etiqueta = etiquetaRol;
  protected readonly abierto = signal(false);
  protected readonly filtro = signal('');
  protected readonly ancho = signal(ANCHO_PANEL);

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
    this.anchor = this.boton.nativeElement.getBoundingClientRect();
    this.ancho.set(Math.max(this.anchor.width, ANCHO_PANEL));
    this.filtro.set('');
    this.abierto.set(true);
  }

  protected elegir(roleId: string): void {
    this.toggled.emit(roleId);
    if (!this.multiple()) this.abierto.set(false);
  }
}
