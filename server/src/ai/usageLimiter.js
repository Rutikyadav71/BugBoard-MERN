import { AppError } from '../utils/AppError.js';

// Application-level budget for AI calls: per-user per-minute, per-user per-day, and a shared daily cap.
// Held in process memory: it resets when the server restarts and is per-instance. That is acceptable for a
// single-process portfolio deployment; use a shared store (e.g. Redis) before scaling horizontally.
const minuteWindows = new Map(); // userId -> number[] (timestamps in ms)
const userDaily = new Map(); // userId -> { day, count }
let globalDaily = { day: '', count: 0 };

const dayKey = (now) => new Date(now).toISOString().slice(0, 10); // UTC day

export function resetUsage() {
  minuteWindows.clear();
  userDaily.clear();
  globalDaily = { day: '', count: 0 };
}

function currentUserDay(userId, now) {
  const d = dayKey(now);
  const entry = userDaily.get(userId);
  return entry && entry.day === d ? entry : { day: d, count: 0 };
}
function currentGlobal(now) {
  const d = dayKey(now);
  return globalDaily.day === d ? globalDaily : { day: d, count: 0 };
}

export function usageSnapshot(userId, cfg, now = Date.now()) {
  const recent = (minuteWindows.get(userId) || []).filter((t) => now - t < 60_000);
  return {
    perMinute: cfg.perMinute,
    perUserPerDay: cfg.perUserPerDay,
    remainingThisMinute: Math.max(0, cfg.perMinute - recent.length),
    remainingToday: Math.max(0, Math.min(cfg.perUserPerDay - currentUserDay(userId, now).count, cfg.globalPerDay - currentGlobal(now).count)),
  };
}

// Counts one AI call for this user, or throws a 429 with a stable error code.
export function consume(userId, cfg, now = Date.now()) {
  const id = String(userId);
  const recent = (minuteWindows.get(id) || []).filter((t) => now - t < 60_000);
  if (recent.length >= cfg.perMinute) {
    const retry = Math.max(1, Math.ceil((60_000 - (now - recent[0])) / 1000));
    throw new AppError(`Too many AI requests. Please wait about ${retry} seconds and try again.`, 429, undefined, 'AI_RATE_LIMITED');
  }
  const u = currentUserDay(id, now);
  if (u.count >= cfg.perUserPerDay) {
    throw new AppError(`You have reached today's AI limit (${cfg.perUserPerDay} requests). It resets at 00:00 UTC.`, 429, undefined, 'AI_DAILY_LIMIT');
  }
  const g = currentGlobal(now);
  if (g.count >= cfg.globalPerDay) {
    throw new AppError('The shared daily AI budget for this app has been used up. Try again tomorrow (00:00 UTC).', 429, undefined, 'AI_BUDGET_EXHAUSTED');
  }
  recent.push(now);
  minuteWindows.set(id, recent);
  userDaily.set(id, { day: u.day, count: u.count + 1 });
  globalDaily = { day: g.day, count: g.count + 1 };
}
