// App «Prestaciones» (Servicio al Cliente): el journey de la asesoría pensional en un solo lugar.
//
//   La persona agenda su asesoría en el sitio público → el asesor la ve en su Bandeja →
//   desde la cita abre la Solicitud (FOR-0075) con el documento puesto → al generar el PDF
//   la cita queda marcada en su historial.
//
// Módulos (cada uno con el permiso que ya tenía; el backend no cambia):
//   · Bandeja de asesorías   app.asesoria-agenda.atender
//   · Citas                  app.asesoria-agenda.citas.view
//   · Analítica              app.asesoria-agenda.citas.view
//   · Solicitudes            app.solicitudes-prestaciones.diligenciar
//   · Consultas              app.solicitudes-prestaciones.auditoria.view
//   · Configuración          app.asesoria-agenda.config.manage

import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { PERM_ATENDER, PERM_CONFIG, PERM_VER } from '../agenda-asesorias/agenda.api';
import { AnaliticaAgendaComponent } from '../agenda-asesorias/analitica.component';
import { CitasAgendaComponent } from '../agenda-asesorias/citas.component';
import { ConfiguracionAgendaComponent } from '../agenda-asesorias/configuracion.component';
import { MiAgendaComponent } from '../agenda-asesorias/mi-agenda.component';
import { ConsultasPrestacionesComponent } from '../solicitudes-prestaciones/consultas.component';
import { PERM_AUDITORIA, PERM_DILIGENCIAR } from '../solicitudes-prestaciones/prestaciones.api';
import { SolicitudFormComponent } from '../solicitudes-prestaciones/solicitud-form.component';
import { CitaSolicitudService } from './cita-solicitud.service';

type Vista = 'bandeja' | 'citas' | 'analitica' | 'solicitud' | 'consultas' | 'configuracion';

const VISTAS: { id: Vista; rotulo: string; permiso: string }[] = [
  { id: 'bandeja', rotulo: 'Bandeja de asesorías', permiso: PERM_ATENDER },
  { id: 'citas', rotulo: 'Citas', permiso: PERM_VER },
  { id: 'analitica', rotulo: 'Analítica', permiso: PERM_VER },
  { id: 'solicitud', rotulo: 'Solicitudes', permiso: PERM_DILIGENCIAR },
  { id: 'consultas', rotulo: 'Consultas', permiso: PERM_AUDITORIA },
  { id: 'configuracion', rotulo: 'Configuración', permiso: PERM_CONFIG },
];

@Component({
  selector: 'alma-prestaciones-page',
  imports: [RouterLink, LucideAngularModule, AccessDeniedComponent, MiAgendaComponent, CitasAgendaComponent, AnaliticaAgendaComponent,
            ConfiguracionAgendaComponent, SolicitudFormComponent, ConsultasPrestacionesComponent],
  template: `
    @if (!vistas().length) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 sm:px-6">
        <div class="flex flex-wrap items-center gap-3">
          <a routerLink="/" class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary">
            <lucide-icon name="arrow-left" [size]="16" /> Inicio
          </a>
          <div>
            <h1 class="text-on-wallpaper text-2xl font-bold tracking-tight text-foreground">Prestaciones</h1>
            <p class="text-on-wallpaper text-sm text-foreground/80">Asesorías agendadas desde el sitio público y solicitudes de prestaciones.</p>
          </div>
        </div>

        @if (vistas().length > 1) {
          <nav class="glass inline-flex flex-wrap gap-1 rounded-2xl p-1 shadow-[var(--shadow-sm)]" aria-label="Módulos de Prestaciones">
            @for (v of vistas(); track v.id) {
              <button type="button" class="h-8 rounded-xl px-3.5 text-sm font-medium transition-colors"
                      [class]="clasePestana(v.id)" [attr.aria-current]="vistaActual() === v.id ? 'page' : null"
                      (click)="vista.set(v.id)">{{ v.rotulo }}</button>
            }
          </nav>
        }

        <!-- La solicitud se conserva al cambiar de módulo: lo digitado no se pierde por ir a la bandeja. -->
        @if (puede('solicitud')) {
          <div [hidden]="vistaActual() !== 'solicitud'"><alma-solicitud-form (irABandeja)="vista.set('bandeja')" /></div>
        }
        @switch (vistaActual()) {
          @case ('bandeja') { <alma-mi-agenda /> }
          @case ('citas') { <alma-citas-agenda /> }
          @case ('analitica') { <alma-analitica-agenda /> }
          @case ('consultas') { <alma-consultas-prestaciones /> }
          @case ('configuracion') { <alma-configuracion-agenda /> }
        }
      </div>
    }
  `,
})
export class PrestacionesPageComponent {
  private readonly auth = inject(AuthService);
  private readonly citaSolicitud = inject(CitaSolicitudService);

  protected readonly vistas = computed(() => VISTAS.filter((v) => this.auth.hasPermission(v.permiso)));
  protected readonly vista = signal<Vista | null>(null);
  protected readonly vistaActual = computed<Vista | null>(() => {
    const elegida = this.vista();
    const disponibles = this.vistas();
    return disponibles.some((v) => v.id === elegida) ? elegida : (disponibles[0]?.id ?? null);
  });

  constructor() {
    // «Iniciar solicitud» en la bandeja: se pasa al módulo de Solicitudes.
    effect(() => {
      if (this.citaSolicitud.pendiente() && this.puede('solicitud')) this.vista.set('solicitud');
    });
  }

  protected puede(v: Vista): boolean {
    return this.vistas().some((x) => x.id === v);
  }

  protected clasePestana(v: Vista): string {
    return this.vistaActual() === v
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground';
  }
}
