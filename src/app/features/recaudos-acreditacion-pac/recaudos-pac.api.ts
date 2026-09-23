// Contrato y cliente de la App "Acreditación PAC" (Recaudos). Los tipos van en
// snake_case, igual que el resto de Alma, para que el backend los devuelva tal cual.
//
// Modo demostración: el módulo aún no existe en alma-backend, así que por ahora TODAS
// las lecturas y escrituras se resuelven en memoria contra recaudos-pac.demo.ts y
// `modoDemo` queda en true para que la UI lo avise. Cuando exista /api/recaudos-pac,
// cada método pasa a llamar a ApiService y la demo queda solo como respaldo (ver
// BuzonApi.conDemo, que resuelve ese mismo caso).
//
// Fuente real (Cosmos cdb-eficiencias-dev, BD recaudos_clasificador). Un pago es un
// correo, y se arma uniendo por el id del correo de Outlook dos contenedores que
// escribe el clasificador:
//   - LogEstadistica        (partición /Grupo):   lo que la IA extrajo del correo.
//   - LogAsignacionUsuario  (partición /Proceso): a qué analista se asignó.
// Ver `pagoDesdeLogs`. Ojo: el id de Outlook cambia si el correo se mueve de carpeta
// (salvo que se pida ImmutableId a Graph); falta confirmarlo con el clasificador.
//
// Lo que NO está en esos logs y por ahora se simula: el estado (cruce con suspense en
// AS400), la referencia, el correo de la empresa (saldría del remitente vía Graph),
// la ruta del archivo y el historial de gestión.
//
// Estados: son DATOS (catálogo), no código. Cada estado trae su nombre, color, acción
// y comportamiento, así que agregar o renombrar uno es configuración. Un pago con un
// estado que no esté en el catálogo no rompe la pantalla: se muestra en gris y en
// solo lectura (ver `metaDesconocido`).

import { Injectable, computed, signal } from '@angular/core';
import {
  DEMO_ESTADOS,
  DEMO_GESTION,
  DEMO_LOG_ASIGNACION,
  DEMO_LOG_ESTADISTICA,
} from './recaudos-pac.demo';

export const PERM_VIEW = 'app.recaudos-acreditacion-pac.view';
/** Configurar el catálogo de estados (p. ej. el líder de Recaudo). */
export const PERM_CONFIG = 'app.recaudos-acreditacion-pac.config';

// ---- Documentos crudos de Cosmos (tal como llegan, con los metadatos _* omitidos) ----

export interface LogEstadisticaDoc {
  id: string;
  correlation_id: string;
  fecha_procesamiento: string; // YYYY-MM-DD
  proceso: string;
  Grupo: string;
  score_confianza: number;
  etiqueta: string;
  asunto_correo: string;
  afiliado_nombre: string;
  afiliado_cedula: string;
  afiliado_contrato: string;
  banco: string;
  cuenta_origen: string;
  cuenta_destino_skandia: string;
  nit_fondo: string;
  // Los montos llegan como texto ("11736043"): se convierten en pagoDesdeLogs.
  monto: string;
  monto_comprobante: string;
  fecha_carta: string;
  numero_solicitud_traslado: string;
}

export interface LogAsignacionDoc {
  id: string;
  NombreAnalista: string; // etiqueta ("Analista 1"), no una persona
  FechaAsignacion: string; // YYYY-MM-DD
  Proceso: string;
}

// La etiqueta de analista ("Analista 1") es solo una distinción del clasificador: la
// persona detrás cambia según la operación. Por eso quien entra ve TODOS los pagos y
// filtra por etiqueta; no se amarra un usuario a una etiqueta.

// ---- Catálogo de estados ----

/** Qué borrador de correo propone el estado al confirmar. */
export type PlantillaCorreo = 'acreditacion' | 'solicitud_info';

export interface EstadoMeta {
  /** Código estable que viene en el pago ("referenciado"). */
  codigo: string;
  /** Posición en el flujo; ordena tarjetas y filtro. */
  orden: number;
  nombre: string;
  corto: string;
  /** Texto del botón de acción de la fila. */
  accion: string;
  descripcion: string;
  /** Hex del punto, la tarjeta y el badge (el badge se deriva, ver estiloBadge). */
  color: string;
  plantilla_correo: PlantillaCorreo | null;
  /** Muestra ruta del archivo y la opción verificar / notificar fallidos. */
  es_pipeline: boolean;
  /** A qué estado pasa al confirmar. null = el pago sale de la bandeja. */
  al_confirmar: string | null;
  /** Solo pipeline: a qué estado pasa si se notifican fallidos. */
  al_notificar?: string | null;
  /** Avisa que el caso pasa a gestión manual fuera del sistema. */
  gestion_manual: boolean;
  /**
   * Los estados se desactivan en vez de borrarse: los pagos que ya pasaron por uno
   * lo siguen nombrando en su historial. Inactivo = no se ofrece como destino al
   * configurar transiciones; los pagos que aún lo tengan se siguen mostrando normal.
   */
  activo: boolean;
  /** No está en el catálogo: se muestra en gris y sin acciones. */
  desconocido?: boolean;
}

