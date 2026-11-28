// Pestaña «Procesos (nuevo)» (095): los procesos «simples» del buzón, uno por caso, cada
// uno con su propio prompt y sus casillas. Muestra una ficha por proceso y abre el
// asistente de 6 pasos para crear o editar. Los procesos clásicos siguen en «Reglas»
// (allá los simples salen con candado). Se publica igual que siempre: una sola versión
// para clásicos y simples.

import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { Buzon, BuzonApi, Categoria, EstadoReglas, Grupo, Proceso } from './buzon.api';
import { deRevision, primerParrafo, textoCasilla } from './buzon-casillas';
import { ProcesoAsistenteComponent, destinoGrupo } from './proceso-asistente.component';

@Component({
  selector: 'alma-procesos-simples-tab',
  imports: [NgTemplateOutlet, LucideAngularModule, ProcesoAsistenteComponent],
  styleUrls: ['./buzon-proto.css'],
  template: `
    @if (cargando()) {
      <p class="xs muted">Cargando procesos…</p>
    } @else if (abierto(); as a) {
      <alma-proceso-asistente [buzon]="buzon()" [proceso]="a.proceso" [pasoInicial]="a.paso" [familiaInicial]="a.familia" [procesos]="procesos()" [categorias]="categorias()"
        [grupos]="grupos()" (guardado)="recargar()" (publicado)="alPublicar()" (cerrado)="cerrar()"
        (probo)="marcarProbado($event)" />
    } @else {
      <div class="glass r-2xl stack" style="padding:16px">
        <div class="row between" style="align-items:flex-start">
          <div style="min-width:0">
            <p class="sm b">Procesos (nuevo)
              @if (est()?.borrador && buzon().version_reglas) { <span class="badge b-violet">Borrador v{{ siguiente() }}</span> sobre }
              @if (buzon().version_reglas) { <span class="badge b-emerald">Vigente v{{ buzon().version_reglas }}</span> }
              @else { <span class="badge b-slate">Sin versión publicada</span> }
            </p>
            <p class="xs muted" style="margin-top:4px">Cada caso es un proceso con su propio texto. Nova lo reconoce, revisa sus casillas y lo deja salir solo o lo manda a Validar con la casilla que falló.</p>
          </div>
          <div class="row">
            @if (est()?.borrador) {
              <button type="button" class="btn outline sm" [disabled]="publicando()" (click)="publicar()" [title]="(est()?.cambios?.length ?? 0) + ' cambio(s) sin publicar'">
                <lucide-icon [name]="publicando() ? 'loader-2' : 'upload-cloud'" [size]="13" [class.animate-spin]="publicando()" /> {{ publicando() ? 'Publicando…' : 'Publicar v' + siguiente() }}</button>
            }
            <button type="button" class="btn primary sm" (click)="abrir(null, 0)"><lucide-icon name="plus" [size]="13" /> Nuevo proceso</button>
          </div>
        </div>
        <p class="note b-sky"><lucide-icon name="info" [size]="13" />
          <span>Los procesos de antes siguen en la pestaña Reglas. Los de aquí aparecen allá con candado y solo se editan aquí.</span></p>
      </div>

      @if (!simples().length) {
        <div class="glass r-2xl empty">
          <div>
            <div class="ei"><lucide-icon name="workflow" [size]="28" /></div>
            <p class="sm b">Aún no hay procesos nuevos</p>
            <p class="xs muted" style="max-width:420px;margin:4px auto 12px">Crea uno con el asistente: un nombre, cómo se reconoce, qué tiene que cumplir para salir solo, a dónde va y una prueba con un correo de verdad.</p>
            <button type="button" class="btn primary" (click)="abrir(null, 0)"><lucide-icon name="plus" [size]="14" /> Nuevo proceso</button>
          </div>
        </div>
      } @else {
        @for (f of secciones().familias; track f.nombre) {
          <section class="stack" style="gap:8px">
            <div class="row between">
              <button type="button" class="row on-wall" style="gap:8px;border:0;background:none;padding:0;cursor:pointer;color:inherit;font:inherit"
                (click)="alternarFamilia(f.nombre)" [attr.aria-expanded]="!plegadas().has(f.nombre)">
                <lucide-icon [name]="plegadas().has(f.nombre) ? 'chevron-right' : 'chevron-down'" [size]="16" />
                <lucide-icon name="layers" [size]="15" />
                <span class="sm bb">{{ f.nombre }}</span>
                <span class="badge b-slate">{{ f.procesos.length }} proceso{{ f.procesos.length === 1 ? '' : 's' }}</span>
              </button>
              <button type="button" class="btn outline sm glass" (click)="abrir(null, 0, f.nombre)"><lucide-icon name="plus" [size]="13" /> Nuevo en {{ f.nombre }}</button>
            </div>
            @if (!plegadas().has(f.nombre)) {
              <div class="stack" style="gap:8px;padding-left:14px;border-left:2px solid color-mix(in srgb, var(--primary) 35%, transparent)">
                @for (p of f.procesos; track p.id) { <ng-container *ngTemplateOutlet="ficha; context: { $implicit: p }" /> }
              </div>
            }
          </section>
        }
        @if (secciones().sueltos.length) {
          @if (secciones().familias.length) { <p class="sm b on-wall">Sin familia</p> }
          @for (p of secciones().sueltos; track p.id) { <ng-container *ngTemplateOutlet="ficha; context: { $implicit: p }" /> }
        }
      }
    }

    <ng-template #ficha let-p>
        <article class="glass r-2xl stack" style="padding:14px;gap:8px" [style.opacity]="p.activo ? 1 : 0.6">
          <div class="row" style="flex-wrap:nowrap;gap:10px;align-items:flex-start">
            <span style="width:5px;height:30px;border-radius:999px;flex:none" [style.background]="p.color || 'var(--primary)'"></span>
            <div style="flex:1;min-width:0">
              <p class="sm bb">{{ p.nombre }}
                @for (e of etiquetasDe(p); track e) { <span class="key">{{ e }}</span> }
                @if (!p.activo) { <span class="badge b-slate">Desactivado</span> }
                @if (probados().has(p.clave)) { <span class="badge b-emerald"><lucide-icon name="check" [size]="12" /> Probado</span> }
              </p>
              <p class="xs muted trunc">{{ reconoce(p) }}</p>
            </div>
            <div class="row" style="gap:4px;flex-wrap:nowrap">
              <button type="button" class="btn outline sm" (click)="abrir(p, 4)"><lucide-icon name="play" [size]="13" /> Probar</button>
              <button type="button" class="btn outline sm" (click)="abrir(p, 0)"><lucide-icon name="pencil" [size]="13" /> Editar</button>
            </div>
          </div>
          <div class="stack" style="gap:2px">
            @for (c of casillasDe(p); track $index) {
              <p class="xs">☑ {{ c }}</p>
            } @empty {
              <p class="xs muted">Sin casillas: sale solo cuando la IA está segura.</p>
            }
          </div>
          <p class="xxs muted"><lucide-icon name="send" [size]="12" /> {{ destinoDe(p) }}</p>
        </article>
    </ng-template>
  `,
})
export class ProcesosSimplesTabComponent implements OnInit {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  /** La versión publicada cambió. */
  readonly buzonActualizado = output<Buzon>();

