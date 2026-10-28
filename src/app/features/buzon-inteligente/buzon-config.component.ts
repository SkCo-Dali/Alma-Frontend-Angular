// Configuración de UN buzón — réplica de `vConfig` del prototipo validado
// (contexto-recaudos-pac/buzon-inteligente-v2.html): encabezado con el estado del
// buzón, pestañas Reglas · Asignación · Exportación · Ajustes (Asignación y
// Exportación solo si su módulo está activo) y «Activar módulo». Solo el editor del
// buzón o el administrador de la App (`puede_administrar`); el revisor no entra.

import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { AjustesTabComponent } from './ajustes-tab.component';
import { AsignacionTabComponent } from './asignacion-tab.component';
import { Buzon, BuzonApi, Categoria, PERM_VER_BUZON } from './buzon.api';
import { DemoBadgeComponent } from './demo-badge.component';
import { ExportacionTabComponent } from './exportacion-tab.component';
import { ReglasTabComponent } from './reglas-tab.component';

type Tab = 'reglas' | 'asig' | 'plant' | 'ajustes';
type Modulo = 'mod_asignacion' | 'mod_bases' | 'mod_exportacion';

/** Degradado del ícono del buzón: personal (azul) o genérico (violeta). */
export function gradienteBuzon(b: Pick<Buzon, 'tipo_cuenta'>): string {
  return b.tipo_cuenta === 'per' ? 'linear-gradient(150deg,#02B1FF,#0062B8)' : 'linear-gradient(150deg,#BF5AF2,#6D4AE0)';
}

