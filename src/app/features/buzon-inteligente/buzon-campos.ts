// Datos de un proceso que ya existe al actualizarlo con un prompt nuevo. Misma regla
// que `fusionar_campos` del backend (buzon_procesos.py): el prompt decide QUÉ datos hay
// (agrega los nuevos, quita los que ya no menciona); de cada dato que sigue se conserva
// lo que el área configuró en «Datos (JSON)» — tipo, Crítico, Alterno, Identificador,
// las columnas de una lista y el «Qué extraer» ajustado a mano (✎). Antes se
// reemplazaba todo y así PAC perdió las columnas de `afiliados` sin que nadie lo viera.

import { CampoProceso } from './buzon.api';

export function fusionarCampos(previos: CampoProceso[], propuestos: CampoProceso[]): CampoProceso[] {
  const porClave = new Map(previos.map((c) => [c.clave, c]));
  return propuestos.map((nuevo) => {
    const viejo = porClave.get(nuevo.clave);
    if (!viejo) return nuevo;
    const tipo = viejo.tipo ?? nuevo.tipo;
    return {
      ...nuevo,
      tipo,
      critico: viejo.critico,
      alterno: viejo.alterno,
      identificador: viejo.identificador,
      origen: viejo.origen ?? nuevo.origen,
      descripcion: viejo.origen === 'user' && viejo.descripcion ? viejo.descripcion : nuevo.descripcion,
      campos: tipo === 'tabla' ? [...new Set([...(viejo.campos ?? []), ...(nuevo.campos ?? [])])] : viejo.campos ?? [],
    };
  });
}

/** Lo que se conserva de un dato que sigue, en palabras («3 columnas · Crítico: Alterno»). */
export interface Conservado {
  clave: string;
  detalle: string;
}

export function ajustesConservados(previos: CampoProceso[], propuestos: CampoProceso[]): Conservado[] {
  const siguen = new Set(propuestos.map((c) => c.clave));
  return previos
    .filter((c) => siguen.has(c.clave))
    .map((c) => {
      const partes: string[] = [];
      const n = c.campos?.length ?? 0;
      if (c.tipo === 'tabla' && n) partes.push(`${n} columna${n === 1 ? '' : 's'}`);
      if (c.alterno) partes.push('Crítico: Alterno');
      else if (c.critico) partes.push('Crítico: Sí');
      if (c.identificador) partes.push('identifica el caso');
      if (c.origen === 'user' && c.descripcion) partes.push('«Qué extraer» ajustado a mano');
      return { clave: c.clave, detalle: partes.join(' · ') };
    })
    .filter((x) => x.detalle);
}

/** Columnas que el prompt propone para una lista y que aún no estaban (se suman). */
export function columnasNuevas(previos: CampoProceso[], propuestos: CampoProceso[]): { clave: string; columnas: string[] }[] {
  const porClave = new Map(previos.map((c) => [c.clave, c]));
  return propuestos
    .map((c) => {
      const viejo = porClave.get(c.clave);
      if (!viejo || (viejo.tipo ?? c.tipo) !== 'tabla') return { clave: c.clave, columnas: [] };
      return { clave: c.clave, columnas: (c.campos ?? []).filter((x) => !(viejo.campos ?? []).includes(x)) };
    })
    .filter((x) => x.columnas.length);
}
