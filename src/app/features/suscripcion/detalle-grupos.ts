// Construcción de los grupos "inset" del detalle de una cotización.
// Filas label→valor, ya filtradas: cada fila con valor null se oculta y un grupo sin filas visibles
// no se dibuja.

import { AfiliacionDetalleApi } from './suscripcion.api';
import { Tarea, fmtCOP } from './suscripcion.domain';

export interface Fila {
  k: string;
  v: string | null;
  strong?: boolean;
  danger?: boolean;
  /** Texto largo: label arriba y valor en bloque (observaciones, causales). */
  full?: boolean;
  /** Valor copiable (documentos, contratos). */
  copy?: string;
  /** Alineación numérica (cifras y fechas). */
  num?: boolean;
}

export interface GrupoDef {
  title: string;
  icon: string;
  filas: Fila[];
}

/** Formatea una fecha ISO ('YYYY-MM-DD…') a dd/mm/aaaa local; null si vacía. */
function fmtDia(iso: unknown): string | null {
  const s = String(iso ?? '').trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('es-CO');
}

/** Normaliza a texto: recorta y convierte vacío en null. */
function txt(s: unknown): string | null {
  const t = String(s ?? '').trim();
  return t === '' ? null : t;
}

/** Monto COP; null si es null. */
function money(n: number | null | undefined): string | null {
  return n == null ? null : fmtCOP(n);
}

/** Número con separadores; null si es null. */
function numTxt(n: number | null | undefined): string | null {
  return n == null ? null : n.toLocaleString('es-CO');
}

function generoLabel(g: string | null): string | null {
  const v = txt(g);
  if (!v) return null;
  if (v.toUpperCase() === 'M') return 'Masculino';
  if (v.toUpperCase() === 'F') return 'Femenino';
  return v;
}

function vigenciaLabel(meses: number | null): string | null {
  if (meses == null) return null;
  const anios = meses / 12;
  if (Number.isInteger(anios) && anios > 0)
    return `${meses} meses (${anios} ${anios === 1 ? 'año' : 'años'})`;
  return `${meses} meses`;
}

