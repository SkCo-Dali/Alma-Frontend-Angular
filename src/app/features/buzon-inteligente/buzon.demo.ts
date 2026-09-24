// Datos de DEMOSTRACIÓN del Buzón Inteligente (área de Recaudos, portado del flujo
// de Daniel Pedraza). Se usan solo cuando el backend no tiene el módulo disponible;
// ver BuzonApi.conDemo. Todo vive en memoria durante la sesión.

import {
  Buzon,
  BuzonIn,
  BuzonUpdate,
  CarpetaGraph,
  Categoria,
  CategoriaIn,
  Correo,
  CorreoDetalle,
  Ejecucion,
  FiltroCorreos,
  Metricas,
  ReglaFija,
  ReglaIn,
  ResultadoPrueba,
  ResumenSync,
} from './buzon.api';

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
    ...extra,
  };
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
  lista.forEach((c, i) => (c.orden = i + 1));
  return lista;
}

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
        { user_id: 'u1', email: 'dapedraza@skandia.com.co', name: 'Daniel Pedraza', rol: 'propietario' },
        { user_id: 'u2', email: 'lgomez@skandia.com.co', name: 'Laura Gómez', rol: 'analista' },
      ],
      puede_administrar: true,
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
      puede_administrar: true,
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
      datos: { afiliado_contrato: 'PC0001234', afiliado_nombre: 'Constructora Sol SAS' },
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
    };
  });
}

function carpetasBase(): CarpetaGraph[] {
  const h = (nombre: string, total: number, hijas: CarpetaGraph[] = []): CarpetaGraph => ({
    id: `f-${nombre}`, nombre, total, no_leidos: Math.floor(total / 5), hijas,
  });
  return [
    h('Bandeja de entrada', 214, []),
    h('4X1000 Acreditar', 58), h('4X1000 Davivienda', 41), h('4X1000 Bancolombia', 37), h('4X1000 Otros Bancos', 9),
    h('Laura Gómez', 33), h('Andrés Pérez', 29), h('Carolina Ruiz', 31),
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
      puede_administrar: true,
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
    };
    this.categorias = [...this.categorias, nueva];
    const b = this.buzones.find((x) => x.id === buzonId);
    if (b) b.categorias_count++;
    return nueva;
  }

  actualizarCategoria(id: string, c: CategoriaIn): Categoria {
    const i = this.categorias.findIndex((x) => x.id === id);
    if (i < 0) throw new Error('Categoría no encontrada.');
    this.categorias[i] = { ...this.categorias[i], ...c, id, buzon_id: this.categorias[i].buzon_id };
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
    const c = { ...this.correos[i] };
    c.categoria_id = categoriaId;
    c.categoria_clave = cat?.clave ?? null;
    c.categoria_nombre = cat?.nombre ?? null;
    c.categoria_color = cat?.color ?? null;
    c.origen = 'humano';
    c.decidido_por = por;
    c.decidido_en = new Date().toISOString();
    c.error = null;
    if (ejecutar) {
      if (cat?.acciones.some((a) => a.tipo === 'asignar_analista')) c.asignado_a = c.asignado_a ?? 'Laura Gómez';
      c.estado = 'ejecutado';
      this.registrarEjecuciones(c, por);
    } else {
      c.estado = 'revision';
    }
    this.correos[i] = c;
    this.correos = [...this.correos];
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
