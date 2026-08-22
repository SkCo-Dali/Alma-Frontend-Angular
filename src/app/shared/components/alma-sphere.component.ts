// Alma "viva": esfera de colores en movimiento caótico (blobs blur + screen)
// con ojos que parpadean. LLENA su contenedor. Con `interactive` los ojos
// siguen el cursor y miran alrededor. Estilos globales en styles.css (.almasph).

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
      <div class="almasph-core">
        <div class="almasph-field">
          <span class="b b1"></span>
          <span class="b b2"></span>
          <span class="b b3"></span>
          <span class="b b4"></span>
          <span class="b b5"></span>
        </div>
        <div class="almasph-gloss"></div>
        <div class="almasph-eyes">
          <div class="almasph-gaze" #gaze>
            <span class="almasph-eye"></span>
            <span class="almasph-eye"></span>
          </div>
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
    const max = size * 0.1;
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
      const r = size * 0.09 * (0.4 + Math.random() * 0.6);
      this.setGaze(Math.cos(a) * r, Math.sin(a) * r * 0.7);
    }, 1700);
  }

  ngOnDestroy(): void {
    window.removeEventListener('mousemove', this.onMove);
    clearInterval(this.saccade);
  }
}
