/**
 * Fábrica pura del registry de add-ons.
 *
 * Sin lógica de UI ni carga dinámica: solo un mapa id → definición con
 * registro/consulta/listado y validación de `sdkVersion`. Validar el semver al
 * registrar evita que un add-on incompatible entre silenciosamente al sistema.
 */
import type { AddonDefinition } from './types';

export interface AddonRegistry {
  /** Registra un add-on. Lanza si el id ya existe o el `sdkVersion` es inválido. */
  register(def: AddonDefinition): void;
  /** Devuelve la definición por id, o `undefined` si no está registrada. */
  get(id: string): AddonDefinition | undefined;
  /** Lista todas las definiciones registradas. */
  list(): AddonDefinition[];
}

/** Acepta semver básico `MAJOR.MINOR.PATCH` con prerelease opcional. */
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function createAddonRegistry(): AddonRegistry {
  const byId = new Map<string, AddonDefinition>();

  return {
    register(def) {
      if (!SEMVER.test(def.sdkVersion)) {
        throw new Error(`sdkVersion inválido para add-on "${def.id}": ${def.sdkVersion}`);
      }
      if (byId.has(def.id)) {
        throw new Error(`add-on duplicado: ${def.id}`);
      }
      byId.set(def.id, def);
    },
    get(id) {
      return byId.get(id);
    },
    list() {
      return [...byId.values()];
    },
  };
}
