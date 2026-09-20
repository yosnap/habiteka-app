const MARKER = 'habiteka-isolated-test-v1';

/** Validar antes de crear clientes; nunca incluir la URL en errores. */
export function assertTestDatabaseUrl(value: string | undefined): string {
  let url: URL;
  try {
    url = new URL(value ?? '');
  } catch {
    throw new Error('Destino de pruebas no autorizado');
  }
  const database = url.pathname.slice(1);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^habiteka_test(?:_[a-z0-9_]+)?$/.test(database) ||
    url.search ||
    url.hash
  ) {
    throw new Error('Destino de pruebas no autorizado');
  }
  return database;
}

export const TEST_DATABASE_MARKER_SQL =
  "SELECT current_database() AS database, shobj_description(oid, 'pg_database') AS marker " +
  'FROM pg_database WHERE datname = current_database()';

export async function verifyTestDatabaseMarker(
  value: string | undefined,
  query: () => Promise<unknown>,
): Promise<void> {
  const database = assertTestDatabaseUrl(value);
  const rows = await query();
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    rows[0]?.database !== database ||
    rows[0]?.marker !== MARKER
  ) {
    throw new Error('Base de pruebas sin marcador de aislamiento válido');
  }
}

export function isTestProcess(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    process.env.HABITEKA_TEST_RUN === '1'
  );
}
