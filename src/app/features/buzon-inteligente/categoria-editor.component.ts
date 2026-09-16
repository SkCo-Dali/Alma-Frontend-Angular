// Editor de una categoría (tipo de correo) del Buzón Inteligente: cómo reconocerla
// (descripción en lenguaje natural, ejemplos, palabras clave), qué datos extraer y qué
// acciones ejecutar. Modal autocontenido; emite la categoría lista para guardar.

import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaSwitchComponent } from '../../shared/components/alma-switch.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import { Accion, CampoExtraer, Categoria, CategoriaIn, TIPOS_ACCION, TipoAccion, nombreAccion } from './buzon.api';

const COLORES = ['#00C83C', '#0A84FF', '#6D4AE0', '#BF5AF2', '#FF9F0A', '#FF375F', '#E5392A', '#F2B600', '#30B0C7', '#A2845E', '#8E8E93'];

interface AccionForm {
  tipo: TipoAccion;
  activa: boolean;
  categoria: string;
  carpeta: string;
  destinatarios: string;
  comentario: string;
  analistas: string;
  mover_a_carpeta_del_analista: boolean;
  webhook_url: string;
}

function accionVacia(tipo: TipoAccion, clave = ''): AccionForm {
  return {
    tipo,
    activa: true,
    categoria: clave,
    carpeta: '',
    destinatarios: '',
    comentario: '',
    analistas: '',
    mover_a_carpeta_del_analista: true,
    webhook_url: '',
  };
}

function aForm(a: Accion): AccionForm {
  const p = a.parametros ?? {};
  return {
    tipo: a.tipo,
    activa: a.activa,
    categoria: String(p['categoria'] ?? ''),
    carpeta: String(p['carpeta'] ?? ''),
    destinatarios: ((p['destinatarios'] as string[] | undefined) ?? []).join(', '),
    comentario: String(p['comentario'] ?? ''),
    analistas: ((p['analistas'] as string[] | undefined) ?? []).join(', '),
    mover_a_carpeta_del_analista: p['mover_a_carpeta_del_analista'] !== false,
    webhook_url: String(p['webhook_url'] ?? ''),
  };
}

function aAccion(f: AccionForm, orden: number): Accion {
  const lista = (s: string) => s.split(/[,\n;]+/).map((x) => x.trim()).filter(Boolean);
  let parametros: Record<string, unknown> = {};
  switch (f.tipo) {
    case 'categorizar':
      parametros = { categoria: f.categoria.trim() };
      break;
    case 'mover':
      parametros = { carpeta: f.carpeta.trim(), crear_si_no_existe: true };
      break;
    case 'reenviar':
      parametros = { destinatarios: lista(f.destinatarios), comentario: f.comentario.trim() };
      break;
    case 'asignar_analista':
      parametros = { estrategia: 'round_robin', analistas: lista(f.analistas), mover_a_carpeta_del_analista: f.mover_a_carpeta_del_analista };
      break;
    case 'notificar_teams':
      parametros = f.webhook_url.trim() ? { webhook_url: f.webhook_url.trim() } : {};
      break;
    default:
      parametros = {};
  }
  return { tipo: f.tipo, parametros, orden, activa: f.activa };
}

