// Cliente HTTP de la App "Buzón Inteligente" (/api/buzon-inteligente, alma-backend).
//
// Contrato: scratchpad SPEC-buzon-inteligente.md (snake_case, igual que el resto de Alma).
// Modo demostración: si el backend aún no tiene el módulo desplegado (404/503) o no
// responde, las LECTURAS caen a un conjunto de datos de ejemplo del área de Recaudos
// (buzon.demo.ts) y `modoDemo` queda en true para que la UI lo avise. Las escrituras
// en modo demo se simulan en memoria (no se pierden al navegar dentro de la App).

import { Injectable, inject, signal } from '@angular/core';
import { environment } from '@env/environment';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { DEMO, demoCorreoDetalle, demoMetricas, demoProbar } from './buzon.demo';

// ── Tipos del contrato ───────────────────────────────────────────────────────

export type ModoBuzon = 'sugerir' | 'automatico';
export type EstadoConexion = 'conectada' | 'sin_conectar' | 'requiere_reconexion' | 'app_only';
export type EstadoCorreo = 'pendiente' | 'revision' | 'ejecutado' | 'ignorado' | 'error';
export type OrigenDecision = 'ia' | 'regla' | 'humano';
export type TipoAccion =
  | 'categorizar'
  | 'mover'
  | 'reenviar'
  | 'asignar_analista'
  | 'notificar_teams'
  | 'marcar_leido';

export interface MiembroBuzon {
  user_id: string | null;
  email: string;
  name?: string | null;
  rol: 'propietario' | 'analista';
}

export interface Buzon {
  id: string;
  nombre: string;
  area: string | null;
  direccion: string;
  correo_buzon_id: string;
  estado_conexion: EstadoConexion;
  carpeta_vigilada: string;
  modo: ModoBuzon;
  umbral_confianza: number;
  max_correos_por_tick: number;
  contexto: string | null;
  activo: boolean;
  ultima_sincronizacion: string | null;
  ultimo_error: string | null;
  categorias_count: number;
  pendientes: number;
  en_revision: number;
  ejecutados_hoy: number;
  miembros: MiembroBuzon[];
  puede_administrar: boolean;
}

export interface BuzonIn {
  direccion: string;
  nombre: string;
  area?: string;
  carpeta_vigilada?: string;
  modo?: ModoBuzon;
  umbral_confianza?: number;
  contexto?: string;
  descripcion?: string;
}

export type BuzonUpdate = Partial<
  Pick<
    Buzon,
    | 'nombre'
    | 'area'
    | 'carpeta_vigilada'
    | 'modo'
    | 'umbral_confianza'
    | 'max_correos_por_tick'
    | 'contexto'
    | 'activo'
  >
>;

export interface Accion {
  id?: string;
  tipo: TipoAccion;
  parametros: Record<string, unknown>;
  orden: number;
  activa: boolean;
}

export interface CampoExtraer {
  clave: string;
  descripcion: string;
}

export interface Categoria {
  id: string;
  buzon_id: string;
  clave: string;
  nombre: string;
  descripcion: string;
  ejemplos: string[];
  palabras_clave: string | null;
  color: string | null;
  orden: number;
  activa: boolean;
  es_fallback: boolean;
  umbral_confianza: number | null;
  campos_extraer: CampoExtraer[];
  acciones: Accion[];
  correos_30d: number;
}

export type CategoriaIn = Omit<Categoria, 'id' | 'buzon_id' | 'correos_30d' | 'orden'> & {
  orden?: number;
};

export interface ReglaFija {
  id: string;
  buzon_id: string;
  nombre: string;
  remitente_contiene: string | null;
  asunto_contiene: string | null;
  cuerpo_contiene: string | null;
  categoria_id: string;
  categoria_clave?: string | null;
  orden: number;
  activa: boolean;
}

export type ReglaIn = Omit<ReglaFija, 'id' | 'buzon_id' | 'categoria_clave'>;

export interface AdjuntoRef {
  nombre: string;
  tipo: string;
  tamano: number;
  texto_extraido: boolean;
}

