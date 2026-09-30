import { StudyState, StudyProgress, StudyEvent, Rating, PlannedItem, WeeklyPlan, DayPlan, PlanCategory } from './study-models';
import { addDays, diffDays, weekStartOf, weekRange, WEEKDAY_LABELS } from './date-utils';

/** 事件流水最多保留条数（回滚栈上限） */
const MAX_EVENTS = 500;

export function emptyState(): StudyState {
  return { favorites: [], progress: {}, events: [], frozenWeeks: {} };
}

export function isFavorited(state: StudyState, idiomId: string): boolean {
  return state.favorites.includes(idiomId);
}

// ---------------------------------------------------------------------------
// SM-2 风格间隔算法
// ---------------------------------------------------------------------------

export function newProgress(idiomId: string, today: string): StudyProgress {
  return { idiomId, proficiency: 0, ease: 2.3, intervalDays: 0, reps: 0, lapses: 0, due: today };
}

/** 依据自评等级计算复习后的新记忆状态（纯函数） */
export function applyRating(prev: StudyProgress, rating: Rating, today: string): StudyProgress {
  const ease = Math.max(1.3, prev.ease + (rating === 'again' ? -0.2 : rating === 'hard' ? -0.15 : rating === 'easy' ? 0.15 : 0));
  let intervalDays: number;
  let reps: number;
  let lapses = prev.lapses;

  if (rating === 'again') {
    intervalDays = 0; // 重学，今日到期
    reps = 0;
    lapses += 1;
  } else if (rating === 'hard') {
    intervalDays = prev.intervalDays === 0 ? 1 : Math.max(1, Math.round(prev.intervalDays * 1.2));
    reps = prev.reps + 1;
  } else if (rating === 'good') {
    intervalDays = prev.intervalDays === 0 ? 1 : prev.intervalDays === 1 ? 3 : Math.round(prev.intervalDays * ease);
    reps = prev.reps + 1;
  } else {
    intervalDays = prev.intervalDays === 0 ? 3 : Math.round(prev.intervalDays * ease * 1.3);
    reps = prev.reps + 1;
  }

  const proficiency =
    rating === 'again'
      ? Math.max(0, prev.proficiency - 1)
      : rating === 'hard'
        ? Math.min(5, Math.max(1, prev.proficiency))
        : rating === 'good'
          ? Math.min(5, prev.proficiency + 1)
          : Math.min(5, prev.proficiency + 2);

  return {
    ...prev,
    proficiency,
    ease: Math.round(ease * 100) / 100,
    intervalDays,
    reps,
    lapses,
    lastReviewed: today,
    due: addDays(today, intervalDays)
  };
}

// ---------------------------------------------------------------------------
// 紧迫度：决定排序。遗忘越久、熟练度越低越靠前；新卡居中，未来到期垫底。
// ---------------------------------------------------------------------------

export function urgencyOf(p: StudyProgress | undefined, today: string): { urgency: number; category: PlanCategory } {
  if (!p) return { urgency: 50, category: 'new' };
  const days = diffDays(p.due, today); // >0 已逾期，0 今日到期，<0 未来
  let urgency: number;
  let category: PlanCategory;
  if (days > 0) {
    urgency = 60 + Math.min(20, days * 4) + (5 - p.proficiency) * 4;
    category = 'overdue';
  } else if (days === 0) {
    urgency = 55 + (5 - p.proficiency);
    category = 'due';
  } else {
    urgency = Math.max(0, 40 + days * 4 - p.proficiency * 2); // days 为负
    category = 'upcoming';
  }
  return { urgency: Math.max(0, Math.min(100, Math.round(urgency))), category };
}

interface Candidate {
  idiomId: string;
  kind: 'favorite' | 'cold';
  favoriteIndex: number;
  /** 冷启动时保留目录（策划）顺序的下标 */
  seedIndex: number;
}

