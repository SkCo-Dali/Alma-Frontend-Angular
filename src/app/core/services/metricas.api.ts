// Cliente del módulo Métricas de Uso (alma-backend /api/metricas/*).
// Requiere el permiso platform.metrics.view (líderes de Operaciones, admin).

import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface MetricasAgente {
  conversaciones: number;
  mensajes: number;
  usuarios: number;
  serie: { dia: string; mensajes: number }[];
  top_usuarios: { email: string; mensajes: number }[];
}

export interface ResumenMetricas {
  dias: number;
  agente: MetricasAgente | null;
  cheques: { registros: number; usuarios: number } | null;
  accesos: { eventos: number } | null;
  suscripcion: { solicitudes: number; evaluaciones: number } | null;
  preguntas_recientes: { email: string; contenido: string; fecha: string }[];
}

@Injectable({ providedIn: 'root' })
export class MetricasApi {
  private readonly api = inject(ApiService);

  obtenerResumen(dias: number): Promise<ResumenMetricas> {
    return this.api.fetch<ResumenMetricas>(`/api/metricas/resumen?dias=${dias}`);
  }
}
