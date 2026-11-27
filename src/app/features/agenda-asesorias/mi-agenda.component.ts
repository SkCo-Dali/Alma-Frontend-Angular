// «Mi agenda» del asesor: sus citas por día, con los datos de contacto para escribir o
// llamar a la hora agendada, y el cierre de cada una (atendida / no asistió + notas).

import { Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { PERM_DILIGENCIAR } from '../solicitudes-prestaciones/prestaciones.api';
import { CitaSolicitudService, tipoDocumentoFormulario } from '../prestaciones/cita-solicitud.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  ACCIONES_HISTORIAL, AgendaApi, Cita, CitaDetalle, EstadoCita, REGIMENES, fechaHoraColombia, celularBonito, claseEstado, enlaceWhatsapp, fechaLarga, horaBonita,
  hoyColombia, rotuloEstado, sumarDias,
} from './agenda.api';

type Rango = 'proximas' | 'pasadas';

@Component({
  selector: 'alma-mi-agenda',
  imports: [LucideAngularModule, AlmaLoaderComponent],
  template: `
    <section class="glass overflow-hidden rounded-3xl shadow-[var(--shadow-sm)]">
      <header class="flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-3">
        <h2 class="mr-auto text-sm font-bold text-foreground">Mis citas</h2>
        <div class="inline-flex gap-1 rounded-xl bg-accent/40 p-1" role="group" aria-label="Rango">
          <button type="button" class="h-7 rounded-lg px-3 text-xs font-medium" [class]="claseRango('proximas')" (click)="cambiarRango('proximas')">Próximas 2 semanas</button>
          <button type="button" class="h-7 rounded-lg px-3 text-xs font-medium" [class]="claseRango('pasadas')" (click)="cambiarRango('pasadas')">Últimas 2 semanas</button>
        </div>
        <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="cargando()" (click)="cargar()">
          <lucide-icon name="refresh-cw" [size]="14" /> Actualizar
        </button>
      </header>

      @if (cargando()) {
        <div class="flex justify-center py-10"><alma-loader [size]="56" label="Cargando…" /></div>
      } @else if (!citas().length) {
        <p class="px-5 py-10 text-center text-sm text-muted-foreground">
          {{ rango() === 'proximas' ? 'No tiene citas agendadas en las próximas dos semanas.' : 'No tuvo citas en las últimas dos semanas.' }}
        </p>
      } @else {
        @for (dia of porDia(); track dia.fecha) {
          <h3 class="bg-[var(--table-header)] px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
            {{ fechaLarga(dia.fecha) }} @if (dia.fecha === hoy) { · hoy }
          </h3>
          <ul>
            @for (c of dia.citas; track c.id) {
              <li class="flex flex-wrap items-start gap-4 border-t border-border/50 px-5 py-3">
                <div class="w-24 shrink-0">
                  <p class="text-sm font-bold text-foreground">{{ horaBonita(c.hora) }}</p>
                  <p class="text-xs text-muted-foreground">{{ c.duracion }} min</p>
                </div>
                <div class="min-w-[14rem] flex-1 space-y-1">
                  <p class="text-sm font-semibold text-foreground">
                    <button type="button" class="text-left hover:text-primary hover:underline" [attr.aria-expanded]="abierta() === c.id"
                            [attr.aria-controls]="'det-' + c.id" (click)="alternarDetalle(c)">
                      {{ c.datosPurgados ? 'Datos eliminados por retención' : c.nombre }}
                    </button>
                    <span class="alma-badge ml-1" [class]="claseEstado(c.estado)">{{ rotuloEstado(c.estado) }}</span>
                  </p>
                  <p class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{{ c.tipoTitulo }} · {{ c.codigo }}</span>
                    <button type="button" class="inline-flex items-center gap-0.5 font-medium text-primary hover:underline" [attr.aria-expanded]="abierta() === c.id"
                            [attr.aria-controls]="'det-' + c.id" (click)="alternarDetalle(c)">
                      {{ abierta() === c.id ? 'Ocultar detalle' : 'Ver detalle' }}
                      <lucide-icon [name]="abierta() === c.id ? 'chevron-up' : 'chevron-down'" [size]="13" />
                    </button>
                  </p>
                  @if (!c.datosPurgados) {
                    <p class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground">
                      @if (enlaceWhatsapp(c.celular) && c.tipo === 'whatsapp') {
                        <a class="inline-flex items-center gap-1 font-medium text-primary hover:underline" [href]="enlaceWhatsapp(c.celular)" target="_blank" rel="noopener">
                          <lucide-icon name="message-circle" [size]="13" /> {{ celularBonito(c.celular) }}
                        </a>
                      } @else {
                        <a class="inline-flex items-center gap-1 font-medium text-primary hover:underline" [href]="'tel:+57' + c.celular">
                          <lucide-icon name="phone" [size]="13" /> {{ celularBonito(c.celular) }}
                        </a>
                      }
                      <span>{{ c.correo }}</span>
                      <span>{{ c.tipoDoc }} {{ c.documento }}</span>
                      @if (c.regimen) { <span>Régimen: {{ regimen(c.regimen) }}</span> }
                    </p>
                    @if (c.comentarios) { <p class="text-xs italic text-muted-foreground">«{{ c.comentarios }}»</p> }
                  }
                  @if (editando() === c.id) {
                    <div class="mt-2 space-y-2">
                      <textarea class="alma-input min-h-16 w-full text-xs" maxlength="1000" placeholder="Notas de la asesoría (opcional)"
                                [value]="notas()" (input)="notas.set($any($event.target).value)"></textarea>
                      <div class="flex flex-wrap gap-2">
                        <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardando()" (click)="cerrar(c, 'atendida')">Atendida</button>
                        <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" [disabled]="guardando()" (click)="cerrar(c, 'no_asistio')">No asistió</button>
                        <button type="button" class="alma-btn alma-btn-ghost w-auto px-3 h-8 text-xs" [disabled]="guardando()" (click)="editando.set(null)">Cancelar</button>
                      </div>
                    </div>
                  } @else if (c.notas) {
                    <p class="text-xs text-foreground"><span class="font-medium">Notas:</span> {{ c.notas }}</p>
                  }
                </div>
                <div class="flex shrink-0 flex-col items-end gap-2">
                  @if (puedeIniciarSolicitud(c)) {
                    <button type="button" class="alma-btn alma-btn-primary h-8 whitespace-nowrap text-xs" (click)="iniciarSolicitud(c)">
                      <lucide-icon name="file-text" [size]="14" /> Iniciar solicitud
                    </button>
                  }
                  @if (editando() !== c.id && puedeCerrar(c)) {
                    <button type="button" class="alma-btn alma-btn-outline h-8 whitespace-nowrap text-xs" (click)="abrir(c)">
                      <lucide-icon name="check-circle-2" [size]="14" /> {{ c.estado === 'confirmada' ? 'Registrar resultado' : 'Cambiar resultado' }}
                    </button>
                  }
                </div>
                @if (abierta() === c.id) {
                  <div [id]="'det-' + c.id" class="basis-full rounded-2xl border border-border/60 bg-[var(--table-header)] p-4">
                    @if (detalle(); as d) {
                      <div animate.enter="nova-expande" animate.leave="nova-colapsa" class="grid gap-4 md:grid-cols-2">
                        <dl class="grid grid-cols-[minmax(8.5rem,40%)_1fr] gap-x-3 gap-y-1 text-sm">
                          <dt class="text-muted-foreground">Asesoría</dt><dd class="text-foreground">{{ d.tipoTitulo }}</dd>
                          <dt class="text-muted-foreground">Canal</dt><dd class="text-foreground">{{ d.canal }}</dd>
                          <dt class="text-muted-foreground">Fecha y hora</dt><dd class="text-foreground">{{ fechaLarga(d.fecha) }}, {{ horaBonita(d.hora) }} ({{ d.duracion }} min)</dd>
                          <dt class="text-muted-foreground">Código</dt><dd class="font-mono text-foreground">{{ d.codigo }}</dd>
                          @if (d.datosPurgados) {
                            <dt class="text-muted-foreground">Persona</dt><dd class="text-foreground">Datos eliminados por retención</dd>
                          } @else {
                            <dt class="text-muted-foreground">Nombre</dt><dd class="text-foreground">{{ d.nombre }}</dd>
                            <dt class="text-muted-foreground">Documento</dt><dd class="text-foreground">{{ d.tipoDoc }} {{ d.documento }}</dd>
                            <dt class="text-muted-foreground">Celular</dt><dd class="text-foreground">{{ celularBonito(d.celular) }}</dd>
                            <dt class="text-muted-foreground">Correo</dt><dd class="break-all text-foreground">{{ d.correo }}</dd>
                            @if (d.regimen) { <dt class="text-muted-foreground">Régimen actual</dt><dd class="text-foreground">{{ regimen(d.regimen) }}</dd> }
                            @for (r of d.respuestas ?? []; track r.id) {
                              <dt class="text-muted-foreground">{{ r.etiqueta }}</dt><dd class="whitespace-pre-line text-foreground">{{ r.valor }}</dd>
                            }
                            @if (d.comentarios) { <dt class="text-muted-foreground">Comentarios</dt><dd class="text-foreground">{{ d.comentarios }}</dd> }
                          }
                          <dt class="text-muted-foreground">Origen</dt><dd class="text-foreground">{{ d.origen === 'web' ? 'Sitio web' : 'Agendada en Nova' }}@if (d.ciudad) { · {{ d.ciudad }} }</dd>
                          <dt class="text-muted-foreground">Agendada el</dt><dd class="text-foreground">{{ fechaHora(d.creadaUtc) }}</dd>
                          @if (d.notas) { <dt class="text-muted-foreground">Notas</dt><dd class="text-foreground">{{ d.notas }}</dd> }
                        </dl>
                        <div>
                          <h4 class="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
                            <lucide-icon name="history" [size]="13" /> Historial
                          </h4>
                          <ol class="space-y-1 text-xs">
                            @for (h of d.historial; track $index) {
                              <li class="text-foreground">
                                <span class="text-muted-foreground">{{ fechaHora(h.Fecha) }}</span> ·
                                <span class="font-medium">{{ accion(h.Accion) }}</span> · {{ h.Actor }}
                                @if (h.Detalle) { <span class="text-muted-foreground">({{ h.Detalle }})</span> }
                              </li>
                            }
                          </ol>
                        </div>
                      </div>
                    } @else {
                      <div class="flex justify-center py-4"><alma-loader [size]="40" label="Cargando…" /></div>
                    }
                  </div>
                }
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
})
export class MiAgendaComponent {
  private readonly api = inject(AgendaApi);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly citaSolicitud = inject(CitaSolicitudService);

  protected readonly hoy = hoyColombia();
  protected readonly rango = signal<Rango>('proximas');
  protected readonly citas = signal<Cita[]>([]);
  protected readonly cargando = signal(false);
  protected readonly editando = signal<string | null>(null);
  protected readonly notas = signal('');
  protected readonly guardando = signal(false);
  /** Cita con el detalle abierto y su detalle (con historial). */
  protected readonly abierta = signal<string | null>(null);
  protected readonly detalle = signal<CitaDetalle | null>(null);
  protected readonly fechaHora = fechaHoraColombia;

  protected readonly porDia = computed(() => {
    const grupos = new Map<string, Cita[]>();
    const lista = [...this.citas()].sort((a, b) => a.inicioUtc.localeCompare(b.inicioUtc));
    if (this.rango() === 'pasadas') lista.reverse();
    for (const c of lista) {
      if (c.estado === 'reprogramada') continue;  // ya existe la cita nueva
      grupos.set(c.fecha, [...(grupos.get(c.fecha) ?? []), c]);
    }
    return [...grupos].map(([fecha, citas]) => ({ fecha, citas }));
  });

  protected readonly fechaLarga = fechaLarga;
  protected readonly horaBonita = horaBonita;
  protected readonly claseEstado = claseEstado;
  protected readonly rotuloEstado = rotuloEstado;
  protected readonly enlaceWhatsapp = enlaceWhatsapp;
  protected readonly celularBonito = celularBonito;

  constructor() {
    void this.cargar();
  }

  protected accion(a: string): string {
    return ACCIONES_HISTORIAL[a] ?? a;
  }

  protected async alternarDetalle(c: Cita): Promise<void> {
    if (this.abierta() === c.id) {
      this.abierta.set(null);
      return;
    }
    this.abierta.set(c.id);
    await this.cargarDetalle(c.id);
  }

  private async cargarDetalle(id: string): Promise<void> {
    this.detalle.set(null);
    try {
      const d = await this.api.miCita(id);
      if (this.abierta() === id) this.detalle.set(d);
    } catch (e) {
      this.abierta.set(null);
      this.toast.error('No se pudo abrir la cita', e instanceof Error ? e.message : String(e));
    }
  }

  protected regimen(r: string): string {
    return REGIMENES[r] ?? r;
  }

  protected claseRango(r: Rango): string {
    return this.rango() === r ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:text-foreground';
  }

  protected cambiarRango(r: Rango): void {
    this.rango.set(r);
    void this.cargar();
  }

  /** El resultado se registra cuando la cita ya empezó (el backend también lo exige). */
  protected puedeCerrar(c: Cita): boolean {
    return ['confirmada', 'atendida', 'no_asistio'].includes(c.estado) && new Date(`${c.inicioUtc}`) <= new Date();
  }

  /** Citas cuyo tipo abre el formulario FOR-0075 (hoy: devolución de saldos), con datos vigentes. */
  protected puedeIniciarSolicitud(c: Cita): boolean {
    return c.formulario === 'for-0075' && !c.datosPurgados && ['confirmada', 'atendida'].includes(c.estado)
      && this.auth.hasPermission(PERM_DILIGENCIAR);
  }

  protected iniciarSolicitud(c: Cita): void {
    this.citaSolicitud.iniciar({
      citaId: c.id, codigo: c.codigo, tipoTitulo: c.tipoTitulo,
      tipoDocumento: tipoDocumentoFormulario(c.tipoDoc), numeroDocumento: c.documento ?? '',
      nombre: c.nombre ?? null, celular: c.celular ?? null, correo: c.correo ?? null,
    });
  }

  protected abrir(c: Cita): void {
    this.notas.set(c.notas ?? '');
    this.editando.set(c.id);
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [desde, hasta] = this.rango() === 'proximas'
        ? [this.hoy, sumarDias(this.hoy, 14)]
        : [sumarDias(this.hoy, -14), this.hoy];
      this.citas.set(await this.api.misCitas(desde, hasta));
    } catch (e) {
      this.toast.error('No se pudieron cargar sus citas', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async cerrar(c: Cita, estado: EstadoCita): Promise<void> {
    this.guardando.set(true);
    try {
      await this.api.marcarMiCita(c.id, estado, this.notas().trim() || null);
      this.toast.show('Resultado guardado', `${c.codigo}: ${rotuloEstado(estado)}`);
      this.editando.set(null);
      await this.cargar();
      if (this.abierta() === c.id) await this.cargarDetalle(c.id);
    } catch (e) {
      this.toast.error('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
