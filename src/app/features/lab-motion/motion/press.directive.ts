// novaPress: feedback físico al presionar, como los botones de iOS.
// Al bajar el puntero el elemento se hunde con un spring rápido; al soltarlo
// vuelve con un leve rebote. Es interrumpible: presionar y soltar muy rápido
// no produce saltos.

import { Directive, ElementRef, inject, input } from '@angular/core';
import { animateSpring } from '../../../shared/motion/spring';
import { MotionTuningService } from './motion-tuning.service';

@Directive({
  selector: '[novaPress]',
  host: {
    '(pointerdown)': 'bajar($event)',
    '(pointerup)': 'subir()',
    '(pointerleave)': 'subir()',
    '(pointercancel)': 'subir()',
    '(keydown.space)': 'bajar()',
    '(keyup.space)': 'subir()',
  },
})
export class PressDirective {
  /** Escala al presionar. */
  readonly novaPress = input<number | ''>(0.96);

  private readonly el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private readonly tuning = inject(MotionTuningService);
  private presionado = false;

  protected bajar(e?: PointerEvent): void {
    if (e && e.button !== 0) return;
    this.presionado = true;
    const escala = this.novaPress() || 0.96;
    animateSpring(this.el, [{ transform: `scale(${escala})` }], this.tuning.spring('snappy'));
  }

  protected subir(): void {
    if (!this.presionado) return;
    this.presionado = false;
    animateSpring(this.el, [{ transform: 'scale(1)' }], this.tuning.spring('bouncy'));
  }
}
