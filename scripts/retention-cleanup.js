const { loadEnvConfig } = require('@next/env');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const execute = process.argv.includes('--execute');
const confirmed = process.argv.includes('--confirm-retention');
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const policies = [
  { label: 'GPS logs (90 hari)', model: prisma.gpsLog, cutoff: daysAgo(90) },
  { label: 'Shipment events (365 hari)', model: prisma.shipmentEvent, cutoff: daysAgo(365) },
  { label: 'Audit logs (365 hari)', model: prisma.auditLog, cutoff: daysAgo(365) },
  { label: 'Messages (180 hari)', model: prisma.message, cutoff: daysAgo(180) },
  { label: 'Notifications (180 hari)', model: prisma.notification, cutoff: daysAgo(180) },
];

async function deleteStoredObject(objectKey) {
  if (process.env.STORAGE_TYPE === 's3') {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      endpoint: process.env.S3_ENDPOINT || '',
      region: process.env.S3_REGION || 'us-east-1',
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY || '', secretAccessKey: process.env.S3_SECRET_KEY || '' },
      forcePathStyle: true,
    });
    await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET || 'dtms-uploads', Key: objectKey }));
    return;
  }

  const root = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'uploads'));
  const target = path.resolve(path.join(root, objectKey));
  if (!target.startsWith(root + path.sep)) throw new Error(`Invalid storage path: ${objectKey}`);
  await fs.promises.unlink(target).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

async function main() {
  if (execute && !confirmed) throw new Error('Gunakan --execute --confirm-retention untuk menghapus data.');
  console.log(execute ? 'RETENTION MODE: EXECUTE' : 'RETENTION MODE: DRY-RUN');
  for (const policy of policies) {
    const where = { createdAt: { lt: policy.cutoff }, legalHold: false };
    const result = execute ? await policy.model.deleteMany({ where }) : await policy.model.count({ where });
    const count = execute ? result.count : result;
    console.log(`${policy.label}: ${count} record${execute ? ' dihapus' : ' akan dihapus'}`);
  }
  const oldFiles = await prisma.uploadedFile.findMany({
    where: { createdAt: { lt: daysAgo(365) }, legalHold: false },
    select: { id: true, objectKey: true },
  });
  if (execute) {
    for (const file of oldFiles) await deleteStoredObject(file.objectKey);
    if (oldFiles.length) await prisma.uploadedFile.deleteMany({ where: { id: { in: oldFiles.map((file) => file.id) } } });
  }
  console.log(`Uploaded files (365 hari): ${oldFiles.length} record${execute ? ' dihapus' : ' akan dihapus'}`);
  console.log('Customer dan data customer tidak diproses oleh retention job.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
