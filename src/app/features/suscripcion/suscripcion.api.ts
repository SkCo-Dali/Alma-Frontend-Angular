// Cliente del módulo Motor de Suscripción (alma-backend) + tipos de dominio y
// mapper de la bandeja. Portado de lib/suscripcion.api.ts y features/suscripcion/data.ts.

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

export type EstadoTarea =
  | 'pendiente'
  | 'en_revision'
  | 'aprobado'
  | 'devuelto'
  | 'escalado'
  | 'emitido';

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
  imc: number | null;
  edad: number | null;
  disponible: number | null;
  relacion_prima: number | null;
  alertas: AlertaApi[];
  exclusiones: string[];
  evaluada_por: string;
  evaluada_en: string | null;
}

export interface SolicitudApi {
  id: string;
  nro_cotizacion: string;
  estado: EstadoTarea;
  fecha_ingreso: string;
  asegurado: {
    nombre: string;
    cedula: string;
    fecha_nacimiento: string;
    genero: 'M' | 'F';
    ciudad: string;
    ocupacion: string;
  };
  producto: {
    suma_asegurada: number;
    prima_mensual: number;
    anios_vigencia: number;
  };
  financiero: { ingresos: number; egresos: number };
  medico: MedicoFlags;
  beneficiarios: Array<{ nombre: string; porcentaje: number; parentesco: string }>;
  metadatos: { asesor: string | null; canal: string };
  evaluacion: EvaluacionApi | null;
}

export interface MedicoFlags {
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
}

export interface Verificaciones {
  cumulo_verificado: boolean;
  pipeline_revisado: boolean;
  pharos_revisado: boolean;
  filenet_localizado: boolean;
  correo_revisado: boolean;
}

export interface DatosEvaluables extends MedicoFlags {
  fecha_nacimiento: string;
  genero: 'M' | 'F';
  ciudad: string;
  ocupacion: string;
  suma_asegurada: number;
  prima_mensual: number;
  anios_vigencia: number;
  ingresos: number;
  egresos: number;
  verificaciones?: Verificaciones;
}

// ---- Dominio de la bandeja ----

export interface Alerta {
  variable: string;
  condicion: string;
  mensaje: string;
  prioridad: 'alta' | 'media';
}

export interface Evaluacion {
  evaluacion_id: string | null;
  decision: DecisionSlug;
  decision_label: string;
  decision_color: string;
  accion_sugerida: string;
  requiere_revision: boolean;
  imc: number;
  edad: number;
  disponible_neto: number;
  relacion_prima_pct: number;
  alertas: Alerta[];
  exclusiones: string[];
}

export interface Tarea {
  tarea_id: string;
  nro_cotizacion: string;
  estado: EstadoTarea;
  nuevo?: boolean;
  fecha_ingreso: string;
  _hrs: number;
  asegurado: SolicitudApi['asegurado'];
  producto: SolicitudApi['producto'];
  financiero: SolicitudApi['financiero'];
  medico: MedicoFlags;
  beneficiarios: SolicitudApi['beneficiarios'];
  metadatos: { asesor: string; canal: string };
  evaluacion: Evaluacion;
}

export const DECISION_META: Record<
  DecisionSlug,
  { label: string; color: string; accion: string; revision: boolean }
> = {
  emision_automatica: {
    label: 'Emisión automática',
    color: '#00C73D',
    accion: 'Emitir la póliza automáticamente. No requiere revisión manual.',
    revision: false,
  },
  emision_estandar: {
    label: 'Emisión estándar',
    color: '#007A26',
    accion: 'Continuar con el proceso de emisión estándar.',
    revision: false,
  },
  alerta_estandar: {
    label: 'Alerta — Estándar con observaciones',
    color: '#D97706',
    accion: 'Emitir con observaciones. Documentar las alertas señaladas.',
    revision: true,
  },
  condicionada: {
    label: 'Aceptada con condiciones',
    color: '#F59E0B',
    accion: 'Aplicar las exclusiones confirmadas antes de emitir.',
    revision: true,
  },
  flujo_suscriptor: {
    label: 'Flujo suscriptor',
    color: '#7C3AED',
    accion: 'Revisión manual del suscriptor requerida para este caso.',
    revision: true,
  },
  devolucion: {
    label: 'Devolución al asesor',
    color: '#DC2626',
    accion: 'Devolver al asesor. El caso no cumple los criterios delegados.',
    revision: false,
  },
  bloqueado: {
    label: 'Bloqueado',
    color: '#9CA3AF',
    accion: 'Completar las verificaciones para continuar.',
    revision: true,
  },
};

