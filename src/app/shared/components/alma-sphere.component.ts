// Alma "viva" — implementación HÍBRIDA:
//  - El CUERPO es un asset renderizado (public/alma/alma-orb.webp: la esfera de
//    cristal sin ojos y sin fondo). El CSS no intenta pintar el vidrio.
//  - Los OJOS son HTML sobre el asset y conservan toda la interacción: siguen
//    el cursor (gaze), hacen sacadas y parpadean.
// Capas independientes: img (material) / eyes (posición base) / gaze (cursor)
// / eye (parpadeo). LLENA su contenedor. Estilos globales en styles.css (.almasph).

import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  input,
} from '@angular/core';

@Component({
  selector: 'alma-sphere',
  template: `
    <div class="almasph" #root>
      <!-- El material del cuerpo viene del asset; el CSS no lo recrea. -->
      <img
        class="almasph-orb"
        src="alma/alma-orb.webp"
        alt=""
        draggable="false"
      />
      <!-- Ojos de luz sobre el cristal: socket = posición base, gaze = cursor,
           eye = parpadeo. Cada responsabilidad en su propia capa. -->
      <div class="almasph-eyes">
        <div class="almasph-gaze" #gaze>
          <span class="almasph-socket"><span class="almasph-eye"></span></span>
          <span class="almasph-socket"><span class="almasph-eye"></span></span>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; height: 100%; }
  `,
})
export class AlmaSphereComponent implements OnInit, OnDestroy {
  readonly interactive = input(false);

  @ViewChild('root', { static: true }) private root!: ElementRef<HTMLElement>;
  @ViewChild('gaze', { static: true }) private gaze!: ElementRef<HTMLElement>;

  private readonly host = inject(ElementRef);
  private lastMove = 0;
  private saccade: ReturnType<typeof setInterval> | undefined;
  private readonly onMove = (e: MouseEvent) => {
    const el = this.root.nativeElement;
    const r = el.getBoundingClientRect();
    const size = r.width || 1;
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy) || 1;
    const max = size * 0.06;
    const k = Math.min(1, dist / size);
    this.setGaze((dx / dist) * max * k, (dy / dist) * max * 1.05 * k);
    this.lastMove = Date.now();
  };

  private setGaze(gx: number, gy: number): void {
    this.gaze.nativeElement.style.transform = `translate(${gx}px, ${gy}px)`;
  }

  ngOnInit(): void {
    if (!this.interactive()) return;
    window.addEventListener('mousemove', this.onMove);
    this.saccade = setInterval(() => {
      if (Date.now() - this.lastMove < 1600) return;
      const size = this.root.nativeElement.getBoundingClientRect().width || 160;
      const a = Math.random() * Math.PI * 2;
      const r = size * 0.05 * (0.4 + Math.random() * 0.6);
      this.setGaze(Math.cos(a) * r, Math.sin(a) * r * 0.7);
    }, 1700);
  }

  ngOnDestroy(): void {
    window.removeEventListener('mousemove', this.onMove);
    clearInterval(this.saccade);
  }
}
