// Cliente HTTP de la App "Buzón Inteligente" (/api/buzon-inteligente, alma-backend).
//
// Contrato: scratchpad SPEC-buzon-inteligente.md (snake_case, igual que el resto de Alma).
// Modo demostración: si el backend aún no tiene el módulo desplegado (404/503) o no
// responde, las LECTURAS caen a un conjunto de datos de ejemplo del área de Recaudos
// (buzon.demo.ts) y `modoDemo` queda en true para que la UI lo avise. Las escrituras
// en modo demo se simulan en memoria (no se pierden al navegar dentro de la App).

import { Injectable, inject, signal } from '@angular/core';
import { environment } from '@env/environment';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { DEMO, demoCorreoDetalle, demoLeerArchivo, demoMetricas, demoProbar } from './buzon.demo';

// ── Tipos del contrato ───────────────────────────────────────────────────────

export type ModoBuzon = 'sugerir' | 'automatico';
/** El Buzón solo lee buzones que su dueño conectó: no hay acceso de plataforma (app-only). */
export type EstadoConexion = 'conectada' | 'sin_conectar' | 'requiere_reconexion';
export type EstadoCorreo = 'pendiente' | 'revision' | 'ejecutado' | 'ignorado' | 'error';
export type OrigenDecision = 'ia' | 'regla' | 'humano';
export type TipoAccion =
  | 'categorizar'
  | 'mover'
  | 'reenviar'
  | 'asignar_analista'
  | 'notificar_teams'
  | 'marcar_leido';

/** Rol del usuario en un buzón (migración 058). 'admin' = administrador de la App. */
export type RolBuzon = 'admin' | 'editor' | 'revisor';
/** Rol que se asigna a un miembro: editor configura, revisor solo trabaja la bandeja. */
export type RolMiembro = 'editor' | 'revisor';
export type ModoClasificacion = 'prompt' | 'agente';
export type AlDesactivar = 'respaldo' | 'roundrobin';

export interface MiembroBuzon {
  user_id: string | null;
  email: string;
  name?: string | null;
  rol: RolMiembro;
}

export interface Buzon {
  id: string;
  nombre: string;
  area: string | null;
  direccion: string;
  correo_buzon_id: string;
  estado_conexion: EstadoConexion;
  carpeta_vigilada: string;
  modo: ModoBuzon;
  umbral_confianza: number;
  max_correos_por_tick: number;
  contexto: string | null;
  activo: boolean;
  /** Solo en la respuesta de crear: la dirección ya había tenido un buzón que
   *  se eliminó, y se restauró con su configuración (queda pausado). */
  restaurado?: boolean;
  ultima_sincronizacion: string | null;
  ultimo_error: string | null;
  categorias_count: number;
  /** 061: procesos activos (tarjeta de la página Buzones). */
  procesos_count: number;
  pendientes: number;
  en_revision: number;
  ejecutados_hoy: number;
  miembros: MiembroBuzon[];
  /** Rol del usuario en este buzón. */
  rol: RolBuzon | null;
  /** Admin o editor del buzón: puede configurarlo. */
  puede_administrar: boolean;
  /** Solo el administrador de la App: crear, conectar, desconectar, eliminar y dar accesos. */
  puede_conectar: boolean;
  /** La conexión la hizo un administrador con SU cuenta (acceso completo al buzón genérico). */
  conexion_compartida: boolean;
  conectada_por: string | null;
  modo_clasificacion: ModoClasificacion;
  agente_nombre: string | null;
  /** Prompt con el que el área ya trabaja (lo lee «Leer el prompt del área»). */
  prompt_area: string | null;
  al_desactivar: AlDesactivar;
  /** 059: deja el archivo generado como borrador de respuesta en el hilo. */
  borrador_en_hilo: boolean;
  /** 061: genérica (buzón de área) o personal. El nombre es {TIPO}-{ALIAS}. */
  tipo_cuenta: TipoCuenta;
  descripcion: string | null;
  /** 061: el asistente «Nuevo buzón» no ha terminado: no se lee hasta activarlo. */
  en_configuracion: boolean;
  /** 061: módulos que el área activó (desactivar conserva la configuración). */
  mod_asignacion: boolean;
  mod_bases: boolean;
  mod_exportacion: boolean;
  reglas_admin: ReglasAdmin;
  agente_proyecto: string | null;
  /** NULL = usa siempre la última versión publicada del agente. */
  agente_version_fija: string | null;
  modelo: string | null;
  exclusiones_globales: string | null;
  discriminacion: ParDiscriminacion[];
  ventana_hilos_dias: number;
  respuesta_sin_novedad: 'vincular' | 'validar';
  /** 061: «tabla según el JSON» (extensión y separador) y entrega del archivo. */
  tabla_formato: 'xlsx' | 'csv' | 'txt';
  tabla_separador: ';' | ',' | '|';
  descarga_en_alma: boolean;
  /** Versión publicada de las reglas (vN); null = sin versión publicada. */
  version_reglas: number | null;
}

export type TipoCuenta = 'gen' | 'per';
export type ReglasAdmin = 'alma' | 'foundry';

/** Qué diferencia a dos procesos que se pueden confundir y qué señal manda. */
export interface ParDiscriminacion {
  a: string;
  b: string;
  manda: string;
}

export interface BuzonIn {
  direccion: string;
  nombre: string;
  area?: string;
  carpeta_vigilada?: string;
  modo?: ModoBuzon;
  umbral_confianza?: number;
  contexto?: string;
  descripcion?: string;
  /** 061: lo crea el asistente «Nuevo buzón» (queda En configuración). */
  tipo_cuenta?: TipoCuenta;
  en_configuracion?: boolean;
}

export type BuzonUpdate = Partial<
  Pick<
    Buzon,
    | 'nombre'
    | 'area'
    | 'carpeta_vigilada'
    | 'modo'
    | 'umbral_confianza'
    | 'max_correos_por_tick'
    | 'contexto'
    | 'activo'
    | 'modo_clasificacion'
    | 'agente_nombre'
    | 'prompt_area'
    | 'al_desactivar'
    | 'borrador_en_hilo'
    | 'descripcion'
    | 'mod_asignacion'
    | 'mod_bases'
    | 'mod_exportacion'
    | 'reglas_admin'
    | 'agente_proyecto'
    | 'agente_version_fija'
    | 'modelo'
    | 'exclusiones_globales'
    | 'discriminacion'
    | 'ventana_hilos_dias'
    | 'respuesta_sin_novedad'
    | 'tabla_formato'
    | 'tabla_separador'
    | 'descarga_en_alma'
  >
>;

export interface Accion {
  id?: string;
  tipo: TipoAccion;
  parametros: Record<string, unknown>;
  orden: number;
  activa: boolean;
}

export interface CampoExtraer {
  clave: string;
  descripcion: string;
}

export interface Categoria {
  id: string;
  buzon_id: string;
  clave: string;
  nombre: string;
  descripcion: string;
  ejemplos: string[];
  palabras_clave: string | null;
  color: string | null;
  orden: number;
  activa: boolean;
  es_fallback: boolean;
  umbral_confianza: number | null;
  campos_extraer: CampoExtraer[];
  acciones: Accion[];
  correos_30d: number;
  /** Proceso al que pertenece la etiqueta (058). */
  proceso_id: string | null;
  /** 061: «por IA» (la IA decide con el texto) o «por datos» (condición sobre el JSON). */
  criterio?: CriterioEtiqueta;
  condicion?: CondicionEtiqueta | null;
  /** ✦ propuesta de Alma · ✎ ajustada por el área. */
  origen?: OrigenRegla;
}

export type CriterioEtiqueta = 'ia' | 'datos';
export type OrigenRegla = 'ia' | 'user';
export type OperadorCondicion = '=' | 'contiene' | 'distinto de';

export interface CondicionEtiqueta {
  campo: string;
  op: OperadorCondicion;
  valor: string;
}

export type CategoriaIn = Omit<Categoria, 'id' | 'buzon_id' | 'correos_30d' | 'orden' | 'proceso_id'> & {
  orden?: number;
  /** Se reenvía siempre al editar: el PUT reemplaza la categoría completa. */
  proceso_id?: string | null;
};

