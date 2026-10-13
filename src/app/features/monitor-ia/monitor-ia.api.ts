// Cliente de la App «Monitor-IA» (Servicio de Atención al Cliente) — alma-backend
// /api/monitor-ia/*. Campañas de autoevaluación automática de llamadas en Genesys
// Cloud: el Coordinador arma la campaña, Alma sortea la muestra por analista y
// pide a Genesys la autoevaluación de cada llamada.

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

export const PERM_VIEW = 'app.monitor-ia.view';
export const PERM_CAMPANAS = 'app.monitor-ia.campanas.manage';
export const PERM_CONFIG = 'app.monitor-ia.config';

export type EstadoCampana =
  | 'PREVISUALIZANDO'
  | 'PREVISUALIZADO'
  | 'EJECUTANDO'
  | 'SOLICITUDES_ENVIADAS'
  | 'RESULTADOS_ACTUALIZADOS'
  | 'CANCELADA'
  | 'ERROR';

export type Sentido = 'inbound' | 'outbound' | 'both';
export type ModoCola = 'any' | 'with_queue' | 'without_queue' | 'selected';
export type CriterioDuracion = 'total' | 'agent' | 'both';

export interface ItemCatalogo {
  id: string;
  name: string;
}

/** Conexión con Genesys y topes vigentes (sin credenciales). */
export interface Conexion {
  configurada: boolean;
  verificada_en: string | null;
  region: string;
  max_por_lote: number;
  max_por_dia: number;
  concurrencia: number;
}

/** Lo que ve el Administrador: el secreto NUNCA viaja, solo si existe. */
export interface Configuracion extends Conexion {
  client_id: string | null;
  tiene_secreto: boolean;
  actualizado_por: string | null;
  actualizado_en: string | null;
}

export interface ConfiguracionIn {
  region: string;
  client_id: string | null;
  /** Vacío o null = conservar el secreto guardado. */
  client_secret: string | null;
  max_por_lote: number;
  max_por_dia: number;
  concurrencia: number;
}

export interface FormularioGenesys {
  id: string;
  name: string;
  type: string | null;
  habilitado: boolean;
}

export interface FormularioHabilitado {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface Campana {
  id: string;
  nombre: string;
  form_id: string;
  form_nombre: string;
  desde: string;
  hasta: string;
  sentido: Sentido;
  modo_cola: ModoCola;
  cola_ids: string[];
  duracion_min_seg: number;
  criterio_duracion: CriterioDuracion;
  por_analista: number;
  analistas: ItemCatalogo[];
  estado: EstadoCampana;
  error: string | null;
  creado_por: string;
  creado_en: string | null;
  iniciado_por: string | null;
  iniciado_en: string | null;
  terminado_en: string | null;
  actualizado_en: string | null;
}

/** Fila del listado: el backend manda conteos (en el detalle, `llamadas` es la lista). */
export interface CampanaListada extends Campana {
  llamadas: number;
  solicitadas: number;
  con_error: number;
}

export interface Llamada {
  id: number;
  conversation_id: string;
  agent_id: string;
  agent_nombre: string | null;
  cola_id: string | null;
  inicio: string | null;
  segundos_total: number | null;
  segundos_agente: number | null;
  /** Cuántas llamadas había para sortear de este analista («N de M»). */
  pool: number | null;
  seleccionada: boolean;
  estado: string;
  evaluation_id: string | null;
  error: string | null;
  solicitada_en: string | null;
  estado_genesys: string | null;
  puntaje: number | null;
  puntaje_max: number | null;
  resultado_en: string | null;
  enlace_genesys: string;
}

export interface CampanaDetalle extends Campana {
  llamadas: Llamada[];
}

export interface PreguntaResultado {
  pregunta: string;
  respuesta: string | null;
  puntaje: number | null;
  comentario: string | null;
}

export interface GrupoResultado {
  grupo: string;
  puntaje: number | null;
  maximo: number | null;
  preguntas: PreguntaResultado[];
}

export interface LlamadaDetalle extends Llamada {
  detalle: GrupoResultado[] | null;
}

export interface NuevaCampana {
  nombre: string;
  form_id: string;
  /** ISO en UTC. */
  desde: string;
  hasta: string;
  sentido: Sentido;
  modo_cola: ModoCola;
  cola_ids: string[];
  duracion_min_seg: number;
  criterio_duracion: CriterioDuracion;
  por_analista: number;
  analistas: ItemCatalogo[];
}

const BASE = '/api/monitor-ia';

@Injectable({ providedIn: 'root' })
export class MonitorIaApi {
  private readonly api = inject(ApiService);

