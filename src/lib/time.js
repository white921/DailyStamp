export function getTodayInJapan() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getMonthBounds(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));

  return {
    start: `${monthKey}-01`,
    end: new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(end),
    daysInMonth: end.getUTCDate(),
    startsOn: start.getUTCDay(),
  };
}

export function getCurrentMonthKey() {
  return getTodayInJapan().slice(0, 7);
}