export interface ReglaFija {
  id: string;
  buzon_id: string;
  nombre: string;
  remitente_contiene: string | null;
  asunto_contiene: string | null;
  cuerpo_contiene: string | null;
  categoria_id: string;
  categoria_clave?: string | null;
  orden: number;
  activa: boolean;
}

export type ReglaIn = Omit<ReglaFija, 'id' | 'buzon_id' | 'categoria_clave'>;

export interface AdjuntoRef {
  nombre: string;
  tipo: string;
  tamano: number;
  texto_extraido: boolean;
}

export interface Correo {
  id: string;
  buzon_id: string;
  buzon_nombre: string;
  remitente: string;
  remitente_nombre: string | null;
  asunto: string;
  recibido_en: string;
  tiene_adjuntos: boolean;
  adjuntos: AdjuntoRef[];
  resumen: string | null;
  categoria_id: string | null;
  categoria_clave: string | null;
  categoria_nombre: string | null;
  categoria_color: string | null;
  confianza: number | null;
  justificacion: string | null;
  datos_extraidos: Record<string, unknown> | null;
  estado: EstadoCorreo;
  origen: OrigenDecision | null;
  asignado_a: string | null;
  decidido_por: string | null;
  decidido_en: string | null;
  categoria_sugerida_id: string | null;
  error: string | null;
  modelo_ia: string | null;
  created_at: string;
  // Migración 058: proceso, grupo, persona asignada y por qué.
  proceso_clave: string | null;
  grupo_id: string | null;
  grupo_nombre: string | null;
  asignado_persona_id: string | null;
  asignacion_traza: PasoTraza[];
  /** Nombre de la persona del equipo asignada (null si es carpeta o nadie). */
  asignado_nombre: string | null;
  // Migración 060: posible duplicado (misma llave de negocio) y respuestas en el hilo.
  duplicado_de?: string | null;
  duplicado_asunto?: string | null;
  duplicado_estado?: 'posible' | 'confirmado' | 'descartado' | null;
  respuestas?: number;
  /** 061: versión de las reglas con la que se clasificó (null = borrador, antes de publicar). */
  reglas_version?: number | null;
}

/** Un correo de la conversación (pestaña Hilo). */
export interface MensajeHilo {
  id: string;
  remitente: string;
  remitente_nombre: string | null;
  asunto: string;
  recibido_en: string;
  adjuntos: string[];
  resumen: string | null;
  estado: EstadoCorreo;
  asignado_a: string | null;
  es_este: boolean;
}

export interface HiloCorreo {
  buzon: { nombre: string; direccion: string; carpeta_vigilada: string };
  items: MensajeHilo[];
  /** Versión del archivo que está como borrador de respuesta en el hilo. */
  borrador: ArchivoCorreo | null;
  ultima_version: number | null;
}

/** Celdas de un archivo generado (vista previa de la bandeja). */
export interface CeldasArchivo extends ArchivoCorreo {
  hoja: string;
  celdas: string[][];
  /** Índice (0-based) de la fila de encabezados; arriba va el título. */
  fila_encabezado: number;
  /** De dónde sale cada columna (vista «Fórmulas»). */
  origenes: string[];
  anotaciones: { estado: 'ok' | 'warn'; texto: string }[];
}

export interface CorreccionDatos {
  correo: Correo;
  archivo: ArchivoGenerado | null;
  cambios?: string[];
  /** Cambió un campo crítico (identificador del caso): se ofrece recalcular la asignación. */
  cambios_criticos?: string[];
}

export interface Ejecucion {
  id: number;
  tipo: TipoAccion | string;
  parametros: Record<string, unknown> | null;
  resultado: 'ok' | 'error' | 'simulado';
  detalle: string | null;
  ejecutado_por: string;
  ejecutado_en: string;
}

export interface CorreoDetalle extends Correo {
  ejecuciones: Ejecucion[];
  acciones_previstas: { tipo: TipoAccion; parametros: Record<string, unknown> }[];
}

export interface FiltroCorreos {
  buzon_id?: string;
  estado?: EstadoCorreo | '';
  categoria_id?: string;
  q?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
  grupo_id?: string;
  /** Cola del líder: correos de un grupo de personas que quedaron sin responsable. */
  sin_asignar?: boolean;
  /** «Posibles duplicados» pendientes de decidir (060). */
  duplicado?: boolean;
}

export interface ResultadoPrueba {
  categoria_clave: string | null;
  categoria_nombre: string | null;
  confianza: number;
  resumen: string;
  justificacion: string;
  datos_extraidos: Record<string, unknown>;
  acciones_previstas: { tipo: TipoAccion; parametros: Record<string, unknown> }[];
  cumple_umbral: boolean;
}

export interface ResumenSync {
  ingresados: number;
  procesados: number;
  ejecutados: number;
  en_revision: number;
  errores: number;
  duracion_ms: number;
}

export interface Metricas {
  total: number;
  por_estado: Record<string, number>;
  por_categoria: { clave: string; nombre: string; color: string | null; total: number }[];
  precision: { decisiones_humanas: number; coincidencias: number; porcentaje: number | null };
  automatizados: number;
  tiempo_medio_decision_min: number | null;
  serie: { fecha: string; total: number; ejecutados: number; revision: number }[];
  ultimas_ejecuciones: (Ejecucion & { asunto?: string; buzon_nombre?: string })[];
}

export interface CarpetaGraph {
  id: string;
  nombre: string;
  total: number;
  no_leidos: number;
  hijas: CarpetaGraph[];
}

export interface ConexionBuzon {
  configurado: boolean;
  correo_buzon_id?: string;
  direccion?: string;
  estado: EstadoConexion | string;
  conectada_por: string | null;
  conectada_en: string | null;
  /** Conectada por un administrador con su cuenta (acceso completo al buzón). */
  compartida: boolean;
  scopes: string;
  puede_conectar: boolean;
}

// ── 2.0: procesos ────────────────────────────────────────────────────────────

export type TipoCampo = 'texto' | 'numero' | 'fecha' | 'booleano' | 'lista' | 'tabla';

export interface CampoProceso {
  clave: string;
  descripcion: string;
  /** Lo usan validaciones cruzadas o identifica el caso. */
  critico: boolean;
  /** Tipo de dato: valida la corrección del revisor (texto si no se declaró). */
  tipo?: TipoCampo;
  /** 061: crítico alterno (basta uno del grupo), identificador del caso y origen. */
  alterno?: boolean;
  identificador?: boolean;
  origen?: OrigenRegla;
  /** Campos de cada elemento cuando el tipo es «tabla» (lista de objetos). */
  campos?: string[];
}

export interface Proceso {
  id: string;
  buzon_id: string;
  clave: string;
  nombre: string;
  /** Señales con las que se reconoce el trámite. */
  descripcion: string | null;
  exclusiones: string | null;
  campos_extraer: CampoProceso[];
  color: string | null;
  orden: number;
  activo: boolean;
  /** Claves de las etiquetas (categorías) del proceso. */
  etiquetas: string[];
  /** 061: confianza mínima (null = la del buzón) y causas que llevan a Validar. */
  umbral?: number | null;
  causas_validar?: string[];
}

export interface ProcesoIn {
  clave: string;
  nombre: string;
  descripcion?: string | null;
  exclusiones?: string | null;
  campos_extraer: CampoProceso[];
  color?: string | null;
  orden?: number | null;
  activo: boolean;
  umbral?: number | null;
  causas_validar?: string[];
}

/** Editor de procesos de Reglas (061): el proceso con sus etiquetas y su discriminación. */
export interface ProcesoCompletoIn {
  /** Clave anterior al renombrar; null = proceso nuevo. */
  original: string | null;
  proceso: ProcesoIn;
  etiquetas: { clave: string; nombre?: string; descripcion: string; criterio: CriterioEtiqueta; condicion?: CondicionEtiqueta | null; origen: OrigenRegla }[];
  discriminacion?: { con: string; manda: string }[];
}

// ── 061: reglas con versiones ────────────────────────────────────────────────

/** [qué cambió, antes, después] del borrador frente a la versión vigente. */
export type CambioRegla = [string, string, string];

export interface PruebaBorrador {
  firma: string;
  fecha: string;
  total: number;
  proceso_ok: number;
  etiqueta_ok: number;
  no_disponibles: number;
  fallos: { correo_id: string; asunto: string; esperado: string; obtenido: string | null; confianza: number }[];
}

