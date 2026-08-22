// Cliente del módulo Motor de Suscripción (alma-backend).
// Port 1:1 de lib/suscripcion.api.ts del front React (contrato v4).

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

export type DecisionSlug =
  | 'emision_automatica'
  | 'emision_estandar'
  | 'alerta_estandar'
  | 'condicionada'
  | 'flujo_suscriptor'
  | 'devolucion'
  | 'bloqueado';

export interface AlertaApi {
  variable: string;
  condicion: string;
  mensaje: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
}

export interface EvaluacionApi {
  id: string;
  decision: string;
  decision_slug: DecisionSlug;
  /** Producto cuyas reglas aplicó el motor (p. ej. "Crea Ahorro"). */
  producto?: string | null;
  /** Slug del producto del motor (crea_patrimonio | crea_ahorro). */
  producto_slug?: string | null;
  imc: number | null;
  edad: number | null;
  disponible: number | null;
  relacion_prima: number | null;
  alertas: AlertaApi[];
  exclusiones: string[];
  evaluada_por: string;
  evaluada_en: string | null;
}

/** Datos de la cotización de afiliaciones (espejo de TrkApplications). */
export interface AfiliacionApi {
  product_code: string | null;
  producto_desc: string | null;
  uw_status: string | null;
  uw_status_desc: string | null;
  sub_status: string | null;
  sub_status_desc: string | null;
  canal_venta: string | null;
  usuario_afiliaciones: string | null;
  agente_id: number | null;
  fecha_recepcion: string | null;
  fecha_cotizacion_pharos: string | null;
  contrato_pharos: string | null;
  cumulo_total: number | null;
  source_id: number | null;
  emitible: boolean;
  motivo_no_emitible: string | null;
}

/**
 * Detalle COMPLETO de la afiliación (script de Pipeline 2.0 ya traducido por el
 * backend). Todos los strings pueden ser null; la UI oculta cada campo nulo.
 */
export interface AfiliacionDetalleApi {
  estado_poliza: string | null;
  subestado_poliza: string | null;
  producto: string | null;
  mes_afiliacion: string | null;
  fecha_recepcion_afiliacion: string | null;
  fecha_iron_mountain: string | null;
  usuario_afiliaciones: string | null;
  numero_cotizacion: string | null;
  fecha_cotizacion_pharos: string | null;
  contrato_ulla: string | null;
  iniciativa: string | null;
  asistencia: string | null;
  observaciones: string | null;
  tomador: {
    tipo_documento: string | null;
    numero_documento: string | null;
    nombre: string | null;
  };
  asegurado: {
    tipo_documento: string | null;
    numero_documento: string | null;
    nombre: string | null;
    fecha_nacimiento: string | null;
    edad: number | null;
    genero: string | null;
    telefono: string | null;
    celular: string | null;
    ciudad_cliente: string | null;
    ciudad_afiliacion: string | null;
    /** Ciudad de residencia (chankla) — la que usa el motor. */
    ciudad_residencia: string | null;
    direccion_residencia: string | null;
  };
  empresa: { nit: string | null; nombre: string | null };
  comercial: {
    codigo_agente: string | null;
    id_agente: string | null;
    nombre_agente: string | null;
    tipo_agente: string | null;
    agencia: string | null;
    director_comercial: string | null;
    canal: string | null;
  };
  condiciones: {
    forma_pago: string | null;
    periodicidad: string | null;
    valor_asegurado: number | null;
    prima_aporte: number | null;
    vigencia_meses: number | null;
    ape: number | null;
    causal_retencion: string | null;
    poliza_asegurable: string | null;
    cobertura: string | null;
    estado_cobertura: string | null;
  };
  sumas: {
    vida_ahorro: number | null;
    vida_incapacidad: number | null;
    capital_seguro: number | null;
    crea_patrimonio: number | null;
    total_cumulo: number | null;
  };
  proceso: {
    fecha_recibida_estudio: string | null;
    fecha_envio_correo_asesor: string | null;
    fecha_respuesta_asesor: string | null;
    contrato_pharos: string | null;
    fecha_emision: string | null;
    usuario_emision: string | null;
    fecha_limite_pago_primera: string | null;
    dias_para_pago: number | null;
    fecha_pago: string | null;
    motivo_rechazo_retracto: string | null;
  };
  examenes: {
    tipo: string | null;
    fecha_envio_solicitud: string | null;
    numero_cita: string | null;
    fecha_llamada_cliente: string | null;
    fecha_cita: string | null;
    direccion_domicilio: string | null;
    fecha_prueba_esfuerzo: string | null;
    unidad: string | null;
    observaciones_proveedor: string | null;
    fecha_entrega_resultados: string | null;
  };
  reaseguro: {
    fecha_envio: string | null;
    fecha_recibido: string | null;
    observaciones: string | null;
  };
}

