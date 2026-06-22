const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const token = new URLSearchParams(window.location.search).get("token");

const elements = {
  status: document.getElementById("status"),
  selectionHint: document.getElementById("selection-hint"),
  habitList: document.getElementById("habit-list"),
  monthLabel: document.getElementById("month-label"),
  todayLabel: document.getElementById("today-label"),
  prevMonthButton: document.getElementById("prev-month"),
  nextMonthButton: document.getElementById("next-month"),
  stampForm: document.getElementById("stamp-form"),
  stampDate: document.getElementById("stamp-date"),
  habitSelect: document.getElementById("habit-select"),
  stampSubmit: document.getElementById("stamp-submit"),
};

let currentMonthKey;
let today;
let loading = false;
let currentHabits = [];

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

function setStatus(message) {
  elements.status.textContent = message;
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

function renderHabitOptions(habits) {
  elements.habitSelect.replaceChildren();

  for (const habit of habits) {
    const option = document.createElement("option");
    option.value = String(habit.id);
    option.textContent = habit.name;
    elements.habitSelect.append(option);
  }
}

function setSelectionHint(message) {
  elements.selectionHint.textContent = message;
}

function renderHabitCard({ habit, daysInMonth, startsOn }) {
  const card = document.createElement("article");
  card.className = "habit-card";

  const header = document.createElement("div");
  header.className = "habit-header";

  const titleWrap = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = habit.name;
  const subtitle = document.createElement("p");
  subtitle.textContent = "押してある日をカレンダーで確認";
  titleWrap.append(title, subtitle);

  const stampCount = document.createElement("p");
  stampCount.className = "stamp-count";
  stampCount.textContent = `${habit.stamps.length} days stamped`;
  header.append(titleWrap, stampCount);

  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  for (const weekday of weekdayLabels) {
    const weekdayElement = document.createElement("div");
    weekdayElement.className = "weekday";
    weekdayElement.textContent = weekday;
    grid.append(weekdayElement);
  }

  for (let dayIndex = 0; dayIndex < startsOn; dayIndex += 1) {
    const placeholder = document.createElement("div");
    placeholder.className = "day-cell empty";
    grid.append(placeholder);
  }

  const stamps = new Set(habit.stamps);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const stampDate = createDateString(currentMonthKey, day);
    const cell = document.createElement("div");
    cell.className = "day-cell";

    if (stampDate === today) {
      cell.classList.add("today");
    }

    if (stamps.has(stampDate)) {
      cell.classList.add("stamped");
    }

    const dayLabel = document.createElement("strong");
    dayLabel.textContent = String(day);

    const mark = document.createElement("span");
    mark.className = "stamp-mark";
    mark.textContent = stamps.has(stampDate) ? "●" : "";

    cell.append(dayLabel, mark);
    grid.append(cell);
  }

  card.append(header, grid);
  return card;
}

function renderSession(session) {
  currentMonthKey = session.monthKey;
  today = session.today;
  currentHabits = session.habits;

  elements.monthLabel.textContent = formatMonth(session.monthKey);
  elements.todayLabel.textContent = `Today: ${session.today}`;
  elements.habitList.replaceChildren();
  elements.stampDate.value = session.today;

  renderHabitOptions(session.habits);
  setStatus("日付と習慣を選んで STAMP を押してください。すでに押した組み合わせは、もう一度押すと取り消しになります。");
  setSelectionHint("下のカレンダーには、今月押してあるスタンプだけが表示されます。");

  for (const habit of session.habits) {
    elements.habitList.append(renderHabitCard({
      habit,
      daysInMonth: session.daysInMonth,
      startsOn: session.startsOn,
    }));
  }
}

async function loadMonth(monthKey) {
  setStatus("読み込み中...");

  try {
    const session = await fetchSession(monthKey);
    renderSession(session);
  } catch (error) {
    setStatus("リンクが無効か期限切れです。Discord のパネルからもう一度開いてください。");
  }
}

elements.prevMonthButton.addEventListener("click", () => {
  loadMonth(shiftMonth(currentMonthKey, -1));
});

elements.nextMonthButton.addEventListener("click", () => {
  loadMonth(shiftMonth(currentMonthKey, 1));
});

elements.stampForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (loading) {
    return;
  }

  const habitId = Number(elements.habitSelect.value);
  const stampDate = elements.stampDate.value;
  const habit = currentHabits.find((item) => Number(item.id) === habitId);

  if (!habit || !stampDate) {
    setStatus("日付と習慣を選んでください。");
    return;
  }

  loading = true;
  elements.stampSubmit.disabled = true;
  setStatus(`${habit.name} の ${stampDate} を更新しています...`);

  try {
    const result = await toggleStamp(habitId, stampDate);
    await loadMonth(currentMonthKey);
    setSelectionHint(
      result.stamped
        ? `${habit.name} に ${stampDate} のスタンプを押しました。`
        : `${habit.name} の ${stampDate} のスタンプを取り消しました。`,
    );
  } catch (error) {
    setStatus("更新に失敗しました。ページを再読み込みしてください。");
  } finally {
    loading = false;
    elements.stampSubmit.disabled = false;
  }
});

if (!token) {
  setStatus("トークンがありません。Discord のパネルから開いてください。");
} else {
  const now = new Date();
  const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  loadMonth(initialMonth);
}
