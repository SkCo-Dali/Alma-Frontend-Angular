// Cliente del módulo Cheques (alma-backend /api/cheques/*).

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

export type EstadoCheque = 'emitido' | 'entregado' | 'devuelto' | 'anulado';

export interface Cheque {
  id: string;
  fecha: string; // YYYY-MM-DD
  contrato: string;
  cuenta?: string | null;
  documento_titular: string;
  titular: string;
  documento_beneficiario?: string | null;
  beneficiario?: string | null;
  valor: number;
  fondo: string;
  ciudad?: string | null;
  oficina?: string | null;
  persona_autorizada?: string | null;
  tipo_retiro?: string | null;
  estado: EstadoCheque;
  created_at?: string | null;
  created_by?: string | null;
}

export type ChequeInput = Omit<Cheque, 'id' | 'created_at' | 'created_by'>;

export const ESTADOS: EstadoCheque[] = ['emitido', 'entregado', 'devuelto', 'anulado'];

export const FONDOS = ['FPOB', 'FVOL', 'Cesantías', 'Pensión Voluntaria', 'Otro'];

export const TIPOS_RETIRO = ['Parcial', 'Total', 'Express', 'Otro'];

export function chequeVacio(): ChequeInput {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    contrato: '',
    cuenta: '',
    documento_titular: '',
    titular: '',
    documento_beneficiario: '',
    beneficiario: '',
    valor: 0,
    fondo: 'FPOB',
    ciudad: '',
    oficina: '',
    persona_autorizada: '',
    tipo_retiro: 'Parcial',
    estado: 'emitido',
  };
}

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function formatoValor(v: number): string {
  return COP.format(v);
}

export const ESTADO_COLOR: Record<EstadoCheque, string> = {
  emitido: 'bg-primary/10 text-primary',
  entregado: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  devuelto: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  anulado: 'bg-muted text-muted-foreground',
};

@Injectable({ providedIn: 'root' })
export class ChequesApi {
  private readonly api = inject(ApiService);

  listar(texto?: string): Promise<Cheque[]> {
    const qs = texto ? `?texto=${encodeURIComponent(texto)}` : '';
    return this.api.fetch<Cheque[]>(`/api/cheques${qs}`);
  }

  crear(data: ChequeInput): Promise<Cheque> {
    return this.api.fetch<Cheque>('/api/cheques', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  actualizar(id: string, data: ChequeInput): Promise<Cheque> {
    return this.api.fetch<Cheque>(`/api/cheques/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async eliminar(id: string): Promise<void> {
    await this.api.fetch(`/api/cheques/${id}`, { method: 'DELETE' });
  }
}
