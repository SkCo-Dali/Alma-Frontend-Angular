// Configuración de UN buzón: parámetros (modo, umbral, carpeta, contexto para la IA),
// tipos de correo (categorías con sus acciones), reglas fijas y un probador en vivo.

import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { AlmaSwitchComponent } from '../../shared/components/alma-switch.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import {
  Buzon,
  BuzonApi,
  Categoria,
  CategoriaIn,
  ReglaFija,
  ReglaIn,
  ResultadoPrueba,
  iconoAccion,
  resumenAccion,
} from './buzon.api';
import { CategoriaEditorComponent } from './categoria-editor.component';
import { DemoBadgeComponent } from './demo-badge.component';

type Tab = 'tipos' | 'reglas' | 'ajustes' | 'probar';

@Component({
  selector: 'alma-buzon-config',
  imports: [DecimalPipe, FormsModule, RouterLink, LucideAngularModule, AccessDeniedComponent, AlmaLoaderComponent, AlmaSwitchComponent, TooltipDirective, CategoriaEditorComponent, DemoBadgeComponent],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else if (cargando()) {
      <div class="flex justify-center py-24"><alma-loader [size]="80" label="Cargando buzón…" /></div>
    } @else if (buzon(); as b) {
      <div class="mx-auto w-full max-w-6xl space-y-5 px-4 py-4 sm:px-6">
        <!-- Encabezado -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <a routerLink="/apps/buzon-inteligente/buzones" class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary">
              <lucide-icon name="arrow-left" [size]="16" /> Buzones
            </a>
            <div class="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style="background:linear-gradient(150deg,#BF5AF2,#6D4AE0)"><lucide-icon name="mail" [size]="20" /></div>
            <div>
              <h1 class="text-on-wallpaper text-2xl font-bold tracking-tight text-foreground">{{ b.nombre }}</h1>
              <p class="text-on-wallpaper text-sm text-foreground/80">{{ b.direccion }} @if (b.area) {· {{ b.area }}}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <alma-demo-badge />
            <div class="glass flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs">
              <span class="text-muted-foreground">Modo</span>
              <span class="font-semibold" [class.text-emerald-600]="b.modo === 'automatico'">{{ b.modo === 'automatico' ? 'Automático' : 'Solo sugiere' }}</span>
              <alma-switch [checked]="b.modo === 'automatico'" (checkedChange)="cambiarModo($event)" [disabled]="!puedeGestionar()" ariaLabel="Modo automático" />
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="glass inline-flex gap-1 rounded-xl p-1">
          @for (t of tabs; track t.id) {
            <button type="button" class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors" [class]="tab() === t.id ? 'bg-primary text-primary-foreground shadow-[var(--shadow-sm)]' : 'text-muted-foreground hover:text-foreground'" (click)="tab.set(t.id)">
              <lucide-icon [name]="t.icon" [size]="15" /> {{ t.nombre }}
              @if (t.id === 'tipos') { <span class="rounded-full bg-black/10 px-1.5 text-[10px] tabular-nums">{{ categorias().length }}</span> }
              @if (t.id === 'reglas') { <span class="rounded-full bg-black/10 px-1.5 text-[10px] tabular-nums">{{ reglas().length }}</span> }
            </button>
          }
        </div>

        @switch (tab()) {
          <!-- ── TIPOS DE CORREO ── -->
          @case ('tipos') {
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm text-muted-foreground">Cada tipo le dice a la IA cómo reconocer el correo, qué datos leer y qué hacer. Ordenados por prioridad.</p>
              @if (puedeGestionar()) {
                <button type="button" class="alma-btn alma-btn-primary rounded-xl" (click)="nuevaCategoria()"><lucide-icon name="plus" [size]="16" /> Nuevo tipo de correo</button>
              }
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              @for (c of categorias(); track c.id) {
                <article class="glass flex flex-col gap-3 rounded-2xl p-4 shadow-[var(--shadow-sm)]" [class.opacity-60]="!c.activa">
                  <div class="flex items-start gap-3">
                    <span class="mt-0.5 h-9 w-1.5 shrink-0 rounded-full" [style.background]="c.color || '#8E8E93'"></span>
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-sm font-bold text-foreground">{{ c.nombre }}</h3>
                        <span class="rounded-md bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{{ c.clave }}</span>
                        @if (c.es_fallback) { <span class="alma-badge bg-zinc-500/15 text-zinc-600 dark:text-zinc-300">Por defecto</span> }
                        @if (!c.activa) { <span class="alma-badge bg-zinc-500/15 text-zinc-600">Inactivo</span> }
                      </div>
                      <p class="mt-1 line-clamp-3 text-xs leading-snug text-muted-foreground">{{ c.descripcion }}</p>
                    </div>
                    @if (puedeGestionar()) {
                      <div class="flex shrink-0 gap-0.5">
                        <button type="button" class="alma-btn alma-btn-ghost" almaTooltip="Editar" (click)="editarCategoria(c)"><lucide-icon name="pencil" [size]="15" /></button>
                        @if (!c.es_fallback) {
                          <button type="button" class="alma-btn alma-btn-ghost text-destructive" almaTooltip="Eliminar" (click)="eliminarCategoria(c)"><lucide-icon name="trash-2" [size]="15" /></button>
                        }
                      </div>
                    }
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    @for (a of accionesOrdenadas(c); track $index) {
                      <span class="inline-flex items-center gap-1 rounded-full border border-border/60 bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] text-foreground" [class.line-through]="!a.activa">
                        <lucide-icon [name]="icono(a.tipo)" [size]="11" class="text-primary" /> {{ resumen(a) }}
                      </span>
                    }
                    @if (!c.acciones.length) { <span class="text-[11px] italic text-muted-foreground">Sin acciones: queda en la bandeja para revisión.</span> }
                  </div>
                  <div class="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span class="inline-flex items-center gap-1"><lucide-icon name="scan-text" [size]="11" /> {{ c.campos_extraer.length }} datos a extraer</span>
                    <span class="inline-flex items-center gap-1"><lucide-icon name="gauge" [size]="11" /> umbral {{ ((c.umbral_confianza ?? b.umbral_confianza) * 100) | number: '1.0-0' }}%</span>
                    <span class="inline-flex items-center gap-1 tabular-nums"><lucide-icon name="mail" [size]="11" /> {{ c.correos_30d }} en 30 días</span>
                  </div>
                </article>
              }
            </div>
          }

          <!-- ── REGLAS FIJAS ── -->
          @case ('reglas') {
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm text-muted-foreground">Atajos sin IA: si el correo cumple todas las condiciones se clasifica directo (útil para notificaciones automáticas).</p>
              @if (puedeGestionar()) {
                <button type="button" class="alma-btn alma-btn-primary rounded-xl" (click)="nuevaRegla()"><lucide-icon name="plus" [size]="16" /> Nueva regla</button>
              }
            </div>
            <div class="glass overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
              @if (reglas().length === 0) {
                <p class="p-8 text-center text-sm text-muted-foreground">No hay reglas fijas. Todo pasa por la IA.</p>
              } @else {
                <div class="overflow-x-auto">
                  <table class="alma-table">
                    <thead><tr><th>Regla</th><th>Remitente contiene</th><th>Asunto contiene</th><th>Cuerpo contiene</th><th>Clasifica como</th><th class="text-right"></th></tr></thead>
                    <tbody>
                      @for (r of reglas(); track r.id) {
                        <tr [class.opacity-50]="!r.activa">
                          <td class="font-medium">{{ r.nombre }}</td>
                          <td class="font-mono text-xs">{{ r.remitente_contiene || '—' }}</td>
                          <td class="font-mono text-xs">{{ r.asunto_contiene || '—' }}</td>
                          <td class="font-mono text-xs">{{ r.cuerpo_contiene || '—' }}</td>
                          <td><span class="alma-badge text-white" [style.background]="colorDe(r.categoria_id)">{{ claveDe(r.categoria_id) }}</span></td>
                          <td class="text-right">
                            @if (puedeGestionar()) {
                              <button type="button" class="alma-btn alma-btn-ghost" (click)="editarRegla(r)"><lucide-icon name="pencil" [size]="15" /></button>
                              <button type="button" class="alma-btn alma-btn-ghost text-destructive" (click)="eliminarRegla(r)"><lucide-icon name="trash-2" [size]="15" /></button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }

          <!-- ── AJUSTES ── -->
          @case ('ajustes') {
            <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <section class="glass rounded-2xl p-5 shadow-[var(--shadow-sm)] lg:col-span-2">
                <h2 class="text-sm font-semibold text-foreground">Contexto del área para la IA</h2>
                <p class="mt-0.5 text-xs text-muted-foreground">Lo que cualquier analista nuevo debería saber: qué hace el área, documentos típicos, glosario, NIT, cuentas, marco legal. Se envía en cada clasificación.</p>
                <textarea class="alma-input mt-3 min-h-52 py-2 text-sm leading-relaxed" [(ngModel)]="ajustes.contexto" [disabled]="!puedeGestionar()"></textarea>
              </section>
              <section class="glass flex flex-col gap-4 rounded-2xl p-5 shadow-[var(--shadow-sm)]">
                <div>
                  <h2 class="text-sm font-semibold text-foreground">Parámetros</h2>
                  <p class="mt-0.5 text-xs text-muted-foreground">Cómo y cuándo actúa Alma sobre este buzón.</p>
                </div>
                <div class="flex flex-col gap-1.5"><label class="alma-label">Nombre</label><input class="alma-input" [(ngModel)]="ajustes.nombre" [disabled]="!puedeGestionar()" /></div>
                <div class="flex flex-col gap-1.5"><label class="alma-label">Área</label><input class="alma-input" [(ngModel)]="ajustes.area" [disabled]="!puedeGestionar()" /></div>
                <div class="flex flex-col gap-1.5">
                  <label class="alma-label flex items-center gap-1">Carpeta vigilada <lucide-icon name="info" [size]="12" almaTooltip="Inbox = Bandeja de entrada. Puedes indicar otra carpeta por su nombre." /></label>
                  <input class="alma-input" [(ngModel)]="ajustes.carpeta_vigilada" [disabled]="!puedeGestionar()" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="alma-label">Umbral de confianza para actuar solo: <b class="text-foreground">{{ ajustes.umbral }}%</b></label>
                  <input type="range" min="50" max="99" class="accent-[var(--primary)]" [(ngModel)]="ajustes.umbral" [disabled]="!puedeGestionar()" />
                  <p class="text-[11px] text-muted-foreground">Debajo del umbral el correo espera aprobación en la bandeja.</p>
                </div>
                <div class="flex flex-col gap-1.5"><label class="alma-label">Correos por ciclo (cada 5 min)</label><input type="number" min="1" max="200" class="alma-input" [(ngModel)]="ajustes.max" [disabled]="!puedeGestionar()" /></div>
                <label class="flex items-center justify-between text-sm"><span>Buzón activo</span><alma-switch [checked]="ajustes.activo" (checkedChange)="ajustes.activo = $event" [disabled]="!puedeGestionar()" /></label>
                @if (puedeGestionar()) {
                  <button type="button" class="alma-btn alma-btn-primary rounded-xl" [disabled]="guardandoAjustes()" (click)="guardarAjustes()">
                    <lucide-icon [name]="guardandoAjustes() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardandoAjustes()" /> Guardar ajustes
                  </button>
                }
              </section>
            </div>
          }

          <!-- ── PROBAR ── -->
          @case ('probar') {
            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section class="glass flex flex-col gap-3 rounded-2xl p-5 shadow-[var(--shadow-sm)]">
                <div>
                  <h2 class="text-sm font-semibold text-foreground">Probar con un correo</h2>
                  <p class="mt-0.5 text-xs text-muted-foreground">Pega un correo real (o inventa uno) y mira cómo lo clasificaría Alma con la configuración actual. No se ejecuta nada.</p>
                </div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div class="flex flex-col gap-1.5"><label class="alma-label">Remitente</label><input class="alma-input" [(ngModel)]="prueba.remitente" placeholder="asesor@fp.skandia.com.co" /></div>
                  <div class="flex flex-col gap-1.5"><label class="alma-label">Asunto</label><input class="alma-input" [(ngModel)]="prueba.asunto" placeholder="Exención 4x1000 traslado FPV" /></div>
                </div>
                <div class="flex flex-col gap-1.5"><label class="alma-label">Cuerpo</label><textarea class="alma-input min-h-32 py-2" [(ngModel)]="prueba.cuerpo" placeholder="Buen día, adjunto carta de autorización a Davivienda y certificado…"></textarea></div>
                <div class="flex flex-col gap-1.5"><label class="alma-label">Texto de adjuntos (opcional)</label><textarea class="alma-input min-h-20 py-2" [(ngModel)]="prueba.texto_adjuntos" placeholder="Pega aquí el texto de un PDF para simular el adjunto…"></textarea></div>
                <div class="flex items-center gap-2">
                  <button type="button" class="alma-btn alma-btn-primary rounded-xl" [disabled]="probando() || !prueba.asunto" (click)="probar()">
                    <lucide-icon [name]="probando() ? 'loader-2' : 'sparkles'" [size]="15" [class.animate-spin]="probando()" /> Clasificar con IA
                  </button>
                  <button type="button" class="alma-btn alma-btn-outline rounded-xl" (click)="ejemploPrueba()"><lucide-icon name="flask-conical" [size]="15" /> Usar un ejemplo</button>
                </div>
              </section>
              <section class="glass flex flex-col rounded-2xl p-5 shadow-[var(--shadow-sm)]">
                @if (resultado(); as r) {
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Clasificación</p>
                      <p class="mt-1 text-xl font-bold text-foreground">{{ r.categoria_nombre ?? 'Sin categoría' }}</p>
                      <p class="font-mono text-xs text-muted-foreground">{{ r.categoria_clave }}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Confianza</p>
                      <p class="mt-1 text-3xl font-bold tabular-nums" [class]="r.cumple_umbral ? 'text-emerald-600' : 'text-amber-600'">{{ (r.confianza * 100) | number: '1.0-0' }}%</p>
                      <p class="text-[11px]" [class]="r.cumple_umbral ? 'text-emerald-600' : 'text-amber-600'">{{ r.cumple_umbral ? 'Se ejecutaría solo' : 'Iría a revisión' }}</p>
                    </div>
                  </div>
                  <div class="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]"><div class="h-full rounded-full transition-all" [class]="r.cumple_umbral ? 'bg-emerald-500' : 'bg-amber-500'" [style.width.%]="r.confianza * 100"></div></div>
                  <div class="mt-4 rounded-xl bg-[var(--surface-sunken)] p-3">
                    <p class="text-[11px] font-semibold text-muted-foreground">Resumen</p>
                    <p class="mt-1 text-sm text-foreground">{{ r.resumen }}</p>
                    <p class="mt-2 text-[11px] font-semibold text-muted-foreground">Por qué</p>
                    <p class="mt-1 text-xs text-muted-foreground">{{ r.justificacion }}</p>
                  </div>
                  @if (entradas(r.datos_extraidos).length) {
                    <div class="mt-3">
                      <p class="text-[11px] font-semibold text-muted-foreground">Datos extraídos</p>
                      <dl class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        @for (d of entradas(r.datos_extraidos); track d[0]) {
                          <dt class="font-mono text-muted-foreground">{{ d[0] }}</dt><dd class="truncate text-foreground">{{ d[1] || '—' }}</dd>
                        }
                      </dl>
                    </div>
                  }
                  <div class="mt-3">
                    <p class="text-[11px] font-semibold text-muted-foreground">Acciones que se ejecutarían</p>
                    <div class="mt-1 flex flex-wrap gap-1.5">
                      @for (a of r.acciones_previstas; track $index) {
                        <span class="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[11px]"><lucide-icon [name]="icono(a.tipo)" [size]="11" class="text-primary" /> {{ resumen(a) }}</span>
                      }
                      @if (!r.acciones_previstas.length) { <span class="text-[11px] italic text-muted-foreground">Ninguna: quedaría en la bandeja.</span> }
                    </div>
                  </div>
                } @else {
                  <div class="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                    <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><lucide-icon name="sparkles" [size]="26" /></span>
                    <p class="text-sm text-muted-foreground">El resultado de la clasificación aparecerá aquí.</p>
                  </div>
                }
              </section>
            </div>
          }
        }
      </div>

      @if (editorAbierto()) {
        <alma-categoria-editor [categoria]="categoriaEditando()" [guardando]="guardandoCategoria()" (guardar)="guardarCategoria($event)" (cancelar)="editorAbierto.set(false)" />
      }

      @if (reglaAbierta()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="reglaAbierta.set(false)">
          <div class="surface-solid w-full max-w-lg rounded-2xl border border-border p-5 shadow-[var(--shadow-lg)]" (click)="$event.stopPropagation()">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-foreground">{{ reglaEditando() ? 'Editar regla' : 'Nueva regla fija' }}</h2>
              <button type="button" class="alma-btn alma-btn-ghost" (click)="reglaAbierta.set(false)"><lucide-icon name="x" [size]="16" /></button>
            </div>
            <div class="grid grid-cols-1 gap-3">
              <div class="flex flex-col gap-1.5"><label class="alma-label">Nombre *</label><input class="alma-input" [(ngModel)]="reglaForm.nombre" /></div>
              <div class="flex flex-col gap-1.5"><label class="alma-label">Remitente contiene</label><input class="alma-input" [(ngModel)]="reglaForm.remitente_contiene" placeholder="notificaciones@banco.com" /></div>
              <div class="flex flex-col gap-1.5"><label class="alma-label">Asunto contiene</label><input class="alma-input" [(ngModel)]="reglaForm.asunto_contiene" /></div>
              <div class="flex flex-col gap-1.5"><label class="alma-label">Cuerpo contiene</label><input class="alma-input" [(ngModel)]="reglaForm.cuerpo_contiene" /></div>
              <div class="flex flex-col gap-1.5">
                <label class="alma-label">Clasificar como *</label>
                <select class="alma-input" [(ngModel)]="reglaForm.categoria_id">
                  @for (c of categorias(); track c.id) { <option [value]="c.id">{{ c.nombre }} ({{ c.clave }})</option> }
                </select>
              </div>
              <label class="flex items-center gap-2 text-sm"><alma-switch [checked]="reglaForm.activa" (checkedChange)="reglaForm.activa = $event" /> Regla activa</label>
            </div>
            @if (errorRegla(); as e) { <p class="mt-3 text-xs text-destructive">{{ e }}</p> }
            <div class="mt-5 flex justify-end gap-2">
              <button type="button" class="alma-btn alma-btn-outline" (click)="reglaAbierta.set(false)">Cancelar</button>
              <button type="button" class="alma-btn alma-btn-primary" [disabled]="guardandoRegla()" (click)="guardarRegla()"><lucide-icon name="save" [size]="15" /> Guardar</button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class BuzonConfigComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected readonly puedeVer = computed(() => this.auth.hasPermission('app.buzon-inteligente.view'));
  protected readonly puedeGestionar = computed(() => this.auth.hasPermission('app.buzon-inteligente.manage') || !!this.buzon()?.puede_administrar);

  protected readonly tabs: { id: Tab; nombre: string; icon: string }[] = [
    { id: 'tipos', nombre: 'Tipos de correo', icon: 'tags' },
    { id: 'reglas', nombre: 'Reglas fijas', icon: 'list-filter' },
    { id: 'ajustes', nombre: 'Ajustes e IA', icon: 'sliders-horizontal' },
    { id: 'probar', nombre: 'Probar', icon: 'flask-conical' },
  ];
  protected readonly tab = signal<Tab>('tipos');

  protected readonly cargando = signal(true);
  protected readonly buzon = signal<Buzon | null>(null);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly reglas = signal<ReglaFija[]>([]);

  protected readonly editorAbierto = signal(false);
  protected readonly categoriaEditando = signal<Categoria | null>(null);
  protected readonly guardandoCategoria = signal(false);

  protected readonly reglaAbierta = signal(false);
  protected readonly reglaEditando = signal<ReglaFija | null>(null);
  protected readonly guardandoRegla = signal(false);
  protected readonly errorRegla = signal<string | null>(null);
  protected reglaForm: ReglaIn = { nombre: '', remitente_contiene: '', asunto_contiene: '', cuerpo_contiene: '', categoria_id: '', orden: 1, activa: true };

  protected readonly guardandoAjustes = signal(false);
  protected ajustes = { nombre: '', area: '', carpeta_vigilada: 'Inbox', umbral: 80, max: 25, activo: true, contexto: '' };

  protected readonly probando = signal(false);
  protected readonly resultado = signal<ResultadoPrueba | null>(null);
  protected prueba = { remitente: '', asunto: '', cuerpo: '', texto_adjuntos: '' };

  protected readonly icono = iconoAccion;
  protected readonly resumen = resumenAccion;

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [b, cats, reglas] = await Promise.all([
        this.api.obtenerBuzon(this.id),
        this.api.listarCategorias(this.id),
        this.api.listarReglas(this.id),
      ]);
      this.buzon.set(b);
      this.categorias.set([...cats].sort((x, y) => x.orden - y.orden));
      this.reglas.set([...reglas].sort((x, y) => x.orden - y.orden));
      this.ajustes = {
        nombre: b.nombre,
        area: b.area ?? '',
        carpeta_vigilada: b.carpeta_vigilada,
        umbral: Math.round(b.umbral_confianza * 100),
        max: b.max_correos_por_tick,
        activo: b.activo,
        contexto: b.contexto ?? '',
      };
    } catch (e) {
      this.toast.error('No se pudo cargar el buzón', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected accionesOrdenadas(c: Categoria) {
    return [...c.acciones].sort((a, b) => a.orden - b.orden);
  }
  protected claveDe(id: string): string {
    return this.categorias().find((c) => c.id === id)?.clave ?? '—';
  }
  protected colorDe(id: string): string {
    return this.categorias().find((c) => c.id === id)?.color ?? '#8E8E93';
  }
  protected entradas(o: Record<string, unknown> | null): [string, string][] {
    return Object.entries(o ?? {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)]);
  }

  protected async cambiarModo(auto: boolean): Promise<void> {
    const b = this.buzon();
    if (!b) return;
    try {
      const actualizado = await this.api.actualizarBuzon(b.id, { modo: auto ? 'automatico' : 'sugerir' });
      this.buzon.set(actualizado);
      this.toast.show(auto ? 'Modo automático activado' : 'Modo “solo sugiere” activado', auto ? `Sobre ${Math.round(actualizado.umbral_confianza * 100)}% de confianza Alma actúa sin preguntar.` : 'Todo pasa por la bandeja de revisión.');
    } catch (e) {
      this.toast.error('No se pudo cambiar el modo', e instanceof Error ? e.message : String(e));
    }
  }

  protected async guardarAjustes(): Promise<void> {
    const b = this.buzon();
    if (!b) return;
    this.guardandoAjustes.set(true);
    try {
      const actualizado = await this.api.actualizarBuzon(b.id, {
        nombre: this.ajustes.nombre.trim(),
        area: this.ajustes.area.trim() || null,
        carpeta_vigilada: this.ajustes.carpeta_vigilada.trim() || 'Inbox',
        umbral_confianza: this.ajustes.umbral / 100,
        max_correos_por_tick: Number(this.ajustes.max) || 25,
        activo: this.ajustes.activo,
        contexto: this.ajustes.contexto.trim() || null,
      });
      this.buzon.set(actualizado);
      this.toast.show('Ajustes guardados');
    } catch (e) {
      this.toast.error('No se pudieron guardar los ajustes', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoAjustes.set(false);
    }
  }

  // Categorías
  protected nuevaCategoria(): void {
    this.categoriaEditando.set(null);
    this.editorAbierto.set(true);
  }
  protected editarCategoria(c: Categoria): void {
    this.categoriaEditando.set(c);
    this.editorAbierto.set(true);
  }
  protected async guardarCategoria(body: CategoriaIn): Promise<void> {
    this.guardandoCategoria.set(true);
    try {
      const actual = this.categoriaEditando();
      if (actual) await this.api.actualizarCategoria(actual.id, body);
      else await this.api.crearCategoria(this.id, body);
      this.editorAbierto.set(false);
      this.toast.show(actual ? 'Tipo de correo actualizado' : 'Tipo de correo creado', body.nombre);
      this.categorias.set((await this.api.listarCategorias(this.id)).sort((x, y) => x.orden - y.orden));
    } catch (e) {
      this.toast.error('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoCategoria.set(false);
    }
  }
  protected async eliminarCategoria(c: Categoria): Promise<void> {
    if (!confirm(`¿Eliminar el tipo “${c.nombre}”? Los correos ya clasificados conservan su histórico.`)) return;
    try {
      await this.api.eliminarCategoria(c.id);
      this.categorias.update((l) => l.filter((x) => x.id !== c.id));
      this.toast.show('Tipo eliminado', c.nombre);
    } catch (e) {
      this.toast.error('No se pudo eliminar', e instanceof Error ? e.message : String(e));
    }
  }

  // Reglas
  protected nuevaRegla(): void {
    this.reglaEditando.set(null);
    this.reglaForm = { nombre: '', remitente_contiene: '', asunto_contiene: '', cuerpo_contiene: '', categoria_id: this.categorias()[0]?.id ?? '', orden: this.reglas().length + 1, activa: true };
    this.errorRegla.set(null);
    this.reglaAbierta.set(true);
  }
  protected editarRegla(r: ReglaFija): void {
    this.reglaEditando.set(r);
    this.reglaForm = { nombre: r.nombre, remitente_contiene: r.remitente_contiene ?? '', asunto_contiene: r.asunto_contiene ?? '', cuerpo_contiene: r.cuerpo_contiene ?? '', categoria_id: r.categoria_id, orden: r.orden, activa: r.activa };
    this.errorRegla.set(null);
    this.reglaAbierta.set(true);
  }
  protected async guardarRegla(): Promise<void> {
    const f = this.reglaForm;
    if (!f.nombre.trim() || !f.categoria_id) {
      this.errorRegla.set('Nombre y categoría son obligatorios.');
      return;
    }
    if (!f.remitente_contiene && !f.asunto_contiene && !f.cuerpo_contiene) {
      this.errorRegla.set('Indica al menos una condición.');
      return;
    }
    this.guardandoRegla.set(true);
    try {
      const body: ReglaIn = { ...f, remitente_contiene: f.remitente_contiene || null, asunto_contiene: f.asunto_contiene || null, cuerpo_contiene: f.cuerpo_contiene || null };
      const actual = this.reglaEditando();
      if (actual) await this.api.actualizarRegla(actual.id, body);
      else await this.api.crearRegla(this.id, body);
      this.reglaAbierta.set(false);
      this.reglas.set((await this.api.listarReglas(this.id)).sort((x, y) => x.orden - y.orden));
      this.toast.show(actual ? 'Regla actualizada' : 'Regla creada', body.nombre);
    } catch (e) {
      this.errorRegla.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoRegla.set(false);
    }
  }
  protected async eliminarRegla(r: ReglaFija): Promise<void> {
    if (!confirm(`¿Eliminar la regla “${r.nombre}”?`)) return;
    try {
      await this.api.eliminarRegla(r.id);
      this.reglas.update((l) => l.filter((x) => x.id !== r.id));
    } catch (e) {
      this.toast.error('No se pudo eliminar', e instanceof Error ? e.message : String(e));
    }
  }

  // Probar
  protected ejemploPrueba(): void {
    this.prueba = {
      remitente: 'mrodriguez@fp.skandia.com.co',
      asunto: 'Exención 4x1000 traslado FPV - Juan Carlos Mejía',
      cuerpo: 'Buen día equipo de Recaudos. Adjunto carta de autorización firmada por el afiliado para que Bancolombia debite $15.000.000 de su cuenta y los traslade al Fondo de Pensiones Voluntarias de Skandia (NIT 830.038.085-1), junto con la certificación de Skandia y el comprobante de la transferencia aprobada. Quedo atenta.',
      texto_adjuntos: 'CERTIFICACION PARA TRASLADOS DE RECURSOS DE CUENTAS CORRIENTES O DE AHORRO A CUENTAS DEL FONDO DE PENSIONES VOLUNTARIAS. Skandia Pensiones y Cesantías S.A. NIT 800.148.514-2 certifica que el traslado de Juan Carlos Mejía Torres CC 79.845.112 contrato 100006818611 corresponde a adición de aportes. Decreto 660 de 2011 Art. 8 Num. 2. Solicitud aprobada No. 8812903 cuenta destino 200-3511643-8 valor 15.000.000.',
    };
  }
  protected async probar(): Promise<void> {
    this.probando.set(true);
    try {
      this.resultado.set(await this.api.probar(this.id, { ...this.prueba, texto_adjuntos: this.prueba.texto_adjuntos || undefined }));
    } catch (e) {
      this.toast.error('No se pudo clasificar', e instanceof Error ? e.message : String(e));
    } finally {
      this.probando.set(false);
    }
  }
}