export interface VersionReglas {
  version: number;
  cambios: CambioRegla[];
  prueba: PruebaBorrador | null;
  publicada_en: string;
  publicada_por: string;
}

export interface EstadoReglas {
  /** Vigente (null = sin versión publicada). */
  version: number | null;
  siguiente: number;
  /** Hay cambios sin publicar. */
  borrador: boolean;
  cambios: CambioRegla[];
  /** Prueba del borrador ACTUAL (null si no se ha probado o cambió después). */
  prueba: PruebaBorrador | null;
  procesos: number;
  pares_discriminacion: number;
  versiones: VersionReglas[];
}

export interface PromptBuzon {
  version: number | null;
  modo: ModoClasificacion;
  prompt: string;
  esquema: Record<string, unknown>;
}

export interface PruebaSeco {
  total: number;
  validar: number;
  resumen: { proceso: string; resultado: string; correos: number }[];
  filas: { asunto: string; proceso: string; etiqueta: string | null; confianza: number; datos: boolean; validar: boolean; destino: string }[];
}

export interface NombreBuzon {
  nombre: string;
  disponible: boolean;
  existente: { id: string; nombre: string; misma_direccion: boolean } | null;
}

export interface EtiquetaPropuesta {
  clave: string;
  nombre: string;
  descripcion: string;
}

export interface ProcesoPropuesto {
  clave: string;
  nombre: string;
  descripcion: string;
  exclusiones: string;
  campos: CampoProceso[];
  etiquetas: EtiquetaPropuesta[];
  color?: string;
}

/** Lo que Alma lee del prompt del área. No se guarda hasta aplicarla. */
export interface PropuestaProcesos {
  procesos: ProcesoPropuesto[];
  instrucciones: string;
}

export interface ResultadoAplicar {
  procesos_creados: number;
  procesos_actualizados: number;
  etiquetas_creadas: number;
  etiquetas_actualizadas: number;
}

// ── 2.0: asignación ──────────────────────────────────────────────────────────

export type Comparacion = 'exacta' | 'digitos' | 'doc' | 'pc' | 'aprox';
export type DestinoGrupo = 'personas' | 'carpeta' | 'categorizar';
export type SinActivosModo = 'cola' | 'carpeta' | 'persona';

export interface Cruce {
  /** Dato del JSON del proceso. */
  campo: string;
  /** Columna de la base. */
  columna: string;
  comparacion: Comparacion;
}

export interface ReglaAsignacion {
  id?: string;
  grupo_id?: string;
  base_id: string;
  base_nombre?: string | null;
  cruces: Cruce[];
  col_responsable: string;
  col_respaldo: string | null;
  orden?: number;
  activa: boolean;
}

export type ReglaAsignacionIn = Pick<ReglaAsignacion, 'base_id' | 'cruces' | 'col_responsable' | 'col_respaldo' | 'activa'>;

export interface Grupo {
  id: string;
  buzon_id: string;
  nombre: string;
  etiquetas: string[];
  destino: DestinoGrupo;
  carpeta: string | null;
  sin_activos_modo: SinActivosModo;
  sin_activos_carpeta: string | null;
  sin_activos_persona_id: string | null;
  orden: number;
  activo: boolean;
  reglas: ReglaAsignacion[];
}

export interface GrupoIn {
  nombre: string;
  etiquetas: string[];
  destino: DestinoGrupo;
  carpeta?: string | null;
  sin_activos_modo: SinActivosModo;
  sin_activos_carpeta?: string | null;
  sin_activos_persona_id?: string | null;
  orden?: number | null;
  activo: boolean;
  /** Reemplaza las búsquedas del grupo (en este orden). */
  reglas: ReglaAsignacionIn[];
}

export interface MembresiaGrupo {
  activa: boolean;
  respaldo_id: string | null;
}

export interface Persona {
  id: string;
  nombre: string;
  correo: string;
  carpeta: string | null;
  disponible: boolean;
  orden: number;
  carga_hoy: number;
  abiertos: number;
  /** {grupo_id: membresía} */
  grupos: Record<string, MembresiaGrupo>;
}

export interface PersonaIn {
  nombre: string;
  correo: string;
  carpeta?: string | null;
  disponible: boolean;
  /** {grupo_id: {activa, respaldo = correo de otra persona del equipo}} */
  grupos: Record<string, { activa: boolean; respaldo?: string | null }>;
}

export interface DisponibilidadIn {
  disponible?: boolean;
  grupo_id?: string;
  activa?: boolean;
}

export type EstadoBase = 'sin_cargar' | 'ok' | 'rechazado';
export type FilaBase = Record<string, string>;

export interface Base {
  id: string;
  nombre: string;
  origen: 'archivo' | 'sharepoint';
  archivo: string | null;
  hoja: string | null;
  fila_encabezado: number | null;
  columnas: string[];
  total_filas: number;
  estado: EstadoBase;
  motivo: string | null;
  sharepoint_url: string | null;
  /** {valor normalizado de la base: correo de la persona} */
  vinculos: Record<string, string>;
  cargada_en: string | null;
  cargada_por: string | null;
  /** Buzones que la usan. */
  buzones: string[];
  /** Búsquedas de asignación que la usan. */
  usos: number;
}

export interface BaseIn {
  nombre: string;
  origen: 'archivo' | 'sharepoint';
  sharepoint_url?: string | null;
  buzones: string[];
}

export type BaseUpdate = Partial<BaseIn>;

/** Vista previa de un archivo (hojas, fila de encabezados, columnas, muestra). */
export interface LecturaArchivo {
  hojas: string[];
  hoja: string | null;
  fila_encabezado: number;
  columnas: string[];
  total_filas: number;
  muestra: FilaBase[];
  titulo: string | null;
  /** Solo en /bases/leer: hasta 500 filas (importación del equipo). */
  filas?: FilaBase[];
}

export interface ResultadoCarga extends LecturaArchivo {
  aceptada: boolean;
  motivo: string | null;
  base: Base;
}

export interface PasoTraza {
  estado: 'ok' | 'skip' | 'warn' | 'bad';
  titulo: string;
  detalle: string;
}

export interface ResultadoAsignacion {
  grupo: { id: string; nombre: string } | null;
  estado: 'asignado' | 'carpeta' | 'categorizar' | 'sin_asignar';
  persona: { id: string; nombre: string; correo: string } | null;
  carpeta: string | null;
  via: string;
  traza: PasoTraza[];
}

// ── 2.0: resumen del inicio ──────────────────────────────────────────────────

export interface FlujoHoy {
  llegaron: number;
  con_adjuntos: number;
  clasificados: number;
  /** En Validar (revisión), de cualquier día. */
  validar: number;
  asignados: number;
  ejecutados: number;
  /** Recepción del más antiguo en Validar. */
  validar_desde: string | null;
  semana: { fecha: string; ejecutados: number }[];
}

export interface AlertaInicio {
  tipo: 'conexion' | 'error' | 'reglas' | 'equipo' | 'base' | string;
  buzon_id?: string;
  base_id?: string;
  texto: string;
}

export interface ResumenInicio {
  buzones: Pick<Buzon, 'id' | 'nombre' | 'estado_conexion' | 'ultima_sincronizacion' | 'activo' | 'en_revision' | 'categorias_count'>[];
  flujo: FlujoHoy;
  sin_asignar: number;
  alertas: AlertaInicio[];
}

export const COMPARACIONES: { id: Comparacion; nombre: string }[] = [
  { id: 'exacta', nombre: 'Exacta' },
  { id: 'digitos', nombre: 'Solo dígitos' },
  { id: 'doc', nombre: 'Documento sin DV' },
  { id: 'pc', nombre: 'Prefijo + número (PC0000)' },
  { id: 'aprox', nombre: 'Texto aproximado ≥ 90 %' },
];

/** Administrador de la App (ve todos los buzones, crea, conecta y da accesos). */
export const PERM_ADMIN_BUZON = 'app.buzon-inteligente.*';
/** Entrada a la App. */
export const PERM_VER_BUZON = 'app.buzon-inteligente.view';

// ── Exportación (059) ────────────────────────────────────────────────────────

