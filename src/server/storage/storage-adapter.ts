/**
 * Abstracción de almacenamiento de objetos (mismo patrón que los adaptadores de
 * IA): desacopla la aplicación del backend concreto. La misma interfaz sirve a un
 * S3 gestionado (producción) y a MinIO (self-host), porque ambos hablan el
 * protocolo S3; cambiar de backend es configuración, no código.
 *
 * Las URLs prefirmadas permiten que el cliente suba y descargue directamente del
 * storage sin que las credenciales salgan del servidor; la de subida incluye un
 * límite de tamaño para que un upload no desborde el bucket.
 */
export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageAdapter {
  put(input: PutObjectInput): Promise<void>;
  delete(key: string): Promise<void>;
  /** URL temporal para que el cliente suba directo, acotada en tamaño. */
  getPresignedUploadUrl(key: string, maxBytes: number, contentType: string): Promise<string>;
  /** URL temporal de descarga (expira). No expone el bucket públicamente. */
  getPresignedDownloadUrl(key: string): Promise<string>;
}