export interface Correo {
  id: string;
  buzon_id: string;
  buzon_nombre: string;
  remitente: string;
  remitente_nombre: string | null;
  asunto: string;
  recibido_en: string;
  tiene_adjuntos: boolean;
  adjuntos: AdjuntoRef[];
  resumen: string | null;
  categoria_id: string | null;
  categoria_clave: string | null;
  categoria_nombre: string | null;
  categoria_color: string | null;
  confianza: number | null;
  justificacion: string | null;
  datos_extraidos: Record<string, unknown> | null;
  estado: EstadoCorreo;
  origen: OrigenDecision | null;
  asignado_a: string | null;
  decidido_por: string | null;
  decidido_en: string | null;
  categoria_sugerida_id: string | null;
  error: string | null;
  modelo_ia: string | null;
  created_at: string;
}

export interface Ejecucion {
  id: number;
  tipo: TipoAccion | string;
  parametros: Record<string, unknown> | null;
  resultado: 'ok' | 'error' | 'simulado';
  detalle: string | null;
  ejecutado_por: string;
  ejecutado_en: string;
}

export interface CorreoDetalle extends Correo {
  ejecuciones: Ejecucion[];
  acciones_previstas: { tipo: TipoAccion; parametros: Record<string, unknown> }[];
}

export interface FiltroCorreos {
  buzon_id?: string;
  estado?: EstadoCorreo | '';
  categoria_id?: string;
  q?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}

export interface ResultadoPrueba {
  categoria_clave: string | null;
  categoria_nombre: string | null;
  confianza: number;
  resumen: string;
  justificacion: string;
  datos_extraidos: Record<string, unknown>;
  acciones_previstas: { tipo: TipoAccion; parametros: Record<string, unknown> }[];
  cumple_umbral: boolean;
}

export interface ResumenSync {
  ingresados: number;
  procesados: number;
  ejecutados: number;
  en_revision: number;
  errores: number;
  duracion_ms: number;
}

export interface Metricas {
  total: number;
  por_estado: Record<string, number>;
  por_categoria: { clave: string; nombre: string; color: string | null; total: number }[];
  precision: { decisiones_humanas: number; coincidencias: number; porcentaje: number | null };
  automatizados: number;
  tiempo_medio_decision_min: number | null;
  serie: { fecha: string; total: number; ejecutados: number; revision: number }[];
  ultimas_ejecuciones: (Ejecucion & { asunto?: string; buzon_nombre?: string })[];
}

export interface CarpetaGraph {
  id: string;
  nombre: string;
  total: number;
  no_leidos: number;
  hijas: CarpetaGraph[];
}

export interface ConexionBuzon {
  configurado: boolean;
  estado: EstadoConexion | string;
  conectada_por: string | null;
  conectada_en: string | null;
  scopes: string;
  puede_conectar: boolean;
}

// ── Catálogo de acciones (UI) ────────────────────────────────────────────────

export const TIPOS_ACCION: { tipo: TipoAccion; nombre: string; icono: string; ayuda: string }[] = [
  { tipo: 'categorizar', nombre: 'Etiquetar en Outlook', icono: 'tag', ayuda: 'Asigna una categoría de Outlook al correo.' },
  { tipo: 'mover', nombre: 'Mover a carpeta', icono: 'folder-input', ayuda: 'Mueve el correo a una carpeta del buzón (la crea si no existe).' },
  { tipo: 'reenviar', nombre: 'Reenviar a', icono: 'forward', ayuda: 'Reenvía el correo a una o varias personas con un comentario.' },
  { tipo: 'asignar_analista', nombre: 'Asignar analista', icono: 'user-check', ayuda: 'Reparte el correo entre analistas (el que menos tenga hoy) y lo mueve a su carpeta.' },
  { tipo: 'notificar_teams', nombre: 'Avisar en Teams', icono: 'bell', ayuda: 'Publica un aviso en un canal o chat de Teams.' },
  { tipo: 'marcar_leido', nombre: 'Marcar como leído', icono: 'mail-check', ayuda: 'Marca el correo como leído.' },
];

