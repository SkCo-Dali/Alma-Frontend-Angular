// Nueva campaña de autoevaluación: el Coordinador elige formulario, rango, analistas,
// colas y criterios; Alma sortea la muestra por analista y la deja en revisión antes
// de pedir nada a Genesys.

import { Component, computed, inject, output, signal, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import {
  Conexion,
  CriterioDuracion,
  FormularioHabilitado,
  ItemCatalogo,
  ModoCola,
  MonitorIaApi,
  Sentido,
} from './monitor-ia.api';
import { ETIQUETA_COLA, ETIQUETA_SENTIDO, bogotaAUtc, bogotaHoy } from './monitor-ia.domain';
import { SelectorMultipleComponent } from './selector-multiple.component';

const MAX_DIAS = 31;
const MAX_POR_ANALISTA = 50;

@Component({
  selector: 'alma-campana-nueva',
  imports: [FormsModule, LucideAngularModule, AlmaLoaderComponent, SelectorMultipleComponent],
  template: `
    @if (cargando()) {
      <div class="flex justify-center py-16"><alma-loader [size]="56" label="Cargando catálogos de Genesys…" /></div>
    } @else if (errorCarga(); as e) {
      <section class="glass rounded-3xl p-6 text-sm shadow-[var(--shadow-sm)]">
        <p class="flex items-start gap-2 text-foreground">
          <lucide-icon name="alert-triangle" [size]="18" class="mt-0.5 shrink-0 text-amber-600" />
          <span>{{ e }}</span>
        </p>
        <button type="button" class="alma-btn alma-btn-outline mt-4 h-9 rounded-xl text-sm" (click)="cargar()">
          <lucide-icon name="refresh-cw" [size]="14" /> Reintentar
        </button>
      </section>
    } @else {
      <form class="space-y-4" (ngSubmit)="crear()">
        <!-- 1. Formulario y período -->
        <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <h2 class="text-sm font-bold text-foreground">1. Formulario y período</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-1 text-xs font-medium text-foreground">
              Nombre de la campaña
              <input class="alma-input" name="nombre" maxlength="200" required [ngModel]="nombre()" (ngModelChange)="nombre.set($event)" />
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground">
              Formulario de autoevaluación
              <select class="alma-input" name="formulario" required [ngModel]="formId()" (ngModelChange)="formId.set($event)">
                <option value="" disabled>Elige un formulario…</option>
                @for (f of formularios(); track f.id) {
                  <option [value]="f.id">{{ f.nombre }}</option>
                }
              </select>
              @if (!formularios().length) {
                <span class="block text-[11px] font-normal text-amber-700 dark:text-amber-400">
                  No hay formularios habilitados. Pídele al Administrador que los habilite en Configuración.
                </span>
              }
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground">
              Desde (hora de Bogotá)
              <input class="alma-input" type="datetime-local" name="desde" required [ngModel]="desde()" (ngModelChange)="desde.set($event)" />
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground">
              Hasta (hora de Bogotá)
              <input class="alma-input" type="datetime-local" name="hasta" required [ngModel]="hasta()" (ngModelChange)="hasta.set($event)" />
            </label>
          </div>
          @if (errorRango(); as r) {
            <p class="text-xs text-destructive">{{ r }}</p>
          }
        </section>

        <!-- 2. Analistas -->
        <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <h2 class="text-sm font-bold text-foreground">2. Analistas a evaluar</h2>
          <alma-selector-multiple
            [items]="analistas()"
            [seleccion]="analistasSel()"
            (seleccionChange)="analistasSel.set($event)"
            placeholder="Buscar analista…"
            vacio="Genesys no devolvió analistas activos."
          />
          <label class="block max-w-xs space-y-1 text-xs font-medium text-foreground">
            Llamadas por analista
            <input class="alma-input" type="number" name="porAnalista" min="1" [max]="maxPorAnalista" required
                   [ngModel]="porAnalista()" (ngModelChange)="porAnalista.set(+$event)" />
          </label>
          <p class="text-xs" [class]="excede() ? 'font-semibold text-destructive' : 'text-muted-foreground'">
            {{ analistasSel().length }} analistas × {{ porAnalista() || 0 }} llamadas =
            <span class="tabular-nums">{{ total() }}</span> evaluaciones
            (máximo por campaña: {{ conexion().max_por_lote }}).
            @if (!excede()) { Si un analista tiene menos llamadas que las pedidas, se toman todas las que haya. }
          </p>
        </section>

        <!-- 3. Colas -->
        <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <h2 class="text-sm font-bold text-foreground">3. Cola de la llamada</h2>
          <div class="grid gap-2 sm:grid-cols-2">
            @for (m of modos; track m) {
              <label class="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors"
                     [class]="modoCola() === m ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'">
                <input type="radio" name="modoCola" class="accent-[var(--primary)]" [value]="m" [checked]="modoCola() === m" (change)="modoCola.set(m)" />
                <span class="text-foreground">{{ etiquetaCola[m] }}</span>
              </label>
            }
          </div>
          @if (modoCola() === 'selected') {
            <alma-selector-multiple
              [items]="colas()"
              [seleccion]="colasSel()"
              (seleccionChange)="colasSel.set($event)"
              placeholder="Buscar cola…"
              vacio="Genesys no devolvió colas."
            />
          }
        </section>

        <!-- 4. Criterios -->
        <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <h2 class="text-sm font-bold text-foreground">4. Criterios de la llamada</h2>
          <div class="grid gap-3 sm:grid-cols-3">
            <label class="space-y-1 text-xs font-medium text-foreground">
              Sentido
              <select class="alma-input" name="sentido" [ngModel]="sentido()" (ngModelChange)="sentido.set($event)">
                @for (s of sentidos; track s) {
                  <option [value]="s">{{ etiquetaSentido[s] }}</option>
                }
              </select>
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground">
              Duración mínima (minutos)
              <input class="alma-input" type="number" name="duracion" min="0" max="120" step="0.5"
                     [ngModel]="duracionMin()" (ngModelChange)="duracionMin.set(+$event)" />
            </label>
            <label class="space-y-1 text-xs font-medium text-foreground">
              Se mide sobre
              <select class="alma-input" name="criterio" [ngModel]="criterio()" (ngModelChange)="criterio.set($event)">
                <option value="total">Conversación total</option>
                <option value="agent">Interacción del asesor</option>
              </select>
            </label>
          </div>
        </section>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-muted-foreground">
            Primero se sortea la muestra y la revisas; no se pide nada a Genesys hasta que inicies la campaña.
          </p>
          <button type="submit" class="alma-btn alma-btn-primary h-10 rounded-xl px-5 text-sm" [disabled]="!valida() || enviando()">
            <lucide-icon [name]="enviando() ? 'loader-2' : 'search'" [size]="16" [class.animate-spin]="enviando()" />
            {{ enviando() ? 'Creando…' : 'Sortear la muestra' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class CampanaNuevaComponent {
  private readonly api = inject(MonitorIaApi);
  private readonly toast = inject(ToastService);

  readonly conexion = input.required<Conexion>();
  readonly creada = output<string>();

  protected readonly modos: ModoCola[] = ['any', 'with_queue', 'without_queue', 'selected'];
  protected readonly sentidos: Sentido[] = ['inbound', 'outbound', 'both'];
  protected readonly etiquetaCola = ETIQUETA_COLA;
  protected readonly etiquetaSentido = ETIQUETA_SENTIDO;
  protected readonly maxPorAnalista = MAX_POR_ANALISTA;

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formularios = signal<FormularioHabilitado[]>([]);
  protected readonly analistas = signal<ItemCatalogo[]>([]);
  protected readonly colas = signal<ItemCatalogo[]>([]);

  protected readonly nombre = signal(`Monitoreo ${bogotaHoy('00:00').slice(0, 10)}`);
  protected readonly formId = signal('');
  protected readonly desde = signal(bogotaHoy('00:00', 7));
  protected readonly hasta = signal(bogotaHoy('23:59'));
  protected readonly analistasSel = signal<string[]>([]);
  protected readonly porAnalista = signal(3);
  protected readonly modoCola = signal<ModoCola>('any');
  protected readonly colasSel = signal<string[]>([]);
  protected readonly sentido = signal<Sentido>('inbound');
  protected readonly duracionMin = signal(2);
  protected readonly criterio = signal<CriterioDuracion>('total');

  protected readonly total = computed(() => this.analistasSel().length * (this.porAnalista() || 0));
  protected readonly excede = computed(() => this.total() > this.conexion().max_por_lote);

  protected readonly errorRango = computed(() => {
    const d = this.desde();
    const h = this.hasta();
    if (!d || !h) return null;
    const ms = new Date(`${h}:00-05:00`).getTime() - new Date(`${d}:00-05:00`).getTime();
    if (!(ms > 0)) return 'La fecha final debe ser posterior a la inicial.';
    if (ms > MAX_DIAS * 86_400_000) return `El rango no puede superar ${MAX_DIAS} días.`;
    return null;
  });

  protected readonly valida = computed(
    () =>
      this.nombre().trim().length > 0 &&
      !!this.formId() &&
      !!this.desde() &&
      !!this.hasta() &&
      !this.errorRango() &&
      this.analistasSel().length > 0 &&
      this.porAnalista() >= 1 &&
      this.porAnalista() <= MAX_POR_ANALISTA &&
      !this.excede() &&
      (this.modoCola() !== 'selected' || this.colasSel().length > 0),
  );

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);
    try {
      const [formularios, analistas, colas] = await Promise.all([
        this.api.formulariosHabilitados(),
        this.api.catalogo('analistas'),
        this.api.catalogo('colas'),
      ]);
      this.formularios.set(formularios);
      this.analistas.set(analistas);
      this.colas.set(colas);
      if (formularios.length === 1) this.formId.set(formularios[0].id);
    } catch (e) {
      this.errorCarga.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async crear(): Promise<void> {
    if (!this.valida() || this.enviando()) return;
    this.enviando.set(true);
    try {
      const ids = new Set(this.analistasSel());
      const id = await this.api.crearCampana({
        nombre: this.nombre().trim(),
        form_id: this.formId(),
        desde: bogotaAUtc(this.desde()),
        hasta: bogotaAUtc(this.hasta()),
        sentido: this.sentido(),
        modo_cola: this.modoCola(),
        cola_ids: this.modoCola() === 'selected' ? this.colasSel() : [],
        duracion_min_seg: Math.round(this.duracionMin() * 60),
        criterio_duracion: this.criterio(),
        por_analista: this.porAnalista(),
        analistas: this.analistas().filter((a) => ids.has(a.id)),
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
