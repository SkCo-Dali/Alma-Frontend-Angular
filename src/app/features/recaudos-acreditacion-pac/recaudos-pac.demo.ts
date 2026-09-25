// Datos de demostración de Acreditación PAC. Los documentos imitan la forma REAL de los
// logs de Cosmos (LogEstadistica + LogAsignacionUsuario, ver recaudos-pac.api.ts) y se
// convierten con la misma función que usará el backend, para probar ese mapeo desde ya.
// Lo de gestión (estado, referencia, historial…) no existe en los logs y se simula.
//
// Empresas, correos e identificadores son ficticios (dominio ejemplo.com) a propósito,
// para que no se confundan con clientes reales.

// Solo tipos: recaudos-pac.api importa este archivo y un import de valor sería
// circular. Por eso la unión de los logs (pagoDesdeLogs) la hace api, no este archivo.
import type {
  DatosGestion,
  EstadoMeta,
  EventoPago,
  LogAsignacionDoc,
  LogEstadisticaDoc,
} from './recaudos-pac.api';

/**
 * Catálogo de estados de la demo: los 7 del mockup (Portal PAC v2), ahora como datos.
 * En backend esto sale de una tabla configurable. Transiciones mientras negocio define
 * las reales: acreditar o gestionar manualmente cierran el caso; corregir el archivo lo
 * deja listo para Pipeline; pedir información lo deja esperando a la empresa.
 */
export const DEMO_ESTADOS: EstadoMeta[] = [
  {
    codigo: 'referenciado', orden: 10, nombre: 'Dinero referenciado en suspense', corto: 'Referenciado',
    accion: 'Verificar acreditación', color: '#00C73D', plantilla_correo: 'acreditacion',
    es_pipeline: false, al_confirmar: null, gestion_manual: false, activo: true,
    descripcion: 'El dinero fue encontrado en suspense. Al confirmar, se envía correo de acreditación a la empresa.',
  },
  {
    codigo: 'similitud', orden: 20, nombre: 'Similitud encontrada', corto: 'Similitud',
    accion: 'Ajustar y verificar', color: '#7CC400', plantilla_correo: 'acreditacion',
    es_pipeline: false, al_confirmar: null, gestion_manual: false, activo: true,
    descripcion: 'Se encontró coincidencia parcial en suspense. El sistema ajustará el registro y verificará la acreditación.',
  },
  {
    codigo: 'no_en_suspense', orden: 30, nombre: 'No está en suspense', corto: 'No en suspense',
    accion: 'Gestión analista', color: '#E03430', plantilla_correo: null,
    es_pipeline: false, al_confirmar: null, gestion_manual: true, activo: true,
    descripcion: 'El dinero no fue encontrado en suspense. Requiere intervención manual completa. Al confirmar, este caso será retirado de tu bandeja.',
  },
  {
    codigo: 'listo_pipeline', orden: 40, nombre: 'Listo para Pipeline', corto: 'Listo Pipeline',
    accion: 'Subir a Pipeline', color: '#00A3C4', plantilla_correo: 'acreditacion',
    es_pipeline: true, al_confirmar: null, al_notificar: 'errores_archivo', gestion_manual: false, activo: true,
    descripcion: 'El archivo fue validado correctamente. Consulta la ruta y sube el archivo a Pipeline. Selecciona la acción a ejecutar después de subir.',
  },
  {
    codigo: 'errores_archivo', orden: 50, nombre: 'Archivo con errores', corto: 'Errores archivo',
    accion: 'Corregir y subir', color: '#FFAE08', plantilla_correo: null,
    es_pipeline: false, al_confirmar: 'listo_pipeline', gestion_manual: false, activo: true,
    descripcion: 'El archivo tiene errores de formato o datos. Corrige antes de subir al Pipeline.',
  },
  {
    codigo: 'info_faltante', orden: 60, nombre: 'Información faltante', corto: 'Info faltante',
    accion: 'Solicitar información', color: '#F08C00', plantilla_correo: 'solicitud_info',
    es_pipeline: false, al_confirmar: 'info_faltante', gestion_manual: false, activo: true,
    descripcion: 'Falta información para armar el archivo. Se enviará correo a la empresa solicitando los datos.',
  },
  {
    codigo: 'multiples_pagos', orden: 70, nombre: 'Múltiples pagos', corto: 'Múlt. pagos',
    accion: 'Gestión analista', color: '#C2410C', plantilla_correo: null,
    es_pipeline: false, al_confirmar: null, gestion_manual: false, activo: true,
    descripcion: 'Se detectaron múltiples pagos en el mismo archivo. Separa y gestiona cada pago individualmente.',
  },
  {
    codigo: 'en_validacion', orden: 80, nombre: 'En validación', corto: 'En validación',
    accion: 'Validar pago', color: '#6D4AE0', plantilla_correo: null,
    es_pipeline: false, al_confirmar: null, gestion_manual: false, activo: true,
    descripcion: 'El clasificador envió este pago a validación manual. Revísalo y confirma.',
  },
];

const sis = (accion: string, fecha: string, tono: EventoPago['tono']): EventoPago => ({
  accion,
  tipo: 'automatico',
  tono,
  fecha,
  usuario: 'Sistema',
});

