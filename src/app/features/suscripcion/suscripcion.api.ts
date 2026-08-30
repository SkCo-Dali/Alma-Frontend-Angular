// Cliente del módulo Motor de Suscripción (alma-backend).

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
  /** v3: qué pedirle al asesor, redactado por suscripción en el catálogo. */
  requisito?: string;
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
  // Cúmulo REAL del cliente (control de cúmulos vía bridge: pólizas vigentes
  // + cotizaciones en trámite). Null = el bridge no respondió; se ocultan las
  // filas en vez de mostrar el TotalCumulus de Pipeline, que nunca acumula.
  sumas: {
    crea_ahorro: number | null;
    crea_patrimonio: number | null;
    capital_seguro: number | null;
    vida_incapacidad: number | null;
    crea_serenidad: number | null;
    total_cumulo: number | null;
    polizas_vigentes: number | null;
    en_tramite: number | null;
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
    // Nulos cuando la solicitud llegó por sync de afiliaciones y aún no se completa.
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
    covid_vacunado: boolean;
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

/** Tercero (rol) del nodo Pharos: pestaña "Terceros" de la cotización. */
export interface TerceroApi {
  tipo: string; // Tomador | Asegurado | Beneficiario | Pagador | Agente | Rol N
  dRoleid: string;
  nombre: string | null;
  partyCode: string | null;
  porcentaje: number | null;
  nivel: number;
  parentesco: string | null; // solo beneficiarios
  visibleType: number | null;
  activo: boolean;
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
    /** Terceros del nodo (bridge nuevo; snapshots viejos no lo traen). */
    terceros?: TerceroApi[] | null;
    sinCalibrar: number;
  }> | null;
  pharos: {
    proposalNo: string | null;
    contractNo: string | null;
    wStatus: number | null;
    nodos: Array<Record<string, unknown>> | null;
  };
}

/** Fila del historial de Control Emisión del cliente (pólizas anteriores). */
export interface HistorialClienteItemApi {
  nro_cotizacion: string | null;
  es_actual: boolean;
  producto: string | null;
  fecha_recepcion: string | null;
  estado: string | null;
  subestado: string | null;
  suma_asegurada: number | null;
  cobertura: string | null;
  estado_cobertura: string | null;
  contrato_pharos: string | null;
  fecha_emision: string | null;
  fecha_pago: string | null;
  motivo_rechazo_retracto: string | null;
  observaciones: string | null;
  observaciones_reaseguro: string | null;
  observaciones_examenes: string | null;
}

/** Producto del portafolio del cliente en Skandia (Sigscg.Contrato). */
export interface ProductoClienteApi {
  productCode: string | null;
  productoDesc: string | null;
  planProducto: string | null;
  contrato: string | null;
  estadoCodigo: string | null;
  estado: string | null;
  fechaInicio: string | null;
  fechaTerminacion: string | null;
}

/** Plantilla de correo de suscripción (galería estilo Dali). */
export interface PlantillaCorreoApi {
  id: string;
  nombre: string;
  categoria: string;
  asunto: string;
  cuerpo_html: string;
  activa: boolean;
  creada_en: string;
  creada_por: string;
  actualizada_en: string | null;
  actualizada_por: string | null;
}

export interface PlantillaCorreoIn {
  nombre: string;
  categoria?: string;
  asunto: string;
  cuerpo_html: string;
}

