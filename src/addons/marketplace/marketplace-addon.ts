/**
 * Definición del add-on de marketplace, registrado contra el registry de add-ons.
 *
 * Se engancha en la barra del canvas (paleta de productos arrastrables) y en el
 * punto post-entrega (sugerencias según el diseño aprobado), con las mismas
 * interfaces que usaría un tercero.
 */
import {
  createAddonRegistry,
  type AddonDefinition,
  type AddonRegistry,
} from '@/lib/addons/registry';

export const MARKETPLACE_ADDON: AddonDefinition = {
  id: 'marketplace',
  name: 'Marketplace',
  sdkVersion: '1.0.0',
  slots: ['canvas.toolbar', 'agent.postEntrega'],
};

export function registerMarketplaceAddon(
  registry: AddonRegistry = createAddonRegistry(),
): AddonRegistry {
  registry.register(MARKETPLACE_ADDON);
  return registry;
}
