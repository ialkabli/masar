import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/index.js";
let app: Awaited<ReturnType<typeof createApp>>;
let adminToken: string, staffToken: string, guestToken: string;
async function call(
  path: string,
  method: any = "GET",
  payload?: any,
  token = adminToken,
) {
  return app.inject({
    method,
    url: "/api" + path,
    payload,
    headers: token ? { authorization: "Bearer " + token } : {},
  });
}
before(async () => {
  app = await createApp(process.env.TEST_DATABASE_URL || ":memory:");
  await app.ready();
  for (const [email, set] of [
    ["admin", (s: string) => (adminToken = s)],
    ["staff", (s: string) => (staffToken = s)],
    ["guest", (s: string) => (guestToken = s)],
  ] as const) {
    const r = await call(
      "/login",
      "POST",
      { email: email + "@example.test", password: "Portfolio!2026" },
      "",
    );
    assert.equal(r.statusCode, 200, r.body);
    set(r.json().token);
  }
});
after(async () => {
  if (app) await app.close();
});
test("authentication, invalid login, and cross-origin rejection", async () => {
  assert.equal((await call("/me", "GET", undefined, "")).statusCode, 401);
  assert.equal(
    (
      await call(
        "/login",
        "POST",
        { email: "admin@example.test", password: "wrong" },
        "",
      )
    ).statusCode,
    401,
  );
  const r = await app.inject({
    method: "POST",
    url: "/api/logout",
    headers: {
      authorization: "Bearer " + adminToken,
      origin: "https://untrusted.test",
    },
  });
  assert.equal(r.statusCode, 403);
  assert.equal((await call("/me")).json().user.role, "admin");
});

test("tenant isolation and workspace ownership are enforced", async () => {
  assert.equal(
    (await call("/workspaces/w1", "GET", undefined, guestToken)).statusCode,
    404,
  );
  assert.equal(
    (await call("/tasks/t1/comments", "GET", undefined, guestToken)).statusCode,
    404,
  );
  assert.equal(
    (
      await call(
        "/workspaces/w1/members",
        "POST",
        { email: "guest@example.test" },
        staffToken,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        "/tasks/t2",
        "PATCH",
        { status: "done", version: 1 },
        staffToken,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        "/workspaces/w1/tasks",
        "POST",
        { title: "مهمة لآخر", priority: "low", assignee: "admin" },
        staffToken,
      )
    ).statusCode,
    403,
  );
  const workspace = (
    await call("/workspaces", "POST", { name: "مساحة مستقلة" }, guestToken)
  ).json();
  assert.equal((await call("/workspaces/" + workspace.id)).statusCode, 404);
});
test("team assignment, comments, notifications and optimistic concurrency", async () => {
  const r = await call("/workspaces/w1/tasks", "POST", {
    title: "مهمة اختبار",
    priority: "high",
    assignee: "staff",
  });
  assert.equal(r.statusCode, 200, r.body);
  const t = r.json();
  const updates = await Promise.all([
    call(
      "/tasks/" + t.id,
      "PATCH",
      { status: "doing", version: 1 },
      staffToken,
    ),
    call("/tasks/" + t.id, "PATCH", { status: "done", version: 1 }, staffToken),
  ]);
  assert.deepEqual(updates.map((x) => x.statusCode).sort(), [200, 409]);
  assert.equal(
    (
      await call(
        "/tasks/" + t.id + "/comments",
        "POST",
        { body: "نقاش الفريق" },
        staffToken,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (await call("/tasks/" + t.id + "/comments")).json().comments[0].body,
    "نقاش الفريق",
  );
  assert.ok(
    (await call("/notifications", "GET", undefined, staffToken))
      .json()
      .notifications.some((n: any) => n.message.includes("مهمة اختبار")),
  );
  await call("/notifications/read", "POST", {}, staffToken);
  assert.ok(
    (await call("/notifications", "GET", undefined, staffToken))
      .json()
      .notifications.every((n: any) => n.seen),
  );
  assert.equal(
    (
      await call("/workspaces/w1/members", "POST", {
        email: "guest@example.test",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await call("/workspaces/w1", "GET", undefined, guestToken)).statusCode,
    200,
  );
});

test("logging out revokes the bearer token", async () => {
  const login = await call(
    "/login",
    "POST",
    { email: "guest@example.test", password: "Portfolio!2026" },
    "",
  );
  const token = login.json().token;
  assert.equal((await call("/logout", "POST", {}, token)).statusCode, 200);
  assert.equal((await call("/me", "GET", undefined, token)).statusCode, 401);
});
