// App "Acreditación PAC" (Recaudos): bandeja del analista con los pagos PAC que llegan
// por correo, ya cruzados contra suspense. Arriba, un conteo por estado que también
// filtra; luego filtros y la tabla. La acción de cada fila abre el panel de gestión;
// el clic en la fila, el historial. Diseño de referencia: Portal PAC v2 (Claude Design).
//
// Los filtros van en signals (no en campos planos con ngModel) porque `filtrados` es
// un computed: en zoneless solo se recalcula cuando cambia una señal que lee.

import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import { PanelAccionPagoComponent } from './panel-accion-pago.component';
import { PanelHistorialPagoComponent } from './panel-historial-pago.component';
import {
  ConfirmarAccionInput,
  PERM_CONFIG,
  PERM_VIEW,
  PagoPac,
  RecaudosPacApi,
  estadoSiguiente,
  estiloBadge,
  formatoFecha,
  formatoFechaCorta,
  formatoMonto,
  montoDescuadrado,
} from './recaudos-pac.api';

@Component({
  selector: 'alma-recaudos-pac-page',
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    AccessDeniedComponent,
    TooltipDirective,
    PanelAccionPagoComponent,
    PanelHistorialPagoComponent,
  ],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <!-- Encabezado -->
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-on-wallpaper text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Acreditación PAC
            </h1>
            <p class="text-on-wallpaper mt-1 text-sm text-foreground/80">
              Pagos PAC recibidos por correo, cruzados contra suspense y listos para gestionar.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            @if (api.modoDemo()) {
              <span
                class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                almaTooltip="El backend de la App aún no existe. Se muestran pagos de ejemplo con empresas ficticias; las acciones y los correos se simulan."
              >
                <lucide-icon name="flask-conical" [size]="12" />
                Datos de demostración
              </span>
            }
            <span class="glass inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground">
              <lucide-icon name="clock-3" [size]="13" />
              {{ actualizado() }}
            </span>
            <button type="button" class="alma-btn alma-btn-ghost" almaTooltip="Actualizar" (click)="cargar()">
              <lucide-icon name="refresh-cw" [size]="15" [class.animate-spin]="cargando()" />
            </button>
            @if (puedeConfigurar()) {
              <a
                routerLink="/apps/recaudos-acreditacion-pac/estados"
                class="alma-btn alma-btn-ghost"
                almaTooltip="Configurar estados"
                aria-label="Configurar estados"
              >
                <lucide-icon name="settings" [size]="15" />
              </a>
            }
          </div>
        </div>

        <!-- Conteo por estado (también filtra). Solo estados con casos, así que la
             cantidad varía: en vez de cuadrícula fija, las tarjetas se reparten el ancho
             (140–220 px) y bajan de línea si son muchas. En celular, fila deslizable
             (apiladas ocupaban casi una pantalla antes de llegar a los pagos). -->
        <div class="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          @for (t of tarjetas(); track t.codigo) {
            <button
              type="button"
              class="glass flex min-w-[128px] shrink-0 flex-col gap-1.5 rounded-xl border-2 px-3.5 py-2.5 text-left shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] sm:max-w-[220px] sm:min-w-[140px] sm:flex-1 sm:basis-[140px] sm:gap-2 sm:px-4 sm:py-3"
              [class.border-dashed]="t.desconocido"
              [attr.title]="t.desconocido ? 'Estado sin configurar en la App' : null"
              [style.border-color]="
                t.seleccionada
                  ? t.color
                  : t.desconocido
                    ? 'color-mix(in srgb, ' + t.color + ' 55%, transparent)'
                    : 'transparent'
              "
              [attr.aria-pressed]="t.seleccionada"
              (click)="alternarEstado(t.codigo)"
            >
              <span class="flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap text-muted-foreground">
                <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="t.color"></span>
                {{ t.corto }}
              </span>
              <span class="text-2xl font-bold tabular-nums text-foreground">{{ t.total }}</span>
            </button>
          }
        </div>

        <!-- Filtros -->
        <!-- En celular cada filtro ocupa el ancho completo; desde sm fluyen en filas. -->
        <div class="glass flex flex-col gap-3 rounded-xl px-4 py-3 shadow-[var(--shadow-sm)] sm:flex-row sm:flex-wrap sm:items-center">
          <div class="relative w-full sm:w-auto sm:min-w-[200px] sm:max-w-[300px] sm:flex-1">
            <!-- El ícono va dentro de un span: lucide-icon copia sus clases al <svg>
                 interno y un left-3 directo sobre él se aplicaba dos veces. -->
            <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
              <lucide-icon name="search" [size]="15" />
            </span>
            <input
              type="search"
              class="alma-input w-full pl-10"
              placeholder="Buscar empresa o referencia…"
              [ngModel]="q()"
              (ngModelChange)="q.set($event)"
            />
          </div>
          <select class="alma-input sm:w-auto sm:min-w-[170px]" aria-label="Analista" [ngModel]="analista()" (ngModelChange)="analista.set($event)">
            <option value="">Todos los analistas</option>
            @for (a of analistas(); track a) {
              <option [value]="a">{{ a }}</option>
            }
          </select>
          <select class="alma-input sm:w-auto sm:min-w-[170px]" aria-label="Empresa" [ngModel]="empresa()" (ngModelChange)="empresa.set($event)">
            <option value="">Todas las empresas</option>
            @for (e of empresas(); track e) {
              <option [value]="e">{{ e }}</option>
            }
          </select>
          <select
            class="alma-input sm:w-auto sm:min-w-[190px]"
            aria-label="Estado"
            [ngModel]="estado() ?? ''"
            (ngModelChange)="estado.set($event || null)"
          >
            <option value="">Todos los estados</option>
            @for (t of tarjetas(); track t.codigo) {
              <option [value]="t.codigo">{{ t.corto }}</option>
            }
          </select>
          <div class="flex items-center gap-2">
            <input
              type="date"
              class="alma-input min-w-0 flex-1 sm:w-auto sm:flex-none"
              aria-label="Procesado desde"
              [ngModel]="desde()"
              (ngModelChange)="desde.set($event ?? '')"
            />
            <span class="text-[13px] text-muted-foreground">a</span>
            <input
              type="date"
              class="alma-input min-w-0 flex-1 sm:w-auto sm:flex-none"
              aria-label="Procesado hasta"
              [ngModel]="hasta()"
              (ngModelChange)="hasta.set($event ?? '')"
            />
          </div>
          <div class="flex items-center gap-3 sm:ml-auto">
            @if (hayFiltros()) {
              <!-- alma-btn-ghost es un botón de solo ícono (32 px fijos, sin padding):
                   con texto hay que devolverle ancho y padding o el texto se desborda. -->
              <button
                type="button"
                class="alma-btn alma-btn-ghost h-9 w-auto px-3 text-xs text-muted-foreground hover:text-foreground"
                (click)="limpiarFiltros()"
              >
                <lucide-icon name="x" [size]="14" />
                Limpiar
              </button>
            }
            <span class="ml-auto whitespace-nowrap text-xs text-muted-foreground">
              {{ filtrados().length }} {{ filtrados().length === 1 ? 'pago' : 'pagos' }}
            </span>
          </div>
        </div>

        <!-- Tabla -->
        <div class="glass overflow-hidden rounded-xl shadow-[var(--shadow-sm)]">
          @if (error(); as err) {
            <p class="p-10 text-center text-sm text-destructive">Error cargando pagos: {{ err }}</p>
          } @else if (cargando() && !pagos().length) {
            <div class="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <lucide-icon name="loader-2" [size]="16" class="animate-spin" /> Cargando pagos…
            </div>
          } @else if (!filtrados().length) {
            <div class="flex flex-col items-center gap-2 p-12 text-center">
              <lucide-icon name="search" [size]="36" class="text-muted-foreground/60" />
              <p class="text-sm text-muted-foreground">
                {{ pagos().length ? 'No se encontraron pagos con estos filtros.' : 'No hay pagos pendientes en tu bandeja.' }}
              </p>
            </div>
          } @else {
            <!-- Celular: una tarjeta por pago en vez de la tabla. -->
            <ul class="divide-y divide-border md:hidden">
              @for (p of filtrados(); track p.id) {
                <li class="flex flex-col gap-2.5 px-4 py-3.5" (click)="abrirHistorial(p)">
                  <div class="flex items-start justify-between gap-3">
                    <p class="min-w-0 text-sm font-semibold leading-snug text-foreground">{{ p.empresa }}</p>
                    <span class="alma-badge shrink-0 gap-1.5 whitespace-nowrap" [style]="badge(meta(p.estado).color)">
                      <span class="h-1.5 w-1.5 rounded-full" [style.background]="meta(p.estado).color"></span>
                      {{ meta(p.estado).corto }}
                    </span>
                  </div>
                  <div class="flex items-baseline justify-between gap-3">
                    <span class="inline-flex items-center gap-1 text-base font-bold tabular-nums text-foreground">
                      @if (descuadre(p)) {
                        <span class="inline-flex text-red-600 dark:text-red-400" aria-label="El monto no coincide con el del comprobante">
                          <lucide-icon name="alert-triangle" [size]="14" />
                        </span>
                      }
                      {{ monto(p.monto) }}
                    </span>
                    <span class="text-xs text-muted-foreground">{{ fechaCorta(p.fecha_procesamiento) }}</span>
                  </div>
                  <p class="flex items-center gap-2 text-xs text-muted-foreground">
                    <code class="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[12px] text-foreground">{{ p.referencia }}</code>
                    {{ p.analista }}
                  </p>
                  <button
                    type="button"
                    class="alma-btn alma-btn-outline h-9 w-full rounded-full border-primary text-xs text-primary hover:bg-primary/10"
                    (click)="abrirAccion(p, $event)"
                  >
                    {{ meta(p.estado).accion }}
                  </button>
                </li>
              }
            </ul>

            <!-- Desde md: tabla con todas las columnas. Si no cabe, se desplaza de lado
                 y la columna Acción queda fija a la derecha para que nunca se corte; por
                 debajo de xl la fecha se acorta para ahorrar ancho. -->
            <div #contTabla class="hidden overflow-x-auto md:block" [class.tabla-desborda]="tablaDesborda()">
              <table class="alma-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Referencia</th>
                    <th class="text-right">Monto</th>
                    <th>Estado</th>
                    <th>Analista</th>
                    <th>Procesado</th>
                    <th class="col-accion-fija text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of filtrados(); track p.id) {
                    <tr class="group cursor-pointer" (click)="abrirHistorial(p)">
                      <td class="min-w-[180px] font-medium">{{ p.empresa }}</td>
                      <td>
                        <code class="whitespace-nowrap rounded bg-[var(--surface-sunken)] px-2 py-0.5 text-[13px]">{{ p.referencia }}</code>
                      </td>
                      <td class="whitespace-nowrap text-right font-semibold tabular-nums">
                        <span class="inline-flex items-center gap-1">
                          @if (descuadre(p)) {
                            <span almaTooltip="El monto no coincide con el del comprobante" class="inline-flex text-red-600 dark:text-red-400">
                              <lucide-icon name="alert-triangle" [size]="13" />
                            </span>
                          }
                          {{ monto(p.monto) }}
                        </span>
                      </td>
                      <td>
                        <span class="alma-badge gap-1.5 whitespace-nowrap" [style]="badge(meta(p.estado).color)">
                          <span class="h-1.5 w-1.5 rounded-full" [style.background]="meta(p.estado).color"></span>
                          {{ meta(p.estado).corto }}
                        </span>
                      </td>
                      <td class="whitespace-nowrap">{{ p.analista }}</td>
                      <td class="whitespace-nowrap text-muted-foreground">
                        <span class="xl:hidden">{{ fechaCorta(p.fecha_procesamiento) }}</span>
                        <span class="hidden xl:inline">{{ fecha(p.fecha_procesamiento) }}</span>
                      </td>
                      <td class="col-accion-fija text-center">
                        <button
                          type="button"
                          class="alma-btn alma-btn-outline h-8 rounded-full border-primary px-4 text-xs whitespace-nowrap text-primary hover:bg-primary/10"
                          (click)="abrirAccion(p, $event)"
                        >
                          {{ meta(p.estado).accion }}
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>

      @if (pagoAccion(); as p) {
        <alma-panel-accion-pago
          [pago]="p"
          [enviando]="confirmando()"
          (cerrar)="pagoAccion.set(null)"
          (confirmar)="confirmar(p, $event)"
        />
      } @else if (pagoHistorial(); as p) {
        <alma-panel-historial-pago [pago]="p" (cerrar)="pagoHistorial.set(null)" />
      }
    }
  `,
  styles: `
    /* Columna Acción fija a la derecha. Sin fondo propio mientras la tabla cabe: la
       tarjeta ya es de vidrio y una segunda capa se veía como una franja blanca. Solo
       cuando la tabla desborda (hay columnas pasando por debajo) toma el vidrio de
       .glass-strong, para que lo de abajo se difumine en vez de encimarse. */
    .col-accion-fija {
      position: sticky;
      right: 0;
      z-index: 10;
    }
    .tabla-desborda .col-accion-fija {
      background-color: color-mix(in srgb, var(--surface-raised) 80%, transparent);
      backdrop-filter: blur(20px) saturate(1.2);
      -webkit-backdrop-filter: blur(20px) saturate(1.2);
      box-shadow: inset 1px 0 0 color-mix(in srgb, var(--border) 60%, transparent);
    }
  `,
})
export class RecaudosPacPageComponent {
  protected readonly api = inject(RecaudosPacApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly badge = estiloBadge;
  protected readonly meta = (codigo: string) => this.api.meta(codigo);
  protected readonly monto = formatoMonto;
  protected readonly fecha = formatoFecha;
  protected readonly fechaCorta = formatoFechaCorta;
  protected readonly descuadre = montoDescuadrado;

  protected readonly puedeVer = computed(() => this.auth.hasPermission(PERM_VIEW));
  protected readonly puedeConfigurar = computed(() => this.auth.hasPermission(PERM_CONFIG));

  protected readonly pagos = signal<PagoPac[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly cargadoEn = signal<Date | null>(null);
  // Reloj de un minuto para que "Actualizado hace N min" avance solo.
  private readonly ahora = signal(Date.now());

  protected readonly q = signal('');
  protected readonly analista = signal(''); // '' = todos
  protected readonly empresa = signal('');
  protected readonly estado = signal<string | null>(null); // código; null = todos
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  protected readonly pagoAccion = signal<PagoPac | null>(null);
  protected readonly pagoHistorial = signal<PagoPac | null>(null);
  protected readonly confirmando = signal(false);

  // numeric: "Analista 10" va después de "Analista 2".
  protected readonly analistas = computed(() =>
    [...new Set(this.pagos().map((p) => p.analista))].sort((a, b) =>
      a.localeCompare(b, 'es', { numeric: true }),
    ),
  );

  protected readonly empresas = computed(() =>
    [...new Set(this.pagos().map((p) => p.empresa))].sort((a, b) => a.localeCompare(b, 'es')),
  );

  // Tarjetas: solo los estados que TIENEN casos, en el orden del catálogo (los que no
  // están en el catálogo van al final, en gris). Cuentan la carga del analista filtrado
  // (o de todos) sin aplicar el resto de filtros: así se ve cuánto tiene esa persona
  // por estado aunque se esté buscando una empresa o un rango de fechas.
  protected readonly tarjetas = computed(() => {
    this.api.estados(); // dependencia: si cambia el catálogo, se recalculan colores y orden
    const analista = this.analista();
    const conteo = new Map<string, number>();
    for (const p of this.pagos()) {
      if (analista && p.analista !== analista) continue;
      conteo.set(p.estado, (conteo.get(p.estado) ?? 0) + 1);
    }
    return [...conteo.entries()]
      .map(([codigo, total]) => {
        const m = this.api.meta(codigo);
        return {
          codigo,
          orden: m.orden,
          corto: m.corto,
          color: m.color,
          desconocido: !!m.desconocido,
          total,
          seleccionada: this.estado() === codigo,
        };
      })
      .sort((a, b) => a.orden - b.orden || a.corto.localeCompare(b.corto, 'es'));
  });

  protected readonly filtrados = computed(() => {
    const q = this.q().trim().toLowerCase();
    const analista = this.analista();
    const empresa = this.empresa();
    const estado = this.estado();
    const desde = this.desde();
    const hasta = this.hasta();
    return this.pagos().filter(
      (p) =>
        (!q || p.empresa.toLowerCase().includes(q) || p.referencia.toLowerCase().includes(q)) &&
        (!analista || p.analista === analista) &&
        (!empresa || p.empresa === empresa) &&
        (estado === null || p.estado === estado) &&
        // fecha_procesamiento es YYYY-MM-DD: la comparación de texto equivale a la de fechas.
        (!desde || p.fecha_procesamiento >= desde) &&
        (!hasta || p.fecha_procesamiento <= hasta),
    );
  });

  protected readonly hayFiltros = computed(
    () => !!(this.q() || this.analista() || this.empresa() || this.estado() !== null || this.desde() || this.hasta()),
  );

  protected readonly actualizado = computed(() => {
    const en = this.cargadoEn();
    if (!en) return 'Actualizando…';
    const min = Math.floor((this.ahora() - en.getTime()) / 60_000);
    return min < 1 ? 'Actualizado hace un momento' : `Actualizado hace ${min} min`;
  });

  private readonly contTabla = viewChild<ElementRef<HTMLElement>>('contTabla');
  /** La tabla no cabe a lo ancho: la columna Acción fija necesita fondo propio. */
  protected readonly tablaDesborda = signal(false);

  constructor() {
    // Se observa el contenedor (cambia con la ventana) y la tabla (cambia al filtrar).
    effect((onCleanup) => {
      const el = this.contTabla()?.nativeElement;
      if (!el) return;
      const medir = () => this.tablaDesborda.set(el.scrollWidth > el.clientWidth + 1);
      const ro = new ResizeObserver(medir);
      ro.observe(el);
      if (el.firstElementChild) ro.observe(el.firstElementChild);
      onCleanup(() => ro.disconnect());
    });

    // Si el estado filtrado se queda sin casos (se confirmó el último, o se cambió de
    // analista), su tarjeta desaparece; se quita el filtro para no dejar una tabla
    // vacía sin tarjeta que explique por qué.
    effect(() => {
      const estado = this.estado();
      if (estado && !this.tarjetas().some((t) => t.codigo === estado)) this.estado.set(null);
    });

    const reloj = setInterval(() => this.ahora.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      // El catálogo va primero: sin él, todos los pagos se verían como "sin configurar".
      if (!this.api.estados().length) await this.api.listarEstados();
      this.pagos.set(await this.api.listar());
      this.cargadoEn.set(new Date());
      this.ahora.set(Date.now());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected alternarEstado(codigo: string): void {
    this.estado.set(this.estado() === codigo ? null : codigo);
  }

  protected limpiarFiltros(): void {
    this.q.set('');
    this.analista.set('');
    this.empresa.set('');
    this.estado.set(null);
    this.desde.set('');
    this.hasta.set('');
  }

  protected abrirHistorial(p: PagoPac): void {
    this.pagoHistorial.set(p);
  }

  protected abrirAccion(p: PagoPac, ev: MouseEvent): void {
    ev.stopPropagation(); // que el clic en el botón no abra también el historial
    this.pagoHistorial.set(null);
    this.pagoAccion.set(p);
  }

  protected async confirmar(p: PagoPac, input: ConfirmarAccionInput): Promise<void> {
    this.confirmando.set(true);
    try {
      const meta = this.api.meta(p.estado);
      const siguiente = estadoSiguiente(meta, input.accion_pipeline);
      // Quien gestiona es el usuario de la sesión del shell (Entra; en local, el mock).
      await this.api.confirmarAccion(p.id, this.auth.user().nombre, input);
      this.pagoAccion.set(null);
      await this.cargar();
      const correo = input.correo ? ' y se envió el correo a la empresa' : '';
      this.toast.show(
        `${p.referencia}: ${meta.accion.toLowerCase()} completado`,
        siguiente === null
          ? `El pago salió de tu bandeja${correo}.`
          : `Ahora está en “${this.api.meta(siguiente).corto}”${correo}.`,
      );
    } catch (e) {
      this.toast.error('No se pudo completar la acción', e instanceof Error ? e.message : String(e));
    } finally {
      this.confirmando.set(false);
    }
  }
}
