// Editor del parámetro "enfermedades_flujo": el conjunto FIJO de condiciones
// del cuestionario médico con etiqueta legible y un check por cada una. Marcar
// una condición significa que, si el asegurado la declara en "sí", la cotización
// se enruta al flujo del suscriptor. Guarda la lista de claves (no texto libre).
// Paridad EnfermedadesEditor.tsx.

import { Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaCheckboxComponent } from '../../../shared/components/alma-checkbox.component';

// Catálogo espejo de ENFERMEDADES_CUESTIONARIO en el backend
// (app/services/motor_suscripcion.py). Debe mantenerse alineado.
const CATALOGO: { clave: string; etiqueta: string }[] = [
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

@Component({
  selector: 'alma-enfermedades-editor',
  imports: [LucideAngularModule, AlmaCheckboxComponent],
  template: `
    <div class="flex flex-col gap-2">
      <div
        class="grid grid-cols-1 gap-1.5 rounded-xl border border-border/50 bg-muted/20 p-2 sm:grid-cols-2"
      >
        @for (c of catalogo; track c.clave) {
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

  protected readonly catalogo = CATALOGO;

  protected readonly resumen = computed(() => {
    const n = this.value().length;
    if (n === 0) return 'Ninguna condición enruta a flujo suscriptor.';
    return `${n} ${n === 1 ? 'condición enruta' : 'condiciones enrutan'} al flujo del suscriptor.`;
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
        CATALOGO.filter((c) => activas.has(c.clave) || c.clave === clave).map((c) => c.clave),
      );
    } else {
      this.valueChange.emit(this.value().filter((v) => v !== clave));
    }
  }
}
