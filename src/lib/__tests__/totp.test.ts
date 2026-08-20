import { describe, it, expect } from 'vitest';
import {
  generateTotpSecret,
  base32Decode,
  hotp,
  totp,
  verifyTotp,
  otpauthUrl,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  removeBackupCode,
} from '../totp';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

describe('totp', () => {
  it('generateTotpSecret menghasilkan base32 valid 32 karakter (20 byte)', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret).length).toBe(20);
  });

  it('hotp sesuai vektor uji RFC 4226 untuk key ASCII "12345678901234567890"', () => {
    const key = b32Encode(Buffer.from('12345678901234567890', 'ascii'));
    const vectors: Array<[number, string]> = [
      [0, '755224'],
      [1, '287082'],
      [2, '359152'],
      [3, '969429'],
      [4, '338314'],
      [5, '254676'],
    ];
    for (const [count, expected] of vectors) {
      expect(hotp(key, count)).toBe(expected);
    }
  });

  it('totp konsisten dalam window 30 detik', () => {
    const secret = generateTotpSecret();
    const fixedTime = 1755700000000;
    const t1 = totp(secret, fixedTime);
    const t2 = totp(secret, fixedTime + 5000);
    expect(t1).toBe(t2);
    expect(t1).toMatch(/^\d{6}$/);
  });

  it('verifyTotp menerima kode benar dan menolak salah/format', () => {
    const secret = generateTotpSecret();
    const code = totp(secret);
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, '000000')).toBe(false);
    expect(verifyTotp(secret, 'abc123')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
  });

  it('verifyTotp menerima kode 1 langkah waktu sebelumnya', () => {
    const secret = generateTotpSecret();
    const code = totp(secret, Date.now() - 30_000);
    expect(verifyTotp(secret, code, 1)).toBe(true);
  });

  it('otpauthUrl berisi issuer & akun yang benar', () => {
    const url = otpauthUrl('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', 'admin', 'DTMS');
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain('secret=ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');
    expect(url).toContain('issuer=DTMS');
    expect(url).toContain('admin');
  });
});

describe('backup codes', () => {
  it('generateBackupCodes menghasilkan format XXXXX-XXXXX unik', () => {
    const codes = generateBackupCodes(8);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[A-F0-9]{5}-[A-F0-9]{5}$/);
  });

  it('verifyBackupCode menerima kode yang benar & menolak salah', () => {
    const codes = generateBackupCodes(4);
    const stored = hashBackupCodes(codes);
    expect(verifyBackupCode(stored, codes[0])).toBe(true);
    expect(verifyBackupCode(stored, 'AAAAA-AAAAA')).toBe(false);
    expect(verifyBackupCode(null, codes[0])).toBe(false);
  });

  it('removeBackupCode hanya menghapus kode yang dipakai', () => {
    const codes = generateBackupCodes(4);
    const stored = hashBackupCodes(codes);
    const remaining = removeBackupCode(stored, codes[0]);
    expect(verifyBackupCode(remaining, codes[0])).toBe(false);
    expect(verifyBackupCode(remaining, codes[1])).toBe(true);
  });
});
