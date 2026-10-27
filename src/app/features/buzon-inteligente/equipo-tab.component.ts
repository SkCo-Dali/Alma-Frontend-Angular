// «Asignación › Equipo» (2.0): las personas que reciben correos del buzón. Una
// persona recibe correos de un grupo si está disponible y su membresía en ese
// grupo está activa. Los interruptores guardan al instante (PATCH); agregar,
// quitar, cambiar carpeta o respaldo reemplaza el equipo completo (PUT). La
// hoja de Excel se lee con /bases/leer y se mapean sus columnas: correo ·
// nombre · carpeta · una columna por grupo (X) · estado · respaldo.

import { Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaSwitchComponent } from '../../shared/components/alma-switch.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import { Buzon, BuzonApi, DisponibilidadIn, Grupo, LecturaArchivo, Persona, PersonaIn } from './buzon.api';
import { aPersonaIn } from './buzon-asignacion';
import { CarpetaPlana, CarpetaSelectComponent } from './carpeta-select.component';

const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

interface FilaImport {
  n: number;
  correo: string;
  nombre: string;
  carpeta: string | null;
  disponible: boolean;
  activa: boolean;
  grupos: string[];
  respaldo: string | null;
  estado: 'ok' | 'warn' | 'bad';
  nota: string;
}

/** «laura.gomez@…» → «Laura Gomez» (el backend exige un nombre). */
function nombreDesdeCorreo(correo: string): string {
  const base = correo.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase()) || correo;
}

