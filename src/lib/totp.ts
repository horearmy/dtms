import { createHmac, randomBytes, createHash } from 'crypto';
import { decryptSecret } from './totp-encrypt';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP = 30;
const TOTP_DIGITS = 6;

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function hotp(secret: string, counter: number, digits = TOTP_DIGITS): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key);
  hmac.update(buf);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const bin = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return bin.toString(10).padStart(digits, '0');
}

export function totp(secret: string, time = Date.now()): string {
  const counter = Math.floor(time / 1000 / TOTP_STEP);
  return hotp(secret, counter);
}

export function verifyTotp(secret: string, token: string, window = 1, time = Date.now()): boolean {
  const clean = token.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const decrypted = decryptSecret(secret);
  const counter = Math.floor(time / 1000 / TOTP_STEP);
  for (let i = -window; i <= window; i++) {
    if (hotp(decrypted, counter + i) === clean) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, account: string, issuer = 'DTMS'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${encodeURIComponent(
    secret
  )}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP}`;
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part1 = randomBytes(3).toString('hex').slice(0, 5).toUpperCase();
    const part2 = randomBytes(3).toString('hex').slice(0, 5).toUpperCase();
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

export function hashBackupCodes(codes: string[]): string {
  return JSON.stringify(codes.map((c) => createHash('sha256').update(c).digest('hex')));
}

export function verifyBackupCode(storedJson: string | null, code: string): boolean {
  if (!storedJson) return false;
  try {
    const hashes: string[] = JSON.parse(storedJson);
    const clean = code.trim().toUpperCase();
    const target = createHash('sha256').update(clean).digest('hex');
    return hashes.includes(target);
  } catch {
    return false;
  }
}

export function removeBackupCode(storedJson: string | null, code: string): string | null {
  if (!storedJson) return null;
  try {
    const hashes: string[] = JSON.parse(storedJson);
    const clean = code.trim().toUpperCase();
    const target = createHash('sha256').update(clean).digest('hex');
    const remaining = hashes.filter((h) => h !== target);
    return remaining.length > 0 ? JSON.stringify(remaining) : null;
  } catch {
    return storedJson;
  }
}
