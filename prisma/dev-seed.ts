/**
 * Datos de desarrollo: un usuario administrador de prueba con su organización y
 * saldo, para poder navegar la app en local sin montar OAuth ni email. Se ejecuta
 * solo en desarrollo; nunca debe correrse contra producción.
 *
 * El usuario se crea a través del flujo de registro de la propia capa de auth (para
 * que el hash de contraseña sea válido) y luego se marca como verificado y admin.
 */
import { auth } from '../src/server/auth/auth';
import { prisma } from '../src/server/db/prisma';
import { provisionOrganization } from '../src/server/auth/provision-organization';
import { MODEL_DEFAULTS } from '../src/server/ai/model-defaults';
import { CANVAS_EXAMPLES } from '../src/canvas/examples';
import type { Prisma } from '../src/generated/prisma/client';

/**
 * Repara la configuración de modelos si algún test dejó datos corruptos en la BD
 * de desarrollo (p. ej. `primaryModel: "p"` o un `provider` de prueba). Repone los
 * valores por defecto cuando el modelo no parece un id válido (slug `vendor/modelo`).
 */
async function repairModelConfig(): Promise<void> {
  const rows = await prisma.modelConfig.findMany({
    select: { action: true, primaryModel: true, provider: true },
  });
  for (const row of rows) {
    const looksValid = /.+\/.+/.test(row.primaryModel) && !row.provider;
    if (looksValid) continue;
    const fallback = MODEL_DEFAULTS[row.action];
    if (!fallback) continue;
    await prisma.modelConfig.update({
      where: { action: row.action },
      data: {
        primaryModel: fallback.primaryModel,
        fallbacks: fallback.fallbacks,
        provider: fallback.provider,
      },
    });
    console.log(`🔧 ModelConfig '${row.action}' reparado → ${fallback.primaryModel}`);
  }
}

const DEV_EMAIL = 'admin@habiteka.dev';
const DEV_PASSWORD = 'habiteka-dev-1234';
const DEV_NAME = 'Admin Dev';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed de desarrollo no debe ejecutarse en producción');
  }

  const existing = await prisma.user.findUnique({ where: { email: DEV_EMAIL } });
  if (!existing) {
    // Registra al usuario por el flujo oficial (hash de contraseña correcto).
    await auth.api.signUpEmail({
      body: { email: DEV_EMAIL, password: DEV_PASSWORD, name: DEV_NAME },
    });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { email: DEV_EMAIL } });

  // En dev, marca el email como verificado y concede rol de administrador.
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, role: 'admin' },
  });

  // Aprovisiona su organización + saldo si aún no la tiene (idempotente).
  await provisionOrganization({ userId: user.id, userName: DEV_NAME, email: DEV_EMAIL });

  // Le da algo de saldo para poder probar acciones que cuestan créditos.
  const member = await prisma.member.findFirstOrThrow({ where: { userId: user.id } });
  await prisma.creditBalance.upsert({
    where: { organizationId: member.organizationId },
    update: { balance: 1000 },
    create: { organizationId: member.organizationId, balance: 1000 },
  });

  // Crea un proyecto de muestra (idempotente) para poder abrir el canvas sin
  // tener todavía una pantalla de "mis proyectos" en la UI.
  const sampleTitle = 'Proyecto de muestra';
  let project = await prisma.project.findFirst({
    where: { organizationId: member.organizationId, title: sampleTitle },
  });
  if (!project) {
    project = await prisma.project.create({
      data: { organizationId: member.organizationId, title: sampleTitle },
    });
  }

  // Crea proyectos con lienzos de ejemplo (idempotente) para mostrar el editor
  // con planos ya montados. La selección no se persiste.
  for (const example of CANVAS_EXAMPLES) {
    const existing = await prisma.project.findFirst({
      where: { organizationId: member.organizationId, title: example.title },
    });
    if (existing) continue;
    const exampleProject = await prisma.project.create({
      data: { organizationId: member.organizationId, title: example.title },
    });
    const { schemaVersion, objects } = example.doc;
    const canvasData = {
      schemaVersion,
      baseImage: null,
      strokes: [],
      objects,
      products: [],
      selection: null,
    } as unknown as Prisma.InputJsonValue;
    await prisma.canvasState.create({
      data: { projectId: exampleProject.id, data: canvasData },
    });
  }

  // Repara la config de modelos por si un test dejó datos corruptos en la BD.
  await repairModelConfig();

  const port = process.env.PORT ?? '3040';

  console.log('✅ Usuario de desarrollo listo:');
  console.log(`   email:    ${DEV_EMAIL}`);
  console.log(`   password: ${DEV_PASSWORD}`);
  console.log(`   rol:      admin · saldo: 1000 créditos`);
  console.log('🎨 Canvas de muestra:');
  console.log(`   http://localhost:${port}/projects/${project.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
