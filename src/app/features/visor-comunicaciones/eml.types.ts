// Modelo de vista del visor de EML: lo que la UI necesita, ya decodificado y
// libre de MIME. El parseo real (postal-mime) vive en eml.service.ts.

export type AttachmentKind = 'pdf' | 'image' | 'text' | 'other';

export interface EmlAttachment {
  /** id estable para trackBy y selección. */
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  /** Blob URL (para previsualizar/descargar). Se revoca al cargar otro correo. */
  url: string;
}

export interface EmlAddress {
  name: string;
  address: string;
}

export interface EmlHeader {
  key: string;
  value: string;
}

export interface ParsedEml {
  subject: string;
  from: EmlAddress | null;
  to: EmlAddress[];
  cc: EmlAddress[];
  /** ISO string tal como venía; el pipe `date` de la vista la formatea. */
  date: string | null;
  messageId: string | null;
  /** HTML del cuerpo con los `cid:` inline ya embebidos como data URLs. */
  html: string | null;
  /** Alternativa en texto plano (cuando no hay HTML, o para "Detalles"). */
  text: string | null;
  /** true si el HTML referencia recursos remotos (imágenes/tracking). */
  hasRemoteContent: boolean;
  attachments: EmlAttachment[];
  headers: EmlHeader[];
  /** Tamaño del .eml original en bytes. */
  sizeBytes: number;
}
