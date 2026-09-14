// Descripción de las secciones de Desarrollo Comercial: columnas y búsqueda.
// La clasificación se cambia in-place vía dropdown → POST override.

import { ParamColumn, ParamRow } from '../parametrizacion/param-table.component';
import { DcSeccionId } from './desarrollo-comercial.store';
import { CLASIFICACION_AGENTE_OPTIONS } from './desarrollo-comercial.domain';

export interface DcSeccionSpec {
  id: DcSeccionId;
  titulo: string;
  subtitulo?: string;
  placeholderBusqueda: string;
  columnas: ParamColumn[];
  anchoMinimo: string;
  soloLectura?: boolean;
  buscarEn: (row: ParamRow) => unknown[];
}

// ── Clasificación de agentes ────────────────────────────────────────────────

const CLASIFICACION_AGENTES: DcSeccionSpec = {
  id: 'clasificacionAgentes',
  titulo: 'Clasificación de agentes',
  placeholderBusqueda: 'Buscar por agente, sociedad, canal o clasificación...',
  soloLectura: true,
  anchoMinimo: '1800px',
  columnas: [
    { key: 'Periodo', label: 'Periodo', tipo: 'mono' },
    { key: 'IdAgte', label: 'IdAgte', tipo: 'mono' },
    { key: 'NombreAgte', label: 'Nombre Agente' },
    { key: 'IdSociedad', label: 'IdSociedad', tipo: 'mono' },
    { key: 'NombreSoc', label: 'Nombre Sociedad' },
    { key: 'CanalId', label: 'CanalId', tipo: 'mono' },
    { key: 'CanalDescripcion', label: 'Canal', tipo: 'chipMuted' },
    { key: 'Activo', label: 'Activo', tipo: 'switch' },
    { key: 'EditadoManual', label: 'Editado Manual', tipo: 'siNo' },
    { key: 'UsuarioModifica', label: 'Usuario Modifica' },
    { key: 'FechaModifica', label: 'Fecha Modifica', tipo: 'fecha', filtro: 'fecha' },
    { key: 'ClasificacionSociedad', label: 'Clasificación Sociedad' },
    { key: 'VigenteEnOrigen', label: 'Vigente en Origen', tipo: 'siNo' },
    {
      key: 'FechaUltimaVezEnOrigen',
      label: 'Última Vez en Origen',
      tipo: 'fecha',
      filtro: 'fecha',
    },
    {
      key: 'ClasificacionAgente',
      label: 'Clasificación',
      tipo: 'select',
      fija: 'right',
      opciones: CLASIFICACION_AGENTE_OPTIONS.map((o) => ({
        label: o.label,
        value: o.value,
      })),
    },
  ],
  buscarEn: (r) => [
    r['Periodo'],
    r['IdAgte'],
    r['NombreAgte'],
    r['IdSociedad'],
    r['NombreSoc'],
    r['CanalId'],
    r['CanalDescripcion'],
    r['ClasificacionAgente'],
    r['ClasificacionSociedad'],
    r['UsuarioModifica'],
  ],
};

export const DC_SECCIONES: Record<DcSeccionId, DcSeccionSpec> = {
  clasificacionAgentes: CLASIFICACION_AGENTES,
};

/** Pestañas principales y qué secciones muestra cada una. */
export const DC_VISTAS: { value: string; label: string; secciones: DcSeccionId[] }[] = [
  {
    value: 'clasificacion_agentes',
    label: 'Clasificación de agentes',
    secciones: ['clasificacionAgentes'],
  },
];
