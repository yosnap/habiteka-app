/**
 * Los perfiles son lo que un administrador aplica de un clic: cada modelo debe
 * estar permitido para su acción y el reparto entre generar y editar imagen es
 * una decisión de coste que no puede cambiar sin querer.
 */
import { describe, expect, it } from 'vitest';
import { MODEL_PROFILES } from '@/server/admin/config/model-profiles';
import { isModelAllowed } from '@/server/admin/config/model-allowlist';

const profiles = Object.values(MODEL_PROFILES);

describe('perfiles de modelos', () => {
  it('solo usa modelos permitidos, también en los respaldos', () => {
    for (const profile of profiles) {
      for (const configuration of profile.configurations) {
        expect(
          isModelAllowed(configuration.action, configuration.primaryModel, configuration.provider),
          `${profile.id}/${configuration.action}: ${configuration.primaryModel}`,
        ).toBe(true);
        for (const backup of configuration.backups ?? [])
          expect(
            isModelAllowed(configuration.action, backup.model, backup.provider),
            `${profile.id}/${configuration.action} respaldo: ${backup.model}`,
          ).toBe(true);
      }
    }
  });

  it('genera con Flare y edita con Sunburst en el perfil de validación', () => {
    const { configurations } = MODEL_PROFILES.gpt_25_architecture_validation;
    const render = configurations.find((item) => item.action === 'render3d')!;
    const inpaint = configurations.find((item) => item.action === 'inpaint')!;
    // Misma calidad por la mitad de coste en la prueba A/B de generación.
    expect(render.primaryModel).toBe('gpt-image-2-5-flare-image-to-image');
    expect(render.backups?.[0]?.model).toBe('gpt-image-2-5-sunburst-image-to-image');
    expect(inpaint.primaryModel).toBe('gpt-image-2-5-sunburst-image-to-image');
  });
});
