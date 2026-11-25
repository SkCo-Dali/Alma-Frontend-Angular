// «Citas» del coordinador: todas las citas con filtros, exportación a Excel y, con
// citas.manage, reasignar, cancelar (avisando o no a la persona) y registrar el resultado.

import { Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import {
  ACCIONES_HISTORIAL, AgendaApi, Asesor, CitaDetalle, Cita, ESTADOS, EstadoCita, FiltroCitas, PERM_GESTIONAR, REGIMENES, TipoCita,
  celularBonito, claseEstado, descargar, fechaHoraColombia, fechaLarga, horaBonita, hoyColombia, rotuloEstado,
  sumarDias,
} from './agenda.api';

const ACCIONES = ACCIONES_HISTORIAL;

@Component({
  selector: 'alma-citas-agenda',
  imports: [LucideAngularModule, AlmaLoaderComponent],
  template: `
    <section class="glass overflow-hidden rounded-3xl shadow-[var(--shadow-sm)]">
      <header class="flex flex-wrap items-end gap-3 border-b border-border/60 px-5 py-3">
        <h2 class="mr-auto self-center text-sm font-bold text-foreground">Citas</h2>
        <div>
          <label class="text-[11px] font-medium text-foreground" for="ci-desde">Desde</label>
          <input id="ci-desde" type="date" class="alma-input mt-0.5 h-8 w-36 text-xs" [value]="desde()" (change)="desde.set($any($event.target).value)" />
        </div>
        <div>
          <label class="text-[11px] font-medium text-foreground" for="ci-hasta">Hasta</label>
          <input id="ci-hasta" type="date" class="alma-input mt-0.5 h-8 w-36 text-xs" [value]="hasta()" (change)="hasta.set($any($event.target).value)" />
        </div>
        <div>
          <label class="text-[11px] font-medium text-foreground" for="ci-tipo">Tipo</label>
          <select id="ci-tipo" class="alma-input mt-0.5 h-8 w-48 text-xs" (change)="tipo.set(num($any($event.target).value))">
            <option value="">Todos</option>
            @for (t of tipos(); track t.Id) { <option [value]="t.Id" [selected]="tipo() === t.Id">{{ t.Titulo }}</option> }
          </select>
        </div>
        <div>
          <label class="text-[11px] font-medium text-foreground" for="ci-asesor">Asesor</label>
          <select id="ci-asesor" class="alma-input mt-0.5 h-8 w-44 text-xs" (change)="asesor.set(num($any($event.target).value))">
            <option value="">Todos</option>
            @for (a of asesores(); track a.Id) { <option [value]="a.Id" [selected]="asesor() === a.Id">{{ a.Nombre }}</option> }
          </select>
        </div>
        <div>
          <label class="text-[11px] font-medium text-foreground" for="ci-estado">Estado</label>
          <select id="ci-estado" class="alma-input mt-0.5 h-8 w-36 text-xs" (change)="estado.set($any($event.target).value || null)">
            <option value="">Todos</option>
            @for (e of estados; track e.valor) { <option [value]="e.valor" [selected]="estado() === e.valor">{{ e.rotulo }}</option> }
          </select>
        </div>
        <button type="button" class="alma-btn alma-btn-primary h-8 rounded-lg text-xs" [disabled]="cargando()" (click)="cargar()">
          <lucide-icon name="search" [size]="14" /> Buscar
        </button>
        <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="exportando() || !citas().length" (click)="exportar()">
          <lucide-icon name="download" [size]="14" /> Excel
        </button>
      </header>

      @if (resumen().total) {
        <p class="border-b border-border/60 px-5 py-2 text-xs text-muted-foreground">
          {{ resumen().total }} citas · {{ resumen().confirmadas }} confirmadas · {{ resumen().atendidas }} atendidas ·
          {{ resumen().noAsistio }} no asistieron · {{ resumen().canceladas }} canceladas
        </p>
      }

      @if (cargando()) {
        <div class="flex justify-center py-10"><alma-loader [size]="56" label="Cargando…" /></div>
      } @else if (!citas().length) {
        <p class="px-5 py-10 text-center text-sm text-muted-foreground">No hay citas con esos filtros.</p>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-[var(--table-header)] text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
              <tr>
                <th class="px-4 py-2">Fecha y hora</th>
                <th class="px-4 py-2">Persona</th>
                <th class="px-4 py-2">Tipo</th>
                <th class="px-4 py-2">Asesor</th>
                <th class="px-4 py-2">Estado</th>
                <th class="px-4 py-2">Código</th>
              </tr>
            </thead>
            <tbody>
              @for (c of citas(); track c.id) {
                <tr class="cursor-pointer border-t border-border/50 hover:bg-accent/40" [class.font-semibold]="detalle()?.id === c.id" [attr.aria-selected]="detalle()?.id === c.id" (click)="abrir(c)">
                  <td class="whitespace-nowrap px-4 py-2 text-foreground">{{ fechaCorta(c.fecha) }} · {{ horaBonita(c.hora) }}</td>
                  <td class="px-4 py-2 text-foreground">
                    {{ c.datosPurgados ? '—' : c.nombre }}
                    @if (!c.datosPurgados) { <span class="block text-xs text-muted-foreground">{{ celularBonito(c.celular) }}</span> }
                  </td>
                  <td class="px-4 py-2 text-xs text-foreground">{{ c.tipoTitulo }}</td>
                  <td class="px-4 py-2 text-xs text-foreground">{{ c.asesor }}</td>
                  <td class="px-4 py-2"><span class="alma-badge" [class]="claseEstado(c.estado)">{{ rotuloEstado(c.estado) }}</span></td>
                  <td class="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">{{ c.codigo }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (detalle(); as d) {
      <section class="glass mt-4 rounded-3xl p-5 shadow-[var(--shadow-sm)]" aria-label="Detalle de la cita">
        <header class="mb-3 flex flex-wrap items-start gap-3">
          <div class="mr-auto">
            <h2 class="text-base font-bold text-foreground">{{ d.tipoTitulo }} · {{ d.codigo }}</h2>
            <p class="text-sm text-muted-foreground">{{ fechaLarga(d.fecha) }}, {{ horaBonita(d.hora) }} ({{ d.duracion }} min) · {{ d.asesor }}</p>
          </div>
          <span class="alma-badge" [class]="claseEstado(d.estado)">{{ rotuloEstado(d.estado) }}</span>
          <button type="button" class="alma-btn alma-btn-ghost h-8 text-xs" (click)="detalle.set(null)" aria-label="Cerrar detalle">
            <lucide-icon name="x" [size]="14" />
          </button>
        </header>

        <div class="grid gap-4 md:grid-cols-2">
          <dl class="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
            @if (d.datosPurgados) {
              <dt class="text-muted-foreground">Persona</dt><dd class="text-foreground">Datos eliminados por retención</dd>
            } @else {
              <dt class="text-muted-foreground">Nombre</dt><dd class="text-foreground">{{ d.nombre }}</dd>
              <dt class="text-muted-foreground">Documento</dt><dd class="text-foreground">{{ d.tipoDoc }} {{ d.documento }}</dd>
              <dt class="text-muted-foreground">Celular</dt><dd class="text-foreground">{{ celularBonito(d.celular) }}</dd>
              <dt class="text-muted-foreground">Correo</dt><dd class="break-all text-foreground">{{ d.correo }}</dd>
              <dt class="text-muted-foreground">Régimen</dt><dd class="text-foreground">{{ regimen(d.regimen) }}</dd>
              @if (d.comentarios) { <dt class="text-muted-foreground">Comentarios</dt><dd class="text-foreground">{{ d.comentarios }}</dd> }
            }
            <dt class="text-muted-foreground">Origen</dt><dd class="text-foreground">{{ d.origen === 'web' ? 'Sitio web' : 'Agendada en Nova' }}@if (d.ciudad) { · {{ d.ciudad }} }</dd>
            @if (d.notas) { <dt class="text-muted-foreground">Notas</dt><dd class="text-foreground">{{ d.notas }}</dd> }
          </dl>
          <div>
            <h3 class="mb-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/65">Historial</h3>
            <ol class="space-y-1 text-xs">
              @for (h of d.historial; track $index) {
                <li class="text-foreground">
                  <span class="text-muted-foreground">{{ fechaHora(h.Fecha) }}</span> · <span class="font-medium">{{ accion(h.Accion) }}</span>
                  · {{ h.Actor }} @if (h.Detalle) { <span class="text-muted-foreground">({{ h.Detalle }})</span> }
                </li>
              }
            </ol>
          </div>
        </div>

        @if (puedeGestionar() && d.estado === 'confirmada') {
          <div class="mt-4 grid gap-4 border-t border-border/60 pt-4 md:grid-cols-2">
            <div class="space-y-2">
              <h3 class="text-sm font-semibold text-foreground">Reasignar</h3>
              <div class="flex gap-2">
                <select class="alma-input h-8 flex-1 text-xs" aria-label="Nuevo asesor" (change)="nuevoAsesor.set(num($any($event.target).value))">
                  <option value="">Elegir asesor…</option>
                  @for (a of asesoresDelTipo(d); track a.Id) {
                    <option [value]="a.Id" [disabled]="a.Id === d.asesorId">{{ a.Nombre }}</option>
                  }
                </select>
                <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" [disabled]="!nuevoAsesor() || ocupado()" (click)="reasignar(d)">Reasignar</button>
              </div>
              <p class="text-xs text-muted-foreground">Solo si ese asesor está libre a esa hora. Le llega el aviso con los datos.</p>
            </div>
            <div class="space-y-2">
              <h3 class="text-sm font-semibold text-foreground">Cancelar</h3>
              <input class="alma-input h-8 w-full text-xs" maxlength="300" placeholder="Motivo (queda en el historial)" [value]="motivo()" (input)="motivo.set($any($event.target).value)" />
              <label class="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" [checked]="avisar()" (change)="avisar.set($any($event.target).checked)" /> Avisar a la persona y al asesor por correo
              </label>
              <button type="button" class="alma-btn alma-btn-outline h-8 text-xs text-destructive" [disabled]="ocupado()" (click)="cancelar(d)">Cancelar la cita</button>
            </div>
          </div>
        }
        @if (puedeGestionar() && yaEmpezo(d) && ['confirmada', 'atendida', 'no_asistio'].includes(d.estado)) {
          <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            <span class="mr-2 text-sm font-semibold text-foreground">Resultado:</span>
            <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" [disabled]="ocupado()" (click)="marcar(d, 'atendida')">Atendida</button>
            <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" [disabled]="ocupado()" (click)="marcar(d, 'no_asistio')">No asistió</button>
          </div>
        }
      </section>
    }
  `,
})
export class CitasAgendaComponent {
  private readonly api = inject(AgendaApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly estados = ESTADOS;
  protected readonly desde = signal(hoyColombia());
  protected readonly hasta = signal(sumarDias(hoyColombia(), 30));
  protected readonly tipo = signal<number | null>(null);
  protected readonly asesor = signal<number | null>(null);
  protected readonly estado = signal<EstadoCita | null>(null);

  protected readonly tipos = signal<TipoCita[]>([]);
  protected readonly asesores = signal<Asesor[]>([]);
  protected readonly citas = signal<Cita[]>([]);
  protected readonly cargando = signal(false);
  protected readonly exportando = signal(false);
  protected readonly detalle = signal<CitaDetalle | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly nuevoAsesor = signal<number | null>(null);
  protected readonly motivo = signal('');
  protected readonly avisar = signal(true);

  protected readonly puedeGestionar = computed(() => this.auth.hasPermission(PERM_GESTIONAR));
  protected readonly resumen = computed(() => {
    const c = this.citas();
    const n = (e: EstadoCita) => c.filter((x) => x.estado === e).length;
    return { total: c.length, confirmadas: n('confirmada'), atendidas: n('atendida'), noAsistio: n('no_asistio'),
             canceladas: n('cancelada') };
  });

  protected readonly fechaLarga = fechaLarga;
  protected readonly horaBonita = horaBonita;
  protected readonly claseEstado = claseEstado;
  protected readonly rotuloEstado = rotuloEstado;
  protected readonly celularBonito = celularBonito;
  protected readonly fechaHora = fechaHoraColombia;

  constructor() {
    void this.iniciar();
  }

  protected num(v: string): number | null {
    return v ? Number(v) : null;
  }

  protected fechaCorta(f: string): string {
    const [y, m, d] = f.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  protected regimen(r: string | null | undefined): string {
    return r ? (REGIMENES[r] ?? r) : '—';
  }

  protected accion(a: string): string {
    return ACCIONES[a] ?? a;
  }

  protected yaEmpezo(c: Cita): boolean {
    return new Date(c.inicioUtc) <= new Date();
  }

  protected asesoresDelTipo(c: Cita): Asesor[] {
    const tipoId = this.tipos().find((t) => t.Slug === c.tipo)?.Id;
    return this.asesores().filter((a) => a.Activo && (tipoId == null || a.tipos.includes(tipoId)));
  }

  private filtro(): FiltroCitas {
    return { desde: this.desde(), hasta: this.hasta(), tipo: this.tipo(), asesor: this.asesor(), estado: this.estado() };
  }

  private async iniciar(): Promise<void> {
    try {
      const cfg = await this.api.configuracion();
      this.tipos.set(cfg.tipos);
      this.asesores.set(cfg.asesores);
    } catch (e) {
      this.toast.error('No se pudo cargar la configuración', e instanceof Error ? e.message : String(e));
    }
    await this.cargar();
  }

  protected async cargar(): Promise<void> {
    if (this.hasta() < this.desde()) {
      this.toast.error('Rango no válido', 'La fecha final debe ser posterior a la inicial.');
      return;
    }
    this.cargando.set(true);
    try {
      this.citas.set(await this.api.citas(this.filtro()));
      const d = this.detalle();
      if (d) this.detalle.set(this.citas().some((c) => c.id === d.id) ? await this.api.cita(d.id) : null);
    } catch (e) {
      this.toast.error('No se pudieron cargar las citas', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async abrir(c: Cita): Promise<void> {
    this.nuevoAsesor.set(null);
    this.motivo.set('');
    this.avisar.set(true);
    try {
      this.detalle.set(await this.api.cita(c.id));
    } catch (e) {
      this.toast.error('No se pudo abrir la cita', e instanceof Error ? e.message : String(e));
    }
  }

  protected async exportar(): Promise<void> {
    this.exportando.set(true);
    try {
      const { blob, nombre } = await this.api.exportar(this.filtro());
      descargar(blob, nombre);
    } catch (e) {
      this.toast.error('No se pudo exportar', e instanceof Error ? e.message : String(e));
    } finally {
      this.exportando.set(false);
    }
  }

  private async accionSobre(d: Cita, hacer: () => Promise<void>, ok: string): Promise<void> {
    this.ocupado.set(true);
    try {
      await hacer();
      this.toast.show(ok, d.codigo);
      await this.cargar();
    } catch (e) {
      this.toast.error('No se pudo completar', e instanceof Error ? e.message : String(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  protected reasignar(d: Cita): Promise<void> {
    const id = this.nuevoAsesor();
    return id ? this.accionSobre(d, () => this.api.reasignar(d.id, id), 'Cita reasignada') : Promise.resolve();
  }

  protected cancelar(d: Cita): Promise<void> {
    const aviso = this.avisar() ? ' Se avisará a la persona y al asesor.' : ' No se avisará a nadie.';
    if (!confirm(`¿Cancelar la cita ${d.codigo}?${aviso}`)) return Promise.resolve();
    return this.accionSobre(d, () => this.api.cancelar(d.id, this.motivo().trim(), this.avisar()), 'Cita cancelada');
  }

  protected marcar(d: Cita, estado: EstadoCita): Promise<void> {
    return this.accionSobre(d, () => this.api.marcar(d.id, estado, null), `Marcada como ${rotuloEstado(estado).toLowerCase()}`);
  }
}
