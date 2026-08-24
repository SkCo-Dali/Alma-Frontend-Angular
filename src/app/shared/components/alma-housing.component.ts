// Marco "vivo" de la esfera para login e Inicio: el halo que respira, las
// órbitas holográficas (cada una con su copia trasera tenue y su franja frontal
// recortada, en fase), la base de anillos de luz que flota con el orbe, las
// ondas y las motas ambientales. Estilos globales en styles.css (.almah).

import { Component, computed, input } from '@angular/core';
import { AlmaSphereComponent } from './alma-sphere.component';

@Component({
  selector: 'alma-housing',
  imports: [AlmaSphereComponent],
  template: `
    <div class="almah" [style.width.px]="size()" [style.height.px]="size()">
      <div class="almah-aura"></div>

      <!-- Órbitas: detrás (completas, tenues) -->
      <span class="almah-orbit back o1"></span>
      <span class="almah-orbit back o2"></span>

      <div class="almah-pad">
        <span class="almah-ring g3"></span>
        <span class="almah-ring g2"></span>
        <span class="almah-ring g1"></span>
        <span class="almah-wave w1"></span>
        <span class="almah-wave w2"></span>
        <span class="almah-wave w3"></span>
      </div>

      <span class="almah-p p1"></span>
      <span class="almah-p p2"></span>
      <span class="almah-p p3"></span>
      <span class="almah-p p4"></span>
      <span class="almah-p p5"></span>

      <div class="almah-sphere" [style.width.px]="sphere()" [style.height.px]="sphere()">
        <alma-sphere [interactive]="interactive()" />
      </div>

      <!-- Órbitas: delante (solo la franja inferior, algo más visibles) -->
      <span class="almah-orbit front o1"></span>
      <span class="almah-orbit front o2"></span>
    </div>
  `,
})
export class AlmaHousingComponent {
  readonly size = input(240);
  readonly interactive = input(true);
  protected readonly sphere = computed(() => Math.round(this.size() * 0.64));
}
