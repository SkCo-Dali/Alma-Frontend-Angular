// «Configuración» de la Agenda (administrador): tipos de cita, asesores con sus turnos
// semanales, ausencias y la política de tratamiento de datos que acepta la persona.

import { Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import {
  AgendaApi, Asesor, Configuracion, DIAS_SEMANA, FormularioServicio, TipoCita, TurnoEntrada, fechaHoraColombia,
  leerFormulario,
} from './agenda.api';

interface TurnoForm {
  dia: number;
  inicio: string;  // HH:MM
  fin: string;
}

interface AsesorForm {
  id: number | null;
  correo: string;
  nombre: string;
  activo: boolean;
  tipos: number[];
  turnos: TurnoForm[];
}

const CAMPOS_TIPO: { campo: keyof TipoCita; rotulo: string; ayuda: string; min: number; max: number }[] = [
  { campo: 'DuracionMin', rotulo: 'Duración (min)', ayuda: 'Largo de cada cita y paso del calendario.', min: 10, max: 240 },
  { campo: 'BufferMin', rotulo: 'Margen entre citas (min)', ayuda: 'Tiempo libre antes y después de cada cita.', min: 0, max: 120 },
  { campo: 'AnticipacionMinHoras', rotulo: 'Anticipación mínima (h)', ayuda: 'Cuántas horas antes se puede agendar.', min: 0, max: 720 },
  { campo: 'HorizonteDias', rotulo: 'Agendar hasta (días)', ayuda: 'Hasta cuántos días adelante.', min: 1, max: 180 },
];

@Component({
  selector: 'alma-configuracion-agenda',
  imports: [LucideAngularModule, AlmaLoaderComponent],
  template: `
    @if (!cfg()) {
      <div class="flex justify-center py-10"><alma-loader [size]="56" label="Cargando…" /></div>
    } @else {
      <div class="space-y-4">
        <!-- Tipos de cita -->
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <h2 class="mb-1 text-sm font-bold text-foreground">Tipos de cita</h2>
          <p class="mb-3 text-xs text-muted-foreground">Lo que ve la persona en el sitio. Un tipo inactivo deja de ofrecerse; sus citas siguen vigentes.</p>
          @for (srv of cfg()!.servicios; track srv.Id) {
          <h3 class="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-foreground/65 first-of-type:mt-0">{{ srv.Titulo }} · <span class="font-mono normal-case">{{ srv.Slug }}</span></h3>
          @if (formularioDe(srv.CamposJson); as f) {
            <div class="mb-3 rounded-2xl border border-border/60 p-3 text-xs">
              <p class="mb-1 font-semibold text-foreground">Datos que pide el formulario</p>
              <p class="text-muted-foreground">
                Siempre: nombre, correo, celular y autorización de datos ·
                {{ f.documento?.etiquetaNumero || 'Documento' }} ({{ (f.documento?.tipos ?? []).join(', ') }}){{ f.documento?.requerido ? '' : ', opcional' }}
              </p>
              <ul class="mt-1 list-disc pl-5 text-foreground">
                @for (p of f.preguntas ?? []; track p.id) {
                  <li>{{ p.etiqueta }}<span class="text-muted-foreground"> · {{ tipoPregunta(p.tipo) }}{{ p.requerido ? ' · obligatoria' : '' }}@if (p.opciones?.length) { : {{ p.opciones!.join(' / ') }} }</span></li>
                }
              </ul>
              <p class="mt-1 text-muted-foreground">Para cambiar las preguntas, pídalo a TI (por ahora se ajustan en la base de datos).</p>
            </div>
          }
          <div class="grid gap-3 lg:grid-cols-2">
            @for (t of tiposDe(srv.Id); track t.Id) {
              <article class="rounded-2xl border border-border/60 p-4">
                <header class="mb-3 flex items-center gap-2">
                  <span class="h-3 w-3 rounded-full" [style.background]="t.Color" aria-hidden="true"></span>
                  <h3 class="mr-auto text-sm font-semibold text-foreground">{{ t.Titulo }}</h3>
                  <label class="flex items-center gap-1.5 text-xs text-foreground">
                    <input type="checkbox" [checked]="valorTipo(t, 'Activo')" (change)="cambiarTipo(t, 'Activo', $any($event.target).checked)" /> Activo
                  </label>
                </header>
                <div class="grid grid-cols-2 gap-3">
                  @for (c of camposTipo; track c.campo) {
                    <div>
                      <label class="text-[11px] font-medium text-foreground" [for]="'t' + t.Id + c.campo">{{ c.rotulo }}</label>
                      <input [id]="'t' + t.Id + c.campo" type="number" class="alma-input mt-0.5 h-8 w-full text-xs" [min]="c.min" [max]="c.max"
                             [value]="valorTipo(t, c.campo)" (input)="cambiarTipo(t, c.campo, +$any($event.target).value)" [title]="c.ayuda" />
                    </div>
                  }
                </div>
                <div class="mt-3 grid grid-cols-3 gap-3">
                  <div>
                    <label class="text-[11px] font-medium text-foreground" [for]="'t' + t.Id + 'vi'">Desde las</label>
                    <input [id]="'t' + t.Id + 'vi'" type="time" class="alma-input mt-0.5 h-8 w-full text-xs" title="Ventana horaria del tipo. Vacío = solo los turnos de los asesores."
                           [value]="valorTipo(t, 'VentanaInicio') ?? ''" (change)="cambiarTipo(t, 'VentanaInicio', $any($event.target).value || null)" />
                  </div>
                  <div>
                    <label class="text-[11px] font-medium text-foreground" [for]="'t' + t.Id + 'vf'">Hasta las</label>
                    <input [id]="'t' + t.Id + 'vf'" type="time" class="alma-input mt-0.5 h-8 w-full text-xs" title="Vacío = solo los turnos de los asesores."
                           [value]="valorTipo(t, 'VentanaFin') ?? ''" (change)="cambiarTipo(t, 'VentanaFin', $any($event.target).value || null)" />
                  </div>
                  <div>
                    <label class="text-[11px] font-medium text-foreground" [for]="'t' + t.Id + 'form'">Abre formulario</label>
                    <select [id]="'t' + t.Id + 'form'" class="alma-input mt-0.5 h-8 w-full text-xs" (change)="cambiarTipo(t, 'Formulario', $any($event.target).value || null)">
                      <option value="" [selected]="!valorTipo(t, 'Formulario')">Ninguno</option>
                      <option value="for-0075" [selected]="valorTipo(t, 'Formulario') === 'for-0075'">FOR-0075 (Solicitudes)</option>
                    </select>
                  </div>
                </div>
                <label class="mt-3 block text-[11px] font-medium text-foreground" [for]="'t' + t.Id + 'conf'">Texto de confirmación ({{ '{' }}celular{{ '}' }} se reemplaza)</label>
                <input [id]="'t' + t.Id + 'conf'" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="400"
                       [value]="valorTipo(t, 'TextoConfirmacion') ?? ''" (input)="cambiarTipo(t, 'TextoConfirmacion', $any($event.target).value)" />
                @if (cambiosTipo()[t.Id]) {
                  <div class="mt-3 flex gap-2">
                    <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardando()" (click)="guardarTipo(t)">Guardar</button>
                    <button type="button" class="alma-btn alma-btn-ghost h-8 text-xs" (click)="descartarTipo(t)">Descartar</button>
                  </div>
                }
              </article>
            }
          </div>
          }
        </section>

        <!-- Asesores -->
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <header class="mb-3 flex flex-wrap items-center gap-2">
            <div class="mr-auto">
              <h2 class="text-sm font-bold text-foreground">Asesores y turnos</h2>
              <p class="text-xs text-muted-foreground">Los cupos salen de estos turnos (hora de Colombia), sin festivos. El correo debe ser el mismo con el que entra a Nova.</p>
            </div>
            <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" (click)="nuevoAsesor()"><lucide-icon name="plus" [size]="14" /> Agregar asesor</button>
          </header>

          @if (form(); as f) {
            <div class="mb-4 rounded-2xl border border-primary/40 p-4">
              <h3 class="mb-3 text-sm font-semibold text-foreground">{{ f.id ? 'Editar asesor' : 'Nuevo asesor' }}</h3>
              <div class="grid gap-3 md:grid-cols-3">
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="as-nombre">Nombre</label>
                  <input id="as-nombre" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="200" [value]="f.nombre" (input)="editarForm({ nombre: $any($event.target).value })" />
                </div>
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="as-correo">Correo</label>
                  <input id="as-correo" type="email" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="200" [value]="f.correo" (input)="editarForm({ correo: $any($event.target).value })" />
                </div>
                <div class="flex items-end gap-4 pb-1.5">
                  <label class="flex items-center gap-1.5 text-xs text-foreground">
                    <input type="checkbox" [checked]="f.activo" (change)="editarForm({ activo: $any($event.target).checked })" /> Activo
                  </label>
                </div>
              </div>
              <fieldset class="mt-3">
                <legend class="text-[11px] font-medium text-foreground">Atiende</legend>
                <div class="mt-1 flex flex-wrap gap-4">
                  @for (t of cfg()!.tipos; track t.Id) {
                    <label class="flex items-center gap-1.5 text-xs text-foreground">
                      <input type="checkbox" [checked]="f.tipos.includes(t.Id)" (change)="alternarTipo(t.Id)" /> {{ t.Titulo }}
                    </label>
                  }
                </div>
              </fieldset>
              <fieldset class="mt-3">
                <legend class="text-[11px] font-medium text-foreground">Turnos semanales</legend>
                <div class="mt-1 space-y-2">
                  @for (tu of f.turnos; track $index; let i = $index) {
                    <div class="flex flex-wrap items-center gap-2">
                      <select class="alma-input h-8 w-32 text-xs" aria-label="Día" (change)="editarTurno(i, { dia: +$any($event.target).value })">
                        @for (d of dias; track $index; let di = $index) { <option [value]="di" [selected]="tu.dia === di">{{ d }}</option> }
                      </select>
                      <input type="time" class="alma-input h-8 w-28 text-xs" aria-label="Desde" [value]="tu.inicio" (change)="editarTurno(i, { inicio: $any($event.target).value })" />
                      <span class="text-xs text-muted-foreground">a</span>
                      <input type="time" class="alma-input h-8 w-28 text-xs" aria-label="Hasta" [value]="tu.fin" (change)="editarTurno(i, { fin: $any($event.target).value })" />
                      <button type="button" class="alma-btn alma-btn-ghost h-8 text-xs" aria-label="Quitar turno" (click)="quitarTurno(i)"><lucide-icon name="trash-2" [size]="14" /></button>
                    </div>
                  }
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" (click)="agregarTurno()"><lucide-icon name="plus" [size]="14" /> Turno</button>
                    <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" (click)="horarioOficina()">Lunes a viernes 8–12 y 14–17</button>
                  </div>
                </div>
              </fieldset>
              <div class="mt-4 flex gap-2">
                <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardando()" (click)="guardarAsesor()">Guardar</button>
                <button type="button" class="alma-btn alma-btn-ghost h-8 text-xs" (click)="form.set(null)">Cancelar</button>
              </div>
            </div>
          }

          @if (!cfg()!.asesores.length) {
            <p class="py-6 text-center text-sm text-muted-foreground">Aún no hay asesores. Sin asesores con turno, el sitio no muestra cupos.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-[var(--table-header)] text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
                  <tr><th class="px-4 py-2">Asesor</th><th class="px-4 py-2">Atiende</th><th class="px-4 py-2">Turnos</th><th class="px-4 py-2">Estado</th><th class="px-4 py-2"></th></tr>
                </thead>
                <tbody>
                  @for (a of cfg()!.asesores; track a.Id) {
                    <tr class="border-t border-border/50 align-top">
                      <td class="px-4 py-2 text-foreground">{{ a.Nombre }}<span class="block text-xs text-muted-foreground">{{ a.Correo }}</span></td>
                      <td class="px-4 py-2 text-xs text-foreground">{{ nombresTipos(a.tipos) }}</td>
                      <td class="px-4 py-2 text-xs text-foreground">{{ resumenTurnos(a) }}</td>
                      <td class="px-4 py-2"><span class="alma-badge" [class]="a.Activo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300'">{{ a.Activo ? 'Activo' : 'Inactivo' }}</span></td>
                      <td class="px-4 py-2 text-right"><button type="button" class="alma-btn alma-btn-ghost h-8 text-xs" (click)="editarAsesor(a)"><lucide-icon name="pencil" [size]="14" /> Editar</button></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <!-- Ausencias -->
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <h2 class="mb-1 text-sm font-bold text-foreground">Ausencias</h2>
          <p class="mb-3 text-xs text-muted-foreground">Vacaciones, incapacidades o capacitaciones: en ese rango el asesor no recibe citas. Las ya agendadas no se mueven solas; reasígnelas en Citas.</p>
          <div class="mb-3 flex flex-wrap items-end gap-2">
            <div>
              <label class="text-[11px] font-medium text-foreground" for="au-asesor">Asesor</label>
              <select id="au-asesor" class="alma-input mt-0.5 h-8 w-48 text-xs" (change)="ausencia.set({ ...ausencia(), asesorId: +$any($event.target).value || null })">
                <option value="">Elegir…</option>
                @for (a of cfg()!.asesores; track a.Id) { <option [value]="a.Id">{{ a.Nombre }}</option> }
              </select>
            </div>
            <div>
              <label class="text-[11px] font-medium text-foreground" for="au-desde">Desde</label>
              <input id="au-desde" type="datetime-local" class="alma-input mt-0.5 h-8 text-xs" (change)="ausencia.set({ ...ausencia(), desde: $any($event.target).value })" />
            </div>
            <div>
              <label class="text-[11px] font-medium text-foreground" for="au-hasta">Hasta</label>
              <input id="au-hasta" type="datetime-local" class="alma-input mt-0.5 h-8 text-xs" (change)="ausencia.set({ ...ausencia(), hasta: $any($event.target).value })" />
            </div>
            <div class="min-w-[12rem] flex-1">
              <label class="text-[11px] font-medium text-foreground" for="au-motivo">Motivo</label>
              <input id="au-motivo" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="200" (input)="ausencia.set({ ...ausencia(), motivo: $any($event.target).value })" />
            </div>
            <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardando()" (click)="crearAusencia()">Agregar</button>
          </div>
          @if (cfg()!.ausencias.length) {
            <ul class="divide-y divide-border/50 text-sm">
              @for (au of cfg()!.ausencias; track au.Id) {
                <li class="flex flex-wrap items-center gap-3 py-2">
                  <span class="font-medium text-foreground">{{ nombreAsesor(au.AsesorId) }}</span>
                  <span class="text-xs text-foreground">{{ fechaHora(au.InicioUtc) }} → {{ fechaHora(au.FinUtc) }}</span>
                  <span class="mr-auto text-xs text-muted-foreground">{{ au.Motivo ?? '' }}</span>
                  <button type="button" class="alma-btn alma-btn-ghost h-8 text-xs" aria-label="Quitar ausencia" (click)="borrarAusencia(au.Id)"><lucide-icon name="trash-2" [size]="14" /></button>
                </li>
              }
            </ul>
          }
        </section>

        <!-- Política de datos -->
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <h2 class="mb-1 text-sm font-bold text-foreground">Política de tratamiento de datos</h2>
          <p class="mb-3 text-xs text-muted-foreground">Texto de la casilla que acepta la persona al agendar. Cada cita guarda la versión que aceptó; para cambiar el texto se crea una versión nueva.</p>
          @if (cfg()!.politicas[0]; as p) {
            <div class="mb-3 rounded-2xl border border-border/60 p-3 text-sm">
              <p class="text-xs text-muted-foreground">Vigente: versión {{ p.Version }} · desde {{ fechaHora(p.VigenteDesde) }}</p>
              <p class="mt-1 text-foreground">{{ p.Texto }}</p>
              <p class="mt-1 text-xs" [class.text-destructive]="!p.Url">{{ p.Url ?? 'Sin enlace a la política completa.' }}</p>
            </div>
          }
          <div class="grid gap-2 md:grid-cols-[10rem_1fr]">
            <input class="alma-input h-8 text-xs" maxlength="20" placeholder="Versión (p. ej. 2027-01)" aria-label="Versión" (input)="politica.set({ ...politica(), version: $any($event.target).value })" />
            <input class="alma-input h-8 text-xs" maxlength="400" placeholder="https://… enlace a la política completa" aria-label="Enlace" (input)="politica.set({ ...politica(), url: $any($event.target).value })" />
            <textarea class="alma-input min-h-16 text-xs md:col-span-2" maxlength="1000" placeholder="Texto de la casilla" aria-label="Texto" (input)="politica.set({ ...politica(), texto: $any($event.target).value })"></textarea>
          </div>
          <button type="button" class="alma-btn alma-btn-outline mt-2 h-8 text-xs" [disabled]="guardando()" (click)="crearPolitica()">Publicar versión nueva</button>
        </section>
      </div>
    }
  `,
})
export class ConfiguracionAgendaComponent {
  private readonly api = inject(AgendaApi);
  private readonly toast = inject(ToastService);

  protected readonly cfg = signal<Configuracion | null>(null);
  protected readonly guardando = signal(false);
  protected readonly cambiosTipo = signal<Record<number, Partial<TipoCita>>>({});
  protected readonly form = signal<AsesorForm | null>(null);
  protected readonly ausencia = signal<{ asesorId: number | null; desde: string; hasta: string; motivo: string }>(
    { asesorId: null, desde: '', hasta: '', motivo: '' });
  protected readonly politica = signal({ version: '', texto: '', url: '' });

  protected readonly camposTipo = CAMPOS_TIPO;
  protected readonly dias = DIAS_SEMANA;
  protected readonly fechaHora = fechaHoraColombia;
  private readonly tiposPorId = computed(() => new Map((this.cfg()?.tipos ?? []).map((t) => [t.Id, t])));

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.cfg.set(await this.api.configuracion());
    } catch (e) {
      this.toast.error('No se pudo cargar la configuración', e instanceof Error ? e.message : String(e));
    }
  }

  private async guardar(hacer: () => Promise<unknown>, ok: string): Promise<boolean> {
    this.guardando.set(true);
    try {
      await hacer();
      this.toast.show(ok);
      await this.cargar();
      return true;
    } catch (e) {
      this.toast.error('No se pudo guardar', e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Tipos ──
  protected formularioDe(json: string | null): FormularioServicio | null {
    return leerFormulario(json);
  }

  protected tipoPregunta(t: string): string {
    return ({ texto: 'texto', texto_largo: 'texto largo', numero: 'número', fecha: 'fecha', opciones: 'una opción',
              si_no: 'sí o no' } as Record<string, string>)[t] ?? t;
  }

  protected tiposDe(servicioId: number): TipoCita[] {
    return (this.cfg()?.tipos ?? []).filter((t) => t.ServicioId === servicioId);
  }

  protected valorTipo<K extends keyof TipoCita>(t: TipoCita, campo: K): TipoCita[K] {
    const c = this.cambiosTipo()[t.Id];
    return (c && campo in c ? c[campo] : t[campo]) as TipoCita[K];
  }

  protected cambiarTipo(t: TipoCita, campo: keyof TipoCita, valor: unknown): void {
    this.cambiosTipo.update((c) => ({ ...c, [t.Id]: { ...(c[t.Id] ?? {}), [campo]: valor } }));
  }

  protected descartarTipo(t: TipoCita): void {
    this.cambiosTipo.update((c) => { const n = { ...c }; delete n[t.Id]; return n; });
  }

  protected async guardarTipo(t: TipoCita): Promise<void> {
    const cambios = this.cambiosTipo()[t.Id];
    if (!cambios) return;
    for (const c of CAMPOS_TIPO) {
      const v = cambios[c.campo] as number | undefined;
      if (v !== undefined && (!Number.isFinite(v) || v < c.min || v > c.max)) {
        this.toast.error('Valor fuera de rango', `${c.rotulo}: entre ${c.min} y ${c.max}.`);
        return;
      }
    }
    const vi = this.valorTipo(t, 'VentanaInicio'), vf = this.valorTipo(t, 'VentanaFin');
    if (vi && vf && vf <= vi) {
      this.toast.error('Revise la ventana horaria', 'La hora final debe ser posterior a la inicial.');
      return;
    }
    if (await this.guardar(() => this.api.actualizarTipo(t.Id, cambios), 'Tipo de cita guardado')) this.descartarTipo(t);
  }

  // ── Asesores ──
  protected nombresTipos(ids: number[]): string {
    const todos = this.cfg()?.tipos ?? [];
    if (todos.length && todos.every((t) => ids.includes(t.Id))) return 'Todos los tipos';
    return ids.map((id) => this.tiposPorId().get(id)?.Titulo ?? `#${id}`).join(' · ') || '—';
  }

  protected nombreAsesor(id: number): string {
    return this.cfg()?.asesores.find((a) => a.Id === id)?.Nombre ?? `#${id}`;
  }

  protected resumenTurnos(a: Asesor): string {
    if (!a.turnos.length) return 'Sin turnos';
    const porDia = new Map<number, string[]>();
    for (const t of a.turnos) porDia.set(t.DiaSemana, [...(porDia.get(t.DiaSemana) ?? []), `${t.HoraInicio.slice(0, 5)}–${t.HoraFin.slice(0, 5)}`]);
    return [...porDia].sort((x, y) => x[0] - y[0]).map(([d, h]) => `${DIAS_SEMANA[d].slice(0, 3)} ${h.join(', ')}`).join(' · ');
  }

  protected nuevoAsesor(): void {
    this.form.set({ id: null, correo: '', nombre: '', activo: true, tipos: (this.cfg()?.tipos ?? []).map((t) => t.Id), turnos: [] });
  }

  protected editarAsesor(a: Asesor): void {
    this.form.set({
      id: a.Id, correo: a.Correo, nombre: a.Nombre, activo: a.Activo, tipos: [...a.tipos],
      turnos: a.turnos.map((t) => ({ dia: t.DiaSemana, inicio: t.HoraInicio.slice(0, 5), fin: t.HoraFin.slice(0, 5) })),
    });
  }

  protected editarForm(cambios: Partial<AsesorForm>): void {
    this.form.update((f) => (f ? { ...f, ...cambios } : f));
  }

  protected alternarTipo(id: number): void {
    this.form.update((f) => f && { ...f, tipos: f.tipos.includes(id) ? f.tipos.filter((x) => x !== id) : [...f.tipos, id] });
  }

  protected agregarTurno(): void {
    this.form.update((f) => f && { ...f, turnos: [...f.turnos, { dia: 0, inicio: '08:00', fin: '12:00' }] });
  }

  protected horarioOficina(): void {
    const turnos: TurnoForm[] = [];
    for (let d = 0; d < 5; d++) turnos.push({ dia: d, inicio: '08:00', fin: '12:00' }, { dia: d, inicio: '14:00', fin: '17:00' });
    this.form.update((f) => f && { ...f, turnos });
  }

  protected editarTurno(i: number, cambios: Partial<TurnoForm>): void {
    this.form.update((f) => f && { ...f, turnos: f.turnos.map((t, j) => (j === i ? { ...t, ...cambios } : t)) });
  }

  protected quitarTurno(i: number): void {
    this.form.update((f) => f && { ...f, turnos: f.turnos.filter((_, j) => j !== i) });
  }

  protected async guardarAsesor(): Promise<void> {
    const f = this.form();
    if (!f) return;
    if (f.nombre.trim().length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.trim())) {
      this.toast.error('Revise los datos', 'Nombre (mínimo 3 letras) y un correo válido.');
      return;
    }
    if (f.turnos.some((t) => !t.inicio || !t.fin || t.fin <= t.inicio)) {
      this.toast.error('Revise los turnos', 'La hora final de cada turno debe ser posterior a la inicial.');
      return;
    }
    const datos = { correo: f.correo.trim().toLowerCase(), nombre: f.nombre.trim(), activo: f.activo, tipos: f.tipos };
    const turnos: TurnoEntrada[] = f.turnos.map((t) => ({ dia_semana: t.dia, hora_inicio: t.inicio, hora_fin: t.fin }));
    const ok = await this.guardar(async () => {
      const id = f.id ?? (await this.api.crearAsesor(datos)).id;
      if (f.id) await this.api.actualizarAsesor(f.id, datos);
      await this.api.guardarTurnos(id, turnos);
    }, f.id ? 'Asesor actualizado' : 'Asesor agregado');
    if (ok) this.form.set(null);
  }

  // ── Ausencias ──
  protected async crearAusencia(): Promise<void> {
    const a = this.ausencia();
    if (!a.asesorId || !a.desde || !a.hasta || a.hasta <= a.desde) {
      this.toast.error('Revise la ausencia', 'Elija el asesor y un rango en el que el fin sea posterior al inicio.');
      return;
    }
    await this.guardar(() => this.api.crearAusencia({ asesorId: a.asesorId!, desde: a.desde, hasta: a.hasta, motivo: a.motivo.trim() || null }),
      'Ausencia agregada');
  }

  protected async borrarAusencia(id: number): Promise<void> {
    if (!confirm('¿Quitar esta ausencia? El asesor vuelve a recibir citas en ese rango.')) return;
    await this.guardar(() => this.api.borrarAusencia(id), 'Ausencia quitada');
  }

  // ── Política ──
  protected async crearPolitica(): Promise<void> {
    const p = this.politica();
    if (!/^[A-Za-z0-9._-]{3,20}$/.test(p.version.trim()) || p.texto.trim().length < 20) {
      this.toast.error('Revise la política', 'Versión de 3 a 20 caracteres (letras, números, punto o guion) y un texto de al menos 20.');
      return;
    }
    if (p.url && !p.url.startsWith('https://')) {
      this.toast.error('Revise el enlace', 'Debe empezar por https://');
      return;
    }
    if (!confirm('Desde ahora las personas aceptarán este texto. ¿Publicar?')) return;
    await this.guardar(() => this.api.crearPolitica({ version: p.version.trim(), texto: p.texto.trim(), url: p.url.trim() || null }),
      'Política publicada');
  }
}
