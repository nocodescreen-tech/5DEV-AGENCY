import { createHash } from 'node:crypto';

/**
 * Cloudinary : téléversement authentifié + URLs signées à la demande.
 * Les fichiers sont envoyés en `type=authenticated` : aucune URL publique ne
 * fonctionne sans signature, donc un album privé ne fuit pas par l'URL.
 */
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME ?? '';
const KEY = process.env.CLOUDINARY_API_KEY ?? '';
const SECRET = process.env.CLOUDINARY_API_SECRET ?? '';

export const cloudinaryReady = (): boolean => Boolean(CLOUD && KEY && SECRET);

const sha1 = (s: string): string => createHash('sha1').update(s).digest('hex');

function sign(params: Record<string, string>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return sha1(`${toSign}${SECRET}`);
}

export type Uploaded = {
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  folder?: string;
};

export async function uploadImage(
  buffer: Buffer,
  filename: string,
  folder = '5dev',
): Promise<Uploaded> {
  if (!cloudinaryReady()) throw new Error('Cloudinary non configuré');

  const timestamp = String(Math.floor(Date.now() / 1000));
  const params: Record<string, string> = { folder, timestamp, type: 'authenticated' };
  const signature = sign(params);

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)]), filename);
  form.append('api_key', KEY);
  form.append('timestamp', timestamp);
  form.append('folder', folder);
  form.append('type', 'authenticated');
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cloudinary ${res.status} — ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as Uploaded;
  return json;
}

export type UrlOptions = { width?: number; height?: number; quality?: number };

/** URL d'affichage signée (durée de vie = celle de la page qui la demande). */
export function signedUrl(
  publicId: string,
  format: string,
  opts: UrlOptions = {},
): string {
  if (!cloudinaryReady()) return '';
  const signature = sha1(`${publicId}${SECRET}`).slice(0, 8);
  const parts: string[] = ['q_auto', 'f_auto'];
  if (opts.width) parts.push(`c_fill`, `w_${opts.width}`);
  if (opts.height) parts.push(`h_${opts.height}`);
  if (opts.quality) parts.push(`q_${opts.quality}`);
  const transformation = parts.join(',');
  const ext = format || 'jpg';
  return `https://res.cloudinary.com/${CLOUD}/image/authenticated/s--${signature}--/${transformation}/v1/${publicId}.${ext}`;
}

/** URL de téléchargement de l'original (signée, avec nom de fichier lisible). */
export function downloadUrl(publicId: string, format: string, name: string): string {
  if (!cloudinaryReady()) return '';
  const signature = sha1(`${publicId}${SECRET}`).slice(0, 8);
  const ext = format || 'jpg';
  const attachment = `fl_attachment:${encodeURIComponent(name)}`;
  return `https://res.cloudinary.com/${CLOUD}/image/authenticated/s--${signature}--/${attachment}/v1/${publicId}.${ext}`;
}
