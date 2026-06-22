import { useEffect, useMemo, useState } from "react";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const token = new URLSearchParams(window.location.search).get("token");

function formatMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${year}年${month}月`;
}

function shiftMonth(monthKey, amount) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  const shiftedYear = date.getUTCFullYear();
  const shiftedMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${shiftedYear}-${shiftedMonth}`;
}

function createDateString(monthKey, day) {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

async function fetchSession(monthKey) {
  const response = await fetch(`/api/session?token=${encodeURIComponent(token)}&month=${monthKey}`);

  if (!response.ok) {
    throw new Error("failed");
  }

  return response.json();
}

async function toggleStamp(habitId, stampDate) {
  const response = await fetch("/api/stamps/toggle", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
      habitId,
      stampDate,
    }),
  });

  if (!response.ok) {
    throw new Error("toggle failed");
  }

  return response.json();
}

function HabitCard({ habit, daysInMonth, startsOn, currentMonthKey, today }) {
  const stamps = useMemo(() => new Set(habit.stamps), [habit.stamps]);

  return (
    <article className="habit-card">
      <div className="habit-header">
        <div>
          <h2>{habit.name}</h2>
          <p>押してある日をカレンダーで確認</p>
        </div>
        <p className="stamp-count">{habit.stamps.length} days stamped</p>
      </div>

      <div className="calendar-grid">
        {weekdayLabels.map((weekday) => (
          <div key={weekday} className="weekday">
            {weekday}
          </div>
        ))}

        {Array.from({ length: startsOn }).map((_, index) => (
          <div key={`empty-${habit.id}-${index}`} className="day-cell empty" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const stampDate = createDateString(currentMonthKey, day);
          const stamped = stamps.has(stampDate);

          return (
            <div
              key={`${habit.id}-${stampDate}`}
              className={[
                "day-cell",
                stampDate === today ? "today" : "",
                stamped ? "stamped" : "",
              ].join(" ").trim()}
            >
              <strong>{day}</strong>
              <span className="stamp-mark">{stamped ? "●" : ""}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function App() {
  const [session, setSession] = useState(null);
  const [currentMonthKey, setCurrentMonthKey] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [stampDate, setStampDate] = useState("");
  const [selectedHabitId, setSelectedHabitId] = useState("");
  const [status, setStatus] = useState(token
    ? "読み込み中..."
    : "トークンがありません。Discord のパネルから開いてください。");
  const [selectionHint, setSelectionHint] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    async function load() {
      setStatus("読み込み中...");

      try {
        const nextSession = await fetchSession(currentMonthKey);

        if (!active) {
          return;
        }

        setSession(nextSession);
        setStampDate(nextSession.today);
        setSelectedHabitId((currentValue) => currentValue || String(nextSession.habits[0]?.id ?? ""));
        setStatus("日付と習慣を選んで STAMP を押してください。すでに押した組み合わせは、もう一度押すと取り消しになります。");
        setSelectionHint("下のカレンダーには、今月押してあるスタンプだけが表示されます。");
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus("リンクが無効か期限切れです。Discord のパネルからもう一度開いてください。");
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [currentMonthKey]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!session || loading) {
      return;
    }

    const habit = session.habits.find((item) => String(item.id) === selectedHabitId);

    if (!habit || !stampDate) {
      setStatus("日付と習慣を選んでください。");
      return;
    }

    setLoading(true);
    setStatus(`${habit.name} の ${stampDate} を更新しています...`);

    try {
      const result = await toggleStamp(Number(selectedHabitId), stampDate);
      const nextSession = await fetchSession(currentMonthKey);
      setSession(nextSession);
      setStatus("日付と習慣を選んで STAMP を押してください。すでに押した組み合わせは、もう一度押すと取り消しになります。");
      setSelectionHint(
        result.stamped
          ? `${habit.name} に ${stampDate} のスタンプを押しました。`
          : `${habit.name} の ${stampDate} のスタンプを取り消しました。`,
      );
    } catch (error) {
      setStatus("更新に失敗しました。ページを再読み込みしてください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="background-glow background-glow-left" />
      <div className="background-glow background-glow-right" />
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">DailyStamp</p>
          <h1>毎日の達成を、カレンダーに残す。</h1>
          <p className="lead">
            Discord のパネルから開いた自分専用ページで、日付と習慣を選んでスタンプを押せます。
          </p>

          <form className="stamp-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>日付</span>
              <input
                type="date"
                required
                value={stampDate}
                onChange={(event) => setStampDate(event.target.value)}
              />
            </label>

            <label className="field">
              <span>習慣</span>
              <select
                required
                value={selectedHabitId}
                onChange={(event) => setSelectedHabitId(event.target.value)}
              >
                {(session?.habits ?? []).map((habit) => (
                  <option key={habit.id} value={String(habit.id)}>
                    {habit.name}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" disabled={loading || !token}>
              STAMP を押す
            </button>
          </form>

          <div className="toolbar">
            <button
              type="button"
              onClick={() => setCurrentMonthKey((value) => shiftMonth(value, -1))}
              disabled={!session}
            >
              前の月
            </button>
            <div>
              <p className="month-label">{session ? formatMonth(session.monthKey) : ""}</p>
              <p className="today-label">{session ? `Today: ${session.today}` : ""}</p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentMonthKey((value) => shiftMonth(value, 1))}
              disabled={!session}
            >
              次の月
            </button>
          </div>
        </section>

        <section className="status-card">{status}</section>
        <section className="selection-hint">{selectionHint}</section>

        <section className="habit-list">
          {(session?.habits ?? []).map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              daysInMonth={session.daysInMonth}
              startsOn={session.startsOn}
              currentMonthKey={session.monthKey}
              today={session.today}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
