// Administración de campañas del Visor de comunicaciones: qué carpetas del storage
// se indexan (traen) al índice, su tipo, y si están activas. Solo para admins de la
// App (app.visor-comunicaciones.*). Descubre carpetas nuevas del storage y permite
// activarlas, editar su tipo y reindexar bajo demanda.

import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CampanaConfig, CampanaDisponible, CampanasService, ReindexResumen } from './campanas.service';

@Component({
  selector: 'alma-admin-campanas',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="glass flex h-full flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
      <header class="shrink-0 border-b border-border/60 px-5 pb-3 pt-4">
        <h1 class="flex items-center gap-2 text-lg font-bold text-foreground">
          <lucide-icon name="settings" [size]="18" class="text-primary" />
          Administrar campañas
        </h1>
        <p class="text-xs text-muted-foreground">
          Elige qué campañas del repositorio se traen al visor y con qué tipo. La
          indexación corre automáticamente; también puedes forzarla aquí.
        </p>
      </header>

      <div class="min-h-0 flex-1 space-y-6 overflow-auto p-5">
        @if (error()) {
          <p class="flex items-center gap-1.5 text-xs text-destructive">
            <lucide-icon name="alert-triangle" [size]="14" /> {{ error() }}
          </p>
        }
        @if (mensaje()) {
          <p class="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
            <lucide-icon name="check-circle-2" [size]="14" /> {{ mensaje() }}
          </p>
        }

        @if (cargando()) {
          <div class="flex items-center justify-center py-10">
            <span class="flex items-center gap-2 text-sm text-muted-foreground">
              <lucide-icon name="loader-2" [size]="18" class="animate-spin text-primary" />
              Cargando campañas…
            </span>
          </div>
        } @else {
          <!-- ── Configuradas ── -->
          <section>
            <h2 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Campañas configuradas ({{ campanas().length }})
            </h2>
            <div class="overflow-x-auto rounded-xl border border-border/60">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-[var(--table-header)] text-left text-[11px] uppercase tracking-wider text-foreground/65">
                    <th class="px-3 py-2">Nombre</th>
                    <th class="px-3 py-2">Tipo</th>
                    <th class="px-3 py-2 text-center">Estado</th>
                    <th class="px-3 py-2 text-right">Indexados</th>
                    <th class="px-3 py-2">Último sync</th>
                    <th class="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of campanas(); track c.clave) {
                    <tr class="border-t border-border/40">
                      <td class="px-3 py-2">
                        <p class="font-medium text-foreground">{{ c.nombre }}</p>
                        <p class="font-mono text-[11px] text-muted-foreground">{{ c.clave }}</p>
                      </td>
                      <td class="px-3 py-2">
                        <input
                          [ngModel]="tipoDe(c)"
                          (ngModelChange)="setTipo(c.clave, $event)"
                          class="glass h-8 w-32 rounded-lg px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td class="px-3 py-2 text-center">
                        <button
                          type="button"
                          (click)="toggle(c)"
                          [disabled]="ocupada() === c.clave"
                          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          [class]="
                            c.activa
                              ? 'bg-[#02B1FF]/12 text-[#0270b8] dark:text-[#5cc3ff]'
                              : 'bg-muted text-muted-foreground'
                          "
                        >
                          <lucide-icon [name]="c.activa ? 'power' : 'power-off'" [size]="12" />
                          {{ c.activa ? 'Activa' : 'Inactiva' }}
                        </button>
                      </td>
                      <td class="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {{ c.totalIndexados }}
                      </td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">
                        {{ fecha(c.ultimoSync) }}
                      </td>
                      <td class="px-3 py-2">
                        <div class="flex items-center justify-end gap-1.5">
                          @if (tipoDe(c) !== c.tipo) {
                            <button
                              type="button"
                              (click)="guardarTipo(c)"
                              [disabled]="ocupada() === c.clave"
                              class="alma-btn alma-btn-outline h-7 rounded-lg text-xs"
                            >
                              <lucide-icon name="check" [size]="14" /> Guardar
                            </button>
                          }
                          <button
                            type="button"
                            (click)="reindexar(c)"
                            [disabled]="ocupada() === c.clave"
                            class="alma-btn alma-btn-outline h-7 rounded-lg text-xs"
                            title="Indexar ahora los .eml nuevos de esta campaña"
                          >
                            <lucide-icon
                              name="refresh-cw"
                              [size]="14"
                              [class.animate-spin]="ocupada() === c.clave"
                            />
                            Reindexar
                          </button>
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="6" class="px-3 py-8 text-center text-sm text-muted-foreground">
                        No hay campañas configuradas. Agrega una de las disponibles abajo.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <!-- ── Disponibles en el storage ── -->
          <section>
            <h2 class="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <lucide-icon name="folder-open" [size]="14" />
              Disponibles en el repositorio ({{ nuevas().length }})
            </h2>
            @if (nuevas().length === 0) {
              <p class="text-xs text-muted-foreground">Todas las carpetas del storage ya están configuradas.</p>
            } @else {
              <div class="space-y-2">
                @for (d of nuevas(); track d.clave) {
                  <div class="glass flex flex-wrap items-center gap-2 rounded-xl px-3 py-2">
                    <span class="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{{ d.clave }}</span>
                    <input
                      [ngModel]="borrador(d.clave).nombre"
                      (ngModelChange)="setBorrador(d.clave, 'nombre', $event)"
                      placeholder="Nombre"
                      class="glass h-8 w-40 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      [ngModel]="borrador(d.clave).tipo"
                      (ngModelChange)="setBorrador(d.clave, 'tipo', $event)"
                      placeholder="Tipo"
                      class="glass h-8 w-32 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      (click)="agregar(d.clave)"
                      [disabled]="ocupada() === d.clave"
                      class="alma-btn alma-btn-primary h-8 rounded-lg text-xs"
                    >
                      <lucide-icon name="plus" [size]="14" /> Agregar y activar
                    </button>
                  </div>
                }
              </div>
            }
          </section>
        }
      </div>
    </div>
  `,
})
export class AdminCampanasComponent {
  private readonly svc = inject(CampanasService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly ocupada = signal<string | null>(null);

  protected readonly campanas = signal<CampanaConfig[]>([]);
  private readonly disponibles = signal<CampanaDisponible[]>([]);
  protected readonly nuevas = computed(() => this.disponibles().filter((d) => !d.configurada));

  // Ediciones locales de tipo (por clave) y borradores de nuevas campañas.
  protected readonly tipos = signal<Record<string, string>>({});
  private readonly borradores = signal<Record<string, { nombre: string; tipo: string }>>({});

  constructor() {
    inject(DestroyRef); // reservado por consistencia con otros componentes
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [campanas, disponibles] = await Promise.all([this.svc.listar(), this.svc.disponibles()]);
      this.campanas.set(campanas);
      this.disponibles.set(disponibles);
      this.tipos.set(Object.fromEntries(campanas.map((c) => [c.clave, c.tipo])));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudieron cargar las campañas.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected borrador(clave: string): { nombre: string; tipo: string } {
    return this.borradores()[clave] ?? { nombre: clave, tipo: 'Comercial' };
  }

  protected setBorrador(clave: string, campo: 'nombre' | 'tipo', valor: string): void {
    const actual = this.borrador(clave);
    this.borradores.update((b) => ({ ...b, [clave]: { ...actual, [campo]: valor } }));
  }

  protected setTipo(clave: string, valor: string): void {
    this.tipos.update((t) => ({ ...t, [clave]: valor }));
  }

  /** Tipo en edición para una campaña (cae a su valor guardado). */
  protected tipoDe(c: CampanaConfig): string {
    return this.tipos()[c.clave] ?? c.tipo;
  }

  protected async toggle(c: CampanaConfig): Promise<void> {
    await this.accion(c.clave, async () => {
      await this.svc.setActiva(c.clave, !c.activa);
      this.mensaje.set(`Campaña "${c.nombre}" ${!c.activa ? 'activada' : 'desactivada'}.`);
      await this.cargar();
    });
  }

  protected async guardarTipo(c: CampanaConfig): Promise<void> {
    const tipo = (this.tipos()[c.clave] ?? c.tipo).trim() || 'Comercial';
    await this.accion(c.clave, async () => {
      await this.svc.guardar({ clave: c.clave, nombre: c.nombre, tipo, activa: c.activa });
      this.mensaje.set(`Tipo de "${c.nombre}" actualizado a "${tipo}".`);
      await this.cargar();
    });
  }

  protected async agregar(clave: string): Promise<void> {
    const b = this.borrador(clave);
    const nombre = (b.nombre || clave).trim();
    const tipo = (b.tipo || 'Comercial').trim();
    await this.accion(clave, async () => {
      await this.svc.guardar({ clave, nombre, tipo, activa: true });
      this.mensaje.set(`Campaña "${nombre}" agregada y activada. Se indexará en el próximo ciclo (o usa Reindexar).`);
      await this.cargar();
    });
  }

  protected async reindexar(c: CampanaConfig): Promise<void> {
    await this.accion(c.clave, async () => {
      const r: ReindexResumen = await this.svc.reindexar(c.clave);
      this.mensaje.set(
        `Reindexación de "${c.nombre}": ${r.blobsTotal} correos en el storage, ${r.insertados} nuevos indexados.`,
      );
      await this.cargar();
    });
  }

  private async accion(clave: string, fn: () => Promise<void>): Promise<void> {
    if (this.ocupada()) return;
    this.ocupada.set(clave);
    this.error.set(null);
    this.mensaje.set(null);
    try {
      await fn();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'La operación falló.');
    } finally {
      this.ocupada.set(null);
    }
  }

  protected fecha(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  }
}
