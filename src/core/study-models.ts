/**
 * 学习计划领域模型
 *
 * 设计要点：
 * - 学习状态（收藏、熟练度、遗忘间隔）与「某一周的队列快照」分离；
 * - 所有写操作都以 StudyEvent 事件追加，事件携带逆操作快照，可逐条回滚；
 * - 周队列一旦生成即冻结（frozenWeeks），周内跨天刷新顺序不变。
 */

/** 复习自评等级（SM-2 风格） */
export type Rating = 'again' | 'hard' | 'good' | 'easy';

/** 单个成语的学习进度 / 记忆状态 */
export interface StudyProgress {
  idiomId: string;
  /** 熟练度 0~5 */
  proficiency: number;
  /** SM-2 ease factor，初始 2.3 */
  ease: number;
  /** 当前复习间隔（天），0 表示新卡 / 重学 */
  intervalDays: number;
  /** 累计成功复习次数 */
  reps: number;
  /** 遗忘（again）次数 */
  lapses: number;
  /** 最近一次复习日期 YYYY-MM-DD */
  lastReviewed?: string;
  /** 到期日期 YYYY-MM-DD */
  due: string;
}

export type StudyEventType = 'reviewed' | 'favoriteAdded' | 'favoriteRemoved';

/** 事件的逆操作快照：回滚时直接还原，不依赖重放 */
export interface EventInverse {
  /** 收藏变更前是否已收藏 */
  favorite?: boolean;
  /** 收藏变更前所在下标（用于恢复插入顺序） */
  favoriteIndex?: number;
  /** 复习前的进度，null 表示此前没有进度记录 */
  progress?: StudyProgress | null;
}

export interface StudyEvent {
  seq: number;
  /** ISO 时间戳 */
  at: string;
  /** 本地日期 YYYY-MM-DD */
  date: string;
  idiomId: string;
  type: StudyEventType;
  rating?: Rating;
  before: EventInverse;
}

export interface FrozenWeek {
  /** 冻结时是否为冷启动（决定计划项标记） */
  coldStart: boolean;
  /** 有序 idiomId 列表 */
  ids: string[];
}

export interface StudyState {
  /** 收藏的成语 id（即成语文本），保持插入顺序 */
  favorites: string[];
  /** 各成语的记忆进度 */
  progress: Record<string, StudyProgress>;
  /** 完成 / 收藏流水（追加，回滚即移除对应事件） */
  events: StudyEvent[];
  /** 每周冻结的队列：weekStart(YYYY-MM-DD) -> 冻结周 */
  frozenWeeks: Record<string, FrozenWeek>;
}

export type PlanItemKind = 'favorite' | 'cold';

export type PlanCategory = 'new' | 'overdue' | 'due' | 'upcoming';

export interface PlannedItem {
  idiomId: string;
  kind: PlanItemKind;
  category: PlanCategory;
  /** 紧迫度 0~100，越高越优先 */
  urgency: number;
  proficiency: number;
  due: string;
  intervalDays: number;
  /** 在本周冻结序列中的名次 */
  rank: number;
  /** 落在周几（0=周一 … 6=周日） */
  dayIndex: number;
  /** 该冻结槽位日期是否已完成复习 */
  completed: boolean;
  /** 该槽位完成记录的事件 seq（用于单卡回滚） */
  completedEventSeq?: number;
}

export interface DayPlan {
  date: string;
  weekday: string;
  isToday: boolean;
  items: PlannedItem[];
}

export interface WeeklyPlan {
  weekStart: string;
  weekEnd: string;
  today: string;
  /** 本周是否为冷启动（无任何收藏） */
  coldStart: boolean;
  days: DayPlan[];
  totalCount: number;
  completedCount: number;
}
