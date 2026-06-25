/**
 * Implementación S3-compatible del almacenamiento. Sirve a un S3 gestionado
 * (producción) y a MinIO (self-host) con el mismo código: solo cambian el endpoint
 * y las credenciales, que se leen del entorno (server-only). El cliente se crea una
 * vez por proceso.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageAdapter, PutObjectInput } from './storage-adapter';

const UPLOAD_TTL_SECONDS = 300;
const DOWNLOAD_TTL_SECONDS = 600;

export class S3StorageAdapter implements StorageAdapter {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(input: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async get(key: string): Promise<Buffer> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!out.Body) throw new Error(`Objeto no encontrado en storage: ${key}`);
    // El SDK v3 expone el cuerpo como stream web/node; `transformToByteArray` lo
    // colecciona sin que tengamos que distinguir el runtime.
    const bytes = await out.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async getPresignedUploadUrl(key: string, maxBytes: number, contentType: string): Promise<string> {
    // El límite de tamaño se ata a la URL firmada (ContentLength), de modo que el
    // storage rechaza un upload mayor sin que el servidor intermedie.
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: maxBytes,
    });
    return getSignedUrl(this.client, command, { expiresIn: UPLOAD_TTL_SECONDS });
  }

  async getPresignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: DOWNLOAD_TTL_SECONDS });
  }
}

let cached: StorageAdapter | undefined;

/** Crea el adaptador de storage desde el entorno (S3 gestionado o MinIO). */
export function getStorageAdapter(): StorageAdapter {
  if (cached) return cached;
  const bucket = process.env.STORAGE_BUCKET;
  const region = process.env.STORAGE_REGION ?? 'us-east-1';
  const endpoint = process.env.STORAGE_ENDPOINT;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Credenciales de storage incompletas (STORAGE_*)');
  }
  const client = new S3Client({
    region,
    endpoint,
    // MinIO requiere acceso por path; un S3 gestionado lo ignora sin problema.
    forcePathStyle: Boolean(endpoint),
    credentials: { accessKeyId, secretAccessKey },
  });
  cached = new S3StorageAdapter(client, bucket);
  return cached;
}

/** Inyecta un adaptador (tests) sin tocar la resolución por entorno. */
export function setStorageAdapter(adapter: StorageAdapter): void {
  cached = adapter;
}
