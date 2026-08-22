// Estado compartido de catálogos (port de useCatalogs + useCatalogFields).
// Es root-provided y con caché porque los editores de reglas lo abren muchas
// veces en la misma sesión: los campos y los valores de un campo solo se piden
// una vez, y las mutaciones del módulo Catálogos invalidan lo que corresponde.

import { Injectable, computed, inject, signal } from '@angular/core';
import { ComisionesToast } from '../comisiones-toast.service';
import {
  Catalog,
  CatalogField,
  CatalogFieldValue,
  CatalogsApi,
  CreateCatalogFieldRequest,
  CreateCatalogRequest,
  UpdateCatalogFieldRequest,
  UpdateCatalogRequest,
} from './catalogs.api';

const PAGE_SIZE = 100;

@Injectable({ providedIn: 'root' })
export class CatalogsStore {
  private readonly api = inject(CatalogsApi);
  private readonly toast = inject(ComisionesToast);

  readonly catalogs = signal<Catalog[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly activos = computed(() => this.catalogs().filter((c) => c.is_active));

  /** Campos por catálogo y valores por `${catalogId}-${fieldId}`. */
  private readonly fields = signal<Record<string, CatalogField[]>>({});
  private readonly fieldValues = signal<Record<string, CatalogFieldValue[]>>({});
  readonly loadingFields = signal(false);
  private readonly enVuelo = new Set<string>();

  private cargado = false;

  /** Carga la lista una vez; `forzar` la vuelve a pedir tras una mutación. */
  async cargar(forzar = false): Promise<void> {
    if (this.cargado && !forzar) return;
    try {
      this.loading.set(true);
      this.error.set(null);
      const res = await this.api.list({
        page: 1,
        page_size: PAGE_SIZE,
        order_by: 'name',
        order_dir: 'asc',
      });
      this.catalogs.set(res.items);
      this.cargado = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error cargando catálogos';
      this.error.set(msg);
      this.toast.errorGenerico('fetch', msg);
    } finally {
      this.loading.set(false);
    }
  }

  camposDe(catalogId: string): CatalogField[] {
    return this.fields()[catalogId] ?? [];
  }

  async cargarCampos(catalogId: string, forzar = false): Promise<void> {
    if (!catalogId) return;
    if (!forzar && (this.fields()[catalogId] || this.enVuelo.has(catalogId))) return;
    this.enVuelo.add(catalogId);
    try {
      this.loadingFields.set(true);
      const res = await this.api.listFields(catalogId, {
        page: 1,
        page_size: PAGE_SIZE,
        order_by: 'field_name',
        order_dir: 'asc',
      });
      this.fields.update((prev) => ({ ...prev, [catalogId]: res.items }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error cargando campos';
      this.toast.errorGenerico('fetch', msg);
    } finally {
      this.loadingFields.set(false);
      this.enVuelo.delete(catalogId);
    }
  }

  valoresDe(catalogId: string, fieldId: string | undefined): CatalogFieldValue[] {
    if (!fieldId) return [];
    return this.fieldValues()[`${catalogId}-${fieldId}`] ?? [];
  }

  async cargarValores(catalogId: string, fieldId: string): Promise<void> {
    const key = `${catalogId}-${fieldId}`;
    if (this.fieldValues()[key] || this.enVuelo.has(key)) return;
    this.enVuelo.add(key);
    try {
      const res = await this.api.listFieldValues(catalogId, fieldId, {
        is_active: true,
        page: 1,
        page_size: PAGE_SIZE,
        order_by: 'sort_index',
        order_dir: 'asc',
      });
      this.fieldValues.update((prev) => ({ ...prev, [key]: res.items }));
    } catch (e) {
      console.error('Error cargando los valores del campo:', e);
    } finally {
      this.enVuelo.delete(key);
    }
  }

  // ── Mutaciones de catálogos ───────────────────────────────────────────────

  async crear(data: CreateCatalogRequest): Promise<Catalog | null> {
    try {
      const nuevo = await this.api.create(data);
      this.catalogs.update((prev) => [...prev, nuevo]);
      this.toast.ok('Catálogo creado', 'El catálogo se creó correctamente.');
      return nuevo;
    } catch (e) {
      this.toast.errorMutacion(e, 'create');
      return null;
    }
  }

  async actualizar(catalogId: string, data: UpdateCatalogRequest): Promise<boolean> {
    try {
      const actualizado = await this.api.update(catalogId, data);
      this.catalogs.update((prev) =>
        prev.map((c) => (c.id === catalogId ? actualizado : c)),
      );
      this.toast.ok('Catálogo actualizado', 'El catálogo se actualizó.');
      return true;
    } catch (e) {
      this.toast.errorMutacion(e, 'update');
      return false;
    }
  }

  async eliminar(catalogId: string): Promise<boolean> {
    try {
      await this.api.remove(catalogId);
      this.catalogs.update((prev) => prev.filter((c) => c.id !== catalogId));
      this.fields.update((prev) => {
        const next = { ...prev };
        delete next[catalogId];
        return next;
      });
      this.toast.ok('Catálogo eliminado', 'El catálogo se eliminó.');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.toast.errorGenerico('delete', msg);
      return false;
    }
  }

  async alternarEstado(catalogId: string, activar: boolean): Promise<boolean> {
    try {
      const actualizado = activar
        ? await this.api.activate(catalogId)
        : await this.api.deactivate(catalogId);
      this.catalogs.update((prev) =>
        prev.map((c) => (c.id === catalogId ? actualizado : c)),
      );
      this.toast.ok(
        activar ? 'Catálogo activado' : 'Catálogo desactivado',
        `El catálogo quedó ${activar ? 'activo' : 'inactivo'}.`,
      );
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.toast.errorGenerico('toggle', msg);
      return false;
    }
  }

  // ── Mutaciones de campos ──────────────────────────────────────────────────

  async crearCampo(
    catalogId: string,
    data: CreateCatalogFieldRequest,
  ): Promise<CatalogField | null> {
    try {
      const nuevo = await this.api.createField(catalogId, data);
      this.fields.update((prev) => ({
        ...prev,
        [catalogId]: [...(prev[catalogId] ?? []), nuevo],
      }));
      this.toast.ok('Campo creado', 'El campo se creó correctamente.');
      return nuevo;
    } catch (e) {
      this.toast.errorMutacion(e, 'create');
      return null;
    }
  }

  async actualizarCampo(
    catalogId: string,
    fieldId: string,
    data: UpdateCatalogFieldRequest,
  ): Promise<boolean> {
    try {
      const actualizado = await this.api.updateField(catalogId, fieldId, data);
      this.fields.update((prev) => ({
        ...prev,
        [catalogId]: (prev[catalogId] ?? []).map((f) =>
          f.id === fieldId ? actualizado : f,
        ),
      }));
      this.toast.ok('Campo actualizado', 'El campo se actualizó.');
      return true;
    } catch (e) {
      this.toast.errorMutacion(e, 'update');
      return false;
    }
  }

  async eliminarCampo(catalogId: string, fieldId: string): Promise<boolean> {
    try {
      await this.api.removeField(catalogId, fieldId);
      this.fields.update((prev) => ({
        ...prev,
        [catalogId]: (prev[catalogId] ?? []).filter((f) => f.id !== fieldId),
      }));
      this.toast.ok('Campo eliminado', 'El campo se eliminó.');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.toast.errorGenerico('delete', msg);
      return false;
    }
  }
}
