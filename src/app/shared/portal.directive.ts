// Mueve el elemento a <body> mientras existe.
//
// Por qué hace falta: los popovers del grid se posicionan con `position: fixed`
// y coordenadas de pantalla, pero si un ancestro tiene filter/backdrop-filter o
// transform (el fondo aurora y las superficies .glass del shell lo tienen), ese
// ancestro se vuelve el bloque contenedor del elemento fijo y el panel aparece
// desplazado hacia abajo. Además, dentro de un <th> se heredaba `uppercase` y el
// tracking del encabezado, así que el contenido del filtro salía en mayúsculas.
// Sacándolo a <body> desaparecen las dos cosas.

import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

@Directive({ selector: '[almaPortal]' })
export class PortalDirective implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    document.body.appendChild(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.host.nativeElement.remove();
  }
}
