// Cliente del Simulador de asegurabilidad (alma-backend).
// Panel: GET /catalogos, GET /precarga/{id}, POST /evaluar (permiso
// app.suscripcion.view). La configuración vive en simulador-config.api.ts.

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';

/** Entrada del simulador (todos los campos son opcionales: lo que falte queda
 *  como "sin información" y no participa del veredicto). */
export interface EntradaSimulador {
  edad?: number | null;
  sexo?: 'F' | 'M' | null;
  /** En metros (el backend tolera centímetros). */
  estatura?: number | null;
  peso?: number | null;
  pais?: string | null;
  preexistencias?: string[];
  ocupacion?: string | null;
  practica_hobby?: boolean | null;
  hobbies?: string[];
  valor_asegurado?: number | null;
  valor_cumulo?: number | null;
}

export type ResultadoItem = 'Estándar' | 'Información adicional' | 'Rechazar';

export type Veredicto = 'continua' | 'informacion_adicional' | 'no_asegurable';

export interface ItemSimulado {
  /** imc | preexistencia | ocupacion | hobby | pais */
  item: string;
  entrada: unknown;
  resultado: ResultadoItem | null;
  requisito: string;
  /** Solo IMC: BAJO PESO / NORMAL / SOBREPESO / OBESIDAD GRADO 1-3. */
  categoria: string | null;
  sin_dato: boolean;
  detalle: string | null;
}

export interface ExamenesSimulados {
  sin_dato: boolean;
  requiere: boolean | null;
  paquete: string | null;
  examenes: string[];
  valor_total: number | null;
}

export interface ResultadoSimulador {
  simulador_version: string;
  veredicto: Veredicto | null;
  veredicto_label: string | null;
  mensaje: string | null;
  requisitos: string[];
  items: ItemSimulado[];
  examenes: ExamenesSimulados;
  alertas: string[];
  datos_incompletos: string[];
  extranjero: {
    aplica: boolean;
    nota: string | null;
    requisitos: string[] | null;
  };
}

export interface CatalogosSimulador {
  preexistencias: string[];
  ocupaciones: string[];
  hobbies: string[];
  paises: string[];
  generales: {
    edad_min: number;
    edad_max: number;
    mensaje_estandar: string;
    nota_extranjero: string;
    nota_hobby: string;
    requisitos_extranjero: string[];
  };
}

export interface UltimaSimulacion {
  origen: 'auto' | 'manual';
  entrada: EntradaSimulador | null;
  resultado: ResultadoSimulador | null;
  ejecutada_por: string;
  ejecutada_en: string;
}

export interface PrecargaSimulador {
  solicitud_id: string;
  nro_cotizacion: string | null;
  asegurado: string | null;
  entrada: EntradaSimulador;
  ultima_simulacion: UltimaSimulacion | null;
}

@Injectable({ providedIn: 'root' })
export class SimuladorApi {
  private readonly api = inject(ApiService);

  /** Listas de los catálogos y textos generales para armar el formulario. */
  getCatalogos(): Promise<CatalogosSimulador> {
    return this.api.fetch<CatalogosSimulador>('/api/suscripcion/simulador/catalogos');
  }

  /** Entrada precargada desde la cotización + última simulación registrada. */
  getPrecarga(solicitudId: string): Promise<PrecargaSimulador> {
    return this.api.fetch<PrecargaSimulador>(
      `/api/suscripcion/simulador/precarga/${solicitudId}`,
    );
  }

  /** Evalúa la entrada con la configuración vigente. Cada corrida queda
   *  registrada en suscripcion.SimuladorEvaluaciones (auditoría de uso). */
  evaluar(
    entrada: EntradaSimulador,
    solicitudId?: string | null,
  ): Promise<ResultadoSimulador> {
    return this.api.fetch<ResultadoSimulador>('/api/suscripcion/simulador/evaluar', {
      method: 'POST',
      body: JSON.stringify({ ...entrada, solicitud_id: solicitudId ?? null }),
    });
  }
}
