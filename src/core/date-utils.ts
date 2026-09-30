/**
 * 纯函数日期工具：统一以本地日期 YYYY-MM-DD 为键，避免时区 / 时钟耦合。
 */

export interface Clock {
  today(): string;
}

export const systemClock: Clock = {
  today: () => toDateKey(new Date())
};

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** 两个日键相差天数：b - a */
export function diffDays(a: string, b: string): number {
  const ms = parseDateKey(b).getTime() - parseDateKey(a).getTime();
  return Math.round(ms / 86400000);
}

/** 周一为一周起点，返回该周周一的日期键 */
export function weekStartOf(key: string): string {
  const d = parseDateKey(key);
  const jsDay = d.getDay(); // 0=周日
  const offset = (jsDay + 6) % 7; // 周一=0
  d.setDate(d.getDate() - offset);
  return toDateKey(d);
}

export function weekRange(key: string): { start: string; end: string } {
  const start = weekStartOf(key);
  return { start, end: addDays(start, 6) };
}

export const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
