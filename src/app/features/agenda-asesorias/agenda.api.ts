// Cliente de la App «Agenda de Asesorías» — alma-backend /api/agenda/*.
// Citas de doble asesoría pensional que las personas agendan desde el sitio público
// (widget de agenda.skandia.co, reemplazo de Calendly). Aquí las ven y gestionan:
//   · Asesor:        sus citas (con datos de contacto) y las marca como atendidas.
//   · Coordinador:   todas las citas, exportar, reasignar y cancelar.
//   · Administrador: tipos de cita, asesores, turnos, ausencias y política de datos.
//
// Horas: el backend guarda UTC; los turnos, las fechas y las horas que se muestran
// están en hora de Colombia (UTC-5, sin horario de verano).

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

export const PERM_ATENDER = 'app.asesoria-agenda.atender';
export const PERM_VER = 'app.asesoria-agenda.citas.view';
export const PERM_GESTIONAR = 'app.asesoria-agenda.citas.manage';
export const PERM_CONFIG = 'app.asesoria-agenda.config.manage';

const BASE = '/api/agenda';

export type EstadoCita = 'confirmada' | 'cancelada' | 'reprogramada' | 'atendida' | 'no_asistio';

export const ESTADOS: { valor: EstadoCita; rotulo: string }[] = [
  { valor: 'confirmada', rotulo: 'Confirmada' },
  { valor: 'atendida', rotulo: 'Atendida' },
  { valor: 'no_asistio', rotulo: 'No asistió' },
  { valor: 'cancelada', rotulo: 'Cancelada' },
  { valor: 'reprogramada', rotulo: 'Reprogramada' },
];

export const REGIMENES: Record<string, string> = {
  RPM: 'Prima Media (Colpensiones)',
  RAIS: 'Ahorro Individual',
  NS: 'No está seguro',
};

/** Rótulos de las acciones del historial de una cita. */
export const ACCIONES_HISTORIAL: Record<string, string> = {
  creada: 'Creada', cancelada: 'Cancelada', reprogramada: 'Reprogramada', reasignada: 'Reasignada',
  atendida: 'Atendida', no_asistio: 'No asistió', confirmada: 'Notas', solicitud: 'Solicitud generada',
};

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export interface Cita {
  id: string;
  codigo: string;
  estado: EstadoCita;
  servicio: string;
  tipo: string;
  tipoTitulo: string;
  canal: string;
  /** AAAA-MM-DD y HH:MM, hora de Colombia. */
  fecha: string;
  hora: string;
  duracion: number;
  inicioUtc: string;
  asesorId: number;
  asesor: string;
  asesorCorreo: string;
  regimen: string | null;
  ciudad: string | null;
  origen: 'web' | 'alma';
  notas: string | null;
  /** Formulario que se abre desde la cita (p. ej. 'for-0075'), o null. */
  formulario: string | null;
  creadaUtc: string;
  datosPurgados: boolean;
  nombre?: string | null;
  tipoDoc?: string | null;
  documento?: string | null;
  celular?: string | null;
  correo?: string | null;
  comentarios?: string | null;
  /** Respuestas a las preguntas propias del servicio (edad, beneficiarios…), ya legibles. */
  respuestas?: RespuestaFormulario[];
}

export interface RespuestaFormulario {
  id: string;
  etiqueta: string;
  valor: string;
}

/** Definición del formulario de un servicio (agenda.Servicios.CamposJson). */
export interface FormularioServicio {
  documento?: { requerido?: boolean; tipos?: string[]; etiquetaTipo?: string; etiquetaNumero?: string };
  preguntas?: { id: string; etiqueta: string; tipo: string; requerido?: boolean; opciones?: string[] }[];
}

/** Texto de CamposJson → definición (o null si no hay o no se puede leer). */
export function leerFormulario(json: string | null | undefined): FormularioServicio | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as FormularioServicio;
  } catch {
    return null;
  }
}

export interface EventoHistorial {
  Fecha: string;
  Actor: string;
  Accion: string;
  Detalle: string | null;
}

export interface CitaDetalle extends Cita {
  historial: EventoHistorial[];
}

