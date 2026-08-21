// src/lib/storage.ts
// Object storage abstraction — S3/MinIO with local filesystem fallback.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local'; // 's3' | 'local'
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'uploads');

// ─── S3 Config ───────────────────────────────────────────
const S3_CONFIG = {
  endpoint: process.env.S3_ENDPOINT || '',
  bucket: process.env.S3_BUCKET || 'dtms-uploads',
  region: process.env.S3_REGION || 'us-east-1',
  accessKeyId: process.env.S3_ACCESS_KEY || '',
  secretAccessKey: process.env.S3_SECRET_KEY || '',
  forcePathStyle: true,
};

// ─── Types ───────────────────────────────────────────────
interface StorageResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
  checksum: string;
}

interface UploadOptions {
  tenantId: string;
  category: string; // 'pod', 'signature', 'vehicle', 'document'
  entityId?: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

// ─── Public API ──────────────────────────────────────────
export async function uploadFile(opts: UploadOptions): Promise<StorageResult> {
  const key = buildKey(opts.tenantId, opts.category, opts.entityId, opts.fileName, opts.mimeType);
  const checksum = crypto.createHash('sha256').update(opts.buffer).digest('hex');

  if (STORAGE_TYPE === 's3') {
    return uploadToS3(key, opts.buffer, opts.mimeType, checksum);
  }
  return uploadToLocal(key, opts.buffer, opts.mimeType, checksum);
}

export async function getFile(key: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (STORAGE_TYPE === 's3') {
    return getFromS3(key);
  }
  return getFromLocal(key);
}

export function getFileUrl(key: string): string {
  if (STORAGE_TYPE === 's3') {
    return `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/${key}`;
  }
  return `/api/files/${key}`;
}

// ─── Key Builder ─────────────────────────────────────────
const SAFE_SEGMENT = /^[a-z0-9_-]+$/i;
const EXT_MIME_MAP: Record<string, string[]> = {
  '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'],
  '.png': ['image/png'], '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
};

function sanitizeSegment(value: string, fallback: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned || fallback;
}

function validateExtension(fileName: string, mimeType: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const allowed = EXT_MIME_MAP[ext];
  if (!allowed || !allowed.includes(mimeType)) {
    return '.bin';
  }
  return ext;
}

function buildKey(tenantId: string, category: string, entityId: string | undefined, fileName: string, mimeType: string): string {
  const safeCategory = sanitizeSegment(category, 'general');
  const safeEntityId = entityId ? sanitizeSegment(entityId, 'general') : 'general';
  const ext = validateExtension(fileName, mimeType);
  const hash = crypto.randomBytes(8).toString('hex');
  const date = new Date().toISOString().slice(0, 10);
  return `tenant/${tenantId}/${safeCategory}/${date}/${safeEntityId}/${hash}${ext}`;
}

// ─── Local Storage ───────────────────────────────────────
async function uploadToLocal(key: string, buffer: Buffer, mimeType: string, checksum: string): Promise<StorageResult> {
  const fullPath = path.join(UPLOAD_DIR, key);
  const dir = path.dirname(fullPath);

  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(fullPath, buffer);

  return { key, url: `/api/files/${key}`, size: buffer.length, mimeType, checksum };
}

async function getFromLocal(key: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const resolvedUploadDir = path.resolve(UPLOAD_DIR);
    const fullPath = path.resolve(path.join(UPLOAD_DIR, key));
    if (!fullPath.startsWith(resolvedUploadDir + path.sep) && fullPath !== resolvedUploadDir) {
      return null;
    }
    const buffer = await fs.promises.readFile(fullPath);
    const mimeType = getMimeType(key);
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

// ─── S3 Storage (AWS SDK v3-compatible) ──────────────────
async function uploadToS3(key: string, buffer: Buffer, mimeType: string, checksum: string): Promise<StorageResult> {
  // Dynamic import to avoid loading AWS SDK if not needed
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const client = new S3Client({
    endpoint: S3_CONFIG.endpoint,
    region: S3_CONFIG.region,
    credentials: {
      accessKeyId: S3_CONFIG.accessKeyId,
      secretAccessKey: S3_CONFIG.secretAccessKey,
    },
    forcePathStyle: S3_CONFIG.forcePathStyle,
  });

  await client.send(new PutObjectCommand({
    Bucket: S3_CONFIG.bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ChecksumSHA256: checksum,
  }));

  const url = `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/${key}`;
  return { key, url, size: buffer.length, mimeType, checksum };
}

async function getFromS3(key: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      endpoint: S3_CONFIG.endpoint,
      region: S3_CONFIG.region,
      credentials: {
        accessKeyId: S3_CONFIG.accessKeyId,
        secretAccessKey: S3_CONFIG.secretAccessKey,
      },
      forcePathStyle: S3_CONFIG.forcePathStyle,
    });

    const res = await client.send(new GetObjectCommand({ Bucket: S3_CONFIG.bucket, Key: key }));
    const stream = res.Body;
    if (!stream) return null;

    const chunks: Uint8Array[] = [];
    const reader = stream.transformToWebStream().getReader();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(result.value);
    }

    const buffer = Buffer.concat(chunks);
    const mimeType = getMimeType(key);
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────
function getMimeType(key: string): string {
  const ext = path.extname(key).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
    '.csv': 'text/csv', '.json': 'application/json',
  };
  return map[ext] || 'application/octet-stream';
}
