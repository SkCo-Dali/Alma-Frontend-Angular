// Etiquetas y colores de los casos de Salesforce en Monitor-IA.

import { Caso, CondicionFiltro, Cobertura, EstadoCampanaCasos, EstadoCaso, Flujo, Operador } from './casos.api';
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

/** Productos de un caso: Lista_Productos__c puede traer varios separados por «;» (igual que el backend). */
export function productosDe(valor: string | null): string[] {
  return [...new Set((valor ?? '').split(';').map((v) => v.trim()).filter(Boolean))];
}

/** La cobertura con los casos seleccionados de AHORA (el Coordinador descarta casos sin recargar). */
export function coberturaVigente(cobertura: Cobertura, casos: ReadonlyArray<Caso>): Cobertura {
  const meta = Math.max(cobertura.minimo, 1);
  const cuenta = new Map<string, number>();
  let sinProducto = 0;
  for (const x of casos) {
    if (!x.seleccionada) continue;
    const productos = productosDe(x.producto);
    if (!productos.length) sinProducto++;
    for (const p of productos) cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
  }
  const productos = cobertura.productos.map((p) => {
    const seleccionados = cuenta.get(p.producto) ?? 0;
    return { ...p, seleccionados, cubierto: seleccionados >= meta };
  });
  return {
    ...cobertura,
    productos,
    cubiertos: productos.filter((p) => p.cubierto).length,
    sin_producto: { ...cobertura.sin_producto, seleccionados: sinProducto },
  };
}

export const OPERADORES: ReadonlyArray<{ valor: Operador; texto: string; negativo: boolean }> = [
  { valor: 'igual', texto: 'es igual a', negativo: false },
  { valor: 'contiene', texto: 'contiene', negativo: false },
  { valor: 'empieza_con', texto: 'empieza con', negativo: false },
  { valor: 'termina_con', texto: 'termina con', negativo: false },
  { valor: 'no_igual', texto: 'es distinto de', negativo: true },
  { valor: 'no_contiene', texto: 'no contiene', negativo: true },
];

const INFO_OPERADOR = new Map(OPERADORES.map((o) => [o.valor, o]));

/** Condiciones sin vacíos ni repetidas, con las claves en el orden en que las devuelve el backend. */
export function limpiarCondiciones(lista: ReadonlyArray<CondicionFiltro>): CondicionFiltro[] {
  const vistas = new Set<string>();
  const salida: CondicionFiltro[] = [];
  for (const c of lista) {
    const valor = c.valor.trim();
    const clave = `${c.operador}|${valor}`;
    if (!valor || vistas.has(clave)) continue;
    vistas.add(clave);
    salida.push({ operador: c.operador, valor });
  }
  return salida;
}

/** Frase que explica el filtro, p. ej. «Origen es igual a «Email» o contiene «Mail», y no contiene «Spam»». */
export function describirFiltro(campo: string, lista: ReadonlyArray<CondicionFiltro>): string {
  const frase = (c: CondicionFiltro) => `${INFO_OPERADOR.get(c.operador)?.texto ?? c.operador} «${c.valor}»`;
  const positivas = lista.filter((c) => !INFO_OPERADOR.get(c.operador)?.negativo).map(frase);
  const negativas = lista.filter((c) => INFO_OPERADOR.get(c.operador)?.negativo).map(frase);
  const partes: string[] = [];
  if (positivas.length) partes.push(`${campo} ${positivas.join(' o ')}`);
  if (negativas.length) partes.push(positivas.length ? negativas.join(' y ') : `${campo} ${negativas.join(' y ')}`);
  return partes.join(', y ');
}

export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
