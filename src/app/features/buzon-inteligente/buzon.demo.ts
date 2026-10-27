// Datos de DEMOSTRACIÓN del Buzón Inteligente (área de Recaudos). Se usan solo
// cuando el backend no tiene el módulo disponible; ver BuzonApi.conDemo. Todo vive
// en memoria durante la sesión. Personas, correos, NIT y empresas son FICTICIOS.

import {
  AlertaInicio,
  ArchivoCorreo,
  CeldasArchivo,
  CorreccionDatos,
  HiloCorreo,
  MensajeHilo,
  ArchivoGenerado,
  ColumnaPlantilla,
  Exportacion,
  ModeloLeido,
  OrigenColumna,
  Plantilla,
  PlantillaIn,
  Salida,
  SalidaIn,
  VistaPrevia,
  Base,
  BaseIn,
  BaseUpdate,
  Buzon,
  BuzonIn,
  BuzonUpdate,
  CarpetaGraph,
  Categoria,
  CategoriaIn,
  Correo,
  CorreoDetalle,
  DisponibilidadIn,
  Ejecucion,
  FilaBase,
  FiltroCorreos,
  Grupo,
  GrupoIn,
  LecturaArchivo,
  Metricas,
  Persona,
  PersonaIn,
  Proceso,
  ProcesoIn,
  PropuestaProcesos,
  ReglaFija,
  ReglaIn,
  ResultadoAplicar,
  ResultadoAsignacion,
  ResultadoCarga,
  ResultadoPrueba,
  ResumenInicio,
  ResumenSync,
  RolMiembro,
} from './buzon.api';
import { nrm, simularAsignacion } from './buzon-asignacion';
import { matriz, nombreArchivo, salidaPara, sugerirColumna } from './buzon-exportacion';

const B_RECAUDOS = 'demo-buzon-recaudos';
const B_JURIDICA = 'demo-buzon-juridica';

function hace(horas: number, minutos = 0): string {
  return new Date(Date.now() - horas * 3_600_000 - minutos * 60_000).toISOString();
}

let seq = 100;
const nuevoId = (p: string) => `${p}-${++seq}`;

const CAMPOS_4X1000 = [
  { clave: 'afiliado_nombre', descripcion: 'Nombre completo del titular del contrato' },
  { clave: 'afiliado_cedula', descripcion: 'Cédula sin puntos ni espacios' },
  { clave: 'afiliado_contrato', descripcion: 'Número de contrato/afiliación Skandia' },
  { clave: 'banco', descripcion: 'Banco al que va dirigida la carta' },
  { clave: 'cuenta_origen', descripcion: 'Cuenta del afiliado a debitar' },
  { clave: 'cuenta_destino_skandia', descripcion: 'Cuenta Skandia destino' },
  { clave: 'nit_fondo', descripcion: 'NIT del fondo (debe ser 8300380851)' },
  { clave: 'monto', descripcion: 'Valor de la transferencia, solo dígitos' },
  { clave: 'fecha_carta', descripcion: 'Fecha de la carta (YYYY-MM-DD)' },
  { clave: 'tiene_comprobante_traslado', descripcion: 'true si existe el comprobante bancario' },
  { clave: 'datos_coinciden', descripcion: 'true si carta y certificado coinciden' },
  { clave: 'documentos_faltantes', descripcion: 'Documentos obligatorios que faltan' },
];

function cat(
  buzon: string,
  clave: string,
  nombre: string,
  descripcion: string,
  color: string,
  acciones: Categoria['acciones'],
  extra: Partial<Categoria> = {},
): Categoria {
  return {
    id: `demo-cat-${clave.toLowerCase()}`,
    buzon_id: buzon,
    clave,
    nombre,
    descripcion,
    ejemplos: [],
    palabras_clave: null,
    color,
    orden: 0,
    activa: true,
    es_fallback: false,
    umbral_confianza: null,
    campos_extraer: [],
    acciones,
    correos_30d: 0,
    proceso_id: null,
    ...extra,
  };
}

/** Proceso de cada etiqueta del buzón de Recaudos (demo). */
function procesoDeEtiqueta(clave: string): string | null {
  if (clave.startsWith('4X1000')) return 'demo-proc-4x1000';
  if (['PAC', 'MFUND', 'PILA'].includes(clave)) return `demo-proc-${clave.toLowerCase()}`;
  return null;
}

const asignar = (carpeta = true): Categoria['acciones'][number] => ({
  tipo: 'asignar_analista',
  parametros: {
    estrategia: 'round_robin',
    analistas: ['Laura Gómez', 'Andrés Pérez', 'Carolina Ruiz'],
    mover_a_carpeta_del_analista: carpeta,
  },
  orden: 3,
  activa: true,
});

function categoriasBase(): Categoria[] {
  const c4 = (clave: string, nombre: string, desc: string, color: string, carpeta: string, n: number) =>
    cat(
      B_RECAUDOS,
      clave,
      nombre,
      desc,
      color,
      [
        { tipo: 'categorizar', parametros: { categoria: clave }, orden: 1, activa: true },
        { tipo: 'mover', parametros: { carpeta, crear_si_no_existe: true }, orden: 2, activa: true },
        asignar(),
      ],
      {
        campos_extraer: CAMPOS_4X1000,
        palabras_clave: 'GMF, 4x1000, Decreto 660, traslado, fondo de pensiones voluntarias',
        ejemplos: ['Solicitud exención 4x1000 traslado FPV', 'Carta autorización débito Davivienda'],
        correos_30d: n,
      },
    );

  const lista: Categoria[] = [
    c4(
      '4X1000_DAVIVIENDA',
      '4x1000 · Davivienda',
      'Carta de autorización al banco firmada por el afiliado + certificado Skandia para traslado a FPV, SIN comprobante de traslado, y la cuenta destino es la de Skandia en Davivienda (482869995076).',
      '#E5392A',
      '4X1000 Davivienda',
      41,
    ),
    c4(
      '4X1000_BANCOLOMBIA',
      '4x1000 · Bancolombia',
      'Carta de autorización al banco + certificado Skandia, SIN comprobante, con cuenta destino Skandia en Bancolombia (200-3511643-8).',
      '#F2B600',
      '4X1000 Bancolombia',
      37,
    ),
    c4(
      '4X1000_OTROS_BANCOS',
      '4x1000 · Otros bancos',
      'Carta + certificado sin comprobante, con una cuenta destino distinta a las de Davivienda y Bancolombia.',
      '#8E8E93',
      '4X1000 Otros Bancos',
      9,
    ),
    c4(
      '4X1000_ACREDITAR',
      '4x1000 · Acreditar',
      'Llegan los TRES documentos: carta al banco, certificado Skandia y comprobante de traslado bancario aprobado, con NIT destino 830.038.085-1. Listo para acreditar.',
      '#00C83C',
      '4X1000 Acreditar',
      58,
    ),
    cat(
      B_RECAUDOS,
      '4X1000_INCOMPLETO',
      '4x1000 · Incompleto',
      'Falta uno de los dos documentos obligatorios (carta o certificado) o el NIT destino no es el del fondo. Se etiqueta para que un analista pida lo que falta.',
      '#FF9F0A',
      [{ tipo: 'categorizar', parametros: { categoria: '4X1000_INCOMPLETO' }, orden: 1, activa: true }],
      { campos_extraer: CAMPOS_4X1000, correos_30d: 14 },
    ),
    cat(
      B_RECAUDOS,
      'PAC',
      'PAC',
      'Correos del proceso PAC: contratos que empiezan por PC o referencias a planes colectivos. Se asignan al analista dueño de la empresa según la base de administración.',
      '#0A84FF',
      [
        { tipo: 'categorizar', parametros: { categoria: 'PAC' }, orden: 1, activa: true },
        asignar(true),
      ],
      { correos_30d: 22 },
    ),
    cat(
      B_RECAUDOS,
      'MFUND',
      'MFUND',
      'Correos relacionados con fondos de inversión MFUND (aportes, novedades de recaudo de fondos).',
      '#6D4AE0',
      [{ tipo: 'categorizar', parametros: { categoria: 'MFUND' }, orden: 1, activa: true }],
      { correos_30d: 11 },
    ),
    cat(
      B_RECAUDOS,
      'PILA',
      'PILA',
      'Planillas integradas de liquidación de aportes de empresas: número de planilla, NIT del aportante y periodo.',
      '#30D158',
      [{ tipo: 'categorizar', parametros: { categoria: 'PILA' }, orden: 1, activa: true }],
      { correos_30d: 8 },
    ),
    cat(
      B_RECAUDOS,
      'INFORMATIVO',
      'Informativo',
      'Notificaciones automáticas que no requieren gestión: consolidaciones de gestión de retiros, avisos bancarios, confirmaciones del sistema.',
      '#30B0C7',
      [
        { tipo: 'categorizar', parametros: { categoria: 'INFORMATIVO' }, orden: 1, activa: true },
        { tipo: 'notificar_teams', parametros: {}, orden: 2, activa: true },
      ],
      { correos_30d: 63 },
    ),
    cat(
      B_RECAUDOS,
      'OTROS',
      'Otros',
      'Todo lo que no encaja en las categorías anteriores. Queda siempre en revisión humana.',
      '#A2845E',
      [],
      { es_fallback: true, correos_30d: 17 },
    ),
    // Buzón Jurídica (ejemplo de otra área parametrizando su propio buzón)
    cat(
      B_JURIDICA,
      'DEMANDA',
      'Demanda o notificación judicial',
      'Notificaciones de juzgados, tutelas, demandas, requerimientos de entes de control. Suelen traer auto admisorio o radicado y un plazo de respuesta.',
      '#E5392A',
      [
        { tipo: 'categorizar', parametros: { categoria: 'DEMANDA' }, orden: 1, activa: true },
        {
          tipo: 'reenviar',
          parametros: { destinatarios: ['litigios@skandia.com.co'], comentario: 'Notificación judicial recibida. Resumen IA adjunto.' },
          orden: 2,
          activa: true,
        },
        { tipo: 'mover', parametros: { carpeta: 'Litigios', crear_si_no_existe: true }, orden: 3, activa: true },
      ],
      {
        campos_extraer: [
          { clave: 'radicado', descripcion: 'Número de radicado del proceso' },
          { clave: 'juzgado', descripcion: 'Despacho o entidad que notifica' },
          { clave: 'plazo_respuesta', descripcion: 'Fecha límite de respuesta (YYYY-MM-DD)' },
        ],
        correos_30d: 6,
      },
    ),
    cat(
      B_JURIDICA,
      'CONTRATO',
      'Solicitud de contrato',
      'Un área interna pide elaborar o revisar un contrato, otrosí o acuerdo de confidencialidad.',
      '#0A84FF',
      [
        { tipo: 'categorizar', parametros: { categoria: 'CONTRATO' }, orden: 1, activa: true },
        { tipo: 'mover', parametros: { carpeta: 'Contratos', crear_si_no_existe: true }, orden: 2, activa: true },
      ],
      { correos_30d: 12 },
    ),
    cat(B_JURIDICA, 'OTROS', 'Otros', 'Sin categoría clara. Revisión humana.', '#A2845E', [], {
      es_fallback: true,
      correos_30d: 4,
    }),
  ];
  lista.forEach((c, i) => {
    c.orden = i + 1;
    if (c.buzon_id === B_RECAUDOS) c.proceso_id = procesoDeEtiqueta(c.clave);
  });
  return lista;
}

const PROMPT_DEMO = `Eres el asistente que clasifica los correos del buzón de Recaudos.

PASO 1. Reconoce el proceso del correo:
- 4X1000: carta de autorización al banco firmada por el afiliado y certificado para traslado a FPV (exención GMF). Etiquetas: 4X1000_DAVIVIENDA, 4X1000_BANCOLOMBIA, 4X1000_OTROS_BANCOS, 4X1000_ACREDITAR, 4X1000_INCOMPLETO.
- PAC: aportes de planes colectivos; el contrato empieza por PC. No es PAC si es una solicitud de retiro.
- MFUND: novedades de recaudo de fondos MFUND.
- PILA: planillas de aportes de empresas.

PASO 2. Extrae en JSON: codigo_pac, nit_empresa, razon_social, valor, periodo, afiliado_cedula, afiliado_contrato.
Si dudas entre dos procesos, usa la etiqueta Validar.`;

