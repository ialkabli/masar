import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
export type Query = (sql: string, params?: any[]) => Promise<any[]>;
export async function database(location: string) {
  const remote = /^postgres(ql)?:/.test(location);
  if (!remote && location !== ":memory:")
    await mkdir(dirname(location), { recursive: true });
  const engine: any = remote
    ? new pg.Pool({ connectionString: location, max: 8 })
    : new PGlite(location === ":memory:" ? undefined : location);
  let tail = Promise.resolve();
  // PGlite owns one connection. Queue complete transactions, never individual statements.
  async function tx<T>(work: (query: Query) => Promise<T>): Promise<T> {
    let release: (() => void) | undefined;
    if (!remote) {
      const previous = tail;
      tail = new Promise<void>((r) => (release = r));
      await previous;
    }
    let client: any,
      begun = false;
    try {
      client = remote ? await engine.connect() : engine;
      const query: Query = async (sql, params = []) =>
        (await client.query(sql, params)).rows;
      await client.query("BEGIN");
      begun = true;
      const result = await work(query);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      if (begun) await client.query("ROLLBACK");
      throw e;
    } finally {
      if (remote && client) client.release();
      release?.();
    }
  }
  return {
    tx,
    close: async () => {
      await tail;
      if (remote) await engine.end();
      else await engine.close();
    },
  };
}
export type DB = Awaited<ReturnType<typeof database>>;
