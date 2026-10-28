// Buzones del Buzón Inteligente — réplica de `vBuzones` del prototipo validado
// (contexto-recaudos-pac/buzon-inteligente-v2.html): buscador y una tarjeta por buzón
// con su estado, En Validar / Ejecutados hoy / Procesos, tipo de cuenta, carpeta
// vigilada, clasificador y versión, miembros y «Configurar». «Nuevo buzón» abre el
// asistente de 6 pasos (nuevo-buzon.component). Roles (058):
//  · Administrador de la App: crea, conecta, desconecta, elimina y da accesos (miembros).
//  · Editor del buzón: lo configura y sincroniza, pero no lo conecta ni lo elimina.
//  · Revisor: no entra aquí (solo bandeja y métricas).

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { Buzon, BuzonApi, PERM_ADMIN_BUZON, PERM_VER_BUZON, RolMiembro } from './buzon.api';
import { gradienteBuzon } from './buzon-config.component';
import { DemoBadgeComponent } from './demo-badge.component';
import { NuevoBuzonComponent } from './nuevo-buzon.component';

const ROLES: { id: RolMiembro; nombre: string; ayuda: string }[] = [
  { id: 'editor', nombre: 'Editor', ayuda: 'Configura el buzón (procesos, reglas, asignación y ajustes) y trabaja la bandeja.' },
  { id: 'revisor', nombre: 'Revisor', ayuda: 'Solo la bandeja y las métricas: aprueba, corrige, reclasifica o ignora correos.' },
];

interface MiembroForm {
  email: string;
  name: string | null;
  rol: RolMiembro;
}

