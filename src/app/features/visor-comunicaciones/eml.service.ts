// Parseo de archivos .eml con postal-mime → modelo de vista (ParsedEml).
// Aquí se resuelve todo lo "sucio" del correo para que la UI no vea nada de MIME:
//  - imágenes inline (cid:) se embeben en el HTML como data URLs;
//  - los adjuntos se exponen como Blob URLs (previsualizar/descargar);
//  - se detecta si el HTML trae recursos remotos (para bloquear tracking por defecto).

import { Injectable } from '@angular/core';
import PostalMime, { type Attachment, type Address } from 'postal-mime';
import { AttachmentKind, EmlAddress, ParsedEml } from './eml.types';

@Injectable({ providedIn: 'root' })
export class EmlService {
  async parse(file: File | ArrayBuffer): Promise<ParsedEml> {
    const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const email = await PostalMime.parse(buffer, { attachmentEncoding: 'arraybuffer' });

    // cid → data URL para las imágenes inline referenciadas en el HTML.
    const porCid = new Map<string, Attachment>();
    for (const att of email.attachments) {
      if (att.contentId) porCid.set(this.limpiarCid(att.contentId), att);
    }

    const cidsUsados = new Set<string>();
    let html = email.html ?? null;
    if (html) {
      html = html.replace(/cid:([^"')\s>]+)/gi, (orig, cid: string) => {
        const att = porCid.get(this.limpiarCid(cid));
        if (!att) return orig;
        cidsUsados.add(this.limpiarCid(cid));
        return this.dataUrl(att);
      });
    }

    // Adjuntos "de verdad": todo lo que no se embebió como imagen inline.
    const attachments = email.attachments
      .filter((att) => !(att.contentId && cidsUsados.has(this.limpiarCid(att.contentId))))
      .map((att, i) => {
        const ab = this.toArrayBuffer(att.content);
        const blob = new Blob([ab], { type: att.mimeType || 'application/octet-stream' });
        return {
          id: `att-${i}`,
          filename: att.filename || `adjunto-${i + 1}`,
          mimeType: att.mimeType || 'application/octet-stream',
          sizeBytes: ab.byteLength,
          kind: this.tipo(att.mimeType || ''),
          url: URL.createObjectURL(blob),
        };
      });

    return {
      subject: email.subject?.trim() || '(sin asunto)',
      from: this.dir(email.from),
      to: this.dirs(email.to),
      cc: this.dirs(email.cc),
      date: email.date ?? null,
      messageId: email.messageId ?? null,
      html,
      text: email.text ?? null,
      hasRemoteContent: this.tieneRemoto(html),
      attachments,
      headers: email.headers.map((h) => ({ key: h.key, value: h.value })),
      sizeBytes: buffer.byteLength,
    };
  }

  /** Libera los Blob URLs de los adjuntos (llamar al cambiar de correo). */
  revoke(parsed: ParsedEml | null): void {
    parsed?.attachments.forEach((a) => URL.revokeObjectURL(a.url));
  }

  formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── helpers ──

  private limpiarCid(cid: string): string {
    return cid.replace(/^<|>$/g, '').trim().toLowerCase();
  }

  private toUint8(content: ArrayBuffer | Uint8Array | string): Uint8Array {
    if (content instanceof Uint8Array) return content;
    if (content instanceof ArrayBuffer) return new Uint8Array(content);
    // encoding 'utf8' (raro con attachmentEncoding arraybuffer, pero por si acaso)
    return new TextEncoder().encode(content);
  }

  /** Copia a un ArrayBuffer "real" (evita el tipo ArrayBufferLike/SharedArrayBuffer). */
  private toArrayBuffer(content: ArrayBuffer | Uint8Array | string): ArrayBuffer {
    const u = this.toUint8(content);
    const ab = new ArrayBuffer(u.byteLength);
    new Uint8Array(ab).set(u);
    return ab;
  }

  private dataUrl(att: Attachment): string {
    const bytes = this.toUint8(att.content);
    return `data:${att.mimeType || 'application/octet-stream'};base64,${this.base64(bytes)}`;
  }

  private base64(bytes: Uint8Array): string {
    let bin = '';
    const chunk = 0x8000; // evita "Maximum call stack" en archivos grandes
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  private tipo(mime: string): AttachmentKind {
    const m = mime.toLowerCase();
    if (m.includes('pdf')) return 'pdf';
    if (m.startsWith('image/')) return 'image';
    if (m.startsWith('text/') || m.includes('json') || m.includes('xml') || m.includes('csv'))
      return 'text';
    return 'other';
  }

  private dir(a: Address | undefined): EmlAddress | null {
    if (!a || !('address' in a) || !a.address) return null;
    return { name: a.name || a.address, address: a.address };
  }

  private dirs(list: Address[] | undefined): EmlAddress[] {
    return (list ?? []).map((a) => this.dir(a)).filter((x): x is EmlAddress => x !== null);
  }

  /** Detección simple de recursos remotos en el HTML (imágenes de rastreo, etc.). */
  private tieneRemoto(html: string | null): boolean {
    if (!html) return false;
    return /(?:src|background|href)\s*=\s*["']?https?:\/\//i.test(html) || /url\(\s*["']?https?:\/\//i.test(html);
  }
}