const RUTA = '//skandia-fs/pac/2026/09';

interface Semilla {
  n: number; // sufijo del id y de la referencia
  empresa: string;
  documento: string;
  correo: string;
  analista: 'Analista 1' | 'Analista 2' | 'Analista 3';
  monto: number;
  /** Solo si difiere del monto (para probar la alerta de descuadre). */
  monto_comprobante?: number | '';
  confianza: number;
  banco: string;
  fecha: string; // procesamiento = asignación
  hora: string;
  asunto: string;
  gestion: Omit<DatosGestion, 'referencia' | 'correo_empresa' | 'historial'> & {
    eventos: [string, EventoPago['tono']][];
  };
}

const SEMILLAS: Semilla[] = [
  { n: 821, empresa: 'INDUSTRIAS ANDINAS SAS', documento: '900111222', correo: 'tesoreria@industriasandinas.ejemplo.com', analista: 'Analista 1', monto: 45_200_000, confianza: 0.96, banco: 'BANCOLOMBIA', fecha: '2026-09-21', hora: '08:14', asunto: 'PAGO PAC SEPTIEMBRE // SOPORTE DE PAGO', gestion: { estado: 'referenciado', eventos: [['Cruce con suspense exitoso — dinero encontrado', 'ok']] } },
  { n: 822, empresa: 'BANCO DEL VALLE', documento: '860333444', correo: 'nomina@bancodelvalle.ejemplo.com', analista: 'Analista 2', monto: 12_800_000, confianza: 0.88, banco: 'DAVIVIENDA', fecha: '2026-09-21', hora: '09:30', asunto: 'RV: APORTES VOLUNTARIOS PAC // AGOSTO', gestion: { estado: 'similitud', eventos: [['Similitud parcial detectada en suspense', 'alerta']] } },
  { n: 823, empresa: 'ALIMENTOS DEL NORTE SAS', documento: '800555666', correo: 'pagos@alimentosnorte.ejemplo.com', analista: 'Analista 3', monto: 8_500_000, confianza: 0.91, banco: 'BBVA', fecha: '2026-09-20', hora: '14:22', asunto: 'SOPORTE PAGO PLANILLA PAC', gestion: { estado: 'no_en_suspense', eventos: [['Dinero no encontrado en suspense', 'error']] } },
  { n: 824, empresa: 'ENERGIA INTERCONECTADA SA', documento: '811777888', correo: 'rrhh@energiainter.ejemplo.com', analista: 'Analista 1', monto: 22_350_000, confianza: 0.94, banco: 'BANCO DE BOGOTA', fecha: '2026-09-20', hora: '10:05', asunto: 'PAGO PAC + ARCHIVO EXCEL AFILIADOS', gestion: { estado: 'listo_pipeline', ruta_archivo: `${RUTA}/ENERGIA_PAC-0824_20260920.xlsx`, eventos: [['Archivo y suspense validados correctamente', 'ok']] } },
  { n: 825, empresa: 'CEMENTOS DEL SUR SAS', documento: '890999000', correo: 'contabilidad@cementossur.ejemplo.com', analista: 'Analista 2', monto: 5_100_000, confianza: 0.72, banco: 'DAVIVIENDA', fecha: '2026-09-19', hora: '11:40', asunto: 'RV: RV: PAGO // FAVOR CONFIRMAR', gestion: { estado: 'errores_archivo', ruta_archivo: `${RUTA}/CEMSUR_PAC-0825_20260919.xlsx`, eventos: [['Archivo con errores de formato', 'error']] } },
  { n: 826, empresa: 'AEROLINEA CONTINENTAL SA', documento: '860123789', correo: 'beneficios@aerocontinental.ejemplo.com', analista: 'Analista 3', monto: 31_000_000, confianza: 0.97, banco: 'BANCOLOMBIA', fecha: '2026-09-19', hora: '15:10', asunto: 'PAGO PAC MES AGOSTO/2026 // SOPORTE DE PAGO', gestion: { estado: 'referenciado', eventos: [['Cruce con suspense exitoso', 'ok']] } },
  { n: 827, empresa: 'ALMACENES LA ESQUINA SAS', documento: '900456123', correo: 'talento@laesquina.ejemplo.com', analista: 'Analista 1', monto: 67_800_000, confianza: 0.83, banco: 'BANCO DE OCCIDENTE', fecha: '2026-09-18', hora: '08:55', asunto: 'APORTE PAC EMPLEADOS', gestion: { estado: 'info_faltante', eventos: [['Información faltante para armar archivo', 'alerta']] } },
  { n: 828, empresa: 'INDUSTRIAS ANDINAS SAS', documento: '900111222', correo: 'tesoreria@industriasandinas.ejemplo.com', analista: 'Analista 2', monto: 15_600_000, monto_comprobante: 15_060_000, confianza: 0.79, banco: 'BANCOLOMBIA', fecha: '2026-09-18', hora: '12:33', asunto: 'PAGOS PAC Y PLANILLA EMPLEADOR', gestion: { estado: 'multiples_pagos', eventos: [['Múltiples pagos detectados en archivo', 'alerta']] } },
  { n: 829, empresa: 'BANCO DEL VALLE', documento: '860333444', correo: 'nomina@bancodelvalle.ejemplo.com', analista: 'Analista 3', monto: 9_200_000, confianza: 0.93, banco: 'DAVIVIENDA', fecha: '2026-09-17', hora: '09:15', asunto: 'PAGO PAC // SOPORTE Y ARCHIVO', gestion: { estado: 'listo_pipeline', ruta_archivo: `${RUTA}/BVALLE_PAC-0829_20260917.xlsx`, eventos: [['Archivo y suspense validados', 'ok']] } },
  { n: 830, empresa: 'ENERGIA INTERCONECTADA SA', documento: '811777888', correo: 'rrhh@energiainter.ejemplo.com', analista: 'Analista 1', monto: 3_400_000, confianza: 0.86, banco: 'BANCO DE BOGOTA', fecha: '2026-09-17', hora: '14:00', asunto: 'RV: PAGO BONIFICACION VOLUNTARIA PAC', gestion: { estado: 'similitud', eventos: [['Similitud parcial detectada', 'alerta']] } },
  { n: 831, empresa: 'CEMENTOS DEL SUR SAS', documento: '890999000', correo: 'contabilidad@cementossur.ejemplo.com', analista: 'Analista 2', monto: 28_750_000, monto_comprobante: '', confianza: 0.9, banco: 'DAVIVIENDA', fecha: '2026-09-16', hora: '07:48', asunto: 'PAGO PAC SEPTIEMBRE', gestion: { estado: 'referenciado', eventos: [['Cruce con suspense exitoso', 'ok']] } },
  { n: 832, empresa: 'ALIMENTOS DEL NORTE SAS', documento: '800555666', correo: 'pagos@alimentosnorte.ejemplo.com', analista: 'Analista 3', monto: 41_000_000, confianza: 0.81, banco: 'BBVA', fecha: '2026-09-16', hora: '16:30', asunto: 'SOPORTE DE PAGO APORTES', gestion: { estado: 'info_faltante', eventos: [['Información faltante detectada', 'alerta']] } },
  // Nació como prueba de un estado SIN configurar (tarjeta gris punteada, panel en
  // solo lectura); ya se agregó "en_validacion" al catálogo y se ve como los demás.
  { n: 833, empresa: 'AEROLINEA CONTINENTAL SA', documento: '860123789', correo: 'beneficios@aerocontinental.ejemplo.com', analista: 'Analista 1', monto: 6_250_000, confianza: 0.92, banco: 'BANCOLOMBIA', fecha: '2026-09-16', hora: '11:05', asunto: 'PAGO PAC // VALIDACION MANUAL', gestion: { estado: 'en_validacion', eventos: [['Enviado a validación por el clasificador', 'info']] } },
];

