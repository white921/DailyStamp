import { useEffect, useMemo, useState } from "react";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const token = new URLSearchParams(window.location.search).get("token");
const habitThemes = [
  { fill: "#ff8ba7", ring: "#ffd0dc", glow: "rgba(255, 139, 167, 0.28)" },
  { fill: "#7fc8f8", ring: "#d8f0ff", glow: "rgba(127, 200, 248, 0.26)" },
  { fill: "#8bd3a8", ring: "#d7f7e3", glow: "rgba(139, 211, 168, 0.26)" },
  { fill: "#f6b26b", ring: "#ffe3c1", glow: "rgba(246, 178, 107, 0.28)" },
  { fill: "#c69cf2", ring: "#efdefd", glow: "rgba(198, 156, 242, 0.24)" },
  { fill: "#ff9f68", ring: "#ffe1d0", glow: "rgba(255, 159, 104, 0.24)" },
];

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

function getHabitStampLabel(habitName) {
  return habitName.slice(0, 2);
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

function HabitLegend({ habits }) {
  return (
    <section className="legend-card">
      <div className="legend-header">
        <div>
          <p className="mini-eyebrow">Color Stamps</p>
          <h2>習慣ごとのスタンプ</h2>
        </div>
        <p>押すとカレンダーにぽんっと乗ります。</p>
      </div>

      <div className="legend-list">
        {habits.map((habit) => (
          <div key={habit.id} className="legend-pill">
            <span
              className="legend-dot"
              style={{
                "--stamp-fill": habit.theme.fill,
                "--stamp-ring": habit.theme.ring,
                "--stamp-glow": habit.theme.glow,
              }}
            >
              {getHabitStampLabel(habit.name)}
            </span>
            <div>
              <strong>{habit.name}</strong>
              <p>{habit.stamps.length} days stamped</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CalendarBoard({
  currentMonthKey,
  daysInMonth,
  startsOn,
  today,
  stampsByDate,
  lastStampEvent,
}) {
  return (
    <section className="calendar-card">
      <div className="calendar-grid calendar-grid-head">
        {weekdayLabels.map((weekday) => (
          <div key={weekday} className="weekday">
            {weekday}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {Array.from({ length: startsOn }).map((_, index) => (
          <div key={`empty-${index}`} className="day-cell empty" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const stampDate = createDateString(currentMonthKey, day);
          const dayStamps = stampsByDate.get(stampDate) ?? [];

          return (
            <div
              key={stampDate}
              className={[
                "day-cell",
                stampDate === today ? "today" : "",
                dayStamps.length > 0 ? "has-stamps" : "",
              ].join(" ").trim()}
            >
              <div className="day-cell-top">
                <strong className="day-number">{day}</strong>
                {stampDate === today ? <span className="today-badge">today</span> : null}
              </div>

              <div className="stamp-stack">
                {dayStamps.map((stamp) => {
                  const isPopping =
                    lastStampEvent &&
                    lastStampEvent.stamped &&
                    lastStampEvent.stampDate === stampDate &&
                    lastStampEvent.habitId === stamp.id;

                  return (
                    <span
                      key={`${stamp.id}-${stampDate}-${isPopping ? lastStampEvent.eventId : "base"}`}
                      className={`stamp-seal${isPopping ? " pop-in" : ""}`}
                      style={{
                        "--stamp-fill": stamp.theme.fill,
                        "--stamp-ring": stamp.theme.ring,
                        "--stamp-glow": stamp.theme.glow,
                      }}
                      title={stamp.name}
                    >
                      <span>{getHabitStampLabel(stamp.name)}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
  const [lastStampEvent, setLastStampEvent] = useState(null);

  const decoratedHabits = useMemo(
    () =>
      (session?.habits ?? []).map((habit, index) => ({
        ...habit,
        theme: habitThemes[index % habitThemes.length],
      })),
    [session],
  );

  const stampsByDate = useMemo(() => {
    const map = new Map();

    for (const habit of decoratedHabits) {
      for (const stampedDate of habit.stamps) {
        const entry = map.get(stampedDate) ?? [];
        entry.push({
          id: habit.id,
          name: habit.name,
          theme: habit.theme,
        });
        map.set(stampedDate, entry);
      }
    }

    for (const entry of map.values()) {
      entry.sort((left, right) => Number(left.id) - Number(right.id));
    }

    return map;
  }, [decoratedHabits]);

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
        setStatus("日付と習慣を選んで、かわいく STAMP。もう一度押すと取り消しできます。");
        setSelectionHint("カレンダーはひとつ。習慣ごとの色スタンプが毎日のマスに並びます。");
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

    const habit = decoratedHabits.find((item) => String(item.id) === selectedHabitId);

    if (!habit || !stampDate) {
      setStatus("日付と習慣を選んでください。");
      return;
    }

    setLoading(true);
    setStatus(`${habit.name} の ${stampDate} にスタンプを準備しています...`);

    try {
      const result = await toggleStamp(Number(selectedHabitId), stampDate);
      const nextSession = await fetchSession(currentMonthKey);

      setSession(nextSession);
      setLastStampEvent({
        habitId: Number(selectedHabitId),
        stampDate,
        stamped: result.stamped,
        eventId: Date.now(),
      });
      setStatus("日付と習慣を選んで、かわいく STAMP。もう一度押すと取り消しできます。");
      setSelectionHint(
        result.stamped
          ? `${habit.name} のスタンプをぽんっと押しました。`
          : `${habit.name} のスタンプを外しました。`,
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
          <h1>ぽんっと押して、毎日を彩る。</h1>
          <p className="lead">
            Discord のパネルから開いた自分専用ページで、日付と習慣を選ぶと色付きスタンプがカレンダーに乗ります。
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
                {decoratedHabits.map((habit) => (
                  <option key={habit.id} value={String(habit.id)}>
                    {habit.name}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" disabled={loading || !token}>
              {loading ? "STAMP中..." : "STAMP を押す"}
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

        {session ? (
          <div className="calendar-layout">
            <CalendarBoard
              currentMonthKey={session.monthKey}
              daysInMonth={session.daysInMonth}
              startsOn={session.startsOn}
              today={session.today}
              stampsByDate={stampsByDate}
              lastStampEvent={lastStampEvent}
            />
            <HabitLegend habits={decoratedHabits} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