export type TipoOrigen = 'campo' | 'fijo' | 'correo' | 'fila' | 'base' | 'formula' | 'vacio';
export type DatoCorreo = 'asunto' | 'remitente' | 'fecha' | 'radicado' | 'etiqueta';
export type FormatoColumna = 'texto' | 'numero' | 'entero' | 'moneda' | 'fecha';
export type ModoSalida = 'ninguno' | 'tabla' | 'plantilla';

/** De dónde sale el valor de una columna de la plantilla. */
export interface OrigenColumna {
  tipo: TipoOrigen;
  /** 'campo': dato del JSON («afiliados.cedula» para un campo del detalle). 'base': dato con el que se busca. */
  campo?: string | null;
  /** 'fijo': texto que se repite en cada fila. */
  valor?: string | null;
  /** 'correo': información del correo. */
  dato?: DatoCorreo | null;
  base_id?: string | null;
  columna_busqueda?: string | null;
  columna_resultado?: string | null;
  comparacion?: Comparacion;
  /** 'formula': empieza con «=»; {fila} = número de la fila en Excel. */
  formula?: string | null;
}

export interface ColumnaPlantilla {
  encabezado: string;
  origen: OrigenColumna;
  formato: FormatoColumna;
}

export interface Plantilla {
  id: string;
  buzon_id: string;
  nombre: string;
  formato: 'xlsx' | 'csv';
  separador: string;
  hoja: string;
  /** Con {campo}: Cargue_{codigo_pac}_{fecha} */
  nombre_archivo: string;
  /** Filas de título sobre los encabezados (se conservan del modelo). */
  titulo: string[][];
  columnas: ColumnaPlantilla[];
  /** Campo lista del JSON: una fila por elemento. */
  detalle: string | null;
  modelo: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export type PlantillaIn = Omit<Plantilla, 'id' | 'buzon_id' | 'updated_at' | 'updated_by'>;

export interface Salida {
  id?: string;
  proceso_id?: string;
  nombre: string;
  modo: ModoSalida;
  /** null = todas las etiquetas del proceso. */
  etiquetas: string[] | null;
  plantilla_id: string | null;
  orden?: number;
  activa: boolean;
}

export type SalidaIn = Pick<Salida, 'nombre' | 'modo' | 'etiquetas' | 'plantilla_id' | 'activa'>;

export interface ProcesoExportacion extends Proceso {
  salidas: Salida[];
}

export interface Exportacion {
  borrador_en_hilo: boolean;
  procesos: ProcesoExportacion[];
  plantillas: Plantilla[];
}

export interface ColumnaModelo extends ColumnaPlantilla {
  /** ✦ Alma propuso el origen por el nombre del encabezado. */
  sugerido: boolean;
  ejemplo: string;
}

/** Lo que Alma lee del modelo que sube el área. */
export interface ModeloLeido {
  hojas: string[];
  hoja: string | null;
  fila_encabezado: number;
  titulo: string[][];
  columnas: ColumnaModelo[];
  formato: 'xlsx' | 'csv';
  modelo: string;
  /** Datos que extraen los procesos del buzón. */
  campos: string[];
}

export interface VistaPrevia {
  nombre_archivo: string;
  titulo: string[][];
  encabezados: string[];
  filas: string[][];
  total_filas: number;
  con_datos_reales: boolean;
}

export interface ArchivoCorreo {
  id: string;
  correo_id: string;
  salida_id: string | null;
  salida_nombre: string | null;
  nombre: string;
  formato: 'xlsx' | 'csv';
  version: number;
  filas: number;
  tamano: number;
  borrador_en_hilo: boolean;
  borrador_en: string | null;
  created_at: string;
  created_by: string;
}

export interface ArchivoGenerado {
  id: string;
  nombre: string;
  version: number;
  filas: number;
}

export const ORIGENES: { id: TipoOrigen; nombre: string; icon: string }[] = [
  { id: 'campo', nombre: 'Dato del correo', icon: 'scan-text' },
  { id: 'fijo', nombre: 'Texto fijo', icon: 'type' },
  { id: 'base', nombre: 'Columna de una base', icon: 'file-spreadsheet' },
  { id: 'formula', nombre: 'Fórmula', icon: 'sigma' },
  { id: 'correo', nombre: 'Información del correo', icon: 'mail' },
  { id: 'fila', nombre: 'Número de fila', icon: 'list-ordered' },
];

export const DATOS_CORREO: { id: DatoCorreo; nombre: string }[] = [
  { id: 'asunto', nombre: 'Asunto' },
  { id: 'remitente', nombre: 'Remitente' },
  { id: 'fecha', nombre: 'Fecha de recibido' },
  { id: 'radicado', nombre: 'Id del correo (radicado)' },
  { id: 'etiqueta', nombre: 'Etiqueta' },
];

export const FORMATOS_COLUMNA: { id: FormatoColumna; nombre: string }[] = [
  { id: 'texto', nombre: 'Texto' },
  { id: 'numero', nombre: 'Número' },
  { id: 'entero', nombre: 'Entero' },
  { id: 'moneda', nombre: 'Moneda' },
  { id: 'fecha', nombre: 'Fecha (DD/MM/AAAA)' },
];

// ── Catálogo de acciones (UI) ────────────────────────────────────────────────

export const TIPOS_ACCION: { tipo: TipoAccion; nombre: string; icono: string; ayuda: string }[] = [
  { tipo: 'categorizar', nombre: 'Etiquetar en Outlook', icono: 'tag', ayuda: 'Asigna una categoría de Outlook al correo.' },
  { tipo: 'mover', nombre: 'Mover a carpeta', icono: 'folder-input', ayuda: 'Mueve el correo a una carpeta del buzón (la crea si no existe).' },
  { tipo: 'reenviar', nombre: 'Reenviar a', icono: 'forward', ayuda: 'Reenvía el correo a una o varias personas con un comentario.' },
  { tipo: 'asignar_analista', nombre: 'Asignar analista', icono: 'user-check', ayuda: 'Reparte el correo entre analistas (el que menos tenga hoy) y lo mueve a su carpeta.' },
  { tipo: 'notificar_teams', nombre: 'Avisar en Teams', icono: 'bell', ayuda: 'Publica un aviso en un canal o chat de Teams.' },
  { tipo: 'marcar_leido', nombre: 'Marcar como leído', icono: 'mail-check', ayuda: 'Marca el correo como leído.' },
];

export const ESTADO_CORREO: Record<EstadoCorreo, { nombre: string; clase: string }> = {
  pendiente: { nombre: 'Pendiente', clase: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  revision: { nombre: 'Por revisar', clase: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  ejecutado: { nombre: 'Ejecutado', clase: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  ignorado: { nombre: 'Ignorado', clase: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300' },
  error: { nombre: 'Error', clase: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
};

/** Filas de Ejecuciones que no son acciones configurables. */
const OTRAS_EJECUCIONES: Record<string, { nombre: string; icono: string }> = {
  asignar: { nombre: 'Asignación', icono: 'route' },
  decision: { nombre: 'Decisión', icono: 'user-check' },
  ignorar: { nombre: 'Ignorado', icono: 'mail-x' },
};

export function nombreAccion(tipo: string): string {
  return TIPOS_ACCION.find((t) => t.tipo === tipo)?.nombre ?? OTRAS_EJECUCIONES[tipo]?.nombre ?? tipo;
}

export function iconoAccion(tipo: string): string {
  return TIPOS_ACCION.find((t) => t.tipo === tipo)?.icono ?? OTRAS_EJECUCIONES[tipo]?.icono ?? 'zap';
}

/** Texto corto de una acción para chips ("Mover a 4X1000 Davivienda"). */
export function resumenAccion(a: { tipo: string; parametros: Record<string, unknown> }): string {
  const p = a.parametros ?? {};
  switch (a.tipo) {
    case 'categorizar':
      return `Etiqueta “${p['categoria'] ?? ''}”`;
    case 'mover':
      return `Mover a “${p['carpeta'] ?? ''}”`;
    case 'reenviar': {
      const d = (p['destinatarios'] as string[] | undefined) ?? [];
      return `Reenviar a ${d.length ? d.join(', ') : '…'}`;
    }
    case 'asignar_analista': {
      const an = (p['analistas'] as string[] | undefined) ?? [];
      return `Asignar analista (${an.length} en turno)`;
    }
    case 'notificar_teams':
      return 'Avisar en Teams';
    case 'marcar_leido':
      return 'Marcar como leído';
    case 'asignar':
      return `Asignación${p['grupo'] ? ` · grupo ${p['grupo']}` : ''}${p['via'] ? ` · ${p['via']}` : ''}`;
    default:
      return a.tipo;
  }
}

// ── Servicio ────────────────────────────────────────────────────────────────

const BASE = '/api/buzon-inteligente';

@Injectable({ providedIn: 'root' })
export class BuzonApi {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** true cuando alguna lectura cayó a los datos de demostración. */
  readonly modoDemo = signal(false);

  // Copia mutable de la demo para que las escrituras simuladas se vean en la sesión.
  private demo = DEMO.clonar();

  /** Un 404/503/5xx del módulo (aún no desplegado o sin configurar) ⇒ demo. */
  private esCaidaDeModulo(e: unknown): boolean {
    const msg = e instanceof Error ? e.message : String(e);
    return /HTTP (404|500|502|503|504)|no está configurado|Failed to fetch|NetworkError/i.test(msg);
  }

  private async conDemo<T>(real: () => Promise<T>, demo: () => T | Promise<T>): Promise<T> {
    if (this.modoDemo()) return demo();
    try {
      return await real();
    } catch (e) {
      if (!this.esCaidaDeModulo(e)) throw e;
      console.warn('[buzon-inteligente] backend no disponible, usando datos de demostración:', e);
      this.modoDemo.set(true);
      return demo();
    }
  }

  // Buzones
  listarBuzones(): Promise<Buzon[]> {
    return this.conDemo(
      async () => (await this.api.fetch<{ items: Buzon[] }>(`${BASE}/buzones`)).items,
      () => this.demo.buzones.map((b) => this.demo.conConteos(b)),
    );
  }

  obtenerBuzon(id: string): Promise<Buzon> {
    return this.conDemo(
      () => this.api.fetch<Buzon>(`${BASE}/buzones/${id}`),
      () => {
        const b = this.demo.buzones.find((x) => x.id === id);
        if (!b) throw new Error('Buzón no encontrado.');
        return this.demo.conConteos(b);
      },
    );
  }

  crearBuzon(body: BuzonIn): Promise<Buzon> {
    return this.conDemo(
      () => this.api.fetch<Buzon>(`${BASE}/buzones`, { method: 'POST', body: JSON.stringify(body) }),
      () => this.demo.crearBuzon(body),
    );
  }

  actualizarBuzon(id: string, body: BuzonUpdate): Promise<Buzon> {
    return this.conDemo(
      () => this.api.fetch<Buzon>(`${BASE}/buzones/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      () => this.demo.actualizarBuzon(id, body),
    );
  }

  /** Borra la conexión y PAUSA el buzón: Alma deja de leerlo hasta reanudarlo. */
  desconectarBuzon(id: string): Promise<Buzon> {
    return this.conDemo(
      () => this.api.fetch<Buzon>(`${BASE}/buzones/${id}/desconectar`, { method: 'POST' }),
      () => this.demo.desconectarBuzon(id),
    );
  }

  /** Quita el buzón de la App (borrado lógico: el historial se conserva y
   *  registrar de nuevo la dirección lo restaura). */
  eliminarBuzon(id: string): Promise<void> {
    return this.conDemo(
      () => this.api.fetch<void>(`${BASE}/buzones/${id}`, { method: 'DELETE' }),
      () => this.demo.eliminarBuzon(id),
    );
  }

  sincronizar(id: string, maxCorreos = 25): Promise<ResumenSync> {
    return this.conDemo(
      () =>
        this.api.fetch<ResumenSync>(`${BASE}/buzones/${id}/sincronizar`, {
          method: 'POST',
          body: JSON.stringify({ max_correos: maxCorreos }),
        }),
      () => this.demo.sincronizar(id),
    );
  }

  conexion(id: string): Promise<ConexionBuzon> {
    return this.conDemo(
      () => this.api.fetch<ConexionBuzon>(`${BASE}/buzones/${id}/conexion`),
      () => {
        const b = this.demo.buzones.find((x) => x.id === id);
        return {
          configurado: true,
          correo_buzon_id: b?.correo_buzon_id,
          direccion: b?.direccion,
          estado: b?.estado_conexion ?? 'sin_conectar',
          conectada_por: b?.conectada_por ?? null,
          conectada_en: null,
          compartida: !!b?.conexion_compartida,
          scopes:
            'openid offline_access User.Read Mail.Send Mail.ReadWrite MailboxSettings.ReadWrite Mail.ReadWrite.Shared Mail.Send.Shared',
          puede_conectar: !!b?.puede_conectar,
        };
      },
    );
  }

  carpetas(id: string): Promise<CarpetaGraph[]> {
    return this.conDemo(
      async () => (await this.api.fetch<{ items: CarpetaGraph[] }>(`${BASE}/buzones/${id}/carpetas`)).items,
      () => this.demo.carpetas,
    );
  }

  /**
   * URL de autorización (OAuth delegado) para conectar el buzón con su propia
   * cuenta. Vuelve por la ruta existente /graph-callback con state
   * "b:<correo_buzon_id>|<ruta>", que ya canjea el código en el backend.
   */
  urlConectar(correoBuzonId: string, scopes: string, volverA: string): string {
    const redirect = `${window.location.origin}/graph-callback`;
    const qs = new URLSearchParams({
      client_id: environment.azure.clientId,
      response_type: 'code',
      redirect_uri: redirect,
      response_mode: 'query',
      scope: scopes,
      state: `b:${correoBuzonId}|${volverA}`,
      prompt: 'select_account',
    });
    return `https://login.microsoftonline.com/${environment.azure.tenantId}/oauth2/v2.0/authorize?${qs}`;
  }

  // Categorías
  listarCategorias(buzonId: string): Promise<Categoria[]> {
    return this.conDemo(
      async () =>
        (await this.api.fetch<{ items: Categoria[] }>(`${BASE}/buzones/${buzonId}/categorias`)).items,
      () => this.demo.categorias.filter((c) => c.buzon_id === buzonId),
    );
  }

  crearCategoria(buzonId: string, body: CategoriaIn): Promise<Categoria> {
    return this.conDemo(
      () =>
        this.api.fetch<Categoria>(`${BASE}/buzones/${buzonId}/categorias`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      () => this.demo.crearCategoria(buzonId, body),
    );
  }

  actualizarCategoria(id: string, body: CategoriaIn): Promise<Categoria> {
    return this.conDemo(
      () => this.api.fetch<Categoria>(`${BASE}/categorias/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      () => this.demo.actualizarCategoria(id, body),
    );
  }

  eliminarCategoria(id: string): Promise<void> {
    return this.conDemo(
      () => this.api.fetch<void>(`${BASE}/categorias/${id}`, { method: 'DELETE' }),
      () => this.demo.eliminarCategoria(id),
    );
  }

  // Reglas fijas
  listarReglas(buzonId: string): Promise<ReglaFija[]> {
    return this.conDemo(
      async () => (await this.api.fetch<{ items: ReglaFija[] }>(`${BASE}/buzones/${buzonId}/reglas`)).items,
      () => this.demo.reglas.filter((r) => r.buzon_id === buzonId),
    );
  }

  crearRegla(buzonId: string, body: ReglaIn): Promise<ReglaFija> {
    return this.conDemo(
      () =>
        this.api.fetch<ReglaFija>(`${BASE}/buzones/${buzonId}/reglas`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      () => this.demo.crearRegla(buzonId, body),
    );
  }

  actualizarRegla(id: string, body: ReglaIn): Promise<ReglaFija> {
    return this.conDemo(
      () => this.api.fetch<ReglaFija>(`${BASE}/reglas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      () => this.demo.actualizarRegla(id, body),
    );
  }

  eliminarRegla(id: string): Promise<void> {
    return this.conDemo(
      () => this.api.fetch<void>(`${BASE}/reglas/${id}`, { method: 'DELETE' }),
      () => this.demo.eliminarRegla(id),
    );
  }

  // Correos (bandeja)
  listarCorreos(f: FiltroCorreos): Promise<{ data: Correo[]; total: number }> {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== false) qs.set(k, String(v));
    });
    return this.conDemo(
      () => this.api.fetch<{ data: Correo[]; total: number }>(`${BASE}/correos?${qs}`),
      () => this.demo.listarCorreos(f),
    );
  }

  obtenerCorreo(id: string): Promise<CorreoDetalle> {
    return this.conDemo(
      () => this.api.fetch<CorreoDetalle>(`${BASE}/correos/${id}`),
      () => demoCorreoDetalle(this.demo, id),
    );
  }

  /** Bytes MIME del correo (para el visor EML). En demo devuelve un .eml de ejemplo. */
  async obtenerMime(id: string): Promise<ArrayBuffer> {
    if (this.modoDemo()) return this.demo.mime(id);
    const token = await this.auth.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const base = environment.apiUrl.replace(/\/+$/, '');
    const resp = await fetch(`${base}${BASE}/correos/${encodeURIComponent(id)}/mime`, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} al descargar el correo`);
    return resp.arrayBuffer();
  }

  decidir(id: string, categoriaId: string, ejecutar: boolean, comentario?: string): Promise<Correo> {
    return this.conDemo(
      () =>
        this.api.fetch<Correo>(`${BASE}/correos/${id}/decidir`, {
          method: 'POST',
          body: JSON.stringify({ categoria_id: categoriaId, ejecutar, comentario }),
        }),
      () => this.demo.decidir(id, categoriaId, ejecutar, this.auth.user().correo),
    );
  }

  ignorar(id: string): Promise<Correo> {
    return this.conDemo(
      () => this.api.fetch<Correo>(`${BASE}/correos/${id}/ignorar`, { method: 'POST' }),
      () => this.demo.ignorar(id, this.auth.user().correo),
    );
  }

  reclasificar(id: string): Promise<Correo> {
    return this.conDemo(
      () => this.api.fetch<Correo>(`${BASE}/correos/${id}/reclasificar`, { method: 'POST' }),
      () => this.demo.reclasificar(id),
    );
  }

  probar(buzonId: string, body: { asunto: string; remitente: string; cuerpo: string; texto_adjuntos?: string }): Promise<ResultadoPrueba> {
    return this.conDemo(
      () =>
        this.api.fetch<ResultadoPrueba>(`${BASE}/buzones/${buzonId}/probar`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      () => demoProbar(this.demo, buzonId, body),
    );
  }

  metricas(buzonId?: string, dias = 30): Promise<Metricas> {
    const qs = new URLSearchParams({ dias: String(dias) });
    if (buzonId) qs.set('buzon_id', buzonId);
    return this.conDemo(
      () => this.api.fetch<Metricas>(`${BASE}/metricas?${qs}`),
      () => demoMetricas(this.demo, buzonId),
    );
  }

  /** Reemplaza los miembros del buzón (solo administrador de la App). */
  guardarMiembros(buzonId: string, miembros: { email: string; rol: RolMiembro }[]): Promise<Buzon> {
    return this.conDemo(
      () =>
        this.api.fetch<Buzon>(`${BASE}/buzones/${buzonId}/miembros`, {
          method: 'PUT',
          body: JSON.stringify({ miembros }),
        }),
      () => this.demo.guardarMiembros(buzonId, miembros),
    );
  }

  // ── 2.0: resumen del inicio ──
  resumen(): Promise<ResumenInicio> {
    return this.conDemo(
      () => this.api.fetch<ResumenInicio>(`${BASE}/resumen`),
      () => this.demo.resumen(),
    );
  }

  // ── 2.0: procesos ──
  listarProcesos(buzonId: string): Promise<Proceso[]> {
    return this.conDemo(
      async () => (await this.api.fetch<{ items: Proceso[] }>(`${BASE}/buzones/${buzonId}/procesos`)).items,
      () => this.demo.listarProcesos(buzonId),
    );
  }

  crearProceso(buzonId: string, body: ProcesoIn): Promise<Proceso> {
    return this.conDemo(
      () => this.api.fetch<Proceso>(`${BASE}/buzones/${buzonId}/procesos`, { method: 'POST', body: JSON.stringify(body) }),
      () => this.demo.guardarProceso(buzonId, body),
    );
  }

  actualizarProceso(id: string, body: ProcesoIn): Promise<Proceso> {
    return this.conDemo(
      () => this.api.fetch<Proceso>(`${BASE}/procesos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      () => this.demo.guardarProceso(null, body, id),
    );
  }

  eliminarProceso(id: string): Promise<void> {
    return this.conDemo(
      () => this.api.fetch<void>(`${BASE}/procesos/${id}`, { method: 'DELETE' }),
      () => this.demo.eliminarProceso(id),
    );
  }

  /** La IA lee el prompt del área y PROPONE procesos (10–30 s). No guarda nada. */
  analizarPrompt(buzonId: string, prompt: string): Promise<PropuestaProcesos> {
    return this.conDemo(
      () =>
        this.api.fetch<PropuestaProcesos>(`${BASE}/buzones/${buzonId}/analizar-prompt`, {
          method: 'POST',
          body: JSON.stringify({ prompt }),
        }),
      () => this.demo.analizarPrompt(prompt),
    );
  }

  /** Crea o actualiza procesos y etiquetas por clave (no borra nada) y guarda el prompt del área. */
  aplicarPropuesta(buzonId: string, propuesta: PropuestaProcesos, promptArea?: string): Promise<ResultadoAplicar> {
    return this.conDemo(
      () =>
        this.api.fetch<ResultadoAplicar>(`${BASE}/buzones/${buzonId}/aplicar-propuesta`, {
          method: 'POST',
          body: JSON.stringify({ propuesta, prompt_area: promptArea ?? null }),
        }),
      () => this.demo.aplicarPropuesta(buzonId, propuesta, promptArea),
    );
  }

  // ── 2.0: grupos ──
  listarGrupos(buzonId: string): Promise<Grupo[]> {
    return this.conDemo(
      async () => (await this.api.fetch<{ items: Grupo[] }>(`${BASE}/buzones/${buzonId}/grupos`)).items,
      () => this.demo.listarGrupos(buzonId),
    );
  }

  crearGrupo(buzonId: string, body: GrupoIn): Promise<Grupo> {
    return this.conDemo(
      () => this.api.fetch<Grupo>(`${BASE}/buzones/${buzonId}/grupos`, { method: 'POST', body: JSON.stringify(body) }),
      () => this.demo.guardarGrupo(buzonId, body),
    );
  }

  /** Actualiza el grupo y REEMPLAZA sus búsquedas en bases. */
  actualizarGrupo(id: string, body: GrupoIn): Promise<Grupo> {
    return this.conDemo(
      () => this.api.fetch<Grupo>(`${BASE}/grupos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      () => this.demo.guardarGrupo(null, body, id),
    );
  }

  eliminarGrupo(id: string): Promise<void> {
    return this.conDemo(
      () => this.api.fetch<void>(`${BASE}/grupos/${id}`, { method: 'DELETE' }),
      () => this.demo.eliminarGrupo(id),
    );
  }

  // ── 2.0: equipo ──
  listarEquipo(buzonId: string): Promise<Persona[]> {
    return this.conDemo(
      async () => (await this.api.fetch<{ items: Persona[] }>(`${BASE}/buzones/${buzonId}/equipo`)).items,
      () => this.demo.listarEquipo(buzonId),
    );
  }

  /** Reemplaza el equipo completo (agregar, quitar e importar). */
  guardarEquipo(buzonId: string, personas: PersonaIn[]): Promise<Persona[]> {
    return this.conDemo(
      async () =>
        (
          await this.api.fetch<{ items: Persona[] }>(`${BASE}/buzones/${buzonId}/equipo`, {
            method: 'PUT',
            body: JSON.stringify({ personas }),
          })
        ).items,
      () => this.demo.guardarEquipo(buzonId, personas),
    );
  }

  /** Cambio rápido: disponible (ausencias) o activa en un grupo. Devuelve el equipo. */
  cambiarDisponibilidad(personaId: string, body: DisponibilidadIn): Promise<Persona[]> {
    return this.conDemo(
      async () =>
        (
          await this.api.fetch<{ items: Persona[] }>(`${BASE}/equipo/${personaId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        ).items,
      () => this.demo.cambiarDisponibilidad(personaId, body),
    );
  }

  // ── 2.0: bases ──
  listarBases(buzonId?: string): Promise<Base[]> {
    const qs = buzonId ? `?buzon_id=${encodeURIComponent(buzonId)}` : '';
    return this.conDemo(
      async () => (await this.api.fetch<{ items: Base[] }>(`${BASE}/bases${qs}`)).items,
      () => this.demo.listarBases(buzonId),
    );
  }

  crearBase(body: BaseIn): Promise<Base> {
    return this.conDemo(
      () => this.api.fetch<Base>(`${BASE}/bases`, { method: 'POST', body: JSON.stringify(body) }),
      () => this.demo.crearBase(body),
    );
  }

  actualizarBase(id: string, body: BaseUpdate): Promise<Base> {
    return this.conDemo(
      () => this.api.fetch<Base>(`${BASE}/bases/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      () => this.demo.actualizarBase(id, body),
    );
  }

  eliminarBase(id: string): Promise<void> {
    return this.conDemo(
      () => this.api.fetch<void>(`${BASE}/bases/${id}`, { method: 'DELETE' }),
      () => this.demo.eliminarBase(id),
    );
  }

  private formArchivo(archivo: File, hoja?: string | null, filaEncabezado?: number | null): FormData {
    const f = new FormData();
    f.append('archivo', archivo, archivo.name);
    if (hoja) f.append('hoja', hoja);
    if (filaEncabezado) f.append('fila_encabezado', String(filaEncabezado));
    return f;
  }

  /** Vista previa de un Excel/CSV sin guardar (hojas, encabezados, columnas, filas). */
  leerArchivo(archivo: File, hoja?: string | null, filaEncabezado?: number | null): Promise<LecturaArchivo> {
    return this.conDemo(
      () => this.api.upload<LecturaArchivo>(`${BASE}/bases/leer`, this.formArchivo(archivo, hoja, filaEncabezado)),
      () => demoLeerArchivo(archivo, hoja, filaEncabezado),
    );
  }

  /** Carga el archivo en la base. Si no sirve, `aceptada` = false y la base conserva la carga anterior. */
  cargarBase(id: string, archivo: File, hoja?: string | null, filaEncabezado?: number | null): Promise<ResultadoCarga> {
    return this.conDemo(
      () => this.api.upload<ResultadoCarga>(`${BASE}/bases/${id}/cargar`, this.formArchivo(archivo, hoja, filaEncabezado)),
      async () => this.demo.cargarBase(id, await demoLeerArchivo(archivo, hoja, filaEncabezado), archivo.name),
    );
  }

  sincronizarBase(id: string): Promise<ResultadoCarga> {
    return this.conDemo(
      () => this.api.fetch<ResultadoCarga>(`${BASE}/bases/${id}/sincronizar`, { method: 'POST' }),
      () => this.demo.sincronizarBase(id),
    );
  }

  filasBase(id: string, q?: string, limit = 50): Promise<{ columnas: string[]; items: FilaBase[] }> {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (q) qs.set('q', q);
    return this.conDemo(
      () => this.api.fetch<{ columnas: string[]; items: FilaBase[] }>(`${BASE}/bases/${id}/filas?${qs}`),
      () => this.demo.filasBase(id, q, limit),
    );
  }

  /** «Vincular a…»: un valor de la base queda equivalente a un correo (null = quitar). */
  vincular(baseId: string, valor: string, correo: string | null): Promise<Base> {
    return this.conDemo(
      () =>
        this.api.fetch<Base>(`${BASE}/bases/${baseId}/vinculos`, {
          method: 'PUT',
          body: JSON.stringify({ valor, correo }),
        }),
      () => this.demo.vincular(baseId, valor, correo),
    );
  }

  /** Simula a quién iría un correo con esa etiqueta y esos datos. No toca Outlook. */
  probarAsignacion(buzonId: string, etiqueta: string, datos: Record<string, unknown>): Promise<ResultadoAsignacion> {
    return this.conDemo(
      () =>
        this.api.fetch<ResultadoAsignacion>(`${BASE}/buzones/${buzonId}/probar-asignacion`, {
          method: 'POST',
          body: JSON.stringify({ etiqueta, datos }),
        }),
      () => this.demo.probarAsignacion(buzonId, etiqueta, datos),
    );
  }

  // ── Exportación (059) ──
  /** Salidas por proceso, plantillas del buzón y entrega (solo quien configura). */
  exportacion(buzonId: string): Promise<Exportacion> {
    return this.conDemo(
      () => this.api.fetch<Exportacion>(`${BASE}/buzones/${buzonId}/exportacion`),
      () => this.demo.exportacion(buzonId),
    );
  }

  /** Reemplaza las salidas del proceso (en este orden: la primera que cubre la etiqueta manda). */
  guardarSalidas(procesoId: string, salidas: SalidaIn[]): Promise<Salida[]> {
    return this.conDemo(
      async () =>
        (
          await this.api.fetch<{ items: Salida[] }>(`${BASE}/procesos/${procesoId}/salidas`, {
            method: 'PUT',
            body: JSON.stringify({ salidas }),
          })
        ).items,
      () => this.demo.guardarSalidas(procesoId, salidas),
    );
  }

  listarPlantillas(buzonId: string): Promise<Plantilla[]> {
    return this.conDemo(
      async () => (await this.api.fetch<{ items: Plantilla[] }>(`${BASE}/buzones/${buzonId}/plantillas`)).items,
      () => this.demo.listarPlantillas(buzonId),
    );
  }

  crearPlantilla(buzonId: string, body: PlantillaIn): Promise<Plantilla> {
    return this.conDemo(
      () => this.api.fetch<Plantilla>(`${BASE}/buzones/${buzonId}/plantillas`, { method: 'POST', body: JSON.stringify(body) }),
      () => this.demo.guardarPlantilla(buzonId, body),
    );
  }

  actualizarPlantilla(id: string, body: PlantillaIn): Promise<Plantilla> {
    return this.conDemo(
      () => this.api.fetch<Plantilla>(`${BASE}/plantillas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      () => this.demo.guardarPlantilla(null, body, id),
    );
  }

  eliminarPlantilla(id: string): Promise<void> {
    return this.conDemo(
      () => this.api.fetch<void>(`${BASE}/plantillas/${id}`, { method: 'DELETE' }),
      () => this.demo.eliminarPlantilla(id),
    );
  }

  /** Lee el modelo del área: columnas con el origen que Alma propone (✦). No guarda nada. */
  leerModelo(buzonId: string, archivo: File, hoja?: string | null, filaEncabezado?: number | null): Promise<ModeloLeido> {
    return this.conDemo(
      () => this.api.upload<ModeloLeido>(`${BASE}/buzones/${buzonId}/plantillas/leer-modelo`, this.formArchivo(archivo, hoja, filaEncabezado)),
      () => this.demo.leerModelo(buzonId, archivo, hoja, filaEncabezado),
    );
  }

  /** Cómo quedaría el archivo: con `datos` o con el último correo real del proceso. */
  vistaPrevia(plantillaId: string, body: { datos?: Record<string, unknown>; proceso_clave?: string }): Promise<VistaPrevia> {
    return this.conDemo(
      () =>
        this.api.fetch<VistaPrevia>(`${BASE}/plantillas/${plantillaId}/vista-previa`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      () => this.demo.vistaPrevia(plantillaId, body),
    );
  }

  archivosCorreo(correoId: string): Promise<ArchivoCorreo[]> {
    return this.conDemo(
      async () => (await this.api.fetch<{ items: ArchivoCorreo[] }>(`${BASE}/correos/${correoId}/archivos`)).items,
      () => this.demo.archivosCorreo(correoId),
    );
  }

  /** Genera la versión siguiente del archivo con los datos actuales del correo. */
  regenerarArchivo(correoId: string): Promise<ArchivoGenerado> {
    return this.conDemo(
      () => this.api.fetch<ArchivoGenerado>(`${BASE}/correos/${correoId}/archivos`, { method: 'POST' }),
      () => this.demo.regenerarArchivo(correoId, this.auth.user().correo),
    );
  }

  /** El revisor corrige los datos extraídos. Si el correo ya se ejecutó, devuelve la
   *  versión nueva del archivo como VISTA PREVIA (el borrador del hilo no cambia). */
  corregirDatos(correoId: string, datos: Record<string, unknown>): Promise<CorreccionDatos> {
    return this.conDemo(
      () =>
        this.api.fetch<CorreccionDatos>(`${BASE}/correos/${correoId}/datos`, {
          method: 'PUT',
          body: JSON.stringify({ datos_extraidos: datos }),
        }),
      () => this.demo.corregirDatos(correoId, datos, this.auth.user().correo),
    );
  }

  /** Conversación del correo (pestaña Hilo) y el borrador vigente de Alma. */
  hilo(correoId: string): Promise<HiloCorreo> {
    return this.conDemo(
      () => this.api.fetch<HiloCorreo>(`${BASE}/correos/${correoId}/hilo`),
      () => this.demo.hilo(correoId),
    );
  }

  /** «Es duplicado» (se ignora y queda vinculado) o «No es duplicado» (flujo normal). */
  decidirDuplicado(correoId: string, esDuplicado: boolean): Promise<Correo> {
    return this.conDemo(
      () =>
        this.api.fetch<Correo>(`${BASE}/correos/${correoId}/duplicado`, {
          method: 'POST',
          body: JSON.stringify({ es_duplicado: esDuplicado }),
        }),
      () => this.demo.decidirDuplicado(correoId, esDuplicado, this.auth.user().correo),
    );
  }

  /** Celdas, origen de cada columna y revisión de una versión del archivo. */
  celdasArchivo(archivoId: string): Promise<CeldasArchivo> {
    return this.conDemo(
      () => this.api.fetch<CeldasArchivo>(`${BASE}/archivos/${archivoId}/celdas`),
      () => this.demo.celdasArchivo(archivoId),
    );
  }

  /** «Actualizar borrador»: deja esta versión como borrador de respuesta en el hilo. */
  actualizarBorrador(archivoId: string): Promise<ArchivoCorreo[]> {
    return this.conDemo(
      async () =>
        (await this.api.fetch<{ items: ArchivoCorreo[] }>(`${BASE}/archivos/${archivoId}/borrador`, { method: 'POST' })).items,
      () => this.demo.actualizarBorrador(archivoId, this.auth.user().correo),
    );
  }

  /** Reasignación manual (editor o administrador del buzón). */
  reasignar(correoId: string, personaId: string): Promise<Correo> {
    return this.conDemo(
      () =>
        this.api.fetch<Correo>(`${BASE}/correos/${correoId}/asignacion`, {
          method: 'PUT',
          body: JSON.stringify({ persona_id: personaId }),
        }),
      () => this.demo.reasignar(correoId, personaId, this.auth.user().correo),
    );
  }

  // ── 061: asistente «Nuevo buzón» y reglas con versiones ──

  /** Nombre {GEN|PER}-{ALIAS} y si está libre. */
  nombreBuzon(direccion: string, tipo: TipoCuenta): Promise<NombreBuzon> {
    const q = `direccion=${encodeURIComponent(direccion)}&tipo=${tipo}`;
    return this.conDemo(
      () => this.api.fetch<NombreBuzon>(`${BASE}/buzones/nombre?${q}`),
      () => this.demo.nombreBuzon(direccion, tipo),
    );
  }

  /** Solo demostración: en vez del inicio de sesión de Microsoft, el buzón queda conectado. */
  simularConexionDemo(buzonId: string): Buzon {
    return this.demo.conectarDemo(buzonId, this.auth.user().correo);
  }

  /** Modelos de IA que la plataforma ofrece. */
  opciones(): Promise<{ modelos: string[] }> {
    return this.conDemo(
      () => this.api.fetch<{ modelos: string[] }>(`${BASE}/opciones`),
      () => ({ modelos: ['gpt-5-mini', 'gpt-4.1'] }),
    );
  }

  /** Cuenta personal: crea la subcarpeta dedicada (p. ej. «Alma») y devuelve el árbol. */
  crearCarpeta(buzonId: string, nombre: string): Promise<CarpetaGraph[]> {
    return this.conDemo(
      async () =>
        (await this.api.fetch<{ items: CarpetaGraph[] }>(`${BASE}/buzones/${buzonId}/carpetas`, {
          method: 'POST',
          body: JSON.stringify({ nombre, dentro_de_bandeja: true }),
        })).items,
      () => this.demo.crearCarpeta(buzonId, nombre),
    );
  }

  guardarProcesoCompleto(buzonId: string, body: ProcesoCompletoIn): Promise<Proceso> {
    return this.conDemo(
      () => this.api.fetch<Proceso>(`${BASE}/buzones/${buzonId}/procesos-completo`, { method: 'PUT', body: JSON.stringify(body) }),
      () => this.demo.guardarProcesoCompleto(buzonId, body),
    );
  }

  estadoReglas(buzonId: string): Promise<EstadoReglas> {
    return this.conDemo(
      () => this.api.fetch<EstadoReglas>(`${BASE}/buzones/${buzonId}/versiones`),
      () => this.demo.estadoReglas(buzonId),
    );
  }

  /** Clasifica con el borrador los últimos correos ya decididos (30–90 s). */
  probarBorrador(buzonId: string): Promise<PruebaBorrador> {
    return this.conDemo(
      () => this.api.fetch<PruebaBorrador>(`${BASE}/buzones/${buzonId}/versiones/probar`, { method: 'POST', body: '{}' }),
      () => this.demo.probarBorrador(buzonId),
    );
  }

  /** Publica el borrador como vN+1 (y activa el buzón si estaba en configuración). */
  publicarReglas(buzonId: string): Promise<{ version: number; cambios: CambioRegla[] }> {
    return this.conDemo(
      () => this.api.fetch<{ version: number; cambios: CambioRegla[] }>(`${BASE}/buzones/${buzonId}/versiones`, { method: 'POST' }),
      () => this.demo.publicarReglas(buzonId, this.auth.user().correo),
    );
  }

  verPrompt(buzonId: string, cual: 'borrador' | 'vigente' = 'borrador'): Promise<PromptBuzon> {
    return this.conDemo(
      () => this.api.fetch<PromptBuzon>(`${BASE}/buzones/${buzonId}/prompt?cual=${cual}`),
      () => this.demo.verPrompt(buzonId),
    );
  }

  /** La IA propone procesos nuevos a partir de los correos recientes (no guarda nada). */
  proponerProcesos(buzonId: string): Promise<PropuestaProcesos & { correos_leidos: number }> {
    return this.conDemo(
      () => this.api.fetch<PropuestaProcesos & { correos_leidos: number }>(`${BASE}/buzones/${buzonId}/proponer-procesos`, { method: 'POST' }),
      () => this.demo.proponerProcesos(buzonId),
    );
  }

  /** Paso 6 del asistente: clasifica los últimos correos sin tocar Outlook. */
  pruebaSeco(buzonId: string, correos = 20): Promise<PruebaSeco> {
    return this.conDemo(
      () => this.api.fetch<PruebaSeco>(`${BASE}/buzones/${buzonId}/prueba-seco`, { method: 'POST', body: JSON.stringify({ correos }) }),
      () => this.demo.pruebaSeco(buzonId),
    );
  }

  /** Vuelve a correr la asignación con los datos actuales del correo. */
  recalcularAsignacion(correoId: string): Promise<Correo> {
    return this.conDemo(
      () => this.api.fetch<Correo>(`${BASE}/correos/${correoId}/recalcular-asignacion`, { method: 'POST' }),
      () => this.demo.recalcularAsignacion(correoId),
    );
  }

  /** Descarga el archivo (binario) y lo entrega al navegador con su nombre. */
  async descargarArchivo(archivo: Pick<ArchivoCorreo, 'id' | 'nombre'>): Promise<void> {
    let blob: Blob;
    if (this.modoDemo()) {
      blob = await this.demo.descargarArchivo(archivo.id);
    } else {
      const token = await this.auth.getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const base = environment.apiUrl.replace(/\/+$/, '');
      const resp = await fetch(`${base}${BASE}/archivos/${encodeURIComponent(archivo.id)}/descargar`, { headers });
      if (!resp.ok) {
        let detalle = `HTTP ${resp.status} al descargar el archivo`;
        try {
          detalle = ((await resp.json()) as { detail?: string }).detail ?? detalle;
        } catch {
          /* cuerpo no JSON */
        }
        throw new Error(detalle);
      }
      blob = await resp.blob();
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = archivo.nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