@Component({
  selector: 'alma-equipo-tab',
  imports: [FormsModule, LucideAngularModule, AlmaSwitchComponent, TooltipDirective, CarpetaSelectComponent],
  template: `
    <section class="glass overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
      <div class="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div>
          <h2 class="text-sm font-semibold text-foreground">Equipo · una columna por grupo que asigna a personas</h2>
          <p class="max-w-3xl text-xs text-muted-foreground">Recibe correos de un grupo si está disponible y su membresía en ese grupo está activa. En las bases se reconoce por su correo o su nombre.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="alma-btn alma-btn-ghost h-8 rounded-lg text-xs" (click)="descargarPlantilla()"><lucide-icon name="download" [size]="14" /> Plantilla</button>
          <label class="alma-btn alma-btn-outline h-8 cursor-pointer rounded-lg text-xs" for="eq-import"><lucide-icon name="file-spreadsheet" [size]="14" /> Importar desde Excel</label>
          <input id="eq-import" type="file" class="sr-only" accept=".xlsx,.xlsm,.csv" (change)="leerHoja($event)" />
        </div>
      </div>

      <form class="flex flex-wrap items-end gap-2 px-4 py-3" (submit)="$event.preventDefault(); agregar()">
        <div class="flex min-w-[160px] flex-1 flex-col gap-1">
          <label class="alma-label" for="eq-nombre">Nombre</label>
          <input id="eq-nombre" name="nombre" class="alma-input h-9" [(ngModel)]="nuevoNombre" placeholder="Laura Gómez" />
        </div>
        <div class="flex min-w-[200px] flex-1 flex-col gap-1">
          <label class="alma-label" for="eq-correo">Correo *</label>
          <input id="eq-correo" name="correo" type="email" class="alma-input h-9" [(ngModel)]="nuevoCorreo" placeholder="persona@skandia.com.co" autocomplete="off" />
        </div>
        <button type="submit" class="alma-btn alma-btn-primary h-9 rounded-lg" [disabled]="guardando() || !nuevoCorreo.trim()"><lucide-icon name="user-plus" [size]="15" /> Agregar</button>
      </form>
      @if (errorAgregar(); as e) { <p class="px-4 pb-2 text-xs text-destructive">{{ e }}</p> }

      <div class="overflow-x-auto">
        <table class="alma-table">
          <thead>
            <tr>
              <th class="w-10 text-right">#</th>
              <th>Persona</th>
              <th>Carpeta en el buzón</th>
              <th>Disponible</th>
              @for (g of gruposPersonas(); track g.id) { <th class="whitespace-nowrap">{{ g.nombre }}</th> }
              <th class="text-right">Hoy</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (p of equipo(); track p.id + ':' + version(); let n = $index) {
              <tr [class.opacity-70]="!p.disponible">
                <td class="text-right text-xs tabular-nums text-muted-foreground">{{ n + 1 }}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{{ iniciales(p.nombre) }}</span>
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-foreground">{{ p.nombre }}</p>
                      <p class="truncate text-[11px] text-muted-foreground">{{ p.correo }}</p>
                    </div>
                  </div>
                </td>
                <td class="min-w-[180px]">
                  <alma-carpeta-select [carpetas]="carpetas()" [valor]="p.carpeta" (valorChange)="cambiarCarpeta(p, $event)" vacia="Sin carpeta (se queda en la vigilada)" [ariaLabel]="'Carpeta de ' + p.nombre" [compacto]="true" [disabled]="guardando()" />
                </td>
                <td>
                  <span class="flex items-center gap-2">
                    <alma-switch [checked]="p.disponible" (checkedChange)="patch(p, { disponible: $event })" [disabled]="ocupado() === p.id" [ariaLabel]="'Disponible: ' + p.nombre" />
                    <span class="text-[11px]" [class]="p.disponible ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'">{{ p.disponible ? 'Disponible' : 'Ausente' }}</span>
                  </span>
                </td>
                @for (g of gruposPersonas(); track g.id) {
                  @let m = p.grupos[g.id];
                  <td class="min-w-[170px]">
                    @if (m) {
                      <div class="flex items-center gap-1.5">
                        <alma-switch [checked]="m.activa" (checkedChange)="patch(p, { grupo_id: g.id, activa: $event })" [disabled]="ocupado() === p.id" [ariaLabel]="p.nombre + ' activa en ' + g.nombre" />
                        <select class="alma-input h-7 w-28 text-[11px]" [attr.aria-label]="'Respaldo de ' + p.nombre + ' en ' + g.nombre" [ngModel]="m.respaldo_id ?? ''" (ngModelChange)="cambiarRespaldo(p, g, $event)" [disabled]="guardando()">
                          <option value="">Sin respaldo</option>
                          @for (o of equipo(); track o.id) { @if (o.id !== p.id) { <option [value]="o.id">{{ o.nombre.split(' ')[0] }}</option> } }
                        </select>
                        <button type="button" class="rounded p-0.5 text-muted-foreground hover:text-destructive" [attr.aria-label]="'Quitar a ' + p.nombre + ' de ' + g.nombre" almaTooltip="Quitar del grupo" [disabled]="guardando()" (click)="quitarDeGrupo(p, g)"><lucide-icon name="x" [size]="12" /></button>
                      </div>
                    } @else {
                      <button type="button" class="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary" [attr.aria-label]="'Agregar a ' + p.nombre + ' a ' + g.nombre" [disabled]="ocupado() === p.id" (click)="patch(p, { grupo_id: g.id, activa: true })">+ {{ g.nombre }}</button>
                    }
                  </td>
                }
                <td class="text-right text-xs tabular-nums" [almaTooltip]="p.abiertos + ' abiertos en Validar'">{{ p.carga_hoy }}</td>
                <td class="text-right">
                  <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0 text-destructive" [attr.aria-label]="'Quitar a ' + p.nombre + ' del equipo'" almaTooltip="Quitar del equipo" [disabled]="guardando()" (click)="quitar(p)"><lucide-icon name="user-minus" [size]="15" /></button>
                </td>
              </tr>
            } @empty {
              <tr><td [attr.colspan]="6 + gruposPersonas().length" class="py-6 text-center text-xs text-muted-foreground">Sin personas. Agrégalas arriba o importa la hoja del equipo.</td></tr>
            }
          </tbody>
        </table>
      </div>

      @for (g of gruposSinActivos(); track g.id) {
        <p class="mx-4 mb-3 flex items-start gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <lucide-icon name="user-x" [size]="13" class="mt-0.5 shrink-0" /> Nadie activo atiende <b>&nbsp;{{ g.nombre }}</b>: sus correos {{ sinActivosTxt(g) }}.
        </p>
      }
      <p class="px-4 pb-3 text-[11px] text-muted-foreground">
        Al desactivar a alguien: <b>{{ buzon().al_desactivar === 'respaldo' ? 'su respaldo fijo' : 'round-robin entre los activos' }}</b> (se cambia en Ajustes).
      </p>
    </section>

    <!-- Importar -->
    @if (lectura(); as l) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cerrarImport()">
        <div class="surface-solid flex max-h-[94dvh] w-full max-w-5xl flex-col rounded-2xl border border-border shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true" aria-labelledby="imp-t" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <div>
              <h2 id="imp-t" class="text-sm font-semibold text-foreground">Importar equipo · {{ archivoNombre() }}</h2>
              <p class="text-xs text-muted-foreground">Indica qué columna trae cada dato. Una fila por persona; en cada grupo marca con X si lo atiende.</p>
            </div>
            <button type="button" class="alma-btn alma-btn-ghost" aria-label="Cerrar" (click)="cerrarImport()"><lucide-icon name="x" [size]="16" /></button>
          </div>
          <div class="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
            <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
              @for (c of camposImport; track c.id) {
                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-semibold text-muted-foreground" [attr.for]="'imp-' + c.id">{{ c.nombre }}{{ c.id === 'correo' ? ' *' : '' }}</label>
                  <select class="alma-input h-8 text-xs" [id]="'imp-' + c.id" [ngModel]="mapa()[c.id] || ''" (ngModelChange)="mapear(c.id, $event)">
                    <option value="">— No viene —</option>
                    @for (col of l.columnas; track col) { <option [value]="col">{{ col }}</option> }
                  </select>
                </div>
              }
            </div>
            @if (gruposPersonas().length) {
              <div>
                <p class="text-[11px] font-semibold text-muted-foreground">Columna de cada grupo (X = lo atiende)</p>
                <div class="mt-1 grid grid-cols-2 gap-3 md:grid-cols-4">
                  @for (g of gruposPersonas(); track g.id) {
                    <div class="flex flex-col gap-1">
                      <label class="text-xs text-foreground" [attr.for]="'impg-' + g.id">{{ g.nombre }}</label>
                      <select class="alma-input h-8 text-xs" [id]="'impg-' + g.id" [ngModel]="mapa()['g:' + g.id] || ''" (ngModelChange)="mapear('g:' + g.id, $event)">
                        <option value="">— No viene —</option>
                        @for (col of l.columnas; track col) { <option [value]="col">{{ col }}</option> }
                      </select>
                    </div>
                  }
                </div>
              </div>
            }
            <fieldset class="flex flex-wrap gap-4 text-sm">
              <legend class="sr-only">Cómo importar</legend>
              <label class="flex items-center gap-2"><input type="radio" name="imp-modo" value="combinar" [(ngModel)]="modoImport" /> Agregar y actualizar (conserva a los demás)</label>
              <label class="flex items-center gap-2"><input type="radio" name="imp-modo" value="reemplazar" [(ngModel)]="modoImport" /> Reemplazar el equipo completo</label>
            </fieldset>

            @if (!mapa()['correo']) {
              <p class="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">Elige la columna con el correo: es lo que identifica a cada persona.</p>
            } @else {
              <div class="overflow-x-auto rounded-xl border border-border/60">
                <table class="alma-table text-xs">
                  <thead><tr><th class="text-right">#</th><th>Correo</th><th>Nombre</th><th>Carpeta</th><th>Grupos</th><th>Estado</th><th>Respaldo</th><th>Validación</th></tr></thead>
                  <tbody>
                    @for (f of filasImport(); track f.n) {
                      <tr>
                        <td class="text-right tabular-nums text-muted-foreground">{{ f.n }}</td>
                        <td>{{ f.correo }}</td>
                        <td>{{ f.nombre }}</td>
                        <td>{{ f.carpeta || '—' }}</td>
                        <td>{{ nombresGrupos(f.grupos) || '—' }}</td>
                        <td>{{ !f.disponible ? 'Ausente' : f.activa ? 'Activo' : 'Inactivo' }}</td>
                        <td>{{ f.respaldo || '—' }}</td>
                        <td><span class="alma-badge" [class]="f.estado === 'ok' ? 'alma-badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : f.estado === 'warn' ? 'alma-badge bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'alma-badge bg-rose-500/15 text-rose-700 dark:text-rose-300'">{{ f.nota }}</span></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="8" class="text-center text-muted-foreground">La hoja no trae filas.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }
            @if (errorImport(); as e) { <p class="text-xs text-destructive">{{ e }}</p> }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border/60 px-5 py-3">
            <span class="mr-auto text-xs text-muted-foreground">{{ validasImport() }} de {{ filasImport().length }} filas se importan</span>
            <button type="button" class="alma-btn alma-btn-outline" (click)="cerrarImport()">Cancelar</button>
            <button type="button" class="alma-btn alma-btn-primary" [disabled]="guardando() || !validasImport()" (click)="aplicarImport()">
              <lucide-icon [name]="guardando() ? 'loader-2' : 'check'" [size]="15" [class.animate-spin]="guardando()" /> Importar {{ validasImport() }} persona(s)
            </button>
          </div>
        </div>
      </div>
    } @else if (leyendo()) {
      <p class="text-xs text-muted-foreground">Leyendo la hoja…</p>
    }
  `,
})
export class EquipoTabComponent {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  readonly grupos = input<Grupo[]>([]);
  readonly carpetas = input<CarpetaPlana[]>([]);
  readonly equipo = model<Persona[]>([]);

