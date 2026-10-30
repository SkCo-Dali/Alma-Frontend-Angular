// Cliente de Monitor-IA para casos de Salesforce — alma-backend /api/monitor-ia/casos/*.
// Calificación con IA de casos cerrados (flujos CORREO y CHAT): reemplaza a las Logic
// Apps de SAC que escribían en Calibracion_CasosEscritos.xlsx. Mismos permisos que las
// campañas de llamadas (PERM_VIEW / PERM_CAMPANAS / PERM_CONFIG de monitor-ia.api).

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { ItemCatalogo } from './monitor-ia.api';

export type Flujo = 'CORREO' | 'CHAT';

export type EstadoCampanaCasos = 'PREVISUALIZANDO' | 'PREVISUALIZADO' | 'EJECUTANDO' | 'TERMINADA' | 'CANCELADA' | 'ERROR';

export type EstadoCaso = 'PENDIENTE' | 'CALIFICADO' | 'SIN_TEXTO' | 'ERROR';

/** Conexión con Salesforce y topes vigentes (sin credenciales). */
export interface ConexionSf {
  configurada: boolean;
  verificada_en: string | null;
  max_por_lote: number;
  max_por_dia: number;
  concurrencia: number;
}

/** Lo que ve el Administrador: el secreto NUNCA viaja, solo si existe. */
export interface ConfiguracionSf extends ConexionSf {
  instancia: string | null;
  client_id: string | null;
  tiene_secreto: boolean;
  api_version: string;
  actualizado_por: string | null;
  actualizado_en: string | null;
}

export interface ConfiguracionSfIn {
  instancia: string;
  client_id: string | null;
  /** Vacío o null = conservar el secreto guardado. */
  client_secret: string | null;
  api_version: string;
  max_por_lote: number;
  max_por_dia: number;
  concurrencia: number;
}

export interface Criterio {
  clave: string;
  nombre: string;
}

export interface PlantillaIn {
  origenes: string[];
  responder_a_excluir: string[];
  prompt_sistema: string;
  prompt_usuario: string;
  criterios: Criterio[];
  modelo: string;
}

export interface Plantilla extends PlantillaIn {
  id: number;
  flujo: Flujo;
  version: number;
  activa: boolean;
  creado_por: string;
  creado_en: string | null;
}

export interface VersionPlantilla {
  id: number;
  version: number;
  modelo: string;
  activa: boolean;
  creado_por: string;
  creado_en: string | null;
}

export interface PlantillaVigente {
  vigente: Plantilla;
  versiones: VersionPlantilla[];
  modelos: string[];
  /** Marcas que el mensaje del caso debe incluir: {descripcion} y {solucion}. */
  marcas: string[];
}

export interface ResultadoIa {
  resumen: string;
  calificacion_general: Record<string, 'Si' | 'No'>;
  analisis_general: string;
}

export interface PruebaPlantilla extends ResultadoIa {
  cumplidos: number;
  total: number;
  modelo: string;
}

export interface Propietario extends ItemCatalogo {
  casos: number;
}

export interface CampanaCasos {
  id: string;
  nombre: string;
  flujo: Flujo;
  desde: string;
  hasta: string;
  por_propietario: number;
  propietarios: ItemCatalogo[];
  estado: EstadoCampanaCasos;
  error: string | null;
  creado_por: string;
  creado_en: string | null;
  iniciado_por: string | null;
  iniciado_en: string | null;
  terminado_en: string | null;
  actualizado_en: string | null;
}

/** Fila del listado: el backend manda conteos (en el detalle, `casos` es la lista). */
export interface CampanaCasosListada extends CampanaCasos {
  casos: number;
  calificados: number;
  con_error: number;
}

export interface Caso {
  id: number;
  case_id: string;
  case_number: string | null;
  owner_id: string;
  owner_nombre: string | null;
  origen: string | null;
  responder_a: string | null;
  tipo: string | null;
  tema: string | null;
  topic: string | null;
  producto: string | null;
  asesor_comercial: string | null;
  se_puede_autogestionar: string | null;
  resuelto_a_favor: string | null;
  actualizacion_datos: string | null;
  confirma_datos: string | null;
  efectividad_contacto: string | null;
  creado_en: string | null;
  cerrado_en: string | null;
  /** Cuántos casos había para sortear de este propietario («N de M»). */
  pool: number | null;
  seleccionada: boolean;
  estado: EstadoCaso;
  error: string | null;
  plantilla_id: number | null;
  modelo: string | null;
  cumplidos: number | null;
  total_criterios: number | null;
  resultado: ResultadoIa | null;
  calificado_en: string | null;
  enlace_salesforce: string | null;
}

export interface CampanaCasosDetalle extends CampanaCasos {
  casos: Caso[];
}

export interface NuevaCampanaCasos {
  nombre: string;
  flujo: Flujo;
  /** ISO en UTC, sobre la fecha de cierre. */
  desde: string;
  hasta: string;
  por_propietario: number;
  propietarios: ItemCatalogo[];
}

