// Editor de plantilla de correo — réplica del EditTemplateDialog de Dali:
// header con ícono degradado, editor completo (toolbar, asunto, campos,
// lienzo Visual/HTML) y footer pill con Nombre Plantilla + Categoría (+ crear
// nueva) + Cancelar/Guardar. Reusable: lo abre la galería (Editar) y el
// diálogo de Envío de Correos (Guardar plantilla). Con la página
// /apps/suscripcion/plantillas eliminada, este diálogo es LA forma de crear
// y editar plantillas.

import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { EditorCorreoComponent } from './editor-correo.component';
import { GaleriaPlantillasDialogComponent } from './galeria-plantillas-dialog.component';
import { CorreoApi, PlantillaCorreoApi } from './correo.api';

/** Valores iniciales del editor. `id` vacío = plantilla nueva. */
export interface PlantillaEnEdicion {
  id: string;
  nombre: string;
  categoria: string;
  asunto: string;
  cuerpo_html: string;
}

@Component({
  selector: 'alma-editar-plantilla-dialog',
  imports: [FormsModule, LucideAngularModule, EditorCorreoComponent, GaleriaPlantillasDialogComponent],
  template: `
    <div
      class="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4"
      (click)="closed.emit()"
    >
      <div
        class="surface-solid flex h-[92vh] max-h-[92vh] w-full max-w-5xl flex-col gap-2 rounded-2xl border-l-[3px] border border-border border-l-primary px-4 pb-3 pt-3 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <!-- Header: ícono degradado + título + subtítulo + X (Dali) -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2.5">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 shadow-md shadow-primary/25">
              <lucide-icon name="mail" [size]="16" class="text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-base font-semibold leading-tight tracking-tight">
                {{ ed.id ? 'Editar plantilla' : 'Nueva plantilla' }}
              </h2>
              <p class="text-[10px] leading-tight text-muted-foreground">
                Modifica el nombre, categoría, contenido y asunto
              </p>
            </div>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            class="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <lucide-icon name="x" [size]="16" />
          </button>
        </div>

        <!-- Toolbar + asunto + campos + lienzo (el editor completo) -->
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <alma-editor-correo
            [(asunto)]="ed.asunto"
            [(value)]="ed.cuerpo_html"
            [variables]="variables()"
            [conPlantillas]="true"
            (abrirPlantillas)="selectorBase.set(true)"
          />
        </div>

        @if (errorEditor(); as err) {
          <p class="rounded-xl bg-destructive/10 p-2 text-center text-xs text-destructive">
            {{ err }}
          </p>
        }

        <!-- Footer pill: Nombre Plantilla + Categoría (+ nueva) + acciones (Dali) -->
        <div class="rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 shadow-sm">
          <div class="flex flex-row flex-wrap items-center gap-2">
            <div class="flex min-w-[180px] flex-1 items-center border-b border-border/50 transition-colors focus-within:border-primary">
              <span class="whitespace-nowrap pl-1 pr-1.5 text-xs font-medium text-muted-foreground">Nombre Plantilla:</span>
              <input [(ngModel)]="ed.nombre" maxlength="150" placeholder="Sin nombre"
                     class="h-8 w-full border-0 bg-transparent px-0 text-sm outline-none" />
            </div>
            @if (!nuevaCategoria()) {
              <div class="flex min-w-[160px] items-center border-b border-border/50 transition-colors focus-within:border-primary">
                <span class="whitespace-nowrap pl-1 pr-1.5 text-xs font-medium text-muted-foreground">Categoría:</span>
                <select [(ngModel)]="ed.categoria"
                        class="h-8 cursor-pointer border-0 bg-transparent text-sm text-foreground outline-none">
                  @for (c of categorias(); track c) { <option [value]="c">{{ c }}</option> }
                </select>
                <button type="button" title="Crear nueva categoría" (click)="nuevaCategoria.set(true)"
                        class="ml-0.5 flex h-6 w-6 items-center justify-center rounded-md text-primary hover:bg-primary/10">
                  <lucide-icon name="plus" [size]="12" />
                </button>
              </div>
            } @else {
              <div class="flex min-w-[160px] items-center gap-1 border-b border-border/50 focus-within:border-primary">
                <span class="whitespace-nowrap pl-1 pr-1.5 text-xs font-medium text-muted-foreground">Nueva:</span>
                <input #nuevaCat maxlength="60" placeholder="Categoría…"
                       class="h-8 w-28 border-0 bg-transparent px-0 text-sm outline-none"
                       (keydown.enter)="crearCategoria(nuevaCat.value); nuevaCat.value=''" />
                <button type="button" class="h-6 px-1.5 text-[10px] font-medium text-primary"
                        (click)="crearCategoria(nuevaCat.value); nuevaCat.value=''">Crear</button>
                <button type="button" class="h-6 px-1 text-[10px] text-muted-foreground"
                        (click)="nuevaCategoria.set(false)">✕</button>
              </div>
            }
            @if (!ed.id) {
              <label class="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
                     [class.opacity-50]="!puedeCompartir()"
                     title="Personal: solo tú la ves y usas. Compartida: todo el equipo de la App.">
                <input type="checkbox" class="h-3.5 w-3.5 accent-[var(--primary)]"
                       [ngModel]="soloParaMi()" (ngModelChange)="soloParaMi.set($event)"
                       [disabled]="!puedeCompartir()" name="soloParaMi" />
                Solo para mí
              </label>
            }
            <div class="ml-auto flex items-center gap-2">
              <button type="button" (click)="closed.emit()" [disabled]="guardando()"
                      class="rounded-xl border border-border/60 bg-background/50 px-3 py-1.5 text-xs transition-all hover:border-amber-500 hover:bg-amber-500 hover:text-white">
                Cancelar
              </button>
              <button type="button" (click)="guardar()"
                      [disabled]="guardando() || !ed.nombre.trim() || !ed.asunto.trim() || !ed.cuerpo_html.trim()"
                      class="flex items-center gap-1 rounded-xl bg-gradient-to-r from-primary to-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-primary/25 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50">
                @if (guardando()) {
                  <lucide-icon name="loader-2" [size]="12" class="animate-spin" /> Guardando…
                } @else {
                  <lucide-icon name="save" [size]="12" /> {{ ed.id ? 'Actualizar' : 'Guardar' }}
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Galería (solo selección) para usar otra plantilla como base -->
    @if (selectorBase()) {
      <alma-galeria-plantillas-dialog
        [app]="app()"
        [soloSeleccion]="true"
        (closed)="selectorBase.set(false)"
        (seleccionar)="usarComoBase($event)"
      />
    }
  `,
})
export class EditarPlantillaDialogComponent {
  private readonly api = inject(CorreoApi);