function buzonesBase(): Buzon[] {
  return [
    {
      id: B_RECAUDOS,
      nombre: 'Recaudos',
      area: 'Recaudos Voluntarios',
      direccion: 'backpagos@skandia.com.co',
      correo_buzon_id: 'demo-correo-buzon-recaudos',
      estado_conexion: 'conectada',
      carpeta_vigilada: 'Inbox',
      modo: 'automatico',
      umbral_confianza: 0.85,
      max_correos_por_tick: 25,
      contexto:
        'Área de Recaudos Voluntarios de Skandia Pensiones y Cesantías. Recibe soportes del proceso 4x1000 (GMF): carta de autorización al banco firmada por el afiliado, certificado Skandia para traslados a FPV (firmado por el Director de Servicio al Cliente) y, a veces, comprobante de traslado bancario. NIT administradora 800.148.514-2; NIT fondo 830.038.085-1. Cuentas Skandia: Davivienda 482869995076, Bancolombia 200-3511643-8. Marco legal: Decreto 660 de 2011 Art. 8 Num. 2 y Art. 879 ET Num. 14. También llegan correos de PAC (contratos PC…), MFUND y notificaciones informativas.',
      activo: true,
      ultima_sincronizacion: hace(0, 4),
      ultimo_error: null,
      categorias_count: 9,
      pendientes: 0,
      en_revision: 4,
      ejecutados_hoy: 27,
      miembros: [
        { user_id: 'u1', email: 'paula.mendez@ejemplo.com.co', name: 'Paula Méndez', rol: 'editor' },
        { user_id: 'u2', email: 'laura.gomez@ejemplo.com.co', name: 'Laura Gómez', rol: 'revisor' },
      ],
      rol: 'admin',
      puede_administrar: true,
      puede_conectar: true,
      conexion_compartida: true,
      conectada_por: 'admin.demo@ejemplo.com.co',
      modo_clasificacion: 'prompt',
      agente_nombre: null,
      prompt_area: PROMPT_DEMO,
      al_desactivar: 'respaldo',
      borrador_en_hilo: true,
    },
    {
      id: B_JURIDICA,
      nombre: 'Jurídica',
      area: 'Vicepresidencia Jurídica',
      direccion: 'juridica@skandia.com.co',
      correo_buzon_id: 'demo-correo-buzon-juridica',
      estado_conexion: 'sin_conectar',
      carpeta_vigilada: 'Inbox',
      modo: 'sugerir',
      umbral_confianza: 0.8,
      max_correos_por_tick: 25,
      contexto:
        'Buzón de la Vicepresidencia Jurídica. Recibe notificaciones judiciales, requerimientos de entes de control y solicitudes internas de contratos.',
      activo: true,
      ultima_sincronizacion: null,
      ultimo_error: null,
      categorias_count: 3,
      pendientes: 0,
      en_revision: 2,
      ejecutados_hoy: 0,
      miembros: [],
      rol: 'admin',
      puede_administrar: true,
      puede_conectar: true,
      conexion_compartida: false,
      conectada_por: null,
      modo_clasificacion: 'agente',
      agente_nombre: 'ClasificadorJuridica',
      prompt_area: null,
      al_desactivar: 'roundrobin',
      borrador_en_hilo: false,
    },
  ];
}

function reglasBase(): ReglaFija[] {
  return [
    {
      id: 'demo-regla-1',
      buzon_id: B_RECAUDOS,
      nombre: 'Consolidación gestión de retiros',
      remitente_contiene: 'gestionderetiros@skandia.com.co',
      asunto_contiene: 'CONSOLIDACION',
      cuerpo_contiene: null,
      categoria_id: 'demo-cat-informativo',
      categoria_clave: 'INFORMATIVO',
      orden: 1,
      activa: true,
    },
    {
      id: 'demo-regla-2',
      buzon_id: B_RECAUDOS,
      nombre: 'Notificaciones automáticas Bancolombia',
      remitente_contiene: 'notificaciones@bancolombia.com.co',
      asunto_contiene: null,
      cuerpo_contiene: 'transacción exitosa',
      categoria_id: 'demo-cat-informativo',
      categoria_clave: 'INFORMATIVO',
      orden: 2,
      activa: true,
    },
  ];
}

interface Sem {
  buzon: string;
  de: string;
  nombre: string;
  asunto: string;
  h: number;
  cat: string | null;
  conf: number | null;
  estado: Correo['estado'];
  origen: Correo['origen'];
  resumen: string;
  just: string;
  datos?: Record<string, unknown>;
  adj?: { nombre: string; tipo: string; tamano: number }[];
  asignado?: string;
  decidido?: string;
  error?: string;
}

