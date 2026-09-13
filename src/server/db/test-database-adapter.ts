import { PrismaPg } from '@prisma/adapter-pg';
import {
  assertTestDatabaseUrl,
  TEST_DATABASE_MARKER_SQL,
  verifyTestDatabaseMarker,
} from './test-database-guard';

/** Prisma receives no usable adapter until the isolated database is identified. */
export class TestDatabaseAdapter extends PrismaPg {
  constructor(private readonly testUrl: string) {
    assertTestDatabaseUrl(testUrl);
    super({ connectionString: testUrl });
  }

  override async connect() {
    assertTestDatabaseUrl(this.testUrl);
    const adapter = await super.connect();
    try {
      await verifyTestDatabaseMarker(this.testUrl, async () => {
        const result = await adapter.queryRaw({
          sql: TEST_DATABASE_MARKER_SQL,
          args: [],
          argTypes: [],
        });
        return result.rows.map((row) => ({ database: row[0], marker: row[1] }));
      });
      return adapter;
    } catch (error) {
      await adapter.dispose();
      throw error;
    }
  }
}
