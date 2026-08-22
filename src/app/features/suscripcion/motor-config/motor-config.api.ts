// Cliente de la configuración del motor de suscripción (alma-backend).
// GET/PUT /api/suscripcion/motor/config + GET …/config/log.
// Requiere el permiso app.suscripcion.motor.config (coordinador y admins).

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';

/** Tipo de dato de un parámetro del motor. */
export type TipoParametro = 'numero' | 'entero' | 'lista' | 'mapa';

/** Valor posible de un parámetro según su tipo. */
export type ValorParametro = number | string[] | Record<string, string>;

export interface ParametroConfig {
  clave: string;
  /** Etiqueta humana; si falta, la UI muestra la clave. */
  etiqueta?: string | null;
  tipo: TipoParametro;
  valor: ValorParametro;
  descripcion?: string | null;
}

export interface GrupoConfig {
  /** compartido | crea_patrimonio | crea_ahorro | mapeo_productos */
  ambito: string;
  titulo: string;
  parametros: ParametroConfig[];
}

export interface MotorConfigApi {
  grupos: GrupoConfig[];
}

/** Un cambio puntual a aplicar con PUT /motor/config. */
export interface CambioConfig {
  ambito: string;
  clave: string;
  valor: ValorParametro;
}

/** Entrada del log de auditoría de la configuración. */
export interface LogItem {
  ambito: string;
  clave: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  cambiado_por: string;
  cambiado_en: string;
  comentario: string | null;
}

@Injectable({ providedIn: 'root' })
export class MotorConfigApiService {
  private readonly api = inject(ApiService);

  /** Configuración vigente del motor, agrupada por ámbito. */
  getConfig(): Promise<MotorConfigApi> {
    return this.api.fetch<MotorConfigApi>('/api/suscripcion/motor/config');
  }

  /**
   * Guarda un lote de cambios. El backend valida tipo/rango y registra un log
   * por cada cambio; el motor los recoge de inmediato (cache invalidada).
   */
  saveConfig(
    cambios: CambioConfig[],
    comentario?: string,
  ): Promise<{ saved: boolean; cambios: number }> {
    return this.api.fetch('/api/suscripcion/motor/config', {
      method: 'PUT',
      body: JSON.stringify({ cambios, comentario: comentario || null }),
    });
  }

  /** Historial de cambios de configuración (más reciente primero). */
  async getLog(limite = 100): Promise<LogItem[]> {
    const data = await this.api.fetch<{ log: LogItem[] }>(
      `/api/suscripcion/motor/config/log?limite=${limite}`,
    );
    return data.log;
  }
}