/** Código de estado: minúsculas, números y guion bajo (es el que llega en el pago). */
export const PATRON_CODIGO = /^[a-z0-9]+(_[a-z0-9]+)*$/;

const GRIS = '#8E8E93';

/** Meta de respaldo para un código que el catálogo no conoce. */
export function metaDesconocido(codigo: string): EstadoMeta {
  const legible = codigo.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return {
    codigo,
    orden: Number.MAX_SAFE_INTEGER,
    nombre: `${legible} (sin configurar)`,
    corto: legible,
    accion: 'Ver detalle',
    descripcion:
      'Este estado aún no está configurado en la App, así que no tiene acciones. Gestiona el pago fuera del sistema y avisa para que se agregue al catálogo.',
    color: GRIS,
    plantilla_correo: null,
    es_pipeline: false,
    al_confirmar: null,
    gestion_manual: false,
    activo: true,
    desconocido: true,
  };
}

/**
 * Colores del badge a partir del color del estado. Con estados configurables no se
 * pueden usar clases de Tailwind por estado (solo se generan las que están escritas
 * en el código), así que se mezcla el color: fondo tenue y texto hacia el color de
 * primer plano, que ya cambia entre tema claro y oscuro.
 */
export function estiloBadge(color: string): Record<string, string> {
  return {
    'background-color': `color-mix(in srgb, ${color} 14%, transparent)`,
    color: `color-mix(in srgb, ${color} 62%, var(--foreground))`,
  };
}

export type TipoEvento = 'automatico' | 'manual';
export type TonoEvento = 'info' | 'ok' | 'alerta' | 'error';

export interface EventoPago {
  accion: string;
  tipo: TipoEvento;
  tono: TonoEvento;
  fecha: string; // ISO
  usuario: string;
  correo_enviado?: string | null;
}

/** Datos del soporte de pago extraídos por la IA (LogEstadistica). Vacío = null. */
export interface DatosExtraidos {
  asunto_correo: string;
  afiliado_documento: string | null;
  afiliado_contrato: string | null;
  banco: string | null;
  cuenta_origen: string | null;
  cuenta_destino_skandia: string | null;
  nit_fondo: string | null;
  fecha_carta: string | null;
  numero_solicitud_traslado: string | null;
  monto_comprobante: number | null;
  score_confianza: number;
}

export interface PagoPac {
  id: string; // id del correo de Outlook
  empresa: string;
  referencia: string;
  monto: number;
  /** Código de estado del catálogo (puede no estar en él: ver metaDesconocido). */
  estado: string;
  fecha_procesamiento: string; // YYYY-MM-DD
  analista: string; // etiqueta del clasificador
  fecha_asignacion: string | null;
  correo_empresa: string;
  ruta_archivo?: string | null;
  extraido: DatosExtraidos;
  historial: EventoPago[];
}

/** Lo que aún no sale de Cosmos y hoy se simula (ver encabezado). */
export type DatosGestion = Pick<PagoPac, 'estado' | 'referencia' | 'correo_empresa' | 'ruta_archivo' | 'historial'>;

const vacioANull = (s: string | null | undefined): string | null => (s && s.trim() ? s.trim() : null);

