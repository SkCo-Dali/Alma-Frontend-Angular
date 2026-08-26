// Bandeja de Cheques: listado con búsqueda + CRUD con formulario modal. El estado va
// en signals, con recarga manual tras cada mutación.

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  SkButtonComponent,
  SkDropdownComponent,
  SkInputComponent,
  SkTagComponent,
} from '@skandia/ui';
import {
  Cheque,
  ChequeInput,
  ChequesApi,
  ESTADOS,
  ESTADO_SEVERITY,
  FONDOS,
  TIPOS_RETIRO,
  chequeVacio,
  formatoValor,
} from './cheques.api';

@Component({
  selector: 'alma-bandeja-cheques',
  imports: [
    FormsModule,
    LucideAngularModule,
    SkButtonComponent,
    SkTagComponent,
    SkInputComponent,
    SkDropdownComponent,
  ],
  template: `
    <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <!-- Encabezado -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-sm font-semibold text-foreground">Cheques emitidos</h1>
          <p class="text-xs text-muted-foreground">
            Base de cheques de Servicio al Cliente. Alimenta al Agente Alma.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <sk-input
            class="w-72"
            iconLeft="search"
            [(ngModel)]="busqueda"
            (keydown.enter)="buscar()"
            placeholder="Buscar por contrato, cuenta, documento o nombre…"
          />
          <sk-button
            variant="secondary"
            type="button"
            label="Buscar"
            (clicked)="buscar()"
          />
          <sk-button
            variant="primary"
            type="button"
            label="Nuevo cheque"
            (clicked)="abrirNuevo()"
          />
        </div>
      </div>

      <!-- Tabla -->
      @if (cargando()) {
        <div class="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <lucide-icon name="loader-2" [size]="16" class="animate-spin" /> Cargando cheques…
        </div>
      } @else if (error(); as err) {
        <p class="py-10 text-sm text-destructive">Error cargando cheques: {{ err }}</p>
      } @else if (cheques().length === 0) {
        <p class="py-10 text-center text-sm text-muted-foreground">
          No hay cheques registrados. Crea el primero con “Nuevo cheque”.
        </p>
      } @else {
        <div class="overflow-x-auto">
          <table class="alma-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Contrato</th>
                <th>Titular</th>
                <th>Documento</th>
                <th class="text-right">Valor</th>
                <th>Fondo</th>
                <th>Estado</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (c of cheques(); track c.id) {
                <tr>
                  <td class="whitespace-nowrap">{{ c.fecha }}</td>
                  <td class="font-medium">{{ c.contrato }}</td>
                  <td>{{ c.titular }}</td>
                  <td>{{ c.documento_titular }}</td>
                  <td class="whitespace-nowrap text-right tabular-nums">
                    {{ valor(c.valor) }}
                  </td>
                  <td>{{ c.fondo }}</td>
                  <td>
                    <sk-tag [value]="c.estado" [severity]="estadoSeverity[c.estado]" />
                  </td>
                  <td class="text-right">
                    <div class="flex justify-end gap-1">
                      <sk-button
                        variant="tertiary"
                        type="button"
                        iconOnly
                        icon="pencil"
                        ariaLabel="Editar"
                        (clicked)="abrirEdicion(c)"
                      />
                      <sk-button
                        variant="tertiary"
                        severity="danger"
                        type="button"
                        iconOnly
                        icon="trash"
                        ariaLabel="Eliminar"
                        [disabled]="eliminando()"
                        (clicked)="eliminar(c)"
                      />
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Formulario modal -->
      @if (formAbierto()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            class="surface-solid max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border p-5 shadow-[var(--shadow-lg)]"
          >
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-foreground">
                {{ editando() ? 'Editar cheque' : 'Nuevo cheque' }}
              </h2>
              <sk-button
                variant="tertiary"
                type="button"
                iconOnly
                icon="times"
                ariaLabel="Cerrar"
                (clicked)="cerrarForm()"
              />
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <sk-input type="date" label="Fecha *" [(ngModel)]="form.fecha" />
              <sk-input type="number" label="Valor *" [(ngModel)]="form.valor" />
              <sk-input label="Contrato *" [(ngModel)]="form.contrato" />
              <sk-input label="Cuenta" [(ngModel)]="form.cuenta" />
              <sk-input label="Documento titular *" [(ngModel)]="form.documento_titular" />
              <sk-input label="Titular *" [(ngModel)]="form.titular" />
              <sk-input
                label="Documento beneficiario"
                [(ngModel)]="form.documento_beneficiario"
              />
              <sk-input label="Beneficiario" [(ngModel)]="form.beneficiario" />
              <sk-dropdown label="Fondo *" [options]="fondoOptions" [(ngModel)]="form.fondo" />
              <sk-dropdown
                label="Tipo de retiro"
                [options]="tipoRetiroOptions"
                [(ngModel)]="form.tipo_retiro"
              />
              <sk-input label="Ciudad" [(ngModel)]="form.ciudad" />
              <sk-input label="Oficina" [(ngModel)]="form.oficina" />
              <sk-input label="Persona autorizada" [(ngModel)]="form.persona_autorizada" />
              <sk-dropdown label="Estado" [options]="estadoOptions" [(ngModel)]="form.estado" />
            </div>

            @if (errorGuardado(); as err) {
              <p class="mt-3 text-xs text-destructive">{{ err }}</p>
            }

            <div class="mt-5 flex justify-end gap-2">
              <sk-button
                variant="secondary"
                type="button"
                label="Cancelar"
                (clicked)="cerrarForm()"
              />
              <sk-button
                variant="primary"
                type="button"
                label="Guardar"
                [loading]="guardando()"
                [disabled]="!valido() || guardando()"
                (clicked)="guardar()"
              />
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class BandejaChequesComponent {
  private readonly api = inject(ChequesApi);

  protected readonly estadoSeverity = ESTADO_SEVERITY;
  protected readonly valor = formatoValor;

  protected readonly estadoOptions = ESTADOS.map((s) => ({ label: s, value: s }));
  protected readonly fondoOptions = FONDOS.map((f) => ({ label: f, value: f }));
  protected readonly tipoRetiroOptions = TIPOS_RETIRO.map((t) => ({ label: t, value: t }));

  protected busqueda = '';
  private aplicada = '';

  protected readonly cheques = signal<Cheque[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly eliminando = signal(false);

  protected readonly formAbierto = signal(false);
  protected readonly editando = signal<Cheque | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorGuardado = signal<string | null>(null);
  protected form: ChequeInput = chequeVacio();

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.cheques.set(await this.api.listar(this.aplicada || undefined));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected buscar(): void {
    this.aplicada = this.busqueda.trim();
    void this.cargar();
  }

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.form = chequeVacio();
    this.errorGuardado.set(null);
    this.formAbierto.set(true);
  }

  protected abrirEdicion(c: Cheque): void {
    this.editando.set(c);
    this.form = {
      fecha: c.fecha,
      contrato: c.contrato,
      cuenta: c.cuenta ?? '',
      documento_titular: c.documento_titular,
      titular: c.titular,
      documento_beneficiario: c.documento_beneficiario ?? '',
      beneficiario: c.beneficiario ?? '',
      valor: c.valor,
      fondo: c.fondo,
      ciudad: c.ciudad ?? '',
      oficina: c.oficina ?? '',
      persona_autorizada: c.persona_autorizada ?? '',
      tipo_retiro: c.tipo_retiro ?? '',
      estado: c.estado,
    };
    this.errorGuardado.set(null);
    this.formAbierto.set(true);
  }

  protected cerrarForm(): void {
    this.formAbierto.set(false);
    this.editando.set(null);
  }

  protected valido(): boolean {
    const f = this.form;
    return Boolean(f.contrato && f.titular && f.documento_titular && f.fondo && f.fecha);
  }

  protected async guardar(): Promise<void> {
    this.guardando.set(true);
    this.errorGuardado.set(null);
    try {
      const actual = this.editando();
      if (actual) {
        await this.api.actualizar(actual.id, { ...this.form, valor: Number(this.form.valor) });
      } else {
        await this.api.crear({ ...this.form, valor: Number(this.form.valor) });
      }
      this.cerrarForm();
      await this.cargar();
    } catch (e) {
      this.errorGuardado.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async eliminar(c: Cheque): Promise<void> {
    if (!confirm(`¿Eliminar el cheque del contrato ${c.contrato}?`)) return;
    this.eliminando.set(true);
    try {
      await this.api.eliminar(c.id);
      await this.cargar();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.eliminando.set(false);
    }
  }
}
