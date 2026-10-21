// Traza de uso de «Solicitudes Prestaciones»: quién consultó a quién y cuándo se generó un PDF.
// La traza NO guarda el número de documento (solo un hash y los 4 últimos dígitos): para saber
// quién consultó a una persona se digita su documento y el backend compara por hash.

import { Component, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { Evento, PrestacionesApi } from './prestaciones.api';

@Component({
  selector: 'alma-consultas-prestaciones',
  imports: [LucideAngularModule, AlmaLoaderComponent],
  template: `
    <section class="glass overflow-hidden rounded-3xl shadow-[var(--shadow-sm)]">
      <header class="flex flex-wrap items-end gap-3 border-b border-border/60 px-5 py-3">
        <h2 class="mr-auto text-sm font-bold text-foreground">Consultas y PDF generados</h2>
        <div>
          <label class="text-[11px] font-medium text-foreground" for="aud-tipo">Tipo</label>
          <select id="aud-tipo" class="alma-input mt-0.5 h-8 w-32 text-xs" (change)="tipo.set($any($event.target).value)">
            <option value="CC" [selected]="tipo() === 'CC'">CC</option>
            <option value="CE" [selected]="tipo() === 'CE'">CE</option>
            <option value="Pasaporte" [selected]="tipo() === 'Pasaporte'">Pasaporte</option>
            <option value="NIT" [selected]="tipo() === 'NIT'">NIT</option>
            <option value="Tarjeta de identidad" [selected]="tipo() === 'Tarjeta de identidad'">Tarjeta de identidad</option>
            <option value="Registro civil" [selected]="tipo() === 'Registro civil'">Registro civil</option>
          </select>
        </div>
        <div>
          <label class="text-[11px] font-medium text-foreground" for="aud-doc">Documento (opcional)</label>
          <input id="aud-doc" class="alma-input mt-0.5 h-8 w-44 text-xs" maxlength="20" inputmode="numeric" autocomplete="off" placeholder="Todas las personas" [value]="numero()" (input)="numero.set($any($event.target).value)" (keydown.enter)="cargar()" />
        </div>
        <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="cargando()" (click)="cargar()">
          <lucide-icon name="search" [size]="14" /> Buscar
        </button>
      </header>
      @if (cargando()) {
        <div class="flex justify-center py-10"><alma-loader [size]="56" label="Cargando…" /></div>
      } @else if (!eventos().length) {
        <p class="px-5 py-10 text-center text-sm text-muted-foreground">No hay movimientos para mostrar.</p>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-[var(--table-header)] text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
              <tr>
                <th class="px-4 py-2">Fecha</th>
                <th class="px-4 py-2">Qué hizo</th>
                <th class="px-4 py-2">Usuario</th>
                <th class="px-4 py-2">Documento consultado</th>
                <th class="px-4 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              @for (e of eventos(); track e.id) {
                <tr class="border-t border-border/50">
                  <td class="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{{ fecha(e.creado_en) }}</td>
                  <td class="px-4 py-2"><span class="alma-badge" [class]="e.tipo === 'consulta' ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'">{{ e.tipo === 'consulta' ? 'Consulta' : 'PDF' }}</span></td>
                  <td class="px-4 py-2 text-foreground">{{ e.usuario }}</td>
                  <td class="whitespace-nowrap px-4 py-2 text-foreground">{{ e.tipo_documento }} ····{{ e.documento_fin ?? '—' }}</td>
                  <td class="px-4 py-2 text-xs text-muted-foreground">{{ e.detalle ?? '' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class ConsultasPrestacionesComponent {
  private readonly api = inject(PrestacionesApi);
  private readonly toast = inject(ToastService);

  protected readonly tipo = signal('CC');
  protected readonly numero = signal('');
  protected readonly eventos = signal<Evento[]>([]);
  protected readonly cargando = signal(false);

  constructor() {
    void this.cargar();
  }

  protected fecha(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.eventos.set(await this.api.eventos(200, this.tipo(), this.numero().trim() || undefined));
    } catch (e) {
      this.toast.error('No se pudo cargar la traza', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