/** Texto de monto ("11736043") a número; null si viene vacío o no es numérico. */
export function montoDesdeTexto(s: string | null | undefined): number | null {
  const limpio = (s ?? '').replace(/[^\d.-]/g, '');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Arma el pago uniendo los dos logs por id del correo. Se reutiliza tal cual en backend. */
export function pagoDesdeLogs(
  est: LogEstadisticaDoc,
  asig: LogAsignacionDoc | undefined,
  gestion: DatosGestion,
): PagoPac {
  return {
    id: est.id,
    empresa: est.afiliado_nombre,
    monto: montoDesdeTexto(est.monto) ?? 0,
    fecha_procesamiento: est.fecha_procesamiento,
    analista: asig?.NombreAnalista ?? 'Sin asignar',
    fecha_asignacion: asig?.FechaAsignacion ?? null,
    extraido: {
      asunto_correo: est.asunto_correo,
      // Se llama "cedula" en el log, pero trae 15 dígitos: parece NIT o cuenta. Por
      // eso en la App se muestra como "Documento" hasta confirmar qué es.
      afiliado_documento: vacioANull(est.afiliado_cedula),
      afiliado_contrato: vacioANull(est.afiliado_contrato),
      banco: vacioANull(est.banco),
      cuenta_origen: vacioANull(est.cuenta_origen),
      cuenta_destino_skandia: vacioANull(est.cuenta_destino_skandia),
      nit_fondo: vacioANull(est.nit_fondo),
      fecha_carta: vacioANull(est.fecha_carta),
      numero_solicitud_traslado: vacioANull(est.numero_solicitud_traslado),
      monto_comprobante: montoDesdeTexto(est.monto_comprobante),
      score_confianza: est.score_confianza,
    },
    ...gestion,
  };
}

/** El monto del correo y el del comprobante no coinciden (ambos presentes). */
export const montoDescuadrado = (p: PagoPac): boolean =>
  p.extraido.monto_comprobante !== null && p.extraido.monto_comprobante !== p.monto;

/** Qué se hace después de subir a Pipeline. */
export type AccionPipeline = 'verificar' | 'notificar';

export interface ConfirmarAccionInput {
  accion_pipeline?: AccionPipeline;
  correo?: { para: string; asunto: string; cuerpo: string } | null;
}

export const TONO_COLOR: Record<TonoEvento, string> = {
  info: '#0099DE',
  ok: '#00C73D',
  alerta: '#FFAE08',
  error: '#E03430',
};

/**
 * A qué estado pasa un pago al confirmar. `null` = sale de la bandeja. Lo define el
 * catálogo (al_confirmar / al_notificar); aquí solo se elige cuál aplica.
 */
export function estadoSiguiente(meta: EstadoMeta, accion?: AccionPipeline): string | null {
  if (meta.es_pipeline && accion === 'notificar') return meta.al_notificar ?? null;
  return meta.al_confirmar;
}

/** Borrador de correo según el estado (y la acción posterior, en Pipeline). */
export function borradorCorreo(
  p: PagoPac,
  meta: EstadoMeta,
  accion: AccionPipeline = 'verificar',
): { para: string; asunto: string; cuerpo: string } | null {
  const monto = formatoMonto(p.monto);
  const firma = 'Cordial saludo,\nSkandia - Acreditación PAC';
  const para = p.correo_empresa;
  if (meta.es_pipeline && accion === 'notificar') {
    return {
      para,
      asunto: `Notificación de fallo - ${p.referencia}`,
      cuerpo: `Estimados,\n\nLamentamos informar que el pago ${p.referencia} por ${monto} no pudo ser procesado. Motivo:\n\n- [Especificar motivo]\n\n${firma}`,
    };
  }
  if (meta.plantilla_correo === 'acreditacion') {
    const tras = meta.es_pipeline ? ' tras la carga a Pipeline' : '';
    return {
      para,
      asunto: `Confirmación acreditación ${p.referencia}`,
      cuerpo: `Estimados,\n\nConfirmamos que el pago ${p.referencia} por valor de ${monto} ha sido acreditado exitosamente${tras}.\n\nSi tienen alguna consulta, no duden en contactarnos.\n\n${firma}`,
    };
  }
  if (meta.plantilla_correo === 'solicitud_info') {
    return {
      para,
      asunto: `Información faltante - ${p.referencia}`,
      cuerpo: `Estimados,\n\nRespecto al pago ${p.referencia} por ${monto}, necesitamos la siguiente información para completar la acreditación:\n\n- [Especificar información faltante]\n\nAgradecemos su pronta respuesta.\n\n${firma}`,
    };
  }
  return null;
}

const FMT_MONTO = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
export const formatoMonto = (n: number): string => FMT_MONTO.format(n);

const FMT_FECHA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const FMT_FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
// Las fechas de recepción llegan como YYYY-MM-DD: se leen en hora local para que no
// se corran un día al convertirlas desde UTC.
export const formatoFecha = (iso: string): string => FMT_FECHA.format(new Date(`${iso}T00:00:00`));
export const formatoFechaHora = (iso: string): string => FMT_FECHA_HORA.format(new Date(iso));
// Para la tabla en pantallas medianas: sin año, que casi siempre es el actual.
const FMT_FECHA_CORTA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
export const formatoFechaCorta = (iso: string): string =>
  FMT_FECHA_CORTA.format(new Date(`${iso}T00:00:00`));

@Injectable({ providedIn: 'root' })
export class RecaudosPacApi {
  /** true mientras la App funcione con datos de ejemplo (sin backend). */
  readonly modoDemo = signal(true);

  /** Catálogo de estados vigente, ordenado por flujo. Lo carga listarEstados(). */
  readonly estados = signal<EstadoMeta[]>([]);
  private readonly porCodigo = computed(
    () => new Map(this.estados().map((e) => [e.codigo, e])),
  );

  // Copia mutable para que las acciones simuladas se mantengan al navegar en la sesión.
  // Se arma con la misma unión de logs que hará el backend.
  private pagos: PagoPac[] = DEMO_LOG_ESTADISTICA.map((est) =>
    pagoDesdeLogs(
      est,
      DEMO_LOG_ASIGNACION.find((a) => a.id === est.id),
      structuredClone(DEMO_GESTION.get(est.id)!),
    ),
  );

  /** Meta de un estado; si el catálogo no lo tiene, la de respaldo en gris. */
  meta(codigo: string): EstadoMeta {
    return this.porCodigo().get(codigo) ?? metaDesconocido(codigo);
  }

  // Copia mutable del catálogo de la demo (las ediciones duran lo que la sesión).
  private catalogo: EstadoMeta[] = structuredClone(DEMO_ESTADOS);

  async listarEstados(): Promise<EstadoMeta[]> {
    const lista = structuredClone(this.catalogo).sort((a, b) => a.orden - b.orden);
    this.estados.set(lista);
    return lista;
  }

  /** Crea (esNuevo) o actualiza un estado del catálogo. */
  async guardarEstado(estado: EstadoMeta, esNuevo: boolean): Promise<void> {
    const limpio: EstadoMeta = { ...structuredClone(estado), desconocido: undefined };
    if (!PATRON_CODIGO.test(limpio.codigo)) {
      throw new Error('El código solo admite minúsculas, números y guion bajo (ej. en_validacion).');
    }
    const i = this.catalogo.findIndex((e) => e.codigo === limpio.codigo);
    if (esNuevo) {
      if (i >= 0) throw new Error(`Ya existe un estado con el código "${limpio.codigo}".`);
      limpio.orden = Math.max(0, ...this.catalogo.map((e) => e.orden)) + 10;
      this.catalogo.push(limpio);
    } else {
      if (i < 0) throw new Error('El estado ya no existe.');
      this.catalogo[i] = limpio;
    }
    await this.listarEstados();
  }

  /** Sube o baja un estado una posición (intercambia su orden con el vecino). */
  async moverEstado(codigo: string, direccion: -1 | 1): Promise<void> {
    const orden = [...this.catalogo].sort((a, b) => a.orden - b.orden);
    const i = orden.findIndex((e) => e.codigo === codigo);
    const j = i + direccion;
    if (i < 0 || j < 0 || j >= orden.length) return;
    [orden[i].orden, orden[j].orden] = [orden[j].orden, orden[i].orden];
    await this.listarEstados();
  }

  /** Pagos en bandeja por código de estado (incluye códigos sin configurar). */
  async conteoPorEstado(): Promise<Map<string, number>> {
    const conteo = new Map<string, number>();
    for (const p of this.pagos) conteo.set(p.estado, (conteo.get(p.estado) ?? 0) + 1);
    return conteo;
  }

  async listar(): Promise<PagoPac[]> {
    return structuredClone(this.pagos);
  }

  async confirmarAccion(id: string, usuario: string, input: ConfirmarAccionInput): Promise<void> {
    const p = this.pagos.find((x) => x.id === id);
    if (!p) throw new Error('El pago ya no está en la bandeja.');
    const meta = this.meta(p.estado);
    if (meta.desconocido) throw new Error('Este estado no está configurado: no tiene acciones.');
    const siguiente = estadoSiguiente(meta, input.accion_pipeline);
    const correo = input.correo
      ? `Para: ${input.correo.para}\nAsunto: ${input.correo.asunto}\n\n${input.correo.cuerpo}`
      : null;
    const notificar = meta.es_pipeline && input.accion_pipeline === 'notificar';
    p.historial.push({
      accion: notificar ? 'Subido a Pipeline — fallidos notificados' : `${meta.accion} — completado`,
      tipo: 'manual',
      tono: notificar ? 'alerta' : 'ok',
      fecha: new Date().toISOString(),
      usuario,
      correo_enviado: correo,
    });
    if (siguiente === null) {
      this.pagos = this.pagos.filter((x) => x.id !== id);
    } else {
      p.estado = siguiente;
    }
  }
}