  /** Slug de la App dueña (p.ej. 'suscripcion'). */
  readonly app = input.required<string>();
  /** Copia editable con los valores iniciales (el padre la construye). */
  readonly plantilla = input.required<PlantillaEnEdicion>();
  readonly variables = input<Record<string, string>>({});
  readonly closed = output<void>();
  /** Se emitió crear/actualizar con éxito (el padre recarga sus listas). */
  readonly guardada = output<void>();

  private readonly editor = viewChild(EditorCorreoComponent);
  protected readonly selectorBase = signal(false);
  protected readonly nuevaCategoria = signal(false);
  /** Ámbito al CREAR: personal (solo yo) o compartida del área. */
  protected readonly soloParaMi = signal(false);
  protected readonly puedeCompartir = signal(true);
  protected readonly guardando = signal(false);
  protected readonly errorEditor = signal<string | null>(null);
  /** Categorías de las plantillas existentes + creadas en esta sesión. */
  private readonly categoriasBase = signal<string[]>([]);
  private readonly categoriasExtra = signal<string[]>([]);

  // El input llega antes del primer render y el objeto se edita en el lugar
  // (mismo patrón del diálogo original de la página de plantillas).
  protected get ed(): PlantillaEnEdicion {
    return this.plantilla();
  }

  protected readonly categorias = computed<string[]>(() => {
    const set = new Set<string>(['Suscripción', 'General', this.plantilla().categoria]);
    for (const c of this.categoriasBase()) set.add(c);
    for (const c of this.categoriasExtra()) set.add(c);
    set.delete('');
    return [...set].sort();
  });

  constructor() {
    // Los inputs required no existen aún en el constructor.
    effect(() => {
      this.app();
      untracked(() => void this.cargarCategorias());
    });
  }

  private async cargarCategorias(): Promise<void> {
    try {
      const r = await this.api.getPlantillas(this.app());
      this.categoriasBase.set([...new Set(r.items.map((p) => p.categoria))]);
      this.puedeCompartir.set(r.puede_gestionar);
      // Sin permiso de gestión, lo único posible es una plantilla personal.
      if (!r.puede_gestionar && !this.ed.id) this.soloParaMi.set(true);
    } catch {
      this.categoriasBase.set([]);
    }
  }

  protected crearCategoria(nombre: string): void {
    const limpio = nombre.trim();
    if (!limpio) return;
    this.categoriasExtra.set([...this.categoriasExtra(), limpio]);
    this.ed.categoria = limpio;
    this.nuevaCategoria.set(false);
  }

  protected usarComoBase(p: PlantillaCorreoApi): void {
    this.selectorBase.set(false);
    this.ed.asunto = p.asunto;
    this.ed.cuerpo_html = p.cuerpo_html;
    this.editor()?.cargar(p.asunto, p.cuerpo_html);
  }

  protected async guardar(): Promise<void> {
    const ed = this.ed;
    this.guardando.set(true);
    this.errorEditor.set(null);
    const body = {
      nombre: ed.nombre.trim(),
      categoria: ed.categoria.trim() || 'General',
      asunto: ed.asunto.trim(),
      cuerpo_html: ed.cuerpo_html,
    };
    try {
      if (ed.id) await this.api.actualizarPlantilla(ed.id, body);
      else await this.api.crearPlantilla(this.app(), {
        ...body, ambito: this.soloParaMi() ? 'personal' : 'app' });
      this.guardada.emit();
      this.closed.emit();
    } catch (e) {
      this.errorEditor.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
