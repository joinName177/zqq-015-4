// 学习计划生成器 · 领域模型

/** 学习条目（以成语为学习内容） */
export interface StudyItem {
  id: string;
  idiom: string;
  pinyin: string;
  meaning: string;
}

/** 熟练度等级 0-5 */
export type ProficiencyLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** 间隔重复复习状态（基于 SM-2 遗忘间隔模型） */
export interface ReviewState {
  itemId: string;
  interval: number;        // 距下次复习的间隔天数
  repetitions: number;     // 连续复习次数
  easeFactor: number;      // 易度因子
  lastReviewDate: string;  // YYYY-MM-DD
  nextReviewDate: string;  // YYYY-MM-DD
}

/** 完成记录（含前后状态快照，支持回滚） */
export interface CompletionRecord {
  id: string;
  itemId: string;
  completedAt: number;
  dayKey: string;          // YYYY-MM-DD
  quality: number;         // 0-5 记忆质量
  reviewStateBefore: ReviewState;
  reviewStateAfter: ReviewState;
  proficiencyBefore: ProficiencyLevel;
  proficiencyAfter: ProficiencyLevel;
}

/** 入队原因 */
export type QueueReason = 'favorite' | 'low-proficiency' | 'due-review' | 'new' | 'starter';

/** 单条队列条目 */
export interface QueueItem {
  item: StudyItem;
  reason: QueueReason;
  priority: number;
  isCompleted: boolean;
  completionId?: string;
  dueStatus: 'overdue' | 'due-today' | 'upcoming' | 'new';
}

/** 某一天的队列 */
export interface DayQueue {
  dayKey: string;
  dateLabel: string;
  weekdayLabel: string;
  isToday: boolean;
  items: QueueItem[];
}

/** 学习计划完整状态 */
export interface StudyPlanState {
  favorites: string[];
  proficiency: Record<string, ProficiencyLevel>;
  reviewStates: Record<string, ReviewState>;
  completions: CompletionRecord[];
}

/** 学习计划统计 */
export interface StudyPlanStats {
  totalItems: number;
  favoriteCount: number;
  completedToday: number;
  dueToday: number;
  overdueCount: number;
  masteredCount: number;   // 熟练度 >= 4
  learningCount: number;   // 有复习记录但未掌握
  newCount: number;        // 从未学习
}