@Component({
  selector: 'alma-buzon-config',
  imports: [
    RouterLink,
    LucideAngularModule,
    AccessDeniedComponent,
    AlmaLoaderComponent,
    DemoBadgeComponent,
    ReglasTabComponent,
    AsignacionTabComponent,
    ExportacionTabComponent,
    AjustesTabComponent,
  ],
  styleUrls: ['./buzon-proto.css'],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else if (cargando()) {
      <div style="display:flex;justify-content:center;padding:96px 0"><alma-loader [size]="80" label="Cargando buzón…" /></div>
    } @else if (!buzon()) {
      <div class="page" style="max-width:460px;text-align:center;justify-items:center">
        <lucide-icon name="alert-triangle" [size]="28" style="color:var(--rose)" />
        <p class="sm b">No se pudo abrir el buzón</p>
        <p class="xs muted">{{ errorCarga() || 'No existe o no tienes acceso a él.' }}</p>
        <a routerLink="/apps/buzon-inteligente" class="btn outline"><lucide-icon name="arrow-left" [size]="16" /> Volver al inicio</a>
      </div>
    } @else if (!buzon()!.puede_administrar) {
      <!-- El revisor no configura: solo bandeja y métricas. -->
      <alma-access-denied />
    } @else if (buzon(); as b) {
      <div class="page">
        <div class="ph">
          <div class="l">
            <a routerLink="/apps/buzon-inteligente/buzones" class="back glass"><lucide-icon name="arrow-left" [size]="16" /> Buzones</a>
            <div class="appicon" [style.background]="gradiente()"><lucide-icon name="mail" [size]="20" /></div>
            <div style="min-width:0">
              <h1 class="on-wall"><span class="mono" style="font-size:1.25rem">{{ b.nombre }}</span></h1>
              <p class="on-wall sm" style="color:color-mix(in srgb,var(--foreground) 80%,transparent)">{{ b.descripcion || b.area || 'Sin descripción' }} · {{ b.direccion }}</p>
            </div>
          </div>
          <div class="row">
            <alma-demo-badge />
            @if (b.en_configuracion) {
              <span class="badge b-amber"><lucide-icon name="settings-2" [size]="13" /> En configuración</span>
            } @else if (!b.activo) {
              <span class="badge b-slate"><lucide-icon name="pause" [size]="13" /> Pausado</span>
            } @else {
              <span class="badge b-emerald"><lucide-icon name="plug-zap" [size]="13" /> Activo · {{ modulosActivos() }}</span>
            }
          </div>
        </div>

        <div class="row between">
          <div class="tabsbar glass" role="tablist" aria-label="Configuración del buzón">
            @for (t of tabs(); track t.id) {
              <button type="button" role="tab" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)">
                <lucide-icon [name]="t.icon" [size]="13" /> {{ t.nombre }}
              </button>
            }
          </div>
          @if (!b.mod_asignacion || !b.mod_bases || !b.mod_exportacion) {
            <button type="button" class="btn outline glass" (click)="modulosAbierto.set(true)"><lucide-icon name="plus" [size]="13" /> Activar módulo</button>
          }
        </div>

        @switch (tabVisible()) {
          @case ('reglas') { <alma-reglas-tab [buzon]="b" (buzonActualizado)="buzon.set($event)" /> }
          @case ('asig') { <alma-asignacion-tab [buzon]="b" [categorias]="categorias()" (irAModulos)="tab.set('ajustes')" (activarModulo)="activar($event)" /> }
          @case ('plant') { <alma-exportacion-tab [buzon]="b" [categorias]="categorias()" (buzonActualizado)="buzon.set($event)" (irAModulos)="tab.set('ajustes')" /> }
          @case ('ajustes') { <alma-ajustes-tab [buzon]="b" (buzonActualizado)="buzon.set($event)" (reconectar)="conectar()" /> }
        }
      </div>

      @if (modulosAbierto()) {
        <div class="scrim" (click)="$event.target === $event.currentTarget && modulosAbierto.set(false)">
          <div class="modal solid" role="dialog" aria-modal="true" aria-label="Activar módulo">
            <div class="row between">
              <div><h2 class="sm b">Activar módulo</h2><p class="xs muted">Cada módulo agrega su pestaña al buzón. Desactivarlo conserva su configuración.</p></div>
              <button type="button" class="btn ghost" (click)="modulosAbierto.set(false)" aria-label="Cerrar"><lucide-icon name="x" [size]="16" /></button>
            </div>
            <div class="g3">
              @for (m of tarjetasModulos(); track m.id) {
                <div class="optcard" style="cursor:default">
                  <span class="row sm b"><lucide-icon [name]="m.icon" [size]="13" /> {{ m.titulo }}</span>
                  <span class="xs muted">{{ m.desc }}</span>
                  @if (b[m.id]) {
                    <span class="badge b-emerald" style="justify-self:start">Activo</span>
                  } @else if (m.requiere) {
                    <span class="xxs" style="color:var(--amber)">{{ m.requiere }}</span>
                    <button type="button" class="btn outline sm" style="justify-self:start" (click)="m.id === 'mod_bases' ? activar('mod_asignacion') : irAReglas()">{{ m.id === 'mod_bases' ? 'Activar asignación' : 'Ir a Reglas' }}</button>
                  } @else {
                    <button type="button" class="btn primary sm" style="justify-self:start" (click)="activar(m.id)">Activar</button>
                  }
                </div>
              }
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

  protected readonly puedeVer = computed(() => this.auth.hasPermission(PERM_VER_BUZON));
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly buzon = signal<Buzon | null>(null);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly modulosAbierto = signal(false);
  protected readonly tab = signal<Tab>(this.tabInicial());

  protected readonly gradiente = computed(() => gradienteBuzon(this.buzon()!));
  protected readonly modulosActivos = computed(() => {
    const b = this.buzon()!;
    return ['Reglas', ...(b.mod_asignacion ? ['Asignación'] : []), ...(b.mod_exportacion ? ['Exportación'] : [])].join(' · ');
  });
  protected readonly tabs = computed(() => {
    const b = this.buzon();
    return [
      { id: 'reglas' as Tab, nombre: 'Reglas', icon: 'scroll-text' },
      ...(b?.mod_asignacion ? [{ id: 'asig' as Tab, nombre: 'Asignación', icon: 'user-check' }] : []),
      ...(b?.mod_exportacion ? [{ id: 'plant' as Tab, nombre: 'Exportación', icon: 'file-spreadsheet' }] : []),
      { id: 'ajustes' as Tab, nombre: 'Ajustes', icon: 'sliders-horizontal' },
    ];
  });
  /** Si el módulo de la pestaña elegida se apaga, vuelve a Reglas. */
  protected readonly tabVisible = computed(() => (this.tabs().some((t) => t.id === this.tab()) ? this.tab() : 'reglas'));
  protected readonly tarjetasModulos = computed(() => {
    const b = this.buzon()!;
    const publicado = !!b.version_reglas;
    return [
      { id: 'mod_asignacion' as Modulo, icon: 'users', titulo: 'Asignación', desc: 'Grupos de etiquetas, equipo y round-robin entre los activos.', requiere: publicado ? '' : 'Publica las reglas primero: los grupos se arman con sus etiquetas.' },
      { id: 'mod_bases' as Modulo, icon: 'database', titulo: 'Búsqueda en bases', desc: 'Responsable fijo según una base de Excel (subida o en SharePoint).', requiere: b.mod_asignacion ? '' : 'Activa primero la asignación.' },
      { id: 'mod_exportacion' as Modulo, icon: 'file-spreadsheet', titulo: 'Exportación', desc: 'Archivo por proceso: tabla según el JSON o plantilla propia.', requiere: publicado ? '' : 'Publica las reglas primero.' },
    ];
  });

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  constructor() {
    void this.cargar();
  }

  private tabInicial(): Tab {
    const t = inject(ActivatedRoute).snapshot.queryParamMap.get('tab');
    return t === 'asig' || t === 'plant' || t === 'ajustes' ? t : 'reglas';
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [b, cats] = await Promise.all([this.api.obtenerBuzon(this.id), this.api.listarCategorias(this.id)]);
      this.buzon.set(b);
      this.categorias.set([...cats].sort((x, y) => x.orden - y.orden));
    } catch (e) {
      this.errorCarga.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected irAReglas(): void {
    this.modulosAbierto.set(false);
    this.tab.set('reglas');
  }

  protected async activar(m: Modulo): Promise<void> {
    try {
      const b = await this.api.actualizarBuzon(this.id, { [m]: true });
      this.buzon.set(b);
      this.categorias.set((await this.api.listarCategorias(this.id)).sort((x, y) => x.orden - y.orden));
      this.modulosAbierto.set(false);
      this.tab.set(m === 'mod_exportacion' ? 'plant' : 'asig');
      this.toast.show(
        { mod_asignacion: 'Asignación activada: arma los grupos y el equipo', mod_bases: 'Búsqueda en bases activada: agrégala en Reglas por grupo', mod_exportacion: 'Exportación activada' }[m],
      );
    } catch (e) {
      this.toast.error('No se pudo activar el módulo', e instanceof Error ? e.message : String(e));
    }
  }

  /** Inicio de sesión de Microsoft con la cuenta del administrador (acceso delegado al buzón). */
  protected async conectar(): Promise<void> {
    const b = this.buzon();
    if (!b) return;
    try {
      const c = await this.api.conexion(b.id);
      if (!c.configurado) {
        this.toast.error('Correo no configurado', 'El ambiente no tiene credenciales de Microsoft Graph.');
        return;
      }
      if (this.api.modoDemo()) {
        this.toast.show('Modo demostración', 'Aquí se abriría el inicio de sesión de Microsoft con tu cuenta.');
        return;
      }
      window.location.assign(this.api.urlConectar(c.correo_buzon_id ?? b.correo_buzon_id, c.scopes, `/apps/buzon-inteligente/buzones/${b.id}?tab=ajustes`, b.tipo_cuenta === 'per' ? b.direccion : undefined));
    } catch (e) {
      this.toast.error('No se pudo iniciar la conexión', e instanceof Error ? e.message : String(e));
    }
  }
}
