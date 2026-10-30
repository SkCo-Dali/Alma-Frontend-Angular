// Nueva campaña de casos de Salesforce: el Coordinador elige el flujo (Correo o Chat),
// el rango sobre la FECHA DE CIERRE y los propietarios; Alma sortea la muestra entre
// los casos cerrados y la deja en revisión antes de calificar nada con la IA.

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { ConexionSf, Flujo, MonitorIaCasosApi, Propietario } from './casos.api';
import { AYUDA_FLUJO, ETIQUETA_FLUJO } from './casos.domain';
import { ItemCatalogo } from './monitor-ia.api';
import { bogotaAUtc, bogotaHoy } from './monitor-ia.domain';
import { SelectorMultipleComponent } from './selector-multiple.component';

const MAX_DIAS = 31;
const MAX_POR_PROPIETARIO = 50;

@Component({
  selector: 'alma-casos-campana-nueva',
  imports: [FormsModule, LowerCasePipe, LucideAngularModule, AlmaLoaderComponent, SelectorMultipleComponent],
  template: `
    <form class="space-y-4" (ngSubmit)="crear()">
      <!-- 1. Flujo y período -->
      <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
        <h2 class="text-sm font-bold text-foreground">1. Flujo y período de cierre</h2>
        <div class="grid gap-2 sm:grid-cols-2">
          @for (f of flujos; track f) {
            <label class="flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors"
                   [class]="flujo() === f ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'">
              <input type="radio" name="flujo" class="mt-1 accent-[var(--primary)]" [value]="f" [checked]="flujo() === f" (change)="cambiarFlujo(f)" />
              <span>
                <span class="block font-medium text-foreground">{{ etiquetaFlujo[f] }}</span>
                <span class="block text-xs text-muted-foreground">{{ ayudaFlujo[f] }}</span>
              </span>
            </label>
          }
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="space-y-1 text-xs font-medium text-foreground">
            Nombre de la campaña
            <input class="alma-input" name="nombre" maxlength="200" required [ngModel]="nombre()" (ngModelChange)="nombre.set($event)" />
          </label>
          <label class="space-y-1 text-xs font-medium text-foreground">
            Cerrados desde (hora de Bogotá)
            <input class="alma-input" type="datetime-local" name="desde" required [ngModel]="desde()" (ngModelChange)="cambiarRango('desde', $event)" />
          </label>
          <label class="space-y-1 text-xs font-medium text-foreground">
            Cerrados hasta (hora de Bogotá)
            <input class="alma-input" type="datetime-local" name="hasta" required [ngModel]="hasta()" (ngModelChange)="cambiarRango('hasta', $event)" />
          </label>
        </div>
        @if (errorRango(); as r) {
          <p class="text-xs text-destructive">{{ r }}</p>
        }
      </section>

      <!-- 2. Propietarios -->
      <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-bold text-foreground">2. Propietarios del caso</h2>
          <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="!!errorRango() || buscando()" (click)="buscar()">
            <lucide-icon [name]="buscando() ? 'loader-2' : 'search'" [size]="14" [class.animate-spin]="buscando()" />
            {{ buscados() ? 'Volver a buscar' : 'Buscar en Salesforce' }}
          </button>
        </div>
        @if (buscando()) {
          <div class="flex justify-center py-8"><alma-loader [size]="48" label="Consultando Salesforce…" /></div>
        } @else if (errorBusqueda(); as e) {
          <p class="flex items-start gap-2 text-sm text-foreground">
            <lucide-icon name="alert-triangle" [size]="16" class="mt-0.5 shrink-0 text-amber-600" /> {{ e }}
          </p>
        } @else if (!buscados()) {
          <p class="text-xs text-muted-foreground">
            Busca los propietarios que cerraron casos de {{ etiquetaFlujo[flujo()] | lowercase }} en el período; verás cuántos tiene cada uno.
          </p>
        } @else {
          <alma-selector-multiple
            [items]="opciones()"
            [seleccion]="seleccion()"
            (seleccionChange)="seleccion.set($event)"
            placeholder="Buscar propietario…"
            vacio="Nadie cerró casos de este flujo en el período."
          />
          <label class="block max-w-xs space-y-1 text-xs font-medium text-foreground">
            Casos por propietario
            <input class="alma-input" type="number" name="porPropietario" min="1" [max]="maxPorPropietario" required
                   [ngModel]="porPropietario()" (ngModelChange)="porPropietario.set(+$event)" />
          </label>
          <p class="text-xs" [class]="excede() ? 'font-semibold text-destructive' : 'text-muted-foreground'">
            {{ seleccion().length }} propietarios × {{ porPropietario() || 0 }} casos =
            <span class="tabular-nums">{{ total() }}</span> calificaciones
            (máximo por campaña: {{ conexion().max_por_lote }}).
            @if (!excede()) { Los casos ya calificados en este flujo no vuelven a entrar al sorteo. }
          </p>
        }
      </section>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-muted-foreground">
          Primero se sortea la muestra y la revisas; la IA no califica nada hasta que inicies la campaña.
        </p>
        <button type="submit" class="alma-btn alma-btn-primary h-10 rounded-xl px-5 text-sm" [disabled]="!valida() || enviando()">
          <lucide-icon [name]="enviando() ? 'loader-2' : 'shuffle'" [size]="16" [class.animate-spin]="enviando()" />
          {{ enviando() ? 'Creando…' : 'Sortear la muestra' }}
        </button>
      </div>
    </form>
  `,
})
export class CasosCampanaNuevaComponent {
  private readonly api = inject(MonitorIaCasosApi);
  private readonly toast = inject(ToastService);