export function evaluacionFromApi(
  ev: EvaluacionApi,
  fallback: { disponible: number },
): Evaluacion {
  const meta = DECISION_META[ev.decision_slug] ?? DECISION_META['flujo_suscriptor'];
  return {
    evaluacion_id: ev.id,
    decision: ev.decision_slug,
    decision_label: meta.label,
    decision_color: meta.color,
    accion_sugerida: meta.accion,
    requiere_revision: meta.revision,
    imc: ev.imc ?? 0,
    edad: ev.edad ?? 0,
    disponible_neto: ev.disponible ?? fallback.disponible,
    relacion_prima_pct: ev.relacion_prima ?? 0,
    alertas: ev.alertas.map((a) => ({
      variable: a.variable,
      condicion: a.condicion,
      mensaje: a.mensaje,
      prioridad: a.prioridad === 'Alta' ? 'alta' : 'media',
    })),
    exclusiones: ev.exclusiones,
  };
}

const SIN_EVALUACION: Omit<Evaluacion, 'disponible_neto'> = {
  evaluacion_id: null,
  decision: 'bloqueado',
  decision_label: 'Sin evaluación',
  decision_color: '#9CA3AF',
  accion_sugerida: 'Ejecutar el motor para obtener una decisión.',
  requiere_revision: true,
  imc: 0,
  edad: 0,
  relacion_prima_pct: 0,
  alertas: [],
  exclusiones: [],
};

export function apiToTarea(dto: SolicitudApi, index: number): Tarea {
  const hrs = Math.max(
    0,
    Math.round((Date.now() - Date.parse(dto.fecha_ingreso)) / 3_600_000),
  );
  const disponible = dto.financiero.ingresos - dto.financiero.egresos;
  return {
    tarea_id: dto.id,
    nro_cotizacion: dto.nro_cotizacion,
    estado: dto.estado,
    nuevo: dto.estado === 'pendiente' && hrs <= 3 && index < 3,
    fecha_ingreso: dto.fecha_ingreso,
    _hrs: hrs,
    asegurado: dto.asegurado,
    producto: dto.producto,
    financiero: dto.financiero,
    medico: dto.medico,
    beneficiarios: dto.beneficiarios,
    metadatos: { asesor: dto.metadatos.asesor ?? '—', canal: dto.metadatos.canal },
    evaluacion: dto.evaluacion
      ? evaluacionFromApi(dto.evaluacion, { disponible })
      : { ...SIN_EVALUACION, disponible_neto: disponible },
  };
}

export function fmtCOP(n: number): string {
  return '$ ' + (Number(n) || 0).toLocaleString('es-CO');
}

export function fmtCOPShort(n: number): string {
  n = Number(n) || 0;
  if (n >= 1_000_000)
    return '$' + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  return '$' + n.toLocaleString('es-CO');
}

export function hrsTxt(h: number): string {
  if (h < 1) return 'hace min';
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

@Injectable({ providedIn: 'root' })
export class SuscripcionApi {
  private readonly api = inject(ApiService);

  async listSolicitudes(): Promise<SolicitudApi[]> {
    const data = await this.api.fetch<{ solicitudes: SolicitudApi[] }>(
      '/api/suscripcion/solicitudes',
    );
    return data.solicitudes;
  }

  evaluarSolicitud(solicitudId: string, datos?: DatosEvaluables): Promise<EvaluacionApi> {
    return this.api.fetch<EvaluacionApi>(
      `/api/suscripcion/solicitudes/${solicitudId}/evaluar`,
      { method: 'POST', body: datos ? JSON.stringify(datos) : 'null' },
    );
  }

  cambiarEstado(
    solicitudId: string,
    estado: EstadoTarea,
    comentario?: string,
  ): Promise<{ estado_anterior: EstadoTarea; estado_nuevo: EstadoTarea }> {
    return this.api.fetch(`/api/suscripcion/solicitudes/${solicitudId}/estado`, {
      method: 'POST',
      body: JSON.stringify({ estado, comentario }),
    });
  }
}
