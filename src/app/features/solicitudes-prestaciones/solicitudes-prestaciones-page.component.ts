// App «Solicitudes Prestaciones» (Servicio al Cliente): ayuda al asesor a diligenciar el
// formato FOR-0075 de solicitud de prestaciones sin errores, para reducir devoluciones y
// reprocesos. Alcance actual: devolución de saldos por vejez.
//
//   · Asesor:        diligencia, revisa y genera el PDF.
//   · Coordinador:   además ve la traza de consultas.
//   · Administrador: todo lo anterior y los accesos de la App.

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { ConsultasPrestacionesComponent } from './consultas.component';
import { PERM_AUDITORIA, PERM_DILIGENCIAR } from './prestaciones.api';
import { SolicitudFormComponent } from './solicitud-form.component';

type Vista = 'solicitud' | 'consultas';

@Component({
  selector: 'alma-solicitudes-prestaciones-page',
  imports: [RouterLink, LucideAngularModule, AccessDeniedComponent, SolicitudFormComponent, ConsultasPrestacionesComponent],
  template: `
    @if (!puedeDiligenciar()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 sm:px-6">
        <div class="flex flex-wrap items-center gap-3">
          <a routerLink="/" class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary">
            <lucide-icon name="arrow-left" [size]="16" /> Inicio
          </a>
          <div>
            <h1 class="text-on-wallpaper text-2xl font-bold tracking-tight text-foreground">Solicitudes Prestaciones</h1>
            <p class="text-on-wallpaper text-sm text-foreground/80">Formato FOR-0075 · devolución de saldos por vejez.</p>
          </div>
        </div>

        @if (puedeAuditar()) {
          <nav class="glass inline-flex flex-wrap gap-1 rounded-2xl p-1 shadow-[var(--shadow-sm)]" aria-label="Secciones de Solicitudes Prestaciones">
            <button type="button" class="h-8 rounded-xl px-3.5 text-sm font-medium transition-colors" [class]="clasePestana('solicitud')" (click)="vista.set('solicitud')">Nueva solicitud</button>
            <button type="button" class="h-8 rounded-xl px-3.5 text-sm font-medium transition-colors" [class]="clasePestana('consultas')" (click)="vista.set('consultas')">Consultas</button>
          </nav>
        }

        @if (vista() === 'consultas' && puedeAuditar()) {
          <alma-consultas-prestaciones />
        } @else {
          <alma-solicitud-form />
        }
      </div>
    }
  `,
})
export class SolicitudesPrestacionesPageComponent {
  private readonly auth = inject(AuthService);

  protected readonly puedeDiligenciar = computed(() => this.auth.hasPermission(PERM_DILIGENCIAR));
  protected readonly puedeAuditar = computed(() => this.auth.hasPermission(PERM_AUDITORIA));
  protected readonly vista = signal<Vista>('solicitud');

  protected clasePestana(v: Vista): string {
    return this.vista() === v
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground';
  }
}
