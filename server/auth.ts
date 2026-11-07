import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { DB } from "./db.js";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const id = () => randomBytes(12).toString("hex");
export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { statusCode: status });
}
export function password(value: string, salt: string) {
  return scryptSync(value, salt, 64).toString("hex");
}
export async function accounts(db: DB) {
  await db.tx(async (q) => {
    await q(
      `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL);`,
    );
    await q(
      `CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,expires TIMESTAMPTZ NOT NULL)`,
    );
  });
  if (process.env.SEED_DEMO === "false") return;
  const secret = process.env.DEMO_PASSWORD || "Portfolio!2026";
  for (const [uid, email, name, role] of [
    ["admin", "admin@example.test", "عبدالمجيد", "admin"],
    ["staff", "staff@example.test", "سارة", "staff"],
    ["guest", "guest@example.test", "ضيف", "staff"],
  ]) {
    await db.tx(async (q) => {
      const salt = id();
      await q(
        "INSERT INTO users VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
        [uid, email, name, role, salt, password(secret, salt)],
      );
    });
  }
}
export async function signIn(db: DB, email: string, secret: string) {
  return db.tx(async (q) => {
    const [u] = await q("SELECT * FROM users WHERE email=$1", [
      email.toLowerCase(),
    ]);
    const expected = u?.password ?? password("invalid", "dummy");
    const actual = password(secret, u?.salt ?? "dummy");
    if (
      !u ||
      !timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"))
    )
      fail("البريد أو كلمة المرور غير صحيحة", 401);
    const token = randomBytes(32).toString("hex");
    await q("DELETE FROM sessions WHERE expires < NOW()");
    await q("INSERT INTO sessions VALUES($1,$2,NOW()+ INTERVAL '12 hours')", [
      hash(token),
      u.id,
    ]);
    return {
      token,
      user: { id: u.id, name: u.name, email: u.email, role: u.role },
    };
  });
}
export async function identify(db: DB, authorization?: string) {
  const token = authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) fail("سجّل الدخول للمتابعة", 401);
  return db.tx(async (q) => {
    const [u] = await q(
      "SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires>NOW()",
      [hash(token)],
    );
    if (!u) fail("انتهت الجلسة، سجّل الدخول مجددًا", 401);
    return u;
  });
}
export function admin(u: any) {
  if (u.role !== "admin") fail("هذه العملية متاحة للمدير فقط", 403);
}
