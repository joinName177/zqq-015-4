import { StudyState } from '../core/study-models';
import { emptyState } from '../core/study-scheduler';
import { StudyStatePort } from '../ports/study-state.port';

const STORAGE_KEY = 'idiom-study-state-v1';

export class LocalStorageStudyAdapter implements StudyStatePort {
  constructor(private readonly storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null) {}

  load(): StudyState {
    if (!this.storage) return emptyState();
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      return this.migrate(JSON.parse(raw) as StudyState);
    } catch {
      // 数据损坏时降级为空状态，避免阻断学习
      return emptyState();
    }
  }

  save(state: StudyState): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储配额 / 隐私模式下静默失败，不影响当次使用
    }
  }

  /** 结构补全，兼容旧版本数据 */
  private migrate(raw: StudyState): StudyState {
    return {
      favorites: Array.isArray(raw.favorites) ? raw.favorites : [],
      progress: raw.progress && typeof raw.progress === 'object' ? raw.progress : {},
      events: Array.isArray(raw.events) ? raw.events : [],
      frozenWeeks: raw.frozenWeeks && typeof raw.frozenWeeks === 'object' ? raw.frozenWeeks : {}
    };
  }
}