// Imita un id de Outlook (base64 largo que empieza por "AAMk"); no es uno real.
const idCorreo = (n: number): string => `AAMkDEMOAGE${n}AAAAAAAAAAAAAAAAAAAAAAAAAAA=`;

export const DEMO_LOG_ESTADISTICA: LogEstadisticaDoc[] = SEMILLAS.map((s) => ({
  id: idCorreo(s.n),
  correlation_id: idCorreo(s.n),
  fecha_procesamiento: s.fecha,
  proceso: 'PAC',
  Grupo: 'PAC',
  score_confianza: s.confianza,
  etiqueta: 'PAC',
  asunto_correo: s.asunto,
  afiliado_nombre: s.empresa,
  afiliado_cedula: s.documento,
  afiliado_contrato: '',
  banco: s.banco,
  cuenta_origen: '',
  cuenta_destino_skandia: '560482869990000',
  nit_fondo: '8300380851',
  monto: String(s.monto),
  monto_comprobante:
    s.monto_comprobante === undefined ? String(s.monto) : String(s.monto_comprobante),
  fecha_carta: s.fecha,
  numero_solicitud_traslado: String(55_240_000 + s.n),
}));

export const DEMO_LOG_ASIGNACION: LogAsignacionDoc[] = SEMILLAS.map((s) => ({
  id: idCorreo(s.n),
  NombreAnalista: s.analista,
  FechaAsignacion: s.fecha,
  Proceso: 'PAC',
}));

/** Lo simulado de cada pago, por id de correo. */
export const DEMO_GESTION = new Map<string, DatosGestion>(
  SEMILLAS.map((s) => [
    idCorreo(s.n),
    {
      estado: s.gestion.estado,
      referencia: `PAC-0${s.n}`,
      correo_empresa: s.correo,
      ruta_archivo: s.gestion.ruta_archivo ?? null,
      historial: [
        sis('Correo recibido y clasificado', `${s.fecha}T${s.hora}:00`, 'info'),
        sis(`Asignado a ${s.analista}`, `${s.fecha}T${s.hora}:00`, 'info'),
        ...s.gestion.eventos.map(([accion, tono]) => sis(accion, `${s.fecha}T${s.hora}:30`, tono)),
      ],
    },
  ]),
);