// Configuración: el backend devuelve las columnas tal cual (PascalCase).
export interface TipoCita {
  Id: number;
  ServicioId: number;
  Slug: string;
  Titulo: string;
  Resumen: string | null;
  Canal: string;
  Color: string;
  DuracionMin: number;
  BufferMin: number;
  AnticipacionMinHoras: number;
  HorizonteDias: number;
  EtiquetaCelular: string;
  AyudaCelular: string | null;
  TextoConfirmacion: string | null;
  /** HH:MM (hora de Colombia) o null = sin ventana propia. */
  VentanaInicio: string | null;
  VentanaFin: string | null;
  Formulario: string | null;
  Orden: number;
  Activo: boolean;
}

export interface Turno {
  Id?: number;
  DiaSemana: number;
  /** HH:MM:SS (hora de Colombia). */
  HoraInicio: string;
  HoraFin: string;
  VigenteDesde: string | null;
  VigenteHasta: string | null;
}

export interface Asesor {
  Id: number;
  Correo: string;
  Nombre: string;
  Activo: boolean;
  UltimaAsignacionUtc: string | null;
  /** Última lectura correcta de su Outlook (lo ocupado ahí descuenta cupos) y último error. */
  OutlookSincronizadoUtc?: string | null;
  OutlookError?: string | null;
  tipos: number[];
  turnos: Turno[];
}

export interface Ausencia {
  Id: number;
  AsesorId: number;
  InicioUtc: string;
  FinUtc: string;
  Motivo: string | null;
  CreadoPor: string | null;
}

export interface Politica {
  Version: string;
  Texto: string;
  Url: string | null;
  VigenteDesde: string;
  CreadoPor: string | null;
}

export interface Configuracion {
  servicios: { Id: number; Slug: string; Titulo: string; Activo: boolean; CamposJson: string | null }[];
  tipos: TipoCita[];
  asesores: Asesor[];
  ausencias: Ausencia[];
  politicas: Politica[];
}

export interface FiltroCitas {
  desde?: string;
  hasta?: string;
  tipo?: number | null;
  asesor?: number | null;
  estado?: EstadoCita | null;
}

export interface TurnoEntrada {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  vigente_desde?: string | null;
  vigente_hasta?: string | null;
}

// ── Utilidades de presentación ────────────────────────────────────────────────

/** Fecha UTC sin zona (como la manda el backend) → texto en hora de Colombia. */
export function fechaHoraColombia(utc: string | null | undefined): string {
  if (!utc) return '—';
  const iso = /[zZ]|[+-]\d\d:\d\d$/.test(utc) ? utc : `${utc}Z`;
  return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
}

export function fechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const s = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function horaBonita(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

export function hoyColombia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

export function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}

export function rotuloEstado(e: EstadoCita): string {
  return ESTADOS.find((x) => x.valor === e)?.rotulo ?? e;
}

export function claseEstado(e: EstadoCita): string {
  switch (e) {
    case 'confirmada':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300';
    case 'atendida':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'no_asistio':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300';
  }
}

/** Enlace para escribirle por WhatsApp (celular colombiano de 10 dígitos). */
export function enlaceWhatsapp(celular: string | null | undefined): string | null {
  return celular && /^3\d{9}$/.test(celular) ? `https://wa.me/57${celular}` : null;
}

export function celularBonito(c: string | null | undefined): string {
  return c && c.length === 10 ? `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6)}` : (c ?? '');
}

function consulta(f: FiltroCitas): string {
  const p = new URLSearchParams();
  if (f.desde) p.set('desde', f.desde);
  if (f.hasta) p.set('hasta', f.hasta);
  if (f.tipo) p.set('tipo', String(f.tipo));
  if (f.asesor) p.set('asesor', String(f.asesor));
  if (f.estado) p.set('estado', f.estado);
  const s = p.toString();
  return s ? `?${s}` : '';
}

@Injectable({ providedIn: 'root' })
export class AgendaApi {
  private readonly api = inject(ApiService);

  // Asesor
  async misCitas(desde: string, hasta: string): Promise<Cita[]> {
    return (await this.api.fetch<{ citas: Cita[] }>(`${BASE}/mis-citas${consulta({ desde, hasta })}`)).citas;
  }