  protected readonly guardando = signal(false);
  protected readonly ocupado = signal<string | null>(null);
  /** Sube cuando un guardado falla: recrea las filas para devolver los controles a su estado. */
  protected readonly version = signal(0);
  protected readonly errorAgregar = signal<string | null>(null);
  protected nuevoNombre = '';
  protected nuevoCorreo = '';

  protected readonly gruposPersonas = computed(() => this.grupos().filter((g) => g.destino === 'personas'));
  protected readonly gruposSinActivos = computed(() =>
    this.gruposPersonas().filter((g) => g.activo && !this.equipo().some((p) => p.disponible && p.grupos[g.id]?.activa)),
  );

  // Importación
  protected readonly camposImport = [
    { id: 'correo', nombre: 'Correo' },
    { id: 'nombre', nombre: 'Nombre' },
    { id: 'carpeta', nombre: 'Carpeta' },
    { id: 'estado', nombre: 'Estado' },
    { id: 'respaldo', nombre: 'Respaldo (correo)' },
  ];
  protected readonly lectura = signal<LecturaArchivo | null>(null);
  protected readonly archivoNombre = signal('');
  protected readonly leyendo = signal(false);
  protected readonly mapa = signal<Record<string, string>>({});
  protected readonly errorImport = signal<string | null>(null);
  protected modoImport: 'combinar' | 'reemplazar' = 'combinar';

