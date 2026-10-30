// Etiquetas y colores de los casos de Salesforce en Monitor-IA.

import { EstadoCampanaCasos, EstadoCaso, Flujo } from './casos.api';
import { EtiquetaEstado } from './monitor-ia.domain';

const MUTED = 'bg-muted text-muted-foreground';
const SKY = 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300';
const AMBER = 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300';
const GREEN = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300';
const RED = 'bg-destructive/10 text-destructive';

export const ETIQUETA_FLUJO: Record<Flujo, string> = {
  CORREO: 'Correo',
  CHAT: 'Chat',
};

export const AYUDA_FLUJO: Record<Flujo, string> = {
  CORREO: 'Casos cerrados de correo electrónico; no entran los de «Responder a: Proceso interno».',
  CHAT: 'Casos cerrados de Chat y WhatsApp.',
};

const ESTADO_CAMPANA: Record<EstadoCampanaCasos, EtiquetaEstado> = {
  PREVISUALIZANDO: { texto: 'Sorteando la muestra', clase: AMBER, enCurso: true },
  PREVISUALIZADO: { texto: 'Lista para revisar', clase: SKY, enCurso: false },
  EJECUTANDO: { texto: 'Calificando con IA', clase: AMBER, enCurso: true },
  TERMINADA: { texto: 'Calificada', clase: GREEN, enCurso: false },
  CANCELADA: { texto: 'Cancelada', clase: MUTED, enCurso: false },
  ERROR: { texto: 'Con error', clase: RED, enCurso: false },
};

export function estadoCampanaCasos(estado: string): EtiquetaEstado {
  return ESTADO_CAMPANA[estado as EstadoCampanaCasos] ?? { texto: estado, clase: MUTED, enCurso: false };
}

const ESTADO_CASO: Record<EstadoCaso, { texto: string; clase: string }> = {
  PENDIENTE: { texto: 'Pendiente', clase: MUTED },
  CALIFICADO: { texto: 'Calificado', clase: GREEN },
  SIN_TEXTO: { texto: 'Sin texto', clase: AMBER },
  ERROR: { texto: 'Error', clase: RED },
};

export function estadoCaso(estado: string): { texto: string; clase: string } {
  return ESTADO_CASO[estado as EstadoCaso] ?? { texto: estado, clase: MUTED };
}

/** «Si» en verde, «No» en rojo. */
export function claseRespuesta(valor: string | undefined): string {
  return valor === 'Si' ? GREEN : valor === 'No' ? RED : MUTED;
}

/** Una lista de valores escrita uno por línea (o separados por coma) → arreglo limpio. */
export function lineas(texto: string): string[] {
  return [...new Set(texto.split(/[\n,]/).map((v) => v.trim()).filter(Boolean))];
}

export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
