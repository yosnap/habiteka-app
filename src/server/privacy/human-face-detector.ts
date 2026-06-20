/**
 * Detector de caras real basado en `@vladmandic/human`.
 *
 * Se carga de forma PEREZOSA y con import dinámico para no acoplar el stack de
 * visión (tfjs + binarios) al bundle ni al lockfile/CI. Si los paquetes opcionales
 * (`@vladmandic/human`, backend de tfjs) no están instalados en el entorno, la
 * carga falla de forma controlada y el llamador (`pii-scrub`) aplica su política.
 *
 * Despliegue: instalar `@vladmandic/human` + `@tensorflow/tfjs-node` en una imagen
 * Debian (no Alpine) y servir los modelos de detección localmente
 * (`PII_FACE_MODELS_PATH`). Ver docs/legal/data-retention.md y la política.
 */
import type { FaceDetector, FaceBox } from './face-blur';

// Config mínima: solo el detector de caras, todo lo demás desactivado.
function buildConfig() {
  return {
    backend: 'tensorflow' as const,
    modelBasePath:
      process.env.PII_FACE_MODELS_PATH ?? 'file://node_modules/@vladmandic/human/models/',
    face: {
      enabled: true,
      detector: { rotation: false },
      mesh: { enabled: false },
      iris: { enabled: false },
      description: { enabled: false },
      emotion: { enabled: false },
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
  };
}

/**
 * Crea el detector real. Lanza si los paquetes opcionales no están disponibles
 * (el llamador decide si eso bloquea o degrada). Usa `import()` con nombre en
 * variable para que el bundler no intente resolverlo en build.
 */
export async function createHumanFaceDetector(): Promise<FaceDetector> {
  const humanPkg = '@vladmandic/human';
  const mod = (await import(/* @vite-ignore */ humanPkg)) as {
    default: new (config: unknown) => HumanLike;
  };
  const Human = mod.default;
  const human = new Human(buildConfig());
  await human.load();

  return {
    async detect(image: Buffer): Promise<FaceBox[]> {
      const tensor = human.tf.node.decodeImage(new Uint8Array(image), 3);
      try {
        const result = await human.detect(tensor);
        return result.face.map((f) => f.box);
      } finally {
        human.tf.dispose(tensor);
      }
    },
  };
}

// Forma mínima de la API de Human que usamos (evita depender del tipo del paquete).
interface HumanLike {
  tf: {
    node: { decodeImage(data: Uint8Array, channels: number): unknown };
    dispose(t: unknown): void;
  };
  load(): Promise<void>;
  detect(input: unknown): Promise<{ face: Array<{ box: FaceBox }> }>;
}