  protected readonly filasImport = computed<FilaImport[]>(() => {
    const l = this.lectura();
    const m = this.mapa();
    if (!l || !m['correo']) return [];
    const carpetas = new Set(this.carpetas().map((c) => c.nombre.toLowerCase()));
    const existentes = new Set(this.equipo().map((p) => p.correo.toLowerCase()));
    const filas = l.filas ?? l.muestra;
    const correosHoja = new Set(filas.map((f) => (f[m['correo']] ?? '').trim().toLowerCase()));
    const vistos = new Set<string>();
    return filas.map((f, i) => {
      const correo = (f[m['correo']] ?? '').trim().toLowerCase();
      const estadoTxt = norm(m['estado'] ? (f[m['estado']] ?? '') : '');
      const carpetaHoja = (m['carpeta'] ? (f[m['carpeta']] ?? '') : '').trim();
      const carpetaReal = this.carpetas().find((c) => c.nombre.toLowerCase() === carpetaHoja.toLowerCase())?.nombre ?? null;
      const respaldo = (m['respaldo'] ? (f[m['respaldo']] ?? '') : '').trim().toLowerCase() || null;
      const grupos = this.gruposPersonas()
        .filter((g) => {
          const col = m['g:' + g.id];
          const v = col ? norm(f[col] ?? '') : '';
          return v && !['no', '0', 'n', 'false'].includes(v);
        })
        .map((g) => g.id);
      const fila: FilaImport = {
        n: i + 1,
        correo,
        nombre: (m['nombre'] ? (f[m['nombre']] ?? '').trim() : '') || this.equipo().find((p) => p.correo === correo)?.nombre || nombreDesdeCorreo(correo),
        carpeta: carpetaReal ?? (carpetas.size ? null : carpetaHoja || null),
        disponible: !/ausente|vacaciones|licencia/.test(estadoTxt),
        activa: !/inactiv|no$|^0$/.test(estadoTxt),
        grupos,
        respaldo,
        estado: 'ok',
        nota: existentes.has(correo) ? 'Ya está: se actualiza' : 'Nueva',
      };
      if (!RE_CORREO.test(correo)) return { ...fila, estado: 'bad', nota: 'No es un correo' };
      if (vistos.has(correo)) return { ...fila, estado: 'bad', nota: 'Correo repetido en la hoja' };
      vistos.add(correo);
      if (carpetaHoja && carpetas.size && !carpetaReal) return { ...fila, estado: 'warn', nota: `La carpeta «${carpetaHoja}» no existe: queda sin carpeta` };
      if (respaldo && !correosHoja.has(respaldo) && !existentes.has(respaldo)) return { ...fila, estado: 'warn', nota: 'El respaldo no está en el equipo' };
      if (!grupos.length && this.gruposPersonas().length) return { ...fila, estado: 'warn', nota: 'Sin grupos: no recibirá correos' };
      return fila;
    });
  });
  protected readonly validasImport = computed(() => this.filasImport().filter((f) => f.estado !== 'bad').length);

