/**
 * Utilidades para preservar el bloque <style> y estructura HTML de plantillas de email.
 * TipTap solo maneja el contenido del <body>, por lo que necesitamos extraer y
 * restaurar el <head> (incluyendo <style>) por separado.
 */

export interface ExtractedTemplate {
  /** Contenido antes del body (DOCTYPE, html, head, style, etc.) */
  headSection: string;
  /** Contenido del body que TipTap puede editar */
  bodyContent: string;
  /** Contenido después del body (cierre de tags) */
  footerSection: string;
  /** Si la plantilla tenía estructura HTML completa */
  hasFullStructure: boolean;
}

/**
 * Extrae las secciones de un HTML de plantilla de email.
 * Preserva el <head> con <style>, DOCTYPE, etc.
 */
export function extractTemplateSections(html: string): ExtractedTemplate {
  // Verificar si es un HTML completo con DOCTYPE o <html>
  const hasDoctype = /<!DOCTYPE\s+html/i.test(html);
  const hasHtmlTag = /<html[\s>]/i.test(html);
  const hasFullStructure = hasDoctype || hasHtmlTag;

  if (!hasFullStructure) {
    // Si no tiene estructura completa, es solo contenido
    return {
      headSection: '',
      bodyContent: html,
      footerSection: '',
      hasFullStructure: false,
    };
  }

  // Buscar el inicio del contenido del body
  const bodyStartMatch = html.match(/<body[^>]*>/i);
  const bodyEndMatch = html.match(/<\/body>/i);

  if (!bodyStartMatch || !bodyEndMatch) {
    // Si no tiene body explícito, tratar como contenido simple
    return {
      headSection: '',
      bodyContent: html,
      footerSection: '',
      hasFullStructure: false,
    };
  }

  const bodyStartIndex = bodyStartMatch.index! + bodyStartMatch[0].length;
  const bodyEndIndex = bodyEndMatch.index!;

  return {
    headSection: html.substring(0, bodyStartIndex),
    bodyContent: html.substring(bodyStartIndex, bodyEndIndex),
    footerSection: html.substring(bodyEndIndex),
    hasFullStructure: true,
  };
}

/**
 * Reconstruye el HTML completo combinando las secciones originales
 * con el contenido editado del body.
 */
export function reconstructFullHtml(
  extractedTemplate: ExtractedTemplate,
  editedBodyContent: string
): string {
  if (!extractedTemplate.hasFullStructure) {
    // Si no había estructura completa, devolver solo el contenido editado
    return editedBodyContent;
  }

  return (
    extractedTemplate.headSection +
    editedBodyContent +
    extractedTemplate.footerSection
  );
}

/**
 * Limpia el HTML que viene de TipTap para que sea compatible con email.
 * Elimina wrappers innecesarios que TipTap pueda agregar.
 */
export function cleanTipTapHtml(html: string): string {
  // TipTap a veces envuelve contenido en divs innecesarios
  // Pero debemos ser cuidadosos de no romper la estructura
  let cleaned = html;

  // Eliminar divs vacíos al inicio o final
  cleaned = cleaned.replace(/^(<div[^>]*>\s*<\/div>)+/gi, '');
  cleaned = cleaned.replace(/(<div[^>]*>\s*<\/div>)+$/gi, '');

  return cleaned;
}

/**
 * Inyecta estilos CSS críticos para email en el contenido.
 * Esto es un fallback por si el bloque <style> original se pierde.
 */
export function getEmailCriticalStyles(): string {
  return `
    <style>
      /* Estilos críticos para compatibilidad de email */
      body { margin: 0; padding: 0; }
      table { border-collapse: collapse; }
      img { border: 0; display: block; }
      a { text-decoration: none; }
    </style>
  `;
}