export const ESTADO_CORREO: Record<EstadoCorreo, { nombre: string; clase: string }> = {
  pendiente: { nombre: 'Pendiente', clase: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  revision: { nombre: 'Por revisar', clase: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  ejecutado: { nombre: 'Ejecutado', clase: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  ignorado: { nombre: 'Ignorado', clase: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300' },
  error: { nombre: 'Error', clase: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
};

export function nombreAccion(tipo: string): string {
  return TIPOS_ACCION.find((t) => t.tipo === tipo)?.nombre ?? tipo;
}

export function iconoAccion(tipo: string): string {
  return TIPOS_ACCION.find((t) => t.tipo === tipo)?.icono ?? 'zap';
}

/** Texto corto de una acción para chips ("Mover a 4X1000 Davivienda"). */
export function resumenAccion(a: { tipo: string; parametros: Record<string, unknown> }): string {
  const p = a.parametros ?? {};
  switch (a.tipo) {
    case 'categorizar':
      return `Etiqueta “${p['categoria'] ?? ''}”`;
    case 'mover':
      return `Mover a “${p['carpeta'] ?? ''}”`;
    case 'reenviar': {
      const d = (p['destinatarios'] as string[] | undefined) ?? [];
      return `Reenviar a ${d.length ? d.join(', ') : '…'}`;
    }
    case 'asignar_analista': {
      const an = (p['analistas'] as string[] | undefined) ?? [];
      return `Asignar analista (${an.length} en turno)`;
    }
    case 'notificar_teams':
      return 'Avisar en Teams';
    case 'marcar_leido':
      return 'Marcar como leído';
    default:
      return a.tipo;
  }
}

// ── Servicio ────────────────────────────────────────────────────────────────

const BASE = '/api/buzon-inteligente';

@Injectable({ providedIn: 'root' })
export class BuzonApi {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** true cuando alguna lectura cayó a los datos de demostración. */
  readonly modoDemo = signal(false);

  // Copia mutable de la demo para que las escrituras simuladas se vean en la sesión.
  private demo = DEMO.clonar();

  /** Un 404/503/5xx del módulo (aún no desplegado o sin configurar) ⇒ demo. */
  private esCaidaDeModulo(e: unknown): boolean {
    const msg = e instanceof Error ? e.message : String(e);
    return /HTTP (404|500|502|503|504)|no está configurado|Failed to fetch|NetworkError/i.test(msg);
  }

  private async conDemo<T>(real: () => Promise<T>, demo: () => T): Promise<T> {
    if (this.modoDemo()) return demo();
    try {
      return await real();
    } catch (e) {
      if (!this.esCaidaDeModulo(e)) throw e;
      console.warn('[buzon-inteligente] backend no disponible, usando datos de demostración:', e);
      this.modoDemo.set(true);
      return demo();
    }
  }

  // Buzones
  listarBuzones(): Promise<Buzon[]> {
    return this.conDemo(
      async () => (await this.api.fetch<{ items: Buzon[] }>(`${BASE}/buzones`)).items,
      () => this.demo.buzones,
    );
  }

  obtenerBuzon(id: string): Promise<Buzon> {
    return this.conDemo(
      () => this.api.fetch<Buzon>(`${BASE}/buzones/${id}`),
      () => {
        const b = this.demo.buzones.find((x) => x.id === id);
        if (!b) throw new Error('Buzón no encontrado.');
        return b;
      },
    );
  }

  crearBuzon(body: BuzonIn): Promise<Buzon> {
    return this.conDemo(
      () => this.api.fetch<Buzon>(`${BASE}/buzones`, { method: 'POST', body: JSON.stringify(body) }),
      () => this.demo.crearBuzon(body),
    );
  }

  actualizarBuzon(id: string, body: BuzonUpdate): Promise<Buzon> {
    return this.conDemo(
      () => this.api.fetch<Buzon>(`${BASE}/buzones/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      () => this.demo.actualizarBuzon(id, body),
    );
  }

  /** Borra la conexión y PAUSA el buzón: Alma deja de leerlo hasta reanudarlo. */
  desconectarBuzon(id: string): Promise<Buzon> {
    return this.conDemo(
      () => this.api.fetch<Buzon>(`${BASE}/buzones/${id}/desconectar`, { method: 'POST' }),
      () => this.demo.desconectarBuzon(id),
    );
  }

  /** Quita el buzón de la App con sus categorías, reglas y correos procesados. */
  eliminarBuzon(id: string): Promise<void> {
    return this.conDemo(
      () => this.api.fetch<void>(`${BASE}/buzones/${id}`, { method: 'DELETE' }),
      () => this.demo.eliminarBuzon(id),
    );
  }

  sincronizar(id: string, maxCorreos = 25): Promise<ResumenSync> {
    return this.conDemo(
      () =>
        this.api.fetch<ResumenSync>(`${BASE}/buzones/${id}/sincronizar`, {
          method: 'POST',
          body: JSON.stringify({ max_correos: maxCorreos }),
        }),
      () => this.demo.sincronizar(id),
    );
  }

  conexion(id: string): Promise<ConexionBuzon> {
    return this.conDemo(
      () => this.api.fetch<ConexionBuzon>(`${BASE}/buzones/${id}/conexion`),
      () => ({
        configurado: true,
        estado: 'sin_conectar',
        conectada_por: null,
        conectada_en: null,
        scopes: 'openid offline_access User.Read Mail.Send Mail.ReadWrite MailboxSettings.ReadWrite',
        puede_conectar: true,
      }),
    );
  }

  carpetas(id: string): Promise<CarpetaGraph[]> {
    return this.conDemo(
      async () => (await this.api.fetch<{ items: CarpetaGraph[] }>(`${BASE}/buzones/${id}/carpetas`)).items,
      () => this.demo.carpetas,
    );
  }

  /**
   * URL de autorización (OAuth delegado) para conectar el buzón con su propia
   * cuenta. Vuelve por la ruta existente /graph-callback con state
   * "b:<correo_buzon_id>|<ruta>", que ya canjea el código en el backend.
   */
  urlConectar(correoBuzonId: string, scopes: string, volverA: string): string {
    const redirect = `${window.location.origin}/graph-callback`;
    const qs = new URLSearchParams({
      client_id: environment.azure.clientId,
      response_type: 'code',
      redirect_uri: redirect,
      response_mode: 'query',
      scope: scopes,
      state: `b:${correoBuzonId}|${volverA}`,
      prompt: 'select_account',
    });
    return `https://login.microsoftonline.com/${environment.azure.tenantId}/oauth2/v2.0/authorize?${qs}`;
  }

  // Categorías
  listarCategorias(buzonId: string): Promise<Categoria[]> {
    return this.conDemo(
      async () =>
        (await this.api.fetch<{ items: Categoria[] }>(`${BASE}/buzones/${buzonId}/categorias`)).items,
      () => this.demo.categorias.filter((c) => c.buzon_id === buzonId),
    );
  }

  crearCategoria(buzonId: string, body: CategoriaIn): Promise<Categoria> {
    return this.conDemo(
      () =>
        this.api.fetch<Categoria>(`${BASE}/buzones/${buzonId}/categorias`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      () => this.demo.crearCategoria(buzonId, body),
    );
  }

  actualizarCategoria(id: string, body: CategoriaIn): Promise<Categoria> {
    return this.conDemo(
      () => this.api.fetch<Categoria>(`${BASE}/categorias/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      () => this.demo.actualizarCategoria(id, body),
    );
  }

  eliminarCategoria(id: string): Promise<void> {
    return this.conDemo(
      () => this.api.fetch<void>(`${BASE}/categorias/${id}`, { method: 'DELETE' }),
      () => this.demo.eliminarCategoria(id),
    );
  }

  // Reglas fijas
  listarReglas(buzonId: string): Promise<ReglaFija[]> {
    return this.conDemo(
      async () => (await this.api.fetch<{ items: ReglaFija[] }>(`${BASE}/buzones/${buzonId}/reglas`)).items,
      () => this.demo.reglas.filter((r) => r.buzon_id === buzonId),
    );
  }

  crearRegla(buzonId: string, body: ReglaIn): Promise<ReglaFija> {
    return this.conDemo(
      () =>
        this.api.fetch<ReglaFija>(`${BASE}/buzones/${buzonId}/reglas`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      () => this.demo.crearRegla(buzonId, body),
    );
  }

  actualizarRegla(id: string, body: ReglaIn): Promise<ReglaFija> {
    return this.conDemo(
      () => this.api.fetch<ReglaFija>(`${BASE}/reglas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      () => this.demo.actualizarRegla(id, body),
    );
  }

  eliminarRegla(id: string): Promise<void> {
    return this.conDemo(
      () => this.api.fetch<void>(`${BASE}/reglas/${id}`, { method: 'DELETE' }),
      () => this.demo.eliminarRegla(id),
    );
  }

  // Correos (bandeja)
  listarCorreos(f: FiltroCorreos): Promise<{ data: Correo[]; total: number }> {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return this.conDemo(
      () => this.api.fetch<{ data: Correo[]; total: number }>(`${BASE}/correos?${qs}`),
      () => this.demo.listarCorreos(f),
    );
  }

  obtenerCorreo(id: string): Promise<CorreoDetalle> {
    return this.conDemo(
      () => this.api.fetch<CorreoDetalle>(`${BASE}/correos/${id}`),
      () => demoCorreoDetalle(this.demo, id),
    );
  }

  /** Bytes MIME del correo (para el visor EML). En demo devuelve un .eml de ejemplo. */
  async obtenerMime(id: string): Promise<ArrayBuffer> {
    if (this.modoDemo()) return this.demo.mime(id);
    const token = await this.auth.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const base = environment.apiUrl.replace(/\/+$/, '');
    const resp = await fetch(`${base}${BASE}/correos/${encodeURIComponent(id)}/mime`, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} al descargar el correo`);
    return resp.arrayBuffer();
  }

  decidir(id: string, categoriaId: string, ejecutar: boolean, comentario?: string): Promise<Correo> {
    return this.conDemo(
      () =>
        this.api.fetch<Correo>(`${BASE}/correos/${id}/decidir`, {
          method: 'POST',
          body: JSON.stringify({ categoria_id: categoriaId, ejecutar, comentario }),
        }),
      () => this.demo.decidir(id, categoriaId, ejecutar, this.auth.user().correo),
    );
  }

  ignorar(id: string): Promise<Correo> {
    return this.conDemo(
      () => this.api.fetch<Correo>(`${BASE}/correos/${id}/ignorar`, { method: 'POST' }),
      () => this.demo.ignorar(id, this.auth.user().correo),
    );
  }

  reclasificar(id: string): Promise<Correo> {
    return this.conDemo(
      () => this.api.fetch<Correo>(`${BASE}/correos/${id}/reclasificar`, { method: 'POST' }),
      () => this.demo.reclasificar(id),
    );
  }

  probar(buzonId: string, body: { asunto: string; remitente: string; cuerpo: string; texto_adjuntos?: string }): Promise<ResultadoPrueba> {
    return this.conDemo(
      () =>
        this.api.fetch<ResultadoPrueba>(`${BASE}/buzones/${buzonId}/probar`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      () => demoProbar(this.demo, buzonId, body),
    );
  }

  metricas(buzonId?: string, dias = 30): Promise<Metricas> {
    const qs = new URLSearchParams({ dias: String(dias) });
    if (buzonId) qs.set('buzon_id', buzonId);
    return this.conDemo(
      () => this.api.fetch<Metricas>(`${BASE}/metricas?${qs}`),
      () => demoMetricas(this.demo, buzonId),
    );
  }
}
