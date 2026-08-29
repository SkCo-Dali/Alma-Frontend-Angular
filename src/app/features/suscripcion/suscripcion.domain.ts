// Tipos de dominio, mapper y badges del Motor de Suscripción. El "Estado Alma" interno
// (pendiente/en_revision/…/emitido) se ELIMINÓ de la plataforma: el único estado visible
// es el del Pipeline (uw_status). La bandeja se alimenta del grid server-side; el
// journey de etapas se nutre de POST /distincts {field:'EstadoPipeline'}.

import { AfiliacionApi, DecisionSlug, EvaluacionApi, SolicitudApi } from './suscripcion.api';

export type Decision = DecisionSlug;

export interface Alerta {
  variable: string;
  condicion: string;
  mensaje: string;
  prioridad: 'alta' | 'media';
  /** v3: qué pedirle al asesor, redactado por suscripción en el catálogo. */
  requisito: string;
}

export interface Evaluacion {
  evaluacion_id: string | null;
  decision: Decision;
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

export interface ResumenDeclaraciones {
  todas_negativas: boolean | null;
  covid_positivo: boolean;
  covid_vacunado: boolean;
  retiene_por_salud: boolean;
  fecha: string;
}

export interface Tarea {
  tarea_id: string;
  nro_cotizacion: string;
  fecha_ingreso: string;
  asegurado: {
    nombre: string;
    cedula: string;
    fecha_nacimiento: string;
    genero: 'F' | 'M';
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
  metadatos: { asesor: string; canal: string };
  afiliacion: AfiliacionApi | null;
  declaraciones: ResumenDeclaraciones | null;
  /** Datos del asegurado aún sin completar (llegó por sync y falta chankla). */
  datos_incompletos: boolean;
  evaluacion: Evaluacion;
}

export const DECISION_META: Record<
  Decision,
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
      // Las evaluaciones anteriores a v3 no lo traen.
      requisito: a.requisito ?? '',
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

export function apiToTarea(dto: SolicitudApi): Tarea {
  const disponible = dto.financiero.ingresos - dto.financiero.egresos;
  const datosIncompletos =
    !dto.asegurado.fecha_nacimiento ||
    !dto.asegurado.genero ||
    dto.medico.peso == null ||
    dto.medico.talla == null;
  return {
    tarea_id: dto.id,
    nro_cotizacion: dto.nro_cotizacion,
    fecha_ingreso: dto.fecha_ingreso,
    // Normaliza los nulos del sync de afiliaciones para los componentes que
    // editan estos campos antes de correr el motor.
    asegurado: {
      nombre: dto.asegurado.nombre,
      cedula: dto.asegurado.cedula,
      fecha_nacimiento: dto.asegurado.fecha_nacimiento ?? '',
      genero: dto.asegurado.genero ?? 'M',
      ciudad: dto.asegurado.ciudad ?? '',
      ocupacion: dto.asegurado.ocupacion ?? '',
    },
    producto: dto.producto,
    financiero: dto.financiero,
    medico: { ...dto.medico, peso: dto.medico.peso ?? 0, talla: dto.medico.talla ?? 0 },
    beneficiarios: dto.beneficiarios,
    metadatos: { asesor: dto.metadatos.asesor ?? '—', canal: dto.metadatos.canal },
    afiliacion: dto.afiliacion ?? null,
    declaraciones: dto.declaraciones
      ? {
          todas_negativas: dto.declaraciones.todas_negativas,
          covid_positivo: dto.declaraciones.covid_positivo ?? false,
          covid_vacunado: dto.declaraciones.covid_vacunado ?? false,
          retiene_por_salud: dto.declaraciones.retiene_por_salud ?? false,
          fecha: dto.declaraciones.fecha,
        }
      : null,
    datos_incompletos: datosIncompletos,
    evaluacion: dto.evaluacion
      ? evaluacionFromApi(dto.evaluacion, { disponible })
      : { ...SIN_EVALUACION, disponible_neto: disponible },
  };
}

export function fmtCOP(n: number): string {
  return '$ ' + (Number(n) || 0).toLocaleString('es-CO');
}

// ── Badges y pills compartidas ───────────────────────────────────────────────

/** Estado del pipeline de afiliaciones (TrkApplications). */
export const UW_BADGE: Record<string, string> = {
  RE: 'bg-muted text-muted-foreground',
  ES: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  EM: 'bg-primary/10 text-primary',
  PP: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  RC: 'bg-destructive/10 text-destructive',
  RT: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
};

/** Decisión del motor de suscripción. */
export const DECISION_BADGE: Record<string, string> = {
  emision_automatica: 'bg-primary/10 text-primary',
  emision_estandar:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  alerta_estandar: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  condicionada: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  flujo_suscriptor: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  devolucion: 'bg-destructive/10 text-destructive',
  bloqueado: 'bg-muted text-muted-foreground',
};

export type EstadoVeredictoSalud =
  | 'positivas'
  | 'covid_sin_restriccion'
  | 'covid_sin_vacuna'
  | 'revision'
  | 'sin_novedades'
  | 'sin_diligenciar';

export interface VeredictoSalud {
  estado: EstadoVeredictoSalud;
  label: string;
  cls: string;
  icon: string;
}

/**
 * Veredicto de salud COHERENTE a partir del resumen de declaraciones: si Pharos
 * marca COVID positivo o retención por salud, el caso pasa a "Requiere
 * revisión" en vez de "Sin novedades" (bug de badges contradictorios).
 *
 * Excepciones COVID no restrictivas (con el cuestionario de enfermedades todo en
 * "No"): (1) la ÚNICA positiva es la prueba COVID-19 (P14) → "COVID-19 · sin
 * restricción"; (2) hay retención por salud pero solo por no registrar esquema de
 * vacunación COVID → "Sin vacuna COVID · sin restricción". Ninguna marca
 * "Requiere revisión".
 */
export function veredictoSalud(d: {
  todas_negativas: boolean | null;
  covid_positivo: boolean;
  covid_vacunado: boolean;
  retiene_por_salud: boolean;
}): VeredictoSalud {
  if (d.todas_negativas === false)
    return {
      estado: 'positivas',
      label: 'Con declaraciones positivas',
      cls: 'bg-destructive/10 text-destructive',
      icon: 'alert-triangle',
    };
  // La única positiva es la prueba COVID (P14): alerta no restrictiva. Debe ir
  // ANTES de "Requiere revisión" para no restringir por la retención COVID.
  if (d.todas_negativas === true && d.covid_positivo)
    return {
      estado: 'covid_sin_restriccion',
      label: 'COVID-19 · sin restricción',
      cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
      icon: 'info',
    };
  // Retención solo por no tener esquema de vacunación COVID: tampoco restrictiva.
  // Va ANTES de la retención genérica; si estuviera vacunado, cae en "Requiere revisión".
  if (d.todas_negativas === true && d.retiene_por_salud && !d.covid_vacunado)
    return {
      estado: 'covid_sin_vacuna',
      label: 'Sin vacuna COVID',
      cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
      icon: 'info',
    };
  if (d.todas_negativas === true && d.retiene_por_salud)
    return {
      estado: 'revision',
      label: 'Requiere revisión',
      cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
      icon: 'alert-triangle',
    };
  if (d.todas_negativas === true)
    return {
      estado: 'sin_novedades',
      label: 'Sin novedades de salud',
      cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
      icon: 'shield-check',
    };
  return {
    estado: 'sin_diligenciar',
    label: 'Sin diligenciar',
    cls: 'bg-muted text-muted-foreground',
    icon: 'help-circle',
  };
}

/** Pills de Declaraciones por veredicto_slug (contrato del grid). */
export const VEREDICTO_PILL: Record<string, { cls: string; icon: string }> = {
  sin_novedades: {
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    icon: 'shield-check',
  },
  requiere_revision: {
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    icon: 'alert-triangle',
  },
  covid_sin_restriccion: {
    cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    icon: 'info',
  },
  covid_sin_vacuna: {
    cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    icon: 'info',
  },
  con_positivas: {
    cls: 'bg-destructive/10 text-destructive',
    icon: 'alert-triangle',
  },
  sin_diligenciar: {
    cls: 'bg-muted text-muted-foreground',
    icon: 'help-circle',
  },
};

/** dd/mm/aaaa desde un ISO date puro (sin conversión de zona). */
export function fmtFecha(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  const dateOnly = value.length > 10 ? value.substring(0, 10) : value;
  const [y, m, d] = dateOnly.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return value;
}
