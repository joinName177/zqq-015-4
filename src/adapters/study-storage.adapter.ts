// 学习计划存储适配器（localStorage 持久化，支持完成记录回滚）

import { StudyStoragePort } from '../ports/study-storage.port';
import {
  StudyPlanState,
  ProficiencyLevel,
  CompletionRecord,
  ReviewState
} from '../core/study-models';
import { scheduleReview, createInitialReviewState } from '../core/spaced-repetition';

const STORAGE_KEY = 'study-plan-state-v1';

const EMPTY_STATE: StudyPlanState = {
  favorites: [],
  proficiency: {},
  reviewStates: {},
  completions: []
};

function clampProficiency(level: number): ProficiencyLevel {
  return Math.max(0, Math.min(5, level)) as ProficiencyLevel;
}

/** 根据记忆质量计算熟练度变化 */
function nextProficiency(prev: ProficiencyLevel, quality: number): ProficiencyLevel {
  if (quality >= 4) return clampProficiency(prev + 1);
  if (quality === 3) return prev;
  return clampProficiency(prev - 1);
}

export class StudyStorageAdapter implements StudyStoragePort {
  private state: StudyPlanState;

  constructor() {
    this.state = this.load();
  }

  load(): StudyPlanState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...EMPTY_STATE };
      const parsed = JSON.parse(raw) as Partial<StudyPlanState>;
      return {
        favorites: parsed.favorites ?? [],
        proficiency: parsed.proficiency ?? {},
        reviewStates: parsed.reviewStates ?? {},
        completions: parsed.completions ?? []
      };
    } catch {
      return { ...EMPTY_STATE };
    }
  }

  save(state: StudyPlanState): void {
    this.state = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储失败时静默降级（内存状态仍可用）
    }
  }

  getState(): StudyPlanState {
    return this.state;
  }

  toggleFavorite(itemId: string): StudyPlanState {
    const favorites = this.state.favorites.includes(itemId)
      ? this.state.favorites.filter(id => id !== itemId)
      : [...this.state.favorites, itemId];
    const next = { ...this.state, favorites };
    this.save(next);
    return next;
  }

  setProficiency(itemId: string, level: ProficiencyLevel): StudyPlanState {
    const proficiency = { ...this.state.proficiency, [itemId]: level };
    const next = { ...this.state, proficiency };
    this.save(next);
    return next;
  }

  completeItem(itemId: string, quality: number, today: string): StudyPlanState {
    const prevReview: ReviewState =
      this.state.reviewStates[itemId] ?? createInitialReviewState(itemId, today);
    const prevProf = this.state.proficiency[itemId] ?? 0;

    const nextReview = scheduleReview(prevReview, quality, today);
    const nextProf = nextProficiency(prevProf, quality);

    const record: CompletionRecord = {
      id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      itemId,
      completedAt: Date.now(),
      dayKey: today,
      quality,
      reviewStateBefore: prevReview,
      reviewStateAfter: nextReview,
      proficiencyBefore: prevProf,
      proficiencyAfter: nextProf
    };

    const next: StudyPlanState = {
      ...this.state,
      proficiency: { ...this.state.proficiency, [itemId]: nextProf },
      reviewStates: { ...this.state.reviewStates, [itemId]: nextReview },
      completions: [...this.state.completions, record]
    };
    this.save(next);
    return next;
  }

  rollbackCompletion(completionId: string): StudyPlanState {
    const record = this.state.completions.find(c => c.id === completionId);
    if (!record) return this.state;

    // 恢复完成前的复习状态与熟练度
    const reviewStates = { ...this.state.reviewStates };
    const proficiency = { ...this.state.proficiency };

    if (record.reviewStateBefore.lastReviewDate === '') {
      // 完成前无复习记录，移除该条目状态
      delete reviewStates[record.itemId];
      delete proficiency[record.itemId];
    } else {
      reviewStates[record.itemId] = record.reviewStateBefore;
      proficiency[record.itemId] = record.proficiencyBefore;
    }

    const next: StudyPlanState = {
      ...this.state,
      proficiency,
      reviewStates,
      completions: this.state.completions.filter(c => c.id !== completionId)
    };
    this.save(next);
    return next;
  }

  getRollbackableCompletions(): CompletionRecord[] {
    return [...this.state.completions].sort((a, b) => b.completedAt - a.completedAt);
  }

  resetAll(): StudyPlanState {
    const next = { ...EMPTY_STATE };
    this.save(next);
    return next;
  }
}
