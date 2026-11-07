import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DB, Query } from "./db.js";
import { fail, id } from "./auth.js";
async function member(q: Query, wid: string, uid: string, lead = false) {
  const [m] = await q(
    "SELECT * FROM members WHERE workspace_id=$1 AND user_id=$2",
    [wid, uid],
  );
  if (!m) fail("مساحة العمل غير متاحة", 404);
  if (lead && m.role !== "owner") fail("العملية متاحة لمالك المساحة فقط", 403);
  return m;
}
export async function domain(app: FastifyInstance, db: DB) {
  await db.tx(async (q) => {
    await q(
      "CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,created TIMESTAMPTZ DEFAULT NOW())",
    );
    await q(
      "CREATE TABLE IF NOT EXISTS members(workspace_id TEXT REFERENCES workspaces(id),user_id TEXT REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('owner','member')),PRIMARY KEY(workspace_id,user_id))",
    );
    await q(
      "CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),title TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('todo','doing','done')),priority TEXT NOT NULL CHECK(priority IN ('low','medium','high')),assignee TEXT REFERENCES users(id),version INT NOT NULL DEFAULT 1,created TIMESTAMPTZ DEFAULT NOW())",
    );
    await q(
      "CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY,task_id TEXT REFERENCES tasks(id),user_id TEXT REFERENCES users(id),body TEXT NOT NULL,created TIMESTAMPTZ DEFAULT NOW())",
    );
    await q(
      "CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),actor TEXT REFERENCES users(id),message TEXT NOT NULL,created TIMESTAMPTZ DEFAULT NOW())",
    );
    await q(
      "CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),message TEXT NOT NULL,seen BOOLEAN NOT NULL DEFAULT FALSE,created TIMESTAMPTZ DEFAULT NOW())",
    );
    if (process.env.SEED_DEMO === "false") return;
    await q(
      "INSERT INTO workspaces(id,name) VALUES('w1','إطلاق الهوية الرقمية') ON CONFLICT DO NOTHING",
    );
    await q(
      "INSERT INTO members VALUES('w1','admin','owner'),('w1','staff','member') ON CONFLICT DO NOTHING",
    );
    for (const [tid, title, status, priority, assignee] of [
      ["t1", "مراجعة تجربة الصفحة الرئيسية", "todo", "high", "staff"],
      ["t2", "تطوير واجهة تسجيل الدخول", "doing", "medium", "admin"],
      ["t3", "إعداد دليل الهوية", "done", "low", "staff"],
    ])
      await q(
        "INSERT INTO tasks(id,workspace_id,title,status,priority,assignee) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
        [tid, "w1", title, status, priority, assignee],
      );
  });
  app.get("/api/workspaces", async (req) =>
    db.tx(async (q) => ({
      workspaces: await q(
        "SELECT w.*,m.role FROM workspaces w JOIN members m ON m.workspace_id=w.id WHERE m.user_id=$1 ORDER BY w.created",
        [req.user.id],
      ),
    })),
  );
  app.post("/api/workspaces", async (req) => {
    const b = z
      .object({ name: z.string().trim().min(2).max(100) })
      .parse(req.body);
    return db.tx(async (q) => {
      const wid = id();
      await q("INSERT INTO workspaces(id,name) VALUES($1,$2)", [wid, b.name]);
      await q("INSERT INTO members VALUES($1,$2,'owner')", [wid, req.user.id]);
      return { id: wid, name: b.name };
    });
  });
  app.get("/api/workspaces/:id", async (req) =>
    db.tx(async (q) => {
      const wid = (req.params as any).id;
      const m = await member(q, wid, req.user.id);
      return {
        role: m.role,
        tasks: await q(
          "SELECT t.*,u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id=t.assignee WHERE workspace_id=$1 ORDER BY created",
          [wid],
        ),
        members: await q(
          "SELECT m.role,u.id,u.name,u.email FROM members m JOIN users u ON u.id=m.user_id WHERE workspace_id=$1",
          [wid],
        ),
        events: await q(
          "SELECT e.*,u.name FROM events e JOIN users u ON u.id=e.actor WHERE workspace_id=$1 ORDER BY created DESC LIMIT 50",
          [wid],
        ),
      };
    }),
  );
  app.post("/api/workspaces/:id/members", async (req) => {
    const b = z.object({ email: z.string().email().max(150) }).parse(req.body);
    return db.tx(async (q) => {
      const wid = (req.params as any).id;
      await member(q, wid, req.user.id, true);
      const [u] = await q("SELECT id FROM users WHERE email=$1", [
        b.email.toLowerCase(),
      ]);
      if (!u) fail("لا يوجد حساب مسجل بهذا البريد", 404);
      await q(
        "INSERT INTO members VALUES($1,$2,'member') ON CONFLICT DO NOTHING",
        [wid, u.id],
      );
      await q(
        "INSERT INTO notifications(id,user_id,message) VALUES($1,$2,$3)",
        [id(), u.id, "أُضيفت لك عضوية في مساحة عمل جديدة"],
      );
      return { ok: true };
    });
  });
  app.post("/api/workspaces/:id/tasks", async (req) => {
    const b = z
      .object({
        title: z.string().trim().min(2).max(200),
        priority: z.enum(["low", "medium", "high"]),
        assignee: z.string().min(1),
      })
      .parse(req.body);
    return db.tx(async (q) => {
      const wid = (req.params as any).id;
      const m = await member(q, wid, req.user.id);
      if (m.role !== "owner" && b.assignee !== req.user.id)
        fail("يمكن للعضو إنشاء مهام لنفسه فقط", 403);
      await member(q, wid, b.assignee);
      const [t] = await q(
        "INSERT INTO tasks(id,workspace_id,title,status,priority,assignee) VALUES($1,$2,$3,'todo',$4,$5) RETURNING *",
        [id(), wid, b.title, b.priority, b.assignee],
      );
      await q(
        "INSERT INTO notifications(id,user_id,message) VALUES($1,$2,$3)",
        [id(), b.assignee, "مهمة جديدة: " + b.title],
      );
      await q(
        "INSERT INTO events(id,workspace_id,actor,message) VALUES($1,$2,$3,$4)",
        [id(), wid, req.user.id, "إنشاء مهمة: " + b.title],
      );
      return t;
    });
  });
  app.patch("/api/tasks/:id", async (req) => {
    const b = z
      .object({
        status: z.enum(["todo", "doing", "done"]),
        version: z.number().int().min(1),
      })
      .parse(req.body);
    return db.tx(async (q) => {
      const [t] = await q("SELECT * FROM tasks WHERE id=$1 FOR UPDATE", [
        (req.params as any).id,
      ]);
      if (!t) fail("المهمة غير موجودة", 404);
      const m = await member(q, t.workspace_id, req.user.id);
      if (m.role !== "owner" && t.assignee !== req.user.id)
        fail("يمكنك تعديل مهامك فقط", 403);
      if (t.version !== b.version)
        fail("عدّل عضو آخر المهمة؛ حدّث البيانات أولًا", 409);
      const [updated] = await q(
        "UPDATE tasks SET status=$1,version=version+1 WHERE id=$2 RETURNING *",
        [b.status, t.id],
      );
      await q(
        "INSERT INTO events(id,workspace_id,actor,message) VALUES($1,$2,$3,$4)",
        [
          id(),
          t.workspace_id,
          req.user.id,
          "تحديث مهمة: " + t.title + " → " + b.status,
        ],
      );
      return updated;
    });
  });
  app.get("/api/tasks/:id/comments", async (req) =>
    db.tx(async (q) => {
      const [t] = await q("SELECT * FROM tasks WHERE id=$1", [
        (req.params as any).id,
      ]);
      if (!t) fail("المهمة غير موجودة", 404);
      await member(q, t.workspace_id, req.user.id);
      return {
        comments: await q(
          "SELECT c.*,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE task_id=$1 ORDER BY created",
          [t.id],
        ),
      };
    }),
  );
  app.post("/api/tasks/:id/comments", async (req) => {
    const b = z
      .object({ body: z.string().trim().min(1).max(2000) })
      .parse(req.body);
    return db.tx(async (q) => {
      const [t] = await q("SELECT * FROM tasks WHERE id=$1", [
        (req.params as any).id,
      ]);
      if (!t) fail("المهمة غير موجودة", 404);
      await member(q, t.workspace_id, req.user.id);
      return (
        await q(
          "INSERT INTO comments(id,task_id,user_id,body) VALUES($1,$2,$3,$4) RETURNING *",
          [id(), t.id, req.user.id, b.body],
        )
      )[0];
    });
  });
  app.get("/api/notifications", async (req) =>
    db.tx(async (q) => ({
      notifications: await q(
        "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created DESC LIMIT 30",
        [req.user.id],
      ),
    })),
  );
  app.post("/api/notifications/read", async (req) => {
    await db.tx((q) =>
      q("UPDATE notifications SET seen=TRUE WHERE user_id=$1", [req.user.id]),
    );
    return { ok: true };
  });
}
