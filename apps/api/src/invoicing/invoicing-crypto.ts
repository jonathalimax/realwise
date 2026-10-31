import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for the provider token kept in `app_settings`. The key is derived (with a purpose label, so it is not
 * the raw JWT secret) from INVOICING_SECRET, falling back to JWT_SECRET. Rotating the secret means re-saving the token.
 */
function key(): Buffer {
  const secret = process.env.INVOICING_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret';
  return createHash('sha256').update(`realwise:invoicing:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64')).join('.');
}

/** Returns null when the value is missing or cannot be decrypted (e.g. the secret changed). */
export function decryptSecret(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const [iv, tag, body] = token.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