/** Correo del buzón de suscripción relacionado con el cliente. */
export interface CorreoClienteApi {
  asunto: string | null;
  de: string | null;
  de_nombre: string | null;
  para: Array<string | null>;
  fecha: string | null;
  resumen: string | null;
  enlace: string | null;
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
  // v3: ítems de catálogo que la bandeja no guarda como columna. Solo
  // alimentan la evaluación; el backend no los persiste en la solicitud.
  pais_residencia?: string | null;
  hobbies?: string[];
  preexistencias?: string[];
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


// ── Estados de Control y Emisión (escritura en Pipeline) ─────────────────────
// Un método por caso del documento "ESTADOS CONTROL Y EMISIÓN" (ago-2026).

/** Casos que el analista puede aplicar sobre la cotización en Pipeline. */
export type CasoEstado =
  | 'informacion_adicional'
  | 'pendiente_fondeo'
  | 'examen_medico'
  | 'reaseguro'
  | 'cobertura'
  | 'examenes'
  | 'reaseguro_seguimiento';

export interface EstadosCatalogosApi {
  subestados: Record<string, string>;
  cobertura: Record<string, string>;
  estadoCobertura: Record<string, string>;
  unidadExamenes: Record<string, string>;
  paquetesExamen: string[];
  /** Longitudes reales de las columnas de TrkApplications (el borde corta ahí). */
  observacionesMax: number;
  numeroCitaMax: number;
  direccionMax: number;
}

export interface EstadoAplicadoApi {
  actualizadas: number;
  nro_cotizacion: string;
  accion: string;
  /** Aviso no bloqueante (p. ej. fondeo sobre un producto que no es Capital + Seguro). */
  advertencia?: string;
}

/** Campos de la pantalla "Registro Exámenes Médicos"; los omitidos no se tocan. */
export interface ExamenesIn {
  tipo_examen?: string | null;
  fecha_envio_solicitud?: string | null;
  numero_cita?: string | null;
  fecha_llamada_cliente?: string | null;
  fecha_cita?: string | null;
  direccion_domicilio?: string | null;
  fecha_prueba_esfuerzo?: string | null;
  unidad?: string | null;
  observaciones_proveedor?: string | null;
  fecha_entrega_resultados?: string | null;
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

  /** Pólizas/cotizaciones ANTERIORES del asegurado en Control Emisión. */
  getHistorialCliente(solicitudId: string): Promise<{ items: HistorialClienteItemApi[]; count: number }> {
    return this.api.fetch(`/api/suscripcion/solicitudes/${solicitudId}/historial-cliente`);
  }

  /** Portafolio del cliente en Skandia (todos los cores, sin saldos). */
  getProductosCliente(solicitudId: string): Promise<{ items: ProductoClienteApi[]; count: number }> {
    return this.api.fetch(`/api/suscripcion/solicitudes/${solicitudId}/productos-cliente`);
  }

  /** Correos del buzón de suscripción que mencionan la cédula/cotización. */
  getCorreosCliente(solicitudId: string): Promise<{ items: CorreoClienteApi[]; count: number }> {
    return this.api.fetch(`/api/suscripcion/solicitudes/${solicitudId}/correos`);
  }

