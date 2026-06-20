import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Datos de arranque idempotentes: el mapeo acción→modelo de IA y los ajustes de
// sistema base. Se ejecuta tras migrar; usa `upsert` para poder re-correrse.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida');
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Mapeo de arranque de cada acción de IA a su modelo primario y respaldos. Son
// valores editables luego desde el back-office; aquí solo el punto de partida.
const MODEL_DEFAULTS = [
  {
    action: 'vision',
    primaryModel: 'google/gemini-2.5-flash',
    fallbacks: ['anthropic/claude-3.7-sonnet'],
  },
  { action: 'chat', primaryModel: 'anthropic/claude-3.7-sonnet', fallbacks: ['openai/gpt-4o'] },
  { action: 'plano2d', primaryModel: 'anthropic/claude-3.7-sonnet', fallbacks: ['openai/gpt-4o'] },
  { action: 'render3d', primaryModel: 'black-forest-labs/flux-1.1-pro', fallbacks: [] },
  { action: 'inpaint', primaryModel: 'black-forest-labs/flux-1.1-pro', fallbacks: [] },
  { action: 'memoria', primaryModel: 'anthropic/claude-3.7-sonnet', fallbacks: ['openai/gpt-4o'] },
] as const;

// Ajustes de sistema base (límites/cuotas). El cupo de bienvenida es finito por
// cuenta; su valor es configurable, no se codifica en la lógica de negocio.
const SYSTEM_SETTINGS = [
  { key: 'welcome_credits', value: 100 },
  { key: 'accounts_per_origin_limit', value: 3 },
  { key: 'free_feedback_iterations', value: 2 },
] as const;

async function main() {
  for (const m of MODEL_DEFAULTS) {
    await prisma.modelConfig.upsert({
      where: { action: m.action },
      update: {},
      create: { action: m.action, primaryModel: m.primaryModel, fallbacks: [...m.fallbacks] },
    });
  }

  for (const s of SYSTEM_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