  protected iniciales(n: string): string {
    return n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  }

  protected nombresGrupos(ids: string[]): string {
    return ids.map((id) => this.grupos().find((g) => g.id === id)?.nombre ?? id).join(', ');
  }

  protected sinActivosTxt(g: Grupo): string {
    if (g.sin_activos_modo === 'carpeta' && g.sin_activos_carpeta) return `se envían a la carpeta «${g.sin_activos_carpeta}»`;
    const p = g.sin_activos_modo === 'persona' ? this.equipo().find((x) => x.id === g.sin_activos_persona_id) : undefined;
    return p ? `se asignan a ${p.nombre}` : 'van a «Sin asignar» con alerta al líder';
  }

  // ── Cambios rápidos (PATCH) ──
  protected async patch(p: Persona, body: DisponibilidadIn): Promise<void> {
    this.ocupado.set(p.id);
    try {
      this.equipo.set(await this.api.cambiarDisponibilidad(p.id, body));
    } catch (e) {
      this.toast.error('No se pudo guardar el cambio', e instanceof Error ? e.message : String(e));
      this.version.update((v) => v + 1); // recrea la fila: el interruptor vuelve a su estado
    } finally {
      this.ocupado.set(null);
    }
  }

  // ── Cambios del equipo completo (PUT) ──
  private async guardarTodo(personas: PersonaIn[], ok?: string): Promise<boolean> {
    this.guardando.set(true);
    try {
      this.equipo.set(await this.api.guardarEquipo(this.buzon().id, personas));
      if (ok) this.toast.show(ok);
      return true;
    } catch (e) {
      this.toast.error('No se pudo guardar el equipo', e instanceof Error ? e.message : String(e));
      this.version.update((v) => v + 1);
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  private conCambio(id: string, cambio: (p: PersonaIn) => PersonaIn): PersonaIn[] {
    const equipo = this.equipo();
    return equipo.map((p) => (p.id === id ? cambio(aPersonaIn(p, equipo)) : aPersonaIn(p, equipo)));
  }

  protected cambiarCarpeta(p: Persona, carpeta: string | null): void {
    if ((p.carpeta ?? null) === carpeta) return;
    void this.guardarTodo(this.conCambio(p.id, (x) => ({ ...x, carpeta })), `${p.nombre}: ${carpeta ? `carpeta «${carpeta}»` : 'sin carpeta'}`);
  }

  protected cambiarRespaldo(p: Persona, g: Grupo, respaldoId: string): void {
    const correo = this.equipo().find((x) => x.id === respaldoId)?.correo ?? null;
    void this.guardarTodo(
      this.conCambio(p.id, (x) => ({ ...x, grupos: { ...x.grupos, [g.id]: { ...x.grupos[g.id], respaldo: correo } } })),
      `Respaldo de ${p.nombre} en ${g.nombre} actualizado`,
    );
  }

  protected quitarDeGrupo(p: Persona, g: Grupo): void {
    void this.guardarTodo(
      this.conCambio(p.id, (x) => {
        const grupos = { ...x.grupos };
        delete grupos[g.id];
        return { ...x, grupos };
      }),
      `${p.nombre} ya no atiende ${g.nombre}`,
    );
  }

  protected quitar(p: Persona): void {
    if (!confirm(`¿Quitar a ${p.nombre} del equipo? Deja de recibir correos de este buzón.`)) return;
    const equipo = this.equipo();
    void this.guardarTodo(equipo.filter((x) => x.id !== p.id).map((x) => aPersonaIn(x, equipo)), `${p.nombre} salió del equipo`);
  }

  protected async agregar(): Promise<void> {
    this.errorAgregar.set(null);
    const correo = this.nuevoCorreo.trim().toLowerCase();
    if (!RE_CORREO.test(correo)) return this.errorAgregar.set('Escribe un correo válido.');
    if (this.equipo().some((p) => p.correo.toLowerCase() === correo)) return this.errorAgregar.set(`${correo} ya está en el equipo.`);
    const nombre = this.nuevoNombre.trim() || nombreDesdeCorreo(correo);
    if (nombre.length < 2) return this.errorAgregar.set('Escribe el nombre.');
    const equipo = this.equipo();
    const ok = await this.guardarTodo(
      [...equipo.map((x) => aPersonaIn(x, equipo)), { nombre, correo, carpeta: null, disponible: true, grupos: {} }],
      `${nombre} entró al equipo: elige qué grupos atiende`,
    );
    if (ok) {
      this.nuevoNombre = '';
      this.nuevoCorreo = '';
    }
  }

  // ── Importar desde Excel ──
  protected async leerHoja(ev: Event): Promise<void> {
    const el = ev.target as HTMLInputElement;
    const archivo = el.files?.[0];
    el.value = '';
    if (!archivo) return;
    this.leyendo.set(true);
    this.errorImport.set(null);
    try {
      const l = await this.api.leerArchivo(archivo);
      this.archivoNombre.set(archivo.name);
      this.mapa.set(this.adivinar(l.columnas));
      this.lectura.set(l);
    } catch (e) {
      this.toast.error('No se pudo leer la hoja', e instanceof Error ? e.message : String(e));
    } finally {
      this.leyendo.set(false);
    }
  }

  private adivinar(columnas: string[]): Record<string, string> {
    const buscar = (re: RegExp) => columnas.find((c) => re.test(norm(c))) ?? '';
    const m: Record<string, string> = {
      correo: buscar(/correo|email|mail/),
      nombre: buscar(/^nombre|name|persona|analista/),
      carpeta: buscar(/carpeta|folder/),
      estado: buscar(/estado|activo|status/),
      respaldo: buscar(/respaldo|backup/),
    };
    this.gruposPersonas().forEach((g) => {
      const col = columnas.find((c) => norm(c) === norm(g.nombre));
      if (col) m['g:' + g.id] = col;
    });
    return m;
  }

  protected mapear(campo: string, col: string): void {
    this.mapa.update((m) => ({ ...m, [campo]: col }));
  }

  protected cerrarImport(): void {
    if (!this.guardando()) this.lectura.set(null);
  }

  protected async aplicarImport(): Promise<void> {
    const filas = this.filasImport().filter((f) => f.estado !== 'bad');
    const equipo = this.equipo();
    const enHoja = new Map(filas.map((f) => [f.correo, f]));
    const grupoIds = new Set(this.gruposPersonas().filter((g) => this.mapa()['g:' + g.id]).map((g) => g.id));
    const desdeHoja = (f: FilaImport, previo?: PersonaIn): PersonaIn => {
      // Los grupos con columna en la hoja se toman de la hoja; los demás se conservan.
      const grupos: PersonaIn['grupos'] = Object.fromEntries(Object.entries(previo?.grupos ?? {}).filter(([gid]) => !grupoIds.has(gid)));
      f.grupos.forEach((gid) => (grupos[gid] = { activa: f.activa, respaldo: f.respaldo }));
      return { nombre: f.nombre, correo: f.correo, carpeta: f.carpeta ?? previo?.carpeta ?? null, disponible: f.disponible, grupos };
    };
    let personas: PersonaIn[];
    if (this.modoImport === 'reemplazar') {
      personas = filas.map((f) => desdeHoja(f));
    } else {
      const actuales = equipo.map((p) => aPersonaIn(p, equipo));
      personas = actuales.map((p) => (enHoja.has(p.correo.toLowerCase()) ? desdeHoja(enHoja.get(p.correo.toLowerCase())!, p) : p));
      filas.filter((f) => !actuales.some((p) => p.correo.toLowerCase() === f.correo)).forEach((f) => personas.push(desdeHoja(f)));
    }
    if (await this.guardarTodo(personas, `Equipo importado: ${filas.length} persona(s) desde ${this.archivoNombre()}`)) this.lectura.set(null);
  }

  protected async descargarPlantilla(): Promise<void> {
    try {
      const XLSX = await import('xlsx');
      const cab = ['correo', 'nombre', 'carpeta', ...this.gruposPersonas().map((g) => g.nombre), 'estado', 'respaldo'];
      const ejemplo = ['persona@skandia.com.co', 'Nombre Apellido', '(opcional)', ...this.gruposPersonas().map((_, i) => (i === 0 ? 'X' : '')), 'activo', 'respaldo@skandia.com.co'];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cab, ejemplo]), 'Equipo');
      XLSX.writeFile(wb, `equipo-${this.buzon().nombre.replace(/[^\w-]+/g, '_')}.xlsx`);
    } catch (e) {
      this.toast.error('No se pudo generar la plantilla', e instanceof Error ? e.message : String(e));
    }
  }
}
