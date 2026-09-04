// Las tres gráficas del tab Desempeño: dona por canal, línea del total del periodo y
// barras por regla. Van en SVG nativo — con su propia forma, paleta y tooltips — para no
// sumarle una librería de gráficas al bundle.

import { Component, computed, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaSpinnerComponent } from '../../../shared/components/alma-spinner.component';
import {
  CanalDatum,
  MesDatum,
  ReglaDatum,
  formatCurrency,
  formatCurrencyCompact,
  formatPeriodo,
} from './info-gerencial.api';

/** Coordenadas de un arco de la dona. */
interface Arco {
  d: string;
  color: string;
  datum: CanalDatum;
}

const R_EXT = 68;
const R_INT = 42;

function polar(cx: number, cy: number, r: number, ang: number): [number, number] {
  const rad = ((ang - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

@Component({
  selector: 'alma-ig-charts',
  imports: [LucideAngularModule, AlmaSpinnerComponent],
  template: `
    @if (loading()) {
      <div class="grid grid-cols-1 gap-4 pt-4 xl:grid-cols-3">
        @for (i of [1, 2, 3]; track i) {
          <div
            class="flex h-[280px] items-center justify-center rounded-xl border border-border/30 bg-card"
          >
            <alma-spinner [size]="28" class="text-muted-foreground" />
          </div>
        }
      </div>
    } @else {
      <div class="grid grid-cols-1 gap-4 pt-4 xl:grid-cols-3">
        <!-- Dona por canal -->
        <div class="rounded-xl border border-border/30 bg-card">
          <div class="px-4 pb-0 pt-4">
            <h3 class="text-sm font-normal leading-tight">Total comisiones por canal</h3>
          </div>
          <div class="px-4 pb-4 pt-2">
            <div
              class="flex flex-col items-center gap-4 md:flex-row md:items-center xl:flex-col 2xl:flex-row"
            >
              <div class="h-[200px] w-full max-w-[280px] shrink-0 md:max-w-[200px] xl:max-w-full">
                @if (arcos().length === 0) {
                  <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Sin datos
                  </div>
                } @else {
                  <svg viewBox="0 0 200 200" class="h-full w-full">
                    <g transform="translate(100,100)">
                      @for (a of arcos(); track a.datum.name) {
                        <path
                          [attr.d]="a.d"
                          [attr.fill]="a.color"
                          stroke="var(--card)"
                          stroke-width="2"
                          class="transition-opacity hover:opacity-90"
                        >
                          <title>{{ a.datum.name }}: {{ moneda(a.datum.value) }}</title>
                        </path>
                      }
                    </g>
                  </svg>
                }
              </div>
              <ul class="w-full space-y-2 text-xs sm:text-[13px] md:min-w-[140px]">
                @for (c of channelData(); track c.name) {
                  <li class="flex items-start gap-2">
                    <span
                      class="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      [style.background]="c.color"
                    ></span>
                    <span class="leading-snug text-muted-foreground">
                      <strong class="mr-1 font-semibold text-foreground">{{ c.percentage }}%</strong>
                      {{ c.name }}
                    </span>
                  </li>
                }
              </ul>
            </div>
          </div>
        </div>

        <!-- Línea del total del periodo -->
        <div class="rounded-xl border border-border/30 bg-card">
          <div class="flex flex-row items-start justify-between px-4 pb-0 pt-4">
            <h3 class="text-sm font-normal leading-tight">Total de comisiones periodo</h3>
            <span class="text-sm font-bold">{{ moneda(periodTotal()) }}</span>
          </div>
          <div class="h-[220px] px-4 pb-4 pt-2 sm:h-[260px] lg:h-[280px]">
            @if (monthlyData().length === 0) {
              <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
                Sin datos
              </div>
            } @else {
              <svg viewBox="0 0 320 200" class="h-full w-full" preserveAspectRatio="none">
                <!-- rejilla horizontal -->
                @for (g of rejilla(); track g) {
                  <line
                    x1="46"
                    [attr.y1]="g"
                    x2="315"
                    [attr.y2]="g"
                    stroke="var(--border)"
                    stroke-dasharray="3 3"
                  />
                }
                <!-- etiquetas del eje Y -->
                @for (t of ticksY(); track t.y) {
                  <text
                    x="42"
                    [attr.y]="t.y + 3"
                    text-anchor="end"
                    class="fill-muted-foreground"
                    style="font-size: 9px"
                  >
                    {{ t.label }}
                  </text>
                }
                <polyline
                  [attr.points]="puntos()"
                  fill="none"
                  stroke="var(--primary)"
                  stroke-width="2"
                />
                @for (p of puntosLista(); track p.periodo) {
                  <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3.5" fill="var(--primary)">
                    <title>{{ etiquetaPeriodo(p.periodo) }}: {{ moneda(p.value) }}</title>
                  </circle>
                  <text
                    [attr.x]="p.x"
                    y="192"
                    text-anchor="middle"
                    class="fill-muted-foreground"
                    style="font-size: 10px"
                  >
                    {{ p.month }}
                  </text>
                }
              </svg>
            }
          </div>
        </div>

        <!-- Barras por regla -->
        <div class="rounded-xl border border-border/30 bg-card">
          <div class="px-4 pb-0 pt-4">
            <h3 class="text-sm font-normal leading-tight">Total comisiones por regla</h3>
          </div>
          <div class="h-[220px] overflow-x-auto px-4 pb-4 pt-2 sm:h-[260px] lg:h-[280px]">
            @if (ruleData().length === 0) {
              <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
                Sin datos
              </div>
            } @else {
              <div class="flex h-full items-end gap-3" [style.min-width.px]="anchoBarras()">
                @for (r of barras(); track r.name) {
                  <div class="flex h-full min-w-[64px] flex-1 flex-col items-center justify-end gap-1">
                    <span class="text-[11px] font-semibold">{{ compacto(r.value) }}</span>
                    <div
                      class="w-full rounded-t bg-[#3B82F6] transition-colors hover:bg-[#2563EB]"
                      [style.height.%]="r.alto"
                      [title]="r.name + ': ' + moneda(r.value)"
                    ></div>
                    <span
                      class="w-full truncate text-center text-[10px] text-muted-foreground"
                      [title]="r.name"
                    >
                      {{ r.name }}
                    </span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class IgChartsComponent {
  readonly channelData = input.required<CanalDatum[]>();
  readonly monthlyData = input.required<MesDatum[]>();
  readonly ruleData = input.required<ReglaDatum[]>();
  readonly periodTotal = input.required<number>();
  readonly loading = input(false);

  protected readonly rejilla = signal([20, 60, 100, 140, 180]);

  protected moneda(v: number): string {
    return formatCurrency(v);
  }

  protected compacto(v: number): string {
    return formatCurrencyCompact(v);
  }

  protected etiquetaPeriodo(p: string): string {
    return formatPeriodo(p);
  }

  /** Arcos de la dona proporcionales al valor de cada canal. */
  protected readonly arcos = computed<Arco[]>(() => {
    const datos = this.channelData();
    const total = datos.reduce((s, d) => s + d.value, 0);
    if (total <= 0) return [];
    let angulo = 0;
    return datos.map((d) => {
      const barrido = (d.value / total) * 360;
      // Se deja un par de grados de aire entre porciones.
      const fin = angulo + Math.max(barrido - 2, 0.5);
      const [x1, y1] = polar(0, 0, R_EXT, angulo);
      const [x2, y2] = polar(0, 0, R_EXT, fin);
      const [x3, y3] = polar(0, 0, R_INT, fin);
      const [x4, y4] = polar(0, 0, R_INT, angulo);
      const grande = barrido > 180 ? 1 : 0;
      const d3 = [
        `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
        `A ${R_EXT} ${R_EXT} 0 ${grande} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
        `A ${R_INT} ${R_INT} 0 ${grande} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
        'Z',
      ].join(' ');
      angulo += barrido;
      return { d: d3, color: d.color, datum: d };
    });
  });

  /** Escala de la línea: 0 → máximo de la serie con 10% de aire. */
  private readonly maximoMes = computed(() =>
    Math.max(...this.monthlyData().map((m) => m.value), 0) * 1.1 || 1,
  );

  protected readonly puntosLista = computed(() => {
    const datos = this.monthlyData();
    const n = Math.max(datos.length - 1, 1);
    return datos.map((m, i) => ({
      ...m,
      x: 50 + (i * 260) / n,
      y: 180 - (m.value / this.maximoMes()) * 160,
    }));
  });

  protected readonly puntos = computed(() =>
    this.puntosLista()
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' '),
  );

  protected readonly ticksY = computed(() => {
    const max = this.maximoMes();
    return this.rejilla().map((y) => ({
      y,
      label: formatCurrencyCompact(((180 - y) / 160) * max),
    }));
  });

  private readonly maximoRegla = computed(
    () => Math.max(...this.ruleData().map((r) => r.value), 0) || 1,
  );

  protected readonly barras = computed(() =>
    this.ruleData().map((r) => ({
      ...r,
      // 8% mínimo para que una barra pequeña siga siendo visible.
      alto: Math.max((r.value / this.maximoRegla()) * 82, 8),
    })),
  );

  /** Con más de 4 reglas la tarjeta se desplaza horizontalmente. */
  protected readonly anchoBarras = computed(() =>
    this.ruleData().length > 4 ? this.ruleData().length * 76 : 0,
  );
}
