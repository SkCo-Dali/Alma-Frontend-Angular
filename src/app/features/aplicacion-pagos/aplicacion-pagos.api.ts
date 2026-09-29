// Cliente de la App «Aplicación de Pagos» (Recaudos) — alma-backend
// /api/aplicacion-pagos/*. El MAESTRO lo arma un script de Calidad que corre en
// local sin alcance al backend: un usuario lo sube desde aquí con su sesión.

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

export const PERM_VIEW = 'app.recaudos-aplicacion-pagos.view';

export interface ErrorCarga {
  hoja: string | null;
  fila: number | null;
  campo: string | null;
  valor: unknown;
  /** 'validacion' (Alma) o 'script:<tipo>' (lo reportó el script de Calidad). */
  tipo: string;
  descripcion: string | null;
}

/** Resultado de subir un MAESTRO (mismo resumen que la hoja CONTROL_CARGAS). */
export interface ResultadoCarga {
  carga_id: string;
  archivo: string;
  fuente: string;
  registros_leidos: number;
  registros_cargados: number;
  /** ID_Registro que ya estaban cargados (el mismo archivo subido otra vez). */
  registros_omitidos: number;
  /** Registros distintos que se parecen a otros: entran marcados para revisión. */
  duplicados_detectados: number;
  errores_encontrados: number;
  errores: ErrorCarga[];
  columnas_ignoradas: string[];
}

export interface Carga {
  id: string;
  archivo: string;
  fuente: string;
  fecha_carga: string | null;
  registros_leidos: number;
  registros_cargados: number;
  registros_omitidos: number;
  duplicados_detectados: number;
  errores_encontrados: number;
  cargado_por: string;
}

const BASE = '/api/aplicacion-pagos';

@Injectable({ providedIn: 'root' })
export class AplicacionPagosApi {
  private readonly api = inject(ApiService);

  subirMaestro(archivo: File): Promise<ResultadoCarga> {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name);
    return this.api.upload<ResultadoCarga>(`${BASE}/cargas`, form);
  }

  async listarCargas(limite = 50): Promise<Carga[]> {
    return (await this.api.fetch<{ items: Carga[] }>(`${BASE}/cargas?limite=${limite}`)).items;
  }

  async erroresDeCarga(cargaId: string): Promise<ErrorCarga[]> {
    return (await this.api.fetch<{ items: ErrorCarga[] }>(`${BASE}/cargas/${cargaId}/errores`)).items;
  }
}