function correosBase(cats: Categoria[]): Correo[] {
  const byClave = (b: string, k: string | null) => cats.find((c) => c.buzon_id === b && c.clave === k);
  const semillas: Sem[] = [
    {
      buzon: B_RECAUDOS, de: 'mrodriguez@fp.skandia.com.co', nombre: 'María Rodríguez · Financial Planner',
      asunto: 'Exención 4x1000 traslado FPV - Juan Carlos Mejía', h: 0.4, cat: '4X1000_ACREDITAR', conf: 0.97,
      estado: 'ejecutado', origen: 'ia',
      resumen: 'Traslado de $15.000.000 desde Bancolombia a Skandia FPV para Juan Carlos Mejía (CC 79.845.112). Llegan carta al banco, certificado Skandia y comprobante aprobado; los datos coinciden.',
      just: 'Los tres documentos del proceso están presentes y el NIT destino es 830.038.085-1. El comprobante indica “Solicitud aprobada”.',
      datos: { afiliado_nombre: 'Juan Carlos Mejía Torres', afiliado_cedula: '79845112', afiliado_contrato: '100006818611', banco: 'Bancolombia', cuenta_origen: '03412345678', cuenta_destino_skandia: '20035116438', nit_fondo: '8300380851', monto: '15000000', fecha_carta: '2026-09-15', tiene_comprobante_traslado: true, datos_coinciden: true, documentos_faltantes: '' },
      adj: [{ nombre: 'Carta_autorizacion_Bancolombia.pdf', tipo: 'application/pdf', tamano: 412300 }, { nombre: 'Certificado_Skandia_FPV.pdf', tipo: 'application/pdf', tamano: 188020 }, { nombre: 'Comprobante_traslado.pdf', tipo: 'application/pdf', tamano: 96500 }],
      asignado: 'Laura Gómez',
    },
    {
      buzon: B_RECAUDOS, de: 'asesor.pelta@samacapital.co', nombre: 'Agencia Pelta', asunto: 'RV: Autorización débito Davivienda - Ana Lucía Prada', h: 1.2,
      cat: '4X1000_DAVIVIENDA', conf: 0.93, estado: 'ejecutado', origen: 'ia',
      resumen: 'Carta de autorización a Davivienda y certificado Skandia para Ana Lucía Prada (CC 52.331.908), $8.500.000. Sin comprobante de traslado.',
      just: 'Carta + certificado presentes, cuenta destino 482869995076 (Skandia Davivienda), sin comprobante.',
      datos: { afiliado_nombre: 'Ana Lucía Prada Gil', afiliado_cedula: '52331908', afiliado_contrato: '100007120344', banco: 'Davivienda', cuenta_origen: '00560012345', cuenta_destino_skandia: '482869995076', nit_fondo: '8300380851', monto: '8500000', fecha_carta: '2026-09-14', tiene_comprobante_traslado: false, datos_coinciden: true },
      adj: [{ nombre: 'Carta_Davivienda_firmada.pdf', tipo: 'application/pdf', tamano: 388100 }, { nombre: 'Certificacion_traslado.pdf', tipo: 'application/pdf', tamano: 170400 }],
      asignado: 'Andrés Pérez',
    },
    {
      buzon: B_RECAUDOS, de: 'contacto@gravit.co', nombre: 'Gravit Consultores', asunto: 'Soporte 4x1000 cliente Restrepo', h: 2.1,
      cat: '4X1000_INCOMPLETO', conf: 0.88, estado: 'revision', origen: 'ia',
      resumen: 'Solo llega la carta de autorización al banco de Pedro Restrepo (CC 80.112.334). Falta el certificado Skandia.',
      just: 'Se identifica un único documento obligatorio; sin certificado no se puede validar el traslado.',
      datos: { afiliado_nombre: 'Pedro Restrepo Ávila', afiliado_cedula: '80112334', banco: 'Davivienda', monto: '4200000', tiene_comprobante_traslado: false, datos_coinciden: false, documentos_faltantes: 'certificado_skandia' },
      adj: [{ nombre: 'carta.pdf', tipo: 'application/pdf', tamano: 254000 }],
    },
    {
      buzon: B_RECAUDOS, de: 'nomina@constructorasol.com', nombre: 'Constructora Sol SAS', asunto: 'Aporte PAC septiembre - PC0001234', h: 3,
      cat: 'PAC', conf: 0.91, estado: 'ejecutado', origen: 'ia',
      resumen: 'Empresa envía planilla de aportes del plan colectivo PC0001234 correspondiente a septiembre.',
      just: 'Referencia a contrato PC y planilla de aportes colectivos.',
      datos: {
        codigo_pac: 'PC0001234', nit_empresa: '900.123.456-7', razon_social: 'Constructora Sol SAS', valor: '18450000', periodo: '2026-09',
        afiliados: [
          { cedula: '79000001', nombre: 'Pedro Ejemplo Ruiz', valor: '8250000' },
          { cedula: '52987654', nombre: 'Ana Demo Torres', valor: '6200000' },
          { cedula: '1020300400', nombre: 'Luis Ficticio Mora', valor: '4000000' },
        ],
      },
      adj: [{ nombre: 'Planilla_sep_2026.xlsx', tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', tamano: 48210 }],
      asignado: 'Carolina Ruiz',
    },
    {
      buzon: B_RECAUDOS, de: 'gestionderetiros@skandia.com.co', nombre: 'Gestión de Retiros', asunto: 'CONSOLIDACION RETIROS 15-09-2026', h: 4.5,
      cat: 'INFORMATIVO', conf: 1, estado: 'ejecutado', origen: 'regla',
      resumen: 'Consolidado diario de retiros. Coincide con la regla fija “Consolidación gestión de retiros”.',
      just: 'Regla fija: remitente gestionderetiros@ y asunto contiene CONSOLIDACION.',
    },
    {
      buzon: B_RECAUDOS, de: 'jpardo@skandia.com.co', nombre: 'Julián Pardo', asunto: 'Duda sobre recaudo MFUND agosto', h: 5.2,
      cat: 'MFUND', conf: 0.79, estado: 'revision', origen: 'ia',
      resumen: 'Consulta interna sobre un recaudo de MFUND que no aparece aplicado en agosto.',
      just: 'Menciona MFUND y recaudo, pero es una consulta y no un soporte; confianza bajo el umbral.',
    },
    {
      buzon: B_RECAUDOS, de: 'cliente.perez@gmail.com', nombre: 'Roberto Pérez', asunto: 'Quiero saber cómo va mi traslado', h: 6,
      cat: 'OTROS', conf: 0.62, estado: 'revision', origen: 'ia',
      resumen: 'Cliente pregunta por el estado de un traslado sin adjuntar soportes ni número de contrato.',
      just: 'No hay documentos del proceso ni referencia identificable. Queda para revisión.',
    },
    {
      buzon: B_RECAUDOS, de: 'notificaciones@bancolombia.com.co', nombre: 'Bancolombia', asunto: 'Transacción exitosa - transferencia programada', h: 7.3,
      cat: 'INFORMATIVO', conf: 1, estado: 'ejecutado', origen: 'regla',
      resumen: 'Notificación automática del banco. Coincide con la regla “Notificaciones automáticas Bancolombia”.',
      just: 'Regla fija por remitente y texto del cuerpo.',
    },
    {
      buzon: B_RECAUDOS, de: 'agencia.exclusiva@skandia.com.co', nombre: 'Agencia Exclusiva Norte', asunto: 'Documentos 4x1000 Itaú - Sandra Marín', h: 9,
      cat: '4X1000_OTROS_BANCOS', conf: 0.9, estado: 'ejecutado', origen: 'humano', decidido: 'dapedraza@skandia.com.co',
      resumen: 'Carta a Itaú y certificado Skandia para Sandra Marín; la cuenta destino no es Davivienda ni Bancolombia.',
      just: 'La IA propuso 4X1000_INCOMPLETO por un dato ilegible; el analista corrigió a Otros bancos.',
      datos: { afiliado_nombre: 'Sandra Marín López', afiliado_cedula: '39571220', banco: 'ITAU', monto: '6000000', tiene_comprobante_traslado: false },
      adj: [{ nombre: 'Carta_Itau.pdf', tipo: 'application/pdf', tamano: 301200 }, { nombre: 'Certificado.pdf', tipo: 'application/pdf', tamano: 160000 }],
      asignado: 'Laura Gómez',
    },
    {
      buzon: B_RECAUDOS, de: 'fp.torres@fp.skandia.com.co', nombre: 'Camilo Torres · FP', asunto: 'Traslado FPV Bancolombia - Luisa Fernanda Ortiz', h: 26,
      cat: '4X1000_BANCOLOMBIA', conf: 0.95, estado: 'error', origen: 'ia', error: 'Graph 403 al mover a “Laura Gómez”: el buzón no tiene permiso Mail.ReadWrite todavía.',
      resumen: 'Carta a Bancolombia y certificado Skandia para Luisa Fernanda Ortiz, $12.000.000.',
      just: 'Carta + certificado, cuenta destino 200-3511643-8, sin comprobante.',
      datos: { afiliado_nombre: 'Luisa Fernanda Ortiz', afiliado_cedula: '1020456789', banco: 'Bancolombia', monto: '12000000' },
      adj: [{ nombre: 'Carta_Bancolombia.pdf', tipo: 'application/pdf', tamano: 402000 }],
    },
    {
      buzon: B_RECAUDOS, de: 'tesoreria@cafedelvalle.example', nombre: 'Café del Valle Ltda', asunto: 'Aporte PAC octubre - contrato pc-3105', h: 0.9,
      cat: 'PAC', conf: 0.74, estado: 'revision', origen: 'ia',
      resumen: 'La empresa envía el soporte del aporte PAC de octubre del contrato PC3105 por $6.200.000.',
      just: 'Referencia a contrato PC y soporte de pago, pero el valor no coincide con la planilla adjunta: confianza bajo el umbral.',
      datos: {
        codigo_pac: 'pc-3105', nit_empresa: '901222333', razon_social: 'Café del Valle Ltda', valor: '6200000', periodo: '2026-10',
        afiliados: [{ cedula: '43111222', nombre: 'Marta Prueba Gil', valor: '6200000' }],
      },
      adj: [{ nombre: 'Soporte_pago_octubre.pdf', tipo: 'application/pdf', tamano: 132000 }],
    },
    {
      buzon: B_RECAUDOS, de: 'nomina@agropacifico.example', nombre: 'Agro Pacífico SAS', asunto: 'Planilla PILA septiembre NIT 900777888', h: 2.6,
      cat: 'PILA', conf: 0.92, estado: 'ejecutado', origen: 'ia',
      resumen: 'Planilla PILA del periodo 2026-09 del aportante Agro Pacífico SAS.',
      just: 'Número de planilla, NIT del aportante y periodo presentes.',
      datos: { numero_planilla: '8800123456', nit_aportante: '900777888', periodo: '2026-09' },
      adj: [{ nombre: 'Planilla_PILA.pdf', tipo: 'application/pdf', tamano: 98000 }],
    },
    {
      buzon: B_JURIDICA, de: 'notificaciones@cendoj.ramajudicial.gov.co', nombre: 'Rama Judicial', asunto: 'Notificación auto admisorio - Rad. 11001310300420260045600', h: 1.5,
      cat: 'DEMANDA', conf: 0.96, estado: 'revision', origen: 'ia',
      resumen: 'Juzgado 4 Civil del Circuito de Bogotá notifica auto admisorio de demanda ordinaria contra Skandia. Plazo de contestación 20 días hábiles.',
      just: 'Remitente judicial, radicado de 23 dígitos y auto admisorio adjunto.',
      datos: { radicado: '11001310300420260045600', juzgado: 'Juzgado 4 Civil del Circuito de Bogotá', plazo_respuesta: '2026-10-14' },
      adj: [{ nombre: 'Auto_admisorio.pdf', tipo: 'application/pdf', tamano: 655000 }],
    },
    {
      buzon: B_JURIDICA, de: 'compras@skandia.com.co', nombre: 'Compras', asunto: 'Elaboración contrato proveedor de mensajería', h: 3.7,
      cat: 'CONTRATO', conf: 0.9, estado: 'revision', origen: 'ia',
      resumen: 'Compras solicita elaborar el contrato con el nuevo proveedor de mensajería; adjunta propuesta comercial y RUT.',
      just: 'Solicitud interna explícita de elaboración de contrato con soportes.',
      adj: [{ nombre: 'Propuesta_comercial.pdf', tipo: 'application/pdf', tamano: 220000 }, { nombre: 'RUT.pdf', tipo: 'application/pdf', tamano: 90000 }],
    },
  ];
  return semillas.map((s, i) => {
    const c = byClave(s.buzon, s.cat);
    const buz = s.buzon === B_RECAUDOS ? 'Recaudos' : 'Jurídica';
    return {
      id: `demo-correo-${i + 1}`,
      buzon_id: s.buzon,
      buzon_nombre: buz,
      remitente: s.de,
      remitente_nombre: s.nombre,
      asunto: s.asunto,
      recibido_en: hace(s.h),
      tiene_adjuntos: !!s.adj?.length,
      adjuntos: (s.adj ?? []).map((a) => ({ ...a, texto_extraido: a.tipo.includes('pdf') || a.tipo.includes('sheet') })),
      resumen: s.resumen,
      categoria_id: c?.id ?? null,
      categoria_clave: c?.clave ?? null,
      categoria_nombre: c?.nombre ?? null,
      categoria_color: c?.color ?? null,
      confianza: s.conf,
      justificacion: s.just,
      datos_extraidos: s.datos ?? null,
      estado: s.estado,
      origen: s.origen,
      asignado_a: s.asignado ?? null,
      decidido_por: s.decidido ?? (s.estado === 'ejecutado' ? 'sistema' : null),
      decidido_en: s.estado === 'ejecutado' ? hace(s.h - 0.05) : null,
      categoria_sugerida_id: s.decidido ? 'demo-cat-4x1000_incompleto' : (c?.id ?? null),
      error: s.error ?? null,
      modelo_ia: s.origen === 'regla' ? null : 'gpt-4.1',
      created_at: hace(s.h),
      // La asignación 2.0 la calcula DemoStore con los grupos, el equipo y las bases.
      proceso_clave: null,
      grupo_id: null,
      grupo_nombre: null,
      asignado_persona_id: null,
      asignacion_traza: [],
      asignado_nombre: null,
    };
  });
}

// ── 2.0: procesos, grupos, equipo y bases (Recaudos) ─────────────────────────

function procesosBase(): Proceso[] {
  const p = (clave: string, nombre: string, color: string, orden: number, descripcion: string, exclusiones: string | null, campos: [string, string, boolean][]): Proceso => ({
    id: `demo-proc-${clave.toLowerCase()}`,
    buzon_id: B_RECAUDOS,
    clave,
    nombre,
    descripcion,
    exclusiones,
    campos_extraer: campos.map(([c, d, k]) => ({ clave: c, descripcion: d, critico: k })),
    color,
    orden,
    activo: true,
    etiquetas: [],
  });
  return [
    p('4X1000', 'Exención 4x1000', '#E5392A', 1,
      'Carta de autorización al banco firmada por el afiliado y certificado Skandia para traslado a FPV; a veces llega el comprobante del traslado.',
      'No es 4x1000 si solo preguntan por el estado de un traslado sin soportes.',
      [['afiliado_cedula', 'Cédula del afiliado, solo dígitos', true], ['afiliado_contrato', 'Contrato Skandia', true], ['banco', 'Banco de la carta', false], ['monto', 'Valor del traslado', false], ['tiene_comprobante_traslado', 'Si llega el comprobante', false]]),
    p('PAC', 'Planes colectivos (PAC)', '#0A84FF', 2,
      'Aportes de planes colectivos de empresas: contrato que empieza por PC, planilla o soporte de pago de la empresa.',
      'No es PAC si la empresa pide un retiro o una certificación.',
      [['codigo_pac', 'Código del contrato PAC (PC + número)', true], ['nit_empresa', 'NIT de la empresa', true], ['razon_social', 'Razón social', false], ['valor', 'Valor del aporte', false], ['periodo', 'Periodo AAAA-MM', false], ['afiliados', 'Lista de afiliados del aporte (cedula, nombre, valor)', false]]),
    p('MFUND', 'Fondos MFUND', '#6D4AE0', 3, 'Novedades de recaudo de fondos MFUND: aportes y aplicaciones pendientes.', null,
      [['numero_encargo', 'Número de encargo', true], ['valor', 'Valor', false]]),
    p('PILA', 'Planillas PILA', '#30D158', 4, 'Planillas integradas de liquidación de aportes enviadas por empresas.', null,
      [['numero_planilla', 'Número de planilla', true], ['nit_aportante', 'NIT del aportante', true], ['periodo', 'Periodo AAAA-MM', false]]),
  ];
}

function gruposBase(): Grupo[] {
  const g = (id: string, nombre: string, orden: number, etiquetas: string[], extra: Partial<Grupo> = {}): Grupo => ({
    id: `demo-g-${id}`,
    buzon_id: B_RECAUDOS,
    nombre,
    etiquetas,
    destino: 'personas',
    carpeta: null,
    sin_activos_modo: 'cola',
    sin_activos_carpeta: null,
    sin_activos_persona_id: null,
    orden,
    activo: true,
    reglas: [],
    ...extra,
  });
  return [
    g('4x1000', '4X1000', 1, ['4X1000_DAVIVIENDA', '4X1000_BANCOLOMBIA', '4X1000_OTROS_BANCOS', '4X1000_ACREDITAR', '4X1000_INCOMPLETO']),
    g('pac', 'PAC', 2, ['PAC'], {
      sin_activos_modo: 'carpeta',
      sin_activos_carpeta: 'PAC sin analista',
      reglas: [
        {
          id: 'demo-r-pac-1',
          grupo_id: 'demo-g-pac',
          base_id: 'demo-base-pac',
          base_nombre: 'BASE PAC',
          cruces: [
            { campo: 'codigo_pac', columna: 'CODIGO PAC', comparacion: 'pc' },
            { campo: 'nit_empresa', columna: 'NIT', comparacion: 'doc' },
          ],
          col_responsable: 'ANALISTA',
          col_respaldo: 'BACKUP',
          orden: 1,
          activa: true,
        },
      ],
    }),
    g('fondos', 'MFUND y PILA', 3, ['MFUND', 'PILA'], { destino: 'carpeta', carpeta: 'MFUND' }),
    g('info', 'Informativos', 4, ['INFORMATIVO'], { destino: 'categorizar' }),
    // Sin nadie activo: sus correos quedan en la cola «Sin asignar» (alerta al líder).
    g('otros', 'Otros', 5, ['OTROS']),
  ];
}

function equipoBase(): (Persona & { buzon_id: string })[] {
  const p = (id: string, nombre: string, carpeta: string | null, disponible: boolean, orden: number, grupos: Persona['grupos']) => ({
    id: `demo-p-${id}`,
    buzon_id: B_RECAUDOS,
    nombre,
    correo: `${nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.')}@ejemplo.com.co`,
    carpeta,
    disponible,
    orden,
    carga_hoy: 0,
    abiertos: 0,
    grupos,
  });
  return [
    p('laura', 'Laura Gómez', 'Laura Gómez', true, 1, { 'demo-g-4x1000': { activa: true, respaldo_id: 'demo-p-andres' } }),
    p('andres', 'Andrés Pérez', 'Andrés Pérez', true, 2, {
      'demo-g-4x1000': { activa: true, respaldo_id: null },
      'demo-g-pac': { activa: true, respaldo_id: 'demo-p-carolina' },
    }),
    p('carolina', 'Carolina Ruiz', 'Carolina Ruiz', true, 3, { 'demo-g-pac': { activa: true, respaldo_id: 'demo-p-mateo' } }),
    p('mateo', 'Mateo Salazar', 'Mateo Salazar', true, 4, { 'demo-g-pac': { activa: true, respaldo_id: 'demo-p-carolina' } }),
    p('valentina', 'Valentina Ríos', null, false, 5, { 'demo-g-4x1000': { activa: true, respaldo_id: 'demo-p-laura' } }),
  ];
}

const COLS_PAC = ['CODIGO PAC', 'NIT', 'RAZON SOCIAL', 'ANALISTA', 'BACKUP'];
const FILAS_PAC: FilaBase[] = [
  ['PC0001234', '900123456', 'Constructora Sol SAS', 'Carolina Ruiz', 'Mateo Salazar'],
  ['PC0002210', '800456789', 'Logística Andina SAS', 'mateo.salazar@ejemplo.com.co', 'Carolina Ruiz'],
  ['PC0003105', '901222333', 'Café del Valle Ltda', 'Caro R.', 'Mateo Salazar'],
  ['PC0004420', '860111222', 'Textiles Norte SA', 'Andrés', 'Carolina Ruiz'],
  ['PC0005001', '900777888', 'Agro Pacífico SAS', '', ''],
  ['PC0006150', '830444555', 'Servicios Médicos Integrales SAS', 'Valentina Ríos', 'Laura Gómez'],
  ['PC0007312', '901333444', 'Transportes del Sur SAS', 'Carolina Ruiz', 'Andrés Pérez'],
].map((r) => Object.fromEntries(COLS_PAC.map((c, i) => [c, r[i]])));

function basesBase(): Base[] {
  return [
    {
      id: 'demo-base-pac',
      nombre: 'BASE PAC',
      origen: 'sharepoint',
      archivo: 'BASE_PAC.xlsx',
      hoja: 'Asignación',
      fila_encabezado: 3,
      columnas: [...COLS_PAC],
      total_filas: FILAS_PAC.length,
      estado: 'ok',
      motivo: null,
      sharepoint_url: 'https://ejemplo.sharepoint.com/sites/recaudos/Documentos/BASE_PAC.xlsx',
      vinculos: {},
      cargada_en: hace(26),
      cargada_por: 'paula.mendez@ejemplo.com.co',
      buzones: [B_RECAUDOS],
      usos: 1,
    },
    {
      id: 'demo-base-mfund',
      nombre: 'BASE ENCARGOS MFUND',
      origen: 'archivo',
      archivo: null,
      hoja: null,
      fila_encabezado: null,
      columnas: [],
      total_filas: 0,
      estado: 'rechazado',
      motivo: 'El archivo no trae filas debajo de los encabezados.',
      sharepoint_url: null,
      vinculos: {},
      cargada_en: null,
      cargada_por: null,
      buzones: [B_RECAUDOS],
      usos: 0,
    },
  ];
}

// ── Exportación (059) ────────────────────────────────────────────────────────

function plantillasBase(): Plantilla[] {
  const col = (encabezado: string, origen: OrigenColumna, formato: ColumnaPlantilla['formato'] = 'texto'): ColumnaPlantilla => ({ encabezado, origen, formato });
  return [
    {
      id: 'demo-tpl-cargue-pac',
      buzon_id: B_RECAUDOS,
      nombre: 'Cargue PAC',
      formato: 'xlsx',
      separador: ';',
      hoja: 'Cargue',
      nombre_archivo: 'Cargue_{codigo_pac}_{fecha}',
      titulo: [['CARGUE DE APORTES PAC'], ['Generado por Alma · Recaudos']],
      columnas: [
        col('CONSECUTIVO', { tipo: 'fila' }, 'entero'),
        col('CODIGO PAC', { tipo: 'campo', campo: 'codigo_pac' }),
        col('NIT EMPRESA', { tipo: 'campo', campo: 'nit_empresa' }),
        col('DOCUMENTO', { tipo: 'campo', campo: 'afiliados.cedula' }),
        col('NOMBRE', { tipo: 'campo', campo: 'afiliados.nombre' }),
        col('VALOR', { tipo: 'campo', campo: 'afiliados.valor' }, 'moneda'),
        col('FECHA RECIBIDO', { tipo: 'correo', dato: 'fecha' }, 'fecha'),
        col('ANALISTA', { tipo: 'base', base_id: 'demo-base-pac', campo: 'codigo_pac', columna_busqueda: 'CODIGO PAC', columna_resultado: 'ANALISTA', comparacion: 'pc' }),
        col('VALOR CON GMF', { tipo: 'formula', formula: '=F{fila}*1.004' }, 'moneda'),
        col('OBSERVACION', { tipo: 'fijo', valor: 'Cargue automático Alma' }),
      ],
      detalle: 'afiliados',
      modelo: 'MODELO_CARGUE_PAC.xlsx',
      updated_at: hace(72),
      updated_by: 'paula.mendez@ejemplo.com.co',
    },
  ];
}

function salidasBase(): Salida[] {
  const s = (id: string, proceso: string, nombre: string, modo: Salida['modo'], orden: number, extra: Partial<Salida> = {}): Salida => ({
    id: `demo-sal-${id}`,
    proceso_id: `demo-proc-${proceso}`,
    nombre,
    modo,
    etiquetas: null,
    plantilla_id: null,
    orden,
    activa: true,
    ...extra,
  });
  return [
    s('4x-tabla', '4x1000', 'Tabla 4X1000', 'tabla', 1, { etiquetas: ['4X1000_DAVIVIENDA', '4X1000_BANCOLOMBIA', '4X1000_OTROS_BANCOS', '4X1000_ACREDITAR'] }),
    s('4x-nada', '4x1000', 'Incompletos sin archivo', 'ninguno', 2, { etiquetas: ['4X1000_INCOMPLETO'] }),
    s('pac', 'pac', 'Cargue PAC', 'plantilla', 1, { plantilla_id: 'demo-tpl-cargue-pac' }),
    s('mfund', 'mfund', 'Sin archivo', 'ninguno', 1),
    s('pila', 'pila', 'Tabla PILA', 'tabla', 1),
  ];
}

const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clonar = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Vista previa de un Excel/CSV en el navegador (solo demo; el real lo lee el backend). */
export async function demoLeerArchivo(archivo: File, hoja?: string | null, filaEncabezado?: number | null): Promise<LecturaArchivo> {
  const XLSX = await import('xlsx');
  const csv = /\.csv$/i.test(archivo.name);
  if (!csv && !/\.(xlsx|xlsm|xls)$/i.test(archivo.name)) throw new Error('La base debe ser un Excel (.xlsx) o un .csv.');
  const wb = csv ? XLSX.read(await archivo.text(), { type: 'string' }) : XLSX.read(new Uint8Array(await archivo.arrayBuffer()), { type: 'array' });
  const hojas = csv ? [] : wb.SheetNames;
  const elegida = hoja && wb.SheetNames.includes(hoja) ? hoja : wb.SheetNames[0];
  const filas = XLSX.utils
    .sheet_to_json<unknown[]>(wb.Sheets[elegida], { header: 1, blankrows: false, defval: '', raw: false })
    .map((r) => r.map((c) => String(c ?? '').trim()));
  let idx = filaEncabezado ? filaEncabezado - 1 : 0;
  if (!filaEncabezado) {
    let mejor = 0;
    filas.slice(0, 20).forEach((f, i) => {
      const n = f.filter((c) => c && isNaN(Number(c.replace(',', '.')))).length;
      if (n > mejor) [mejor, idx] = [n, i];
    });
    if (mejor < 2) throw new Error('No encontré una fila de encabezados (al menos dos columnas con nombre).');
  }
  if (idx < 0 || idx >= filas.length) throw new Error('La fila de encabezados está fuera del archivo.');
  const vistos = new Map<string, number>();
  const columnas = filas[idx].map((c, i) => {
    let n = c || `Columna ${i + 1}`;
    const k = vistos.get(n) ?? 0;
    vistos.set(n, k + 1);
    if (k) n = `${n} (${k + 1})`;
    return n;
  });
  const datos = filas
    .slice(idx + 1)
    .filter((f) => f.some((c) => c))
    .map((f) => Object.fromEntries(columnas.map((c, i) => [c, f[i] ?? ''])));
  const titulo = filas.slice(0, idx).map((f) => f.filter(Boolean).join(' ')).filter(Boolean).join(' · ');
  return {
    hojas,
    hoja: csv ? null : elegida,
    fila_encabezado: idx + 1,
    columnas,
    total_filas: datos.length,
    muestra: datos.slice(0, 20),
    titulo: titulo || null,
    filas: datos.slice(0, 500),
  };
}

function carpetasBase(): CarpetaGraph[] {
  const h = (nombre: string, total: number, hijas: CarpetaGraph[] = []): CarpetaGraph => ({
    id: `f-${nombre}`, nombre, total, no_leidos: Math.floor(total / 5), hijas,
  });
  return [
    h('Bandeja de entrada', 214, []),
    h('4X1000 Acreditar', 58), h('4X1000 Davivienda', 41), h('4X1000 Bancolombia', 37), h('4X1000 Otros Bancos', 9),
    h('Laura Gómez', 33), h('Andrés Pérez', 29), h('Carolina Ruiz', 31), h('Mateo Salazar', 18),
    h('MFUND', 22), h('PAC sin analista', 0),
    h('2026', 812, [h('SEPTIEMBRE', 140), h('AGOSTO', 173)]),
  ];
}

// ── Almacén de demo ──────────────────────────────────────────────────────────

export class DemoStore {
  buzones = buzonesBase();
  categorias = categoriasBase();
  reglas = reglasBase();
  correos = correosBase(this.categorias);
  carpetas = carpetasBase();
  ejecuciones = new Map<string, Ejecucion[]>();
  procesos = procesosBase();
  grupos = gruposBase();
  equipo = equipoBase();
  bases = basesBase();
  filasPorBase = new Map<string, FilaBase[]>([['demo-base-pac', FILAS_PAC.map((f) => ({ ...f }))]]);

  salidas = salidasBase();
  plantillas = plantillasBase();
  archivos: ArchivoCorreo[] = [];
  /** Celdas de cada archivo generado (para descargarlo en la demo). */
  private contenidos = new Map<string, { hoja: string; formato: 'xlsx' | 'csv'; separador: string; celdas: string[][] }>();

  constructor() {
    // En orden, para que el round-robin vea la carga que va quedando.
    this.correos.forEach((c, i) => (this.correos[i] = this.asignarCorreo(c)));
    this.correos.filter((c) => c.estado === 'ejecutado').forEach((c) => this.generarArchivo(c, 'sistema', c.decidido_en ?? c.created_at));
    // Bandeja (060): un posible duplicado y un correo con respuesta en el hilo.
    const pac = this.correos.filter((c) => c.proceso_clave === 'PAC');
    if (pac.length >= 2) {
      const [orig, dup] = [pac[pac.length - 1], pac[0]];
      this.correos = this.correos.map((c) =>
        c.id === dup.id ? { ...c, estado: 'revision', duplicado_de: orig.id, duplicado_asunto: orig.asunto, duplicado_estado: 'posible' } : c,
      );
    }
    const conRespuesta = this.correos.find((c) => c.estado === 'ejecutado' && c.proceso_clave);
    if (conRespuesta) this.correos = this.correos.map((c) => (c.id === conRespuesta.id ? { ...c, respuestas: 1 } : c));
  }

  // ── Bandeja (060) ──
  hilo(correoId: string): HiloCorreo {
    const c = this.correos.find((x) => x.id === correoId);
    if (!c) throw new Error('Correo no encontrado.');
    const b = this.buzones.find((x) => x.id === c.buzon_id);
    const archivos = this.archivosCorreo(correoId);
    const msg = (x: Correo, esEste: boolean): MensajeHilo => ({
      id: x.id, remitente: x.remitente, remitente_nombre: x.remitente_nombre, asunto: x.asunto, recibido_en: x.recibido_en,
      adjuntos: x.adjuntos.map((a) => a.nombre), resumen: x.resumen, estado: x.estado, asignado_a: x.asignado_a, es_este: esEste,
    });
    const items = [msg(c, true)];
    if (c.respuestas) {
      const r = new Date(new Date(c.recibido_en).getTime() + 3_600_000).toISOString();
      items.push({ ...msg(c, false), id: `${c.id}-r`, asunto: `RE: ${c.asunto}`, recibido_en: r, adjuntos: [], resumen: 'Muchas gracias, quedamos atentos.' });
    }
    return {
      buzon: { nombre: b?.nombre ?? '', direccion: b?.direccion ?? '', carpeta_vigilada: b?.carpeta_vigilada ?? 'Inbox' },
      items,
      borrador: archivos.find((a) => a.borrador_en_hilo) ?? null,
      ultima_version: archivos[0]?.version ?? null,
    };
  }

  decidirDuplicado(correoId: string, esDuplicado: boolean, por: string): Correo {
    const i = this.correos.findIndex((x) => x.id === correoId);
    if (i < 0) throw new Error('Correo no encontrado.');
    const c: Correo = esDuplicado
      ? { ...this.correos[i], duplicado_estado: 'confirmado', estado: 'ignorado', origen: 'humano', decidido_por: por, decidido_en: new Date().toISOString() }
      : { ...this.correos[i], duplicado_estado: 'descartado' };
    this.correos[i] = c;
    this.correos = [...this.correos];
    return clonar(c);
  }

  celdasArchivo(archivoId: string): CeldasArchivo {
    const a = this.archivos.find((x) => x.id === archivoId);
    const cont = this.contenidos.get(archivoId);
    if (!a || !cont) throw new Error('Archivo no encontrado.');
    const c = this.correos.find((x) => x.id === a.correo_id);
    const cat = this.categorias.find((x) => x.id === c?.categoria_id);
    const proceso = this.procesos.find((p) => p.id === cat?.proceso_id);
    const salida = this.salidas.find((s) => s.id === a.salida_id && s.proceso_id === proceso?.id);
    const t = salida?.modo === 'plantilla' ? this.plantillas.find((x) => x.id === salida.plantilla_id) : undefined;
    const enc = t?.titulo.length ?? 0;
    const encabezados = cont.celdas[enc] ?? [];
    const datos = cont.celdas.slice(enc + 1);
    const anotaciones: CeldasArchivo['anotaciones'] = [];
    encabezados.forEach((h, i) => {
      const tipo = t ? t.columnas[i]?.origen.tipo : 'campo';
      if (tipo !== 'campo' && tipo !== 'base') return;
      const vacias = datos.filter((f) => !String(f[i] ?? '').trim()).length;
      if (vacias) anotaciones.push({ estado: 'warn', texto: `${vacias} fila${vacias > 1 ? 's' : ''} con «${h}» vacía.` });
    });
    if (!anotaciones.length) anotaciones.push({ estado: 'ok', texto: 'Todas las columnas que salen del correo y de las bases tienen valor.' });
    anotaciones.push({ estado: 'ok', texto: `${datos.length} fila${datos.length !== 1 ? 's' : ''} de datos escritas.` });
    const origen = (o: OrigenColumna): string =>
      o.tipo === 'campo' ? `← ${o.campo ?? '?'}` : o.tipo === 'fijo' ? `«${o.valor ?? ''}»` : o.tipo === 'correo' ? `← correo.${o.dato ?? '?'}`
        : o.tipo === 'fila' ? 'FILA()' : o.tipo === 'base' ? `${o.columna_resultado ?? '?'} ← base por ${o.campo ?? '?'}` : o.tipo === 'formula' ? o.formula ?? '=' : '(vacía)';
    return {
      ...clonar(a), hoja: cont.hoja, celdas: clonar(cont.celdas), fila_encabezado: enc,
      origenes: t ? t.columnas.map((col) => origen(col.origen)) : encabezados.map((h) => `← ${h}`), anotaciones,
    };
  }

  actualizarBorrador(archivoId: string, por: string): ArchivoCorreo[] {
    const a = this.archivos.find((x) => x.id === archivoId);
    if (!a) throw new Error('Archivo no encontrado.');
    const ahora = new Date().toISOString();
    this.archivos = this.archivos.map((x) =>
      x.correo_id !== a.correo_id ? x : x.id === archivoId ? { ...x, borrador_en_hilo: true, borrador_en: ahora, created_by: x.created_by || por } : { ...x, borrador_en_hilo: false },
    );
    return this.archivosCorreo(a.correo_id);
  }

  reasignar(correoId: string, personaId: string, por: string): Correo {
    const i = this.correos.findIndex((x) => x.id === correoId);
    const c = this.correos[i];
    const p = this.equipo.find((x) => x.id === personaId);
    if (!c || !p) throw new Error('Persona no encontrada.');
    const traza = [...(c.asignacion_traza ?? []), { estado: 'ok' as const, titulo: `Reasignado a ${p.nombre}`, detalle: `Manual · ${por}` }];
    if (p.carpeta) traza.push({ estado: 'ok', titulo: `Movido a «${p.carpeta}»`, detalle: '' });
    this.correos[i] = { ...c, asignado_persona_id: p.id, asignado_a: p.correo, asignado_nombre: p.nombre, asignacion_traza: traza };
    this.correos = [...this.correos];
    return clonar(this.correos[i]);
  }

  recalcularAsignacion(correoId: string): Correo {
    const i = this.correos.findIndex((x) => x.id === correoId);
    if (i < 0) throw new Error('Correo no encontrado.');
    this.correos[i] = this.asignarCorreo(this.correos[i]);
    this.correos = [...this.correos];
    return clonar(this.correos[i]);
  }

  // ── Exportación (059) ──
  exportacion(buzonId: string): Exportacion {
    const b = this.buzones.find((x) => x.id === buzonId);
    if (!b) throw new Error('Buzón no encontrado.');
    return {
      borrador_en_hilo: b.borrador_en_hilo,
      procesos: this.listarProcesos(buzonId).map((p) => ({
        ...p,
        salidas: clonar(this.salidas.filter((s) => s.proceso_id === p.id).sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0))),
      })),
      plantillas: this.listarPlantillas(buzonId),
    };
  }

  guardarSalidas(procesoId: string, salidas: SalidaIn[]): Salida[] {
    const p = this.procesos.find((x) => x.id === procesoId);
    if (!p) throw new Error('Proceso no encontrado.');
    const etiquetas = this.listarProcesos(p.buzon_id).find((x) => x.id === procesoId)?.etiquetas ?? [];
    for (const s of salidas) {
      if (s.modo === 'plantilla' && !this.plantillas.some((t) => t.id === s.plantilla_id && t.buzon_id === p.buzon_id)) {
        throw new Error(`La salida «${s.nombre}» usa una plantilla: elígela.`);
      }
      if (s.etiquetas !== null && !s.etiquetas.length) throw new Error(`La salida «${s.nombre}» no aplica a ninguna etiqueta.`);
      if (s.etiquetas?.some((e) => !etiquetas.includes(e))) throw new Error(`«${s.nombre}» usa etiquetas que no son del proceso ${p.clave}.`);
    }
    this.salidas = [
      ...this.salidas.filter((s) => s.proceso_id !== procesoId),
      ...salidas.map((s, i) => ({
        ...clonar(s),
        id: nuevoId('demo-sal'),
        proceso_id: procesoId,
        plantilla_id: s.modo === 'plantilla' ? s.plantilla_id : null,
        orden: i + 1,
      })),
    ];
    return clonar(this.salidas.filter((s) => s.proceso_id === procesoId));
  }

  listarPlantillas(buzonId: string): Plantilla[] {
    return clonar(this.plantillas.filter((t) => t.buzon_id === buzonId).sort((a, b) => a.nombre.localeCompare(b.nombre)));
  }

  guardarPlantilla(buzonId: string | null, body: PlantillaIn, id?: string): Plantilla {
    const previa = id ? this.plantillas.find((t) => t.id === id) : undefined;
    if (id && !previa) throw new Error('Plantilla no encontrada.');
    const malo = body.columnas.find((c) => c.origen.tipo === 'formula' && !(c.origen.formula ?? '').startsWith('='));
    if (malo) throw new Error('La fórmula debe empezar con «=». Usa {fila} para el número de la fila.');
    const t: Plantilla = {
      ...clonar(body),
      id: previa?.id ?? nuevoId('demo-tpl'),
      buzon_id: previa?.buzon_id ?? buzonId!,
      updated_at: new Date().toISOString(),
      updated_by: 'tú (demostración)',
    };
    this.plantillas = previa ? this.plantillas.map((x) => (x.id === id ? t : x)) : [...this.plantillas, t];
    return clonar(t);
  }

  eliminarPlantilla(id: string): void {
    // Las salidas que la usaban quedan «sin archivo».
    this.salidas = this.salidas.map((s) => (s.plantilla_id === id ? { ...s, plantilla_id: null, modo: 'ninguno' } : s));
    this.plantillas = this.plantillas.filter((t) => t.id !== id);
  }

  async leerModelo(buzonId: string, archivo: File, hoja?: string | null, filaEncabezado?: number | null): Promise<ModeloLeido> {
    const XLSX = await import('xlsx');
    const csv = /\.csv$/i.test(archivo.name);
    if (!csv && !/\.(xlsx|xlsm)$/i.test(archivo.name)) throw new Error('El archivo debe ser un Excel (.xlsx) o un .csv.');
    const wb = csv ? XLSX.read(await archivo.text(), { type: 'string' }) : XLSX.read(new Uint8Array(await archivo.arrayBuffer()), { type: 'array' });
    const elegida = hoja && wb.SheetNames.includes(hoja) ? hoja : wb.SheetNames[0];
    const filas = XLSX.utils
      .sheet_to_json<unknown[]>(wb.Sheets[elegida], { header: 1, blankrows: true, defval: '', raw: false })
      .map((r) => r.map((c) => String(c ?? '').trim()));
    let idx = filaEncabezado ? filaEncabezado - 1 : 0;
    if (!filaEncabezado) {
      let mejor = 0;
      filas.slice(0, 20).forEach((f, i) => {
        const n = f.filter((c) => c && isNaN(Number(c.replace(',', '.')))).length;
        if (n > mejor) [mejor, idx] = [n, i];
      });
      if (mejor < 2) throw new Error('No encontré una fila de encabezados (al menos dos columnas con nombre).');
    }
    if (idx < 0 || idx >= filas.length) throw new Error('La fila de encabezados está fuera del archivo.');
    const ancho = filas[idx].reduce((n, c, i) => (c ? i + 1 : n), 0);
    const ejemplo = filas[idx + 1] ?? [];
    const campos = this.camposBuzon(buzonId);
    const columnas = filas[idx].slice(0, ancho).map((enc, i) => {
      const muestra = ejemplo[i] ?? '';
      const sugerido = sugerirColumna(enc, campos);
      return {
        encabezado: enc || `Columna ${i + 1}`,
        origen: sugerido ?? { tipo: 'vacio' as const },
        sugerido: !!sugerido,
        formato: (/^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/.test(muestra) ? 'fecha' : muestra && /^[\d.,$\s-]+$/.test(muestra) && muestra.length < 15 ? 'numero' : 'texto') as ColumnaPlantilla['formato'],
        ejemplo: muestra,
      };
    });
    return {
      hojas: csv ? [] : wb.SheetNames,
      hoja: csv ? null : elegida,
      fila_encabezado: idx + 1,
      titulo: filas.slice(0, idx).filter((f) => f.some(Boolean)).map((f) => f.slice(0, ancho)),
      columnas,
      formato: csv ? 'csv' : 'xlsx',
      modelo: archivo.name,
      campos,
    };
  }

  /** Datos que extraen los procesos del buzón (los de las listas como «lista.campo»). */
  private camposBuzon(buzonId: string): string[] {
    const out = this.procesos.filter((p) => p.buzon_id === buzonId).flatMap((p) => p.campos_extraer.map((c) => c.clave));
    const listas = this.correos
      .filter((c) => c.buzon_id === buzonId)
      .flatMap((c) => Object.entries(c.datos_extraidos ?? {}))
      .filter(([, v]) => Array.isArray(v) && v.length && typeof v[0] === 'object')
      .flatMap(([k, v]) => Object.keys((v as Record<string, unknown>[])[0]).map((x) => `${k}.${x}`));
    return [...new Set([...out, ...listas])];
  }

  private meta(c: Pick<Correo, 'asunto' | 'remitente' | 'recibido_en' | 'id'> | null, etiqueta: string, proceso: string): Record<string, string> {
    return {
      asunto: c?.asunto ?? 'Asunto del correo',
      remitente: c?.remitente ?? 'remitente@empresa.com',
      fecha: (c?.recibido_en ?? '').slice(0, 10),
      radicado: (c?.id ?? 'AB12CD34').replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase(),
      etiqueta,
      proceso,
      hoy: new Date().toISOString().slice(0, 10),
    };
  }

  vistaPrevia(plantillaId: string, body: { datos?: Record<string, unknown>; proceso_clave?: string }): VistaPrevia {
    const t = this.plantillas.find((x) => x.id === plantillaId);
    if (!t) throw new Error('Plantilla no encontrada.');
    let datos = body.datos ?? null;
    if (!datos && body.proceso_clave) {
      datos = [...this.correos].filter((c) => c.proceso_clave === body.proceso_clave!.toUpperCase() && c.datos_extraidos).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.datos_extraidos ?? null;
    }
    const meta = this.meta(null, body.proceso_clave ?? '', body.proceso_clave ?? '');
    meta['fecha'] = '';
    const m = matriz(t, datos ?? {}, meta, this.basesConFilas());
    return {
      nombre_archivo: nombreArchivo(t.nombre_archivo, datos ?? {}, meta, t.formato),
      titulo: m.titulo,
      encabezados: m.encabezados,
      filas: m.filas.slice(0, 30),
      total_filas: m.filas.length,
      con_datos_reales: !body.datos && !!datos,
    };
  }

  archivosCorreo(correoId: string): ArchivoCorreo[] {
    return clonar(this.archivos.filter((a) => a.correo_id === correoId).sort((a, b) => b.version - a.version));
  }

  /** Versión siguiente del archivo según la salida de la etiqueta (null si no genera archivo). */
  private generarArchivo(c: Correo, usuario: string, cuando = new Date().toISOString(), conBorrador = true): ArchivoGenerado | null {
    const cat = this.categorias.find((x) => x.id === c.categoria_id);
    const proceso = this.procesos.find((p) => p.id === cat?.proceso_id);
    if (!cat || !proceso) return null;
    const salidas = this.salidas.filter((s) => s.proceso_id === proceso.id).sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0));
    const salida = salidaPara(salidas, cat.clave);
    if (!salida || salida.modo === 'ninguno') return null;
    const t = salida.modo === 'plantilla' ? this.plantillas.find((x) => x.id === salida.plantilla_id) : undefined;
    if (salida.modo === 'plantilla' && !t) return null;
    const meta = this.meta(c, cat.clave, proceso.clave);
    const datos = c.datos_extraidos ?? {};
    const m = matriz(t ?? null, datos, meta, this.basesConFilas());
    const formato = t?.formato ?? 'xlsx';
    const version = Math.max(0, ...this.archivos.filter((a) => a.correo_id === c.id).map((a) => a.version)) + 1;
    const buzon = this.buzones.find((b) => b.id === c.buzon_id);
    const archivo: ArchivoCorreo = {
      id: nuevoId('demo-arch'),
      correo_id: c.id,
      salida_id: salida.id ?? null,
      salida_nombre: salida.nombre,
      nombre: nombreArchivo(t?.nombre_archivo ?? `${proceso.clave}_{radicado}`, datos, meta, formato),
      formato,
      version,
      filas: m.filas.length,
      tamano: 4_000 + m.filas.length * 120,
      borrador_en_hilo: conBorrador && !!buzon?.borrador_en_hilo,
      borrador_en: conBorrador && buzon?.borrador_en_hilo ? cuando : null,
      created_at: cuando,
      created_by: usuario,
    };
    // Un borrador nuevo reemplaza al anterior del mismo correo.
    if (archivo.borrador_en_hilo) this.archivos = this.archivos.map((x) => (x.correo_id === c.id ? { ...x, borrador_en_hilo: false } : x));
    this.archivos = [...this.archivos, archivo];
    this.contenidos.set(archivo.id, { hoja: t?.hoja ?? proceso.clave, formato, separador: t?.separador ?? ';', celdas: [...m.titulo, m.encabezados, ...m.filas] });
    return { id: archivo.id, nombre: archivo.nombre, version, filas: archivo.filas };
  }

  regenerarArchivo(correoId: string, usuario: string): ArchivoGenerado {
    const c = this.correos.find((x) => x.id === correoId);
    if (!c) throw new Error('Correo no encontrado.');
    const a = this.generarArchivo(c, usuario);
    if (!a) throw new Error('La etiqueta de este correo no tiene archivo de salida.');
    return a;
  }

  corregirDatos(correoId: string, datos: Record<string, unknown>, usuario: string): CorreccionDatos {
    const i = this.correos.findIndex((x) => x.id === correoId);
    if (i < 0) throw new Error('Correo no encontrado.');
    const antes = this.correos[i].datos_extraidos ?? {};
    let c: Correo = { ...this.correos[i], datos_extraidos: clonar(datos) };
    const cambios = [...new Set([...Object.keys(antes), ...Object.keys(datos)])].filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(datos[k])).sort();
    const cat = this.categorias.find((x) => x.id === c.categoria_id);
    const criticos = new Set((this.procesos.find((p) => p.id === cat?.proceso_id)?.campos_extraer ?? []).filter((f) => f.critico).map((f) => f.clave));
    // Si quedó sin responsable, con los datos corregidos se vuelve a buscar.
    if (!c.asignado_a && c.categoria_id) c = this.asignarCorreo(c);
    this.correos[i] = c;
    this.correos = [...this.correos];
    // La corrección genera una vista previa: el borrador del hilo no cambia.
    const archivo = c.estado === 'ejecutado' ? this.generarArchivo(c, usuario, undefined, false) : null;
    return { correo: c, archivo, cambios, cambios_criticos: cambios.filter((k) => criticos.has(k)) };
  }

  async descargarArchivo(id: string): Promise<Blob> {
    const a = this.archivos.find((x) => x.id === id);
    const cont = this.contenidos.get(id);
    if (!a || !cont) throw new Error('Archivo no encontrado.');
    if (cont.formato === 'csv') {
      const sep = cont.separador === '\t' ? '\t' : cont.separador;
      const texto = cont.celdas.map((f) => f.map((v) => (/[";\n,|]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(sep)).join('\r\n');
      return new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' });
    }
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cont.celdas), cont.hoja.slice(0, 31) || 'Hoja1');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ── 2.0: asignación de los correos de la demo ──
  private grupoDeEtiqueta(buzonId: string, clave: string): Grupo | undefined {
    return [...this.grupos]
      .filter((g) => g.buzon_id === buzonId && g.activo)
      .sort((a, b) => a.orden - b.orden)
      .find((g) => g.etiquetas.some((e) => e.toUpperCase() === clave.toUpperCase()));
  }

  private basesConFilas(): Record<string, Base & { filas: FilaBase[] }> {
    return Object.fromEntries(this.bases.map((b) => [b.id, { ...b, filas: this.filasPorBase.get(b.id) ?? [] }]));
  }

  private cargaHoy(): Record<string, number> {
    const carga: Record<string, number> = {};
    this.correos.forEach((c) => {
      if (c.asignado_persona_id) carga[c.asignado_persona_id] = (carga[c.asignado_persona_id] ?? 0) + 1;
    });
    return carga;
  }

  private asignarCorreo(c: Correo): Correo {
    const cat = this.categorias.find((x) => x.id === c.categoria_id);
    if (!cat || !this.grupos.some((g) => g.buzon_id === c.buzon_id)) return c; // sin grupos: asignación v1
    const proceso_clave = this.procesos.find((p) => p.id === cat.proceso_id)?.clave ?? null;
    const grupo = this.grupoDeEtiqueta(c.buzon_id, cat.clave);
    if (!grupo) {
      return {
        ...c,
        proceso_clave,
        grupo_id: null,
        grupo_nombre: null,
        asignado_persona_id: null,
        asignado_a: null,
        asignado_nombre: null,
        asignacion_traza: [{ estado: 'warn', titulo: 'Sin grupo de asignación', detalle: `La etiqueta ${cat.clave} no está en ningún grupo: se queda sin asignar` }],
      };
    }
    const buzon = this.buzones.find((b) => b.id === c.buzon_id);
    const r = simularAsignacion(grupo, this.listarEquipo(c.buzon_id), this.basesConFilas(), c.datos_extraidos ?? {}, buzon?.al_desactivar ?? 'respaldo', this.cargaHoy());
    if (r.carpeta && (r.estado === 'asignado' || r.estado === 'carpeta')) r.traza.push({ estado: 'ok', titulo: `Movido a «${r.carpeta}»`, detalle: '' });
    return {
      ...c,
      proceso_clave,
      grupo_id: grupo.id,
      grupo_nombre: grupo.nombre,
      asignado_persona_id: r.persona?.id ?? null,
      asignado_a: r.persona ? r.persona.correo : r.estado === 'carpeta' && r.carpeta ? `Carpeta «${r.carpeta}»` : r.estado === 'categorizar' ? 'Solo categorizar' : null,
      asignacion_traza: r.traza,
      asignado_nombre: r.persona?.nombre ?? null,
    };
  }

  guardarMiembros(buzonId: string, miembros: { email: string; rol: RolMiembro }[]): Buzon {
    const unicos = new Map(miembros.map((m) => [m.email.trim().toLowerCase(), m.rol]));
    const b = this.actualizarBuzon(buzonId, {});
    b.miembros = [...unicos].map(([email, rol], i) => ({
      user_id: `demo-u-${i}`,
      email,
      name: b.miembros.find((m) => m.email === email)?.name ?? null,
      rol,
    }));
    return b;
  }

  resumen(): ResumenInicio {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const hoy = this.correos.filter((c) => new Date(c.created_at) >= inicioHoy);
    const revision = this.correos.filter((c) => c.estado === 'revision');
    const desde = revision.map((c) => c.recibido_en).sort()[0] ?? null;
    const alertas: AlertaInicio[] = [];
    this.buzones
      .filter((b) => b.puede_administrar)
      .forEach((b) => {
        if (b.estado_conexion !== 'conectada') alertas.push({ tipo: 'conexion', buzon_id: b.id, texto: `${b.nombre}: sin conexión con Outlook` });
        else if (b.ultimo_error) alertas.push({ tipo: 'error', buzon_id: b.id, texto: `${b.nombre}: ${b.ultimo_error.slice(0, 120)}` });
        if (!b.categorias_count) alertas.push({ tipo: 'reglas', buzon_id: b.id, texto: `${b.nombre}: sin reglas publicadas` });
        const equipo = this.listarEquipo(b.id);
        this.grupos
          .filter((g) => g.buzon_id === b.id && g.activo && g.destino === 'personas')
          .filter((g) => !equipo.some((p) => p.disponible && p.grupos[g.id]?.activa))
          .forEach((g) => alertas.push({ tipo: 'equipo', buzon_id: b.id, texto: `Grupo ${g.nombre} sin analistas activos` }));
      });
    this.bases
      .filter((x) => x.estado === 'rechazado' || (x.motivo && x.estado === 'ok'))
      .forEach((x) => alertas.push({ tipo: 'base', base_id: x.id, texto: `${x.nombre}: ${x.motivo ?? 'última carga rechazada'}` }));
    const semana = [11, 14, 9, 16, 13, 15].map((n, i) => ({
      fecha: new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
      ejecutados: n,
    }));
    const ejecutadosHoy = hoy.filter((c) => c.estado === 'ejecutado').length;
    semana.push({ fecha: new Date().toISOString().slice(0, 10), ejecutados: ejecutadosHoy });
    return {
      buzones: this.buzones.map((b) => ({
        id: b.id,
        nombre: b.nombre,
        estado_conexion: b.estado_conexion,
        ultima_sincronizacion: b.ultima_sincronizacion,
        activo: b.activo,
        en_revision: this.correos.filter((c) => c.buzon_id === b.id && c.estado === 'revision').length,
        categorias_count: b.categorias_count,
      })),
      flujo: {
        llegaron: hoy.length,
        con_adjuntos: hoy.filter((c) => c.tiene_adjuntos).length,
        clasificados: hoy.filter((c) => c.categoria_id || c.estado === 'revision' || c.estado === 'ejecutado').length,
        validar: revision.length,
        asignados: hoy.filter((c) => c.asignado_a).length,
        ejecutados: ejecutadosHoy,
        validar_desde: desde,
        semana,
      },
      sin_asignar: this.correos.filter((c) => c.grupo_id && !c.asignado_a && this.grupos.find((g) => g.id === c.grupo_id)?.destino === 'personas').length,
      alertas,
    };
  }

  // ── 2.0: procesos ──
  listarProcesos(buzonId: string): Proceso[] {
    return this.procesos
      .filter((p) => p.buzon_id === buzonId)
      .sort((a, b) => a.orden - b.orden)
      .map((p) => ({ ...p, etiquetas: this.categorias.filter((c) => c.proceso_id === p.id).sort((a, b) => a.orden - b.orden).map((c) => c.clave) }));
  }

  guardarProceso(buzonId: string | null, body: ProcesoIn, id?: string): Proceso {
    const previo = id ? this.procesos.find((p) => p.id === id) : undefined;
    if (id && !previo) throw new Error('Proceso no encontrado.');
    const bid = previo?.buzon_id ?? buzonId!;
    const clave = body.clave.trim().toUpperCase();
    if (this.procesos.some((p) => p.buzon_id === bid && p.clave === clave && p.id !== id)) throw new Error(`Ya existe el proceso ${clave}.`);
    const nuevo: Proceso = {
      id: previo?.id ?? nuevoId('demo-proc'),
      buzon_id: bid,
      clave,
      nombre: body.nombre,
      descripcion: body.descripcion ?? null,
      exclusiones: body.exclusiones ?? null,
      campos_extraer: body.campos_extraer.map((c) => ({ ...c })),
      color: body.color ?? null,
      orden: body.orden ?? previo?.orden ?? this.procesos.filter((p) => p.buzon_id === bid).length + 1,
      activo: body.activo,
      etiquetas: [],
    };
    this.procesos = previo ? this.procesos.map((p) => (p.id === id ? nuevo : p)) : [...this.procesos, nuevo];
    return this.listarProcesos(bid).find((p) => p.id === nuevo.id)!;
  }

  eliminarProceso(id: string): void {
    this.categorias = this.categorias.map((c) => (c.proceso_id === id ? { ...c, proceso_id: null } : c));
    this.procesos = this.procesos.filter((p) => p.id !== id);
  }

  /** Lectura del prompt SOLO para la demo: busca líneas «- CLAVE: señales». */
  async analizarPrompt(prompt: string): Promise<PropuestaProcesos> {
    await espera(1800);
    const paleta = ['#1976D2', '#7B1FA2', '#00796B', '#D32F2F', '#F57C00', '#0097A7'];
    const procesos: PropuestaProcesos['procesos'] = [];
    for (const linea of prompt.split(/\r?\n/)) {
      const m = /^\s*[-•*]\s*([A-Z0-9_]{2,40})\s*[:–-]\s*(.+)$/.exec(linea);
      if (!m || procesos.some((p) => p.clave === m[1])) continue;
      const [clave, resto] = [m[1], m[2]];
      const et = /Etiquetas?:\s*([A-Z0-9_,\s-]+)/i.exec(resto);
      const etiquetas = (et ? et[1].split(/[,\s]+/).filter((x) => x.length >= 2) : [clave]).map((e) => ({
        clave: e.toUpperCase(),
        nombre: e.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (x) => x.toUpperCase()),
        descripcion: `Se asigna cuando el correo es de ${clave} (${e}).`,
      }));
      const exclusion = /No es [^.]*\./i.exec(resto)?.[0] ?? '';
      procesos.push({
        clave,
        nombre: clave,
        descripcion: resto.replace(/Etiquetas?:[^.]*\.?/i, '').replace(exclusion, '').trim(),
        exclusiones: exclusion,
        campos: (this.procesos.find((p) => p.clave === clave)?.campos_extraer ?? [{ clave: 'numero_caso', descripcion: 'Identificador del caso', critico: true }]).map((c) => ({ ...c })),
        etiquetas,
        color: paleta[procesos.length % paleta.length],
      });
    }
    if (!procesos.length) throw new Error('No encontré procesos en el prompt. Escribe cada proceso en una línea «- CLAVE: cómo se reconoce».');
    const instrucciones = /dud[ae][^.]*\./i.exec(prompt)?.[0] ?? '';
    return { procesos, instrucciones };
  }

  aplicarPropuesta(buzonId: string, propuesta: PropuestaProcesos, promptArea?: string): ResultadoAplicar {
    const r: ResultadoAplicar = { procesos_creados: 0, procesos_actualizados: 0, etiquetas_creadas: 0, etiquetas_actualizadas: 0 };
    for (const pr of propuesta.procesos) {
      const previo = this.procesos.find((p) => p.buzon_id === buzonId && p.clave === pr.clave);
      const p = this.guardarProceso(buzonId, { clave: pr.clave, nombre: pr.nombre, descripcion: pr.descripcion, exclusiones: pr.exclusiones, campos_extraer: pr.campos, color: previo?.color ?? pr.color ?? null, activo: true }, previo?.id);
      r[previo ? 'procesos_actualizados' : 'procesos_creados']++;
      for (const e of pr.etiquetas) {
        const c = this.categorias.find((x) => x.buzon_id === buzonId && x.clave === e.clave);
        if (c) {
          this.actualizarCategoria(c.id, { ...c, nombre: e.nombre, descripcion: e.descripcion || c.descripcion, proceso_id: p.id });
          r.etiquetas_actualizadas++;
        } else {
          const nueva = this.crearCategoria(buzonId, {
            clave: e.clave, nombre: e.nombre, descripcion: e.descripcion || `Etiqueta del proceso ${pr.nombre}.`, ejemplos: [], palabras_clave: null,
            color: pr.color ?? null, activa: true, es_fallback: false, umbral_confianza: null, campos_extraer: [],
            acciones: [{ tipo: 'categorizar', parametros: {}, orden: 1, activa: true }],
          });
          nueva.proceso_id = p.id;
          r.etiquetas_creadas++;
        }
      }
    }
    if (promptArea !== undefined) this.actualizarBuzon(buzonId, { prompt_area: promptArea });
    return r;
  }

  // ── 2.0: grupos ──
  listarGrupos(buzonId: string): Grupo[] {
    return clonar(this.grupos.filter((g) => g.buzon_id === buzonId).sort((a, b) => a.orden - b.orden));
  }

  guardarGrupo(buzonId: string | null, body: GrupoIn, id?: string): Grupo {
    const previo = id ? this.grupos.find((g) => g.id === id) : undefined;
    if (id && !previo) throw new Error('Grupo no encontrado.');
    if (body.destino === 'carpeta' && !body.carpeta?.trim()) throw new Error('Elige la carpeta a la que se envían los correos del grupo.');
    if (body.sin_activos_modo === 'carpeta' && !body.sin_activos_carpeta?.trim()) throw new Error('Elige la carpeta para cuando no haya nadie activo en el grupo.');
    if (body.sin_activos_modo === 'persona' && !body.sin_activos_persona_id) throw new Error('Elige la persona para cuando no haya nadie activo en el grupo.');
    const gid = previo?.id ?? nuevoId('demo-g');
    const bid = previo?.buzon_id ?? buzonId!;
    const nuevo: Grupo = {
      id: gid,
      buzon_id: bid,
      nombre: body.nombre,
      etiquetas: [...new Set(body.etiquetas.map((e) => e.toUpperCase()))],
      destino: body.destino,
      carpeta: body.carpeta ?? null,
      sin_activos_modo: body.sin_activos_modo,
      sin_activos_carpeta: body.sin_activos_carpeta ?? null,
      sin_activos_persona_id: body.sin_activos_persona_id ?? null,
      orden: body.orden ?? previo?.orden ?? this.grupos.filter((g) => g.buzon_id === bid).length + 1,
      activo: body.activo,
      reglas: body.reglas.map((r, i) => ({
        ...clonar(r),
        id: `${gid}-r${i + 1}`,
        grupo_id: gid,
        base_nombre: this.bases.find((b) => b.id === r.base_id)?.nombre ?? null,
        orden: i + 1,
      })),
    };
    this.grupos = previo ? this.grupos.map((g) => (g.id === id ? nuevo : g)) : [...this.grupos, nuevo];
    return clonar(nuevo);
  }

  eliminarGrupo(id: string): void {
    this.grupos = this.grupos.filter((g) => g.id !== id);
    this.equipo.forEach((p) => delete p.grupos[id]);
  }

  // ── 2.0: equipo ──
  listarEquipo(buzonId: string): Persona[] {
    return this.equipo
      .filter((p) => p.buzon_id === buzonId)
      .sort((a, b) => a.orden - b.orden)
      .map(({ buzon_id: _b, ...p }) => ({
        ...clonar(p),
        carga_hoy: this.correos.filter((c) => c.asignado_persona_id === p.id).length,
        abiertos: this.correos.filter((c) => c.asignado_persona_id === p.id && c.estado === 'revision').length,
      }));
  }

  guardarEquipo(buzonId: string, personas: PersonaIn[]): Persona[] {
    const correos = personas.map((p) => p.correo.trim().toLowerCase());
    if (new Set(correos).size !== correos.length) throw new Error('Hay correos repetidos en el equipo.');
    const previos = this.equipo.filter((p) => p.buzon_id === buzonId);
    const nuevos = personas.map((p, i) => ({
      id: previos.find((x) => x.correo === p.correo.toLowerCase())?.id ?? nuevoId('demo-p'),
      buzon_id: buzonId,
      nombre: p.nombre,
      correo: p.correo.toLowerCase(),
      carpeta: p.carpeta || null,
      disponible: p.disponible,
      orden: i + 1,
      carga_hoy: 0,
      abiertos: 0,
      grupos: {} as Persona['grupos'],
    }));
    personas.forEach((p, i) => {
      Object.entries(p.grupos).forEach(([gid, m]) => {
        const respaldo = nuevos.find((x) => x.correo === (m.respaldo ?? '').toLowerCase());
        nuevos[i].grupos[gid] = { activa: m.activa, respaldo_id: respaldo && respaldo.id !== nuevos[i].id ? respaldo.id : null };
      });
    });
    this.equipo = [...this.equipo.filter((p) => p.buzon_id !== buzonId), ...nuevos];
    return this.listarEquipo(buzonId);
  }

  cambiarDisponibilidad(personaId: string, body: DisponibilidadIn): Persona[] {
    const p = this.equipo.find((x) => x.id === personaId);
    if (!p) throw new Error('Persona no encontrada.');
    if (body.disponible !== undefined) p.disponible = body.disponible;
    if (body.grupo_id && body.activa !== undefined) {
      p.grupos[body.grupo_id] = { activa: body.activa, respaldo_id: p.grupos[body.grupo_id]?.respaldo_id ?? null };
    }
    return this.listarEquipo(p.buzon_id);
  }

  // ── 2.0: bases ──
  private conUsos(b: Base): Base {
    return { ...clonar(b), usos: this.grupos.reduce((n, g) => n + g.reglas.filter((r) => r.base_id === b.id).length, 0) };
  }

  listarBases(buzonId?: string): Base[] {
    return this.bases.filter((b) => !buzonId || b.buzones.includes(buzonId)).map((b) => this.conUsos(b));
  }

  private base(id: string): Base {
    const b = this.bases.find((x) => x.id === id);
    if (!b) throw new Error('Base no encontrada.');
    return b;
  }

  crearBase(body: BaseIn): Base {
    if (body.origen === 'sharepoint' && !body.sharepoint_url) throw new Error('Pega el enlace de SharePoint del archivo de la base.');
    const b: Base = {
      id: nuevoId('demo-base'), nombre: body.nombre, origen: body.origen, archivo: null, hoja: null, fila_encabezado: null, columnas: [],
      total_filas: 0, estado: 'sin_cargar', motivo: null, sharepoint_url: body.sharepoint_url ?? null, vinculos: {}, cargada_en: null,
      cargada_por: null, buzones: [...body.buzones], usos: 0,
    };
    this.bases = [...this.bases, b];
    return this.conUsos(b);
  }

  actualizarBase(id: string, body: BaseUpdate): Base {
    const b = this.base(id);
    Object.assign(b, body);
    return this.conUsos(b);
  }

  eliminarBase(id: string): void {
    if (this.conUsos(this.base(id)).usos) throw new Error('La base está en uso por reglas de asignación: quítala de ellas primero.');
    this.bases = this.bases.filter((b) => b.id !== id);
  }

  cargarBase(id: string, leida: LecturaArchivo, archivo: string): ResultadoCarga {
    const b = this.base(id);
    const requeridas = new Set<string>();
    this.grupos.forEach((g) =>
      g.reglas.filter((r) => r.base_id === id).forEach((r) => {
        requeridas.add(r.col_responsable);
        if (r.col_respaldo) requeridas.add(r.col_respaldo);
        r.cruces.forEach((c) => requeridas.add(c.columna));
      }),
    );
    const faltan = [...requeridas].filter((c) => c && !leida.columnas.includes(c)).sort();
    const motivo = faltan.length
      ? `${faltan.length === 1 ? 'Falta la columna ' : 'Faltan las columnas '}${faltan.join(', ')} (la usan las reglas de asignación).`
      : !leida.total_filas
        ? 'El archivo no trae filas debajo de los encabezados.'
        : null;
    if (motivo) {
      b.motivo = motivo;
      if (!b.total_filas) b.estado = 'rechazado';
      return { ...leida, aceptada: false, motivo, base: this.conUsos(b) };
    }
    Object.assign(b, {
      archivo, hoja: leida.hoja, fila_encabezado: leida.fila_encabezado, columnas: leida.columnas, total_filas: leida.total_filas,
      estado: 'ok', motivo: null, cargada_en: new Date().toISOString(), cargada_por: 'tú (demostración)',
    });
    this.filasPorBase.set(id, leida.filas ?? leida.muestra);
    return { ...leida, aceptada: true, motivo: null, base: this.conUsos(b) };
  }

  async sincronizarBase(id: string): Promise<ResultadoCarga> {
    await espera(900);
    const b = this.base(id);
    if (b.origen !== 'sharepoint') throw new Error('Esta base se carga subiendo el archivo, no desde SharePoint.');
    const filas = this.filasPorBase.get(id) ?? [];
    Object.assign(b, { estado: 'ok', motivo: null, cargada_en: new Date().toISOString(), cargada_por: 'sistema' });
    return {
      hojas: [b.hoja ?? 'Hoja1'], hoja: b.hoja, fila_encabezado: b.fila_encabezado ?? 1, columnas: b.columnas, total_filas: filas.length,
      muestra: filas.slice(0, 20), titulo: null, aceptada: true, motivo: null, base: this.conUsos(b),
    };
  }

  filasBase(id: string, q?: string, limit = 50): { columnas: string[]; items: FilaBase[] } {
    const b = this.base(id);
    let filas = this.filasPorBase.get(id) ?? [];
    if (q) filas = filas.filter((f) => Object.values(f).some((v) => v.toLowerCase().includes(q.toLowerCase())));
    return { columnas: b.columnas, items: clonar(filas.slice(0, limit)) };
  }

  vincular(baseId: string, valor: string, correo: string | null): Base {
    const b = this.base(baseId);
    const vinculos = { ...b.vinculos };
    if (correo) vinculos[nrm(valor)] = correo.trim().toLowerCase();
    else delete vinculos[nrm(valor)];
    b.vinculos = vinculos;
    return this.conUsos(b);
  }

  probarAsignacion(buzonId: string, etiqueta: string, datos: Record<string, unknown>): ResultadoAsignacion {
    const grupo = this.grupoDeEtiqueta(buzonId, etiqueta);
    if (!grupo) {
      return {
        grupo: null, estado: 'sin_asignar', persona: null, carpeta: null, via: '',
        traza: [{ estado: 'warn', titulo: 'Sin grupo de asignación', detalle: `La etiqueta ${etiqueta.toUpperCase()} no está en ningún grupo` }],
      };
    }
    const buzon = this.buzones.find((b) => b.id === buzonId);
    const r = simularAsignacion(grupo, this.listarEquipo(buzonId), this.basesConFilas(), datos, buzon?.al_desactivar ?? 'respaldo', this.cargaHoy());
    return {
      ...r,
      grupo: { id: grupo.id, nombre: grupo.nombre },
      persona: r.persona ? { id: r.persona.id, nombre: r.persona.nombre, correo: r.persona.correo } : null,
    };
  }

  crearBuzon(b: BuzonIn): Buzon {
    const nuevo: Buzon = {
      id: nuevoId('demo-buzon'),
      nombre: b.nombre,
      area: b.area ?? null,
      direccion: b.direccion.toLowerCase(),
      correo_buzon_id: nuevoId('demo-correo-buzon'),
      estado_conexion: 'sin_conectar',
      carpeta_vigilada: b.carpeta_vigilada || 'Inbox',
      modo: b.modo ?? 'sugerir',
      umbral_confianza: b.umbral_confianza ?? 0.8,
      max_correos_por_tick: 25,
      contexto: b.contexto ?? null,
      activo: true,
      ultima_sincronizacion: null,
      ultimo_error: null,
      categorias_count: 1,
      pendientes: 0,
      en_revision: 0,
      ejecutados_hoy: 0,
      miembros: [],
      rol: 'admin',
      puede_administrar: true,
      puede_conectar: true,
      conexion_compartida: false,
      conectada_por: null,
      modo_clasificacion: 'prompt',
      agente_nombre: null,
      prompt_area: null,
      al_desactivar: 'respaldo',
      borrador_en_hilo: true,
    };
    this.buzones = [...this.buzones, nuevo];
    this.categorias.push(cat(nuevo.id, 'OTROS', 'Otros', 'Sin categoría clara. Revisión humana.', '#A2845E', [], { es_fallback: true, orden: 1 }));
    return nuevo;
  }

  actualizarBuzon(id: string, u: BuzonUpdate): Buzon {
    const i = this.buzones.findIndex((b) => b.id === id);
    if (i < 0) throw new Error('Buzón no encontrado.');
    this.buzones[i] = { ...this.buzones[i], ...u } as Buzon;
    this.buzones = [...this.buzones];
    return this.buzones[i];
  }

  desconectarBuzon(id: string): Buzon {
    const b = this.actualizarBuzon(id, { activo: false });
    b.estado_conexion = 'sin_conectar';
    return b;
  }

  eliminarBuzon(id: string): void {
    this.buzones = this.buzones.filter((b) => b.id !== id);
    this.categorias = this.categorias.filter((c) => c.buzon_id !== id);
  }

  sincronizar(id: string): ResumenSync {
    this.actualizarBuzon(id, {});
    const b = this.buzones.find((x) => x.id === id)!;
    b.ultima_sincronizacion = new Date().toISOString();
    return { ingresados: 0, procesados: 0, ejecutados: 0, en_revision: 0, errores: 0, duracion_ms: 380 };
  }

  crearCategoria(buzonId: string, c: CategoriaIn): Categoria {
    const nueva: Categoria = {
      ...c,
      id: nuevoId('demo-cat'),
      buzon_id: buzonId,
      orden: this.categorias.filter((x) => x.buzon_id === buzonId).length + 1,
      correos_30d: 0,
      proceso_id: c.proceso_id ?? null,
    };
    this.categorias = [...this.categorias, nueva];
    const b = this.buzones.find((x) => x.id === buzonId);
    if (b) b.categorias_count++;
    return nueva;
  }

  actualizarCategoria(id: string, c: CategoriaIn): Categoria {
    const i = this.categorias.findIndex((x) => x.id === id);
    if (i < 0) throw new Error('Categoría no encontrada.');
    this.categorias[i] = {
      ...this.categorias[i],
      ...c,
      id,
      buzon_id: this.categorias[i].buzon_id,
      proceso_id: c.proceso_id ?? null,
    };
    this.categorias = [...this.categorias];
    return this.categorias[i];
  }

  eliminarCategoria(id: string): void {
    this.categorias = this.categorias.filter((x) => x.id !== id);
  }

  crearRegla(buzonId: string, r: ReglaIn): ReglaFija {
    const cat = this.categorias.find((c) => c.id === r.categoria_id);
    const nueva: ReglaFija = { ...r, id: nuevoId('demo-regla'), buzon_id: buzonId, categoria_clave: cat?.clave ?? null };
    this.reglas = [...this.reglas, nueva];
    return nueva;
  }

  actualizarRegla(id: string, r: ReglaIn): ReglaFija {
    const i = this.reglas.findIndex((x) => x.id === id);
    if (i < 0) throw new Error('Regla no encontrada.');
    const cat = this.categorias.find((c) => c.id === r.categoria_id);
    this.reglas[i] = { ...this.reglas[i], ...r, categoria_clave: cat?.clave ?? null };
    this.reglas = [...this.reglas];
    return this.reglas[i];
  }

  eliminarRegla(id: string): void {
    this.reglas = this.reglas.filter((x) => x.id !== id);
  }

  listarCorreos(f: FiltroCorreos): { data: Correo[]; total: number } {
    let lista = [...this.correos];
    if (f.buzon_id) lista = lista.filter((c) => c.buzon_id === f.buzon_id);
    if (f.estado) lista = lista.filter((c) => c.estado === f.estado);
    if (f.categoria_id) lista = lista.filter((c) => c.categoria_id === f.categoria_id);
    if (f.grupo_id) lista = lista.filter((c) => c.grupo_id === f.grupo_id);
    if (f.duplicado) lista = lista.filter((c) => c.duplicado_estado === 'posible');
    if (f.sin_asignar) {
      lista = lista.filter(
        (c) => c.grupo_id && !c.asignado_a && (c.estado === 'revision' || c.estado === 'ejecutado') && this.grupos.find((g) => g.id === c.grupo_id)?.destino === 'personas',
      );
    }
    if (f.q) {
      const q = f.q.toLowerCase();
      lista = lista.filter((c) => `${c.asunto} ${c.remitente} ${c.remitente_nombre ?? ''} ${c.resumen ?? ''}`.toLowerCase().includes(q));
    }
    lista.sort((a, b) => b.recibido_en.localeCompare(a.recibido_en));
    const off = f.offset ?? 0;
    const lim = f.limit ?? 50;
    return { data: lista.slice(off, off + lim), total: lista.length };
  }

  private categoriaDe(id: string | null): Categoria | undefined {
    return this.categorias.find((c) => c.id === id);
  }

  private registrarEjecuciones(correo: Correo, por: string): void {
    const cat = this.categoriaDe(correo.categoria_id);
    const lista: Ejecucion[] = (cat?.acciones ?? []).filter((a) => a.activa).map((a, i) => ({
      id: Date.now() + i,
      tipo: a.tipo,
      parametros: a.parametros,
      resultado: a.tipo === 'notificar_teams' ? 'simulado' : 'ok',
      detalle: a.tipo === 'asignar_analista' ? `Asignado a ${correo.asignado_a ?? 'Laura Gómez'}` : null,
      ejecutado_por: por,
      ejecutado_en: new Date().toISOString(),
    }));
    this.ejecuciones.set(correo.id, [...(this.ejecuciones.get(correo.id) ?? []), ...lista]);
  }

  decidir(id: string, categoriaId: string, ejecutar: boolean, por: string): Correo {
    const i = this.correos.findIndex((c) => c.id === id);
    if (i < 0) throw new Error('Correo no encontrado.');
    const cat = this.categoriaDe(categoriaId);
    let c = { ...this.correos[i] };
    const cambio = c.categoria_id !== categoriaId;
    c.categoria_id = categoriaId;
    c.categoria_clave = cat?.clave ?? null;
    c.categoria_nombre = cat?.nombre ?? null;
    c.categoria_color = cat?.color ?? null;
    c.origen = 'humano';
    c.decidido_por = por;
    c.decidido_en = new Date().toISOString();
    c.error = null;
    // Otra etiqueta puede ser otro grupo: se reasigna antes de ejecutar.
    if (cambio || !c.grupo_id) c = this.asignarCorreo(c);
    if (ejecutar) {
      if (!c.grupo_id && cat?.acciones.some((a) => a.tipo === 'asignar_analista')) c.asignado_a = c.asignado_a ?? 'Laura Gómez';
      c.estado = 'ejecutado';
      this.registrarEjecuciones(c, por);
    } else {
      c.estado = 'revision';
    }
    this.correos[i] = c;
    this.correos = [...this.correos];
    // Al aprobar, el archivo sale con la salida de la etiqueta final.
    if (ejecutar) this.generarArchivo(c, por);
    return c;
  }

  ignorar(id: string, por: string): Correo {
    const i = this.correos.findIndex((c) => c.id === id);
    if (i < 0) throw new Error('Correo no encontrado.');
    this.correos[i] = { ...this.correos[i], estado: 'ignorado', origen: 'humano', decidido_por: por, decidido_en: new Date().toISOString() };
    this.correos = [...this.correos];
    return this.correos[i];
  }

  reclasificar(id: string): Correo {
    const i = this.correos.findIndex((c) => c.id === id);
    if (i < 0) throw new Error('Correo no encontrado.');
    const c = { ...this.correos[i], estado: 'revision' as const, origen: 'ia' as const, error: null, decidido_por: null, decidido_en: null };
    this.correos[i] = c;
    this.correos = [...this.correos];
    return c;
  }

  /** .eml sintético del correo (para el visor). */
  mime(id: string): ArrayBuffer {
    const c = this.correos.find((x) => x.id === id);
    const asunto = c?.asunto ?? 'Correo de demostración';
    const de = c ? `${c.remitente_nombre ?? c.remitente} <${c.remitente}>` : 'demo@skandia.com.co';
    const para = c?.buzon_id === B_JURIDICA ? 'juridica@skandia.com.co' : 'backpagos@skandia.com.co';
    const datos = c?.datos_extraidos ?? {};
    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222">
<p>Buen día equipo,</p>
<p>${c?.resumen ?? 'Adjunto los soportes solicitados.'}</p>
${datos['afiliado_nombre'] ? `<p><b>Afiliado:</b> ${datos['afiliado_nombre']}<br/><b>Cédula:</b> ${datos['afiliado_cedula'] ?? ''}<br/><b>Contrato:</b> ${datos['afiliado_contrato'] ?? ''}<br/><b>Banco:</b> ${datos['banco'] ?? ''}<br/><b>Valor:</b> $${Number(datos['monto'] ?? 0).toLocaleString('es-CO')}</p>` : ''}
<p>Quedo atento a su confirmación.</p>
<p>Cordialmente,<br/>${c?.remitente_nombre ?? ''}</p>
<hr/><p style="font-size:11px;color:#777">Aviso legal de responsabilidad: este mensaje y sus anexos son confidenciales…</p>
</div>`;
    const adjuntos = (c?.adjuntos ?? []).map(
      (a) => `--alma-demo\r\nContent-Type: text/plain; name="${a.nombre}"\r\nContent-Disposition: attachment; filename="${a.nombre}"\r\n\r\n[Contenido de demostración de ${a.nombre} — ${Math.round(a.tamano / 1024)} KB]\r\n`,
    );
    const eml =
      `From: ${de}\r\nTo: ${para}\r\nSubject: ${asunto}\r\nDate: ${new Date(c?.recibido_en ?? Date.now()).toUTCString()}\r\n` +
      `Message-ID: <${id}@demo.alma>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="alma-demo"\r\n\r\n` +
      `--alma-demo\r\nContent-Type: text/html; charset="utf-8"\r\n\r\n${html}\r\n` +
      adjuntos.join('') +
      `--alma-demo--\r\n`;
    return new TextEncoder().encode(eml).buffer as ArrayBuffer;
  }
}

export const DEMO = { clonar: () => new DemoStore() };

export function demoCorreoDetalle(store: DemoStore, id: string): CorreoDetalle {
  const c = store.correos.find((x) => x.id === id);
  if (!c) throw new Error('Correo no encontrado.');
  const cat = store.categorias.find((x) => x.id === c.categoria_id);
  let ejecuciones = store.ejecuciones.get(id) ?? [];
  if (!ejecuciones.length && c.estado === 'ejecutado') {
    ejecuciones = (cat?.acciones ?? []).map((a, i) => ({
      id: i + 1,
      tipo: a.tipo,
      parametros: a.parametros,
      resultado: a.tipo === 'notificar_teams' ? 'simulado' : 'ok',
      detalle: a.tipo === 'asignar_analista' ? `Asignado a ${c.asignado_a}` : a.tipo === 'mover' ? `Movido a “${a.parametros['carpeta']}”` : null,
      ejecutado_por: c.decidido_por ?? 'sistema',
      ejecutado_en: c.decidido_en ?? c.recibido_en,
    }));
  }
  if (c.estado === 'error') {
    ejecuciones = [
      { id: 1, tipo: 'categorizar', parametros: { categoria: c.categoria_clave }, resultado: 'ok', detalle: null, ejecutado_por: 'sistema', ejecutado_en: c.recibido_en },
      { id: 2, tipo: 'mover', parametros: { carpeta: '4X1000 Bancolombia' }, resultado: 'error', detalle: c.error, ejecutado_por: 'sistema', ejecutado_en: c.recibido_en },
    ];
  }
  return {
    ...c,
    ejecuciones,
    acciones_previstas: (cat?.acciones ?? []).filter((a) => a.activa).map((a) => ({ tipo: a.tipo, parametros: a.parametros })),
  };
}

export function demoProbar(
  store: DemoStore,
  buzonId: string,
  body: { asunto: string; remitente: string; cuerpo: string; texto_adjuntos?: string },
): ResultadoPrueba {
  const texto = `${body.asunto} ${body.cuerpo} ${body.texto_adjuntos ?? ''}`.toLowerCase();
  const cats = store.categorias.filter((c) => c.buzon_id === buzonId && c.activa);
  const buzon = store.buzones.find((b) => b.id === buzonId);
  // Heurística SOLO para la demo (el backend real usa el modelo de IA): las
  // palabras del nombre/clave pesan más que las de la descripción, sin repetir.
  const tokens = (t: string) => new Set(t.toLowerCase().split(/[^a-záéíóúñ0-9]+/).filter((w) => w.length > 4));
  const puntuar = (c: Categoria) => {
    let n = 0;
    tokens(`${c.nombre} ${c.clave.replace(/_/g, ' ')}`).forEach((w) => (n += texto.includes(w) ? 3 : 0));
    tokens(`${c.palabras_clave ?? ''} ${c.descripcion}`).forEach((w) => (n += texto.includes(w) ? 1 : 0));
    return n;
  };
  const ordenadas = cats.filter((c) => !c.es_fallback).map((c) => ({ c, p: puntuar(c) })).sort((a, b) => b.p - a.p);
  const mejor = ordenadas[0]?.p ? ordenadas[0].c : cats.find((c) => c.es_fallback) ?? cats[0];
  const confianza = mejor?.es_fallback ? 0.55 : Math.min(0.98, 0.7 + (ordenadas[0]?.p ?? 0) * 0.06);
  const umbral = mejor?.umbral_confianza ?? buzon?.umbral_confianza ?? 0.8;
  return {
    categoria_clave: mejor?.clave ?? null,
    categoria_nombre: mejor?.nombre ?? null,
    confianza,
    resumen: `${body.remitente || 'El remitente'} escribe sobre “${body.asunto || 'sin asunto'}”. ${body.cuerpo.slice(0, 140)}${body.cuerpo.length > 140 ? '…' : ''}`,
    justificacion: mejor?.es_fallback
      ? 'No se reconocen términos ni documentos de las categorías configuradas.'
      : `Coincide con la descripción de “${mejor?.nombre}” (términos: ${mejor?.palabras_clave ?? mejor?.nombre}).`,
    datos_extraidos: Object.fromEntries((mejor?.campos_extraer ?? []).slice(0, 4).map((k) => [k.clave, ''])),
    acciones_previstas: (mejor?.acciones ?? []).filter((a) => a.activa).map((a) => ({ tipo: a.tipo, parametros: a.parametros })),
    cumple_umbral: confianza >= umbral,
  };
}

export function demoMetricas(store: DemoStore, buzonId?: string): Metricas {
  const correos = store.correos.filter((c) => !buzonId || c.buzon_id === buzonId);
  const cats = store.categorias.filter((c) => !buzonId || c.buzon_id === buzonId);
  const por_estado: Record<string, number> = {};
  correos.forEach((c) => (por_estado[c.estado] = (por_estado[c.estado] ?? 0) + 1));
  const factor = buzonId === B_JURIDICA ? 0.12 : 1;
  const total30 = Math.round(cats.reduce((n, c) => n + c.correos_30d, 0));
  const serie = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000);
    const base = [22, 31, 27, 35, 40, 12, 6, 29, 33, 38, 41, 36, 44, 27][i];
    const total = Math.max(1, Math.round(base * factor));
    const ejecutados = Math.round(total * 0.78);
    return { fecha: d.toISOString().slice(0, 10), total, ejecutados, revision: total - ejecutados };
  });
  const humanas = Math.round(61 * factor) || 3;
  const coincid = Math.round(humanas * 0.9);
  return {
    total: total30,
    por_estado: {
      ejecutado: Math.round(total30 * 0.74),
      revision: Math.round(total30 * 0.19),
      ignorado: Math.round(total30 * 0.05),
      error: Math.round(total30 * 0.02),
      ...(correos.length ? {} : {}),
    },
    por_categoria: cats.map((c) => ({ clave: c.clave, nombre: c.nombre, color: c.color, total: c.correos_30d })).sort((a, b) => b.total - a.total),
    precision: { decisiones_humanas: humanas, coincidencias: coincid, porcentaje: Math.round((coincid / humanas) * 1000) / 10 },
    automatizados: Math.round(total30 * 0.74),
    tiempo_medio_decision_min: buzonId === B_JURIDICA ? 95 : 1.4,
    serie,
    ultimas_ejecuciones: correos
      .filter((c) => c.estado === 'ejecutado')
      .slice(0, 8)
      .flatMap((c) =>
        demoCorreoDetalle(store, c.id).ejecuciones.slice(0, 2).map((e) => ({ ...e, asunto: c.asunto, buzon_nombre: c.buzon_nombre })),
      ),
  };
}
