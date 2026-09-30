// 学习计划生成器 · 核心调度算法
// 依据收藏、熟练度与遗忘间隔生成一周学习队列。
// 关键特性：跨天刷新顺序稳定（确定性哈希排序）、冷启动引导。

import {
  StudyItem,
  StudyPlanState,
  DayQueue,
  QueueItem,
  QueueReason,
  ProficiencyLevel,
  ReviewState,
  CompletionRecord
} from './study-models';
import { STUDY_ITEM_POOL, STARTER_PACK_IDS } from './study-items';
import { toDayKey, addDays, dueStatusOf, createInitialReviewState } from './spaced-repetition';

const ITEMS_PER_DAY = 5;
const WEEK_LENGTH = 7;

/** 确定性字符串哈希（用于生成稳定的排序扰动） */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** 生成确定性排序扰动（0-1 小数，不覆盖优先级整数档位） */
function stableJitter(dayKey: string, itemId: string): number {
  return (hashString(`${dayKey}::${itemId}`) % 1000) / 1000;
}

/** 判断是否为冷启动（无收藏且无完成记录） */
export function isColdStart(state: StudyPlanState): boolean {
  return state.favorites.length === 0 && state.completions.length === 0;
}

/** 计算条目在某天的优先级分数与入队原因 */
function scoreItem(
  item: StudyItem,
  dayKey: string,
  state: StudyPlanState,
  completedItemIds: Set<string>
): { score: number; reason: QueueReason; dueStatus: QueueItem['dueStatus'] } {
  const isFavorite = state.favorites.includes(item.id);
  const proficiency = state.proficiency[item.id] ?? 0;
  const review: ReviewState | undefined = state.reviewStates[item.id];
  const dueStatus = dueStatusOf(review, dayKey);

  let score = 0;
  let reason: QueueReason = 'new';

  // 收藏加成（最高优先级）
  if (isFavorite) {
    score += 100;
    reason = 'favorite';
  }

  // 熟练度越低越需复习
  const profGap = 5 - proficiency;
  if (profGap > 0) {
    score += profGap * 10;
    if (proficiency <= 2 && reason === 'new') reason = 'low-proficiency';
  }

  // 到期/逾期加成
  if (dueStatus === 'overdue') {
    score += 50;
    reason = 'due-review';
  } else if (dueStatus === 'due-today') {
    score += 30;
    reason = 'due-review';
  }

  // 新条目加成（引导探索）
  if (dueStatus === 'new') {
    score += 5;
    if (reason === 'new') reason = 'new';
  }

  // 冷启动：入门包条目获得额外加成
  if (isColdStart(state) && STARTER_PACK_IDS.includes(item.id)) {
    score += 200;
    reason = 'starter';
  }

  // 已完成的条目降权（避免重复出现）
  if (completedItemIds.has(item.id)) {
    score -= 500;
  }

  // 确定性扰动：保证同一天刷新顺序稳定，不覆盖优先级档位
  score += stableJitter(dayKey, item.id);

  return { score, reason, dueStatus };
}

/** 收集某天已完成的条目 id */
function getCompletedOnDay(state: StudyPlanState, dayKey: string): Set<string> {
  const set = new Set<string>();
  state.completions.forEach((c: CompletionRecord) => {
    if (c.dayKey === dayKey) set.add(c.itemId);
  });
  return set;
}

/** 生成一周学习队列 */
export function generateWeekQueue(state: StudyPlanState, today: Date = new Date()): DayQueue[] {
  const todayKey = toDayKey(today);
  const queues: DayQueue[] = [];

  for (let i = 0; i < WEEK_LENGTH; i++) {
    const dayKey = addDays(todayKey, i);
    const completedOnDay = getCompletedOnDay(state, dayKey);

    const scored = STUDY_ITEM_POOL.map(item => {
      const { score, reason, dueStatus } = scoreItem(item, dayKey, state, completedOnDay);
      const completion = state.completions.find(
        c => c.dayKey === dayKey && c.itemId === item.id
      );
      return {
        item,
        reason,
        priority: Math.round(score * 100) / 100,
        isCompleted: !!completion,
        completionId: completion?.id,
        dueStatus
      } as QueueItem;
    });

    // 按优先级降序（确定性扰动已在分数内）
    scored.sort((a, b) => b.priority - a.priority);

    // 冷启动时只展示入门包
    let items: QueueItem[];
    if (isColdStart(state)) {
      items = scored
        .filter(q => STARTER_PACK_IDS.includes(q.item.id))
        .slice(0, ITEMS_PER_DAY);
    } else {
      items = scored.slice(0, ITEMS_PER_DAY);
    }

    const date = new Date(dayKey + 'T00:00:00');
    const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    queues.push({
      dayKey,
      dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
      weekdayLabel: weekdayLabels[date.getDay()],
      isToday: i === 0,
      items
    });
  }

  return queues;
}

/** 生成学习计划统计 */
export function generateStats(state: StudyPlanState, today: Date = new Date()) {
  const todayKey = toDayKey(today);
  const completedToday = state.completions.filter(c => c.dayKey === todayKey).length;

  let dueToday = 0;
  let overdueCount = 0;
  let masteredCount = 0;
  let learningCount = 0;
  let newCount = 0;

  STUDY_ITEM_POOL.forEach(item => {
    const review = state.reviewStates[item.id];
    const dueStatus = dueStatusOf(review, todayKey);
    const proficiency = state.proficiency[item.id] ?? 0;

    if (dueStatus === 'due-today') dueToday += 1;
    if (dueStatus === 'overdue') overdueCount += 1;
    if (proficiency >= 4) masteredCount += 1;
    else if (review && review.repetitions > 0) learningCount += 1;
    else newCount += 1;
  });

  return {
    totalItems: STUDY_ITEM_POOL.length,
    favoriteCount: state.favorites.length,
    completedToday,
    dueToday,
    overdueCount,
    masteredCount,
    learningCount,
    newCount
  };
}

/** 确保条目有初始复习状态 */
export function ensureReviewState(
  reviewStates: Record<string, ReviewState>,
  itemId: string,
  today: string
): Record<string, ReviewState> {
  if (reviewStates[itemId]) return reviewStates;
  return {
    ...reviewStates,
    [itemId]: createInitialReviewState(itemId, today)
  };
}
