// Buzones del Buzón Inteligente: tarjetas por área con estado de conexión, modo,
// contadores y accesos. Roles (058):
//  · Administrador de la App: crea, conecta, desconecta, elimina y da accesos (miembros).
//  · Editor del buzón: lo configura y sincroniza, pero no lo conecta ni lo elimina.
//  · Revisor: no entra aquí (solo bandeja y métricas).

import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import { Buzon, BuzonApi, BuzonIn, EstadoConexion, PERM_ADMIN_BUZON, PERM_VER_BUZON, RolMiembro } from './buzon.api';
import { DemoBadgeComponent } from './demo-badge.component';

const CONEXION: Record<EstadoConexion, { nombre: string; clase: string; icon: string }> = {
  conectada: { nombre: 'Conectado', clase: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', icon: 'plug-zap' },
  sin_conectar: { nombre: 'Sin conectar', clase: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', icon: 'plug' },
  requiere_reconexion: { nombre: 'Reconectar', clase: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', icon: 'alert-triangle' },
};

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
  imports: [DecimalPipe, FormsModule, RouterLink, LucideAngularModule, AccessDeniedComponent, AlmaLoaderComponent, TooltipDirective, DemoBadgeComponent],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else if (!cargando() && !puedeEntrar()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-6xl space-y-5 px-4 py-4 sm:px-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <a routerLink="/apps/buzon-inteligente" class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary">
              <lucide-icon name="arrow-left" [size]="16" /> Buzón Inteligente
            </a>
            <div>
              <h1 class="text-on-wallpaper text-2xl font-bold tracking-tight text-foreground">Buzones</h1>
              <p class="text-on-wallpaper text-sm text-foreground/80">
                {{ esAdmin() ? 'Todos los buzones de la App. Conecta, configura y define quién trabaja en cada uno.' : 'Los buzones que configuras como editor.' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <alma-demo-badge />
            @if (esAdmin()) {
              <button type="button" class="alma-btn alma-btn-primary rounded-xl" (click)="abrirNuevo()">
                <lucide-icon name="plus" [size]="16" /> Nuevo buzón
              </button>
            }
          </div>
        </div>

        @if (cargando()) {
          <div class="flex justify-center py-16"><alma-loader [size]="72" label="Cargando buzones…" /></div>
        } @else if (editables().length === 0) {
          <div class="glass flex flex-col items-center gap-3 rounded-3xl p-10 text-center">
            <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><lucide-icon name="mail" [size]="26" /></span>
            <p class="text-sm font-semibold text-foreground">Aún no hay buzones</p>
            <p class="max-w-sm text-xs text-muted-foreground">Registra el buzón genérico del área, conéctalo con tu cuenta y agrega a quienes lo van a trabajar.</p>
            @if (esAdmin()) {
              <button type="button" class="alma-btn alma-btn-primary rounded-xl" (click)="abrirNuevo()"><lucide-icon name="plus" [size]="16" /> Nuevo buzón</button>
            }
          </div>
        } @else {
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            @for (b of editables(); track b.id) {
              <article class="glass flex flex-col gap-4 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex min-w-0 items-center gap-3">
                    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style="background:linear-gradient(150deg,#BF5AF2,#6D4AE0)">
                      <lucide-icon name="mail" [size]="20" />
                    </div>
                    <div class="min-w-0">
                      <h2 class="truncate text-base font-bold text-foreground">{{ b.nombre }}</h2>
                      <p class="truncate text-xs text-muted-foreground">{{ b.direccion }} @if (b.area) {· {{ b.area }}}</p>
                    </div>
                  </div>
                  <span [class]="'alma-badge shrink-0 gap-1 ' + conexion[b.estado_conexion].clase">
                    <lucide-icon [name]="conexion[b.estado_conexion].icon" [size]="12" /> {{ conexion[b.estado_conexion].nombre }}
                  </span>
                </div>

                @if (b.estado_conexion === 'conectada' && b.conectada_por) {
                  <p class="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <lucide-icon name="shield-check" [size]="13" class="text-emerald-600" />
                    Conectado por <b class="font-medium text-foreground">{{ b.conectada_por }}</b>{{ b.conexion_compartida ? ' (acceso compartido)' : '' }}
                  </p>
                }

                <div class="grid grid-cols-3 gap-2">
                  <div class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2">
                    <p class="text-[11px] text-muted-foreground">Por revisar</p>
                    <p class="text-lg font-bold tabular-nums" [class.text-amber-600]="b.en_revision > 0">{{ b.en_revision }}</p>
                  </div>
                  <div class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2">
                    <p class="text-[11px] text-muted-foreground">Ejecutados hoy</p>
                    <p class="text-lg font-bold tabular-nums text-emerald-600">{{ b.ejecutados_hoy }}</p>
                  </div>
                  <div class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2">
                    <p class="text-[11px] text-muted-foreground">Tipos de correo</p>
                    <p class="text-lg font-bold tabular-nums">{{ b.categorias_count }}</p>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  @if (!b.activo) {
                    <span class="inline-flex items-center gap-1 rounded-full bg-zinc-500/15 px-2 py-0.5 font-medium text-zinc-700 dark:text-zinc-300" almaTooltip="Alma no lee este buzón hasta que lo reanudes.">
                      <lucide-icon name="power-off" [size]="12" /> Pausado
                    </span>
                  }
                  <span class="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
                    <lucide-icon [name]="b.modo === 'automatico' ? 'zap' : 'user-check'" [size]="12" />
                    {{ b.modo === 'automatico' ? 'Automático' : 'Solo sugiere' }} · umbral {{ (b.umbral_confianza * 100) | number: '1.0-0' }}%
                  </span>
                  <span class="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
                    <lucide-icon name="folder-open" [size]="12" /> {{ b.carpeta_vigilada === 'Inbox' ? 'Bandeja de entrada' : b.carpeta_vigilada }}
                  </span>
                  <span class="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5" [almaTooltip]="b.ultimo_error ?? ''">
                    <lucide-icon name="refresh-cw" [size]="12" />
                    {{ b.ultima_sincronizacion ? 'Leído ' + hace(b.ultima_sincronizacion) : 'Nunca leído' }}
                    @if (b.ultimo_error) { <lucide-icon name="alert-triangle" [size]="12" class="text-rose-500" /> }
                  </span>
                </div>

                <div class="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <button
                    type="button"
                    class="flex items-center gap-2 rounded-lg px-1 py-0.5 text-left disabled:cursor-default"
                    [disabled]="!b.puede_conectar"
                    [attr.aria-label]="b.puede_conectar ? 'Miembros de ' + b.nombre : null"
                    (click)="abrirMiembros(b)"
                  >
                    <span class="flex -space-x-1.5">
                      @for (m of b.miembros.slice(0, 4); track m.email) {
                        <span class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary/15 text-[10px] font-bold text-primary" [almaTooltip]="(m.name || m.email) + ' · ' + nombreRol(m.rol)">{{ iniciales(m.name || m.email) }}</span>
                      }
                    </span>
                    @if (b.miembros.length === 0) {
                      <span class="text-xs text-muted-foreground">Sin miembros: solo lo ven los administradores</span>
                    } @else if (b.miembros.length > 4) {
                      <span class="text-xs text-muted-foreground">+{{ b.miembros.length - 4 }}</span>
                    }
                    @if (b.puede_conectar) { <lucide-icon name="user-plus" [size]="14" class="text-primary" /> }
                  </button>
                  <div class="flex flex-wrap items-center justify-end gap-1.5">
                    @if (b.puede_conectar && b.estado_conexion !== 'conectada') {
                      <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" (click)="pedirConexion(b)">
                        <lucide-icon name="plug" [size]="14" /> Conectar
                      </button>
                    }
                    @if (b.activo) {
                      <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="sincronizando() === b.id" (click)="sincronizar(b)">
                        <lucide-icon name="refresh-cw" [size]="14" [class.animate-spin]="sincronizando() === b.id" /> Sincronizar
                      </button>
                      @if (b.puede_conectar) {
                        <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" (click)="pedirConfirmacion('desconectar', b)">
                          <lucide-icon name="power-off" [size]="14" /> Desconectar
                        </button>
                      }
                    } @else {
                      <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="trabajando() === b.id" (click)="reanudar(b)">
                        <lucide-icon name="power" [size]="14" /> Reanudar
                      </button>
                    }
                    @if (b.puede_conectar) {
                      <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 rounded-lg p-0 text-destructive hover:bg-destructive/10" almaTooltip="Quitar de la App" aria-label="Quitar buzón de la App" (click)="pedirConfirmacion('eliminar', b)">
                        <lucide-icon name="trash-2" [size]="14" />
                      </button>
                    }
                    <a [routerLink]="['/apps/buzon-inteligente/buzones', b.id]" class="alma-btn alma-btn-primary h-8 rounded-lg text-xs">
                      <lucide-icon name="sliders-horizontal" [size]="14" /> Configurar
                    </a>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      </div>

      <!-- Modal nuevo buzón (solo administrador) -->
      @if (formAbierto()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cerrar()">
          <div class="surface-solid w-full max-w-lg rounded-2xl border border-border p-5 shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true" aria-labelledby="nb-titulo" (click)="$event.stopPropagation()">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <h2 id="nb-titulo" class="text-sm font-semibold text-foreground">Nuevo buzón</h2>
                <p class="text-xs text-muted-foreground">La cuenta genérica del área que recibe los correos. Después la conectas y defines sus reglas.</p>
              </div>
              <button type="button" class="alma-btn alma-btn-ghost" aria-label="Cerrar" (click)="cerrar()"><lucide-icon name="x" [size]="16" /></button>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5 sm:col-span-2">
                <label class="alma-label" for="nb-dir">Dirección de correo *</label>
                <input id="nb-dir" class="alma-input" [(ngModel)]="form.direccion" placeholder="area@skandia.com.co" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="alma-label" for="nb-nom">Nombre *</label>
                <input id="nb-nom" class="alma-input" [(ngModel)]="form.nombre" placeholder="Recaudos" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="alma-label" for="nb-area">Área</label>
                <input id="nb-area" class="alma-input" [(ngModel)]="form.area" placeholder="Recaudos Voluntarios" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="alma-label" for="nb-carp">Carpeta vigilada</label>
                <input id="nb-carp" class="alma-input" [(ngModel)]="form.carpeta_vigilada" placeholder="Inbox" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="alma-label" for="nb-modo">Modo</label>
                <select id="nb-modo" class="alma-input" [(ngModel)]="form.modo">
                  <option value="sugerir">Solo sugiere (revisión humana)</option>
                  <option value="automatico">Automático sobre el umbral</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5 sm:col-span-2">
                <label class="alma-label" for="nb-ctx">Contexto del área para la IA</label>
                <textarea id="nb-ctx" class="alma-input min-h-24 py-2" [(ngModel)]="form.contexto" placeholder="Qué hace el área, qué documentos suelen llegar, glosario, NIT, cuentas…"></textarea>
              </div>
            </div>
            @if (errorForm(); as e) { <p class="mt-3 text-xs text-destructive">{{ e }}</p> }
            <div class="mt-5 flex justify-end gap-2">
              <button type="button" class="alma-btn alma-btn-outline" (click)="cerrar()">Cancelar</button>
              <button type="button" class="alma-btn alma-btn-primary" [disabled]="!valido() || guardando()" (click)="guardar()">
                <lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="16" [class.animate-spin]="guardando()" /> Crear buzón
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Conectar: el administrador entra con SU cuenta -->
      @if (conectando(); as b) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="conectando.set(null)">
          <div class="surface-solid w-full max-w-md rounded-2xl border border-border p-5 shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true" aria-labelledby="cx-titulo" (click)="$event.stopPropagation()">
            <div class="flex items-start gap-3">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><lucide-icon name="plug" [size]="20" /></span>
              <div>
                <h2 id="cx-titulo" class="text-sm font-semibold text-foreground">Conecta con tu cuenta</h2>
                <p class="mt-1 text-xs text-muted-foreground">
                  Inicia sesión en Microsoft con <b class="text-foreground">tu propia cuenta</b>: debe tener acceso completo al buzón
                  <b class="text-foreground">{{ b.direccion }}</b>. Alma lee y organiza ese buzón en tu nombre; no necesitas la clave de la cuenta genérica.
                </p>
              </div>
            </div>
            <ul class="mt-3 space-y-1 rounded-xl bg-[var(--surface-sunken)] p-3 text-xs text-muted-foreground">
              <li class="flex gap-1.5"><lucide-icon name="check" [size]="13" class="mt-0.5 shrink-0 text-emerald-600" /> Microsoft te pedirá aceptar los permisos de correo compartido.</li>
              <li class="flex gap-1.5"><lucide-icon name="check" [size]="13" class="mt-0.5 shrink-0 text-emerald-600" /> Si luego pierdes el acceso al buzón, Alma deja de leerlo y te avisa.</li>
            </ul>
            <div class="mt-5 flex justify-end gap-2">
              <button type="button" class="alma-btn alma-btn-outline" (click)="conectando.set(null)">Cancelar</button>
              <button type="button" class="alma-btn alma-btn-primary" [disabled]="trabajando() === b.id" (click)="conectar(b)">
                <lucide-icon [name]="trabajando() === b.id ? 'loader-2' : 'external-link'" [size]="16" [class.animate-spin]="trabajando() === b.id" /> Continuar con Microsoft
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Miembros (solo administrador) -->
      @if (miembrosDe(); as b) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cerrarMiembros()">
          <div class="surface-solid flex max-h-[90dvh] w-full max-w-lg flex-col rounded-2xl border border-border p-5 shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true" aria-labelledby="mb-titulo" (click)="$event.stopPropagation()">
            <div class="mb-3 flex items-center justify-between">
              <div>
                <h2 id="mb-titulo" class="text-sm font-semibold text-foreground">Miembros de {{ b.nombre }}</h2>
                <p class="text-xs text-muted-foreground">Quién trabaja este buzón. Los administradores de la App lo ven siempre.</p>
              </div>
              <button type="button" class="alma-btn alma-btn-ghost" aria-label="Cerrar" (click)="cerrarMiembros()"><lucide-icon name="x" [size]="16" /></button>
            </div>

            <div class="grid gap-1.5 rounded-xl bg-[var(--surface-sunken)] p-3 text-xs">
              @for (r of roles; track r.id) {
                <p><b class="text-foreground">{{ r.nombre }}:</b> <span class="text-muted-foreground">{{ r.ayuda }}</span></p>
              }
            </div>

            <form class="mt-3 flex flex-wrap items-end gap-2" (submit)="$event.preventDefault(); agregarMiembro()">
              <div class="flex min-w-[200px] flex-1 flex-col gap-1">
                <label class="alma-label" for="mb-email">Correo</label>
                <input id="mb-email" name="email" type="email" class="alma-input" [(ngModel)]="nuevoEmail" placeholder="persona@skandia.com.co" autocomplete="off" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="alma-label" for="mb-rol">Rol</label>
                <select id="mb-rol" name="rol" class="alma-input w-32" [(ngModel)]="nuevoRol">
                  @for (r of roles; track r.id) { <option [value]="r.id">{{ r.nombre }}</option> }
                </select>
              </div>
              <button type="submit" class="alma-btn alma-btn-outline" [disabled]="!nuevoEmail.trim()"><lucide-icon name="user-plus" [size]="15" /> Agregar</button>
            </form>
            @if (errorMiembros(); as e) { <p class="mt-2 text-xs text-destructive">{{ e }}</p> }

            <div class="mt-3 min-h-0 flex-1 overflow-auto rounded-xl border border-border/60">
              @for (m of miembrosForm(); track m.email; let i = $index) {
                <div class="flex items-center gap-2 border-b border-border/50 px-3 py-2 last:border-b-0">
                  <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{{ iniciales(m.name || m.email) }}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-foreground">{{ m.name || m.email }}</span>
                    @if (m.name) { <span class="block truncate text-[11px] text-muted-foreground">{{ m.email }}</span> }
                  </span>
                  <select class="alma-input h-8 w-28 text-xs" [attr.aria-label]="'Rol de ' + m.email" [ngModel]="m.rol" (ngModelChange)="cambiarRol(i, $event)">
                    @for (r of roles; track r.id) { <option [value]="r.id">{{ r.nombre }}</option> }
                  </select>
                  <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0 text-destructive" [attr.aria-label]="'Quitar a ' + m.email" (click)="quitarMiembro(i)"><lucide-icon name="x" [size]="15" /></button>
                </div>
              } @empty {
                <p class="p-4 text-center text-xs text-muted-foreground">Sin miembros. Agrega a quienes van a configurar o revisar este buzón.</p>
              }
            </div>
            <p class="mt-2 text-[11px] text-muted-foreground">Quien agregues recibe acceso de entrada a la App si aún no lo tiene.</p>
            <div class="mt-4 flex justify-end gap-2">
              <button type="button" class="alma-btn alma-btn-outline" (click)="cerrarMiembros()">Cancelar</button>
              <button type="button" class="alma-btn alma-btn-primary" [disabled]="guardandoMiembros()" (click)="guardarMiembros(b)">
                <lucide-icon [name]="guardandoMiembros() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardandoMiembros()" /> Guardar miembros
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Confirmar desconectar / eliminar -->
      @if (confirmacion(); as c) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cancelarConfirmacion()">
          <div class="surface-solid w-full max-w-md rounded-2xl border border-border p-5 shadow-[var(--shadow-lg)]" role="alertdialog" aria-modal="true" (click)="$event.stopPropagation()">
            @if (c.accion === 'desconectar') {
              <h2 class="text-sm font-semibold text-foreground">¿Desconectar {{ c.buzon.nombre }}?</h2>
              <p class="mt-2 text-xs text-muted-foreground">
                Alma deja de leer <span class="font-medium text-foreground">{{ c.buzon.direccion }}</span>: se borra la conexión con Microsoft y el buzón queda pausado.
                Se conservan sus reglas, la asignación y el historial de correos. Puedes reanudarlo cuando quieras.
              </p>
            } @else {
              <h2 class="text-sm font-semibold text-foreground">¿Quitar {{ c.buzon.nombre }} de la App?</h2>
              <p class="mt-2 text-xs text-muted-foreground">
                Deja de verse en el Buzón Inteligente y Alma deja de leer <span class="font-medium text-foreground">{{ c.buzon.direccion }}</span>: se borra su conexión con Microsoft.
                No se toca ningún correo en Outlook.
              </p>
              <p class="mt-2 text-xs text-muted-foreground">
                Sus reglas, miembros e historial se conservan: si vuelves a registrar esta dirección, el buzón se restaura como estaba.
              </p>
            }
            <div class="mt-5 flex justify-end gap-2">
              <button type="button" class="alma-btn alma-btn-outline" (click)="cancelarConfirmacion()">Cancelar</button>
              <button type="button" [class]="c.accion === 'eliminar' ? 'alma-btn bg-destructive text-white hover:bg-destructive/90' : 'alma-btn alma-btn-primary'"
                      [disabled]="trabajando() === c.buzon.id"
                      (click)="confirmar()">
                <lucide-icon [name]="trabajando() === c.buzon.id ? 'loader-2' : c.accion === 'eliminar' ? 'trash-2' : 'power-off'" [size]="16" [class.animate-spin]="trabajando() === c.buzon.id" />
                {{ c.accion === 'eliminar' ? 'Quitar de la App' : 'Desconectar' }}
              </button>
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

  protected readonly conexion = CONEXION;
  protected readonly roles = ROLES;
  protected readonly puedeVer = computed(() => this.auth.hasPermission(PERM_VER_BUZON));

  protected readonly buzones = signal<Buzon[]>([]);
  protected readonly cargando = signal(true);
  protected readonly sincronizando = signal<string | null>(null);

  /** Administrador de la App: crea, conecta, desconecta, elimina y da accesos. */
  protected readonly esAdmin = computed(() => this.auth.hasPermission(PERM_ADMIN_BUZON) || this.buzones().some((b) => b.puede_conectar));
  /** Solo los buzones que el usuario configura (admin: todos; editor: los suyos). */
  protected readonly editables = computed(() => this.buzones().filter((b) => b.puede_administrar));
  /** El revisor no entra a «Buzones». */
  protected readonly puedeEntrar = computed(() => this.esAdmin() || this.editables().length > 0);

  /** Buzón sobre el que corre desconectar / reanudar / eliminar / conectar. */
  protected readonly trabajando = signal<string | null>(null);
  protected readonly confirmacion = signal<{ accion: 'desconectar' | 'eliminar'; buzon: Buzon } | null>(null);
  protected readonly conectando = signal<Buzon | null>(null);

  protected readonly formAbierto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorForm = signal<string | null>(null);
  protected form: BuzonIn = { direccion: '', nombre: '', area: '', carpeta_vigilada: 'Inbox', modo: 'sugerir', contexto: '' };

  // Miembros
  protected readonly miembrosDe = signal<Buzon | null>(null);
  protected readonly miembrosForm = signal<MiembroForm[]>([]);
  protected readonly guardandoMiembros = signal(false);
  protected readonly errorMiembros = signal<string | null>(null);
  protected nuevoEmail = '';
  protected nuevoRol: RolMiembro = 'revisor';

  constructor() {
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

  protected hace(iso: string): string {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} d`;
  }

  protected abrirNuevo(): void {
    this.form = { direccion: '', nombre: '', area: '', carpeta_vigilada: 'Inbox', modo: 'sugerir', contexto: '' };
    this.errorForm.set(null);
    this.formAbierto.set(true);
  }

  protected cerrar(): void {
    this.formAbierto.set(false);
  }

  protected valido(): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.form.direccion.trim()) && this.form.nombre.trim().length >= 2;
  }

  protected async guardar(): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      const nuevo = await this.api.crearBuzon({ ...this.form, direccion: this.form.direccion.trim().toLowerCase() });
      if (nuevo.restaurado) {
        this.toast.show(
          'Buzón restaurado',
          `${nuevo.direccion} ya había estado en la App: volvió con sus reglas, miembros e historial. Quedó pausado: conéctalo y reanúdalo.`,
        );
      } else {
        this.toast.show('Buzón creado', `${nuevo.nombre} · ${nuevo.direccion}. Ahora conéctalo con tu cuenta.`);
      }
      this.cerrar();
      void this.router.navigate(['/apps/buzon-inteligente/buzones', nuevo.id]);
    } catch (e) {
      this.errorForm.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
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

  protected pedirConfirmacion(accion: 'desconectar' | 'eliminar', buzon: Buzon): void {
    this.confirmacion.set({ accion, buzon });
  }

  protected cancelarConfirmacion(): void {
    if (this.trabajando()) return;
    this.confirmacion.set(null);
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

  protected pedirConexion(b: Buzon): void {
    this.conectando.set(b);
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
        this.conectando.set(null);
        return;
      }
      // Los scopes de /conexion ya son los compartidos: la cuenta del administrador con acceso completo al buzón.
      window.location.assign(this.api.urlConectar(c.correo_buzon_id ?? b.correo_buzon_id, c.scopes, '/apps/buzon-inteligente/buzones'));
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