const BASE = '/api/monitor-ia/casos';

@Injectable({ providedIn: 'root' })
export class MonitorIaCasosApi {
  private readonly api = inject(ApiService);

  conexion(): Promise<ConexionSf> {
    return this.api.fetch<ConexionSf>(`${BASE}/conexion`);
  }

  // ── Administrador ────────────────────────────────────────────────────────

  configuracion(): Promise<ConfiguracionSf> {
    return this.api.fetch<ConfiguracionSf>(`${BASE}/configuracion`);
  }

  guardarConfiguracion(datos: ConfiguracionSfIn): Promise<ConfiguracionSf> {
    return this.api.fetch<ConfiguracionSf>(`${BASE}/configuracion`, { method: 'PUT', body: JSON.stringify(datos) });
  }

  probarConexion(): Promise<ConfiguracionSf> {
    return this.api.fetch<ConfiguracionSf>(`${BASE}/configuracion/probar`, { method: 'POST' });
  }

  plantilla(flujo: Flujo): Promise<PlantillaVigente> {
    return this.api.fetch<PlantillaVigente>(`${BASE}/plantillas/${flujo}`);
  }

  version(flujo: Flujo, id: number): Promise<Plantilla> {
    return this.api.fetch<Plantilla>(`${BASE}/plantillas/${flujo}/versiones/${id}`);
  }

  guardarPlantilla(flujo: Flujo, datos: PlantillaIn): Promise<Plantilla> {
    return this.api.fetch<Plantilla>(`${BASE}/plantillas/${flujo}`, { method: 'PUT', body: JSON.stringify(datos) });
  }

  restaurarVersion(flujo: Flujo, id: number): Promise<Plantilla> {
    return this.api.fetch<Plantilla>(`${BASE}/plantillas/${flujo}/versiones/${id}/restaurar`, { method: 'POST' });
  }

  /** La IA puede tardar: se espera más que una consulta normal. */
  probarPlantilla(flujo: Flujo, datos: PlantillaIn, caseNumber: string): Promise<PruebaPlantilla> {
    return this.api.fetch<PruebaPlantilla>(
      `${BASE}/plantillas/${flujo}/probar`,
      { method: 'POST', body: JSON.stringify({ ...datos, case_number: caseNumber }) },
      120_000,
    );
  }

  // ── Coordinador ──────────────────────────────────────────────────────────

  async propietarios(flujo: Flujo, desde: string, hasta: string): Promise<Propietario[]> {
    return (
      await this.api.fetch<{ items: Propietario[] }>(`${BASE}/propietarios`, {
        method: 'POST',
        body: JSON.stringify({ flujo, desde, hasta }),
      })
    ).items;
  }

  async crearCampana(datos: NuevaCampanaCasos): Promise<string> {
    return (await this.api.fetch<{ id: string }>(`${BASE}/campanas`, { method: 'POST', body: JSON.stringify(datos) })).id;
  }

  seleccionarCaso(campanaId: string, casoId: number, seleccionada: boolean): Promise<unknown> {
    return this.api.fetch(`${BASE}/campanas/${campanaId}/casos/${casoId}`, {
      method: 'PUT',
      body: JSON.stringify({ seleccionada }),
    });
  }

  iniciar(campanaId: string): Promise<unknown> {
    return this.api.fetch(`${BASE}/campanas/${campanaId}/iniciar`, { method: 'POST' });
  }

  reintentar(campanaId: string): Promise<{ reintentados: number }> {
    return this.api.fetch(`${BASE}/campanas/${campanaId}/reintentar`, { method: 'POST' });
  }

  cancelar(campanaId: string): Promise<unknown> {
    return this.api.fetch(`${BASE}/campanas/${campanaId}/cancelar`, { method: 'POST' });
  }

  async exportar(campanaId: string): Promise<{ blob: Blob; nombre: string }> {
    const res = await this.api.fetchRaw(`${BASE}/campanas/${campanaId}/exportar`);
    if (!res.ok) {
      let detalle: unknown = null;
      try {
        detalle = (await res.json())?.detail;
      } catch {
        /* sin cuerpo JSON */
      }
      throw new Error(typeof detalle === 'string' ? detalle : `No se pudo exportar (HTTP ${res.status}).`);
    }
    const nombre = /filename="?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'monitor-ia-casos.xlsx';
    return { blob: await res.blob(), nombre };
  }

  // ── Todos los roles ──────────────────────────────────────────────────────

  async campanas(): Promise<CampanaCasosListada[]> {
    return (await this.api.fetch<{ items: CampanaCasosListada[] }>(`${BASE}/campanas`)).items;
  }

  campana(id: string): Promise<CampanaCasosDetalle> {
    return this.api.fetch<CampanaCasosDetalle>(`${BASE}/campanas/${id}`);
  }
}
