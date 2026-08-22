// Diálogo de formulario genérico de Parametrización. Los 14 formularios de la
// pantalla comparten la misma mecánica (campos con validación por tipo, campos
// derivados y deshabilitados, y guardar/cancelar), así que se describen por
// campos. Paridad Create/Edit*Dialog + sus esquemas de validación.

import {
  Component,
  OnInit,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

export type ParamFieldTipo =
  | 'texto'
  | 'numero'
  | 'decimal'
  | 'select'
  | 'switch'
  | 'fecha'
  | 'periodo'
  | 'email';

export interface ParamFieldOption {
  label: string;
  value: string;
}

export interface ParamField {
  key: string;
  label: string;
  tipo: ParamFieldTipo;
  requerido?: boolean;
  opciones?: ParamFieldOption[];
  /** Select con buscador (listas largas, p. ej. planes de comisión). */
  buscable?: boolean;
  maxLength?: number;
  deshabilitado?: boolean;
  placeholder?: string;
  ayuda?: string;
  /** Ocupa el ancho completo de la rejilla. */
  ancho?: 'full';
}

export type ParamValues = Record<string, string | boolean>;

@Component({
  selector: 'alma-param-form-dialog',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      (click)="cerrar()"
    >
      <div
        class="surface-solid my-6 w-full rounded-2xl border border-border p-6 shadow-2xl"
        [style.max-width]="ancho()"
        (click)="$event.stopPropagation()"
      >
        <h2 class="text-lg font-bold">{{ titulo() }}</h2>
        @if (descripcion()) {
          <p class="text-sm text-muted-foreground">{{ descripcion() }}</p>
        }

        <div
          class="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto py-4"
          [class]="columnas() === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'"
        >
          @for (f of fields(); track f.key) {
            <div class="space-y-2" [class.sm:col-span-full]="f.ancho === 'full'">
              @if (f.tipo === 'switch') {
                <label class="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    class="h-5 w-5 accent-[var(--primary)]"
                    [disabled]="!!f.deshabilitado"
                    [checked]="booleano(f.key)"
                    (change)="setValor(f.key, $any($event.target).checked)"
                  />
                  {{ f.label }}
                </label>
                @if (f.ayuda) {
                  <p class="text-xs text-muted-foreground">{{ f.ayuda }}</p>
                }
              } @else {
                <label class="text-sm font-medium" [for]="'pf-' + f.key">
                  {{ f.label }}
                  @if (f.requerido) {
                    <span class="text-destructive">*</span>
                  }
                </label>

                @switch (f.tipo) {
                  @case ('select') {
                    @if (f.buscable) {
                      <input
                        class="alma-input mb-1 h-8 text-xs"
                        placeholder="Buscar…"
                        [ngModel]="busqueda()[f.key] || ''"
                        (ngModelChange)="setBusqueda(f.key, $event)"
                      />
                    }
                    <select
                      [id]="'pf-' + f.key"
                      class="alma-input"
                      [disabled]="!!f.deshabilitado"
                      [ngModel]="valor(f.key)"
                      (ngModelChange)="setValor(f.key, $event)"
                    >
                      <option value="">Seleccionar…</option>
                      @for (o of opcionesVisibles(f); track o.value) {
                        <option [value]="o.value">{{ o.label }}</option>
                      }
                    </select>
                  }
                  @case ('fecha') {
                    <input
                      [id]="'pf-' + f.key"
                      type="date"
                      class="alma-input"
                      [disabled]="!!f.deshabilitado"
                      [ngModel]="valor(f.key)"
                      (ngModelChange)="setValor(f.key, $event)"
                    />
                  }
                  @case ('periodo') {
                    <div class="flex gap-2">
                      <select
                        [id]="'pf-' + f.key"
                        class="alma-input"
                        [ngModel]="anioDe(f.key)"
                        (ngModelChange)="setPeriodo(f.key, $event, mesDe(f.key))"
                      >
                        <option value="">Año</option>
                        @for (a of anios; track a) {
                          <option [value]="a">{{ a }}</option>
                        }
                      </select>
                      <select
                        class="alma-input"
                        [ngModel]="mesDe(f.key)"
                        (ngModelChange)="setPeriodo(f.key, anioDe(f.key), $event)"
                      >
                        <option value="">Mes</option>
                        @for (m of meses; track m.value) {
                          <option [value]="m.value">{{ m.label }}</option>
                        }
                      </select>
                    </div>
                  }
                  @default {
                    <input
                      [id]="'pf-' + f.key"
                      class="alma-input"
                      [type]="f.tipo === 'email' ? 'email' : 'text'"
                      [attr.maxlength]="f.maxLength ?? null"
                      [disabled]="!!f.deshabilitado"
                      [placeholder]="f.placeholder ?? ''"
                      [ngModel]="valor(f.key)"
                      (ngModelChange)="setTexto(f, $event)"
                    />
                  }
                }

                @if (errores()[f.key]; as err) {
                  <p class="text-xs text-destructive">{{ err }}</p>
                } @else if (f.ayuda) {
                  <p class="text-xs text-muted-foreground">{{ f.ayuda }}</p>
                }
              }
            </div>
          }
        </div>

        <div class="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            (click)="cerrar()"
            [disabled]="guardando()"
            class="alma-btn alma-btn-outline"
          >
            Cancelar
          </button>
          <button
            type="button"
            (click)="enviar()"
            [disabled]="guardando() || hayErrores()"
            class="alma-btn alma-btn-primary"
          >
            {{ guardando() ? textoGuardando() : textoGuardar() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ParamFormDialogComponent implements OnInit {
  readonly titulo = input.required<string>();
  readonly descripcion = input('');
  readonly fields = input.required<ParamField[]>();
  readonly valores = input.required<ParamValues>();
  readonly textoGuardar = input('Guardar');
  readonly textoGuardando = input('Guardando…');
  readonly ancho = input('640px');
  readonly columnas = input<2 | 3>(2);
  /** Validaciones que cruzan campos (rangos, formato por tipo de documento…). */
  readonly validarExtra = input<(v: ParamValues) => Record<string, string>>(() => ({}));
  /** Campos que se recalculan al cambiar otro (canal→código, plan→producto…). */
  readonly derivar = input<(key: string, v: ParamValues) => ParamValues>((_, v) => v);

  readonly guardar = output<ParamValues>();
  readonly closed = output<void>();

  protected readonly guardando = signal(false);
  protected readonly estado = signal<ParamValues>({});
  protected readonly busqueda = signal<Record<string, string>>({});

  protected readonly meses = [
    { label: 'Enero', value: '01' },
    { label: 'Febrero', value: '02' },
    { label: 'Marzo', value: '03' },
    { label: 'Abril', value: '04' },
    { label: 'Mayo', value: '05' },
    { label: 'Junio', value: '06' },
    { label: 'Julio', value: '07' },
    { label: 'Agosto', value: '08' },
    { label: 'Septiembre', value: '09' },
    { label: 'Octubre', value: '10' },
    { label: 'Noviembre', value: '11' },
    { label: 'Diciembre', value: '12' },
  ];

  /** Diez años atrás y cinco adelante, como el original. */
  protected readonly anios = (() => {
    const actual = new Date().getFullYear();
    return Array.from({ length: 16 }, (_, i) => String(actual - 10 + i));
  })();

  ngOnInit(): void {
    this.estado.set({ ...this.valores() });
  }

  protected valor(key: string): string {
    const v = this.estado()[key];
    return typeof v === 'boolean' ? String(v) : (v ?? '');
  }

  protected booleano(key: string): boolean {
    return Boolean(this.estado()[key]);
  }

  protected setValor(key: string, valor: string | boolean): void {
    this.estado.update((prev) => this.derivar()(key, { ...prev, [key]: valor }));
  }

  /** Los campos numéricos filtran lo que no sea dígito (o punto en decimales). */
  protected setTexto(f: ParamField, valor: string): void {
    let v = valor;
    if (f.tipo === 'numero') v = v.replace(/\D/g, '');
    if (f.tipo === 'decimal') v = v.replace(/[^\d.]/g, '');
    if (f.maxLength) v = v.slice(0, f.maxLength);
    this.setValor(f.key, v);
  }

  protected setBusqueda(key: string, texto: string): void {
    this.busqueda.update((prev) => ({ ...prev, [key]: texto }));
  }

  protected opcionesVisibles(f: ParamField): ParamFieldOption[] {
    const todas = f.opciones ?? [];
    if (!f.buscable) return todas;
    const q = (this.busqueda()[f.key] ?? '').trim().toLowerCase();
    return q ? todas.filter((o) => o.label.toLowerCase().includes(q)) : todas;
  }

  protected anioDe(key: string): string {
    return this.valor(key).slice(0, 4);
  }

  protected mesDe(key: string): string {
    return this.valor(key).slice(4, 6);
  }

  protected setPeriodo(key: string, anio: string, mes: string): void {
    this.setValor(key, anio && mes ? `${anio}${mes}` : '');
  }

  protected readonly errores = computed<Record<string, string>>(() => {
    const v = this.estado();
    const errs: Record<string, string> = {};

    for (const f of this.fields()) {
      const valor = v[f.key];
      const texto = typeof valor === 'string' ? valor.trim() : '';

      if (f.requerido && f.tipo !== 'switch' && !texto) {
        errs[f.key] = `${f.label} es obligatorio`;
        continue;
      }
      if (!texto) continue;

      if (f.tipo === 'numero' && !/^\d+$/.test(texto)) {
        errs[f.key] = 'Solo se permiten números (0-9)';
      } else if (
        f.tipo === 'decimal' &&
        !/^([0-9]{1,2}(\.[0-9]{1,3})?|100(\.0{1,3})?)$/.test(texto)
      ) {
        errs[f.key] = 'Número entre 0 - 100 (máx 3 decimales)';
      } else if (f.tipo === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto)) {
        errs[f.key] = 'Ingrese un correo valido';
      } else if (f.maxLength && texto.length > f.maxLength) {
        errs[f.key] = `Máximo ${f.maxLength} caracteres`;
      }
    }

    return { ...errs, ...this.validarExtra()(v) };
  });

  protected readonly hayErrores = computed(() => Object.keys(this.errores()).length > 0);

  protected async enviar(): Promise<void> {
    if (this.hayErrores()) return;
    this.guardando.set(true);
    try {
      this.guardar.emit(this.estado());
    } finally {
      this.guardando.set(false);
    }
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    this.closed.emit();
  }
}
