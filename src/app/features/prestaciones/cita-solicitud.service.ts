// Puente entre la Bandeja de asesorías y el formulario de Solicitudes dentro de la App
// «Prestaciones»: el asesor abre la solicitud desde una cita y el formulario llega con el
// documento puesto (y busca solo), el celular y el correo como sugerencias.
//
// Los datos viajan en memoria, nunca por la URL (las cédulas no deben quedar en logs ni en
// el historial del navegador) y se olvidan al empezar otra solicitud.

import { Injectable, signal } from '@angular/core';

export interface CitaParaSolicitud {
  citaId: string;
  codigo: string;
  tipoTitulo: string;
  /** Ya en el vocabulario del formulario: CC, CE, Pasaporte. */
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string | null;
  celular: string | null;
  correo: string | null;
}

/** Tipo de documento de la agenda (CC, CE, PA) → el del formulario FOR-0075. */
export function tipoDocumentoFormulario(tipo: string | null | undefined): string {
  return tipo === 'PA' ? 'Pasaporte' : (tipo ?? 'CC');
}

@Injectable({ providedIn: 'root' })
export class CitaSolicitudService {
  /** Cita que el formulario debe tomar al abrirse (se consume una vez). */
  readonly pendiente = signal<CitaParaSolicitud | null>(null);
  /** Cita de la solicitud que está en pantalla (para el aviso y para marcarla al generar el PDF). */
  readonly activa = signal<CitaParaSolicitud | null>(null);

  iniciar(c: CitaParaSolicitud): void {
    this.pendiente.set(c);
  }

  /** El formulario la toma: deja de estar pendiente y pasa a ser la activa. */
  tomar(): CitaParaSolicitud | null {
    const c = this.pendiente();
    this.pendiente.set(null);
    if (c) this.activa.set(c);
    return c;
  }

  soltar(): void {
    this.activa.set(null);
  }
}
