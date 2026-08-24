// Estado compartido del simulador de asegurabilidad. Es un servicio de raíz porque
// en la app solo hay un simulador a la vez.
//
// - `abierto` persiste en sessionStorage para sobrevivir la navegación
//   bandeja ↔ detalle (cada ruta monta su propio host).
// - `disparadoresExternos` cuenta los botones que otras pantallas aportan en su
//   toolbar; mientras haya al menos uno, el host oculta su botón flotante para no
//   duplicar el disparador.

import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'alma-simulador-abierto';

function leerEstado(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class SimuladorStore {
  readonly abierto = signal<boolean>(leerEstado());

  private readonly disparadoresExternos = signal(0);

  /** El flotante aparece solo si el panel está cerrado y nadie aporta su disparador. */
  readonly mostrarFlotante = computed(() => !this.abierto() && this.disparadoresExternos() === 0);

  alternar(v: boolean): void {
    this.abierto.set(v);
    try {
      sessionStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {
      // sessionStorage no disponible: el estado queda solo en memoria.
    }
  }

  /** Registra un disparador externo; devuelve la función de baja. */
  registrarDisparadorExterno(): () => void {
    this.disparadoresExternos.update((n) => n + 1);
    return () => this.disparadoresExternos.update((n) => Math.max(0, n - 1));
  }
}
