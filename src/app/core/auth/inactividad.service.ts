// Cierre de sesión por inactividad real.
//
// Hallazgo del pentest de 7Way (sept-2026): dejar la plataforma abierta días y
// recargar renovaba los tokens sin preguntar nada, porque MSAL confía en la
// sesión del proveedor de identidad y nadie medía cuánto llevaba el usuario sin
// tocar el teclado. En un equipo desatendido eso es acceso perpetuo.
//
// Este servicio mide ACTIVIDAD HUMANA —clic, tecla, rueda, toque, movimiento
// del puntero—, no peticiones de red: un dashboard que refresca solo no cuenta
// como presencia. Avisa antes de cerrar para no perder trabajo a medio hacer.
//
// La marca de tiempo se comparte entre pestañas por localStorage: si alguien
// trabaja en otra pestaña de Alma, esta no lo saca.

import { DestroyRef, Injectable, inject, signal } from '@angular/core';

import { AuthService, authEnabled } from './auth.service';

/**
 * Minutos sin actividad humana antes de cerrar la sesión.
 * Definido con negocio; cambiar aquí si se revisa la política.
 */
const LIMITE_MINUTOS = 20;

/** Segundos de aviso antes del cierre, para poder continuar la sesión. */
const AVISO_SEGUNDOS = 60;

/** Cada cuánto se revisa el reloj. No necesita más precisión que esta. */
const INTERVALO_MS = 5_000;

/** Máximo una escritura de la marca por este lapso: mousemove dispara mucho. */
const REGISTRO_MINIMO_MS = 10_000;

const CLAVE = 'alma.ultima-actividad';

const EVENTOS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
] as const;

@Injectable({ providedIn: 'root' })
export class InactividadService {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  /** Segundos que faltan para el cierre; null mientras no haya que avisar. */
  readonly avisoSegundos = signal<number | null>(null);

  private ultimaEscritura = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cerrando = false;

  /** Arranca el monitor. Idempotente: llamarlo dos veces no duplica timers. */
  iniciar(): void {
    // Sin Entra (local con usuario mock) no hay sesión que cerrar.
    if (!authEnabled || this.timer) return;

    this.registrarActividad(true);

    const alHaberActividad = () => this.registrarActividad();
    for (const evento of EVENTOS) {
      window.addEventListener(evento, alHaberActividad, { passive: true });
    }

    this.timer = setInterval(() => this.revisar(), INTERVALO_MS);

    this.destroyRef.onDestroy(() => {
      for (const evento of EVENTOS) {
        window.removeEventListener(evento, alHaberActividad);
      }
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    });
  }

  /** "Sigo aquí": reinicia el conteo desde el aviso. */
  continuar(): void {
    this.registrarActividad(true);
    this.avisoSegundos.set(null);
  }

  private registrarActividad(forzar = false): void {
    const ahora = Date.now();
    if (!forzar && ahora - this.ultimaEscritura < REGISTRO_MINIMO_MS) return;
    this.ultimaEscritura = ahora;
    try {
      localStorage.setItem(CLAVE, String(ahora));
    } catch {
      // Modo incógnito o almacenamiento bloqueado: se sigue midiendo en memoria.
    }
  }

  /** La más reciente entre esta pestaña y las demás. */
  private ultimaActividad(): number {
    let compartida = 0;
    try {
      compartida = Number(localStorage.getItem(CLAVE)) || 0;
    } catch {
      compartida = 0;
    }
    return Math.max(this.ultimaEscritura, compartida);
  }

  private revisar(): void {
    if (this.cerrando || this.auth.status() !== 'ready') return;

    const inactivoMs = Date.now() - this.ultimaActividad();
    const limiteMs = LIMITE_MINUTOS * 60_000;
    const restanteMs = limiteMs - inactivoMs;

    if (restanteMs <= 0) {
      this.cerrar();
      return;
    }

    if (restanteMs <= AVISO_SEGUNDOS * 1_000) {
      this.avisoSegundos.set(Math.ceil(restanteMs / 1_000));
    } else if (this.avisoSegundos() !== null) {
      // Volvió antes de que se cumpliera el plazo (p. ej. desde otra pestaña).
      this.avisoSegundos.set(null);
    }
  }

  private cerrar(): void {
    this.cerrando = true;
    this.avisoSegundos.set(null);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* sin almacenamiento: nada que limpiar */
    }
    void this.auth.signOut();
  }
}
