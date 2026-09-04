// Mock del "storage" de comunicaciones (simula el índice de un blob de Azure).
// Cada ítem apunta a un .eml servido desde /public/mock-eml. Cuando exista el
// storage real, se reemplaza por un servicio que liste blobs y devuelva URLs (SAS).

export interface ComunicacionRef {
  id: string;
  remitente: string;
  remitenteEmail: string;
  /** Destinatarios (To). */
  destinatarios: string[];
  asunto: string;
  /** Clasificación de la comunicación (para filtrar). */
  tipo: string;
  /** ISO; la vista la formatea. */
  fecha: string;
  adjuntos: number;
  tamanoBytes: number;
  /** URL del .eml (hoy en /mock-eml; mañana un blob SAS de Azure). */
  archivo: string;
}

export const COMUNICACIONES_MOCK: ComunicacionRef[] = [
  {
    id: 'c-001',
    remitente: 'Skandia',
    remitenteEmail: 'DoNotReply@skandia.co',
    destinatarios: ['20firpeople@gmail.com'],
    asunto:
      'Skandia Seguros de Vida – Descubre la nueva forma de gestionar el pago de tu T.C. de tu seguro de vida fácilmente ✅',
    tipo: 'Comercial',
    fecha: '2026-09-03T10:15:00-05:00',
    adjuntos: 2,
    tamanoBytes: 2391930,
    archivo: '/mock-eml/skandia-pago-tc.eml',
  },
  {
    id: 'c-002',
    remitente: 'Servicio al Cliente Skandia',
    remitenteEmail: 'servicioalcliente@skandia.co',
    destinatarios: ['cliente@email.com'],
    asunto: 'Confirmación de radicación de tu solicitud #SC-48213',
    tipo: 'Notificación',
    fecha: '2026-09-01T08:42:00-05:00',
    adjuntos: 0,
    tamanoBytes: 1180,
    archivo: '/mock-eml/skandia-solicitud.eml',
  },
  {
    id: 'c-003',
    remitente: 'Indemnizaciones Skandia',
    remitenteEmail: 'indemnizaciones@skandia.co',
    destinatarios: ['cliente@email.com', 'legal@skandia.co'],
    asunto: 'Respuesta a tu reclamación de siniestro — Caso R-9042',
    tipo: 'Siniestro',
    fecha: '2026-08-29T16:05:00-05:00',
    adjuntos: 0,
    tamanoBytes: 1720,
    archivo: '/mock-eml/skandia-siniestro.eml',
  },
];
