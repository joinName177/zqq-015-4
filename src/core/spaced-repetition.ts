// 间隔重复算法（基于 SM-2 遗忘间隔模型）
// 依据记忆质量动态调整复习间隔，实现"遗忘间隔"调度。

import { ReviewState } from './study-models';

const MS_PER_DAY = 86400000;

/** 日期转 YYYY-MM-DD */
export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD 转 Date（本地时区） */
export function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 日期加天数 */
export function addDays(dayKey: string, days: number): string {
  const date = parseDayKey(dayKey);
  date.setDate(date.getDate() + days);
  return toDayKey(date);
}

/** 两个日期相差天数（后者 - 前者） */
export function daysBetween(a: string, b: string): number {
  const da = parseDayKey(a).getTime();
  const db = parseDayKey(b).getTime();
  return Math.round((db - da) / MS_PER_DAY);
}

/** 初始复习状态（新学条目，即刻到期） */
export function createInitialReviewState(itemId: string, today: string): ReviewState {
  return {
    itemId,
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    lastReviewDate: '',
    nextReviewDate: today
  };
}

/**
 * SM-2 调度：根据本次记忆质量计算下次复习间隔。
 * quality >= 3 视为成功回忆，间隔递增；否则重置。
 */
export function scheduleReview(prev: ReviewState, quality: number, today: string): ReviewState {
  let { interval, repetitions, easeFactor } = prev;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(interval * easeFactor));
    }
    repetitions += 1;
    // SM-2 易度因子更新公式
    easeFactor =
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(1.3, Number(easeFactor.toFixed(2)));
  } else {
    repetitions = 0;
    interval = 1;
  }

  return {
    itemId: prev.itemId,
    interval,
    repetitions,
    easeFactor,
    lastReviewDate: today,
    nextReviewDate: addDays(today, interval)
  };
}

/** 判断条目在指定日期的到期状态 */
export function dueStatusOf(
  review: ReviewState | undefined,
  today: string
): 'overdue' | 'due-today' | 'upcoming' | 'new' {
  if (!review || review.repetitions === 0) {
    // 从未成功复习过
    if (!review || review.lastReviewDate === '') return 'new';
    return 'overdue';
  }
  const diff = daysBetween(today, review.nextReviewDate);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due-today';
  return 'upcoming';
}
