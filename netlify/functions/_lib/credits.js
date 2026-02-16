export const DAILY_CREDIT = {
  guest: 1,
  free: 5,
  premium: 20
};

export function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function asUtcDate(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function diffDays(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  const diffMs = asUtcDate(toKey).getTime() - asUtcDate(fromKey).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function applyCumulativeCredits(record, role, todayKey = getTodayKey()) {
  if (!record) return { changed: false, credits: 0 };
  if (role === "admin") return { changed: false, credits: Infinity };
  const dailyCredit = DAILY_CREDIT[role];
  if (!dailyCredit) return { changed: false, credits: Number(record.credits || 0) };

  let changed = false;
  if (typeof record.credits !== "number" || Number.isNaN(record.credits)) {
    record.credits = 0;
    changed = true;
  }

  if (!record.lastCreditAt) {
    record.credits += dailyCredit;
    record.lastCreditAt = todayKey;
    changed = true;
    return { changed, credits: record.credits };
  }

  const elapsedDays = diffDays(record.lastCreditAt, todayKey);
  if (elapsedDays > 0) {
    record.credits += elapsedDays * dailyCredit;
    record.lastCreditAt = todayKey;
    changed = true;
  }

  return { changed, credits: record.credits };
}