  miCita(id: string): Promise<CitaDetalle> {
    return this.api.fetch<CitaDetalle>(`${BASE}/mis-citas/${encodeURIComponent(id)}`);
  }

  marcarMiCita(id: string, estado: EstadoCita | null, notas: string | null): Promise<void> {
    return this.api.fetch(`${BASE}/mis-citas/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, notas }),
    });
  }

  /** Se generó el PDF de la solicitud desde esta cita: queda en su historial. */
  solicitudGenerada(id: string): Promise<void> {
    return this.api.fetch(`${BASE}/citas/${encodeURIComponent(id)}/solicitud-generada`, { method: 'POST' });
  }

  // Coordinador
  async citas(f: FiltroCitas): Promise<Cita[]> {
    return (await this.api.fetch<{ citas: Cita[] }>(`${BASE}/citas${consulta(f)}`)).citas;
  }

  cita(id: string): Promise<CitaDetalle> {
    return this.api.fetch<CitaDetalle>(`${BASE}/citas/${encodeURIComponent(id)}`);
  }

  marcar(id: string, estado: EstadoCita | null, notas: string | null): Promise<void> {
    return this.api.fetch(`${BASE}/citas/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, notas }),
    });
  }

  cancelar(id: string, motivo: string, avisar: boolean): Promise<void> {
    return this.api.fetch(`${BASE}/citas/${encodeURIComponent(id)}/cancelar`, {
      method: 'POST',
      body: JSON.stringify({ motivo: motivo || null, avisar }),
    });
  }

  reasignar(id: string, asesorId: number): Promise<void> {
    return this.api.fetch(`${BASE}/citas/${encodeURIComponent(id)}/reasignar`, {
      method: 'POST',
      body: JSON.stringify({ asesorId }),
    });
  }

  async exportar(f: FiltroCitas): Promise<{ blob: Blob; nombre: string }> {
    const res = await this.api.fetchRaw(`${BASE}/citas/exportar${consulta(f)}`);
    if (!res.ok) throw new Error(`No se pudo exportar (HTTP ${res.status}).`);
    const nombre = /filename="?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'citas-agenda.xlsx';
    return { blob: await res.blob(), nombre };
  }

  // Configuración
  configuracion(): Promise<Configuracion> {
    return this.api.fetch<Configuracion>(`${BASE}/configuracion`);
  }

  actualizarTipo(id: number, campos: Partial<TipoCita>): Promise<void> {
    return this.api.fetch(`${BASE}/tipos/${id}`, { method: 'PATCH', body: JSON.stringify(campos) });
  }

  crearAsesor(a: { correo: string; nombre: string; activo: boolean; tipos: number[] }): Promise<{ id: number }> {
    return this.api.fetch(`${BASE}/asesores`, { method: 'POST', body: JSON.stringify(a) });
  }

  actualizarAsesor(id: number, a: { correo: string; nombre: string; activo: boolean; tipos: number[] }): Promise<void> {
    return this.api.fetch(`${BASE}/asesores/${id}`, { method: 'PUT', body: JSON.stringify(a) });
  }

  guardarTurnos(asesorId: number, turnos: TurnoEntrada[]): Promise<void> {
    return this.api.fetch(`${BASE}/asesores/${asesorId}/turnos`, { method: 'PUT', body: JSON.stringify({ turnos }) });
  }

  crearAusencia(a: { asesorId: number; desde: string; hasta: string; motivo: string | null }): Promise<{ id: number }> {
    return this.api.fetch(`${BASE}/ausencias`, { method: 'POST', body: JSON.stringify(a) });
  }

  borrarAusencia(id: number): Promise<void> {
    return this.api.fetch(`${BASE}/ausencias/${id}`, { method: 'DELETE' });
  }

  crearPolitica(p: { version: string; texto: string; url: string | null }): Promise<void> {
    return this.api.fetch(`${BASE}/politicas`, { method: 'POST', body: JSON.stringify(p) });
  }
}

/** Descarga un archivo en el navegador. */
export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
