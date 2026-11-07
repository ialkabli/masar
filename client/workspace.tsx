import React, { useEffect, useState } from "react";
import { Heading, Metric, Empty, Field, date, type Props } from "./main";
const states = [
  ["todo", "لم تبدأ"],
  ["doing", "قيد التنفيذ"],
  ["done", "مكتملة"],
];
export function Workspace({ api, user, notify }: Props) {
  const [spaces, setSpaces] = useState<any[]>([]),
    [wid, setWid] = useState(""),
    [data, setData] = useState<any>(null),
    [notes, setNotes] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState("board");
  const [spaceName, setSpaceName] = useState(""),
    [title, setTitle] = useState(""),
    [priority, setPriority] = useState("medium"),
    [assignee, setAssignee] = useState(user.id),
    [email, setEmail] = useState(""),
    [task, setTask] = useState<any>(null),
    [comments, setComments] = useState<any[]>([]),
    [comment, setComment] = useState("");
  async function loadSpaces() {
    const s = (await api("/workspaces")).workspaces;
    setSpaces(s);
    return s;
  }
  async function load(id = wid) {
    if (id) setData(await api("/workspaces/" + id));
    setNotes((await api("/notifications")).notifications);
  }
  async function act(work: () => Promise<any>, message = "") {
    setBusy(true);
    setError("");
    try {
      await work();
      if (message) notify(message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    act(async () => {
      const s = await loadSpaces();
      if (s[0]) {
        setWid(s[0].id);
        await load(s[0].id);
      }
    });
  }, []);
  async function selectTask(t: any) {
    setTask(t);
    setComments((await api("/tasks/" + t.id + "/comments")).comments);
    setComment("");
  }
  return (
    <>
      <Heading
        tag="GREAT WORK, TOGETHER"
        title="خطوة أقرب، كل يوم."
        description="مساحة مشتركة للمهام والقرارات، بصلاحيات واضحة لكل عضو."
      >
        <button
          className="secondary"
          disabled={busy}
          onClick={() => act(() => load(), "تم تحديث مساحة العمل")}
        >
          تحديث ↻
        </button>
      </Heading>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="form-grid">
          <Field label="مساحة العمل">
            <select
              value={wid}
              disabled={busy}
              onChange={(e) => {
                const value = e.target.value;
                setWid(value);
                setTask(null);
                act(() => load(value));
              }}
            >
              {spaces.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <form
            className="actions"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                const s = await api("/workspaces", "POST", { name: spaceName });
                await loadSpaces();
                setWid(s.id);
                await load(s.id);
                setSpaceName("");
              }, "أُنشئت مساحة العمل");
            }}
          >
            <input
              aria-label="اسم مساحة جديدة"
              placeholder="اسم مساحة جديدة"
              minLength={2}
              maxLength={100}
              required
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
            />
            <button className="secondary" disabled={busy}>
              إنشاء مساحة +
            </button>
          </form>
        </div>
      </section>
      {!data ? (
        <Empty>أنشئ مساحة عمل لتبدأ، أو انتظر تحميل المساحة.</Empty>
      ) : (
        <>
          <div className="metrics">
            <Metric
              label="المهام"
              value={data.tasks.length}
              hint="في مساحة العمل المحددة"
            />
            <Metric
              label="المكتملة"
              value={data.tasks.filter((t: any) => t.status === "done").length}
              hint="كل إنجاز يصنع فرقًا"
            />
            <Metric
              label="أعضاء الفريق"
              value={data.members.length}
              hint={
                data.role === "owner"
                  ? "أنت مالك هذه المساحة"
                  : "أنت عضو في هذه المساحة"
              }
            />
          </div>
          <div className="tabs">
            {[
              ["board", "لوحة المهام"],
              ["team", "الفريق والنشاط"],
              [
                "notifications",
                "الإشعارات " + notes.filter((n) => !n.seen).length,
              ],
            ].map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "selected" : ""}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "board" && (
            <>
              <section className="panel">
                <h3>أضف الخطوة القادمة</h3>
                <form
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(async () => {
                      await api("/workspaces/" + wid + "/tasks", "POST", {
                        title,
                        priority,
                        assignee,
                      });
                      setTitle("");
                      await load();
                    }, "أُضيفت المهمة");
                  }}
                >
                  <Field label="عنوان المهمة">
                    <input
                      minLength={2}
                      maxLength={200}
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </Field>
                  <Field label="المسؤول">
                    <select
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                    >
                      {data.members
                        .filter(
                          (m: any) => data.role === "owner" || m.id === user.id,
                        )
                        .map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="الأولوية">
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="low">منخفضة</option>
                      <option value="medium">متوسطة</option>
                      <option value="high">عالية</option>
                    </select>
                  </Field>
                  <button className="primary" disabled={busy}>
                    إضافة مهمة +
                  </button>
                </form>
              </section>
              <div className="kanban">
                {states.map(([status, label]) => (
                  <section className="column" key={status}>
                    <h3>
                      {label}
                      <span>
                        {
                          data.tasks.filter((t: any) => t.status === status)
                            .length
                        }
                      </span>
                    </h3>
                    {data.tasks
                      .filter((t: any) => t.status === status)
                      .map((t: any) => (
                        <article className="task" key={t.id}>
                          <span
                            className={
                              "badge " + (t.priority === "high" ? "warn" : "")
                            }
                          >
                            {
                              {
                                low: "منخفضة",
                                medium: "متوسطة",
                                high: "عالية",
                              }[t.priority as "low"]
                            }
                          </span>
                          <p>{t.title}</p>
                          <small>◉ {t.assignee_name}</small>
                          <select
                            aria-label={"حالة " + t.title}
                            value={t.status}
                            disabled={
                              busy ||
                              (data.role !== "owner" && t.assignee !== user.id)
                            }
                            onChange={(e) => {
                              const status = e.target.value;
                              act(async () => {
                                await api("/tasks/" + t.id, "PATCH", {
                                  status,
                                  version: t.version,
                                });
                                await load();
                              }, "تم تحديث المهمة");
                            }}
                          >
                            {states.map(([s, l]) => (
                              <option value={s} key={s}>
                                {l}
                              </option>
                            ))}
                          </select>
                          <button
                            className="icon"
                            disabled={busy}
                            onClick={() => act(() => selectTask(t))}
                          >
                            التعليقات ↗
                          </button>
                        </article>
                      ))}
                  </section>
                ))}
              </div>
              {task && (
                <section className="panel">
                  <div className="panel-heading">
                    <h3>{task.title}</h3>
                    <button
                      className="icon"
                      aria-label="إغلاق التعليقات"
                      onClick={() => setTask(null)}
                    >
                      ✕
                    </button>
                  </div>
                  {comments.map((c) => (
                    <div className="comment" key={c.id}>
                      <small>
                        {c.name} · {date(c.created)}
                      </small>
                      <p>{c.body}</p>
                    </div>
                  ))}
                  {!comments.length && (
                    <p className="hint">ابدأ النقاش حول هذه المهمة.</p>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(async () => {
                        await api("/tasks/" + task.id + "/comments", "POST", {
                          body: comment,
                        });
                        await selectTask(task);
                      }, "أُضيف التعليق");
                    }}
                  >
                    <Field label="تعليق جديد">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        required
                        maxLength={2000}
                      />
                    </Field>
                    <button className="primary" disabled={busy}>
                      إضافة تعليق
                    </button>
                  </form>
                </section>
              )}
            </>
          )}
          {tab === "team" && (
            <div className="split">
              <section className="panel">
                <h3>الفريق</h3>
                {data.members.map((m: any) => (
                  <div className="member" key={m.id}>
                    <div>
                      {m.name}
                      <small className="hint"> · {m.email}</small>
                    </div>
                    <span className="badge">
                      {m.role === "owner" ? "مالك" : "عضو"}
                    </span>
                  </div>
                ))}
                {data.role === "owner" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(async () => {
                        await api("/workspaces/" + wid + "/members", "POST", {
                          email,
                        });
                        setEmail("");
                        await load();
                      }, "أُضيف العضو");
                    }}
                  >
                    <Field label="إضافة حساب مسجل إلى المساحة">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="guest@example.test"
                      />
                    </Field>
                    <button className="secondary" disabled={busy}>
                      إضافة عضو
                    </button>
                    <p className="hint">
                      تُضاف العضوية داخل التطبيق فقط؛ لا تُرسل رسائل بريد.
                    </p>
                  </form>
                )}
              </section>
              <section className="panel">
                <h3>سجل النشاط</h3>
                {data.events.map((e: any) => (
                  <div className="comment" key={e.id}>
                    <small>
                      {e.name} · {date(e.created)}
                    </small>
                    <p>{e.message}</p>
                  </div>
                ))}
                {!data.events.length && (
                  <Empty>ستظهر هنا عمليات إنشاء المهام وتحديثها.</Empty>
                )}
              </section>
            </div>
          )}
          {tab === "notifications" && (
            <section className="panel">
              <div className="panel-heading">
                <h3>إشعاراتك</h3>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api("/notifications/read", "POST");
                      await load();
                    })
                  }
                >
                  تعليم الكل كمقروء
                </button>
              </div>
              {notes.map((n) => (
                <div className="comment" key={n.id}>
                  <span className={"badge " + (n.seen ? "gray" : "")}>
                    {n.seen ? "مقروء" : "جديد"}
                  </span>
                  <p>{n.message}</p>
                  <small>{date(n.created)}</small>
                </div>
              ))}
              {!notes.length && <Empty>ليس لديك إشعارات بعد.</Empty>}
            </section>
          )}
        </>
      )}
    </>
  );
}