/**
 * 候选集：
 * - 有收藏时，仅从收藏生成（依据熟练度 / 遗忘间隔排序）；
 * - 没有任何收藏（冷启动）时，用内容目录种子填充，让新用户立刻有东西可学。
 * 排序键：紧迫度降序 → 收藏插入顺序（冷启动为目录顺序）→ id 字典序，
 * 保证结果确定、可复现。
 */
export function buildCandidateOrder(
  state: StudyState,
  catalogIds: string[],
  today: string
): { candidates: Candidate[]; coldStart: boolean } {
  const coldStart = state.favorites.length === 0;
  const source: Candidate[] = coldStart
    ? catalogIds.map((id, i) => ({ idiomId: id, kind: 'cold' as const, favoriteIndex: i, seedIndex: i }))
    : state.favorites.map((id, i) => ({ idiomId: id, kind: 'favorite' as const, favoriteIndex: i, seedIndex: Number.MAX_SAFE_INTEGER }));

  const candidates = [...source].sort((a, b) => {
    const ua = urgencyOf(state.progress[a.idiomId], today);
    const ub = urgencyOf(state.progress[b.idiomId], today);
    if (ua.urgency !== ub.urgency) return ub.urgency - ua.urgency;
    if (coldStart && a.seedIndex !== b.seedIndex) return a.seedIndex - b.seedIndex;
    if (a.favoriteIndex !== b.favoriteIndex) return a.favoriteIndex - b.favoriteIndex;
    return a.idiomId < b.idiomId ? -1 : a.idiomId > b.idiomId ? 1 : 0;
  });
  return { candidates, coldStart };
}

// ---------------------------------------------------------------------------
// 周队列冻结：跨天刷新顺序稳定的关键
// ---------------------------------------------------------------------------

/** 若本周队列尚未冻结则按当前状态生成一次快照；之后一周内不再变化 */
export function ensureWeekFrozen(state: StudyState, catalogIds: string[], today: string): StudyState {
  const week = weekStartOf(today);
  if (state.frozenWeeks[week]) return state;
  const { candidates, coldStart } = buildCandidateOrder(state, catalogIds, today);
  const next: StudyState = {
    ...state,
    frozenWeeks: { ...state.frozenWeeks, [week]: { coldStart, ids: candidates.map(c => c.idiomId) } }
  };
  return next;
}

/**
 * 取本周学习计划。
 * 槽位分配：按冻结序列名次轮转（rank % 7）铺到周一至周日，每日负载均衡，
 * 顺序由冻结快照固定，因此跨天刷新（无论进度如何变化）都不会重排。
 */
export function getWeeklyPlan(state: StudyState, catalogIds: string[], today: string): { state: StudyState; plan: WeeklyPlan } {
  const ensured = ensureWeekFrozen(state, catalogIds, today);
  const { start, end } = weekRange(today);
  const frozen = ensured.frozenWeeks[start]!;

  const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(start, i),
    weekday: WEEKDAY_LABELS[i],
    isToday: addDays(start, i) === today,
    items: []
  }));

  let completedCount = 0;
  frozen.ids.forEach((idiomId, rank) => {
    const dayIndex = rank % 7;
    const date = addDays(start, dayIndex);
    const p = ensured.progress[idiomId];
    const { urgency, category } = urgencyOf(p, today);
    const completedEvent = ensured.events.find(e => e.type === 'reviewed' && e.idiomId === idiomId && e.date === date);
    const completed = Boolean(completedEvent);
    if (completed) completedCount += 1;

    const item: PlannedItem = {
      idiomId,
      kind: frozen.coldStart ? 'cold' : 'favorite',
      category,
      urgency,
      proficiency: p?.proficiency ?? 0,
      due: p?.due ?? today,
      intervalDays: p?.intervalDays ?? 0,
      rank,
      dayIndex,
      completed,
      completedEventSeq: completedEvent?.seq
    };
    days[dayIndex].items.push(item);
  });

  return {
    state: ensured,
    plan: {
      weekStart: start,
      weekEnd: end,
      today,
      coldStart: frozen.coldStart,
      days,
      totalCount: frozen.ids.length,
      completedCount
    }
  };
}

