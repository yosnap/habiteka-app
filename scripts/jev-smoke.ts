/**
 * Prueba real de Jev contra la API de TypeSafe con la clave guardada en el panel
 * de admin (BD de desarrollo). Imprime score, decisión y coste; nunca la clave.
 *
 *   set -a && source .env.local && set +a && bun --conditions=react-server scripts/jev-smoke.ts
 *
 * La condición `react-server` es necesaria porque el cliente de Jev es
 * server-only; sin ella Bun lo resuelve como módulo de cliente y aborta.
 */
import { prisma } from '../src/server/db/prisma';
import { openSecret } from '../src/server/security/secret-box';
import { PETICION_MINIMA, type PeticionEvidence } from '../src/server/quality/checkpoints';
import { askJev, TYPESAFE_PROVIDER, type JevQuestion } from '../src/server/quality/jev-client';
import { combineAnswers, decide, DEFAULT_THRESHOLDS } from '../src/server/quality/scoring';

const EVIDENCIA: PeticionEvidence = {
  descripcion: 'Reforma integral de un piso de dos dormitorios: cocina abierta al salón y baño nuevo.',
  superficieM2: 78,
  estancias: 5,
};

async function main(): Promise<void> {
  const credential = await prisma.aiProviderCredential.findUnique({
    where: { provider: TYPESAFE_PROVIDER },
  });
  if (!credential?.enabled) {
    console.log('No hay clave de Jev (TypeSafe) configurada o está desactivada: nada que probar.');
    return;
  }

  const questions = Object.fromEntries(
    Object.entries(PETICION_MINIMA.questions).map(([id, spec]) => [id, spec.build(EVIDENCIA)]),
  ) as Record<string, JevQuestion>;

  const result = await askJev(PETICION_MINIMA.buildState(EVIDENCIA), questions, {
    apiKey: openSecret(credential.encryptedApiKey),
  });
  const combined = combineAnswers(PETICION_MINIMA, questions, result.answers);

  console.log(`Modelo: ${result.model}`);
  console.log(`Score: ${combined.score ?? 'sin respuestas utilizables'}`);
  console.log(
    `Decisión: ${combined.score === null ? 'confirm (fail-closed)' : decide(combined.score, DEFAULT_THRESHOLDS)}`,
  );
  console.log(`Confianza: ${combined.confidence?.toFixed(2) ?? '—'}`);
  console.log(`Motivos: ${combined.reasons.join(' · ') || '—'}`);
  console.log(`Tokens de entrada: ${result.inputTokens} · Coste: ${result.costUsd.toFixed(8)} $`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Fallo al probar Jev.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
