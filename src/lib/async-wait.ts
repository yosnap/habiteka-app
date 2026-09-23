/**
 * Esperas acotadas.
 *
 * Existe porque un botón que dice «Preparando…» para siempre es peor que un
 * error: el usuario no sabe si esperar, cancelar o recargar. Todo lo que la
 * interfaz espera de la escena 3D (que tarda segundos en cargar y captura
 * contra WebGL) pasa por aquí, con un plazo y un mensaje legible.
 *
 * Es código puro salvo por el reloj y el temporizador, que se pueden inyectar.
 */

export interface WaitUntilOptions {
  /** Plazo total; al agotarse se lanza `message`. */
  timeoutMs: number;
  /** Cada cuánto se vuelve a comprobar la condición. */
  pollMs?: number;
  /** Mensaje del error cuando vence el plazo; se enseña tal cual al usuario. */
  message: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Espera a que `isReady` sea cierto, sondeando, y falla con un mensaje legible
 * si no ocurre dentro del plazo. Nunca se queda esperando indefinidamente.
 */
export async function waitUntil(
  isReady: () => boolean,
  { timeoutMs, pollMs = 100, message, now = Date.now, sleep = realSleep }: WaitUntilOptions,
): Promise<void> {
  const deadline = now() + timeoutMs;
  while (!isReady()) {
    if (now() >= deadline) throw new Error(message);
    await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
  }
}

/**
 * Acota una promesa ajena. La tarea original sigue su curso (no se puede
 * cancelar una captura de WebGL a medias), pero quien espera deja de hacerlo.
 */
export function withTimeout<T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause: unknown) => {
        clearTimeout(timer);
        reject(cause instanceof Error ? cause : new Error(String(cause)));
      },
    );
  });
}
