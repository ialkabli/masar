import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpLeft,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  Activity,
  Menu,
  X,
} from "lucide-react";
import { Workspace } from "./workspace";
import "./style.css";
export const money = (n: number) =>
  new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(n / 100);
export const date = (s: string) =>
  new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    calendar: "gregory",
  }).format(new Date(s));
export type API = (path: string, method?: string, body?: any) => Promise<any>;
export function App() {
  const [token, setToken] = useState(""),
    [user, setUser] = useState<any>(null),
    [email, setEmail] = useState("admin@example.test"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [menu, setMenu] = useState(false);
  const api: API = async (path, method = "GET", body) => {
    const form = body instanceof FormData;
    const r = await fetch("/api" + path, {
      method,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(!form && body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 401 && token) {
        setToken("");
        setUser(null);
      }
      throw Error(data.error || "تعذر تنفيذ الطلب");
    }
    return data;
  };
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(""), 5000);
    return () => clearTimeout(timer);
  }, [note]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/login", "POST", { email, password });
      setToken(r.token);
      setUser(r.user);
      setPassword("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <main className="login">
        <div className="login-art">
          <div className="brand">
            <span className="brand-symbol">مـ</span> مسار<small>MASAR</small>
          </div>
          <span className="eyebrow">BUILT FOR THE WAY YOU WORK</span>
          <h1>لفريقك وجهة. ولكل فكرة مسار.</h1>
          <p>مساحة واحدة تجمع المشاريع والمهام وأحاديث الفريق.</p>
          <div className="orbit">
            <span>مـ</span>
          </div>
          <div className="login-foot">
            تصميم وتطوير · عبدالمجيد حسن كابلي <span>01 / PORTFOLIO</span>
          </div>
        </div>
        <section className="login-panel">
          <span className="eyebrow">مساحة العمل / MASAR</span>
          <h2>أهلًا بعودتك.</h2>
          <p className="muted">سجّل الدخول للوصول إلى مساحة عملك.</p>
          <form onSubmit={login}>
            <label>
              البريد الإلكتروني
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </label>
            <label>
              كلمة المرور
              <input
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "جارٍ الدخول…" : "دخول إلى مساحة العمل"}
              <ArrowUpLeft size={18} />
            </button>
          </form>
          <aside className="demo">
            <ShieldCheck size={20} />
            <div>
              <strong>نسخة محلية للتجربة</strong>
              <p>
                المدير: admin@example.test
                <br />
                الموظف: staff@example.test
                <br />
                كلمة مرور التجربة: <bdi>Portfolio!2026</bdi>
                <br />
                حسابات مشتركة للعرض، استخدم بيانات تجريبية.
              </p>
            </div>
          </aside>
        </section>
      </main>
    );
  return (
    <div className="app">
      <button
        className="mobile-menu"
        aria-label="القائمة"
        aria-expanded={menu}
        aria-controls="workspace-navigation"
        onClick={() => setMenu(!menu)}
      >
        {menu ? <X /> : <Menu />}
      </button>
      <aside id="workspace-navigation" className={"sidebar " + (menu ? "open" : "")}>
        <div className="brand">
          <span className="brand-symbol">مـ</span> مسار<small>MASAR</small>
        </div>
        <div className="nav-label">مساحة العمل</div>
        <a
          className="nav-item active"
          href="#workspace"
          onClick={() => setMenu(false)}
        >
          <LayoutDashboard size={19} /> المشاريع والفريق<span>01</span>
        </a>
        <div className="sidebar-note">
          <Activity size={20} />
          <strong>كل التفاصيل في مكان واحد.</strong>
          <p>مساحة واحدة تجمع المشاريع والمهام وأحاديث الفريق.</p>
        </div>
        <div className="profile">
          <div className="avatar">{user.name[0]}</div>
          <div>
            <strong>{user.name}</strong>
            <small>
              {user.role === "admin" ? "مدير النظام" : "عضو الفريق"}
            </small>
          </div>
          <button
            className="icon"
            aria-label="تسجيل الخروج"
            onClick={async () => {
              try {
                await api("/logout", "POST");
                setToken("");
                setUser(null);
              } catch (e: any) {
                setNote(e.message);
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="main" id="workspace">
        <header className="topbar">
          <span>
            مساحة العمل <span className="muted">/ مسار</span>
          </span>
          <span className="status-dot">تشغيل محلي · بيانات تجريبية</span>
        </header>
        <Workspace api={api} user={user} notify={setNote} />
        <footer>
          MASAR · مشروع برمجي تجريبي <span>صُنع بعناية · iprigner</span>
        </footer>
      </main>
      {note && (
        <div className="toast" role="status">
          {note}
        </div>
      )}
    </div>
  );
}
export function Heading({ tag, title, description, children }: any) {
  return (
    <section className="page-heading">
      <div>
        <span className="eyebrow">{tag}</span>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </section>
  );
}
export function Metric({ label, value, hint }: any) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}
export function Empty({ children }: any) {
  return (
    <div className="empty">
      <span>↗</span>
      <p>{children}</p>
    </div>
  );
}
export function Field({ label, children }: any) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
export type Props = { api: API; user: any; notify: (s: string) => void };
createRoot(document.getElementById("root")!).render(<App />);