export function buildGrupos(a: AfiliacionDetalleApi, sel: Tarea): GrupoDef[] {
  const as = a.asegurado;
  const to = a.tomador;
  const co = a.condiciones;
  const su = a.sumas;
  const cm = a.comercial;
  const em = a.empresa;
  const pr = a.proceso;
  const ex = a.examenes;
  const re = a.reaseguro;

  const tomadorDistinto =
    txt(to.numero_documento) != null &&
    txt(to.numero_documento) !== txt(as.numero_documento);

  const positivo = (n: number | null | undefined): string | null =>
    n != null && n > 0 ? fmtCOP(n) : null;

  return [
    {
      title: 'Asegurado y contacto',
      icon: 'user',
      filas: [
        { k: 'Nombre', v: txt(as.nombre), strong: true },
        // Documento SIEMPRE en dos filas: el tipo no trunca al número.
        { k: 'Tipo de documento', v: txt(as.tipo_documento) },
        {
          k: 'N° de documento',
          v: txt(as.numero_documento),
          copy: txt(as.numero_documento) ?? undefined,
          num: true,
        },
        { k: 'Nacimiento', v: fmtDia(as.fecha_nacimiento), num: true },
        { k: 'Edad', v: as.edad != null ? `${as.edad} años` : null, num: true },
        { k: 'Género', v: generoLabel(as.genero) },
        { k: 'Profesión', v: txt(sel.asegurado.ocupacion) },
        { k: 'Teléfono', v: txt(as.telefono), num: true },
        {
          k: 'Celular',
          v: txt(as.celular),
          copy: txt(as.celular) ?? undefined,
          num: true,
        },
        // Ciudad de residencia (chankla) = la que evalúa el motor. Se muestran
        // también las otras dos por transparencia (pueden diferir).
        { k: 'Ciudad de residencia', v: txt(as.ciudad_residencia), strong: true },
        { k: 'Ciudad cliente (Pipeline)', v: txt(as.ciudad_cliente) },
        { k: 'Ciudad afiliación', v: txt(as.ciudad_afiliacion) },
      ],
    },
    {
      title: 'Tomador',
      icon: 'user',
      filas: tomadorDistinto
        ? [
            { k: 'Nombre', v: txt(to.nombre), strong: true },
            { k: 'Tipo de documento', v: txt(to.tipo_documento) },
            {
              k: 'N° de documento',
              v: txt(to.numero_documento),
              copy: txt(to.numero_documento) ?? undefined,
              num: true,
            },
          ]
        : [],
    },
    {
      title: 'Producto y condiciones',
      icon: 'layers',
      filas: [
        { k: 'Producto', v: txt(a.producto), full: true, strong: true },
        { k: 'Valor asegurado', v: money(co.valor_asegurado), strong: true, num: true },
        { k: 'Prima / aporte', v: money(co.prima_aporte), num: true },
        { k: 'Forma de pago', v: txt(co.forma_pago) },
        { k: 'Periodicidad', v: txt(co.periodicidad) },
        { k: 'Vigencia', v: vigenciaLabel(co.vigencia_meses), num: true },
        { k: 'APE', v: numTxt(co.ape), num: true },
        { k: 'Cobertura', v: txt(co.cobertura) },
        { k: 'Estado cobertura', v: txt(co.estado_cobertura) },
        { k: 'Póliza asegurable', v: txt(co.poliza_asegurable) },
        { k: 'Causal retención', v: txt(co.causal_retencion), full: true },
      ],
    },
    {
      // Cúmulo REAL (control de cúmulos: pólizas vigentes + cotizaciones en
      // trámite, la actual incluida). Si el bridge no respondió, todo viene
      // null y el grupo se oculta — nunca se muestra el TotalCumulus de
      // Pipeline, que era el bug del "cúmulo incompleto".
      title: 'Cúmulo del cliente',
      icon: 'coins',
      filas: [
        { k: 'Crea Ahorro', v: positivo(su.crea_ahorro), num: true },
        { k: 'Crea Patrimonio', v: positivo(su.crea_patrimonio), num: true },
        { k: 'Capital + Seguro', v: positivo(su.capital_seguro), num: true },
        { k: 'Vida e Incapacidad', v: positivo(su.vida_incapacidad), num: true },
        { k: 'Crea Serenidad', v: positivo(su.crea_serenidad), num: true },
        {
          k: 'Exposiciones',
          v:
            su.polizas_vigentes != null || su.en_tramite != null
              ? `${su.polizas_vigentes ?? 0} vigente(s) · ${su.en_tramite ?? 0} en trámite`
              : null,
        },
        { k: 'Total cúmulo', v: money(su.total_cumulo), strong: true, num: true },
      ],
    },
    {
      title: 'Comercial',
      icon: 'briefcase',
      filas: [
        { k: 'Nombre agente', v: txt(cm.nombre_agente), full: true },
        { k: 'Código agente', v: txt(cm.codigo_agente), num: true },
        { k: 'Id agente', v: txt(cm.id_agente), num: true },
        { k: 'Tipo agente', v: txt(cm.tipo_agente) },
        { k: 'Agencia', v: txt(cm.agencia) },
        { k: 'Director comercial', v: txt(cm.director_comercial) },
        { k: 'Canal', v: txt(cm.canal) },
        { k: 'Iniciativa', v: txt(a.iniciativa) },
      ],
    },
    {
      title: 'Empresa',
      icon: 'building-2',
      filas:
        txt(em.nit) || txt(em.nombre)
          ? [
              { k: 'Nombre', v: txt(em.nombre), full: true },
              { k: 'NIT', v: txt(em.nit), num: true },
            ]
          : [],
    },
    {
      title: 'Proceso de suscripción',
      icon: 'clipboard-list',
      filas: [
        { k: 'Recibida a estudio', v: fmtDia(pr.fecha_recibida_estudio), num: true },
        { k: 'Envío correo asesor', v: fmtDia(pr.fecha_envio_correo_asesor), num: true },
        { k: 'Respuesta asesor', v: fmtDia(pr.fecha_respuesta_asesor), num: true },
        {
          k: 'Contrato Pharos',
          v: txt(pr.contrato_pharos),
          copy: txt(pr.contrato_pharos) ?? undefined,
          num: true,
        },
        { k: 'Emisión', v: fmtDia(pr.fecha_emision), num: true },
        { k: 'Usuario emisión', v: txt(pr.usuario_emision) },
        { k: 'Límite 1er pago', v: fmtDia(pr.fecha_limite_pago_primera), num: true },
        {
          k: 'Días para pago',
          v: numTxt(pr.dias_para_pago),
          danger: pr.dias_para_pago != null && pr.dias_para_pago < 0,
          num: true,
        },
        { k: 'Fecha de pago', v: fmtDia(pr.fecha_pago), num: true },
        {
          k: 'Motivo rechazo / retracto',
          v: txt(pr.motivo_rechazo_retracto),
          full: true,
          danger: true,
        },
      ],
    },
    {
      title: 'Exámenes médicos',
      icon: 'flask-conical',
      filas:
        txt(ex.tipo) ||
        ex.fecha_envio_solicitud ||
        ex.fecha_cita ||
        ex.fecha_entrega_resultados
          ? [
              { k: 'Tipo', v: txt(ex.tipo) },
              { k: 'N° cita', v: txt(ex.numero_cita), num: true },
              { k: 'Envío solicitud', v: fmtDia(ex.fecha_envio_solicitud), num: true },
              { k: 'Llamada cliente', v: fmtDia(ex.fecha_llamada_cliente), num: true },
              { k: 'Fecha cita', v: fmtDia(ex.fecha_cita), num: true },
              { k: 'Prueba de esfuerzo', v: fmtDia(ex.fecha_prueba_esfuerzo), num: true },
              { k: 'Unidad', v: txt(ex.unidad) },
              { k: 'Entrega resultados', v: fmtDia(ex.fecha_entrega_resultados), num: true },
              { k: 'Dirección domicilio', v: txt(ex.direccion_domicilio), full: true },
              {
                k: 'Observaciones proveedor',
                v: txt(ex.observaciones_proveedor),
                full: true,
              },
            ]
          : [],
    },
    {
      title: 'Reaseguro',
      icon: 'repeat',
      filas: [
        { k: 'Envío', v: fmtDia(re.fecha_envio), num: true },
        { k: 'Recibido', v: fmtDia(re.fecha_recibido), num: true },
        { k: 'Observaciones', v: txt(re.observaciones), full: true },
      ],
    },
    {
      title: 'Estados y afiliación',
      icon: 'file-text',
      filas: [
        { k: 'Estado póliza', v: txt(a.estado_poliza) },
        { k: 'Subestado póliza', v: txt(a.subestado_poliza) },
        { k: 'Mes afiliación', v: txt(a.mes_afiliacion) },
        {
          k: 'N° cotización',
          v: txt(a.numero_cotizacion),
          copy: txt(a.numero_cotizacion) ?? undefined,
          num: true,
        },
        { k: 'Cotización Pharos', v: fmtDia(a.fecha_cotizacion_pharos), num: true },
        { k: 'Recepción afiliación', v: fmtDia(a.fecha_recepcion_afiliacion), num: true },
        { k: 'Usuario afiliaciones', v: txt(a.usuario_afiliaciones) },
        { k: 'Iron Mountain', v: fmtDia(a.fecha_iron_mountain), num: true },
        { k: 'Contrato Ulla', v: txt(a.contrato_ulla), num: true },
        { k: 'Asistencia', v: txt(a.asistencia) },
        { k: 'Observaciones', v: txt(a.observaciones), full: true },
      ],
    },
  ];
}