export interface SolicitudApi {
  id: string;
  nro_cotizacion: string;
  fecha_ingreso: string;
  asegurado: {
    nombre: string;
    cedula: string;
    // Nulos cuando la solicitud llegó por sync de afiliaciones y aún no se completa
    fecha_nacimiento: string | null;
    genero: 'M' | 'F' | null;
    ciudad: string | null;
    ocupacion: string | null;
  };
  producto: {
    suma_asegurada: number;
    prima_mensual: number;
    anios_vigencia: number;
  };
  financiero: { ingresos: number; egresos: number };
  medico: {
    peso: number | null;
    talla: number | null;
    cardiovascular: boolean;
    diabetes: boolean;
    oncologico: boolean;
    pulmonar: boolean;
    neurologico: boolean;
    cirugia: boolean;
    tabaco: boolean;
    alcohol: boolean;
    discapacidad: boolean;
    medicacion: boolean;
  };
  beneficiarios: Array<{ nombre: string; porcentaje: number; parentesco: string }>;
  metadatos: { asesor: string | null; canal: string };
  afiliacion: AfiliacionApi | null;
  declaraciones: {
    todas_negativas: boolean | null;
    covid_positivo: boolean;
    retiene_por_salud: boolean;
    fecha: string;
  } | null;
  evaluacion: EvaluacionApi | null;
}

// ── Declaraciones (cuestionario de asegurabilidad desde Pharos) ──────────────

export interface DeclaracionItemApi {
  code: string | null;
  descripcion: string | null;
  tipoApi: number | null;
  tipoBlob: string | null;
  valor: string | null;
  ddeclarationid: string;
  calibrada: boolean;
  /** Visibilidad en Pharos: 4 = oculta. null en snapshots antiguos. */
  visibleType?: number | null;
}

export interface DeclaracionFormApi {
  formCode: string | null;
  descripcion: string | null;
  ddeclarationFormId: string;
  declaraciones: DeclaracionItemApi[];
}

export interface AnalisisDeclaracionesApi {
  todasNegativas: boolean | null;
  casillasPositivas: string[];
  bloquesDetalle: Record<string, string>;
  covidPositivo: boolean;
  covidFecha: string | null;
  covidVacunado: boolean;
  covidDosis: string | null;
  retieneContratoPorSalud: boolean;
  peso: string | null;
  estatura: string | null;
}

export interface DeclaracionesApi {
  todas_negativas: boolean | null;
  fecha: string;
  analisis: AnalisisDeclaracionesApi | null;
  contenido: Array<{
    nodeId: number | null;
    displayName: string | null;
    nodeStatus: string | null;
    formularios: DeclaracionFormApi[];
    declaracionesRaiz?: DeclaracionItemApi[] | null;
    sinCalibrar: number;
  }> | null;
  pharos: {
    proposalNo: string | null;
    contractNo: string | null;
    wStatus: number | null;
    nodos: Array<Record<string, unknown>> | null;
  };
}

export interface Verificaciones {
  cumulo_verificado: boolean;
  pipeline_revisado: boolean;
  pharos_revisado: boolean;
  filenet_localizado: boolean;
  correo_revisado: boolean;
}

export interface DatosEvaluables {
  fecha_nacimiento: string;
  genero: 'M' | 'F';
  ciudad: string;
  ocupacion: string;
  suma_asegurada: number;
  prima_mensual: number;
  anios_vigencia: number;
  ingresos: number;
  egresos: number;
  peso: number;
  talla: number;
  cardiovascular: boolean;
  diabetes: boolean;
  oncologico: boolean;
  pulmonar: boolean;
  neurologico: boolean;
  cirugia: boolean;
  tabaco: boolean;
  alcohol: boolean;
  discapacidad: boolean;
  medicacion: boolean;
  verificaciones?: Verificaciones;
}

