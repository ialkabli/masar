import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { database } from "../server/db.js";

test("database persists committed records and rolls back failed transactions", async () => {
  const parent = resolve("data/test-runs");
  await mkdir(parent, { recursive: true });
  const path = await mkdtemp(parent + "/db-");
  const db = await database(path);
  await db.tx(async (q) => {
    await q("CREATE TABLE records(id INT PRIMARY KEY,label TEXT NOT NULL)");
    await q("INSERT INTO records VALUES(1,'persisted')");
  });
  await assert.rejects(
    db.tx(async (q) => {
      await q("INSERT INTO records VALUES(2,'rolled back')");
      throw Error("abort");
    }),
  );
  await db.close();
  const reopened = await database(path);
  try {
    const rows = await reopened.tx((q) =>
      q("SELECT * FROM records ORDER BY id"),
    );
    assert.deepEqual(rows, [{ id: 1, label: "persisted" }]);
  } finally {
    await reopened.close();
  }
});