  readonly conexion = input.required<ConexionSf>();
  readonly creada = output<string>();

  protected readonly flujos: Flujo[] = ['CORREO', 'CHAT'];
  protected readonly etiquetaFlujo = ETIQUETA_FLUJO;
  protected readonly ayudaFlujo = AYUDA_FLUJO;
  protected readonly maxPorPropietario = MAX_POR_PROPIETARIO;

  protected readonly flujo = signal<Flujo>('CORREO');
  protected readonly nombre = signal(`Calibración correo ${bogotaHoy('00:00').slice(0, 10)}`);
  protected readonly desde = signal(bogotaHoy('00:00', 7));
  protected readonly hasta = signal(bogotaHoy('23:59', 1));
  protected readonly propietarios = signal<Propietario[]>([]);
  protected readonly seleccion = signal<string[]>([]);
  protected readonly porPropietario = signal(3);

  protected readonly buscando = signal(false);
  protected readonly buscados = signal(false);
  protected readonly errorBusqueda = signal<string | null>(null);
  protected readonly enviando = signal(false);

  /** El selector muestra «Nombre (N casos)». */
  protected readonly opciones = computed<ItemCatalogo[]>(() =>
    this.propietarios().map((p) => ({ id: p.id, name: `${p.name} (${p.casos} ${p.casos === 1 ? 'caso' : 'casos'})` })),
  );

  protected readonly total = computed(() => this.seleccion().length * (this.porPropietario() || 0));
  protected readonly excede = computed(() => this.total() > this.conexion().max_por_lote);

  protected readonly errorRango = computed(() => {
    const d = this.desde();
    const h = this.hasta();
    if (!d || !h) return 'Indica el período.';
    const ms = new Date(`${h}:00-05:00`).getTime() - new Date(`${d}:00-05:00`).getTime();
    if (!(ms > 0)) return 'La fecha final debe ser posterior a la inicial.';
    if (ms > MAX_DIAS * 86_400_000) return `El rango no puede superar ${MAX_DIAS} días.`;
    return null;
  });

  protected readonly valida = computed(
    () =>
      this.nombre().trim().length > 0 &&
      !this.errorRango() &&
      this.buscados() &&
      this.seleccion().length > 0 &&
      this.porPropietario() >= 1 &&
      this.porPropietario() <= MAX_POR_PROPIETARIO &&
      !this.excede(),
  );

  protected cambiarFlujo(f: Flujo): void {
    if (f === this.flujo()) return;
    const anterior = `Calibración ${ETIQUETA_FLUJO[this.flujo()].toLowerCase()}`;
    if (this.nombre().startsWith(anterior)) {
      this.nombre.set(this.nombre().replace(anterior, `Calibración ${ETIQUETA_FLUJO[f].toLowerCase()}`));
    }
    this.flujo.set(f);
    this.reiniciar();
  }

  protected cambiarRango(campo: 'desde' | 'hasta', valor: string): void {
    (campo === 'desde' ? this.desde : this.hasta).set(valor);
    this.reiniciar();
  }

  /** Los propietarios dependen del flujo y del período: si cambian, hay que volver a buscar. */
  private reiniciar(): void {
    this.buscados.set(false);
    this.propietarios.set([]);
    this.seleccion.set([]);
    this.errorBusqueda.set(null);
  }

  protected async buscar(): Promise<void> {
    if (this.errorRango() || this.buscando()) return;
    this.buscando.set(true);
    this.errorBusqueda.set(null);
    try {
      const items = await this.api.propietarios(this.flujo(), bogotaAUtc(this.desde()), bogotaAUtc(this.hasta()));
      this.propietarios.set(items);
      const vigentes = new Set(items.map((p) => p.id));
      this.seleccion.set(this.seleccion().filter((id) => vigentes.has(id)));
      this.buscados.set(true);
    } catch (e) {
      this.errorBusqueda.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.buscando.set(false);
    }
  }

  protected async crear(): Promise<void> {
    if (!this.valida() || this.enviando()) return;
    this.enviando.set(true);
    try {
      const ids = new Set(this.seleccion());
      const id = await this.api.crearCampana({
        nombre: this.nombre().trim(),
        flujo: this.flujo(),
        desde: bogotaAUtc(this.desde()),
        hasta: bogotaAUtc(this.hasta()),
        por_propietario: this.porPropietario(),
        propietarios: this.propietarios()
          .filter((p) => ids.has(p.id))
          .map((p) => ({ id: p.id, name: p.name })),
      });
      this.toast.show('Sorteando la muestra', 'Te avisamos cuando esté lista para revisar.');
      this.creada.emit(id);
    } catch (e) {
      this.toast.error('No se pudo crear la campaña', e instanceof Error ? e.message : String(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
