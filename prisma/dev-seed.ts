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
