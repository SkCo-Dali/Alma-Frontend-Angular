// Estado de Parametrización: las 8 entidades con su carga perezosa por pestaña. Como en
// el original, cada entidad se trae COMPLETA (todas las páginas) y el filtrado, orden y
// paginación son en cliente; tras cualquier mutación se recarga la entidad entera en vez
// de parchear el arreglo local.

import { Injectable, inject, signal } from '@angular/core';
import { ComisionesToast } from '../comisiones-toast.service';
import { ParametrizacionApi } from './parametrizacion.api';
import {
  AccountingRecord,
  AutonomousPatrimonyRecord,
  CarbonBondRecord,
  CommissionConfigRecord,
  CommissionTypeRecord,
  DeferredPercentageRecord,
  DeferredRecord,
  SpecialCaseRecord,
} from './parametrizacion.domain';

export type SeccionId =
  | 'contabilidad'
  | 'tiposComision'
  | 'diferidos'
  | 'diferidosParam'
  | 'configContrato'
  | 'configProducto'
  | 'ajustesComisiones'
  | 'casosEspeciales';

@Injectable()
export class ParametrizacionStore {
  private readonly api = inject(ParametrizacionApi);
  private readonly toast = inject(ComisionesToast);

  readonly accounting = signal<AccountingRecord[]>([]);
  readonly commTypes = signal<CommissionTypeRecord[]>([]);
  readonly deferred = signal<DeferredRecord[]>([]);
  readonly deferredParams = signal<DeferredPercentageRecord[]>([]);
  readonly contractConfig = signal<CarbonBondRecord[]>([]);
  readonly productConfig = signal<AutonomousPatrimonyRecord[]>([]);
  readonly commissionAdjustments = signal<CommissionConfigRecord[]>([]);
  readonly specialCases = signal<SpecialCaseRecord[]>([]);

  readonly loading = signal<Record<SeccionId, boolean>>({
    contabilidad: false,
    tiposComision: false,
    diferidos: false,
    diferidosParam: false,
    configContrato: false,
    configProducto: false,
    ajustesComisiones: false,
    casosEspeciales: false,
  });

  /** Los casos especiales muestran un aviso propio si su servicio falla. */
  readonly errorCasosEspeciales = signal<string | null>(null);

  private marcar(seccion: SeccionId, valor: boolean): void {
    this.loading.update((prev) => ({ ...prev, [seccion]: valor }));
  }

