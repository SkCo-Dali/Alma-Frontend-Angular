import { Node, mergeAttributes } from '@tiptap/core';

// Extensión para soportar tablas con estilos inline
// Las plantillas de email a menudo usan tablas para layout
export const TableWithStyles = Node.create({
  name: 'customTable',

  group: 'block',

  // Aceptar tableBody o tableRow directamente para preservar estructura original
  content: '(tableBody | tableRow)+',

  isolating: true,

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
      cellpadding: {
        default: null,
        parseHTML: element => element.getAttribute('cellpadding'),
        renderHTML: attributes => {
          if (!attributes['cellpadding']) return {};
          return { cellpadding: attributes['cellpadding'] };
        },
      },
      cellspacing: {
        default: null,
        parseHTML: element => element.getAttribute('cellspacing'),
        renderHTML: attributes => {
          if (!attributes['cellspacing']) return {};
          return { cellspacing: attributes['cellspacing'] };
        },
      },
      border: {
        default: null,
        parseHTML: element => element.getAttribute('border'),
        renderHTML: attributes => {
          if (!attributes['border']) return {};
          return { border: attributes['border'] };
        },
      },
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width'),
        renderHTML: attributes => {
          if (!attributes['width']) return {};
          return { width: attributes['width'] };
        },
      },
      align: {
        default: null,
        parseHTML: element => element.getAttribute('align'),
        renderHTML: attributes => {
          if (!attributes['align']) return {};
          return { align: attributes['align'] };
        },
      },
      bgcolor: {
        default: null,
        parseHTML: element => element.getAttribute('bgcolor'),
        renderHTML: attributes => {
          if (!attributes['bgcolor']) return {};
          return { bgcolor: attributes['bgcolor'] };
        },
      },
      role: {
        default: null,
        parseHTML: element => element.getAttribute('role'),
        renderHTML: attributes => {
          if (!attributes['role']) return {};
          return { role: attributes['role'] };
        },
      },
      // Atributo background para imágenes de fondo (legacy HTML pero usado en emails)
      background: {
        default: null,
        parseHTML: element => element.getAttribute('background'),
        renderHTML: attributes => {
          if (!attributes['background']) return {};
          return { background: attributes['background'] };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'table' }];
  },

  // IMPORTANTE: No añadir tbody automáticamente, preservar estructura original
  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(HTMLAttributes), 0];
  },
});

// Extensión para tbody - preservar estructura original
export const TableBody = Node.create({
  name: 'tableBody',

  content: 'tableRow+',

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
    return [{ tag: 'tbody' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['tbody', mergeAttributes(HTMLAttributes), 0];
  },
});

export const TableRow = Node.create({
  name: 'tableRow',

  content: 'tableCell+',

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
      valign: {
        default: null,
        parseHTML: element => element.getAttribute('valign'),
        renderHTML: attributes => {
          if (!attributes['valign']) return {};
          return { valign: attributes['valign'] };
        },
      },
      align: {
        default: null,
        parseHTML: element => element.getAttribute('align'),
        renderHTML: attributes => {
          if (!attributes['align']) return {};
          return { align: attributes['align'] };
        },
      },
      bgcolor: {
        default: null,
        parseHTML: element => element.getAttribute('bgcolor'),
        renderHTML: attributes => {
          if (!attributes['bgcolor']) return {};
          return { bgcolor: attributes['bgcolor'] };
        },
      },
      // Atributo background para imágenes de fondo en filas
      background: {
        default: null,
        parseHTML: element => element.getAttribute('background'),
        renderHTML: attributes => {
          if (!attributes['background']) return {};
          return { background: attributes['background'] };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'tr' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes), 0];
  },
});

export const TableCell = Node.create({
  name: 'tableCell',

  // ProseMirror no permite mezclar inline y block en la misma expresión.
  // Mantener 'block+' y dejar que el parser envuelva inline (como <img>) dentro de <p> cuando sea necesario.
  content: 'block+',

  isolating: true,

  addAttributes() {
    return {
      colspan: {
        default: 1,
        parseHTML: element => {
          const colspan = element.getAttribute('colspan');
          return colspan ? parseInt(colspan, 10) : 1;
        },
        renderHTML: attributes => {
          if (attributes['colspan'] === 1) return {};
          return { colspan: attributes['colspan'] };
        },
      },
      rowspan: {
        default: 1,
        parseHTML: element => {
          const rowspan = element.getAttribute('rowspan');
          return rowspan ? parseInt(rowspan, 10) : 1;
        },
        renderHTML: attributes => {
          if (attributes['rowspan'] === 1) return {};
          return { rowspan: attributes['rowspan'] };
        },
      },
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
      valign: {
        default: null,
        parseHTML: element => element.getAttribute('valign'),
        renderHTML: attributes => {
          if (!attributes['valign']) return {};
          return { valign: attributes['valign'] };
        },
      },
      align: {
        default: null,
        parseHTML: element => element.getAttribute('align'),
        renderHTML: attributes => {
          if (!attributes['align']) return {};
          return { align: attributes['align'] };
        },
      },
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width'),
        renderHTML: attributes => {
          if (!attributes['width']) return {};
          return { width: attributes['width'] };
        },
      },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height'),
        renderHTML: attributes => {
          if (!attributes['height']) return {};
          return { height: attributes['height'] };
        },
      },
      bgcolor: {
        default: null,
        parseHTML: element => element.getAttribute('bgcolor'),
        renderHTML: attributes => {
          if (!attributes['bgcolor']) return {};
          return { bgcolor: attributes['bgcolor'] };
        },
      },
      // Atributo padding para email compatibility
      padding: {
        default: null,
        parseHTML: element => element.getAttribute('padding'),
        renderHTML: attributes => {
          if (!attributes['padding']) return {};
          return { padding: attributes['padding'] };
        },
      },
      // Atributo background para imágenes de fondo (legacy HTML pero común en emails)
      background: {
        default: null,
        parseHTML: element => element.getAttribute('background'),
        renderHTML: attributes => {
          if (!attributes['background']) return {};
          return { background: attributes['background'] };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'td' }, { tag: 'th' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(HTMLAttributes), 0];
  },
});
