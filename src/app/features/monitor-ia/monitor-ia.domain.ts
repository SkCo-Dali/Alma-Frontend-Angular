// Etiquetas, colores y conversiones de Monitor-IA.

import { CriterioDuracion, EstadoCampana, ModoCola, Sentido } from './monitor-ia.api';

/** Las fechas se leen y se piden en hora de Colombia (UTC-5 fijo, sin horario de verano). */
export const ZONA = { timeZone: 'America/Bogota' } as const;

/** «2026-10-01T08:00» (hora de Bogotá, del <input type="datetime-local">) → ISO en UTC. */
export function bogotaAUtc(local: string): string {
  return new Date(`${local}:00-05:00`).toISOString();
}

/** Fecha de hoy en Bogotá con la hora indicada, en el formato del <input type="datetime-local">. */
export function bogotaHoy(hora: string, diasAtras = 0): string {
  const ahora = new Date(Date.now() - 5 * 3600_000 - diasAtras * 86400_000);
  return `${ahora.toISOString().slice(0, 10)}T${hora}`;
}

export function fecha(iso: string | null, conAnio = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString('es-CO', {
        ...ZONA,
        day: '2-digit',
        month: 'short',
        ...(conAnio ? { year: 'numeric' } : {}),
        hour: '2-digit',
        minute: '2-digit',
      });
}

export function duracion(segundos: number | null): string {
  if (segundos === null || segundos === undefined) return '—';
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface EtiquetaEstado {
  texto: string;
  clase: string;
  /** El estado cambia solo (hay trabajo en segundo plano): la pantalla se refresca. */
  enCurso: boolean;
}

const MUTED = 'bg-muted text-muted-foreground';
const SKY = 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300';
const AMBER = 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300';
const GREEN = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300';
const RED = 'bg-destructive/10 text-destructive';

export const ESTADO_CAMPANA: Record<EstadoCampana, EtiquetaEstado> = {
  PREVISUALIZANDO: { texto: 'Sorteando la muestra', clase: AMBER, enCurso: true },
  PREVISUALIZADO: { texto: 'Lista para revisar', clase: SKY, enCurso: false },
  EJECUTANDO: { texto: 'Enviando a Genesys', clase: AMBER, enCurso: true },
  SOLICITUDES_ENVIADAS: { texto: 'Solicitudes enviadas', clase: SKY, enCurso: false },
  RESULTADOS_ACTUALIZADOS: { texto: 'Con resultados', clase: GREEN, enCurso: false },
  CANCELADA: { texto: 'Cancelada', clase: MUTED, enCurso: false },
  ERROR: { texto: 'Con error', clase: RED, enCurso: false },
};

export function estadoCampana(estado: string): EtiquetaEstado {
  return ESTADO_CAMPANA[estado as EstadoCampana] ?? { texto: estado, clase: MUTED, enCurso: false };
}

const ESTADO_LLAMADA: Record<string, { texto: string; clase: string }> = {
  PENDIENTE: { texto: 'Pendiente', clase: MUTED },
  SOLICITADA: { texto: 'Solicitada', clase: SKY },
  YA_EXISTIA: { texto: 'Ya existía en Genesys', clase: SKY },
  NO_CONFIRMADA: { texto: 'Por confirmar', clase: AMBER },
  ERROR: { texto: 'Error', clase: RED },
  DUPLICADA: { texto: 'Ya pedida antes', clase: AMBER },
};

export function estadoLlamada(estado: string): { texto: string; clase: string } {
  return ESTADO_LLAMADA[estado] ?? { texto: estado, clase: MUTED };
}

export const ETIQUETA_SENTIDO: Record<Sentido, string> = {
  inbound: 'Entrantes',
  outbound: 'Salientes',
  both: 'Entrantes y salientes',
};

export const ETIQUETA_COLA: Record<ModoCola, string> = {
  any: 'Cualquier llamada',
  with_queue: 'Solo con cola',
  without_queue: 'Solo sin cola',
  selected: 'Colas específicas',
};

export const ETIQUETA_CRITERIO: Record<CriterioDuracion, string> = {
  total: 'Conversación total',
  agent: 'Interacción del asesor',
  both: 'Interacción del asesor',
};

export function estadoGenesys(estado: string | null): string {
  switch ((estado ?? '').toUpperCase()) {
    case 'FINISHED':
      return 'Terminada';
    case 'PENDING':
      return 'Procesando';
    case 'INPROGRESS':
      return 'En curso';
    case '':
      return '—';
    default:
      return estado as string;
  }
}

export function nota(puntaje: number | null, maximo: number | null): string {
  if (puntaje === null || puntaje === undefined) return '—';
  const fmt = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  return maximo ? `${fmt(puntaje)} / ${fmt(maximo)}` : fmt(puntaje);
}