  private async cargar<T>(
    seccion: SeccionId,
    traer: () => Promise<T[]>,
    destino: { set: (v: T[]) => void },
  ): Promise<void> {
    this.marcar(seccion, true);
    try {
      destino.set(await traer());
      if (seccion === 'casosEspeciales') this.errorCasosEspeciales.set(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (seccion === 'casosEspeciales') {
        this.errorCasosEspeciales.set(msg);
      }
      this.toast.errorGenerico('fetch', msg);
    } finally {
      this.marcar(seccion, false);
    }
  }

  cargarAccounting(): Promise<void> {
    return this.cargar('contabilidad', () => this.api.listAccounting(), this.accounting);
  }

  cargarCommTypes(): Promise<void> {
    return this.cargar(
      'tiposComision',
      () => this.api.listCommissionTypes(),
      this.commTypes,
    );
  }

  cargarDiferidos(desde?: string, hasta?: string): Promise<void> {
    return this.cargar('diferidos', () => this.api.listDeferred(desde, hasta), this.deferred);
  }

  cargarDiferidosParam(): Promise<void> {
    return this.cargar(
      'diferidosParam',
      () => this.api.listDeferredParameters(),
      this.deferredParams,
    );
  }

  cargarConfigContrato(): Promise<void> {
    return this.cargar(
      'configContrato',
      () => this.api.listContractConfig(),
      this.contractConfig,
    );
  }

  cargarConfigProducto(): Promise<void> {
    return this.cargar(
      'configProducto',
      () => this.api.listProductConfig(),
      this.productConfig,
    );
  }

  cargarAjustes(): Promise<void> {
    return this.cargar(
      'ajustesComisiones',
      () => this.api.listCommissionAdjustments(),
      this.commissionAdjustments,
    );
  }

  cargarCasosEspeciales(): Promise<void> {
    return this.cargar(
      'casosEspeciales',
      () => this.api.listSpecialCases(),
      this.specialCases,
    );
  }

  /** Lo que se recarga al entrar a cada pestaña (igual que el original). */
  cargarPestana(vista: string): void {
    if (vista === 'contabilidad') {
      void this.cargarAccounting();
      void this.cargarCommTypes();
    } else if (vista === 'diferidos') {
      void this.cargarDiferidos();
      void this.cargarDiferidosParam();
    } else if (vista === 'bonos_carbono') {
      void this.cargarConfigContrato();
    } else if (vista === 'patrimonios_autonomos') {
      void this.cargarConfigProducto();
    } else if (vista === 'config_comisiones') {
      void this.cargarAjustes();
    } else if (vista === 'casos_especiales') {
      void this.cargarCasosEspeciales();
    }
  }

  // ── Mutaciones ────────────────────────────────────────────────────────────

  /** Ejecuta la mutación, avisa y recarga la entidad completa. */
  private async mutar(
    accion: () => Promise<unknown>,
    recargar: () => Promise<void>,
    okTitulo: string,
    okDescripcion: string,
    tipo: 'create' | 'update' | 'delete' | 'toggle',
  ): Promise<boolean> {
    try {
      await accion();
      this.toast.ok(okTitulo, okDescripcion);
      await recargar();
      return true;
    } catch (e) {
      if (tipo === 'create' || tipo === 'update') {
        this.toast.errorMutacion(e, tipo);
      } else {
        this.toast.errorGenerico(tipo, e instanceof Error ? e.message : String(e));
      }
      return false;
    }
  }

  crear(seccion: SeccionId, datos: Record<string, unknown>): Promise<boolean> {
    const recargar = this.recargadorDe(seccion);
    const accion = () => {
      switch (seccion) {
        case 'contabilidad':
          return this.api.createAccounting(datos as Partial<AccountingRecord>);
        case 'tiposComision':
          return this.api.createCommissionType(datos as Partial<CommissionTypeRecord>);
        case 'diferidosParam':
          return this.api.createDeferredParameter(
            datos as Partial<DeferredPercentageRecord>,
          );
        case 'configContrato':
          return this.api.createContractConfig(datos as Partial<CarbonBondRecord>);
        case 'configProducto':
          return this.api.createProductConfig(
            datos as Partial<AutonomousPatrimonyRecord>,
          );
        case 'ajustesComisiones':
          return this.api.createCommissionAdjustment(datos as unknown as CommissionConfigRecord);
        case 'casosEspeciales':
          return this.api.createSpecialCase(datos as Partial<SpecialCaseRecord>);
        default:
          return Promise.reject(new Error('Esta sección es de solo lectura'));
      }
    };
    return this.mutar(
      accion,
      recargar,
      'Registro creado',
      'El registro se creó correctamente.',
      'create',
    );
  }

  actualizar(
    seccion: SeccionId,
    id: string,
    datos: Record<string, unknown>,
  ): Promise<boolean> {
    const recargar = this.recargadorDe(seccion);
    const accion = () => {
      switch (seccion) {
        case 'contabilidad':
          return this.api.updateAccounting(id, datos as Partial<AccountingRecord>);
        case 'tiposComision':
          return this.api.updateCommissionType(id, datos as Partial<CommissionTypeRecord>);
        case 'diferidosParam':
          return this.api.updateDeferredParameter(
            id,
            datos as Partial<DeferredPercentageRecord>,
          );
        case 'configContrato':
          return this.api.updateContractConfig(id, datos as Partial<CarbonBondRecord>);
        case 'configProducto':
          return this.api.updateProductConfig(
            id,
            datos as Partial<AutonomousPatrimonyRecord>,
          );
        case 'ajustesComisiones':
          return this.api.updateCommissionAdjustment(id, datos as unknown as CommissionConfigRecord);
        case 'casosEspeciales':
          return this.api.updateSpecialCase(id, datos as Partial<SpecialCaseRecord>);
        default:
          return Promise.reject(new Error('Esta sección es de solo lectura'));
      }
    };
    return this.mutar(
      accion,
      recargar,
      'Registro actualizado',
      'El registro se actualizó correctamente.',
      'update',
    );
  }

  eliminar(seccion: SeccionId, id: string): Promise<boolean> {
    const recargar = this.recargadorDe(seccion);
    const accion = () => {
      switch (seccion) {
        case 'contabilidad':
          return this.api.deleteAccounting(id);
        case 'tiposComision':
          return this.api.deleteCommissionType(id);
        case 'diferidosParam':
          return this.api.deleteDeferredParameter(id);
        case 'configContrato':
          return this.api.deleteContractConfig(id);
        case 'configProducto':
          return this.api.deleteProductConfig(id);
        case 'ajustesComisiones':
          return this.api.deleteCommissionAdjustment(id);
        case 'casosEspeciales':
          return this.api.deleteSpecialCase(id);
        default:
          return Promise.reject(new Error('Esta sección es de solo lectura'));
      }
    };
    return this.mutar(
      accion,
      recargar,
      'Registro eliminado',
      'El registro se eliminó correctamente.',
      'delete',
    );
  }

  alternar(seccion: SeccionId, id: string, activo: boolean): Promise<boolean> {
    const recargar = this.recargadorDe(seccion);
    const accion = () => {
      switch (seccion) {
        case 'contabilidad':
          return this.api.toggleAccounting(id, activo);
        case 'tiposComision':
          return this.api.toggleCommissionType(id, activo);
        case 'diferidosParam':
          return this.api.toggleDeferredParameter(id, activo);
        case 'configContrato':
          return this.api.toggleContractConfig(id, activo);
        case 'configProducto':
          return this.api.toggleProductConfig(id, activo);
        case 'ajustesComisiones':
          return this.api.toggleCommissionAdjustment(id, activo);
        case 'casosEspeciales':
          return this.api.toggleSpecialCase(id, activo);
        default:
          return Promise.reject(new Error('Esta sección es de solo lectura'));
      }
    };
    return this.mutar(
      accion,
      recargar,
      activo ? 'Registro activado' : 'Registro desactivado',
      `El registro quedó ${activo ? 'activo' : 'inactivo'}.`,
      'toggle',
    );
  }

  private recargadorDe(seccion: SeccionId): () => Promise<void> {
    switch (seccion) {
      case 'contabilidad':
        return () => this.cargarAccounting();
      case 'tiposComision':
        return () => this.cargarCommTypes();
      case 'diferidos':
        return () => this.cargarDiferidos();
      case 'diferidosParam':
        return () => this.cargarDiferidosParam();
      case 'configContrato':
        return () => this.cargarConfigContrato();
      case 'configProducto':
        return () => this.cargarConfigProducto();
      case 'ajustesComisiones':
        return () => this.cargarAjustes();
      case 'casosEspeciales':
        return () => this.cargarCasosEspeciales();
    }
  }

  datos(seccion: SeccionId): Record<string, unknown>[] {
    switch (seccion) {
      case 'contabilidad':
        return this.accounting() as unknown as Record<string, unknown>[];
      case 'tiposComision':
        return this.commTypes() as unknown as Record<string, unknown>[];
      case 'diferidos':
        return this.deferred() as unknown as Record<string, unknown>[];
      case 'diferidosParam':
        return this.deferredParams() as unknown as Record<string, unknown>[];
      case 'configContrato':
        return this.contractConfig() as unknown as Record<string, unknown>[];
      case 'configProducto':
        return this.productConfig() as unknown as Record<string, unknown>[];
      case 'ajustesComisiones':
        return this.commissionAdjustments() as unknown as Record<string, unknown>[];
      case 'casosEspeciales':
        return this.specialCases() as unknown as Record<string, unknown>[];
    }
  }
}