// ── Motor de Cúmulo (política POL-ADC-01-11-01 v13) ─────────────────────────

export type NivelCumulo = 'bajo' | 'medio' | 'alto' | 'limite_reaseguro';

export interface CumuloAlertaApi {
  codigo: string;
  nivel: 'error' | 'advertencia' | 'info';
  mensaje: string;
}

export interface CumuloPolizaApi {
  numero_poliza: string;
  producto: string;
  producto_pharos: string;
  suma_asegurada: number;
  fin_vigencia: string | null;
}

export interface CumuloResultadoApi {
  cumulo_acumulado: number;
  cumulo_total: number;
  nivel: NivelCumulo;
  requiere_asegurabilidad: boolean;
  requiere_examenes: boolean;
  nivel_examen: 'ninguno' | 'A' | 'B' | 'C' | 'D' | 'E';
  examen_detalle: string;
  suma_nueva_valida: boolean;
  supera_reaseguro: boolean;
  psa_requerido: boolean;
  alertas: CumuloAlertaApi[];
  tercero: { partyCode: string; nombre: string } | null;
  polizas_vigentes: CumuloPolizaApi[];
  advertencias: string[];
}

export interface CuentaPharosApi {
  conectada: boolean;
  estado: 'conectada' | 'requiere_refresco' | null;
  pharos_user?: string;
  ultima_verificacion?: string | null;
}

@Injectable({ providedIn: 'root' })
export class SuscripcionApi {
  private readonly api = inject(ApiService);

  /** Detalle de una solicitud (subpágina de la bandeja). */
  getSolicitud(solicitudId: string): Promise<SolicitudApi> {
    return this.api.fetch<SolicitudApi>(`/api/suscripcion/solicitudes/${solicitudId}`);
  }

  /** Detalle completo de la afiliación (todos los campos del Pipeline 2.0). */
  getAfiliacion(solicitudId: string): Promise<AfiliacionDetalleApi> {
    return this.api.fetch<AfiliacionDetalleApi>(
      `/api/suscripcion/solicitudes/${solicitudId}/afiliacion`,
    );
  }

  evaluarSolicitud(solicitudId: string, datos?: DatosEvaluables): Promise<EvaluacionApi> {
    return this.api.fetch<EvaluacionApi>(
      `/api/suscripcion/solicitudes/${solicitudId}/evaluar`,
      { method: 'POST', body: datos ? JSON.stringify(datos) : 'null' },
    );
  }

  getDeclaraciones(solicitudId: string): Promise<DeclaracionesApi> {
    return this.api.fetch<DeclaracionesApi>(
      `/api/suscripcion/solicitudes/${solicitudId}/declaraciones`,
    );
  }

  /** Verificación de cúmulo contra Pharos (pólizas vigentes del asegurado). */
  verificarCumulo(solicitudId: string): Promise<CumuloResultadoApi> {
    return this.api.fetch<CumuloResultadoApi>(
      `/api/suscripcion/solicitudes/${solicitudId}/cumulo`,
      { method: 'POST' },
    );
  }

  emitirSolicitud(
    solicitudId: string,
    confirmacion: string,
  ): Promise<{ contrato: string; advertencia: string | null }> {
    return this.api.fetch(`/api/suscripcion/solicitudes/${solicitudId}/emitir`, {
      method: 'POST',
      body: JSON.stringify({ confirmacion }),
    });
  }

  // ── Cuenta de Pharos del usuario (emisión a su nombre) ────────────────────

  getCuentaPharos(): Promise<CuentaPharosApi> {
    return this.api.fetch<CuentaPharosApi>('/api/suscripcion/cuenta-pharos');
  }

  conectarCuentaPharos(pharosUser: string, password: string): Promise<CuentaPharosApi> {
    return this.api.fetch<CuentaPharosApi>('/api/suscripcion/cuenta-pharos', {
      method: 'PUT',
      body: JSON.stringify({ pharos_user: pharosUser, password }),
    });
  }

  desconectarCuentaPharos(): Promise<{ conectada: boolean }> {
    return this.api.fetch('/api/suscripcion/cuenta-pharos', { method: 'DELETE' });
  }
}
