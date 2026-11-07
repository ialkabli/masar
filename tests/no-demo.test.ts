import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/index.js";

test("an empty database starts without dangling demo memberships when seeding is disabled", async () => {
  process.env.SEED_DEMO = "false";
  const app = await createApp(":memory:");
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { email: "admin@example.test", password: "Portfolio!2026" },
    });
    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
    delete process.env.SEED_DEMO;
  }
});
