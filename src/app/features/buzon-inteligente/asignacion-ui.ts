// Utilidades de la UI de «Asignación» (2.0) que comparten la pestaña del buzón y el
// asistente «Nuevo buzón» (prototipo validado: etiquetasDe, camposDeGrupo,
// gruposPorModo, sinActivosTxt, parseCorreos). Los grupos del formulario son un
// borrador: sincronizarGrupos los lleva al backend (crea, actualiza y elimina).

import type { AccesosApi } from '../../core/services/accesos.api';
import type { BuzonApi, CampoProceso, Categoria, DestinoGrupo, Grupo, GrupoIn, Persona, PersonaIn, Proceso } from './buzon.api';
import { aGrupoIn } from './buzon-asignacion';

/** [clave de la etiqueta, clave del proceso]. */
export type EtiquetaProceso = [string, string];

export type ModoGrupos = 'uno' | 'proceso' | 'etiqueta' | 'custom';

/** Grupo del formulario (gruposForm). `id` es null hasta que se crea en el backend. */
export interface GrupoBorrador {
  id: string | null;
  /** Llave local estable (track, selects). */
  key: string;
  nombre: string;
  etiquetas: string[];
  destino: DestinoGrupo;
  carpeta: string | null;
}

export interface EstadoGrupos {
  modo: ModoGrupos;
  grupos: GrupoBorrador[];
}

export const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const normTxt = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Etiquetas activas en el orden de los procesos; las que no tienen proceso van a OTROS. */
export function etiquetasDe(categorias: Categoria[], procesos: Proceso[]): EtiquetaProceso[] {
  const activas = categorias.filter((c) => c.activa).sort((a, b) => a.orden - b.orden);
  const procs = procesos.filter((p) => p.activo).sort((a, b) => a.orden - b.orden);
  const out: EtiquetaProceso[] = [];
  procs.forEach((p) => activas.filter((c) => c.proceso_id === p.id).forEach((c) => out.push([c.clave, p.clave])));
  activas.filter((c) => !procs.some((p) => p.id === c.proceso_id)).forEach((c) => out.push([c.clave, 'OTROS']));
  return out;
}

/** Datos que extraen los procesos de las etiquetas del grupo y sirven para cruzar (críticos primero). */
export function camposDeGrupo(g: { etiquetas: string[] }, categorias: Categoria[], procesos: Proceso[]): CampoProceso[] {
  const procIds = new Set(categorias.filter((c) => g.etiquetas.includes(c.clave) && c.proceso_id).map((c) => c.proceso_id));
  const vistos = new Map<string, CampoProceso>();
  procesos
    .filter((p) => procIds.has(p.id))
    .forEach((p) => p.campos_extraer.forEach((c) => c.tipo !== 'tabla' && c.tipo !== 'booleano' && !vistos.has(c.clave) && vistos.set(c.clave, c)));
  return [...vistos.values()].sort((a, b) => Number(b.critico) - Number(a.critico));
}

export function borradorDe(g: Grupo): GrupoBorrador {
  return { id: g.id, key: g.id, nombre: g.nombre, etiquetas: [...g.etiquetas], destino: g.destino, carpeta: g.carpeta };
}

/** Grupos propuestos por modo. Conserva destino, carpeta e id de los grupos previos con la misma llave o nombre. */
export function gruposPorModo(modo: ModoGrupos, ets: EtiquetaProceso[], prev: GrupoBorrador[]): GrupoBorrador[] {
  const usados = new Set<string>();
  const mk = (key: string, nombre: string, etiquetas: string[]): GrupoBorrador => {
    const o = prev.find((g) => !usados.has(g.key) && (g.key === key || normTxt(g.nombre) === normTxt(nombre)));
    if (o) usados.add(o.key);
    return {
      id: o?.id ?? null,
      key: o?.key ?? key,
      nombre,
      etiquetas,
      destino: o ? o.destino : key === 'OTROS' ? 'categorizar' : 'personas',
      carpeta: o?.carpeta ?? null,
    };
  };
  if (modo === 'uno') return [mk('TODOS', 'Todo el buzón', ets.map((e) => e[0]))];
  if (modo === 'etiqueta') return ets.map((e) => mk(e[0], e[0], [e[0]]));
  const by = new Map<string, string[]>();
  ets.forEach((e) => by.set(e[1], [...(by.get(e[1]) ?? []), e[0]]));
  return [...by.entries()].map(([k, etq]) => mk(k, k, etq));
}