  /**
   * Envía el correo de suscripción al FP (CC opcional al director), en modo
   * libre (cuerpo de texto plano) o con plantilla (plantilla_id + mensaje;
   * el HTML lo renderiza el servidor).
   */
  enviarCorreoAsesor(
    solicitudId: string,
    body: {
      asunto: string;
      cuerpo?: string | null;
      plantilla_id?: string | null;
      mensaje?: string | null;
      copiar_director: boolean;
    },
  ): Promise<{ enviado: boolean; para: string; cc: string[] }> {
    return this.api.fetch(`/api/suscripcion/solicitudes/${solicitudId}/correo-asesor`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ── Plantillas de correo (galería estilo Dali) ─────────────────────────────

  getPlantillasCorreo(
    soloActivas = false,
  ): Promise<{ items: PlantillaCorreoApi[]; variables: Record<string, string> }> {
    return this.api.fetch(
      `/api/suscripcion/correo-plantillas?solo_activas=${soloActivas}`,
    );
  }

  crearPlantillaCorreo(body: PlantillaCorreoIn): Promise<PlantillaCorreoApi> {
    return this.api.fetch('/api/suscripcion/correo-plantillas', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  actualizarPlantillaCorreo(
    id: string,
    body: Partial<PlantillaCorreoIn> & { activa?: boolean },
  ): Promise<PlantillaCorreoApi> {
    return this.api.fetch(`/api/suscripcion/correo-plantillas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  eliminarPlantillaCorreo(id: string): Promise<void> {
    return this.api.fetch(`/api/suscripcion/correo-plantillas/${id}`, {
      method: 'DELETE',
    });
  }

  /** Vista previa de la plantilla con los datos reales de la cotización. */
  renderPlantillaCorreo(
    solicitudId: string,
    plantillaId: string,
  ): Promise<{
    asunto: string;
    cuerpo_html: string;
    para: string | null;
    cc_director: string | null;
    usa_mensaje: boolean;
  }> {
    return this.api.fetch(
      `/api/suscripcion/solicitudes/${solicitudId}/correo-plantillas/${plantillaId}/render`,
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
    opciones?: { cobertura?: 'VT' | 'VI'; observaciones?: string },
  ): Promise<{ contrato: string; advertencia: string | null }> {
    return this.api.fetch(`/api/suscripcion/solicitudes/${solicitudId}/emitir`, {
      method: 'POST',
      body: JSON.stringify({
        confirmacion,
        cobertura: opciones?.cobertura ?? null,
        observaciones: opciones?.observaciones || null,
      }),
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

  // ── Estados de Control y Emisión ──────────────────────────────────────────
  // Escriben en Pipeline (TrkApplications) vía backend + bridge. La respuesta
  // trae cuántas filas se actualizaron; 0 nunca llega (el backend lo vuelve 409).

  getCatalogosEstados(): Promise<EstadosCatalogosApi> {
    return this.api.fetch<EstadosCatalogosApi>(
      '/api/suscripcion/solicitudes/estados/catalogos',
    );
  }

  private postEstado(
    solicitudId: string,
    ruta: string,
    body: unknown,
  ): Promise<EstadoAplicadoApi> {
    return this.api.fetch<EstadoAplicadoApi>(
      `/api/suscripcion/solicitudes/${solicitudId}/${ruta}`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  }

  marcarInformacionAdicional(
    solicitudId: string,
    fechaCorreoAsesor: string | null,
    observaciones: string | null,
  ): Promise<EstadoAplicadoApi> {
    return this.postEstado(solicitudId, 'estado/informacion-adicional', {
      fecha_correo_asesor: fechaCorreoAsesor,
      observaciones,
    });
  }

  marcarPendienteFondeo(
    solicitudId: string,
    fechaCorreoAsesor: string | null,
    observaciones: string | null,
  ): Promise<EstadoAplicadoApi> {
    return this.postEstado(solicitudId, 'estado/pendiente-fondeo', {
      fecha_correo_asesor: fechaCorreoAsesor,
      observaciones,
    });
  }

  marcarExamenMedico(
    solicitudId: string,
    observaciones: string | null,
  ): Promise<EstadoAplicadoApi> {
    return this.postEstado(solicitudId, 'estado/examen-medico', { observaciones });
  }

  marcarReaseguro(
    solicitudId: string,
    observaciones: string | null,
  ): Promise<EstadoAplicadoApi> {
    return this.postEstado(solicitudId, 'estado/reaseguro', { observaciones });
  }

  definirCobertura(
    solicitudId: string,
    estadoCobertura: string,
    cobertura: string | null,
    observaciones: string | null,
  ): Promise<EstadoAplicadoApi> {
    return this.postEstado(solicitudId, 'estado/cobertura', {
      estado_cobertura: estadoCobertura,
      cobertura,
      observaciones,
    });
  }

  registrarExamenes(solicitudId: string, campos: ExamenesIn): Promise<EstadoAplicadoApi> {
    return this.postEstado(solicitudId, 'examenes', campos);
  }

  registrarReaseguro(
    solicitudId: string,
    fechaEnvio: string | null,
    fechaRecibido: string | null,
    observaciones: string | null,
  ): Promise<EstadoAplicadoApi> {
    return this.postEstado(solicitudId, 'reaseguro/seguimiento', {
      fecha_envio: fechaEnvio,
      fecha_recibido: fechaRecibido,
      observaciones,
    });
  }
}

