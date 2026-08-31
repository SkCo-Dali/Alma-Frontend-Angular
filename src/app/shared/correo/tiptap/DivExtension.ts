import { Node, mergeAttributes } from '@tiptap/core';

// Extensión para soportar divs con estilos inline
// Preserva completamente los divs de plantillas de email
export const DivExtension = Node.create({
  name: 'div',

  group: 'block',

  content: 'block+',

  defining: true,

  addAttributes() {
    return {
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
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});
