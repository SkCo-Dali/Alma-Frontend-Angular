// Cliente de la configuración del Simulador de asegurabilidad (alma-backend).
// GET/PUT /api/suscripcion/simulador/config + GET …/config/log.
// Requiere el permiso app.suscripcion.simulador.config (coordinador y admins).

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { ResultadoItem } from '../simulador/simulador.api';

/** Tipo de dato de un parámetro del simulador. */
export type TipoParametroSim =
  | 'numero'
  | 'entero'
  | 'texto'
  | 'lista_texto'
  | 'segmentos'
  | 'catalogo'
  | 'matriz'
  | 'paquetes';

/** Ítem de un catálogo (preexistencias / ocupaciones / hobbies / países). */
export interface ItemCatalogo {
  nombre: string;
  resultado: ResultadoItem;
  requisito: string;
}

/** Segmento de la tabla de IMC (rangos enteros contiguos). */
export interface SegmentoImc {
  desde: number;
  hasta: number;
  categoria: string;
  resultado: ResultadoItem;
  requisito: string;
}

/** Rango de valor asegurado dentro de una fila de la matriz de exámenes. */
export interface RangoMatriz {
  desde: number;
  hasta: number | null;
  paquete: string;
}

/** Fila de la matriz de exámenes (banda de edad × rangos de valor). */
export interface FilaMatriz {
  edadDesde: number;
  edadHasta: number | null;
  rangos: RangoMatriz[];
}

export type ValorParametroSim =
  | number
  | string
  | string[]
  | ItemCatalogo[]
  | SegmentoImc[]
  | FilaMatriz[]
  | Record<string, string[]>;

export interface ParametroSimConfig {
  clave: string;
  etiqueta?: string | null;
  tipo: TipoParametroSim;
  valor: ValorParametroSim;
  descripcion?: string | null;
}

export interface GrupoSimConfig {
  /** generales | imc | catalogos | examenes */
  ambito: string;
  titulo: string;
  parametros: ParametroSimConfig[];
}

export interface SimuladorConfigApi {
  grupos: GrupoSimConfig[];
}

export interface CambioSimConfig {
  ambito: string;
  clave: string;
  valor: ValorParametroSim;
}

/** Entrada del log de auditoría (mismo shape que el log del motor). */
export interface SimLogItem {
  ambito: string;
  clave: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  cambiado_por: string;
  cambiado_en: string;
  comentario: string | null;
}

@Injectable({ providedIn: 'root' })
export class SimuladorConfigApiService {
  private readonly api = inject(ApiService);

  getConfig(): Promise<SimuladorConfigApi> {
    return this.api.fetch<SimuladorConfigApi>('/api/suscripcion/simulador/config');
  }

  /**
   * Guarda un lote de cambios. El backend valida tipo y coherencia (segmentos
   * contiguos, catálogos sin duplicados, matriz sobre paquetes existentes) y
   * registra un log por cambio. El simulador los usa de inmediato.
   */
  saveConfig(
    cambios: CambioSimConfig[],
    comentario?: string,
  ): Promise<{ saved: boolean; cambios: number }> {
    return this.api.fetch('/api/suscripcion/simulador/config', {
      method: 'PUT',
      body: JSON.stringify({ cambios, comentario: comentario || null }),
    });
  }

  async getLog(limite = 100): Promise<SimLogItem[]> {
    const data = await this.api.fetch<{ log: SimLogItem[] }>(
      `/api/suscripcion/simulador/config/log?limite=${limite}`,
    );
    return data.log;
  }
}
