import type { ModelAction } from '@/generated/prisma/enums';
import type { ModelBackup, UpdateModelInput } from './model-config-ops';

type ProfileConfiguration = UpdateModelInput;

export interface ModelProfile {
  id: string;
  name: string;
  description: string;
  configurations: ProfileConfiguration[];
}

const openRouter = (
  action: ModelAction,
  primaryModel: string,
  backups: ModelBackup[] = [],
): ProfileConfiguration => ({
  action,
  primaryModel,
  enabled: true,
  provider: 'openrouter',
  backups,
});

/** Perfiles operativos: sólo modelos que el adaptador actual puede ejecutar. */
export const MODEL_PROFILES = {
  balanced: {
    id: 'balanced',
    name: 'Equilibrado',
    description: 'Calidad sólida para el uso diario con coste contenido.',
    configurations: [
      openRouter('vision', 'google/gemini-3.7-flash'),
      openRouter('chat', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
      openRouter('plano2d', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
      {
        action: 'render3d',
        primaryModel: 'nano-banana-2-lite',
        provider: 'kie',
        enabled: true,
        backups: [{ model: 'google/gemini-3.1-flash-image', provider: 'openrouter' }],
      },
      {
        action: 'inpaint',
        primaryModel: 'nano-banana-2-lite',
        provider: 'kie',
        enabled: true,
        backups: [{ model: 'google/gemini-3.1-flash-image', provider: 'openrouter' }],
      },
      openRouter('memoria', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
    ],
  },
  professional: {
    id: 'professional',
    name: 'Calidad profesional',
    description: 'Prioriza la fidelidad visual en renders y ediciones; coste superior.',
    configurations: [
      openRouter('vision', 'google/gemini-3.7-flash'),
      openRouter('chat', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
      openRouter('plano2d', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
      {
        action: 'render3d',
        primaryModel: 'nano-banana-pro',
        provider: 'kie',
        enabled: true,
        backups: [{ model: 'google/gemini-3-pro-image', provider: 'openrouter' }],
      },
      {
        action: 'inpaint',
        primaryModel: 'nano-banana-pro',
        provider: 'kie',
        enabled: true,
        backups: [{ model: 'google/gemini-3-pro-image', provider: 'openrouter' }],
      },
      openRouter('memoria', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
    ],
  },
  structural_render: {
    id: 'structural_render',
    name: 'Render estructural profesional',
    description:
      'Máxima fidelidad para renders desde planos: FLUX.2 Flex con referencias de planta y estructura.',
    configurations: [
      openRouter('vision', 'google/gemini-3.7-flash'),
      openRouter('chat', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
      openRouter('plano2d', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
      {
        action: 'render3d',
        primaryModel: 'flux-2/flex-image-to-image',
        provider: 'kie',
        enabled: true,
        backups: [
          { model: 'flux-2/pro-image-to-image', provider: 'kie' },
          { model: 'google/gemini-3-pro-image', provider: 'openrouter' },
        ],
      },
      {
        action: 'inpaint',
        primaryModel: 'flux-2/flex-image-to-image',
        provider: 'kie',
        enabled: true,
        backups: [
          { model: 'flux-2/pro-image-to-image', provider: 'kie' },
          { model: 'google/gemini-3-pro-image', provider: 'openrouter' },
        ],
      },
      openRouter('memoria', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
    ],
  },
  gpt_25_architecture_validation: {
    id: 'gpt_25_architecture_validation',
    name: 'Validación arquitectónica GPT 2.5',
    description:
      'Prueba de máxima precisión con GPT Image 2.5 Sunburst y referencias de planta y estructura.',
    configurations: [
      openRouter('vision', 'google/gemini-3.7-flash'),
      openRouter('chat', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
      openRouter('plano2d', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
      {
        // Un A/B real (mismo dormitorio, misma cámara, mismo prompt) dio calidad
        // equivalente entre Flare y Sunburst, a mitad de coste por imagen: para
        // generar de cero manda Flare y Sunburst queda de respaldo. La edición
        // (`inpaint`) sigue en Sunburst, que es donde sí se nota.
        action: 'render3d',
        primaryModel: 'gpt-image-2-5-flare-image-to-image',
        provider: 'kie',
        enabled: true,
        backups: [
          { model: 'gpt-image-2-5-sunburst-image-to-image', provider: 'kie' },
          { model: 'flux-2/flex-image-to-image', provider: 'kie' },
          { model: 'flux-2/pro-image-to-image', provider: 'kie' },
          { model: 'google/gemini-3-pro-image', provider: 'openrouter' },
        ],
      },
      {
        action: 'inpaint',
        primaryModel: 'gpt-image-2-5-sunburst-image-to-image',
        provider: 'kie',
        enabled: true,
        backups: [
          { model: 'flux-2/flex-image-to-image', provider: 'kie' },
          { model: 'flux-2/pro-image-to-image', provider: 'kie' },
          { model: 'google/gemini-3-pro-image', provider: 'openrouter' },
        ],
      },
      openRouter('memoria', 'anthropic/claude-sonnet-5', [
        { model: 'openai/gpt-5.2-chat', provider: 'openrouter' },
      ]),
    ],
  },
} satisfies Record<string, ModelProfile>;