/** Partes de la línea de identidad bajo el título (documento, edad, etc.). */
export interface ParteIdentidad {
  texto: string;
  prefijo?: string;
  copy?: string;
  copyLabel?: string;
  icon?: string;
  fuerte?: boolean;
}

export function buildIdentidad(
  sel: Tarea,
  afi: AfiliacionDetalleApi | null,
): ParteIdentidad[] {
  const partes: ParteIdentidad[] = [];
  const tipoDoc = txt(afi?.asegurado.tipo_documento);
  const numDoc = txt(afi?.asegurado.numero_documento) ?? txt(sel.asegurado.cedula);
  if (numDoc)
    partes.push({
      prefijo: tipoDoc ?? undefined,
      texto: numDoc,
      fuerte: true,
      copy: numDoc,
      copyLabel: 'número de documento',
    });
  const edad = afi?.asegurado.edad;
  if (edad != null) partes.push({ texto: `${edad} años` });
  const genero = generoLabel(sel.asegurado.genero);
  if (genero) partes.push({ texto: genero });
  const profesion = txt(sel.asegurado.ocupacion);
  if (profesion) partes.push({ texto: profesion, icon: 'briefcase' });
  const ciudad = txt(sel.asegurado.ciudad) ?? txt(afi?.asegurado.ciudad_cliente);
  if (ciudad) partes.push({ texto: ciudad });
  partes.push({
    prefijo: 'Cotización',
    texto: sel.nro_cotizacion,
    fuerte: true,
    copy: sel.nro_cotizacion,
    copyLabel: 'número de cotización',
  });
  return partes;
}