@Component({
  selector: 'alma-buzones-page',
  imports: [FormsModule, RouterLink, LucideAngularModule, AccessDeniedComponent, AlmaLoaderComponent, DemoBadgeComponent, NuevoBuzonComponent],
  styleUrls: ['./buzon-proto.css'],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else if (!cargando() && !puedeEntrar()) {
      <alma-access-denied />
    } @else {
      <div class="page">
        <div class="ph">
          <div class="l">
            <a routerLink="/apps/buzon-inteligente" class="back glass"><lucide-icon name="arrow-left" [size]="16" /> Buzón Inteligente</a>
            <div style="min-width:0">
              <h1 class="on-wall">Buzones</h1>
              <p class="on-wall sm" style="color:color-mix(in srgb,var(--foreground) 80%,transparent)">Un buzón por área o persona, con sus reglas y los módulos que cada uno active.</p>
            </div>
          </div>
          <div class="row">
            <alma-demo-badge />
            @if (esAdmin()) {
              <button type="button" class="btn primary" (click)="asistente.set({ id: null })"><lucide-icon name="plus" [size]="16" /> Nuevo buzón</button>
            }
          </div>
        </div>

        <label class="glass search" for="qb">
          <lucide-icon name="search" [size]="16" class="muted" />
          <input id="qb" type="search" placeholder="Buscar buzón por nombre, correo o descripción…" [ngModel]="q()" (ngModelChange)="q.set($event)" />
          <span class="xs muted">{{ visibles().length }} de {{ editables().length }}</span>
        </label>

        @if (cargando()) {
          <div style="display:flex;justify-content:center;padding:64px 0"><alma-loader [size]="72" label="Cargando buzones…" /></div>
        } @else if (visibles().length) {
          <div class="g2">
            @for (b of visibles(); track b.id) {
              <article class="glass r-3xl stack" style="padding:20px;gap:16px">
                <div class="row between" style="align-items:flex-start;flex-wrap:nowrap">
                  <div class="row" style="flex-wrap:nowrap;min-width:0">
                    <div class="appicon" [style.background]="gradiente(b)"><lucide-icon [name]="b.tipo_cuenta === 'per' ? 'user' : 'mail'" [size]="20" /></div>
                    <div style="min-width:0">
                      <h2 class="trunc bb mono" style="font-size:.92rem">{{ b.nombre }}</h2>
                      <p class="trunc xs" [title]="b.descripcion || b.area || ''">{{ b.descripcion || b.area || 'Sin descripción' }}</p>
                      <p class="trunc xxs muted mono">{{ b.direccion }}</p>
                    </div>
                  </div>
                  @if (b.en_configuracion) {
                    <span class="badge b-amber"><lucide-icon name="settings-2" [size]="13" /> En configuración</span>
                  } @else if (b.estado_conexion === 'requiere_reconexion') {
                    <span class="badge b-rose"><lucide-icon name="alert-triangle" [size]="13" /> Reconectar</span>
                  } @else if (b.estado_conexion !== 'conectada') {
                    <span class="badge b-amber"><lucide-icon name="plug" [size]="13" /> Sin conectar</span>
                  } @else if (!b.activo) {
                    <span class="badge b-slate"><lucide-icon name="pause" [size]="13" /> Pausado</span>
                  } @else {
                    <span class="badge b-emerald"><lucide-icon name="plug-zap" [size]="13" /> Activo · {{ modulos(b) }}</span>
                  }
                </div>
                <div class="g3" style="gap:8px">
                  <div class="stat"><p class="l">En Validar</p><p class="v" style="color:var(--amber)">{{ b.en_revision }}</p></div>
                  <div class="stat"><p class="l">Ejecutados hoy</p><p class="v" style="color:var(--emerald)">{{ b.ejecutados_hoy }}</p></div>
                  <div class="stat"><p class="l">Procesos</p><p class="v">{{ b.procesos_count }}</p></div>
                </div>
                <div class="row xs muted">
                  <span class="chipo"><lucide-icon [name]="b.tipo_cuenta === 'per' ? 'user' : 'users'" [size]="13" /> {{ b.tipo_cuenta === 'per' ? 'Cuenta personal' : 'Cuenta genérica' }}</span>
                  <span class="chipo"><lucide-icon name="folder-open" [size]="13" /> {{ carpeta(b.carpeta_vigilada) }}</span>
                  <span class="chipo"><lucide-icon [name]="b.modo_clasificacion === 'agente' ? 'bot' : 'scroll-text'" [size]="13" /> {{ clasificador(b) }} · {{ b.version_reglas ? 'v' + b.version_reglas : '—' }}</span>
                </div>
                <div class="row between" style="border-top:1px solid var(--border);padding-top:12px">
                  <button type="button" class="row" style="gap:0;padding-left:6px;border:0;background:none;cursor:pointer" [disabled]="!b.puede_conectar"
                    (click)="abrirMiembros(b)" [attr.aria-label]="'Miembros de ' + b.nombre" [title]="b.puede_conectar ? 'Quién trabaja en este buzón' : ''">
                    @for (m of b.miembros.slice(0, 5); track m.user_id) {
                      <span class="avatar s" style="margin-left:-6px;border:2px solid var(--card)" [title]="(m.name || m.email) + ' · ' + nombreRol(m.rol)">{{ iniciales(m.name || m.email) }}</span>
                    } @empty {
                      <span class="xs muted" style="margin-left:-6px">Sin miembros</span>
                    }
                    @if (b.puede_conectar) { <lucide-icon name="user-plus" [size]="13" class="muted" style="margin-left:6px" /> }
                  </button>
                  <div class="row">
                    @if (b.puede_conectar && !b.en_configuracion) {
                      @if (b.estado_conexion !== 'conectada') {
                        <button type="button" class="btn outline sm" [disabled]="trabajando() === b.id" (click)="conectar(b)"><lucide-icon name="log-in" [size]="13" /> Conectar</button>
                      } @else if (!b.activo) {
                        <button type="button" class="btn outline sm" [disabled]="trabajando() === b.id" (click)="reanudar(b)"><lucide-icon name="play" [size]="13" /> Reanudar</button>
                      }
                    }
                    @if (b.activo && b.estado_conexion === 'conectada' && !b.en_configuracion) {
                      <button type="button" class="btn ghost" [disabled]="sincronizando() === b.id" (click)="sincronizar(b)" [attr.aria-label]="'Sincronizar ' + b.nombre" title="Sincronizar ahora">
                        <lucide-icon name="refresh-cw" [size]="16" />
                      </button>
                    }
                    @if (b.puede_conectar) {
                      @if (b.activo && b.estado_conexion === 'conectada') {
                        <button type="button" class="btn ghost" (click)="confirmacion.set({ accion: 'desconectar', buzon: b })" [attr.aria-label]="'Desconectar ' + b.nombre" title="Desconectar"><lucide-icon name="unplug" [size]="16" /></button>
                      }
                      <button type="button" class="btn ghost danger" (click)="confirmacion.set({ accion: 'eliminar', buzon: b })" [attr.aria-label]="'Eliminar ' + b.nombre" title="Quitar de la App"><lucide-icon name="trash-2" [size]="16" /></button>
                    }
                    <button type="button" class="btn primary sm" (click)="configurar(b)">
                      <lucide-icon name="sliders-horizontal" [size]="13" /> {{ b.en_configuracion ? 'Continuar configuración' : 'Configurar' }}
                    </button>
                  </div>
                </div>
              </article>
            }
          </div>
        } @else {
          <div class="glass r-3xl empty">
            <div>
              @if (editables().length) {
                <p class="sm b">No hay buzones que coincidan</p>
                <p class="xs muted">Prueba con otra parte del nombre o del correo.</p>
              } @else {
                <p class="sm b">Aún no hay buzones</p>
                <p class="xs muted">Crea el buzón del área con «Nuevo buzón»: lo conectas, describes sus reglas y activas lo que necesites.</p>
              }
            </div>
          </div>
        }
      </div>

      @if (asistente(); as a) {
        <alma-nuevo-buzon [reanudar]="a.id" (cerrado)="cerrarAsistente()" />
      }

      @if (confirmacion(); as c) {
        <div class="scrim" (click)="$event.target === $event.currentTarget && !trabajando() && confirmacion.set(null)">
          <div class="modal solid sm" role="dialog" aria-modal="true" [attr.aria-label]="c.accion === 'desconectar' ? 'Desconectar buzón' : 'Eliminar buzón'">
            <div class="row between">
              <h2 class="sm b">{{ c.accion === 'desconectar' ? '¿Desconectar ' + c.buzon.nombre + '?' : '¿Quitar ' + c.buzon.nombre + ' de la App?' }}</h2>
              <button type="button" class="btn ghost" (click)="confirmacion.set(null)" aria-label="Cerrar"><lucide-icon name="x" [size]="16" /></button>
            </div>
            <p class="xs muted">
              @if (c.accion === 'desconectar') {
                Alma deja de leer {{ c.buzon.direccion }} y borra la conexión. Reglas, equipo e historial se conservan; se reanuda conectándolo de nuevo.
              } @else {
                Deja de verse y de leerse. Reglas, miembros e historial se conservan como auditoría: registrar de nuevo la misma dirección lo restaura.
              }
            </p>
            <div class="row" style="justify-content:flex-end">
              <button type="button" class="btn outline" [disabled]="!!trabajando()" (click)="confirmacion.set(null)">Cancelar</button>
              <button type="button" class="btn primary" [class.danger]="c.accion === 'eliminar'" [disabled]="!!trabajando()" (click)="confirmar()">
                {{ trabajando() ? 'Procesando…' : c.accion === 'desconectar' ? 'Desconectar' : 'Quitar de la App' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (miembrosDe(); as b) {
        <div class="scrim" (click)="$event.target === $event.currentTarget && cerrarMiembros()">
          <div class="modal solid" role="dialog" aria-modal="true" aria-label="Miembros del buzón">
            <div class="row between">
              <div><h2 class="sm b">Quién trabaja en {{ b.nombre }}</h2><p class="xs muted">El editor configura el buzón y trabaja la bandeja; el revisor solo trabaja la bandeja.</p></div>
              <button type="button" class="btn ghost" (click)="cerrarMiembros()" aria-label="Cerrar"><lucide-icon name="x" [size]="16" /></button>
            </div>
            <div class="row" style="flex-wrap:nowrap">
              <input class="input" [(ngModel)]="nuevoEmail" (keydown.enter)="agregarMiembro()" placeholder="correo@skandia.com.co" aria-label="Correo" />
              <select class="input" style="width:auto" [(ngModel)]="nuevoRol" aria-label="Rol">
                @for (r of roles; track r.id) { <option [value]="r.id">{{ r.nombre }}</option> }
              </select>
              <button type="button" class="btn primary sm" (click)="agregarMiembro()"><lucide-icon name="user-plus" [size]="13" /> Agregar</button>
            </div>
            @if (errorMiembros()) { <p class="err">{{ errorMiembros() }}</p> }
            <div class="stack" style="gap:6px">
              @for (m of miembrosForm(); track m.email; let i = $index) {
                <div class="row between sunk r-xl" style="padding:8px 12px;flex-wrap:nowrap">
                  <div class="row" style="flex-wrap:nowrap;min-width:0">
                    <span class="avatar s">{{ iniciales(m.name || m.email) }}</span>
                    <div style="min-width:0"><p class="sm b trunc">{{ m.name || m.email }}</p><p class="xxs muted trunc">{{ m.email }}</p></div>
                  </div>
                  <div class="row" style="flex-wrap:nowrap">
                    <select class="input sm" style="width:auto" [ngModel]="m.rol" (ngModelChange)="cambiarRol(i, $event)" [attr.aria-label]="'Rol de ' + m.email">
                      @for (r of roles; track r.id) { <option [value]="r.id">{{ r.nombre }}</option> }
                    </select>
                    <button type="button" class="btn ghost danger" (click)="quitarMiembro(i)" [attr.aria-label]="'Quitar ' + m.email"><lucide-icon name="x" [size]="13" /></button>
                  </div>
                </div>
              } @empty {
                <p class="xs muted">Solo el administrador ve este buzón. Agrega a quienes lo van a trabajar.</p>
              }
            </div>
            <div class="row" style="justify-content:flex-end">
              <button type="button" class="btn outline" [disabled]="guardandoMiembros()" (click)="cerrarMiembros()">Cancelar</button>
              <button type="button" class="btn primary" [disabled]="guardandoMiembros()" (click)="guardarMiembros(b)"><lucide-icon name="save" [size]="16" /> Guardar</button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class BuzonesPageComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly roles = ROLES;
  protected readonly puedeVer = computed(() => this.auth.hasPermission(PERM_VER_BUZON));

  protected readonly buzones = signal<Buzon[]>([]);
  protected readonly cargando = signal(true);
  protected readonly sincronizando = signal<string | null>(null);
  protected readonly q = signal('');

  /** Administrador de la App: crea, conecta, desconecta, elimina y da accesos. */
  protected readonly esAdmin = computed(() => this.auth.hasPermission(PERM_ADMIN_BUZON) || this.buzones().some((b) => b.puede_conectar));
  /** Solo los buzones que el usuario configura (admin: todos; editor: los suyos). */
  protected readonly editables = computed(() => this.buzones().filter((b) => b.puede_administrar));
  /** El revisor no entra a «Buzones». */
  protected readonly puedeEntrar = computed(() => this.esAdmin() || this.editables().length > 0);
  protected readonly visibles = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.editables().filter((b) => !q || `${b.nombre} ${b.descripcion ?? ''} ${b.area ?? ''} ${b.direccion}`.toLowerCase().includes(q));
  });

  /** Asistente «Nuevo buzón» abierto: id = buzón que se retoma (al volver de Microsoft). */
  protected readonly asistente = signal<{ id: string | null } | null>(null);
  protected readonly trabajando = signal<string | null>(null);
  protected readonly confirmacion = signal<{ accion: 'desconectar' | 'eliminar'; buzon: Buzon } | null>(null);

  // Miembros
  protected readonly miembrosDe = signal<Buzon | null>(null);
  protected readonly miembrosForm = signal<MiembroForm[]>([]);
  protected readonly guardandoMiembros = signal(false);
  protected readonly errorMiembros = signal<string | null>(null);
  protected nuevoEmail = '';
  protected nuevoRol: RolMiembro = 'revisor';

  constructor() {
    // Al volver del inicio de sesión de Microsoft el asistente sigue donde iba.
    const reanudar = this.route.snapshot.queryParamMap.get('asistente');
    if (reanudar) this.asistente.set({ id: reanudar });
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.buzones.set(await this.api.listarBuzones());
    } catch (e) {
      this.toast.error('No se pudieron cargar los buzones', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected gradiente(b: Buzon): string {
    return gradienteBuzon(b);
  }

  protected modulos(b: Buzon): string {
    return ['Reglas', ...(b.mod_asignacion ? ['Asignación'] : []), ...(b.mod_exportacion ? ['Exportación'] : [])].join(' · ');
  }

  protected carpeta(n: string): string {
    return !n || n.toLowerCase() === 'inbox' ? 'Bandeja de entrada' : n;
  }

  protected clasificador(b: Buzon): string {
    if (!b.version_reglas && !b.procesos_count) return 'Sin clasificador';
    return b.modo_clasificacion === 'agente' ? 'Agente Foundry' : 'Prompt de Alma';
  }

  protected nombreRol(r: string): string {
    return ROLES.find((x) => x.id === r)?.nombre ?? r;
  }

  protected iniciales(n: string): string {
    return n
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  /** Un buzón en configuración que aún no se conectó vuelve al asistente; los demás, a su configuración. */
  protected configurar(b: Buzon): void {
    if (b.en_configuracion && b.estado_conexion !== 'conectada') {
      this.asistente.set({ id: b.id });
      return;
    }
    void this.router.navigate(['/apps/buzon-inteligente/buzones', b.id]);
  }

  protected cerrarAsistente(): void {
    this.asistente.set(null);
    if (this.route.snapshot.queryParamMap.has('asistente')) {
      void this.router.navigate([], { queryParams: { asistente: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    void this.cargar();
  }

  protected async sincronizar(b: Buzon): Promise<void> {
    this.sincronizando.set(b.id);
    try {
      const r = await this.api.sincronizar(b.id);
      this.toast.show(
        `Sincronizado ${b.nombre}`,
        `${r.ingresados} nuevos · ${r.ejecutados} ejecutados · ${r.en_revision} por revisar${r.errores ? ` · ${r.errores} con error` : ''}`,
      );
      await this.cargar();
    } catch (e) {
      this.toast.error('No se pudo sincronizar', e instanceof Error ? e.message : String(e));
    } finally {
      this.sincronizando.set(null);
    }
  }

  protected async confirmar(): Promise<void> {
    const c = this.confirmacion();
    if (!c) return;
    this.trabajando.set(c.buzon.id);
    try {
      if (c.accion === 'desconectar') {
        await this.api.desconectarBuzon(c.buzon.id);
        this.toast.show('Buzón desconectado', `${c.buzon.nombre} quedó pausado: Alma ya no lo lee.`);
      } else {
        await this.api.eliminarBuzon(c.buzon.id);
        this.toast.show('Buzón quitado de la App', `${c.buzon.nombre} · ${c.buzon.direccion}`);
      }
      this.confirmacion.set(null);
      await this.cargar();
    } catch (e) {
      this.toast.error(
        c.accion === 'desconectar' ? 'No se pudo desconectar' : 'No se pudo eliminar',
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      this.trabajando.set(null);
    }
  }

  protected async reanudar(b: Buzon): Promise<void> {
    this.trabajando.set(b.id);
    try {
      await this.api.actualizarBuzon(b.id, { activo: true });
      this.toast.show('Buzón reanudado', `Alma vuelve a leer ${b.direccion}.`);
      await this.cargar();
    } catch (e) {
      this.toast.error('No se pudo reanudar', e instanceof Error ? e.message : String(e));
    } finally {
      this.trabajando.set(null);
    }
  }

  protected async conectar(b: Buzon): Promise<void> {
    this.trabajando.set(b.id);
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
      // Con el modo que ya tenía; las genéricas sin conectar, con la cuenta del buzón.
      window.location.assign(this.api.urlConectar(b, c, '/apps/buzon-inteligente/buzones'));
    } catch (e) {
      this.toast.error('No se pudo iniciar la conexión', e instanceof Error ? e.message : String(e));
    } finally {
      this.trabajando.set(null);
    }
  }

  // ── Miembros ──
  protected abrirMiembros(b: Buzon): void {
    if (!b.puede_conectar) return;
    this.miembrosForm.set(b.miembros.map((m) => ({ email: m.email, name: m.name ?? null, rol: m.rol === 'editor' ? 'editor' : 'revisor' })));
    this.nuevoEmail = '';
    this.nuevoRol = 'revisor';
    this.errorMiembros.set(null);
    this.miembrosDe.set(b);
  }

  protected cerrarMiembros(): void {
    if (this.guardandoMiembros()) return;
    this.miembrosDe.set(null);
  }

  protected agregarMiembro(): void {
    const email = this.nuevoEmail.trim().toLowerCase();
    this.errorMiembros.set(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      this.errorMiembros.set('Escribe un correo válido.');
      return;
    }
    if (this.miembrosForm().some((m) => m.email === email)) {
      this.errorMiembros.set(`${email} ya es miembro: cambia su rol en la lista.`);
      return;
    }
    this.miembrosForm.update((l) => [...l, { email, name: null, rol: this.nuevoRol }]);
    this.nuevoEmail = '';
  }

  protected cambiarRol(i: number, rol: RolMiembro): void {
    this.miembrosForm.update((l) => l.map((m, j) => (j === i ? { ...m, rol } : m)));
  }

  protected quitarMiembro(i: number): void {
    this.miembrosForm.update((l) => l.filter((_, j) => j !== i));
  }

  protected async guardarMiembros(b: Buzon): Promise<void> {
    this.guardandoMiembros.set(true);
    this.errorMiembros.set(null);
    try {
      const actualizado = await this.api.guardarMiembros(
        b.id,
        this.miembrosForm().map((m) => ({ email: m.email, rol: m.rol })),
      );
      this.buzones.update((l) => l.map((x) => (x.id === b.id ? actualizado : x)));
      this.toast.show('Miembros guardados', `${b.nombre}: ${actualizado.miembros.length} ${actualizado.miembros.length === 1 ? 'persona' : 'personas'}.`);
      this.miembrosDe.set(null);
    } catch (e) {
      this.errorMiembros.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoMiembros.set(false);
    }
  }
}
