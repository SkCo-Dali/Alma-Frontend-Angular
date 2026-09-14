// Tipos y catálogos del módulo Desarrollo Comercial.

export interface CalificacionAgenteRecord {
  id: string;
  Periodo: number;
  IdAgte: number;
  NombreAgte: string;
  IdSociedad: number;
  NombreSoc: string;
  CanalId: number;
  CanalDescripcion: string;
  ClasificacionAgente: string;
  Activo: boolean;
  EditadoManual: boolean;
  UsuarioModifica: string | null;
  FechaModifica: string | null;
  ClasificacionSociedad: string;
  VigenteEnOrigen: boolean;
  FechaUltimaVezEnOrigen: string | null;
}

/** Opciones del dropdown de clasificación en la tabla. */
export const CLASIFICACION_AGENTE_OPTIONS = [
  { label: 'Agencia basica', value: 'Agencia basica' },
  { label: 'Agencia master', value: 'Agencia master' },
  { label: 'Distribuidor mayorista', value: 'Distribuidor mayorista' },
  { label: 'Nuevos proyectos', value: 'Nuevos proyectos' },
] as const;