  conexion(): Promise<Conexion> {
    return this.api.fetch<Conexion>(`${BASE}/conexion`);
  }

  // ── Administrador ──────────────────────────────────────────────────────────

  configuracion(): Promise<Configuracion> {
    return this.api.fetch<Configuracion>(`${BASE}/configuracion`);
  }

  guardarConfiguracion(datos: ConfiguracionIn): Promise<Configuracion> {
    return this.api.fetch<Configuracion>(`${BASE}/configuracion`, {
      method: 'PUT',
      body: JSON.stringify(datos),
    });
  }

  probarConexion(): Promise<Configuracion> {
    return this.api.fetch<Configuracion>(`${BASE}/configuracion/probar`, { method: 'POST' });
  }

  async formulariosGenesys(): Promise<FormularioGenesys[]> {
    return (await this.api.fetch<{ items: FormularioGenesys[] }>(`${BASE}/configuracion/formularios`)).items;
  }

  async habilitarFormularios(ids: string[]): Promise<FormularioHabilitado[]> {
    return (
      await this.api.fetch<{ items: FormularioHabilitado[] }>(`${BASE}/configuracion/formularios`, {
        method: 'PUT',
        body: JSON.stringify({ ids }),
      })
    ).items;
  }

  // ── Coordinador ────────────────────────────────────────────────────────────

  async formulariosHabilitados(): Promise<FormularioHabilitado[]> {
    return (await this.api.fetch<{ items: FormularioHabilitado[] }>(`${BASE}/formularios`)).items;
  }

  async catalogo(tipo: 'colas' | 'analistas'): Promise<ItemCatalogo[]> {
    return (await this.api.fetch<{ items: ItemCatalogo[] }>(`${BASE}/catalogos/${tipo}`)).items;
  }

  async crearCampana(datos: NuevaCampana): Promise<string> {
    return (
      await this.api.fetch<{ id: string }>(`${BASE}/campanas`, {
        method: 'POST',
        body: JSON.stringify(datos),
      })
    ).id;
  }

  seleccionarLlamada(campanaId: string, llamadaId: number, seleccionada: boolean): Promise<unknown> {
    return this.api.fetch(`${BASE}/campanas/${campanaId}/llamadas/${llamadaId}`, {
      method: 'PUT',
      body: JSON.stringify({ seleccionada }),
    });
  }

  iniciar(campanaId: string): Promise<unknown> {
    return this.api.fetch(`${BASE}/campanas/${campanaId}/iniciar`, { method: 'POST' });
  }

  cancelar(campanaId: string): Promise<unknown> {
    return this.api.fetch(`${BASE}/campanas/${campanaId}/cancelar`, { method: 'POST' });
  }

  actualizarResultados(campanaId: string): Promise<{ actualizadas: number }> {
    return this.api.fetch(`${BASE}/campanas/${campanaId}/actualizar-resultados`, { method: 'POST' });
  }

  // ── Todos los roles ────────────────────────────────────────────────────────

  async campanas(): Promise<CampanaListada[]> {
    return (await this.api.fetch<{ items: CampanaListada[] }>(`${BASE}/campanas`)).items;
  }

  campana(id: string): Promise<CampanaDetalle> {
    return this.api.fetch<CampanaDetalle>(`${BASE}/campanas/${id}`);
  }

  llamada(campanaId: string, llamadaId: number): Promise<LlamadaDetalle> {
    return this.api.fetch<LlamadaDetalle>(`${BASE}/campanas/${campanaId}/llamadas/${llamadaId}`);
  }
}