// ---------------------------------------------------------------------------
// 写操作（事件溯源，事件携带逆操作快照 → 可逐条回滚）
// ---------------------------------------------------------------------------

function pushEvent(state: StudyState, event: Omit<StudyEvent, 'seq'>): { state: StudyState; event: StudyEvent } {
  const seq = state.events.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
  const full: StudyEvent = { ...event, seq };
  const events = [...state.events, full];
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  return { state: { ...state, events }, event: full };
}

export function addFavorite(state: StudyState, idiomId: string, today: string, at: string): StudyState {
  if (!idiomId || state.favorites.includes(idiomId)) return state;
  const pushed = pushEvent(state, {
    at,
    date: today,
    idiomId,
    type: 'favoriteAdded',
    before: { favorite: false, favoriteIndex: state.favorites.length }
  });
  return { ...pushed.state, favorites: [...state.favorites, idiomId] };
}

export function removeFavorite(state: StudyState, idiomId: string, today: string, at: string): StudyState {
  const favoriteIndex = state.favorites.indexOf(idiomId);
  if (favoriteIndex === -1) return state;
  const pushed = pushEvent(state, {
    at,
    date: today,
    idiomId,
    type: 'favoriteRemoved',
    before: { favorite: true, favoriteIndex }
  });
  const favorites = state.favorites.filter(id => id !== idiomId);
  return { ...pushed.state, favorites };
}

/** 记录一次复习完成，返回新状态与事件 */
export function recordReview(
  state: StudyState,
  idiomId: string,
  rating: Rating,
  today: string,
  at: string
): { state: StudyState; event: StudyEvent } {
  const prev = state.progress[idiomId] ?? null;
  const pushed = pushEvent(state, {
    at,
    date: today,
    idiomId,
    type: 'reviewed',
    rating,
    before: { progress: prev ? { ...prev } : null }
  });
  const updated = applyRating(prev ?? newProgress(idiomId, today), rating, today);
  return {
    state: {
      ...pushed.state,
      progress: { ...pushed.state.progress, [idiomId]: updated }
    },
    event: pushed.event
  };
}

/** 回滚任意一条事件（不要求是最后一条），按事件快照逆向还原 */
export function undoEvent(state: StudyState, seq: number): { state: StudyState; event: StudyEvent } {
  const event = state.events.find(e => e.seq === seq);
  if (!event) return { state, event: undefined as unknown as StudyEvent };

  let next: StudyState = { ...state, events: state.events.filter(e => e.seq !== seq) };

  if (event.type === 'reviewed') {
    const progress = { ...next.progress };
    if (event.before.progress) progress[event.idiomId] = { ...event.before.progress };
    else delete progress[event.idiomId];
    next = { ...next, progress };
  } else if (event.type === 'favoriteAdded') {
    next = { ...next, favorites: next.favorites.filter(id => id !== event.idiomId) };
  } else if (event.type === 'favoriteRemoved') {
    if (!next.favorites.includes(event.idiomId)) {
      const idx = Math.min(event.before.favoriteIndex ?? next.favorites.length, next.favorites.length);
      const favorites = [...next.favorites];
      favorites.splice(idx, 0, event.idiomId);
      next = { ...next, favorites };
    }
  }
  return { state: next, event };
}

/** 回滚最近一条事件（完成 / 收藏），无事件时原样返回 */
export function undoLast(state: StudyState): { state: StudyState; event: StudyEvent | undefined } {
  const last = state.events.reduce<StudyEvent | undefined>((m, e) => (!m || e.seq > m.seq ? e : m), undefined);
  if (!last) return { state, event: undefined };
  return undoEvent(state, last.seq);
}
