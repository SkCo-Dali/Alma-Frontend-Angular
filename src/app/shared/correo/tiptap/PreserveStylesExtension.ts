import { Extension, Node, mergeAttributes } from '@tiptap/core';
import Link from '@tiptap/extension-link';

// Extensión para manejar elementos <a> (links) preservando atributos completos.
// TipTap Link (mark) por defecto NO guarda atributos como `style`/`class`, lo que rompe CTAs tipo botón.
export const LinkWithStyles = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => (attributes['style'] ? { style: attributes['style'] } : {}),
      },
      class: {
        default: null,
        parseHTML: element => element.getAttribute('class'),
        renderHTML: attributes => (attributes['class'] ? { class: attributes['class'] } : {}),
      },
      title: {
        default: null,
        parseHTML: element => element.getAttribute('title'),
        renderHTML: attributes => (attributes['title'] ? { title: attributes['title'] } : {}),
      },
    };
  },
});

// Extensión para manejar elementos span con estilos
export const SpanWithStyles = Node.create({
  name: 'styledSpan',
  
  group: 'inline',
  
  inline: true,
  
  content: 'inline*',
  
  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes['style']) return {};
          return { style: attributes['style'] };
        },
      },
      class: {
        default: null,
        parseHTML: element => element.getAttribute('class'),
        renderHTML: attributes => {
          if (!attributes['class']) return {};
          return { class: attributes['class'] };
        },
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'span[style]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

// Extensión para preservar estilos inline y atributos HTML en elementos
// Esto es crucial para mantener el formato de plantillas de email
export const PreserveStylesExtension = Extension.create({
  name: 'preserveStyles',

  addGlobalAttributes() {
    return [
      {
        // Nota: mantenemos heading habilitado para no degradar plantillas HTML.
        types: ['paragraph', 'heading', 'listItem', 'blockquote'],
        attributes: {
          style: {
            default: null,
            parseHTML: element => element.getAttribute('style'),
            renderHTML: attributes => {
              if (!attributes['style']) {
                return {};
              }
              return {
                style: attributes['style'],
              };
            },
          },
          class: {
            default: null,
            parseHTML: element => element.getAttribute('class'),
            renderHTML: attributes => {
              if (!attributes['class']) {
                return {};
              }
              return {
                class: attributes['class'],
              };
            },
          },
          align: {
            default: null,
            parseHTML: element => element.getAttribute('align'),
            renderHTML: attributes => {
              if (!attributes['align']) {
                return {};
              }
              return {
                align: attributes['align'],
              };
            },
          },
        },
      },
    ];
  },

  addExtensions() {
    return [];
  },
});
