// Funciones puras de la asignación del Buzón Inteligente 2.0, portadas de
// alma-backend app/services/buzon_asignacion.py. El backend es la fuente de
// verdad; aquí se usan para (1) marcar en la vista previa de una base los
// responsables que no se reconocen en el equipo («Vincular a…») y (2) simular
// la cadena en el modo demostración. Mantener alineado con el backend.

import type { Base, Comparacion, Grupo, GrupoIn, PasoTraza, Persona, PersonaIn, ResultadoAsignacion } from './buzon.api';

/** Cuerpo del PUT de un grupo (reemplaza también sus búsquedas en bases). */
export function aGrupoIn(g: Grupo, cambios: Partial<GrupoIn> = {}): GrupoIn {
  return {
    nombre: g.nombre,
    etiquetas: [...g.etiquetas],
    destino: g.destino,
    carpeta: g.carpeta,
    sin_activos_modo: g.sin_activos_modo,
    sin_activos_carpeta: g.sin_activos_carpeta,
    sin_activos_persona_id: g.sin_activos_persona_id,
    orden: g.orden,
    activo: g.activo,
    reglas: g.reglas.map((r) => ({
      base_id: r.base_id,
      cruces: r.cruces.map((c) => ({ ...c })),
      col_responsable: r.col_responsable,
      col_respaldo: r.col_respaldo || null,
      activa: r.activa,
    })),
    ...cambios,
  };
}

/** Persona → cuerpo del PUT del equipo (el respaldo viaja como correo). */
export function aPersonaIn(p: Persona, equipo: Persona[]): PersonaIn {
  return {
    nombre: p.nombre,
    correo: p.correo,
    carpeta: p.carpeta || null,
    disponible: p.disponible,
    grupos: Object.fromEntries(
      Object.entries(p.grupos).map(([gid, m]) => [
        gid,
        { activa: m.activa, respaldo: equipo.find((x) => x.id === m.respaldo_id)?.correo ?? null },
      ]),
    ),
  };
}

/** Comparación sugerida según el nombre del dato (igual que el prototipo validado). */
export function comparacionPara(campo: string): Comparacion {
  if (/nit/.test(campo)) return 'doc';
  if (/codigo_pac|_pc$/.test(campo)) return 'pc';
  if (/cedula|identificacion|contrato|encargo|planilla/.test(campo)) return 'digitos';
  if (/razon|nombre|empresa|proveedor/.test(campo)) return 'aprox';
  return 'exacta';
}

const sinTildes = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '');

function normPc(v: unknown): string {
  const m = /^PC(\d+)$/.exec(String(v ?? '').replace(/[\s.-]/g, '').toUpperCase());
  if (!m) return '';
  const n = m[1].replace(/^0+/, '');
  return n ? `PC${n.padStart(4, '0')}` : '';
}

function normNit(v: unknown): string {
  return String(v ?? '').split('-')[0].replace(/\D/g, '').replace(/^0+/, '');
}

function normTxt(v: unknown): string {
  let t = sinTildes(String(v ?? '').toUpperCase());
  t = t.replace(/\b(S\.?A\.?S\.?|S\.?A\.?|LTDA\.?)(?=\W|$)/g, '');
  return t.replace(/[^A-Z0-9]/g, '');
}

