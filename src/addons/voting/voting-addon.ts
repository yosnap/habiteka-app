/**
 * Definición del add-on de votación, registrado contra el registry de add-ons.
 *
 * Se declara con las mismas interfaces que usaría un tercero: el add-on se engancha
 * en los puntos de extensión post-entrega (para abrir una sala desde un diseño
 * aprobado) y en las capas del canvas. No hay carga dinámica de plugins (no hace
 * falta todavía); el registro valida que el add-on encaja en los slots previstos.
 */
import {
  createAddonRegistry,
  type AddonDefinition,
  type AddonRegistry,
} from '@/lib/addons/registry';

export const VOTING_ADDON: AddonDefinition = {
  id: 'voting',
  name: 'Votación comunitaria',
  sdkVersion: '1.0.0',
  slots: ['agent.postEntrega', 'canvas.layers'],
};

/** Registra el add-on de votación en un registry (nuevo o el provisto). */
export function registerVotingAddon(
  registry: AddonRegistry = createAddonRegistry(),
): AddonRegistry {
  registry.register(VOTING_ADDON);
  return registry;
}