@Component({
  selector: 'alma-categoria-editor',
  imports: [FormsModule, LucideAngularModule, AlmaSwitchComponent, TooltipDirective],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cancelar.emit()">
      <div class="surface-solid flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-lg)]" (click)="$event.stopPropagation()">
        <!-- Encabezado -->
        <div class="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div class="flex items-center gap-3">
            <span class="h-9 w-9 rounded-xl" [style.background]="color()"></span>
            <div>
              <h2 class="text-sm font-semibold text-foreground">{{ categoria() ? 'Editar tipo de correo' : 'Nuevo tipo de correo' }}</h2>
              <p class="text-xs text-muted-foreground">Descríbelo como se lo explicarías a alguien nuevo en el área.</p>
            </div>
          </div>
          <button type="button" class="alma-btn alma-btn-ghost" (click)="cancelar.emit()"><lucide-icon name="x" [size]="16" /></button>
        </div>

        <!-- Pasos -->
        <div class="flex gap-1 border-b border-border/60 px-5 py-2">
          @for (p of pasos; track p.id; let i = $index) {
            <button type="button" class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors" [class]="paso() === p.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'" (click)="paso.set(p.id)">
              <span class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" [class]="paso() === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">{{ i + 1 }}</span>
              {{ p.nombre }}
            </button>
          }
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          @switch (paso()) {
            @case ('reconocer') {
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div class="flex flex-col gap-1.5 sm:col-span-2">
                  <label class="alma-label">Nombre *</label>
                  <input class="alma-input" [(ngModel)]="nombre" (ngModelChange)="sugerirClave()" placeholder="Demanda o notificación judicial" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="alma-label flex items-center gap-1">Clave / etiqueta Outlook <lucide-icon name="info" [size]="12" almaTooltip="Identificador corto en mayúsculas. Es la etiqueta que verán en Outlook y la salida de la IA." /></label>
                  <input class="alma-input font-mono uppercase" [(ngModel)]="clave" [disabled]="esFallback" placeholder="DEMANDA" />
                </div>
                <div class="flex flex-col gap-1.5 sm:col-span-3">
                  <label class="alma-label">Cómo reconocerlo *</label>
                  <textarea class="alma-input min-h-28 py-2" [(ngModel)]="descripcion" placeholder="Qué dice el correo, quién suele enviarlo, qué documentos trae, qué lo diferencia de otros tipos…"></textarea>
                </div>
                <div class="flex flex-col gap-1.5 sm:col-span-2">
                  <label class="alma-label">Ejemplos de asuntos o frases</label>
                  <div class="alma-input flex h-auto min-h-9 flex-wrap items-center gap-1.5 py-1.5">
                    @for (e of ejemplos(); track $index) {
                      <span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{{ e }}
                        <button type="button" class="opacity-70 hover:opacity-100" (click)="quitarEjemplo($index)"><lucide-icon name="x" [size]="11" /></button>
                      </span>
                    }
                    <input class="min-w-32 flex-1 bg-transparent text-sm outline-none" [(ngModel)]="nuevoEjemplo" (keydown.enter)="$event.preventDefault(); agregarEjemplo()" placeholder="Escribe y presiona Enter" />
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="alma-label">Palabras clave</label>
                  <input class="alma-input" [(ngModel)]="palabrasClave" placeholder="radicado, juzgado, tutela" />
                </div>
                <div class="flex flex-col gap-1.5 sm:col-span-2">
                  <label class="alma-label">Color</label>
                  <div class="flex flex-wrap gap-2">
                    @for (c of colores; track c) {
                      <button type="button" class="h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110" [style.background]="c" [class.ring-2]="color() === c" [class.ring-primary]="color() === c" (click)="color.set(c)"></button>
                    }
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="alma-label flex items-center gap-1">Umbral propio <lucide-icon name="info" [size]="12" almaTooltip="Vacío = usa el umbral del buzón. Con este nivel de confianza o más, en modo automático se ejecuta sin preguntar." /></label>
                  <div class="flex items-center gap-2">
                    <input type="range" min="50" max="99" class="flex-1 accent-[var(--primary)]" [ngModel]="umbral() ?? 80" (ngModelChange)="umbral.set(+$event)" />
                    <span class="w-12 text-right text-sm tabular-nums">{{ umbral() !== null ? umbral() + '%' : 'buzón' }}</span>
                    @if (umbral() !== null) { <button type="button" class="alma-btn alma-btn-ghost" almaTooltip="Usar el del buzón" (click)="umbral.set(null)"><lucide-icon name="rotate-ccw" [size]="14" /></button> }
                  </div>
                </div>
              </div>
            }
            @case ('extraer') {
              <p class="mb-3 text-xs text-muted-foreground">Datos que la IA debe leer del correo y sus adjuntos para este tipo. Quedan disponibles en la bandeja y para las acciones.</p>
              <div class="flex flex-col gap-2">
                @for (c of campos(); track $index) {
                  <div class="grid grid-cols-[1fr_2fr_auto] items-center gap-2">
                    <input class="alma-input font-mono text-xs" [(ngModel)]="c.clave" placeholder="afiliado_cedula" />
                    <input class="alma-input" [(ngModel)]="c.descripcion" placeholder="Cédula sin puntos ni espacios" />
                    <button type="button" class="alma-btn alma-btn-ghost text-destructive" (click)="quitarCampo($index)"><lucide-icon name="trash-2" [size]="15" /></button>
                  </div>
                }
                <button type="button" class="alma-btn alma-btn-outline w-fit rounded-lg text-xs" (click)="agregarCampo()"><lucide-icon name="plus" [size]="14" /> Agregar dato</button>
              </div>
            }
            @case ('acciones') {
              <p class="mb-3 text-xs text-muted-foreground">Se ejecutan en orden cuando el correo se clasifica en este tipo (automáticamente o al aprobar en la bandeja).</p>
              <div class="flex flex-col gap-3">
                @for (a of acciones(); track $index; let i = $index) {
                  <div class="rounded-xl border border-border/60 bg-[var(--surface-sunken)] p-3">
                    <div class="flex items-center gap-2">
                      <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{{ i + 1 }}</span>
                      <lucide-icon [name]="icono(a.tipo)" [size]="15" class="text-primary" />
                      <span class="text-sm font-semibold text-foreground">{{ nombreDe(a.tipo) }}</span>
                      <div class="ml-auto flex items-center gap-2">
                        <alma-switch [checked]="a.activa" (checkedChange)="a.activa = $event" ariaLabel="Activa" />
                        <button type="button" class="alma-btn alma-btn-ghost" [disabled]="i === 0" (click)="mover(i, -1)"><lucide-icon name="arrow-up" [size]="14" /></button>
                        <button type="button" class="alma-btn alma-btn-ghost" [disabled]="i === acciones().length - 1" (click)="mover(i, 1)"><lucide-icon name="arrow-down" [size]="14" /></button>
                        <button type="button" class="alma-btn alma-btn-ghost text-destructive" (click)="quitarAccion(i)"><lucide-icon name="trash-2" [size]="15" /></button>
                      </div>
                    </div>
                    <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      @switch (a.tipo) {
                        @case ('categorizar') {
                          <div class="flex flex-col gap-1"><label class="alma-label">Categoría de Outlook</label><input class="alma-input" [(ngModel)]="a.categoria" [placeholder]="clave || 'ETIQUETA'" /></div>
                        }
                        @case ('mover') {
                          <div class="flex flex-col gap-1"><label class="alma-label">Carpeta destino (se crea si no existe)</label><input class="alma-input" [(ngModel)]="a.carpeta" placeholder="4X1000 Davivienda" /></div>
                        }
                        @case ('reenviar') {
                          <div class="flex flex-col gap-1"><label class="alma-label">Destinatarios (coma)</label><input class="alma-input" [(ngModel)]="a.destinatarios" placeholder="litigios@skandia.com.co" /></div>
                          <div class="flex flex-col gap-1"><label class="alma-label">Comentario</label><input class="alma-input" [(ngModel)]="a.comentario" placeholder="Se adjunta resumen de la IA" /></div>
                        }
                        @case ('asignar_analista') {
                          <div class="flex flex-col gap-1 sm:col-span-2"><label class="alma-label">Analistas en turno (coma). Se asigna al que menos tenga hoy.</label><input class="alma-input" [(ngModel)]="a.analistas" placeholder="Laura Gómez, Andrés Pérez" /></div>
                          <label class="flex items-center gap-2 text-xs text-muted-foreground"><alma-switch [checked]="a.mover_a_carpeta_del_analista" (checkedChange)="a.mover_a_carpeta_del_analista = $event" /> Mover a la carpeta con el nombre del analista</label>
                        }
                        @case ('notificar_teams') {
                          <div class="flex flex-col gap-1 sm:col-span-2"><label class="alma-label">Webhook del canal (opcional)</label><input class="alma-input" [(ngModel)]="a.webhook_url" placeholder="https://…webhook.office.com/…" /></div>
                        }
                      }
                    </div>
                  </div>
                }
                <div class="flex flex-wrap gap-2">
                  @for (t of tipos; track t.tipo) {
                    <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [almaTooltip]="t.ayuda" (click)="agregarAccion(t.tipo)">
                      <lucide-icon [name]="t.icono" [size]="14" /> {{ t.nombre }}
                    </button>
                  }
                </div>
              </div>
            }
          }
        </div>

        <!-- Pie -->
        <div class="flex items-center justify-between gap-2 border-t border-border/60 px-5 py-3">
          <label class="flex items-center gap-2 text-xs text-muted-foreground"><alma-switch [checked]="activa()" (checkedChange)="activa.set($event)" /> Tipo activo</label>
          @if (error(); as e) { <p class="text-xs text-destructive">{{ e }}</p> }
          <div class="flex gap-2">
            <button type="button" class="alma-btn alma-btn-outline" (click)="cancelar.emit()">Cancelar</button>
            @if (paso() !== 'acciones') {
              <button type="button" class="alma-btn alma-btn-primary" (click)="siguiente()">Siguiente <lucide-icon name="arrow-right" [size]="15" /></button>
            } @else {
              <button type="button" class="alma-btn alma-btn-primary" [disabled]="guardando()" (click)="confirmar()">
                <lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardando()" /> Guardar
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CategoriaEditorComponent {
  readonly categoria = input<Categoria | null>(null);
  readonly guardando = input(false);
  readonly guardar = output<CategoriaIn>();
  readonly cancelar = output<void>();

  protected readonly pasos = [
    { id: 'reconocer' as const, nombre: 'Reconocer' },
    { id: 'extraer' as const, nombre: 'Datos a extraer' },
    { id: 'acciones' as const, nombre: 'Acciones' },
  ];
  protected readonly paso = signal<'reconocer' | 'extraer' | 'acciones'>('reconocer');
  protected readonly colores = COLORES;
  protected readonly tipos = TIPOS_ACCION;

  protected nombre = '';
  protected clave = '';
  protected esFallback = false;
  protected descripcion = '';
  protected palabrasClave = '';
  protected nuevoEjemplo = '';
  protected readonly ejemplos = signal<string[]>([]);
  protected readonly color = signal(COLORES[1]);
  protected readonly umbral = signal<number | null>(null);
  protected readonly activa = signal(true);
  protected readonly campos = signal<CampoExtraer[]>([]);
  protected readonly acciones = signal<AccionForm[]>([]);
  protected readonly error = signal<string | null>(null);

  private claveManual = false;

  constructor() {
    // Carga inicial desde la categoría a editar (input) — una sola vez al abrir.
    queueMicrotask(() => {
      const c = this.categoria();
      if (!c) {
        this.acciones.set([accionVacia('categorizar')]);
        return;
      }
      this.nombre = c.nombre;
      this.clave = c.clave;
      this.claveManual = true;
      this.esFallback = c.es_fallback;
      this.descripcion = c.descripcion;
      this.palabrasClave = c.palabras_clave ?? '';
      this.ejemplos.set([...c.ejemplos]);
      this.color.set(c.color ?? COLORES[1]);
      this.umbral.set(c.umbral_confianza !== null ? Math.round(c.umbral_confianza * 100) : null);
      this.activa.set(c.activa);
      this.campos.set(c.campos_extraer.map((x) => ({ ...x })));
      this.acciones.set([...c.acciones].sort((a, b) => a.orden - b.orden).map(aForm));
    });
  }

  protected nombreDe(t: string): string {
    return nombreAccion(t);
  }
  protected icono(t: string): string {
    return TIPOS_ACCION.find((x) => x.tipo === t)?.icono ?? 'zap';
  }

  protected sugerirClave(): void {
    if (this.claveManual || this.categoria()) return;
    this.clave = this.nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    // La acción "categorizar" por defecto sigue la clave mientras no la toquen.
    const acs = this.acciones();
    if (acs.length && acs[0].tipo === 'categorizar' && !acs[0].categoria) acs[0].categoria = '';
  }

  protected agregarEjemplo(): void {
    const e = this.nuevoEjemplo.trim();
    if (!e) return;
    this.ejemplos.update((l) => [...l, e]);
    this.nuevoEjemplo = '';
  }
  protected quitarEjemplo(i: number): void {
    this.ejemplos.update((l) => l.filter((_, j) => j !== i));
  }
  protected agregarCampo(): void {
    this.campos.update((l) => [...l, { clave: '', descripcion: '' }]);
  }
  protected quitarCampo(i: number): void {
    this.campos.update((l) => l.filter((_, j) => j !== i));
  }
  protected agregarAccion(tipo: TipoAccion): void {
    this.acciones.update((l) => [...l, accionVacia(tipo, this.clave)]);
  }
  protected quitarAccion(i: number): void {
    this.acciones.update((l) => l.filter((_, j) => j !== i));
  }
  protected mover(i: number, d: number): void {
    this.acciones.update((l) => {
      const c = [...l];
      const [x] = c.splice(i, 1);
      c.splice(i + d, 0, x);
      return c;
    });
  }

  protected siguiente(): void {
    if (this.paso() === 'reconocer') {
      if (!this.validarBase()) return;
      this.paso.set('extraer');
    } else if (this.paso() === 'extraer') {
      this.paso.set('acciones');
    }
  }

  private validarBase(): boolean {
    this.error.set(null);
    if (this.nombre.trim().length < 2) {
      this.error.set('Escribe un nombre.');
      return false;
    }
    this.clave = this.clave.trim().toUpperCase().replace(/\s+/g, '_');
    if (!/^[A-Z0-9_\-]{2,80}$/.test(this.clave)) {
      this.error.set('La clave debe tener letras, números, guion o guion bajo (2 a 80 caracteres).');
      return false;
    }
    if (this.descripcion.trim().length < 10) {
      this.error.set('Describe cómo reconocer este tipo de correo (al menos una frase).');
      return false;
    }
    return true;
  }

  protected confirmar(): void {
    if (!this.validarBase()) {
      this.paso.set('reconocer');
      return;
    }
    const acciones = this.acciones().map((f, i) => {
      const a = { ...f };
      if (a.tipo === 'categorizar' && !a.categoria.trim()) a.categoria = this.clave;
      return aAccion(a, i + 1);
    });
    this.guardar.emit({
      clave: this.clave,
      nombre: this.nombre.trim(),
      descripcion: this.descripcion.trim(),
      ejemplos: this.ejemplos(),
      palabras_clave: this.palabrasClave.trim() || null,
      color: this.color(),
      activa: this.activa(),
      es_fallback: this.esFallback,
      umbral_confianza: this.umbral() !== null ? this.umbral()! / 100 : null,
      campos_extraer: this.campos().filter((c) => c.clave.trim()).map((c) => ({ clave: c.clave.trim(), descripcion: c.descripcion.trim() })),
      acciones,
    });
  }
}
