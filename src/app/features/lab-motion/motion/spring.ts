// Motor de springs de Nova.
//
// En lugar de «300ms ease-out», el movimiento se define como un resorte físico
// con dos parámetros al estilo SwiftUI:
//   - response: periodo de oscilación en segundos (qué tan rápido llega).
//   - bounce:   0 = sin rebote (críticamente amortiguado), 0.3 = rebote visible.
//
// Con esos parámetros se resuelve la ecuación del oscilador amortiguado y se
// muestrea a una curva CSS `linear(...)`, que todos los navegadores modernos
// aceptan como easing. Así una transición CSS o una animación WAAPI siguen
// exactamente la física del resorte, y la duración sale del cálculo (el tiempo
// hasta que el resorte se asienta), no de un número elegido a mano.

export interface SpringParams {
  /** Periodo en segundos. Más bajo = más rápido. */
  response: number;
  /** 0 = sin rebote … 0.5 = muy elástico. */
  bounce: number;
}

export interface SpringCurve {
  /** Valor para `transition-timing-function` / `easing`. */
  easing: string;
  /** Duración en ms hasta que el resorte se asienta. */
  duration: number;
}

/** Presets de Nova, por intención. */
export const SPRING_PRESETS = {
  /** Controles: botones, switches, press feedback. */
  snappy: { response: 0.3, bounce: 0.15 },
  /** Superficies: sheets, diálogos, transiciones de contenedor. */
  smooth: { response: 0.5, bounce: 0 },
  /** Momentos expresivos: la isla, confirmaciones, toasts. */
  bouncy: { response: 0.5, bounce: 0.32 },
} satisfies Record<string, SpringParams>;

export type SpringName = keyof typeof SPRING_PRESETS;

const MAX_SEGUNDOS = 3;
const TOLERANCIA = 0.0008;

/**
 * Posición normalizada (0 → 1) del resorte en el instante t.
 * `v0` es la velocidad inicial en «distancias por segundo» hacia el destino:
 * sirve para que una animación continúe el impulso de un gesto.
 */
function posicion(t: number, p: SpringParams, v0: number): number {
  const w0 = (2 * Math.PI) / Math.max(p.response, 0.05);
  const zeta = 1 - Math.min(Math.max(p.bounce, 0), 0.95);
  if (zeta >= 1) {
    // Críticamente amortiguado.
    return 1 - Math.exp(-w0 * t) * (1 + (w0 - v0) * t);
  }
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return (
    1 -
    Math.exp(-zeta * w0 * t) *
      (Math.cos(wd * t) + ((zeta * w0 - v0) / wd) * Math.sin(wd * t))
  );
}

const cache = new Map<string, SpringCurve>();

/** Resuelve el resorte y lo convierte en una curva `linear()` + duración. */
export function springCurve(p: SpringParams, v0 = 0): SpringCurve {
  const clave = `${p.response.toFixed(3)}|${p.bounce.toFixed(3)}|${v0.toFixed(2)}`;
  const hit = cache.get(clave);
  if (hit) return hit;

  // 1) Tiempo de asentamiento: el último instante en que el resorte aún está
  //    fuera de la tolerancia.
  const dt = 1 / 240;
  let asentado = 0;
  for (let t = 0; t <= MAX_SEGUNDOS; t += dt) {
    if (Math.abs(1 - posicion(t, p, v0)) > TOLERANCIA) asentado = t;
  }
  const dur = Math.max(asentado + dt, 0.1);

  // 2) Muestras uniformes; con rebote se necesitan más puntos para que los
  //    picos no se aplanen.
  const n = Math.min(120, Math.max(30, Math.round(dur * 90)));
  const puntos: string[] = [];
  for (let i = 0; i <= n; i++) {
    const x = i === n ? 1 : posicion((i / n) * dur, p, v0);
    puntos.push(String(Math.round(x * 10000) / 10000));
  }

  const curva = { easing: `linear(${puntos.join(', ')})`, duration: Math.round(dur * 1000) };
  if (cache.size > 200) cache.clear();
  cache.set(clave, curva);
  return curva;
}

/** Puntos (t, x) del resorte para dibujarlo en el panel de ajuste. */
export function springSamples(p: SpringParams, n = 80): { t: number; x: number }[] {
  const { duration } = springCurve(p);
  const dur = duration / 1000;
  return Array.from({ length: n + 1 }, (_, i) => ({
    t: i / n,
    x: posicion((i / n) * dur, p, 0),
  }));
}

export function prefiereMenosMovimiento(): boolean {
  return (
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Anima `el` con un resorte usando la Web Animations API.
 *
 * - Interrumpible: si el elemento ya tenía una animación de spring en curso, se
 *   congela su estado actual (commitStyles) y la nueva parte desde AHÍ, sin
 *   saltos. Es la sensación de iOS: puedes «agarrar» algo a mitad de camino.
 * - Con `velocity` la animación hereda el impulso de un gesto.
 * - Con reduced motion se convierte en un cambio casi instantáneo.
 */
export function animateSpring(
  el: HTMLElement,
  keyframes: Keyframe[],
  spring: SpringParams,
  opts: { velocity?: number; delay?: number } = {},
): Animation {
  const anterior = activas.get(el);
  if (anterior && anterior.playState === 'running') {
    try {
      anterior.commitStyles();
    } catch {
      /* elemento fuera del DOM: se ignora */
    }
    anterior.cancel();
  }

  const reducido = prefiereMenosMovimiento();
  const curva = springCurve(spring, opts.velocity ?? 0);
  const anim = el.animate(keyframes, {
    duration: reducido ? 1 : curva.duration,
    easing: reducido ? 'linear' : curva.easing,
    delay: reducido ? 0 : (opts.delay ?? 0),
    fill: 'both',
  });
  activas.set(el, anim);
  anim.finished
    .then(() => {
      if (activas.get(el) !== anim) return;
      try {
        anim.commitStyles();
      } catch {
        /* sin estilo que fijar */
      }
      anim.cancel();
      activas.delete(el);
    })
    .catch(() => {
      /* cancelada por otra animación: normal */
    });
  return anim;
}

const activas = new WeakMap<HTMLElement, Animation>();