export function normaliza(v: unknown, comparacion: Comparacion): string {
  if (comparacion === 'digitos') return String(v ?? '').replace(/\D/g, '');
  if (comparacion === 'doc') return normNit(v);
  if (comparacion === 'pc') return normPc(v);
  if (comparacion === 'aprox') return normTxt(v);
  return String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Similitud aproximada (Dice sobre bigramas): basta para la demo. */
function similitud(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bi = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const x = bi(a);
  const y = bi(b);
  let inter = 0;
  x.forEach((n, k) => (inter += Math.min(n, y.get(k) ?? 0)));
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

export function coincide(valorCorreo: string, valorBase: unknown, comparacion: Comparacion): boolean {
  const b = normaliza(valorBase, comparacion);
  if (!valorCorreo || !b) return false;
  if (valorCorreo === b) return true;
  return comparacion === 'aprox' && similitud(valorCorreo, b) >= 0.9;
}

/** Clave con la que el backend guarda los vínculos de una base. */
export function nrm(v: unknown): string {
  return sinTildes(String(v ?? '').toUpperCase()).replace(/[^A-Z0-9@.]/g, '');
}

/** Persona del equipo a la que se refiere un valor de la base: correo, nombre
 *  completo, primer nombre o usuario del correo; o el vínculo guardado. */
export function reconocer(
  valor: unknown,
  equipo: Pick<Persona, 'nombre' | 'correo'>[],
  vinculos?: Record<string, string> | null,
): Pick<Persona, 'nombre' | 'correo'> | null {
  const n = nrm(valor);
  if (!n) return null;
  const vinculado = vinculos?.[n];
  return (
    equipo.find((p) => {
      const correo = (p.correo ?? '').toLowerCase();
      const nombre = p.nombre ?? '';
      return (
        (vinculado && correo === vinculado.toLowerCase()) ||
        nrm(correo) === n ||
        nrm(nombre) === n ||
        (nombre && nrm(nombre.split(/\s+/)[0]) === n) ||
        nrm(correo.split('@')[0]) === n
      );
    }) ?? null
  );
}

export function activo(p: Persona | null | undefined, grupoId: string): boolean {
  if (!p || !p.disponible) return false;
  return !!p.grupos?.[grupoId]?.activa;
}

const carpetaTxt = (p: Persona) =>
  p.carpeta ? `carpeta «${p.carpeta}»` : 'sin carpeta: queda en la carpeta vigilada';

const primerValor = (v: unknown): unknown => (Array.isArray(v) ? v.find((x) => x !== null && x !== '') : v);

/** Simulación de la cadena (solo demo). Misma lógica que `asignar` del backend. */
export function simularAsignacion(
  grupo: Grupo,
  equipo: Persona[],
  bases: Record<string, Base & { filas: Record<string, string>[] }>,
  datos: Record<string, unknown>,
  alDesactivar: 'respaldo' | 'roundrobin',
  cargaHoy: Record<string, number> = {},
): Omit<ResultadoAsignacion, 'grupo' | 'persona'> & { persona: Persona | null } {
  const traza: PasoTraza[] = [];
  const porId = new Map(equipo.map((p) => [p.id, p]));
  const paso = (estado: PasoTraza['estado'], titulo: string, detalle = '') => traza.push({ estado, titulo, detalle });
  const fin = (estado: ResultadoAsignacion['estado'], persona: Persona | null = null, carpeta: string | null = null, via = '') => ({
    estado,
    persona,
    carpeta: carpeta ?? persona?.carpeta ?? null,
    via,
    traza,
  });
  const gid = grupo.id;

  if (grupo.destino === 'carpeta') {
    paso('ok', `Destino: carpeta «${grupo.carpeta ?? '—'}»`, 'Se etiqueta y se mueve, sin asignar a personas');
    return fin('carpeta', null, grupo.carpeta, `Grupo ${grupo.nombre} → carpeta`);
  }
  if (grupo.destino === 'categorizar') {
    paso('ok', 'Destino: solo categorizar', 'Se etiqueta y se queda en la carpeta vigilada');
    return fin('categorizar', null, null, `Grupo ${grupo.nombre} → solo categorizar`);
  }
  paso('skip', 'Continuidad del hilo', 'Correo inicial o sin responsable previo: no aplica');

  const responsable = (valor: unknown, respaldoBase: unknown, fuente: string, base: Base): Persona | null => {
    if (valor === null || valor === undefined || valor === '') {
      paso('skip', `${fuente}: responsable vacío`, 'Sigue con la siguiente búsqueda');
      return null;
    }
    const r0 = reconocer(valor, equipo, base.vinculos);
    const p = r0 ? (equipo.find((x) => x.correo === r0.correo) ?? null) : null;
    if (!p) {
      paso('warn', `${fuente}: «${valor}» no se reconoce en el equipo`, 'Vincúlalo en la base; mientras tanto sigue con la siguiente búsqueda');
      return null;
    }
    const quien = String(valor) + (nrm(valor) !== nrm(p.nombre) ? ` = ${p.nombre}` : '');
    if (activo(p, gid)) {
      paso('ok', `Asignado a ${p.nombre}`, `${fuente} → ${quien} · ${carpetaTxt(p)}`);
      return p;
    }
    const motivo = !p.disponible ? 'ausente' : !p.grupos[gid] ? 'no pertenece al grupo' : 'inactiva en el grupo';
    paso('warn', `${quien} · ${motivo}`, 'Al desactivar: ' + (alDesactivar === 'respaldo' ? 'respaldo fijo' : 'round-robin'));
    if (alDesactivar === 'respaldo') {
      let r = porId.get(p.grupos[gid]?.respaldo_id ?? '') ?? null;
      if (!r && respaldoBase) {
        const rb = reconocer(respaldoBase, equipo, base.vinculos);
        r = rb ? (equipo.find((x) => x.correo === rb.correo) ?? null) : null;
      }
      if (r && activo(r, gid)) {
        paso('ok', `Respaldo → ${r.nombre}`, carpetaTxt(r));
        return r;
      }
      paso('warn', 'Respaldo no disponible', 'Pasa a la siguiente búsqueda');
    }
    return null;
  };

  for (const regla of grupo.reglas) {
    const base = bases[regla.base_id];
    const nombreB = base?.nombre ?? regla.base_nombre ?? 'base';
    if (!regla.activa) {
      paso('skip', `Búsqueda en ${nombreB}`, 'Regla desactivada');
      continue;
    }
    if (!base || base.estado !== 'ok') {
      paso('warn', `${nombreB} no disponible`, 'Sigue con la siguiente búsqueda');
      continue;
    }
    for (const cz of regla.cruces) {
      const titulo = `${nombreB} · ${cz.campo} ↔ ${cz.columna}`;
      const valor = primerValor(datos[cz.campo]);
      if (valor === null || valor === undefined || valor === '') {
        paso('skip', titulo, `El correo no trae ${cz.campo}`);
        continue;
      }
      if (!base.columnas.includes(cz.columna)) {
        paso('warn', `${nombreB} · la columna ${cz.columna} no existe`, 'Revisa el cruce');
        continue;
      }
      const nv = normaliza(valor, cz.comparacion);
      const filas = base.filas.filter((f) => coincide(nv, f[cz.columna], cz.comparacion));
      if (!filas.length) {
        paso('skip', titulo, `${nv || String(valor)} no está en la base`);
        continue;
      }
      const distintos = [...new Set(filas.map((f) => f[regla.col_responsable]).filter((x) => x))];
      if (distintos.length > 1) {
        paso('warn', titulo, `${filas.length} filas con responsables distintos: conflicto, prueba el siguiente cruce`);
        continue;
      }
      paso('ok', titulo, `${nv} → fila encontrada`);
      const fila = filas[0];
      const p = responsable(
        fila[regla.col_responsable],
        regla.col_respaldo ? fila[regla.col_respaldo] : null,
        `${nombreB} · ${regla.col_responsable}`,
        base,
      );
      if (p) return fin('asignado', p, null, `${nombreB} · ${cz.campo}`);
      break;
    }
  }

  const activos = equipo.filter((p) => activo(p, gid));
  if (activos.length) {
    const elegido = [...activos].sort((a, b) => (cargaHoy[a.id] ?? 0) - (cargaHoy[b.id] ?? 0) || a.orden - b.orden)[0];
    paso(
      'ok',
      `Round-robin ${grupo.nombre} → ${elegido.nombre}`,
      `${carpetaTxt(elegido)} · carga hoy: ` + activos.map((p) => `${p.nombre.split(' ')[0]} ${cargaHoy[p.id] ?? 0}`).join(' · '),
    );
    return fin('asignado', elegido, null, `Round-robin ${grupo.nombre}`);
  }
  if (grupo.sin_activos_modo === 'carpeta' && grupo.sin_activos_carpeta) {
    paso('warn', `Round-robin ${grupo.nombre}: nadie activo`, `Se envía a la carpeta «${grupo.sin_activos_carpeta}» sin asignar`);
    return fin('carpeta', null, grupo.sin_activos_carpeta, `${grupo.nombre}: nadie activo`);
  }
  const persona = grupo.sin_activos_modo === 'persona' ? porId.get(grupo.sin_activos_persona_id ?? '') : undefined;
  if (persona?.disponible) {
    paso('ok', `Round-robin ${grupo.nombre}: nadie activo → ${persona.nombre}`, 'Persona de respaldo del grupo · ' + carpetaTxt(persona));
    return fin('asignado', persona, null, `${grupo.nombre}: respaldo del grupo`);
  }
  paso('bad', `Round-robin ${grupo.nombre}`, 'Nadie activo en el grupo → cola «Sin asignar» y alerta al líder');
  return fin('sin_asignar', null, null, `${grupo.nombre}: nadie activo`);
}
