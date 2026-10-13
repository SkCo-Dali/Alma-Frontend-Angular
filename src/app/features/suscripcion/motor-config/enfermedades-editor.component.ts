// Editor de los parámetros "enfermedades_flujo" y "preguntas_declaracion_flujo": un
// conjunto FIJO de opciones con etiqueta legible y un check por cada una. Marcar una
// opción significa que, si el asegurado la declara en "sí", la cotización se enruta al
// flujo del suscriptor. Guarda la lista de claves (no texto libre).

import { Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaCheckboxComponent } from '../../../shared/components/alma-checkbox.component';

// Catálogo espejo de ENFERMEDADES_CUESTIONARIO en el backend
// (app/services/motor_suscripcion.py). Debe mantenerse alineado.
export interface OpcionFlujo {
  clave: string;
  etiqueta: string;
}

const CATALOGO: OpcionFlujo[] = [
  { clave: 'cardiovascular', etiqueta: 'Enfermedad cardiovascular' },
  { clave: 'diabetes', etiqueta: 'Diabetes mellitus' },
  { clave: 'oncologico', etiqueta: 'Antecedente oncológico' },
  { clave: 'pulmonar', etiqueta: 'Enfermedad pulmonar' },
  { clave: 'neurologico', etiqueta: 'Enfermedad neurológica' },
  { clave: 'cirugia', etiqueta: 'Cirugía reciente' },
  { clave: 'tabaco', etiqueta: 'Consumo de tabaco' },
  { clave: 'alcohol', etiqueta: 'Alcohol / sustancias' },
  { clave: 'discapacidad', etiqueta: 'Discapacidad certificada' },
  { clave: 'medicacion', etiqueta: 'Medicación permanente' },
];

// Preguntas del cuestionario de salud de Pharos, espejo de PREGUNTAS_DECLARACION en el
// backend (app/services/motor_suscripcion.py). Debe mantenerse alineado. La pregunta 11
// tiene dos códigos (dos versiones del formulario).
export const PREGUNTAS_DECLARACION: OpcionFlujo[] = [
  { clave: '400041', etiqueta: '4. Enfermedad física o mental / hospitalización' },
  { clave: '400170', etiqueta: '5a. Corazón / hipertensión' },
  { clave: '400172', etiqueta: '5b. Cáncer, tumor o enfermedad sanguínea' },
  { clave: '400174', etiqueta: '5c. Hígado, digestivo, riñones o urológico' },
  { clave: '400176', etiqueta: '5d. Diabetes, colesterol, tiroides o respiratoria' },
  { clave: '400178', etiqueta: '5e. Sistema nervioso' },
  { clave: '400180', etiqueta: '5f. Trastorno mental o adicciones' },
  { clave: '400182', etiqueta: '5g. Otra enfermedad no mencionada' },
  { clave: '400122', etiqueta: '6. VIH / ETS' },
  { clave: '400060', etiqueta: '7. Tratamiento médico actual o cirugía programada' },
  { clave: '500070', etiqueta: '8. Seguro de vida individual solicitado antes' },
  { clave: '500100', etiqueta: '9. Tratamiento por alcohol o drogas' },
  { clave: '400096', etiqueta: '10. Fuma' },
  { clave: '400092', etiqueta: '11. Actividad de riesgo' },
  { clave: '400250', etiqueta: '11. Actividad de riesgo (formulario nuevo)' },
  { clave: '400150', etiqueta: '12. Antecedentes familiares' },
  { clave: '400152', etiqueta: '13. Otros factores no revelados' },
];

@Component({
  selector: 'alma-enfermedades-editor',
  imports: [LucideAngularModule, AlmaCheckboxComponent],
  template: `
    <div class="flex flex-col gap-2">
      <div
        class="grid grid-cols-1 gap-1.5 rounded-xl border border-border/50 bg-muted/20 p-2 sm:grid-cols-2"
      >
        @for (c of opciones(); track c.clave) {
          <label
            class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors"
            [class]="
              activa(c.clave)
                ? 'bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:bg-muted/50'
            "
          >
            <alma-checkbox
              [checked]="activa(c.clave)"
              (checkedChange)="toggle(c.clave, $event)"
            />
            <lucide-icon
              name="heart-pulse"
              [size]="14"
              class="shrink-0"
              [class]="activa(c.clave) ? 'text-primary' : 'text-muted-foreground/60'"
            />
            <span class="min-w-0 flex-1">{{ c.etiqueta }}</span>
          </label>
        }
      </div>
      <p class="text-[11px] text-muted-foreground">
        {{ resumen() }}
      </p>
    </div>
  `,
})
export class EnfermedadesEditorComponent {
  readonly value = input.required<string[]>();
  readonly valueChange = output<string[]>();
  /** Opciones fijas; por defecto las condiciones del cuestionario médico. */
  readonly opciones = input<OpcionFlujo[]>(CATALOGO);
  /** Sustantivo en singular y plural para el resumen. */
  readonly nombres = input<[string, string]>(['condición', 'condiciones']);

  protected readonly resumen = computed(() => {
    const n = this.value().length;
    const [uno, varios] = this.nombres();
    if (n === 0) return `Ninguna ${uno} enruta a flujo suscriptor.`;
    return `${n} ${n === 1 ? `${uno} enruta` : `${varios} enrutan`} al flujo del suscriptor.`;
  });

  protected activa(clave: string): boolean {
    return this.value().includes(clave);
  }

  protected toggle(clave: string, checked: boolean): void {
    const activas = new Set(this.value());
    if (checked) {
      if (activas.has(clave)) return;
      // Conserva el orden del catálogo para un diff estable.
      this.valueChange.emit(
        this.opciones()
          .filter((c) => activas.has(c.clave) || c.clave === clave)
          .map((c) => c.clave),
      );
    } else {
      this.valueChange.emit(this.value().filter((v) => v !== clave));
    }
  }
}