  protected readonly cargando = signal(true);
  protected readonly procesos = signal<Proceso[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly grupos = signal<Grupo[]>([]);
  protected readonly est = signal<EstadoReglas | null>(null);
  protected readonly publicando = signal(false);
  protected readonly abierto = signal<{ proceso: Proceso | null; paso: number; familia: string } | null>(null);
  /** Familias plegadas en la lista. */
  protected readonly plegadas = signal<Set<string>>(new Set());
  /** Procesos probados en esta sesión (el backend no lo guarda). */
  protected readonly probados = signal<Set<string>>(new Set());

  protected readonly simples = computed(() => this.procesos().filter((p) => p.modo === 'simple'));
  /** Familias (sin importar mayúsculas, con la primera ortografía que aparezca) y los procesos sin familia. */
  protected readonly secciones = computed(() => {
    const familias = new Map<string, { nombre: string; procesos: Proceso[] }>();
    const sueltos: Proceso[] = [];
    for (const p of this.simples()) {
      const f = (p.familia ?? '').trim();
      if (!f) {
        sueltos.push(p);
        continue;
      }
      const k = f.toLowerCase();
      if (!familias.has(k)) familias.set(k, { nombre: f, procesos: [] });
      familias.get(k)!.procesos.push(p);
    }
    return { familias: [...familias.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), sueltos };
  });
  protected readonly siguiente = computed(() => this.est()?.siguiente ?? (this.buzon().version_reglas ?? 0) + 1);

  ngOnInit(): void {
    void this.recargar().finally(() => this.cargando.set(false));
  }

  protected async recargar(): Promise<void> {
    const id = this.buzon().id;
    try {
      const [procesos, categorias, grupos, est] = await Promise.all([
        this.api.listarProcesos(id),
        this.api.listarCategorias(id),
        this.buzon().mod_asignacion ? this.api.listarGrupos(id) : Promise.resolve([]),
        this.api.estadoReglas(id),
      ]);
      this.procesos.set(procesos);
      this.categorias.set(categorias);
      this.grupos.set(grupos);
      this.est.set(est);
      // El asistente abierto sigue con el proceso al día (p. ej. después de crearlo).
      const a = this.abierto();
      if (a?.proceso) this.abierto.set({ ...a, proceso: procesos.find((p) => p.id === a.proceso!.id) ?? a.proceso });
    } catch (e) {
      this.toast.error('No se pudieron cargar los procesos', e instanceof Error ? e.message : String(e));
    }
  }

  protected abrir(p: Proceso | null, paso: number, familia = ''): void {
    this.abierto.set({ proceso: p, paso, familia });
  }

  protected alternarFamilia(nombre: string): void {
    this.plegadas.update((s) => {
      const n = new Set(s);
      if (n.has(nombre)) n.delete(nombre);
      else n.add(nombre);
      return n;
    });
  }

  protected marcarProbado(clave: string): void {
    this.probados.update((s) => new Set(s).add(clave));
  }

  protected cerrar(): void {
    this.abierto.set(null);
    void this.recargar();
  }

  protected async alPublicar(): Promise<void> {
    await this.recargar();
    this.buzonActualizado.emit(await this.api.obtenerBuzon(this.buzon().id));
  }

  protected etiquetasDe(p: Proceso): string[] {
    return this.categorias().filter((c) => c.proceso_id === p.id && c.activa).map((c) => c.clave);
  }

  protected reconoce(p: Proceso): string {
    return primerParrafo(p.reglas ?? '') || 'Sin texto: ábrelo y escribe cómo se reconoce.';
  }

  protected casillasDe(p: Proceso): string[] {
    return (p.revisiones ?? []).filter((r) => r.activa !== false).map((r) => textoCasilla(deRevision(r)));
  }

  protected destinoDe(p: Proceso): string {
    if (!this.buzon().mod_asignacion) return 'Cuando sale solo: queda con su etiqueta en Outlook.';
    const et = this.etiquetasDe(p);
    const g = this.grupos().find((x) => x.etiquetas.some((e) => et.includes(e)));
    return g ? `Cuando sale solo: ${g.nombre} · ${destinoGrupo(g).toLowerCase()}.` : 'Cuando sale solo: queda con su etiqueta (sin grupo de Asignación).';
  }

  protected async publicar(): Promise<void> {
    const n = this.est()?.cambios.length ?? 0;
    if (!confirm(`¿Publicar v${this.siguiente()}? ${n} cambio(s) del borrador, de procesos nuevos y de antes: desde ya Nova clasifica los correos nuevos con estas reglas.`)) return;
    this.publicando.set(true);
    try {
      const r = await this.api.publicarReglas(this.buzon().id);
      await this.alPublicar();
      this.toast.show(`Reglas v${r.version} publicadas`);
    } catch (e) {
      this.toast.error('No se pudieron publicar las reglas', e instanceof Error ? e.message : String(e));
    } finally {
      this.publicando.set(false);
    }
  }
}