/** Lleva el borrador al backend: elimina los grupos que ya no están, actualiza y crea.
 *  Un grupo «a carpeta» sin carpeta no se guarda todavía (el backend lo rechaza). */
export async function sincronizarGrupos(
  api: BuzonApi,
  buzonId: string,
  actuales: Grupo[],
  borrador: GrupoBorrador[],
): Promise<{ grupos: Grupo[]; borrador: GrupoBorrador[] }> {
  const ids = new Set(borrador.map((b) => b.id).filter(Boolean));
  for (const g of actuales) if (!ids.has(g.id)) await api.eliminarGrupo(g.id);
  const out: GrupoBorrador[] = [];
  for (const [i, b] of borrador.entries()) {
    const nombre = b.nombre.trim() || `Grupo ${i + 1}`;
    const valido = b.destino !== 'carpeta' || !!b.carpeta;
    const previo = b.id ? actuales.find((g) => g.id === b.id) : undefined;
    if (previo) {
      const cambios: Partial<GrupoIn> = { nombre, etiquetas: [...b.etiquetas], orden: i + 1 };
      if (valido) Object.assign(cambios, { destino: b.destino, carpeta: b.destino === 'carpeta' ? b.carpeta : null });
      const cuerpo = aGrupoIn(previo, cambios);
      if (JSON.stringify(cuerpo) !== JSON.stringify(aGrupoIn(previo))) await api.actualizarGrupo(previo.id, cuerpo);
      out.push(b);
    } else if (valido) {
      const g = await api.crearGrupo(buzonId, {
        nombre,
        etiquetas: [...b.etiquetas],
        destino: b.destino,
        carpeta: b.destino === 'carpeta' ? b.carpeta : null,
        sin_activos_modo: 'cola',
        orden: i + 1,
        activo: true,
        reglas: [],
      });
      out.push({ ...b, id: g.id });
    } else {
      out.push({ ...b, id: null });
    }
  }
  return { grupos: await api.listarGrupos(buzonId), borrador: out };
}

export function activosEn(g: Pick<Grupo, 'id'>, equipo: Persona[]): number {
  return equipo.filter((p) => p.disponible && p.grupos[g.id]?.activa).length;
}

export function sinActivosTxt(g: Grupo, equipo: Persona[]): string {
  if (g.sin_activos_modo === 'carpeta' && g.sin_activos_carpeta) return `se envían a la carpeta «${g.sin_activos_carpeta}»`;
  const p = g.sin_activos_modo === 'persona' ? equipo.find((x) => x.id === g.sin_activos_persona_id) : undefined;
  return p ? `se asignan a ${p.nombre}` : 'irán a «Sin asignar» con alerta al líder';
}

export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

/** «laura.gomez@…» → «Laura Gomez» (el backend exige un nombre). */
export function nombreDesdeCorreo(correo: string): string {
  const base = correo.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase()) || correo;
}

/** Correos pegados (coma, punto y coma o salto de línea) → válidos y errores. */
export function parseCorreos(txt: string, existentes: string[]): { ok: string[]; err: string[] } {
  const ok: string[] = [];
  const err: string[] = [];
  const ya = new Set(existentes.map((c) => c.toLowerCase()));
  String(txt || '')
    .split(/[\s,;]+/)
    .filter(Boolean)
    .forEach((x) => {
      const c = x.toLowerCase().replace(/^<|>$/g, '');
      if (!RE_CORREO.test(c)) err.push(`«${x}» no es un correo.`);
      else if (ya.has(c) || ok.includes(c)) err.push(`${c} ya está en el equipo.`);
      else ok.push(c);
    });
  return { ok, err };
}

/** Nombre de cada correo según el directorio (Graph) o, si no se puede leer, el usuario del correo. */
export async function nombresDirectorio(accesos: AccesosApi, correos: string[]): Promise<Record<string, string>> {
  const pares = await Promise.all(
    correos.map(async (c) => {
      const n = await accesos.resolverNombreDirectorio(c).catch(() => null);
      // El directorio entrega «Apellidos, Nombres»: se guarda «Nombres Apellidos» para reconocer el primer nombre.
      const nombre = n?.includes(',') ? `${n.slice(n.indexOf(',') + 1).trim()} ${n.slice(0, n.indexOf(',')).trim()}` : n;
      return [c, nombre?.trim() || nombreDesdeCorreo(c)] as const;
    }),
  );
  return Object.fromEntries(pares);
}

/** PersonaIn nueva sin grupos (se marcan después). */
export function personaNueva(correo: string, nombre: string): PersonaIn {
  return { nombre, correo, carpeta: null, disponible: true, grupos: {} };
}
