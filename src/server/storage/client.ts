/**
 * Cliente S3-compatible (MinIO en dev, R2/S3 en prod).
 * Configurado vía las variables STORAGE_* del entorno.
 *
 * Expone tres helpers usados por las rutas de API:
 *   uploadBuffer  — sube un Buffer con el Content-Type dado
 *   presignedGet  — genera una URL firmada de lectura (defecto: 1h)
 *   deleteObject  — borra un objeto (borrado RGPD)
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

function buildClient() {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const region = process.env.STORAGE_REGION ?? 'auto';
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID ?? '';
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY ?? '';

  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    // MinIO en modo path-style: http://host/bucket/key
    forcePathStyle: !!endpoint,
  });
}

// Singleton por proceso (HMR-safe en dev).
const s3 = buildClient();
const BUCKET = process.env.STORAGE_BUCKET ?? 'habiteka';

export async function uploadBuffer(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function presignedGet(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn },
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
