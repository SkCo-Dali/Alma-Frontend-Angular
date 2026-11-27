// Mueve el elemento a <body> mientras existe.
//
// Por qué hace falta: los popovers del grid se posicionan con `position: fixed`
// y coordenadas de pantalla, pero si un ancestro tiene filter/backdrop-filter o
// transform (el fondo aurora y las superficies .glass del shell lo tienen), ese
// ancestro se vuelve el bloque contenedor del elemento fijo y el panel aparece
// desplazado hacia abajo. Además, dentro de un <th> se heredaba `uppercase` y el
// tracking del encabezado, así que el contenido del filtro salía en mayúsculas.
// Sacándolo a <body> desaparecen las dos cosas. (Dentro de un nova-dialog va a
// su panel; ver abajo.)

import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

@Directive({ selector: '[almaPortal]' })
export class PortalDirective implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    const el = this.host.nativeElement as HTMLElement;
    // Dentro de un <nova-dialog> el destino es su panel, no <body>: el diálogo
    // vive en <body> con z-index alto y un popover suelto quedaría DETRÁS. El
    // panel no tiene transform en reposo, así que el fixed sigue siendo
    // relativo a la pantalla.
    const dialogo = el.parentElement?.closest<HTMLElement>('[data-nova-dialog-panel]');
    (dialogo ?? document.body).appendChild(el);
  }

  ngOnDestroy(): void {
    // Si el panel tiene animate.leave, Angular le pone la clase de salida y lo
    // quita al terminar. Quitarlo aquí de inmediato cortaría la animación, así
    // que se espera un frame y, si hay animaciones en curso, a que terminen.
    // Sin animación (o con reducir movimiento) se quita en ese mismo frame.
    const el = this.host.nativeElement as HTMLElement;
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      const animaciones = el.getAnimations?.() ?? [];
      if (animaciones.length === 0) {
        el.remove();
        return;
      }
      void Promise.allSettled(animaciones.map((a) => a.finished)).then(() => el.remove());
    });
  }
}
